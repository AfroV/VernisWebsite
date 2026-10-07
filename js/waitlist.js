/**
 * VERNIS - waitlist
 * Submits the Mailchimp embedded form in place (JSONP), so visitors stay on the page.
 * Without JavaScript the form still posts to Mailchimp in a new tab.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure: turn the embedded-form action into Mailchimp's JSONP endpoint. */
export function jsonpUrl(action, fields, callback) {
  const url = new URL(action.replace('/subscribe/post?', '/subscribe/post-json?'));
  for (const [k, v] of Object.entries(fields)) url.searchParams.set(k, v);
  url.searchParams.set('c', callback);
  return url.toString();
}

function jsonp(src, callback) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 10000);
    function cleanup() { clearTimeout(timer); delete window[callback]; script.remove(); }
    window[callback] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('network')); };
    script.src = src;
    document.head.append(script);
  });
}

// Mailchimp messages can contain HTML and a "0 - " field prefix.
const plain = (msg) => String(msg || '').replace(/<[^>]*>/g, '').replace(/^\d+ - /, '').trim();

export function initWaitlist({ onSuccess } = {}) {
  const form = document.getElementById('waitlist-form');
  if (!form) return;
  const status = document.getElementById('waitlist-status');
  const input = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!EMAIL.test(email)) {
      status.textContent = 'Enter an email address, like name@example.com.';
      input.focus();
      return;
    }
    if (form.action.includes('PLACEHOLDER')) {
      status.textContent = "The list isn't connected yet. Email us instead and we'll add you.";
      return;
    }
    const fields = Object.fromEntries(new FormData(form));
    fields.EMAIL = email;
    button.disabled = true;
    status.textContent = 'Adding you…';
    try {
      const cb = `vernisWaitlist${Date.now()}`;
      const res = await jsonp(jsonpUrl(form.action, fields, cb), cb);
      if (res.result === 'success') {
        status.textContent = plain(res.msg) || "You're on the list. Check your inbox to confirm.";
        form.reset();
        onSuccess?.();
      } else {
        status.textContent = plain(res.msg) || "That didn't work. Check the address and try again.";
      }
    } catch {
      status.textContent = "We couldn't reach the mailing list. Try again in a minute.";
    } finally {
      button.disabled = false;
    }
  });
}
