/* A standard two-storey brick-toy home: kitchen, bathroom (working water),
   living room with wall TV, bedroom. Built in local coords; the game keeps it
   hidden until the player enters through a front door. */
import * as THREE from 'three';
import { BR, CY, SP, mkMat, merged, addBox, addCyl, part } from './brickkit.js';

export const INTERIOR_DEF = {
  x0: -5, x1: 5, z0: -4.5, z1: 4.5, h: 3.4,
  doorHalf: 0.62, doorZ: 1.0,
  spawn: { x: 0, y: 0.02, z: 2.9 },
  door: { x: 0, z: 4.4 }
};

const C = {
  floor: 0xd9b98a, floorAlt: 0xc9a878, wall: 0xf6efe3, wallAlt: 0xefe2cf,
  trim: 0xffffff, ceiling: 0xfbf6ec,
  cabRed: 0xe8402a, cabCream: 0xf4e9d2, counter: 0xb9c2cc, fridge: 0xf1f3f5,
  tile: 0xbfe4f2, tileDeep: 0x8fd0e8, porcelain: 0xffffff,
  chrome: 0xc8ced6, wood: 0x9a5b3f, woodLight: 0xc08a52,
  sofa: 0x2f7de1, rug: 0xff8a3d, tv: 0x22252b, bed: 0xff5d8f, quilt: 0xffd23f,
  lamp: 0xffe08a, book: 0x35b56a
};

export function buildInterior(scene) {
  const solids = [];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const D = INTERIOR_DEF;
  const W = D.x1 - D.x0, DP = D.z1 - D.z0;

  const solid = (x0, y0, z0, x1, y1, z1) => solids.push(
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));

  // floor
  const floor = [];
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 9; j++)
      addBox(floor, 1, 0.1, 1, D.x0 + i + 0.5, 0.05, D.z0 + j + 0.5);
  group.add(merged(floor, mkMat(C.floor)));
  solid(D.x0, -1, D.z0, D.x1, 0.1, D.z1);

  // ceilings (noRay=false so interior click-place raycasts to walls/floor only)
  const ceil = [];
  addBox(ceil, W, 0.16, DP, 0, D.h + 0.08, 0);
  group.add(merged(ceil, mkMat(C.ceiling)));

  // walls: front (+z) carries the door opening
  const wallMat = mkMat(C.wall);
  const t = 0.25;
  const wallPieces = [];
  const wallSolid = (x0, x1, z0, z1) => solid(x0, 0, z0, x1, D.h, z1);

  // north wall (-z)
  addBox(wallPieces, W + t, D.h, t, 0, D.h / 2, D.z0 - t / 2);
  wallSolid(D.x0 - t, D.x1 + t, D.z0 - t, D.z0);
  // west + east walls
  addBox(wallPieces, t, D.h, DP, D.x0 - t / 2, D.h / 2, 0);
  addBox(wallPieces, t, D.h, DP, D.x1 + t / 2, D.h / 2, 0);
  wallSolid(D.x0 - t, D.x0, D.z0, D.z1);
  wallSolid(D.x1, D.x1 + t, D.z0, D.z1);
  // front wall left / right of the door
  const dl = D.x0, dr = -D.doorHalf, fr = D.doorHalf, ff = D.x1;
  addBox(wallPieces, dr - dl + t, D.h, t, (dl + dr) / 2 - t / 2 + t, D.h / 2, D.z1 + t / 2);
  addBox(wallPieces, ff - fr + t, D.h, t, (fr + ff) / 2, D.h / 2, D.z1 + t / 2);
  wallSolid(dl - t, dr, D.z1, D.z1 + t);
  wallSolid(fr, ff + t, D.z1, D.z1 + t);
  // header above the door
  addBox(wallPieces, D.doorHalf * 2, D.h - 2.15, t, 0, 2.15 + (D.h - 2.15) / 2, D.z1 + t / 2);
  solid(-D.doorHalf, 2.15, D.z1, D.doorHalf, D.h, D.z1 + t);
  group.add(merged(wallPieces, wallMat));

  // skirting
  const skirt = [];
  addBox(skirt, W + 0.5, 0.16, 0.06, 0, 0.08, D.z0 + 0.03);
  addBox(skirt, 0.06, 0.16, DP, D.x0 + 0.03, 0.08, 0);
  addBox(skirt, 0.06, 0.16, DP, D.x1 - 0.03, 0.08, 0);
  group.add(merged(skirt, mkMat(C.trim)));

  // door frame + interior door pad + exit glow pad
  const frame = [];
  for (const sx of [-1, 1]) addBox(frame, 0.18, 2.2, 0.34, sx * (D.doorHalf + 0.09), 1.1, D.z1 + 0.02);
  addBox(frame, D.doorHalf * 2 + 0.36, 0.18, 0.34, 0, 2.29, D.z1 + 0.02);
  group.add(merged(frame, mkMat(C.wood)));

  const padMat = mkMat(0x43d46c, { emissive: 0x2f9e4f, emissiveIntensity: 0.7 });
  const pad = new THREE.Mesh(BR.clone().scale(1.1, 0.06, 0.8), padMat);
  pad.position.set(0, 0.13, D.door.z - 0.55);
  group.add(pad);

  // ceiling lamps (visual + light)
  const lampMat = mkMat(C.lamp, { emissive: 0xffdf7a, emissiveIntensity: 0.85 });
  for (const [lx, lz] of [[-2.5, 2.4], [2.5, 2.4], [-2.5, -2.2], [2.5, -2.2]]) {
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

  const mat = (c) => mkMat(c);

  // ---- living room: corner at -x/+z ----
  const tvFrame = [];
  addBox(tvFrame, 2.6, 1.55, 0.1, -2.6, 1.85, D.z0 + 0.14);
  group.add(merged(tvFrame, mat(C.tv)));
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
  addBox(console_, 2.2, 0.55, 0.6, -2.6, 0.375, D.z0 + 0.45);
  addBox(console_, 0.4, 0.18, 0.3, -1.9, 0.74, D.z0 + 0.45);
  group.add(merged(console_, mat(C.woodLight)));
  solid(-3.7, 0, D.z0 + 0.15, -1.5, 0.65, D.z0 + 0.75);

  const sofa = [];
  addBox(sofa, 2.4, 0.5, 1.0, 0, 0.3, 0);          // base (local, then moved)
  const sofaMesh = merged(sofa, mat(C.sofa));
  sofaMesh.position.set(-2.6, 0, 2.0);
  const sofaBack = merged([addBox([], 2.4, 0.9, 0.3, 0, 0.75, -0.38)], mat(C.sofa));
  sofaBack.position.set(-2.6, 0, 2.0);
  const sofaArms = [];
  for (const sx of [-1.15, 1.15]) addBox(sofaArms, 0.28, 0.75, 1.0, sx, 0.42, 0);
  const armsMesh = merged(sofaArms, mat(C.sofa));
  armsMesh.position.set(-2.6, 0, 2.0);
  group.add(sofaMesh, sofaBack, armsMesh);
  solid(-3.85, 0, 1.4, -1.35, 0.95, 2.6);

  const rug = new THREE.Mesh(CY.clone().scale(1.5, 0.055, 1.1), mat(C.rug));
  rug.position.set(-2.4, 0.13, 0.9);
  rug.receiveShadow = true;
  group.add(rug);

  const lampStand = [];
  addCyl(lampStand, 0.16, 0.06, 0, 0.03, 0);
  addCyl(lampStand, 0.045, 1.3, 0, 0.68, 0);
  const lampMesh = merged(lampStand, mat(C.chrome));
  lampMesh.position.set(-4.3, 0, 3.5);
  group.add(lampMesh);
  const shade = new THREE.Mesh(CY.clone().scale(0.3, 0.32, 0.3), lampMat);
  shade.position.set(-4.3, 1.42, 3.5);
  group.add(shade);

  // ---- kitchen: corner at -x/-z ----
  const run = [];
  addBox(run, 3.4, 0.9, 0.7, 0, 0.45, 0);         // cabinets
  addBox(run, 3.5, 0.1, 0.78, 0, 0.95, 0);        // counter
  addBox(run, 0.9, 0.5, 0.06, -0.6, 0.45, 0.37);  // oven door
  addBox(run, 0.66, 0.04, 0.5, 0.7, 0.98, 0);     // hob plate
  for (const bx of [0.55, 0.85]) for (const bz of [-0.1, 0.1])
    addCyl(run, 0.09, 0.03, bx, 1.01, bz);
  group.add(merged(run, mat(C.cabCream)));
  const counterMesh = group.children[group.children.length - 1];
  counterMesh.position.set(-2.95, 0, -4.05);
  solid(-4.75, 0, -4.4, -1.15, 1.0, -3.65);

  const sink = [];
  addBox(sink, 0.8, 0.12, 0.55, 0, 0.92, 0);      // basin rim
  addBox(sink, 0.6, 0.18, 0.4, 0, 0.86, 0);
  group.add(merged(sink, mat(C.counter)));
  group.children[group.children.length - 1].position.set(-3.4, 0, -4.05);

  const tap = [];
  addCyl(tap, 0.035, 0.4, 0, 1.2, 0);
  const spout = part(CY, 0.12, 1.38, 0);
  spout.rotation.z = Math.PI / 2;
  spout.scale.set(0.03, 0.26, 0.03);
  tap.push(spout);
  const tapMesh = merged(tap, mat(C.chrome));
  tapMesh.position.set(-3.4, 0, -4.28);
  group.add(tapMesh);

  const sinkDrops = [];
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(SP.clone(), mkMat(0x67c9f5, { transparent: true, opacity: 0.9 }));
    d.scale.setScalar(0.045);
    d.position.set(-3.3 + (Math.random() - 0.5) * 0.22, 0.98 + Math.random() * 0.35, -4.12 + (Math.random() - 0.5) * 0.22);
    d.userData.v = 0;
    group.add(d);
    sinkDrops.push(d);
  }

  const fridge = [];
  addBox(fridge, 0.95, 2.0, 0.8, 0, 1.0, 0);
  addBox(fridge, 0.05, 0.55, 0.05, 0.38, 1.45, 0.42);
  addBox(fridge, 0.05, 0.55, 0.05, 0.38, 0.75, 0.42);
  group.add(merged(fridge, mat(C.fridge)));
  group.children[group.children.length - 1].position.set(-1.0, 0, -4.0);
  solid(-1.5, 0, -4.4, -0.5, 2.0, -3.6);

  const table = [];
  addBox(table, 1.4, 0.1, 0.9, 0, 0.82, 0);
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.32, 0.32])
    addBox(table, 0.1, 0.82, 0.1, sx, 0.41, sz);
  const tableMesh = merged(table, mat(C.woodLight));
  tableMesh.position.set(-2.6, 0, -2.2);
  group.add(tableMesh);
  solid(-3.3, 0, -2.65, -1.9, 0.9, -1.75);

  const chairs = [];
  for (const sx of [-1, 1]) {
    addBox(chairs, 0.42, 0.08, 0.42, sx * 1.05, 0.46, 0);
    addBox(chairs, 0.42, 0.55, 0.08, sx * 1.24, 0.73, 0);
    for (const lx of [-0.15, 0.15]) for (const lz of [-0.15, 0.15])
      addBox(chairs, 0.07, 0.46, 0.07, sx * 1.05 + lx, 0.23, lz);
  }
  const chairMesh = merged(chairs, mat(C.wood));
  chairMesh.position.set(-2.6, 0, -2.2);
  group.add(chairMesh);

  const bowl = new THREE.Mesh(CY.clone().scale(0.2, 0.07, 0.14), mat(0x35a7ff));
  bowl.position.set(-2.35, 0.92, -2.1);
  group.add(bowl);

  // ---- bathroom: corner at +x/-z ----
  const tile = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      addBox(tile, 0.95, 0.95, 0.04, 3.0 + i * 0.0 - 2.95 + 0.0, 0, 0); // placeholder, replaced below
  tile.length = 0;
  for (let ix = 0; ix < 3; ix++)
    for (let iy = 0; iy < 3; iy++)
      addBox(tile, 0.95, 0.95, 0.04, 1.6 + ix, 0.55 + iy, D.z0 + 0.13);
  group.add(merged(tile, mat(C.tile)));

  const wallTilesW = [];
  for (let iz = 0; iz < 3; iz++)
    for (let iy = 0; iy < 3; iy++)
      addBox(wallTilesW, 0.04, 0.95, 0.95, D.x0 + 0.13, 0.55 + iy, -1.4 + iz);
  group.add(merged(wallTilesW, mat(C.tileDeep)));

  // tub with running water + shower head
  const tub = [];
  addBox(tub, 2.0, 0.62, 1.1, 0, 0.31, 0);
  addBox(tub, 1.7, 0.5, 0.9, 0, 0.66, 0);         // hollow-ish rim look
  addBox(tub, 1.72, 0.06, 0.92, 0, 0.86, 0);      // water surface
  group.add(merged(tub.slice(0, 2), mkMat(C.porcelain)));
  group.children[group.children.length - 1].position.set(3.55, 0, -2.9);
  const tubWater = merged([tub[2]], mkMat(0x4fb6ee, { transparent: true, opacity: 0.8, roughness: 0.1 }));
  tubWater.position.set(3.55, 0, -2.9);
  tubWater.scale.set(1, 1, 1);
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

  // vanity + mirror
  const vanity = [];
  addBox(vanity, 1.1, 0.8, 0.55, 0, 0.4, 0);
  addBox(vanity, 1.16, 0.1, 0.6, 0, 0.86, 0);
  addBox(vanity, 0.5, 0.08, 0.34, 0, 0.9, 0.02);
  group.add(merged(vanity, mat(C.woodLight)));
  group.children[group.children.length - 1].position.set(4.6, 0, -1.2);
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
  group.add(merged(toilet, mkMat(C.porcelain)));
  group.children[group.children.length - 1].position.set(1.55, 0, -3.85);
  solid(1.25, 0, -4.2, 1.9, 0.8, -3.5);

  // ---- bedroom: corner at +x/+z ----
  const bed = [];
  addBox(bed, 1.35, 0.42, 2.1, 0, 0.21, 0);
  addBox(bed, 1.45, 0.65, 0.16, 0, 0.5, -1.05);   // headboard
  const bedMesh = merged(bed, mat(C.porcelain));
  bedMesh.position.set(3.7, 0, 2.6);
  group.add(bedMesh);
  const sheet = merged([addBox([], 1.33, 0.16, 2.05, 0, 0.46, 0)], mat(C.bed));
  sheet.position.set(3.7, 0, 2.6);
  group.add(sheet);
  const quiltTop = merged([addBox([], 1.4, 0.06, 1.15, 0, 0.58, 0.42)], mat(C.quilt));
  quiltTop.position.set(3.7, 0, 2.6);
  group.add(quiltTop);
  const pillow = merged([addBox([], 0.8, 0.2, 0.45, 0, 0.6, -0.75)], mat(0xffffff));
  pillow.position.set(3.7, 0, 2.6);
  group.add(pillow);
  solid(3.0, 0, 1.55, 4.4, 0.42, 3.65);   // bed base (step-up height)
  solid(3.0, 0, 1.5, 4.4, 0.85, 1.62);    // headboard

  const dresser = [];
  addBox(dresser, 1.3, 0.85, 0.55, 0, 0.425, 0);
  for (const dy of [0.25, 0.55]) addBox(dresser, 1.1, 0.16, 0.05, 0, dy, 0.29);
  group.add(merged(dresser, mat(C.wood)));
  group.children[group.children.length - 1].position.set(2.3, 0, D.z0 + 0.4);
  solid(1.6, 0, -4.4, 3.0, 0.85, -4.05);

  const shelfParts = [];
  for (const sy of [1.2, 1.9]) addBox(shelfParts, 1.2, 0.08, 0.3, 0, sy, 0);
  const shelf = merged(shelfParts, mat(C.woodLight));
  shelf.position.set(3.6, 0, D.z0 + 0.28);
  group.add(shelf);
  const bookCols = [0xe8402a, 0x2f7de1, 0x35b56a, 0xff8a3d];
  for (const side of [0, 1]) {
    const parts = [];
    for (let i = 0; i < 4; i++) addBox(parts, 0.09, 0.3, 0.2, -0.45 + i * 0.12, 0, 0);
    const bm = merged(parts, mat(bookCols[side * 2 % bookCols.length]));
    bm.position.set(3.6, 1.28 + side * 0.7, D.z0 + 0.28);
    group.add(bm);
  }

  // rug
  const bedRug = new THREE.Mesh(BR.clone().scale(1.6, 0.05, 1.0), mat(0x9fe0ff));
  bedRug.position.set(2.9, 0.13, 2.4);
  group.add(bedRug);

  const painter = makeTvPainter(screenCanvas);
  let tvClock = 0;

  function tickInterior(t, dt) {
    // kitchen tap: thin falling stream + splash
    for (const d of sinkDrops) {
      d.userData.v += 9 * dt;
      d.position.y -= d.userData.v * dt;
      if (d.position.y < 0.93) {
        d.userData.v = 0;
        d.position.y = 1.32 + Math.random() * 0.06;
        d.position.x = -3.3 + (Math.random() - 0.5) * 0.2;
        d.position.z = -4.1 + (Math.random() - 0.5) * 0.15;
      }
    }
    // shower: fan of drops
    for (const d of showerDrops) {
      d.userData.v += 8 * dt;
      d.position.y -= d.userData.v * dt;
      if (d.position.y < 0.92) {
        d.userData.v = 0;
        const a = d.userData.ang, r = d.userData.rad;
        d.position.set(2.84 + Math.cos(a) * r, 1.66, -2.9 + Math.sin(a) * r);
      }
    }
    // tub ripple
    tubWater.position.y = 0.86 + Math.sin(t * 2.2) * 0.012;
    // TV
    tvClock += dt;
    if (tvClock > 0.1) {
      tvClock = 0;
      painter.tick(t);
      screenTex.needsUpdate = true;
    }
    // exit pad pulse
    pad.material.emissiveIntensity = 0.5 + Math.sin(t * 3.2) * 0.25;
  }

  return {
    group,
    solids,
    tick: tickInterior,
    tv: painter,
    screenMesh: screen
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
