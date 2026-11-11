"""SmartSorter - API d'analyse de déchets par vision et par texte."""
import hashlib
import json
import math
import os
import threading
import time
from collections import defaultdict, deque
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
import httpx
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from pydantic import BaseModel

load_dotenv()

RULES = json.loads((Path(__file__).parent / "rules.json").read_text(encoding="utf-8"))

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DETAIL = os.getenv("OPENAI_DETAIL", "low")  # "low" (économique) ou "high" (verre transparent)
MAX_PER_MIN = int(os.getenv("MAX_SCANS_PER_MIN", "10"))
MAX_PER_DAY = int(os.getenv("MAX_SCANS_PER_DAY", "500"))
MAX_IMAGE_BYTES = 1_500_000
MAX_OBJETS = 5
ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
ALLOWED_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
)

app = FastAPI(title="SmartSorter API")
app.add_middleware(
    CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"]
)

# --------------------------------------------------------------------------- #
# Prompt
# --------------------------------------------------------------------------- #
BAC_KEYS = list(RULES["bacs"].keys())

SYSTEM_PROMPT = f"""Tu es un expert du tri des déchets en France. Tu analyses une photo (ou une description écrite de l'objet) et tu réponds UNIQUEMENT par un objet JSON, en français.

Format :
{{"objets": [{{"nom": "bouteille d'eau en plastique", "matiere": "plastique|verre|carton|papier|organique|metal|textile|electronique|autre", "bac": "<une clé parmi {BAC_KEYS}>", "recyclabilite": 0-100, "conseil": "geste concret, ex: garde le bouchon vissé", "alternative": "option plus durable, ou chaîne vide"}}], "message": ""}}

Consignes :
- Liste séparément chaque objet distinct visible (ex: bouteille ET bouchon si les gestes diffèrent).
- {MAX_OBJETS} objets maximum, les plus visibles d'abord.
- "recyclabilite" : part réellement recyclée si le geste est correct (verre propre ~100, barquette multicouche ~40, couche ou mouchoir 0).
- Si la photo ne montre aucun déchet identifiable, renvoie "objets": [] et explique en une phrase dans "message".
- Sois bref : conseil et alternative tiennent en une phrase chacun.
- Le verre transparent est difficile à voir : repère les reflets, le goulot, les bords, l'étiquette, le contenu. Un bocal ou une bouteille transparente vide est du verre, même s'il se distingue mal du fond.
- L'objet posé au centre de l'image est le sujet principal. En cas de doute, donne ta meilleure hypothèse plutôt qu'une liste vide. Ne renvoie "objets": [] que si aucun objet n'est visible.
- Un couvercle ou une capsule en métal se jette dans le bac jaune, séparément du bocal en verre.

Règles de tri à appliquer :
{json.dumps(RULES["regles"], ensure_ascii=False, indent=1)}

Description des bacs :
{json.dumps({k: v["description"] for k, v in RULES["bacs"].items()}, ensure_ascii=False, indent=1)}
"""

# --------------------------------------------------------------------------- #
# Garde-fous (budget API)
# --------------------------------------------------------------------------- #
_hits: dict[str, deque] = defaultdict(deque)
_daily = {"day": date.today().isoformat(), "count": 0}
_cache: dict[str, dict] = {}
_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise HTTPException(500, "OPENAI_API_KEY manquante côté serveur.")
        _client = OpenAI(api_key=key)
    return _client


def check_limits(ip: str) -> None:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= MAX_PER_MIN:
        raise HTTPException(429, "Trop de scans à la suite. Attends quelques secondes.")
    today = date.today().isoformat()
    if _daily["day"] != today:
        _daily.update(day=today, count=0)
    if _daily["count"] >= MAX_PER_DAY:
        raise HTTPException(429, "Limite quotidienne de scans atteinte.")
    q.append(now)


def validate_image(data_url: str) -> None:
    if not data_url.startswith(ALLOWED_PREFIXES):
        raise HTTPException(400, "Format d'image invalide (JPEG, PNG ou WebP).")
    if len(data_url) * 3 // 4 > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image trop lourde. Réduis sa taille.")


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def remember(key: str, result: dict) -> None:
    if len(_cache) > 200:
        _cache.clear()
    _cache[key] = result


# --------------------------------------------------------------------------- #
# Enrichissement : on ne fait jamais confiance au modèle pour les couleurs ni le CO2
# --------------------------------------------------------------------------- #
def enrich(raw: dict) -> dict:
    objets = []
    for o in (raw.get("objets") or [])[:MAX_OBJETS]:
        bac = o.get("bac") if o.get("bac") in RULES["bacs"] else "ordures_menageres"
        matiere = o.get("matiere") if o.get("matiere") in RULES["impact_co2_g"] else "autre"
        try:
            reco = max(0, min(100, int(o.get("recyclabilite", 0))))
        except (TypeError, ValueError):
            reco = 0
        info = RULES["bacs"][bac]
        objets.append(
            {
                "nom": str(o.get("nom", "Objet")),
                "matiere": matiere,
                "bac": bac,
                "bac_label": info["label"],
                "bac_couleur": info["couleur"],
                "recyclabilite": reco,
                "conseil": str(o.get("conseil", "")),
                "alternative": str(o.get("alternative", "")),
                "co2_g": RULES["impact_co2_g"].get(matiere, 0) if info["valorise"] else 0,
            }
        )
    return {
        "objets": objets,
        "co2_total_g": sum(o["co2_g"] for o in objets),
        "message": str(raw.get("message", "")),
    }


def run_model(user_content) -> dict:
    """Appel commun à l'image et au texte : même prompt, même enrichissement."""
    try:
        r = get_client().chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )
        raw = json.loads(r.choices[0].message.content)
    except HTTPException:
        raise
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(502, "Le service d'analyse ne répond pas. Réessaie.") from e
    _daily["count"] += 1
    return enrich(raw)


# --------------------------------------------------------------------------- #
# Points de collecte (OpenStreetMap via Overpass : gratuit, sans clé)
# --------------------------------------------------------------------------- #
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
RADII_M = (3000, 10000)  # on élargit automatiquement si rien à 3 km
MAX_POINTS = 8
GEO_TTL = 3600
GEO_MAX_PER_MIN = 20

COLLECTE_TYPES = {
    "piles": {
        "label": "Piles et ampoules",
        "fallback": "Point de collecte piles et ampoules",
        "filters": ['["recycling:batteries"="yes"]', '["recycling:light_bulbs"="yes"]'],
    },
    "electro": {
        "label": "Appareils électriques",
        "fallback": "Point de collecte d'appareils électriques",
        "filters": [
            '["recycling:electrical_items"="yes"]',
            '["recycling:small_appliances"="yes"]',
            '["recycling:electrical_appliances"="yes"]',
        ],
    },
    "textile": {
        "label": "Textile et chaussures",
        "fallback": "Borne de collecte textile",
        "filters": ['["recycling:clothes"="yes"]', '["recycling:shoes"="yes"]'],
    },
    "medicaments": {
        "label": "Médicaments (pharmacie)",
        "fallback": "Pharmacie",
        "filters": ['["amenity"="pharmacy"]'],
    },
    "verre": {
        "label": "Verre",
        "fallback": "Colonne à verre",
        "filters": [
            '["amenity"="recycling"]["recycling:glass_bottles"="yes"]',
            '["amenity"="recycling"]["recycling:glass"="yes"]',
        ],
    },
    "decheterie": {
        "label": "Déchèterie",
        "fallback": "Déchèterie",
        "filters": ['["amenity"="recycling"]["recycling_type"="centre"]'],
    },
}

_geo_hits: dict[str, deque] = defaultdict(deque)
GEO_CACHE_FILE = Path(__file__).parent / "geo_cache.json"
_geo_lock = threading.Lock()


def _load_geo_cache() -> dict[str, list]:
    try:
        return json.loads(GEO_CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_geo_cache() -> None:
    try:
        GEO_CACHE_FILE.write_text(json.dumps(_geo_cache, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


# Cache sur disque : survit aux redémarrages et sert de secours si Overpass est saturé.
# Clé "type|lat|lon" (arrondie à ~1 km) -> [horodatage, éléments, rayon]
_geo_cache: dict[str, list] = _load_geo_cache()


def check_geo_limit(ip: str) -> None:
    now = time.time()
    q = _geo_hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= GEO_MAX_PER_MIN:
        raise HTTPException(429, "Trop de recherches à la suite. Attends quelques secondes.")
    q.append(now)


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * 6371000 * math.asin(math.sqrt(a)))


def build_query(filters: list[str], lat: float, lon: float, radius: int) -> str:
    body = "".join(f"nwr{f}(around:{radius},{lat},{lon});" for f in filters)
    return f"[out:json][timeout:12];({body});out tags center 60;"


def overpass(query: str) -> list[dict]:
    """Interroge les miroirs Overpass. Une réponse vide avec un 'remark' est un échec, pas « 0 résultat »."""
    for url in OVERPASS_URLS:
        try:
            r = httpx.post(
                url,
                data={"data": query},
                headers={"User-Agent": "SmartSorter-hackathon/0.1"},
                timeout=httpx.Timeout(12, connect=4),
            )
        except httpx.HTTPError as e:
            print(f"[overpass] {url} injoignable : {e!r}")
            continue
        if r.status_code != 200:
            print(f"[overpass] {url} -> HTTP {r.status_code} : {r.text[:200]!r}")
            continue
        try:
            data = r.json()
        except ValueError:
            print(f"[overpass] {url} : réponse non JSON : {r.text[:200]!r}")
            continue
        if data.get("remark"):
            print(f"[overpass] {url} remark : {data['remark']}")
            continue
        return data.get("elements", [])
    raise HTTPException(502, "Service de cartographie surchargé. Réessaie dans un instant.")


def fetch_elements(kind: str, lat: float, lon: float) -> tuple[list[dict], int]:
    key = f"{kind}|{lat:.2f}|{lon:.2f}"
    # Une seule requête Overpass à la fois : on ne martèle pas un serveur déjà saturé.
    with _geo_lock:
        hit = _geo_cache.get(key)
        if hit and time.time() - hit[0] < GEO_TTL:
            return hit[1], hit[2]
        try:
            elements: list[dict] = []
            radius = RADII_M[0]
            for radius in RADII_M:
                elements = overpass(build_query(COLLECTE_TYPES[kind]["filters"], lat, lon, radius))
                if elements:
                    break
        except HTTPException:
            if hit:  # serveurs saturés : un résultat un peu ancien vaut mieux que rien
                return hit[1], hit[2]
            raise
        if len(_geo_cache) > 300:
            _geo_cache.clear()
        _geo_cache[key] = [time.time(), elements, radius]
        _save_geo_cache()
        return elements, radius


def to_point(el: dict, spec: dict, lat: float, lon: float) -> dict | None:
    tags = el.get("tags", {})
    plat = el.get("lat", (el.get("center") or {}).get("lat"))
    plon = el.get("lon", (el.get("center") or {}).get("lon"))
    if plat is None or plon is None:
        return None
    street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
    address = ", ".join(filter(None, [street, tags.get("addr:city", "")]))
    return {
        "nom": tags.get("name") or tags.get("operator") or spec["fallback"],
        "adresse": address,
        "horaires": tags.get("opening_hours", ""),
        "lat": plat,
        "lon": plon,
        "distance_m": distance_m(lat, lon, plat, plon),
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
class Scan(BaseModel):
    image: str  # data URL base64


class Search(BaseModel):
    query: str


@app.get("/api/health")
def health():
    return {"ok": True, "model": MODEL, "detail": DETAIL, "scans_today": _daily["count"]}


@app.post("/api/analyze")
def analyze(scan: Scan, request: Request):
    validate_image(scan.image)

    key = hashlib.sha256(scan.image.encode()).hexdigest()
    if key in _cache:
        return _cache[key]

    check_limits(client_ip(request))
    result = run_model(
        [{"type": "image_url", "image_url": {"url": scan.image, "detail": DETAIL}}]
    )
    remember(key, result)
    return result


@app.post("/api/search")
def search(body: Search, request: Request):
    q = " ".join(body.query.split())[:100]
    if len(q) < 2:
        raise HTTPException(400, "Décris l'objet en quelques mots.")

    key = "txt:" + q.lower()
    if key in _cache:
        return _cache[key]

    check_limits(client_ip(request))
    result = run_model(
        f"Il n'y a pas de photo : l'utilisateur décrit l'objet en texte : « {q} ». "
        "Applique les mêmes consignes et le même format JSON. "
        "Si la description est ambiguë (ex : « bouteille »), choisis le cas le plus courant "
        "et mentionne l'autre cas dans le conseil. "
        "Si le texte ne désigne ni un objet ni un déchet, renvoie \"objets\": [] "
        "avec une phrase dans \"message\"."
    )
    remember(key, result)
    return result


@app.get("/api/collecte")
def collecte(
    request: Request,
    kind: str = Query(alias="type"),
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
):
    spec = COLLECTE_TYPES.get(kind)
    if spec is None:
        raise HTTPException(400, "Type de point de collecte inconnu.")
    check_geo_limit(client_ip(request))

    elements, radius = fetch_elements(kind, lat, lon)
    points = [p for p in (to_point(el, spec, lat, lon) for el in elements) if p]
    points.sort(key=lambda p: p["distance_m"])
    return {"type": kind, "label": spec["label"], "rayon_m": radius, "points": points[:MAX_POINTS]}