/**
 * VERNIS - shipping zone
 * Two zones, Europe and the rest of the world, each with its own Stripe Payment Link per model
 * (data-link-europe / data-link-world on every [data-buy] button). Each link only accepts
 * addresses inside its zone, so the shipping fee shown on the page is the one the buyer pays.
 */

export const ZONES = ['europe', 'world'];

// Time zones named Europe/* whose countries ship at the rest-of-world rate, or not at all.
const OUTSIDE_EUROPE_ZONE = new Set([
  'Europe/Moscow', 'Europe/Minsk', 'Europe/Istanbul', 'Europe/Kaliningrad', 'Europe/Samara',
  'Europe/Volgograd', 'Europe/Kirov', 'Europe/Saratov', 'Europe/Ulyanovsk', 'Europe/Astrakhan',
  'Europe/Simferopol'
]);
// European places whose time zone is not named Europe/*.
const EUROPE_ELSEWHERE = new Set([
  'Atlantic/Reykjavik', 'Atlantic/Faroe', 'Atlantic/Canary', 'Atlantic/Madeira',
  'Atlantic/Azores', 'Arctic/Longyearbyen'
]);

/** Pure: a first guess at the buyer's zone from their time zone. Unknown means Europe. */
export function guessZone(timeZone) {
  if (!timeZone || EUROPE_ELSEWHERE.has(timeZone)) return 'europe';
  if (timeZone.startsWith('Europe/')) return OUTSIDE_EUROPE_ZONE.has(timeZone) ? 'world' : 'europe';
  return 'world';
}

/** Pure: the line under each price: shipping for the zone, then frame + shipping. */
export function shippingText(fee, zone, price) {
  const line = `+ €${fee} shipping ${zone === 'world' ? 'worldwide' : 'to Europe'}`;
  const total = Number(price) + Number(fee);
  return price && Number.isFinite(total) ? `${line}, €${total} in total` : line;
}

/**
 * Wire the switch. Writes each button's link for the chosen zone to data-href, which the
 * sales window (sale.js) uses while a wave is open. With no sales window, sets href directly.
 * Call before initSale so the first render already has the right link.
 */
export function initCheckout() {
  const radios = [...document.querySelectorAll('input[name="zone"]')];
  if (!radios.length) return;
  const buttons = document.querySelectorAll('[data-buy]');
  const fees = document.querySelectorAll('[data-ship-fee]');

  const apply = (zone) => {
    const radio = radios.find((r) => r.value === zone) || radios[0];
    radio.checked = true;
    const sale = document.documentElement.dataset.sale;
    for (const b of buttons) {
      const link = b.dataset[zone === 'world' ? 'linkWorld' : 'linkEurope'];
      if (!link) continue;
      b.dataset.href = link;
      b.dataset.zone = radio.value;
      if (!sale || sale === 'open') b.setAttribute('href', link);
    }
    fees.forEach((f) => { f.textContent = shippingText(radio.dataset.fee, radio.value, f.dataset.price); });
  };

  let timeZone;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* old browser */ }
  apply(guessZone(timeZone));
  radios.forEach((r) => r.addEventListener('change', () => r.checked && apply(r.value)));
}
