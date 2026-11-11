"""Pré-charge les points de collecte de ta zone de démo (stockés dans geo_cache.json).

Usage, depuis le dossier backend :
    python scripts/warm_cache.py LATITUDE LONGITUDE

Relance automatiquement les types qui échouent (serveurs saturés).
Laisse tourner jusqu'à ce que tout soit "OK", puis garde le fichier geo_cache.json.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException  # noqa: E402

import main  # noqa: E402

lat, lon = float(sys.argv[1]), float(sys.argv[2])
pending = list(main.COLLECTE_TYPES)

for attempt in range(1, 11):
    for kind in list(pending):
        try:
            elements, radius = main.fetch_elements(kind, lat, lon)
            print(f"OK     {kind:12} {len(elements):3} résultats (rayon {radius} m)")
            pending.remove(kind)
        except HTTPException:
            print(f"ÉCHEC  {kind}")
    if not pending:
        print("Tout est en cache.")
        break
    print(f"Tentative {attempt}/10 terminée. Nouvelle tentative dans 30 s ({len(pending)} types restants)...")
    time.sleep(30)
else:
    print("Certains types n'ont pas pu être chargés. Relance le script plus tard.")