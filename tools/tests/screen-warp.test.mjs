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
