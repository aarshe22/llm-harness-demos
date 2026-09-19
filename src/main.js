import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const BR = new THREE.BoxGeometry(1, 1, 1);
const CY = new THREE.CylinderGeometry(1, 1, 1, 12);
const SP = new THREE.SphereGeometry(1, 16, 10);
const CO = new THREE.ConeGeometry(1, 1, 5);

const BRICKS = [
  { name: 'Brick', w: 1, h: 1, d: 1, color: 0xe8402a, studs: [[0, 0]] },
  { name: 'Plate', w: 1, h: 0.4, d: 1, color: 0x2f7de1, studs: [[0, 0]] },
  { name: 'Wide', w: 2, h: 1, d: 1, color: 0xffc42e, studs: [[-0.5, 0], [0.5, 0]] },
  { name: 'Tile', w: 2, h: 0.4, d: 2, color: 0x35b56a, studs: [] },
  { name: 'Arch', w: 1, h: 2, d: 1, color: 0x9b5de5, studs: [[0, 0]], hollow: true },
  { name: 'Round', w: 1, h: 1, d: 1, color: 0xff8a3d, studs: [[0, 0]], round: true }
];
const RAINBOW = [0xff4d6d, 0xff9f1c, 0xffd23f, 0x43d46c, 0x35a7ff, 0x9b5de5];
const GOAL = 24;
const HALF = 28;
const RIVER = { x0: -7, x1: 7, z0: 9, z1: 19 };
const WATER_TOP = 0.4;
const BED_TOP = -2.2;

function mkMat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.02 }, extra));
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function part(geo, x, y, z) {
  const m = new THREE.Mesh(geo, null);
  m.position.set(x, y, z);
  return m;
}
function addBox(g, w, h, d, x, y, z) {
  const m = part(BR, x, y, z); m.scale.set(w, h, d); g.push(m); return m;
}
function addCyl(g, r, h, x, y, z, rz) {
  const m = part(CY, x, y, z); m.scale.set(r, h, rz === undefined ? r : rz); g.push(m); return m;
}
function bake(m) {
  m.updateMatrix();
  const g = m.geometry.clone().applyMatrix4(m.matrix);
  if (g.index) g.deleteAttribute('normal');
  return g;
}
function merged(list, mat) {
  if (!list.length) return new THREE.Mesh(new THREE.BufferGeometry(), mat);
  const geo = mergeGeometries(list.map(bake), false);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

class World {
  constructor(scene) {
    this.scene = scene;
    this.solids = [];
    this.staticMeshes = [];
    this.brickMap = new Map();
    this.brickMeshes = [];
    this.placedCount = 0;
    this._mat = new Map();
    this._studs = new Map();
    this.hillCenters = [[-19, -13], [20, -18], [-21, 15], [21, 12]];
    this.houseRects = [
      { x: -11, z: -7, w: 2.8, d: 2.3 }, { x: 9, z: -12, w: 2.3, d: 2.8 },
      { x: -16, z: 4, w: 2.3, d: 2.8 }, { x: 14, z: 3, w: 2.8, d: 2.3 },
      { x: 6, z: 2, w: 1.3, d: 1.3 }
    ];
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
    this.solids.push({ box, brick: null, noSupport: !!noSupport });
    if (mesh) {
      this.scene.add(mesh);
      if (!noRay) this.staticMeshes.push(mesh);
    }
  }

  build() {
    this.buildGround();
    this.buildWater();
    this.buildPaths();
    this.buildHills();
    this.buildVillage();
    for (let i = 0; i < 24; i++) this.buildTree();
    this.buildBridge();
  }

  inRiver(x, z) { return x > RIVER.x0 && x < RIVER.x1 && z > RIVER.z0 && z < RIVER.z1; }

  propBlocked(x, z) {
    if (this.inRiver(x, z)) return true;
    if (Math.abs(x) < 3 && Math.abs(z + 3.5) < 2.5) return true;
    if (Math.abs(x) < 3 && z > -16 && z < 8) return true;
    if (Math.abs(z - 6.5) < 2.5 && Math.abs(x) < 9.5) return true;
    for (const h of this.houseRects) {
      if (Math.abs(x - h.x) < h.w + 1 && Math.abs(z - h.z) < h.d + 1) return true;
    }
    return false;
  }

  buildGround() {
    const grass = this.mat(0x74c745);
    const regions = [
      [0, -10, 2 * (HALF + 1), RIVER.z0 + HALF + 1],
      [0, 24, 2 * (HALF + 1), HALF + 1 - RIVER.z1],
      [-18, 14, RIVER.x0 + HALF + 1, RIVER.z1 - RIVER.z0],
      [18, 14, HALF + 1 - RIVER.x1, RIVER.z1 - RIVER.z0]
    ];
    const parts = [];
    for (const [cx, cz, w, d] of regions) {
      addBox(parts, w, 2, d, cx, -1, cz);
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(cx - w / 2, -2, cz - d / 2),
        new THREE.Vector3(cx + w / 2, 0, cz + d / 2)
      ), null, true);
    }
    const ground = merged(parts, grass);
    this.scene.add(ground);
    this.staticMeshes.push(ground);

    const bed = merged([addBox([], RIVER.x1 - RIVER.x0, 1.2, RIVER.z1 - RIVER.z0, 0, BED_TOP - 0.6, 14)], this.mat(0xd9b98a));
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(RIVER.x0, BED_TOP - 1, RIVER.z0),
      new THREE.Vector3(RIVER.x1, BED_TOP, RIVER.z1)
    ), bed, true);

    const patches = [];
    const stems = [];
    const headsByColor = [[], [], [], []];
    const headMats = [0xff5d8f, 0xffd23f, 0xffffff, 0xff8a3d].map((c) => this.mat(c));
    for (let i = 0; i < 90; i++) {
      const x = Math.round((Math.random() * 2 - 1) * (HALF - 2)) + 0.5;
      const z = Math.round((Math.random() * 2 - 1) * (HALF - 2)) + 0.5;
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
    this.scene.add(merged(patches, this.mat(0x8fda5a)));
    this.scene.add(merged(stems, this.mat(0x2f9e4f)));
    headsByColor.forEach((list, i) => { if (list.length) this.scene.add(merged(list, headMats[i])); });
  }

  buildWater() {
    const mat = mkMat(0x2f9bea, { roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false });
    const h = WATER_TOP - BED_TOP + 0.15;
    const parts = [];
    for (let x = RIVER.x0; x < RIVER.x1; x++) {
      for (let z = RIVER.z0; z < RIVER.z1; z++) {
        addBox(parts, 1, h, 1, x + 0.5, BED_TOP - 0.15 + h / 2, z + 0.5);
      }
    }
    const water = merged(parts, mat);
    water.castShadow = false;
    water.renderOrder = 2;
    this.water = water;
    this.scene.add(water);
    this.staticMeshes.push(water);

    const shore = [];
    for (const z of [RIVER.z0 - 1, RIVER.z1]) {
      for (let x = RIVER.x0 - 1; x < RIVER.x1 + 1; x++) addBox(shore, 1, 0.1, 1, x + 0.5, 0.05, z + 0.5);
    }
    this.scene.add(merged(shore, this.mat(0xe8c78a)));
  }

  buildPaths() {
    const parts = [];
    for (let z = -14; z <= 8; z += 2) addBox(parts, 1.6, 0.12, 1.8, 0.5, 0.06, z + 0.5);
    for (let x = -8; x <= 8; x += 2) addBox(parts, 1.8, 0.12, 1.6, x + 0.5, 0.06, 6.5);
    const m = merged(parts, this.mat(0xd9cdb6));
    m.receiveShadow = true;
    this.scene.add(m);
  }

  buildHills() {
    for (const [cx, cz] of this.hillCenters) {
      const tiers = [[9, 1.0], [6.4, 1.0], [4.4, 1.0], [2.8, 1.0]];
      let y = 0;
      for (const [size, h] of tiers) {
        const tier = merged([addBox([], size, h, size, cx + 0.5, y + h / 2, cz + 0.5)],
          this.mat(y < 0.1 ? 0x5fb83a : 0x6ac446));
        this.addSolid(new THREE.Box3(
          new THREE.Vector3(cx + 0.5 - size / 2, y, cz + 0.5 - size / 2),
          new THREE.Vector3(cx + 0.5 + size / 2, y + h, cz + 0.5 + size / 2)
        ), tier);
        y += h;
      }
      this.scene.add(merged([addBox([], 2.8, 0.12, 2.8, cx + 0.5, y + 0.06, cz + 0.5)], this.mat(0x8fda5a)));
      const rock = part(SP, cx + 1.6, y + 0.35, cz + 1.4);
      rock.scale.set(0.6, 0.45, 0.55);
      this.scene.add(merged([rock], this.mat(0xa8b0b8)));
    }
  }

  buildTree() {
    let x, z;
    for (let tries = 0; tries < 14; tries++) {
      const px = Math.round((Math.random() * 2 - 1) * (HALF - 3) * 2) / 2;
      const pz = Math.round((Math.random() * 2 - 1) * (HALF - 3) * 2) / 2;
      if (Math.hypot(px, pz) < 6) continue;
      if (this.hillCenters.some((h) => Math.hypot(px - h[0], pz - h[1]) < 6)) continue;
      if (this.propBlocked(px, pz)) continue;
      x = px; z = pz;
      break;
    }
    if (x === undefined) return;

    const trunkH = 1.4 + Math.random() * 1.1;
    const trunk = [];
    addCyl(trunk, 0.26, trunkH, x, trunkH / 2, z, 0.34);
    this.scene.add(merged(trunk, this.mat(0x8b5a2b)));

    const leafMat = this.mat(Math.random() < 0.6 ? 0x2f9e4f : 0x3fb963);
    const leaves = [];
    const cones = Math.random() < 0.55;
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
    this.scene.add(merged(leaves, leafMat));

    this.solids.push({ brick: null, noSupport: true, box: new THREE.Box3(
      new THREE.Vector3(x - 0.4, 0, z - 0.4), new THREE.Vector3(x + 0.4, trunkH, z + 0.4)
    )});
  }

  buildVillage() {
    const houses = [
      { x: -11, z: -7, ry: 0, body: 0xe8402a, roof: 0x2f7de1 },
      { x: 9, z: -12, ry: Math.PI / 2, body: 0xffc42e, roof: 0x35b56a },
      { x: -16, z: 4, ry: -Math.PI / 2, body: 0x35a7ff, roof: 0xff7f50 },
      { x: 14, z: 3, ry: Math.PI, body: 0x35b56a, roof: 0xffd23f }
    ];
    for (const h of houses) this.buildHouse(h);

    const arch = new THREE.Group();
    const AZ = -3.5;
    const azOff = new THREE.Vector3(0, 0, AZ);
    for (const sx of [-2.5, 2.5]) {
      arch.add(merged([addBox([], 0.7, 3.4, 0.7, sx, 1.7, 0)], this.mat(0xf1f3f5)));
      this.addSolid(new THREE.Box3(
        new THREE.Vector3(sx - 0.35, 0, -0.35), new THREE.Vector3(sx + 0.35, 3.4, 0.35)
      ).translate(azOff), null, true);
    }
    arch.add(merged([addBox([], 5.7, 0.8, 0.7, 0, 3.8, 0)], this.mat(0xffd23f)));
    arch.position.set(0, 0, AZ);
    this.scene.add(arch);
    this.staticMeshes.push(arch);

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
    wellGroup.position.set(6, 0, 2);
    this.scene.add(wellGroup);
    this.addSolid(new THREE.Box3(new THREE.Vector3(4.9, 0, 0.9), new THREE.Vector3(7.1, 0.9, 3.1)), null, true);
  }

  buildHouse(h) {
    const bw = 5, bd = 4, bh = 3;
    const grp = new THREE.Group();
    grp.add(merged([addBox([], bw, bh, bd, 0, bh / 2, 0)], this.mat(h.body)));

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
    this.scene.add(grp);
    this.staticMeshes.push(grp);

    const axisAligned = Math.abs(h.ry % Math.PI) < 0.01 || Math.abs(Math.abs(h.ry % Math.PI) - Math.PI) < 0.01;
    const w = axisAligned ? bw : bd;
    const d = axisAligned ? bd : bw;
    this.addSolid(new THREE.Box3(
      new THREE.Vector3(h.x - w / 2 - 0.1, 0, h.z - d / 2 - 0.1),
      new THREE.Vector3(h.x + w / 2 + 0.1, bh, h.z + d / 2 + 0.1)
    ), null, true);
  }

  buildBridge() {
    const g = new THREE.Group();
    this.bridge = g;
    this.bridgePieces = [];

    const deckW = 3, deckT = 0.5, deckL = 1.06;
    const zA = 9.1, zB = 18.9, lift = 1.7, yA = 1.35;
    const N = 26;
    const isBroken = (i) => i >= 8 && i <= 17;

    for (const z of [8.5, 19.5]) {
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
      this.staticMeshes.push(deck);
    }
    this.scene.add(g);

    const post = part(CY, 0, 0.9, 0);
    post.scale.set(0.12, 1.8, 0.12);
    const sign = new THREE.Group();
    sign.add(merged([post], this.mat(0x8b5a2b)));
    const board = new THREE.Mesh(BR, this.mat(0xffe08a));
    board.scale.set(2.4, 0.9, 0.14);
    board.position.set(0.1, 1.8, 0);
    board.castShadow = true;
    sign.add(board);
    sign.position.set(-3.6, 0, 8);
    sign.rotation.y = 0.4;
    this.scene.add(sign);
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
    portal.position.set(0.5, 0, 24.5);
    portal.visible = false;
    this.portal = portal;
    this.portalParts = { ring, disc, halo };
    this.scene.add(portal);
    this.portalLight = new THREE.PointLight(0xffd166, 0, 24, 2);
    this.portalLight.position.set(0.5, 3, 24.5);
    this.scene.add(this.portalLight);
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
      if (s.noSupport || b.max.y > maxY + 1e-4 || b.max.y > 40) continue;
      // (noSupport entries are skipped so props never act as build supports)
      if (b.max.x > x0 && b.min.x < x1 && b.max.z > z0 && b.min.z < z1 && b.max.y > top) top = b.max.y;
    }
    return top;
  }

  update(t, dt) {
    if (this.water) this.water.position.y = Math.sin(t * 1.4) * 0.03;
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
    this.yaw = 0;
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
    box(mkMat(0xffffff), 0.34, 0.1, 0.48, 0, 0.6, 0.02);
    box(skin, 0.62, 0.6, 0.56, 0, 1.0, 0);
    for (const sx of [-0.15, 0.15]) {
      box(mkMat(0x22252b), 0.09, 0.11, 0.05, sx, 1.06, 0.29);
      box(hair, 0.13, 0.045, 0.05, sx, 1.17, 0.29);
    }
    box(mkMat(0xc0392b), 0.22, 0.045, 0.05, 0, 0.88, 0.29);
    box(mkMat(0x2f7de1), 0.66, 0.14, 0.6, 0, 1.34, 0);
    box(mkMat(0x2f7de1), 0.5, 0.07, 0.26, 0, 1.31, 0.4);
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
      box(mkMat(0x22252b), 0.3, 0.14, 0.42, 0, -0.76, 0.06, leg);
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
    this.pos.x = clamp(this.pos.x, -HALF + 0.5, HALF - 0.5);
    this.pos.z = clamp(this.pos.z, -HALF + 0.5, HALF - 0.5);

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
      const want = Math.atan2(this.vel.x, this.vel.z);
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
    this.scene.fog = new THREE.Fog(0xbfe4ff, 70, 170);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.orbit = { yaw: Math.PI, pitch: 0.42, dist: 11, wantDist: 11 };

    this.scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x5f8f3f, 1.0));
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
    this.world.build();
    this.player = new Player(this.world);
    this.scene.add(this.player.root);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.collected = 0;
    this.repaired = false;
    this.started = false;
    this.slot = 0;
    this.removeMode = false;
    this.pick = new THREE.Raycaster();
    this.confetti = null;
    this.jumpQueued = 0;
    this.rescueT = 0;
    this.ghost = this.makeGhost();

    this.bindDom();
    this.selectSlot(0);
    this.spawnCollectibles();
    this.bindInput();
    this.resize();
    this.updateHud();

    this.tick = this.tick.bind(this);
    this.renderer.setAnimationLoop(this.tick);
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
    const studsGeo = mergeGeometries([-0.22, 0.22].map((sx) => {
      const m = new THREE.Mesh(CY);
      m.scale.set(0.11, 0.09, 0.11);
      m.position.set(sx, 0.25, 0);
      m.updateMatrix();
      return m.geometry.clone().applyMatrix4(m.matrix);
    }), false);
    const gA = BR.clone().scale(0.55, 0.55, 0.55);
    const gB = BR.clone().scale(1.05, 0.42, 0.55);

    const spots = [
      [0, -6], [2.5, -9], [-2.5, -9], [6, -4], [-6, -4], [-11, -2], [9, -6.5],
      [14, 6.5], [-16, 9], [-4.5, 5.5], [4.5, 5.5], [0, -18], [-8, -16], [8, -16],
      [12, -20], [-13, -19], [18, 6], [-18, -3], [-19, -13], [20, -18], [-21, 15],
      [21, 12], [-23, 8], [23, -8], [-9, 23], [9, 23], [0, 22.5], [20, 22], [24, 20],
      [-4, 21], [6, 22], [-24, 0]
    ];
    this.collectibles = [];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const onHill = this.world.hillCenters.some((h) => Math.hypot(x - h[0], z - h[1]) < 2);
      const y = onHill ? 4.75 : 0.75;
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
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 18),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.3;
      grp.add(ring);
      grp.position.set(x, y, z);
      grp.userData.phase = i * 0.6;
      grp.userData.baseY = y;
      this.scene.add(grp);
      this.collectibles.push(grp);
    }
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

    this.elCount = document.getElementById('hud-count');
    this.elNeed = document.getElementById('hud-need');
    this.elNeed.className = 'row need';
    this.toastEl = document.getElementById('toast');
    this.intro = document.getElementById('intro');
    document.getElementById('btn-play').addEventListener('click', () => this.start());
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
    this.intro.classList.add('hidden');
    this.toast(`Grab loose bricks — the bridge needs ${GOAL}`, 'good');
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
  }

  bindInput() {
    this.keys = new Set();
    const map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); this.jumpQueued = 0.16; return; }
      if (map[e.code]) { this.keys.add(map[e.code]); e.preventDefault(); return; }
      if (e.code === 'KeyX') this.selectSlot(BRICKS.length);
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= BRICKS.length) this.selectSlot(n - 1);
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
    hud.append(this.joy, this.jumpBtn);
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
  }

  touchUi(e) {
    for (const el of [this.joy, this.jumpBtn]) {
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
        gy = brick ? brick.box.max.y : (hit.object === this.world.water ? WATER_TOP : 0);
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

    if (gy > 14 || Math.abs(gx) > HALF || Math.abs(gz) > HALF) {
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
    const ndc = this.ndc(e.clientX, e.clientY);
    this.pick.setFromCamera(ndc, this.camera);
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
    const t = this.computePlacement(ndc);
    if (!t) return;
    if (!t.valid) { this.toast(`Can't place there — ${t.reason}`, 'bad'); return; }
    const rec = this.world.placeBrick(t.gx, t.gy, t.gz, t.def);
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
      pos[i * 3 + 2] = 24.5 + (Math.random() * 2 - 1) * 3;
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
    const o = this.orbit;
    o.dist += (o.wantDist - o.dist) * Math.min(1, dt * 6);
    const p = this.player.pos;
    const target = new THREE.Vector3(p.x, p.y + 1.5, p.z);
    const dir = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch));
    const want = target.clone().addScaledVector(dir, o.dist);
    const groundY = this.world.surfaceTop(Math.floor(want.x + 0.5), Math.floor(want.z + 0.5), 60);
    want.y = Math.max(want.y, Math.max(groundY, p.y) + 0.9);
    want.x = clamp(want.x, -HALF - 8, HALF + 8);
    want.z = clamp(want.z, -HALF - 8, HALF + 8);
    this.camera.position.lerp(want, Math.min(1, dt * 9));
    this.camera.lookAt(target);

    this.sun.position.set(p.x + 26, 40, p.z + 18);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  updateGhost() {
    if (this.removeMode || !this.started || this.pointers.size >= 2) { this.ghost.visible = false; return; }
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

  riverRescue(dt) {
    if (this.player.inRiverTrench()) {
      this.rescueT += dt;
      if (this.rescueT > 1.2) {
        const p = this.player;
        p.pos.z = p.pos.z < 14 ? RIVER.z0 - 1.2 : RIVER.z1 + 1.2;
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

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('error', (e) => {
  const t = document.getElementById('toast');
  if (t) { t.textContent = 'Error: ' + e.message; t.className = 'show bad'; }
});

const game = new Game();
window.GAME = game;
