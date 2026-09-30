// Gview — IRIS GL viewer for GFO radiosity models: the Barcelona Pavilion
// (Mies van der Rohe, 1929), 2,676 Gouraud polygons whose per-vertex colours
// already encode the radiosity solution. Barcelona.gfo is the original data.
import { createRenderer, hud, toast, THREE } from '../shared/sgi.js';

const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8090a8);
const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 60);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
const toastEl = hud({
  title: 'Gview: Barcelona Pavilion', author: 'Unattributed (SGI)', year: '1988',
  blurb: 'Radiosity model viewer: Mies van der Rohe\u2019s 1929 German Pavilion. 2,676 Gouraud polygons with precomputed global illumination baked into vertex colours \u2014 no lighting needed.',
  controls: 'mouse: look \u00b7 LMB fly fwd \u00b7 MMB back \u00b7 W/Q speed \u00b7 A/S zoom \u00b7 space: orbit/fly \u00b7 esc',
});

const toColor = (c) => [(c & 0xff) / 255, ((c >> 8) & 0xff) / 255, ((c >> 16) & 0xff) / 255];

const text = await (await fetch('data/Barcelona.gfo')).text();
const v3 = [], cpacks = [];
for (const line of text.split('\n')) {
  const p = line.trim();
  let m;
  if ((m = p.match(/^v3f\s*{\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*}/)))
    v3.push([+m[1], +m[2], +m[3]]);
  else if ((m = p.match(/^cpack\s*{\s*(0x[0-9a-fA-F]+|\d+)\s*}/)))
    cpacks.push(parseInt(m[1], 0));
}

const pos = [], col = [];
for (const line of text.split('\n')) {
  const p = line.trim();
  if (!p.startsWith('polygon')) continue;
  const refs = [...p.matchAll(/cpack\[(\d+)\]\s+v3f\[(\d+)\]/g)].map(x => [+x[1], +x[2]]);
  for (let i = 1; i < refs.length - 1; i++)
    for (const k of [0, i, i + 1]) {
      const [ci, vi] = refs[k];
      pos.push(...v3[vi]);
      col.push(...toColor(cpacks[ci]));
    }
}

const g = new THREE.BufferGeometry();
// centre + normalise to radius ~2.4 like compute_initial_view
let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
for (const v of v3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
const ctr = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
const s = 4.0 / span;
for (let i = 0; i < pos.length; i += 3) {
  pos[i] = (pos[i] - ctr[0]) * s;
  pos[i + 1] = (pos[i + 1] - ctr[1]) * s;
  pos[i + 2] = (pos[i + 2] - ctr[2]) * s;
}
g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
const model = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
scene.add(model);

// GFO is Z-up; flip the model to three's Y-up.
model.rotation.x = -Math.PI / 2;

let mode = 'fly';
const fly = { yaw: 0, pitch: 0, speed: 0, mx: 0.5, my: 0.5, left: false, mid: false };
let orbitYaw = 0, orbitPitch = 0.35, orbitDist = 6;
window.addEventListener('pointermove', e => { fly.mx = e.clientX / innerWidth; fly.my = e.clientY / innerHeight; });
window.addEventListener('pointerdown', e => {
  if (e.button === 0) fly.left = true;
  if (e.button === 1) fly.mid = true;
});
window.addEventListener('pointerup', e => {
  if (e.button === 0) fly.left = false;
  if (e.button === 1) fly.mid = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const fs = dt / (1 / 15); // original motion constants are per ~15fps frame

  if (mode === 'fly') {
    if (fly.left) fly.speed += 0.02 * fs;
    if (fly.mid) fly.speed -= 0.02 * fs;
    fly.speed -= fly.speed * 0.3 * Math.min(1, fs);
    fly.yaw += (fly.mx - 0.5) * 15 * fs;
    fly.pitch = -(fly.my - 0.5) * 126;
    const yr = THREE.MathUtils.degToRad(fly.yaw), pr = THREE.MathUtils.degToRad(fly.pitch);
    camera.position.x += Math.sin(yr) * fly.speed * fs;
    camera.position.y += Math.sin(pr) * fly.speed * fs;
    camera.position.z += Math.cos(yr) * fly.speed * fs;
    camera.rotation.set(pr, yr + Math.PI, 0, 'YXZ');
    camera.up.set(0, 1, 0);
  } else {
    orbitYaw += (fly.mx - 0.5) * 10 * fs;
    camera.position.set(
      Math.sin(orbitYaw) * orbitDist * Math.cos(orbitPitch),
      orbitDist * Math.sin(orbitPitch) + 1.2,
      Math.cos(orbitYaw) * orbitDist * Math.cos(orbitPitch));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 1.2, 0);
  }
  renderer.render(scene, camera);
});

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape': location.href = '../'; break;
    case ' ': mode = mode === 'fly' ? 'orbit' : 'fly'; toast(toastEl, mode === 'fly' ? 'fly-through' : 'turntable orbit'); break;
    case 'w': case 'W': fly.speed *= 1.2; break;
    case 'q': case 'Q': fly.speed /= 1.2; break;
    case 'a': case 'A': camera.fov = Math.max(20, camera.fov - 4); camera.updateProjectionMatrix(); break;
    case 's': case 'S': camera.fov = Math.min(90, camera.fov + 4); camera.updateProjectionMatrix(); break;
  }
});
renderer.domElement.addEventListener('wheel', (e) => {
  orbitDist = Math.max(0.5, orbitDist * (e.deltaY > 0 ? 1.1 : 0.9));
});
