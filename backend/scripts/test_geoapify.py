"""Teste l'API Geoapify directement, sans passer par l'appli.

Usage, depuis le dossier backend :
    python scripts/test_geoapify.py TA_CLE_GEOAPIFY [latitude] [longitude]
"""
import json
import sys
import time

import httpx

key = sys.argv[1]
lat = float(sys.argv[2]) if len(sys.argv) > 2 else 48.3705
lon = float(sys.argv[3]) if len(sys.argv) > 3 else -4.5287

URL = "https://api.geoapify.com/v2/places"
TESTS = {"pharmacies": "healthcare.pharmacy", "points de recyclage": "service.recycling"}

for label, category in TESTS.items():
    params = {
        "categories": category,
        "filter": f"circle:{lon},{lat},3000",  # attention : longitude d'abord
        "bias": f"proximity:{lon},{lat}",
        "limit": 5,
        "apiKey": key,
    }
    t = time.time()
    r = httpx.get(URL, params=params, timeout=15)
    print(f"\n=== {label} : HTTP {r.status_code} en {time.time() - t:.1f}s")
    if r.status_code != 200:
        print(r.text[:300])
        continue
    features = r.json().get("features", [])
    print(f"{len(features)} résultat(s)")
    for f in features[:3]:
        p = f["properties"]
        print(json.dumps({k: p.get(k) for k in ("name", "address_line2", "distance", "opening_hours", "categories")}, ensure_ascii=False))
        raw = (p.get("datasource") or {}).get("raw", {})
        tags = {k: v for k, v in raw.items() if k.startswith("recycling") or k in ("amenity", "recycling_type")}
        print("   tags OSM :", tags or "(aucun trouvé)")
