// Jello — Thant Tessman, SGI, Aug 1987. Ported from jello.c: 13 atoms,
// icosahedron springs, exact integrator (dt .5, dw .9, damp .3, fric .3).
import { createRenderer, hud, toast, pupMenu, dragOrbit, orientFromDelta, THREE, halftoneTexture } from '../shared/sgi.js';

const HEIGHT = 3.0, SHADOW_H = 0.015, ANG = 42.861, PI = Math.PI;
const dt = 0.5, dw = 0.9, fric = 0.3, dist = 15.0;
let damp = 0.3, grav = 0.0;

const renderer = createRenderer();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, dist - HEIGHT * 1.74, dist + HEIGHT * 1.74);
camera.position.z = dist;
const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
resize(); window.addEventListener('resize', resize);
const toastEl = hud({
  title: 'Jello', author: 'Thant Tessman', year: 1987,
  blurb: 'An elastic icosahedron of 13 masses joined by springs, integrated every frame and dropped into a box with a dithered shadow.',
  controls: 'LMB: drop · MMB drag: rotate · RMB: menu · esc',
});
const menuHost = document.createElement('div');
document.body.appendChild(menuHost);

// ---- atoms + springs (exact list from build_icosahedron) ----
const atoms = [];
for (let i = 0; i < 13; i++)
  atoms.push({ acc: [0, 0, 0], vel: [0, 0, 0], pos: [0, 0, 0], norm: [0, 0, 0], center: false, colur: 0 });

const SPRINGS = [
  [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 7], [1, 8], [1, 9], [1, 10], [1, 11],
  [2, 3], [2, 6], [2, 9], [2, 10],
  [3, 4], [3, 10], [3, 11],
  [4, 5], [4, 7], [4, 11],
  [5, 6], [5, 7], [5, 8],
  [6, 8], [6, 9],
  [7, 8], [7, 11],
  [8, 9], [9, 10], [10, 11],
  [0, 12], [1, 12], [2, 12], [3, 12], [4, 12], [5, 12],
  [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
];

// 20 faces (the original derives them from the spring graph at startup).
const FACES = [
  [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 6], [0, 6, 2],
  [1, 7, 8], [1, 8, 9], [1, 9, 10], [1, 10, 11], [1, 11, 7],
  [2, 6, 9], [2, 9, 10], [2, 10, 3], [3, 10, 11], [3, 11, 4],
  [4, 11, 7], [4, 7, 5], [5, 7, 8], [5, 8, 6], [6, 8, 9],
];

function reset_jello() {
  atoms.forEach(a => {
    a.pos = [0, 0, 0]; a.vel = [0, 0, 0]; a.acc = [0, 0, 0];
    a.norm = [0, 0, 0]; a.center = false; a.colur = 0;
  });
  const a = atoms;
  a[0].pos = [0, 0, -1];
  a[1].pos = [0, 0, 1];
  const z = Math.cos(ANG), xy = Math.sin(ANG);
  for (let i = 2; i < 7; i++) {
    const ang = (i - 2) * 2 * PI / 5;
    const x = xy * Math.cos(ang), y = xy * Math.sin(ang);
    a[i].pos = [x, y, -z];
    a[i + 5].pos = [-x, -y, z];
  }
  a[12].center = true;
  damp = 0.3; grav = 0.0;
  gravVec.set(0, 0, 0);
}

// ---- physics (iterate: clear, accel, bounds, vel, pos) ----
const gravVec = new THREE.Vector3(0, 0, 0);
let lightVector = new THREE.Vector3(0, 1, 0);

function iterate() {
  for (const a of atoms) { a.acc[0] = gravVec.x; a.acc[1] = gravVec.y; a.acc[2] = gravVec.z; }
  for (const [i, j] of SPRINGS) {
    const f = atoms[i], t = atoms[j];
    const dx = f.pos[0] - t.pos[0], dy = f.pos[1] - t.pos[1], dz = f.pos[2] - t.pos[2];
    const dr = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (f.center) {
      t.norm = [-dx / dr, -dy / dr, -dz / dr];
      t.colur = t.norm[0] * lightVector.x + t.norm[1] * lightVector.y + t.norm[2] * lightVector.z;
    } else if (t.center) {
      f.norm = [dx / dr, dy / dr, dz / dr];
      f.colur = f.norm[0] * lightVector.x + f.norm[1] * lightVector.y + f.norm[2] * lightVector.z;
    }
    const ax = dt * (dx - dx / dr), ay = dt * (dy - dy / dr), az = dt * (dz - dz / dr);
    f.acc[1] -= ay; f.acc[0] -= ax; f.acc[2] -= az;
    t.acc[0] += ax; t.acc[1] += ay; t.acc[2] += az;
  }
  const b = HEIGHT - 0.1;
  for (const a of atoms) {
    if (a.pos[1] < -(b)) { a.acc[1] -= (a.pos[1] + b) * dw; a.vel[0] *= fric; a.vel[2] *= fric; }
    if (a.pos[1] > b) { a.acc[1] -= (a.pos[1] - b) * dw; a.vel[0] *= fric; a.vel[2] *= fric; }
    if (a.pos[0] < -(b)) { a.acc[0] -= (a.pos[0] + b) * dw; a.vel[1] *= fric; a.vel[2] *= fric; }
    if (a.pos[0] > b) { a.acc[0] -= (a.pos[0] - b) * dw; a.vel[1] *= fric; a.vel[2] *= fric; }
    if (a.pos[2] < -(b)) { a.acc[2] -= (a.pos[2] + b) * dw; a.vel[0] *= fric; a.vel[1] *= fric; }
    if (a.pos[2] > b) { a.acc[2] -= (a.pos[2] - b) * dw; a.vel[0] *= fric; a.vel[1] *= fric; }
  }
  for (const a of atoms) {
    for (let k = 0; k < 3; k++) {
      a.vel[k] = (a.vel[k] + a.acc[k]) * damp;
      a.pos[k] += a.vel[k];
    }
  }
}

// ---- scene: box room, blue frame, gouraud jello, halftone shadow ----
const view = new THREE.Group();
scene.add(view);

const floorMats = {};
function wall(axis, dir) {
  const geo = new THREE.PlaneGeometry(2 * HEIGHT, 2 * HEIGHT);
  const mat = new THREE.MeshBasicMaterial({ color: 0x373737, side: THREE.FrontSide });
  const m = new THREE.Mesh(geo, mat);
  m.position[axis] = dir * HEIGHT;
  if (axis === 'x') m.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  if (axis === 'y') m.rotation.x = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  if (axis === 'z') m.rotation.y = dir > 0 ? Math.PI : 0;
  view.add(m);
  floorMats[axis + dir] = mat;
  return m;
}
const floors = [wall('x', 1), wall('x', -1), wall('y', 1), wall('y', -1), wall('z', 1), wall('z', -1)];

const frame = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * (HEIGHT - 0.02), 2 * (HEIGHT - 0.02), 2 * (HEIGHT - 0.02))),
  new THREE.LineBasicMaterial({ color: new THREE.Color(50 / 255, 100 / 255, 1) }));
view.add(frame);

const jelloGeo = new THREE.BufferGeometry();
const jelloPos = new Float32Array(FACES.length * 9);
const jelloCol = new Float32Array(FACES.length * 9);
jelloGeo.setAttribute('position', new THREE.BufferAttribute(jelloPos, 3));
jelloGeo.setAttribute('color', new THREE.BufferAttribute(jelloCol, 3));
const jelloMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const jelloMesh = new THREE.Mesh(jelloGeo, jelloMat);
view.add(jelloMesh);

const shadowGeo = new THREE.BufferGeometry();
const shadowPos = new Float32Array(FACES.length * 9);
shadowGeo.setAttribute('position', new THREE.BufferAttribute(shadowPos, 3));
const shadowMesh = new THREE.Mesh(shadowGeo,
  new THREE.MeshBasicMaterial({ map: halftoneTexture(), transparent: true, opacity: 0.55, side: THREE.DoubleSide, color: 0x000000 }));
view.add(shadowMesh);

let displayMode = 'gouraud';
function updateMeshes() {
  const lv = lightVector;
  for (let f = 0; f < FACES.length; f++) {
    let miny = 1e9;
    for (let v = 0; v < 3; v++) {
      const a = atoms[FACES[f][v]];
      const o = f * 9 + v * 3;
      jelloPos[o] = a.pos[0]; jelloPos[o + 1] = a.pos[1]; jelloPos[o + 2] = a.pos[2];
      // shadow: project along view y onto nearest wall handled via y-floor only
      miny = Math.min(miny, a.pos[1]);
      let c = a.colur; if (c < 0) c = 0;
      if (displayMode === 'gouraud') {
        jelloCol[o] = c * 100 / 255 + 30 / 255;
        jelloCol[o + 1] = c * 50 / 255 + 15 / 255;
        jelloCol[o + 2] = c * 200 / 255 + 50 / 255;
      } else { // surface triangles: flat facet color (original polf + dot(norm,light))
        const [p0, p1, p2] = FACES[f].map(i => atoms[i].pos);
        const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const n = [u[1] * w[2] - w[1] * u[2], u[2] * w[0] - w[2] * u[0], u[0] * w[1] - w[1] * u[0]];
        const r = Math.hypot(...n) || 1;
        let c2 = (n[0] * lv.x + n[1] * lv.y + n[2] * lv.z) / r; if (c2 < 0) c2 = 0;
        jelloCol[o] = c2 * 100 / 255 + 100 / 255;
        jelloCol[o + 1] = c2 * 50 / 255 + 50 / 255;
        jelloCol[o + 2] = c2 * 120 / 255 + 120 / 255;
      }
    }
  }
  jelloGeo.attributes.position.needsUpdate = true;
  jelloGeo.attributes.color.needsUpdate = true;

  // projected shadow on the floor under the jello (matrix projection like the C code)
  const m = view.matrixWorld;
  for (let f = 0; f < FACES.length; f++)
    for (let v = 0; v < 3; v++) {
      const a = atoms[FACES[f][v]];
      const o = f * 9 + v * 3;
      shadowPos[o] = a.pos[0];
      shadowPos[o + 1] = -HEIGHT + SHADOW_H;
      shadowPos[o + 2] = a.pos[2];
    }
  shadowGeo.attributes.position.needsUpdate = true;
  shadowGeo.computeBoundingSphere();
}

// ---- input ----
const q = new THREE.Quaternion();
dragOrbit(renderer.domElement, (dx, dy) => {
  orientFromDelta(q, dx, -dy);
  lightVector.set(0, 1, 0).applyQuaternion(q).normalize();
  gravVec.copy(lightVector).multiplyScalar(grav);
}, { button: 1 });

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) {
    grav = -0.008; damp = 0.995;
    gravVec.copy(lightVector).multiplyScalar(grav);
    toast(toastEl, 'the jello drops toward the light');
  } else if (e.button === 2) {
    pupMenu(menuHost, ['Jello', 'reset', 'display', 'exit'], e.clientX, e.clientY).then(i => {
      if (i === 1) reset_jello();
      else if (i === 2) {
        pupMenu(menuHost, ['Jello Display', 'gouraud', 'surface triangles'], e.clientX, e.clientY).then(j => {
          if (j === 1) displayMode = 'gouraud';
          if (j === 2) displayMode = 'triangles';
        });
      } else if (i === 3) location.href = '../';
    });
  }
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });

reset_jello();
renderer.setAnimationLoop(() => {
  iterate();
  updateMeshes();
  renderer.render(scene, camera);
});
