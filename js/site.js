/**
 * VERNIS - landing page
 * Navigation, the live hero, and the "see it with your own art" viewer.
 */
import { attachWarp } from './screen-warp.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HERO_INTERVAL = 7000;
const FADE_MS = 600;

// ---------------------------------------------
// Navigation
// ---------------------------------------------
const nav = document.getElementById('nav');
const toggle = nav.querySelector('.nav__toggle');
const links = document.getElementById('nav-links');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  links.classList.toggle('is-open', open);
});
links.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    toggle.setAttribute('aria-expanded', 'false');
    links.classList.remove('is-open');
  }
});

// Edition note: only show a remaining count when a real number is set in the HTML.
const edition = document.getElementById('edition-note');
if (edition?.dataset.remaining) {
  edition.textContent = `Signed edition of ${edition.dataset.size}. ${edition.dataset.remaining} remaining.`;
}

// ---------------------------------------------
// Art elements
// ---------------------------------------------
function createArt({ type, src, poster }) {
  if (type === 'video') {
    const v = document.createElement('video');
    Object.assign(v, { src, muted: true, loop: true, playsInline: true, autoplay: !reduceMotion });
    if (poster) v.poster = poster;
    v.setAttribute('muted', '');
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
    const ok = el.tagName === 'VIDEO' ? 'loadeddata' : 'load';
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth) return resolve(el);
    el.addEventListener(ok, () => resolve(el), { once: true });
    el.addEventListener('error', () => reject(new Error('unreadable')), { once: true });
  });
}

/** Swap the art inside a layer with a short crossfade. Rejects if the file can't be shown. */
async function showArt(layer, el) {
  el.style.opacity = '0';
  layer.append(el);
  try {
    await whenReady(el);
  } catch (err) {
    el.remove();
    throw err;
  }
  if (el.tagName === 'VIDEO' && !reduceMotion) el.play().catch(() => {});
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  const old = [...layer.children].filter((c) => c !== el);
  setTimeout(() => old.forEach((c) => c.remove()), reduceMotion ? 0 : FADE_MS);
}

function clearArt(layer) {
  layer.replaceChildren();
}

// ---------------------------------------------
// Data
// ---------------------------------------------
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const [screens, library] = await Promise.all([
  loadJSON('data/screens.json'),
  loadJSON('data/library.json')
]);
const scenes = screens.scenes.filter((s) => s.corners);
const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
const pieces = library.items;

const srcset = (scene, ext) =>
  [800, 1600, 2400].map((w) => `${scene.src}-${w}.${ext} ${w}w`).join(', ');

// ---------------------------------------------
// Hero: rotate library pieces on the real photo
// ---------------------------------------------
function initHero() {
  const stage = document.querySelector('.hero__stage');
  const scene = sceneById[stage?.dataset.scene];
  if (!scene) return;
  const photo = stage.querySelector('.scene__photo');
  const layer = stage.querySelector('.scene__art');
  const caption = stage.querySelector('.hero__caption');
  attachWarp(photo, layer, scene.corners);

  let i = 0;
  let timer = null;
  const show = async () => {
    const item = pieces[i % pieces.length];
    try {
      await showArt(layer, createArt(item));
      caption.textContent = `On screen: ${item.title}, ${item.artist}`;
    } catch {
      // Skip a piece that fails to load; the next tick tries the following one.
    }
    i += 1;
  };
  show();
  if (reduceMotion || stage.dataset.rotate !== 'true' || pieces.length < 2) return;

  const start = () => { if (!timer) timer = setInterval(show, HERO_INTERVAL); };
  const stop = () => { clearInterval(timer); timer = null; };
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

// ---------------------------------------------
// Viewer: pick a setting and a piece, or use your own file
// ---------------------------------------------
const ACCEPTED = /^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|quicktime))$/;

function initViewer() {
  const stage = document.getElementById('viewer-stage');
  const photo = document.getElementById('viewer-photo');
  const layer = stage.querySelector('.scene__art');
  const sceneList = document.getElementById('viewer-scenes');
  const libraryList = document.getElementById('viewer-library');
  const fileInput = document.getElementById('viewer-file');
  const drop = document.getElementById('drop');
  const status = document.getElementById('viewer-status');

  let scene = sceneById['canal-23'] || scenes[0];
  let art = { kind: 'library', item: pieces[0] };
  let userUrl = null;
  let lastFileType = '';
  const warp = attachWarp(photo, layer, scene.corners);

  const press = (container, target) => {
    container.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === target)));
  };

  async function render() {
    status.textContent = '';
    if (art.kind === 'original') { clearArt(layer); return; }
    const spec = art.kind === 'file' ? { type: art.type, src: userUrl } : art.item;
    try {
      await showArt(layer, createArt(spec));
    } catch {
      status.textContent = "This file can't be shown in the browser. Try a JPG, PNG, GIF, WebP, MP4 or WebM.";
    }
  }

  function renderLibrary() {
    const chips = pieces.map((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', String(art.kind === 'library' && art.item === item));
      const thumb = document.createElement('img');
      thumb.src = item.poster || item.src;
      thumb.alt = '';
      thumb.loading = 'lazy';
      b.append(thumb, item.title);
      b.addEventListener('click', () => { art = { kind: 'library', item }; press(libraryList, b); render(); });
      return b;
    });
    if (scene.originalArt) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = 'Original photo';
      b.setAttribute('aria-pressed', String(art.kind === 'original'));
      b.addEventListener('click', () => { art = { kind: 'original' }; press(libraryList, b); render(); });
      chips.unshift(b);
    }
    if (userUrl) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = 'Your file';
      b.setAttribute('aria-pressed', String(art.kind === 'file'));
      b.addEventListener('click', () => { art = { kind: 'file', type: lastFileType }; press(libraryList, b); render(); });
      chips.unshift(b);
    }
    libraryList.replaceChildren(...chips);
  }

  function selectScene(next, button) {
    scene = next;
    press(sceneList, button);
    stage.classList.toggle('is-wide', scene.w > scene.h);
    photo.alt = scene.alt;
    photo.srcset = srcset(scene, 'jpg');
    photo.sizes = '(min-width: 960px) 58vw, 100vw';
    photo.src = `${scene.src}-1600.jpg`;
    warp.update(scene.corners);
    if (art.kind === 'original' && !scene.originalArt) art = { kind: 'library', item: pieces[0] };
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
      status.textContent = `${file.name} isn't a supported format. Use a JPG, PNG, GIF, WebP, MP4 or WebM.`;
      return;
    }
    if (userUrl) URL.revokeObjectURL(userUrl);
    userUrl = URL.createObjectURL(file);
    lastFileType = file.type.startsWith('video/') ? 'video' : 'image';
    art = { kind: 'file', type: lastFileType };
    renderLibrary();
    render();
  }

  fileInput.addEventListener('change', () => useFile(fileInput.files[0]));
  for (const target of [drop, stage]) {
    target.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    target.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    target.addEventListener('drop', (e) => {
      e.preventDefault();
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

  const first = [...sceneList.children][scenes.indexOf(scene)];
  selectScene(scene, first);
}

initHero();
initViewer();
