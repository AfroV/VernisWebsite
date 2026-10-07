"""Build web scene images + screens.json from the photographer's originals.

Usage (from repo root):
  tools/.venv/bin/python -m tools.photos.build            # all scenes
  tools/.venv/bin/python -m tools.photos.build --only canal-23
  tools/.venv/bin/python -m tools.photos.build --redetect canal-23
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from tools.photos.detect import detect_corners
from tools.photos.imaging import export_variants, load_upright
from tools.photos.scenes import load_scenes, merge_scene, save_scenes

ROOT = Path(__file__).resolve().parents[2]
SELECTION = ROOT / "tools/photos/selection.json"
SCENES_JSON = ROOT / "data/screens.json"
OUT_IMAGES = ROOT / "images/scenes"
CHECK = ROOT / "tools/photos/out/check.jpg"
BUDGET = 15e6  # bytes for all web scene images


def _checker(size=400):
    tile = np.indices((8, 8)).sum(0) % 2
    board = np.kron(tile, np.ones((size // 8, size // 8)))
    rgb = np.stack([board * 230 + 20, board * 200 + 50, board * 120 + 100], -1).astype(np.uint8)
    return rgb


# status → (banner colour, label suffix); "ok" = hand-verified corners already in screens.json
_BANNER = {
    "ok": ((255, 230, 0), ""),
    "AUTO — VERIFY": ((255, 150, 0), "  AUTO - VERIFY IN CALIBRATE"),  # ASCII: default PIL font lacks the em dash
    "NEEDS CALIBRATION": ((255, 80, 80), "  NEEDS CALIBRATION"),
}


def _check_tile(img: Image.Image, corners, label: str, status: str) -> Image.Image:
    thumb = img.copy()
    thumb.thumbnail((600, 600))
    w, h = thumb.size
    arr = np.asarray(thumb).copy()
    if corners:
        dst = np.float32([[x * w, y * h] for x, y in corners])
        board = _checker()
        src = np.float32([[0, 0], [400, 0], [400, 400], [0, 400]])
        warped = cv2.warpPerspective(board, cv2.getPerspectiveTransform(src, dst), (w, h))
        mask = cv2.warpPerspective(np.full((400, 400), 255, np.uint8), cv2.getPerspectiveTransform(src, dst), (w, h))
        arr[mask > 0] = (0.35 * arr[mask > 0] + 0.65 * warped[mask > 0]).astype(np.uint8)
    tile = Image.fromarray(arr)
    d = ImageDraw.Draw(tile)
    if corners:
        d.polygon([(x * w, y * h) for x, y in corners], outline=(255, 0, 0), width=2)
    colour, suffix = _BANNER[status]
    d.rectangle([0, 0, 300, 22], fill=colour)
    d.text((4, 4), label + suffix, fill=(0, 0, 0))
    return tile


def _contact_sheet(tiles):
    cols = 5
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 600, rows * 600), (255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 600, (i // cols) * 600))
    CHECK.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CHECK, quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--redetect")
    args = ap.parse_args()

    sel = json.loads(SELECTION.read_text())
    data = load_scenes(SCENES_JSON)
    known = {s["id"]: s for s in data["scenes"]}
    tiles = []
    for item in sel["scenes"]:
        sid = item["id"]
        if args.only and sid != args.only:
            continue
        img = load_upright(ROOT / sel["sourceDir"] / item["source"])
        export_variants(img, sid, OUT_IMAGES)
        force = args.redetect == sid
        have = known.get(sid, {}).get("corners")
        corners = have if have and not force else detect_corners(img)
        entry = {
            "id": sid, "src": f"images/scenes/{sid}", "w": img.width, "h": img.height,
            "corners": corners, "originalArt": item["originalArt"], "tags": item["tags"], "alt": item["alt"],
        }
        data = merge_scene(data, entry, force=force)
        final = next(s for s in data["scenes"] if s["id"] == sid)["corners"]
        if not final:
            status = "NEEDS CALIBRATION"
        elif have and not force:
            status = "ok"
        else:
            status = "AUTO — VERIFY"  # detected this run: unreliable until checked
        print(f"{sid:16s} {status}")
        tiles.append(_check_tile(img, final, sid, status))
    save_scenes(SCENES_JSON, data)
    _contact_sheet(tiles)
    total = sum(p.stat().st_size for p in OUT_IMAGES.glob("*.*"))
    print(f"images/scenes total: {total / 1e6:.1f} MB  ·  check sheet: {CHECK.relative_to(ROOT)}")
    if total > BUDGET:
        print("WARNING: images/scenes exceeds 15 MB budget — see tools/README.md")


if __name__ == "__main__":
    main()
