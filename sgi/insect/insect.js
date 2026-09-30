// Insect — Thant Tessman (mid-80s); walker code by David B. Ligon, 1988.
// Geometry comes from the original parts.c coordinate tables (extracted to
// data_tables.json); leg IK ported from dolegs(), gait from move_insect(),
// flat software shading from getpolycolor() against the Eclipse ramps, and a
// matrix-projected halftone shadow. Built in the original Z-up frame, then
// rotated -90° about X for three's Y-up.
import { createRenderer, hud, halftoneTexture, THREE } from '../shared/sgi.js';

const PI = Math.PI, RESF = 30, REACH = 1.6, SIN60 = 0.866025404, COS60 = 0.5, R1 = 0.420994836;

const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(50 / 255, 50 / 255, 150 / 255); // SKYBLUE
const camera = new THREE.PerspectiveCamera(64, 1, 0.01, 131);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Insect', author: 'Thant Tessman / D. Ligon', year: '1986',
  blurb: 'A six-legged walker whose legs are posed by inverse kinematics: hips yaw and pitch toward the walk direction, knees bend with reach, and a projected shadow tracks the bug across a checkered floor.',
  controls: 'move mouse: steer · F: follow · drag: orbit · esc',
});

const T = await (await fetch('data_tables.json')).json();

// ---- software lighting (getpolycolor + Eclipse ramps) ----
const RAMPS = [
  [25, 50, 125, 250, 0, 0],    // 0 body → green
  [50, 100, 125, 250, 0, 0],   // 1 hip
  [75, 150, 125, 250, 0, 0],   // 2 thigh
  [100, 200, 125, 250, 0, 0],  // 3 kneeball
  [125, 250, 125, 250, 0, 0],  // 4 shin → pale yellow-green
];
const lightVec = (phi, theta = PI / 4) => {
  const f = Math.sin(theta);
  return [-Math.cos(phi) * f, -Math.sin(phi) * f, Math.cos(theta)];
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - b[1] * a[2], a[2] * b[0] - b[2] * a[0], a[0] * b[1] - b[1] * a[0]];

function polyColor(pts, rampIdx, light) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  const l = Math.hypot(...n) || 1;
  let c = dot([n[0] / l, n[1] / l, n[2] / l], light);
  c = Math.max(0, Math.min(1, c));
  const [r1, r2, g1, g2, b1, b2] = RAMPS[rampIdx];
  return [(r1 + (r2 - r1) * c) / 255, (g1 + (g2 - g1) * c) / 255, (b1 + (b2 - b1) * c) / 255];
}

// ---- matrix helpers mirroring IRIS GL postmultiplication ----
const rotOn = (m, axis, tenthDeg) => {
  const a = THREE.MathUtils.degToRad(tenthDeg / 10);
  const r = new THREE.Matrix4();
  if (axis === 'x') r.makeRotationX(a); else if (axis === 'y') r.makeRotationY(a); else r.makeRotationZ(a);
  m.multiply(r);
};
const trs = (m, x, y, z) => m.multiply(new THREE.Matrix4().makeTranslation(x, y, z));
const applyM = (m, p) => {
  const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(m);
  return [v.x, v.y, v.z];
};
function newAcc() { return { pos: [], col: [] }; }
function emitFace(acc, m, pts, color) {
  for (let i = 1; i < pts.length - 1; i++) {
    const a = applyM(m, pts[0]), b = applyM(m, pts[i]), c = applyM(m, pts[i + 1]);
    acc.pos.push(...a, ...b, ...c);
    acc.col.push(...color, ...color, ...color);
  }
}
function finalize(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
  return g;
}
const rotTable = (table, tenthDeg, axis) => {
  const m = new THREE.Matrix4();
  rotOn(m, axis, tenthDeg);
  return table.map(p => applyM(m, p));
};

// ---- body: b7/b8 dodecagon caps, b1..b6 rotated 6× about z ----
function buildBody() {
  const acc = newAcc(), L = lightVec(PI / 4), m = new THREE.Matrix4();
  const b7 = [], b8 = [];
  for (let i = 0; i < 12; i++) {
    const a = i * (PI / 6) + PI / 12;
    b7.push([R1 * COS60 * Math.cos(a), R1 * COS60 * Math.sin(a), R1 * SIN60]);
    b8.push([R1 * COS60 * Math.cos(a), R1 * COS60 * Math.sin(a), -R1 * SIN60]);
  }
  emitFace(acc, m, b7, polyColor(b7, 0, L));
  emitFace(acc, m, b8, polyColor(b8, 0, L));
  for (let s = 0; s < 6; s++)
    for (const f of ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']) {
      const world = rotTable(T[f], s * 600, 'z');
      emitFace(acc, m, world, polyColor(world, 0, L));
    }
  return finalize(acc);
}
// ---- hip: h1,h2,h3 duplicated 6× about y (createobjects advances phi per sector)
function buildHip() {
  const acc = newAcc(), m = new THREE.Matrix4();
  for (let s = 0; s < 6; s++) {
    const L = lightVec(PI / 4 + s * PI / 3);
    for (const f of ['h1', 'h2', 'h3']) {
      const world = rotTable(T[f], -s * 600, 'y');
      emitFace(acc, m, world, polyColor(world, 1, L));
    }
  }
  return finalize(acc);
}
function buildThigh() {
  const acc = newAcc(), m = new THREE.Matrix4(), L = lightVec(0);
  for (const f of ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'])
    emitFace(acc, m, T[f], polyColor(T[f], 2, L));
  return finalize(acc);
}
function buildKneeball() {
  const acc = newAcc(), m = new THREE.Matrix4(), L = lightVec(0);
  const A2 = 0.088388348, k2 = [], k3 = [];
  for (let i = 0; i < 6; i++) {
    const a = i * (PI / 3);
    k2.push([A2 * COS60, A2 * Math.cos(a) + 1, A2 * Math.sin(a)]);
    k3.push([-A2 * COS60, A2 * Math.cos((5 - i) * (PI / 3)) + 1, A2 * Math.sin((5 - i) * (PI / 3))]);
  }
  emitFace(acc, m, k2, polyColor(k2, 3, L));
  emitFace(acc, m, k3, polyColor(k3, 3, L));
  let k1 = T.k1.map(p => [...p]);
  for (let s = 0; s < 6; s++) {
    emitFace(acc, m, k1, polyColor(k1, 3, L));
    k1 = k1.map(p => [p[0], p[1] - 1, p[2]]);        // pivot about the ball center
    const r = new THREE.Matrix4(); rotOn(r, 'x', -600);
    const mm = new THREE.Matrix4().makeTranslation(0, 1, 0).multiply(r).multiply(new THREE.Matrix4().makeTranslation(0, -1, 0));
    k1 = k1.map(p => applyM(mm, p));
  }
  return finalize(acc);
}
function buildShin() {
  const acc = newAcc(), m = new THREE.Matrix4();
  for (const f of ['s1', 's2', 's3', 's4', 's5'])
    emitFace(acc, m, T[f], polyColor(T[f], 4, lightVec(0)));
  return finalize(acc);
}

// ---- ground: the checkered screen (z=0 in insect frame) ----
function buildGround() {
  const acc = newAcc(), m = new THREE.Matrix4();
  const col = [128 / 255, 200 / 255, 250 / 255];
  let k = 1;
  for (let i = -8; i < 7; i++)
    for (let j = -8; j < 7; j++) {
      k = 1 - k;
      if (k === 0)
        emitFace(acc, m, [[i * 3, j * 3, 0], [(i + 1) * 3, j * 3, 0], [(i + 1) * 3, (j + 1) * 3, 0], [i * 3, (j + 1) * 3, 0]], col);
    }
  const g = finalize(acc);
  g.rotateX(Math.PI / 2); // insect z=0 plane → three's XZ plane
  return g;
}
const ground = new THREE.Mesh(buildGround(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
scene.add(ground);

// ---- insect world frame (z-up), flipped for three ----
const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;
scene.add(world);

// shadow root: projection p → (x+z, y+z, 0) along the 45° light, in insect space
const shadowRoot = new THREE.Group();
shadowRoot.matrixAutoUpdate = false;
shadowRoot.matrix.set(1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1);
shadowRoot.matrixWorldNeedsUpdate = true;
world.add(shadowRoot);

const geos = { body: buildBody(), hip: buildHip(), thigh: buildThigh(), knee: buildKneeball(), shin: buildShin() };
const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, map: halftoneTexture(), transparent: true, opacity: 0.5,
  side: THREE.DoubleSide, depthWrite: false,
});

const bodyMesh = new THREE.Mesh(geos.body, bodyMat);
world.add(bodyMesh);
shadowRoot.add(new THREE.Mesh(geos.body, shadowMat));

// per-leg rigs mirroring draw_fore: hip → (hipPhi z, hipTheta x) → thigh, knee → +y, knee x → shin
const rigs = [];
for (let leg = 0; leg < 6; leg++) {
  const root = new THREE.Group();
  const hip = new THREE.Group(); hip.position.set(0, 0.5, 0);
  const joint = new THREE.Group(); joint.rotation.order = 'YZX';
  const shinHolder = new THREE.Group(); shinHolder.position.set(0, 1, 0);
  root.add(hip); hip.add(joint); joint.add(shinHolder);
  hip.add(new THREE.Mesh(geos.hip, bodyMat));
  joint.add(new THREE.Mesh(geos.thigh, bodyMat));
  joint.add(new THREE.Mesh(geos.knee, bodyMat));
  shinHolder.add(new THREE.Mesh(geos.shin, bodyMat));
  world.add(root);

  const sroot = new THREE.Group();
  const ship = new THREE.Group(); ship.position.set(0, 0.5, 0);
  const sjoint = new THREE.Group(); sjoint.rotation.order = 'YZX';
  const sshin = new THREE.Group(); sshin.position.set(0, 1, 0);
  sroot.add(ship); ship.add(sjoint); sjoint.add(sshin);
  ship.add(new THREE.Mesh(geos.hip, shadowMat));
  sjoint.add(new THREE.Mesh(geos.thigh, shadowMat));
  sjoint.add(new THREE.Mesh(geos.knee, shadowMat));
  sshin.add(new THREE.Mesh(geos.shin, shadowMat));
  shadowRoot.add(sroot);
  rigs.push({ leg, root, joint, shinHolder, sroot, sjoint, sshin });
}

// ---- walk engine (move_insect + dolegs, verbatim math) ----
const st = {
  legx: [], legy: [], legup: [false, true, false, true, false, true],
  knee: [0, 0, 0, 0, 0, 0], hipPhi: [0, 0, 0, 0, 0, 0], hipTheta: [0, 0, 0, 0, 0, 0],
  dmr: [0, 0, 0, 0, 0, 0], fr: [0, 0, 0, 0, 0, 0],
  px: 0, py: 0, mx: 0, my: 0, cphi: 0, follow: false,
};
for (let i = 0; i < 6; i++) { st.legx[i] = RESF / 2 + i; st.legy[i] = RESF / 2 + i; }
const l05 = (i) => ((i % 6) + 6) % 6;
const sgn = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

function moveInsect() {
  const s = Math.sin(st.cphi * Math.PI / 1800), c = Math.cos(st.cphi * Math.PI / 1800);
  const MMX = st.mx * c + st.my * s, MMY = -st.mx * s + st.my * c;
  if (st.follow) { st.px -= MMX / RESF; st.py -= MMY / RESF; }
  const dr = Math.hypot(MMX, MMY) || 1e-6;
  const ux = MMX / dr, uy = MMY / dr;
  for (let i = 0; i < 6; i++) {
    let lx = (st.legx[i] - RESF / 2) / (RESF / 2), ly = (st.legy[i] - RESF / 2) / (RESF / 2);
    const dmx = ux - lx, dmy = uy - ly;
    st.dmr[i] = Math.hypot(dmx, dmy) || 1e-6;
    if (st.legup[i]) {
      st.legx[i] += 3 * dr * dmx / st.dmr[i];
      st.legy[i] += 3 * dr * dmy / st.dmr[i];
      if (st.dmr[i] < 0.15) st.legup[i] = false;
    } else {
      st.legx[i] -= MMX * 4; st.legy[i] -= MMY * 4;
      if (!st.legup[l05(i - 1)] && !st.legup[l05(i + 1)] &&
        st.dmr[i] > REACH && (lx * ux + ly * uy) < 0) {
        st.legup[i] = true; st.fr[i] = st.dmr[i];
      }
    }
  }
}
function doLegs() {
  for (let leg = 0; leg < 6; leg++) {
    let gx = st.legx[leg] - RESF / 2, gy = st.legy[leg] - RESF / 2;
    const off = [[0, 1], [0.8660254, 0.5], [0.8660254, -0.5], [0, -1], [-0.8660254, -0.5], [-0.8660254, 0.5]][leg];
    gx += off[0] * RESF; gy += off[1] * RESF;
    const r = Math.hypot(gx, gy) / RESF;
    const l = Math.hypot(1, r);
    const k = Math.acos(Math.max(-1, Math.min(1, (5 - l * l) / 4)));
    st.knee[leg] = k * 1800 / PI;
    let t = Math.min(1, 2 * Math.sin(k) / l);
    let a = Math.asin(t);
    if (l < 1.7320508) a = PI - a;
    st.hipTheta[leg] = (a - Math.atan2(1, r)) * 1800 / PI;
    st.hipPhi[leg] = (gx === 0 ? 900 * sgn(gy) : Math.atan2(gy, gx) * 1800 / PI) + (-900 + 600 * leg);
    if (st.legup[leg])
      st.hipTheta[leg] += 200 * ((st.fr[leg] / 2) - Math.abs(st.dmr[leg] - st.fr[leg] / 2));
  }
}

// ---- input ----
let userMouse = -1e9;
window.addEventListener('pointermove', (e) => {
  if (dragging) return;
  st.mx = (e.clientX / innerWidth) * 2 - 1;
  st.my = (e.clientY / innerHeight) * 2 - 1;
  userMouse = performance.now();
});
let dragging = false, dlx = 0, dly = 0;
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; dlx = e.clientX; dly = e.clientY; });
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  camPhi += (e.clientX - dlx) * 10;
  camTheta = Math.max(-1000, Math.min(-250, camTheta + (e.clientY - dly) * 6));
  dlx = e.clientX; dly = e.clientY;
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') location.href = '../';
  if (e.key.toLowerCase() === 'f') st.follow = !st.follow;
});

let camTheta = -420, camPhi = 0;
let idleT = Math.random() * 10;
renderer.setAnimationLoop(() => {
  if (performance.now() - userMouse > 5000) {
    idleT += 0.010;
    st.mx = 0.45 * Math.cos(idleT);
    st.my = 0.45 * Math.sin(idleT);
    st.follow = true;
  }
  moveInsect();
  doLegs();
  const d = THREE.MathUtils.degToRad;
  for (const r of rigs) {
    r.root.rotation.z = d(-r.leg * 60);
    r.joint.rotation.set(0, d(st.hipPhi[r.leg] / 10), d(st.hipTheta[r.leg] / 10));
    r.shinHolder.rotation.x = d(st.knee[r.leg] / 10);
    r.sroot.rotation.copy(r.root.rotation);
    r.sjoint.rotation.copy(r.joint.rotation);
    r.sshin.rotation.copy(r.shinHolder.rotation);
  }
  // insect frame: body floats at z=1 above the floor; walk displacement px,py
  world.position.set(st.px * 8, 1, -st.py * 8);
  const th = d(camTheta / 10), ph = d(camPhi / 10);
  const dist = 14;
  camera.position.set(-Math.sin(ph) * Math.cos(th) * dist, -Math.sin(th) * dist, Math.cos(ph) * Math.cos(th) * dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(world.position.x, 0.8, world.position.z);
  renderer.render(scene, camera);
});
