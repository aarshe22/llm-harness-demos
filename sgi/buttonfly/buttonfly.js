// Buttonfly — Wade Olsen, SGI, late 1980s. The demo-tape launcher: a
// hierarchical menu of bevelled 3D buttons that tumble to reveal sub-menus.
// Purple buttons (the .9 .5 .9 / .highcolor 1.0 .7 1.0 of the real menu
// files) open deeper menus; blue buttons run a command — here, the ports.
// Button bevel geometry uses the WIDE/HIGH/THICK/BEVEL proportions of data.h.
import { createRenderer, hud, THREE } from '../shared/sgi.js';

const WIDE = 5 / 8, HIGH = 4 / 8, THICK = 1 / 8, BEVEL = 1 / 8;

const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2338);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 7);
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Buttonfly', author: 'Wade Olsen', year: '1988',
  blurb: 'The hierarchical 3D button menu that fronted /usr/demos. Purple buttons tumble to a deeper menu; blue ones run a demo. Here the buttons run the ports in this folder.',
  controls: 'click a button \u00b7 esc: exit',
});
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(1, 1, 2);
scene.add(key);

// ---- menu tree (mirrors menus/m_demos, m_bounce, m_more_demos) ----
const run = (p) => () => { location.href = p; };
const TREE = {
  label: 'SGI Demos', items: [
    { label: 'Bounce', sub: { label: 'Bounce', items: [
      { label: 'Logo', href: '../bounce/' },
      { label: 'X29', href: '../bounce/' },
      { label: 'VW', href: '../bounce/' },
      { label: 'Martini', href: '../bounce/' },
      { label: 'Candlestick', href: '../bounce/' },
      { label: 'Doughnut', href: '../bounce/' },
    ] } },
    { label: 'Ideas', href: '../ideas/' },
    { label: 'Insect', href: '../insect/' },
    { label: 'Logo', href: '../logo/' },
    { label: 'Electropaint', sub: { label: 'Electropaint', items: [
      { label: '1988', href: '../ep-1988/' },
      { label: '1989', href: '../ep-1989/' },
      { label: '1994', href: '../ep-1994/' },
    ] } },
    { label: 'More Demos', sub: { label: 'More Demos', items: [
      { label: 'Jello', href: '../jello/' },
      { label: 'Newave', href: '../newave/' },
      { label: 'Arena', href: '../arena/' },
      { label: 'Flight', sub: { label: 'Flight', items: [
        { label: '1988', href: '../flight-1988/' },
        { label: '3.4', href: '../flight-1994/' },
      ] } },
      { label: 'Gview', href: '../gview/' },
      { label: 'Cedit', href: '../cedit/' },
      { label: 'Twilight', href: '../twilight/' },
    ] } },
    { label: 'Gallery', href: '../' },
  ],
};

// ---- bevelled button geometry ----
function buttonGeometry() {
  const p = [], n = [], uv = [];
  const q = (a, b, c, d) => { for (const v of [a, b, c, d]) { p.push(...v); n.push(...faceNormal([a, b, c, d])); } };
  const faceNormal = (pts) => {
    const u = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const w = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...nn) || 1;
    return [nn[0] / l, nn[1] / l, nn[2] / l];
  };
  const fw = (s) => [s * WIDE, s * HIGH, THICK];
  const bw = (sx, sy) => [sx * (WIDE - BEVEL), sy * (HIGH - BEVEL), THICK + BEVEL];
  const f = (s) => [s * WIDE, s * HIGH, -THICK];
  const fv = (sx, sy) => [sx * (WIDE - BEVEL), sy * (HIGH - BEVEL), -THICK - BEVEL];
  // front face + chamfer ring
  q(fv(-1, -1), fv(1, -1), fv(1, 1), fv(-1, 1));                         // flat front
  q(f(-1, 1), f(1, 1), fv(1, 1), fv(-1, 1));                             // top bevel
  q(fv(-1, -1), fv(1, -1), f(1, -1), f(-1, -1));                         // bottom bevel
  q(f(1, 1), f(1, -1), fv(1, -1), fv(1, 1));                             // right bevel
  q(fv(-1, 1), fv(-1, -1), f(-1, -1), f(-1, 1));                         // left bevel
  // back + side rim
  q(f(1, 1), f(-1, 1), f(-1, -1), f(1, -1));
  q(fv(1, 1), fv(1, -1), f(1, -1), f(1, 1));
  q(f(-1, 1), f(-1, -1), fv(-1, -1), fv(-1, 1));
  q(fv(-1, -1), fv(1, -1), f(1, -1), f(-1, -1));
  q(f(-1, 1), f(1, 1), fv(1, 1), fv(-1, 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}
const btnGeo = buttonGeometry();

function labelTexture(text, isMenu) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 200;
  const g = cv.getContext('2d');
  g.fillStyle = isMenu ? '#8a4fb0' : '#3a5fd0';
  g.fillRect(0, 0, 512, 200);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, 512, 90);
  g.fillStyle = '#fff';
  g.font = 'bold 64px Helvetica, Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 104);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

// ---- menu rendering / tumble transition ----
let current = TREE, buttons = [], group = new THREE.Group();
scene.add(group);
let transitioning = 0, pendingMenu = null;

function buildMenu(menu) {
  buttons.forEach(b => { scene.remove(b); b.geometry?.labelTex?.dispose?.(); });
  buttons = [];
  group = new THREE.Group();
  scene.add(group);
  const items = menu.items;
  const n = items.length;
  items.forEach((it, i) => {
    const isMenu = !!it.sub;
    const base = new THREE.Color(isMenu ? 0xb070d0 : 0x4f7fe0);
    const hi = new THREE.Color(isMenu ? 0xffb3ff : 0xa9c6ff);
    const mesh = new THREE.Mesh(btnGeo, new THREE.MeshPhongMaterial({
      color: base, specular: hi, shininess: 40, map: labelTexture(it.label, isMenu),
    }));
    mesh.userData = { item: it, base: base.clone(), hi: hi.clone(), phase: Math.random() * 6 };
    // front label plane
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2 * WIDE * 0.98, 2 * HIGH * 0.7),
      new THREE.MeshBasicMaterial({ map: labelTexture(it.label, isMenu), transparent: true }));
    label.position.z = THICK + 0.02;
    mesh.add(label);
    group.add(mesh);
    buttons.push(mesh);
  });
  layoutMenu(0);
}
function layoutMenu(t) {
  const n = buttons.length;
  buttons.forEach((b, i) => {
    const targetY = (n > 7 ? 0.85 : 0.95) * ((n - 1) / 2 - i) * 1.15;
    b.position.y = targetY;
    b.position.x = 0;
    b.position.z = 0;
    const s = Math.min(1.6, 5.2 / n);
    b.scale.setScalar(n > 6 ? 0.82 : 1);
    b.visible = true;
  });
}

function openMenu(sub) {
  transitioning = 1;
  pendingMenu = sub;
}
window.addEventListener('resize', () => layoutMenu());

// ---- picking ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hover = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(buttons)[0];
  hover = hit ? hit.object : null;
  renderer.domElement.style.cursor = hover ? 'pointer' : 'default';
});
renderer.domElement.addEventListener('click', () => {
  if (transitioning || !hover) return;
  const it = hover.userData.item;
  if (it.sub) openMenu(it.sub);
  else if (it.href) {
    // tumble the clicked button forward, then navigate
    openMenu({ href: it.href });
  }
});

let t0 = performance.now();
buildMenu(TREE);
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = (now - t0) / 1000; t0 = now;

  if (transitioning > 0) {
    transitioning += dt * 3;
    const p = Math.min(1, transitioning);
    group.rotation.x = p * Math.PI / 2;
    group.scale.setScalar(1 - p * 0.5);
    if (p >= 1) {
      if (pendingMenu.href) { location.href = pendingMenu.href; return; }
      current = pendingMenu;
      buildMenu(current);
      pendingMenu = null;
      transitioning = -0.0001;
    }
  } else if (transitioning < 0) {
    transitioning += dt * 3;
    group.rotation.x = (transitioning) * Math.PI / 2;
    group.scale.setScalar(1 + Math.min(0, transitioning) * 0.5);
    if (transitioning >= 0) transitioning = 0;
  }

  const tilt = hover ? 0.06 : 0;
  group.rotation.y = Math.sin(now * 0.0004) * 0.05 + tilt;
  buttons.forEach((b) => {
    const s = b === hover ? 1.12 : 1;
    b.scale.x += (s * (buttons.length > 6 ? 0.82 : 1) - b.scale.x) * 0.2;
    b.scale.y += (s * (buttons.length > 6 ? 0.82 : 1) - b.scale.y) * 0.2;
    b.position.z = b === hover ? 0.3 : 0;
    b.rotation.z = Math.sin(now * 0.001 + b.userData.phase) * 0.005;
  });
  renderer.render(scene, camera);
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });
