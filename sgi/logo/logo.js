// Logo — Thant Tessman, SGI, July 1987. Port of logo.c: the SGI cube grown
// from quads, a kinematic chain of tubes + elbows whose joint unfolds from
// 180deg to 90deg while the cylinder segments extend, under two lights.
import { createRenderer, hud, dragOrbit, THREE } from '../shared/sgi.js';

const S_CYL = 6.0, D_CYL = 8.0, ELBOW_RAD = 1.0, JOINT = 900;
const radius = 1.0, cres = 8, bres = 8;

const renderer = createRenderer();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 34, 72);
camera.position.set(-30, 30, 30);
camera.lookAt(0, 0, 0);
const resize = () => { camera.aspect = innerWidth / (innerHeight * 0.8) * 1.25; camera.updateProjectionMatrix(); };
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Logo', author: 'Thant Tessman', year: 1987,
  blurb: 'The SGI cube logo, built from 1,296 quadrilaterals every frame as its joints unfold, under two hardware lights.',
  controls: 'drag: rotate · esc: back',
});

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const l1 = new THREE.DirectionalLight(0xffffff, 1.0);
l1.position.set(1, 0.35, 0);   // light1: POSITION 1,0,0 (directional)
scene.add(l1);
const l2 = new THREE.DirectionalLight(new THREE.Color(0.5, 0.1, 0.0), 1.0);
l2.position.set(0, -1, 0.25);  // light2: POSITION 0,-1,0
scene.add(l2);

const group = new THREE.Group();
scene.add(group);
const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.8, 0.4, 1.0), specular: 0xffffff, shininess: 20,
  side: THREE.DoubleSide, flatShading: false,
}));
group.add(mesh);

// ---- geometry builders (verbatim math from build_parts / edit_parts) ----
const mycirc = [];
{
  const deg10 = Math.PI / 1800;
  for (let a = 0; a <= 3600; a += 3600 / cres)
    mycirc.push([Math.cos(a * deg10), Math.sin(a * deg10), 0]);
}

function elbowQuads(joint) {
  const quads = [];
  const deg10 = Math.PI / 1800;
  let ct1 = mycirc.map(p => [...p]);
  let n1 = mycirc.map(p => [...p]);
  for (let a = joint / bres; a <= joint; a += joint / bres) {
    const glsin = Math.sin(a * deg10), glcos = Math.cos(a * deg10);
    const ct2 = mycirc.map(p => [p[0], (p[1] - ELBOW_RAD) * glcos + ELBOW_RAD, -(p[1] - ELBOW_RAD) * glsin]);
    const n2 = mycirc.map(p => [p[0], p[1] * glcos, -p[1] * glsin]);
    for (let i = 0; i < mycirc.length - 1; i++)
      quads.push([ct1[i], n1[i], ct2[i], n2[i], ct2[i + 1], n2[i + 1], ct1[i + 1], n1[i + 1]]);
    ct1 = ct2; n1 = n2;
  }
  return quads;
}

function cylQuads(len) {
  const quads = [];
  const deg10 = Math.PI / 1800;
  const N = mycirc.length - 1;
  for (let k = 0; k < N; k++) {
    const a0 = k * (3600 / cres) * deg10, a1 = (k + 1) * (3600 / cres) * deg10;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    quads.push([
      [c0, s0, -0.1], [c0, s0, 0],
      [c0, s0, len], [c0, s0, 0],
      [c1, s1, len], [c1, s1, 0],
      [c1, s1, -0.1], [c1, s1, 0],
    ]);
  }
  return quads;
}

// ---- chain (build_logo: 3 hooks, each double-fwd-double-fwd-single-elbow) ----
// move ops apply as IRIS GL does: matrix = matrix * op.
const R = (m, axis, tenthDeg) => {
  const a = tenthDeg * Math.PI / 1800;
  const r = new THREE.Matrix4();
  if (axis === 'x') r.makeRotationX(a);
  if (axis === 'y') r.makeRotationY(a);
  if (axis === 'z') r.makeRotationZ(a);
  m.multiply(r);
};
const T = (m, x, y, z) => m.multiply(new THREE.Matrix4().makeTranslation(x, y, z));

const CHAIN = [
  ['double', 'move_double'], ['elbow', 'bend_forward'], ['double', 'move_double'],
  ['elbow', 'bend_forward'], ['single', 'move_single'], ['elbow', 'bend_right'],
];
// the original chains hook 2 and 3 off the last elbow of the previous one,
// alternating the final bend right/left.
const HOOKS = [
  CHAIN,
  CHAIN.slice(0, 5).concat([['elbow', 'bend_right']]),
  CHAIN.slice(0, 5).concat([['elbow', 'bend_left']]),
];

function moveOp(name, m, joint, d_cyl, s_cyl) {
  switch (name) {
    case 'move_double': T(m, 0, 0, -d_cyl); break;
    case 'move_single': T(m, 0, 0, -s_cyl); break;
    case 'bend_forward': T(m, 0, ELBOW_RAD, 0); R(m, 'x', joint); T(m, 0, -ELBOW_RAD, 0); break;
    case 'bend_right': R(m, 'z', joint); T(m, 0, ELBOW_RAD, 0); R(m, 'x', joint); T(m, 0, -ELBOW_RAD, 0); break;
    case 'bend_left': R(m, 'z', -joint); T(m, 0, ELBOW_RAD, 0); R(m, 'x', joint); T(m, 0, -ELBOW_RAD, 0); break;
  }
}

function build(joint, s_cyl, d_cyl) {
  const elb = elbowQuads(joint), dbl = cylQuads(d_cyl), sgl = cylQuads(s_cyl);
  const pos = [], nor = [];
  const start = new THREE.Matrix4().makeTranslation(0, 0, ELBOW_RAD * 2);
  const stack = [];
  let m = start.clone();
  // the three hooks are nested subs of the previous chain's terminal elbow
  for (let h = 0; h < 3; h++) {
    for (const [part, move] of HOOKS[h]) {
      moveOp(move, m, joint, d_cyl, s_cyl);
      const quads = part === 'double' ? dbl : part === 'single' ? sgl : elb;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const v = new THREE.Vector3(), nv = new THREE.Vector3();
      for (const q of quads) {
        // quads: p0,n0,p1,n1,p2,n2,p3,n3 -> two triangles
        const p = [], nn = [];
        for (let i = 0; i < 4; i++) {
          v.fromArray(q[i * 2]).applyMatrix4(m); p.push([v.x, v.y, v.z]);
          nv.fromArray(q[i * 2 + 1]).applyMatrix3(nm).normalize(); nn.push([nv.x, nv.y, nv.z]);
        }
        for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); nor.push(...nn[i]); }
      }
      stack.push(m.clone());
    }
    m = stack[stack.length - 1].clone(); // next hook continues from last elbow
  }
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(pos.flat());
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor.flat()), 3));
  g.computeBoundingSphere();
  // draw_everything does translate(t,-t,t) + lookat(-30,30,30) with a
  // near..far of 34..72: centre the chain on the orbit and fit it in frame.
  if (g.boundingSphere) {
    const c = g.boundingSphere.center, r = g.boundingSphere.radius || 1;
    const s = 12 / r;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = (arr[i] - c.x) * s; arr[i + 1] = (arr[i + 1] - c.y) * s; arr[i + 2] = (arr[i + 2] - c.z) * s;
    }
    g.computeBoundingSphere();
  }
  return g;
}

let joint = 1800;
function frame_() {
  const s_cyl = ((1800 - joint) / JOINT) * S_CYL;
  const d_cyl = ((1800 - joint) / JOINT) * D_CYL;
  mesh.geometry.dispose();
  mesh.geometry = build(joint, s_cyl, d_cyl);
  if (joint > JOINT) joint -= 9; else joint = JOINT;
}
frame_();

let spin = 0;
const pivot = new THREE.Group();
scene.remove(group); pivot.add(group); scene.add(pivot);
dragOrbit(renderer.domElement, (dx, dy) => {
  pivot.rotation.y += THREE.MathUtils.degToRad(dx);
  pivot.rotation.x += THREE.MathUtils.degToRad(dy);
});
renderer.domElement.addEventListener('pointerdown', e => { if (e.button === 0 && joint === JOINT) spin = 0.15; });
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });

renderer.setAnimationLoop(() => {
  if (joint > JOINT) frame_();
  else group.rotation.y += spin || 0;
  renderer.render(scene, camera);
});
