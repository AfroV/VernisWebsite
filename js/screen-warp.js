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

// Maps the content square onto corners (normalized to boxW x boxH), shifted by offsetX/Y px.
export function computeWarp(corners, boxW, boxH, contentSize, offsetX = 0, offsetY = 0) {
  const s = contentSize;
  const src = [[0, 0], [s, 0], [s, s], [0, s]];
  const dst = corners.map(([x, y]) => [x * boxW + offsetX, y * boxH + offsetY]);
  const [a, b, c, d, e, f, g, h] = computeHomography(src, dst);
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(',')})`;
}

// Resolves one object-position component ('50%', '12px', or a keyword) to a px offset.
function resolvePos(value, free) {
  const v = String(value ?? '50%').trim();
  const kw = { left: 0, top: 0, center: 50, right: 100, bottom: 100 }[v];
  if (kw !== undefined) return free * kw / 100;
  if (v.endsWith('%')) return free * parseFloat(v) / 100;
  const px = parseFloat(v);
  return Number.isFinite(px) ? px : free / 2;
}

/**
 * Where the image pixels are actually drawn inside the img content box,
 * honouring object-fit (fill | cover | contain | scale-down | none) and object-position.
 * Pure: returns {x, y, w, h} in px relative to the content box's top-left.
 */
export function drawnImageRect({ boxW, boxH, naturalW, naturalH, fit = 'fill', posX = '50%', posY = '50%' }) {
  if (fit === 'fill' || !naturalW || !naturalH) return { x: 0, y: 0, w: boxW, h: boxH };
  const sx = boxW / naturalW;
  const sy = boxH / naturalH;
  let scale;
  if (fit === 'cover') scale = Math.max(sx, sy);
  else if (fit === 'contain') scale = Math.min(sx, sy);
  else if (fit === 'scale-down') scale = Math.min(1, sx, sy);
  else scale = 1; // 'none'
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: resolvePos(posX, boxW - w), y: resolvePos(posY, boxH - h), w, h };
}

// Drawn image rect of imgEl, in px relative to contentEl's containing block.
function measure(imgEl, contentEl) {
  const cs = getComputedStyle(imgEl);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const boxW = imgEl.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
  const boxH = imgEl.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0);
  let left;
  let top;
  const op = contentEl.offsetParent;
  if (op && imgEl.offsetParent === op) {
    left = imgEl.offsetLeft + imgEl.clientLeft + padL;
    top = imgEl.offsetTop + imgEl.clientTop + padT;
  } else {
    const r = imgEl.getBoundingClientRect();
    const o = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
    left = r.left + imgEl.clientLeft + padL - o.left - (op ? op.clientLeft : 0);
    top = r.top + imgEl.clientTop + padT - o.top - (op ? op.clientTop : 0);
  }
  const [posX, posY] = cs.objectPosition.split(/\s+/);
  const d = drawnImageRect({
    boxW, boxH, naturalW: imgEl.naturalWidth, naturalH: imgEl.naturalHeight,
    fit: cs.objectFit || 'fill', posX, posY
  });
  return { x: left + d.x, y: top + d.y, w: d.w, h: d.h };
}

/**
 * Warps contentEl onto the screen quad of the scene photo imgEl.
 *
 * Contract:
 * - contentEl must share a positioned ancestor (containing block) with imgEl; it is set to
 *   position:absolute and placed over the image pixels, wherever they are drawn
 *   (padding, border, margin and object-fit / object-position are accounted for).
 * - corners are normalized [x, y] in image space, order TL, TR, BR, BL.
 * - Children of contentEl should use width/height 100% + object-fit: cover so
 *   non-square art or video fills the square.
 * - corners null (uncalibrated) or a degenerate quad hides contentEl.
 * Returns { update(corners), destroy() }; destroy() removes the styles set here.
 */
export function attachWarp(imgEl, contentEl, corners, contentSize = 1000) {
  let current = corners;
  const STYLE_KEYS = ['position', 'left', 'top', 'width', 'height', 'transformOrigin', 'pointerEvents', 'transform', 'visibility'];
  Object.assign(contentEl.style, {
    position: 'absolute', left: '0', top: '0',
    width: `${contentSize}px`, height: `${contentSize}px`,
    transformOrigin: '0 0', pointerEvents: 'none'
  });
  const hide = () => { contentEl.style.visibility = 'hidden'; };
  const apply = () => {
    if (!current || !imgEl.clientWidth || !imgEl.clientHeight || !imgEl.naturalWidth) return hide();
    try {
      const r = measure(imgEl, contentEl);
      contentEl.style.transform = computeWarp(current, r.w, r.h, contentSize, r.x, r.y);
      contentEl.style.visibility = '';
    } catch {
      hide(); // degenerate quad
    }
  };
  const ro = new ResizeObserver(apply);
  ro.observe(imgEl);
  imgEl.addEventListener('load', apply);
  apply();
  return {
    update(next) { current = next; apply(); },
    destroy() {
      ro.disconnect();
      imgEl.removeEventListener('load', apply);
      for (const k of STYLE_KEYS) contentEl.style[k] = '';
    }
  };
}
