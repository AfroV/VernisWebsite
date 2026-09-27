/**
 * VERNIS - landing page
 * Navigation, the live hero, and the "see it with your own art" viewer.
 */
import { attachWarp } from './screen-warp.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERO_INTERVAL = 7000;
const FADE_MS = 600;
const FORMATS = 'a JPG, PNG, GIF, WebP, MP4 or WebM';

// ---------------------------------------------
// Navigation
// ---------------------------------------------
const nav = document.getElementById('nav');
const toggle = nav.querySelector('.nav__toggle');
const links = document.getElementById('nav-links');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const setMenu = (open) => {
  toggle.setAttribute('aria-expanded', String(open));
  links.classList.toggle('is-open', open);
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && links.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
});

// Edition note: only show a remaining count when a real number is set in the HTML.
const edition = document.getElementById('edition-note');
if (edition?.dataset.remaining) {
  edition.firstChild.textContent = `Signed edition of ${edition.dataset.size}, ${edition.dataset.remaining} remaining. `;
}

// A file dropped outside the drop targets must not navigate away from the page.
for (const type of ['dragover', 'drop']) document.addEventListener(type, (e) => e.preventDefault());

// ---------------------------------------------
// Art elements
// ---------------------------------------------
function createArt({ type, src, poster }) {
  if (type === 'video') {
    const v = document.createElement('video');
    Object.assign(v, { src, muted: true, loop: true, playsInline: true, preload: 'auto', autoplay: !reduceMotion });
    if (poster) v.poster = poster;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    return v;
  }
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.src = src;
  return img;
}

function whenReady(el) {
  return new Promise((resolve, reject) => {
    // loadedmetadata is enough to size a video; iOS may not load frames before playback.
    const ok = el.tagName === 'VIDEO' ? 'loadedmetadata' : 'load';
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth) return resolve(el);
    el.addEventListener(ok, () => resolve(el), { once: true });
    el.addEventListener('error', () => reject(new Error('unreadable')), { once: true });
  });
}

/**
 * Swap the art inside a layer with a short crossfade.
 * Only the newest call wins: a slower, older load is discarded when it finishes.
 * Resolves true when shown, false when superseded; rejects if the file can't be shown.
 */
const latest = new WeakMap();
async function showArt(layer, el) {
  const token = (latest.get(layer) || 0) + 1;
  latest.set(layer, token);
  el.style.opacity = '0';
  layer.append(el);
  try {
    await whenReady(el);
  } catch (err) {
    el.remove();
    if (latest.get(layer) !== token) return false;
    throw err;
  }
  if (latest.get(layer) !== token) { el.remove(); return false; }
  if (el.tagName === 'VIDEO' && !reduceMotion) el.play().catch(() => {});
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  const old = [...layer.children].filter((c) => c !== el);
  setTimeout(() => old.forEach((c) => c.remove()), reduceMotion ? 0 : FADE_MS);
  return true;
}

function clearArt(layer) {
  latest.set(layer, (latest.get(layer) || 0) + 1);
  layer.replaceChildren();
}

// ---------------------------------------------
// Data
// ---------------------------------------------
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

const [screens, library] = await Promise.all([loadJSON('data/screens.json'), loadJSON('data/library.json')]);
const scenes = (screens?.scenes || []).filter((s) => s.corners);
const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
const pieces = library?.items || [];

const srcset = (scene, ext) =>
  [800, 1600, 2400].map((w) => `${scene.src}-${w}.${ext} ${w}w`).join(', ');

// ---------------------------------------------
// Hero: rotate library pieces on the real photo
// ---------------------------------------------
function initHero() {
  const stage = document.querySelector('.hero__stage');
  const scene = sceneById[stage?.dataset.scene];
  if (!scene || !pieces.length) return;
  const photo = stage.querySelector('.scene__photo');
  const layer = stage.querySelector('.scene__art');
  const caption = stage.querySelector('.hero__caption');
  const pause = stage.querySelector('.hero__pause');
  attachWarp(photo, layer, scene.corners);

  let i = 0;
  const show = async () => {
    const item = pieces[i % pieces.length];
    i += 1;
    try {
      if (await showArt(layer, createArt(item))) caption.textContent = `On screen: ${item.title}, ${item.artist}`;
    } catch {
      // Skip a piece that fails to load; the next tick tries the following one.
    }
  };
  show();
  if (reduceMotion || stage.dataset.rotate !== 'true' || pieces.length < 2) return;

  let timer = null;
  let visible = true;
  let paused = false;
  const sync = () => {
    const run = visible && !paused && !document.hidden;
    if (run && !timer) timer = setInterval(show, HERO_INTERVAL);
    if (!run && timer) { clearInterval(timer); timer = null; }
  };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  pause.hidden = false;
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Play the artwork slideshow' : 'Pause the artwork slideshow');
    sync();
  });
  sync();
}

// ---------------------------------------------
// Viewer: pick a setting and a piece, or use your own file
// ---------------------------------------------
const ACCEPTED = /^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|quicktime))$/;

function initViewer() {
  const section = document.getElementById('try');
  if (!scenes.length) { section.hidden = true; return; }

  const stage = document.getElementById('viewer-stage');
  const photo = document.getElementById('viewer-photo');
  const layer = stage.querySelector('.scene__art');
  const sceneList = document.getElementById('viewer-scenes');
  const libraryList = document.getElementById('viewer-library');
  const fileInput = document.getElementById('viewer-file');
  const drop = document.getElementById('drop');
  const status = document.getElementById('viewer-status');

  let scene = sceneById['canal-23'] || scenes[0];
  let art = pieces.length ? { kind: 'library', item: pieces[0] } : { kind: 'none' };
  let userUrl = null;
  let lastFileType = '';
  const warp = attachWarp(photo, layer, scene.corners);

  const press = (container, target) => {
    container.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === target)));
  };

  async function render() {
    status.textContent = '';
    if (art.kind === 'original') { clearArt(layer); return; }
    if (art.kind === 'none') {
      clearArt(layer);
      status.textContent = `The sample library didn't load. You can still try ${FORMATS} of your own.`;
      return;
    }
    const spec = art.kind === 'file' ? { type: art.type, src: userUrl } : art.item;
    try {
      await showArt(layer, createArt(spec));
    } catch {
      status.textContent = `This file can't be shown in the browser. Try ${FORMATS}.`;
    }
  }

  function chip(label, pressed, onClick, thumbSrc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(pressed));
    if (thumbSrc) {
      const thumb = document.createElement('img');
      thumb.src = thumbSrc;
      thumb.alt = '';
      thumb.loading = 'lazy';
      b.append(thumb);
    }
    b.append(label);
    b.addEventListener('click', () => { onClick(); press(libraryList, b); render(); });
    return b;
  }

  function renderLibrary() {
    const chips = pieces.map((item) => chip(
      item.title, art.kind === 'library' && art.item === item,
      () => { art = { kind: 'library', item }; }, item.poster || item.src
    ));
    if (scene.originalArt) {
      chips.unshift(chip('Original photo', art.kind === 'original', () => { art = { kind: 'original' }; }));
    }
    if (userUrl) {
      chips.unshift(chip('Your file', art.kind === 'file', () => { art = { kind: 'file', type: lastFileType }; }));
    }
    libraryList.replaceChildren(...chips);
  }

  function selectScene(next, button) {
    scene = next;
    press(sceneList, button);
    stage.classList.toggle('is-wide', scene.w > scene.h);
    // Hide the art until the new photo is laid out, so it never sits on the old photo's screen.
    const src = `${scene.src}-1600.jpg`;
    if (photo.getAttribute('src') !== src) {
      layer.style.opacity = '0';
      photo.addEventListener('load', () => { warp.update(scene.corners); layer.style.opacity = ''; }, { once: true });
      photo.alt = scene.alt;
      photo.srcset = srcset(scene, 'jpg');
      photo.sizes = '(min-width: 960px) 58vw, 100vw';
      photo.src = src;
    }
    if (art.kind === 'original' && !scene.originalArt) art = pieces.length ? { kind: 'library', item: pieces[0] } : { kind: 'none' };
    renderLibrary();
    render();
  }

  sceneList.replaceChildren(...scenes.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', s.alt);
    const img = document.createElement('img');
    img.src = `${s.src}-800.jpg`;
    img.alt = '';
    img.loading = 'lazy';
    b.append(img);
    b.addEventListener('click', () => selectScene(s, b));
    return b;
  }));

  function useFile(file) {
    if (!file) return;
    if (!ACCEPTED.test(file.type)) {
      status.textContent = `${file.name} isn't a supported format. Use ${FORMATS}.`;
      return;
    }
    if (userUrl) URL.revokeObjectURL(userUrl);
    userUrl = URL.createObjectURL(file);
    lastFileType = file.type.startsWith('video/') ? 'video' : 'image';
    art = { kind: 'file', type: lastFileType };
    renderLibrary();
    render();
  }

  fileInput.addEventListener('change', () => {
    useFile(fileInput.files[0]);
    fileInput.value = ''; // so choosing the same file again still fires change
  });

  let dragDepth = 0;
  for (const target of [drop, stage]) {
    target.addEventListener('dragenter', () => { dragDepth += 1; drop.classList.add('is-over'); });
    target.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.classList.remove('is-over'); });
    target.addEventListener('drop', (e) => {
      dragDepth = 0;
      drop.classList.remove('is-over');
      useFile(e.dataTransfer.files[0]);
    });
  }

  document.querySelectorAll('.viewer__fit [data-fit]').forEach((b) => {
    b.addEventListener('click', () => {
      layer.classList.toggle('fit-contain', b.dataset.fit === 'contain');
      press(b.parentElement, b);
    });
  });

  selectScene(scene, sceneList.children[scenes.indexOf(scene)]);
}

initHero();
initViewer();
