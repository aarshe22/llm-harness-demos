/* Weaponry: weapon stats/models, pooled particle FX, ray/AABB math.
   Audio lives in sfx.js; damage bookkeeping lives in main.js (Props). */
import * as THREE from 'three';
import { BR, CY, mkMat, clamp } from './brickkit.js';

export const WEAPONS = [
  { id: 'sword',  name: 'Brick Sword',  icon: '🗡️', dmg: 20,  radius: 0.6, maxBreak: 2, range: 2.7, arc: 1.25, cd: 0.55, kind: 'melee' },
  { id: 'hammer', name: 'Brick Hammer', icon: '🔨', dmg: 50,  radius: 1.0, maxBreak: 3, range: 3.0, arc: 1.40, cd: 0.95, kind: 'melee' },
  { id: 'flame',  name: 'Flamethrower', icon: '🔥', dmg: 7,   radius: 0.8, maxBreak: 1, range: 8.0, cd: 0.12, kind: 'stream', ignite: true },
  { id: 'rpg',    name: 'Shoulder RPG', icon: '🚀', dmg: 150, radius: 5.2, maxBreak: 6, range: 70,  cd: 1.8, kind: 'rocket', ignite: true }
];

/* -------------------------------------------------------------------- FX */
const MAXP = 340;
export class Fx {
  constructor(scene) {
    this.pos = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 3);
    this.vel = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.maxLife = new Float32Array(MAXP);
    this.baseSize = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAXP), 1));
    this.sizeArr = geo.attributes.size.array;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    this.mat = new THREE.PointsMaterial({
      size: 1, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  spawn(x, y, z, kind, n = 6) {
    const r = Math.random;
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % MAXP;
      const i3 = i * 3;
      this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
      if (kind === 'smoke') {
        this.vel[i3] = (r() - 0.5) * 0.9; this.vel[i3 + 1] = 0.9 + r() * 1.3; this.vel[i3 + 2] = (r() - 0.5) * 0.9;
        const g = 0.3 + r() * 0.3; this.col[i3] = g; this.col[i3 + 1] = g; this.col[i3 + 2] = g;
        this.life[i] = this.maxLife[i] = 1.1 + r() * 0.9; this.baseSize[i] = 0.5 + r() * 0.6; this.grav[i] = 1.3;
      } else if (kind === 'fire') {
        this.vel[i3] = (r() - 0.5) * 1.8; this.vel[i3 + 1] = 1.5 + r() * 1.8; this.vel[i3 + 2] = (r() - 0.5) * 1.8;
        this.col[i3] = 1; this.col[i3 + 1] = 0.4 + r() * 0.4; this.col[i3 + 2] = 0.08;
        this.life[i] = this.maxLife[i] = 0.28 + r() * 0.3; this.baseSize[i] = 0.4 + r() * 0.45; this.grav[i] = 2.4;
      } else if (kind === 'debris') {
        const a = r() * Math.PI * 2, sp = 2 + r() * 4;
        this.vel[i3] = Math.cos(a) * sp; this.vel[i3 + 1] = 3 + r() * 4.5; this.vel[i3 + 2] = Math.sin(a) * sp;
        const c = r() * 0.45; this.col[i3] = 0.75 + c; this.col[i3 + 1] = 0.6 + c; this.col[i3 + 2] = 0.4 + c;
        this.life[i] = this.maxLife[i] = 0.7 + r() * 0.5; this.baseSize[i] = 0.18 + r() * 0.14; this.grav[i] = -9.5;
      } else { // spark / muzzle flash
        this.vel[i3] = (r() - 0.5) * 2.5; this.vel[i3 + 1] = (r() - 0.5) * 2.5; this.vel[i3 + 2] = (r() - 0.5) * 2.5;
        this.col[i3] = 1; this.col[i3 + 1] = 0.8; this.col[i3 + 2] = 0.3;
        this.life[i] = this.maxLife[i] = 0.16 + r() * 0.12; this.baseSize[i] = 0.3 + r() * 0.25; this.grav[i] = 0;
      }
      this.sizeArr[i] = this.baseSize[i];
    }
  }
  update(dt) {
    let live = 0;
    for (let i = 0; i < MAXP; i++) {
      if (this.life[i] <= 0) { this.sizeArr[i] = 0; continue; }
      live++;
      const i3 = i * 3;
      this.life[i] -= dt;
      const f = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.vel[i3 + 1] += this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.grav[i] < 0 && this.pos[i3 + 1] < 0.06) {
        this.pos[i3 + 1] = 0.06; this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.55; this.vel[i3 + 2] *= 0.55;
      }
      // smoke/fire expand as they fade; debris/sparks shrink
      this.sizeArr[i] = this.grav[i] > 0
        ? this.baseSize[i] * (1.9 - f)
        : Math.max(0.001, this.baseSize[i] * f);
    }
    this.points.visible = live > 0;
    if (live) {
      const a = this.geo.attributes;
      a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
    }
  }
}

/* --------------------------------------------------------- weapon meshes */
export function buildWeaponModels() {
  const steel = mkMat(0xb9c2cc, { metalness: 0.5, roughness: 0.35 });
  const dark = mkMat(0x22252b);
  const wood = mkMat(0x9a5b3f);
  const green = mkMat(0x4a6b35);
  const red = mkMat(0xc0392b);
  const out = {};

  const s = new THREE.Group();
  {
    const blade = new THREE.Mesh(BR, steel); blade.scale.set(0.12, 1.5, 0.32); blade.position.y = 0.95;
    const tip = new THREE.Mesh(BR, steel); tip.scale.set(0.12, 0.3, 0.16); tip.position.y = 1.82;
    const guard = new THREE.Mesh(BR, red); guard.scale.set(0.16, 0.1, 0.5); guard.position.y = 0.18;
    const grip = new THREE.Mesh(CY, dark); grip.scale.set(0.06, 0.3, 0.06); grip.position.y = -0.02;
    s.add(blade, tip, guard, grip);
  }
  out.sword = s;

  const h = new THREE.Group();
  {
    const shaft = new THREE.Mesh(CY, wood); shaft.scale.set(0.07, 1.15, 0.07); shaft.position.y = 0.5;
    const head = new THREE.Mesh(BR, steel); head.scale.set(0.55, 0.34, 0.34); head.position.y = 1.12;
    const cap = new THREE.Mesh(BR, dark); cap.scale.set(0.16, 0.38, 0.38); cap.position.set(0.32, 1.12, 0);
    h.add(shaft, head, cap);
  }
  out.hammer = h;

  const f = new THREE.Group();
  {
    const body = new THREE.Mesh(BR, red); body.scale.set(0.2, 0.26, 0.7); body.position.set(0, 0, 0.1);
    const barrel = new THREE.Mesh(CY, dark); barrel.scale.set(0.07, 0.55, 0.07); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.04, 0.62);
    const tank = new THREE.Mesh(CY, steel); tank.scale.set(0.13, 0.42, 0.13); tank.rotation.x = Math.PI / 2; tank.position.set(0, -0.14, -0.05);
    const tip = new THREE.Mesh(BR, mkMat(0xffd23f)); tip.scale.set(0.1, 0.08, 0.12); tip.position.set(0, 0.04, 0.9);
    f.add(body, barrel, tank, tip);
  }
  out.flame = f;

  const r = new THREE.Group();
  {
    const tube = new THREE.Mesh(CY, green); tube.scale.set(0.14, 1.25, 0.14); tube.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(CY, dark); ring.scale.set(0.17, 0.16, 0.17); ring.rotation.x = Math.PI / 2; ring.position.z = -0.6;
    const sight = new THREE.Mesh(BR, dark); sight.scale.set(0.06, 0.16, 0.3); sight.position.set(0, 0.17, 0.1);
    const nose = new THREE.Mesh(BR, red); nose.scale.set(0.1, 0.1, 0.34); nose.position.z = 0.95;
    const fins = new THREE.Mesh(BR, dark); fins.scale.set(0.24, 0.24, 0.1); fins.position.z = 0.75;
    r.add(tube, ring, sight, nose, fins);
  }
  out.rpg = r;

  for (const grp of Object.values(out)) grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return out;
}

export function makeRocketMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(CY, mkMat(0xb9c2cc, { metalness: 0.4 }));
  body.scale.set(0.1, 0.5, 0.1); body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(BR, mkMat(0xc0392b)); nose.scale.set(0.1, 0.1, 0.28); nose.position.z = 0.38;
  const fins = new THREE.Mesh(BR, mkMat(0x22252b)); fins.scale.set(0.22, 0.22, 0.08); fins.position.z = -0.26;
  g.add(body, nose, fins);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* Ray vs AABB: entry distance or null. */
export function rayAabb(ro, rd, box) {
  const EPS = 1e-9;
  const slab = (o, d, mn, mx) => {
    const io = Math.abs(d) < EPS ? (d < 0 ? -1 : 1) / EPS : 1 / d;
    let ta = (mn - o) * io, tb = (mx - o) * io;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    return [ta, tb];
  };
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, d, mn, mx] of [
    [ro.x, rd.x, box.min.x, box.max.x],
    [ro.y, rd.y, box.min.y, box.max.y],
    [ro.z, rd.z, box.min.z, box.max.z]
  ]) {
    const p = slab(o, d, mn, mx);
    t0 = Math.max(t0, p[0]); t1 = Math.min(t1, p[1]);
    if (t1 < t0) return null;
  }
  return t0 >= 0 ? t0 : null;
}

export function nearestPointOnBox(box, p, out) {
  out.set(
    clamp(p.x, box.min.x, box.max.x),
    clamp(p.y, box.min.y, box.max.y),
    clamp(p.z, box.min.z, box.max.z)
  );
  return out;
}
