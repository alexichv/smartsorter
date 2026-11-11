"""Teste l'API sur un dossier de photos.

Usage (serveur lancé sur :8000) :
    python scripts/batch_test.py ../test_images
"""
import base64
import mimetypes
import sys
from pathlib import Path

import httpx

URL = "http://localhost:8000/api/analyze"


def main(folder: str) -> None:
    files = sorted(p for p in Path(folder).iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    for p in files:
        mime = mimetypes.guess_type(p)[0] or "image/jpeg"
        data_url = f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"
        r = httpx.post(URL, json={"image": data_url}, timeout=60)
        if r.status_code != 200:
            print(f"{p.name:30} ERREUR {r.status_code} {r.text}")
            continue
        for o in r.json()["objets"]:
            print(f"{p.name:30} {o['nom']:35} -> {o['bac_label']:18} {o['recyclabilite']:3}%")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "test_images")
