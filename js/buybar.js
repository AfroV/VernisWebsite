/**
 * VERNIS - buy bar
 * A slim bar pinned to the bottom of the screen while a wave is open: price, closing time and a
 * Order now link to the editions. Hidden over the hero (which has its own button) and while the
 * editions are on screen (the real buttons are right there).
 */
import { saleState } from './sale.js';

/** Pure: "closes Sun 23:59" in Oslo time. */
export function closesShort(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Oslo'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `closes ${get('weekday')} ${get('hour')}:${get('minute')}`;
}

export function initBuyBar(config) {
  const bar = document.querySelector('[data-buybar]');
  const hero = document.querySelector('.hero');
  const editions = document.getElementById('editions');
  if (!bar || !hero || !editions || !('IntersectionObserver' in window)) return;
  const when = bar.querySelector('[data-buybar-when]');

  let heroOnScreen = true;
  let editionsOnScreen = false;
  const sync = () => {
    const s = saleState(config);
    const show = s.state === 'open' && !heroOnScreen && !editionsOnScreen;
    if (s.state === 'open' && when) when.textContent = closesShort(s.closes);
    bar.hidden = !show;
    document.body.classList.toggle('has-buybar', show);
  };

  new IntersectionObserver(([e]) => { heroOnScreen = e.isIntersecting; sync(); }).observe(hero);
  new IntersectionObserver(([e]) => { editionsOnScreen = e.isIntersecting; sync(); }).observe(editions);
  setInterval(sync, 60000);
}
