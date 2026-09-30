// Newave — SGI, late 1980s. A wave surface on a diamond-oriented grid,
// spring-coupled propagation (exact stencil from getforce/getvelocity/
// getposition), depth-cued through the classic ramp: index = 191*dot+832
// over a blue→sea-green→white spectrum. The wave starts flat; poke and go.
import { createRenderer, hud, toast, pupMenu, THREE } from '../shared/sgi.js';

const NRAMPB = 832, NRAMPE = 1023;
let grid = 17;
let dt = 0.004;               // speed menu: weak .001 / medium .004 / strong .008
let posit, veloc, force;

const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0);
const camera = new THREE.PerspectiveCamera(64, 1, 1, 40);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
const toastEl = hud({
  title: 'Newave', author: 'Unattributed (SGI)', year: '1988',
  blurb: 'A wave on a grid under a fixed light, depth-cued through the colormap. Right-click to edit, pull a point up, then go.',
  controls: 'MMB drag: spin · wheel: depth · RMB: menu · esc',
});
const menuHost = document.createElement('div');
document.body.appendChild(menuHost);

// the group holds a Z-up world flipped into three's Y-up (like the IRIS camera chain)
const world = new THREE.Group();
world.rotation.x = Math.PI / 2;
scene.add(world);

function alloc() {
  posit = [...Array(grid)].map(() => new Float64Array(grid));
  veloc = [...Array(grid)].map(() => new Float64Array(grid));
  force = [...Array(grid)].map(() => new Float64Array(grid));
}
alloc();

// colormap from makerange(): [832..998] r 0→200 g 0→50 b 30→255, then white cap
function rampColor(c) {
  const idx = Math.max(NRAMPB, Math.min(NRAMPE, Math.round((NRAMPE - NRAMPB) * c + NRAMPB)));
  let r, g, b;
  if (idx <= NRAMPE - 25) {
    const t = (idx - NRAMPB) / (NRAMPE - 25 - NRAMPB);
    r = 200 * t; g = 50 * t; b = 30 + 225 * t;
  } else {
    const t = (idx - (NRAMPB + 166)) / 24;
    r = 200 + 55 * t; g = 50 + 205 * t; b = 255;
  }
  return [r / 255, g / 255, b / 255];
}

// light from getlightvector with phi=theta=PI/4 (Z-up space)
const theta = Math.PI / 4, phi = Math.PI / 4;
const light = [
  -Math.cos(phi) * Math.sin(theta),
  -Math.sin(phi) * Math.sin(theta),
  Math.cos(theta),
];

let dmode = 'normal', editing = false, running = true;
let sphi = 0, stheta = 450, sdepth = (5 / 4) * grid;

const surface = new THREE.Mesh(new THREE.BufferGeometry(),
  new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, wireframe: true, color: 0x00ffff }));
world.add(surface);

function gridToWorld(i, j, h) {
  // original view transform: scale z*200 inside the grid space
  const c = (grid + 1) / 2 - 1;
  return [(i - c), (j - c), h * 200];
}

function rebuildSurface() {
  const idxHalf = (grid + 1) >> 1;
  const cells = [];
  const inDiamond = (i, j) =>
    (i < idxHalf && j < idxHalf) || (i >= idxHalf && j >= idxHalf) ||
    (i >= idxHalf && j >= i - idxHalf + 1 && j < idxHalf) ||
    (i < idxHalf && j >= idxHalf && j < i + idxHalf);
  for (let j = 1; j < grid; j++)
    for (let i = 1; i < grid; i++) {
      if (inDiamond(i, j)) cells.push([i, j]);
      if (inDiamond(i - 1, j) && inDiamond(i, j - 1) && inDiamond(i - 1, j - 1)) cells.push([i, j]);
    }
  const seen = new Set(), tris = [];
  for (const [i, j] of cells) {
    for (const tri of [[[i, j], [i, j - 1], [i - 1, j]], [[i - 1, j], [i, j - 1], [i - 1, j - 1]]]) {
      const key = tri.map(p => p.join(',')).sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      tris.push(tri);
    }
  }
  tris.length; // keep grid tidy
  const pos = [], col = [];
  // per-vertex shade from do_vertvec accumulation + dot with light
  const vv = [...Array(grid)].map(() => [...Array(grid)].map(() => [0, 0, 0]));
  const addVV = (i, j, dz, dx, dy) => { if (vv[i] && vv[i][j]) { vv[i][j][2] += dz; vv[i][j][0] += dx; vv[i][j][1] += dy; } };
  for (let i = 1; i < grid; i++)
    for (let j = 1; j < grid; j++) {
      let d = posit[i][j] - posit[i][j - 1];
      addVV(i, j, 1 / 200, d * 0.2558819, d * -0.965926); addVV(i, j - 1, 1 / 200, d * 0.2558819, d * -0.965926);
      d = posit[i][j] - posit[i - 1][j];
      addVV(i, j, 1 / 200, d * -0.9659258, d * 0.258819); addVV(i - 1, j, 1 / 200, d * -0.9659258, d * 0.258819);
      d = posit[i][j] - posit[i - 1][j - 1];
      addVV(i, j, 1 / 200, d * -0.70710678, d * -0.70710678); addVV(i - 1, j - 1, 1 / 200, d * -0.70710678, d * -0.70710678);
    }
  for (const tri of tris) {
    for (const [i, j] of tri) {
      const p = gridToWorld(i, j, posit[i][j]);
      pos.push(...p);
      const v = vv[i][j];
      const r = Math.hypot(...v) || 1;
      const c = (v[0] * light[0] + v[1] * light[1] + v[2] * light[2]) / r;
      const [rr, gg, bb] = dmode === 'normal' ? [0, 1, 1] : rampColor(Math.max(0, c));
      col.push(rr, gg, bb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  surface.geometry.dispose();
  surface.geometry = g;
  surface.material.wireframe = dmode === 'normal';
  surface.material.color.set(dmode === 'normal' ? 0x00ffff : 0xffffff);
}

// ---- simulation: exact stencil, applied across the diamond ----
let go = false;
function step() {
  if (!go || editing) return;
  for (let i = 1; i < grid - 1; i++)
    for (let j = 1; j < grid - 1; j++) {
      force[i][j] = 0;
      let d;
      d = posit[i][j] - posit[i][j - 1]; force[i][j] -= d; force[i][j - 1] += d;
      d = posit[i][j] - posit[i - 1][j]; force[i][j] -= d; force[i - 1][j] += d;
      d = posit[i][j] - posit[i - 1][j - 1]; force[i][j] -= d; force[i - 1][j - 1] += d;
    }
  for (let i = 1; i < grid - 1; i++)
    for (let j = 1; j < grid - 1; j++) veloc[i][j] += force[i][j] * dt;
  for (let i = 1; i < grid - 1; i++)
    for (let j = 1; j < grid - 1; j++) posit[i][j] += veloc[i][j];
}

// ---- input ----
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
let midDown = false, lx = 0, ly = 0;
window.addEventListener('pointerdown', e => {
  if (e.button === 1) { midDown = true; lx = e.clientX; ly = e.clientY; e.preventDefault(); }
  else if (e.button === 0 && editing) poke(e);
  else if (e.button === 2) {
    pupMenu(menuHost, ['WAVE', 'edit', 'go', 'reverse', 'display menu', 'speed', 'grid size', 'reset'], e.clientX, e.clientY).then(async (i) => {
      if (i === 1) { editing = !editing; toast(toastEl, editing ? 'edit: click to move points' : 'edit off'); }
      else if (i === 2) { go = true; toast(toastEl, 'go'); }
      else if (i === 3) { for (let a = 1; a < grid - 1; a++) for (let b = 1; b < grid - 1; b++) veloc[a][b] = -veloc[a][b]; }
      else if (i === 4) {
        const k = await pupMenu(menuHost, ['Display Type', 'normal', 'depthcued', 'gouraud shaded'], e.clientX, e.clientY);
        dmode = ['normal', 'normal', 'depthcued', 'gouraud'][k || 1];
        toast(toastEl, `display: ${dmode}`);
      }
      else if (i === 5) {
        const k = await pupMenu(menuHost, ['Speed', 'weak', 'medium', 'strong'], e.clientX, e.clientY);
        dt = [0.004, 0.001, 0.004, 0.008][k || 0];
      }
      else if (i === 6) {
        const k = await pupMenu(menuHost, ['Grid Size', 'small (13)', 'medium (17)', 'large (21)'], e.clientX, e.clientY);
        if (k) { grid = [13, 17, 21][k - 1]; alloc(); sdepth = (5 / 4) * grid; }
      }
      else if (i === 7) { alloc(); toast(toastEl, 'reset — wave is flat'); }
    });
  }
});
window.addEventListener('pointermove', e => {
  if (!midDown) return;
  sphi += (e.clientX - lx); stheta += (ly - e.clientY);
  lx = e.clientX; ly = e.clientY;
});
window.addEventListener('pointerup', e => { if (e.button === 1) midDown = false; });
renderer.domElement.addEventListener('wheel', e => { sdepth = Math.max(1, sdepth + e.deltaY * 0.01); });

function poke(e) {
  // approximate the original's screen→grid mapping: pick nearest point to ray
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const c = (grid + 1) / 2 - 1;
  const i = Math.round(hit.x + c), j = Math.round(-hit.z + c);
  if (i < 1 || j < 1 || i >= grid - 1 || j >= grid - 1) return;
  posit[i][j] = 0.06 * (1 - 2 * (e.clientY / innerHeight));
  toast(toastEl, `point (${i},${j}) = ${posit[i][j].toFixed(3)} — right-click → go`, 900);
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') location.href = '../';
  if (e.key === 'ArrowUp') sdepth = Math.max(1, sdepth - 0.1);
  if (e.key === 'ArrowDown') sdepth += 0.1;
});

// attract: poke the middle, let it go — like firing up the real thing
setTimeout(() => {
  const m = (grid + 1) >> 1;
  posit[m][m] = 0.10;
  posit[m + 1][m] = 0.05; posit[m - 1][m] = 0.05; posit[m][m + 1] = 0.05; posit[m][m - 1] = 0.05;
  go = true;
}, 400);

renderer.setAnimationLoop(() => {
  step();
  rebuildSurface();
  const th = THREE.MathUtils.degToRad(stheta), ph = THREE.MathUtils.degToRad(sphi);
  camera.position.set(
    Math.sin(ph) * Math.sin(th) * sdepth,
    Math.cos(th) * sdepth,
    Math.cos(ph) * Math.sin(th) * sdepth);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
});
