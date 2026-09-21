/* Interiors for every enterable building type. One shared wall/floor/door
   shell, then a unique furnished scene per type:
   - home:   kitchen, bathroom, living room w/ TV, bedroom — per-instance
             colour + furniture variance from the build site's seed
   - farm:   farmhouse kitchen + big table, workshop bench, produce crates
   - school: one standard classroom — whiteboard up front, podium, rows of
             pupil desks, ticking clock, reading corner
   - police: booking desk, barred holding cell, evidence wall, mug-shot chart
   - fire:   apparatus bay with a parked brick fire engine, kit lockers,
             sliding pole + mezzanine, alarm bell
   A scene is built lazily on first entry and kept in a cache; the game shows
   exactly one at a time near the origin. */
import * as THREE from 'three';
import { BR, CY, SP, CO, mkMat, merged, addBox, addCyl, part } from './brickkit.js';

/* Per-type room footprint (door always centered on the +z wall). */
export const INTERIOR_DEFS = {
  home: {
    x0: -5, x1: 5, z0: -4.5, z1: 4.5, h: 3.4,
    doorHalf: 0.62, doorZ: 1.0,
    spawn: { x: 0, y: 0.02, z: 2.9 },
    door: { x: 0, z: 4.4 }
  },
  farm: { x0: -5.5, x1: 5.5, z0: -4.5, z1: 4.5, h: 3.6, doorHalf: 0.72, doorZ: 1.05, spawn: { x: 0, y: 0.02, z: 2.9 }, door: { x: 0, z: 4.4 } },
  school: { x0: -7.5, x1: 7.5, z0: -5.5, z1: 5.5, h: 4.0, doorHalf: 0.75, doorZ: 1.05, spawn: { x: 0, y: 0.02, z: 3.9 }, door: { x: 0, z: 5.4 } },
  police: { x0: -6, x1: 6, z0: -5, z1: 5, h: 3.5, doorHalf: 0.68, doorZ: 1.0, spawn: { x: 0, y: 0.02, z: 3.4 }, door: { x: 0, z: 4.9 } },
  fire: { x0: -6, x1: 6, z0: -5.5, z1: 5.5, h: 4.2, doorHalf: 0.72, doorZ: 1.05, spawn: { x: 0, y: 0.02, z: 3.9 }, door: { x: 0, z: 5.4 } }
};

const C = {
  floor: 0xd9b98a, wall: 0xf6efe3,
  trim: 0xffffff, ceiling: 0xfbf6ec,
  cabCream: 0xf4e9d2, counter: 0xb9c2cc, fridge: 0xf1f3f5,
  porcelain: 0xffffff, chrome: 0xc8ced6, wood: 0x9a5b3f, woodLight: 0xc08a52,
  lamp: 0xffe08a
};

function mulberry(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ shell */
function buildShell(D, pal, group) {
  const solids = [];
  const solid = (x0, y0, z0, x1, y1, z1) => solids.push(
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  const W = D.x1 - D.x0, DP = D.z1 - D.z0;
  const mat = (c) => mkMat(c);

  const floor = [];
  const fx = Math.round(W), fz = Math.round(DP);
  for (let i = 0; i < fx; i++)
    for (let j = 0; j < fz; j++)
      addBox(floor, 1, 0.1, 1, D.x0 + i + 0.5, 0.05, D.z0 + j + 0.5);
  group.add(merged(floor, mkMat(pal.floor)));
  // Slab + collider deliberately overrun the room footprint (incl. 1.0 past
  // the front-door gap): no walkable tile inside a building may lack floor.
  solid(D.x0 - 0.3, -1, D.z0 - 0.3, D.x1 + 0.3, 0.1, D.z1 + 1.0);

  const ceil = [];
  addBox(ceil, W, 0.16, DP, 0, D.h + 0.08, 0);
  group.add(merged(ceil, mkMat(C.ceiling)));

  const t = 0.25;
  const wallPieces = [];
  const wallSolid = (x0, x1, z0, z1) => solid(x0, 0, z0, x1, D.h, z1);

  addBox(wallPieces, W + t, D.h, t, 0, D.h / 2, D.z0 - t / 2);
  wallSolid(D.x0 - t, D.x1 + t, D.z0 - t, D.z0);
  addBox(wallPieces, t, D.h, DP, D.x0 - t / 2, D.h / 2, 0);
  addBox(wallPieces, t, D.h, DP, D.x1 + t / 2, D.h / 2, 0);
  wallSolid(D.x0 - t, D.x0, D.z0, D.z1);
  wallSolid(D.x1, D.x1 + t, D.z0, D.z1);
  const dl = D.x0, dr = -D.doorHalf, fr = D.doorHalf, ff = D.x1;
  addBox(wallPieces, dr - dl + t, D.h, t, (dl + dr) / 2 - t / 2 + t, D.h / 2, D.z1 + t / 2);
  addBox(wallPieces, ff - fr + t, D.h, t, (fr + ff) / 2, D.h / 2, D.z1 + t / 2);
  wallSolid(dl - t, dr, D.z1, D.z1 + t);
  wallSolid(fr, ff + t, D.z1, D.z1 + t);
  addBox(wallPieces, D.doorHalf * 2, D.h - 2.15, t, 0, 2.15 + (D.h - 2.15) / 2, D.z1 + t / 2);
  solid(-D.doorHalf, 2.15, D.z1, D.doorHalf, D.h, D.z1 + t);
  group.add(merged(wallPieces, mkMat(pal.wall)));

  const skirt = [];
  addBox(skirt, W + 0.5, 0.16, 0.06, 0, 0.08, D.z0 + 0.03);
  addBox(skirt, 0.06, 0.16, DP, D.x0 + 0.03, 0.08, 0);
  addBox(skirt, 0.06, 0.16, DP, D.x1 - 0.03, 0.08, 0);
  group.add(merged(skirt, mkMat(C.trim)));

  const frame = [];
  for (const sx of [-1, 1]) addBox(frame, 0.18, 2.2, 0.34, sx * (D.doorHalf + 0.09), 1.1, D.z1 + 0.02);
  addBox(frame, D.doorHalf * 2 + 0.36, 0.18, 0.34, 0, 2.29, D.z1 + 0.02);
  group.add(merged(frame, mkMat(C.wood)));

  const padMat = mkMat(0x43d46c, { emissive: 0x2f9e4f, emissiveIntensity: 0.7 });
  const pad = new THREE.Mesh(BR.clone().scale(1.1, 0.06, 0.8), padMat);
  pad.position.set(0, 0.13, D.door.z - 0.55);
  group.add(pad);

  const lampMat = mkMat(C.lamp, { emissive: 0xffdf7a, emissiveIntensity: 0.85 });
  const lampPos = [[-2.5, 2.4], [2.5, 2.4], [-2.5, -2.2], [2.5, -2.2]];
  if (W > 11) lampPos.push([0, 0], [-5.5, 0], [5.5, 0], [0, 3.4]);
  for (const [lx, lz] of lampPos) {
    const lamp = new THREE.Mesh(CY.clone().scale(0.34, 0.12, 0.34), lampMat);
    lamp.position.set(lx, D.h - 0.02, lz);
    group.add(lamp);
  }
  const glow = new THREE.PointLight(0xfff1cf, 24, 14, 2);
  glow.position.set(0, D.h - 0.4, 0);
  group.add(glow);
  const glow2 = new THREE.PointLight(0xdff1ff, 12, 10, 2);
  glow2.position.set(-2.5, D.h - 0.4, -2.2);
  group.add(glow2);

  const tickPad = (tt) => { pad.material.emissiveIntensity = 0.5 + Math.sin(tt * 3.2) * 0.25; };
  return { solids, solid, mat, tickPad };
}

/* ------------------------------------------------- shared home furniture */
function furnishKitchen(group, solid, mat, fx) {
  const run = [];
  addBox(run, 3.4, 0.9, 0.7, 0, 0.45, 0);
  addBox(run, 3.5, 0.1, 0.78, 0, 0.95, 0);
  addBox(run, 0.9, 0.5, 0.06, -0.6, 0.45, 0.37);
  addBox(run, 0.66, 0.04, 0.5, 0.7, 0.98, 0);
  for (const bx of [0.55, 0.85]) for (const bz of [-0.1, 0.1])
    addCyl(run, 0.09, 0.03, bx, 1.01, bz);
  const runM = merged(run, mat(C.cabCream));
  runM.position.set(fx, 0, -4.05);
  group.add(runM);
  solid(fx - 1.8, 0, -4.4, fx + 1.8, 1.0, -3.65);

  const sink = [];
  addBox(sink, 0.8, 0.12, 0.55, 0, 0.92, 0);
  addBox(sink, 0.6, 0.18, 0.4, 0, 0.86, 0);
  const sinkM = merged(sink, mat(C.counter));
  sinkM.position.set(fx - 0.45, 0, -4.05);
  group.add(sinkM);

  const tap = [];
  addCyl(tap, 0.035, 0.4, 0, 1.2, 0);
  const spout = part(CY, 0.12, 1.38, 0);
  spout.rotation.z = Math.PI / 2;
  spout.scale.set(0.03, 0.26, 0.03);
  tap.push(spout);
  const tapMesh = merged(tap, mat(C.chrome));
  tapMesh.position.set(fx - 0.45, 0, -4.28);
  group.add(tapMesh);

  const sinkDrops = [];
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(SP.clone(), mkMat(0x67c9f5, { transparent: true, opacity: 0.9 }));
    d.scale.setScalar(0.045);
    d.position.set(fx - 0.35 + (Math.random() - 0.5) * 0.22, 0.98 + Math.random() * 0.35, -4.12 + (Math.random() - 0.5) * 0.22);
    d.userData.v = 0;
    group.add(d);
    sinkDrops.push(d);
  }

  const fridge = [];
  addBox(fridge, 0.95, 2.0, 0.8, 0, 1.0, 0);
  addBox(fridge, 0.05, 0.55, 0.05, 0.38, 1.45, 0.42);
  addBox(fridge, 0.05, 0.55, 0.05, 0.38, 0.75, 0.42);
  const frM = merged(fridge, mat(C.fridge));
  frM.position.set(fx + 1.95, 0, -4.0);
  group.add(frM);
  solid(fx + 1.45, 0, -4.4, fx + 2.45, 2.0, -3.6);

  const tick = (t, dt) => {
    for (const d of sinkDrops) {
      d.userData.v += 9 * dt;
      d.position.y -= d.userData.v * dt;
      if (d.position.y < 0.93) {
        d.userData.v = 0;
        d.position.y = 1.32 + Math.random() * 0.06;
        d.position.x = fx - 0.35 + (Math.random() - 0.5) * 0.2;
        d.position.z = -4.1 + (Math.random() - 0.5) * 0.15;
      }
    }
  };
  return tick;
}

function furnishBedroom(group, solid, mat, bed, quilt, bedX, bedZ) {
  const bedP = [];
  addBox(bedP, 1.35, 0.42, 2.1, 0, 0.21, 0);
  addBox(bedP, 1.45, 0.65, 0.16, 0, 0.5, -1.05);
  const bedMesh = merged(bedP, mat(C.porcelain));
  bedMesh.position.set(bedX, 0, bedZ);
  group.add(bedMesh);
  const sheet = merged([addBox([], 1.33, 0.16, 2.05, 0, 0.46, 0)], mat(bed));
  sheet.position.set(bedX, 0, bedZ);
  group.add(sheet);
  const quiltTop = merged([addBox([], 1.4, 0.06, 1.15, 0, 0.58, 0.42)], mat(quilt));
  quiltTop.position.set(bedX, 0, bedZ);
  group.add(quiltTop);
  const pillow = merged([addBox([], 0.8, 0.2, 0.45, 0, 0.6, -0.75)], mat(0xffffff));
  pillow.position.set(bedX, 0, bedZ);
  group.add(pillow);
  solid(bedX - 0.7, 0, bedZ - 1.05, bedX + 0.7, 0.42, bedZ + 1.05);
  solid(bedX - 0.7, 0, bedZ - 1.12, bedX + 0.7, 0.85, bedZ - 0.95);
}

function furnishBath(group, solid, mat, D) {
  const tiles = [];
  for (let iy = 0; iy < 3; iy++)
    addBox(tiles, 0.04, 0.95, 0.95, D.x1 - 0.13, 0.55 + iy, -3.3 + 0 + 0.4 + iy * 0);
  addBox(tiles, 0.95, 0.95, 0.04, 2.2, 2.45, D.z0 + 0.13);
  group.add(merged(tiles, mkMat(0x8fd0e8)));

  const tub = [];
  addBox(tub, 2.0, 0.62, 1.1, 0, 0.31, 0);
  addBox(tub, 1.7, 0.5, 0.9, 0, 0.66, 0);
  addBox(tub, 1.72, 0.06, 0.92, 0, 0.86, 0);
  const tubM = merged(tub.slice(0, 2), mkMat(C.porcelain));
  tubM.position.set(3.55, 0, -2.9);
  group.add(tubM);
  const tubWater = merged([tub[2]], mkMat(0x4fb6ee, { transparent: true, opacity: 0.8, roughness: 0.1 }));
  tubWater.position.set(3.55, 0, -2.9);
  group.add(tubWater);
  solid(2.5, 0, -3.5, 4.6, 0.9, -2.3);

  const shower = [];
  addCyl(shower, 0.035, 1.9, 0, 0.95, 0);
  addCyl(shower, 0.035, 0.5, 0.22, 1.82, 0, undefined);
  const head = part(CY, 0.42, 1.72, 0);
  head.scale.set(0.14, 0.05, 0.14);
  shower.push(head);
  const showerMesh = merged(shower, mat(C.chrome));
  showerMesh.position.set(2.42, 0, -2.9);
  group.add(showerMesh);

  const showerDrops = [];
  const dropMat = mkMat(0x9fe0ff, { transparent: true, opacity: 0.85 });
  for (let i = 0; i < 26; i++) {
    const d = new THREE.Mesh(SP.clone(), dropMat);
    d.scale.setScalar(0.035);
    d.userData.ang = Math.random() * Math.PI * 2;
    d.userData.rad = Math.random() * 0.12;
    d.userData.v = Math.random() * 1.4;
    group.add(d);
    showerDrops.push(d);
  }

  const vanity = [];
  addBox(vanity, 1.1, 0.8, 0.55, 0, 0.4, 0);
  addBox(vanity, 1.16, 0.1, 0.6, 0, 0.86, 0);
  const vanM = merged(vanity, mat(C.woodLight));
  vanM.position.set(4.6, 0, -1.2);
  group.add(vanM);
  solid(4.05, 0, -1.5, 5.0, 0.95, -0.9);
  const vanityTap = [];
  addCyl(vanityTap, 0.03, 0.26, 4.6, 1.05, -1.35);
  group.add(merged(vanityTap, mat(C.chrome)));
  const mirror = new THREE.Mesh(BR.clone().scale(0.9, 1.0, 0.04),
    mkMat(0xcfeaff, { roughness: 0.1, metalness: 0.6 }));
  mirror.position.set(4.68, 2.0, -1.2);
  group.add(mirror);
  solid(4.5, 1.5, -1.7, 4.9, 2.5, -0.7);

  const toilet = [];
  addBox(toilet, 0.45, 0.42, 0.6, 0, 0.21, 0);
  addBox(toilet, 0.45, 0.72, 0.2, 0, 0.36, -0.24);
  addBox(toilet, 0.4, 0.1, 0.5, 0, 0.46, 0.04);
  const wcM = merged(toilet, mkMat(C.porcelain));
  wcM.position.set(1.55, 0, -3.85);
  group.add(wcM);
  solid(1.25, 0, -4.2, 1.9, 0.8, -3.5);

  const tick = (t, dt) => {
    for (const d of showerDrops) {
      d.userData.v += 8 * dt;
      d.position.y -= d.userData.v * dt;
      if (d.position.y < 0.92) {
        d.userData.v = 0;
        const a = d.userData.ang, r = d.userData.rad;
        d.position.set(2.84 + Math.cos(a) * r, 1.66, -2.9 + Math.sin(a) * r);
      }
    }
    tubWater.position.y = 0.86 + Math.sin(t * 2.2) * 0.012;
  };
  return tick;
}

/* ------------------------------------------------------------- HOME type */
function sceneHome(group, D, ctx, seed) {
  const { solid, mat } = ctx;
  const rand = mulberry(seed);
  const SOFA = [0x2f7de1, 0x35b56a, 0xe8402a, 0x9b5de5, 0x16a3b8, 0xd81e5b];
  const RUG = [0xff8a3d, 0x35a7ff, 0xffd23f, 0x2aa876];
  const BED = [0xff5d8f, 0x9b5de5, 0x43d46c, 0x35a7ff];
  const QUILT = [0xffd23f, 0xf4e9d2, 0xff9ff3, 0x9fe0ff];
  const sofaCol = SOFA[Math.floor(rand() * SOFA.length)];
  const rugCol = RUG[Math.floor(rand() * RUG.length)];
  const bedCol = BED[Math.floor(rand() * BED.length)];
  const quiltCol = QUILT[Math.floor(rand() * QUILT.length)];
  const layout = Math.floor(rand() * 3); // 0 classic, 1 wide sofa, 2 study corner
  const tickKitchen = furnishKitchen(group, solid, mat, -2.95);
  const tickBath = furnishBath(group, solid, mat, D);
  furnishBedroom(group, solid, mat, bedCol, quiltCol, 3.7, 2.6);

  // living room: TV wall + sofa (-x/+z corner)
  const tvFrame = [];
  addBox(tvFrame, 2.6, 1.55, 0.1, -2.6, 1.85, D.z0 + 0.14);
  group.add(merged(tvFrame, mat(0x22252b)));
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 256; screenCanvas.height = 144;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const screen = new THREE.Mesh(BR.clone().scale(2.3, 1.28, 0.04), screenMat);
  screen.position.set(-2.6, 1.85, D.z0 + 0.21);
  group.add(screen);
  solid(-3.95, 1.0, D.z0, -1.25, 2.7, D.z0 + 0.25);

  const console_ = [];
  addBox(console_, 2.2, 0.55, 0.6, 0, 0.375, 0);
  addBox(console_, 0.4, 0.18, 0.3, 0.7, 0.74, 0);
  const consM = merged(console_, mat(C.woodLight));
  consM.position.set(-2.6, 0, D.z0 + 0.45);
  group.add(consM);
  solid(-3.7, 0, D.z0 + 0.15, -1.5, 0.65, D.z0 + 0.75);

  const sofaW = layout === 1 ? 2.8 : 2.4;
  const sofaBase = merged([addBox([], sofaW, 0.5, 1.0, 0, 0.3, 0)], mat(sofaCol));
  sofaBase.position.set(-2.6, 0, 2.0);
  const sofaBack = merged([addBox([], sofaW, 0.9, 0.3, 0, 0.75, -0.38)], mat(sofaCol));
  sofaBack.position.set(-2.6, 0, 2.0);
  const sofaArms = [];
  for (const sx of [-sofaW / 2 + 0.14, sofaW / 2 - 0.14]) addBox(sofaArms, 0.28, 0.75, 1.0, sx, 0.42, 0);
  const armsMesh = merged(sofaArms, mat(sofaCol));
  armsMesh.position.set(-2.6, 0, 2.0);
  group.add(sofaBase, sofaBack, armsMesh);
  solid(-2.6 - sofaW / 2 - 0.15, 0, 1.4, -2.6 + sofaW / 2 + 0.15, 0.95, 2.6);

  const rug = layout === 2
    ? new THREE.Mesh(BR.clone().scale(1.6, 0.055, 1.2), mat(rugCol))
    : new THREE.Mesh(CY.clone().scale(1.5, 0.055, 1.1), mat(rugCol));
  rug.position.set(-2.4, 0.13, 0.9);
  group.add(rug);

  // variant corner (+x/-z): dresser+bookshelf (0/1) or study desk (2)
  if (layout !== 2) {
    const dresser = [];
    addBox(dresser, 1.3, 0.85, 0.55, 0, 0.425, 0);
    for (const dy of [0.25, 0.55]) addBox(dresser, 1.1, 0.16, 0.05, 0, dy, 0.29);
    const drM = merged(dresser, mat(C.wood));
    drM.position.set(2.3, 0, D.z0 + 0.4);
    group.add(drM);
    solid(1.6, 0, D.z0 - 0.1, 3.0, 0.85, D.z0 + 0.68);
    const shelfParts = [];
    for (const sy of [1.2, 1.9]) addBox(shelfParts, 1.2, 0.08, 0.3, 0, sy, 0);
    const shelf = merged(shelfParts, mat(C.woodLight));
    shelf.position.set(3.6, 0, D.z0 + 0.28);
    group.add(shelf);
    const bookCols = [0xe8402a, 0x2f7de1, 0x35b56a, 0xff8a3d];
    for (const side of [0, 1]) {
      const parts = [];
      for (let i = 0; i < 4; i++) addBox(parts, 0.09, 0.3, 0.2, -0.45 + i * 0.12, 0, 0);
      const bm = merged(parts, mat(bookCols[(side * 2 + Math.floor(rand() * 2)) % bookCols.length]));
      bm.position.set(3.6, 1.28 + side * 0.7, D.z0 + 0.28);
      group.add(bm);
    }
  } else {
    const desk = [];
    addBox(desk, 1.6, 0.08, 0.8, 0, 0.74, 0);
    for (const sx of [-0.7, 0.7]) addBox(desk, 0.12, 0.74, 0.7, sx, 0.37, 0);
    addBox(desk, 0.5, 0.35, 0.06, -0.3, 0.94, -0.3);
    const dkM = merged(desk, mat(C.woodLight));
    dkM.position.set(2.6, 0, D.z0 + 0.55);
    group.add(dkM);
    solid(1.8, 0, D.z0 + 0.1, 3.4, 0.78, D.z0 + 1.0);
    const chair = merged([addBox([], 0.5, 0.08, 0.5, 0, 0.5, 0), addBox([], 0.5, 0.55, 0.08, 0, 0.78, 0.22)], mat(sofaCol));
    chair.position.set(2.6, 0, D.z0 + 1.35);
    group.add(chair);
  }

  // wall art on the south wall (deterministic per variant seed)
  const artCols = [0xff4d6d, 0xffd23f, 0x35a7ff, 0x43d46c, 0x9b5de5];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(BR.clone().scale(0.55, 0.75, 0.05),
      mkMat(artCols[Math.floor(rand() * artCols.length)]));
    a.position.set(1.4 + i * 1.15, 2.3 + rand() * 0.4, D.z1 - 0.08);
    group.add(a);
  }

  const bedRug = new THREE.Mesh(BR.clone().scale(1.6, 0.05, 1.0), mat(0x9fe0ff));
  bedRug.position.set(2.9, 0.13, 2.4);
  group.add(bedRug);

  const painter = makeTvPainter(screenCanvas);
  let tvClock = 0;
  const tick = (t, dt) => {
    tickKitchen(t, dt);
    tickBath(t, dt);
    tvClock += dt;
    if (tvClock > 0.1) {
      tvClock = 0;
      painter.tick(t);
      screenTex.needsUpdate = true;
    }
  };
  return { tick, tv: painter, screenMesh: screen };
}

/* ------------------------------------------------------------- FARM type */
function sceneFarm(group, D, ctx) {
  const { solid, mat } = ctx;
  const woodDark = 0x8b5a2b, plank = 0xc99a5e;
  const tickKitchen = furnishKitchen(group, solid, mat, -3.4);

  // wide plank runner down the middle (farmhouse style)
  const strip = [];
  addBox(strip, D.x1 - D.x0 - 0.8, 0.06, 1.6, 0, 0.115, 0);
  group.add(merged(strip, mat(plank)));

  // big dining table + benches
  const table = [];
  addBox(table, 2.4, 0.12, 1.2, 0, 0.78, 0);
  for (const sx of [-1, 1]) for (const sz of [-0.45, 0.45])
    addBox(table, 0.14, 0.78, 0.14, sx * 1.0, 0.39, sz);
  const tbM = merged(table, mat(woodDark));
  tbM.position.set(0, 0, 1.2);
  group.add(tbM);
  solid(-1.3, 0, 0.55, 1.3, 0.84, 1.85);
  for (const sz of [0.28, 2.12]) {
    const bench = merged([addBox([], 2.2, 0.1, 0.4, 0, 0.48, 0), addBox([], 0.12, 0.48, 0.36, -0.9, 0.24, 0), addBox([], 0.12, 0.48, 0.36, 0.9, 0.24, 0)], mat(plank));
    bench.position.set(0, 0, sz);
    group.add(bench);
    solid(-1.15, 0, sz - 0.22, 1.15, 0.55, sz + 0.22);
  }

  // workshop corner (+x/-z): bench, vice, tool wall
  const benchP = [];
  addBox(benchP, 3.0, 0.1, 0.8, 0, 0.86, 0);
  for (const sx of [-1.3, 1.3]) addBox(benchP, 0.16, 0.86, 0.7, sx, 0.43, 0);
  addBox(benchP, 0.1, 0.5, 0.5, -1.0, 1.16, 0);
  const bnM = merged(benchP, mat(woodDark));
  bnM.position.set(3.3, 0, -3.9);
  group.add(bnM);
  solid(1.75, 0, -4.35, 4.85, 0.95, -3.45);
  const toolWall = [];
  for (const tx of [2.4, 2.9, 3.4]) addBox(toolWall, 0.08, 0.6, 0.06, tx, 1.7, -4.32);
  addBox(toolWall, 1.6, 0.12, 0.12, 2.9, 2.08, -4.32);
  group.add(merged(toolWall, mat(0xb9c2cc)));

  // produce crates + veg (-x/+z)
  const crateCols = [0x74c745, 0xff8a3d, 0xffd23f];
  for (let i = 0; i < 3; i++) {
    const cx = -4.3 + (i % 2) * 0.85, cz = 1.6 + Math.floor(i / 2) * 0.9;
    const cr = [];
    addBox(cr, 0.7, 0.5, 0.7, 0, 0.25, 0);
    const crM = merged(cr, mat(woodDark));
    crM.position.set(cx, 0, cz);
    group.add(crM);
    const veg = new THREE.Mesh(SP.clone(), mkMat(crateCols[i]));
    veg.scale.setScalar(0.14);
    veg.position.set(cx, 0.62, cz);
    group.add(veg);
    solid(cx - 0.4, 0, cz - 0.4, cx + 0.4, 0.55, cz + 0.4);
  }

  // spartan bed (+x/+z)
  furnishBedroom(group, solid, mat, 0x8b5a2b, 0xd9b98a, 4.2, 3.0);
  const rug = merged([addBox([], 1.8, 0.05, 1.2, 0, 0, 0)], mkMat(0xb0413e));
  rug.position.set(0, 0.13, -1.6);
  group.add(rug);

  return { tick: (t, dt) => tickKitchen(t, dt), tv: null, screenMesh: null };
}

/* ----------------------------------------------------------- SCHOOL type */
function sceneSchool(group, D, ctx) {
  const { solid, mat } = ctx;
  const wallGreen = 0x9ecfa8, deskWood = 0xc99a5e;

  // classroom tile overlay (kept inside the wall faces)
  const tiles = [];
  for (let x = Math.ceil(D.x0); x <= D.x1 - 2; x += 2)
    for (let z = Math.ceil(D.z0); z <= D.z1 - 2; z += 2)
      addBox(tiles, 1.9, 0.05, 1.9, x + 0.5, 0.125, z + 0.5);
  group.add(merged(tiles, mkMat(0xe8e2d2)));

  // wainscot band
  const wain = [];
  addBox(wain, D.x1 - D.x0, 0.7, 0.06, 0, 0.35, D.z0 + 0.03);
  addBox(wain, 0.06, 0.7, D.z1 - D.z0, D.x0 + 0.03, 0.35, 0);
  addBox(wain, 0.06, 0.7, D.z1 - D.z0, D.x1 - 0.03, 0.35, 0);
  group.add(merged(wain, mkMat(wallGreen)));

  // ---- front wall (-z): whiteboard + marker tray + pens ----
  const boardFrame = merged([addBox([], 5.6, 2.0, 0.1, 0, 2.0, 0)], mat(0x3b3f46));
  boardFrame.position.set(0, 0, D.z0 + 0.14);
  group.add(boardFrame);
  const board = merged([addBox([], 5.1, 1.6, 0.08, 0, 2.0, 0)], mkMat(0xf7fbff, { roughness: 0.25 }));
  board.position.set(0, 0, D.z0 + 0.2);
  group.add(board);
  const scribble = [];
  for (let i = 0; i < 5; i++) addBox(scribble, 2.4 - i * 0.3, 0.07, 0.03, -1.1 + i * 0.12, 2.42 - i * 0.28, 0);
  const scrM = merged(scribble, mkMat(0x2f7de1, { roughness: 0.4 }));
  scrM.position.set(0, 0, D.z0 + 0.25);
  group.add(scrM);
  const tray = merged([addBox([], 1.6, 0.08, 0.16, 0, 0, 0)], mat(0xb9c2cc));
  tray.position.set(0, 1.02, D.z0 + 0.3);
  group.add(tray);
  for (const [cx, cc] of [[-0.4, 0xdc1414], [0, 0x22252b], [0.4, 0x2f7de1]]) {
    const pen = new THREE.Mesh(CY.clone().scale(0.03, 0.16, 0.03), mkMat(cc));
    pen.position.set(cx, 1.12, D.z0 + 0.3);
    pen.rotation.z = 0.3;
    group.add(pen);
  }
  // wall clock with sweeping hands
  const clockFace = new THREE.Mesh(CY.clone().scale(0.34, 0.34, 0.08), mkMat(0xffffff));
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.set(3.6, 2.9, D.z0 + 0.18);
  group.add(clockFace);
  const handMin = merged([addBox([], 0.03, 0.26, 0.03, 0, 0.13, 0)], mat(0x22252b));
  handMin.position.set(3.6, 2.9, D.z0 + 0.24);
  const handHour = merged([addBox([], 0.04, 0.18, 0.03, 0, 0.09, 0)], mat(0xdc1414));
  handHour.position.set(3.6, 2.9, D.z0 + 0.25);
  group.add(handMin, handHour);

  // ---- teacher podium + globe up front ----
  const podium = [];
  addBox(podium, 1.1, 0.95, 0.7, 0, 0.475, 0);
  addBox(podium, 1.2, 0.1, 0.8, 0, 1.0, 0);
  const pdM = merged(podium, mat(0x8b5a2b));
  pdM.position.set(-4.6, 0, D.z0 + 1.2);
  group.add(pdM);
  solid(-5.2, 0, D.z0 + 0.8, -4.0, 1.05, D.z0 + 1.6);
  const globe = new THREE.Mesh(SP.clone(), mkMat(0x35a7ff));
  globe.scale.setScalar(0.18);
  globe.position.set(-4.6, 1.2, D.z0 + 1.2);
  group.add(globe);
  solid(-4.85, 1.05, D.z0 + 0.95, -4.35, 1.42, D.z0 + 1.45);

  // ---- pupil desks: 3 rows x 3 columns, each with a chair ----
  const deskCols = [0xc99a5e, 0xd9b98a, 0xb98a55];
  const chairCols = [0x2f7de1, 0xe8402a, 0x35b56a];
  const deskXs = [-3.4, 0, 3.4], rowZs = [-1.6, 0.6, 2.8];
  for (let r = 0; r < rowZs.length; r++) {
    for (let c = 0; c < deskXs.length; c++) {
      const dx = deskXs[c], dz = rowZs[r];
      const dk = [];
      addBox(dk, 1.5, 0.08, 0.9, 0, 0.72, 0);
      for (const sx of [-0.62, 0.62]) addBox(dk, 0.1, 0.72, 0.8, sx, 0.36, 0);
      addBox(dk, 1.3, 0.22, 0.06, 0, 0.86, -0.42);
      const dkM = merged(dk, mkMat(deskCols[(r + c) % 3]));
      dkM.position.set(dx, 0, dz);
      group.add(dkM);
      solid(dx - 0.8, 0, dz - 0.5, dx + 0.8, 0.78, dz + 0.5);
      const ch = merged([
        addBox([], 0.5, 0.08, 0.5, 0, 0.46, 0),
        addBox([], 0.5, 0.5, 0.08, 0, 0.73, 0.22),
        addBox([], 0.08, 0.46, 0.44, -0.2, 0.23, 0),
        addBox([], 0.08, 0.46, 0.44, 0.2, 0.23, 0)
      ], mkMat(chairCols[(r * 3 + c) % 3]));
      ch.position.set(dx, 0, dz + 0.72);
      group.add(ch);
      if ((r + c) % 2 === 0) {
        const book = merged([addBox([], 0.4, 0.05, 0.3, -0.1, 0, 0), addBox([], 0.4, 0.05, 0.3, 0.1, 0.02, 0)], mkMat(0xf7f3e8));
        book.position.set(dx, 0.78, dz);
        group.add(book);
      }
    }
  }

  // ---- reading corner (+x/+z): rug + low bookshelf ----
  const rRug = new THREE.Mesh(CY.clone().scale(1.6, 0.06, 1.1), mkMat(0x9b5de5));
  rRug.position.set(5.2, 0.13, 3.8);
  group.add(rRug);
  const shelf = [];
  addBox(shelf, 2.2, 0.7, 0.5, 0, 0.35, 0);
  const shM = merged(shelf, mat(0xc08a52));
  shM.position.set(6.3, 0, 2.4);
  group.add(shM);
  solid(5.2, 0, 2.1, 7.4, 0.7, 2.7);
  const bcols = [0xe8402a, 0x2f7de1, 0x35b56a, 0xffd23f, 0x9b5de5];
  for (let i = 0; i < 5; i++) {
    const b = merged([addBox([], 0.12, 0.4, 0.3, 0, 0, 0)], mkMat(bcols[i]));
    b.position.set(5.6 + i * 0.3, 0.9, 2.4);
    group.add(b);
  }

  // posters east wall + ABC strip west wall + world map by the door
  const posterCols = [0xffd23f, 0x35a7ff, 0x43d46c, 0xff5d8f];
  for (let i = 0; i < 4; i++) {
    const po = merged([addBox([], 0.9, 1.1, 0.05, 0, 0, 0)], mkMat(posterCols[i]));
    po.position.set(D.x1 - 0.12, 2.0, -3.6 + i * 2.1);
    po.rotation.y = -Math.PI / 2;
    group.add(po);
  }
  const abc = [];
  for (let i = 0; i < 8; i++) addBox(abc, 0.34, 0.44, 0.05, 0, 0, -2.6 + i * 0.62);
  const abcM = merged(abc, mkMat(0xf7fbff));
  abcM.position.set(D.x0 + 0.12, 2.6, 0);
  group.add(abcM);
  const map = merged([addBox([], 2.2, 1.3, 0.05, 0, 0, 0)], mkMat(0xbfe4f2));
  map.position.set(-4.6, 2.2, D.z1 - 0.06);
  group.add(map);

  // classroom flag corner
  const pole = merged([addCyl([], 0.05, 2.6, 0, 1.3, 0)], mat(0xf1f3f5));
  pole.position.set(-6.6, 0, D.z0 + 0.9);
  group.add(pole);
  const flg = new THREE.Mesh(BR.clone().scale(0.9, 0.55, 0.05), mkMat(0xe8402a));
  flg.position.set(-6.15, 2.35, D.z0 + 0.9);
  group.add(flg);

  const tick = (t) => {
    handMin.rotation.z = -(t % 60) / 60 * Math.PI * 2;
    handHour.rotation.z = -(t % 720) / 720 * Math.PI * 2;
  };
  return { tick, tv: null, screenMesh: null };
}

/* ----------------------------------------------------------- POLICE type */
function scenePolice(group, D, ctx) {
  const { solid, mat } = ctx;
  const navy = 0x1d3557, steel = 0x9aa5b1, goldBadge = 0xffd23f;

  const tiles = [];
  for (let x = Math.ceil(D.x0); x <= D.x1 - 2; x += 2)
    for (let z = Math.ceil(D.z0); z <= D.z1 - 2; z += 2)
      addBox(tiles, 1.9, 0.05, 1.9, x + 0.5, 0.125, z + 0.5);
  group.add(merged(tiles, mkMat(0xdfe6ec)));

  // ---- booking desk front-left + desk lamp + radio ----
  const desk = [];
  addBox(desk, 2.6, 1.05, 0.9, 0, 0.525, 0);
  addBox(desk, 2.8, 0.12, 1.05, 0, 1.11, 0);
  addBox(desk, 0.35, 0.4, 0.06, 0.9, 1.32, -0.2);
  const dkM = merged(desk, mat(navy));
  dkM.position.set(-3.4, 0, D.z0 + 1.5);
  group.add(dkM);
  solid(-4.85, 0, D.z0 + 1.0, -1.95, 1.17, D.z0 + 2.0);
  const lampD = merged([addCyl([], 0.04, 0.5, 0, 1.35, 0), addBox([], 0.24, 0.16, 0.2, 0, 1.62, 0)], mkMat(goldBadge, { emissive: 0xffdf7a, emissiveIntensity: 0.6 }));
  lampD.position.set(-2.7, 0, D.z0 + 1.4);
  group.add(lampD);
  const radio = merged([addBox([], 0.3, 0.18, 0.2, 0, 0, 0), addCyl([], 0.02, 0.3, 0.1, 0.22, 0)], mat(0x22252b));
  radio.position.set(-4.0, 1.26, D.z0 + 1.4);
  group.add(radio);

  // ---- holding cell across the back-right: partition, bars, bunk ----
  const cellX0 = 0.6, cellX1 = D.x1 - 0.3, cellZ0 = D.z0 + 0.3, cellZ1 = D.z0 + 3.0;
  const padC = [];
  addBox(padC, cellX1 - cellX0, 0.08, cellZ1 - cellZ0, (cellX0 + cellX1) / 2, 0.15, (cellZ0 + cellZ1) / 2);
  group.add(merged(padC, mat(0xb9bfc6)));
  const partW = [];
  addBox(partW, 0.18, D.h, cellZ1 - cellZ0, cellX0, D.h / 2, (cellZ0 + cellZ1) / 2);
  group.add(merged(partW, mat(steel)));
  solid(cellX0 - 0.1, 0, cellZ0, cellX0 + 0.1, D.h, cellZ1);
  const bars = [];
  for (let bx = cellX0 + 0.45; bx < cellX1; bx += 0.55)
    addCyl(bars, 0.05, D.h - 0.2, bx, D.h / 2, cellZ1);
  addBox(bars, cellX1 - cellX0, 0.16, 0.16, (cellX0 + cellX1) / 2, D.h - 0.2, cellZ1);
  addBox(bars, cellX1 - cellX0, 0.16, 0.16, (cellX0 + cellX1) / 2, 0.2, cellZ1);
  group.add(merged(bars, mkMat(0x6e7781, { metalness: 0.7, roughness: 0.3 })));
  solid(cellX0 + 0.15, 0, cellZ1 - 0.12, cellX1, D.h - 0.35, cellZ1 + 0.12);
  const bunk = [];
  addBox(bunk, 2.0, 0.14, 0.8, 0, 0.55, 0);
  addBox(bunk, 2.0, 0.14, 0.8, 0, 1.45, 0);
  for (const sx of [-0.9, 0.9]) addBox(bunk, 0.12, 1.6, 0.12, sx, 0.8, -0.34);
  const bkM = merged(bunk, mat(0x8892a0));
  bkM.position.set(cellX0 + 1.5, 0, cellZ0 + 0.65);
  group.add(bkM);
  solid(cellX0 + 0.5, 0, cellZ0 + 0.25, cellX0 + 2.5, 1.55, cellZ0 + 1.05);
  const cellToilet = merged([addBox([], 0.4, 0.4, 0.55, 0, 0.2, 0)], mat(C.porcelain));
  cellToilet.position.set(cellX1 - 0.55, 0, cellZ0 + 0.5);
  group.add(cellToilet);
  solid(cellX1 - 0.8, 0, cellZ0 + 0.2, cellX1 - 0.3, 0.45, cellZ0 + 0.8);
  // mug-shot height chart on the lobby side of the partition
  const chart = [];
  for (let i = 0; i < 6; i++) addBox(chart, 0.5, 0.06, 0.04, 0, 0.8 + i * 0.3, 0);
  const chM = merged(chart, mat(0xf7fbff));
  chM.position.set(cellX0 - 0.12, 0, cellZ0 + 1.7);
  chM.rotation.y = Math.PI / 2;
  group.add(chM);

  // ---- lobby divider near the entrance ----
  const lobby = [];
  addBox(lobby, 3.4, 1.0, 0.3, 0, 0.5, 0);
  addBox(lobby, 3.6, 0.14, 0.5, 0, 1.05, 0);
  const lbM = merged(lobby, mat(navy));
  lbM.position.set(0, 0, D.z1 - 2.6);
  group.add(lbM);
  solid(-1.9, 0, D.z1 - 2.8, 1.9, 1.12, D.z1 - 2.35);

  // ---- evidence shelf + wanted posters (+x/+z corner) ----
  const evShelf = [];
  addBox(evShelf, 2.6, 0.1, 0.5, 0, 0, 0);
  addBox(evShelf, 2.6, 0.1, 0.5, 0, 0.9, 0);
  for (const sx of [-1.2, 1.2]) addBox(evShelf, 0.12, 1.0, 0.5, sx, 0.45, 0);
  const evM = merged(evShelf, mat(0xc08a52));
  evM.position.set(D.x1 - 1.6, 1.2, D.z1 - 1.2);
  group.add(evM);
  solid(3.25, 1.1, D.z1 - 1.5, 5.75, 2.3, D.z1 - 0.9);
  const jarCols = [0x43d46c, 0x35a7ff, 0xff8a3d, 0xffd23f];
  for (let i = 0; i < 4; i++) {
    const jr = new THREE.Mesh(CY.clone().scale(0.12, 0.22, 0.12), mkMat(jarCols[i], { transparent: true, opacity: 0.85 }));
    jr.position.set(D.x1 - 2.6 + i * 0.62, 1.52, D.z1 - 1.2);
    group.add(jr);
  }
  for (let i = 0; i < 2; i++) {
    const wp = merged([addBox([], 1.0, 1.25, 0.05, 0, 0, 0)], mkMat(0xf4e9d2));
    wp.position.set(D.x1 - 0.1, 2.2, D.z1 - 3.4 - i * 1.5);
    wp.rotation.y = -Math.PI / 2;
    group.add(wp);
    const hat = merged([addBox([], 0.4, 0.28, 0.4, 0, 0, 0)], mkMat(0x22252b));
    hat.position.set(D.x1 - 0.16, 2.55, D.z1 - 3.4 - i * 1.5);
    group.add(hat);
  }

  // ---- badge emblem on the front wall + blinker beacon ----
  const badge = new THREE.Mesh(CY.clone().scale(0.5, 0.5, 0.06), mkMat(goldBadge, { metalness: 0.6, roughness: 0.3 }));
  badge.rotation.x = Math.PI / 2;
  badge.position.set(-4.0, 2.4, D.z0 + 0.18);
  group.add(badge);
  const star = new THREE.Mesh(CY.clone().scale(0.22, 0.22, 0.08), mkMat(navy));
  star.rotation.x = Math.PI / 2;
  star.position.set(-4.0, 2.4, D.z0 + 0.21);
  group.add(star);

  const beaconR = mkMat(0xff2d2d, { emissive: 0xff2d2d, emissiveIntensity: 1 });
  const beaconB = mkMat(0x2f7de1, { emissive: 0x2f7de1, emissiveIntensity: 1 });
  const bR = new THREE.Mesh(SP.clone(), beaconR); bR.scale.setScalar(0.14); bR.position.set(-5.4, D.h - 0.3, D.z0 + 0.6);
  const bB = new THREE.Mesh(SP.clone(), beaconB); bB.scale.setScalar(0.14); bB.position.set(-5.0, D.h - 0.3, D.z0 + 0.6);
  group.add(bR, bB);

  let beaconT = 0;
  const tick = (t, dt) => {
    beaconT += dt;
    const blink = Math.sin(beaconT * 6) > 0;
    beaconR.emissiveIntensity = blink ? 1.4 : 0.15;
    beaconB.emissiveIntensity = blink ? 0.15 : 1.4;
  };
  return { tick, tv: null, screenMesh: null };
}

/* ------------------------------------------------------------- FIRE type */
function sceneFire(group, D, ctx) {
  const { solid, mat } = ctx;
  const fireRed = 0xd62828, cream = 0xf4e9d2;

  const floorPad = [];
  addBox(floorPad, D.x1 - D.x0 - 0.6, 0.06, D.z1 - D.z0 - 0.6, 0, 0.125, 0);
  group.add(merged(floorPad, mat(0xc3c9cf)));

  // ---- apparatus bay: brick fire engine parked nose-in on the left ----
  const eng = new THREE.Group();
  eng.add(merged([addBox([], 2.2, 1.5, 4.2, 0, 0.95, 0)], mat(fireRed)));
  eng.add(merged([addBox([], 2.2, 1.0, 1.2, 0, 2.1, -1.5)], mat(fireRed)));
  eng.add(merged([addBox([], 1.9, 0.6, 0.1, 0, 2.1, -2.12)], mkMat(0x9fd4ff, { roughness: 0.2, metalness: 0.3 })));
  eng.add(merged([addBox([], 2.26, 0.3, 4.24, 0, 1.25, 0)], mat(cream)));
  eng.add(merged([
    addBox([], 0.1, 0.08, 3.4, -0.5, 1.78, 0.3), addBox([], 0.1, 0.08, 3.4, 0.5, 1.78, 0.3),
    addBox([], 1.1, 0.06, 0.08, 0, 1.78, -0.9), addBox([], 1.1, 0.06, 0.08, 0, 1.78, -0.3),
    addBox([], 1.1, 0.06, 0.08, 0, 1.78, 0.3), addBox([], 1.1, 0.06, 0.08, 0, 1.78, 0.9)
  ], mat(0xc0c8cf)));
  for (const wz of [-1.3, 1.3]) {
    const wheel = new THREE.Mesh(CY.clone().scale(0.42, 0.24, 0.42), mkMat(0x1a1c20));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(-1.1, 0.42, wz);
    eng.add(wheel);
    const wheel2 = wheel.clone(); wheel2.position.x = 1.1;
    eng.add(wheel2);
  }
  const epR = mkMat(0xff2d2d, { emissive: 0xff2d2d, emissiveIntensity: 1 });
  const epB = mkMat(0x2f7de1, { emissive: 0x2f7de1, emissiveIntensity: 1 });
  const engLightR = new THREE.Mesh(SP.clone(), epR); engLightR.scale.setScalar(0.16); engLightR.position.set(-0.55, 2.68, -1.5);
  const engLightB = new THREE.Mesh(SP.clone(), epB); engLightB.scale.setScalar(0.16); engLightB.position.set(0.55, 2.68, -1.5);
  eng.add(engLightR, engLightB);
  eng.position.set(-3.2, 0, -1.4);
  group.add(eng);
  solid(-4.4, 0, -3.6, -2.0, 2.75, 0.8);

  // appliance bay door frame on the +z wall behind the engine
  const bayFrame = [];
  addBox(bayFrame, 3.4, 0.3, 0.2, 0, 3.2, 0);
  for (const sx of [-1.7, 1.7]) addBox(bayFrame, 0.3, 3.4, 0.2, sx, 1.6, 0);
  const bfM = merged(bayFrame, mat(fireRed));
  bfM.position.set(-3.2, 0, D.z1 - 0.12);
  group.add(bfM);

  // ---- kit lockers + helmets along the north wall ----
  const lockers = [];
  for (let i = 0; i < 4; i++) addBox(lockers, 0.9, 2.0, 0.5, i * 1.0, 1.0, 0);
  const lkM = merged(lockers, mat(fireRed));
  lkM.position.set(D.x1 - 2.4, 0, D.z0 + 0.6);
  group.add(lkM);
  solid(D.x1 - 2.95, 0, D.z0 + 0.3, D.x1 - 0.05, 2.0, D.z0 + 0.9);
  const helmCols = [fireRed, 0xffd23f, cream, 0x22252b];
  for (let i = 0; i < 4; i++) {
    const hm = new THREE.Mesh(SP.clone().scale(0.24, 0.14, 0.26), mkMat(helmCols[i]));
    hm.position.set(D.x1 - 2.4 + i, 1.7, D.z0 + 0.35);
    group.add(hm);
  }

  // ---- sliding pole + mezzanine loft (+x/+z) ----
  const pole = merged([addCyl([], 0.09, D.h - 0.4, 0, (D.h - 0.4) / 2 + 0.1, 0)], mkMat(0xc8ced6, { metalness: 0.7, roughness: 0.25 }));
  pole.position.set(4.8, 0, 3.4);
  group.add(pole);
  solid(4.62, 0, 3.22, 4.98, D.h, 3.58);
  const mez = merged([addBox([], 3.2, 0.14, 2.4, 0, 0, 0)], mat(0x8b5a2b));
  mez.position.set(4.2, D.h - 0.5, 4.0);
  group.add(mez);
  solid(2.6, D.h - 0.6, 2.85, 5.8, D.h, 5.1);   // climbable loft platform
  const mezRail = merged([addBox([], 3.2, 0.1, 0.1, 0, 0.55, 0)], mat(fireRed));
  mezRail.position.set(4.2, D.h - 0.5, 2.88);
  group.add(mezRail);

  // ---- alarm bell, hose reel, crew table with mugs ----
  const bell = new THREE.Mesh(CO, mat(0xffd23f, { emissive: 0xffdf7a, emissiveIntensity: 0.4 }));
  bell.scale.set(0.28, 0.4, 0.28);
  bell.position.set(0.5, 3.0, D.z0 + 0.3);
  group.add(bell);
  const reel = [];
  addBox(reel, 0.5, 1.2, 0.4, 0, 1.1, 0);
  addCyl(reel, 0.3, 0.4, 0, 1.1, 0.3);
  const rlM = merged(reel, mat(fireRed));
  rlM.position.set(D.x0 + 0.5, 0, D.z0 + 1.6);
  rlM.rotation.y = Math.PI / 2;
  group.add(rlM);
  solid(D.x0 + 0.15, 0, D.z0 + 1.35, D.x0 + 0.85, 1.75, D.z0 + 1.85);
  const table = merged([addBox([], 2.6, 0.1, 1.1, 0, 0.8, 0), addBox([], 0.14, 0.8, 0.9, -1.1, 0.4, 0), addBox([], 0.14, 0.8, 0.9, 1.1, 0.4, 0)], mat(cream));
  table.position.set(1.6, 0, 1.6);
  group.add(table);
  solid(0.3, 0, 1.05, 2.9, 0.85, 2.15);
  const mugCols = [0xdc1414, 0x2f7de1, 0x35b56a];
  for (let i = 0; i < 3; i++) {
    const mug = new THREE.Mesh(CY.clone().scale(0.08, 0.1, 0.08), mkMat(mugCols[i]));
    mug.position.set(1.0 + i * 0.55, 0.9, 1.6);
    group.add(mug);
  }

  let bellT = 0;
  const tick = (t, dt) => {
    bellT += dt;
    bell.rotation.y = Math.sin(bellT * 1.4) * 0.15;
    epR.emissiveIntensity = Math.sin(bellT * 5) > 0 ? 1.2 : 0.2;
    epB.emissiveIntensity = Math.sin(bellT * 5) > 0 ? 0.2 : 1.2;
  };
  return { tick, tv: null, screenMesh: null };
}

/* ------------------------------------------------------------ entrypoint */
const SCENES = { home: sceneHome, farm: sceneFarm, school: sceneSchool, police: scenePolice, fire: sceneFire };
const PALS = {
  home: { floor: 0xd9b98a, wall: 0xf6efe3 },
  farm: { floor: 0xb98a55, wall: 0xf1e3c8 },
  school: { floor: 0xd9cdb6, wall: 0xeef3ee },
  police: { floor: 0xc2ccd6, wall: 0xe7edf2 },
  fire: { floor: 0xb8bec4, wall: 0xf3e6e3 }
};

/* Build (or return cached) interior for a type+variant seed. Home variant
   colours/furniture depend on the seed; civic types ignore it. */
export function makeInterior(scene, type = 'home', seed = 0) {
  const kind = SCENES[type] ? type : 'home';
  const D = INTERIOR_DEFS[kind];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const shell = buildShell(D, PALS[kind] || PALS.home, group);
  const sceneApi = SCENES[kind](group, D, shell, seed | 0);
  const tickPad = shell.tickPad;
  return {
    type: kind,
    def: D,
    group,
    solids: shell.solids,
    screenMesh: sceneApi.screenMesh || null,
    tv: sceneApi.tv || null,
    tick(t, dt) { tickPad(t); if (sceneApi.tick) sceneApi.tick(t, dt); }
  };
}

// Animated channel-art for the wall TV.
export function makeTvPainter(canvas) {
  const ctx = canvas.getContext('2d');
  const CH = [
    (t) => { // brick rainbow
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      ['#ff4d6d', '#ff9f1c', '#ffd23f', '#43d46c', '#35a7ff', '#9b5de5'].forEach((c, i) =>
        g.addColorStop(i / 5, c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 8; i++) {
        const x = (i * 37 + t * 40) % (canvas.width + 20) - 10;
        ctx.fillRect(x, canvas.height - 18 - ((Math.sin(t * 2 + i) * 0.5 + 0.5) * 40), 14, 14);
      }
    },
    (t) => { // bouncing brick
      ctx.fillStyle = '#141a24'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const x = Math.abs(Math.sin(t * 1.3)) * (canvas.width - 30);
      const y = Math.abs(Math.sin(t * 2.7)) * (canvas.height - 24);
      ctx.fillStyle = '#e8402a'; ctx.fillRect(x + 8, y + 4, 22, 14);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x + 14, y + 4, 3, 0, 7); ctx.arc(x + 24, y + 4, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#43d46c'; ctx.fillRect(0, canvas.height - 8, canvas.width, 8);
    },
    (t) => { // weather: sun + clouds over hills
      ctx.fillStyle = '#7fc4f2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(210, 34 + Math.sin(t) * 4, 18, 0, 7); ctx.fill();
      ctx.fillStyle = '#43d46c';
      ctx.beginPath(); ctx.arc(60, canvas.height + 30, 90, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(180, canvas.height + 40, 100, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 3; i++) {
        const x = (i * 90 + t * 22) % (canvas.width + 60) - 30;
        ctx.fillRect(x, 24 + i * 20, 34, 10);
        ctx.fillRect(x + 8, 18 + i * 20, 20, 10);
      }
    }
  ];
  let ch = 0;
  return {
    tick(t) {
      CH[ch % CH.length](t);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`BRICK TV ${String((ch % CH.length) + 1).padStart(2, '0')}`, 6, 14);
    },
    nextChannel() { ch = (ch + 1) % CH.length; }
  };
}
