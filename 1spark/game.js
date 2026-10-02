/* =====================================================================
   THE VOXEL GARDEN OF THE PAGODA — island world edition
   Sparse voxel store on a 65536^3 lattice; rendering emits only the
   exposed faces of each voxel (no coincident cube faces => no flicker).
   ===================================================================== */
"use strict";

const GRID = 65536;          // logical lattice edge; storage is sparse
const WORLD = 512;           // populated island footprint: [-256 .. 255]
const OFF = 256;
const GARDEN = { hx: 150, hz: 110, wall: 4 };   // ~16x the original garden
const POND = { x: -95, z: 60, r: 22 };
const ISLAND_R = 232;
const MTN_R0 = 170, MTN_R1 = 210;

/* ---------------- tiny value-noise ---------------- */
function hash2(x, z) {
  let n = (x * 374761393 + z * 668265263 + 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}
function sstep(t) { return t * t * (3 - 2 * t); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = sstep(xf), v = sstep(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct) {
  let f = 1, s = 0, amp = 1, nrm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f); nrm += amp; amp *= 0.5; f *= 2; }
  return s / nrm;
}
function rnd() { return Math.random(); }
function rr(a, b) { return a + Math.random() * (b - a); }
function ri(a, b) { return Math.floor(rr(a, b + 1)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function COL(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
function jitter(hex, amt) {
  const r = clamp((hex >> 16) + ri(-amt, amt), 0, 255);
  const g = clamp(((hex >> 8) & 255) + ri(-amt, amt), 0, 255);
  const b = clamp((hex & 255) + ri(-amt, amt), 0, 255);
  return COL(r, g, b);
}

/* ---------------- three.js basics ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 6000);
scene.fog = new THREE.Fog(0xa8cbe8, 380, 1300);

(function makeSky() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 512;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#2f6fd0');
  g.addColorStop(0.45, '#7db7e8');
  g.addColorStop(0.75, '#ffd9b0');
  g.addColorStop(1, '#ffe9c8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(cv);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2600, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(dome);
})();

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a6b3a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(120, 180, 90);
scene.add(sun);
const sunBall = new THREE.Mesh(
  new THREE.SphereGeometry(60, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })
);
sunBall.position.set(1100, 1500, -1800);
scene.add(sunBall);

/* baked face shading (terrain geometry uses MeshBasic + vertex colors) */
const _h = Math.hypot(120, 180, 90), LX = 120 / _h, LY = 180 / _h, LZ = 90 / _h;
const FACE_DIRS = [
  [1, 0, 0, [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
  [-1, 0, 0, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [0, 0, 1, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [0, 0, -1, [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]]
];
const FACE_SHADE = FACE_DIRS.map(d => {
  const dot = Math.max(0, d[0] * LX + d[1] * LY + d[2] * LZ);
  const amb = d[1] > 0 ? 0.66 : (d[1] < 0 ? 0.36 : 0.52);
  return clamp(amb + 0.55 * dot, 0.3, 1.12);
});

/* ---------------- voxel store (numeric keys) ---------------- */
const voxels = new Map();            // packed index -> {x,y,z,c,t}
const waterList = [];
let heightGrid = new Float32Array(WORLD * WORLD);

function hAt(x, z) {
  x = clamp(Math.round(x), -OFF, OFF - 1);
  z = clamp(Math.round(z), -OFF, OFF - 1);
  return heightGrid[(x + OFF) * WORLD + (z + OFF)];
}
function kkey(x, y, z) { return (x + OFF) + (z + OFF) * WORLD + y * WORLD * WORLD; }
function addVoxel(x, y, z, c, t) {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  if (y < 0 || x < -OFF || x >= OFF || z < -OFF || z >= OFF) return;
  const k = kkey(x, y, z);
  const e = voxels.get(k);
  if (e) { e.c = c; e.t = t; }
  else voxels.set(k, { x, y, z, c, t });
}
function addBox(x0, y0, z0, w, h, d, c, t, jit) {
  for (let x = x0; x < x0 + w; x++)
    for (let y = y0; y < y0 + h; y++)
      for (let z = z0; z < z0 + d; z++)
        addVoxel(x, y, z, jit ? jitter(c, jit) : c, t);
}
function riverZ(x) { return -162 + 26 * Math.sin(x * 0.01) + 16 * (fbm(x * 0.008, 7.7, 2) - 0.5); }
function riverW(x) { return 5 + 3 * fbm(x * 0.015, 31.3, 2); }
function addWater(x, y, z, c) {
  if (x < -OFF || x >= OFF || z < -OFF || z >= OFF) return;
  waterList.push({ x: Math.round(x), y, z: Math.round(z), c });
}

/* ---------------- world generation ---------------- */
function generateWorld() {
  voxels.clear();
  waterList.length = 0;
  heightGrid = new Float32Array(WORLD * WORLD);

  // 1) heights
  for (let x = -OFF; x < OFF; x++) {
    for (let z = -OFF; z < OFF; z++) {
      const d = Math.hypot(x, z);
      let h = 2 + fbm(x * 0.02, z * 0.02, 4) * 7 + fbm(x * 0.005 + 5.2, z * 0.005 + 9.1, 3) * 3;
      const dw = Math.abs(z - riverZ(x));
      const w = riverW(x);
      if (dw < w) h = Math.min(h, 5);
      else if (dw < w + 3) h = Math.min(h, 7);
      if (Math.abs(x) < GARDEN.hx && Math.abs(z) < GARDEN.hz) {
        h = 12 + fbm(x * 0.05, z * 0.05, 2) * 0.6;
      }
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r) h = 9;
      const m = clamp((d - MTN_R0) / (MTN_R1 - MTN_R0), 0, 1);
      h += m * (26 * fbm(x * 0.02 + 2.3, z * 0.02 + 7.7, 4) + 16 * m);
      if (d > ISLAND_R) h = Math.min(h, 2);
      h = Math.max(1, Math.round(h));
      heightGrid[(x + OFF) * WORLD + (z + OFF)] = h;
    }
  }

  // 2) fill columns (deep enough to cover cliff faces) + water + flowers
  for (let x = -OFF; x < OFF; x++) {
    for (let z = -OFF; z < OFF; z++) {
      const h = hAt(x, z);
      const d = Math.hypot(x, z);
      const lowN = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1));
      const y0 = Math.max(0, Math.min(h, lowN - 4));
      const col = surfaceColor(x, z, h, d);
      for (let y = y0; y <= h; y++) {
        let c;
        if (y === h) c = col.top;
        else if (y >= h - 1) c = col.mid;
        else c = col.deep;
        addVoxel(x, y, z, jitter(c, 9), 't');
      }
      const dwr = Math.abs(z - riverZ(x));
      if (dwr < riverW(x) + 2.2 && h < 6) addWater(x, 6, z, jitter(COL(64, 140, 205), 8));
      if (d > ISLAND_R + 1) addWater(x, 6, z, jitter(COL(52, 130, 195), 10));
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r - 0.5) addWater(x, 11, z, jitter(COL(70, 150, 190), 8));
      if (Math.abs(x) < GARDEN.hx - GARDEN.wall - 2 && Math.abs(z) < GARDEN.hz - GARDEN.wall - 2 && h === 12) {
        if (hash2(x * 3 + 11, z * 5 + 7) < 0.012) {
          const fl = [COL(244, 80, 110), COL(255, 200, 40), COL(190, 90, 220), COL(255, 255, 255), COL(255, 130, 30), COL(90, 120, 250)][Math.floor(hash2(x, z * 3) * 6)];
          addVoxel(x, h + 1, z, fl, 'v');
        }
      }
    }
  }
  // flower meadow clusters
  for (let i = 0; i < 45; i++) {
    const cx = ri(-GARDEN.hx + 10, GARDEN.hx - 10), cz = ri(-GARDEN.hz + 10, GARDEN.hz - 10);
    if (Math.hypot(cx - POND.x, cz - POND.z) < POND.r + 4) continue;
    const pal = [COL(244, 80, 110), COL(255, 200, 40), COL(190, 90, 220), COL(255, 255, 255), COL(255, 130, 30)];
    const fc = pal[Math.floor(rnd() * pal.length)];
    for (let k = 0; k < 70; k++) {
      const x = cx + ri(-6, 6), z = cz + ri(-6, 6);
      if (Math.abs(x) > GARDEN.hx - 6 || Math.abs(z) > GARDEN.hz - 6) continue;
      if (Math.abs(x) < 5 && z > -26) continue;
      if (Math.abs(z) < 5 && Math.abs(x) < 141) continue;
      if (hAt(x, z) === 12) addVoxel(x, 13, z, jitter(fc, 18), 'v');
    }
  }

  // 3) structures & flora
  buildPaths();
  buildHedge();
  buildPagoda(0, -30, 10, 5);
  buildPagoda(-105, -62, 5, 3);
  buildTeahouse(100, -55);
  buildTorii(0, 106, 10);
  buildBridge(-30, Math.round(riverZ(-30)));
  buildBarn(60, 150);
  for (const lz of [-16, -4, 10, 24, 40, 56, 72, 88, 100]) { buildLantern(7, lz); buildLantern(-7, lz); }
  for (const lx of [-130, -60, -30, 30, 60, 100, 130]) buildLantern(lx, 5);
  for (let i = 0; i < 26; i++) {
    const lx = ri(-GARDEN.hx + 14, GARDEN.hx - 14), lz = ri(-GARDEN.hz + 12, GARDEN.hz - 12);
    if (Math.hypot(lx - POND.x, lz - POND.z) < POND.r + 6) continue;
    if (Math.abs(lx) < 13 && lz < 12) continue;
    buildLantern(lx, lz);
  }
  const gardenCherries = [
    [-40, -70], [40, -70], [-70, -40], [70, -40], [-130, 20], [130, 20],
    [-60, 92], [0, 95], [60, 92], [120, 90], [-130, 95], [-30, 30], [30, 30],
    [-45, 12], [45, 12], [95, 30], [-120, -20], [120, -20], [85, -95], [-85, -95],
    [-25, -90], [25, -90], [140, 55], [-140, 55]
  ];
  for (const p of gardenCherries) addTree(p[0], p[1], 'cherry');
  for (let x = -232; x <= 232; x += 11) {
    const jx = x + ri(-3, 3);
    const side = hash2(x, 3) < 0.5 ? 1 : -1;
    const bz = Math.round(riverZ(jx) + side * (riverW(jx) + 4 + ri(0, 3)));
    if (Math.abs(bz) < OFF - 4 && hAt(jx, bz) >= 6 && Math.hypot(jx, bz) < ISLAND_R)
      addTree(jx, bz, hash2(x, 9) < 0.6 ? 'cherry' : 'oak');
  }
  for (let i = 0; i < 170; i++) {
    const x = ri(-200, 200), z = ri(120, 200);
    if (Math.hypot(x, z) > ISLAND_R - 8) continue;
    addTree(x, z, hash2(x, z) < 0.5 ? 'maple' : (hash2(x, z) < 0.78 ? 'cherry' : 'oak'));
  }
  for (let i = 0; i < 150; i++) {
    const a = rr(2.4, 3.9), rad = rr(160, ISLAND_R - 12);
    const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad * 0.7);
    if (Math.hypot(x, z) > GARDEN.hx + 8 && Math.hypot(x, z) < ISLAND_R - 6)
      addTree(x, z, hash2(x * 2, z) < 0.6 ? 'pine' : 'oak');
  }
  for (let i = 0; i < 420; i++) {
    const x = ri(-140, -105), z = ri(-95, -45);
    if (hAt(x, z) > 8) addBamboo(x, z);
  }
  for (let i = 0; i < 100; i++) {
    const x = ri(160, 215), z = ri(-70, 90);
    if (Math.hypot(x, z) > ISLAND_R - 10) continue;
    addTree(x, z, hash2(x, z * 2) < 0.35 ? 'cherry' : 'oak');
  }
  for (let i = 0; i < 150; i++) {
    const a = rr(0, Math.PI * 2), r = rr(MTN_R0 + 8, ISLAND_R - 8);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    if (hAt(x, z) > 12 && hAt(x, z) < 42) addTree(x, z, 'pine');
  }
}

function surfaceColor(x, z, h, d) {
  if (d > ISLAND_R) return { top: COL(216, 196, 140), mid: COL(196, 176, 124), deep: COL(158, 140, 100) };
  const dw = Math.abs(z - riverZ(x));
  const w = riverW(x);
  if (h <= 7 && dw < w + 3.2)
    return { top: COL(212, 190, 130), mid: COL(196, 170, 112), deep: COL(150, 128, 90) };
  if (h > 44) return { top: COL(240, 246, 255), mid: COL(225, 228, 238), deep: COL(150, 150, 160) };
  if (h > 36) return { top: COL(128, 130, 138), mid: COL(112, 114, 122), deep: COL(92, 94, 102) };
  if (Math.abs(x) < GARDEN.hx && Math.abs(z) < GARDEN.hz) {
    const g = hash2(x, z);
    const top = g < 0.33 ? COL(88, 168, 84) : (g < 0.66 ? COL(98, 178, 88) : COL(78, 158, 78));
    return { top, mid: COL(120, 92, 60), deep: COL(96, 72, 48) };
  }
  if (h > 24) return { top: COL(58, 110, 55), mid: COL(96, 80, 56), deep: COL(80, 66, 46) };
  const g = hash2(x * 2, z);
  const top = g < 0.25 ? COL(92, 170, 80) : (g < 0.5 ? COL(104, 178, 86) : (g < 0.8 ? COL(84, 158, 74) : COL(120, 186, 90)));
  return { top, mid: COL(112, 88, 58), deep: COL(92, 70, 46) };
}

/* ---------------- paths & garden furniture ---------------- */
function buildPaths() {
  const stone = COL(198, 192, 178), gravel = COL(178, 152, 112);
  for (let z = -25; z <= GARDEN.hz; z++)
    for (let x = -3; x <= 3; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  for (let x = -GARDEN.hx + 9; x <= GARDEN.hx - 9; x++)
    for (let z = -2; z <= 2; z++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  for (let z = 2; z <= 38; z++)
    for (let x = -98; x <= -92; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  for (let z = 0; z >= -108; z--)
    for (let x = -32; x <= -28; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  for (let t = 0; t <= 44; t++) {
    const x = Math.round(t * 1.35), z = Math.round(GARDEN.hz + t * 0.9);
    for (let dx = -2; dx <= 2; dx++) addVoxel(x + dx, hAt(x + dx, z), z, jitter(gravel, 10), 't');
  }
}

function buildHedge() {
  const g = 12, dark = COL(44, 92, 46);
  const wx = GARDEN.hx - GARDEN.wall, wz = GARDEN.hz - GARDEN.wall;
  for (let x = -wx; x <= wx; x++) {
    if (Math.abs(x) >= 8) addBox(x, g + 1, wz, 1, 3, 1, jitter(dark, 14), 's');            // south (gate gap)
    if (Math.abs(x) >= 8 && Math.abs(x + 30) > 3) addBox(x, g + 1, -wz, 1, 3, 1, jitter(dark, 14), 's'); // north (gate + bridge path gaps)
  }
  for (let z = -wz; z <= wz; z++) {
    if (Math.abs(z) >= 8) {
      addBox(wx, g + 1, z, 1, 3, 1, jitter(dark, 14), 's');                                // east
      addBox(-wx, g + 1, z, 1, 3, 1, jitter(dark, 14), 's');                               // west
    }
  }
  for (const p of [[10, wz], [-10, wz], [wx, 10], [-wx, 10], [wx, -wz + 10], [-wx, -wz + 10], [10, -wz], [-10, -wz]])
    addBox(p[0] - 1, g + 1, p[1] - 1, 3, 3, 3, COL(52, 108, 52), 's', 12);
}

function buildPagoda(cx, cz, hw0, tiers) {
  const g = 12;
  const base = hw0 + 2;
  addBox(cx - base, g + 1, cz - base, base * 2 + 1, 2, base * 2 + 1, COL(158, 162, 168), 's', 8);
  addBox(cx - base + 1, g + 3, cz - base + 1, base * 2 - 1, 1, base * 2 - 1, COL(138, 142, 148), 's', 6);
  const wallC = COL(242, 236, 224), postC = COL(146, 56, 40),
        roofC = COL(38, 52, 96), goldC = COL(232, 182, 76);
  let y = g + 4;
  for (let i = 0; i < tiers; i++) {
    const hw = Math.max(1, hw0 - Math.round(i * (hw0 / tiers)));
    const wh = hw0 > 8 ? 4 : 3;
    for (let x = cx - hw; x <= cx + hw; x++)
      for (let z = cz - hw; z <= cz + hw; z++) {
        const edge = (x === cx - hw || x === cx + hw || z === cz - hw || z === cz + hw);
        if (!edge) continue;
        const post = ((x - cx + 30) % 3 === 0) || ((z - cz + 30) % 3 === 0);
        for (let yy = 0; yy < wh; yy++) addVoxel(x, y + yy, z, post ? postC : wallC, 's');
      }
    for (const a of [[cx, cz - hw], [cx, cz + hw], [cx - hw, cz], [cx + hw, cz]])
      addVoxel(a[0], y + Math.floor(wh / 2), a[1], COL(60, 42, 40), 's');
    y += wh;
    const rh = hw + (hw0 > 8 ? 3 : 2);
    for (let x = cx - rh; x <= cx + rh; x++)
      for (let z = cz - rh; z <= cz + rh; z++) {
        const edgeX = Math.abs(x - cx) >= rh - 1, edgeZ = Math.abs(z - cz) >= rh - 1;
        const corner = (Math.abs(x - cx) === rh && Math.abs(z - cz) === rh);
        const goldTip = corner || (edgeX && edgeZ && hash2(x * 5 + i, z * 3) < 0.3) ||
                        (edgeZ && (x - cx + 30) % 2 === 0 && rnd() < 0.22) ||
                        (edgeX && (z - cz + 30) % 2 === 0 && rnd() < 0.22);
        addVoxel(x, y, z, goldTip ? goldC : jitter(roofC, 10), 's');
      }
    addVoxel(cx - rh, y, cz, goldC, 's'); addVoxel(cx + rh, y, cz, goldC, 's');
    addVoxel(cx, y, cz - rh, goldC, 's'); addVoxel(cx, y, cz + rh, goldC, 's');
    y += 1;
  }
  addBox(cx - 1, y, cz - 1, 3, 1, 3, COL(214, 168, 70), 's');
  const sp = hw0 > 8 ? 7 : 4;
  for (let k = 0; k < sp; k++) addVoxel(cx, y + 1 + k, cz, k % 2 ? COL(255, 214, 110) : goldC, 's');
  addVoxel(cx, y + sp + 1, cz, COL(255, 240, 170), 's');
  for (let s = 0; s < 5; s++) addBox(cx - 3, g + 1 + (4 - s), cz + base + s, 7, 1, 1, COL(168, 170, 176), 's', 6);
  addBox(cx - 1, g + 4, cz + base, 3, 4, 1, COL(94, 42, 30), 's');
  addVoxel(cx, g + 8, cz + base, COL(232, 182, 76), 's');
}

function buildTorii(tx, tz, span) {
  const g = 12, verm = COL(201, 58, 42);
  for (const s of [-span, span]) {
    addBox(tx + s - 1, g + 1, tz, 2, 2, 2, COL(238, 238, 232), 's');
    addBox(tx + s, g + 3, tz, 1, 8, 1, jitter(verm, 8), 's');
    addVoxel(tx + s, g + 11, tz, COL(245, 245, 240), 's');
  }
  addBox(tx - span - 1, g + 11, tz, span * 2 + 3, 1, 1, jitter(verm, 6), 's');
  addBox(tx - span, g + 9, tz, span * 2 + 1, 1, 1, jitter(verm, 6), 's');
  addVoxel(tx, g + 9, tz, COL(90, 40, 30), 's');
  addBox(tx - span - 2, g + 12, tz, span * 2 + 5, 1, 2, COL(60, 55, 60), 's');
  addVoxel(tx - span - 2, g + 13, tz, COL(232, 182, 76), 's');
  addVoxel(tx + span + 2, g + 13, tz, COL(232, 182, 76), 's');
}

function buildBridge(bx, bz) {
  const red = COL(178, 48, 48);
  const span = 24;
  for (let t = 0; t <= span; t++) {
    const z = bz - span / 2 + t;
    const y = 15 + Math.round(6 * (1 - Math.pow((t - span / 2) / (span / 2), 2)));
    for (let dx = -2; dx <= 2; dx++) addVoxel(bx + dx, y, z, jitter(red, 10), 's');
    if (t % 2 === 0) { addVoxel(bx - 2, y + 1, z, red, 's'); addVoxel(bx + 2, y + 1, z, red, 's'); }
    if (t % 5 === 1) { addVoxel(bx - 2, y + 2, z, COL(232, 182, 76), 's'); addVoxel(bx + 2, y + 2, z, COL(232, 182, 76), 's'); }
  }
  for (const t of [4, span - 4]) {
    const z = bz - span / 2 + t;
    const y = 15 + Math.round(6 * (1 - Math.pow((t - span / 2) / (span / 2), 2)));
    for (let yy = 5; yy < y; yy++) addVoxel(bx, yy, z, jitter(COL(120, 90, 60), 8), 's');
  }
}

function buildLantern(lx, lz) {
  const g = hAt(lx, lz);
  if (g < 8 || Math.abs(lx) >= GARDEN.hx || Math.abs(lz) >= GARDEN.hz) return;
  const stone = COL(150, 152, 158);
  addVoxel(lx, g + 1, lz, jitter(stone, 8), 's');
  addVoxel(lx, g + 2, lz, jitter(stone, 8), 's');
  addVoxel(lx, g + 3, lz, jitter(stone, 8), 's');
  addBox(lx - 1, g + 4, lz - 1, 3, 1, 3, COL(136, 138, 144), 's', 6);
  addBox(lx - 1, g + 5, lz - 1, 2, 2, 2, COL(255, 212, 122), 's');
  addBox(lx - 1, g + 7, lz - 1, 3, 1, 3, COL(120, 122, 128), 's', 6);
  addVoxel(lx, g + 8, lz, COL(150, 152, 158), 's');
}

function buildTeahouse(tx, tz) {
  const g = 12;
  addBox(tx - 7, g + 1, tz - 6, 15, 1, 12, COL(140, 104, 66), 's', 8);
  for (let x = tx - 6; x <= tx + 6; x++)
    for (let z = tz - 5; z <= tz + 5; z++) {
      const edge = (x === tx - 6 || x === tx + 6 || z === tz - 5 || z === tz + 5);
      if (!edge) continue;
      for (let y = g + 2; y <= g + 4; y++)
        addVoxel(x, y, z, (x % 3 === 0 || z % 3 === 0) ? COL(120, 52, 38) : COL(238, 226, 205), 's');
    }
  for (let r = 0; r <= 6; r++)
    for (let x = tx - 7; x <= tx + 7; x++)
      for (let z = tz - 6; z <= tz + 6; z++) {
        const reach = Math.max(Math.abs(x - tx) / 8, Math.abs(z - tz) / 7);
        if (Math.abs(reach - (1 - r / 6.6)) < 0.09) addVoxel(x, g + 5 + r, z, jitter(COL(52, 44, 52), 8), 's');
      }
  addVoxel(tx, g + 12, tz, COL(232, 182, 76), 's');
  for (const c of [[tx - 7, tz - 6], [tx + 7, tz - 6], [tx - 7, tz + 6], [tx + 7, tz + 6]])
    addVoxel(c[0], g + 6, c[1], COL(220, 60, 48), 's');
}

function buildBarn(bx, bz) {
  const g = Math.round(hAt(bx, bz));
  const red = COL(168, 46, 38), white = COL(240, 238, 230), roofC = COL(104, 108, 116);
  const W = 18, D = 12, H = 7;
  for (let x = bx; x < bx + W; x++)
    for (let z = bz; z < bz + D; z++) {
      const edge = (x === bx || x === bx + W - 1 || z === bz || z === bz + D - 1);
      if (!edge) continue;
      for (let y = g + 1; y <= g + H; y++) addVoxel(x, y, z, jitter(red, 8), 's');
    }
  for (let r = 0; r < 6; r++)
    for (let z = bz; z < bz + D; z++)
      for (let x = bx + r; x <= bx + W - 1 - r; x++) {
        const isEdge = (x === bx + r || x === bx + W - 1 - r);
        if (r < 2 || isEdge || z === bz || z === bz + D - 1) addVoxel(x, g + H + 1 + r, z, jitter(roofC, 8), 's');
      }
  addBox(bx + 6, g + 1, bz + D - 1, 6, 6, 1, COL(120, 34, 28), 's');
  addBox(bx + 6, g + 7, bz + D - 1, 6, 1, 1, white, 's');
  addVoxel(bx + 8, g + 3, bz + D - 1, white, 's'); addVoxel(bx + 10, g + 3, bz + D - 1, white, 's');
  addBox(bx + 7, g + 9, bz, 4, 2, 1, COL(80, 60, 40), 's');
  for (let y = g + 1; y <= g + 13; y++)
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (dx * dx + dz * dz <= 5 && (dx * dx + dz * dz >= 2 || y % 4 === 0))
          addVoxel(bx + W + 5 + dx, y, bz + 6 + dz, jitter(COL(190, 192, 196), 6), 's');
  addBox(bx + W + 3, g + 14, bz + 4, 5, 1, 5, COL(168, 46, 38), 's', 6);
  for (let fx = bx - 14; fx <= bx + W + 12; fx += 3) {
    addVoxel(fx, g + 1, bz - 10, COL(150, 116, 80), 's');
    addVoxel(fx, g + 2, bz - 10, COL(150, 116, 80), 's');
  }
}

/* ---------------- trees ---------------- */
function addTree(x, z, kind) {
  if (Math.abs(x) >= OFF - 3 || Math.abs(z) >= OFF - 3) return;
  const g = Math.round(hAt(x, z));
  if (g < 7) return;
  if (kind === 'cherry') {
    const th = 4 + ri(0, 2);
    for (let y = 1; y <= th; y++) addVoxel(x, g + y, z, jitter(COL(104, 72, 50), 8), 'v');
    const r = 4 + ri(0, 1);
    const pal = [COL(255, 183, 197), COL(255, 158, 182), COL(255, 205, 221), COL(255, 240, 244)];
    blobCanopy(x, g + th + 1, z, r, () => pal[Math.floor(rnd() * pal.length)], 0.62);
  } else if (kind === 'maple') {
    const th = 4 + ri(0, 2);
    for (let y = 1; y <= th; y++) addVoxel(x, g + y, z, jitter(COL(96, 66, 44), 8), 'v');
    const pal = [COL(220, 62, 32), COL(232, 116, 26), COL(208, 152, 30), COL(180, 40, 30)];
    blobCanopy(x, g + th + 1, z, 4, () => pal[Math.floor(rnd() * pal.length)], 0.6);
  } else if (kind === 'pine') {
    const h0 = 3;
    for (let y = 1; y <= h0; y++) addVoxel(x, g + y, z, jitter(COL(88, 60, 40), 6), 'v');
    for (let tier = 0; tier < 3; tier++) {
      const r = 3 - tier;
      const ty = g + h0 + tier * 2;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          for (let dy = 0; dy < 2; dy++)
            if (Math.abs(dx) + Math.abs(dz) <= r + (dy ? 0 : 1))
              addVoxel(x + dx, ty + dy, z + dz, jitter(COL(38, 92 - tier * 8, 46), 8), 'v');
    }
    addVoxel(x, g + h0 + 6, z, COL(34, 84, 42), 'v');
  } else { // oak
    const th = 3 + ri(0, 2);
    for (let y = 1; y <= th; y++) addVoxel(x, g + y, z, jitter(COL(100, 70, 46), 8), 'v');
    const pal = [COL(54, 134, 56), COL(64, 148, 62), COL(44, 118, 48), COL(84, 160, 68)];
    blobCanopy(x, g + th + 1, z, 3 + ri(0, 1), () => pal[Math.floor(rnd() * pal.length)], 0.58);
  }
}
function blobCanopy(cx, cy, cz, r, colorFn, fill) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++) {
        const d2 = dx * dx + dy * dy * 1.35 + dz * dz;
        if (d2 > r * r + 1) continue;
        if (hash2(cx * 31 + dx * 7, cz * 17 + dz * 13 + dy * 5) > fill + 0.35 * (1 - d2 / (r * r))) continue;
        addVoxel(cx + dx, cy + dy + Math.floor(r * 0.5), cz + dz, colorFn(), 'v');
      }
}
function addBamboo(x, z) {
  const g = Math.round(hAt(x, z));
  const h0 = 6 + ri(0, 4);
  for (let y = 1; y <= h0; y++) addVoxel(x, g + y, z, jitter(COL(120, 178, 82), 10), 'v');
  for (let k = 0; k < 5; k++) {
    const dx = ri(-1, 1), dz = ri(-1, 1);
    addVoxel(x + dx, g + h0 - ri(0, 2), z + dz, jitter(COL(86, 158, 66), 8), 'v');
  }
}

/* ---------------- face-merged rendering (flicker-free) ---------------- */
const matTerrain = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true });
const matWater = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
const BOX_GEO_PART = new THREE.BoxGeometry(1, 1, 1);
let terrainMesh = null, waterMesh = null;

function buildFaceGeometry(list, topOnly) {
  const posArr = [], colArr = [];
  for (const e of list) {
    for (let f = 0; f < 6; f++) {
      const d = FACE_DIRS[f];
      if (topOnly) { if (f !== 2) continue; }
      else if (voxels.has(kkey(e.x + d[0], e.y + d[1], e.z + d[2]))) continue;
      const shade = topOnly ? 1.0 : FACE_SHADE[f];
      const r = Math.min(1, ((e.c >> 16) & 255) / 255 * shade);
      const g = Math.min(1, ((e.c >> 8) & 255) / 255 * shade);
      const b = Math.min(1, (e.c & 255) / 255 * shade);
      const q = d[3];
      const idx = [0, 1, 2, 0, 2, 3];
      for (let i = 0; i < 6; i++) {
        const c = q[idx[i]];
        posArr.push(e.x + c[0], e.y + c[1], e.z + c[2]);
        colArr.push(r, g, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArr), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colArr), 3));
  geo.computeBoundingSphere();
  return geo;
}
function rebuild() {
  if (terrainMesh) { scene.remove(terrainMesh); terrainMesh.geometry.dispose(); terrainMesh = null; }
  if (waterMesh) { scene.remove(waterMesh); waterMesh.geometry.dispose(); waterMesh = null; }
  const list = [];
  for (const e of voxels.values()) {
    if (!voxels.has(kkey(e.x + 1, e.y, e.z)) || !voxels.has(kkey(e.x - 1, e.y, e.z)) ||
        !voxels.has(kkey(e.x, e.y + 1, e.z)) || !voxels.has(kkey(e.x, e.y - 1, e.z)) ||
        !voxels.has(kkey(e.x, e.y, e.z + 1)) || !voxels.has(kkey(e.x, e.y, e.z - 1)))
      list.push(e);
  }
  const geoT = buildFaceGeometry(list, false);
  terrainMesh = new THREE.Mesh(geoT, matTerrain);
  terrainMesh.frustumCulled = false;
  scene.add(terrainMesh);

  const geoW = buildFaceGeometry(waterList, true);
  waterMesh = new THREE.Mesh(geoW, matWater);
  waterMesh.frustumCulled = false;
  scene.add(waterMesh);

  const st = document.getElementById('stats');
  if (st) st.textContent = 'grid ' + GRID + '^3 lattice (sparse) | voxels ' + voxels.size.toLocaleString() +
    ' | tris ' + (geoT.attributes.position.count / 3).toLocaleString() + ' | island world ' + WORLD + '^2';
}
/* =====================================================================
   CRITTERS
   ===================================================================== */
const matCache = {};
function lamMat(hex) {
  if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
  return matCache[hex];
}
function mkBox(w, h, d, hex, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lamMat(hex));
  m.position.set(x, y, z);
  return m;
}
const critters = [];
function spawnCritter(kind, patch) {
  const g = new THREE.Group();
  const parts = { legs: [], head: null };
  if (kind === 'chicken') {
    g.add(mkBox(0.6, 0.45, 0.5, COL(250, 248, 245), 0, 0.55, 0));
    g.add(mkBox(0.25, 0.18, 0.45, COL(120, 40, 30), 0, 0.62, -0.3));
    g.add(mkBox(0.3, 0.3, 0.3, COL(252, 250, 248), 0, 0.95, 0.32));
    parts.head = g.children[g.children.length - 1];
    g.add(mkBox(0.12, 0.14, 0.12, COL(220, 40, 40), 0, 1.16, 0.32));
    g.add(mkBox(0.1, 0.08, 0.12, COL(240, 150, 40), 0, 0.92, 0.52));
    for (const sx of [-0.15, 0.15]) {
      const leg = mkBox(0.09, 0.32, 0.09, COL(232, 170, 60), sx, 0.32, 0);
      leg.geometry.translate(0, -0.16, 0);
      parts.legs.push(leg); g.add(leg);
    }
  } else if (kind === 'cow') {
    const body = new THREE.Group();
    body.add(mkBox(1.6, 0.9, 1.0, COL(248, 246, 242), 0, 0, 0));
    for (let i = 0; i < 4; i++)
      body.add(mkBox(0.45, 0.45, 0.5, COL(40, 38, 38), rr(-0.7, 0.7), rr(-0.2, 0.3), rr(-0.3, 0.3)));
    body.position.y = 1.05;
    g.add(body);
    g.add(mkBox(0.6, 0.55, 0.6, COL(248, 246, 242), 0, 1.35, 0.78));
    parts.head = g.children[g.children.length - 1];
    g.add(mkBox(0.4, 0.22, 0.15, COL(240, 170, 180), 0, 1.2, 1.05));
    g.add(mkBox(0.1, 0.16, 0.1, COL(230, 228, 220), -0.28, 1.72, 0.75));
    g.add(mkBox(0.1, 0.16, 0.1, COL(230, 228, 220), 0.28, 1.72, 0.75));
    g.add(mkBox(0.12, 0.4, 0.12, COL(60, 50, 45), 0, 0.2, -0.55));
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.3, 0.3]) {
      const leg = mkBox(0.18, 0.62, 0.18, COL(70, 60, 55), sx, 0.62, sz);
      leg.geometry.translate(0, -0.31, 0);
      parts.legs.push(leg); g.add(leg);
    }
  } else { // pig
    const body = new THREE.Group();
    body.add(mkBox(1.2, 0.7, 0.85, COL(244, 150, 170), 0, 0, 0));
    body.position.y = 0.85;
    g.add(body);
    g.add(mkBox(0.45, 0.42, 0.5, COL(242, 140, 162), 0, 1.0, 0.62));
    parts.head = g.children[g.children.length - 1];
    g.add(mkBox(0.24, 0.18, 0.1, COL(228, 110, 140), 0, 0.94, 0.88));
    g.add(mkBox(0.14, 0.16, 0.08, COL(232, 120, 150), -0.16, 1.28, 0.6));
    g.add(mkBox(0.14, 0.16, 0.08, COL(232, 120, 150), 0.16, 1.28, 0.6));
    const tail = mkBox(0.08, 0.25, 0.08, COL(236, 130, 158), 0, 0.95, -0.6);
    tail.rotation.x = 0.6;
    g.add(tail);
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.26, 0.26]) {
      const leg = mkBox(0.15, 0.5, 0.15, COL(228, 120, 146), sx, 0.5, sz);
      leg.geometry.translate(0, -0.25, 0);
      parts.legs.push(leg); g.add(leg);
    }
  }
  const c = {
    kind, group: g, parts, patch,
    x: rr(patch.x0, patch.x1), z: rr(patch.z0, patch.z1),
    tx: 0, tz: 0, speed: kind === 'chicken' ? 1.1 : 0.7, fright: 0, phase: rr(0, 6)
  };
  c.tx = c.x; c.tz = c.z;
  scene.add(g);
  critters.push(c);
}
function newCritterTarget(c) {
  c.tx = rr(c.patch.x0, c.patch.x1);
  c.tz = rr(c.patch.z0, c.patch.z1);
}
function initCritters() {
  for (let i = 0; i < 14; i++) spawnCritter('chicken', { x0: -GARDEN.hx + 8, x1: GARDEN.hx - 8, z0: -GARDEN.hz + 8, z1: GARDEN.hz - 14 });
  for (let i = 0; i < 8; i++) spawnCritter('cow', { x0: 25, x1: 145, z0: 125, z1: 190 });
  for (let i = 0; i < 6; i++) spawnCritter('pig', { x0: 40, x1: 100, z0: 130, z1: 175 });
}
function updateCritters(dt, t) {
  for (const c of critters) {
    const dx = c.tx - c.x, dz = c.tz - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) {
      if (rnd() < 0.01) newCritterTarget(c);
    } else {
      const sp = c.speed * (c.fright > 0 ? 3.4 : 1);
      c.x += (dx / dist) * sp * dt;
      c.z += (dz / dist) * sp * dt;
      c.group.rotation.y = Math.atan2(dx, dz);
    }
    c.fright = Math.max(0, c.fright - dt);
    c.group.position.set(c.x, hAt(c.x, c.z) + 1, c.z);
    const sw = Math.sin(t * 9 + c.phase) * (dist > 0.4 ? 0.55 : 0.05) * (c.fright > 0 ? 1.6 : 1);
    for (let i = 0; i < c.parts.legs.length; i++)
      c.parts.legs[i].rotation.x = (i % 2 ? sw : -sw);
    if (c.kind === 'chicken' && c.parts.head && dist < 0.4)
      c.parts.head.rotation.x = Math.sin(t * 5 + c.phase) * 0.5;
  }
}

/* =====================================================================
   KOI — live fish cruising under the pond surface
   ===================================================================== */
const koi = [];
function initKoi() {
  const skins = [
    [COL(255, 120, 40), COL(255, 200, 150)], [COL(250, 250, 250), COL(230, 60, 50)],
    [COL(240, 80, 60), COL(255, 220, 180)], [COL(255, 170, 60), COL(255, 255, 255)],
    [COL(60, 60, 70), COL(250, 250, 250)], [COL(255, 130, 50), COL(255, 240, 200)],
    [COL(250, 250, 250), COL(255, 150, 40)], [COL(255, 100, 45), COL(80, 60, 50)],
    [COL(250, 240, 200), COL(255, 90, 60)], [COL(90, 120, 200), COL(250, 250, 250)]
  ];
  for (let i = 0; i < 10; i++) {
    const bodyC = skins[i % skins.length][0], tailC = skins[i % skins.length][1];
    const g = new THREE.Group();
    g.add(mkBox(0.5, 0.28, 1.1, bodyC, 0, 0, 0));
    const tail = mkBox(0.36, 0.2, 0.4, tailC, 0, 0, -0.75);
    tail.geometry.translate(0, 0, -0.2);
    g.add(tail);
    g.add(mkBox(0.7, 0.06, 0.3, tailC, 0, 0.02, 0.1));
    scene.add(g);
    koi.push({
      group: g, tail,
      ang: rr(0, Math.PI * 2), rad: rr(3, POND.r - 5),
      w: rr(0.16, 0.4) * (rnd() < 0.5 ? -1 : 1),
      wob: rr(0, 6), y: rr(10.35, 10.7)
    });
  }
}
function updateKoi(dt, t) {
  for (const k of koi) {
    k.ang += k.w * dt;
    const rad = k.rad + Math.sin(t * 0.4 + k.wob) * 3;
    k.group.position.set(
      POND.x + Math.cos(k.ang) * rad,
      k.y + Math.sin(t * 2 + k.wob) * 0.06,
      POND.z + Math.sin(k.ang) * rad
    );
    k.group.rotation.y = Math.atan2(-Math.sin(k.ang) * k.w, Math.cos(k.ang) * k.w);
    k.tail.rotation.y = Math.sin(t * 7 + k.wob) * 0.55;
    if (rnd() < 0.0008) k.w = -k.w;
  }
}

/* =====================================================================
   BIRDS — flapping flocks
   ===================================================================== */
const flocks = [];
function makeBird(hex1, hex2) {
  const g = new THREE.Group();
  g.add(mkBox(0.35, 0.3, 0.8, hex1, 0, 0, 0));
  g.add(mkBox(0.26, 0.24, 0.28, hex1, 0, 0.14, 0.5));
  g.add(mkBox(0.1, 0.08, 0.16, COL(240, 170, 60), 0, 0.12, 0.72));
  g.add(mkBox(0.2, 0.12, 0.4, hex2, 0, 0.02, -0.6));
  const w1 = mkBox(0.9, 0.07, 0.45, hex2, 0.55, 0.05, 0);
  w1.geometry.translate(0.45, 0, 0);
  const w2 = mkBox(0.9, 0.07, 0.45, hex2, -0.55, 0.05, 0);
  w2.geometry.translate(-0.45, 0, 0);
  g.add(w1); g.add(w2);
  return { group: g, w1, w2 };
}
function initFlocks() {
  const sets = [
    { cx: 0, cz: 0, cy: 55, n: 6, r: 40, hex1: COL(60, 62, 70), hex2: COL(120, 124, 135) },
    { cx: POND.x, cz: POND.z, cy: 42, n: 5, r: 26, hex1: COL(250, 250, 252), hex2: COL(220, 220, 226) },
    { cx: 100, cz: -55, cy: 60, n: 7, r: 48, hex1: COL(40, 60, 90), hex2: COL(90, 130, 180) },
    { cx: 60, cz: 150, cy: 48, n: 5, r: 34, hex1: COL(120, 70, 40), hex2: COL(190, 140, 90) },
    { cx: -30, cz: -165, cy: 65, n: 6, r: 44, hex1: COL(30, 80, 60), hex2: COL(70, 140, 110) }
  ];
  for (const s of sets) {
    const birds = [];
    for (let i = 0; i < s.n; i++) birds.push(makeBird(s.hex1, s.hex2));
    scene.add(...birds.map(b => b.group));
    flocks.push({ cx: s.cx, cz: s.cz, cy: s.cy, r: s.r, birds, base: rr(0, 6), speed: rr(0.25, 0.45) * (rnd() < 0.5 ? -1 : 1) });
  }
}
function updateFlocks(dt, t) {
  for (const f of flocks) {
    f.base += f.speed * dt;
    for (let i = 0; i < f.birds.length; i++) {
      const b = f.birds[i];
      const a = f.base + i * 0.45;
      const rad = f.r + (i % 3) * 5 + Math.sin(t * 0.6 + i) * 3;
      b.group.position.set(f.cx + Math.cos(a) * rad, f.cy + Math.sin(t * 1.4 + i * 2) * 2.5, f.cz + Math.sin(a) * rad);
      const w = f.speed;
      b.group.rotation.y = Math.atan2(-Math.sin(a) * w, Math.cos(a) * w);
      const flap = Math.sin(t * 11 + i * 1.3) * 0.9;
      b.w1.rotation.z = flap;
      b.w2.rotation.z = -flap;
    }
  }
}

/* =====================================================================
   SKY TRAFFIC — balloons, blimps, planes, clouds
   ===================================================================== */
const floaters = [];
function addFloater(group, kind, opts) {
  floaters.push(Object.assign({ group, kind }, opts));
  scene.add(group);
}
function makeBalloon(pal, x, y, z) {
  const g = new THREE.Group();
  const R = 5.5, H = 12;
  for (let dy = 0; dy < H; dy++) {
    const tt = dy / H;
    const rad = R * Math.sin(clamp(tt / 0.78, 0, 1) * Math.PI * 0.92);
    const ri2 = Math.ceil(rad);
    for (let dx = -ri2; dx <= ri2; dx++)
      for (let dz = -ri2; dz <= ri2; dz++) {
        if (dx * dx + dz * dz > rad * rad + 0.6) continue;
        g.add(mkBox(1, 1, 1, pal[Math.floor((dy / 1.6) + (Math.abs(dx) + Math.abs(dz))) % pal.length], dx, dy - H + 2, dz));
      }
  }
  g.add(mkBox(1.8, 1.4, 1.8, COL(126, 84, 50), 0, -H - 0.6, 0));
  g.add(mkBox(0.4, 0.5, 0.4, COL(250, 220, 180), 0, -H + 0.2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(mkBox(0.12, 1.6, 0.12, COL(60, 50, 44), sx, -H + 0.2, sz));
  addFloater(g, 'balloon', { x, y, z, dir: rnd() < 0.5 ? 1 : -1, bob: rr(0, 6), speed: rr(1.6, 3.2) });
}
function makeBlimp(x, y, z, bodyHex, stripeHex) {
  const g = new THREE.Group();
  for (let dx = -8; dx <= 8; dx++) {
    const s = 1 - (dx / 8) * (dx / 8);
    const rad = 2.4 * Math.sqrt(Math.max(0, s));
    for (let dy = -3; dy <= 3; dy++)
      for (let dz = -3; dz <= 3; dz++) {
        if (dy * dy + dz * dz > rad * rad + 0.4) continue;
        g.add(mkBox(1, 1, 1, Math.abs(dy) <= 1 ? stripeHex : bodyHex, dx, dy, dz));
      }
  }
  g.add(mkBox(4, 1, 0.4, stripeHex, -7, 0, 0));
  g.add(mkBox(1, 2, 4, stripeHex, -7, 0, 0));
  g.add(mkBox(2, 0.8, 1, COL(60, 55, 60), 2, -3, 0));
  addFloater(g, 'blimp', { x, y, z, dir: 1, speed: rr(5, 8), bob: rr(0, 6) });
}
function makePlane(bodyHex, stripeHex, radius, y, speed, phase) {
  const g = new THREE.Group();
  g.add(mkBox(6, 1, 1, bodyHex, 0, 0, 0));
  g.add(mkBox(2, 0.8, 1.2, stripeHex, 1.5, 0.9, 0));
  g.add(mkBox(1.6, 0.2, 10, stripeHex, 0.5, 0.2, 0));
  g.add(mkBox(1.4, 0.2, 3, stripeHex, -2.4, 0.9, 0));
  g.add(mkBox(0.6, 1.2, 0.2, stripeHex, -2.6, 0.6, 0));
  const prop = mkBox(0.2, 3.4, 0.3, COL(40, 40, 46), 3.2, 0, 0);
  g.add(prop);
  g.userData.prop = prop;
  addFloater(g, 'plane', { radius, y, speed, phase });
}
function makeCloud(x, y, z) {
  const g = new THREE.Group();
  const n = ri(5, 9);
  for (let i = 0; i < n; i++) {
    const b = mkBox(rr(3, 7), rr(1.6, 3), rr(3, 6), COL(255, 253, 250), rr(-7, 7), rr(-1, 1.5), rr(-4, 4));
    b.material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
    g.add(b);
  }
  addFloater(g, 'cloud', { x, y, z, speed: rr(0.9, 2.2) });
}
function initSkyTraffic() {
  makeBalloon([COL(235, 60, 60), COL(250, 250, 250), COL(70, 130, 220), COL(245, 190, 60)], -150, 62, -140);
  makeBalloon([COL(60, 170, 110), COL(250, 235, 160), COL(230, 90, 140), COL(255, 255, 255)], 60, 70, -190);
  makeBalloon([COL(150, 80, 200), COL(255, 170, 60), COL(255, 255, 255), COL(60, 190, 200)], 190, 58, 90);
  makeBalloon([COL(250, 120, 50), COL(50, 60, 120), COL(255, 240, 200), COL(220, 60, 80)], -70, 80, 130);
  makeBalloon([COL(80, 160, 240), COL(255, 255, 255), COL(240, 90, 90), COL(250, 210, 90)], -200, 66, 60);
  makeBalloon([COL(120, 220, 160), COL(240, 240, 250), COL(230, 70, 70), COL(250, 190, 90)], 30, 90, 180);
  makeBlimp(-190, 100, -60, COL(216, 218, 226), COL(190, 50, 50));
  makeBlimp(150, 112, 140, COL(90, 105, 130), COL(240, 220, 120));
  makePlane(COL(235, 240, 245), COL(210, 40, 40), 180, 72, 0.06, 0);
  makePlane(COL(60, 90, 160), COL(240, 230, 120), 225, 88, -0.045, 2.2);
  for (let i = 0; i < 15; i++) makeCloud(rr(-240, 240), rr(125, 165), rr(-240, 240));
}
function updateSkyTraffic(dt, t) {
  for (const f of floaters) {
    if (f.kind === 'balloon') {
      f.x += f.dir * f.speed * dt;
      if (f.x > 260) f.x = -260;
      if (f.x < -260) f.x = 260;
      f.group.position.set(f.x, f.y + Math.sin(t * 0.7 + f.bob) * 1.2, f.z + Math.sin(t * 0.3 + f.bob) * 6);
      f.group.rotation.z = Math.sin(t * 0.8 + f.bob) * 0.05;
    } else if (f.kind === 'blimp') {
      f.x += f.dir * f.speed * dt;
      if (f.x > 270) f.x = -270;
      f.group.position.set(f.x, f.y + Math.sin(t * 0.5 + f.bob) * 1.5, f.z);
      f.group.rotation.y = Math.PI / 2;
    } else if (f.kind === 'plane') {
      f.phase += f.speed * dt;
      const a = f.phase;
      f.group.position.set(Math.cos(a) * f.radius, f.y + Math.sin(a * 2) * 4, Math.sin(a) * f.radius);
      f.group.rotation.y = Math.atan2(-Math.sin(a) * f.speed, Math.cos(a) * f.speed) - Math.PI / 2;
      f.group.rotation.z = 0.22 * (f.speed > 0 ? 1 : -1);
      if (f.group.userData.prop) f.group.userData.prop.rotation.x += dt * 26;
    } else if (f.kind === 'cloud') {
      f.x += f.speed * dt;
      if (f.x > 290) f.x = -290;
      f.group.position.set(f.x, f.y, f.z);
    }
  }
}

/* =====================================================================
   CONTROLS
   ===================================================================== */
const ctrl = { yaw: 0.0, pitch: 0.34, dist: 165, tx: 0, ty: 25, tz: 40, keys: {} };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  ctrl.keys[k] = true;
  if (k === 'escape') disarm();
});
window.addEventListener('keyup', e => { ctrl.keys[e.key.toLowerCase()] = false; });

let dragging = false, moved = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  dragging = true; moved = 0;
  if (e.button === 2) disarm();
});
window.addEventListener('pointerup', e => {
  dragging = false;
  if (armed && e.button === 0 && moved < 6) {
    const p = pickGround(e);
    if (p) fire(armed, p.x, p.z);
    disarm();
  }
});
window.addEventListener('pointermove', e => {
  if (dragging) {
    const dx = e.movementX || 0, dy = e.movementY || 0;
    moved += Math.abs(dx) + Math.abs(dy);
    ctrl.yaw -= dx * 0.005;
    ctrl.pitch = clamp(ctrl.pitch + dy * 0.005, -0.15, 1.45);
  }
  if (armed) {
    const p = pickGround(e);
    if (p) { marker.visible = true; marker.position.set(p.x, hAt(p.x, p.z) + 0.4, p.z); }
    else marker.visible = false;
  }
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('wheel', e => {
  ctrl.dist = clamp(ctrl.dist * (e.deltaY > 0 ? 1.12 : 0.9), 6, 900);
}, { passive: true });

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -12);
function pickGround(e) {
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
  if (Math.abs(p.x) > OFF - 2 || Math.abs(p.z) > OFF - 2) return null;
  return { x: Math.round(p.x), z: Math.round(p.z) };
}
const marker = new THREE.Mesh(
  new THREE.RingGeometry(6, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

function updateCamera(dt) {
  const sp = 80 * dt * (0.5 + ctrl.dist / 120);
  const fx = -Math.sin(ctrl.yaw), fz = -Math.cos(ctrl.yaw);
  const rx = Math.cos(ctrl.yaw), rz = -Math.sin(ctrl.yaw);
  if (ctrl.keys['arrowup']) { ctrl.tx += fx * sp; ctrl.tz += fz * sp; }
  if (ctrl.keys['arrowdown']) { ctrl.tx -= fx * sp; ctrl.tz -= fz * sp; }
  if (ctrl.keys['arrowleft']) { ctrl.tx -= rx * sp; ctrl.tz -= rz * sp; }
  if (ctrl.keys['arrowright']) { ctrl.tx += rx * sp; ctrl.tz += rz * sp; }
  if (ctrl.keys['q']) ctrl.ty += 70 * dt;
  if (ctrl.keys['a']) ctrl.ty -= 70 * dt;
  if (ctrl.keys['z']) ctrl.dist = Math.max(6, ctrl.dist * (1 - 1.2 * dt));
  if (ctrl.keys['x']) ctrl.dist = Math.min(900, ctrl.dist * (1 + 1.2 * dt));
  ctrl.tx = clamp(ctrl.tx, -OFF - 60, OFF + 60);
  ctrl.tz = clamp(ctrl.tz, -OFF - 60, OFF + 60);
  ctrl.ty = clamp(ctrl.ty, 2, 600);
  const cx = ctrl.tx + ctrl.dist * Math.sin(ctrl.yaw) * Math.cos(ctrl.pitch);
  const cy = ctrl.ty + ctrl.dist * Math.sin(ctrl.pitch);
  const cz = ctrl.tz + ctrl.dist * Math.cos(ctrl.yaw) * Math.cos(ctrl.pitch);
  camera.position.set(cx + shakeOff.x, cy + shakeOff.y, cz + shakeOff.z);
  camera.lookAt(ctrl.tx, ctrl.ty, ctrl.tz);
}

/* =====================================================================
   DISASTERS
   ===================================================================== */
let armed = null;
let running = false;
let shakeT = 0, shakeMag = 0;
const shakeOff = new THREE.Vector3();
const particles = [];
const fxList = [];
const statusEl = document.getElementById('status');
const flashEl = document.getElementById('flash');
const dbtns = [...document.querySelectorAll('.dbtn[data-t]')];

function msg(txt, ms) {
  if (!statusEl) return;
  statusEl.textContent = txt;
  clearTimeout(msg._t);
  msg._t = setTimeout(() => { statusEl.textContent = ''; }, ms || 4200);
}
function arm(type, btn) {
  if (running && type !== 'eq') return;
  disarm();
  armed = type;
  btn.classList.add('armed');
  marker.visible = true;
  msg('Click a spot in the world to unleash it (right click / Esc to cancel)', 8000);
}
function disarm() {
  armed = null;
  marker.visible = false;
  dbtns.forEach(b => b.classList.remove('armed'));
}
dbtns.forEach(b => b.addEventListener('click', () => arm(b.dataset.t, b)));
const resetBtn = document.getElementById('reset');
if (resetBtn) resetBtn.addEventListener('click', () => {
  running = false;
  clearAnimObjects();
  generateWorld();
  rebuild();
  msg('The garden is reborn.', 2500);
});

function shake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function scare() { for (const c of critters) c.fright = 6; }

function spawnParticles(x, y, z, n, colors, speed, sizeMin, sizeMax, life) {
  for (let i = 0; i < n && particles.length < 420; i++) {
    const hex = colors[Math.floor(rnd() * colors.length)];
    const m = new THREE.Mesh(BOX_GEO_PART, lamMat(hex));
    const s = rr(sizeMin, sizeMax);
    m.scale.set(s, s, s);
    m.position.set(x, y, z);
    scene.add(m);
    const a = rr(0, Math.PI * 2), e = rr(0.2, 1.2);
    particles.push({
      m, vx: Math.cos(a) * speed * rr(0.3, 1), vy: speed * e, vz: Math.sin(a) * speed * rr(0.3, 1),
      life: rr(life * 0.6, life)
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy -= 22 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    if (p.m.position.y < 0.2) { p.m.position.y = 0.2; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
  }
}
function puff(x, y, z, r0, r1, hex, dur, rise, op) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op === undefined ? 0.9 : op }));
  m.position.set(x, y, z);
  m.scale.setScalar(r0);
  scene.add(m);
  fxList.push({ m, r0, r1, dur, t: 0, rise, fade: true });
}
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i];
    f.t += dt;
    const k = clamp(f.t / f.dur, 0, 1);
    f.m.scale.setScalar(f.r0 + (f.r1 - f.r0) * k);
    f.m.position.y += f.rise * dt;
    if (f.fade) f.m.material.opacity = 0.9 * (1 - k);
    if (f.t >= f.dur) { scene.remove(f.m); fxList.splice(i, 1); }
  }
}
function clearAnimObjects() {
  while (particles.length) scene.remove(particles.pop().m);
  while (fxList.length) scene.remove(fxList.pop().m);
  if (tsunamiWall) { scene.remove(tsunamiWall); tsunamiWall = null; }
  if (tsunamiFuji) { scene.remove(tsunamiFuji); tsunamiFuji = null; }
  if (meteorObj) { scene.remove(meteorObj); meteorObj = null; }
}

/* batch voxel edits near a column center (collect first, mutate after) */
function voxelsNear(cx, cz, r, cb) {
  const toDel = [], toSet = [];
  const r2 = r * r;
  for (const e of voxels.values()) {
    const dx = e.x - cx, dz = e.z - cz;
    if (dx * dx + dz * dz > r2) continue;
    cb(e, toDel, toSet);
  }
  for (const d of toDel) voxels.delete(kkey(d[0], d[1], d[2]));
  for (const s of toSet) addVoxel(s[0], s[1], s[2], s[3], s[4]);
}

/* ---- EARTHQUAKE ---- */
function earthquake(cx, cz) {
  shake(1.5, 3.0);
  scare();
  const rub = [COL(130, 120, 110), COL(96, 88, 78), COL(120, 110, 96), COL(150, 140, 126)];
  voxelsNear(cx, cz, 80, (e, del) => {
    if (e.t === 's' || e.t === 'v') {
      if (e.y > hAt(e.x, e.z) + 5 && rnd() < 0.5) del.push([e.x, e.y, e.z]);
      else if (rnd() < 0.1) del.push([e.x, e.y, e.z]);
    } else if (e.t === 't') {
      if (e.y === hAt(e.x, e.z) && rnd() < 0.05) del.push([e.x, e.y, e.z]);
    }
  });
  for (let i = 0; i < 1200; i++) {
    const a = rr(0, Math.PI * 2), r = Math.sqrt(rnd()) * 78;
    const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
    addVoxel(x, hAt(x, z) + 1, z, jitter(rub[Math.floor(rnd() * rub.length)], 12), 's');
  }
  spawnParticles(cx, hAt(cx, cz) + 2, cz, 80, [COL(150, 138, 120), COL(120, 108, 92)], 12, 0.3, 0.9, 1.6);
  rebuild();
  msg('Earthquake reported near the garden!');
}

/* ---- METEOR ---- */
let meteorObj = null, meteorState = null;
function meteorStrike(cx, cz) {
  scare();
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) g.add(mkBox(rr(1, 2.6), rr(1, 2.6), rr(1, 2.6), COL(74, 64, 60), rr(-1.4, 1.4), rr(-1.4, 1.4), rr(-1.4, 1.4)));
  for (let i = 0; i < 6; i++) g.add(mkBox(rr(0.6, 1.4), rr(0.6, 1.4), rr(0.6, 1.4), [COL(255, 120, 30), COL(255, 190, 60), COL(255, 70, 20)][i % 3], rr(-1.8, 1.8), rr(1.6, 2.6), rr(-1.8, 1.8)));
  scene.add(g);
  meteorObj = g;
  meteorState = { cx, cz, t: 0, dur: 1.5, sx: cx + 90, sz: cz - 70 };
  msg('Incoming meteor! Impact imminent.');
}
function updateMeteor(dt) {
  if (!meteorState) return;
  const s = meteorState;
  s.t += dt;
  const k = clamp(s.t / s.dur, 0, 1);
  const gy = hAt(s.cx, s.cz) + 1;
  const px = s.sx + (s.cx - s.sx) * k;
  const pz = s.sz + (s.cz - s.sz) * k;
  const py = 240 - (240 - gy) * (k * k * 0.4 + k * 0.6);
  if (meteorObj) meteorObj.position.set(px, py, pz);
  if (rnd() < 0.9) spawnParticles(px, py, pz, 2, [COL(255, 140, 40), COL(255, 200, 80), COL(90, 80, 76)], 4, 0.25, 0.6, 0.7);
  if (k >= 1) {
    scene.remove(meteorObj); meteorObj = null;
    impactMeteor(s.cx, s.cz);
    meteorState = null;
  }
}
function impactMeteor(cx, cz) {
  shake(2.6, 1.8);
  const cy = hAt(cx, cz) + 2;
  const R = 13;
  voxelsNear(cx, cz, R + 3, (e, del) => {
    const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz;
    if (dx * dx + dy * dy + dz * dz <= R * R) del.push([e.x, e.y, e.z]);
  });
  voxelsNear(cx, cz, 20, (e, del, set) => {
    const d = Math.hypot(e.x - cx, e.z - cz);
    if (e.t === 't' && d < 18) set.push([e.x, e.y, e.z, jitter(COL(56, 44, 36), 8), 't']);
  });
  for (let i = 0; i < 180; i++) {
    const a = rr(0, Math.PI * 2), d = rr(R, R + 4);
    const x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
    if (rnd() < 0.6) addVoxel(x, hAt(x, z) + 1, z, jitter(COL(96, 88, 80), 14), 's');
  }
  for (let a = 0; a < Math.PI * 2; a += 0.4) {
    const x = Math.round(cx + Math.cos(a) * 6), z = Math.round(cz + Math.sin(a) * 6);
    addVoxel(x, hAt(x, z) - 2, z, COL(40, 32, 28), 't');
  }
  puff(cx, cy + 5, cz, 4, 24, 0xffb347, 1.4, 6, 0.95);
  puff(cx, cy + 16, cz, 3, 16, 0xff7722, 1.8, 8, 0.8);
  for (let i = 0; i < 6; i++) puff(cx + rr(-5, 5), cy + 12 + i * 3.5, cz + rr(-5, 5), 2, 10 + i * 2, 0x6f6a66, 2.6 + i * 0.3, 4, 0.65);
  spawnParticles(cx, cy + 3, cz, 150, [COL(80, 66, 52), COL(120, 100, 80), COL(255, 130, 40), COL(60, 50, 44)], 24, 0.35, 1.2, 2.4);
  rebuild();
  msg('Meteor impact recorded — crater formed.');
}

/* ---- TSUNAMI ---- */
let tsunamiWall = null, tsunamiState = null, tsunamiFuji = null;

/* ---- "The Great Wave off Kanagawa" — procedural Hokusai wave wall ---- */
const WAVE_DEEP = COL(19, 52, 94), WAVE_MID = COL(30, 91, 140), WAVE_LIGHT = COL(77, 142, 192), WAVE_FOAM = COL(242, 248, 252);
function waveHeight(x) {
  // five tall crests with troughs between, like Hokusai's claw fingers
  const C = [[-230, 10], [-120, 15], [0, 21], [95, 14], [200, 18], [275, 9], [-280, 7]];
  let h = 9;
  for (const [c, a] of C) {
    const d = x - c;
    h += a * Math.exp(-(d * d) / (2 * 34 * 34));
  }
  return h + 1.6 * Math.sin(x * 0.11) + 1.2 * Math.sin(x * 0.041 + 1.7);
}
function waveProfile(h) {
  const r = Math.min(5.5, h * 0.33);
  const p = [[-16, 0], [-13, h * 0.22], [-10, h * 0.45], [-8, h * 0.62], [-6, h * 0.80], [-4.5, h * 0.93]];
  const cZ = -3, cY = h - r;
  for (let s = 0; s <= 6; s++) {
    const a = (90 - s * 23.3) * Math.PI / 180;           // 90deg -> -50deg: curl over and down
    p.push([cZ + r * Math.cos(a), cY + r * Math.sin(a)]);
  }
  p.push([-1.2, 0]);
  p.tip = p[p.length - 2];
  return p;
}
function buildGreatWave() {
  const g = new THREE.Group();
  const pos = [], col = [];
  const STEP = 4, N = 560 / STEP;
  const cols = [];
  for (let i = 0; i <= N; i++) {
    const x = -280 + i * STEP;
    cols.push({ x, h: waveHeight(x), p: waveProfile(waveHeight(x)) });
  }
  // ribbon the profile strip across x
  for (let i = 0; i < N; i++) {
    const A = cols[i], B = cols[i + 1];
    for (let s = 0; s < A.p.length - 1; s++) {
      const p0 = A.p[s], p1 = A.p[s + 1], q0 = B.p[s], q1 = B.p[s + 1];
      const quad = (x0, z0, y0, x1, z1, y1, x2, z2, y2, hex) => {
        const pts = [[x0, y0, z0], [x1, y1, z1], [x2, y2, z2]];
        for (const pt of pts) { pos.push(pt[0], pt[1], pt[2]); col.push(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255); }
      };
      const hexAt = (x, y, h, sIdx, sTot) => {
        const n = hash2(Math.floor(x * 0.5), Math.floor(y));
        if (y > h * 0.86 || (sIdx > sTot * 0.72 && y > h * 0.55))
          return n < 0.4 ? WAVE_FOAM : WAVE_LIGHT;                          // foam cap & curl underside
        if (y > h * 0.7) return n < 0.5 ? WAVE_LIGHT : WAVE_MID;
        const band = Math.sin(y * 1.1 + x * 0.02) > 0.86 ? WAVE_LIGHT : (n < 0.12 ? WAVE_MID : WAVE_DEEP);
        return band;
      };
      const hA = A.h, hB = B.h;
      quad(A.x, p0[0], p0[1], B.x, q0[0], q0[1], B.x, q1[0], q1[1], hexAt(A.x, p0[1], hA, s, A.p.length));
      quad(A.x, p0[0], p0[1], B.x, q1[0], q1[1], A.x, p1[0], p1[1], hexAt(A.x, p1[1], hA, s, A.p.length));
    }
  }
  // secondary swells in front (smaller clawed waves)
  for (let x = -280; x < 280; x += STEP) {
    const hh = 3 + 2.4 * Math.abs(Math.sin(x * 0.07)) + 1.5 * Math.abs(Math.sin(x * 0.019 + 2));
    const sp = [[4, 0], [5.5, hh * 0.6], [7, hh], [9.5, 0]];
    for (let s = 0; s < sp.length - 1; s++) {
      const p0 = sp[s], p1 = sp[s + 1], x1 = x + STEP;
      const hex = p0[1] > hh * 0.7 ? WAVE_FOAM : (hash2(x, s) < 0.3 ? WAVE_MID : WAVE_LIGHT);
      const pts = [[x, p0[1], p0[0]], [x1, p0[1], p0[0]], [x1, p1[1], p1[0]], [x, p0[1], p0[0]], [x1, p1[1], p1[0]], [x, p1[1], p1[0]]];
      for (const pt of pts) { pos.push(pt[0], pt[1], pt[2]); col.push(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  geo.computeBoundingSphere();
  const body = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true, transparent: true, opacity: 0.94 }));
  body.frustumCulled = false;
  g.add(body);

  // foam claws + spray droplets hanging off each crest tip
  const foamMat = new THREE.MeshLambertMaterial({ color: 0xf4f9fc });
  const foams = [];
  for (let i = 0; i < cols.length; i += 2) {
    const cd = cols[i];
    if (cd.h < 17) continue;
    const tip = cd.p.tip;
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(BOX_GEO_PART, foamMat);
      const s = rr(0.7, 1.9);
      m.scale.set(s, s, s);
      m.position.set(cd.x + rr(-1.6, 1.6), tip[1] - rr(-0.8, 1.4), tip[0] + rr(-0.4, 2.4));
      g.add(m); foams.push(m);
    }
    for (let k = 0; k < 5; k++) {                                        // spray fingers
      const m = new THREE.Mesh(BOX_GEO_PART, foamMat);
      const s = rr(0.35, 0.85);
      m.scale.set(s, s, s);
      m.position.set(cd.x + rr(-2.4, 2.4), tip[1] - rr(1.5, 6.5), tip[0] + rr(1.2, 4));
      g.add(m); foams.push(m);
    }
  }
  // white water churning at the base
  for (let x = -280; x < 280; x += 5) {
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(BOX_GEO_PART, foamMat);
      const s = rr(0.6, 1.6);
      m.scale.set(s, s, s);
      m.position.set(x + rr(-2, 2), rr(0.2, 2.4), -14 + rr(-3, 13));
      g.add(m); foams.push(m);
    }
  }
  g.userData.foams = foams;
  return g;
}
function makeFuji() {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(62, 88, 22, 5);
  const pc = [];
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i) + 44;
    const a = Math.atan2(pa.getZ(i), pa.getX(i));
    const snowLine = 56 + 9 * Math.sin(a * 7) + 5 * Math.sin(a * 3 + 1);
    pc.push(y > snowLine ? 0.95 : 0.16, y > snowLine ? 0.97 : 0.30, y > snowLine ? 0.99 : 0.52);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pc), 3));
  const cone = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  cone.position.y = 44;
  g.add(cone);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(15, 20, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2f7fc }));
  cap.position.y = 80;
  g.add(cap);
  return g;
}
function tsunami() {
  scare();
  const g = buildGreatWave();
  scene.add(g);
  tsunamiWall = g;
  tsunamiFuji = makeFuji();
  tsunamiFuji.position.set(40, 2, -380);
  scene.add(tsunamiFuji);
  tsunamiState = { z: -300, done: false, rebuildT: 0 };
  msg('Tsunami warning — giant wave approaching from the north!');
}
function updateTsunami(dt) {
  const s = tsunamiState;
  if (!s) return;
  s.z += 46 * dt;
  if (tsunamiWall) {
    tsunamiWall.position.set(0, Math.sin(s.z * 0.05) * 0.5, s.z);
    tsunamiWall.rotation.z = Math.sin(s.z * 0.03) * 0.006;
  }
  shake(0.5, 0.2);
  const zFrom = Math.max(-OFF, Math.floor(s.z - 30)), zTo = Math.min(OFF - 1, Math.floor(s.z));
  for (let z = zFrom; z <= zTo; z++) {
    for (let x = -OFF; x < OFF; x++) {
      for (let y = 3; y < 26; y++) {
        const e = voxels.get(kkey(x, y, z));
        if (e && (e.t === 's' || e.t === 'v')) voxels.delete(kkey(x, y, z));
      }
    }
  }
  if (rnd() < 0.8) spawnParticles(rr(-240, 240), rr(6, 20), s.z + 14, 3, [0xffffff, 0xd8f2ff], 7, 0.3, 0.8, 0.8);
  s.rebuildT -= dt;
  if (s.rebuildT <= 0) { rebuild(); s.rebuildT = 0.6; }
  if (s.z > 320 && !s.done) {
    s.done = true;
    scene.remove(tsunamiWall); tsunamiWall = null;
    if (tsunamiFuji) { scene.remove(tsunamiFuji); tsunamiFuji = null; }
    tsunamiState = null;
    rebuild();
    msg('The wave has receded.');
  }
}

/* ---- 25KT NUCLEAR AIRBURST ---- */
function nukeBurst(cx, cz) {
  scare();
  if (flashEl) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = 1;
    setTimeout(() => { flashEl.style.transition = 'opacity 1.6s'; flashEl.style.opacity = 0; }, 90);
  }
  shake(3.2, 2.4);
  const cy = hAt(cx, cz) + 9;
  const R = 44, R2 = R * 2.3;
  voxelsNear(cx, cz, R, (e, del, set) => {
    const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz;
    if (dx * dx + dy * dy + dz * dz <= R * R) {
      if (e.t !== 't' || e.y > hAt(e.x, e.z) - 3) del.push([e.x, e.y, e.z]);
      else set.push([e.x, e.y, e.z, jitter(COL(70, 66, 60), 8), 't']);
    }
  });
  voxelsNear(cx, cz, R2, (e, del, set) => {
    const d = Math.hypot(e.x - cx, e.z - cz);
    if (d > R) {
      if ((e.t === 's' || e.t === 'v') && rnd() < 0.8) del.push([e.x, e.y, e.z]);
      if (e.t === 't' && e.y === hAt(e.x, e.z) && rnd() < 0.4) set.push([e.x, e.y, e.z, jitter(COL(96, 92, 66), 10), 't']);
    }
  });
  for (let a = 0; a < Math.PI * 2; a += 0.14) {
    const d = R + rr(-1, 2);
    const x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
    addVoxel(x, hAt(x, z) + 1, z, rnd() < 0.5 ? COL(180, 200, 190) : COL(120, 130, 122), 's');
  }
  puff(cx, cy, cz, 5, 34, 0xfff2b0, 0.9, 4, 1);
  puff(cx, cy + 4, cz, 4, 26, 0xff8c2e, 1.5, 7, 0.9);
  for (let i = 0; i < 6; i++) puff(cx + rr(-6, 6), cy + 16 + i * 6, cz + rr(-6, 6), 3, 14 + i * 2, 0x8d857c, 3 + i * 0.4, 5.5 - i * 0.4, 0.7);
  puff(cx, cy + 52, cz, 7, 38, 0xa9a29a, 4.2, 6.5, 0.8);
  puff(cx, cy + 22, cz, 3, 9, 0x9b948c, 3.4, 8, 0.75);
  spawnParticles(cx, cy, cz, 170, [COL(255, 170, 60), COL(255, 220, 120), COL(110, 100, 90), COL(80, 72, 66)], 34, 0.3, 1.1, 2.6);
  rebuild();
  msg('25KT airburst at grid (' + cx + ', ' + cz + ').');
}

/* ---- dispatcher ---- */
function fire(type, x, z) {
  if (type === 'eq') earthquake(x, z);
  else if (type === 'meteor') meteorStrike(x, z);
  else if (type === 'tsunami') tsunami();
  else if (type === 'nuke') nukeBurst(x, z);
}

/* =====================================================================
   MAIN LOOP
   ===================================================================== */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (shakeT > 0) {
    shakeT -= dt;
    const s = shakeMag * clamp(shakeT / 1.5, 0, 1);
    shakeOff.set(rr(-s, s), rr(-s, s), rr(-s, s));
    if (shakeT <= 0) { shakeMag = 0; shakeOff.set(0, 0, 0); }
  }
  updateCamera(dt);
  updateCritters(dt, t);
  updateKoi(dt, t);
  updateFlocks(dt, t);
  updateSkyTraffic(dt, t);
  updateParticles(dt);
  updateFx(dt);
  updateMeteor(dt);
  updateTsunami(dt);
  if (waterMesh) {
    matWater.opacity = 0.72 + Math.sin(t * 2.1) * 0.07;
    waterMesh.position.y = Math.sin(t * 1.3) * 0.08;
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- boot ---------------- */
generateWorld();
initCritters();
initKoi();
initFlocks();
initSkyTraffic();
rebuild();
msg('Welcome, gardener. The disasters below bite hard — REBUILD restores all.', 6000);
requestAnimationFrame(loop);
