import * as THREE from 'three';

const SIZE = 256, C = 128;
let seed = 20260419;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const H = (h, s, l) => new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l).getHex();

const scene = new THREE.Scene();
const skyHex = H(0.58, 0.6, 0.8);
scene.background = new THREE.Color(skyHex);
scene.fog = new THREE.Fog(skyHex, 340, 1100);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x54703f, 1.05));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
sun.position.set(180, 260, 90);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffd9ec, 0.35);
fill.position.set(-140, 120, -180);
scene.add(fill);

const vx = [], vy = [], vz = [], vc = [];
const taken = new Uint8Array(SIZE * SIZE * 64);
function V(x, y, z, c) {
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE || y < 0 || y >= 64) return;
  const k = (z * SIZE + x) * 64 + y;
  if (taken[k]) return;
  taken[k] = 1;
  vx.push(x); vy.push(y); vz.push(z); vc.push(c);
}

const hmap = new Int16Array(SIZE * SIZE);
const water = new Uint8Array(SIZE * SIZE);
const used = new Uint8Array(SIZE * SIZE);
const idx = (x, z) => z * SIZE + x;

const n2 = (x, z) => (Math.sin(x * 0.31) * Math.sin(z * 0.27) + Math.sin((x + z) * 0.11) * 0.6 + 1) / 2;
const riverX = z => Math.round(C + 34 * Math.sin(z * 0.045) + 16 * Math.sin(z * 0.017 + 2));
const POND = { x: 168, z: 92, r: 6 };
const GROVE = { x: 178, z: 62 };

const isPath = (x, z) => {
  if (Math.abs(z - C) <= 2 && x >= 18 && x <= 238) return true;
  if (Math.abs(x - C) <= 2 && z >= 18 && z <= 238) return true;
  const dx = x - C, dz = z - C;
  return Math.abs(Math.sqrt(dx * dx + dz * dz) - 40) <= 1.3;
};

for (let x = 0; x < SIZE; x++) {
  for (let z = 0; z < SIZE; z++) {
    const dEdge = Math.min(x, SIZE - 1 - x, z, SIZE - 1 - z);
    let h = 10 + Math.round(n2(x, z) * 1.5);
    if (dEdge < 16) h += Math.round((16 - dEdge) * 1.1 + n2(x * 1.7, z * 1.7) * 5);
    hmap[idx(x, z)] = h;
    if (Math.abs(x - riverX(z)) <= 3 && dEdge > 8) water[idx(x, z)] = 1;
    const pdx = x - POND.x, pdz = z - POND.z;
    if (pdx * pdx + pdz * pdz <= POND.r * POND.r) water[idx(x, z)] = 2;
  }
}

const pinks = [H(0.95, 0.75, 0.72), H(0.93, 0.8, 0.78), H(0.97, 0.65, 0.62), H(0.91, 0.7, 0.85), H(0.99, 0.6, 0.66)];
const greens = [H(0.3, 0.6, 0.3), H(0.26, 0.55, 0.28), H(0.34, 0.6, 0.36), H(0.23, 0.5, 0.24)];
const autumns = [H(0.05, 0.85, 0.5), H(0.02, 0.8, 0.42), H(0.09, 0.9, 0.55), H(0.12, 0.85, 0.5)];
const pines = [H(0.36, 0.55, 0.2), H(0.33, 0.5, 0.16)];
const flowers = [H(0.98, 0.85, 0.6), H(0.0, 0.9, 0.55), H(0.15, 0.95, 0.6), H(0.75, 0.8, 0.65), H(0.6, 0.85, 0.55), H(0.08, 0.95, 0.55), H(0, 0, 0.97), H(0.55, 0.9, 0.6)];

for (let x = 0; x < SIZE; x++) {
  for (let z = 0; z < SIZE; z++) {
    const i = idx(x, z);
    const w = water[i];
    if (w) {
      V(x, 8, z, H(0.09, 0.4, 0.55));
      V(x, 9, z, w === 2 ? H(0.5, 0.7, 0.42 + rand() * 0.06) : H(0.55 + rand() * 0.04, 0.75, 0.42 + rand() * 0.1));
      continue;
    }
    const h = hmap[i];
    for (let y = 8; y <= h; y++) {
      let c;
      if (y === h) {
        if (h >= 27) c = H(0, 0, 0.93 + rand() * 0.05);
        else if (h >= 19) c = H(0.08, 0.06, 0.3 + ((y % 3) * 0.05) + rand() * 0.05);
        else if (isPath(x, z)) c = rand() < 0.12 ? H(0.08, 0.05, 0.45) : H(0.1, 0.45, 0.55 + rand() * 0.08);
        else {
          c = H(0.27 + rand() * 0.06, 0.5 + rand() * 0.2, 0.28 + rand() * 0.12);
          if (rand() < 0.015) V(x, h + 1, z, flowers[(rand() * flowers.length) | 0]);
        }
      } else {
        c = h >= 19 ? H(0.08, 0.06, 0.28 + ((y % 3) * 0.05)) : H(0.07, 0.45, 0.22);
      }
      V(x, y, z, c);
    }
  }
}

function markRect(x0, z0, w, d) {
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
    const x = x0 + dx, z = z0 + dz;
    if (x >= 0 && z >= 0 && x < SIZE && z < SIZE) used[idx(x, z)] = 1;
  }
}

for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) used[idx(C + dx, C + dz)] = 1;
for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) {
  if (dx * dx + dz * dz <= 81) used[idx(POND.x + dx, POND.z + dz)] = 1;
}

function buildPagoda() {
  const base = hmap[idx(C, C)];
  const stone = H(0.08, 0.06, 0.6), stoneD = H(0.08, 0.08, 0.45);
  const wood = H(0.06, 0.5, 0.28), red = H(0.98, 0.62, 0.4), dark = H(0.98, 0.4, 0.14);
  const teal = H(0.46, 0.5, 0.38), tealD = H(0.46, 0.55, 0.26);
  const gold = H(0.13, 0.85, 0.55), white = H(0.12, 0.25, 0.9);

  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++)
    V(C + dx, base + 1, C + dz, rand() < 0.15 ? stoneD : stone);

  const halfs = [8, 7, 5, 4, 3];
  let cur = base + 2;
  for (let t = 0; t < halfs.length; t++) {
    const half = halfs[t];
    for (let dx = -half; dx <= half; dx++) for (let dz = -half; dz <= half; dz++)
      V(C + dx, cur, C + dz, wood);
    for (let y = cur + 1; y <= cur + 3; y++) {
      for (let dx = -half; dx <= half; dx++) for (let dz = -half; dz <= half; dz++) {
        if (Math.abs(dx) !== half && Math.abs(dz) !== half) continue;
        const win = y === cur + 2 && (((dx + dz + half * 2) & 3) === 1);
        V(C + dx, y, C + dz, win ? dark : red);
      }
    }
    const ry = cur + 4;
    for (let dx = -half - 2; dx <= half + 2; dx++) for (let dz = -half - 2; dz <= half + 2; dz++) {
      const ax = Math.abs(dx), az = Math.abs(dz), ring = Math.max(ax, az);
      if (ring === half + 2) V(C + dx, ry, C + dz, (ax === half + 2 && az === half + 2) ? gold : teal);
      else V(C + dx, ry + 1, C + dz, ring >= half ? teal : tealD);
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
      V(C + sx * (half + 2), ry - 1, C + sz * (half + 2), red);
    cur = ry + 2;
  }
  for (let y = 0; y < 4; y++) V(C, cur + y, C, gold);
  V(C, cur + 4, C, white);
}
buildPagoda();

function buildBridge() {
  const plank = H(0.07, 0.5, 0.35), rail = H(0.98, 0.62, 0.45);
  for (let z = 0; z < SIZE; z++) {
    const rx = riverX(z);
    for (let dx = -6; dx <= 6; dx++) {
      const x = rx + dx;
      if (x < 0 || x >= SIZE) continue;
      if (!water[idx(x, z)]) continue;
      const onPath = (Math.abs(z - C) <= 2 && x >= 18 && x <= 238) || (Math.abs(x - C) <= 2 && z >= 18 && z <= 238);
      if (!onPath) continue;
      V(x, 10, z, plank);
      if (Math.abs(dx) === 5) V(x, 11, z, rail);
    }
  }
}
buildBridge();

const woodC = H(0.06, 0.5, 0.28);
for (let i = 1; i <= 4; i++) V(POND.x, 10, POND.z + POND.r + i, woodC);
for (let i = 0; i < 3; i++) V(POND.x - 2 + i, 11, POND.z + POND.r + 4, woodC);
V(POND.x - 2, 10, POND.z + POND.r + 4, woodC);
V(POND.x + 0, 10, POND.z + POND.r + 4, woodC);
V(POND.x - 2, 10, POND.z + POND.r + 1, woodC);

function bench(bx, bz) {
  const g = hmap[idx(bx, bz)];
  for (let i = 0; i < 3; i++) V(bx + i, g + 2, bz, H(0.06, 0.5, 0.3));
  V(bx, g + 1, bz, H(0.06, 0.5, 0.25));
  V(bx + 2, g + 1, bz, H(0.06, 0.5, 0.25));
  markRect(bx, bz, 3, 1);
}
bench(POND.x - 9, POND.z - 3);
bench(C + 24, C - 7);
bench(C - 30, C + 7);

for (let i = 0; i < 10; i++) {
  const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 5;
  const kx = POND.x + Math.round(Math.cos(a) * rr), kz = POND.z + Math.round(Math.sin(a) * rr);
  V(kx, 10, kz, rand() < 0.5 ? H(0.05, 0.9, 0.55) : H(0, 0, 0.95));
}
for (let i = 0; i < 8; i++) {
  const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 5;
  V(POND.x + Math.round(Math.cos(a) * rr), 10, POND.z + Math.round(Math.sin(a) * rr), H(0.33, 0.7, 0.4));
}

function lantern(x, z) {
  const i = idx(x, z);
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE || water[i] || used[i]) return;
  const g = hmap[i];
  V(x, g + 1, z, H(0.08, 0.05, 0.7));
  V(x, g + 2, z, H(0.08, 0.05, 0.7));
  V(x, g + 3, z, H(0.14, 0.9, 0.6));
  used[i] = 1;
}
for (let x = 26; x <= 230; x += 24) { lantern(x, C - 5); lantern(x, C + 5); }
for (let z = 26; z <= 230; z += 24) { lantern(C - 5, z); lantern(C + 5, z); }

function treeAt(x, z, kind) {
  const g = hmap[idx(x, z)];
  const trunk = H(0.07, 0.5, 0.2 + rand() * 0.1);
  if (kind === 'pine') {
    const th = 5 + (rand() * 3 | 0);
    for (let y = 1; y <= th; y++) V(x, g + y, z, trunk);
    const layers = [[3, th - 1], [2, th + 1], [1, th + 3]];
    for (const [r, ly] of layers) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r) continue;
        if (dx === 0 && dz === 0 && ly <= th) continue;
        V(x + dx, g + ly, z + dz, pines[(rand() * pines.length) | 0]);
      }
    }
    V(x, g + th + 4, z, pines[0]);
  } else {
    const th = 3 + (rand() * 3 | 0);
    for (let y = 1; y <= th; y++) { V(x, g + y, z, trunk); if (rand() < 0.3) V(x + 1, g + y, z, trunk); }
    const r = kind === 'cherry' ? 3 : 2 + (rand() * 2 | 0);
    const cy = g + th + 1;
    const pal = kind === 'cherry' ? pinks : kind === 'autumn' ? autumns : greens;
    for (let dx = -r; dx <= r; dx++) for (let dy = -1; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      const d2 = dx * dx + dy * dy * 1.4 + dz * dz;
      if (d2 <= r * r + 1 && rand() < 0.82) V(x + dx, cy + dy, z + dz, pal[(rand() * pal.length) | 0]);
    }
    if (kind === 'cherry') {
      for (let i = 0; i < 8; i++) {
        const px = x + ((rand() * 11 - 5) | 0), pz = z + ((rand() * 11 - 5) | 0);
        if (px < 0 || pz < 0 || px >= SIZE || pz >= SIZE) continue;
        const pi = idx(px, pz);
        if (water[pi] || used[pi] || isPath(px, pz)) continue;
        if (rand() < 0.7) V(px, hmap[pi] + 1, pz, pinks[(rand() * pinks.length) | 0]);
      }
    }
  }
  markRect(x - 1, z - 1, 3, 2);
}

let placed = 0, guard = 0;
while (placed < 150 && guard++ < 9000) {
  const x = (rand() * SIZE) | 0, z = (rand() * SIZE) | 0;
  const i = idx(x, z);
  if (water[i] || used[i] || isPath(x, z)) continue;
  const dx = x - C, dz = z - C, r0 = Math.sqrt(dx * dx + dz * dz);
  if (r0 < 20) continue;
  if (Math.min(x, SIZE - 1 - x, z, SIZE - 1 - z) < 22) continue;
  const gd = Math.hypot(x - GROVE.x, z - GROVE.z);
  let kind;
  if (gd < 26) kind = 'cherry';
  else { const t = rand(); kind = t < 0.35 ? 'cherry' : t < 0.7 ? 'green' : t < 0.85 ? 'autumn' : 'pine'; }
  treeAt(x, z, kind);
  placed++;
}

function freeSpot() {
  for (let k = 0; k < 300; k++) {
    const x = (8 + rand() * 240) | 0, z = (8 + rand() * 240) | 0;
    const i = idx(x, z);
    if (water[i] || used[i] || isPath(x, z)) continue;
    if (hmap[i] > 16) continue;
    return { x, z, g: hmap[i] };
  }
  return null;
}

const whiteC = H(0, 0, 0.95), redC = H(0.99, 0.8, 0.45), orangeC = H(0.09, 0.9, 0.55),
  yellowC = H(0.13, 0.85, 0.5), blackC = H(0, 0, 0.12), pinkC = H(0.97, 0.6, 0.72),
  dPinkC = H(0.95, 0.55, 0.55);

function addChicken(x, z) {
  const g = hmap[idx(x, z)];
  V(x, g + 1, z, yellowC); V(x + 1, g + 1, z, yellowC);
  V(x - 1, g + 2, z, whiteC); V(x, g + 2, z, whiteC); V(x + 1, g + 2, z, whiteC);
  V(x + 1, g + 3, z, whiteC); V(x + 1, g + 4, z, redC); V(x + 2, g + 3, z, orangeC);
  V(x - 2, g + 3, z, whiteC);
  markRect(x - 2, z, 5, 1);
}
function addCow(x, z) {
  const g = hmap[idx(x, z)];
  V(x, g + 1, z, whiteC); V(x + 3, g + 1, z, whiteC); V(x, g + 1, z + 1, whiteC); V(x + 3, g + 1, z + 1, whiteC);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
    V(x + i, g + 2, z + j, rand() < 0.28 ? blackC : whiteC), V(x + i, g + 3, z + j, rand() < 0.25 ? blackC : whiteC);
  V(x + 4, g + 3, z, whiteC); V(x + 4, g + 3, z + 1, whiteC);
  V(x + 4, g + 4, z, whiteC); V(x + 4, g + 4, z + 1, whiteC);
  V(x + 5, g + 3, z, pinkC); V(x + 5, g + 3, z + 1, pinkC);
  markRect(x, z, 6, 2);
}
function addPig(x, z) {
  const g = hmap[idx(x, z)];
  V(x, g + 1, z, dPinkC); V(x + 2, g + 1, z, dPinkC); V(x, g + 1, z + 1, dPinkC); V(x + 2, g + 1, z + 1, dPinkC);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) V(x + i, g + 2, z + j, pinkC);
  V(x + 3, g + 2, z, pinkC); V(x + 3, g + 2, z + 1, pinkC);
  V(x + 3, g + 3, z, pinkC); V(x + 3, g + 3, z + 1, pinkC);
  V(x + 4, g + 2, z, dPinkC); V(x + 4, g + 2, z + 1, dPinkC);
  markRect(x, z, 5, 2);
}
for (let i = 0; i < 16; i++) { const s = freeSpot(); if (s) addChicken(s.x, s.z); }
for (let i = 0; i < 9; i++) { const s = freeSpot(); if (s) addCow(s.x, s.z); }
for (let i = 0; i < 9; i++) { const s = freeSpot(); if (s) addPig(s.x, s.z); }

// ---- live voxel world (supports real damage) ----
const WKEYS = SIZE * SIZE * 64;
const colOf = new Uint32Array(WKEYS);
const slotOf = new Uint32Array(WKEYS);
const liveList = new Uint32Array(vx.length + 8192);
const CAP = liveList.length;
let liveCount = 0;
for (let i = 0; i < vx.length; i++) {
  const k = (vz[i] * SIZE + vx[i]) * 64 + vy[i];
  colOf[k] = vc[i];
  slotOf[k] = liveCount;
  liveList[liveCount++] = k;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const staticMat = new THREE.MeshLambertMaterial();
const staticMesh = new THREE.InstancedMesh(boxGeo, staticMat, CAP);
staticMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
staticMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
staticMesh.frustumCulled = false;
staticMesh.count = liveCount;
scene.add(staticMesh);
console.log('static voxels:', liveCount);

let staticDirty = true, lastRebuild = -10;
const _rc = new THREE.Color();
function rebuildStatic() {
  staticDirty = false;
  lastRebuild = t;
  const ma = staticMesh.instanceMatrix.array;
  const ca = staticMesh.instanceColor.array;
  for (let i = 0; i < liveCount; i++) {
    const k = liveList[i], o = i * 16;
    ma[o] = 1; ma[o + 5] = 1; ma[o + 10] = 1; ma[o + 15] = 1;
    ma[o + 12] = (k >> 6 & 255) + 0.5;
    ma[o + 13] = (k & 63) + 0.5;
    ma[o + 14] = (k >> 14) + 0.5;
    _rc.setHex(colOf[k]);
    const co = i * 3;
    ca[co] = _rc.r; ca[co + 1] = _rc.g; ca[co + 2] = _rc.b;
  }
  staticMesh.count = liveCount;
  staticMesh.instanceMatrix.needsUpdate = true;
  staticMesh.instanceColor.needsUpdate = true;
}
function removeKey(k) {
  if (!colOf[k]) return;
  const s = slotOf[k], lk = liveList[--liveCount];
  liveList[s] = lk; slotOf[lk] = s;
  colOf[k] = 0;
  staticDirty = true;
}
function paintKey(k, hex) { if (colOf[k]) { colOf[k] = hex; staticDirty = true; } }
function addKey(x, y, z, hex) {
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE || y < 0 || y >= 64 || liveCount >= CAP) return;
  const k = (z * SIZE + x) * 64 + y;
  if (colOf[k]) { colOf[k] = hex; staticDirty = true; return; }
  colOf[k] = hex; slotOf[k] = liveCount; liveList[liveCount++] = k;
  staticDirty = true;
}
function colBase(x, z) {
  const i = idx(x, z);
  return water[i] ? 9 : Math.max(hmap[i], 8);
}
function destroyColumn(x, z, from, to) {
  for (let y = from; y <= to; y++) removeKey((z * SIZE + x) * 64 + y);
}

// ---- coroutine scheduler ----
let shakeAmp = 0, flashLevel = 0;
const flashDiv = document.getElementById('flash');
function doFlash(v) { flashLevel = Math.max(flashLevel, v); }
const cos = [];
const activeDisasters = new Set();
function spawnCo(g, name) { cos.push({ g, wait: 0, name }); }
function finishDisaster(n) { if (n) { activeDisasters.delete(n); updateStrip(); } }
function stepCos(dt) {
  for (let i = cos.length - 1; i >= 0; i--) {
    const c = cos[i];
    c.wait -= dt;
    let guard = 0;
    while (c.wait <= 0 && guard++ < 500) {
      const r = c.g.next();
      if (r.done) { finishDisaster(c.name); cos.splice(i, 1); break; }
      c.wait += (typeof r.value === 'number' ? r.value : 0);
    }
  }
}

// ---- disaster helpers ----
function prepCols(tx, tz) {
  const arr = [];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const dx = x - tx, dz = z - tz;
    arr.push([dx * dx + dz * dz, x, z]);
  }
  arr.sort((a, b) => a[0] - b[0]);
  return arr;
}
function* digScorch(tx, tz, craterR, structR, fireN, step) {
  const cols = prepCols(tx, tz);
  let si = 0, ci = 0, sr = 0, cr = 0;
  while (sr < structR || (ci < cols.length && cols[ci][0] < craterR * craterR)) {
    sr = Math.min(structR, sr + Math.max(2, structR / 30));
    while (si < cols.length && cols[si][0] < sr * sr) {
      const d2 = cols[si][0], x = cols[si][1], z = cols[si][2]; si++;
      const h = colBase(x, z);
      destroyColumn(x, z, h + 1, Math.min(63, h + 44));
      paintKey((z * SIZE + x) * 64 + h, H(0.06, 0.25, 0.08 + rand() * 0.04));
    }
    cr = Math.min(craterR, cr + craterR / 18);
    while (ci < cols.length && cols[ci][0] < cr * cr) {
      const d2 = cols[ci][0], x = cols[ci][1], z = cols[ci][2]; ci++;
      const d = Math.sqrt(d2), h = hmap[idx(x, z)];
      const depth = Math.max(0, Math.round(craterR * 0.6 - d * 0.4));
      const floorY = Math.max(2, h - depth);
      for (let y = floorY; y <= h; y++) removeKey((z * SIZE + x) * 64 + y);
      if (d < craterR * 0.45) addKey(x, floorY, z, H(0.04, 0.95, 0.42));
    }
    staticDirty = true;
    yield step;
  }
  for (let i = 0; i < fireN; i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * (craterR + 24);
    const x = Math.round(tx + Math.cos(a) * rr), z = Math.round(tz + Math.sin(a) * rr);
    if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) continue;
    const k = (z * SIZE + x) * 64 + hmap[idx(x, z)];
    if (colOf[k]) colOf[k] = H(rand() < 0.5 ? 0.03 : 0.08, 0.95, 0.42 + rand() * 0.1);
  }
  staticDirty = true;
}

// ---- earthquake ----
function* disasterQuake() {
  shakeAmp = Math.max(shakeAmp, 2.4);
  for (let r = 1; r <= 95; r++) {
    const p = Math.max(0, 0.95 - r / 110);
    for (let z = C - r; z <= C + r; z++) {
      if (z < 0 || z >= SIZE) continue;
      for (let x = C - r; x <= C + r; x++) {
        if (x < 0 || x >= SIZE) continue;
        if (Math.max(Math.abs(x - C), Math.abs(z - C)) !== r) continue;
        if (rand() > p) continue;
        const h = colBase(x, z);
        destroyColumn(x, z, h + 1, Math.min(63, h + 42));
        if (rand() < 0.4) removeKey((z * SIZE + x) * 64 + (h - ((rand() * 3) | 0)));
        const kt = (z * SIZE + x) * 64 + h;
        if (colOf[kt] && rand() < 0.3) colOf[kt] = H(0.07, 0.15, 0.16);
      }
    }
    shakeAmp = Math.max(shakeAmp, 2.4 * (1 - r / 100));
    staticDirty = true;
    yield 0.07;
  }
}

// ---- meteor strike ----
let meteor = null;
function startMeteor() {
  const tx = 60 + ((rand() * 136) | 0), tz = 60 + ((rand() * 136) | 0);
  const off = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++)
    if (dx * dx + dy * dy + dz * dz <= 6) off.push([dx, dy, dz, H(0.06 + dy * 0.012, 0.95, 0.5 - dy * 0.05)]);
  const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), off.length);
  mesh.frustumCulled = false;
  const _m = new THREE.Matrix4(), _cc = new THREE.Color();
  off.forEach(([x, y, z, c], i) => {
    mesh.setMatrixAt(i, _m.makeTranslation(x + 0.5, y + 0.5, z + 0.5));
    _cc.setHex(c); mesh.setColorAt(i, _cc);
  });
  scene.add(mesh);
  meteor = { mesh, from: new THREE.Vector3(tx - 200, 170, tz - 150), to: new THREE.Vector3(tx, 10, tz), t: 0, dur: 2.4, tx, tz };
}
function updateMeteor(dt) {
  if (!meteor) return;
  meteor.t += dt;
  const k = Math.min(1, meteor.t / meteor.dur);
  meteor.mesh.position.lerpVectors(meteor.from, meteor.to, k * k);
  if (k >= 1) {
    const { tx, tz } = meteor;
    scene.remove(meteor.mesh);
    meteor = null;
    doFlash(0.55);
    shakeAmp = Math.max(shakeAmp, 1.8);
    spawnCo(digScorch(tx, tz, 10, 34, 140, 0.05), 'meteor');
  }
}

// ---- tsunami ----
const waterPal = [H(0.55, 0.75, 0.42), H(0.56, 0.8, 0.45), H(0.57, 0.7, 0.38), H(0.54, 0.85, 0.5)];
const foamPal = [H(0, 0, 0.97), H(0.55, 0.5, 0.75)];
let tsunami = null;
function startTsunami() {
  const cap = 11000;
  const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  tsunami = { mesh, cap, x: -14.0, spd: 30 };
  doFlash(0.15);
  shakeAmp = Math.max(shakeAmp, 0.8);
}
function updateTsunami(dt) {
  if (!tsunami) return;
  const w = tsunami;
  const prevX = Math.floor(w.x);
  w.x += w.spd * dt;
  const curX = Math.floor(w.x);
  for (let x = prevX; x < curX; x++) {
    if (x < 0 || x >= SIZE) continue;
    for (let z = 0; z < SIZE; z++) {
      const i = idx(x, z), base = colBase(x, z);
      destroyColumn(x, z, base + 1, Math.min(63, base + 18));
      const mud = rand(), kt = (z * SIZE + x) * 64 + hmap[i];
      if (colOf[kt]) {
        if (mud < 0.45) colOf[kt] = H(0.07, 0.35, 0.16 + rand() * 0.06);
        else if (mud < 0.6) colOf[kt] = H(0.11, 0.4, 0.5);
      }
    }
    staticDirty = true;
  }
  const _m = new THREE.Matrix4(), _cc = new THREE.Color();
  const wx = Math.floor(w.x);
  let n = 0;
  for (let z = 0; z < SIZE; z++) {
    const hcol = 15 + Math.round(3 * Math.sin(z * 0.12) + 2 * Math.sin(z * 0.031 + 1));
    for (let dy = 0; dy < hcol; dy++) {
      for (let wdx = 0; wdx < 2; wdx++) {
        if (n >= w.cap) break;
        _m.makeTranslation(wx + wdx + 0.5, 6 + dy + 0.5, z + 0.5);
        w.mesh.setMatrixAt(n++, _m);
        _cc.setHex(dy >= hcol - 2 ? foamPal[(z + dy) & 1] : waterPal[(z + dy) & 3]);
        w.mesh.setColorAt(n - 1, _cc);
      }
    }
  }
  w.mesh.count = n;
  w.mesh.instanceMatrix.needsUpdate = true;
  if (w.mesh.instanceColor) w.mesh.instanceColor.needsUpdate = true;
  if (w.x > SIZE + 20) { scene.remove(w.mesh); tsunami = null; finishDisaster('tsunami'); }
}

// ---- 25kt nuclear airburst ----
const nukeLight = new THREE.PointLight(0xffd9a0, 0, 500, 1.8);
scene.add(nukeLight);
let mush = null;
function startMushroom(x, z) {
  const parts = [];
  for (let y = 0; y < 20; y++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
    if (dx * dx + dz * dz <= 5) parts.push([dx, y, dz, H(0.07, 0.05, 0.16 + rand() * 0.15)]);
  for (let dx = -9; dx <= 9; dx++) for (let dy = -3; dy <= 4; dy++) for (let dz = -9; dz <= 9; dz++) {
    if (dx * dx + dz * dz + dy * dy * 6 > 78 || rand() < 0.15) continue;
    const hot = dy <= -1 && rand() < 0.6;
    parts.push([dx, dy + 20, dz, hot ? H(0.05, 0.9, 0.45) : H(0.07, 0.04, 0.14 + rand() * 0.2)]);
  }
  const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), parts.length);
  mesh.frustumCulled = false;
  const _m = new THREE.Matrix4(), _cc = new THREE.Color();
  parts.forEach(([x2, y2, z2, c], i) => {
    mesh.setMatrixAt(i, _m.makeTranslation(x2 + 0.5, y2 + 0.5, z2 + 0.5));
    _cc.setHex(c); mesh.setColorAt(i, _cc);
  });
  mesh.position.set(x, 20, z);
  scene.add(mesh);
  mush = { mesh, t: 0 };
}
function updateMush(dt) {
  if (!mush) return;
  mush.t += dt;
  const rise = Math.min(1, mush.t / 6);
  mush.mesh.position.y = 20 * rise * rise;
  if (mush.t > 13) { scene.remove(mush.mesh); mush = null; }
}
function* disasterNuke() {
  const tx = C, tz = C;
  doFlash(1);
  nukeLight.position.set(tx, 45, tz);
  nukeLight.intensity = 4000;
  shakeAmp = Math.max(shakeAmp, 1.4);
  yield 0.4;
  spawnCo(digScorch(tx, tz, 24, 80, 380, 0.04));
  yield 1.0;
  startMushroom(tx, tz);
  yield 14;
}

// ---- strip wiring ----
function startDisaster(name) {
  if (activeDisasters.has(name)) return;
  if (name === 'earthquake') spawnCo(disasterQuake(), name);
  else if (name === 'meteor') { startMeteor(); }
  else if (name === 'tsunami') { startTsunami(); }
  else if (name === 'nuke') spawnCo(disasterNuke(), name);
  else return;
  activeDisasters.add(name);
  updateStrip();
}
function updateStrip() {
  document.querySelectorAll('#strip button[data-d]').forEach(b => {
    b.disabled = activeDisasters.has(b.dataset.d);
  });
}
document.querySelectorAll('#strip button[data-d]').forEach(b =>
  b.addEventListener('click', () => startDisaster(b.dataset.d)));
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) resetBtn.addEventListener('click', () => location.reload());
window.__disaster = startDisaster;

const dyn = [];
let dynCount = 0;
function registerDyn(kind, make, extra) {
  const offsets = make();
  dyn.push({ kind, offsets, start: dynCount, ...extra });
  dynCount += offsets.length;
}
function makeBalloon(hue) {
  const o = [];
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    if (dx * dx + dy * dy + dz * dz <= 11 && rand() < 0.92)
      o.push([dx, dy + 3, dz, H(hue + dx * 0.014, 0.75, 0.55)]);
  }
  for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    o.push([dx, -1, dz, H(0.07, 0.55, 0.3)]);
    o.push([dx, -2, dz, H(0.09, 0.6, 0.42)]);
    o.push([dx, -3, dz, H(0.08, 0.55, 0.35)]);
  }
  return o;
}
function makePlane(hue) {
  const o = [];
  const body = H(hue, 0.8, 0.55), wing = H(hue, 0.35, 0.85), dk = H(0, 0, 0.15);
  for (let i = -3; i <= 3; i++) o.push([i, 0, 0, body]);
  o.push([4, 0, 0, dk]);
  for (let j = -5; j <= 5; j++) if (j !== 0) o.push([0, 0, j, wing]);
  for (let j = -2; j <= 2; j++) if (j !== 0) o.push([-3, 0, j, wing]);
  o.push([-3, 1, 0, wing]); o.push([-3, 2, 0, dk]);
  return o;
}
function makeCloud() {
  const o = [];
  const blobs = 2 + (rand() * 2 | 0);
  for (let b = 0; b < blobs; b++) {
    const bx = (rand() * 8 - 4) | 0, by = (rand() * 2) | 0, bz = (rand() * 6 - 3) | 0, r = 2.2 + rand() * 1.6;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) {
      if (dx * dx + dy * dy * 2.5 + dz * dz <= r * r && rand() < 0.5) {
        const wx = bx + dx, wy = by + dy, wz = bz + dz;
        if (!o.some(p => p[0] === wx && p[1] === wy && p[2] === wz)) o.push([wx, wy, wz, H(0, 0, 0.97)]);
      }
    }
  }
  return o;
}
for (let i = 0; i < 7; i++) {
  const hue = rand();
  registerDyn('balloon', () => makeBalloon(hue), {
    pos: new THREE.Vector3(rand() * 320 - 30, 0, rand() * 320 - 30),
    baseY: 55 + rand() * 28, ph: rand() * 6.28, drift: 1.5 + rand() * 1.5
  });
}
for (let i = 0; i < 6; i++) {
  const hue = rand();
  registerDyn('plane', () => makePlane(hue), {
    pos: new THREE.Vector3(), cx: C, cz: C, r: 55 + rand() * 70,
    h: 50 + rand() * 38, a: rand() * 6.28, spd: (0.1 + rand() * 0.15) * (rand() < 0.5 ? 1 : -1)
  });
}
for (let i = 0; i < 9; i++) {
  registerDyn('cloud', makeCloud, {
    pos: new THREE.Vector3(rand() * 320 - 30, 62 + rand() * 30, rand() * 320 - 30),
    drift: 1.2 + rand() * 1.2
  });
}

const dynMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), dynCount);
dynMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dynMesh.frustumCulled = false;
const dynColor = new THREE.Color();
for (const o of dyn) {
  o.localMats = o.offsets.map(([x, y, z]) => new THREE.Matrix4().makeTranslation(x + 0.5, y + 0.5, z + 0.5));
  o.offsets.forEach(([, , , c], k) => { dynColor.setHex(c); dynMesh.setColorAt(o.start + k, dynColor); });
}
if (dynMesh.instanceColor) dynMesh.instanceColor.needsUpdate = true;
scene.add(dynMesh);

const camPos = new THREE.Vector3(C + 58, 36, C + 84);
let yaw = Math.atan2(camPos.x - C, camPos.z - C), pitch = -0.28;
const keys = new Set();
const CTRL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyA', 'KeyZ', 'KeyX']);
addEventListener('keydown', e => { keys.add(e.code); if (CTRL.has(e.code)) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.code));
let dragging = false;
addEventListener('mousedown', e => { if (e.button === 0) dragging = true; });
addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', e => {
  if (!dragging) return;
  yaw -= e.movementX * 0.0032;
  pitch = Math.max(-1.35, Math.min(1.35, pitch - e.movementY * 0.0032));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let t = 0;
const _m = new THREE.Matrix4(), _o = new THREE.Matrix4(), _q = new THREE.Quaternion(),
  _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _f = new THREE.Vector3(), _t = new THREE.Vector3();

function updateDyn(dt) {
  for (const o of dyn) {
    if (o.kind === 'plane') {
      o.a += o.spd * dt;
      o.pos.set(o.cx + Math.cos(o.a) * o.r, o.h, o.cz + Math.sin(o.a) * o.r);
      o.yaw = Math.atan2(-Math.cos(o.a), -Math.sin(o.a));
    } else if (o.kind === 'balloon') {
      o.pos.x += o.drift * dt;
      if (o.pos.x > 330) o.pos.x = -70;
      o.pos.y = o.baseY + Math.sin(t * 0.3 + o.ph) * 2.5;
      o.yaw = 0;
    } else {
      o.pos.x += o.drift * dt;
      if (o.pos.x > 330) o.pos.x = -70;
      o.yaw = 0;
    }
    _e.set(0, o.yaw, 0);
    _q.setFromEuler(_e);
    _m.compose(o.pos, _q, _s);
    for (let k = 0; k < o.offsets.length; k++) {
      _o.multiplyMatrices(_m, o.localMats[k]);
      dynMesh.setMatrixAt(o.start + k, _o);
    }
  }
  dynMesh.instanceMatrix.needsUpdate = true;
}

function updateCam(dt) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = -fz, rz = fx;
  let mx = 0, mz = 0, my = 0, mz2 = 0;
  if (keys.has('ArrowUp')) { mx += fx; mz += fz; }
  if (keys.has('ArrowDown')) { mx -= fx; mz -= fz; }
  if (keys.has('ArrowLeft')) { mx -= rx; mz -= rz; }
  if (keys.has('ArrowRight')) { mx += rx; mz += rz; }
  if (keys.has('KeyQ')) my += 1;
  if (keys.has('KeyA')) my -= 1;
  if (keys.has('KeyZ')) mz2 += 1;
  if (keys.has('KeyX')) mz2 -= 1;
  camPos.x = Math.max(-60, Math.min(316, camPos.x + mx * 28 * dt));
  camPos.z = Math.max(-60, Math.min(316, camPos.z + mz * 28 * dt));
  camPos.y = Math.max(11, Math.min(170, camPos.y + my * 22 * dt));
  _f.set(fx * Math.cos(pitch), Math.sin(pitch), fz * Math.cos(pitch));
  camPos.addScaledVector(_f, mz2 * 44 * dt);
  camPos.y = Math.max(11, Math.min(170, camPos.y));
  camera.position.set(
    camPos.x + (Math.random() - 0.5) * shakeAmp,
    camPos.y + (Math.random() - 0.5) * shakeAmp * 0.6,
    camPos.z + (Math.random() - 0.5) * shakeAmp
  );
  _t.copy(camPos).add(_f);
  camera.lookAt(_t);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  updateDyn(dt);
  updateMeteor(dt);
  updateTsunami(dt);
  updateMush(dt);
  stepCos(dt);
  shakeAmp = Math.max(0, shakeAmp - dt * 0.9);
  if (nukeLight.intensity > 0) nukeLight.intensity = Math.max(0, nukeLight.intensity - dt * 900);
  if (flashLevel > 0) {
    flashLevel = Math.max(0, flashLevel - dt * 0.6);
    flashDiv.style.opacity = flashLevel.toFixed(3);
  }
  if (staticDirty && t - lastRebuild > 0.4) rebuildStatic();
  updateCam(dt);
  renderer.render(scene, camera);
});
