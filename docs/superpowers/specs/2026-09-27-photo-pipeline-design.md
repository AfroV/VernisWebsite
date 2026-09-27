# Photo Pipeline + Screen Calibration (Design Spec)

**Date:** 2026-09-27
**Status:** Approved design, pending implementation plan
**Scope:** Sub-project A of the site upgrade (A: photo pipeline → B: "try your art"
viewer → C: site redesign; D: Stripe Payment Links in parallel, operator task).
Turns the photographer's shoot into web-ready images plus measured screen geometry, so
any artwork (image, GIF, video) can be composited onto the Vernis screen in the browser.

## Goal

- 14 selected photos available as optimized, metadata-stripped web images.
- For each photo, the four corners of the display area, stored in one JSON file.
- A shared JS module that warps any square artwork onto those corners with correct
  perspective.
- A local calibration tool so the operator can fine-tune corners and add future photos
  without a developer.

## Non-goals

- The public "try your art" viewer and artwork library (sub-project B).
- Page layout / redesign (sub-project C).
- Glare/reflection overlays on the composite (B decides how the composite is styled).

## Source photos

Originals: `images/wetransfer_kunstramme-jpeg_2026-09-26_1630/` (34 JPEGs, 5712×4284,
~125 MB, most with EXIF orientation 6). Moved to `images/originals/` and git-ignored.

Selected (14). `originalArt` = real artwork already on screen (can be shown as-is or
replaced).

| Source | id | originalArt | tags |
|---|---|---|---|
| image00019 | `oslo-view-19` | false | hero |
| image00020 | `oslo-view-20` | false | hero |
| image00021 | `oslo-view-21` | false | hero |
| image00009 | `shelf-wide-09` | false | wide, lifestyle |
| image00001 | `shelf-01` | false | lifestyle |
| image00012 | `shelf-12` | false | lifestyle |
| image00023 | `canal-23` | false | lifestyle |
| image00024 | `canal-24` | false | lifestyle |
| image00033 | `angle-33` | false | product |
| image00034 | `angle-34` | false | product |
| image00028 | `grass-art-28` | true | lifestyle |
| image00029 | `plant-art-29` | true | lifestyle |
| image00031 | `canal-art-31` | true | lifestyle |
| image00032 | `canal-art-32` | true | lifestyle |

More photos can be added later via `selection.json` + the calibration tool.

Dropped: 02–08, 10, 11, 13 (near-duplicates / reflections), 14–18 (patterned reflection),
22 (hand reflection), 25–27 (strong ground reflection), 30 (weaker than 23/24).

## Components

### 1. `tools/photos/build.py` (local only, Python 3 + Pillow + OpenCV in `tools/.venv`)

- Input: list of `{source, id, originalArt, tags, alt}` in `tools/photos/selection.json`.
- For each photo:
  - Apply EXIF orientation, then **strip all metadata** (EXIF incl. GPS, XMP); convert to sRGB and
    embed only the sRGB ICC profile.
  - Write `images/scenes/<id>-{800,1600,2400}.{webp,jpg}` (long edge). Targets: WebP q≈80,
    JPEG q≈82 progressive; 2400 variant ≤ ~500 KB.
  - Corner detection (only if the id has no corners in `data/screens.json` yet):
    downscale → grayscale → find the dark quadrilateral inside the bright metal frame
    (threshold + contours + `approxPolyDP` to 4 points, pick the most square, darkest,
    frame-enclosed candidate) → order TL, TR, BR, BL → normalize to 0–1.
    If no confident quad: write `corners: null` and flag it in the report.
- Merge into `data/screens.json`; **never overwrite existing corners** (hand-tuned wins).
  `--redetect <id>` forces re-detection for one photo.
- Write a verification contact sheet to `tools/photos/out/check.jpg` (git-ignored):
  each photo with the quad outlined and a checkerboard warped into it.

### 2. `data/screens.json`

```json
{
  "version": 1,
  "scenes": [
    {
      "id": "oslo-view-19",
      "src": "images/scenes/oslo-view-19",
      "w": 4284, "h": 5712,
      "corners": [[0.41,0.62],[0.58,0.62],[0.58,0.78],[0.41,0.78]],
      "originalArt": false,
      "tags": ["hero"],
      "alt": "Vernis on a table in front of a view over Oslo"
    }
  ]
}
```

- `w`/`h`: upright pixel size of the original (aspect ratio source of truth).
- `corners`: normalized [x, y] of the visible display area (inside the bezel), order
  TL, TR, BR, BL as seen in the photo. `null` = needs calibration.
- `src`: path prefix; consumers append `-<size>.<ext>`.

### 3. `js/screen-warp.js` (shared, ES module, no dependencies)

- `computeHomography(srcQuad, dstQuad)` → 3×3 matrix (8-unknown linear solve).
- `quadToMatrix3d(corners, boxW, boxH, contentSize)` → CSS `matrix3d(...)` string that
  maps a `contentSize`×`contentSize` element onto the corners, given the rendered image
  box size.
- `attachWarp(imgEl, contentEl, corners)` → positions `contentEl` absolutely over
  `imgEl`, applies the transform, and re-applies on resize (ResizeObserver).
- Works for `<img>`, `<video>`, `<canvas>` content alike. Content is square; non-square
  art is fit with `object-fit: cover` (B may change this).

### 4. `tools/calibrate.html` + `tools/calibrate.js` (local tool)

- Run: `python3 -m http.server` from the repo root, open `/tools/calibrate.html`.
- Scene picker (from `data/screens.json`), test-art picker (bundled test pattern +
  local file input), toggle art on/off, opacity slider.
- Four draggable corner handles; a magnifier loupe while dragging; arrow keys nudge the
  selected handle by 1 px (Shift = 10 px).
- Live preview through `js/screen-warp.js` (same code the public site will use).
- Save: Chrome's File System Access API writes `data/screens.json` directly; fallback
  downloads the file. Only `corners` of the edited scenes change.
- Published by GitHub Pages at `/tools/…` — harmless (reads public data only). Not linked
  from the site; `<meta name="robots" content="noindex">`.

### 5. Repo hygiene

`.gitignore` adds: `images/originals/`, `tools/.venv/`, `tools/photos/out/`,
`.playwright-mcp/`.

## Verification

- Node test (`node --test tools/tests/screen-warp.test.mjs`): homography maps the four
  source corners to the four destination corners within 1e-6; identity quad → identity.
- Visual: inspect `check.jpg`; every quad hugs the display edge within ~0.5% of image
  width. Fix outliers in the calibration tool.
- Playwright: load calibrate.html, drag a handle, confirm preview transform changes and
  save produces valid JSON.
- `git status` shows no originals, venv or output artifacts staged. Spot-check one web
  image with `exiftool`/Pillow: no GPS / EXIF.

## Success criteria

- All selected photos exist in `images/scenes/` in three sizes × two formats, no
  metadata, total committed weight well under ~15 MB.
- `data/screens.json` has non-null, visually verified corners for every scene.
- The calibration tool lets the operator adjust corners and add a new photo without a
  developer.
- `js/screen-warp.js` is ready to be imported by sub-project B unchanged.
