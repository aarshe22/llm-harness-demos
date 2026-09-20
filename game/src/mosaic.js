/* The one source image asset: /assets/maddox-face.jpg (real photo, 600x800).
   Everything derived from it (welcome portrait, giant monument, plaque) is a
   deterministic 16-color vibrant mosaic: head crop -> block downsample ->
   Floyd-Steinberg dithering onto MADDOX_FACE_PALETTE_16 only. No grayscale. */
import * as THREE from 'three';

export const ASSET_URL = './assets/maddox-face.jpg';

export const MADDOX_FACE_PALETTE_16 = [
  '#101014', // 0 deep outline black
  '#2a1a12', // 1 dark brown outline
  '#5b351f', // 2 warm shadow brown
  '#8e5a35', // 3 tan shadow
  '#c9854e', // 4 warm mid skin
  '#f0b27a', // 5 peach skin
  '#ffd2a3', // 6 light skin highlight
  '#fff0d2', // 7 bright skin highlight
  '#7b4a12', // 8 dark blonde hair shadow
  '#b97419', // 9 golden hair mid
  '#f0b635', // 10 bright blonde hair
  '#ffe27a', // 11 hair highlight
  '#143a5a', // 12 dark blue eye
  '#2f78a8', // 13 bright blue eye
  '#d96b78', // 14 pink lips/cheeks
  '#ffffff'  // 15 eye shine/highlight
];

export const PALETTE16 = MADDOX_FACE_PALETTE_16;

/* Relief depth factor per palette index for the 3D monument: dark outlines
   sit shallow, midtones medium, highlights raised forward. */
export const DEPTH_BY_INDEX = [
  0.5, 0.55, 0.8, 0.9,   // outlines / shadow browns
  1.25, 1.4, 1.55, 1.7,  // skin tones
  1.0, 1.15, 1.35, 1.6,  // hair tones
  0.7, 0.85,             // blue eyes
  1.3, 1.95              // pink lips, white shine
];

const PAL_RGB = PALETTE16.map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)
]);

function nearest(r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 16; i++) {
    const p = PAL_RGB[i];
    const d = (r - p[0]) ** 2 * 0.30 + (g - p[1]) ** 2 * 0.59 + (b - p[2]) ** 2 * 0.11;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

let _img = null; // decoded source, once

async function loadImage() {
  if (_img) return _img;
  const resp = await fetch(ASSET_URL);
  if (!resp.ok) throw new Error('asset load failed: ' + ASSET_URL);
  const blob = await resp.blob();
  _img = await createImageBitmap(blob).catch(() => new Promise((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error('asset decode failed'));
    el.src = URL.createObjectURL(blob);
  }));
  return _img;
}

/* Draw the source to a work canvas, cropping around the head: border pixels
   are background, so keep the bbox of pixels whose color differs from the
   border's average color, padded generously so the full head survives. */
function faceCrop(img) {
  const W = Math.min(480, img.width);
  const H = Math.max(1, Math.round(W * img.height / img.width));
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const ctx = full.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  let bx = 0, by = 0, bz = 0, bn = 0;
  const push = (x, y) => { const p = at(x, y); bx += p[0]; by += p[1]; bz += p[2]; bn++; };
  for (let x = 0; x < W; x += 4) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y += 4) { push(0, y); push(W - 1, y); }
  bx /= bn; by /= bn; bz /= bn;
  const far = (x, y) => { const p = at(x, y); return (p[0] - bx) ** 2 + (p[1] - by) ** 2 + (p[2] - bz) ** 2 > 45 * 45; };
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (!far(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 <= x0 || y1 <= y0) return { canvas: full, sx: 0, sy: 0, sw: W, sh: H };
  const padX = (x1 - x0) * 0.08, padY = (y1 - y0) * 0.08;
  const sx = Math.max(0, Math.floor(x0 - padX));
  const sy = Math.max(0, Math.floor(y0 - padY));
  const sw = Math.min(W - sx, Math.ceil(x1 - x0 + padX * 2));
  const sh = Math.min(H - sy, Math.ceil(y1 - y0 + padY * 2));
  return { canvas: full, sx, sy, sw, sh };
}

/* { w, h, cells:Uint8Array } — the head resampled to `cols` blocks wide
   (height follows the crop's aspect), Floyd-Steinberg dithered across the
   16-color palette only. */
export async function faceMosaic(cols) {
  const img = await loadImage();
  const crop = faceCrop(img);
  const gw = Math.max(8, cols | 0);
  const gh = Math.max(8, Math.round(gw * crop.sh / crop.sw));
  const small = document.createElement('canvas');
  small.width = gw; small.height = gh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(crop.canvas, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, gw, gh);
  const data = sctx.getImageData(0, 0, gw, gh).data;
  const cells = new Uint8Array(gw * gh);
  const f = new Float32Array(gw * gh * 3);
  for (let i = 0, p = 0; i < gw * gh; i++, p += 4) {
    f[i * 3] = data[p]; f[i * 3 + 1] = data[p + 1]; f[i * 3 + 2] = data[p + 2];
  }
  const errTo = (x, y, e0, e1, e2, k) => {
    if (x < 0 || x >= gw || y < 0 || y >= gh) return;
    const j = (y * gw + x) * 3;
    f[j] += e0 * k; f[j + 1] += e1 * k; f[j + 2] += e2 * k;
  };
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x, j = i * 3;
      const r = Math.max(0, Math.min(255, f[j]));
      const g = Math.max(0, Math.min(255, f[j + 1]));
      const b = Math.max(0, Math.min(255, f[j + 2]));
      const ci = nearest(r, g, b);
      cells[i] = ci;
      const p = PAL_RGB[ci];
      const e0 = r - p[0], e1 = g - p[1], e2 = b - p[2];
      errTo(x + 1, y, e0, e1, e2, 7 / 16);
      errTo(x - 1, y + 1, e0, e1, e2, 3 / 16);
      errTo(x, y + 1, e0, e1, e2, 5 / 16);
      errTo(x + 1, y + 1, e0, e1, e2, 1 / 16);
    }
  }
  return { w: gw, h: gh, cells };
}

/* Welcome-dialog portrait: every mosaic cell drawn as one brick cell, plus
   the exact 16-color palette strip underneath. */
export async function bannerTexture() {
  const m = await faceMosaic(96);
  const BR = 10;
  const sw = 40, gap = 6, perRow = 8, stripRows = 2;
  const total = perRow * sw + (perRow - 1) * gap;
  const W = Math.max(BR * m.w, total + 24);
  const H = BR * m.h + 66 + 26 + stripRows * (sw + gap);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241f1d';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd2a3';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M A D D O X   B L O X', W / 2, 32);
  ctx.fillStyle = '#b9a894';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('welcome, builder — 16 vibrant brick colors', W / 2, 54);

  const ox = (W - BR * m.w) / 2, oy = 66;
  for (let gy = 0; gy < m.h; gy++) {
    for (let gx = 0; gx < m.w; gx++) {
      const ci = m.cells[gy * m.w + gx];
      const x = ox + gx * BR, y = oy + gy * BR;
      ctx.fillStyle = PALETTE16[ci];
      ctx.fillRect(x, y, BR, BR);
      // bevel + joint so each cell reads as an individual brick
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 1, y + 1, BR - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y + BR - 1, BR, 1);
      ctx.fillRect(x + BR - 1, y, 1, BR);
    }
  }
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  ctx.strokeRect(ox - 4, oy - 4, m.w * BR + 8, m.h * BR + 8);

  for (let i = 0; i < 16; i++) {
    const row = (i / perRow) | 0, col = i % perRow;
    const x = (W - total) / 2 + col * (sw + gap);
    const y = oy + m.h * BR + 18 + row * (sw + gap);
    ctx.fillStyle = PALETTE16[i];
    ctx.fillRect(x, y, sw, sw);
    ctx.strokeStyle = '#00000066';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, sw - 1, sw - 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, url: canvas.toDataURL('image/png'), dispose: () => tex.dispose(), mosaic: m };
}

/* 3D block mosaic: (gx,gy) -> world x/y; each cell becomes one block whose
   palette color drives its material and whose role depth (DEPTH_BY_INDEX)
   drives its forward extrusion, producing a relief head, not a flat wall. */
export function instancedMosaicMesh(m, cells, size, depthScale, yBase = 0, flipX = false) {
  const perColor = Array.from({ length: 16 }, () => []);
  for (const [gx, gy, ci] of cells) perColor[ci].push(flipX ? m.w - 1 - gx : gx, gy);
  const box = new THREE.BoxGeometry(size, size, size);
  const group = new THREE.Group();
  const geos = [];
  const mtx = new THREE.Matrix4();
  for (let ci = 0; ci < 16; ci++) {
    const list = perColor[ci];
    if (!list.length) continue;
    const f = DEPTH_BY_INDEX[ci];
    const inst = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
      color: parseInt(PALETTE16[ci].slice(1), 16), roughness: 0.45, metalness: 0.02
    }), list.length / 2);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const depth = f * size * depthScale;
    for (let i = 0, n = 0; i < list.length; i += 2, n++) {
      mtx.makeScale(1, 1, depth / size);
      // backs flush at local z=0; brighter roles protrude further forward
      mtx.setPosition(
        (list[i] - (m.w - 1) / 2) * size,
        (m.h - 1 - list[i + 1]) * size + yBase,
        depth / 2
      );
      inst.setMatrixAt(n, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    geos.push(inst.geometry);
  }
  group.userData.geos = geos;
  group.userData.dispose = () => {
    box.dispose();
    for (const g of geos) g.dispose();
    group.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
  };
  return group;
}
