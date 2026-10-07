import { attachWarp } from '../js/screen-warp.js';

const $ = (id) => document.getElementById(id);
const photo = $('photo');
const artLayer = $('art-layer');
const handles = [...document.querySelectorAll('.handle')];
const loupe = $('loupe').getContext('2d');
const hires = new Image();

let data;
let scene;
let warp;
let active = 0;
let working; // corners being edited; only written to scene.corners once a handle moves
const edited = new Set();

function testPattern() {
  const c = document.createElement('canvas');
  c.width = c.height = 1000;
  const g = c.getContext('2d');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    g.fillStyle = (x + y) % 2 ? '#e8e2d0' : '#2a4d6e';
    g.fillRect(x * 100, y * 100, 100, 100);
  }
  g.strokeStyle = '#ff3b30'; g.lineWidth = 12; g.strokeRect(6, 6, 988, 988);
  g.fillStyle = '#ff3b30'; g.font = 'bold 120px sans-serif'; g.fillText('TL', 30, 140);
  return c;
}

function setArt(node) {
  artLayer.replaceChildren(...(node ? [node] : []));
}

function placeHandles() {
  const w = photo.clientWidth;
  const h = photo.clientHeight;
  working.forEach(([x, y], i) => {
    handles[i].style.left = `${x * w}px`;
    handles[i].style.top = `${y * h}px`;
    handles[i].classList.toggle('active', i === active);
  });
  warp?.update(working);
}

function drawLoupe() {
  if (!hires.complete || !hires.naturalWidth) return;
  const [x, y] = working[active];
  const sx = x * hires.naturalWidth - 55;
  const sy = y * hires.naturalHeight - 55;
  loupe.imageSmoothingEnabled = false;
  loupe.clearRect(0, 0, 220, 220);
  loupe.drawImage(hires, sx, sy, 110, 110, 0, 0, 220, 220);
  loupe.strokeStyle = '#0ff';
  loupe.beginPath(); loupe.moveTo(110, 0); loupe.lineTo(110, 220); loupe.moveTo(0, 110); loupe.lineTo(220, 110); loupe.stroke();
}

function refresh() { placeHandles(); drawLoupe(); }

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Moves corner i of the working copy and marks the scene as edited.
function setCorner(i, x, y) {
  working[i] = [+clamp01(x).toFixed(4), +clamp01(y).toFixed(4)];
  scene.corners = working;
  edited.add(scene.id);
  $('status').textContent = 'unsaved changes';
  refresh();
}

// True when TL, TR, BR, BL form a convex quad in clockwise (screen, y-down) order.
function validQuad(q) {
  if (!Array.isArray(q) || q.length !== 4) return false;
  return q.every((p, i) => {
    const [a, b, c] = [p, q[(i + 1) % 4], q[(i + 2) % 4]];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0;
  });
}

function loadScene(id) {
  scene = data.scenes.find((s) => s.id === id);
  working = scene.corners ?? [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]];
  photo.onload = refresh;
  hires.onload = drawLoupe;
  $('status').textContent = '';
  warp?.destroy();
  warp = attachWarp(photo, artLayer, working);
  photo.src = `../${scene.src}-1600.jpg`;
  hires.src = `../${scene.src}-2400.jpg`;
}

handles.forEach((el, i) => {
  el.addEventListener('pointerdown', (e) => {
    active = i;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = photo.getBoundingClientRect();
      setCorner(i, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
    refresh();
  });
});

document.addEventListener('keydown', (e) => {
  const step = (e.shiftKey ? 10 : 1);
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d || !scene || ['SELECT', 'INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  const [x, y] = working[active];
  setCorner(active, x + d[0] / photo.clientWidth, y + d[1] / photo.clientHeight);
});

$('art').addEventListener('change', (e) => {
  if (e.target.value === 'pattern') setArt(testPattern());
  else if (e.target.value === 'none') setArt(null);
  else $('file').click();
});

$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  let node;
  if (f.type.startsWith('video/')) {
    node = Object.assign(document.createElement('video'), { src: url, muted: true, loop: true, autoplay: true, playsInline: true });
  } else {
    node = Object.assign(document.createElement('img'), { src: url, alt: '' });
  }
  setArt(node);
});

$('opacity').addEventListener('input', (e) => { artLayer.style.opacity = e.target.value; });
$('scene').addEventListener('change', (e) => loadScene(e.target.value));
window.addEventListener('resize', refresh);

$('save').addEventListener('click', async () => {
  const bad = [...edited].find((id) => !validQuad(data.scenes.find((s) => s.id === id).corners));
  if (bad) { $('status').textContent = `invalid quad on ${bad} — not saved`; return; }
  const json = JSON.stringify(data, null, 2) + '\n';
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: 'screens.json', types: [{ accept: { 'application/json': ['.json'] } }] });
      const w = await handle.createWritable(); await w.write(json); await w.close();
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'screens.json' });
      a.click();
    }
    $('status').textContent = 'saved';
  } catch (err) {
    if (err.name !== 'AbortError') $('status').textContent = `save failed: ${err.message}`;
  }
});

data = await (await fetch('../data/screens.json', { cache: 'no-store' })).json();
$('scene').replaceChildren(...data.scenes.map((s) => new Option(`${s.id}${s.corners ? '' : '  ⚠ needs calibration'}`, s.id)));
artLayer.style.opacity = $('opacity').value;
setArt(testPattern());
loadScene(data.scenes[0].id);
