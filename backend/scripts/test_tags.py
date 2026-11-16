"""Vérifie si des points textile / piles / électro existent autour de toi (données Geoapify).

Usage, depuis le dossier backend :
    python scripts/test_tags.py TA_CLE_GEOAPIFY [latitude] [longitude]

Coût : environ 50 crédits sur tes 3 000 par jour.
"""
import sys

import httpx

key = sys.argv[1]
lat = float(sys.argv[2]) if len(sys.argv) > 2 else 48.3705
lon = float(sys.argv[3]) if len(sys.argv) > 3 else -4.5287
LIMIT = 500
TAGS = [
    "recycling:clothes", "recycling:shoes",
    "recycling:batteries", "recycling:light_bulbs",
    "recycling:electrical_items", "recycling:small_appliances", "recycling:electrical_appliances",
    "recycling:glass_bottles", "recycling:glass",
]

for radius in (3000, 10000):
    r = httpx.get(
        "https://api.geoapify.com/v2/places",
        params={
            "categories": "service.recycling",
            "filter": f"circle:{lon},{lat},{radius}",
            "bias": f"proximity:{lon},{lat}",
            "limit": LIMIT,
            "apiKey": key,
        },
        timeout=30,
    )
    if r.status_code != 200:
        print(f"Rayon {radius} m : HTTP {r.status_code} {r.text[:200]}")
        continue
    features = r.json().get("features", [])
    truncated = " (limite atteinte : il y en a peut-être davantage)" if len(features) >= LIMIT else ""
    print(f"\nRayon {radius} m : {len(features)} points de recyclage{truncated}")
    raws = [(f["properties"].get("datasource") or {}).get("raw") or {} for f in features]
    for tag in TAGS:
        n = sum(1 for raw in raws if raw.get(tag) == "yes")
        print(f"  {tag:34} {n}")
    centres = sum(1 for f in features if "service.recycling.centre" in f["properties"].get("categories", []))
    print(f"  {'déchèteries':34} {centres}")
