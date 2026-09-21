/* Regenerates src/face8.js from assets/maddox-face-8color.png.
 *
 * The welcome banner paints that PNG directly, and the 3D monument must be a
 * literal pixel -> colored-block translation of it. Canvas getImageData on
 * indexed PNGs is color-managed by browsers (the file carries an iCCP chunk)
 * and returns off-palette pixels, so we decode the IDAT stream here and ship
 * the palette indices verbatim in src/face8.js.
 *
 * Run from the game/ directory:  node tools/gen-face8.js
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const SRC = 'assets/maddox-face-8color.png';
const OUT = 'src/face8.js';

const buf = fs.readFileSync(SRC);
let off = 8;
let ihdr = null, plte = null;
const idat = [];
while (off + 8 <= buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.slice(off + 8, off + 8 + len);
  if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9] };
  else if (type === 'PLTE') plte = data;
  else if (type === 'IDAT') idat.push(data);
  off += 12 + len;
}
if (!ihdr || ihdr.ct !== 3 || (ihdr.depth !== 4 && ihdr.depth !== 8)) throw new Error('expected an indexed PNG');
if (!plte || !idat.length) throw new Error('missing PLTE/IDAT');

const { w, h, depth } = ihdr;
const raw = zlib.inflateSync(Buffer.concat(idat));
const rowBytes = Math.ceil((w * depth) / 8);
const px = new Uint8Array(w * h);
let pos = 0;
for (let y = 0; y < h; y++) {
  const f = raw[pos++];
  if (f > 4) throw new Error('bad filter ' + f + ' on row ' + y);
  const line = raw.slice(pos, pos + rowBytes); pos += rowBytes;
  const prev = y ? px.subarray((y - 1) * w) : null;
  const cur = px.subarray(y * w);
  for (let x = 0; x < w; x++) {
    let v = depth === 4 ? ((line[x >> 1] >> ((x & 1) ? 4 : 0)) & 15) : line[x];
    const a = x >= 1 ? cur[x - 1] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= 1 ? prev[x - 1] : 0;
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    cur[x] = v & ((1 << depth) - 1);
  }
}
if (pos !== raw.length) throw new Error('IDAT length mismatch (consumed ' + pos + ' of ' + raw.length + ')');

const palette = [];
for (let i = 0; i + 2 < plte.length; i += 3) {
  palette.push('#' + [...plte.slice(i, i + 3)].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join(''));
}
for (let i = 0; i < px.length; i++) {
  if (px[i] >= palette.length) throw new Error('index ' + px[i] + ' out of palette at pixel ' + i);
}
const rows = [];
for (let y = 0; y < h; y++) {
  let s = '';
  for (let x = 0; x < w; x++) s += px[y * w + x].toString(16);
  rows.push(s);
}

const out = `/* GENERATED — do not hand-edit. Source of truth: assets/maddox-face-8color.png
 * (${w}x${h}, ${depth}-bit indexed, ${palette.length} palette entries). One character = one
 * source pixel = one mosaic block, so the 3D monument is a literal pixel->block
 * translation of the image the welcome banner paints. Regenerate with
 * \`node tools/gen-face8.js\` from the game/ directory. */
export const FACE8_W = ${w};
export const FACE8_H = ${h};

/* Palette in PNG PLTE order. */
export const FACE8_PALETTE = [
${palette.map((p) => `  '${p}'`).join(',\n')}
];

/* Row 0 = top scanline, column 0 = left pixel; hex digit = palette index. */
export const FACE8_RASTER = [
${rows.map((r) => `  '${r}'`).join(',\n')}
];

let _raster = null;
export function face8Raster() {
  if (_raster) return _raster;
  if (FACE8_RASTER.length !== FACE8_H) throw new Error('FACE8 raster must be ' + FACE8_H + ' rows');
  const cells = new Uint8Array(FACE8_W * FACE8_H);
  for (let y = 0; y < FACE8_H; y++) {
    const row = FACE8_RASTER[y];
    if (row.length !== FACE8_W) throw new Error('FACE8 row ' + y + ': expected ' + FACE8_W + ' cols, got ' + row.length);
    for (let x = 0; x < FACE8_W; x++) {
      const ci = parseInt(row[x], 16);
      if (!(ci >= 0 && ci < FACE8_PALETTE.length)) throw new Error('FACE8 row ' + y + ' col ' + x + ": invalid pixel '" + row[x] + "'");
      cells[y * FACE8_W + x] = ci;
    }
  }
  _raster = { w: FACE8_W, h: FACE8_H, cells };
  return _raster;
}
`;
fs.writeFileSync(OUT, out);
console.log('wrote ' + OUT + ': ' + w + 'x' + h + ' (' + (w * h) + ' pixels), ' + palette.length + ' colors');
console.log('palette:', palette.join(' '));
