/* Weather control mode: condition table + visual systems (particles, sky,
   props). Damage/sound/flow logic lives in Game (main.js). */
import * as THREE from 'three';
import { BR, SP, mkMat, clamp } from './brickkit.js';

/* dmg = damage dealt to a prop per tick; every = seconds between damage
   ticks; radius = reach of the moving/striking source. */
export const WEATHERS = [
  { id: 'clear',    name: 'Clear',         icon: '☀️' },
  { id: 'morning',  name: 'Morning',       icon: '🌅' },
  { id: 'noon',     name: 'Noon',          icon: '🌞' },
  { id: 'evening',  name: 'Evening',       icon: '🌇' },
  { id: 'night',    name: 'Night',          icon: '🌙' },
  { id: 'rain',     name: 'Rain',           icon: '🌧️',  dmg: 3,   every: 1.6 },
  { id: 'snow',     name: 'Snow',           icon: '🌨️',  dmg: 1,   every: 2.2 },
  { id: 'thunder',  name: 'Thunderstorm',   icon: '⛈️',  dmg: 40,  every: 3.5, strike: true },
  { id: 'tornado',  name: 'Tornado',        icon: '🌪️',  dmg: 14,  every: 0.5, mover: true, radius: 4 },
  { id: 'quake',    name: 'Earthquake',     icon: '🫨',  dmg: 10,  every: 0.9, shake: true },
  { id: 'hurricane',name: 'Hurricane',      icon: '🌀',  dmg: 24,  every: 0.7, mover: true, radius: 6 },
  { id: 'tsunami',  name: 'Tsunami',        icon: '🌊',  dmg: 60,  sweep: true },
  { id: 'meteor',   name: 'Meteor Strike',  icon: '☄️',  dmg: 150, every: 2.2, meteor: true, radius: 6 },
  { id: 'nuke',     name: '25kt Nuke Airdrop',  icon: '☢️',  dmg: 400, every: 0.5, radius: 26, nuke: true }
];

/* Sky/light recipe per condition id. */
export const SKY = {
  clear:    { bg: 0x8fd0ff, fog: 0xbfe4ff, sun: 2.2, sunCol: 0xfff2d6, hemi: 1.0, star: false },
  morning:  { bg: 0xffd9a3, fog: 0xffe2c2, sun: 1.7, sunCol: 0xffb066, hemi: 0.8, star: false },
  noon:     { bg: 0x6fc0ff, fog: 0xd8f0ff, sun: 2.6, sunCol: 0xffffff, hemi: 1.15, star: false },
  evening:  { bg: 0xff9d6b, fog: 0xffbf9a, sun: 1.4, sunCol: 0xff8a3d, hemi: 0.65, star: false },
  night:    { bg: 0x0b1030, fog: 0x141a3d, sun: 0.35, sunCol: 0x8fa3ff, hemi: 0.35, star: true },
  rain:     { bg: 0x5d6b7a, fog: 0x7d8a97, sun: 0.8, sunCol: 0xbfd0e0, hemi: 0.55, star: false },
  snow:     { bg: 0xaebfd0, fog: 0xd4dfe8, sun: 1.0, sunCol: 0xe8f0f8, hemi: 0.8, star: false },
  thunder:  { bg: 0x37414f, fog: 0x414c59, sun: 0.5, sunCol: 0x9fb2c8, hemi: 0.4, star: false },
  tornado:  { bg: 0x4a4436, fog: 0x5c5443, sun: 0.6, sunCol: 0xcbb98a, hemi: 0.5, star: false },
  quake:    { bg: 0x9a7f66, fog: 0xb09276, sun: 1.2, sunCol: 0xffc27d, hemi: 0.7, star: false },
  hurricane:{ bg: 0x46586a, fog: 0x5a6d7e, sun: 0.55, sunCol: 0xaebfd0, hemi: 0.45, star: false },
  tsunami:  { bg: 0x33465c, fog: 0x44586e, sun: 0.7, sunCol: 0xbcd2e8, hemi: 0.55, star: false },
  meteor:   { bg: 0x511f1f, fog: 0x6b3030, sun: 1.1, sunCol: 0xff8a5c, hemi: 0.6, star: false },
  nuke:     { bg: 0x6b5a3c, fog: 0x8a7454, sun: 1.5, sunCol: 0xffd9a0, hemi: 0.75, star: false }
};

/* Particle curtain (rain/hurricane) or drift (snow): points recycled inside a
   moving box around the player. */
export class ParticleField {
  constructor(scene, count, color, size) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.geo = geo;
    this.box = 44;
    this.hgt = 30;
  }
  recenter(px, pz, spread = true) {
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = px + (Math.random() * 2 - 1) * this.box;
      this.pos[i * 3 + 1] = Math.random() * this.hgt + 1;
      this.pos[i * 3 + 2] = pz + (Math.random() * 2 - 1) * this.box;
      if (!spread) this.pos[i * 3 + 1] += (i / this.n) * this.hgt;
    }
  }
  update(dt, px, pz, vy, wind = 0) {
    const b = this.box;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      this.pos[i3 + 1] += vy * dt;
      this.pos[i3] += wind * dt;
      this.pos[i3 + 2] += wind * 0.35 * dt;
      if (this.pos[i3 + 1] < 0.1 || this.pos[i3 + 1] > this.hgt + 2) {
        this.pos[i3 + 1] = vy < 0 ? this.hgt + Math.random() * 2 : 0.3 + Math.random() * 2;
      }
      if (this.pos[i3] < px - b || this.pos[i3] > px + b) this.pos[i3] = px + (Math.random() * 2 - 1) * b;
      if (this.pos[i3 + 2] < pz - b || this.pos[i3 + 2] > pz + b) this.pos[i3 + 2] = pz + (Math.random() * 2 - 1) * b;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { this.points.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

/* Twinkling star dome for night skies. */
export class StarField {
  constructor(scene) {
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.46 + 0.08;
      const r = 240;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 1.4, transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  set(on) { this.mat.opacity = on ? 0.9 : 0; this.points.visible = on; }
  move(px, pz) { this.points.position.set(px, 0, pz); }
  dispose() { this.points.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

/* Tornado / hurricane funnel: stacked spinning rings. */
export class Funnel {
  constructor(scene) {
    this.group = new THREE.Group();
    this.rings = [];
    const mat = mkMat(0x6b6152, { transparent: true, opacity: 0.55 });
    for (let i = 0; i < 12; i++) {
      const r = 0.7 + i * (i * 0.06 + 0.16);
      const ring = new THREE.Mesh(SP, mat);
      ring.scale.set(r, 0.55, r);
      ring.position.y = i * 1.7;
      this.group.add(ring);
      this.rings.push(ring);
    }
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
  }
  update(dt, x, y, z, spin = 1) {
    this.t += dt;
    this.group.position.set(x, y, z);
    for (let i = 0; i < this.rings.length; i++) {
      const rg = this.rings[i];
      rg.rotation.y = this.t * (3 + i * 0.4) * spin;
      rg.position.x = Math.sin(this.t * (2 + i * 0.3)) * (0.2 + i * 0.12);
      rg.position.z = Math.cos(this.t * (2.3 + i * 0.27)) * (0.2 + i * 0.12);
    }
  }
  show(on) { this.group.visible = on; }
  dispose() { this.group.removeFromParent(); this.rings[0].material.dispose(); }
}

/* Tsunami wavefront: a broad translucent wall that sweeps across the map. */
/* Giant moving brick wave: a wall of translucent water-bricks whose crest
   rolls and curls as it travels, plus a white foam cap. Instanced bricks are
   recomposed every frame from a cheap column/row profile, so it reads as a
   wall of blocks — MADDOX BLOX style — not a stretched box. */
export class WaveFront {
  constructor(scene) {
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.waterMat = mkMat(0x2f9bea, {
      transparent: true, opacity: 0.66, roughness: 0.12, metalness: 0.05,
      emissive: 0x0b3f77, emissiveIntensity: 0.45, depthWrite: false
    });
    this.foamMat = mkMat(0xeaf8ff, {
      transparent: true, opacity: 0.92, roughness: 0.4,
      emissive: 0xbfe8ff, emissiveIntensity: 0.35
    });
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.water = null;
    this.foam = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this.COLS = 0; this.ROWS = 0; this.FOAMN = 0;
  }
  _alloc(cols, rows) {
    if (this.water) { this.water.removeFromParent(); this.water.dispose(); }
    if (this.foam) { this.foam.removeFromParent(); this.foam.dispose(); }
    const foamMax = cols * 3;
    this.water = new THREE.InstancedMesh(this.geo, this.waterMat, cols * rows);
    this.foam = new THREE.InstancedMesh(this.geo, this.foamMat, foamMax);
    for (const m of [this.water, this.foam]) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      this.group.add(m);
    }
    this.COLS = cols; this.ROWS = rows; this.FOAMN = foamMax;
  }
  /* Center the wall at (x, z) spanning `span` units wide, `height` tall.
     `t` drives the roll; wave travel direction is +z. */
  place(x, z, span, height, t = 0) {
    this.group.visible = true;
    const cols = Math.min(Math.max(Math.round(span), 24), 460);
    const rows = Math.max(3, Math.round(height));
    if (!this.water || cols !== this.COLS || rows !== this.ROWS) this._alloc(cols, rows);
    const cellW = span / cols;
    const m = this._m, q = this._q, p = this._p, s = this._s;
    q.identity();
    let wi = 0, fi = 0;
    const put = (mesh, i, px, py, pz, sx, sy, sz) => {
      p.set(px, py, pz); s.set(sx, sy, sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    };
    for (let c = 0; c < cols; c++) {
      const u = (c / (cols - 1)) * 2 - 1;                 // -1..1 across face
      const cx = x + u * span / 2;
      // crest profile: taller midspan, rolling swell travelling along face
      const swell = Math.sin(u * 9 + t * 2.4) * 0.55 + Math.sin(u * 23 - t * 3.7) * 0.3;
      const colH = height * (0.86 + 0.16 * Math.cos(u * 1.35)) + swell;
      const nRow = Math.max(2, Math.min(rows, Math.round(colH)));
      for (let r = 0; r < nRow; r++) {
        const frac = (r + 0.5) / nRow;                    // 0 bottom → 1 crest
        // breaker curl: the crest leans back (-z) and wobbles as it rolls
        const curl = -frac * frac * (1.1 + 0.5 * Math.sin(t * 2.0 + u * 6));
        const jit = Math.sin(c * 12.9898 + r * 4.1414 + t * 5) * 0.12;
        put(this.water, wi++, cx, r + 0.5 - 0.35, z + curl + jit,
          cellW * 1.06, 1, 1.05 + frac * 0.9);
      }
      // foam: white caps riding the crest + occasional streaks down the face
      put(this.foam, fi++, cx, nRow - 0.15, z - 1.1 + Math.sin(t * 3 + u * 8) * 0.3,
        cellW * 1.1, 0.9, 1.6);
      if ((c % 5) === (Math.floor(t * 7) % 5)) {
        put(this.foam, fi++, cx, nRow * 0.45 + Math.sin(t * 4 + c) * 0.6,
          z + 0.85, cellW * 1.05, 0.5, 0.6);
      }
    }
    // churning base skirt a little ahead of the wall
    for (let c = 0; c < cols && fi < this.FOAMN - 1; c += 2) {
      const u = (c / (cols - 1)) * 2 - 1;
      put(this.foam, fi++, x + u * span / 2, 0.28, z + 2.2 + Math.sin(t * 5 + c) * 0.4,
        cellW * 1.2, 0.5, 1.4);
    }
    this.water.count = wi;
    this.foam.count = Math.min(fi, this.FOAMN);
    this.water.instanceMatrix.needsUpdate = true;
    this.foam.instanceMatrix.needsUpdate = true;
  }
  hide() { this.group.visible = false; }
  dispose() {
    if (this.water) { this.water.dispose(); this.water = null; }
    if (this.foam) { this.foam.dispose(); this.foam = null; }
    this.group.removeFromParent();
    this.geo.dispose();
  }
}

export const clampN = clamp;
