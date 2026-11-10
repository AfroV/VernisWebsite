import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessZone, shippingText } from '../../js/checkout.js';

test('European time zones guess Europe', () => {
  for (const tz of ['Europe/Oslo', 'Europe/London', 'Europe/Belgrade', 'Europe/Kyiv', 'Atlantic/Reykjavik', 'Atlantic/Canary']) {
    assert.equal(guessZone(tz), 'europe', tz);
  }
});

test('Russia, Belarus, Turkey and everywhere else guess rest of world', () => {
  for (const tz of ['Europe/Moscow', 'Europe/Minsk', 'Europe/Istanbul', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney']) {
    assert.equal(guessZone(tz), 'world', tz);
  }
});

test('unknown time zone falls back to Europe', () => {
  assert.equal(guessZone(undefined), 'europe');
  assert.equal(guessZone(''), 'europe');
});

test('shipping text', () => {
  assert.equal(shippingText('30', 'europe'), '+ €30 shipping in Europe');
  assert.equal(shippingText('60', 'world'), '+ €60 shipping worldwide');
});
