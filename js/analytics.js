/**
 * VERNIS - analytics
 * Thin wrapper around Plausible (cookieless, no personal data). If the script is
 * blocked or not loaded, events are dropped silently: tracking must never break the page.
 */

export function track(event, props) {
  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined);
    }
  } catch {
    // ignore
  }
}
