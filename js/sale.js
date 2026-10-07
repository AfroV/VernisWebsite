/**
 * VERNIS - sales window
 * A wave is open between `opens` and `closes` (ISO dates in data/sale.json).
 * Outside the window the buy buttons point to the waitlist instead of Stripe.
 */

const TIME_ZONE = 'Europe/Oslo';

/** Pure: where a wave stands at `now`. state is 'unscheduled' | 'upcoming' | 'open' | 'closed'. */
export function saleState(config, now = new Date()) {
  const opens = config?.opens ? new Date(config.opens) : null;
  const closes = config?.closes ? new Date(config.closes) : null;
  if (!opens || !closes || Number.isNaN(+opens) || Number.isNaN(+closes) || closes <= opens) {
    return { state: 'unscheduled' };
  }
  if (now < opens) return { state: 'upcoming', opens, closes };
  if (now < closes) return { state: 'open', opens, closes, msLeft: closes - now };
  return { state: 'closed', opens, closes };
}

/** Pure: "3 days, 4 hours" / "5 hours, 12 minutes" / "12 minutes". */
export function formatLeft(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (d) return `${unit(d, 'day')}, ${unit(h, 'hour')}`;
  if (h) return `${unit(h, 'hour')}, ${unit(m, 'minute')}`;
  return unit(Math.max(m, 1), 'minute');
}

const when = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE
  }).format(date) + ' Oslo time';

/** Pure: the sentence shown in the hero and above the editions. */
export function saleMessage(s, wave) {
  switch (s.state) {
    case 'upcoming': return `Wave ${wave} opens ${when(s.opens)}.`;
    case 'open': return `Wave ${wave} is open until ${when(s.closes)}: ${formatLeft(s.msLeft)} left.`;
    case 'closed': return `Wave ${wave} has closed. Join the list to hear when wave ${wave + 1} opens.`;
    default: return `Wave ${wave} opens soon. Join the list to hear when.`;
  }
}

/** Wire the page: notes, buy buttons and the shipping line. Re-checks every minute. */
export function initSale(config) {
  const wave = config?.wave ?? 2;
  const notes = document.querySelectorAll('[data-sale-note]');
  const buttons = [...document.querySelectorAll('[data-buy]')].map((el) => ({
    el, href: el.getAttribute('href'), text: el.textContent, target: el.getAttribute('target')
  }));
  const ship = document.querySelector('[data-ship-note]');
  if (ship && config?.shipsWeeksAfterClose) {
    ship.textContent = `Frames ship about ${config.shipsWeeksAfterClose} weeks after the window closes.`;
  }

  const update = () => {
    const s = saleState(config);
    const text = saleMessage(s, wave);
    notes.forEach((n) => { n.textContent = text; });
    const open = s.state === 'open';
    for (const b of buttons) {
      if (open) {
        b.el.setAttribute('href', b.href);
        b.el.textContent = b.text;
        if (b.target) b.el.setAttribute('target', b.target);
      } else {
        b.el.setAttribute('href', '#waitlist');
        b.el.textContent = s.state === 'closed' ? `Join the list for wave ${wave + 1}` : `Join the wave ${wave} list`;
        b.el.removeAttribute('target');
      }
    }
    document.documentElement.dataset.sale = s.state;
    return s;
  };

  update();
  setInterval(update, 60000);
}
