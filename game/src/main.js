import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BR, CY, SP, CO, RAINBOW, GOAL, mkMat, clamp, part, addBox, addCyl, bake, merged } from './brickkit.js';
import { INTERIOR_DEF, buildInterior } from './interior.js';
import { buildOptionsPanel, loadOptions, sizePreset } from './options.js';
import { instancedMosaicMesh, bannerTexture, welcomeTexture, maddoxRaster } from './mosaic.js';
import { WEAPONS, Fx, buildWeaponModels, makeRocketMesh, rayAabb, nearestPointOnBox } from './weaponry.js';
import { sfx } from './sfx.js';
import { Life } from './life.js';
import { Train } from './train.js';
import { WEATHERS, SKY, ParticleField, StarField, Funnel, WaveFront } from './weather.js';
import { sigOf, getState, setState, clearState } from './persist.js';

/* Mutually exclusive control modes; exactly one strip is ever visible. */
export const MODES = [
  { id: 'explore', name: 'Explore — roam free (Esc)',     icon: '🧭', key: 'ESC' },
  { id: 'build',   name: 'Build — brick strip (B)',       icon: '🧱', key: 'B' },
  { id: 'weapon',  name: 'Weapon — weapon strip (V)',     icon: '⚔️', key: 'V' },
  { id: 'weather', name: 'Weather — disaster strip (C)',  icon: '🌦️', key: 'C' }
];
export const MODE_KEYS = { KeyB: 'build', KeyV: 'weapon', KeyC: 'weather' };

const UP = new THREE.Vector3(0, 1, 0);

const BRICKS = [
  { name: 'Brick', w: 1, h: 1, d: 1, color: 0xe8402a, studs: [[0, 0]] },
  { name: 'Plate', w: 1, h: 0.4, d: 1, color: 0x2f7de1, studs: [[0, 0]] },
  { name: 'Wide', w: 2, h: 1, d: 1, color: 0xffc42e, studs: [[-0.5, 0], [0.5, 0]] },
  { name: 'Tile', w: 2, h: 0.4, d: 2, color: 0x35b56a, studs: [] },
  { name: 'Arch', w: 1, h: 2, d: 1, color: 0x9b5de5, studs: [[0, 0]], hollow: true },
  { name: 'Round', w: 1, h: 1, d: 1, color: 0xff8a3d, studs: [[0, 0]], round: true }
];
const BED_TOP = -2.2;

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hash32(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function rndFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class World {
  constructor(scene) {
    this.scene = scene;
    this.solids = [];
    this.staticMeshes = [];
    this.doorAnchors = [];
    this.brickMap = new Map();
    this.brickMeshes = [];
    this.placedCount = 0;
    this._mat = new Map();
    this._studs = new Map();
    this.obstacles = [];
    this.half = 28;
    this.waterTop = 0.4;
    this.river = { x0: -7, x1: 7, z0: 9, z1: 19 };
    this.spots = [];
    this.zones = [];
    this.respawnAnchors = [];
    this.props = [];
    this._propId = 0;
    this.rand = rndFrom(1);
    this.opts = loadOptions();
    this.applyOptions();
    this.sig = sigOf(this.opts);
    const st = getState(this.opts.size, this.sig);
    this.genSalt = st ? st.salt : (Math.floor(Math.random() * 0x7fffffff) >>> 0);
    this._pending = st && Array.isArray(st.entries) ? st.entries : [];
    this.over = this.makeBucket('_over');
    this.inHouse = false;
    this.interior = buildInterior(this.scene);
    this.interiorSolids = this.interior.solids.map((box) => ({ box, brick: null }));
    this.interior.group.visible = false;
    this.build();
  }

  applyOptions() {
    const p = sizePreset(this.opts.size);
    this.preset = p;
    this.half = p.half;
    // k is the classic "small" scaling reference. Clamped to >= 1 so smaller
    // maps never shrink props: map size buys extent + generation capacity
    // (towns/rural/farms/zones/trees), not object scale.
    this.k = clamp(this.half / 28, 1, 1.3);
    this.waterTop = 0.4 * this.k;
    const rz = 1; // river keeps its classic spot; size buys far-bank space, not a wider river
    this.river = { x0: -7 * this.k, x1: 7 * this.k, z0: 9 * rz, z1: 19 * rz };
  }

  makeBucket(name) {
    const group = new THREE.Group();
    group.name = name;
    this.scene.add(group);
    return { group, solids: [], staticMeshes: [] };
  }

  count(id) {
    const o = this.opts;
    if (!o.enabled[id]) return 0;
    const mult = id === 'tree' ? this.preset.trees : id === 'flower' ? this.preset.zones * 0.6 : 1;
    return Math.max(0, Math.min(Math.round((o.counts[id] || 0) * mult), 200));
  }

  addObj(obj) { this._b.group.add(obj); return obj; }

  teardown(b) {
    // shared geometries reused across builds: primitives + cached stud meshes
    const sharedGeo = new Set([BR, CY, SP, CO]);
    for (const m of this._studs.values()) sharedGeo.add(m.geometry);
    b.group.removeFromParent();
    b.group.traverse((o) => {
      if (o.isMesh) {
        if (!sharedGeo.has(o.geometry)) o.geometry.dispose();
        const shared = this._mat.has(o.material?.color?.getHex?.());
        if (!shared) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      }
    });
  }

  clearBricks() {
    const sharedGeo = new Set([BR, CY, SP, CO]);
    for (const m of this._studs.values()) sharedGeo.add(m.geometry);
    for (const rec of [...this.brickMap.values()]) {
      this.scene.remove(rec.group);
      rec.group.traverse((o) => {
        if (o.isMesh) {
          if (!sharedGeo.has(o.geometry)) o.geometry.dispose();
          if (!this._mat.has(o.material?.color?.getHex?.())) o.material.dispose();
        }
      });
    }
    this.brickMap.clear();
    this.brickMeshes = [];
    this.placedCount = 0;
  }

  rebuild() {
    this.teardown(this.over);
    this.clearBricks();
    this.over = this.makeBucket('_over');
    this.applyOptions();
    this.build();
    if (this.onWorldChanged) this.onWorldChanged();
  }

  mat(color) {
    let m = this._mat.get(color);
    if (!m) { m = mkMat(color); this._mat.set(color, m); }
    return m;
  }

  studsMesh(color, studs, topY) {
    if (!studs.length) return null;
    const key = `${color}|${topY.toFixed(2)}|${studs.length}`;
    if (!this._studs.has(key)) {
      const list = [];
      for (const [sx, sz] of studs) addCyl(list, 0.19, 0.17, sx, topY + 0.085, sz);
      const geo = mergeGeometries(list.map(bake), false);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.mat(color));
      mesh.castShadow = true;
      this._studs.set(key, mesh);
    }
    return this._studs.get(key);
  }

  addSolid(box, mesh, noRay, noSupport) {
    const rec = { box, brick: null, noSupport: !!noSupport };
    this._b.solids.push(rec);
    if (mesh) {
      this.addObj(mesh);
      if (!noRay) this._b.staticMeshes.push(mesh);
    }
    return rec;
  }

  /* ---- destructible props: registry + damage ---- */
  registerProp(kind, cx, cz, max, parts, scale = 1) {
    const p = { id: ++this._propId, key: kind + '#' + this._propId, kind, cx, cz, max, dmg: 0, gone: false, parts, scale, extra: [] };
    for (const pt of parts) {
      pt.base = pt.mesh.position.clone();
      pt.baseQ = pt.mesh.quaternion.clone();
      pt.hidden = false;
      if (pt.solid) pt.baseBox = pt.solid.box.clone();
    }
    this.props.push(p);
    return p;
  }

  hidePart(pt) {
    if (pt.hidden) return;
    pt.hidden = true;
    pt.mesh.visible = false;
    if (pt.solid) pt.solid.disabled = true;
  }

  applyHit(p, amount, pt) {
    if (p.gone) return;
    p.dmg += amount;
    if (p.dmg >= p.max) {
      p.gone = true;
      for (const q of p.parts) this.hidePart(q);
      if (p.kind === 'tree') {
        const stump = merged([addCyl([], 0.3, 0.4, p.cx, 0.2, p.cz)], this.mat(0x8b5a2b));
        this.addObj(stump);
        p.extra.push(stump);
      }
    } else {
      const hide = Math.floor((p.dmg / p.max) * p.parts.length);
      for (let j = 0; j < hide; j++) this.hidePart(p.parts[p.parts.length - 1 - j]);
    }
    if (this.onDamage) this.onDamage(p, amount, pt);
  }

  /* Replay persisted damage without hooks/FX/sound. One-shot queue. */
  applyPending() {
    const q = this._pending || [];
    this._pending = [];
    for (const [i, d] of q) {
      const p = this.props[i];
      if (!p || p.gone) continue;
      const save = this.onDamage;
      this.onDamage = null;
      this.applyHit(p, d, null);
      this.onDamage = save;
    }
  }

  propAt(x, z, r) {
    let best = null, bd = r;
    for (const p of this.props) {
      if (p.gone) continue;
      const d = Math.hypot(p.cx - x, p.cz - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  build() {
    // Deterministic generation: seeded from preset + salt, so the damage log
    // (indexed by prop id) replays onto the exact same world after reload.
    this.rand = rndFrom(hash32(this.opts.size + ':' + this.genSalt));
    this.props = [];
    this._propId = 0;
    this.obstacles = [];
    this.zones = [];
    this.respawnAnchors = [];
    this.houseRects = [];
    this.doorAnchors = [];
    this.swings = [];
    this.villageSites = [];
    this.townSites = [];
    this.ruralSites = [];
    this.farmSites = [];
    this.roadSegs = [];
    this.railR = 0;
    this.station = null;
    this.crossRoadZ = undefined;
    this._b = this.over;
    this.solids = this.over.solids;
    this.staticMeshes = this.over.staticMeshes;
    const H = this.half, r = this.river;
    this.buildGround();
    this.buildWater();
    this.buildPaths();
    // Village stays anchored on the near (z<0) side between the hero spawn and
    // the river; everything past the bridge is scaled-up exploration space.
    // Monument reserves its strip first so village/town houses can never
    // fill the candidate row and strand the generator without a site.
    this.buildMonumentSite();
    this.buildVillage();
    // Far-side roads are placed after the monument so they route around it.
    if (H - r.z1 > 8) {
      const pad = this.monumentRect;
      const roadZ = pad ? Math.min(r.z1 + 6, pad.z0 - 6) : r.z1 + 6;
      this.buildRoad(0.5, r.z1 + 1, 0.5, H - 3, 2.2, pad);
      if (roadZ > r.z1 + 2) {
        this.crossRoadZ = roadZ;
        this.buildRoad(0.5, roadZ, H - 4, roadZ, 2.2, pad);
        this.buildRoad(0.5, roadZ, -H + 4, roadZ, 2.2, pad);
      }
      if (pad) {
        this.buildRoad(0.5, r.z1 + 1, pad.cx, r.z1 + 1, 2, pad);
        this.buildRoad(pad.cx, r.z1 + 1, pad.cx, pad.z0 - 7, 2, pad);
      }
    }
    this.buildMountains();
    this.buildVolcanoes();
    this.buildExtraTowns();
    this.buildRuralAndFarms();
    for (let i = 0; i < this.count('tree'); i++) this.buildTree();
    this.buildBridge();
    if (this.preset.train) this.buildRingRail();
    this.pickSpots();
    this.applyPending();
  }

  enterHouse() {
    this.solids = this.interiorSolids;
    this.inHouse = true;
  }

  exitHouse() {
    this.solids = this.over.solids;
    this.inHouse = false;
  }

  inRiver(x, z) { const r = this.river; return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }

  pickSpots() {
    const H = this.half, k = this.k, r = this.river;
    const cands = [];
    const step = Math.max(1.5, H / 30);
    for (let x = -H + 2; x <= H - 2; x += step)
      for (let z = -H + 2; z <= H - 2; z += step) cands.push([x, z]);
    const chosen = [];
    const add = (x, z) => {
      if (this.propBlocked(x, z)) return;
      if (chosen.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 3.2)) return;
      chosen.push([x, z]);
    };
    add(11, r.z0 - 2);   // guaranteed near-bridge spots so the goal stays reachable
    add(11, r.z1 + 2);
    // guarantee at least one spot deep in exploration space (monument plaza)
    const pad = this.monumentRect;
    if (pad && !chosen.some(([cx2, cz2]) => Math.hypot(pad.cx - cx2, pad.z0 + 3 - cz2) < 3.2)) {
      chosen.push([pad.cx, pad.z0 + 3]);
    }
    const limit = Math.round(40 * this.preset.spots);
    for (const [x, z] of this.shuffle(cands)) {
      if (chosen.length >= limit) break;
      if (Math.hypot(x, z) < 5 * k) continue;
      add(x, z);
    }
    this.spots = chosen;
  }

  propBlocked(x, z) {
    if (this.inRiver(x, z)) return true;
    if (Math.abs(x) < 3 && Math.abs(z + 3.5) < 2.5) return true;
    if (Math.abs(x) < 3 && z > -4 * this.k && z < this.river.z0 - 1) return true;
    if (Math.abs(z - (this.river.z0 - 2.5)) < 2.5 && Math.abs(x) < 9.5 * this.k) return true;
    for (const h of this.houseRects || []) {
      if (Math.abs(x - h.x) < h.w + 2 && Math.abs(z - h.z) < h.d + 2) return true;
    }
    for (const h of this.obstacles) {
      if (Math.abs(x - h.x) < h.w + 1 && Math.abs(z - h.z) < h.d + 1) return true;
    }
    return false;
  }

  buildGround() {
    const H = this.half, r = this.river, grass = this.mat(0x74c745);
    const regions = [
      [0, (r.z0 - H - 1) / 2, 2 * (H + 1), r.z0 + H + 1],
      [0, (r.z1 + H + 1) / 2, 2 * (H + 1), H + 1 - r.z1],
      [(r.x0 - H - 1) / 2, (r.z0 + r.z1) / 2, r.x0 + H + 1, r.z1 - r.z0],
      [(r.x1 + H + 1) / 2, (r.z0 + r.z1) / 2, H + 1 - r.x1, r.z1 - r.z0]
    ];
    const parts = [];
    for (const [cx, cz, w, d] of regions) {
      if (w <= 0 || d <= 0) continue;
      addBox(parts, w, 2, d, cx, -1, cz);
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(cx - w / 2, -2, cz - d / 2),
        new THREE.Vector3(cx + w / 2, 0, cz + d / 2)
      ), null, true, true);
    }
    const ground = merged(parts, grass);
    this.addObj(ground);
    this._b.staticMeshes.push(ground);
    this.registerZones();

    const bed = merged([addBox([], r.x1 - r.x0, 1.2, r.z1 - r.z0, 0, BED_TOP - 0.6, (r.z0 + r.z1) / 2)], this.mat(0xd9b98a));
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(r.x0, BED_TOP - 1, r.z0),
      new THREE.Vector3(r.x1, BED_TOP, r.z1)
    ), bed, true);

    const patches = [];
    const stems = [];
    const headsByColor = [[], [], [], []];
    const headMats = [0xff5d8f, 0xffd23f, 0xffffff, 0xff8a3d].map((c) => this.mat(c));
    // terrain-zone ground tints: every tile inside a zone gets a patch of the
    // zone's color, so zones read as distinct regions of the map.
    const zoneTint = { village: 0x7cc850, town: 0x86cf5e, rural: 0x97c85e, farm: 0xa9c05c, wild: 0x67b93c, monument: 0x8ad06a };
    const zonePatches = Object.fromEntries(Object.keys(zoneTint).map((z) => [z, []]));
    const zoneAt = (x, z) => (this.zones.find((zn) => x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) || {}).id;
    for (let x = Math.ceil(-H); x <= H; x += 2) {
      for (let z = Math.ceil(-H); z <= H; z += 2) {
        const zn = zoneAt(x, z);
        if (!zn || zn === 'village' || this.propBlocked(x, z)) continue;
        addBox(zonePatches[zn], 1.7, 0.1, 1.7, x + 0.5, 0.05, z + 0.5);
      }
    }
    for (let i = 0; i < this.count('flower'); i++) {
      const x = Math.round((Math.random() * 2 - 1) * (H - 2)) + 0.5;
      const z = Math.round((Math.random() * 2 - 1) * (H - 2)) + 0.5;
      if (this.propBlocked(x, z)) continue;
      if (hash(x, z) < 0.5) {
        addBox(patches, 1, 0.12, 1, x, 0.06, z);
      } else {
        addCyl(stems, 0.06, 0.34, x, 0.17, z);
        const hd = part(SP, x, 0.42, z);
        hd.scale.setScalar(0.13);
        headsByColor[i % 4].push(hd);
      }
    }
    this.addObj(merged(patches, this.mat(0x8fda5a)));
    for (const zid of Object.keys(zonePatches)) {
      if (zonePatches[zid].length) this.addObj(merged(zonePatches[zid], this.mat(zoneTint[zid])));
    }
    this.addObj(merged(stems, this.mat(0x2f9e4f)));
    headsByColor.forEach((list, i) => { if (list.length) this.addObj(merged(list, headMats[i])); });
  }

  buildWater() {
    const r = this.river;
    const mat = mkMat(0x2f9bea, { roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false });
    const h = this.waterTop - BED_TOP + 0.15;
    const parts = [];
    for (let x = Math.ceil(r.x0); x < r.x1; x++) {
      for (let z = Math.ceil(r.z0); z < r.z1; z++) {
        addBox(parts, 1, h, 1, x + 0.5, BED_TOP - 0.15 + h / 2, z + 0.5);
      }
    }
    const water = merged(parts, mat);
    water.castShadow = false;
    water.renderOrder = 2;
    this.water = water;
    this.addObj(water);
    this._b.staticMeshes.push(water);

    const shore = [];
    for (const z of [Math.floor(r.z0) - 1, Math.ceil(r.z1)]) {
      for (let x = Math.floor(r.x0) - 1; x < Math.ceil(r.x1) + 1; x++) addBox(shore, 1, 0.1, 1, x + 0.5, 0.05, z + 0.5);
    }
    this.addObj(merged(shore, this.mat(0xe8c78a)));
  }

  /* Ring railway hugging the world edge: recessed walkable ballast, twin
     rails, sleepers, a level crossing where the avenue meets it, and a
     platform+shelter station at the SW corner. Skips if anything generated
     inside the outer corridor (defensive). */
  buildRingRail() {
    const H = this.half, r = H - 3;
    const band0 = r - 1.7, band1 = r + 1.7;
    for (const o of this.obstacles) {
      if (Math.abs(o.x) + o.w > band0 - 0.5 && Math.abs(o.z) + o.d > band0 - 0.5) return;
    }
    const m = this.monumentRect;
    if (m && (m.z1 > H - 6.5 || m.z0 < -H + 5.5 || m.x1 > H - 2 || m.x0 < -H + 2)) return;
    this.railR = r;
    const parts = [];
    const half = 1.7;
    const bed = [
      [-r - half, -r - half, r + half, -r + half], [r - half, -r - half, r + half, r + half],
      [-r - half, r - half, r + half, r + half], [-r - half, -r - half, -r + half, r + half]
    ];
    for (const [x0, z0, x1, z1] of bed) addBox(parts, x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, 0.05, (z0 + z1) / 2);
    for (let a = -r; a < r; a += 1.4) {   // sleepers on all four legs
      addBox(parts, 1.5, 0.08, 0.34, a, 0.13, -r);
      addBox(parts, 1.5, 0.08, 0.34, a, 0.13, r);
      addBox(parts, 0.34, 0.08, 1.5, -r, 0.13, a);
      addBox(parts, 0.34, 0.08, 1.5, r, 0.13, a);
    }
    const mesh = merged(parts, this.mat(0x8b8577));
    mesh.receiveShadow = true;
    this.addObj(mesh);
    const railMat = this.mat(0x8d949c);
    for (const o of [-0.5, 0.5]) {
      for (const horiz of [true, false]) {
        const rm = new THREE.Mesh(BR, railMat);
        if (horiz) {
          rm.scale.set(2 * r + 1.4, 0.1, 0.12);
          rm.position.set(0, 0.22, o > 0 ? -r + o : r + o);
        } else {
          rm.scale.set(0.12, 0.1, 2 * r + 1.4);
          rm.position.set(o > 0 ? r + o : -r + o, 0.22, 0);
        }
        rm.castShadow = true;
        this.addObj(rm);
      }
    }
    for (const [x0, z0, x1, z1] of bed) {
      this.addSolid(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 0.1, z1)), null, true, true);
    }
    // level crossing: the x=0.5 avenue runs into the south rail? no — it runs north.
    // The south end of the east/west roads stops short; mark the N avenue crossing
    // where the E-W rail meets the x=0.5 avenue on the north edge.
    const sign = [];
    addBox(sign, 0.12, 2.6, 0.12, 0.5, 1.3, r + 2.4);
    const sgn = merged(sign, this.mat(0xffffff));
    this.addObj(sgn);
    const board = new THREE.Mesh(BR, this.mat(0xc0392b));
    board.scale.set(1.5, 0.3, 0.1);
    board.rotation.z = 0.7;
    board.position.set(0.5, 2.35, r + 2.4);
    this.addObj(board);
    // station: platform + shelter inside the SW corner
    const px = -r + 5.2, pz = -r + 5.2;
    const pf = [];
    addBox(pf, 6, 0.55, 4, px, 0.27, pz);
    const plat = merged(pf, this.mat(0xb8b0a0));
    plat.receiveShadow = true;
    this.addObj(plat);
    this.addSolid(new THREE.Box3(new THREE.Vector3(px - 3, 0, pz - 2), new THREE.Vector3(px + 3, 0.55, pz + 2)), plat);
    const shelter = [];
    for (const sx of [-2.4, 2.4]) for (const sz of [-1.4, 1.4]) addBox(shelter, 0.22, 1.8, 0.22, px + sx, 1.45, pz + sz);
    addBox(shelter, 5.6, 0.22, 3.6, px, 2.45, pz);
    const roof = merged(shelter, this.mat(0xc0392b));
    roof.castShadow = true;
    this.addObj(roof);
    const bench = new THREE.Mesh(BR, this.mat(0x9a5b3f));
    bench.scale.set(2.4, 0.3, 0.7);
    bench.position.set(px, 0.75, pz + 0.9);
    this.addObj(bench);
    this.station = { x: px, z: pz };
  }

  buildPaths() {
    const k = this.k;
    const parts = [];
    const seg = (x0, z0, x1, z1) => {
      const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) / 2);
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
        if (horiz) addBox(parts, 1.8, 0.12, 1.6, x + 0.5, 0.06, z + 0.5);
        else addBox(parts, 1.6, 0.12, 1.8, x + 0.5, 0.06, z + 0.5);
      }
    };
    seg(0.5, -14 * k, 0.5, this.river.z0 - 2);
    seg(-8 * k, this.river.z0 - 2.5, 8 * k, this.river.z0 - 2.5);
    const m = merged(parts, this.mat(0xd9cdb6));
    m.receiveShadow = true;
    this.addObj(m);
    this.respawnAnchors.push({ x: 0.5, z: 3 * k });
  }

  /* One road segment: thin walkable tiles on solid backing; `avoid` (a rect)
     is routed around. Adds a collider whose top equals the tile surface so the
     player can walk roads without step collisions. */
  buildRoad(x0, z0, x1, z1, width = 2.4, avoid = null) {
    const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const parts = [];
    const solid = [];
    const along = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    const n = Math.ceil(along);
    for (let i = 0; i <= n; i++) {
      let x = Math.round(x0 + (x1 - x0) * i / n);
      let z = Math.round(z0 + (z1 - z0) * i / n);
      if (avoid && x > avoid.x0 - 2 && x < avoid.x1 + 2 && z > avoid.z0 - 2 && z < avoid.z1 + 2) {
        // jog sideways around the excluded rect, clamped inside the world
        const H = this.half - 3;
        if (horiz) x = x < (avoid.x0 + avoid.x1) / 2 ? avoid.x0 - 4 : avoid.x1 + 4;
        else z = z < (avoid.z0 + avoid.z1) / 2 ? avoid.z0 - 4 : avoid.z1 + 4;
        if (horiz) x = Math.round(Math.max(-H, Math.min(H, x)));
        else z = Math.round(Math.max(-H, Math.min(H, z)));
      }
      if (horiz) {
        for (let w = 0; w < width; w++) addBox(parts, 1.05, 0.14, 1, x + 0.5, 0.07, z - Math.floor(width / 2) + w + 0.5);
        solid.push([[x - 0.5, -0.1, z - Math.floor(width / 2)], [x + 0.6, 0.14, z + Math.ceil(width / 2)]]);
      } else {
        for (let w = 0; w < width; w++) addBox(parts, 1, 0.14, 1.05, x - Math.floor(width / 2) + w + 0.5, 0.07, z + 0.5);
        solid.push([[x - Math.floor(width / 2), -0.1, z - 0.5], [x + Math.ceil(width / 2), 0.14, z + 0.6]]);
      }
    }
    const mesh = merged(parts, this.mat(0xcfc4ab));
    mesh.receiveShadow = true;
    this.addObj(mesh);
    if (Math.abs(x1 - x0) + Math.abs(z1 - z0) > 8) (this.roadSegs = this.roadSegs || []).push({ x0, z0, x1, z1 });
    for (const [a, b] of solid) {
      this.addSolid(new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b)), null, true, true);
    }
  }

  /* Distinct terrain zones carved out of the playable extent; the count grows
     with the preset (Tiny 1 → Huge 5). Zones drive ground tints and where the
     towns / rural areas / farms / monument get placed. */
  registerZones() {
    const H = this.half, r = this.river, nz = this.preset.zones;
    const mid2 = (r.z1 + H) / 2;
    const zones = [{ id: 'village', x0: -H, x1: H, z0: -H, z1: r.z0 }];
    if (nz >= 2) {
      zones.push({ id: 'town', x0: -H, x1: -H * 0.25, z0: r.z1, z1: H });
      zones.push({ id: 'farm', x0: -H * 0.25, x1: H, z0: r.z1, z1: mid2 });
      zones.push({ id: 'wild', x0: -H * 0.25, x1: H, z0: mid2, z1: H });
    }
    if (nz >= 3) {
      zones.push({ id: 'rural', x0: -H, x1: -H * 0.55, z0: -H, z1: -2 });
    }
    if (nz >= 5) {
      zones.push({ id: 'monument', x0: r.x1 + 6, x1: H * 0.9, z0: r.z0, z1: H });
    }
    this.zones = zones;
  }

  siteInMonument(x, z, pad = 4) {
    const m = this.monumentRect;
    return !!m && x > m.x0 - pad && x < m.x1 + pad && z > m.z0 - pad && z < m.z1 + pad;
  }

  zoneCenter(id, idx = 0) {
    const z = this.zones.find((zn) => zn.id === id);
    if (!z) return null;
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
    const spread = Math.min(z.x1 - z.x0, z.z1 - z.z0) * 0.3;
    const a = idx * 2.399963; // golden angle: stable scatter inside the zone
    return { x: cx + Math.cos(a) * spread, z: cz + Math.sin(a) * spread };
  }

  /* Extra towns on the far (north) bank — presets carry the capacity. */
  buildExtraTowns() {
    const n = this.preset.towns;
    if (!n) return;
    const r = this.river, H = this.half;
    const sites = [
      { x: -16, dz: 5, ry: 0, body: 0xff7f50, roof: 0x2f7de1 },
      { x: -24, dz: 8, ry: Math.PI / 2, body: 0x35a7ff, roof: 0xffd23f },
      { x: -13, dz: 14, ry: -Math.PI / 2, body: 0xffd23f, roof: 0x9b5de5 },
      { x: -21, dz: 18, ry: Math.PI, body: 0x35b56a, roof: 0xe8402a }
    ];
    let placed = 0;
    for (const st of sites) {
      if (placed >= n) break;
      const h = { x: st.x * this.k, z: Math.min(r.z1 + st.dz, H - 4), ry: st.ry, body: st.body, roof: st.roof };
      if (Math.abs(h.x) > H - 5 || h.z < r.z1 + 4) continue;
      if (this.propBlocked(h.x, h.z) || this.siteInMonument(h.x, h.z, 5)) continue;
      if (this.buildHouse(h)) { placed++; (this.townSites = this.townSites || []).push(h); }
    }
    for (let i = 0; i < placed; i++) {
      const rc = this.houseRects[this.houseRects.length - 1 - i];
      this.respawnAnchors.push({ x: rc.x, z: rc.z + rc.d + 2 });
    }
  }

  /* Rural homesteads + farms: capacity scales with preset (rural/farms). */
  buildRuralAndFarms() {
    const p = this.preset, H = this.half, r = this.river;
    if (!p.rural && !p.farms) return;
    const sites = [];
    for (let i = 0; i < p.rural; i++) {
      const c = this.zoneCenter('rural', i + 1) || { x: -H * 0.75, z: -H * 0.5 };
      const x = Math.max(-H + 6, Math.min(-H * 0.58, c.x));
      const z = Math.max(-H + 6, Math.min(-4, c.z));
      sites.push({ x, z, ry: Math.PI, body: 0xd9b98a, roof: 0x8b5a2b, farm: i < Math.min(p.farms, 2) });
    }
    for (let i = 0; i < p.farms; i++) {
      if (i < Math.min(p.rural, 2)) continue; // rural homesteads double as the first farms
      const fz = this.zones.find((zn) => zn.id === 'farm');
      let x, z;
      if (fz) {
        // sunflower scatter filling the whole farm zone, not clustered at its center
        const a = i * 2.399963 + 1.7;
        const rad = 0.35 + 0.55 * Math.sqrt((i + 0.6) / Math.max(1, p.farms));
        x = (fz.x0 + fz.x1) / 2 + Math.cos(a) * rad * (fz.x1 - fz.x0) * 0.42;
        z = (fz.z0 + fz.z1) / 2 + Math.sin(a) * rad * (fz.z1 - fz.z0) * 0.42;
      } else {
        const c = { x: (r.x1 + H) / 2, z: (r.z1 + H) / 2 };
        x = c.x; z = c.z;
      }
      x = Math.max(r.x1 + 4, Math.min(H - 8, x));
      z = Math.max(r.z1 + 4, Math.min(H - 8, z));
      sites.push({ x, z, ry: 0, body: 0xc0392b, roof: 0xf1f3f5, farm: true });
    }
    for (const st of sites) {
      if (this.propBlocked(st.x, st.z) || this.siteInMonument(st.x, st.z, 5)) continue;
      if (!this.buildHouse(st)) continue;
      this.respawnAnchors.push({ x: st.x, z: st.z + 4 });
      this.ruralSites.push(st);
      if (st.farm) this.farmSites.push(st);
      if (st.farm) this.buildFarm(st);
    }
  }

  /* Barn + fenced crop field + pond + haystack; all colliders walkable/edge-safe. */
  buildFarm(s) {
    const grp = new THREE.Group();
    const bx = s.x + (s.ry === 0 ? 6 : -6), bz = s.z + 1;
    if (Math.abs(bx) > this.half - 4) return;
    // barn
    const barnMesh = merged([addBox([], 4, 2.6, 3, bx, 1.3, bz)], this.mat(0xc0392b));
    grp.add(barnMesh);
    const rf = [];
    for (const s2 of [-1, 1]) {
      const m = addBox(rf, 3.2, 0.3, 3.6, bx + s2 * 1.0, 3.05, bz);
      m.rotation.z = -s2 * 0.5;
    }
    const barnRoof = merged(rf, this.mat(0xf1f3f5));
    grp.add(barnRoof);
    const barnSolid = this.addSolid(new THREE.Box3(
      new THREE.Vector3(bx - 2, 0, bz - 1.5), new THREE.Vector3(bx + 2, 2.6, bz + 1.5)
    ), null, true);
    this.registerProp('barn', bx, bz, 220, [{ mesh: barnMesh, solid: barnSolid }, { mesh: barnRoof }]);
    this.obstacles.push({ x: bx, z: bz, w: 2.4, d: 2 });

    // crop field: raised walkable soil beds with furrows
    const fx = s.x - (s.ry === 0 ? 5 : -5), fz = s.z - 4;
    const field = new THREE.Group();
    field.position.set(fx, 0, fz);
    const beds = [], soil = [];
    for (let i = 0; i < 4; i++) {
      addBox(soil, 6.2, 0.28, 1.1, 0, 0.14, i * 1.6 - 2.4);
      for (let c = 0; c < 5; c++) {
        const crop = part(SP, c * 1.2 - 2.4, 0.5, i * 1.6 - 2.4);
        crop.scale.setScalar(0.22);
        beds.push(crop);
      }
    }
    field.add(merged(soil, this.mat(0x8a5a30)));
    field.add(merged(beds, this.mat(0x3fb963)));
    const posts = [];
    for (const sx of [-3.4, 3.4]) for (const sz of [-3.4, 0, 3.4]) addCyl(posts, 0.08, 1, sx, 0.5, sz, 0.08);
    field.add(merged(posts, this.mat(0x9a5b3f)));
    for (const sz of [-3.4, 3.4]) {
      const rail = addBox([], 6.8, 0.1, 0.1, 0, 0.85, sz); field.add(merged([rail], this.mat(0xd9b98a)));
    }
    grp.add(field);
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(fx - 3.1, 0, fz - 3), new THREE.Vector3(fx + 3.1, 0.28, fz + 3)
    ), null, true, true);

    // pond (rim above water level so it isn't a trap) + haystack
    const px = fx + 6, pz = fz + 4;
    if (Math.abs(px) < this.half - 2 && Math.abs(pz) < this.half - 2) {
      const rim = [];
      for (let a = 0; a < 8; a++) {
        addBox(rim, 1.2, 0.5, 1.2, px + Math.cos(a * Math.PI / 4) * 1.9, 0.08, pz + Math.sin(a * Math.PI / 4) * 1.9);
      }
      this.addObj(merged(rim, this.mat(0xb9c2cc)));
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 8),
        mkMat(0x2f9bea, { roughness: 0.15, transparent: true, opacity: 0.85 }));
      water.position.set(px, 0.3, pz);
      grp.add(water);
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(px - 1.5, 0, pz - 1.5), new THREE.Vector3(px + 1.5, 0.3, pz + 1.5)
      ), null, true, true);
    }
    const hay = part(CY, s.x + 3, 0.55, s.z + 3);
    hay.scale.set(0.9, 1.1, 0.9); hay.rotation.x = Math.PI / 2;
    grp.add(merged([hay], this.mat(0xe0b53f)));
    this.addObj(grp);
  }

  /* The one giant monument. Prefers the far (north) bank; on smaller maps it
     drops to the south bank in front of the village. Never overlaps props. */
  buildMonumentSite() {
    this.monumentRect = null;
    this.monument = null;
    const H = this.half, r = this.river;
    const hitProp = (x0, x1, z0, z1) => {
      for (const o of this.obstacles) {
        if (x1 > o.x - o.w - 1 && x0 < o.x + o.w + 1 &&
            z1 > o.z - o.d - 1 && z0 < o.z + o.d + 1) return true;
      }
      for (const h of this.houseRects) {
        if (x1 > h.x - h.w - 1.5 && x0 < h.x + h.w + 1.5 &&
            z1 > h.z - h.d - 1.5 && z0 < h.z + h.d + 1.5) return true;
      }
      return false;
    };
    const zm = this.zones.find((zn) => zn.id === 'monument');
    const attempts = [];
    const outer = this.preset.train ? 7 : 1.5;   // keep the rail ring's outer corridor free
    { // north bank
      const availZ = H - outer - (r.z1 + 5);
      attempts.push({ side: 1, depth: availZ, prefer: zm ? (zm.x0 + zm.x1) / 2 : (r.x1 + H) / 2 });
    }
    { // south bank (in front of the village, works on Tiny/Small)
      const depth = (-r.z0 - 6) - (-H + (outer - 0.5));
      attempts.push({ side: -1, depth, prefer: -H * 0.15 });
    }
    let chosen = null;
    for (const at of attempts) {
      if (at.depth < 10) continue;
      const sc = at.depth >= 22 ? 1 : 0.8;
      const wallW = 22 * sc, plazaW = wallW + 10;
      const plazaD = Math.min(16 * sc + 6, at.depth);
      if (plazaD < 9 || H * 2 - 4 < plazaW + 4) continue;
      const cxLo = -H + plazaW / 2 + 1.5, cxHi = H - plazaW / 2 - 1.5;
      let bd = Infinity, cx = null;
      for (let c = cxLo; c <= cxHi; c += 2) {
        const zNear = at.side > 0 ? r.z1 + 5 : -r.z0 - 6;
        const z0 = at.side > 0 ? zNear : zNear - plazaD;
        const z1 = z0 + plazaD;
        if (Math.abs(c - at.prefer) < bd && !hitProp(c - plazaW / 2 - 2, c + plazaW / 2 + 2, z0 - 3, z1 + 3)) {
          bd = Math.abs(c - at.prefer); cx = c;
        }
      }
      if (cx === null) {
        // last resort: nearest candidate ignoring props (site row is already
        // reserved before houses are placed, so this rarely fires)
        for (let c = cxLo; c <= cxHi; c += 2) {
          if (Math.abs(c - at.prefer) < bd) { bd = Math.abs(c - at.prefer); cx = c; }
        }
      }
      if (cx !== null) { chosen = { at, sc, wallW, plazaW, plazaD, cx: Math.round(cx) }; break; }
    }
    if (!chosen) return;
    const { at, sc, wallW, plazaW, plazaD } = chosen;
    const wallH = 18 * sc, wallD = 2.6;
    const cx = chosen.cx;
    const side = at.side; // +1: plaza at north edge, wall facing south; -1: plaza at south edge, facing north
    const plazaZ1 = side > 0 ? H - outer + 0.5 : (-r.z0 - 6);
    const plazaZ0 = plazaZ1 - plazaD;
    const wallZ = side > 0 ? plazaZ1 - 2 : plazaZ0 + 2;
    const pedTop = 1.2 + 4 * Math.max(0.7, sc);
    const grp = new THREE.Group();
    grp.name = 'monument';

    // plaza: thick solid, top at y=1.2 — valid flat walkable terrain
    grp.add(merged([addBox([], plazaW, 1.2, plazaD, cx, 0.6, (plazaZ0 + plazaZ1) / 2)], this.mat(0xb9a98f)));
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(cx - plazaW / 2, 0, plazaZ0),
      new THREE.Vector3(cx + plazaW / 2, 1.2, plazaZ1)
    ), null, true, true);

    // steps up to the plaza, on the approach side (walkable 0.4 rises)
    const stSign = side > 0 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      const sy = 0.4 * (3 - i), sz = (side > 0 ? plazaZ0 : plazaZ1) + stSign * (1.5 + i * 1.5);
      grp.add(merged([addBox([], plazaW * 0.7, sy, 1.5, cx, sy / 2, sz)], this.mat(0xcfc4ab)));
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(cx - plazaW * 0.35, 0, sz - 0.75),
        new THREE.Vector3(cx + plazaW * 0.35, sy, sz + 0.75)
      ), null, true, true);
    }

    // pedestal (buildable support) + wall backing + buttresses
    const pedW = wallW + 4, pedD = 12 * sc;
    grp.add(merged([addBox([], pedW, pedTop - 1.2, pedD, cx, (1.2 + pedTop) / 2, wallZ)], this.mat(0x8f9aa8)));
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(cx - pedW / 2, 1.2, wallZ - pedD / 2),
      new THREE.Vector3(cx + pedW / 2, pedTop, wallZ + pedD / 2)
    ), null, true);

    const wallMesh = merged([addBox([], wallW, wallH, wallD, cx, pedTop + wallH / 2, wallZ)], this.mat(0x3b3b40));
    grp.add(wallMesh);
    // collider spans wall + projected mosaic depth (symmetric: side-agnostic)
    const zd = wallD / 2 + 3.0; // covers protruding relief blocks
    const wallSolid = this.addSolid(new THREE.Box3(
      new THREE.Vector3(cx - wallW / 2 - 0.6, pedTop, wallZ - zd),
      new THREE.Vector3(cx + wallW / 2 + 0.6, pedTop + wallH, wallZ + zd)
    ), null, true);
    this.registerProp('monument', cx, wallZ, 900, [{ mesh: wallMesh, solid: wallSolid }]);

    for (const s2 of [-1, 1]) {
      // buttress fully outside the wall footprint so the mosaic stays visible
      const bx0 = cx + s2 * (wallW / 2 + 1.9), bx1 = cx + s2 * (wallW / 2 + 3.3);
      grp.add(merged([addBox([], 1.4, wallH * 0.62, 6 * sc, (bx0 + bx1) / 2, pedTop + wallH * 0.31, wallZ)], this.mat(0x7d8896)));
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(Math.min(bx0, bx1), pedTop, wallZ - 3 * sc),
        new THREE.Vector3(Math.max(bx0, bx1), pedTop + wallH * 0.62, wallZ + 3 * sc)
      ), null, true);
      const light = new THREE.PointLight(0xffd166, 1.2, 26, 2);
      light.position.set(cx + s2 * (plazaW / 2 - 3), 5, (side > 0 ? plazaZ1 : plazaZ0) + stSign * 3);
      grp.add(light);
    }

    // plaque on the wall's public face (same 16-color mosaic, via the banner)
    const faceSign = stSign; // mosaic/plaque on the plaza/approach side
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(8 * sc, 2.4 * sc),
      new THREE.MeshBasicMaterial({ color: 0x8f9aa8 }));
    plaque.position.set(cx, pedTop - 1.4 * Math.max(0.7, sc), wallZ + faceSign * (pedD / 2 + 0.06));
    plaque.rotation.y = faceSign > 0 ? 0 : Math.PI;
    grp.add(plaque);
    const mprop = this.props[this.props.length - 1];
    if (mprop && mprop.kind === 'monument') mprop.parts.push({ mesh: plaque });
    bannerTexture().then((b) => {
      if (grp.parent) {
        plaque.material.map = b.tex;
        plaque.material.color.setHex(0xffffff);
        plaque.material.needsUpdate = true;
      } else b.dispose();
    }).catch(() => {});

    this.addObj(grp);
    this._b.staticMeshes.push(grp);
    this.obstacles.push({ x: cx, z: (plazaZ0 + plazaZ1) / 2, w: plazaW / 2, d: plazaD / 2 + 6 });
    this.monumentRect = { cx, x0: cx - plazaW / 2, x1: cx + plazaW / 2, z0: plazaZ0, z1: plazaZ1 };
    this.respawnAnchors.push({ x: cx, z: side > 0 ? plazaZ0 + 3 : plazaZ1 - 3 });
    this.monument = { cx, wallZ, wallW, wallH, pedTop, sc, faceSign, group: grp, attached: false };
    this._attachMonumentMosaic(this.monument);
  }

  async _attachMonumentMosaic(mon) {
    try {
      const m = maddoxRaster();
      if (this.monument !== mon) return;
      // literal grid: cell size = wallH/96 so all 96 rows stack to the wall
      // top; 64 cols (64*cell wide) sit centered on the wall backing, which
      // is wider than the grid, so the full 64x96 grid is backed.
      const s = mon.wallH / m.h;
      const mesh = instancedMosaicMesh(m, s, false);
      // PI-y for a -Z-facing plaza keeps the art un-mirrored and the blocks
      // protruding toward the viewer
      mesh.rotation.y = mon.faceSign < 0 ? Math.PI : 0;
      mesh.position.set(mon.cx, mon.pedTop + mon.wallH / 2,
        mon.wallZ + mon.faceSign * 1.3);
      mon.group.add(mesh);
      mon.group.userData.dispose = () => mesh.userData.dispose();
      mon.attached = true;
      mon.mosaicMesh = mesh;
      const mp = this.props.find((p) => p.kind === 'monument');
      if (mp) { mp.parts.push({ mesh }); if (mp.gone) mesh.visible = false; }
      mon.mesh = mesh;
    } catch (e) {
      console.warn('mosaic asset unavailable:', e && e.message);
    }
  }

  buildMountains() {
    this.mountCenters = [];
    const n = this.count('mountain');
    const cands = [[-19, -13], [20, -18], [-21, 15], [21, 12], [-24, -2], [24, -8], [-8, -24], [13, -23]];
    const k = this.k;
    for (const [bx, bz] of this.shuffle(cands)) {
      if (this.mountCenters.length >= n) break;
      const cx = bx * k, cz = bz * k;
      if (Math.abs(cx) > this.half - 6 || Math.abs(cz) > this.half - 6) continue;
      if (this.propBlocked(cx, cz)) continue;
      if (this.mountCenters.some((m) => Math.hypot(cx - m[0], cz - m[1]) < 9 * k)) continue;
      this.mountCenters.push([cx, cz]);
      this.buildMountain(cx, cz, k);
    }
  }

  buildMountain(cx, cz, k) {
    const tiers = [[9, 1.0], [6.4, 1.0], [4.4, 1.0], [2.8, 1.0]];
    const parts = [];
    let y = 0;
    for (const [size, h] of tiers) {
      const s = size * k;
      const tier = merged([addBox([], s, h, s, cx + 0.5, y + h / 2, cz + 0.5)],
        this.mat(y < 0.1 ? 0x5fb83a : 0x6ac446));
      const sol = this.addSolid(new THREE.Box3(
        new THREE.Vector3(cx + 0.5 - s / 2, y, cz + 0.5 - s / 2),
        new THREE.Vector3(cx + 0.5 + s / 2, y + h, cz + 0.5 + s / 2)
      ), tier);
      parts.push({ mesh: tier, solid: sol });
      y += h;
    }
    parts.push({ mesh: this.addObj(merged([addBox([], 2.8 * k, 0.12, 2.8 * k, cx + 0.5, y + 0.06, cz + 0.5)], this.mat(0x8fda5a))) });
    const rock = part(SP, cx + 1.6 * k, y + 0.35, cz + 1.4 * k);
    rock.scale.set(0.6, 0.45, 0.55);
    parts.push({ mesh: this.addObj(merged([rock], this.mat(0xa8b0b8))) });
    this.registerProp('mountain', cx, cz, 600, parts);
    this.obstacles.push({ x: cx, z: cz, w: 4.5 * k, d: 4.5 * k });
  }

  buildVolcanoes() {
    this.volcanoCenters = [];
    const n = this.count('volcano');
    const cands = [[12, 21], [-13, 20], [22, -15], [-17, -22]];
    const k = this.k;
    for (const [bx, bz] of this.shuffle(cands)) {
      if (this.volcanoCenters.length >= n) break;
      const cx = bx * k, cz = bz * k;
      if (Math.abs(cx) > this.half - 7 || Math.abs(cz) > this.half - 6) continue;
      if (this.propBlocked(cx, cz)) continue;
      if ([...this.mountCenters, ...this.volcanoCenters].some((m) => Math.hypot(cx - m[0], cz - m[1]) < 8 * k)) continue;
      this.volcanoCenters.push([cx, cz]);
      this.buildVolcano(cx, cz, k);
    }
  }

  buildVolcano(cx, cz, k) {
    const tiers = [[8, 1.3], [5.8, 1.3], [3.9, 1.3], [2.2, 1.0]];
    const parts = [];
    let y = 0;
    for (const [size, h] of tiers) {
      const s = size * k;
      const tier = merged([addBox([], s, h, s, cx + 0.5, y + h / 2, cz + 0.5)],
        this.mat(y < 0.1 ? 0x6b6f76 : 0x54585f));
      const sol = this.addSolid(new THREE.Box3(
        new THREE.Vector3(cx + 0.5 - s / 2, y, cz + 0.5 - s / 2),
        new THREE.Vector3(cx + 0.5 + s / 2, y + h, cz + 0.5 + s / 2)
      ), tier);
      parts.push({ mesh: tier, solid: sol });
      y += h;
    }
    const vparts = parts.map((p) => p);
    const lava = mkMat(0xff571a, { emissive: 0xff8f1f, emissiveIntensity: 1.4, roughness: 0.4 });
    const cap = merged([addBox([], 1.6 * k, 0.14, 1.6 * k, cx + 0.5, y + 0.05, cz + 0.5)], lava);
    cap.castShadow = false;
    this.addObj(cap);
    vparts.push({ mesh: cap });
    const flow = merged([
      (() => { const b = addBox([], 0.7 * k, 1.9, 0.35, 0, 0, 0); b.rotation.x = 0.9; b.position.set(cx + 0.5, y - 0.55, cz + 2.6 * k); return b; })()
    ], lava);
    flow.castShadow = false;
    this.addObj(flow);
    vparts.push({ mesh: flow });
    const glow = new THREE.PointLight(0xff7b2e, 1.6, 10 * k, 2);
    glow.position.set(cx + 0.5, y + 0.8, cz + 0.5);
    this.addObj(glow);
    this.registerProp('volcano', cx, cz, 700, vparts);
    this.obstacles.push({ x: cx, z: cz, w: 4 * k, d: 4 * k });
  }

  shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  buildTree() {
    const H = this.half, k = this.k, rand = this.rand;
    let x, z;
    for (let tries = 0; tries < 14; tries++) {
      const px = Math.round((rand() * 2 - 1) * (H - 3) * 2) / 2;
      const pz = Math.round((rand() * 2 - 1) * (H - 3) * 2) / 2;
      if (Math.hypot(px, pz) < 6 * k) continue;
      if (this.propBlocked(px, pz)) continue;
      x = px; z = pz;
      break;
    }
    if (x === undefined) return;

    const trunkH = 1.4 + rand() * 1.1;
    const trunk = [];
    addCyl(trunk, 0.26, trunkH, x, trunkH / 2, z, 0.34);
    const trunkMesh = this.addObj(merged(trunk, this.mat(0x8b5a2b)));

    const leafMat = this.mat(rand() < 0.6 ? 0x2f9e4f : 0x3fb963);
    const leaves = [];
    const cones = rand() < 0.55;
    let y = trunkH;
    [[1.55, 1.3], [1.2, 1.1], [0.8, 0.95]].forEach(([r, h], i) => {
      if (cones) {
        const c = part(CO, x, y + h / 2, z);
        c.scale.set(r, h, r);
        c.rotation.y = i * 0.6;
        leaves.push(c);
      } else {
        addCyl(leaves, r, h, x, y + h / 2, z, r * 0.72);
      }
      y += h * 0.62;
    });
    const leafMesh = this.addObj(merged(leaves, leafMat));

    const trunkSolid = { brick: null, noSupport: true, box: new THREE.Box3(
      new THREE.Vector3(x - 0.4, 0, z - 0.4), new THREE.Vector3(x + 0.4, trunkH, z + 0.4)
    )};
    this._b.solids.push(trunkSolid);
    this.registerProp('tree', x, z, 45, [{ mesh: trunkMesh, solid: trunkSolid }, { mesh: leafMesh }]);
  }

  buildVillage() {
    const k = this.k;
    this.swings = [];
    this.houseRects = [];
    const sites = [
      { x: -11, z: -7, ry: 0, body: 0xe8402a, roof: 0x2f7de1 },
      { x: 9, z: -12, ry: Math.PI / 2, body: 0xffc42e, roof: 0x35b56a },
      { x: -16, z: 4, ry: -Math.PI / 2, body: 0x35a7ff, roof: 0xff7f50 },
      { x: 14, z: 3, ry: Math.PI, body: 0x35b56a, roof: 0xffd23f },
      { x: -22, z: -18, ry: 0, body: 0xff8a3d, roof: 0x9b5de5 },
      { x: 21, z: -3, ry: -Math.PI / 2, body: 0x9b5de5, roof: 0xe8402a },
      { x: -6, z: 22, ry: Math.PI, body: 0x2f7de1, roof: 0xffc42e },
      { x: 17, z: 18, ry: Math.PI / 2, body: 0xffd23f, roof: 0x35a7ff },
      { x: -24, z: 20, ry: 0, body: 0x35b56a, roof: 0xff8a3d }
    ];
    const n = this.count('house');
    let placed = 0;
    for (const s of sites) {
      if (placed >= n) break;
      const h = { x: s.x, z: s.z, ry: s.ry, body: s.body, roof: s.roof };
      if (Math.abs(h.x) > this.half - 5 || Math.abs(h.z) > this.half - 5) continue;
      if (this.buildHouse(h)) { placed++; this.villageSites.push(h); }
    }

    if (this.count('school')) {
      const sx = -14, sz = -18;
      if (!(Math.abs(sx) > this.half - 7 || Math.abs(sz) > this.half - 6) && !this.propBlocked(sx, sz)) {
        this.buildSchool(sx, sz, k);
      }
    }

    const pgN = this.count('playground');
    let pg = 0;
    for (const [bx, bz] of [[17, -19], [-20, 8], [20, 8], [-20, -6], [8, 15], [-9, -23]]) {
      if (pg >= pgN) break;
      const px = bx, pz = bz;
      if (Math.abs(px) > this.half - 4.5 || Math.abs(pz) > this.half - 4.5) continue;
      if (this.propBlocked(px, pz)) continue;
      this.buildPlayground(px, pz, k);
      this.obstacles.push({ x: px, z: pz, w: 2.5, d: 2.5 });
      pg++;
    }

    if (this.count('deco')) this.buildDeco(k);
  }

  buildDeco(k) {
    const AZ = -3.5 * k;
    const arch = new THREE.Group();
    const azOff = new THREE.Vector3(0, 0, AZ);
    for (const sx of [-2.5 * k, 2.5 * k]) {
      arch.add(merged([addBox([], 0.7, 3.4, 0.7, sx, 1.7, 0)], this.mat(0xf1f3f5)));
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(sx - 0.35, 0, -0.35), new THREE.Vector3(sx + 0.35, 3.4, 0.35)
      ).translate(azOff), null, true);
    }
    arch.add(merged([addBox([], 5.7 * k, 0.8, 0.7, 0, 3.8, 0)], this.mat(0xffd23f)));
    arch.position.set(0, 0, AZ);
    this.addObj(arch);
    this._b.staticMeshes.push(arch);
    this.registerProp('deco', 0, AZ, 150,
      arch.children.filter((c) => c.isMesh).map((mesh) => ({ mesh })));

    const well = merged([
      (() => { const m = part(CY, 0, 0.45, 0); m.scale.set(1.05, 0.9, 1.05); return m; })(),
      addBox([], 2.4, 0.22, 0.4, 0, 1.75, -1.15), addBox([], 2.4, 0.22, 0.4, 0, 1.75, 1.15),
      addBox([], 0.22, 1.2, 0.22, -1.1, 1.15, -1.15), addBox([], 0.22, 1.2, 0.22, 1.1, 1.15, -1.15),
      addBox([], 0.22, 1.2, 0.22, -1.1, 1.15, 1.15), addBox([], 0.22, 1.2, 0.22, 1.1, 1.15, 1.15)
    ], this.mat(0xb9c2cc));
    const roofPiece = part(CO, 0, 2.9, 0);
    roofPiece.scale.set(1.7, 0.9, 1.5);
    roofPiece.rotation.y = Math.PI / 4;
    const wellGroup = new THREE.Group();
    wellGroup.add(well, merged([roofPiece], this.mat(0xe8402a)));
    wellGroup.position.set(6 * k, 0, 2 * k);
    this.addObj(wellGroup);
    const wellSolid = this.addSolid(new THREE.Box3(
      new THREE.Vector3(6 * k - 1.1, 0, 2 * k - 1.1), new THREE.Vector3(6 * k + 1.1, 0.9, 2 * k + 1.1)
    ), null, true);
    this.registerProp('deco', 6 * k, 2 * k, 150,
      [{ mesh: wellGroup.children[0], solid: wellSolid }, { mesh: wellGroup.children[1] }]);
    this.obstacles.push({ x: 6 * k, z: 2 * k, w: 1.3, d: 1.3 });
  }

  buildSchool(cx, cz, k) {
    const w = 8 * k, d = 5.5 * k, bh = 4;
    const grp = new THREE.Group();
    const bodyMesh = merged([addBox([], w, bh, d, 0, bh / 2, 0)], this.mat(0xd9b98a));
    grp.add(bodyMesh);
    const band = [];
    for (let i = -3; i <= 3; i++) addBox(band, 0.9, 0.7, 0.12, i * 1.1 * k, bh - 0.6, d / 2 + 0.03);
    grp.add(merged(band, this.mat(0x2f7de1)));
    const win = [];
    for (const r of [1.3, 2.5]) for (let i = -3; i <= 3; i++) addBox(win, 0.8, 0.8, 0.08, i * 1.1 * k, r, d / 2 + 0.03);
    grp.add(merged(win, this.mat(0x9fe0ff)));
    grp.add(merged([addBox([], 1.6, 2.4, 0.12, 0, 1.2, d / 2 + 0.05)], this.mat(0x8b5a2b)));
    const flagPole = [];
    addCyl(flagPole, 0.07, 4.6, w / 2 + 1.2 * k, 2.3, d / 2 + 1.2 * k);
    grp.add(merged(flagPole, this.mat(0xf1f3f5)));
    const flag = new THREE.Mesh(BR.clone().scale(1.1, 0.66, 0.06), this.mat(0xe8402a));
    flag.position.set(w / 2 + 1.75 * k, 4.2, d / 2 + 1.2 * k);
    grp.add(flag);
    grp.position.set(cx, 0, cz);
    this.addObj(grp);
    this._b.staticMeshes.push(grp);
    const bodySolid = this.addSolid(new THREE.Box3(
      new THREE.Vector3(cx - w / 2 - 0.1, 0, cz - d / 2 - 0.1),
      new THREE.Vector3(cx + w / 2 + 0.1, bh, cz + d / 2 + 0.1)
    ), null, true);
    this.registerProp('school', cx, cz, 400,
      [{ mesh: bodyMesh, solid: bodySolid },
       ...grp.children.filter((c) => c !== bodyMesh && c.isMesh).map((mesh) => ({ mesh }))]);
    this.obstacles.push({ x: cx, z: cz, w: w / 2 + 0.5, d: d / 2 + 0.5 });
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, 0);
    this.doorAnchors.push({
      world: new THREE.Vector3(cx + dir.x * (d / 2 + 1.6), 0, cz + dir.z * (d / 2 + 1.6)),
      yaw: 0
    });
  }

  buildPlayground(cx, cz, k) {
    const grp = new THREE.Group();
    // sand pit
    grp.add(merged([addBox([], 3.4 * k, 0.14, 3.4 * k, 0, 0.07, 0)], this.mat(0xe8c78a)));
    // slide
    const slide = [];
    addCyl(slide, 0.09, 1.5, -1.1 * k, 0.75, -0.8 * k);
    addCyl(slide, 0.09, 1.5, -1.1 * k, 0.75, -0.2 * k);
    grp.add(merged(slide, this.mat(0x35a7ff)));
    const ladder = [];
    for (const ry of [0.5, 0.9, 1.3]) addCyl(ladder, 0.05, 0.5, -1.1 * k, ry, -1.15 * k, 0.05);
    grp.add(merged(ladder, this.mat(0xf1f3f5)));
    const chute = addBox([], 0.55, 1.9, 0.1, -0.4 * k, 0.85, 0.45 * k);
    chute.rotation.x = -0.9;
    grp.add(merged([chute], this.mat(0xffd23f)));
    const plat = [];
    addBox(plat, 0.7, 0.14, 1.0, -1.1 * k, 1.5, -0.5 * k);
    grp.add(merged(plat, this.mat(0x35b56a)));
    // swing
    const frame = [];
    for (const sx of [-1.65, -0.95]) {
      addCyl(frame, 0.07, 2.1, sx * k, 1.05, 1.15 * k, 0.06);
      addCyl(frame, 0.07, 2.1, sx * k, 1.05, 1.85 * k, 0.06);
    }
    addCyl(frame, 0.06, 0.85, -1.3 * k, 2.08, 1.5 * k, 0.06).rotation.x = Math.PI / 2;
    grp.add(merged(frame, this.mat(0xe8402a)));
    const swing = new THREE.Group();
    const ropes = [];
    for (const sx of [-0.12, 0.12]) addCyl(ropes, 0.02, 1.1, sx, -0.58, 0, 0.02);
    const seat = addBox([], 0.4, 0.06, 0.2, 0, -1.13, 0);
    swing.add(merged([...ropes, seat], this.mat(0x9b5de5)));
    swing.position.set(-1.3 * k, 2.08, 1.5 * k);   // pivot at the top bar
    grp.add(swing);
    this.swings.push(swing);
    // seesaw
    const fulcrum = [];
    addBox(fulcrum, 0.3, 0.5, 0.3, 1.3 * k, 0.25, 1.3 * k);
    grp.add(merged(fulcrum, this.mat(0x2f9e4f)));
    const board = addBox([], 2.2 * k, 0.12, 0.4, 1.3 * k, 0.56, 1.3 * k);
    board.rotation.z = 0.16;
    grp.add(merged([board], this.mat(0xff8a3d)));
    grp.position.set(cx, 0, cz);
    this.addObj(grp);
    this._b.staticMeshes.push(grp);
    this.registerProp('playground', cx, cz, 120,
      grp.children.filter((c) => c.isMesh).map((mesh) => ({ mesh })));
    this.obstacles.push({ x: cx, z: cz, w: 2.2 * k, d: 2.2 * k });
  }

  buildHouse(h) {
    const bw = 5, bd = 4, bh = 3;
    const grp = new THREE.Group();
    const bodyMesh = merged([addBox([], bw, bh, bd, 0, bh / 2, 0)], this.mat(h.body));
    grp.add(bodyMesh);

    const roof = [];
    for (const s of [-1, 1]) {
      const m = addBox(roof, bw * 0.78, 0.34, bd + 0.6, s * bw * 0.27, bh + 0.62, 0);
      m.rotation.z = -s * 0.42;
    }
    addBox(roof, bw * 0.3, 0.5, bd + 0.62, 0, bh + 1.06, 0);
    grp.add(merged(roof, this.mat(h.roof)));

    const mk = (mat, geo, w, ht, d, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(w, ht, d);
      m.position.set(x, y, z);
      m.castShadow = true;
      grp.add(m);
    };
    mk(this.mat(0x7a4a22), BR, 1.1, 1.8, 0.1, 0, 0.9, bd / 2 + 0.03);
    mk(this.mat(0xffd23f), SP, 0.18, 0.18, 0.18, 0.34, 1.0, bd / 2 + 0.12);
    for (const sx of [-1.6, 1.6]) {
      mk(this.mat(0xffffff), BR, 1.05, 1.05, 0.08, sx, 1.9, bd / 2 + 0.03);
      mk(this.mat(0x9fe0ff), BR, 0.8, 0.8, 0.06, sx, 1.9, bd / 2 + 0.09);
    }
    grp.add(merged([addBox([], 0.7, 1.7, 0.7, bw * 0.3, bh + 1.25, -bd * 0.2)], this.mat(0x9a5b3f)));
    const studs = [];
    for (let i = -2; i <= 2; i++) addCyl(studs, 0.16, 0.16, i, bh + 0.08, bd / 2 - 0.3);
    grp.add(merged(studs, this.mat(h.body)));

    grp.position.set(h.x, 0, h.z);
    grp.rotation.y = h.ry;
    this.addObj(grp);
    this._b.staticMeshes.push(grp);

    const axisAligned = Math.abs(h.ry % Math.PI) < 0.01 || Math.abs(Math.abs(h.ry % Math.PI) - Math.PI) < 0.01;
    const w = axisAligned ? bw : bd;
    const d = axisAligned ? bd : bw;
    const bodySolid = this.addSolid(new THREE.Box3(
      new THREE.Vector3(h.x - w / 2 - 0.1, 0, h.z - d / 2 - 0.1),
      new THREE.Vector3(h.x + w / 2 + 0.1, bh, h.z + d / 2 + 0.1)
    ), null, true);
    this.registerProp('house', h.x, h.z, 200,
      [{ mesh: bodyMesh, solid: bodySolid },
       ...grp.children.filter((c) => c !== bodyMesh && c.isMesh).map((mesh) => ({ mesh }))]);
    this.houseRects.push({ x: h.x, z: h.z, w: w / 2, d: d / 2 });

    // front-door anchor: door sits at local (0, 0, bd/2), 1.6 units out along facing
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, h.ry);
    this.doorAnchors.push({
      world: new THREE.Vector3(h.x + dir.x * 1.6, 0, h.z + dir.z * 1.6),
      yaw: h.ry
    });
    return true;
  }

  buildBridge() {
    const g = new THREE.Group();
    this.bridge = g;
    this.bridgePieces = [];
    const k = this.k;

    const deckW = 3, deckT = 0.5, deckL = 1.06;
    const r = this.river;
    const zA = r.z0 + 0.1, zB = r.z1 - 0.1, lift = 1.7, yA = 1.35;
    const N = 26;
    const isBroken = (i) => i >= 8 && i <= 17;

    for (const z of [r.z0 - 0.5, r.z1 + 0.5]) {
      const ab = [];
      addBox(ab, 5.2, 1.6, 1.6, 0.5, 0.8, z);
      for (let i = -2; i <= 2; i++) addCyl(ab, 0.17, 0.16, i + 0.5, 1.68, z);
      const mesh = merged(ab, this.mat(0xb9c2cc));
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(-2.1, 0, z - 0.8), new THREE.Vector3(3.1, 1.6, z + 0.8)
      ), mesh);
    }

    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const z = zA + (zB - zA) * t;
      const slope = lift * 4 * (1 - 2 * t) / (zB - zA);
      const y = yA + lift * 4 * t * (1 - t);
      const piece = new THREE.Group();
      const mat = this.mat(RAINBOW[i % RAINBOW.length]);
      const deck = new THREE.Mesh(BR, mat);
      deck.scale.set(deckW, deckT, deckL);
      deck.castShadow = true;
      deck.receiveShadow = true;
      piece.add(deck);
      const studs = [];
      for (const sx of [-1, 0, 1]) addCyl(studs, 0.17, 0.16, sx, deckT / 2 + 0.08, 0);
      piece.add(merged(studs, mat));
      for (const sz of [-0.44, 0.44]) {
        const rail = new THREE.Mesh(BR, this.mat(0xf8f9fa));
        rail.scale.set(deckW, 0.66, 0.14);
        rail.position.set(0, deckT / 2 + 0.33, sz);
        rail.castShadow = true;
        piece.add(rail);
      }
      piece.position.set(0.5, y + deckT / 2, z);
      piece.rotation.x = -Math.atan(slope);
      g.add(piece);
      this.bridgePieces.push({ piece, broken: isBroken(i) });
      if (isBroken(i)) piece.visible = false;
      else this.addBridgeSolid(piece);
      this._b.staticMeshes.push(deck);
    }
    this.addObj(g);

    const post = part(CY, 0, 0.9, 0);
    post.scale.set(0.12, 1.8, 0.12);
    const sign = new THREE.Group();
    sign.add(merged([post], this.mat(0x8b5a2b)));
    const board = new THREE.Mesh(BR, this.mat(0xffe08a));
    board.scale.set(2.4, 0.9, 0.14);
    board.position.set(0.1, 1.8, 0);
    board.castShadow = true;
    sign.add(board);
    sign.position.set(-3.6 * k, 0, r.z0 - 2);
    sign.rotation.y = 0.4;
    this.addObj(sign);
    this.sign = sign;

    const portal = new THREE.Group();
    const ringMat = mkMat(0xffe066, { emissive: 0xffb703, emissiveIntensity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.28, 12, 32), ringMat);
    ring.castShadow = true;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.09, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.5 }));
    ring.position.y = disc.position.y = halo.position.y = 2.4;
    portal.add(ring, disc, halo);
    portal.add(merged([
      addBox([], 0.4, 1.6, 0.4, -1.7, 0.8, 0),
      addBox([], 0.4, 1.6, 0.4, 1.7, 0.8, 0)
    ], this.mat(0xffd23f)));
    portal.position.set(0.5, 0, Math.min(r.z1 + 4, this.half - 2));
    portal.visible = false;
    this.portal = portal;
    this.portalParts = { ring, disc, halo };
    this.addObj(portal);
    this.portalLight = new THREE.PointLight(0xffd166, 0, 24, 2);
    this.portalLight.position.set(0.5, 3, Math.min(r.z1 + 4, this.half - 2));
    this.addObj(this.portalLight);
  }

  addBridgeSolid(piece) {
    const p = piece.position;
    const c = Math.cos(piece.rotation.x);
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(p.x - 1.5, p.y - 0.6, p.z - 0.6),
      new THREE.Vector3(p.x + 1.5, p.y + 0.25 * c, p.z + 0.6)
    ), null, true, true);
  }

  repairBridge() {
    for (const p of this.bridgePieces) {
      if (!p.broken) continue;
      p.piece.visible = true;
      p.piece.scale.setScalar(0.2);
      p.pop = 1;
      this.addBridgeSolid(p.piece);
    }
    this.portal.visible = true;
    this.portalLight.intensity = 3;
    this.sign.visible = false;
  }

  brickKey(gx, gy, gz) { return `${gx},${gy},${gz}`; }

  placeBrick(gx, gy, gz, def) {
    const key = this.brickKey(gx, gy, gz);
    if (this.brickMap.has(key)) return null;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      def.round ? CY.clone().scale(def.w / 2, def.h, def.d / 2) : BR.clone().scale(def.w, def.h, def.d),
      this.mat(def.color)
    );
    body.position.y = def.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    if (def.hollow) {
      for (const sx of [-0.32, 0.32]) for (const sz of [-0.32, 0.32]) {
        const leg = new THREE.Mesh(BR, this.mat(def.color));
        leg.scale.set(0.36, 1.0, 0.36);
        leg.position.set(sx, 0.5, sz);
        leg.castShadow = true;
        group.add(leg);
      }
      const cap = new THREE.Mesh(BR, this.mat(0xffffff));
      cap.scale.set(def.w, 0.2, def.d);
      cap.position.y = def.h - 0.1;
      cap.castShadow = true;
      group.add(cap);
    }

    const studs = this.studsMesh(def.color, def.studs, def.h);
    if (studs) group.add(studs.clone());

    group.position.set(gx + def.w / 2 - 0.5, gy, gz + def.d / 2 - 0.5);
    group.userData.key = key;
    this.scene.add(group);

    const box = new THREE.Box3(
      new THREE.Vector3(gx, gy, gz), new THREE.Vector3(gx + def.w, gy + def.h, gz + def.d)
    );
    this.solids.push({ brick: null, box });
    const rec = { key, group, def, gx, gy, gz, box, solid: this.solids[this.solids.length - 1] };
    rec.solid.brick = rec;
    this.brickMap.set(key, rec);
    this.brickMeshes.push(group);
    this.placedCount++;
    if (navigator.vibrate) navigator.vibrate(12);
    return rec;
  }

  removeBrick(rec) {
    this.scene.remove(rec.group);
    this.brickMap.delete(rec.key);
    const i = this.solids.indexOf(rec.solid);
    if (i >= 0) this.solids.splice(i, 1);
    const j = this.brickMeshes.indexOf(rec.group);
    if (j >= 0) this.brickMeshes.splice(j, 1);
    this.placedCount--;
    return rec;
  }

  surfaceTop(gx, gz, maxY) {
    let top = 0;
    const x0 = gx + 1e-4, x1 = gx + 1 - 1e-4, z0 = gz + 1e-4, z1 = gz + 1 - 1e-4;
    for (const s of this.solids) {
      const b = s.box;
      if (s.disabled || s.noSupport || b.max.y > maxY + 1e-4 || b.max.y > 40) continue;
      // (noSupport entries are skipped so props never act as build supports)
      if (b.max.x > x0 && b.min.x < x1 && b.max.z > z0 && b.min.z < z1 && b.max.y > top) top = b.max.y;
    }
    return top;
  }

  surfaceTopAny(x, z) {
    let top = -Infinity;
    for (const s of this.solids) {
      if (s.disabled) continue;
      const b = s.box;
      if (b.max.y > -1 && b.max.y > top &&
          x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) top = b.max.y;
    }
    return top;
  }

  respawnPlayer(p) {
    const H = this.half;
    let x = clamp(p.pos.x, -H + 2, H - 2);
    let z = clamp(p.pos.z, -H + 2, H - 2);
    let top = this.surfaceTopAny(x, z);
    if (top === -Infinity) {
      const pts = this.respawnAnchors.length ? this.respawnAnchors : [{ x: 0.5, z: 3 }];
      let best = pts[0], bd = Infinity;
      for (const a of pts) {
        const ax = clamp(a.x, -H + 2, H - 2), az = clamp(a.z, -H + 2, H - 2);
        const d = Math.hypot(p.pos.x - ax, p.pos.z - az);
        if (d < bd && this.surfaceTopAny(ax, az) > -Infinity) { bd = d; best = { x: ax, z: az }; }
      }
      x = best.x; z = best.z;
      top = this.surfaceTopAny(x, z);
      if (top === -Infinity) top = 0;
    }
    p.pos.set(x, top + 0.05, z);
    p.vel.set(0, 0, 0);
  }

  update(t, dt) {
    if (this.water) this.water.position.y = Math.sin(t * 1.4) * 0.03;
    for (const s of this.swings || []) s.rotation.x = Math.sin(t * 1.8 + s.position.x) * 0.35;
    for (const p of this.bridgePieces) {
      if (p.pop) {
        p.pop = Math.max(0, p.pop - dt * 1.6);
        const s = 1 - p.pop * 0.8;
        p.piece.scale.setScalar(s);
      }
    }
    if (this.portal.visible) {
      const { ring, disc, halo } = this.portalParts;
      ring.rotation.z = t * 0.8;
      halo.rotation.z = -t * 1.3;
      halo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06);
      disc.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
      this.portalLight.intensity = 3 + Math.sin(t * 4) * 0.8;
    }
  }
}

class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(0.5, 0, 3);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.radius = 0.4;
    this.height = 1.85;
    this.coyote = 0;
    this.phase = 0;
    this.grounded = true;

    const skin = mkMat(0xffcc66);
    const shirt = mkMat(0xe8402a);
    const pants = mkMat(0x2f4b7c);
    const hair = mkMat(0x5b3a1e);
    const g = new THREE.Group();
    const hip = new THREE.Group();
    hip.position.y = 0.72;
    g.add(hip);

    const box = (mat, w, h, d, x, y, z, parent) => {
      const m = new THREE.Mesh(BR, mat);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.castShadow = true;
      (parent || hip).add(m);
      return m;
    };

    box(shirt, 0.76, 0.66, 0.46, 0, 0.3, 0);
    box(mkMat(0xffffff), 0.34, 0.1, 0.48, 0, 0.6, -0.02);
    box(skin, 0.62, 0.6, 0.56, 0, 1.0, 0);
    for (const sx of [-0.15, 0.15]) {
      box(mkMat(0x22252b), 0.09, 0.11, 0.05, sx, 1.06, -0.29);
      box(hair, 0.13, 0.045, 0.05, sx, 1.17, -0.29);
    }
    box(mkMat(0xc0392b), 0.22, 0.045, 0.05, 0, 0.88, -0.29);
    box(mkMat(0x2f7de1), 0.66, 0.14, 0.6, 0, 1.34, 0);
    box(mkMat(0x2f7de1), 0.5, 0.07, 0.26, 0, 1.31, -0.4);
    const stud = new THREE.Mesh(CY, mkMat(0xffd23f));
    stud.scale.set(0.12, 0.1, 0.12);
    stud.position.y = 1.45;
    stud.castShadow = true;
    hip.add(stud);

    this.arms = [];
    this.legs = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.5, 0.56, 0);
      box(shirt, 0.24, 0.36, 0.28, 0, -0.18, 0, arm);
      box(skin, 0.22, 0.24, 0.26, 0, -0.48, 0, arm);
      hip.add(arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(sx * 0.2, 0.72, 0);
      box(pants, 0.28, 0.72, 0.3, 0, -0.36, 0, leg);
      box(mkMat(0x22252b), 0.3, 0.14, 0.42, 0, -0.76, -0.06, leg);
      g.add(leg);
      this.legs.push(leg);
    }
    this.root = g;
  }

  groundTopAt(x, z, feet) {
    const box = new THREE.Box3(
      new THREE.Vector3(x - this.radius, feet - 0.12, z - this.radius),
      new THREE.Vector3(x + this.radius, feet + 1.1, z + this.radius)
    );
    let top = -Infinity;
    for (const s of this.world.solids) {
      if (s.disabled) continue;
      if (s.box.intersectsBox(box) && s.box.max.y < box.max.y && s.box.max.y > top) top = s.box.max.y;
    }
    return top;
  }

  blocked(x, z, feet, head, stepH) {
    const box = new THREE.Box3(
      new THREE.Vector3(x - this.radius, feet + 0.06, z - this.radius),
      new THREE.Vector3(x + this.radius, head - 0.05, z + this.radius)
    );
    for (const s of this.world.solids) {
      if (s.disabled) continue;
      if (stepH > 0 && s.box.max.y <= feet + stepH) continue;
      if (s.box.intersectsBox(box)) return true;
    }
    return false;
  }

  inRiverTrench() {
    return this.world.inRiver(this.pos.x, this.pos.z) && this.pos.y < -0.6;
  }

  update(dt, move, jump) {
    const speed = 6.4;
    this.vel.x += (move.x * speed - this.vel.x) * Math.min(1, dt * 12);
    this.vel.z += (move.z * speed - this.vel.z) * Math.min(1, dt * 12);
    this.vel.y -= 26 * dt;

    const ground = this.groundTopAt(this.pos.x, this.pos.z, this.pos.y - 0.12);
    if (ground > -Infinity && this.vel.y <= 0 && this.pos.y <= ground + 1e-3) {
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
      this.coyote = 0.12;
    } else {
      this.grounded = false;
      this.coyote = Math.max(0, this.coyote - dt);
    }
    if (jump && (this.grounded || this.coyote > 0)) {
      this.vel.y = 9.6;
      this.coyote = 0;
      if (navigator.vibrate) navigator.vibrate(8);
    }

    const horiz = Math.hypot(this.vel.x, this.vel.z);
    const stepH = (this.grounded || this.coyote > 0) ? 1.05 : 0;
    const feet = this.pos.y + Math.max(0, this.vel.y * dt);
    const head = feet + this.height;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this.blocked(nx, this.pos.z, feet, head, stepH)) this.pos.x = nx; else this.vel.x *= 0.2;
    if (!this.blocked(this.pos.x, nz, feet, head, stepH)) this.pos.z = nz; else this.vel.z *= 0.2;

    this.pos.y += this.vel.y * dt;
    const H = this.world.half;
    this.pos.x = clamp(this.pos.x, -H + 0.5, H - 0.5);
    this.pos.z = clamp(this.pos.z, -H + 0.5, H - 0.5);
    if (!this.world.inHouse && this.pos.y < -3.5) {
      this.world.respawnPlayer(this);
      if (this.fellHook) this.fellHook();
    }

    if (this.vel.y <= 0.5) {
      const g2 = this.groundTopAt(this.pos.x, this.pos.z, this.pos.y - 0.02);
      if (g2 > -Infinity && this.pos.y < g2) {
        this.pos.y = g2;
        this.vel.y = 0;
        this.grounded = true;
      }
    }

    this.phase += dt * (2 + horiz * 1.5);
    const s = Math.sin(this.phase * 3.2) * Math.min(0.9, horiz * 0.16);
    this.legs[0].rotation.x = s;
    this.legs[1].rotation.x = -s;
    this.arms[0].rotation.x = -s * 0.8;
    this.arms[1].rotation.x = s * 0.8;
    const bob = Math.abs(s) * 0.09;

    this.root.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    if (horiz > 0.6) {
      const want = Math.atan2(-this.vel.x, -this.vel.z);
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 11);
    }
    this.root.rotation.y = this.yaw;
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = this.makeSky();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.orbit = { yaw: Math.PI, pitch: 0.42, dist: 11, wantDist: 11 };

    this.hemi = new THREE.HemisphereLight(0xd8f0ff, 0x5f8f3f, 1.0);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    sun.position.set(26, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 130 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.world = new World(this.scene);
    this.world.onWorldChanged = () => {
      this.fitShadow();
      this.applyOutdoorFog();
      if (this.life) {
        this.life.dispose();
        this.life = new Life(this.world, this.scene, this.world.rand);
        this.life.populate();
      }
      if (this.train) { this.train.dispose(); this.train = null; }
      if (this.world.railR) this.train = new Train(this.world, this.scene, this.world.rand);
    };
    this.player = new Player(this.world);
    this.player.fellHook = () => this.toast('You fell out of the world — respawned on solid ground!', 'bad');
    this.scene.add(this.player.root);
    this.fitShadow();

    // plain delta timer (THREE.Clock is deprecated upstream)
    this.clock = {
      _last: performance.now(),
      getDelta() {
        const now = performance.now();
        const d = (now - this._last) / 1000;
        this._last = now;
        return d;
      },
    };
    this.time = 0;
    this.collected = 0;
    this.repaired = false;
    this.started = false;
    this.slot = 0;
    this.nuke = null;
    this.removeMode = false;
    this.pick = new THREE.Raycaster();
    this.confetti = null;
    this.jumpQueued = 0;
    this.rescueT = 0;
    this.ghost = this.makeGhost();
    this.nearDoor = null;

    // explore / build / weapon / weather modes are mutually exclusive
    this.mode = 'explore';
    this.weapon = 0;
    this.removeMode = false;
    this.fireCd = 0;
    this.boltT = 0;
    this.holdNdc = null;
    this.rockets = [];
    this.fireballs = [];
    this.meteors = [];
    this._falling = [];
    this.fx = new Fx(this.scene);
    this.life = new Life(this.world, this.scene, this.world.rand);
    this.life.populate();
    if (this.world.railR) this.train = new Train(this.world, this.scene, this.world.rand);
    this.weaponModels = buildWeaponModels();
    this.weaponRig = new THREE.Group();
    this.weaponRig.position.set(0.42, 1.02, -0.18);
    this.weaponRig.visible = false;
    this.player.root.add(this.weaponRig);
    this.showWeaponModel();

    // weather systems
    this.weather = 'clear';
    this.weatherDef = WEATHERS[0];
    this.weatherT = 0;
    this.weatherDmgT = 0;
    this.shakeT = 0;
    this.flashT = 0;
    this.tornadoPos = new THREE.Vector3(0, 0, 0);
    this.tornadoTgt = new THREE.Vector3(0, 0, 0);
    this.waveZ = 0;
    this.waveId = 0;
    this.rain = new ParticleField(this.scene, 650, 0xbcd6ea, 0.32);
    this.snowf = new ParticleField(this.scene, 520, 0xffffff, 0.55);
    this.stars = new StarField(this.scene);
    this.funnel = new Funnel(this.scene);
    this.wave = new WaveFront(this.scene);
    this.bolt = new THREE.Mesh(BR, new THREE.MeshBasicMaterial({ color: 0xcfe8ff }));
    this.bolt.visible = false;
    this.scene.add(this.bolt);
    this.flash = new THREE.PointLight(0xdfefff, 0, 120, 1);
    this.flash.position.set(0, 40, 0);
    this.scene.add(this.flash);

    // persistent damage
    this._saveT = 0;
    this.world.onDamage = (p, amt, pt) => this.onPropDamage(p, amt, pt);

    this.optionsEl = document.createElement('button');
    this.optionsEl.id = 'btn-options';
    this.optionsEl.textContent = '⚙️';
    this.optionsEl.title = 'World options';
    this.optionsEl.setAttribute('aria-label', 'World options');
    this.panel = buildOptionsPanel(this.world.opts, {
      onOpen: () => { this.keys.clear(); this.pointers.clear(); },
      onRegen: () => this.regenerateWorld()
    });
    document.getElementById('hud').appendChild(this.optionsEl);
    document.body.appendChild(this.panel.el);
    this.optionsEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.optionsEl.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.panel.toggle(); });

    this.bindDom();
    this.bindStrips();
    this.setMode('build');
    this.selectSlot(0);
    this.spawnCollectibles();
    this.bindInput();
    this.resize();
    this.updateHud();

    this.applyOutdoorFog();
    this.tick = this.tick.bind(this);
    this.renderer.setAnimationLoop(this.tick);
  }

  skyTexFor(r) {
    if (!this._skyTex) this._skyTex = new Map();
    let tex = this._skyTex.get(this.weather);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 256;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#' + new THREE.Color(r.bg).getHexString());
      grad.addColorStop(1, '#' + new THREE.Color(r.fog).lerp(new THREE.Color(0xffffff), 0.35).getHexString());
      g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this._skyTex.set(this.weather, tex);
    }
    return tex;
  }

  applyOutdoorFog() {
    const H = this.world.half;
    const r = SKY[this.weather] || SKY.clear;
    this.scene.fog = new THREE.Fog(r.fog, H * (this.weather === 'clear' || this.weather === 'noon' ? 1.8 : 1.1), H * 4.5);
    this.scene.background = this.skyTexFor(r);
    this.sun.intensity = r.sun;
    this.sun.color.setHex(r.sunCol);
    this.hemi.intensity = r.hemi;
    this.stars.set(r.star);
  }

  makeSky() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2f86d8');
    grad.addColorStop(0.45, '#7fc4f2');
    grad.addColorStop(0.8, '#cfeeff');
    grad.addColorStop(1, '#f6f0d8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  makeGhost() {
    const mesh = new THREE.Mesh(BR.clone(),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }));
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(BR.clone()), new THREE.LineBasicMaterial({ color: 0xffffff })));
    mesh.visible = false;
    mesh.renderOrder = 3;
    this.scene.add(mesh);
    return mesh;
  }

  setGhostDef(def) {
    const mesh = this.ghost;
    if (!mesh) return;
    mesh.geometry.dispose();
    mesh.geometry = BR.clone().scale(def.w, def.h, def.d);
    const edges = mesh.children[0];
    edges.geometry.dispose();
    edges.geometry = new THREE.EdgesGeometry(BR.clone().scale(def.w, def.h, def.d));
    mesh.material.color.setHex(def.color);
  }

  spawnCollectibles() {
    this.clearCollectibles();
    this._colGeos = [];
    const studsGeo = mergeGeometries([-0.22, 0.22].map((sx) => {
      const m = new THREE.Mesh(CY);
      m.scale.set(0.11, 0.09, 0.11);
      m.position.set(sx, 0.25, 0);
      m.updateMatrix();
      return m.geometry.clone().applyMatrix4(m.matrix);
    }), false);
    const gA = BR.clone().scale(0.55, 0.55, 0.55);
    const gB = BR.clone().scale(1.05, 0.42, 0.55);
    const ringGeo = new THREE.TorusGeometry(0.72, 0.05, 6, 18);
    this._colGeos.push(studsGeo, gA, gB, ringGeo);

    const tops = [...(this.world.mountCenters || []), ...(this.world.volcanoCenters || [])];
    const spots = this.world.spots;
    this.collectibles = [];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const onTop = tops.some((h) => Math.hypot(x - h[0], z - h[1]) < 2.2);
      const y = onTop ? 4.75 : this.world.surfaceTopAny(x, z) + 0.75;
      const color = RAINBOW[i % RAINBOW.length];
      const mat = mkMat(color, { emissive: color, emissiveIntensity: 0.25 });
      const grp = new THREE.Group();
      const body = new THREE.Mesh(i % 2 ? gB : gA, mat);
      body.castShadow = true;
      grp.add(body);
      if (i % 2 === 0) {
        const st = new THREE.Mesh(studsGeo, mat);
        st.position.y = 0.02;
        grp.add(st);
      }
      const ring = new THREE.Mesh(ringGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.3;
      grp.add(ring);
      grp.position.set(x, y, z);
      grp.userData.phase = i * 0.6;
      grp.userData.baseY = y;
      grp.userData.disposables = [mat, ring.material];
      this.scene.add(grp);
      this.collectibles.push(grp);
    }
  }

  clearCollectibles() {
    for (const b of this.collectibles || []) {
      this.scene.remove(b);
      for (const m of b.userData.disposables || []) m.dispose();
    }
    this.collectibles = [];
    for (const g of this._colGeos || []) g.dispose();
    this._colGeos = [];
  }

  bindDom() {
    const bar = document.getElementById('hotbar');
    this.slots = [];
    BRICKS.forEach((b, i) => {
      const el = document.createElement('button');
      el.className = 'slot' + (b.w === 2 ? ' wide' : '');
      el.title = b.name;
      el.innerHTML = `<span class="key">${i + 1}</span><span class="swatch" style="background:#${b.color.toString(16).padStart(6, '0')}"></span>`;
      el.addEventListener('click', () => this.selectSlot(i));
      bar.appendChild(el);
      this.slots.push(el);
    });
    const rm = document.createElement('button');
    rm.className = 'slot remove';
    rm.title = 'Remove bricks (X)';
    rm.innerHTML = '<span class="key">X</span>✕';
    rm.addEventListener('click', () => this.selectSlot(BRICKS.length));
    bar.appendChild(rm);
    this.slots.push(rm);

    this.bannerImg = document.getElementById('welcome-banner');
    this.elCount = document.getElementById('hud-count');
    this.elNeed = document.getElementById('hud-need');
    this.elNeed.className = 'row need';
    this.toastEl = document.getElementById('toast');
    this.intro = document.getElementById('intro');
    document.getElementById('btn-play').addEventListener('click', () => this.start());
    if (this.bannerImg) {
      welcomeTexture().then((b) => {
        if (this.bannerImg) this.bannerImg.src = b.url;
        else b.dispose();
      }).catch(() => { if (this.bannerImg) this.bannerImg.style.display = 'none'; });
    }
  }

  bindStrips() {
    this.hotbar = document.getElementById('hotbar');
    this.stripBar = document.getElementById('stripbar');
    const hud = document.getElementById('hud');
    this.modePill = document.createElement('div');
    this.modePill.id = 'mode-pill';
    hud.appendChild(this.modePill);

    this.modeBar = document.createElement('div');
    this.modeBar.id = 'modebar';
    hud.appendChild(this.modeBar);
    this.modeSlots = MODES.map((m) => {
      const el = document.createElement('button');
      el.className = 'slot mode';
      el.title = m.name;
      el.innerHTML = `<span class="key">${m.key}</span><span class="wicon">${m.icon}</span>`;
      el.addEventListener('click', (e) => { e.preventDefault(); this.setMode(m.id); });
      this.modeBar.appendChild(el);
      return el;
    });

    this.weaponSlots = WEAPONS.map((w, i) => {
      const el = document.createElement('button');
      el.className = 'slot';
      el.title = `${w.name} — ${w.dmg} dmg`;
      el.innerHTML = `<span class="key">${i + 1}</span><span class="wicon">${w.icon}</span>`;
      el.addEventListener('click', (e) => { e.preventDefault(); this.setMode('weapon'); this.selectWeapon(i); });
      this.stripBar.appendChild(el);
      return el;
    });
    this.exploreClear = document.createElement('button');
    this.exploreClear.className = 'slot weather-w';
    this.exploreClear.title = 'Clear skies · back to explore (Esc)';
    this.exploreClear.innerHTML = '<span class="wicon">🧭</span>';
    this.exploreClear.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.weather !== 'clear') this.activateWeather('clear');
      else this.setMode('explore');
    });
    this.stripBar.appendChild(this.exploreClear);

    this.weatherSlots = WEATHERS.map((w) => {
      const el = document.createElement('button');
      el.className = 'slot weather-w';
      el.title = w.name;
      el.innerHTML = `<span class="wicon">${w.icon}</span>`;
      el.addEventListener('click', (e) => { e.preventDefault(); this.onWeatherClick(w.id); });
      this.stripBar.appendChild(el);
      return el;
    });
  }

  setMode(mode) {
    if (mode === this.mode) { this.refreshStrips(); return; }
    const prev = this.mode;
    if (mode === 'weather') {
      this.mode = 'weather';
      sfx.swap();
      this.toast('🌦️ Weather control — tap an icon to arm it', 'good');
      this.refreshStrips();
      return;
    }
    this.mode = mode;
    if (mode !== 'weapon') sfx.setFlame(false);
    // explore/build are neutral: leaving weather mode pacifies the sky again
    if (prev === 'weather' && (mode === 'explore' || mode === 'build') && this.weather !== 'clear') {
      this.activateWeather('clear');
    }
    sfx.swap();
    if (mode === 'explore') this.toast('Explore mode — roam free. Pick a mode anytime.', 'good');
    this.refreshStrips();
  }



  onWeatherClick(id) {
    const enter = this.mode !== 'weather';
    if (enter) this.setMode('weather');
    this.activateWeather(id);
    if (id === 'nuke') this.armNuke();
    this.refreshStrips();
  }

  defuseNuke() {
    const n = this.nuke;
    if (!n) return;
    for (const k of ['mesh', 'cloud', 'crater']) if (n[k]) this.scene.remove(n[k]);
    this.nuke = null;
  }

  refreshStrips() {
    const build = this.mode === 'build';
    const weapon = this.mode === 'weapon';
    const weather = this.mode === 'weather';
    this.hotbar.classList.toggle('hidden', !build);
    this.stripBar.classList.toggle('hidden', !weapon && !weather);
    if (this.exploreClear) this.exploreClear.style.display = weather ? '' : 'none';
    this.weaponSlots.forEach((el, i) => {
      el.style.display = weapon ? '' : 'none';
      el.classList.toggle('active', weapon && i === this.weapon);
    });
    this.weatherSlots.forEach((el, i) => {
      const id = WEATHERS[i].id;
      el.style.display = weather ? '' : 'none';
      el.classList.toggle('active', weather && id === this.weather && !(id === 'nuke' && !this.nuke));
    });
    this.modeSlots.forEach((el, i) => el.classList.toggle('active', MODES[i].id === this.mode));
    this.weaponRig.visible = weapon;
    this.ghost.visible = false;
    const label = this.mode === 'explore' ? '🧭 EXPLORE'
      : build ? '🧱 BUILD'
      : weapon ? `⚔️ WEAPON · ${WEAPONS[this.weapon].name}`
      : `🌦️ WEATHER · ${this.weatherDef.name}`;
    this.modePill.textContent = label;
    this.modePill.className = weapon ? 'weapon' : weather ? 'weather' : this.mode === 'explore' ? 'explore' : '';
  }

  selectWeapon(i) {
    this.weapon = clamp(i, 0, WEAPONS.length - 1);
    this.showWeaponModel();
    this.refreshStrips();
  }

  showWeaponModel() {
    const def = WEAPONS[this.weapon];
    for (const c of [...this.weaponRig.children]) this.weaponRig.remove(c);
    this.weaponRig.add(this.weaponModels[def.id]);
  }

  /* ------------------------------------------------ weather activation */
  activateWeather(id) {
    const def = WEATHERS.find((w) => w.id === id) || WEATHERS[0];
    this.weather = def.id;
    this.weatherDef = def;
    this.weatherT = 0;
    this.weatherDmgT = 0;
    this.shakeT = 0;
    this.boltT = 0;
    this.bolt.visible = false;
    if (this.mode !== 'weather') this.setMode('weather');
    sfx.unloopAll();
    if (def.id === 'clear') this.defuseNuke();
    this.rain.points.visible = false;
    this.snowf.points.visible = false;
    this.funnel.show(false);
    this.wave.hide();
    const p = this.player.pos;
    switch (def.id) {
      case 'rain': sfx.loop('rain', { type: 'bandpass', f: 1400, q: 0.5, gain: 0.22, lfo: 0.4, lfoDepth: 300 });
        this.rain.recenter(p.x, p.z); this.rain.points.visible = true; break;
      case 'snow': sfx.loop('snow', { type: 'lowpass', f: 420, q: 0.6, gain: 0.1 });
        this.snowf.recenter(p.x, p.z); this.snowf.points.visible = true; break;
      case 'thunder': sfx.loop('storm', { type: 'lowpass', f: 900, q: 0.6, gain: 0.26, lfo: 0.25, lfoDepth: 250 });
        this.rain.recenter(p.x, p.z); this.rain.points.visible = true; break;
      case 'tornado': sfx.loop('tornado', { type: 'lowpass', f: 260, q: 0.9, gain: 0.34, lfo: 0.18, lfoDepth: 90 });
        this.funnel.show(true);
        this.tornadoPos.set(p.x + 22, 0, p.z + 22); this.tornadoTgt.copy(this.tornadoPos); break;
      case 'hurricane': sfx.loop('hurricane', { type: 'lowpass', f: 520, q: 0.8, gain: 0.4, lfo: 0.5, lfoDepth: 320 });
        sfx.loop('debris', { type: 'bandpass', f: 2400, q: 1.4, gain: 0.1, lfo: 3.2, lfoDepth: 900 });
        this.funnel.show(true);
        this.tornadoPos.set(p.x + 18, 0, p.z - 18); this.tornadoTgt.copy(this.tornadoPos); break;
      case 'quake': sfx.loop('quake', { type: 'lowpass', f: 65, q: 1.2, gain: 0.42 });
        this.shakeT = 9999; break;
      case 'tsunami': sfx.wave(); this.waveId++;
        this.waveZ = -this.world.half - 14; break;
      case 'meteor': sfx.meteorWhistle(); this.spawnMeteor(); break;
      case 'nuke': break; // armed by onWeatherClick only (one-shot air-drop)
      default: break; // clear/morning/noon/evening/night: ambience only
    }
    this.applyOutdoorFog();
    this.refreshStrips();
    this.toast(`${def.icon} ${def.name} — ${def.dmg ? `${def.dmg} damage every ${def.every}s` : 'no damage, sky only'}`, 'good');
  }

  /* ----------------------------------------------------- combat helpers */
  propBox(p) {
    for (const pt of p.parts) if (pt.baseBox) return pt.baseBox;
    const s = 2 * p.scale;
    return new THREE.Box3(new THREE.Vector3(p.cx - s, 0, p.cz - s), new THREE.Vector3(p.cx + s, 3, p.cz + s));
  }

  hitPoint(p, from) {
    return nearestPointOnBox(this.propBox(p), from, new THREE.Vector3());
  }

  bricksInRadius(center, r, cb) {
    for (const rec of [...this.world.brickMap.values()]) {
      const c = new THREE.Vector3();
      rec.box.getCenter(c);
      if (c.distanceTo(center) <= r) cb(rec);
    }
  }

  hurtBrick(rec, amount) {
    rec._dmg = (rec._dmg || 0) + amount;
    if (rec._dmg < 25) { sfx.crack(); return; }
    const c = new THREE.Vector3();
    rec.box.getCenter(c);
    this.fx.spawn(c.x, c.y, c.z, 'debris', 10);
    this.fx.spawn(c.x, c.y, c.z, 'smoke', 4);
    sfx.thud();
    this.world.removeBrick(rec);
  }

  /* Ray-march against all solid boxes (terrain, props, bricks) */
  rayScene(ro, rd, maxDist) {
    let best = maxDist, solid = null;
    for (const s of this.world.solids) {
      if (s.disabled) continue;
      const t = rayAabb(ro, rd, s.box);
      if (t !== null && t < best) { best = t; solid = s; }
    }
    return { t: best, solid };
  }

  onPropDamage(p, amount, pt) {
    const at = pt || new THREE.Vector3(p.cx, 1.5, p.cz);
    this.fx.spawn(at.x, at.y, at.z, 'smoke', 4);
    sfx.crack();
    if (p.gone) {
      sfx.destroy();
      this.fx.spawn(at.x, at.y, at.z, 'debris', 16);
      this.fx.spawn(at.x, at.y + 1, at.z, 'smoke', 10);
      for (const q of p.parts) {
        if (q.hidden) continue;
        q.hidden = true;
        q.mesh.visible = false;
        if (q.solid) q.solid.disabled = true;
      }
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    }
    this._saveT = 1.0; // debounce persist
  }

  saveDamage() {
    const entries = [];
    this.world.props.forEach((p, i) => { if (p.dmg > 0) entries.push([i, Math.round(p.dmg)]); });
    setState(this.world.opts.size, {
      sig: this.world.sig, salt: this.world.genSalt, entries
    });
  }

  /* ---------------------------------------------------------- attacks */
  tryFire(ndc) {
    if (this.mode !== 'weapon' || !this.started) return false;
    const def = WEAPONS[this.weapon];
    if (this.fireCd > 0) return false;
    this.fireCd = def.cd;
    const p = this.player.pos;
    const chest = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    this.pick.setFromCamera(ndc, this.camera);
    const ro = this.pick.ray.origin, rd = this.pick.ray.direction;

    const fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    // projectiles follow the body heading, flat-horizontal
    const aim = fwd.clone();

    if (def.kind === 'rocket') {
      sfx.launch();
      const mesh = makeRocketMesh();
      const muzzle = chest.clone().addScaledVector(aim, 0.9).add(new THREE.Vector3(0, 0.15, 0));
      mesh.position.copy(muzzle);
      mesh.lookAt(muzzle.clone().add(aim));
      this.scene.add(mesh);
      // straight forward + horizontal; a gentle 1.0 m/s^2 lift arches it slightly
      this.rockets.push({ mesh, vel: aim.clone().multiplyScalar(26).setY(0.35),
        life: def.range / 26, kind: 'rocket' });
      this.fx.spawn(muzzle.x, muzzle.y, muzzle.z, 'smoke', 8);
      this._swing(0.5);
      return true;
    }
    if (def.kind === 'stream') {
      if (!this.fireballs) this.fireballs = [];
      sfx.fireTick();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xff8c1a, emissive: 0xff5500, emissiveIntensity: 1.6 }));
      const muzzle = chest.clone().addScaledVector(aim, 0.75).add(new THREE.Vector3(0, 0.25, 0));
      ball.position.copy(muzzle);
      this.scene.add(ball);
      // lob forward with an upward arc: 10 m/s horizontal, 6.5 m/s up
      this.fireballs.push({ mesh: ball, vel: aim.clone().multiplyScalar(10).setY(6.5), life: 4 });
      this.fx.spawn(muzzle.x, muzzle.y, muzzle.z, 'fire', 4);
      this._swing(0.35);
      return true;
    }
    // melee
    let hits = 0;
    for (const prop of this.world.props) {
      if (prop.gone || hits >= def.maxBreak) continue;
      const pt = this.hitPoint(prop, chest);
      const dxz = new THREE.Vector2(pt.x - p.x, pt.z - p.z);
      if (dxz.length() > def.range) continue;
      const dxzN = dxz.clone().normalize();
      const cos = dxzN.x * fwd.x + dxzN.y * fwd.z;
      if (Math.acos(clamp(cos, -1, 1)) > def.arc / 2) continue;
      this.world.applyHit(prop, def.dmg, pt);
      this.fx.spawn(pt.x, pt.y, pt.z, 'debris', 8);
      hits++;
    }
    this.bricksInRadius(chest.clone().addScaledVector(fwd, def.range * 0.7), def.radius + 1.1, (rec) => {
      if (rec._dmg >= 25) return;
      this.hurtBrick(rec, def.dmg);
    });
    if (def.id === 'sword') sfx.sword(); else sfx.hammer();
    if (navigator.vibrate) navigator.vibrate(def.id === 'hammer' ? 30 : 12);
    this._swing(def.id === 'hammer' ? 0.8 : 0.5);
    return true;
  }

  _swing(t) {
    this.weaponRig.userData.swing = t;
  }

  damageSplash(def, at, from, fallDist = 8) {
    let n = 0;
    for (const prop of this.world.props) {
      if (prop.gone) continue;
      const pt = this.hitPoint(prop, at);
      if (pt.distanceTo(at) > def.radius + 2) continue;
      if (n >= def.maxBreak) break;
      const falloff = 1 - clamp(pt.distanceTo(at) / (def.radius + 2), 0, 0.85);
      this.world.applyHit(prop, def.dmg * falloff, pt);
      n++;
    }
    this.bricksInRadius(at, def.radius, (rec) => this.hurtBrick(rec, def.dmg));
    const pp = this.player.pos;
    if (at.distanceTo(new THREE.Vector3(pp.x, pp.y + 1, pp.z)) < def.radius + 1.5) {
      const push = new THREE.Vector3(pp.x - at.x, 0, pp.z - at.z).normalize().multiplyScalar(9);
      push.y = 6;
      this.player.vel.add(push);
      sfx.hurt();
      this.toast('💥 Blast shockwave!', 'bad');
    }
  }

  explode(at, def) {
    sfx.explode();
    this.fx.spawn(at.x, at.y, at.z, 'fire', 22);
    this.fx.spawn(at.x, at.y, at.z, 'smoke', 14);
    this.fx.spawn(at.x, at.y, at.z, 'debris', 24);
    this.damageSplash(def, at, null);
    if (navigator.vibrate) navigator.vibrate([40, 30, 90]);
  }

  /* ---------------------------------------------------- weather per-frame */
  weatherPickProp(maxDist = 55) {
    const p = this.player.pos;
    const near = this.world.props.filter((pr) =>
      !pr.gone && Math.hypot(pr.cx - p.x, pr.cz - p.z) < maxDist);
    if (!near.length) return null;
    return near[Math.floor(Math.random() * near.length)];
  }

  strikeLightning() {
    const target = this.weatherPickProp() || null;
    const at = target ? this.hitPoint(target, new THREE.Vector3(target.cx, 20, target.cz))
      : new THREE.Vector3(this.player.pos.x + (Math.random() * 2 - 1) * 30, 0, this.player.pos.z + (Math.random() * 2 - 1) * 30);
    const H = 34;
    this.bolt.visible = true;
    this.bolt.scale.set(0.35, H, 0.35);
    this.bolt.position.set(at.x, H / 2, at.z);
    this.flash.position.set(at.x, H * 0.7, at.z);
    this.flash.intensity = 8;
    this.boltT = 0.14;
    sfx.thunder();
    if (target) {
      this.world.applyHit(target, this.weatherDef.dmg, new THREE.Vector3(at.x, Math.max(1, at.y), at.z));
    } else if (this.player.pos.distanceTo(at) < 6) {
      sfx.hurt();
    }
  }

  /* ------------------------------------------- 25kt nuclear air-drop */
  armNuke() {
    if (this.nuke && this.nuke.stage !== 'done') return;
    const p = this.player.pos;
    const H = this.world.half;
    const tx = clamp(p.x + (Math.random() * 2 - 1) * 8, -H + 10, H - 10);
    const tz = clamp(p.z + 26 + Math.random() * 18, -H + 10, H - 10);
    const bomb = new THREE.Group();
    const casing = new THREE.Mesh(SP, mkMat(0x3c4650, { metalness: 0.5, roughness: 0.4 }));
    casing.scale.set(1.1, 1.6, 1.1);
    const fin = mkMat(0xffc832);
    const fins = new THREE.Mesh(BR, fin); fins.scale.set(1.5, 0.12, 0.6); fins.position.y = 1.25;
    const fins2 = new THREE.Mesh(BR, fin); fins2.scale.set(0.12, 1.5, 0.6); fins2.position.y = 1.25;
    bomb.add(casing, fins, fins2);
    bomb.position.set(tx, 78, tz);
    this.scene.add(bomb);
    this.nuke = { stage: 'fall', mesh: bomb, tx, tz, t: 0, cloud: null, crater: null };
    this.toast('☢️ 25kt device AWAY — take cover, 6 seconds!', 'bad');
    sfx.meteorWhistle();
  }

  updateLife(dt) {
    if (this.life) this.life.update(dt);
    if (this.train) this.train.update(dt, this.camera);
  }

  updateNuke(dt) {
    const n = this.nuke;
    if (!n || n.stage === 'done') return;
    n.t += dt;
    if (n.stage === 'fall') {
      n.mesh.position.y -= 13 * dt;
      n.mesh.rotation.z = Math.sin(n.t * 7) * 0.08;
      this.fx.spawn(n.mesh.position.x, n.mesh.position.y, n.mesh.position.z, 'smoke', 1);
      const gy = this.world.surfaceTop(Math.floor(n.tx + 0.5), Math.floor(n.tz + 0.5), 60);
      const gTop = gy > -Infinity ? gy : 0;
      if (n.t > 6 || n.mesh.position.y <= gTop + 2) {
        n.mesh.position.y = gTop + 2;
        this._nukeBlast(n, gTop);
        n.stage = 'cloud'; n.t = 0;
      }
      return;
    }
    if (n.stage === 'cloud') {
      const g = Math.min(1, n.t / 5);        // mushroom blooms over 5 s
      n.cloud.scale.setScalar(0.2 + g * 1.05);
      n.cloud.position.y = n.gTop + g * 34 + Math.max(0, n.t - 5) * dt * 0.6;
      n.cloud.rotation.y += dt * 0.25;
      if (n.t > 26) {
        this.scene.remove(n.cloud);
        this.scene.remove(n.crater);
        n.cloud = null; n.crater = null;
        n.stage = 'done';
        if (this.weather === 'nuke') this.activateWeather('clear');
        this.toast('Mushroom cloud dissipating… skies clear again.', 'good');
      }
    }
  }

  _nukeBlast(n, gTop) {
    const at = new THREE.Vector3(n.tx, gTop + 3, n.tz);
    const def = WEATHERS.find((x) => x.id === 'nuke');
    sfx.explode(); sfx.thunder();
    if (navigator.vibrate) navigator.vibrate([90, 40, 260]);
    this.flash.position.set(n.tx, gTop + 14, n.tz);
    this.flash.intensity = 260;              // blinding flash
    this.shakeT = 2.2;
    this.fx.spawn(at.x, at.y, at.z, 'fire', 120);
    this.fx.spawn(at.x, at.y + 3, at.z, 'smoke', 80);
    this.fx.spawn(at.x, at.y, at.z, 'debris', 90);
    for (const prop of this.world.props) {
      if (prop.gone) continue;
      if (Math.hypot(prop.cx - n.tx, prop.cz - n.tz) < def.radius) {
        for (let i = 0; i < 3; i++) this.world.applyHit(prop, def.dmg, null);
      }
    }
    this.bricksInRadius(at, def.radius - 2, (rec) => this.hurtBrick(rec, def.dmg));
    this.damageSplash(def, at, null);
    if (this.life) this.life.killNear(n.tx, n.tz, def.radius + 4);
    const crater = new THREE.Group();
    const char = mkMat(0x2b2320, { roughness: 1 });
    for (let a = 0; a < 26; a++) {
      const ang = (a / 26) * Math.PI * 2;
      const rr = 9 + (a % 3);
      const b = new THREE.Mesh(BR, char);
      b.scale.set(1.6, 0.5, 1.6);
      b.position.set(n.tx + Math.cos(ang) * rr, gTop + 0.25, n.tz + Math.sin(ang) * rr);
      b.rotation.y = ang;
      crater.add(b);
    }
    const floor = new THREE.Mesh(BR, char);
    floor.scale.set(15, 0.3, 15);
    floor.position.set(n.tx, gTop + 0.16, n.tz);
    crater.add(floor);
    this.scene.add(crater);
    const cloud = new THREE.Group();
    const cl = mkMat(0xd9c9a8, { emissive: 0xff7b2d, emissiveIntensity: 0.45, roughness: 1 });
    const cl2 = mkMat(0xb9a685, { roughness: 1 });
    const stem = new THREE.Mesh(SP, cl); stem.scale.set(4, 12, 4); stem.position.y = 6;
    const cap = new THREE.Mesh(SP, cl); cap.scale.set(12, 7, 12); cap.position.y = 15;
    cloud.add(stem, cap);
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(SP, cl2);
      const rr = 6.5 + i * 1.4;
      r.scale.set(rr, 2.4, rr);
      r.position.y = 11 + i * 2.2;
      cloud.add(r);
    }
    cloud.position.set(n.tx, gTop, n.tz);
    cloud.scale.setScalar(0.2);
    this.scene.add(cloud);
    n.cloud = cloud; n.crater = crater; n.gTop = gTop;
    this.toast('☢️ GROUND ZERO — 25kt. The map will remember that.', 'bad');
  }

  spawnMeteor() {
    if (this.mode !== 'weather' || this.weather !== 'meteor') return;
    const target = this.weatherPickProp(70);
    const t = target ? new THREE.Vector3(target.cx, 0, target.cz)
      : new THREE.Vector3(this.player.pos.x + (Math.random() * 2 - 1) * 40, 0, this.player.pos.z + (Math.random() * 2 - 1) * 40);
    const mesh = new THREE.Mesh(SP, mkMat(0x5a4636, { emissive: 0xff5a1f, emissiveIntensity: 1.6 }));
    mesh.scale.setScalar(1.4);
    mesh.position.set(t.x + 14, 46, t.z + 10);
    this.scene.add(mesh);
    const vel = t.clone().setY(0.5).sub(mesh.position).normalize().multiplyScalar(26);
    this.meteors.push({ mesh, vel, target: t });
    sfx.meteorWhistle();
  }

  updateWeather(dt) {
    const def = this.weatherDef;
    const p = this.player.pos;
    this.weatherT += dt;
    if (def.id === 'rain' || def.id === 'thunder') this.rain.update(dt, p.x, p.z, -30, -4);
    if (def.id === 'snow') this.snowf.update(dt, p.x, p.z, -1.6, Math.sin(this.weatherT * 0.4) * 1.2);
    if (this.boltT > 0) { this.boltT -= dt; this.bolt.visible = this.boltT > 0; }
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 40);

    // damage ticks (nuke is a one-shot air-drop event, not weather)
    if (def.dmg && !def.nuke) {
      this.weatherDmgT += dt;
      if (this.weatherDmgT >= def.every) {
        this.weatherDmgT = 0;
        if (def.strike) {
          this.strikeLightning();
        } else if (def.id === 'meteor') {
          this.spawnMeteor();
        } else if (def.mover) {
          // funnel path damage handled continuously below
        } else if (def.shake) { // earthquake: cracks everything near the player
          for (const pr of this.world.props) {
            if (pr.gone || Math.hypot(pr.cx - p.x, pr.cz - p.z) > 42) continue;
            const pt = this.hitPoint(pr, new THREE.Vector3(pr.cx, 1, pr.cz));
            this.world.applyHit(pr, def.dmg, pt);
            this.fx.spawn(pt.x, pt.y, pt.z, 'debris', 3);
          }
          sfx.thud();
        } else if (def.sweep) { // tsunami tick: wave body damages along its front
          // handled in wave sweep
        } else { // rain/snow steady wear near the player
          const pr = this.weatherPickProp();
          if (pr) {
            const pt = this.hitPoint(pr, new THREE.Vector3(pr.cx, 1.5, pr.cz));
            this.world.applyHit(pr, def.dmg, pt);
          }
        }
      }
    }

    // mover: tornado / hurricane funnel roams, sucking up debris and smashing props
    if (def.mover) {
      if (this.weatherT > 2.5) {
        this.weatherT = 0;
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 18;
        this.tornadoTgt.set(
          clamp(p.x + Math.cos(a) * r, -this.world.half + 4, this.world.half - 4),
          0,
          clamp(p.z + Math.sin(a) * r, -this.world.half + 4, this.world.half - 4));
      }
      const speed = def.id === 'hurricane' ? 10 : 7;
      const d = this.tornadoTgt.clone().sub(this.tornadoPos); d.y = 0;
      if (d.length() > 0.5) this.tornadoPos.addScaledVector(d.normalize(), Math.min(speed * dt, d.length()));
      this.funnel.update(dt, this.tornadoPos.x, 0, this.tornadoPos.z, def.id === 'hurricane' ? 2 : 1);
      if (def.id === 'hurricane') {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          this.fx.spawn(this.tornadoPos.x + Math.cos(a) * 5, 1 + Math.random() * 12, this.tornadoPos.z + Math.sin(a) * 5, 'debris', 1);
        }
      }
      this.weatherDmgT += dt;
      if (this.weatherDmgT >= def.every) {
        this.weatherDmgT = 0;
        for (const pr of this.world.props) {
          if (pr.gone) continue;
          if (Math.hypot(pr.cx - this.tornadoPos.x, pr.cz - this.tornadoPos.z) > def.radius + 2) continue;
          const pt = this.hitPoint(pr, this.tornadoPos.clone().setY(2));
          this.world.applyHit(pr, def.dmg, pt);
        }
      }
    }

    // tsunami sweep
    if (def.sweep) {
      const H = this.world.half;
      this.waveZ += dt * 17;
      if (this.waveZ > H + 16) { this.waveZ = -H - 16; this.waveId++; sfx.wave(); }
      this.wave.place(this.player.pos.x * 0.3, this.waveZ, H * 2.4, 9);
      for (const pr of this.world.props) {
        if (pr.gone || pr._ts === this.waveId + ':' + Math.floor(this.waveZ / 6)) continue;
        if (Math.abs(pr.cz - this.waveZ) > 5) continue;
        pr._ts = this.waveId + ':' + Math.floor(this.waveZ / 6);
        const pt = this.hitPoint(pr, new THREE.Vector3(pr.cx, 2, this.waveZ));
        this.world.applyHit(pr, def.dmg, pt);
        this.fx.spawn(pr.cx, 2, pr.cz, 'fire', 6);
      }
      if (Math.abs(p.z - this.waveZ) < 6 && p.y < 6) {
        this.player.vel.z += (this.player.pos.z < this.waveZ ? -14 : 14) * dt * 8;
        this.player.vel.y += 20 * dt;
      }
    }
  }

  updateRockets(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      const step = r.vel.clone().multiplyScalar(dt);
      const ro = r.mesh.position.clone();
      const rd = r.vel.clone().normalize();
      const hit = this.rayScene(ro, rd, step.length() + 0.05);
      r.vel.y += 1.0 * dt; // slight upward arch over the flight
      r.mesh.position.add(step);
      if (r.vel.lengthSq() > 0.01) r.mesh.lookAt(r.mesh.position.clone().add(r.vel));
      r.life -= dt;
      this.fx.spawn(r.mesh.position.x, r.mesh.position.y, r.mesh.position.z, 'smoke', 1);
      let boom = false;
      if (hit.solid) {
        boom = true;
        r.mesh.position.copy(ro).addScaledVector(rd, Math.max(0.05, hit.t - 0.05));
      } else if (r.life <= 0 || r.mesh.position.y < -2) boom = true;
      if (boom) {
        this.explode(r.mesh.position.clone(), WEAPONS[3]);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }
  }

  /* Lobbed fireballs: gravity arc, detonate on terrain/props/timeout. */
  updateFireballs(dt) {
    if (!this.fireballs || !this.fireballs.length) return;
    const def = { ...WEAPONS[2], radius: 2.6, dmg: 30, maxBreak: 4 };
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const b = this.fireballs[i];
      b.vel.y -= 9.8 * dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const ro = b.mesh.position.clone();
      const rd = b.vel.clone().normalize();
      const hit = this.rayScene(ro, rd, step.length() + 0.05);
      b.mesh.position.add(step);
      b.life -= dt;
      this.fx.spawn(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 'fire', 2);
      const groundY = this.world.inHouse ? -Infinity
        : this.world.surfaceTop(Math.floor(b.mesh.position.x + 0.5), Math.floor(b.mesh.position.z + 0.5), 60);
      let boom = hit.solid || b.life <= 0 ||
        (groundY > -Infinity && b.mesh.position.y + b.vel.y * dt <= groundY + 0.05) ||
        b.mesh.position.y < -2;
      if (boom) {
        this.explode(b.mesh.position.clone(), def);
        this.scene.remove(b.mesh);
        this.fireballs.splice(i, 1);
      }
    }
  }

  updateMeteors(dt) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.mesh.position.addScaledVector(m.vel, dt);
      this.fx.spawn(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, 'fire', 3);
      if (m.mesh.position.y <= 0.6) {
        const def = { ...WEATHERS.find((w) => w.id === 'meteor'), radius: 6, maxBreak: 6, dmg: 150 };
        this.explode(new THREE.Vector3(m.mesh.position.x, 0.8, m.mesh.position.z), def);
        this.scene.remove(m.mesh);
        this.meteors.splice(i, 1);
      }
    }
  }

  updateFalling(dt) {
    for (let i = this._falling.length - 1; i >= 0; i--) {
      const f = this._falling[i];
      f.t += dt;
      f.vel.y -= 18 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      if (f.t > 2.4) {
        f.mesh.visible = false;
        f.mesh.removeFromParent();
        this._falling.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------- input */
  bindStripsDone() {}

  fitShadow() {
    const span = Math.max(this.world.half, 40) * 1.6;
    const s = this.sun.shadow.camera;
    s.left = -span; s.right = span; s.top = span; s.bottom = -span;
    s.near = 1; s.far = 60 + span * 2;
    s.updateProjectionMatrix();
  }

  regenerateWorld() {
    if (this.life) { this.life.dispose(); }
    if (this.train) { this.train.dispose(); this.train = null; }
    clearState(this.world.opts.size); // mammoth reset: regenerate wipes all damage
    this.world.genSalt = (Math.floor(Math.random() * 0x7fffffff) >>> 0);
    this.sig = sigOf(this.world.opts);
    this.world.sig = this.sig;
    this.world._pending = [];
    if (this.weather !== 'clear') this.activateWeather('clear');
    if (this.world.inHouse) {
      this.world.exitHouse();
      this.world.interior.group.visible = false;
      this.applyOutdoorFog();
    }
    this.world.rebuild();
    if (this.confetti) {
      this.scene.remove(this.confetti);
      this.confetti.geometry.dispose();
      this.confetti.material.dispose();
      this.confetti = null;
    }
    this.life = new Life(this.world, this.scene, this.world.rand);
    this.life.populate();
    if (this.world.railR && !this.train) this.train = new Train(this.world, this.scene, this.world.rand);
    this.clearCollectibles();
    this.collected = 0;
    this.repaired = false;
    this.rescueT = 0;
    this.nearDoor = null;
    this.ghost.visible = false;
    this.player.pos.set(0.5, 0, 3);
    this.player.vel.set(0, 0, 0);
    this.orbit.wantDist = 11;
    this.fitShadow();
    this.applyOutdoorFog();
    this.spawnCollectibles();
    this.updateHud();
    const p = this.world.preset;
    const extra = p.towns + p.rural + p.farms;
    this.toast(`World regenerated — ${p.label} map, ${p.zones} zone${p.zones > 1 ? 's' : ''}`
      + (extra ? `, ${extra} settlements beyond the village` : '') + ', 1 giant monument', 'good');
  }

  selectSlot(i) {
    this.slot = i;
    this.removeMode = i >= BRICKS.length;
    this.slots.forEach((s, j) => s.classList.toggle('active', j === i));
    if (!this.removeMode) this.setGhostDef(BRICKS[i]);
    if (this.ghost) this.ghost.visible = false;
  }

  start() {
    this.started = true;
    this.setMode('explore');
    this.intro.classList.add('hidden');
    this.toast('🧭 Explore mode — grab loose bricks, or switch modes (1-4).', 'good');
  }

  toast(msg, kind) {
    const el = this.toastEl;
    el.textContent = msg;
    el.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.className = ''; }, kind === 'win' ? 6500 : 2600);
  }

  updateHud() {
    this.elCount.textContent = String(this.collected);
    const left = Math.max(0, GOAL - this.collected);
    this.elNeed.textContent = left > 0
      ? `Collect ${left} more to fix the rainbow bridge`
      : 'Bridge repaired — portal unlocked!';
    if (this.world.monumentRect) {
      this.elNeed.textContent += ' · 🗿 giant face mosaic is north across the bridge';
    }
  }

  bindInput() {
    this.keys = new Set();
    const map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    window.addEventListener('keydown', (e) => {
      if (this.panel?.isOpen) {
        if (e.code === 'Escape') this.panel.close();
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); this.jumpQueued = 0.16; return; }
      if (e.code === 'KeyE') { this.toggleDoor(); return; }
      if (e.code === 'Escape') { e.preventDefault(); this.setMode('explore'); return; }
      if (e.code === 'Tab') {
        e.preventDefault();
        const order = MODES.map((m) => m.id);
        this.setMode(order[(order.indexOf(this.mode) + 1) % order.length]);
        return;
      }
      const mk = MODE_KEYS[e.code];
      if (mk !== undefined) { e.preventDefault(); this.setMode(mk); return; }
      if (map[e.code]) { this.keys.add(map[e.code]); e.preventDefault(); return; }
      if (e.code === 'KeyX' && this.mode === 'build') { this.selectSlot(BRICKS.length); return; }
      const n = parseInt(e.key, 10);
      if (Number.isNaN(n)) return;
      if (this.mode === 'weapon') {
        if (n >= 1 && n <= WEAPONS.length) this.selectWeapon(n - 1);
      } else if (this.mode === 'weather') {
        if (n >= 1 && n <= WEATHERS.length) this.onWeatherClick(WEATHERS[n - 1].id);
      } else if (this.mode === 'build') {
        if (n >= 1 && n <= BRICKS.length) this.selectSlot(n - 1);
      }
    });
    window.addEventListener('keyup', (e) => { if (map[e.code]) this.keys.delete(map[e.code]); });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => this.resize());
    if (matchMedia('(hover: none)').matches) document.body.classList.add('touch');

    const c = this.canvas;
    this.pointers = new Map();
    this.pinch = 0;
    this.hoverNdc = null;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.touchUi(e)) return;
      if (this.mode === 'weapon' && this.started && !this.world.inHouse && this.pointers.size === 0 && e.button !== 2) {
        this.holdNdc = this.ndc(e.clientX, e.clientY);
        this.tryFire(this.holdNdc);
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), fire: true });
        return;
      }
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (this.pointers.size === 2) this.pinch = this.pinchDist();
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') this.hoverNdc = this.ndc(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (p.fire) this.holdNdc = this.ndc(e.clientX, e.clientY);
      this.orbit.yaw -= dx * 0.0062;
      this.orbit.pitch = clamp(this.orbit.pitch + dy * 0.0055, -0.18, 1.32);
      if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.pinch) this.orbit.wantDist = clamp(this.orbit.wantDist * (this.pinch / d), 4.5, 26);
        this.pinch = d;
      }
    });
    const finish = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (p && p.fire) { this.holdNdc = null; sfx.setFlame(false); return; }
      if (!p) return;
      const quick = performance.now() - p.t < 450;
      const still = Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 14;
      if (quick && still) this.actuate(e);
    };
    c.addEventListener('pointerup', finish);
    c.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.wantDist = clamp(this.orbit.wantDist + Math.sign(e.deltaY) * 1.3, 4.5, 26);
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    const hud = document.getElementById('hud');
    this.joy = document.createElement('div');
    this.joy.id = 'joystick';
    this.joy.innerHTML = '<div class="knob"></div>';
    this.jumpBtn = document.createElement('button');
    this.jumpBtn.id = 'btn-jump';
    this.jumpBtn.textContent = 'JUMP';
    this.enterBtn = document.createElement('button');
    this.enterBtn.id = 'btn-enter';
    this.enterBtn.textContent = 'ENTER';
    hud.append(this.joy, this.jumpBtn, this.enterBtn);
    this.joyVec = { x: 0, y: 0 };

    const knob = this.joy.querySelector('.knob');
    let joyId = null, joyRect = null;
    this.joy.addEventListener('touchstart', (e) => {
      joyId = e.changedTouches[0].identifier;
      joyRect = this.joy.getBoundingClientRect();
      e.preventDefault();
    }, { passive: false });
    this.joy.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId || !joyRect) continue;
        let vx = (t.clientX - (joyRect.left + joyRect.width / 2)) / (joyRect.width / 2);
        let vy = (t.clientY - (joyRect.top + joyRect.height / 2)) / (joyRect.height / 2);
        const len = Math.hypot(vx, vy);
        if (len > 1) { vx /= len; vy /= len; }
        this.joyVec = { x: vx, y: vy };
        knob.style.transform = `translate(${vx * 30}px, ${vy * 30}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    const joyUp = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.joyVec = { x: 0, y: 0 };
          knob.style.transform = '';
        }
      }
    };
    this.joy.addEventListener('touchend', joyUp);
    this.joy.addEventListener('touchcancel', joyUp);
    this.jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.jumpQueued = 0.16; }, { passive: false });
    this.jumpBtn.addEventListener('click', (e) => { e.preventDefault(); this.jumpQueued = 0.16; });
    this.enterBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleDoor(); }, { passive: false });
    this.enterBtn.addEventListener('click', (e) => { e.preventDefault(); this.toggleDoor(); });
  }

  touchUi(e) {
    for (const el of [this.joy, this.jumpBtn, this.enterBtn]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
    }
    return false;
  }

  pinchDist() {
    const p = [...this.pointers.values()];
    if (p.length < 2) return 0;
    return Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y));
  }

  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * 2 - 1, y: -((y - r.top) / r.height) * 2 + 1 };
  }

  ownerBrick(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.key) return this.world.brickMap.get(o.userData.key);
      o = o.parent;
    }
    return null;
  }

  rayTargets() {
    if (this.world.inHouse) return [];
    return this.world.staticMeshes.concat(this.world.brickMeshes);
  }

  computePlacement(ndc) {
    this.pick.setFromCamera(ndc, this.camera);
    const hits = this.pick.intersectObjects(this.rayTargets(), true);
    const def = BRICKS[this.slot];
    let gx, gz, gy;

    if (hits.length) {
      const hit = hits[0];
      const n = hit.face
        ? hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
        : UP.clone();
      const point = hit.point.clone().addScaledVector(n, 0.02);
      const brick = this.ownerBrick(hit.object);
      if (n.y > 0.5) {
        gx = Math.floor(point.x + 0.5);
        gz = Math.floor(point.z + 0.5);
        gy = brick ? brick.box.max.y : (hit.object === this.world.water ? this.world.waterTop : 0);
      } else {
        const dx = n.x > 0.5 ? 1 : n.x < -0.5 ? -1 : 0;
        const dz = n.z > 0.5 ? 1 : n.z < -0.5 ? -1 : 0;
        gx = Math.floor(point.x + 0.5) + dx;
        gz = Math.floor(point.z + 0.5) + dz;
        gy = brick && brick.box.min.y > 0 ? brick.box.min.y : 0;
      }
    } else {
      const pt = new THREE.Vector3();
      if (!this.pick.ray.intersectPlane(new THREE.Plane(UP, 0), pt)) return null;
      gx = Math.floor(pt.x + 0.5);
      gz = Math.floor(pt.z + 0.5);
      gy = 0;
    }

    const support = this.world.surfaceTop(gx, gz, gy + 8);
    if (support > gy + 1e-3) gy = support;

    if (gy > 14 || Math.abs(gx) > this.world.half || Math.abs(gz) > this.world.half) {
      return { valid: false, reason: 'out of range', gx, gy, gz, def };
    }
    if (this.world.brickMap.has(this.world.brickKey(gx, gy, gz))) {
      return { valid: false, reason: 'that spot is taken', gx, gy, gz, def };
    }
    const p = this.player.pos;
    const box = new THREE.Box3(new THREE.Vector3(gx, gy, gz), new THREE.Vector3(gx + def.w, gy + def.h, gz + def.d));
    const me = new THREE.Box3(new THREE.Vector3(p.x - 0.42, p.y, p.z - 0.42), new THREE.Vector3(p.x + 0.42, p.y + 1.9, p.z + 0.42));
    if (box.intersectsBox(me)) return { valid: false, reason: 'you are standing there', gx, gy, gz, def };
    return { valid: true, gx, gy, gz, def };
  }

  actuate(e) {
    if (!this.started) return;
    if (this.mode === 'weapon') return; // handled by tryFire on pointerdown
    if (this.mode === 'weather') { this.toast('Pick a weather from the strip below', 'good'); return; }
    const ndc = this.ndc(e.clientX, e.clientY);
    this.pick.setFromCamera(ndc, this.camera);

    if (this.world.inHouse) {
      const hits = this.pick.intersectObjects([this.world.interior.screenMesh], false);
      if (hits.length) {
        this.world.interior.tv.nextChannel();
        this.toast('BRICK TV — channel changed', 'good');
        if (navigator.vibrate) navigator.vibrate(10);
      }
      return;
    }
    const hits = this.pick.intersectObjects(this.rayTargets(), true);

    if (this.removeMode) {
      for (const h of hits) {
        const b = this.ownerBrick(h.object);
        if (b) {
          this.world.removeBrick(b);
          this.toast(`Removed a ${b.def.name.toLowerCase()} brick`, 'bad');
          return;
        }
      }
      this.toast('Remove mode: tap one of your placed bricks', 'bad');
      return;
    }
    if (this.mode === 'explore') return;
    const t = this.computePlacement(ndc);
    if (!t) return;
    if (!t.valid) { this.toast(`Can't place there — ${t.reason}`, 'bad'); return; }
    const rec = this.world.placeBrick(t.gx, t.gy, t.gz, t.def);
    if (rec) sfx.place();
    if (rec && this.world.placedCount % 10 === 0) this.toast(`${this.world.placedCount} bricks built. Nice!`, 'good');
  }

  collectCheck() {
    const p = this.player.pos;
    const c = new THREE.Vector3(p.x, p.y + 0.9, p.z);
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const b = this.collectibles[i];
      if (b.position.distanceTo(c) < 1.6) {
        this.scene.remove(b);
        this.collectibles.splice(i, 1);
        this.collected++;
        if (navigator.vibrate) navigator.vibrate(15);
        this.updateHud();
        if (!this.repaired) {
          if (this.collected >= GOAL) this.repair();
          else if (this.collected % 5 === 0) this.toast(`${GOAL - this.collected} bricks to go`, 'good');
        }
      }
    }
  }

  repair() {
    this.repaired = true;
    this.world.repairBridge();
    this.updateHud();
    this.toast('Rainbow bridge repaired! A celebration portal glows across the river.', 'win');
    if (!this.confetti) this.makeConfetti();
  }

  makeConfetti() {
    const n = 300;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.confettiVel = new Float32Array(n * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 0.5 + (Math.random() * 2 - 1) * 3;
      pos[i * 3 + 1] = 2 + Math.random() * 6;
      pos[i * 3 + 2] = this.world.river.z1 + 5.5 + (Math.random() * 2 - 1) * 3;
      tmp.setHex(RAINBOW[i % RAINBOW.length]);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      this.confettiVel[i * 3] = (Math.random() * 2 - 1) * 2.4;
      this.confettiVel[i * 3 + 1] = 2 + Math.random() * 4;
      this.confettiVel[i * 3 + 2] = (Math.random() * 2 - 1) * 2.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.confetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.34, vertexColors: true }));
    this.scene.add(this.confetti);
  }

  updateCamera(dt) {
    if (this.world.inHouse) {
      const o = this.orbit;
      o.dist += (o.wantDist - o.dist) * Math.min(1, dt * 6);
      const D = INTERIOR_DEF;
      const p = this.player.pos;
      const target = new THREE.Vector3(p.x, p.y + 1.4, p.z);
      const dir = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch));
      const want = target.clone().addScaledVector(dir, o.dist);
      want.x = clamp(want.x, D.x0 + 0.4, D.x1 - 0.4);
      want.z = clamp(want.z, D.z0 + 0.4, D.z1 + 1.4);
      want.y = clamp(want.y, 0.7, D.h - 0.35);
      this.camera.position.lerp(want, Math.min(1, dt * 9));
      this.camera.lookAt(target);
      return;
    }
    const o = this.orbit;
    o.dist += (o.wantDist - o.dist) * Math.min(1, dt * 6);
    const p = this.player.pos;
    const target = new THREE.Vector3(p.x, p.y + 1.5, p.z);
    const dir = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch));
    const want = target.clone().addScaledVector(dir, o.dist);
    const groundY = this.world.surfaceTop(Math.floor(want.x + 0.5), Math.floor(want.z + 0.5), 60);
    want.y = Math.max(want.y, Math.max(groundY, p.y) + 0.9);
    want.x = clamp(want.x, -this.world.half - 8, this.world.half + 8);
    want.z = clamp(want.z, -this.world.half - 8, this.world.half + 8);
    this.camera.position.lerp(want, Math.min(1, dt * 9));
    this.camera.lookAt(target);

    this.sun.position.set(p.x + 26, 40, p.z + 18);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  updateGhost() {
    if (this.mode !== 'build' || this.removeMode || !this.started || this.pointers.size >= 2) { this.ghost.visible = false; return; }
    let ndc = null;
    if (this.pointers.size === 1) {
      const p = [...this.pointers.values()][0];
      ndc = this.ndc(p.x, p.y);
    } else if (this.hoverNdc) {
      ndc = this.hoverNdc;
    }
    if (ndc) {
      const t = this.computePlacement(ndc);
      if (t) {
        const d = t.def;
        this.ghost.position.set(t.gx + d.w / 2 - 0.5, t.gy + d.h / 2, t.gz + d.d / 2 - 0.5);
        this.ghost.material.opacity = t.valid ? 0.42 : 0.15;
        this.ghost.children[0].material.color.setHex(t.valid ? 0xffffff : 0xff5555);
        this.ghost.visible = true;
        return;
      }
    }
    this.ghost.visible = false;
  }

  updateDoorState() {
    const p = this.player.pos;
    const btn = this.enterBtn;
    let action = null;
    if (this.world.inHouse) {
      const D = INTERIOR_DEF;
      const near = Math.hypot(p.x - D.door.x, p.z - D.door.z) < 1.35;
      action = near ? 'exit' : null;
      btn.textContent = near ? 'EXIT' : 'EXIT 🔒';
    } else {
      let best = Infinity, hit = null;
      for (const a of this.world.doorAnchors) {
        const d = Math.hypot(p.x - a.world.x, p.z - a.world.z);
        if (d < best) { best = d; hit = a; }
      }
      if (hit && best < 2.2) { action = 'enter'; this.nearDoor = hit; } else { action = null; this.nearDoor = null; }
      btn.textContent = 'ENTER';
    }
    btn.classList.toggle('pulse', !!action);
    btn.classList.toggle('hidden', !action);
    this.doorAction = action;
  }

  toggleDoor() {
    if (!this.started) return;
    if (this.world.inHouse) {
      const D = INTERIOR_DEF;
      if (Math.hypot(this.player.pos.x - D.door.x, this.player.pos.z - D.door.z) >= 1.35) {
        this.toast('Walk to the front door to leave', 'bad');
        return;
      }
      const a = this.nearDoor;
      this.world.exitHouse();
      this.world.interior.group.visible = false;
      this.applyOutdoorFog();
      this.player.pos.set(a.world.x + Math.sin(a.yaw) * 1.0, 0.05, a.world.z + Math.cos(a.yaw) * 1.0);
      this.player.vel.set(0, 0, 0);
      this.orbit.wantDist = 11;
      this.toast('Back outside', 'good');
      return;
    }
    const a = this.nearDoor;
    if (!a) { this.toast('Stand in front of a house door to enter', 'bad'); return; }
    this.world.enterHouse();
    const D = INTERIOR_DEF;
    this.world.interior.group.visible = true;
    this.scene.fog = null;
    this.player.pos.set(D.spawn.x, D.spawn.y, D.spawn.z);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = Math.PI;
    this.orbit.yaw = 0;
    this.orbit.pitch = 0.3;
    this.orbit.wantDist = 6.5;
    this.ghost.visible = false;
    this.toast('Welcome inside! Tap the TV to change the channel. Green pad = exit.', 'good');
  }

  riverRescue(dt) {
    if (this.player.inRiverTrench()) {
      this.rescueT += dt;
      if (this.rescueT > 1.2) {
        const p = this.player;
        const rz = this.world.river;
        const mid = (rz.z0 + rz.z1) / 2;
        p.pos.z = p.pos.z < mid ? rz.z0 - 1.2 : rz.z1 + 1.2;
        p.pos.y = 0;
        p.vel.set(0, 0, 0);
        this.rescueT = 0;
        this.toast('The current swept you back to the bank!', 'bad');
      }
    } else {
      this.rescueT = 0;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.jumpQueued = Math.max(0, this.jumpQueued - dt);

    const k = this.keys;
    let mx = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
    let mz = (k.has('b') ? 1 : 0) - (k.has('f') ? 1 : 0);
    mx += this.joyVec.x;
    mz += this.joyVec.y;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    const yaw = this.orbit.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = { x: fwd.x * -mz + right.x * mx, z: fwd.z * -mz + right.z * mx };

    this.player.update(dt, move, this.jumpQueued > 0);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.tickWeaponRig(dt);
    if (this.mode === 'weapon' && this.holdNdc && this.pointers.size > 0) this.tryFire(this.holdNdc);
    this.updateRockets(dt);
    this.updateFireballs(dt);
    this.updateNuke(dt);
    this.updateLife(dt);
    this.updateMeteors(dt);
    this.updateFalling(dt);
    this.fx.update(dt);
    this._saveT -= dt;
    if (this._saveT < -1) { this._saveT = 2; this.saveDamage(); }
    if (!this.world.inHouse && this.started) this.updateWeather(dt);
    this.stars.move(this.player.pos.x, this.player.pos.z);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    this.updateDoorState();
    if (this.world.inHouse) {
      this.world.interior.tick(this.time, dt);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.riverRescue(dt);
    this.collectCheck();
    this.updateGhost();
    this.updateCamera(dt);
    this.world.update(this.time, dt);

    for (const b of this.collectibles) {
      b.rotation.y += dt * 1.6;
      b.position.y = b.userData.baseY + Math.sin(this.time * 2 + b.userData.phase) * 0.16;
    }
    if (this.confetti) {
      const pos = this.confetti.geometry.attributes.position.array;
      const v = this.confettiVel;
      for (let i = 0; i < pos.length / 3; i++) {
        v[i * 3 + 1] -= 7 * dt;
        pos[i * 3] += v[i * 3] * dt;
        pos[i * 3 + 1] += v[i * 3 + 1] * dt;
        pos[i * 3 + 2] += v[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.2) { pos[i * 3 + 1] = 5 + Math.random() * 4; v[i * 3 + 1] = Math.random() * 2; }
      }
      this.confetti.geometry.attributes.position.needsUpdate = true;
    }

    if (this.shakeT > 0) {
      const s = 0.12;
      this.camera.position.x += (Math.random() * 2 - 1) * s;
      this.camera.position.y += (Math.random() * 2 - 1) * s;
      this.camera.position.z += (Math.random() * 2 - 1) * s;
    }
    this.renderer.render(this.scene, this.camera);
  }

  tickWeaponRig(dt) {
    if (!this.weaponRig.visible) return;
    const rig = this.weaponRig.userData;
    rig.swing = Math.max(0, (rig.swing || 0) - dt * 3);
    const sw = rig.swing;
    // -X pitch tips a -Z-pointing weapon forward/down. Rest pose is raked
    // back (-0.15); at fire it pitches forward and strikes, snapping back.
    const u = Math.min(1, sw * 2);
    this.weaponRig.rotation.x = -0.15 - u * 1.25;
    this.weaponRig.rotation.y = -0.2 + u * 0.4;
  }
}

window.addEventListener('error', (e) => {
  const t = document.getElementById('toast');
  if (t) { t.textContent = 'Error: ' + e.message; t.className = 'show bad'; }
});

const game = new Game();
window.GAME = game;
game.debugBricks = BRICKS; // exposed for smoke tests
