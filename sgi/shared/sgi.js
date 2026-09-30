// Shared helpers for the SGI demo three.js ports.
import * as THREE from 'three';

export { THREE };

export function createRenderer(container = document.body, { alpha = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  (container === document.body ? document.body : container).appendChild(renderer.domElement);
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    window.dispatchEvent(new Event('sgiresize'));
  });
  return renderer;
}

export function hud({ title, author = '', year = '', blurb = '', controls = '' }) {
  const d = document.createElement('div');
  d.id = 'sgihud';
  d.innerHTML = `
    <div class="sgi-title">SGI · <b>${title}</b></div>
    <div class="sgi-sub">${author} · ${year}</div>
    <div class="sgi-blurb">${blurb}</div>
    <div class="sgi-controls">${controls}</div>
    <a class="sgi-back" href="../">← all demos</a>`;
  document.body.appendChild(d);
  const t = document.createElement('div');
  t.id = 'sgitoast';
  document.body.appendChild(t);
  return t;
}

let toastTimer = null;
export function toast(el, msg, ms = 1600) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// IRIS GL pup menu: right-click pops an item list, resolves with 1-based index.
export function pupMenu(host, items, x, y) {
  return new Promise((resolve) => {
    host.innerHTML = '';
    const m = document.createElement('div');
    m.className = 'sgi-pup';
    const head = document.createElement('div');
    head.className = 'sgi-pup-head';
    head.textContent = items[0];
    m.appendChild(head);
    items.slice(1).forEach((label, i) => {
      const it = document.createElement('div');
      it.className = 'sgi-pup-item';
      it.textContent = label;
      it.onclick = (e) => { e.stopPropagation(); close(); resolve(i + 1); };
      m.appendChild(it);
    });
    host.appendChild(m);
    m.style.left = Math.min(x, window.innerWidth - 190) + 'px';
    m.style.top = Math.min(y, window.innerHeight - items.length * 22 - 30) + 'px';
    const close = () => { host.innerHTML = ''; window.removeEventListener('pointerdown', outside); resolve(0); };
    const outside = () => close();
    setTimeout(() => window.addEventListener('pointerdown', outside), 0);
  });
}

// Exact drand48 from twilight.c / ideas, so "stars are always the same".
export function makeDrand48(seed = 0) {
  let state = (BigInt(seed) << 16n) & 0xFFFFFFFFFFFFn;
  const mult = 0x5DEECE66Dn, add = 0xBn, mask = 0xFFFFFFFFFFFFn;
  return function drand48() {
    state = (state * mult + add) & mask;
    return Number(state >> 16n) / 2147483648;
  };
}

// rand() family used by ep (libc LCG), for exprand / demo jitter.
export function makeRand(seed) {
  let s = seed >>> 0;
  return function rand32768() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s >> 16) & 0x7fff; // 15-bit like IRIX rand
  };
}

export function hlsToRgb(h, l, s) {
  h = ((h % 1) + 1) % 1;
  s = Math.min(Math.max(s, 0), 1);
  l = Math.min(Math.max(l, 0), 1);
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

// Classic ep spectrum colormap: entry i of ncolors = HLS(i/ncolors, .5, 1).
export function spectrumColor(i, ncolors) {
  let k = ((i % ncolors) + ncolors) % ncolors;
  const [r, g, b] = hlsToRgb(k / ncolors, 0.5, 1.0);
  return [r, g, b];
}

// spin/fastobj .bin loader (bounce objects): big-endian quads,
// 8 ints per vertex (color/normal as floats then position, or c3i+v3f).
export async function loadFastObj(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  const magic = dv.getInt32(0, false);
  if (magic !== 0x5423) throw new Error('bad fastobj magic');
  const npoints = dv.getInt32(4, false);
  const colors = dv.getInt32(8, false);
  // File holds 24 bytes per vertex: [n|color as 3 ints][3 position floats];
  // drawfastobj walks them as quads of 4 vertices (memory layout 8 ints each).
  const npolys = Math.floor(npoints / 4);
  const pos = [], col = [], nor = [];
  const V = (bytes) => dv.getFloat32(12 + bytes, false);
  const C = (bytes) => dv.getUint8(12 + bytes + 3);
  const vert = (v) => {
    const b = v * 24;
    if (colors) col.push(C(b) / 255, C(b + 4) / 255, C(b + 8) / 255);
    else nor.push(V(b), V(b + 4), V(b + 8));
    pos.push(V(b + 12), V(b + 16), V(b + 20));
  };
  for (let p = 0; p < npolys; p++)
    for (const v of [0, 1, 2, 0, 2, 3]) vert(p * 4 + v);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  else if (nor.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  else g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geometry: g, vertexColors: !!colors };
}

// halftone stipple texture (jello shadow / twilight color-index mode).
export function halftoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#000';
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (((y % 2 === 0) ? (x % 2 === 0) : (x % 2 === 1))) g.fillRect(x, y, 1, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Shared trackball-ish drag orientation on a quaternion target.
export function dragOrbit(dom, onChange, { button = 0, scale = 0.5 } = {}) {
  let down = false, lx = 0, ly = 0;
  dom.addEventListener('pointerdown', (e) => {
    if (e.button !== button) return;
    down = true; lx = e.clientX; ly = e.clientY;
    dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (!down) return;
    onChange((e.clientX - lx) * scale, (e.clientY - ly) * scale, e);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointerup', () => { down = false; });
}

export function orientFromDelta(q, dx, dy) {
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(dx));
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(dy));
  q.premultiply(qx).premultiply(qy);
}

export function fitCameraToGeometry(camera, geom, dist) {
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
}

export const DEG10 = Math.PI / 1800; // IRIS GL angles are tenths of a degree.
