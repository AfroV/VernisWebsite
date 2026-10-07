import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHomography, applyHomography, computeWarp, drawnImageRect } from '../../js/screen-warp.js';

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

const projector = (css) => {
  const m = css.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number);
  return (x, y) => {
    const W = m[3] * x + m[7] * y + m[15];
    return [(m[0] * x + m[4] * y + m[12]) / W, (m[1] * x + m[5] * y + m[13]) / W];
  };
};

test('computeWarp shifts every corner by the offset', () => {
  const corners = [[0.25, 0.2], [0.75, 0.22], [0.74, 0.7], [0.26, 0.68]];
  const project = projector(computeWarp(corners, 800, 600, 1000, 30, -12));
  [[0, 0], [1000, 0], [1000, 1000], [0, 1000]].forEach((p, i) => {
    const [x, y] = project(p[0], p[1]);
    close(x, corners[i][0] * 800 + 30, 1e-3); close(y, corners[i][1] * 600 - 12, 1e-3);
  });
});

const rect = (r, x, y, w, h) => { close(r.x, x); close(r.y, y); close(r.w, w); close(r.h, h); };
const base = { naturalW: 1600, naturalH: 1200, posX: '50%', posY: '50%' };

test('drawnImageRect: fill stretches to the box', () => {
  rect(drawnImageRect({ ...base, boxW: 500, boxH: 300, fit: 'fill' }), 0, 0, 500, 300);
});

test('drawnImageRect: cover on a wide box crops top/bottom, centred', () => {
  // 1000x400 box, 4:3 image → scale 1000/1600, h=750, y=(400-750)/2
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'cover' }), 0, -175, 1000, 750);
});

test('drawnImageRect: cover on a tall box crops left/right, centred', () => {
  // 300x600 box → scale 600/1200, w=800, x=(300-800)/2
  rect(drawnImageRect({ ...base, boxW: 300, boxH: 600, fit: 'cover' }), -250, 0, 800, 600);
});

test('drawnImageRect: contain letterboxes', () => {
  // 1000x400 box → scale 400/1200, w=1600/3, x=(1000-w)/2
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'contain' }), (1000 - 1600 / 3) / 2, 0, 1600 / 3, 400);
});

test('drawnImageRect: object-position 0% and 100%', () => {
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'cover', posX: '0%', posY: '0%' }), 0, 0, 1000, 750);
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'cover', posX: '100%', posY: '100%' }), 0, -350, 1000, 750);
});

test('drawnImageRect: object-position in px', () => {
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'cover', posX: '0px', posY: '-20px' }), 0, -20, 1000, 750);
});

test('drawnImageRect: none uses natural size, scale-down picks the smaller of none/contain', () => {
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'none', posX: '0%', posY: '0%' }), 0, 0, 1600, 1200);
  rect(drawnImageRect({ ...base, boxW: 1000, boxH: 400, fit: 'scale-down' }), (1000 - 1600 / 3) / 2, 0, 1600 / 3, 400);
  rect(drawnImageRect({ ...base, naturalW: 160, naturalH: 120, boxW: 1000, boxH: 400, fit: 'scale-down' }), 420, 140, 160, 120);
});
