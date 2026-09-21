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
export class WaveFront {
  constructor(scene) {
    this.mesh = new THREE.Mesh(BR, mkMat(0x2f9bea, { transparent: true, opacity: 0.8, depthWrite: false }));
    this.mesh.castShadow = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.foam = new THREE.Mesh(BR, mkMat(0xeaf8ff, { transparent: true, opacity: 0.9 }));
    this.foam.visible = false;
    scene.add(this.foam);
  }
  place(x, z, span, height) {
    this.mesh.visible = this.foam.visible = true;
    this.mesh.scale.set(span, height, 3.2);
    this.mesh.position.set(x, height / 2 - 0.4, z);
    this.foam.scale.set(span, 1.1, 3.6);
    this.foam.position.set(x, height - 0.2, z);
  }
  hide() { this.mesh.visible = this.foam.visible = false; }
  dispose() { this.mesh.removeFromParent(); this.foam.removeFromParent(); this.mesh.geometry === BR || this.mesh.geometry.dispose(); }
}

export const clampN = clamp;
