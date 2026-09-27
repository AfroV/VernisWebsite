# Vernis local tools

## Setup (once)
    python3 -m venv tools/.venv && tools/.venv/bin/pip install -r tools/requirements.txt

## Add a new photo
1. Put the original in `images/originals/<folder>/` (git-ignored — never commit originals).
2. Add an entry to `tools/photos/selection.json` (`source`, `id`, `originalArt`, `tags`, `alt`).
3. Run `tools/.venv/bin/python -m tools.photos.build --only <id>`.
4. Open `tools/photos/out/check.jpg`. If the red outline is off or it says NEEDS CALIBRATION, calibrate.

## Calibrate screen corners
1. `python3 -m http.server 8765` from the repo root.
2. Open http://localhost:8765/tools/calibrate.html (Chrome recommended — saves directly).
3. Pick the scene, drag the four corners onto the inner edge of the screen, Save → `data/screens.json`.
Hand-tuned corners are never overwritten by the build (use `--redetect <id>` to force).

## Tests
    tools/.venv/bin/python -m pytest tools/photos/tests -q
    node --test tools/tests/*.test.mjs
