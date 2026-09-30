// Cedit — Paul Haeberli, SGI, 1984. A colour editor: click an entry of the
// (256-index) colour map in the test image with the left button, then drag
// the R/G/B sliders to edit that entry with modmapcolor(). The test image is
// an indexed image drawn through the live colormap, so edits show everywhere.
import { createRenderer, hud, THREE } from '../shared/sgi.js';

const renderer = createRenderer();
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(0, 10, 10, 0, -1, 1); // cedit's 10×10 space
const resize = () => {
  renderer.setSize(innerWidth, innerHeight);
  const a = innerWidth / innerHeight;
  if (a > 1) { cam.left = -10 * (a - 1) / 2; cam.right = 10 + 10 * (a - 1) / 2; cam.top = 0; cam.bottom = 10; }
  else { cam.left = 0; cam.right = 10; cam.top = -10 * (1 / a - 1) / 2; cam.bottom = 10 + 10 * (1 / a - 1) / 2; }
  cam.updateProjectionMatrix();
};
resize(); window.addEventListener('resize', resize);
hud({
  title: 'Cedit', author: 'Paul Haeberli', year: '1984',
  blurb: 'A colormap editor from the IRIS-2400 gifts package. Left-click the test image to pick a colour-map entry, then drag the R, G, B sliders \u2014 the indexed image updates as the map changes.',
  controls: 'LMB on image: pick entry \u00b7 drag R/G/B column: edit \u00b7 RMB: colour system \u00b7 esc',
});

// ---- the 256-entry colour map, initial spectrum + grey ramp ----
const palette = new Uint8Array(256 * 3);
function hls2rgb(h, l) {
  const q = l < 0.5 ? l * (1 + l) : l + l - l * l, p = 2 * l - q;
  const t = [1 / 3, 0, -1 / 3].map(dx => {
    let x = h + dx;
    x = ((x % 1) + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  });
  return t.map(v => Math.round(v * 255));
}
for (let i = 0; i < 16; i++) { const g = Math.round(i / 15 * 255); palette.set([g, g, g], i * 3); }
for (let i = 16; i < 256; i++) palette.set(hls2rgb((i - 16) / 240, 0.5), i * 3);

// ---- the indexed test image: all 256 indices are on screen ----
const IMG = 256;
const idxImg = new Uint8Array(IMG * IMG);
for (let y = 0; y < IMG; y++)
  for (let x = 0; x < IMG; x++) {
    const dx = (x - 128) / 128, dy = (y - 128) / 128, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let v;
    if (r < 0.85) {
      const hue = (a / (2 * Math.PI) + 0.5) % 1;
      v = 16 + Math.round(hue * 239);
      if (r < 0.3) v = Math.round(r / 0.3 * 15);           // grey hub
    } else {
      v = 16 + Math.round(((x / IMG) * (1 - y / IMG)) * 239); // corner gradient block
    }
    idxImg[y * IMG + x] = v & 255;
  }
const tex = new THREE.DataTexture(new Uint8Array(IMG * IMG * 4), IMG, IMG);
function refreshTex() {
  const d = tex.image.data;
  for (let i = 0; i < IMG * IMG; i++) {
    const p = idxImg[i] * 3;
    d[i * 4] = palette[p]; d[i * 4 + 1] = palette[p + 1]; d[i * 4 + 2] = palette[p + 2]; d[i * 4 + 3] = 255;
  }
  tex.needsUpdate = true;
}
refreshTex();
tex.magFilter = THREE.NearestFilter;

// ---- ortho scene ----
const ortho = new THREE.OrthographicCamera(0, 10, 10, 0, -1, 1);
const ui = new THREE.Scene();
function quad(x, y, w, h, color, order = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, depthTest: false }));
  m.position.set(x + w / 2, 10 - (y + h / 2));
  m.renderOrder = order;
  ui.add(m);
  return m;
}
// image lives at x .2..? original: image 0..10 wide, UI 7..9. Keep the classic
// 10-unit frame: sliders at x 1..2 / 3..4 / 5..6, swatch 7..9, image across top.
const imgMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5),
  new THREE.MeshBasicMaterial({ map: tex, depthTest: false }));
imgMesh.position.set(5, 10 - 2.25);
ui.add(imgMesh);

// slider tracks (grey) + knobs + swatch — redrawn each frame
const knobs = [], swatchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
for (const x of [1, 3, 5]) quad(x, 6.6, 1, 2.8 + 1.6, 0x404040, 1);  // 1.6..9.4 track, flipped
for (const x of [1, 3, 5]) {
  const k = quad(x + 0.1, 7.6, 0.8, 0.28, 0xffffff, 3);
  knobs.push(k);
}
quad(7, 1.6, 2, 7.8, 0xffffff, 1);
const swatch = new THREE.Mesh(new THREE.PlaneGeometry(2, 7.8), swatchMat);
swatch.position.set(8, 10 - 5.5); swatch.renderOrder = 2; ui.add(swatch);
const labels = ['R', 'G', 'B'];
for (let i = 0; i < 3; i++) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = '#cfd6e4'; g.font = 'bold 48px Helvetica'; g.fillText(labels[i], 18, 48);
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  l.position.set(i * 2 + 1.5, 10 - 9.7); l.renderOrder = 4; ui.add(l);
}

let cc = 16, col = [palette[48] / 255, palette[49] / 255, palette[50] / 255];
let drag = null;

function toUI(e) {
  const nx = (e.clientX / innerWidth), ny = (e.clientY / innerHeight);
  // invert the ortho mapping we set up
  const a = innerWidth / innerHeight;
  let x, y;
  if (a > 1) { const span = 10 * a; x = nx * span - (span - 10) / 2; y = ny * 10; }
  else { const span = 10 / a; y = ny * span - (span - 10) / 2; x = nx * 10; }
  return [x, y];
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  const [x, y] = toUI(e);
  if (y < 4.5 && x >= 0 && x <= 10) {
    const px = Math.floor(x / 10 * IMG), py = Math.floor(y / 4.5 * IMG);
    cc = idxImg[Math.min(IMG - 1, py) * IMG + Math.min(IMG - 1, px)];
    const p = cc * 3;
    col = [palette[p] / 255, palette[p + 1] / 255, palette[p + 2] / 255];
  } else if (y >= 6.4) {
    if (x > 1 && x < 2) drag = 0;
    else if (x > 3 && x < 4) drag = 1;
    else if (x > 5 && x < 6) drag = 2;
  }
});
window.addEventListener('pointerup', () => drag = null);
window.addEventListener('pointermove', (e) => {
  if (drag == null) return;
  const [, y] = toUI(e);
  const v = Math.max(0, Math.min(1, 1 - (y - 6.6) / 2.8));
  col[drag] = v;
  const p = cc * 3;
  palette[p] = Math.round(col[0] * 255);
  palette[p + 1] = Math.round(col[1] * 255);
  palette[p + 2] = Math.round(col[2] * 255);
  refreshTex();
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });

renderer.setAnimationLoop(() => {
  knobs[0].material.color.setRGB(1, 0.25, 0.25);
  knobs[1].material.color.setRGB(0.25, 1, 0.25);
  knobs[2].material.color.setRGB(0.25, 0.4, 1);
  knobs.forEach((k, i) => { k.position.y = (10 - 6.6) - col[i] * 2.8; });
  swatchMat.color.setRGB(col[0], col[1], col[2]);
  renderer.render(ui, ortho);
});
