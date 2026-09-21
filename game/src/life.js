/* Inhabitants & vehicles. Habitat rules: cows/chickens farm-only; dogs/cats/
   birds rural + urban; people urban + rural + farms; balloons roam open sky;
   cars cruise recorded road segments; boats patrol the river channel. */
import * as THREE from 'three';
import { BR, SP, CY, mkMat, clamp } from './brickkit.js';

const SKINS = [0xffcc99, 0xf5b98b, 0xd69c6d, 0xa5714b, 0x8a5a3b];
const SHIRTS = [0xdc1414, 0x2f7de1, 0xf5aa0f, 0x2aa876, 0x8e44ad, 0x16a3b8, 0xd81e5b];
const HATS = [0x22252b, 0xdc1414, 0x2f7de1, 0xffdc2d, 0xffffff];

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const mod = (v, m) => ((v % m) + m) % m;

function box(parent, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(BR, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function finish(g) {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function legoGuy(rand, opts = {}) {
  const g = new THREE.Group();
  const skin = mkMat(pick(rand, SKINS));
  const shirt = mkMat(opts.shirt !== undefined ? opts.shirt : pick(rand, SHIRTS));
  const pants = mkMat(pick(rand, [0x22252b, 0x2f4a7a, 0x6b4a2f, 0x356b3f]));
  box(g, pants, 0.17, 0.2, 0.19, -0.085, 0.1, 0);
  box(g, pants, 0.17, 0.2, 0.19, 0.085, 0.1, 0);
  box(g, shirt, 0.34, 0.26, 0.2, 0, 0.33, 0);
  const armL = box(g, skin, 0.11, 0.22, 0.13, -0.225, 0.33, 0);
  const armR = box(g, skin, 0.11, 0.22, 0.13, 0.225, 0.33, 0);
  box(g, skin, 0.24, 0.2, 0.21, 0, 0.57, 0);
  if (opts.hat !== false) box(g, mkMat(pick(rand, HATS)), 0.26, 0.07, 0.23, 0, 0.7, 0);
  box(g, mkMat(0x22252b), 0.045, 0.045, 0.03, -0.06, 0.59, -0.106);
  box(g, mkMat(0x22252b), 0.045, 0.045, 0.03, 0.06, 0.59, -0.106);
  g.userData.legs = g.children.slice(0, 2);
  g.userData.arms = [armL, armR];
  return finish(g);
}

function cowMesh(rand) {
  const g = new THREE.Group();
  const hide = mkMat(0xf2ede4), patch = mkMat(0x241f1c), pink = mkMat(0xe8a0a0);
  box(g, hide, 0.5, 0.42, 0.9, 0, 0.44, 0);
  box(g, patch, 0.52, 0.28, 0.3, 0, 0.5, 0.16);
  box(g, hide, 0.34, 0.3, 0.3, 0, 0.6, -0.55);
  box(g, pink, 0.2, 0.12, 0.1, 0, 0.52, -0.72);
  box(g, patch, 0.1, 0.16, 0.1, -0.12, 0.78, -0.55);
  g.userData.legs = [
    box(g, hide, 0.09, 0.3, 0.09, -0.17, 0.15, 0.3),
    box(g, hide, 0.09, 0.3, 0.09, 0.17, 0.15, 0.3),
    box(g, hide, 0.09, 0.3, 0.09, -0.17, 0.15, -0.3),
    box(g, hide, 0.09, 0.3, 0.09, 0.17, 0.15, -0.3)
  ];
  box(g, patch, 0.08, 0.3, 0.08, 0, 0.5, 0.48);
  return finish(g);
}

function chickenMesh(rand) {
  const g = new THREE.Group();
  const body = mkMat(pick(rand, [0xf7f3e8, 0xd9cfc0, 0xf0b429]));
  box(g, body, 0.22, 0.22, 0.28, 0, 0.2, 0);
  box(g, body, 0.14, 0.13, 0.13, 0, 0.36, -0.1);
  box(g, mkMat(0xffa63f), 0.06, 0.05, 0.08, 0, 0.34, -0.2);
  box(g, mkMat(0xdc1414), 0.04, 0.06, 0.08, 0, 0.44, -0.1);
  g.userData.legs = [
    box(g, mkMat(0x22252b), 0.03, 0.12, 0.03, -0.05, 0.06, 0),
    box(g, mkMat(0x22252b), 0.03, 0.12, 0.03, 0.05, 0.06, 0)
  ];
  return finish(g);
}

function dogMesh(rand) {
  const g = new THREE.Group();
  const fur = mkMat(pick(rand, [0x9a5b3f, 0xd9b98a, 0x4a4a4a, 0xe8e0d0]));
  box(g, fur, 0.22, 0.2, 0.42, 0, 0.26, 0);
  box(g, fur, 0.18, 0.17, 0.17, 0, 0.38, -0.28);
  box(g, mkMat(0x22252b), 0.06, 0.05, 0.06, 0, 0.36, -0.38);
  box(g, fur, 0.06, 0.1, 0.06, -0.08, 0.5, -0.26);
  box(g, fur, 0.06, 0.1, 0.06, 0.08, 0.5, -0.26);
  g.userData.tail = box(g, fur, 0.05, 0.05, 0.22, 0, 0.34, 0.3);
  g.userData.legs = [
    box(g, fur, 0.06, 0.16, 0.06, -0.08, 0.08, 0.14),
    box(g, fur, 0.06, 0.16, 0.06, 0.08, 0.08, 0.14),
    box(g, fur, 0.06, 0.16, 0.06, -0.08, 0.08, -0.14),
    box(g, fur, 0.06, 0.16, 0.06, 0.08, 0.08, -0.14)
  ];
  return finish(g);
}

function catMesh(rand) {
  const g = new THREE.Group();
  const fur = mkMat(pick(rand, [0x3a3a3a, 0xd07e2e, 0xb0b0b0, 0xf0e6d2]));
  box(g, fur, 0.16, 0.15, 0.32, 0, 0.19, 0);
  box(g, fur, 0.14, 0.13, 0.13, 0, 0.29, -0.21);
  box(g, fur, 0.04, 0.08, 0.04, -0.06, 0.39, -0.2);
  box(g, fur, 0.04, 0.08, 0.04, 0.06, 0.39, -0.2);
  g.userData.tail = box(g, fur, 0.04, 0.04, 0.24, 0, 0.26, 0.24);
  g.userData.legs = [
    box(g, fur, 0.045, 0.12, 0.045, -0.055, 0.06, 0.1),
    box(g, fur, 0.045, 0.12, 0.045, 0.055, 0.06, 0.1),
    box(g, fur, 0.045, 0.12, 0.045, -0.055, 0.06, -0.1),
    box(g, fur, 0.045, 0.12, 0.045, 0.055, 0.06, -0.1)
  ];
  return finish(g);
}

function birdMesh(rand) {
  const g = new THREE.Group();
  const body = mkMat(pick(rand, [0x2f7de1, 0xdc1414, 0xffdc2d, 0xf7f3e8, 0x16a3b8]));
  box(g, body, 0.12, 0.1, 0.18, 0, 0, 0);
  box(g, body, 0.09, 0.09, 0.09, 0, 0.05, -0.11);
  box(g, mkMat(0xffa63f), 0.04, 0.03, 0.06, 0, 0.04, -0.18);
  const wl = box(g, body, 0.14, 0.03, 0.1, -0.1, 0.03, 0);
  const wr = box(g, body, 0.14, 0.03, 0.1, 0.1, 0.03, 0);
  g.userData.wings = [wl, wr];
  return finish(g);
}

function balloonMesh(rand) {
  const g = new THREE.Group();
  const env = new THREE.Mesh(SP, mkMat(pick(rand, [0xdc1414, 0x2f7de1, 0xf5aa0f, 0x2aa876, 0xd81e5b])));
  env.scale.set(1.7, 2.1, 1.7);
  env.position.y = 2.6;
  g.add(env);
  const band = new THREE.Mesh(SP, mkMat(0xffffff));
  band.scale.set(1.74, 0.35, 1.74);
  band.position.y = 2.6;
  g.add(band);
  box(g, mkMat(0x9a5b3f), 0.7, 0.5, 0.7, 0, 0.62, 0);
  box(g, mkMat(0x22252b), 0.04, 1.5, 0.04, -0.3, 1.45, 0);
  box(g, mkMat(0x22252b), 0.04, 1.5, 0.04, 0.3, 1.45, 0);
  const pilot = legoGuy(rand, { hat: false });
  pilot.scale.setScalar(0.7);
  pilot.position.set(0, 0.82, 0);
  g.add(pilot);
  return finish(g);
}

function carMesh(rand) {
  const g = new THREE.Group();
  const col = mkMat(pick(rand, [0xdc1414, 0x2f7de1, 0xffdc2d, 0x2aa876, 0xf7f3e8, 0x22252b]));
  const glass = mkMat(0x9fd4ff, { roughness: 0.2, metalness: 0.3 });
  box(g, col, 0.7, 0.26, 1.3, 0, 0.28, 0);
  box(g, glass, 0.6, 0.24, 0.55, 0, 0.52, -0.1);
  box(g, col, 0.7, 0.1, 0.3, 0, 0.55, 0.35);
  box(g, mkMat(0xffe9a8, { emissive: 0xffd23f, emissiveIntensity: 0.9 }), 0.12, 0.1, 0.06, -0.22, 0.3, -0.67);
  box(g, mkMat(0xffe9a8, { emissive: 0xffd23f, emissiveIntensity: 0.9 }), 0.12, 0.1, 0.06, 0.22, 0.3, -0.67);
  box(g, mkMat(0xc0392b, { emissive: 0xc0392b, emissiveIntensity: 0.6 }), 0.12, 0.1, 0.05, -0.22, 0.3, 0.67);
  box(g, mkMat(0xc0392b, { emissive: 0xc0392b, emissiveIntensity: 0.6 }), 0.12, 0.1, 0.05, 0.22, 0.3, 0.67);
  box(g, mkMat(0x1a1c20), 0.16, 0.24, 0.24, -0.36, 0.12, -0.4);
  box(g, mkMat(0x1a1c20), 0.16, 0.24, 0.24, 0.36, 0.12, -0.4);
  box(g, mkMat(0x1a1c20), 0.16, 0.24, 0.24, -0.36, 0.12, 0.4);
  box(g, mkMat(0x1a1c20), 0.16, 0.24, 0.24, 0.36, 0.12, 0.4);
  return finish(g);
}

function boatMesh(rand) {
  const g = new THREE.Group();
  const hull = mkMat(pick(rand, [0xc0392b, 0x2f7de1, 0x2aa876, 0xf5aa0f]));
  box(g, hull, 1.2, 0.4, 2.4, 0, 0.1, 0);
  box(g, mkMat(0xf0e2c0), 0.95, 0.12, 1.9, 0, 0.34, 0);
  box(g, mkMat(0xffffff), 0.6, 0.4, 0.7, 0, 0.6, 0.4);
  const mast = new THREE.Mesh(CY, mkMat(0x9a5b3f));
  mast.scale.set(0.05, 1.4, 0.05);
  mast.position.set(0, 1.0, -0.5);
  g.add(mast);
  box(g, mkMat(0xf7f3e8), 0.05, 1.1, 0.9, 0, 1.1, -0.15);
  const skipper = legoGuy(rand, { shirt: 0xffffff });
  skipper.scale.setScalar(0.75);
  skipper.position.set(0, 0.4, 0.4);
  g.add(skipper);
  return finish(g);
}

const MAKERS = {
  person: legoGuy, cow: cowMesh, chicken: chickenMesh, dog: dogMesh,
  cat: catMesh, bird: birdMesh, balloon: balloonMesh, car: carMesh, boat: boatMesh
};

export class Life {
  constructor(world, scene, rand) {
    this.world = world;
    this.scene = scene;
    this.rand = rand;
    this.creatures = [];
    this.group = new THREE.Group();
    this.group.name = 'life';
    scene.add(this.group);
  }

  dispose() {
    for (const c of this.creatures) this.group.remove(c.mesh);
    this.creatures = [];
    this.scene.remove(this.group);
  }

  counts() {
    const out = {};
    for (const c of this.creatures) if (c.alive) out[c.kind] = (out[c.kind] || 0) + 1;
    return out;
  }

  ground(x, z) {
    const top = this.world.surfaceTop(Math.floor(x + 0.5), Math.floor(z + 0.5), 6);
    return top > -Infinity ? top : 0;
  }

  _spawn(kind, x, z, homeR, opts) {
    const H = this.world.half - 3;
    x = clamp(x, -H, H); z = clamp(z, -H, H);
    const gy = this.ground(x, z);
    const mesh = MAKERS[kind](this.rand, opts || {});
    this.group.add(mesh);
    mesh.position.set(x, kind === 'boat' ? 0.4 : kind === 'bird' ? 5 : kind === 'balloon' ? 15 : gy, z);
    const c = {
      kind, mesh, home: { x, z }, homeR,
      tx: x, tz: z, t: this.rand() * 60, walk: 0, reachedAt: 0,
      yaw: this.rand() * Math.PI * 2, lane: this.rand() < 0.5 ? -1 : 1,
      alive: true
    };
    this.creatures.push(c);
    return c;
  }

  /* Settlement sources come from World's own placement records so animals
     always live where their habitat actually generated. */
  populate() {
    const w = this.world;
    const cap = w.preset || { id: 'small', towns: 1, rural: 0, farms: 1, spots: 1 };
    const density = clamp(cap.spots || 1, 0.7, 2.6);
    const farms = w.farmSites || [];
    const rural = w.ruralSites || [];
    const urban = [].concat(w.villageSites || [], w.townSites || []);

    for (const f of farms) {
      const nCow = Math.max(2, Math.round(2 * density));
      for (let i = 0; i < nCow; i++) this._spawn('cow', f.x + 3 + this.rand() * 6, f.z + 3 + this.rand() * 7, 8);
      for (let i = 0; i < nCow + 2; i++) this._spawn('chicken', f.x - 3 + this.rand() * 9, f.z + 2 + this.rand() * 8, 7);
      this._spawn('person', f.x + 1, f.z + 4, 5);
      this._spawn('dog', f.x - 3, f.z + 3, 5);
      this._spawn('cat', f.x - 2, f.z + 5, 5);
    }
    for (const r of rural) {
      this._spawn('person', r.x, r.z + 3, 6);
      this._spawn('dog', r.x + 2, r.z + 2, 6);
      this._spawn('cat', r.x - 2, r.z + 3, 6);
      for (let i = 0; i < 2; i++) this._spawn('bird', r.x + this.rand() * 8 - 4, r.z + this.rand() * 8 - 4, 12);
    }
    for (const u of urban) {
      const n = Math.max(2, Math.round(3 * density));
      for (let i = 0; i < n; i++) {
        const a = this.rand() * Math.PI * 2, r = 3 + this.rand() * 8;
        this._spawn('person', u.x + Math.cos(a) * r, u.z + Math.sin(a) * r, 8);
      }
      this._spawn('dog', u.x + 4, u.z + 4, 7);
      this._spawn('cat', u.x - 4, u.z + 5, 7);
      for (let i = 0; i < 2; i++) this._spawn('bird', u.x + this.rand() * 10 - 5, u.z + this.rand() * 10 - 5, 14);
    }
    const balloons = Math.max(2, Math.min(6, 2 + (cap.towns || 0)));
    for (let i = 0; i < balloons; i++) {
      const a = this.rand() * Math.PI * 2, r = w.half * (0.25 + this.rand() * 0.4);
      this._spawn('balloon', Math.cos(a) * r, Math.sin(a) * r, w.half * 0.3);
    }
    const segs = (w.roadSegs || []).filter((sg) => sg && sg.x0 !== undefined
      && Math.hypot(sg.x1 - sg.x0, sg.z1 - sg.z0) > 8);
    // traffic scales with the road network, so big worlds get fuller streets
    const nCars = segs.length ? Math.min(24, Math.max(3, Math.round(3 + segs.length * 0.9) * (cap.id === 'tiny' ? 0 : 1))) : 0;
    for (let i = 0; nCars && i < nCars; i++) {
      const sg = segs[i % segs.length];
      const c = this._spawn('car', sg.x0, sg.z0, 0);
      if (c) {
        c.seg = sg;
        const driver = legoGuy(this.rand, { hat: false });
        driver.scale.setScalar(0.6);
        driver.position.set(0, 0.52, -0.1);
        c.mesh.add(driver);
      }
    }
    const nBoats = cap.id === 'tiny' ? 2 : cap.id === 'small' ? 3 : 4;
    for (let i = 0; i < nBoats; i++) {
      const c = this._spawn('boat', 0, 0, 0);
      if (c) c.phase = this.rand() * 100;
    }
    if (w.monumentRect) {
      const m = w.monumentRect;
      for (let i = 0; i < 2; i++) {
        this._spawn('bird', m.cx + (this.rand() * 2 - 1) * 8, (m.z0 + m.z1) / 2 + (this.rand() * 2 - 1) * 6, 14);
      }
    }
    return this.counts();
  }

  killNear(x, z, r) {
    let n = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      if (Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z) < r) {
        c.alive = false;
        c.mesh.visible = false;
        n++;
      }
    }
    return n;
  }

  update(dt) {
    const w = this.world;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      c.t += dt;
      const m = c.mesh;

      if (c.kind === 'balloon') {
        const a = c.t * 0.03 + c.yaw, R = c.homeR;
        m.position.x += (c.home.x + Math.cos(a) * R - m.position.x) * Math.min(1, dt * 0.3);
        m.position.z += (c.home.z + Math.sin(a) * R - m.position.z) * Math.min(1, dt * 0.3);
        m.position.y = 15 + Math.sin(c.t * 0.35) * 2.5;
        m.rotation.y = -a;
        continue;
      }
      if (c.kind === 'bird') {
        const a = c.t * 0.45 + c.yaw, R = Math.max(6, c.homeR * 0.7);
        m.position.x = c.home.x + Math.cos(a) * R;
        m.position.z = c.home.z + Math.sin(a) * R;
        m.position.y = 5 + Math.sin(c.t * 1.4) * 1.5;
        m.rotation.y = -a;
        const flap = Math.sin(c.t * 13) * 0.8;
        m.userData.wings[0].rotation.z = flap;
        m.userData.wings[1].rotation.z = -flap;
        continue;
      }
      if (c.kind === 'boat') {
        const r = w.river;
        const span = r.z1 - r.z0 - 3;
        const t = mod(c.t * 1.6 + (c.phase || 0) * 7, span * 2);
        const goingN = t < span;
        const z = r.z0 + 1.5 + (goingN ? t : span * 2 - t);
        const x = (r.x0 + r.x1) / 2 + c.lane * 2.2 + Math.sin(c.t * 0.5) * 1.2;
        m.position.set(x, 0.4 + Math.sin(c.t * 1.9) * 0.08, z);
        m.rotation.z = Math.sin(c.t * 1.9) * 0.06;
        m.rotation.y = goingN ? 0 : Math.PI;
        continue;
      }
      if (c.kind === 'car' && c.seg) {
        const sg = c.seg;
        const len = Math.hypot(sg.x1 - sg.x0, sg.z1 - sg.z0) || 1;
        const u = mod(c.t * 3.2 + c.yaw * 6, len * 2);
        const fwd = u <= len;
        const p = (fwd ? u : u - len) / len;
        const ax = fwd ? sg.x0 : sg.x1, bx = fwd ? sg.x1 : sg.x0;
        const az = fwd ? sg.z0 : sg.z1, bz = fwd ? sg.z1 : sg.z0;
        const dirx = (bx - ax) / len, dirz = (bz - az) / len;
        m.position.x = ax + (bx - ax) * p - dirz * c.lane * 0.6;
        m.position.z = az + (bz - az) * p + dirx * c.lane * 0.6;
        m.position.y = this.ground(m.position.x, m.position.z) + 0.02;
        m.rotation.y = Math.atan2(-dirx, -dirz);
        continue;
      }
      // ground walkers
      const dx = c.tx - m.position.x, dz = c.tz - m.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) {
        c.walk = 0;
        if (c.t - c.reachedAt > 1 + wrand(c) * 2.5) {
          c.reachedAt = c.t;
          const a = Math.random() * Math.PI * 2, r = Math.random() * c.homeR;
          c.tx = clamp(c.home.x + Math.cos(a) * r, -w.half + 3, w.half - 3);
          c.tz = clamp(c.home.z + Math.sin(a) * r, -w.half + 3, w.half - 3);
        }
      } else {
        const sp = c.kind === 'cow' ? 1.0 : c.kind === 'chicken' ? 1.6 : 1.9;
        const step = Math.min(dist, sp * dt);
        m.position.x += (dx / dist) * step;
        m.position.z += (dz / dist) * step;
        c.yaw = Math.atan2(-dx, -dz);
        c.walk += dt;
      }
      m.rotation.y = c.yaw;
      const gy = this.ground(m.position.x, m.position.z);
      m.position.y += (gy - m.position.y) * Math.min(1, dt * 9);
      const sw = Math.sin(c.walk * 7) * (c.walk > 0.05 ? 0.45 : 0.03);
      if (m.userData.legs) {
        m.userData.legs[0].rotation.x = sw;
        if (m.userData.legs[1]) m.userData.legs[1].rotation.x = -sw;
      }
      if (m.userData.arms) {
        m.userData.arms[0].rotation.x = -sw;
        m.userData.arms[1].rotation.x = sw;
      }
      if (m.userData.tail) m.userData.tail.rotation.y = Math.sin(c.t * 3.2) * 0.45;
    }
  }
}

function wrand(c) { return Math.abs(Math.sin(c.t * 12.9898 + c.home.x * 78.233)) % 1; }
