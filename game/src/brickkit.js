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
