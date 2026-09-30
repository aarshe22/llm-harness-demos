// Arena — Rob Mace, SGI, 1988. "A future sport": first-person mech combat
// in a maze, flat-shaded colour-index style walls, enemy mechs that patrol
// the corridors, tracers and explosions. (The original maze layout is wall-
// art ASCII in maze.c; regenerated here with a fixed seed, same dimensions.)
import { createRenderer, hud, toast, THREE } from '../shared/sgi.js';

const renderer = createRenderer(document.getElementById('gl') && document.body);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101028);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
const toastEl = hud({
  title: 'Arena', author: 'Rob Mace', year: '1988',
  blurb: 'Simulates a future sport: your mech versus theirs in a colour-index maze. Track the mouse to turn, click to fire. The original supported network play over Ethernet.',
  controls: 'drag: look · W/S: fwd/back · A/D: strafe · click: fire · esc',
});

// ---------- maze ----------
const MSIZ = 16, CELL = 6, WALLH = 3.2;
let seed = 19880;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const walls = []; // walls[r][c] = {n,e,s,w} true=solid
for (let r = 0; r < MSIZ; r++) {
  walls.push([]);
  for (let c = 0; c < MSIZ; c++) walls[r].push({ n: true, e: true, s: true, w: true, vis: false });
}
// recursive backtracker with fixed seed
{
  const stack = [[0, 0]];
  walls[0][0].vis = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const dirs = [[0, 1, 'e', 'w'], [0, -1, 'w', 'e'], [1, 0, 's', 'n'], [-1, 0, 'n', 's']]
      .filter(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        return nr >= 0 && nr < MSIZ && nc >= 0 && nc < MSIZ && !walls[nr][nc].vis;
      });
    if (!dirs.length) { stack.pop(); continue; }
    const [dr, dc, a, b] = dirs[Math.floor(rnd() * dirs.length)];
    walls[r][c][a] = false;
    walls[r + dr][c + dc][b] = false;
    walls[r + dr][c + dc].vis = true;
    stack.push([r + dr, c + dc]);
  }
}
// colour-index style flat wall colors: each direction gets its own tint
const wallMats = {
  n: new THREE.MeshLambertMaterial({ color: 0x7a4fd0 }),
  s: new THREE.MeshLambertMaterial({ color: 0x3f9b4f }),
  e: new THREE.MeshLambertMaterial({ color: 0xb5762f }),
  w: new THREE.MeshLambertMaterial({ color: 0x2f6fb5 }),
};
scene.add(new THREE.AmbientLight(0xb0b8d0, 1.4));
const dl = new THREE.DirectionalLight(0xffffff, 0.7);
dl.position.set(0.3, 1, 0.2);
scene.add(dl);

const world = new THREE.Group();
scene.add(world);
const g2w = (v) => (v - MSIZ / 2) * CELL;

for (let r = 0; r < MSIZ; r++)
  for (let c = 0; c < MSIZ; c++) {
    const cell = walls[r][c];
    const add = (matKey, x, z, sx, sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, WALLH, sz), wallMats[matKey]);
      m.position.set(x, WALLH / 2, z);
      world.add(m);
    };
    if (cell.n) add('n', g2w(c) + CELL / 2, g2w(r) - CELL / 2 + 0.15, CELL, 0.3);
    if (cell.w) add('w', g2w(c) - CELL / 2 + 0.15, g2w(r) + CELL / 2, 0.3, CELL);
    if (r === MSIZ - 1 && cell.s) add('s', g2w(c) + CELL / 2, g2w(r + 1) + 0.15 - CELL / 2 + CELL, CELL, 0.3);
    if (c === MSIZ - 1 && cell.e) add('e', g2w(c + 1) + 0.15 - CELL / 2 + CELL, g2w(r) + CELL / 2, 0.3, CELL);
  }
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MSIZ * CELL * 2, MSIZ * CELL * 2),
    new THREE.MeshLambertMaterial({ color: 0x30343f }));
  floor.rotation.x = -Math.PI / 2;
  world.add(floor);
}

// ---------- player ----------
const player = { r: 0.5, c: 0.5, yaw: 0, pitch: 0, pos: new THREE.Vector3(g2w(0.5 + MSIZ / 2), 1.6, g2w(0.5 + MSIZ / 2)) };
player.pos.set(0 - (MSIZ * 0) , 1.6, 0);
const cam = { x: g2w(0.5), z: g2w(0.5), yaw: Math.PI, pitch: 0 };

let shield = 100, score = 0, frags = 0;
const hudCv = document.createElement('canvas');
hudCv.width = 512; hudCv.height = 128;
Object.assign(hudCv.style, { position: 'fixed', left: '50%', bottom: '10px', transform: 'translateX(-50%)', width: '520px', pointerEvents: 'none' });
document.body.appendChild(hudCv);
const hg = hudCv.getContext('2d');

// ---------- enemy mechs ----------
function makeMech(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.1), m);
  torso.position.y = 2.0;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xd0d0e0 }));
  head.position.y = 2.95;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), m); legL.position.set(-0.5, 0.7, 0);
  const legR = legL.clone(); legR.position.x = 0.5;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x222228 }));
  gun.position.set(1.0, 2.2, -0.6);
  g.add(torso, head, legL, legR, gun);
  return g;
}
const mechs = [];
for (let i = 0; i < 5; i++) {
  const mesh = makeMech([0xe04040, 0xe0a030, 0x40c060, 0x4080e0, 0xc050c0][i]);
  const cellR = 2 + Math.floor(rnd() * (MSIZ - 4)), cellC = 2 + Math.floor(rnd() * (MSIZ - 4));
  mesh.position.set(g2w(cellC + 0.5), 0, g2w(cellR + 0.5));
  world.add(mesh);
  mechs.push({ mesh, r: cellR + 0.5, c: cellC + 0.5, tr: cellR + 0.5, tc: cellC + 0.5, cool: rnd() * 3, fire: 0 });
}

// ---------- tracers & explosions ----------
const tracers = [], booms = [];
function tracer(a, b, col) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col }));
  scene.add(l);
  tracers.push({ l, t: 0.12 });
}
function boom(pos, col) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true }));
  m.position.copy(pos);
  scene.add(m);
  booms.push({ m, t: 0 });
}

// ---------- input ----------
const kd = {};
window.addEventListener('keydown', e => { kd[e.key.toLowerCase()] = true; if (e.key === 'Escape') location.href = '../'; });
window.addEventListener('keyup', e => { kd[e.key.toLowerCase()] = false; });
let looking = false, lx = 0, ly = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button === 0) {
    if (!e.shiftKey) { looking = true; lx = e.clientX; ly = e.clientY; }
    fire();
  }
});
window.addEventListener('pointerup', () => looking = false);
window.addEventListener('pointermove', e => {
  if (!looking) return;
  cam.yaw -= (e.clientX - lx) * 0.005;
  cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch - (e.clientY - ly) * 0.003));
  lx = e.clientX; ly = e.clientY;
});

const ray = new THREE.Raycaster();
function fire() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(cam.pitch, cam.yaw, 0, 'YXZ'));
  ray.set(camera.position, dir);
  let hit = null, best = 1e9;
  for (const m of mechs) {
    if (!m.mesh.visible) continue;
    const box = new THREE.Box3().setFromObject(m.mesh);
    const p = new THREE.Vector3();
    if (ray.ray.intersectBox(box, p)) {
      const d = p.distanceTo(camera.position);
      if (d < best) { best = d; hit = m; }
    }
  }
  const end = camera.position.clone().addScaledVector(dir, hit ? best : 60);
  tracer(camera.position.clone().addScaledVector(dir, 0.5).setY(1.3), end, 0xffff60);
  if (hit) {
    boom(hit.mesh.position.clone().setY(2), 0xff8020);
    hit.mesh.visible = false;
    frags++; score += 100;
    setTimeout(() => {           // respawn somewhere far
      hit.mesh.visible = true;
      const r = 1 + Math.floor(rnd() * (MSIZ - 2)), c = 1 + Math.floor(rnd() * (MSIZ - 2));
      hit.r = hit.tr = r + 0.5; hit.c = hit.tc = c + 0.5;
    }, 2500);
  }
}

// ---------- wall-aware movement ----------
function cellAt(x, z) {
  const c = Math.floor(x / CELL + MSIZ / 2), r = Math.floor(z / CELL + MSIZ / 2);
  return [Math.max(0, Math.min(MSIZ - 1, r)), Math.max(0, Math.min(MSIZ - 1, c))];
}
function canMove(x, z) {
  const [r, c] = cellAt(x, z);
  const cell = walls[r][c];
  const fx = x / CELL + MSIZ / 2 - c, fz = z / CELL + MSIZ / 2 - r;
  if (fx < 0.22 && cell.w) return false;
  if (fx > 0.78 && cell.e) return false;
  if (fz < 0.22 && cell.n) return false;
  if (fz > 0.78 && cell.s) return false;
  return true;
}

// mech pathing: BFS to a random target cell, step through centers
function bfs(cr, cc, tr, tc) {
  const prev = new Map();
  const q = [[cr, cc]];
  prev.set(cr * MSIZ + cc, -1);
  while (q.length) {
    const [r, c] = q.shift();
    if (r === tr && c === tc) break;
    for (const [dr, dc, a] of [[0, 1, 'e'], [0, -1, 'w'], [1, 0, 's'], [-1, 0, 'n']]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= MSIZ || nc >= MSIZ || prev.has(nr * MSIZ + nc)) continue;
      if (walls[r][c][a]) continue;
      prev.set(nr * MSIZ + nc, r * MSIZ + c);
      q.push([nr, nc]);
    }
  }
  const path = [];
  let cur = tr * MSIZ + tc;
  if (!prev.has(cur)) return path;
  while (cur !== -1) { path.push([Math.floor(cur / MSIZ), cur % MSIZ]); cur = prev.get(cur); }
  return path.reverse();
}

// ---------- loop ----------
let lastT = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // player motion
  const sp = 7 * dt;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  let nx = cam.x, nz = cam.z;
  if (kd['w']) { nx += fx * sp; nz += fz * sp; }
  if (kd['s']) { nx -= fx * sp; nz -= fz * sp; }
  if (kd['a']) { nx += fz * sp; nz -= fx * sp; }
  if (kd['d']) { nx -= fz * sp; nz += fx * sp; }
  if (canMove(nx, cam.z)) cam.x = nx;
  if (canMove(cam.x, nz)) cam.z = nz;
  camera.position.set(cam.x, 1.6, cam.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(cam.pitch, cam.yaw, 0);

  // mechs wander + shoot back
  for (const m of mechs) {
    if (!m.mesh.visible) continue;
    m.cool -= dt;
    if (m.cool <= 0) {
      m.cool = 1 + rnd() * 2;
      m.tr = 0.5 + Math.floor(rnd() * MSIZ);
      m.tc = 0.5 + Math.floor(rnd() * MSIZ);
      m.path = bfs(Math.floor(m.r), Math.floor(m.c), Math.floor(m.tr), Math.floor(m.tc)).slice(1);
      m.pi = 0;
    }
    if (m.path && m.pi < m.path.length) {
      const [tr, tc] = m.path[m.pi];
      const tx = g2w(tc + 0.5), tz = g2w(tr + 0.5);
      const dx = tx - m.mesh.position.x, dz = tz - m.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) m.pi++;
      else {
        m.mesh.position.x += dx / d * 1.6 * dt;
        m.mesh.position.z += dz / d * 1.6 * dt;
        m.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    m.fire -= dt;
    if (m.fire <= 0) {
      m.fire = 2.5 + rnd() * 4;
      const mp = m.mesh.position.clone().setY(2.2);
      const toP = camera.position.clone().sub(mp);
      if (toP.length() < 26) {
        tracer(mp, camera.position.clone().add(new THREE.Vector3((rnd() - .5) * 1.5, (rnd() - .5) * 1.5, (rnd() - .5) * 1.5)), 0xff4030);
        if (rnd() < 0.35) shield = Math.max(0, shield - 5 - rnd() * 10);
      }
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt;
    if (tracers[i].t <= 0) { scene.remove(tracers[i].l); tracers.splice(i, 1); }
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    b.t += dt;
    b.m.scale.setScalar(1 + b.t * 8);
    b.m.material.opacity = Math.max(0, 1 - b.t / 0.6);
    if (b.t > 0.6) { scene.remove(b.m); booms.splice(i, 1); }
  }
  if (shield <= 0) { toast(toastEl, 'your mech is destroyed — respawning'); shield = 100; frags = Math.max(0, frags - 1); }

  // HUD: crosshair + status, IRIS GL meters style
  hg.clearRect(0, 0, 512, 128);
  hg.strokeStyle = '#7fe07f'; hg.fillStyle = '#7fe07f';
  hg.font = '18px ui-monospace, monospace';
  hg.fillText(`SHIELD`, 20, 30);
  hg.fillRect(110, 16, shield * 1.5, 14);
  hg.strokeRect(110, 16, 150, 14);
  hg.fillText(`MECHS DESTROYED: ${frags}`, 20, 62);
  hg.fillText(`SCORE: ${score}`, 20, 90);
  hg.strokeStyle = '#ffe070';
  hg.beginPath(); hg.moveTo(256 - 8, 110); hg.lineTo(256 + 8, 110); hg.moveTo(256, 102); hg.lineTo(256, 118); hg.stroke();
  renderer.render(scene, camera);
});
