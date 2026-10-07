# Photo Pipeline + Screen Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the photographer's 34-photo shoot into 14 web-ready, metadata-free scene images plus measured screen corners (`data/screens.json`), a shared perspective-warp JS module, and a local calibration tool.

**Architecture:** A local Python script (`tools/photos/build.py`, Pillow + OpenCV in a git-ignored venv) exports image variants and auto-detects the display quad, merging into `data/screens.json` without ever overwriting hand-tuned corners. A dependency-free ES module (`js/screen-warp.js`) computes a homography and applies it as CSS `matrix3d` so any `<img>/<video>/<canvas>` sits on the screen in perspective. `tools/calibrate.html` uses that same module to let the operator drag corners and save the JSON.

**Tech Stack:** Python 3.11, Pillow, opencv-python-headless, numpy, pytest; vanilla JS ES modules; Node 22 `node --test`; Playwright MCP for browser verification.

**Spec:** `docs/superpowers/specs/2026-09-27-photo-pipeline-design.md`

## Global Constraints

- Work on branch `photo-pipeline`. Never commit to `main`. Show the diff to the user before each commit (CLAUDE.md).
- Originals (`images/originals/`), `tools/.venv/`, `tools/photos/out/`, `.playwright-mcp/` are git-ignored and never staged.
- Web images carry **no EXIF/GPS/XMP**; colors converted to sRGB with only the sRGB ICC profile embedded (iPhone originals are Display P3).
- Output: `images/scenes/<id>-{800,1600,2400}.{webp,jpg}` (long edge). WebP q=80, JPEG q=82 progressive.
- Total committed weight of `images/scenes/` should stay under ~15 MB; if over, lower JPEG q to 78 before anything else.
- `data/screens.json` corners: normalized `[x, y]`, order TL, TR, BR, BL; `null` = needs calibration. Existing non-null corners are **never** overwritten by the build (only `--redetect <id>`).
- No new runtime dependencies on the public site. Site code is vanilla JS, no build step.
- Alt text and code comments in English (site language).

## Review Focus

1. **Photos with art or reflections on screen (28, 29, 31, 32, 23, 24)** — detection may fail; expected: `corners: null` and a clear "NEEDS CALIBRATION" line, never a wrong-but-confident quad on the frame's outer edge. Pinned by the "bright screen" and "no screen" tests in Task 3.
2. **Re-running the build after hand calibration** — expected: hand-tuned corners survive. Pinned by `test_merge_keeps_existing_corners` in Task 3.
3. **Resizing the browser / image loading late** — expected: warp re-applies when the image box changes or finishes loading. Pinned by the `computeWarp` scaling test in Task 2 and the resize check in Task 4.
4. **EXIF orientation 3 and 6 (upside-down / rotated shots)** — expected: exported images and corners in upright space. Pinned by `test_load_upright_applies_orientation` in Task 1.
5. **Non-square user art / video in the calibration tool** — expected: covers the square screen (`object-fit: cover`), video plays muted and looped. Checked in Task 4 step 5.

---

## File Structure

| Path | Responsibility |
|---|---|
| `.gitignore` | add ignore entries |
| `tools/requirements.txt` | Python deps for the local tool |
| `tools/photos/selection.json` | which originals become which scene id (+ tags, alt) |
| `tools/photos/imaging.py` | load upright, sRGB, strip metadata, export variants |
| `tools/photos/detect.py` | find the display quad in a photo |
| `tools/photos/scenes.py` | read/merge/write `data/screens.json` |
| `tools/photos/build.py` | CLI: glue + verification contact sheet |
| `tools/photos/tests/test_*.py` | pytest |
| `js/screen-warp.js` | homography + CSS matrix3d + `attachWarp` (public, shared with sub-project B) |
| `tools/tests/screen-warp.test.mjs` | node tests |
| `tools/calibrate.html`, `tools/calibrate.js`, `tools/calibrate.css` | local calibration tool |
| `tools/README.md` | how the operator adds a photo / recalibrates |
| `data/screens.json` | generated + hand-tuned scene data |
| `images/scenes/*` | generated web images |

---

### Task 1: Repo hygiene, venv, and image export

**Files:**
- Modify: `.gitignore`
- Create: `tools/requirements.txt`, `tools/photos/selection.json`, `tools/photos/imaging.py`, `tools/photos/tests/test_imaging.py`, `tools/photos/__init__.py`, `tools/photos/tests/__init__.py`

**Interfaces:**
- Produces: `load_upright(path: Path) -> PIL.Image.Image` (RGB, sRGB, upright, no metadata); `export_variants(img, scene_id: str, out_dir: Path) -> list[Path]`; `SIZES = (800, 1600, 2400)`.

- [ ] **Step 1: Move originals and extend .gitignore**

```bash
cd /Users/sharthansimoons/Kode/VernisWebsite
mkdir -p images/originals
mv images/wetransfer_kunstramme-jpeg_2026-09-26_1630 images/originals/kunstramme-2026-09-26   # untracked, plain mv
ls images/originals/kunstramme-2026-09-26 | wc -l   # expect 34
```

Append to `.gitignore`:

```gitignore

# Photo originals (large, contain GPS EXIF) + local tooling output
images/originals/
tools/.venv/
tools/photos/out/
.playwright-mcp/
__pycache__/
```

- [ ] **Step 2: venv + deps**

`tools/requirements.txt`:

```
pillow>=10.3
opencv-python-headless>=4.9
numpy>=1.26
pytest>=8
```

```bash
python3 -m venv tools/.venv && tools/.venv/bin/pip install -q -r tools/requirements.txt
touch tools/photos/__init__.py tools/photos/tests/__init__.py
```

- [ ] **Step 3: selection.json**

`tools/photos/selection.json` (source dir relative to repo root):

```json
{
  "sourceDir": "images/originals/kunstramme-2026-09-26",
  "scenes": [
    {"source": "image00019.jpeg", "id": "oslo-view-19", "originalArt": false, "tags": ["hero"], "alt": "Vernis frame on a table in front of a wide view over Oslo"},
    {"source": "image00020.jpeg", "id": "oslo-view-20", "originalArt": false, "tags": ["hero"], "alt": "Vernis frame on a table overlooking the Oslo fjord"},
    {"source": "image00021.jpeg", "id": "oslo-view-21", "originalArt": false, "tags": ["hero"], "alt": "Vernis frame by a window above the Oslo Opera House"},
    {"source": "image00009.jpeg", "id": "shelf-wide-09", "originalArt": false, "tags": ["wide", "lifestyle"], "alt": "Vernis frame on an oak shelf between a green glass vase and a candle"},
    {"source": "image00001.jpeg", "id": "shelf-01", "originalArt": false, "tags": ["lifestyle"], "alt": "Vernis frame on an oak shelf against a concrete wall"},
    {"source": "image00012.jpeg", "id": "shelf-12", "originalArt": false, "tags": ["lifestyle"], "alt": "Vernis frame beside a green glass vase on a shelf"},
    {"source": "image00023.jpeg", "id": "canal-23", "originalArt": false, "tags": ["lifestyle"], "alt": "Vernis frame on a bench by a canal between apartment buildings"},
    {"source": "image00024.jpeg", "id": "canal-24", "originalArt": false, "tags": ["lifestyle"], "alt": "Vernis frame in low sun by a city canal"},
    {"source": "image00033.jpeg", "id": "angle-33", "originalArt": false, "tags": ["product"], "alt": "Vernis metal frame seen from an angle on a wooden surface"},
    {"source": "image00034.jpeg", "id": "angle-34", "originalArt": false, "tags": ["product"], "alt": "Side view of the Vernis metal frame showing its depth and ports"},
    {"source": "image00028.jpeg", "id": "grass-art-28", "originalArt": true, "tags": ["lifestyle"], "alt": "Vernis frame displaying artwork among grass by a canal"},
    {"source": "image00029.jpeg", "id": "plant-art-29", "originalArt": true, "tags": ["lifestyle"], "alt": "Vernis frame displaying artwork next to a green plant"},
    {"source": "image00031.jpeg", "id": "canal-art-31", "originalArt": true, "tags": ["lifestyle"], "alt": "Vernis frame displaying colourful artwork by a canal"},
    {"source": "image00032.jpeg", "id": "canal-art-32", "originalArt": true, "tags": ["lifestyle"], "alt": "Close view of Vernis frame displaying colourful artwork"}
  ]
}
```

- [ ] **Step 4: Write failing tests** — `tools/photos/tests/test_imaging.py`

```python
from pathlib import Path
from PIL import Image
from tools.photos.imaging import load_upright, export_variants, SIZES


def _jpeg_with_orientation(tmp_path: Path, orientation: int) -> Path:
    img = Image.new("RGB", (400, 200), (200, 50, 50))  # wide
    exif = Image.Exif()
    exif[274] = orientation          # Orientation
    exif[0x010F] = "Apple"           # Make — must not survive
    p = tmp_path / f"o{orientation}.jpg"
    img.save(p, exif=exif.tobytes())
    return p


def test_load_upright_applies_orientation(tmp_path):
    img = load_upright(_jpeg_with_orientation(tmp_path, 6))
    assert img.size == (200, 400)
    img3 = load_upright(_jpeg_with_orientation(tmp_path, 3))
    assert img3.size == (400, 200)


def test_load_upright_strips_metadata(tmp_path):
    img = load_upright(_jpeg_with_orientation(tmp_path, 6))
    assert len(img.getexif()) == 0
    assert "exif" not in img.info


def test_export_variants_sizes_and_no_exif(tmp_path):
    src = Image.new("RGB", (3000, 4000), (10, 120, 200))
    paths = export_variants(src, "demo", tmp_path)
    assert len(paths) == len(SIZES) * 2
    for size in SIZES:
        for ext in ("webp", "jpg"):
            p = tmp_path / f"demo-{size}.{ext}"
            assert p.exists()
            with Image.open(p) as out:
                assert max(out.size) == size
                assert len(out.getexif()) == 0
                assert 274 not in out.getexif()
```

- [ ] **Step 5: Run — expect FAIL (ModuleNotFoundError)**

Run: `tools/.venv/bin/python -m pytest tools/photos/tests/test_imaging.py -q`

- [ ] **Step 6: Implement** — `tools/photos/imaging.py`

```python
"""Load photographer originals upright in sRGB and export metadata-free web variants."""
import io
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

SIZES = (800, 1600, 2400)
_SRGB = ImageCms.createProfile("sRGB")
_SRGB_BYTES = ImageCms.ImageCmsProfile(_SRGB).tobytes()


def load_upright(path: Path) -> Image.Image:
    """Return an upright RGB sRGB copy with no metadata attached."""
    with Image.open(path) as src:
        src.load()
        icc = src.info.get("icc_profile")
        img = ImageOps.exif_transpose(src).convert("RGB")
    if icc:
        img = ImageCms.profileToProfile(
            img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), _SRGB, outputMode="RGB"
        )
    # Rebuild from raw pixels so no EXIF/XMP/GPS survives.
    clean = Image.new("RGB", img.size)
    clean.paste(img)
    return clean


def export_variants(img: Image.Image, scene_id: str, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for size in SIZES:
        variant = img.copy()
        variant.thumbnail((size, size), Image.LANCZOS)  # never upscales; originals are 5712 px
        webp = out_dir / f"{scene_id}-{size}.webp"
        jpg = out_dir / f"{scene_id}-{size}.jpg"
        variant.save(webp, "WEBP", quality=80, method=6, icc_profile=_SRGB_BYTES)
        variant.save(jpg, "JPEG", quality=82, progressive=True, optimize=True, icc_profile=_SRGB_BYTES)
        written += [webp, jpg]
    return written
```

- [ ] **Step 7: Run — expect PASS (3 passed)**

Run: `tools/.venv/bin/python -m pytest tools/photos/tests/test_imaging.py -q`

- [ ] **Step 8: Show diff to user, then commit**

```bash
git add .gitignore tools/requirements.txt tools/photos/__init__.py tools/photos/tests/__init__.py tools/photos/selection.json tools/photos/imaging.py tools/photos/tests/test_imaging.py
git status --short   # confirm nothing under images/originals or tools/.venv is staged
git commit -m "Photo pipeline: ignore originals, image export with metadata stripping"
```

---

### Task 2: `js/screen-warp.js` (homography → CSS matrix3d)

**Files:**
- Create: `js/screen-warp.js`, `tools/tests/screen-warp.test.mjs`

**Interfaces:**
- Produces (ES module exports):
  - `computeHomography(src: [x,y][4], dst: [x,y][4]) -> number[9]` (row-major, h[8] = 1)
  - `applyHomography(h: number[9], x, y) -> [x, y]`
  - `computeWarp(corners: [x,y][4] normalized, boxW: number, boxH: number, contentSize: number) -> string` (CSS `matrix3d(...)`)
  - `attachWarp(imgEl: HTMLImageElement, contentEl: HTMLElement, corners, contentSize = 1000) -> { update(corners), destroy() }`
- Contract for `attachWarp`: `imgEl` and `contentEl` are siblings inside a wrapper with `position: relative`; `imgEl` is `display:block; width:100%`. `attachWarp` sets `contentEl` to `position:absolute; left:0; top:0; width/height = contentSize px; transform-origin:0 0; transform: matrix3d(...)`.

- [ ] **Step 1: Write failing tests** — `tools/tests/screen-warp.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHomography, applyHomography, computeWarp } from '../../js/screen-warp.js';

const SQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('identity quad gives identity homography', () => {
  const h = computeHomography(SQ, SQ);
  [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => close(h[i], v));
});

test('maps the four source corners onto a perspective quad', () => {
  const dst = [[120, 80], [410, 95], [400, 390], [110, 370]];
  const h = computeHomography(SQ, dst);
  SQ.forEach((p, i) => {
    const [x, y] = applyHomography(h, p[0], p[1]);
    close(x, dst[i][0]); close(y, dst[i][1]);
  });
});

test('computeWarp maps content square onto corners scaled to the box', () => {
  const corners = [[0.25, 0.2], [0.75, 0.22], [0.74, 0.7], [0.26, 0.68]];
  for (const [w, h] of [[800, 600], [1600, 1200]]) {
    const css = computeWarp(corners, w, h, 1000);
    const m = css.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number);
    // column-major 4x4 → apply to (x, y, 0, 1)
    const project = (x, y) => {
      const X = m[0] * x + m[4] * y + m[12];
      const Y = m[1] * x + m[5] * y + m[13];
      const W = m[3] * x + m[7] * y + m[15];
      return [X / W, Y / W];
    };
    [[0, 0], [1000, 0], [1000, 1000], [0, 1000]].forEach((p, i) => {
      const [x, y] = project(p[0], p[1]);
      close(x, corners[i][0] * w, 1e-3); close(y, corners[i][1] * h, 1e-3);
    });
  }
});

test('degenerate quad throws', () => {
  assert.throws(() => computeHomography(SQ, [[0, 0], [0, 0], [0, 0], [0, 0]]));
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `node --test tools/tests/`

- [ ] **Step 3: Implement** — `js/screen-warp.js`

```js
/**
 * VERNIS - Screen warp
 * Maps square artwork onto the measured screen quad of a scene photo
 * using a homography applied as a CSS matrix3d transform.
 */

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Degenerate quad');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}

export function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

export function computeWarp(corners, boxW, boxH, contentSize) {
  const s = contentSize;
  const src = [[0, 0], [s, 0], [s, s], [0, s]];
  const dst = corners.map(([x, y]) => [x * boxW, y * boxH]);
  const [a, b, c, d, e, f, g, h] = computeHomography(src, dst);
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(',')})`;
}

export function attachWarp(imgEl, contentEl, corners, contentSize = 1000) {
  let current = corners;
  Object.assign(contentEl.style, {
    position: 'absolute', left: '0', top: '0',
    width: `${contentSize}px`, height: `${contentSize}px`,
    transformOrigin: '0 0', pointerEvents: 'none'
  });
  const apply = () => {
    const w = imgEl.clientWidth;
    const h = imgEl.clientHeight;
    if (!w || !h || !current) { contentEl.style.visibility = 'hidden'; return; }
    contentEl.style.visibility = '';
    contentEl.style.transform = computeWarp(current, w, h, contentSize);
  };
  const ro = new ResizeObserver(apply);
  ro.observe(imgEl);
  imgEl.addEventListener('load', apply);
  apply();
  return {
    update(next) { current = next; apply(); },
    destroy() { ro.disconnect(); imgEl.removeEventListener('load', apply); }
  };
}
```

- [ ] **Step 4: Run — expect PASS (4 tests)**

Run: `node --test tools/tests/`

- [ ] **Step 5: Show diff, commit**

```bash
git add js/screen-warp.js tools/tests/screen-warp.test.mjs
git commit -m "Add screen-warp module: homography to CSS matrix3d"
```

---

### Task 3: Corner detection + scenes.json merge

**Files:**
- Create: `tools/photos/detect.py`, `tools/photos/scenes.py`, `tools/photos/tests/test_detect.py`, `tools/photos/tests/test_scenes.py`

**Interfaces:**
- Produces:
  - `detect_corners(img: PIL.Image.Image) -> list[list[float]] | None` — normalized TL, TR, BR, BL, rounded to 4 decimals; `None` if not confident.
  - `order_corners(pts: np.ndarray) -> np.ndarray` (4×2, TL,TR,BR,BL)
  - `load_scenes(path) -> dict`, `merge_scene(data: dict, entry: dict, force: bool = False) -> dict`, `save_scenes(path, data)`.
  - Scene entry keys: `id, src, w, h, corners, originalArt, tags, alt` (spec §2).

- [ ] **Step 1: Write failing tests** — `tools/photos/tests/test_detect.py`

```python
import numpy as np
from PIL import Image, ImageDraw
from tools.photos.detect import detect_corners, order_corners

SCREEN = [(470, 300), (760, 315), (750, 600), (480, 585)]


def _scene(screen_fill=(12, 12, 16), with_screen=True):
    img = Image.new("RGB", (1200, 1600), (140, 138, 132))      # concrete-ish
    d = ImageDraw.Draw(img)
    d.rectangle([0, 900, 1200, 1600], fill=(170, 120, 70))     # wooden shelf
    d.polygon([(430, 260), (800, 275), (790, 640), (440, 625)], fill=(205, 180, 120))  # brass frame
    if with_screen:
        d.polygon(SCREEN, fill=screen_fill)
    return img


def test_order_corners():
    pts = np.array([[10, 10], [0, 10], [10, 0], [0, 0]], float)
    assert order_corners(pts).tolist() == [[0, 0], [10, 0], [10, 10], [0, 10]]


def test_detects_dark_screen_inside_frame():
    corners = detect_corners(_scene())
    assert corners is not None
    for (cx, cy), (ex, ey) in zip(corners, SCREEN):
        assert abs(cx - ex / 1200) < 0.01 and abs(cy - ey / 1600) < 0.01


def test_bright_screen_returns_none_not_the_outer_frame():
    # Screen showing bright art: must not report the brass frame's outer edge.
    corners = detect_corners(_scene(screen_fill=(210, 190, 140)))
    assert corners is None


def test_no_screen_returns_none():
    assert detect_corners(_scene(with_screen=False)) is None
```

`tools/photos/tests/test_scenes.py`:

```python
from tools.photos.scenes import load_scenes, merge_scene, save_scenes

E = {"id": "a", "src": "images/scenes/a", "w": 10, "h": 20, "corners": [[0, 0], [1, 0], [1, 1], [0, 1]],
     "originalArt": False, "tags": [], "alt": "x"}


def test_load_missing_file_gives_empty(tmp_path):
    assert load_scenes(tmp_path / "none.json") == {"version": 1, "scenes": []}


def test_merge_adds_new():
    data = merge_scene({"version": 1, "scenes": []}, E)
    assert data["scenes"][0]["id"] == "a"


def test_merge_keeps_existing_corners():
    tuned = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]
    data = {"version": 1, "scenes": [dict(E, corners=tuned)]}
    data = merge_scene(data, dict(E, corners=[[0, 0], [1, 0], [1, 1], [0, 1]], alt="new alt"))
    assert data["scenes"][0]["corners"] == tuned
    assert data["scenes"][0]["alt"] == "new alt"


def test_merge_force_overwrites_corners():
    data = {"version": 1, "scenes": [dict(E, corners=[[0.1, 0.1]] * 4)]}
    data = merge_scene(data, E, force=True)
    assert data["scenes"][0]["corners"] == E["corners"]


def test_merge_fills_null_corners():
    data = {"version": 1, "scenes": [dict(E, corners=None)]}
    assert merge_scene(data, E)["scenes"][0]["corners"] == E["corners"]


def test_roundtrip(tmp_path):
    p = tmp_path / "s.json"
    save_scenes(p, merge_scene({"version": 1, "scenes": []}, E))
    assert load_scenes(p)["scenes"][0]["id"] == "a"
```

- [ ] **Step 2: Run — expect FAIL (import errors)**

Run: `tools/.venv/bin/python -m pytest tools/photos/tests -q`

- [ ] **Step 3: Implement** — `tools/photos/scenes.py`

```python
"""Read, merge and write data/screens.json. Hand-tuned corners always win."""
import json
from pathlib import Path


def load_scenes(path: Path) -> dict:
    path = Path(path)
    if not path.exists():
        return {"version": 1, "scenes": []}
    return json.loads(path.read_text())


def merge_scene(data: dict, entry: dict, force: bool = False) -> dict:
    for i, existing in enumerate(data["scenes"]):
        if existing["id"] == entry["id"]:
            merged = {**existing, **entry}
            if existing.get("corners") and not force:
                merged["corners"] = existing["corners"]
            data["scenes"][i] = merged
            return data
    data["scenes"].append(entry)
    return data


def save_scenes(path: Path, data: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + "\n")
```

`tools/photos/detect.py`:

```python
"""Find the dark display quad inside the bright metal frame of a Vernis photo."""
import cv2
import numpy as np
from PIL import Image

WORK = 1200          # long edge used for detection
MIN_AREA = 0.002     # fraction of image
MAX_AREA = 0.25
MIN_CONTRAST = 40    # frame ring must be this much brighter than screen (0-255 gray)


def order_corners(pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, float).reshape(4, 2)
    s = pts.sum(1)
    d = pts[:, 1] - pts[:, 0]
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]])


def _mean_in(gray, mask):
    return float(gray[mask > 0].mean()) if mask.any() else 255.0


def _score(gray, quad):
    h, w = gray.shape
    inner = np.zeros_like(gray)
    cv2.fillConvexPoly(inner, quad.astype(np.int32), 255)
    centre = quad.mean(0)
    ring_quad = centre + (quad - centre) * 1.12
    ring = np.zeros_like(gray)
    cv2.fillConvexPoly(ring, ring_quad.astype(np.int32), 255)
    ring[inner > 0] = 0
    screen = _mean_in(gray, inner)
    frame = _mean_in(gray, ring)
    contrast = frame - screen
    x, y, bw, bh = cv2.boundingRect(quad.astype(np.int32))
    squareness = min(bw, bh) / max(bw, bh)
    if contrast < MIN_CONTRAST or squareness < 0.6:
        return None
    return contrast * squareness


def detect_corners(img: Image.Image):
    scale = WORK / max(img.size)
    small = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    gray = cv2.GaussianBlur(cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2GRAY), (5, 5), 0)
    h, w = gray.shape
    best, best_score = None, 0.0
    for thresh in (40, 60, 80, 100):
        _, mask = cv2.threshold(gray, thresh, 255, cv2.THRESH_BINARY_INV)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c) / (w * h)
            if not MIN_AREA <= area <= MAX_AREA:
                continue
            approx = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
            if len(approx) != 4 or not cv2.isContourConvex(approx):
                continue
            quad = order_corners(approx.reshape(4, 2))
            score = _score(gray, quad)
            if score and score > best_score:
                best, best_score = quad, score
    if best is None:
        return None
    return [[round(x / w, 4), round(y / h, 4)] for x, y in best]
```

- [ ] **Step 4: Run — expect PASS (all imaging, detect, scenes tests)**

Run: `tools/.venv/bin/python -m pytest tools/photos/tests -q`
If `test_detects_dark_screen_inside_frame` is off by more than 0.01, lower the `approxPolyDP` epsilon to 0.02 and re-run; do not loosen the test.

- [ ] **Step 5: Show diff, commit**

```bash
git add tools/photos/detect.py tools/photos/scenes.py tools/photos/tests/test_detect.py tools/photos/tests/test_scenes.py
git commit -m "Photo pipeline: screen corner detection and screens.json merge"
```

---

### Task 4: Calibration tool

**Files:**
- Create: `tools/calibrate.html`, `tools/calibrate.css`, `tools/calibrate.js`

**Interfaces:**
- Consumes: `attachWarp`, `computeWarp` from `js/screen-warp.js`; `data/screens.json` (spec §2); images `images/scenes/<id>-1600.jpg` and `-2400.jpg` (loupe).
- Produces: an edited `data/screens.json` (only `corners` change).

- [ ] **Step 1: Create a fixture to develop against** (until Task 5 produces real data)

```bash
mkdir -p images/scenes data
tools/.venv/bin/python -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (1200, 1600), (140,138,132)); d = ImageDraw.Draw(img)
d.polygon([(430,260),(800,275),(790,640),(440,625)], fill=(205,180,120))
d.polygon([(470,300),(760,315),(750,600),(480,585)], fill=(12,12,16))
for s in (1600, 2400): img.resize((s*3//4, s)).save(f'images/scenes/fixture-{s}.jpg')
"
cat > data/screens.json <<'JSON'
{"version": 1, "scenes": [{"id": "fixture", "src": "images/scenes/fixture", "w": 1200, "h": 1600,
 "corners": [[0.40, 0.20], [0.62, 0.20], [0.62, 0.37], [0.40, 0.37]],
 "originalArt": false, "tags": [], "alt": "fixture"}]}
JSON
```

(These fixture files are deleted in Task 5 before committing real data.)

- [ ] **Step 2: `tools/calibrate.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Vernis – Screen calibration</title>
  <link rel="stylesheet" href="calibrate.css">
</head>
<body>
  <header class="bar">
    <select id="scene"></select>
    <label>Art <select id="art"><option value="pattern">Test pattern</option><option value="file">Local file…</option><option value="none">None</option></select></label>
    <input type="file" id="file" accept="image/*,video/*" hidden>
    <label>Opacity <input type="range" id="opacity" min="0" max="1" step="0.05" value="0.85"></label>
    <span id="status"></span>
    <button id="save">Save screens.json</button>
  </header>
  <main>
    <div class="stage" id="stage">
      <img id="photo" alt="">
      <div class="art" id="art-layer"></div>
      <div class="handle" data-i="0"></div><div class="handle" data-i="1"></div>
      <div class="handle" data-i="2"></div><div class="handle" data-i="3"></div>
    </div>
    <canvas id="loupe" width="220" height="220"></canvas>
  </main>
  <p class="help">Drag the four corners onto the inner edge of the screen (TL, TR, BR, BL). Click a handle, then arrow keys nudge 1 px (Shift = 10 px).</p>
  <script type="module" src="calibrate.js"></script>
</body>
</html>
```

- [ ] **Step 3: `tools/calibrate.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
.bar { display: flex; gap: 12px; align-items: center; padding: 10px 16px; background: #1c1c1c; position: sticky; top: 0; z-index: 10; flex-wrap: wrap; }
.bar button { padding: 6px 14px; background: #c9a86a; border: 0; border-radius: 4px; cursor: pointer; }
main { display: flex; gap: 16px; padding: 16px; align-items: flex-start; }
.stage { position: relative; flex: 1; max-width: 900px; overflow: hidden; }
.stage img { display: block; width: 100%; user-select: none; -webkit-user-drag: none; }
.art { overflow: hidden; }
.art > * { width: 100%; height: 100%; object-fit: cover; display: block; }
.handle { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border: 2px solid #fff; border-radius: 50%; background: rgba(255,60,60,.5); cursor: grab; touch-action: none; }
.handle.active { background: rgba(60,200,255,.8); }
#loupe { border: 1px solid #444; image-rendering: pixelated; position: sticky; top: 70px; }
.help { padding: 0 16px 24px; color: #999; }
#status { color: #c9a86a; }
```

- [ ] **Step 4: `tools/calibrate.js`**

```js
import { attachWarp } from '../js/screen-warp.js';

const $ = (id) => document.getElementById(id);
const photo = $('photo');
const artLayer = $('art-layer');
const handles = [...document.querySelectorAll('.handle')];
const loupe = $('loupe').getContext('2d');
const hires = new Image();

let data;
let scene;
let warp;
let active = 0;

function testPattern() {
  const c = document.createElement('canvas');
  c.width = c.height = 1000;
  const g = c.getContext('2d');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    g.fillStyle = (x + y) % 2 ? '#e8e2d0' : '#2a4d6e';
    g.fillRect(x * 100, y * 100, 100, 100);
  }
  g.strokeStyle = '#ff3b30'; g.lineWidth = 12; g.strokeRect(6, 6, 988, 988);
  g.fillStyle = '#ff3b30'; g.font = 'bold 120px sans-serif'; g.fillText('TL', 30, 140);
  return c;
}

function setArt(node) {
  artLayer.replaceChildren(...(node ? [node] : []));
}

function placeHandles() {
  const w = photo.clientWidth;
  const h = photo.clientHeight;
  scene.corners.forEach(([x, y], i) => {
    handles[i].style.left = `${x * w}px`;
    handles[i].style.top = `${y * h}px`;
    handles[i].classList.toggle('active', i === active);
  });
  warp?.update(scene.corners);
}

function drawLoupe() {
  if (!hires.complete || !hires.naturalWidth) return;
  const [x, y] = scene.corners[active];
  const sx = x * hires.naturalWidth - 55;
  const sy = y * hires.naturalHeight - 55;
  loupe.imageSmoothingEnabled = false;
  loupe.clearRect(0, 0, 220, 220);
  loupe.drawImage(hires, sx, sy, 110, 110, 0, 0, 220, 220);
  loupe.strokeStyle = '#0ff';
  loupe.beginPath(); loupe.moveTo(110, 0); loupe.lineTo(110, 220); loupe.moveTo(0, 110); loupe.lineTo(220, 110); loupe.stroke();
}

function refresh() { placeHandles(); drawLoupe(); }

function loadScene(id) {
  scene = data.scenes.find((s) => s.id === id);
  if (!scene.corners) scene.corners = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]];
  photo.onload = refresh;
  hires.onload = drawLoupe;
  $('status').textContent = '';
  warp?.destroy();
  warp = attachWarp(photo, artLayer, scene.corners);
  photo.src = `../${scene.src}-1600.jpg`;
  hires.src = `../${scene.src}-2400.jpg`;
}

handles.forEach((el, i) => {
  el.addEventListener('pointerdown', (e) => {
    active = i;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = photo.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      scene.corners[i] = [+x.toFixed(4), +y.toFixed(4)];
      $('status').textContent = 'unsaved changes';
      refresh();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
    refresh();
  });
});

document.addEventListener('keydown', (e) => {
  const step = (e.shiftKey ? 10 : 1);
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d || !scene) return;
  e.preventDefault();
  const [x, y] = scene.corners[active];
  scene.corners[active] = [+(x + d[0] / photo.clientWidth).toFixed(4), +(y + d[1] / photo.clientHeight).toFixed(4)];
  $('status').textContent = 'unsaved changes';
  refresh();
});

$('art').addEventListener('change', (e) => {
  if (e.target.value === 'pattern') setArt(testPattern());
  else if (e.target.value === 'none') setArt(null);
  else $('file').click();
});

$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  let node;
  if (f.type.startsWith('video/')) {
    node = Object.assign(document.createElement('video'), { src: url, muted: true, loop: true, autoplay: true, playsInline: true });
  } else {
    node = Object.assign(document.createElement('img'), { src: url, alt: '' });
  }
  setArt(node);
});

$('opacity').addEventListener('input', (e) => { artLayer.style.opacity = e.target.value; });
$('scene').addEventListener('change', (e) => loadScene(e.target.value));
window.addEventListener('resize', refresh);

$('save').addEventListener('click', async () => {
  const json = JSON.stringify(data, null, 2) + '\n';
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: 'screens.json', types: [{ accept: { 'application/json': ['.json'] } }] });
      const w = await handle.createWritable(); await w.write(json); await w.close();
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'screens.json' });
      a.click();
    }
    $('status').textContent = 'saved';
  } catch (err) {
    if (err.name !== 'AbortError') $('status').textContent = `save failed: ${err.message}`;
  }
});

data = await (await fetch('../data/screens.json', { cache: 'no-store' })).json();
$('scene').replaceChildren(...data.scenes.map((s) => new Option(`${s.id}${s.corners ? '' : '  ⚠ needs calibration'}`, s.id)));
artLayer.style.opacity = $('opacity').value;
setArt(testPattern());
loadScene(data.scenes[0].id);
```

- [ ] **Step 5: Verify in browser (Playwright MCP)**

```bash
python3 -m http.server 8765 --directory /Users/sharthansimoons/Kode/VernisWebsite  # run in background
```

With Playwright MCP:
1. Navigate to `http://localhost:8765/tools/calibrate.html`; console has no errors.
2. Screenshot: checkerboard sits inside the fixture's dark quad region (roughly), 4 red handles visible.
3. Drag handle 0 by (+40, +30) px with `browser_drag`/mouse; evaluate `getComputedStyle(document.getElementById('art-layer')).transform` — it differs from before; status reads "unsaved changes".
4. Resize viewport 1400→800 wide: handles still sit on the same image features (screenshot).
5. Upload a non-square PNG and a short MP4 via `browser_file_upload` after choosing "Local file…": art covers the quad, video plays (evaluate `document.querySelector('#art-layer video').paused === false`).
6. Click Save in headless (no `showSaveFilePicker` in Playwright → download path): confirm a download event with valid JSON (`JSON.parse` succeeds, `scenes[0].corners` updated).

- [ ] **Step 6: Show diff, commit (fixtures excluded)**

```bash
git add tools/calibrate.html tools/calibrate.css tools/calibrate.js
git commit -m "Add local screen calibration tool"
```

---

### Task 5: Build CLI, run on real photos, verify, calibrate, commit assets

**Files:**
- Create: `tools/photos/build.py`, `tools/README.md`
- Generated: `images/scenes/*` (84 files), `data/screens.json`
- Delete: fixture files from Task 4

**Interfaces:**
- Consumes: `load_upright`, `export_variants` (Task 1); `detect_corners` (Task 3); `load_scenes`, `merge_scene`, `save_scenes` (Task 3).
- Produces: CLI `tools/.venv/bin/python -m tools.photos.build [--only ID] [--redetect ID]`; `tools/photos/out/check.jpg`.

- [ ] **Step 1: `tools/photos/build.py`**

```python
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


def _checker(size=400):
    tile = np.indices((8, 8)).sum(0) % 2
    board = np.kron(tile, np.ones((size // 8, size // 8)))
    rgb = np.stack([board * 230 + 20, board * 200 + 50, board * 120 + 100], -1).astype(np.uint8)
    return rgb


def _check_tile(img: Image.Image, corners, label: str) -> Image.Image:
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
    d.rectangle([0, 0, 300, 22], fill=(255, 230, 0) if corners else (255, 80, 80))
    d.text((4, 4), label + ("" if corners else "  NEEDS CALIBRATION"), fill=(0, 0, 0))
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
        print(f"{sid:16s} {'ok' if final else 'NEEDS CALIBRATION'}")
        tiles.append(_check_tile(img, final, sid))
    save_scenes(SCENES_JSON, data)
    _contact_sheet(tiles)
    total = sum(p.stat().st_size for p in OUT_IMAGES.glob("*.*"))
    print(f"images/scenes total: {total / 1e6:.1f} MB  ·  check sheet: {CHECK.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Remove fixtures and run on real photos**

```bash
rm -f images/scenes/fixture-*.jpg data/screens.json
tools/.venv/bin/python -m tools.photos.build
```

Expected: 14 lines, some possibly `NEEDS CALIBRATION` (likely the originalArt ones and maybe 23/24/33/34); total ≲ 15 MB.
If total > 15 MB: change JPEG `quality=82` → `78` in `imaging.py`, rerun, re-run pytest.

- [ ] **Step 3: Inspect `tools/photos/out/check.jpg`** (Read tool, visually). For every `ok` tile, the red quad must hug the inner edge of the screen (not the outer frame edge, not the bezel shadow). Note ids that are off.

- [ ] **Step 4: Calibrate outliers and nulls** in `tools/calibrate.html` (Playwright MCP, or the operator). Save → overwrite `data/screens.json`. Re-run `python -m tools.photos.build` and confirm those ids now print `ok` with unchanged corners (merge keeps them). Re-inspect `check.jpg` until every tile is `ok` and tight.

- [ ] **Step 5: Metadata spot check**

```bash
tools/.venv/bin/python -c "
from PIL import Image; import glob
for p in glob.glob('images/scenes/*'):
    im = Image.open(p); assert len(im.getexif()) == 0, p
print('no EXIF in', len(glob.glob('images/scenes/*')), 'files')"
```

Expected: `no EXIF in 84 files`.

- [ ] **Step 6: `tools/README.md`**

```markdown
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
    node --test tools/tests/
```

- [ ] **Step 7: Full test run**

```bash
tools/.venv/bin/python -m pytest tools/photos/tests -q && node --test tools/tests/
```

Expected: all pass.

- [ ] **Step 8: Show diff summary to user (file list + sizes + check.jpg), then commit**

```bash
git add tools/photos/build.py tools/README.md data/screens.json images/scenes
git status --short | grep -E 'originals|\.venv|out/' && echo "STOP: ignored files staged" || true
git commit -m "Add 14 scene photos and calibrated screen corners"
```
