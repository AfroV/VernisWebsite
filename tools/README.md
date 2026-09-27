# Vernis local tools

## Setup (once)
    python3 -m venv tools/.venv && tools/.venv/bin/pip install -r tools/requirements.txt

## Add a new photo
1. Put the original in `images/originals/<folder>/` (git-ignored — never commit originals).
2. Add an entry to `tools/photos/selection.json` (`source`, `id`, `originalArt`, `tags`, `alt`).
3. Run `tools/.venv/bin/python -m tools.photos.build --only <id>`.
4. **Always open `tools/photos/out/check.jpg`.** Banner colours: yellow = hand-calibrated
   corners from `data/screens.json`; orange `AUTO - VERIFY IN CALIBRATE` = detected this run;
   red = NEEDS CALIBRATION. AUTO — VERIFY quads are unreliable (the detector returned
   confident wrong quads on all 14 original photos): calibrate every new photo.

## Calibrate screen corners
1. `python3 -m http.server 8765` from the repo root.
2. Open http://localhost:8765/tools/calibrate.html (Chrome recommended — saves directly).
3. Pick the scene, drag the four corners onto the inner edge of the screen, Save → `data/screens.json`.
Hand-tuned corners are never overwritten by the build (use `--redetect <id>` to force).

Alternative: measure the corners on zoomed crops of `images/scenes/<id>-2400.jpg` and edit
`data/screens.json` directly — `corners` are normalized `[x, y]` (pixel / image width or
height), order TL, TR, BR, BL.

## Image budget
All of `images/scenes/` should stay under ~15 MB; the build prints a WARNING above that.
The main lever is JPEG quality in `tools/photos/imaging.py` (`quality=82` → `78`), then
rebuild.

## Tests (Node 22+)
    tools/.venv/bin/python -m pytest tools/photos/tests -q
    node --test tools/tests/*.test.mjs
