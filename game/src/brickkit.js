/* Shared brick helpers used by the overworld and house interiors. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BR = new THREE.BoxGeometry(1, 1, 1);
export const CY = new THREE.CylinderGeometry(1, 1, 1, 12);
export const SP = new THREE.SphereGeometry(1, 16, 10);
export const CO = new THREE.ConeGeometry(1, 1, 5);

export const RAINBOW = [0xff4d6d, 0xff9f1c, 0xffd23f, 0x43d46c, 0x35a7ff, 0x9b5de5];
export const GOAL = 24;

export function mkMat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.02 }, extra));
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function part(geo, x, y, z) {
  const m = new THREE.Mesh(geo, null);
  m.position.set(x, y, z);
  return m;
}

export function addBox(g, w, h, d, x, y, z) {
  const m = part(BR, x, y, z); m.scale.set(w, h, d); g.push(m); return m;
}

export function addCyl(g, r, h, x, y, z, rz) {
  const m = part(CY, x, y, z); m.scale.set(r, h, rz === undefined ? r : rz); g.push(m); return m;
}

export function bake(m) {
  m.updateMatrix();
  const g = m.geometry.clone().applyMatrix4(m.matrix);
  if (g.index) g.deleteAttribute('normal');
  return g;
}

export function merged(list, mat) {
  if (!list.length) return new THREE.Mesh(new THREE.BufferGeometry(), mat);
  const geo = mergeGeometries(list.map(bake), false);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---- brick census: how many 1x1x1 bricks an object is made of ---- */

export function colorOfMat(mat) {
  if (!mat) return 0x9aa4ae;
  const h = mat.color ? mat.color.getHex() : 0x9aa4ae;
  // tinted texture maps (plaque banners etc.) still report their brick color
  return h >>> 0;
}

export function partMeshes(obj) {
  const out = [];
  if (obj.isMesh || obj.isInstancedMesh) out.push(obj);
  else if (obj.traverse) obj.traverse((o) => { if (o.isMesh || o.isInstancedMesh) out.push(o); });
  return out;
}

/* World-space volume of a mesh in units³ (1.0 == one 1x1x1 brick). Instance
   matrices carry per-instance scale, and the mesh's own scale multiplies in.
   Local space is fine: props sit in the world root at scale 1. */
export function meshVolume(mesh) {
  const geo = mesh.geometry;
  if (geo && !geo.boundingBox) geo.computeBoundingBox();
  const bb = geo?.boundingBox;
  if (!bb) return 0;
  const geoVol = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z);
  const own = new THREE.Vector3();
  mesh.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), own);
  const ownScale = Math.max(own.x * own.y * own.z, 1e-9);
  if (mesh.isInstancedMesh) {
    const s = new THREE.Vector3();
    const im = new THREE.Matrix4();
    let sum = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, im);
      im.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      sum += Math.max(s.x * s.y * s.z, 1e-9);
    }
    return geoVol * sum * ownScale;
  }
  const sx = Math.abs(mesh.scale.x), sy = Math.abs(mesh.scale.y), sz = Math.abs(mesh.scale.z);
  return geoVol * sx * sy * sz;
}

/* Census a prop's meshes into { hex, volume } entries, one per material color,
   volume measured in world units³ (1.0 == one 1x1x1 brick). */
export function brickCensus(meshes) {
  const byColor = new Map();
  for (const mesh of meshes) {
    const leaves = [];
    if (mesh.isGroup) mesh.traverse((o) => { if (o.isMesh && o.visible) leaves.push(o); });
    else if (mesh.visible) leaves.push(mesh);
    for (const m of leaves) {
      const hex = colorOfMat(m.material);
      byColor.set(hex, (byColor.get(hex) || 0) + meshVolume(m));
    }
  }
  let total = 0;
  for (const v of byColor.values()) total += v;
  return { byColor, total };
}

/* One brick geometry per color with an integer stud count (0-4) so piles read
   as loose bricks instead of featureless cubes. */
function studCount(hex, k) {
  // cheap deterministic pick from the color bits + index
  const n = (hex * 2654435761 + k * 40503) >>> 0;
  return 1 + (n % 4);
}

const studGeoCache = new Map();
function brickGeometry(color, studs) {
  const key = `${color}|${studs}`;
  let g = studGeoCache.get(key);
  if (g) return g;
  const parts = [addBox([], 1, 1, 1, 0, 0.5, 0)];
  for (let i = 0; i < studs; i++) {
    const sx = studs === 1 ? 0 : (i % 2 ? 0.24 : -0.24);
    const sz = studs <= 2 ? 0 : (i < 2 ? -0.22 : 0.22);
    parts.push(addCyl([], 0.17, 0.14, sx, 1.07, sz));
  }
  g = mergeGeometries(parts.map(bake), false);
  g.computeVertexNormals();
  g.userData.shared = true;
  studGeoCache.set(key, g);
  return g;
}

/* Rubble pile of exactly `count` bricks whose colors match `census` (one entry
   per material color). Counts per color are proportional to that color's brick
   volume; when the pile has to be quantized below the exact count, the largest
   color groups are decimated first so the mix stays true. Brick size is chosen
   so the bricks together hold `census.total` units³ — the same amount of brick
   material the object was built from — and capped at 1.0 so the pile can never
   balloon past the structure's own volume. */
function colorCounts(census, count) {
  const entries = [...census.byColor.entries()]
    .filter(([, vol]) => vol > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = census.total || 1;
  const out = new Map();
  if (!entries.length) return out;
  const exact = entries.map(([hex, vol]) => ({ hex, exact: (vol / total) * count }));
  let floorSum = 0;
  for (const e of exact) {
    const n = Math.floor(e.exact);
    out.set(e.hex, n);
    floorSum += n;
  }
  // hand out the remaining slots to the largest fractional parts
  const rem = exact.slice().sort((a, b) => (b.exact % 1) - (a.exact % 1));
  for (let i = 0; i < count - floorSum; i++) out.set(rem[i % rem.length].hex, out.get(rem[i % rem.length].hex) + 1);
  // every color that had any brick keeps at least one
  for (const [hex] of entries) {
    if (out.get(hex) > 0) continue;
    const donor = [...out.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0];
    if (donor) { out.set(donor[0], donor[1] - 1); out.set(hex, 1); }
  }
  return out;
}

export const BRICK_PILE_CAP = 256;

/* Loose rubble is always real 1x1x1 brick geometry, unscaled — degrading a big
   object must never spawn giant bricks. Count is capped, so rubble reads as a
   debris field of ordinary bricks. Bricks settle onto a brick-sized lattice and
   fill the emptiest spot first, so the pile spreads outward flat instead of
   growing a tower; stacks are hard-capped at STACK_CAP courses. */
export function brickPile(count, census, rnd, opt = {}) {
  const group = new THREE.Group();
  const wants = count ?? Math.round(census.total);
  const n = Math.max(1, Math.min(wants, BRICK_PILE_CAP));
  const spread = opt.spread ?? clamp(Math.cbrt(Math.max(census.total, 1)) * 1.6, 2.2, 14);
  const baseY = opt.baseY ?? 0;
  const cx = opt.cx ?? 0, cz = opt.cz ?? 0;
  const counts = colorCounts(census, n);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  // round-robin the palette so the pile mixes colors like a real debris field
  const left = [...counts.entries()].filter(([, c]) => c > 0);
  const order = [];
  while (left.length) {
    for (let j = left.length - 1; j >= 0; j--) {
      order.push(left[j][0]);
      if (--left[j][1] <= 0) left.splice(j, 1);
    }
  }
  const cell = 1.35;          // lattice pitch: one brick per cell, loose fit
  const STACK_CAP = 2;        // never more than 2 courses anywhere
  const stack = new Map();    // lattice cell -> settled course count
  const byHex = new Map();    // hex -> Matrix4 list
  const freeCell = () => {
    // sample emptiest-first; a cell is only accepted while it still has a
    // free course, so two bricks can NEVER settle at the same position
    // (the old Math.min(stack, CAP) clamp double-stacked bricks on top of
    // each other and the colors z-fought/flickered)
    let bx = 0, bz = 0, bScore = Infinity;
    for (let t = 0; t < 12; t++) {
      const a = rnd() * Math.PI * 2;
      const rr = spread * Math.sqrt(rnd());
      const gx = Math.round(Math.cos(a) * rr / cell);
      const gz = Math.round(Math.sin(a) * rr / cell);
      if ((stack.get(`${gx}|${gz}`) || 0) >= STACK_CAP) continue;
      let load = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) load += stack.get(`${gx + dx}|${gz + dz}`) || 0;
      }
      if (load >= STACK_CAP * 9) continue;   // neighborhood saturated
      const score = load * 10 + Math.hypot(gx, gz);
      if (score < bScore) { bScore = score; bx = gx; bz = gz; }
      if (load === 0) break;
    }
    if ((stack.get(`${bx}|${bz}`) || 0) < STACK_CAP && bScore < Infinity) return [bx, bz];
    // fallback: walk out in an expanding spiral until a free course is found
    for (let ring = 0; ring < 400; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if ((stack.get(`${dx}|${dz}`) || 0) < STACK_CAP) return [dx, dz];
        }
      }
    }
    return [0, 0];
  };
  for (let i = 0; i < order.length; i++) {
    const [bx, bz] = freeCell();
    const gy = stack.get(`${bx}|${bz}`) || 0;   // always < STACK_CAP here
    stack.set(`${bx}|${bz}`, gy + 1);
    pos.set(
      cx + bx * cell + (rnd() - 0.5) * 0.25,
      baseY + gy + 0.5,
      cz + bz * cell + (rnd() - 0.5) * 0.25
    );
    eul.set(0, (Math.floor(rnd() * 4) * Math.PI) / 2 + (rnd() - 0.5) * 0.14, 0);
    q.setFromEuler(eul);
    mtx.compose(pos, q, one);   // scale 1: rubble == the same 1x1x1 bricks
    const hex = order[i];
    if (!byHex.has(hex)) byHex.set(hex, []);
    byHex.get(hex).push(mtx.clone());
  }
  let k = 0;
  for (const [hex, list] of byHex) {
    const geo = brickGeometry(hex, studCount(hex, k++));
    const inst = new THREE.InstancedMesh(geo, mkMat(hex, { roughness: 0.62 }), list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    list.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  group.userData.count = n;
  group.userData.brickSize = 1;
  group.userData.volume = census.total;
  group.userData.dispose = () => group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  return group;
}

