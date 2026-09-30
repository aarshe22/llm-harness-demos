// Bounce — SGI, late 1980s. Three point lights riding shaded balls that
// bounce inside a lit cubic room; right-click menu swaps in the original
// spin/fastobj models (.bin files used verbatim).
import { createRenderer, hud, toast, pupMenu, dragOrbit, orientFromDelta, loadFastObj, THREE } from '../shared/sgi.js';

const R = 0.04, BALLSCALE = 1.0 - R, EYEZ = 3.3;
const renderer = createRenderer();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, EYEZ - 2.0, EYEZ + 2.0);
camera.position.z = EYEZ;
const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
resize(); window.addEventListener('resize', resize);
const toastEl = hud({
  title: 'Bounce', author: 'Unattributed', year: 1988,
  blurb: 'Three coloured lights on shaded balls bouncing in a cubic room. Right-click to swap the model: doughnut, martini, VW, X-29, candlestick, SGI logo.',
  controls: 'LMB drag: rotate · RMB: menu · esc',
});
const menuHost = document.createElement('div');
document.body.appendChild(menuHost);

scene.add(new THREE.AmbientLight(0xffffff, 0.3)); // lmodel AMBIENT .3

const view = new THREE.Group();
scene.add(view);

// room: material AMBIENT .1 DIFFUSE .8 SPEC 1 SHININESS 20, seen from inside
const wallMat = new THREE.MeshPhongMaterial({
  color: 0xcccccc, specular: 0xffffff, shininess: 20 / 100, side: THREE.BackSide,
});
const room = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), wallMat);
view.add(room);

const COLORS = [[1, 0.25, 0.25], [0.25, 1, 0.25], [0.25, 0.25, 1]];
const balls = [], lights = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 12, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...COLORS[i]) }));
  const L = new THREE.PointLight(new THREE.Color(COLORS[i][0], COLORS[i][1] > 0.2 ? COLORS[i][1] : 0.1, COLORS[i][2]), 2.2, 0, 2);
  // original LCOLOR is (1,.1,.1) etc; keep that for the light itself
  L.color.setRGB(i === 0 ? 1 : 0.1, i === 1 ? 1 : 0.1, i === 2 ? 1 : 0.1);
  const rand = () => 0.1 * (Math.random() - 0.5) * 2;
  balls.push({ mesh: m, p: [0, 0, 0], d: [rand(), rand(), rand()] });
  lights.push(L);
  view.add(m); view.add(L);
}

// ---- original fastobj object ----
let objMesh = null, objectOn = true, spinOn = true, frozen = false;
let orx = 0, ory = 0;
const objGroup = new THREE.Group();
view.add(objGroup);
async function loadObject(name) {
  try {
    const { geometry, vertexColors } = await loadFastObj(`data/${name}.bin`);
    geometry.computeBoundingSphere();
    const s = 0.55 / (geometry.boundingSphere.radius || 1);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: vertexColors ? 0xffffff : 0xb8c6de, specular: 0xffffff, shininess: 0.3,
      vertexColors, side: THREE.DoubleSide,
    }));
    mesh.userData.scale = 1.5 * s;
    mesh.matrixAutoUpdate = false;
    objGroup.clear();
    objGroup.add(mesh);
    objMesh = mesh;
    toast(toastEl, `model: ${name}.bin`);
  } catch (e) { console.error(e); }
}
loadObject('x29');

let freeze = false;
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 2) return;
  const items = ['bounce'];
  for (let i = 0; i < 3; i++) items.push(`${['red', 'green', 'blue'][i]} light ${lights[i].visible ? 'off' : 'on'}`);
  items.push(frozen ? 'unfreeze lights' : 'freeze lights');
  items.push(objectOn ? 'object off' : 'object on', spinOn ? 'object spin off' : 'object spin on');
  items.push('load object…', 'exit');
  pupMenu(menuHost, items, e.clientX, e.clientY).then(async (i) => {
    if (i >= 1 && i <= 3) lights[i - 1].visible = !lights[i - 1].visible;
    else if (i === 4) frozen = !frozen;
    else if (i === 5) objectOn = !objectOn;
    else if (i === 6) spinOn = !spinOn;
    else if (i === 7) {
      const k = await pupMenu(menuHost, ['object', 'x-29', 'vw', 'doughnut', 'martini glass', 'candlestick', 'SGI logo'], e.clientX, e.clientY);
      const names = ['x29', 'vw', 'doughnut', 'martini', 'canstick', 'logo'];
      if (k) { await loadObject(names[k - 1]); objectOn = true; }
    } else if (i === 8) location.href = '../';
  });
});

const q = new THREE.Quaternion();
dragOrbit(renderer.domElement, (dx, dy) => orientFromDelta(q, dx, dy), { button: 0 });
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });

renderer.setAnimationLoop(() => {
  if (!frozen) for (const b of balls) {
    for (let k = 0; k < 3; k++) {
      b.p[k] += b.d[k];
      if (Math.abs(b.p[k]) > BALLSCALE) {
        b.p[k] = Math.sign(b.p[k]) * BALLSCALE;
        b.d[k] = -b.d[k];
      }
    }
    b.mesh.position.set(...b.p);
    lights[balls.indexOf(b)].position.set(...b.p);
  }
  if (spinOn) { orx += 50 / 3; ory += 50 / 3; }
  const s_ = objMesh ? objMesh.userData.scale : 1;
  if (objMesh) {
    // M = scale * rotZ(180) * rotX(orx) * rotY(ory), as IRIS GL postmultiplies
    objMesh.matrix.identity()
      .scale(new THREE.Vector3(s_, s_, s_))
      .multiply(new THREE.Matrix4().makeRotationZ(Math.PI))
      .multiply(new THREE.Matrix4().makeRotationX(orx * Math.PI / 1800))
      .multiply(new THREE.Matrix4().makeRotationY(ory * Math.PI / 1800));
  }
  objGroup.visible = objectOn;
  view.quaternion.copy(q);
  renderer.render(scene, camera);
});
