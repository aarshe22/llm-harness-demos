/* MADDOX BLOX mosaics. The welcome banner and the giant monument render the
   SAME picture: the 8-color face portrait at assets/maddox-face-8color.png.
   The banner paints one flat square per source pixel; the monument raises one
   1x1x1 brick per source pixel, so the 3D mosaic is a direct pixel -> colored
   block translation of the live banner image. The pixel map lives in
   src/face8.js, generated 1:1 from the PNG by tools/gen-face8.js — browsers
   color-manage indexed PNGs on canvas readback, so palette indices are decoded
   offline instead of sampled back out of a canvas. No resizing, interpolation,
   dithering, or reinterpretation in either path. */
import * as THREE from 'three';
import { FACE8_PALETTE, face8Raster } from './face8.js';

export { FACE8_PALETTE, face8Raster };

const BG_INDEX = 4; // the portrait's background palette entry (#1C1C1C)

function paintPortrait(ctx, ox, oy, cell) {
  const m = face8Raster();
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      ctx.fillStyle = FACE8_PALETTE[m.cells[y * m.w + x]];
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }
}

function paletteStrip(ctx, y, W) {
  const sw = 34, gap = 8, n = FACE8_PALETTE.length;
  const total = n * sw + (n - 1) * gap;
  ctx.font = 'bold 11px ui-monospace, monospace';
  for (let i = 0; i < n; i++) {
    const x = Math.round((W - total) / 2) + i * (sw + gap);
    ctx.fillStyle = FACE8_PALETTE[i];
    ctx.fillRect(x, y, sw, sw);
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, sw - 1, sw - 1);
    ctx.fillStyle = i === 0 ? '#101014' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(FACE8_PALETTE[i].slice(1), x + sw / 2, y + sw + 14);
  }
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function wrapCanvas(canvas) {
  const tex = canvasTexture(canvas);
  return { tex, url: canvas.toDataURL('image/png'), dispose: () => tex.dispose() };
}

function bannerCanvas(cell, paint) {
  const titleH = 70, stripH = 64;
  const m = face8Raster();
  const W = m.w * cell, H = m.h * cell;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = titleH + H + stripH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#241f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd2a3';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M A D D O X   B L O X', W / 2, 32);
  ctx.fillStyle = '#b9a894';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('welcome, builder - 8-color brick mosaic portrait', W / 2, 56);
  paint(ctx, W, H, titleH);
  paletteStrip(ctx, titleH + H + 8, W);
  return canvas;
}

/* The welcome dialog portrait: one source pixel -> one flat cell x cell brick,
   nearest-neighbour, plus the exact 8-color palette strip the mosaic uses.
   The pixels come from face8.js — the PNG's indices + PLTE decoded 1:1 by
   tools/gen-face8.js — instead of drawImage-ing the PNG into a canvas, because
   Chromium color-manages indexed PNGs on canvas readback and shifts the 8 brick
   colors away from the exact palette values. Painting from the decoded raster
   keeps banner and monument pixel-identical AND color-identical to the asset. */
export function welcomeTexture(src = 'assets/maddox-face-8color.png', cell = 4) {
  return Promise.resolve(wrapCanvas(
    bannerCanvas(cell, (ctx, W, H, titleH) => paintPortrait(ctx, 0, titleH, cell))
  )).then((b) => {
    const m = face8Raster();
    b.region = { x: 0, y: 70, w: m.w * cell, h: m.h * cell, cell };
    return b;
  });
}

/* Monument plaque: the same portrait, framed and captioned. Promise-shaped so
   callers can await it like the welcome texture. */
export function plaqueTexture() {
  return Promise.resolve().then(() => {
  const cell = 3, pad = 9, capH = 34;
  const m = face8Raster();
  const W = m.w * cell + pad * 2, H = m.h * cell + pad * 2 + capH;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#8f9aa8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2b3038';
  ctx.fillRect(pad - 3, pad - 3, m.w * cell + 6, m.h * cell + 6);
  paintPortrait(ctx, pad, pad, cell);
  ctx.fillStyle = '#f2f5f8';
  ctx.font = `bold ${capH - 12}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('M A D D O X   B L O X   ·   1 BRICK PER PIXEL', W / 2, H - 12);
  return wrapCanvas(canvas);
  });
}

/* The monument's pixel map IS the live banner image: one brick per pixel,
   background included, no cropping, no resampling. Cached. */
let _monumentMosaic = null;
export function monumentMosaic() {
  if (!_monumentMosaic) {
    const m = face8Raster();
    _monumentMosaic = { w: m.w, h: m.h, cells: m.cells, srcX: 0, srcY: 0 };
  }
  return _monumentMosaic;
}

/* One 1x1x1 brick per source pixel, every brick the same size, backs flush at
   local z=0 and protruding exactly one block toward the viewer. Bricks group
   per palette color, so the mosaic is a handful of InstancedMeshes rather than
   one Object3D per pixel. */
export function instancedMosaicMesh(m, size, flipX = false, palette = FACE8_PALETTE) {
  const perColor = Array.from({ length: palette.length }, () => []);
  for (let gy = 0; gy < m.h; gy++) {
    for (let gx = 0; gx < m.w; gx++) {
      perColor[m.cells[gy * m.w + gx]].push(flipX ? m.w - 1 - gx : gx, gy);
    }
  }
  const box = new THREE.BoxGeometry(size, size, size);
  const group = new THREE.Group();
  const mtx = new THREE.Matrix4();
  const meshes = [];
  for (let ci = 0; ci < palette.length; ci++) {
    const list = perColor[ci];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
      color: parseInt(palette[ci].slice(1), 16), roughness: 0.45, metalness: 0.02
    }), list.length / 2);
    // 57,600 bricks as a shallow wall relief: receive shadows yes, cast no —
    // the 0.26-unit protrusion casts nothing worth a doubled shadow pass
    inst.castShadow = false;
    inst.receiveShadow = true;
    for (let i = 0, n = 0; i < list.length; i += 2, n++) {
      mtx.identity();
      mtx.setPosition(
        (list[i] - (m.w - 1) / 2) * size,
        (m.h - 1 - list[i + 1]) * size,
        size / 2
      );
      inst.setMatrixAt(n, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    meshes.push(inst);
  }
  group.userData.mosaic = m;
  group.userData.cell = size;
  group.userData.dispose = () => {
    box.dispose();
    for (const g of meshes) g.dispose();
    group.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
  };
  return group;
}
