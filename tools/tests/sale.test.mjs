import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saleState, formatLeft, saleMessage } from '../../js/sale.js';
import { jsonpUrl } from '../../js/waitlist.js';

const cfg = { wave: 2, opens: '2026-10-14T10:00:00Z', closes: '2026-10-21T18:00:00Z' };

test('no dates means unscheduled', () => {
  assert.equal(saleState({ wave: 2, opens: null, closes: null }).state, 'unscheduled');
  assert.equal(saleState(null).state, 'unscheduled');
});

test('bad or reversed dates are unscheduled, not open', () => {
  assert.equal(saleState({ opens: 'nope', closes: '2026-10-21T18:00:00Z' }).state, 'unscheduled');
  assert.equal(saleState({ opens: cfg.closes, closes: cfg.opens }).state, 'unscheduled');
});

test('upcoming, open and closed around the window edges', () => {
  assert.equal(saleState(cfg, new Date('2026-10-14T09:59:59Z')).state, 'upcoming');
  assert.equal(saleState(cfg, new Date('2026-10-14T10:00:00Z')).state, 'open');
  assert.equal(saleState(cfg, new Date('2026-10-21T17:59:59Z')).state, 'open');
  assert.equal(saleState(cfg, new Date('2026-10-21T18:00:00Z')).state, 'closed');
});

test('formatLeft', () => {
  assert.equal(formatLeft(((3 * 24 + 4) * 60 + 5) * 60000), '3 days, 4 hours');
  assert.equal(formatLeft((1 * 60 + 1) * 60000), '1 hour, 1 minute');
  assert.equal(formatLeft(30 * 1000), '1 minute');
});

test('messages name the wave and Oslo time', () => {
  const open = saleState(cfg, new Date('2026-10-20T18:00:00Z'));
  assert.match(saleMessage(open, 2), /^Wave 2 is open until Wed 21 October.* Oslo time: 1 day, 0 hours left\.$/);
  assert.match(saleMessage(saleState(cfg, new Date('2026-10-22T00:00:00Z')), 2), /wave 3 opens/);
  assert.match(saleMessage({ state: 'unscheduled' }, 2), /^Wave 2 opens soon/);
});

test('jsonpUrl targets post-json and carries fields + callback', () => {
  const u = new URL(jsonpUrl('https://x.us1.list-manage.com/subscribe/post?u=abc&id=def', { EMAIL: 'a@b.no' }, 'cb1'));
  assert.equal(u.pathname, '/subscribe/post-json');
  assert.equal(u.searchParams.get('u'), 'abc');
  assert.equal(u.searchParams.get('EMAIL'), 'a@b.no');
  assert.equal(u.searchParams.get('c'), 'cb1');
});
