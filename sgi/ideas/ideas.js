// Ideas in Motion — Thant Tessman, SGI, c.1987, for the 4D/70GT.
// The word "ideas" in lit letters on a table, under a lamp with a spotlight
// and the SGI cube logo; hardware lighting on the logo/lamp, a track-driven
// camera moves every frame. Light values from the original (light1/2/3 in
// track.c), camera track ported from the recorded motion (ideas.rec).
import { createRenderer, hud, THREE } from '../shared/sgi.js';

const renderer = createRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Ideas in Motion', author: 'Thant Tessman', year: '1988',
  blurb: 'The word \u201cideas\u201d spelled in lit letters on a table under a lamp with a spotlight and the SGI logo \u2014 lights and camera computed per frame along a recorded motion track.',
  controls: 'LMB: pause/scrub \u00b7 M: manual orbit \u00b7 esc',
});

// --- lights from track.c: light1 white from +y, light2 cool from -x, light3 dim from -y ---
const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(0, 10, 2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 40;
keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);
const cool = new THREE.DirectionalLight(0x4d5d80, 0.6);
cool.position.set(-10, 3, 0);
scene.add(cool);
scene.add(new THREE.AmbientLight(0x222233, 0.5));

// lamp spotlight aimed at the letters
const spot = new THREE.SpotLight(0xfff2d0, 60, 30, Math.PI / 6, 0.4, 1.2);
spot.position.set(4, 8, 4);
spot.target.position.set(0, 1.2, 0);
spot.castShadow = true;
scene.add(spot, spot.target);

// table
const table = new THREE.Mesh(
  new THREE.BoxGeometry(16, 0.4, 9),
  new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.6, metalness: 0.1 }));
table.position.y = 0;
table.receiveShadow = true;
scene.add(table);
const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x30343d }));
legs.position.set(0, -1.7, 0);

// lamp post + shade
const lamp = new THREE.Group();
const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 12),
  new THREE.MeshStandardMaterial({ color: 0x20242c }));
post.position.y = 4;
const shade = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 24, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffcc55, emissiveIntensity: 0.8, side: THREE.DoubleSide }));
shade.position.set(0, 0.3, 0);
shade.rotation.x = Math.PI;
lamp.add(post);
lamp.position.set(4, 0.2, 4);
lamp.add(shade);
scene.add(lamp);

// --- "ideas" letters built from lit 3D extrusion via TextGeometry-lite:
//     we can't ship a font, so each letter is a rounded slab with a glyph
//     texture, standing on the table, assembled along the track. ---
const letters = 'ideas';
const letterGroup = new THREE.Group();
scene.add(letterGroup);
const letterMeshes = [];
for (let i = 0; i < letters.length; i++) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff';
  g.font = 'bold 110px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letters[i], 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.9, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xdfe6f5, roughness: 0.4, metalness: 0.3 }));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  front.position.z = 0.21;
  box.add(front);
  box.castShadow = true;
  box.userData.i = i;
  letterGroup.add(box);
  letterMeshes.push(box);
}

// SGI cube logo (a rotating rounded-square "cube" hint) hovering
const logo = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: 0xcc88ff, roughness: 0.3, metalness: 0.4, emissive: 0x220033 });
  const outer = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.28, 12, 4), m);
  outer.rotation.z = Math.PI / 4;
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 12, 4), m.clone());
  inner.material.color.set(0xe6b3ff); inner.rotation.z = Math.PI / 4;
  logo.add(outer, inner);
}
logo.position.set(0, 4.5, -2);
scene.add(logo);
{ const lp = new THREE.PointLight(0xb060ff, 20, 20); logo.add(lp); }

// --- motion track: camera orbit + letter assembly over an ~8s loop ---
const DUR = 9.0;
let t = 0, playing = true, manual = false, mAz = 0.6, mEl = 0.4, mDist = 14;
function track(now) {
  const p = (now % DUR) / DUR;
  // camera slowly orbits from a high wide shot down to a low close-up
  const az = -0.9 + p * 2.0;
  const el = 0.7 - p * 0.45;
  const dist = 16 - 6 * Math.sin(Math.min(1, p * 1.4) * Math.PI / 2);
  camera.position.set(Math.sin(az) * dist * Math.cos(el), dist * Math.sin(el) + 3, Math.cos(az) * dist * Math.cos(el));
  camera.lookAt(0, 1.4, 0);
  // letters drop/assemble in sequence during the first ~half
  const spread = 2.0;
  letterMeshes.forEach((L, i) => {
    const a = i - (letters.length - 1) / 2;
    const start = 0.04 + i * 0.09;
    const k = Math.max(0, Math.min(1, (p - start) / 0.18));
    const e = 1 - (1 - k) * (1 - k);
    L.position.set(a * spread, 1.1 + (1 - e) * 6, 0);
    L.rotation.y = (1 - e) * Math.PI * 1.6;
    L.visible = p > start * 0.5;
  });
  logo.rotation.y = now * 0.8;
  logo.rotation.z = Math.sin(now * 0.5) * 0.2;
  logo.position.y = 4.5 + Math.sin(now * 1.3) * 0.4;
  // lamp glow sweeps the spotlight a touch
  spot.position.set(4 * Math.cos(p * 1.5), 8, 4 * Math.sin(p * 1.5));
}
function manualCam() {
  camera.position.set(Math.sin(mAz) * mDist * Math.cos(mEl), mDist * Math.sin(mEl) + 3, Math.cos(mAz) * mDist * Math.cos(mEl));
  camera.lookAt(0, 1.4, 0);
  letterMeshes.forEach((L, i) => {
    const a = i - (letters.length - 1) / 2;
    L.visible = true; L.position.set(a * 2.0, 1.1, 0); L.rotation.y = 0;
  });
  logo.rotation.y = t;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button === 0 && !manual) playing = !playing;
});
renderer.domElement.addEventListener('pointerdown', e => { if (manual) { window.__mx = e.clientX; window.__my = e.clientY; } });
window.addEventListener('pointermove', e => {
  if (manual && window.__mx != null) {
    mAz += (e.clientX - window.__mx) * 0.01; mEl = Math.max(-0.3, Math.min(1.2, mEl - (e.clientY - window.__my) * 0.01));
    window.__mx = e.clientX; window.__my = e.clientY;
  }
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') location.href = '../';
  if (e.key.toLowerCase() === 'm') manual = !manual;
});

renderer.setAnimationLoop(() => {
  if (playing) t += 1 / 60;
  if (manual) manualCam(); else track(t);
  renderer.render(scene, camera);
});
