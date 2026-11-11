import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closesShort } from '../../js/buybar.js';

test('closing time reads in Oslo time', () => {
  // 22:59 UTC on Sunday 15 November 2026 is 23:59 in Oslo (CET).
  assert.equal(closesShort(new Date('2026-11-15T22:59:00Z')), 'closes Sun 23:59');
  // Summer time: 10:00 UTC is 12:00 in Oslo (CEST).
  assert.equal(closesShort(new Date('2026-06-03T10:00:00Z')), 'closes Wed 12:00');
});
