/* Voxel Golf — core engine. Units: yards, seconds. */
(function () {
'use strict';

/* ============================== math utils ============================== */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash2(x, y, s) {
  let h = x * 374761393 + y * 668265263 + s * 1442695041;
  h = (h ^ (h >> 13)) >>> 0; h = (h * 1274126177) >>> 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, s) { return 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 9) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 17); }
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd) { return Math.sqrt(-2 * Math.log(1 - rnd() * 0.999999 + 0.0000001)) * Math.cos(6.2831853 * rnd()); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 100000; }

/* ============================== classes ============================== */
const CLS = { NAT: 0, ROUGH: 1, FRW: 2, TEE: 3, GRN: 4, FRG: 5, BNK: 6, WTR: 7, FOR: 8, OUT: 99 };
const LIE_NAME = { 0: 'NATIVE', 1: 'ROUGH', 2: 'FAIRWAY', 3: 'TEE', 4: 'GREEN', 5: 'FRINGE', 6: 'SAND', 7: 'WATER', 8: 'ROUGH', 99: 'OUT OF BOUNDS' };
const LIE_CLASS = { 0: 'native', 1: 'rough', 2: 'fair', 3: 'fair', 4: 'green', 5: 'green', 6: 'bunker', 7: 'water', 8: 'rough', 99: 'water' };

const CLUBS = [
  { id: 'DR', label: 'DR', yd: 240, loft: 12 },
  { id: '3W', label: '3W', yd: 224, loft: 14 },
  { id: '5W', label: '5W', yd: 209, loft: 16 },
  { id: '3i', label: '3i', yd: 199, loft: 19 },
  { id: '4i', label: '4i', yd: 190, loft: 21 },
  { id: '5i', label: '5i', yd: 180, loft: 23 },
  { id: '6i', label: '6i', yd: 170, loft: 26 },
  { id: '7i', label: '7i', yd: 160, loft: 30 },
  { id: '8i', label: '8i', yd: 150, loft: 34 },
  { id: '9i', label: '9i', yd: 140, loft: 38 },
  { id: 'PW', label: 'PW', yd: 127, loft: 42 },
  { id: 'GW', label: 'GW', yd: 112, loft: 46 },
  { id: 'LW', label: 'LW', yd: 95, loft: 52 },
  { id: 'PT', label: 'PUTT', yd: 30, loft: 3 },
];
const CLUB_IX = {}; CLUBS.forEach((c, i) => CLUB_IX[c.id] = i);

/* ============================== ballistics ============================== */
const G = 10.7;
const K_DRAG = 0.0022;
function simulateCarry(v0, loftr, dt) {
  let x = 0, y = 1.0;
  const c = Math.cos(loftr), s = Math.sin(loftr);
  let vx = v0 * c, vy = v0 * s;
  while (!(y <= 0 && vy <= 0)) {
    const sp = Math.hypot(vx, vy);
    vx -= K_DRAG * sp * vx * dt;
    vy -= (G + K_DRAG * sp * vy) * dt;
    x += vx * dt; y += vy * dt;
    if (y < -30 || x > 1400) break;
  }
  return x;
}
function solveV0(targetYd, loftr) {
  let lo = 2, hi = 160;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (simulateCarry(mid, loftr, 1 / 90) < targetYd) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/* dynamic loft: clubs launch a bit higher than static spec */
function effLoft(club) { return (club.id === 'PT' ? club.loft : club.loft + 4) * Math.PI / 180; }
const _v0cache = new Map();
function v0For(clubId, targetYd) {
  const key = clubId + '|' + Math.round(targetYd);
  let v = _v0cache.get(key);
  if (v === undefined) {
    const club = CLUBS[CLUB_IX[clubId]];
    v = solveV0(clamp(targetYd, 5, 340), effLoft(club));
    _v0cache.set(key, v);
  }
  return v;
}

/* ============================== polygon raster ============================== */
function rasterPoly(mask, W, H, flat, x0, z0, cell, val) {
  const n = flat.length / 2;
  let zmin = 1e9, zmax = -1e9;
  for (let i = 0; i < n; i++) { const z = flat[i * 2 + 1]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
  const r0 = Math.max(0, Math.floor((zmin - z0) / cell)), r1 = Math.min(H - 1, Math.floor((zmax - z0) / cell));
  const xs = [];
  for (let r = r0; r <= r1; r++) {
    const y = z0 + (r + 0.5) * cell;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const ax = flat[i * 2], az = flat[i * 2 + 1], bx = flat[((i + 1) % n) * 2], bz = flat[((i + 1) % n) * 2 + 1];
      if ((az > y) !== (bz > y)) xs.push(ax + (y - az) / (bz - az) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.floor((xs[k] - x0) / cell)), c1 = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / cell));
      for (let c = c0; c <= c1; c++) mask[r * W + c] = val;
    }
  }
}
function pointInPoly(flat, x, y) {
  const n = flat.length / 2; let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2], zi = flat[i * 2 + 1], xj = flat[j * 2], zj = flat[j * 2 + 1];
    if ((zi > y) !== (zj > y) && x < (xj - xi) * (y - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function polyCentroid(flat) {
  const n = flat.length / 2; let x = 0, z = 0;
  for (let i = 0; i < n; i++) { x += flat[i * 2]; z += flat[i * 2 + 1]; }
  return [x / n, z / n];
}
function polyArea(flat) {
  const n = flat.length / 2; let a = 0;
  for (let i = 0; i < n; i++) {
    const x1 = flat[i * 2], z1 = flat[i * 2 + 1], x2 = flat[((i + 1) % n) * 2], z2 = flat[((i + 1) % n) * 2 + 1];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}
function nearestOnPoly(flat, x, y) {
  const n = flat.length / 2;
  let bx = flat[0], bz = flat[1], bd = 1e18;
  for (let i = 0; i < n; i++) {
    const ax = flat[i * 2], az = flat[i * 2 + 1], cx = flat[(i + 1) % n * 2], cz = flat[(i + 1) % n * 2 + 1];
    const dx = cx - ax, dz = cz - az, L2 = dx * dx + dz * dz;
    let t = L2 ? ((x - ax) * dx + (y - az) * dz) / L2 : 0; t = clamp(t, 0, 1);
    const px = ax + t * dx, pz = az + t * dz, d2 = (px - x) * (px - x) + (pz - y) * (pz - y);
    if (d2 < bd) { bd = d2; bx = px; bz = pz; }
  }
  return [bx, bz];
}

/* ============================== hole model ============================== */
const CELL = 2;

class HoleModel {
  constructor(course, holeNum) {
    const T = this._t = {}; const now = () => performance.now();
    let _s = now(); T.mark = k => { T[k] = Math.round(now() - _s); _s = now(); };
    this.course = course;
    this.holeNum = holeNum;
    const hd = course.holes[holeNum];
    this.par = hd.par || 4;
    const polys = [hd.tee, hd.fairway, hd.green, hd.bunker, hd.water].filter(a => a && a.length);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, waterA = 0;
    polys.forEach(list => list.forEach(f => {
      for (let i = 0; i < f.length; i += 2) {
        if (f[i] < x0) x0 = f[i]; if (f[i] > x1) x1 = f[i];
        if (f[i + 1] < z0) z0 = f[i + 1]; if (f[i + 1] > z1) z1 = f[i + 1];
      }
    }));
    (hd.water || []).forEach(w => waterA += polyArea(w));
    this.rawCx = (x0 + x1) / 2; this.rawCz = (z0 + z1) / 2;
    const pad = 72;
    x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
    this.x0 = x0; this.z0 = z0;
    const CELL = this.CELL = ((x1 - x0) * (z1 - z0)) > 3.2e6 ? 4 : 2;
    this.W = Math.ceil((x1 - x0) / CELL); this.H = Math.ceil((z1 - z0) / CELL);
    const W = this.W, H = this.H, N = W * H;
    this.seed = hashStr(course.id) * 17 + holeNum * 101;

    // foreign polygons (other holes)
    this.foreign = [];
    Object.keys(course.holes).forEach(k => {
      if (+k === holeNum) return;
      const o = course.holes[k];
      ['tee', 'fairway', 'green', 'bunker'].forEach(t => (o[t] || []).forEach(f => this.foreign.push(f)));
    });

    T.mark('alloc');
    const cls = this.cls = new Uint8Array(N);
    this.foreign.forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.FOR));
    (hd.tee || []).forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.TEE));
    (hd.fairway || []).forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.FRW));
    (hd.green || []).forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.GRN));
    (hd.bunker || []).forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.BNK));
    (hd.water || []).forEach(f => rasterPoly(cls, W, H, f, x0, z0, CELL, CLS.WTR));

    T.mark('raster');
    // corridor mask (playable surfaces)
    const corr = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const c = cls[i];
      if (c === CLS.TEE || c === CLS.FRW || c === CLS.GRN || c === CLS.BNK || c === CLS.WTR) corr[i] = 1;
    }
    // BFS distance to corridor — rough & terrain falloff
    const cd = this.cdist = new Uint16Array(N).fill(40000);
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (corr[i]) { cd[i] = 0; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++], d = cd[i], r = (i / W) | 0, c = i % W;
      const nd = d + 1;
      if (nd > 60) continue;
      if (c > 0 && cd[i - 1] > nd) { cd[i - 1] = nd; q[qt++] = i - 1; }
      if (c < W - 1 && cd[i + 1] > nd) { cd[i + 1] = nd; q[qt++] = i + 1; }
      if (r > 0 && cd[i - W] > nd) { cd[i - W] = nd; q[qt++] = i - W; }
      if (r < H - 1 && cd[i + W] > nd) { cd[i + W] = nd; q[qt++] = i + W; }
    }
    T.mark('bfsC');
    // rough band around corridor
    for (let i = 0; i < N; i++) if (cls[i] === CLS.NAT && cd[i] <= 3) cls[i] = CLS.ROUGH;

    T.mark('fringe');
    // pin on largest green polygon
    const greens = hd.green && hd.green.length ? hd.green : null;
    if (!greens) throw new Error('hole without green');
    const bigG = greens.slice().sort((a, b) => b.length - a.length)[0];
    const gPts = bigG.map((v, i) => v);
    this.gLongA = bigG;
    let gx0 = 1e9, gx1 = -1e9, gz0 = 1e9, gz1 = -1e9;
    for (let i = 0; i < bigG.length; i += 2) {
      if (bigG[i] < gx0) gx0 = bigG[i]; if (bigG[i] > gx1) gx1 = bigG[i];
      if (bigG[i + 1] < gz0) gz0 = bigG[i + 1]; if (bigG[i + 1] > gz1) gz1 = bigG[i + 1];
    }
    this.gLong = (gx1 - gx0) > (gz1 - gz0) ? [1, 0] : [0, 1];
    this.gHalf = Math.max(5, Math.max(gx1 - gx0, gz1 - gz0) / 2);
    this.gCenter = polyCentroid(bigG);
    this.pinX = this.gCenter[0]; this.pinZ = this.gCenter[1];
    this.pinC = this.gCenter;

    T.mark('green');
    // play tee: farthest-back valid tee polygon (prefer converter's play_tee order), place ball directly on it
    const tees = hd.tee && hd.tee.length ? hd.tee : null;
    let teeCent = null, teeCellIdx = null;
    if (tees) {
      const cands = tees.map(t => polyCentroid(t))
        .sort((a, b) => (dist2(b, this.gCenter) - dist2(a, this.gCenter)));
      // if a tee centroid falls inside a foreign hole's polygons, deprioritize it
      const score = c => dist2(c, this.gCenter) - (this.foreign.some(f => pointInPoly(f, c[0], c[1])) ? 1e9 : 0);
      cands.sort((a, b) => score(b) - score(a));
      for (const c of cands) {
        const ci = this.cellOf(c[0], c[1]);
        if (ci == null) continue;
        let found = null;
        const r0 = (ci / W) | 0, c0 = ci % W;
        for (let rad = 0; rad <= 5 && found == null; rad++) {
          for (let r = Math.max(0, r0 - rad); r <= Math.min(H - 1, r0 + rad) && found == null; r++)
            for (let c = Math.max(0, c0 - rad); c <= Math.min(W - 1, c0 + rad) && found == null; c++) {
              const j = r * W + c;
              if (cls[j] === CLS.TEE) found = j;
              else if (cls[j] === CLS.FRW && found == null && rad >= 3) found = j;
            }
        }
        if (found != null) { teeCellIdx = found; teeCent = c; break; }
      }
      if (teeCellIdx == null) { teeCent = cands[0]; teeCellIdx = this.cellOf(teeCent[0], teeCent[1]); }
    }
    if (teeCellIdx == null) {
      const vx = this.rawCx - this.gCenter[0], vz = this.rawCz - this.gCenter[1];
      const vl = Math.hypot(vx, vz) || 1;
      const off = Math.min(220, vl * 0.85 + 80);
      teeCent = [this.gCenter[0] + vx / vl * off, this.gCenter[1] + vz / vl * off];
      teeCellIdx = this.cellOf(teeCent[0], teeCent[1]) != null
        ? this.cellOf(teeCent[0], teeCent[1])
        : this.cellOf(this.rawCx, this.rawCz);
      this.yardsSynth = true;
    }
    this.teeCell = teeCellIdx;
    this.teeX = this.x2(teeCellIdx % W) + CELL / 2;
    this.teeZ = this.z2((teeCellIdx / W) | 0) + CELL / 2;
    this.yards = Math.max(40, Math.round(Math.hypot(this.teeX - this.pinX, this.teeZ - this.pinZ)));

    T.mark('tee');
    // corridor distance field from pin (Dijkstra)
    const walk = new Uint8Array(N), wcost = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (corr[i]) { walk[i] = 1; wcost[i] = CELL; }
      else if (cd[i] <= 3 && cls[i] !== CLS.WTR) { walk[i] = 1; wcost[i] = CELL * 2.2; }
    }
    T.mark('walk0');
    // bridge disconnected corridor components (some traces have gaps between polygons)
    const comp = new Int32Array(N).fill(-1);
    const comps = [];
    {
      const q2 = new Int32Array(N);
      for (let s = 0; s < N; s++) {
        if (!corr[s] || comp[s] >= 0) continue;
        const list = [];
        let h2 = 0;
        list.push(s); comp[s] = comps.length; q2[0] = s;
        let t2 = 1;
        while (h2 < t2) {
          const i = q2[h2++]; list.push(i);
          const r = (i / W) | 0, c = i % W;
          if (c > 0 && corr[i - 1] && comp[i - 1] < 0) { comp[i - 1] = comps.length; q2[t2++] = i - 1; }
          if (c < W - 1 && corr[i + 1] && comp[i + 1] < 0) { comp[i + 1] = comps.length; q2[t2++] = i + 1; }
          if (r > 0 && corr[i - W] && comp[i - W] < 0) { comp[i - W] = comps.length; q2[t2++] = i - W; }
          if (r < H - 1 && corr[i + W] && comp[i + W] < 0) { comp[i + W] = comps.length; q2[t2++] = i + W; }
        }
        list.shift();
        let br0 = 1e9, br1 = -1e9, bc0 = 1e9, bc1 = -1e9;
        for (const i of list) {
          const r = (i / W) | 0, c = i % W;
          if (r < br0) br0 = r; if (r > br1) br1 = r;
          if (c < bc0) bc0 = c; if (c > bc1) bc1 = c;
        }
        list.bbox = [br0, br1, bc0, bc1];
        comps.push(list);
        this._comps = comps.length;
      }
    }
    const gcPin = this.cellOf(this.pinX, this.pinZ);
    const pinComp = gcPin != null && comp[gcPin] >= 0 ? comp[gcPin] : (comps.length ? comps.map((list, i) => ({ i, n: list.length })).sort((a, b) => b.n - a.n)[0].i : -1);
    if (pinComp >= 0 && comps.length > 1) {
      // candidate pairs sorted by bbox proximity — refine only the best crossing pair per merge
      const bboxD2 = (a, b) => {
        const ba = comps[a].bbox, bb = comps[b].bbox;
        const rd = Math.max(0, ba[0] - bb[1], bb[0] - ba[1]), cd2 = Math.max(0, ba[2] - bb[3], bb[2] - ba[3]);
        return rd * rd + cd2 * cd2;
      };
      const pairs = [];
      for (let i = 0; i < comps.length; i++)
        for (let j = i + 1; j < comps.length; j++)
          pairs.push({ i, j, d2: bboxD2(i, j) });
      pairs.sort((a, b) => a.d2 - b.d2);
      const active = new Set([pinComp]);
      const remaining = new Set(comps.map((_, i) => i).filter(i => i !== pinComp));
      const nearestPair = (A, B) => {
        const stpA = Math.max(1, Math.floor(A.length / 140));
        const stpB = Math.max(1, Math.floor(B.length / 140));
        let best = null;
        for (let i = 0; i < A.length; i += stpA) for (let j = 0; j < B.length; j += stpB) {
          const ai = A[i], bi = B[j];
          const dr = ((ai / W) | 0) - ((bi / W) | 0), dc = (ai % W) - (bi % W);
          const d2 = dr * dr + dc * dc;
          if (!best || d2 < best.d2) best = { a: ai, b: bi, d2 };
        }
        return best;
      };
      let guard = 0;
      while (remaining.size && guard++ < 20) {
        let pick = null;
        for (const pr of pairs) {
          const ia = active.has(pr.i), ja = active.has(pr.j);
          if (ia === ja) continue;
          if (pr.d2 > 40 * 40) break;
          pick = pr;
          break;
        }
        if (!pick) break;
        const A = comps[pick.i], B = comps[pick.j];
        const best = nearestPair(A, B);
        if (!best || best.d2 > 40 * 40) { remaining.delete(pick.i); remaining.delete(pick.j); continue; }
        const other = active.has(pick.i) ? pick.j : pick.i;
        let r = (best.a / W) | 0, c = best.a % W;
        const r1 = (best.b / W) | 0, c1 = best.b % W;
        const dr = Math.abs(r1 - r), dc = Math.abs(c1 - c), sr = r < r1 ? 1 : -1, sc = c < c1 ? 1 : -1;
        let err = dr - dc, g2 = 0;
        const mark = i3 => {
          if (i3 >= 0 && i3 < N && !walk[i3] && cls[i3] !== CLS.WTR) { walk[i3] = 1; wcost[i3] = CELL * 1.4; }
        };
        for (;;) {
          const i2 = r * W + c;
          mark(i2);
          if (c > 0) mark(i2 - 1);
          if (c < W - 1) mark(i2 + 1);
          if (r > 0) mark(i2 - W);
          if (r < H - 1) mark(i2 + W);
          if (r === r1 && c === c1) break;
          if (g2++ > 4000) break;
          const e2 = 2 * err;
          if (e2 > -dc) { err -= dc; c += sc; }
          if (e2 < dr) { err += dr; r += sr; }
        }
        active.add(other);
        remaining.delete(other);
      }
    }
    T.mark('bridge');
    const dist = this.dist = new Float64Array(N).fill(1e9);
    const gc = gcPin;
    if (gc != null) {
      const heap = new MinHeap();
      const gSeed = walk[gc] ? gc : this.nearestCorr(gc, 14);
      if (gSeed != null) { dist[gSeed] = 0; heap.push(gSeed, 0); }
      void gPts;
      while (heap.size()) {
        const i = heap.pop(); const d = dist[i];
        const r = (i / W) | 0, c = i % W;
        const nbs = [[r - 1, c, 1], [r + 1, c, 1], [r, c - 1, 1], [r, c + 1, 1],
                     [r - 1, c - 1, 1.414], [r - 1, c + 1, 1.414], [r + 1, c - 1, 1.414], [r + 1, c + 1, 1.414]];
        for (let k = 0; k < 8; k++) {
          const nr = nbs[k][0], nc = nbs[k][1], w = nbs[k][2];
          if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
          if (nr !== r && nc !== c && !(walk[r * W + nc] && walk[nr * W + c])) continue;
          const j = nr * W + nc;
          if (!walk[j]) continue;
          const nd = d + w * wcost[j];
          if (nd + 0.01 < dist[j]) { dist[j] = nd; heap.push(j, nd); }
        }
      }
    }

    T.mark('dijkstra');
    // bunker & water distance for ramps
    this.bdist = this.bfsField(cls, CLS.BNK);
    this.wdist = this.bfsField(cls, CLS.WTR);

    T.mark('bfs2');
    // play mask: near corridor or near the reachable path (covers water bodies lying off corridor)
    // auto-shrink on pathological holes so the voxel mesh stays mobile-sized
    const play = this.play = new Uint8Array(N);
    for (const rad of [30, 20, 14, 10]) {
      let count = 0;
      for (let i = 0; i < N; i++) {
        let p = cd[i] <= rad || dist[i] <= rad * 2.4;
        if (!p && (cls[i] === CLS.WTR || cls[i] === CLS.BNK)) {
          for (const nb of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const r = ((i / W) | 0) + nb[0], c = i % W + nb[1];
            if (r < 0 || c < 0 || r >= H || c >= W) continue;
            const j = r * W + c;
            if (dist[j] <= rad * 2.4 || cd[j] <= 6) { p = true; break; }
          }
        }
        play[i] = p ? 1 : 0;
        if (p) count++;
      }
      if (count <= 260000 || rad === 10) break;
    }

    T.mark('mask');
    const rnd = mulberry(this.seed * 7 + 3);
    const amp = 3 + rnd() * 9 + Math.min(6, waterA / 12000);
    this.eTee = (rnd() < 0.5 ? -1 : 1) * amp;
    this.gTilt = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.3);
    this.axis = [this.pinX - this.teeX, this.pinZ - this.teeZ];
    const al = Math.hypot(this.axis[0], this.axis[1]) || 1;
    this.axis = [this.axis[0] / al, this.axis[1] / al];
    this.axisLen = al;
    this.maxD = Math.max(1, this.yards);
    T.mark('final');
  }
  x2(cx) { return this.x0 + cx * this.CELL; }
  z2(cz) { return this.z0 + cz * this.CELL; }
  cellOf(x, z) {
    const c = Math.floor((x - this.x0) / this.CELL), r = Math.floor((z - this.z0) / this.CELL);
    if (c < 0 || r < 0 || c >= this.W || r >= this.H) return null;
    return r * this.W + c;
  }
  nearestCorr(i, maxr) {
    if (i == null) return null;
    if (this.cdist[i] === 0) return i;
    const W = this.W, r0 = (i / W) | 0, c0 = i % W;
    for (let rad = 1; rad <= maxr; rad++) {
      for (let r = Math.max(0, r0 - rad); r <= Math.min(this.H - 1, r0 + rad); r++)
        for (let c = Math.max(0, c0 - rad); c <= Math.min(this.W - 1, c0 + rad); c++) {
          if (Math.abs(r - r0) !== rad && Math.abs(c - c0) !== rad) continue;
          const j = r * W + c;
          if (this.cdist[j] === 0) return j;
        }
    }
    return null;
  }
  nearestCorrPt(x, z, maxr) { return this.nearestCorr(this.cellOf(x, z), maxr); }
  bfsField(cls, want) {
    const W = this.W, H = this.H, N = W * H;
    const f = new Uint16Array(N).fill(40000);
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (cls[i] === want) { f[i] = 0; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++], d = f[i], r = (i / W) | 0, c = i % W;
      const nd = d + 1;
      if (nd > 12) continue;
      if (c > 0 && f[i - 1] > nd) { f[i - 1] = nd; q[qt++] = i - 1; }
      if (c < W - 1 && f[i + 1] > nd) { f[i + 1] = nd; q[qt++] = i + 1; }
      if (r > 0 && f[i - W] > nd) { f[i - W] = nd; q[qt++] = i - W; }
      if (r < H - 1 && f[i + W] > nd) { f[i + W] = nd; q[qt++] = i + W; }
    }
    return f;
  }
  profileAt(x, z) {
    const i = this.cellOf(x, z);
    if (i != null && this.dist[i] < 1e8) {
      const u = clamp(1 - this.dist[i] / (this.maxD * 1.08), 0, 1);
      return this.eTee * u;
    }
    const p = clamp(((x - this.pinX) * -this.axis[0] + (z - this.pinZ) * -this.axis[1]) / this.axisLen, -0.25, 1.25);
    return this.eTee * p;
  }
  /* put ball onto playable ground near (x,z): returns {x,z} */
  resolveLie(x, z, opts) {
    opts = opts || {};
    const allow = opts.ground || opts.allow;
    let i = this.cellOf(x, z);
    if (i == null) return null;
    const c = this.cls[i];
    const bad = c === CLS.WTR || (opts.ground && (c === CLS.OUT));
    if (!bad) return { x, z };
    const W = this.W, H = this.H, r0 = (i / W) | 0, c0 = i % W;
    let best = null, bs = -1e9;
    for (let rad = 1; rad <= 12; rad++) {
      for (let r = Math.max(0, r0 - rad); r <= Math.min(H - 1, r0 + rad); r++)
        for (let c = Math.max(0, c0 - rad); c <= Math.min(W - 1, c0 + rad); c++) {
          if (Math.abs(r - r0) !== rad && Math.abs(c - c0) !== rad) continue;
          const j = r * W + c, cc = this.cls[j];
          if (cc === CLS.WTR || cc === CLS.OUT) continue;
          if (cc !== CLS.FRW && cc !== CLS.ROUGH && cc !== CLS.NAT && cc !== CLS.FRG && cc !== CLS.GRN && cc !== CLS.FOR && cc !== CLS.TEE) continue;
          const sc = (cc === CLS.FRW ? 3 : cc === CLS.ROUGH ? 1.5 : 0.3) - rad * 0.35;
          if (sc > bs) { bs = sc; best = j; }
        }
      if (best && rad > 3) break;
    }
    if (best == null) return null;
    return { x: this.x2(best % W) + this.CELL / 2, z: this.z2((best / W) | 0) + this.CELL / 2 };
  }
}
function dist2(a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]); }

class MinHeap {
  constructor() { this.ks = []; this.vs = []; }
  size() { return this.ks.length; }
  push(k, v) {
    const ks = this.ks, vs = this.vs; ks.push(k); vs.push(v);
    let i = ks.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (vs[p] <= vs[i]) break; [ks[p], ks[i]] = [ks[i], ks[p]]; [vs[p], vs[i]] = [vs[i], vs[p]]; i = p; }
  }
  pop() {
    const ks = this.ks, vs = this.vs, top = ks[0];
    const lk = ks.pop(), lv = vs.pop();
    if (ks.length) {
      ks[0] = lk; vs[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < ks.length && vs[l] < vs[m]) m = l;
        if (r < ks.length && vs[r] < vs[m]) m = r;
        if (m === i) break;
        [ks[m], ks[i]] = [ks[i], ks[m]]; [vs[m], vs[i]] = [vs[i], vs[m]]; i = m;
      }
    }
    return top;
  }
}

/* ============================== elevation ============================== */
function buildElevation(model) {
  const { W, H, cls, cdist, bdist, wdist } = model;
  const CELL = model.CELL;
  const N = W * H;
  const h = new Float32Array(N);
  const wl = new Float32Array(N);
  const s = model.seed;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c, cC = cls[i];
      const x = model.x2(c) + CELL / 2, z = model.z2(r) + CELL / 2;
      const base = model.profileAt(x, z);
      const outer = clamp((cdist[i] - 4) / 10, 0, 1);
      const far = clamp((cdist[i] - 22) / 26, 0, 1);
      let v;
      if (cC === CLS.GRN) {
        const t = ((x - model.pinX) * model.gLong[0] + (z - model.pinZ) * model.gLong[1]) / model.gHalf;
        v = model.gTilt * t + (fbm(x * 0.045, z * 0.045, s) - 0.5) * 0.2;
      } else if (cC === CLS.FRG) {
        v = 0.1 + base * 0.1 + (fbm(x * 0.03, z * 0.03, s + 2) - 0.5) * 0.4;
      } else if (cC === CLS.TEE) {
        v = base + (fbm(x * 0.05, z * 0.05, s) - 0.5) * 0.18;
      } else if (cC === CLS.FRW) {
        v = base + (fbm(x * 0.018, z * 0.018, s + 3) - 0.5) * 1.4 + (fbm(x * 0.005, z * 0.005, s + 4) - 0.5) * 3.2;
      } else if (cC === CLS.BNK) {
        const rim = bdist[i] <= 2 ? (2 - bdist[i]) * 0.3 : 0;
        v = base - 1.0 + rim;
      } else if (cC === CLS.WTR) {
        const lvl = base - 0.5; wl[i] = lvl;
        v = lvl - (wdist[i] < 4 ? (wdist[i] / 4) * 2.2 : 2.2);
      } else if (cC === CLS.ROUGH) {
        v = base * 0.92 + (fbm(x * 0.02, z * 0.02, s + 5) - 0.5) * 1.8 + outer * (fbm(x * 0.006, z * 0.006, s + 6) - 0.5) * 6;
      } else {
        v = base * 0.85 + (fbm(x * 0.011, z * 0.011, s + 1) - 0.5) * (3 + 14 * outer) +
            (fbm(x * 0.0026 + 7, z * 0.0026, s + 8) - 0.5) * (5 + 28 * far);
      }
      h[i] = v;
    }
  }
  const tmp = new Float32Array(N);
  for (let it = 0; it < 3; it++) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, cC = cls[i];
      if (cdist[i] > 46) { tmp[i] = h[i]; continue; }
      const fixed = (cC === CLS.WTR && wdist[i] >= 3) || (cC === CLS.BNK && bdist[i] >= 2) || cC === CLS.TEE;
      if (fixed) { tmp[i] = h[i]; continue; }
      const up = r > 0 ? h[i - W] : h[i], dn = r < H - 1 ? h[i + W] : h[i];
      const lf = c > 0 ? h[i - 1] : h[i], rt = c < W - 1 ? h[i + 1] : h[i];
      tmp[i] = (h[i] * 2 + up + dn + lf + rt) / 6;
    }
    h.set(tmp);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (cls[i] === CLS.WTR && wdist[i] >= 3) h[i] = wl[i] - 2.2;
    }
  }
  model.h = h; model.wl = wl;
}

/* ============================== voxel mesh ============================== */
const COL = {
  NAT_A: [0.55, 0.60, 0.30], NAT_B: [0.50, 0.52, 0.27],
  ROUGH_A: [0.24, 0.52, 0.22], ROUGH_B: [0.21, 0.46, 0.20],
  FRW_A: [0.33, 0.63, 0.30], FRW_B: [0.38, 0.68, 0.33],
  TEE: [0.36, 0.68, 0.32], GRN: [0.40, 0.76, 0.36], FRG: [0.28, 0.58, 0.26],
  BNK: [0.91, 0.83, 0.60], FOR: [0.42, 0.46, 0.28],
};
function classColor(c, x, z, ax, az, r, cD) {
  if (c === CLS.FRW) {
    const band = Math.floor(((x * ax + z * az) / 7 + (r * 0 + cD) * 0)) % 2;
    return band ? COL.FRW_A : COL.FRW_B;
  }
  if (c === CLS.GRN) return COL.GRN;
  if (c === CLS.FRG) return COL.FRG;
  if (c === CLS.TEE) return COL.TEE;
  if (c === CLS.BNK) return COL.BNK;
  if (c === CLS.ROUGH) return (hash2(x | 0, z | 0, 3) > 0.5 ? COL.ROUGH_A : COL.ROUGH_B);
  if (c === CLS.FOR) return COL.FOR;
  return (hash2(x | 0, z | 0, 11) > 0.5 ? COL.NAT_A : COL.NAT_B);
}

function buildTerrainMesh(model) {
  const { W, H, cls, h, play, wl } = model;
  const CELL = model.CELL;
  const pos = [], col = [], idx = [];
  const wpos = [], wcol = [], widx = [];
  const ax = model.axis[0], az = model.axis[1];
  function quads(bufP, bufC, bufI, arr, baseIdx, count) {
    const b = bufP.length / 3;
    for (let k = 0; k < count; k++) {
      bufP.push(arr[k * 6], arr[k * 6 + 1], arr[k * 6 + 2]);
      bufC.push(arr[k * 6 + 3], arr[k * 6 + 4], arr[k * 6 + 5]);
    }
    for (let q = 0; q < count / 4; q++) {
      const o = b + q * 4;
      bufI.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    void baseIdx;
  }
  const V = []; // scratch: x,y,z,r,g,b per vertex
  const minH = (function () { let m = 1e9; for (let i = 0; i < h.length; i++) if (h[i] < m) m = h[i]; return m; })();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c;
    if (!play[i]) continue;
    const cC = cls[i];
    const isW = cC === CLS.WTR;
    const x0 = model.x2(c), z0 = model.z2(r), x1 = x0 + CELL, z1 = z0 + CELL;
    const topY = isW ? wl[i] : h[i];
    const rgb = isW ? [1, 1, 1] : classColor(cC, x0, z0, ax, az, r, c);
    const nz = hash2(c, r, 17) * 0.08 - 0.04;
    const sh = 1 + nz;
    // top face (+y winding): p00,p01,p11,p10
    V.length = 0;
    const pts = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
    for (const [px, pz] of pts) {
      V.push(px, topY, pz,
        rgb[0] * (isW ? 0.85 : sh), rgb[1] * (isW ? 0.9 : sh), rgb[2] * (isW ? 1 : sh));
    }
    quads(isW ? wpos : pos, isW ? wcol : col, isW ? widx : idx, V, 0, 4);
    // sides
    const nbs = [[r, c + 1], [r, c - 1], [r + 1, c], [r - 1, c]];
    for (let sI = 0; sI < 4; sI++) {
      const nr = nbs[sI][0], nc = nbs[sI][1];
      const inB = nr >= 0 && nc >= 0 && nr < H && nc < W;
      const j = inB ? nr * W + nc : -1;
      const nbPlay = inB && play[j];
      let hn = inB ? (cls[j] === CLS.WTR ? wl[j] : h[j]) : (h[i] - 16);
      hn = Math.min(hn, minH - 2);
      if (nbPlay && hn >= topY - 0.06) continue;
      const drop = nbPlay ? Math.min(hn, topY - 0.06) : topY - (14 + sh * 2);
      const dk = [0.72, 0.66, 0.8, 0.6][sI];
      const a = (topY - drop) > 0 ? 1 : 0.4; void a;
      V.length = 0;
      if (sI === 0) { // +x
        V.push(x1, topY, z0, rgb[0] * dk, rgb[1] * dk * 0.95, rgb[2] * dk);
        V.push(x1, topY, z1, rgb[0] * dk, rgb[1] * dk * 0.95, rgb[2] * dk);
        V.push(x1, drop, z1, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
        V.push(x1, drop, z0, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
      } else if (sI === 1) { // -x
        V.push(x0, topY, z1, rgb[0] * dk, rgb[1] * dk * 0.95, rgb[2] * dk);
        V.push(x0, topY, z0, rgb[0] * dk, rgb[1] * dk * 0.95, rgb[2] * dk);
        V.push(x0, drop, z0, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
        V.push(x0, drop, z1, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
      } else if (sI === 2) { // +z
        V.push(x1, topY, z1, rgb[0] * dk, rgb[1] * dk, rgb[2] * dk);
        V.push(x0, topY, z1, rgb[0] * dk, rgb[1] * dk, rgb[2] * dk);
        V.push(x0, drop, z1, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
        V.push(x1, drop, z1, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
      } else { // -z
        V.push(x0, topY, z0, rgb[0] * dk, rgb[1] * dk, rgb[2] * dk);
        V.push(x1, topY, z0, rgb[0] * dk, rgb[1] * dk, rgb[2] * dk);
        V.push(x1, drop, z0, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
        V.push(x0, drop, z0, rgb[0] * dk * 0.7, rgb[1] * dk * 0.7, rgb[2] * dk * 0.7);
      }
      quads(isW ? wpos : pos, isW ? wcol : col, isW ? widx : idx, V, 0, 4);
    }
  }
  return { ground: makeGeom(pos, col, idx), water: makeGeom(wpos, wcol, widx) };
}
function makeGeom(pos, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ============================== scenery ============================== */
function buildTrees(model, qualityLevel) {
  const { W, H, cls, cdist, wdist, h, play } = model;
  const CELL = model.CELL;
  const rnd = mulberry(model.seed * 13 + 5);
  const cap = qualityLevel <= 1 ? 420 : 780;
  const taken = new Uint8Array(W * H);
  const pos = [], col = [], idx = [];
  function box(cx, cy, cz, sx, sy, sz, rgb, shade) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y0 = cy, y1 = cy + sy;
    const v = [
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    ];
    const shs = [1.0, 0.78, 0.78, 0.66, 0.86, 0.5];
    const base = pos.length / 3;
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        pos.push(v[f][k][0], v[f][k][1], v[f][k][2]);
        const s2 = shs[f] * (shade || 1);
        col.push(rgb[0] * s2, rgb[1] * s2, rgb[2] * s2);
      }
      idx.push(base + f * 4, base + f * 4 + 1, base + f * 4 + 2, base + f * 4, base + f * 4 + 2, base + f * 4 + 3);
    }
  }
  let count = 0;
  for (let r = 1; r < H - 1 && count < cap; r++) for (let c = 1; c < W - 1 && count < cap; c++) {
    const i = r * W + c;
    if (!play[i] || taken[i]) continue;
    const cC = cls[i];
    if (cC !== CLS.NAT && cC !== CLS.ROUGH && cC !== CLS.FOR) continue;
    if (cdist[i] < 6) continue;
    const p = cC === CLS.NAT ? 0.08 : cC === CLS.FOR ? 0.045 : 0.03;
    if (rnd() > p) continue;
    const x = model.x2(c) + CELL / 2, z = model.z2(r) + CELL / 2;
    const gy = h[i];
    const nearW = wdist[i] < 5 && wdist[i] > 0;
    const th = nearW ? 13 + rnd() * 8 : 6 + rnd() * 7;
    const cs = 2.2 + rnd() * 1.6;
    box(x, gy, z, 0.7, th * 0.5, 0.7, [0.36, 0.26, 0.16]);
    const gShade = 0.75 + rnd() * 0.45;
    const greens = [[0.16, 0.42, 0.16], [0.20, 0.50, 0.20], [0.13, 0.35, 0.15], [0.24, 0.52, 0.18]];
    const gr = greens[(rnd() * 4) | 0];
    if (nearW) {
      box(x, gy + th * 0.35, z, cs * 0.7, th * 0.42, cs * 0.7, [0.11, 0.31, 0.13], gShade);
      box(x, gy + th * 0.62, z, cs * 0.5, th * 0.36, cs * 0.5, [0.11, 0.35, 0.14], gShade);
    } else {
      box(x, gy + th * 0.3, z, cs * 1.5, cs * 0.85, cs * 1.5, gr, gShade);
      box(x, gy + th * 0.55, z, cs * 1.1, cs * 0.75, cs * 1.1, gr, gShade * 1.06);
      box(x, gy + th * 0.78, z, cs * 0.6, cs * 0.6, cs * 0.6, gr, gShade * 1.1);
    }
    count++;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const j = (r + dr) * W + (c + dc);
      if (j >= 0 && j < W * H) taken[j] = 1;
    }
    if (rnd() < 0.05 && cC === CLS.NAT) box(x + 3, gy, z - 2, 1.6 + rnd() * 1.5, 1.1, 1.4, [0.45, 0.44, 0.42]);
  }
  return { treeGeom: makeGeom(pos, col, idx), count };
}

/* ============================== GAME ============================== */
const listeners = {};
function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
function emit(ev, d) { (listeners[ev] || []).forEach(f => { try { f(d); } catch (e) { console.warn(e); } }); }

let renderer, scene, camera, sun, ballMesh, trailLine, trailPts, trailN, trailMax;
let aimArrow, landRing, puttLine, flagGroup, flagPlane, cupMesh, teeMarks;
let skyMesh, cloudMesh, cloudBase = { x: 0, z: 0 };
let groundMesh = null, waterMesh = null, treeMesh = null;
let model = null;
const quality = { mode: 'auto', level: 2, dpr: 2, shadow: 1024 };

const state = {
  phase: 'idle',
  courseId: null, course: null, holeNum: 1,
  strokes: 0, scores: [], si: {},
  club: 'DR', autoClub: true, shape: 0,
  aimDeg: 0, power: 0,
  ball: { x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0 },
  prevShot: { x: 0, z: 0 },
  lie: CLS.FRW, sandLie: false,
  wind: { spd: 0, deg: 0, vx: 0, vz: 0 },
  camMode: 0,
  yaw: 0, pitch: 0.35, zoom: 1,
  spinT: 0, bounces: 0, _shape: 0,
  time: 0,
};
const BALL_R = 0.21;
const ROLL = {
  [CLS.GRN]: { f: 0.9, q: 0.5, sk: 0.34, e: 0.38 },
  [CLS.FRG]: { f: 1.4, q: 0.7, sk: 0.3, e: 0.45 },
  [CLS.FRW]: { f: 1.2, q: 0.55, sk: 0.3, e: 0.50 },
  [CLS.TEE]: { f: 1.2, q: 0.55, sk: 0.3, e: 0.5 },
  [CLS.ROUGH]: { f: 3.2, q: 1.2, sk: 0.28, e: 0.32 },
  [CLS.NAT]: { f: 4.0, q: 1.6, sk: 0.26, e: 0.3 },
  [CLS.FOR]: { f: 3.2, q: 1.2, sk: 0.28, e: 0.32 },
  [CLS.BNK]: { f: 8, q: 2, sk: 0.2, e: 0.1 },
};
function rollParams(c) { return ROLL[c] || ROLL[CLS.NAT]; }
/* putt launch speed for a target roll distance under (f + q*v) friction */
function rollDist(v0, f, q) {
  let x = 0, v = v0; const dt = 1 / 120;
  while (v > 0.05) { v -= (f + q * v) * dt; x += v * dt; if (x > 200) break; }
  return x;
}
function puttV0(targetYd, f, q) {
  let lo = 0.05, hi = 40;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (rollDist(m, f, q) < targetYd) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

function initThree(canvas, opts) {
  quality.mode = opts.quality || 'auto';
  const isMobile = matchMedia('(pointer: coarse)').matches;
  if (quality.mode === 'auto') quality.level = isMobile ? 1 : 2;
  else quality.level = opts.quality === 'low' ? 0 : opts.quality === 'high' ? 2 : 1;
  quality.dpr = [1, 1.5, 2][quality.level];
  quality.shadow = [0, 1024, 2048][quality.level];

  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.level >= 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality.shadow > 0;
  renderer.shadowMap.type = quality.level >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe4ef, 220, 820);
  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 3000);
  window.GAME.cam = camera;

  const hemi = new THREE.HemisphereLight(0xbfdff0, 0x54683c, 0.9);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sun.castShadow = quality.shadow > 0;
  const ss = Math.max(512, quality.shadow);
  sun.shadow.mapSize.set(ss, ss);
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 280;
  sun.shadow.bias = -0.0012;
  scene.add(sun); scene.add(sun.target);

  const skyG = new THREE.SphereGeometry(1600, 24, 14);
  const skyCol = [];
  const cTop = new THREE.Color(0x3f78b5), cBot = new THREE.Color(0xddeef4), cT = new THREE.Color();
  const pa = skyG.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const t = clamp((pa.getY(i) / 1600 + 0.12) / 1.12, 0, 1);
    cT.copy(cBot).lerp(cTop, Math.pow(t, 0.7));
    skyCol.push(cT.r, cT.g, cT.b);
  }
  skyG.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
  skyMesh = new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(skyMesh);
  buildClouds();

  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  ballMesh.castShadow = quality.level >= 1;
  scene.add(ballMesh);

  trailMax = 220; trailPts = new Float32Array(trailMax * 3); trailN = 0;
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(trailPts, 3).setUsage(THREE.DynamicDrawUsage));
  tg.setDrawRange(0, 0);
  trailLine = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  trailLine.frustumCulled = false;
  scene.add(trailLine);

  aimArrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 7), new THREE.MeshBasicMaterial({ color: 0xffd54a }));
  shaft.position.z = -5;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 4), new THREE.MeshBasicMaterial({ color: 0xffd54a }));
  head.rotation.x = -Math.PI / 2; head.position.z = -10;
  aimArrow.add(shaft, head); aimArrow.visible = false;
  scene.add(aimArrow);

  landRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.5, 24), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
  landRing.rotation.x = -Math.PI / 2; landRing.visible = false;
  scene.add(landRing);

  const plg = new THREE.BufferGeometry();
  plg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  plg.setDrawRange(0, 0);
  puttLine = new THREE.Line(plg, new THREE.LineBasicMaterial({ color: 0xd6ffe8, transparent: true, opacity: 0.9 }));
  puttLine.frustumCulled = false; puttLine.visible = false;
  scene.add(puttLine);

  flagGroup = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 10, 6), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
  pole.position.y = 5; pole.castShadow = quality.level >= 1;
  flagPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4, 10, 5), new THREE.MeshLambertMaterial({ color: 0xe33b3b, side: THREE.DoubleSide }));
  flagPlane.position.set(1.15, 9, 0);
  cupMesh = new THREE.Mesh(new THREE.CircleGeometry(0.56, 14), new THREE.MeshBasicMaterial({ color: 0x10160e }));
  cupMesh.rotation.x = -Math.PI / 2;
  flagGroup.add(pole, flagPlane, cupMesh);
  scene.add(flagGroup);

  teeMarks = new THREE.Group();
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), new THREE.MeshLambertMaterial({ color: 0x3d6fd8 }));
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), new THREE.MeshLambertMaterial({ color: 0xd84040 }));
  teeMarks.add(m1, m2);
  scene.add(teeMarks);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); emit('toast', { msg: 'Graphics context lost — please reload', persist: true }); });
}

function buildClouds() {
  const pos = [], col = [], idx = [];
  const rnd = mulberry(99);
  function box(cx, cy, cz, sx, sy, sz, sh) {
    const v = [
      [[cx - sx / 2, cy + sy, cz - sz / 2], [cx - sx / 2, cy + sy, cz + sz / 2], [cx + sx / 2, cy + sy, cz + sz / 2], [cx + sx / 2, cy + sy, cz - sz / 2]],
      [[cx - sx / 2, cy, cz - sz / 2], [cx + sx / 2, cy, cz - sz / 2], [cx + sx / 2, cy, cz + sz / 2], [cx - sx / 2, cy, cz + sz / 2]],
    ];
    const base = pos.length / 3;
    for (const face of v) for (let k = 0; k < 4; k++) {
      pos.push(face[k][0], face[k][1], face[k][2]);
      col.push(sh, sh, Math.min(1, sh * 1.02));
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
  }
  for (let k = 0; k < 9; k++) {
    let bx = -700 + rnd() * 1400, bz = -700 + rnd() * 1400; const cy = 130 + rnd() * 60;
    for (let b = 0; b < 4; b++) {
      box(bx, cy, bz, 18 + rnd() * 26, 7 + rnd() * 6, 12 + rnd() * 18, 0.97);
      bx += 16 + rnd() * 16; bz += (rnd() - 0.5) * 12;
    }
  }
  cloudMesh = new THREE.Mesh(makeGeom(pos, col, idx), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, fog: false, side: THREE.DoubleSide }));
  scene.add(cloudMesh);
}

/* ---------- ground sampling ---------- */
function hAt(x, z) {
  if (!model || !model.h) return 0;
  const { W, H, x0, z0, h } = model;
  const fx = (x - x0) / model.CELL - 0.5, fz = (z - z0) / model.CELL - 0.5;
  const c0f = Math.floor(fx), r0f = Math.floor(fz);
  const c0 = clamp(c0f, 0, W - 1), r0 = clamp(r0f, 0, H - 1);
  const c1 = Math.min(c0 + 1, W - 1), r1 = Math.min(r0 + 1, H - 1);
  const tx = clamp(fx - c0f, 0, 1), tz = clamp(fz - r0f, 0, 1);
  const h00 = h[r0 * W + c0], h10 = h[r0 * W + c1], h01 = h[r1 * W + c0], h11 = h[r1 * W + c1];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}
function gradAt(x, z) {
  const d = 1.2;
  return [(hAt(x + d, z) - hAt(x - d, z)) / (2 * d), (hAt(x, z + d) - hAt(x, z - d)) / (2 * d)];
}
function clsAt(x, z) {
  if (!model) return CLS.OUT;
  const i = model.cellOf(x, z);
  return i == null ? CLS.OUT : model.cls[i];
}
function yardsToPin(x, z) {
  return Math.max(1, Math.round(Math.hypot(x - model.pinX, z - model.pinZ)));
}

/* ============================== hole flow ============================== */
function computeSI(course) {
  const holes = Object.keys(course.holes).map(Number).sort((a, b) => a - b);
  const diff = holes.map(h => {
    const hd = course.holes[h];
    return { h, d: -(hd.yards_est || 380) - (hd.bunker || []).length * 5 - (hd.water || []).length * 25 };
  }).sort((a, b) => a.d - b.d);
  const qF = diff.filter(d => d.h <= 9).map(d => d.h);
  const qB = diff.filter(d => d.h > 9).map(d => d.h);
  const si = {};
  for (let i = 0; i < diff.length; i++) {
    const wantF = i % 2 === 0;
    let h = (wantF ? qF : qB).shift();
    if (h == null) h = (wantF ? qB : qF).shift();
    si[h] = i + 1;
  }
  return si;
}

function holeNumsList() { return state.course ? Object.keys(state.course.holes).map(Number).sort((a, b) => a - b) : []; }

let buildTask = null;
function startRound(courseId) {
  const course = window.GOLF_COURSES[courseId];
  if (!course) return;
  state.courseId = courseId; state.course = course;
  state.scores = [];
  state.si = computeSI(course);
  loadHole(holeNumsList()[0]);
}

function loadHole(holeNum) {
  state.phase = 'loading';
  emit('loading', { on: true, msg: 'Building hole ' + holeNum + '…' });
  [groundMesh, waterMesh, treeMesh].forEach(m => { if (m) { scene.remove(m); m.geometry.dispose(); } });
  groundMesh = waterMesh = treeMesh = null;
  if (buildTask) { cancelAnimationFrame(buildTask); buildTask = null; }

  const steps = [];
  const stepMs = state._stepMs = [];
  const timed = fn => () => { const t0 = performance.now(); try { return fn(); } finally { stepMs.push(Math.round(performance.now() - t0)); } };
  steps.push(timed(() => {
    try { model = new HoleModel(state.course, holeNum); state.holeNum = holeNum; }
    catch (e) { console.error('hole build failed', e); emit('toast', { msg: 'This hole failed to build' }); }
  }));
  steps.push(timed(() => model && buildElevation(model)));
  steps.push(timed(() => {
    if (!model) return;
    const m = buildTerrainMesh(model);
    groundMesh = new THREE.Mesh(m.ground, new THREE.MeshLambertMaterial({ vertexColors: true }));
    groundMesh.receiveShadow = quality.level >= 1;
    scene.add(groundMesh);
    if (m.water.attributes.position.count > 0) {
      waterMesh = new THREE.Mesh(m.water, new THREE.MeshPhongMaterial({
        vertexColors: true, transparent: true, opacity: 0.72, shininess: 90, depthWrite: false,
      }));
      scene.add(waterMesh);
    }
  }));
  steps.push(timed(() => {
    if (!model) return;
    const t = buildTrees(model, quality.level);
    if (t.treeGeom.attributes.position.count > 0) {
      treeMesh = new THREE.Mesh(t.treeGeom, new THREE.MeshLambertMaterial({ vertexColors: true }));
      scene.add(treeMesh);
    }
  }));
  steps.push(timed(() => {
    if (!model) { emit('loading', { on: false }); return; }
    cloudBase = { x: model.x2(model.W / 2), z: model.z2(model.H / 2) };
    const pinY = hAt(model.pinX, model.pinZ);
    flagGroup.position.set(model.pinX, pinY, model.pinZ);
    cupMesh.position.y = 0.03;
    const ax = -model.axis[1], az = model.axis[0];
    teeMarks.visible = true;
    teeMarks.children[0].position.set(model.teeX + ax * 3, hAt(model.teeX + ax * 3, model.teeZ + az * 3) + 0.45, model.teeZ + az * 3);
    teeMarks.children[1].position.set(model.teeX - ax * 3, hAt(model.teeX - ax * 3, model.teeZ - az * 3) + 0.45, model.teeZ - az * 3);

    state.strokes = 0;
    state.ball.x = model.teeX; state.ball.z = model.teeZ;
    state.ball.y = hAt(model.teeX, model.teeZ) + BALL_R;
    state.ball.vx = state.ball.vy = state.ball.vz = 0;
    state.prevShot.x = state.ball.x; state.prevShot.z = state.ball.z;
    state.sandLie = false;
    const wrnd = mulberry(hashStr(state.courseId) + holeNum * 31 + 7);
    state.wind.spd = Math.round(wrnd() * 12);
    state.wind.deg = Math.floor(wrnd() * 360);
    setWindVec(0);
    state.aimDeg = Math.atan2(model.pinX - state.ball.x, model.pinZ - state.ball.z) * 180 / Math.PI;
    state.power = 0;
    trailN = 0; trailLine.geometry.setDrawRange(0, 0);
    updateLie();
    suggestClub();
    state.camMode = 0;
    state.phase = 'aim';
    emit('loading', { on: false });
    emit('hole', {
      hole: holeNum, par: model.par, yds: model.yards, si: state.si[holeNum] || 1,
      name: state.course.name, strokes: 0,
    });
    emit('toast', { msg: 'Hole ' + holeNum + ' · Par ' + model.par + ' · ' + model.yards + ' yds' });
    emit('state');
  }));
  let si2 = 0;
  function run() {
    if (si2 < steps.length) { steps[si2++](); buildTask = requestAnimationFrame(run); }
    else buildTask = null;
  }
  run();
}
function setWindVec(t) {
  const r = state.wind.deg * Math.PI / 180;
  const gust = 1 + 0.22 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3);
  const s = state.wind.spd * 0.489 * gust;
  state.wind.vx = Math.cos(r) * s; state.wind.vz = Math.sin(r) * s;
}

/* ============================== shooting ============================== */
function updateLie() {
  state.lie = clsAt(state.ball.x, state.ball.z);
  state.sandLie = state.lie === CLS.BNK;
}
function suggestClub() {
  if (!state.autoClub) { emit('state'); return; }
  const d = yardsToPin(state.ball.x, state.ball.z);
  const onGreen = state.lie === CLS.GRN || state.lie === CLS.FRG;
  let id;
  if (onGreen) id = 'PT';
  else if (d <= 30) id = 'LW';
  else {
    let best = CLUBS[0];
    for (const c of CLUBS) if (c.id !== 'PT' && c.yd >= d - 5) best = c;
    id = best.id;
    if (d > CLUBS[0].yd * 1.15) id = 'DR';
  }
  state.club = id;
  emit('club', { club: id });
  emit('state');
}
function setClub(id) {
  if (!(id in CLUB_IX)) return;
  state.club = id; state.autoClub = false;
  emit('club', { club: id }); emit('state');
}
function cycleClub(d) {
  const ix = CLUB_IX[state.club] || 0;
  setClub(CLUBS[(ix + d + CLUBS.length) % CLUBS.length].id);
}
function setAutoClub(b) { state.autoClub = b; emit('autoclub', { on: b }); if (b) suggestClub(); }

function dispersionSigma() {
  let s = 0.6;
  if (state.power > 88) s += (state.power - 88) * 0.06;
  const L = state.lie;
  if (L === CLS.ROUGH) s += 1.4;
  else if (L === CLS.NAT || L === CLS.FOR) s += 2.3;
  else if (L === CLS.BNK) s += 2.6;
  else if (L === CLS.TEE) s -= 0.2;
  s += state.wind.spd * 0.05;
  return s;
}

const rndShoot = mulberry((Date.now() & 0xffff) + 3);
function shoot(power) {
  if (state.phase !== 'aim') return;
  const putting = state.club === 'PT';
  state.power = clamp(power, 1, 100);
  if (state.power < (putting ? 1.5 : 4)) { emit('state'); return; }

  state.strokes++;
  state.prevShot.x = state.ball.x; state.prevShot.z = state.ball.z;
  const b = state.ball;
  updateLie();
  const sigma = dispersionSigma();
  const ang = state.aimDeg * Math.PI / 180 + gauss(rndShoot) * sigma * Math.PI / 180;

  if (putting) {
    const d = Math.pow(state.power / 100, 1.5) * 34;
    const rp = rollParams(state.lie === CLS.GRN || state.lie === CLS.FRG ? state.lie : CLS.GRN);
    const v0 = puttV0(Math.max(0.6, d), rp.f, rp.q);
    b.vx = Math.sin(ang) * v0; b.vz = Math.cos(ang) * v0; b.vy = 0;
    b.y = hAt(b.x, b.z) + BALL_R + 0.02;
    state.phase = 'roll'; state.spinT = 0; state.bounces = 0;
    emit('shot', { type: 'putt' });
  } else {
    const club = CLUBS[CLUB_IX[state.club]];
    let target = club.yd * (0.35 + 0.7 * state.power / 100);
    target *= 1 + gauss(rndShoot) * 0.028;
    if (state.sandLie) target *= 0.55;
    else if (state.lie === CLS.ROUGH) target *= 0.9;
    else if (state.lie === CLS.NAT || state.lie === CLS.FOR) target *= 0.82;
    const loft = effLoft(club) + (state.sandLie ? 0.15 : 0);
    const v0 = v0For(club.id, target) * (1 + (rndShoot() - 0.5) * 0.015);
    const vh = v0 * Math.cos(loft), vy = v0 * Math.sin(loft);
    b.vx = Math.sin(ang) * vh; b.vz = Math.cos(ang) * vh; b.vy = vy;
    b.y = hAt(b.x, b.z) + BALL_R + 0.04;
    state._shape = state.shape;
    state.phase = 'flight'; state.spinT = 0; state.bounces = 0;
    emit('shot', { type: 'swing', power: state.power });
  }
  trailN = 0; trailLine.geometry.setDrawRange(0, 0);
  emit('state');
}

/* ============================== physics ============================== */
function stepPhysics(dt) {
  const b = state.ball;
  setWindVec(state.time);
  if (trailN < trailMax) {
    trailPts[trailN * 3] = b.x; trailPts[trailN * 3 + 1] = b.y; trailPts[trailN * 3 + 2] = b.z;
    trailN++;
    trailLine.geometry.setDrawRange(0, trailN);
    trailLine.geometry.attributes.position.needsUpdate = true;
  }
  const inFlight = state.phase === 'flight';
  if (inFlight) {
    const rvx = b.vx - state.wind.vx, rvy = b.vy, rvz = b.vz - state.wind.vz;
    const sp = Math.hypot(rvx, rvy, rvz);
    b.vx -= K_DRAG * sp * rvx * dt;
    b.vy -= (G + K_DRAG * sp * rvy) * dt;
    b.vz -= K_DRAG * sp * rvz * dt;
    if (state._shape) {
      const px = Math.cos(state.aimDeg * Math.PI / 180), pz = -Math.sin(state.aimDeg * Math.PI / 180);
      const sgn = state._shape; // +1 fade (slides right for RH), -1 draw
      const curve = sgn * 1.15 * dt * clamp(sp / 60, 0.2, 1.4);
      b.vx += px * curve; b.vz += pz * curve;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const gh = hAt(b.x, b.z);
    if (b.y - BALL_R <= gh && b.vy < 0) {
      const c = clsAt(b.x, b.z);
      const dc = Math.hypot(b.x - model.pinX, b.z - model.pinZ);
      const spd = Math.hypot(b.vx, b.vy, b.vz);
      if (dc < 0.8 && spd < 7 && c === CLS.GRN) return holed();
      if (c === CLS.OUT) return outOfBounds();
      if (c === CLS.WTR) return splash(b.x, b.z);
      const rp = rollParams(c);
      b.y = gh + BALL_R;
      if (c === CLS.BNK) {
        b.vx *= 0.22; b.vz *= 0.22; b.vy = Math.abs(b.vy) * 0.08;
        emit('impact', { sand: true });
        state.phase = 'roll'; state.bounces = 3;
        return;
      }
      b.vy = Math.abs(b.vy) * rp.e;
      b.vx *= 0.8; b.vz *= 0.8;
      state.bounces++;
      emit('impact', {});
      if (state.bounces === 1) state.spinT = 0.55;
      if (b.vy < 2.6 || state.bounces > 4) { b.vy = 0; state.phase = 'roll'; }
      return;
    }
    if (clsAt(b.x, b.z) === CLS.OUT) return outOfBounds();
  } else if (state.phase === 'roll') {
    const c = clsAt(b.x, b.z);
    if (c === CLS.OUT) return outOfBounds();
    if (c === CLS.WTR) return splash(b.x, b.z);
    const rp = rollParams(c);
    const gr = gradAt(b.x, b.z);
    b.vx += -G * rp.sk * gr[0] * dt;
    b.vz += -G * rp.sk * gr[1] * dt;
    if (state.spinT > 0) {
      state.spinT -= dt;
      const sp2 = Math.hypot(b.vx, b.vz);
      if (sp2 > 0.01) { b.vx += (b.vx / sp2) * 1.2 * dt; b.vz += (b.vz / sp2) * 1.2 * dt; }
    }
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.0001) {
      const ns = Math.max(0, sp - (rp.f + rp.q * sp) * dt);
      b.vx *= ns / sp; b.vz *= ns / sp;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    const gh = hAt(b.x, b.z);
    if (gh + BALL_R > b.y + 0.6 && Math.hypot(b.vx, b.vz) > 6) {
      state.phase = 'flight'; b.y = gh + BALL_R + 0.05; return;
    }
    b.y = gh + BALL_R;
    const dc = Math.hypot(b.x - model.pinX, b.z - model.pinZ);
    const spd = Math.hypot(b.vx, b.vy, b.vz);
    if (c === CLS.GRN) {
      if (dc < 0.62 && spd < 6.5) return holed();
      if (dc < 0.8 && spd >= 6.5 && spd < 12) { b.vx *= 0.5; b.vz *= 0.5; } // lip
      // cup pull near hole
      if (dc < 1.4 && dc > 0.01) {
        const pull = (1.4 - dc) * 2.6 * dt;
        b.vx += (model.pinX - b.x) / dc * pull;
        b.vz += (model.pinZ - b.z) / dc * pull;
      }
    }
    if (Math.hypot(b.vx, b.vz) < 0.5) { b.vx = b.vy = b.vz = 0; return settle(); }
  }
}

/* ---------- rules ---------- */
function splash(x, z) {
  const b = state.ball;
  b.vx = b.vy = b.vz = 0;
  state.phase = 'settled';
  emit('splash', {});
  state.strokes++;
  emit('penalty', { why: 'Water hazard — 1 stroke, drop at the margin' });
  const res = model.resolveLie(x, z, { ground: true });
  if (res) {
    const dx = state.prevShot.x - res.x, dz = state.prevShot.z - res.z;
    const L = Math.hypot(dx, dz) || 1;
    b.x = res.x + dx / L * 1.0; b.z = res.z + dz / L * 1.0;
    const r2 = model.resolveLie(b.x, b.z, { ground: true });
    if (r2) { b.x = r2.x; b.z = r2.z; }
  } else { b.x = state.prevShot.x; b.z = state.prevShot.z; }
  b.y = hAt(b.x, b.z) + BALL_R;
  emit('toast', { msg: '+1 penalty stroke — dropped' });
  afterShotRest();
}
function outOfBounds() {
  state.phase = 'settled';
  state.strokes++;
  emit('penalty', { why: 'Out of bounds — 1 stroke & distance' });
  const b = state.ball;
  b.x = state.prevShot.x; b.z = state.prevShot.z;
  const r = model.resolveLie(b.x, b.z, { ground: true });
  if (r) { b.x = r.x; b.z = r.z; }
  b.y = hAt(b.x, b.z) + BALL_R;
  b.vx = b.vy = b.vz = 0;
  emit('toast', { msg: '+1 penalty — replay from previous spot' });
  afterShotRest();
}
function dropUnplayable() {
  if (state.phase !== 'aim') return;
  const c = state.lie;
  if (c === CLS.GRN || c === CLS.FRG || c === CLS.FRW || c === CLS.TEE) { emit('toast', { msg: 'You can play from here' }); return; }
  state.strokes++;
  emit('penalty', { why: 'Unplayable lie — 1 stroke, drop' });
  const b = state.ball;
  const dx = model.pinX - b.x, dz = model.pinZ - b.z;
  const L = Math.hypot(dx, dz) || 1;
  let placed = null;
  for (let t = 2; t < 50 && !placed; t += 2) {
    const r = model.resolveLie(b.x + dx / L * t, b.z + dz / L * t, {});
    if (r) { const cc = clsAt(r.x, r.z); if (cc === CLS.FRW || cc === CLS.TEE) placed = r; }
  }
  if (!placed) placed = model.resolveLie(b.x, b.z, {}) || { x: b.x, z: b.z };
  b.x = placed.x; b.z = placed.z; b.y = hAt(b.x, b.z) + BALL_R;
  afterShotRest();
}
function afterShotRest() {
  updateLie();
  suggestClub();
  state.phase = 'aim';
  state.power = 0;
  emit('rest', {}); emit('state', {});
}
function settle() {
  state.phase = 'settled';
  updateLie();
  if (state.lie === CLS.WTR) return splash(state.ball.x, state.ball.z);
  afterShotRest();
}
function holed() {
  const b = state.ball;
  b.x = model.pinX; b.z = model.pinZ;
  b.y = hAt(model.pinX, model.pinZ) + 0.05;
  b.vx = b.vy = b.vz = 0;
  state.phase = 'holed';
  const nums = holeNumsList();
  state.scores[nums.indexOf(state.holeNum)] = state.strokes;
  emit('holed', { strokes: state.strokes, par: model.par, last: state.holeNum === nums[nums.length - 1] });
}
function nextHole() {
  const nums = holeNumsList();
  const ix = nums.indexOf(state.holeNum);
  if (ix >= nums.length - 1) { finishRound(); return; }
  loadHole(nums[ix + 1]);
}
function scoreLabel(s, par) {
  const d = s - par;
  if (s === 1) return 'HOLE IN ONE!';
  if (d <= -3) return 'ALBATROSS';
  if (d === -2) return 'EAGLE';
  if (d === -1) return 'BIRDIE';
  if (d === 0) return 'PAR';
  if (d === 1) return 'BOGEY';
  if (d === 2) return 'DOUBLE BOGEY';
  if (d === 3) return 'TRIPLE BOGEY';
  return '+' + d;
}
function finishRound() {
  const nums = holeNumsList();
  const total = nums.reduce((a, h, i) => a + (state.scores[i] || 0), 0);
  const par = nums.reduce((a, h) => a + (state.course.holes[h].par || 4), 0);
  const key = 'voxelgolf.best.' + state.courseId;
  let best = null;
  try { best = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  const rec = { total, over: total - par, date: new Date().toISOString().slice(0, 10) };
  if (!best || total < best.total) { best = rec; try { localStorage.setItem(key, JSON.stringify(rec)); } catch (e) {} }
  emit('round', { total, par, over: total - par, best, scores: state.scores, nums });
}
function restartHole() { if (state.phase !== 'loading') loadHole(state.holeNum); }
function restartRound() { startRound(state.courseId); }

/* ============================== aim helpers ============================== */
function setAim(deg) { state.aimDeg = ((deg + 540) % 360) - 180; emit('state', {}); }
function nudgeAim(d) { setAim(state.aimDeg + d); }
function aimVec() { const r = state.aimDeg * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }

function predictLanding() {
  const b = state.ball;
  const ang = state.aimDeg * Math.PI / 180;
  const pts = [];
  if (state.club === 'PT') {
    const d = Math.pow(state.power / 100, 1.5) * 34;
    const rp = rollParams(state.lie === CLS.GRN || state.lie === CLS.FRG ? state.lie : CLS.GRN);
    let x = b.x, z = b.z;
    const v0 = puttV0(Math.max(0.6, d), rp.f, rp.q);
    let vx = Math.sin(ang) * v0, vz = Math.cos(ang) * v0;
    const dt = 1 / 40;
    for (let i = 0; i < 160; i++) {
      const gr = gradAt(x, z);
      vx += -G * rp.sk * gr[0] * dt; vz += -G * rp.sk * gr[1] * dt;
      const sp = Math.hypot(vx, vz);
      if (sp < 0.3) break;
      const ns = Math.max(0.001, sp - (rp.f + rp.q * sp) * dt);
      vx *= ns / sp; vz *= ns / sp;
      x += vx * dt; z += vz * dt;
      if (i % 2 === 0) pts.push(x, hAt(x, z) + 0.08, z);
    }
    return { pts, putting: true };
  }
  const club = CLUBS[CLUB_IX[state.club]];
  let target = club.yd * (0.35 + 0.7 * state.power / 100);
  if (state.sandLie) target *= 0.55;
  const loft = effLoft(club);
  const v = v0For(club.id, target);
  let x = b.x, y = b.y, z = b.z;
  let vx = Math.sin(ang) * v * Math.cos(loft), vz = Math.cos(ang) * v * Math.cos(loft), vy = v * Math.sin(loft);
  const dt = 1 / 60;
  for (let i = 0; i < 420; i++) {
    const sp = Math.hypot(vx, vy, vz);
    vx -= K_DRAG * sp * vx * dt; vy -= (G + K_DRAG * sp * vy) * dt; vz -= K_DRAG * sp * vz * dt;
    x += vx * dt; y += vy * dt; z += vz * dt;
    if (y <= hAt(x, z) + BALL_R && vy < 0) { pts.push(x, hAt(x, z) + 0.08, z); break; }
  }
  return { pts, putting: false };
}

/* ============================== camera ============================== */
const camPos = new THREE.Vector3(0, 30, 80);
function updateCamera(dt) {
  const b = state.ball;
  const bh = hAt(b.x, b.z);
  let tx, ty, tz, lx, ly, lz, smooth = 5;
  if (state.camMode === 0) {
    if (state.phase === 'flight' || state.phase === 'roll') {
      const sp = Math.hypot(b.vx, b.vz);
      const dvx = sp > 1 ? b.vx / sp : aimVec()[0], dvz = sp > 1 ? b.vz / sp : aimVec()[1];
      tx = b.x - dvx * (16 + Math.min(sp * 0.14, 10)); tz = b.z - dvz * (16 + Math.min(sp * 0.14, 10));
      ty = Math.max(bh, b.y) + 6;
      lx = b.x + dvx * 8; ly = b.y; lz = b.z + dvz * 8;
      smooth = 3.6;
    } else {
      const [ax, az] = aimVec();
      const d = state.lie === CLS.GRN ? 6.5 : 11;
      tx = b.x - ax * d; tz = b.z - az * d;
      ty = bh + (state.lie === CLS.GRN ? 2.6 : 6.5);
      lx = b.x + ax * 15; ly = bh + 1.2; lz = b.z + az * 15;
    }
  } else if (state.camMode === 2) {
    tx = b.x; ty = bh + 100; tz = b.z + 0.01;
    lx = b.x; ly = bh; lz = b.z;
  } else {
    const r = (14 + 34 * state.zoom) * (state.lie === CLS.GRN ? 0.55 : 1);
    tx = b.x - Math.sin(state.yaw) * Math.cos(state.pitch) * r;
    tz = b.z - Math.cos(state.yaw) * Math.cos(state.pitch) * r;
    ty = bh + Math.sin(state.pitch) * r + 1.5;
    lx = b.x; ly = bh + 0.8; lz = b.z;
    smooth = 8;
  }
  const k = 1 - Math.exp(-smooth * dt);
  camPos.lerp(new THREE.Vector3(tx, ty, tz), k);
  camera.position.copy(camPos);
  camera.lookAt(lx, ly, lz);
  sun.position.set(b.x - 45, bh + 100, b.z - 35);
  sun.target.position.set(b.x, bh, b.z);
  sun.target.updateMatrixWorld();
  skyMesh.position.set(b.x, 0, b.z);
  if (cloudMesh) {
      cloudMesh.position.x = cloudBase.x + ((state.time * 2) % 2400) - 1200;
      cloudMesh.position.z = cloudBase.z;
    }
}

/* ============================== main loop ============================== */
let lastT = 0, fpsEMA = 16, degraded = false;
function loop(tms) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (tms - lastT) / 1000 || 0.016);
  lastT = tms;
  state.time += dt;
  fpsEMA = fpsEMA * 0.95 + (dt * 1000) * 0.05;
  if (!degraded && quality.mode === 'auto' && fpsEMA > 46 && state.time > 5) {
    degraded = true;
    renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1));
    if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sun.castShadow = false; }
  }
  if (model && (state.phase === 'flight' || state.phase === 'roll')) {
    const steps = clamp(Math.round(dt / (1 / 140)), 1, 5);
    const sdt = dt / steps;
    for (let i = 0; i < steps && (state.phase === 'flight' || state.phase === 'roll'); i++) stepPhysics(sdt);
  }
  ballMesh.position.set(state.ball.x, state.ball.y, state.ball.z);
  ballMesh.visible = state.phase !== 'holed';
  if (flagGroup && model) {
    const paF = flagPlane.geometry.attributes.position;
    const tt = state.time * 2.4;
    const windAdd = 0.6 + state.wind.spd / 12;
    for (let i = 0; i < paF.count; i++) {
      const lx2 = paF.getX(i) + 1.15;
      const rel = clamp((paF.getX(i) + 1.15) / 1.2, 0, 1);
      paF.setZ(i, Math.sin(lx2 * 1.7 - tt) * 0.14 * rel * windAdd + Math.cos(paF.getY(i) * 2 + tt * 0.7) * 0.05 * rel);
    }
    paF.needsUpdate = true;
    flagPlane.geometry.computeVertexNormals();
  }
  const aiming = state.phase === 'aim';
  aimArrow.visible = aiming; landRing.visible = false; puttLine.visible = false;
  if (aiming) {
    const [ax, az] = aimVec();
    const bh = hAt(state.ball.x, state.ball.z);
    aimArrow.position.set(state.ball.x, bh + 0.06, state.ball.z);
    aimArrow.rotation.y = state.aimDeg * Math.PI / 180;
    aimArrow.scale.setScalar(clamp(0.45 + state.power / 60, 0.45, 2.2));
    if (state.power > 2) {
      const pl = predictLanding();
      if (pl.putting && pl.pts.length >= 6) {
        const lg = puttLine.geometry, capN = lg.attributes.position.count;
        const n = Math.min(Math.floor(pl.pts.length / 3), capN);
        const arr = lg.attributes.position.array;
        for (let i = 0; i < n * 3; i++) arr[i] = pl.pts[i];
        lg.setDrawRange(0, n); lg.attributes.position.needsUpdate = true;
        puttLine.visible = true;
      } else if (!pl.putting && pl.pts.length >= 3) {
        landRing.position.set(pl.pts[0], pl.pts[1] + 0.06, pl.pts[2]);
        landRing.visible = true;
      }
    }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

/* ============================== public ============================== */
window.GAME = {
  HM: HoleModel, buildElevation, buildTerrainMesh, buildTrees,
  on, emit,
  boot(canvas, opts) { initThree(canvas, opts); requestAnimationFrame(loop); },
  state, CLUBS, LIE_NAME, LIE_CLASS, scoreLabel,
  api: {
    shoot, setAim, nudgeAim, setClub, cycleClub, setAutoClub, dropUnplayable,
    restartHole, restartRound, nextHole, startRound,
    setShape(s) { state.shape = s; },
    cycleCamera() {
      state.camMode = (state.camMode + 1) % 3;
      if (state.camMode === 1) state.yaw = state.aimDeg * Math.PI / 180;
      emit('camera', { mode: state.camMode });
    },
    orbit(dyaw, dpitch) {
      if (state.camMode !== 1) state.camMode = 1;
      state.yaw -= dyaw; state.pitch = clamp(state.pitch + dpitch, -0.1, 1.3);
    },
    zoomBy(f) { state.zoom = clamp(state.zoom * f, 0.2, 3); },
    pinDist() { return model ? yardsToPin(state.ball.x, state.ball.z) : 0; },
    suggest() {
      if (!model) return 'DR';
      const d = yardsToPin(state.ball.x, state.ball.z);
      const onGreen = state.lie === CLS.GRN || state.lie === CLS.FRG;
      if (onGreen) return 'PT';
      if (d <= 30) return 'LW';
      let best = CLUBS[0];
      for (const c of CLUBS) if (c.id !== 'PT' && c.yd >= d - 5) best = c;
      return d > CLUBS[0].yd * 1.15 ? 'DR' : best.id;
    },
    holeData() { return model ? { par: model.par, yds: model.yards, hole: state.holeNum } : null; },
    minimap() {
      if (!model) return null;
      const m = model, hd = m.course.holes[m.holeNum];
      return {
        polys: { tee: hd.tee || [], fairway: hd.fairway || [], green: hd.green || [], bunker: hd.bunker || [], water: hd.water || [] },
        ball: [state.ball.x, state.ball.z], pin: [m.pinX, m.pinZ], tee: [m.teeX, m.teeZ],
        aim: state.aimDeg, wind: state.wind,
        bounds: { x0: m.x0, z0: m.z0, x1: m.x2(m.W), z1: m.z2(m.H) },
      };
    },
  },
  test: {
    shoot(aimDeg, power, clubId) {
      if (clubId) { state.autoClub = false; state.club = clubId; }
      state.aimDeg = aimDeg;
      shoot(power);
    },
    setPhase(p) { state.phase = p; },
    cam() { return camera ? { p: [camera.position.x, camera.position.y, camera.position.z].map(v => +v.toFixed(1)) } : null; },
    dbg() {
      return {
        model: !!model, h: model ? !!model.h : false,
        phase: state.phase, camMode: state.camMode, lie: state.lie,
        ball: [state.ball.x, state.ball.z],
        groundV: groundMesh ? groundMesh.geometry.attributes.position.count : 0,
        treeV: treeMesh ? treeMesh.geometry.attributes.position.count : 0,
        water: !!waterMesh,
        yds: model ? model.yards : 0, par: model ? model.par : 0,
        t: model ? model._t : null, grid: model ? [model.W, model.H, model.CELL] : null,
        comps: model && model._comps ? model._comps : 0,
      };
    },
    st() {
      return {
        phase: state.phase, hole: state.holeNum, strokes: state.strokes,
        ball: { x: +state.ball.x.toFixed(1), y: +state.ball.y.toFixed(1), z: +state.ball.z.toFixed(1) },
        pinDist: model ? yardsToPin(state.ball.x, state.ball.z) : -1,
        lie: state.lie, club: state.club, power: state.power,
        yards: model ? model.yards : 0,
      };
    },
    nextHole, restartHole, loadHole, holeNumsList,
    holed: n => { if (typeof n === 'number') state.strokes = n; holed(); },
    waterSpot() {
      if (!model) return null;
      const { cls, play, W, H } = model;
      for (let i = 0; i < W * H; i++) if (cls[i] === CLS.WTR && play[i]) {
        return [model.x2(i % W) + 1, model.z2((i / W) | 0) + 1];
      }
      return null;
    },
    voidSpot() {
      if (!model) return null;
      return [model.x0 - 50, model.z0 - 50];
    },
    setBall(x, z, phase) {
      state.ball.x = x; state.ball.z = z; state.ball.y = hAt(x, z) + BALL_R + 0.1;
      state.ball.vx = 1; state.ball.vy = 0; state.ball.vz = 0;
      updateLie();
      state.phase = phase || 'roll';
    },
    roughNearBall() {
      if (!model) return null;
      const { cls, W, H } = model;
      for (let i = 0; i < W * H; i++) if (cls[i] === CLS.ROUGH && model.play[i]) {
        return [model.x2(i % W) + 1, model.z2((i / W) | 0) + 1];
      }
      return null;
    },
  },
};
})();
