/* =====================================================================
   THE VOXEL GARDEN OF THE PAGODA
   A voxel sandbox on a sparse 65536^3 lattice.
   ===================================================================== */
"use strict";

// Logical lattice: every voxel lives at integer coords of a 65536^3 grid.
// Only voxels that actually exist are stored (sparse map) and only the
// exposed shell is sent to the GPU.
const GRID = 65536;
const WORLD = 256;              // populated region: [-128 .. 127] on x/z
const OFF = 128;

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
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 4000);
scene.fog = new THREE.Fog(0xa8cbe8, 170, 560);

// sky dome with vertical gradient
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
    new THREE.SphereGeometry(1800, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(dome);
})();

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a6b3a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
sun.position.set(120, 180, 90);
scene.add(sun);
const sunBall = new THREE.Mesh(
  new THREE.SphereGeometry(34, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })
);
sunBall.position.set(620, 760, -900);
scene.add(sunBall);

/* ---------------- voxel store ---------------- */
const voxels = new Map();            // "x|y|z" -> {x,y,z,c,t}
const waterList = [];                // {x,y,z,c}
let heightGrid = new Float32Array(WORLD * WORLD);

function hAt(x, z) {
  x = clamp(Math.round(x), -OFF, OFF - 1);
  z = clamp(Math.round(z), -OFF, OFF - 1);
  return heightGrid[(x + OFF) * WORLD + (z + OFF)];
}
function kkey(x, y, z) { return x + "|" + y + "|" + z; }
function addVoxel(x, y, z, c, t) {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  if (y < 0) return;
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
function riverZ(x) { return -46 + 16 * Math.sin(x * 0.025) + 12 * (fbm(x * 0.02, 7.7, 2) - 0.5); }
function riverW(x) { return 4.2 + 2.6 * fbm(x * 0.02, 31.3, 2); }

const POND = { x: -25, z: 26, r: 10 };

/* ---------------- world generation ---------------- */
function generateWorld() {
  voxels.clear();
  waterList.length = 0;
  heightGrid = new Float32Array(WORLD * WORLD);

  // 1) heights
  for (let x = -OFF; x < OFF; x++) {
    for (let z = -OFF; z < OFF; z++) {
      const d = Math.hypot(x, z);
      let h = 2 + fbm(x * 0.035, z * 0.035, 4) * 7 + fbm(x * 0.008 + 5.2, z * 0.008 + 9.1, 3) * 3;
      // river
      const dw = Math.abs(z - riverZ(x));
      const w = riverW(x);
      if (dw < w) h = Math.min(h, 5);
      else if (dw < w + 3) h = Math.min(h, 7);
      // garden plateau
      if (Math.abs(x) < 42 && Math.abs(z) < 34) {
        h = 12 + fbm(x * 0.1, z * 0.1, 2) * 0.6;
      }
      // pond carve
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r) h = 9;
      // mountain ring
      const m = clamp((d - 88) / 26, 0, 1);
      h += m * (26 * fbm(x * 0.028 + 2.3, z * 0.028 + 7.7, 4) + 14 * m);
      h = Math.max(1, Math.round(h));
      heightGrid[(x + OFF) * WORLD + (z + OFF)] = h;
    }
  }

  // 2) fill columns (deep enough to cover cliff faces)
  for (let x = -OFF; x < OFF; x++) {
    for (let z = -OFF; z < OFF; z++) {
      const h = hAt(x, z);
      const lowN = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1));
      const y0 = Math.max(0, Math.min(h, lowN - 4));
      const col = surfaceColor(x, z, h);
      for (let y = y0; y <= h; y++) {
        let c;
        if (y === h) c = col.top;
        else if (y >= h - 1) c = col.mid;
        else c = col.deep;
        addVoxel(x, y, z, jitter(c, 9), 't');
      }
      // water surfaces
      const dwr = Math.abs(z - riverZ(x));
      if (dwr < riverW(x) + 2.2 && h < 6) addWater(x, 6, z, jitter(COL(64, 140, 205), 8));
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (pd < POND.r - 0.5) addWater(x, 11, z, jitter(COL(70, 150, 190), 8));
      // koi in the pond
      if (pd < POND.r - 2 && hash2(x * 7, z * 13) < 0.02) {
        const kc = hash2(x, z) < 0.5 ? COL(255, 120, 40) : (hash2(x, z) < 0.8 ? COL(250, 250, 250) : COL(40, 40, 50));
        addVoxel(x, 10, z, kc, 't');
      }
      // garden flowers
      if (Math.abs(x) < 40 && Math.abs(z) < 32 && h === 12) {
        if (hash2(x * 3 + 11, z * 5 + 7) < 0.016) {
          const fl = [COL(244, 80, 110), COL(255, 200, 40), COL(190, 90, 220), COL(255, 255, 255), COL(255, 130, 30), COL(90, 120, 250)][Math.floor(hash2(x, z * 3) * 6)];
          addVoxel(x, h + 1, z, fl, 'v');
        }
      }
    }
  }

  // 3) structures & flora
  buildPaths();
  buildHedge();
  buildPagoda(0, -14);
  buildTorii(0, 34);
  buildBridge(15, Math.round(riverZ(15)));
  const lanterns = [[4, 4], [-4, 4], [4, 12], [-4, 12], [4, 20], [-4, 20], [4, 28], [-4, 28], [8, 0], [-8, 0]];
  for (const p of lanterns) buildLantern(p[0], p[1]);
  buildBarn(66, 42);

  const gardenCherries = [[-14, -26], [14, -26], [-16, 6], [16, 6], [-30, -6], [30, -6], [-12, 16], [22, 16], [-33, 12], [33, 10]];
  for (const p of gardenCherries) addTree(p[0], p[1], 'cherry');
  // orchard row along the river
  for (let x = -116; x <= 116; x += 9) {
    const jx = x + ri(-2, 2);
    const side = hash2(x, 3) < 0.5 ? 1 : -1;
    const bz = Math.round(riverZ(jx) + side * (riverW(jx) + 3 + ri(0, 2)));
    if (hAt(jx, bz) >= 6) addTree(jx, bz, hash2(x, 9) < 0.65 ? 'cherry' : 'oak');
  }
  // southern orchard: maples + cherries
  for (let i = 0; i < 46; i++) {
    const x = ri(-90, 90), z = ri(40, 80);
    if (Math.hypot(x, z) > 108) continue;
    addTree(x, z, hash2(x, z) < 0.5 ? 'maple' : (hash2(x, z) < 0.75 ? 'cherry' : 'oak'));
  }
  // western pines + bamboo
  for (let i = 0; i < 44; i++) {
    const x = ri(-110, -60), z = ri(-40, 45);
    addTree(x, z, hash2(x * 2, z) < 0.6 ? 'pine' : 'oak');
  }
  for (let i = 0; i < 130; i++) {
    const x = ri(-95, -68), z = ri(-12, 18);
    addBamboo(x, z);
  }
  // meadow oaks east / pasture shade trees
  for (let i = 0; i < 26; i++) {
    const x = ri(52, 100), z = ri(-30, 70);
    if (Math.hypot(x, z) > 110) continue;
    addTree(x, z, hash2(x, z * 2) < 0.4 ? 'cherry' : 'oak');
  }
  // mountain firs
  for (let i = 0; i < 40; i++) {
    const a = rr(0, Math.PI * 2), r = rr(92, 116);
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    if (hAt(x, z) > 12 && hAt(x, z) < 42) addTree(x, z, 'pine');
  }
}
function addWater(x, y, z, c) { waterList.push({ x, y, z, c }); }

function surfaceColor(x, z, h) {
  const d = Math.hypot(x, z);
  const dw = Math.abs(z - riverZ(x));
  const w = riverW(x);
  if (h <= 7 && dw < w + 3.2) {  // river bank / bed
    return { top: COL(212, 190, 130), mid: COL(196, 170, 112), deep: COL(150, 128, 90) };
  }
  if (h > 44) return { top: COL(240, 246, 255), mid: COL(225, 228, 238), deep: COL(150, 150, 160) };
  if (h > 36) return { top: COL(128, 130, 138), mid: COL(112, 114, 122), deep: COL(92, 94, 102) };
  if (Math.abs(x) < 42 && Math.abs(z) < 34) {
    const g = hash2(x, z);
    const top = g < 0.33 ? COL(88, 168, 84) : (g < 0.66 ? COL(98, 178, 88) : COL(78, 158, 78));
    return { top, mid: COL(120, 92, 60), deep: COL(96, 72, 48) };
  }
  const g = hash2(x * 2, z);
  if (h > 24) {
    return { top: COL(58, 110, 55), mid: COL(96, 80, 56), deep: COL(80, 66, 46) };
  }
  const top = g < 0.25 ? COL(92, 170, 80) : (g < 0.5 ? COL(104, 178, 86) : (g < 0.8 ? COL(84, 158, 74) : COL(120, 186, 90)));
  return { top, mid: COL(112, 88, 58), deep: COL(92, 70, 46) };
}

function buildPaths() {
  const stone = COL(198, 192, 178);
  // main boulevard (S->N) and east-west avenue
  for (let z = -2; z <= 34; z++)
    for (let x = -2; x <= 2; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  for (let x = -34; x <= 34; x++)
    for (let z = -1; z <= 1; z++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  // spur to pond
  for (let z = 0; z <= 14; z++)
    for (let x = -26; x <= -24; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  // path east to barn
  for (let x = 34; x <= 60; x++)
    for (let z = -1; z <= 1; z++) addVoxel(x, hAt(x, z), z, jitter(COL(178, 152, 112), 10), 't');
  // path north to river bridge
  for (let z = -34; z <= -2; z++) {
    const bx = Math.round(xPathToBridge(z));
    for (let x = bx - 1; x <= bx + 1; x++) addVoxel(x, hAt(x, z), z, jitter(stone, 12), 't');
  }
}
function xPathToBridge(z) {
  // blend from x=0 at z=-2 to x=15 at the bridge
  const t = clamp((-2 - z) / 32, 0, 1);
  return 0 + t * 15;
}

function buildHedge() {
  const g = 12;
  const dark = COL(44, 92, 46);
  for (let x = -40; x <= 40; x++) {
    if (Math.abs(x) < 4) continue;                       // south gate
    addBox(x, g + 1, 32, 1, 3, 1, jitter(dark, 14), 's');
  }
  for (let z = -32; z <= 32; z++) {
    const gateN = Math.abs(z + 30) < 4;                  // north gate to the river
    const gateE = Math.abs(z) < 3;                       // east gate to the farm
    if (!gateN) { addBox(40, g + 1, z, 1, 3, 1, jitter(dark, 14), 's'); }
    if (!gateE) { addBox(-40, g + 1, z, 1, 3, 1, jitter(dark, 14), 's'); }
  }
  // topiary balls at gate corners
  for (const p of [[5, 32], [-5, 32], [39, 3], [-39, 3]]) {
    const g0 = 12;
    addBox(p[0] - 1, g0 + 1, p[1] - 1, 3, 3, 3, COL(52, 108, 52), 's', 12);
  }
}

function buildPagoda(cx, cz) {
  const g = 12;
  addBox(cx - 9, g + 1, cz - 9, 19, 2, 19, COL(158, 162, 168), 's', 8);   // stone plinth
  addBox(cx - 8, g + 3, cz - 8, 17, 1, 17, COL(138, 142, 148), 's', 6);
  const wallC = COL(242, 236, 224), postC = COL(146, 56, 40),
        roofC = COL(38, 52, 96), goldC = COL(232, 182, 76);
  let y = g + 4;
  for (let i = 0; i < 5; i++) {
    const hw = 7 - i;                       // half width of story
    const wh = 3;
    // walls (ring)
    for (let x = cx - hw; x <= cx + hw; x++)
      for (let z = cz - hw; z <= cz + hw; z++) {
        const edge = (x === cx - hw || x === cx + hw || z === cz - hw || z === cz + hw);
        if (!edge) continue;
        const post = ((x - cx + 9) % 3 === 0) || ((z - cz + 9) % 3 === 0);
        for (let yy = 0; yy < wh; yy++)
          addVoxel(x, y + yy, z, post ? postC : wallC, 's');
      }
    // dark window dots on upper stories
    for (let s = 0; s < 4; s++) {
      const a = [
        [cx, cz - hw], [cx, cz + hw], [cx - hw, cz], [cx + hw, cz]
      ][s];
      addVoxel(a[0], y + 1, a[1], COL(60, 42, 40), 's');
    }
    y += wh;
    // roof: overhanging slab
    const rh = hw + 2;
    for (let x = cx - rh; x <= cx + rh; x++)
      for (let z = cz - rh; z <= cz + rh; z++) {
        const edgeX = Math.abs(x - cx) >= rh - 1, edgeZ = Math.abs(z - cz) >= rh - 1;
        const corner = (Math.abs(x - cx) === rh && Math.abs(z - cz) === rh);
        const goldTip = corner || (edgeX && edgeZ && hash2(x * 5 + i, z * 3) < 0.3) || (edgeZ && (x - cx + 9) % 2 === 0 && Math.random() < 0.25) || (edgeX && (z - cz + 9) % 2 === 0 && Math.random() < 0.25);
        addVoxel(x, y, z, goldTip ? goldC : jitter(roofC, 10), 's');
      }
    // eave upturns (gold flicks at mid edges)
    addVoxel(cx - rh, y, cz, goldC, 's'); addVoxel(cx + rh, y, cz, goldC, 's');
    addVoxel(cx, y, cz - rh, goldC, 's'); addVoxel(cx, y, cz + rh, goldC, 's');
    y += 1;
  }
  // golden spire
  addBox(cx - 1, y, cz - 1, 3, 1, 3, COL(214, 168, 70), 's');
  for (let k = 0; k < 5; k++) addVoxel(cx, y + 1 + k, cz, k % 2 ? COL(255, 214, 110) : goldC, 's');
  addVoxel(cx, y + 6, cz, COL(255, 240, 170), 's');
  // grand stair south
  for (let s = 0; s < 4; s++) addBox(cx - 2, g + 1 + (3 - s), cz + 9 + s, 5, 1, 1, COL(168, 170, 176), 's', 6);
  // door
  addBox(cx - 1, g + 4, cz + 9, 3, 3, 1, COL(94, 42, 30), 's');
  addVoxel(cx, g + 7, cz + 9, COL(232, 182, 76), 's');
}

function buildTorii(tx, tz) {
  const g = 12, verm = COL(201, 58, 42);
  for (const s of [-4, 4]) {
    addBox(tx + s - 1, g + 1, tz, 1, 2, 1, COL(238, 238, 232), 's');      // white foot
    addBox(tx + s, g + 3, tz, 1, 7, 1, jitter(verm, 8), 's');              // pillar
    addVoxel(tx + s, g + 10, tz, COL(245, 245, 240), 's');                 // white sleeve
  }
  addBox(tx - 5, g + 10, tz, 11, 1, 1, jitter(verm, 6), 's');              // shimaki
  addBox(tx - 4, g + 8, tz, 9, 1, 1, jitter(verm, 6), 's');                // nuki
  addVoxel(tx, g + 8, tz, COL(90, 40, 30), 's');                           // strut dot
  addBox(tx - 6, g + 11, tz, 13, 1, 1, COL(60, 55, 60), 's');              // kasagi cap
  addVoxel(tx - 6, g + 12, tz, COL(232, 182, 76), 's');
  addVoxel(tx + 6, g + 12, tz, COL(232, 182, 76), 's');
}

function buildBridge(bx, bz) {
  const red = COL(178, 48, 48);
  for (let t = 0; t <= 18; t++) {
    const z = bz - 9 + t;
    const y = 15 + Math.round(5 * (1 - Math.pow((t - 9) / 9, 2)));
    for (let dx = -1; dx <= 1; dx++) addVoxel(bx + dx, y, z, jitter(red, 10), 's');
    if (t % 2 === 0) { addVoxel(bx - 1, y + 1, z, red, 's'); addVoxel(bx + 1, y + 1, z, red, 's'); }
    if (t % 6 === 1) { addVoxel(bx - 1, y + 2, z, COL(232, 182, 76), 's'); addVoxel(bx + 1, y + 2, z, COL(232, 182, 76), 's'); }
  }
  for (const t of [3, 15]) {
    const z = bz - 9 + t;
    const y = 15 + Math.round(5 * (1 - Math.pow((t - 9) / 9, 2)));
    for (let yy = 6; yy < y; yy++) addVoxel(bx, yy, z, jitter(COL(120, 90, 60), 8), 's');
  }
}

function buildLantern(lx, lz) {
  const g = hAt(lx, lz);
  const stone = COL(150, 152, 158);
  addVoxel(lx, g + 1, lz, jitter(stone, 8), 's');
  addVoxel(lx, g + 2, lz, jitter(stone, 8), 's');
  addVoxel(lx, g + 3, lz, jitter(stone, 8), 's');
  addBox(lx - 1, g + 4, lz - 1, 3, 1, 3, COL(136, 138, 144), 's', 6);
  addBox(lx - 1, g + 5, lz - 1, 2, 2, 2, COL(255, 212, 122), 's');
  addBox(lx - 1, g + 7, lz - 1, 3, 1, 3, COL(120, 122, 128), 's', 6);
  addVoxel(lx, g + 8, lz, COL(150, 152, 158), 's');
}

function buildBarn(bx, bz) {
  const g = Math.round(hAt(bx, bz));
  const red = COL(168, 46, 38), white = COL(240, 238, 230), roofC = COL(104, 108, 116);
  // walls
  for (let x = bx; x < bx + 12; x++)
    for (let z = bz; z < bz + 9; z++) {
      const edge = (x === bx || x === bx + 11 || z === bz || z === bz + 8);
      if (!edge) continue;
      for (let y = g + 1; y <= g + 6; y++) addVoxel(x, y, z, jitter(red, 8), 's');
    }
  // gable ends + roof
  for (let r = 0; r < 5; r++) {
    for (let z = bz; z < bz + 9; z++) {
      for (let x = bx + r; x <= bx + 11 - r; x++) {
        const isEdge = (x === bx + r || x === bx + 11 - r);
        if (r < 2 || isEdge || z === bz || z === bz + 8)
          addVoxel(x, g + 7 + r, z, jitter(roofC, 8), 's');
      }
    }
  }
  // big door (white trim)
  addBox(bx + 4, g + 1, bz + 8, 4, 5, 1, COL(120, 34, 28), 's');
  addBox(bx + 4, g + 6, bz + 8, 4, 1, 1, white, 's');
  addVoxel(bx + 5, g + 3, bz + 8, white, 's'); addVoxel(bx + 6, g + 3, bz + 8, white, 's');
  // hayloft
  addBox(bx + 5, g + 8, bz, 2, 2, 1, COL(80, 60, 40), 's');
  // silo
  for (let y = g + 1; y <= g + 11; y++)
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (dx * dx + dz * dz <= 4 && (Math.abs(dx) === 2 || Math.abs(dz) === 2 || dx === 0 || dz === 0))
          if (dx * dx + dz * dz <= 5) addVoxel(bx + 16 + dx, y, bz + 4 + dz, jitter(COL(190, 192, 196), 6), 's');
  addBox(bx + 14, g + 12, bz + 2, 5, 1, 5, COL(168, 46, 38), 's', 6);
}

/* ---------------- trees ---------------- */
function addTree(x, z, kind) {
  const g = Math.round(hAt(x, z));
  if (kind === 'cherry') {
    const th = 4 + ri(0, 2);
    for (let y = 1; y <= th; y++) addVoxel(x, g + y, z, jitter(COL(104, 72, 50), 8), 'v');
    const r = 4 + ri(0, 1);
    const pal = [COL(255, 183, 197), COL(255, 158, 182), COL(255, 205, 221), COL(255, 240, 244)];
    blobCanopy(x, g + th + 1, z, r, (dx, dy, dz) => pal[Math.floor(hash2(x + dx * 7, z + dz * 13 + dy) * pal.length)], 0.62);
  } else if (kind === 'maple') {
    const th = 4 + ri(0, 2);
    for (let y = 1; y <= th; y++) addVoxel(x, g + y, z, jitter(COL(96, 66, 44), 8), 'v');
    const pal = [COL(220, 62, 32), COL(232, 116, 26), COL(208, 152, 30), COL(180, 40, 30)];
    blobCanopy(x, g + th + 1, z, 4, (dx, dy, dz) => pal[Math.floor(hash2(x + dx * 3, z + dz * 11) * pal.length)], 0.6);
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
    blobCanopy(x, g + th + 1, z, 3 + ri(0, 1), (dx, dy, dz) => pal[Math.floor(hash2(x + dx, z + dz * 5 + dy * 3) * pal.length)], 0.58);
  }
}
function blobCanopy(cx, cy, cz, r, colorFn, fill) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++) {
        const d2 = dx * dx + dy * dy * 1.35 + dz * dz;
        if (d2 > r * r + 1) continue;
        if (hash2(cx * 31 + dx * 7, cz * 17 + dz * 13 + dy * 5) > fill + 0.35 * (1 - d2 / (r * r))) continue;
        addVoxel(cx + dx, cy + dy + Math.floor(r * 0.5), cz + dz, colorFn(dx, dy, dz), 'v');
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

/* ---------------- instanced rendering ---------------- */
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const matTerrain = new THREE.MeshLambertMaterial({});
const matWater = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
let terrainMesh = null, waterMesh = null;
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

function exposed(x, y, z) {
  return !voxels.has(kkey(x + 1, y, z)) || !voxels.has(kkey(x - 1, y, z)) ||
         !voxels.has(kkey(x, y + 1, z)) || !voxels.has(kkey(x, y - 1, z)) ||
         !voxels.has(kkey(x, y, z + 1)) || !voxels.has(kkey(x, y, z - 1));
}
function rebuild() {
  if (terrainMesh) { scene.remove(terrainMesh); terrainMesh.dispose(); terrainMesh = null; }
  if (waterMesh) { scene.remove(waterMesh); waterMesh.dispose(); waterMesh = null; }
  const list = [];
  for (const e of voxels.values()) if (exposed(e.x, e.y, e.z)) list.push(e);
  const im = new THREE.InstancedMesh(BOX_GEO, matTerrain, Math.max(1, list.length));
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    _dummy.position.set(v.x + 0.5, v.y + 0.5, v.z + 0.5);
    _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    im.setMatrixAt(i, _dummy.matrix);
    _col.setHex(v.c);
    im.setColorAt(i, _col);
  }
  im.count = list.length;
  im.frustumCulled = false;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  scene.add(im);
  terrainMesh = im;

  const wm = new THREE.InstancedMesh(BOX_GEO, matWater, Math.max(1, waterList.length));
  for (let i = 0; i < waterList.length; i++) {
    const v = waterList[i];
    _dummy.position.set(v.x + 0.5, v.y + 0.5, v.z + 0.5);
    _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    wm.setMatrixAt(i, _dummy.matrix);
    _col.setHex(v.c);
    wm.setColorAt(i, _col);
  }
  wm.count = waterList.length;
  wm.frustumCulled = false;
  if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
  scene.add(wm);
  waterMesh = wm;

  document.getElementById('stats').textContent =
    'grid ' + GRID + '^3 lattice (sparse) | voxels ' + voxels.size.toLocaleString() + ' | drawn ' + list.length.toLocaleString();
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
    g.add(mkBox(0.25, 0.18, 0.45, COL(120, 40, 30), 0, 0.62, -0.3));   // tail
    g.add(mkBox(0.3, 0.3, 0.3, COL(252, 250, 248), 0, 0.95, 0.32));    // head
    const head = g.children[g.children.length - 1]; parts.head = head;
    g.add(mkBox(0.12, 0.14, 0.12, COL(220, 40, 40), 0, 1.16, 0.32));   // comb
    g.add(mkBox(0.1, 0.08, 0.12, COL(240, 150, 40), 0, 0.92, 0.52));   // beak
    for (const sx of [-0.15, 0.15]) {
      const leg = mkBox(0.09, 0.32, 0.09, COL(232, 170, 60), sx, 0.16, 0);
      leg.geometry.translate(0, -0.16, 0); leg.position.y = 0.32;
      parts.legs.push(leg); g.add(leg);
    }
  } else if (kind === 'cow') {
    const body = new THREE.Group();
    body.add(mkBox(1.6, 0.9, 1.0, COL(248, 246, 242), 0, 0, 0));
    for (let i = 0; i < 4; i++)
      body.add(mkBox(0.45, 0.45, 0.5, COL(40, 38, 38), rr(-0.7, 0.7), rr(-0.2, 0.3), rr(-0.3, 0.3)));
    body.position.y = 1.05;
    g.add(body);
    g.add(mkBox(0.6, 0.55, 0.6, COL(248, 246, 242), 0, 1.35, 0.78));   // head
    const head = g.children[g.children.length - 1]; parts.head = head;
    g.add(mkBox(0.4, 0.22, 0.15, COL(240, 170, 180), 0, 1.2, 1.05));   // snout
    g.add(mkBox(0.1, 0.16, 0.1, COL(230, 228, 220), -0.28, 1.72, 0.75));
    g.add(mkBox(0.1, 0.16, 0.1, COL(230, 228, 220), 0.28, 1.72, 0.75));
    g.add(mkBox(0.12, 0.4, 0.12, COL(60, 50, 45), 0, 0.2, -0.55));     // tail
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.3, 0.3]) {
      const leg = mkBox(0.18, 0.62, 0.18, COL(70, 60, 55), sx, 0.31, sz);
      leg.geometry.translate(0, -0.31, 0); leg.position.y = 0.62;
      parts.legs.push(leg); g.add(leg);
    }
  } else { // pig
    const body = new THREE.Group();
    body.add(mkBox(1.2, 0.7, 0.85, COL(244, 150, 170), 0, 0, 0));
    body.position.y = 0.85;
    g.add(body);
    g.add(mkBox(0.45, 0.42, 0.5, COL(242, 140, 162), 0, 1.0, 0.62));   // head
    const head = g.children[g.children.length - 1]; parts.head = head;
    g.add(mkBox(0.24, 0.18, 0.1, COL(228, 110, 140), 0, 0.94, 0.88));  // snout
    g.add(mkBox(0.14, 0.16, 0.08, COL(232, 120, 150), -0.16, 1.28, 0.6));
    g.add(mkBox(0.14, 0.16, 0.08, COL(232, 120, 150), 0.16, 1.28, 0.6));
    const tail = mkBox(0.08, 0.25, 0.08, COL(236, 130, 158), 0, 0.95, -0.6); tail.rotation.x = 0.6;
    g.add(tail);
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.26, 0.26]) {
      const leg = mkBox(0.15, 0.5, 0.15, COL(228, 120, 146), sx, 0.25, sz);
      leg.geometry.translate(0, -0.25, 0); leg.position.y = 0.5;
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
  for (let i = 0; i < 10; i++) spawnCritter('chicken', { x0: -36, x1: 36, z0: -28, z1: 30 });
  for (let i = 0; i < 6; i++) spawnCritter('cow', { x0: 50, x1: 92, z0: 18, z1: 58 });
  for (let i = 0; i < 5; i++) spawnCritter('pig', { x0: 60, x1: 84, z0: 34, z1: 56 });
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
    const gy = hAt(c.x, c.z) + 1;
    c.group.position.set(c.x, gy, c.z);
    const sw = Math.sin(t * 9 + c.phase) * (dist > 0.4 ? 0.55 : 0.05) * (c.fright > 0 ? 1.6 : 1);
    for (let i = 0; i < c.parts.legs.length; i++)
      c.parts.legs[i].rotation.x = (i % 2 ? sw : -sw);
    if (c.kind === 'chicken' && c.parts.head && dist < 0.4)
      c.parts.head.rotation.x = Math.sin(t * 5 + c.phase) * 0.5;
  }
}

/* =====================================================================
   SKY TRAFFIC — balloons, blimps, planes, clouds
   ===================================================================== */
const floaters = [];
function addFloater(group, kind, opts) {
  floaters.push({ group, kind, ...opts });
  scene.add(group);
}
function makeBalloon(pal, x, y, z) {
  const g = new THREE.Group();
  const R = 5.5, H = 12;
  for (let dy = 0; dy < H; dy++) {
    const t = dy / H;
    const rad = R * Math.sin(clamp(t / 0.78, 0, 1) * Math.PI * 0.92);
    const ri2 = Math.ceil(rad);
    for (let dx = -ri2; dx <= ri2; dx++)
      for (let dz = -ri2; dz <= ri2; dz++) {
        if (dx * dx + dz * dz > rad * rad + 0.6) continue;
        g.add(mkBox(1, 1, 1, pal[Math.floor((dy / 1.6) + (Math.abs(dx) + Math.abs(dz))) % pal.length], dx, dy - H + 2, dz));
      }
  }
  g.add(mkBox(1.8, 1.4, 1.8, COL(126, 84, 50), 0, -H - 0.6, 0));      // basket
  g.add(mkBox(0.4, 0.5, 0.4, COL(250, 220, 180), 0, -H + 0.2, 0));    // passenger head
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(mkBox(0.12, 1.6, 0.12, COL(60, 50, 44), sx, -H + 0.2, sz)); // ropes
  addFloater(g, 'balloon', { x, y, z, dir: Math.random() < 0.5 ? 1 : -1, bob: rr(0, 6), speed: rr(1.2, 2.4) });
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
  g.add(mkBox(4, 1, 0.4, stripeHex, -7, 0, 0));   // fin vertical
  g.add(mkBox(1, 2, 4, stripeHex, -7, 0, 0));     // fin horiz-ish
  g.add(mkBox(2, 0.8, 1, COL(60, 55, 60), 2, -3, 0)); // gondola
  addFloater(g, 'blimp', { x, y, z, dir: 1, speed: rr(4, 6), bob: rr(0, 6) });
}
function makePlane(bodyHex, stripeHex, radius, y, speed, phase) {
  const g = new THREE.Group();
  g.add(mkBox(6, 1, 1, bodyHex, 0, 0, 0));           // fuselage
  g.add(mkBox(2, 0.8, 1.2, stripeHex, 1.5, 0.9, 0)); // canopy
  g.add(mkBox(1.6, 0.2, 10, stripeHex, 0.5, 0.2, 0)); // wings
  g.add(mkBox(1.4, 0.2, 3, stripeHex, -2.4, 0.9, 0)); // tailplane
  g.add(mkBox(0.6, 1.2, 0.2, stripeHex, -2.6, 0.6, 0)); // fin
  const prop = mkBox(0.2, 3.4, 0.3, COL(40, 40, 46), 3.2, 0, 0);
  g.add(prop);
  g.userData.prop = prop;
  addFloater(g, 'plane', { radius, y, speed, phase, bankDir: speed > 0 ? 1 : -1 });
}
function makeCloud(x, y, z) {
  const g = new THREE.Group();
  const n = ri(5, 9);
  for (let i = 0; i < n; i++) {
    const b = mkBox(rr(3, 7), rr(1.6, 3), rr(3, 6), COL(255, 253, 250), rr(-7, 7), rr(-1, 1.5), rr(-4, 4));
    b.material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
    g.add(b);
  }
  addFloater(g, 'cloud', { x, y, z, dir: 1, speed: rr(0.7, 1.8), drift: true });
}
function initSkyTraffic() {
  makeBalloon([COL(235, 60, 60), COL(250, 250, 250), COL(70, 130, 220), COL(245, 190, 60)], -80, 52, -80);
  makeBalloon([COL(60, 170, 110), COL(250, 235, 160), COL(230, 90, 140), COL(255, 255, 255)], 30, 60, -110);
  makeBalloon([COL(150, 80, 200), COL(255, 170, 60), COL(255, 255, 255), COL(60, 190, 200)], 110, 48, 40);
  makeBalloon([COL(250, 120, 50), COL(50, 60, 120), COL(255, 240, 200), COL(220, 60, 80)], -40, 68, 90);
  makeBalloon([COL(80, 160, 240), COL(255, 255, 255), COL(240, 90, 90), COL(250, 210, 90)], -120, 58, 60);
  makeBlimp(-100, 78, -30, COL(216, 218, 226), COL(190, 50, 50));
  makeBlimp(80, 88, 70, COL(90, 105, 130), COL(240, 220, 120));
  makePlane(COL(235, 240, 245), COL(210, 40, 40), 95, 58, 0.10, 0);
  makePlane(COL(60, 90, 160), COL(240, 230, 120), 120, 70, -0.075, 2.2);
  for (let i = 0; i < 9; i++) makeCloud(rr(-140, 140), rr(95, 125), rr(-140, 140));
}
function updateSkyTraffic(dt, t) {
  for (const f of floaters) {
    if (f.kind === 'balloon') {
      f.x += f.dir * f.speed * dt;
      if (f.x > 150) f.x = -150;
      if (f.x < -150) f.x = 150;
      f.group.position.set(f.x, f.y + Math.sin(t * 0.7 + f.bob) * 1.2, f.z + Math.sin(t * 0.3 + f.bob) * 4);
      f.group.rotation.z = Math.sin(t * 0.8 + f.bob) * 0.05;
    } else if (f.kind === 'blimp') {
      f.x += f.dir * f.speed * dt;
      if (f.x > 160) f.x = -160;
      f.group.position.set(f.x, f.y + Math.sin(t * 0.5 + f.bob) * 1.5, f.z);
      f.group.rotation.y = Math.PI / 2;
    } else if (f.kind === 'plane') {
      f.phase += f.speed * dt;
      const a = f.phase;
      f.group.position.set(Math.cos(a) * f.radius, f.y + Math.sin(a * 2) * 3, Math.sin(a) * f.radius);
      f.group.rotation.y = -a + (f.speed > 0 ? Math.PI : 0);
      f.group.rotation.z = 0.22 * (f.speed > 0 ? 1 : -1);
      if (f.group.userData.prop) f.group.userData.prop.rotation.x += dt * 26;
    } else if (f.kind === 'cloud') {
      f.x += f.speed * dt;
      if (f.x > 170) f.x = -170;
      f.group.position.set(f.x, f.y, f.z);
    }
  }
}

/* =====================================================================
   CONTROLS
   ===================================================================== */
const ctrl = {
  yaw: 0.0, pitch: 0.34, dist: 92,
  tx: 0, ty: 14, tz: 4,
  keys: {}
};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  ctrl.keys[k] = true;
  if (k === 'escape') disarm();
});
window.addEventListener('keyup', e => { ctrl.keys[e.key.toLowerCase()] = false; });

let dragging = false, downX = 0, downY = 0, moved = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  dragging = true; downX = e.clientX; downY = e.clientY; moved = 0;
  if (e.button === 2) disarm();
});
window.addEventListener('pointerup', e => {
  dragging = false;
  if (armed && e.button === 0 && moved < 6) {
    const p = pickGround(e);
    if (p) { fire(armed, p.x, p.z); }
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
  ctrl.dist = clamp(ctrl.dist * (e.deltaY > 0 ? 1.12 : 0.9), 6, 500);
}, { passive: true });

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -12);
function pickGround(e) {
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
  if (Math.abs(p.x) > 126 || Math.abs(p.z) > 126) return null;
  return { x: Math.round(p.x), z: Math.round(p.z) };
}
const marker = new THREE.Mesh(
  new THREE.RingGeometry(4.5, 6, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

function updateCamera(dt) {
  const sp = 46 * dt * (0.5 + ctrl.dist / 80);
  const fx = -Math.sin(ctrl.yaw), fz = -Math.cos(ctrl.yaw);
  const rx = Math.cos(ctrl.yaw), rz = -Math.sin(ctrl.yaw);
  if (ctrl.keys['arrowup']) { ctrl.tx += fx * sp; ctrl.tz += fz * sp; }
  if (ctrl.keys['arrowdown']) { ctrl.tx -= fx * sp; ctrl.tz -= fz * sp; }
  if (ctrl.keys['arrowleft']) { ctrl.tx -= rx * sp; ctrl.tz -= rz * sp; }
  if (ctrl.keys['arrowright']) { ctrl.tx += rx * sp; ctrl.tz += rz * sp; }
  if (ctrl.keys['q']) ctrl.ty += 40 * dt;
  if (ctrl.keys['a']) ctrl.ty -= 40 * dt;
  if (ctrl.keys['z']) ctrl.dist = Math.max(6, ctrl.dist * (1 - 1.2 * dt));
  if (ctrl.keys['x']) ctrl.dist = Math.min(500, ctrl.dist * (1 + 1.2 * dt));
  ctrl.tx = clamp(ctrl.tx, -240, 240);
  ctrl.tz = clamp(ctrl.tz, -240, 240);
  ctrl.ty = clamp(ctrl.ty, 2, 300);
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
    const m = new THREE.Mesh(BOX_GEO, lamMat(hex));
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
  if (meteorObj) { scene.remove(meteorObj); meteorObj = null; }
}

/* ---- helper: batch voxel edits (avoid mutating during iteration) ---- */
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
  voxelsNear(cx, cz, 46, (e, del, set) => {
    if (e.t === 's' || e.t === 'v') {
      if (e.y > hAt(e.x, e.z) + 5 && rnd() < 0.55) del.push([e.x, e.y, e.z]);
      else if (rnd() < 0.12) del.push([e.x, e.y, e.z]);
    } else if (e.t === 't') {
      if (e.y === hAt(e.x, e.z) && rnd() < 0.055) del.push([e.x, e.y, e.z]);   // ground cracks
    }
  });
  for (let i = 0; i < 550; i++) {
    const a = rr(0, Math.PI * 2), r = Math.sqrt(rnd()) * 44;
    const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
    addVoxel(x, hAt(x, z) + 1, z, jitter(rub[Math.floor(rnd() * rub.length)], 12), 's');
  }
  spawnParticles(cx, hAt(cx, cz) + 2, cz, 60, [COL(150, 138, 120), COL(120, 108, 92)], 10, 0.3, 0.9, 1.6);
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
  meteorState = { cx, cz, t: 0, dur: 1.5, sx: cx + 55, sz: cz - 45 };
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
  const py = 170 - (170 - gy) * (k * k * 0.4 + k * 0.6);
  if (meteorObj) meteorObj.position.set(px, py, pz);
  if (Math.random() < 0.9) spawnParticles(px, py, pz, 2, [COL(255, 140, 40), COL(255, 200, 80), COL(90, 80, 76)], 4, 0.25, 0.6, 0.7);
  if (k >= 1) {
    scene.remove(meteorObj); meteorObj = null;
    impactMeteor(s.cx, s.cz);
    meteorState = null;
  }
}
function impactMeteor(cx, cz) {
  shake(2.6, 1.8);
  const hy = hAt(cx, cz);
  const cy = hy + 2;
  const R = 10;
  voxelsNear(cx, cz, R + 3, (e, del, set) => {
    const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz;
    if (dx * dx + dy * dy + dz * dz <= R * R) del.push([e.x, e.y, e.z]);
  });
  // crater floor + rim + scorch
  voxelsNear(cx, cz, 16, (e, del, set) => {
    const d = Math.hypot(e.x - cx, e.z - cz);
    if (e.t === 't' && d < 14) set.push([e.x, e.y, e.z, jitter(COL(56, 44, 36), 8), 't']);
  });
  for (let i = 0; i < 90; i++) {
    const a = rr(0, Math.PI * 2), d = rr(R, R + 3.5);
    const x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
    const hh = hAt(x, z);
    if (rnd() < 0.6) addVoxel(x, hh + 1, z, jitter(COL(96, 88, 80), 14), 's');
  }
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const x = Math.round(cx + Math.cos(a) * 5), z = Math.round(cz + Math.sin(a) * 5);
    addVoxel(x, hAt(x, z) - 2, z, COL(40, 32, 28), 't');
  }
  puff(cx, cy + 4, cz, 3, 18, 0xffb347, 1.4, 6, 0.95);
  puff(cx, cy + 14, cz, 2, 12, 0xff7722, 1.8, 8, 0.8);
  for (let i = 0; i < 5; i++) puff(cx + rr(-4, 4), cy + 10 + i * 3, cz + rr(-4, 4), 2, 9 + i * 2, 0x6f6a66, 2.6 + i * 0.3, 4, 0.65);
  spawnParticles(cx, cy + 3, cz, 140, [COL(80, 66, 52), COL(120, 100, 80), COL(255, 130, 40), COL(60, 50, 44)], 22, 0.35, 1.2, 2.4);
  rebuild();
  msg('Meteor impact recorded — crater formed.');
}

/* ---- TSUNAMI ---- */
let tsunamiWall = null, tsunamiState = null;
function tsunami() {
  scare();
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(290, 18, 26),
    new THREE.MeshLambertMaterial({ color: 0x1f5f8a, transparent: true, opacity: 0.88 }));
  wall.position.y = 11;
  g.add(wall);
  const foam = new THREE.Mesh(new THREE.BoxGeometry(290, 5, 26),
    new THREE.MeshLambertMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.95 }));
  foam.position.set(0, 19, 4);
  g.add(foam);
  scene.add(g);
  tsunamiWall = g;
  tsunamiState = { z: -175, done: false, rebuildT: 0 };
  msg('Tsunami warning — giant wave approaching from the north!');
}
function updateTsunami(dt) {
  const s = tsunamiState;
  if (!s) return;
  s.z += 26 * dt;
  if (tsunamiWall) tsunamiWall.position.set(0, 0, s.z);
  shake(0.5, 0.2);
  // destroy everything the crest sweeps over (soft structures only; land remains)
  const zFrom = Math.max(-OFF, Math.floor(s.z - 26)), zTo = Math.min(OFF - 1, Math.floor(s.z));
  for (let z = zFrom; z <= zTo; z++) {
    for (let x = -OFF; x < OFF; x++) {
      for (let y = 3; y < 24; y++) {
        const e = voxels.get(kkey(x, y, z));
        if (e && (e.t === 's' || e.t === 'v')) voxels.delete(kkey(x, y, z));
      }
    }
  }
  if (s.z % 3 < 1) spawnParticles(rr(-120, 120), rr(6, 18), s.z + 12, 3, [0xffffff, 0xd8f2ff], 6, 0.3, 0.8, 0.8);
  s.rebuildT -= dt;
  if (s.rebuildT <= 0) { rebuild(); s.rebuildT = 0.35; }
  if (s.z > 180 && !s.done) {
    s.done = true;
    scene.remove(tsunamiWall); tsunamiWall = null;
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
  const gy = hAt(cx, cz);
  const cy = gy + 9;
  const R = 34, R2 = R * 2.3;
  // core: everything vaporized; ground scoured to bedrock
  voxelsNear(cx, cz, R, (e, del, set) => {
    const dx = e.x - cx, dy = e.y - cy, dz = e.z - cz;
    if (dx * dx + dy * dy + dz * dz <= R * R) {
      if (e.t !== 't' || e.y > hAt(e.x, e.z) - 3) del.push([e.x, e.y, e.z]);
      else set.push([e.x, e.y, e.z, jitter(COL(70, 66, 60), 8), 't']);
    }
  });
  // scorch + wind zone
  voxelsNear(cx, cz, R2, (e, del, set) => {
    const d = Math.hypot(e.x - cx, e.z - cz);
    if (d > R) {
      if ((e.t === 's' || e.t === 'v') && rnd() < 0.8) del.push([e.x, e.y, e.z]);
      if (e.t === 't' && e.y === hAt(e.x, e.z) && rnd() < 0.4) set.push([e.x, e.y, e.z, jitter(COL(96, 92, 66), 10), 't']);
    }
  });
  // glassy crater lip
  for (let a = 0; a < Math.PI * 2; a += 0.18) {
    const d = R + rr(-1, 2);
    const x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d);
    addVoxel(x, hAt(x, z) + 1, z, rnd() < 0.5 ? COL(180, 200, 190) : COL(120, 130, 122), 's');
  }
  // fireball + mushroom
  puff(cx, cy, cz, 4, 26, 0xfff2b0, 0.9, 4, 1);
  puff(cx, cy + 3, cz, 3, 20, 0xff8c2e, 1.5, 7, 0.9);
  for (let i = 0; i < 6; i++) puff(cx + rr(-5, 5), cy + 14 + i * 5, cz + rr(-5, 5), 3, 12 + i * 2, 0x8d857c, 3 + i * 0.4, 5.5 - i * 0.4, 0.7);
  puff(cx, cy + 44, cz, 6, 30, 0xa9a29a, 4.2, 6.5, 0.8);   // cap
  puff(cx, cy + 20, cz, 3, 8, 0x9b948c, 3.4, 8, 0.75);      // stem
  spawnParticles(cx, cy, cz, 160, [COL(255, 170, 60), COL(255, 220, 120), COL(110, 100, 90), COL(80, 72, 66)], 30, 0.3, 1.1, 2.6);
  rebuild();
  msg('25KT TATP-equivalent airburst at grid (' + cx + ', ' + cz + ').');
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
  // shake decay
  if (shakeT > 0) {
    shakeT -= dt;
    const s = shakeMag * clamp(shakeT / 1.5, 0, 1);
    shakeOff.set(rr(-s, s), rr(-s, s), rr(-s, s));
    if (shakeT <= 0) { shakeMag = 0; shakeOff.set(0, 0, 0); }
  }
  updateCamera(dt);
  updateCritters(dt, t);
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
initSkyTraffic();
rebuild();
msg('Welcome, gardener. The disasters below bite hard — REBUILD restores all.', 6000);
requestAnimationFrame(loop);
