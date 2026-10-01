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

const staticMesh = (() => {
  const n = vx.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n);
  const M = new THREE.Matrix4(), Cc = new THREE.Color();
  for (let i = 0; i < n; i++) {
    M.makeTranslation(vx[i] + 0.5, vy[i] + 0.5, vz[i] + 0.5);
    mesh.setMatrixAt(i, M);
    Cc.setHex(vc[i]);
    mesh.setColorAt(i, Cc);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();
console.log('static voxels:', vx.length);

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
  camera.position.copy(camPos);
  _t.copy(camPos).add(_f);
  camera.lookAt(_t);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  updateDyn(dt);
  updateCam(dt);
  renderer.render(scene, camera);
});
