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
