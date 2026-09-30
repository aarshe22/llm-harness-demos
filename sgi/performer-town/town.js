// Performer Town (webfly) — the SGI Performer fly-through of a low-poly
// town, from the sgi-performer web build: fly over and through a gridded
// town of instanced buildings with a fogged horizon. Mouse steers, wheel
// throttles, arrow keys climb/dive.
import { createRenderer, hud, THREE } from '../shared/sgi.js';

const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8d8);
scene.fog = new THREE.Fog(0x9fb8d8, 60, 520);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 2000);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Performer Town', author: 'SGI (Performer / webfly)', year: '1995',
  blurb: 'The Performer fly-through of a low-poly town: a camera tour over instanced buildings with a fogged horizon, the demo that showed off Performer\u2019s culling and LOD.',
  controls: 'mouse: steer \u00b7 wheel: throttle \u00b7 ↑/↓ climb/dive \u00b7 F: auto tour \u00b7 esc',
});

const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
sun.position.set(120, 200, 80);
scene.add(sun, new THREE.AmbientLight(0x8fa8cc, 0.8));

// ground
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshLambertMaterial({ color: 0x5d7a4a }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ---- gridded town: blocks of instanced buildings between roads ----
let seed = 4242;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const BLOCK = 40, ROAD = 12, TOWN = 12;
const dummy = new THREE.Object3D();
const mats = [0xd8c8b0, 0xb08868, 0x9aa8b8, 0xc8b088, 0x8898a8, 0xa86a4a].map(
  c => new THREE.MeshLambertMaterial({ color: c }));
const buildings = [];
for (let bi = 0; bi < TOWN; bi++)
  for (let bj = 0; bj < TOWN; bj++) {
    const cx = (bi - TOWN / 2) * (BLOCK + ROAD), cz = (bj - TOWN / 2) * (BLOCK + ROAD);
    const dist = Math.hypot(cx, cz);
    const n = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const w = 6 + rnd() * 12, d = 6 + rnd() * 12;
      const tall = Math.max(0, 1 - dist / 260);
      const h = 6 + rnd() * (12 + tall * 90);
      buildings.push({ x: cx + (rnd() - 0.5) * (BLOCK - w), z: cz + (rnd() - 0.5) * (BLOCK - d), w, d, h, mat: Math.floor(rnd() * mats.length) });
    }
  }
// road stripes
{
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33363d });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd8d0a0 });
  for (let i = -TOWN / 2; i <= TOWN / 2; i++) {
    const rz = (i) * (BLOCK + ROAD) - (BLOCK + ROAD) / 2;
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(TOWN * (BLOCK + ROAD), ROAD), roadMat);
    roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.02, rz); scene.add(roadH);
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, TOWN * (BLOCK + ROAD)), roadMat);
    roadV.rotation.x = -Math.PI / 2; roadV.position.set(rz, 0.02, 0); scene.add(roadV);
  }
}
// instanced boxes, one InstancedMesh per material bucket
for (let m = 0; m < mats.length; m++) {
  const list = buildings.filter(b => b.mat === m);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats[m], list.length);
  list.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
}

// ---- fly camera ----
const cam = { x: -260, y: 60, z: -300, yaw: 0.6, pitch: -0.08, speed: 40, auto: true, tourT: 0 };
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-280, 80, -300), new THREE.Vector3(60, 40, -220),
  new THREE.Vector3(240, 70, 0), new THREE.Vector3(120, 22, 200),
  new THREE.Vector3(-160, 50, 240), new THREE.Vector3(-300, 90, 40),
], true);
window.addEventListener('pointermove', e => {
  if (cam.auto) return;
  cam.yaw = -((e.clientX / innerWidth) * 2 - 1) * 2.2;
  cam.pitch = -((e.clientY / innerHeight) * 2 - 1) * 0.7;
});
renderer.domElement.addEventListener('wheel', e => { cam.speed = Math.max(0, Math.min(220, cam.speed - e.deltaY * 0.1)); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') location.href = '../';
  if (e.key.toLowerCase() === 'f') cam.auto = !cam.auto;
  if (e.key === 'ArrowUp') cam.y += 1;
  if (e.key === 'ArrowDown') cam.y = Math.max(6, cam.y - 1);
  if (e.key === ' ') cam.auto = false;
});

const fwd = new THREE.Vector3();
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (cam.auto) {
    cam.tourT = (cam.tourT + dt * 0.012) % 1;
    const p = path.getPointAt(cam.tourT), t = path.getTangentAt(cam.tourT);
    camera.position.lerp(p, 0.12);
    camera.lookAt(p.clone().add(t));
  } else {
    fwd.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    cam.x += fwd.x * cam.speed * dt; cam.z += fwd.z * cam.speed * dt;
    cam.y = Math.max(6, cam.y);
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.x + fwd.x * 10, cam.y + fwd.y * 10, cam.z + fwd.z * 10);
    cam.x = camera.position.x; cam.y = camera.position.y; cam.z = camera.position.z;
  }
  renderer.render(scene, camera);
});
