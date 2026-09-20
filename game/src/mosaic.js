/* The one source image asset: /assets/maddox-face-8color.png.
   Everything derived from it (welcome banner, giant monument, portal plaque)
   is quantized onto exactly these 8 palette colors. */
import * as THREE from 'three';

export const ASSET_URL = './assets/maddox-face-8color.png';

export const PALETTE = [
  '#f0c18d', // 0 skin
  '#c5875d', // 1 skin shadow
  '#301e14', // 2 hair dark brown
  '#1c1d1e', // 3 near-black
  '#1c1c1c', // 4 black (background/majority)
  '#1c1c1b', // 5 near-black B
  '#1c1413', // 6 warm near-black
  '#120e0e'  // 7 darkest
];

const PAL_RGB = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)
]);

let _src = null; // { w, h, idx:Uint8Array palette indices, canvas } — one decode per load

/* Manual decode of the indexed PNG: exact palette indices, no browser color
   management. Falls back to a canvas draw + quantization for other formats. */
async function decodeIndexPng(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const dv = new DataView(buf.buffer);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('not png');
  let p = 8, w = 0, h = 0, plte = null, idat = [], bd = 0, ct = 0;
  while (p + 8 <= buf.length) {
    const len = dv.getUint32(p); const type = dv.getUint32(p + 4); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 0x49484452) {
      w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); bd = buf[p + 16]; ct = buf[p + 17];
    } else if (type === 0x504c5445) plte = data;
    else if (type === 0x49444154) idat.push(data);
    p += 12 + len;
  }
  if (ct !== 3 || bd !== 8 || !plte) throw new Error('not an 8-bit indexed png');
  const total = idat.reduce((a, c) => a + c.length, 0);
  const comp = new Uint8Array(total); let o = 0;
  for (const c of idat) { comp.set(c, o); o += c.length; }
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(comp); writer.close();
  const raw = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  const stride = w;
  const idx = new Uint8Array(w * h);
  let prev = new Uint8Array(stride);
  let pos = 0;
  const paeth = (a, b, c) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 1 ? line[x - 1] : 0, b = prev[x], c = x >= 1 ? prev[x - 1] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) line[x] = (line[x] + paeth(a, b, c)) & 255;
      idx[y * w + x] = line[x];
    }
    prev = line.slice();
  }
  // canvas copy at native size (exact palette RGB), used by the banner
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    img.data[i * 4] = plte[v * 3]; img.data[i * 4 + 1] = plte[v * 3 + 1];
    img.data[i * 4 + 2] = plte[v * 3 + 2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { w, h, idx, canvas };
}

function canvasFallback(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.max(1, img.naturalWidth), h = Math.max(1, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      let data;
      try { data = ctx.getImageData(0, 0, w, h); } catch (e) { reject(e); return; }
      const idx = new Uint8Array(w * h);
      for (let i = 0; i < idx.length; i++) {
        idx[i] = nearest(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2]);
      }
      resolve({ w, h, idx, canvas });
    };
    img.onerror = () => reject(new Error('asset load failed: ' + url));
    img.src = url;
  });
}

export async function loadMosaicAsset() {
  if (_src) return Promise.resolve(_src);
  try { _src = await decodeIndexPng(ASSET_URL); }
  catch (e) { _src = await canvasFallback(ASSET_URL); }
  return _src;
}

function nearest(r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 8; i++) {
    const p = PAL_RGB[i];
    const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/* Quantized low-res cell grid of the asset: { w, h, cells:Uint8Array of 0..7 }
   sampled in image orientation (row 0 = top of the image). Each cell takes the
   majority palette index of its source block, so colors stay exact. */
export async function mosaicCells(cols) {
  const s = await loadMosaicAsset();
  const ratio = s.h / s.w;
  const gw = Math.max(8, cols | 0);
  const gh = Math.max(4, Math.round(gw * ratio));
  const cells = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * s.w / gw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * s.w / gw));
      const y0 = Math.floor(gy * s.h / gh), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * s.h / gh));
      const tally = new Uint32Array(8);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) tally[s.idx[y * s.w + x]]++;
      let best = 4;
      for (let i = 0; i < 8; i++) if (tally[i] > tally[best]) best = i;
      cells[gy * gw + gx] = best;
    }
  }
  return { w: gw, h: gh, cells };
}

/* Welcome-dialog banner: a wide canvas texture built from the 8-color asset
   plus its exact palette swatches. Returns { tex, url, dispose }. */
export async function bannerTexture() {
  const src = await loadMosaicAsset();
  const BR = 8; // mosaic cell size in px: the banner is literally brick cells
  const cols = 90, padX = 16;
  const sw = 46, gap = 10;
  const total = 8 * sw + 7 * gap;
  const W = Math.max(BR * cols + padX * 2, total + padX * 2);
  const imgW = BR * cols, imgH = Math.round(imgW * src.h / src.w);
  const H = 108 + imgH + 74;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241f1d';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f0c18d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M A D D O X   B L O X', W / 2, 36);
  ctx.fillStyle = '#8f857c';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('welcome, builder — one face, eight brick colors', W / 2, 58);

  // majority palette index per BRpx block, drawn as one brick cell each
  const cellIdx = new Uint8Array(cols * (imgH / BR | 0));
  const rows = imgH / BR | 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.floor(gx * src.w / cols), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * src.w / cols));
      const y0 = Math.floor(gy * src.h / rows), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * src.h / rows));
      const tally = new Uint32Array(8);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) tally[src.idx[y * src.w + x]]++;
      let best = 0;
      for (let i = 1; i < 8; i++) if (tally[i] > tally[best]) best = i;
      cellIdx[gy * cols + gx] = best;
    }
  }
  const ox = (W - imgW) / 2, oy = 78;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const ci = cellIdx[gy * cols + gx];
      const x = ox + gx * BR, y = oy + gy * BR;
      ctx.fillStyle = PALETTE[ci];
      ctx.fillRect(x, y, BR, BR);
      // 1px brick joints in the darkest palette color: joints stay on-palette
      ctx.fillStyle = PALETTE[7];
      ctx.fillRect(x + BR - 1, y, 1, BR);
      ctx.fillRect(x, y + BR - 1, BR, 1);
    }
  }
  ctx.strokeStyle = '#f0c18d';
  ctx.lineWidth = 3;
  ctx.strokeRect(ox - 4, oy - 4, imgW + 8, rows * BR + 8);

  for (let i = 0; i < 8; i++) {
    const x = (W - total) / 2 + i * (sw + gap);
    ctx.fillStyle = PALETTE[i];
    ctx.fillRect(x, H - 64, sw, sw);
    ctx.strokeStyle = '#00000055';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, H - 63.5, sw - 1, sw - 1);
    ctx.fillStyle = '#cfc6bd';
    ctx.font = '10px monospace';
    ctx.fillText(PALETTE[i].slice(1), x + sw / 2, H - 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, url: canvas.toDataURL('image/png'), dispose: () => tex.dispose() };
}

/* Instanced box-grid mesh: (gx,gy) cell coords map to world (x = gx*size,
   y = (gh-1-gy)*size), z = depth. Only cells listed in `cells` become bricks.
   Merged per palette color into one mesh. */
export function instancedMosaicMesh(m, cells, size, depth, yBase = 0, flipX = false) {
  const perColor = Array.from({ length: 8 }, () => []);
  for (const [gx, gy, ci] of cells) perColor[ci].push(flipX ? m.w - 1 - gx : gx, gy);
  const box = new THREE.BoxGeometry(size, size, depth);
  const group = new THREE.Group();
  const geos = [];
  for (let ci = 0; ci < 8; ci++) {
    const list = perColor[ci];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({
      color: parseInt(PALETTE[ci].slice(1), 16), roughness: 0.5, metalness: 0.02
    }), list.length / 2);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < list.length; i += 2) {
      mtx.makeTranslation((list[i] - (m.w - 1) / 2) * size, (m.h - 1 - list[i + 1]) * size + yBase, 0);
      inst.setMatrixAt(i / 2, mtx);
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
