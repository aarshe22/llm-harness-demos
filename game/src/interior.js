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
   - church: nave of pews facing a raised chancel: lectern with an open book,
             LEGO pastor behind it, LEGO Jesus on a big cross on the wall
             behind, candles, font, bell, stained-glass windows
   - store:  convenience store — two grocery rows, cash-register counter,
             slushie machine at the back (tap flavours, press the button to
             pour from the spigot), fridge, chips, snacks, magazines, bins
   A scene is built lazily on first entry and kept in a cache; the game shows
   exactly one at a time near the origin. */
import * as THREE from 'three';
import { BR, CY, SP, CO, mkMat, merged, addBox, addCyl, part } from './brickkit.js';
import { sfx } from './sfx.js';

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
  fire: { x0: -6, x1: 6, z0: -5.5, z1: 5.5, h: 4.2, doorHalf: 0.72, doorZ: 1.05, spawn: { x: 0, y: 0.02, z: 3.9 }, door: { x: 0, z: 5.4 } },
  church: { x0: -6.5, x1: 6.5, z0: -8, z1: 6, h: 5.2, doorHalf: 0.8, doorZ: 1.1, spawn: { x: 0, y: 0.02, z: 4.4 }, door: { x: 0, z: 5.9 } },
  store: { x0: -5.5, x1: 5.5, z0: -7, z1: 5, h: 3.6, doorHalf: 0.9, doorZ: 1.05, spawn: { x: 0, y: 0.02, z: 3.4 }, door: { x: 0, z: 4.9 } }
};

const C = {
  floor: 0xd9b98a, wall: 0xf6efe3,
  trim: 0xffffff, ceiling: 0xfbf6ec,
  cabCream: 0xf4e9d2, counter: 0xb9c2cc, fridge: 0xf1f3f5,
  porcelain: 0xffffff, chrome: 0xc8ced6, wood: 0x9a5b3f, woodLight: 0xc08a52,
  lamp: 0xffe08a
};

/* Every house body colour gets its own interior theme: wall/floor/trim
   colours, an accent palette for soft furnishings, a themed furniture block
   (fired in sceneHome), and an extra themed room corner (fired in
   sceneHomeExtra). Homes whose colour is not in this table fall back to the
   first entry. */
export const HOME_THEMES = {
  0xe8402a: { floor: 0xe9c48f, wall: 0xf3e0cc, trim: 0xffffff, ceiling: 0xf8ecdc, accent: 0xe8402a,
    extras: 'attic', blurb: 'red house · attic loft with a treasure trunk' },
  0xffc42e: { floor: 0xf0dcb4, wall: 0xfbf1da, trim: 0xf7e6b0, ceiling: 0xfdf7e8, accent: 0xffc42e,
    extras: 'greenhouse', blurb: 'yellow house · sunroom greenhouse of brick plants' },
  0x35a7ff: { floor: 0xd8e2ec, wall: 0xe6f1fb, trim: 0xcfe3f5, ceiling: 0xf1f8ff, accent: 0x35a7ff,
    extras: 'bunks', blurb: 'blue house · bunk-bed kids room with a toy chest' },
  0x35b56a: { floor: 0xdcdba6, wall: 0xe7f3df, trim: 0xc9e2c0, ceiling: 0xf3faf0, accent: 0x35b56a,
    extras: 'green', blurb: 'green house · indoor herb garden and reading nook' },
  0xff8a3d: { floor: 0xf0cba8, wall: 0xfce6d4, trim: 0xf2c9a0, ceiling: 0xfef1e6, accent: 0xff8a3d,
    extras: 'fireplace', blurb: 'orange house · snug with a roaring brick fireplace' },
  0x9b5de5: { floor: 0xd9cfe8, wall: 0xe9dcf7, trim: 0xd2bce8, ceiling: 0xf4ecff, accent: 0x9b5de5,
    extras: 'planet', blurb: 'purple house · stargazer loft with a telescope' },
  0x2f7de1: { floor: 0xd0daea, wall: 0xe1e9f6, trim: 0xa9c4e8, ceiling: 0xeef3fb, accent: 0x2f7de1,
    extras: 'library', blurb: 'dark-blue house · library with ladder and reading chair' },
  0xffd23f: { floor: 0xefe2a8, wall: 0xf9f0cf, trim: 0xf2df8f, ceiling: 0xfdf8e0, accent: 0xffd23f,
    extras: 'pantry', blurb: 'gold house · bakery pantry with a cake stand' },
  0xff7f50: { floor: 0xf0bf9e, wall: 0xfadbc8, trim: 0xf0b28f, ceiling: 0xfdeee3, accent: 0xff7f50,
    extras: 'hammock', blurb: 'coral house · sun porch with a hammock and palm' }
};
const HOME_THEME_LIST = Object.values(HOME_THEMES);

function homeTheme(seed) {
  // -1 = legacy/unknown seed: rotate the theme list instead of falling back
  if (!(seed > 0)) return HOME_THEME_LIST[Math.abs(seed | 0) % HOME_THEME_LIST.length];
  return HOME_THEMES[seed] || HOME_THEME_LIST[0];
}

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
  // Slab + collider deliberately overrun the room footprint: no walkable tile
  // inside a building may lack floor. Forward reach (z1 + 1.6) must cover the
  // whole EXIT-trigger circle (door ±1.35 m) plus the player's body radius —
  // the DBG log proved the fall: player inside a home walked to z=5.85 while
  // the old slab ended at z=5.5, ground/surf went null, and they fell out of
  // the world without ever "exiting".
  solid(D.x0 - 0.55, -1, D.z0 - 0.55, D.x1 + 0.55, 0.1, D.z1 + 1.6);

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
  // Invisible threshold in the open doorway. Indoors, world.solids is just the
  // room's own colliders, so ground ends at the slab; walking out the door gap
  // used to mean stepping off the world (confirmed by DBG log). Jump apex
  // (~1.77) can't clear the 2.15 height, so EXIT is the only way out — and the
  // EXIT trigger (door ±1.35) fires long before the player reaches this.
  solid(-D.doorHalf, 0, D.z1, D.doorHalf, 2.15, D.z1 + t);
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
  const th = homeTheme(seed);
  const SOFA = [0x2f7de1, 0x35b56a, 0xe8402a, 0x9b5de5, 0x16a3b8, 0xd81e5b];
  const RUG = [0xff8a3d, 0x35a7ff, 0xffd23f, 0x2aa876];
  const BED = [0xff5d8f, 0x9b5de5, 0x43d46c, 0x35a7ff];
  const QUILT = [0xffd23f, 0xf4e9d2, 0xff9ff3, 0x9fe0ff];
  // the accent leads the soft furnishing colours so the inside matches the
  // exterior brick colour of the house
  const sofaCol = th.accent;
  const rugCol = SOFA[(SOFA.indexOf(th.accent) + 2) % SOFA.length];
  const bedCol = BED[(BED.indexOf(th.accent) + 1 + BED.length) % BED.length] || th.accent;
  const quiltCol = QUILT[Math.floor(rand() * QUILT.length)];
  const layout = ['attic', 'planet', 'library', 'hammock'].includes(th.extras) ? 2
    : ['fireplace', 'bunks', 'greenhouse'].includes(th.extras) ? 1 : 0;
  const tickKitchen = furnishKitchen(group, solid, mat, -2.95);
  const tickBath = furnishBath(group, solid, mat, D);
  if (th.extras === 'bunks') furnishBunks(group, solid, mat, th.accent);
  else furnishBedroom(group, solid, mat, bedCol, quiltCol, 3.7, 2.6);
  // one themed interior block per house colour (see HOME_THEMES.extras)
  const homeFx = { flames: [], sway: [], orbit: null, tick: null };
  if (th.extras === 'attic') furnishAttic(group, solid, mat, D);
  if (th.extras === 'greenhouse') furnishGreenhouse(group, solid, mat, D);
  if (th.extras === 'green') furnishHerbGarden(group, solid, mat, D, homeFx);
  if (th.extras === 'fireplace') furnishFireplace(group, solid, mat, D, homeFx);
  if (th.extras === 'planet') furnishPlanetLoft(group, solid, mat, D, homeFx);
  if (th.extras === 'library') furnishLibrary(group, solid, mat, D);
  if (th.extras === 'pantry') furnishPantry(group, solid, mat, D);
  if (th.extras === 'hammock') furnishSunPorch(group, solid, mat, D, homeFx);

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
    for (const fl of homeFx.flames) {
      if (fl.isPointLight) fl.intensity = 4 + Math.sin(t * 9) * 1.4;
      else fl.scale.y = 0.2 * (0.8 + Math.sin(t * 8 + fl.position.z * 9) * 0.25);
    }
    if (homeFx.orbit) {
      homeFx.orbit.planet.rotation.y += dt * 0.35;
      homeFx.orbit.ring.rotation.z += dt * 0.12;
    }
    for (let i = 0; i < homeFx.sway.length; i++) {
      const o = homeFx.sway[i];
      if (o.isGroup) o.rotation.x = Math.sin(t * 1.1) * 0.06;
      else o.rotation.z = Math.sin(t * 2.2 + i) * 0.12;
    }
    tvClock += dt;
    if (tvClock > 0.1) {
      tvClock = 0;
      painter.tick(t);
      screenTex.needsUpdate = true;
    }
  };
  return { tick, tv: painter, screenMesh: screen };
}

/* ---- themed home furniture: one per HOME_THEMES.extras ----
   All props sit in the dead bands of the floor plan: the west strip
   (x ≈ -4.5..-3.5, between kitchen run and sofa), the east wall gap
   (z ≈ -0.5..1.0, between bath and bed), and the ceiling. */

function plantPot(group, solid, mat, x, z, s = 1, potCol = 0xb46a3c) {
  const pot = merged([addCyl([], 0.17 * s, 0.24 * s, 0, 0.12 * s, 0)], mat(potCol));
  pot.position.set(x, 0, z);
  group.add(pot);
  const leafM = mat(0x3fae6a);
  for (let i = 0; i < 3; i++) {
    const lf = new THREE.Mesh(SP.clone(), leafM);
    lf.scale.set(0.2 * s, 0.2 * s, 0.2 * s);
    lf.position.set(x + (i - 1) * 0.12 * s, (0.32 + i * 0.09) * s, z + (i % 2 ? 0.08 : -0.06) * s);
    lf.rotation.z = (i - 1) * 0.5;
    group.add(lf);
  }
  solid(x - 0.2 * s, 0, z - 0.2 * s, x + 0.2 * s, 0.24 * s, z + 0.2 * s);
}

function furnishBunks(group, solid, mat, accent) {
  // twin bunk beds in the bedroom corner (3.0..4.4, 1.55..3.65)
  const frame = [];
  addBox(frame, 1.35, 0.42, 2.1, 0, 0.21, 0);
  addBox(frame, 1.45, 0.65, 0.16, 0, 0.5, -1.05);
  group.add(merged(frame, mat(C.porcelain)).translateX(3.7).translateZ(2.6));
  const sheet = merged([addBox([], 1.33, 0.16, 2.05, 0, 0.46, 0)], mat(accent));
  sheet.position.set(3.7, 0, 2.6);
  group.add(sheet);
  const upFrame = [];
  addBox(upFrame, 1.35, 0.14, 2.1, 0, 1.45, 0);
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.98, 0.98])
    addBox(upFrame, 0.1, 0.95, 0.1, sx, 1.95, sz);
  addBox(upFrame, 1.35, 0.12, 0.12, 0, 1.9, -0.98);
  const upM = merged(upFrame, mat(C.porcelain));
  upM.position.set(3.7, 0, 2.6);
  group.add(upM);
  const upSheet = merged([addBox([], 1.3, 0.12, 1.9, 0, 1.58, 0)], mat(0xffd23f));
  upSheet.position.set(3.7, 0, 2.6);
  group.add(upSheet);
  const ladder = merged([
    addBox([], 0.07, 1.15, 0.07, -0.3, 1.0, 1.06), addBox([], 0.07, 1.15, 0.07, 0.3, 1.0, 1.06),
    addBox([], 0.67, 0.06, 0.07, 0, 0.75, 1.06), addBox([], 0.67, 0.06, 0.07, 0, 1.15, 1.06)
  ], mat(C.woodLight));
  ladder.position.set(3.7, 0, 2.6);
  group.add(ladder);
  solid(3.0, 0, 1.55, 4.4, 0.42, 3.65);
  solid(3.0, 0, 1.48, 4.4, 2.1, 1.65);       // headboard posts
  solid(3.0, 1.38, 1.55, 4.4, 2.05, 3.65);   // upper bunk: don't stand in it
  // toy chest by the foot of the bunks
  const toy = merged([addBox([], 0.9, 0.5, 0.55, 0, 0.25, 0), addBox([], 0.94, 0.1, 0.6, 0, 0.53, 0)], mat(0xd81e5b));
  toy.position.set(2.35, 0, 3.5);
  group.add(toy);
  solid(1.9, 0, 3.2, 2.8, 0.58, 3.8);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(SP.clone(), mat([0xe8402a, 0x35a7ff, 0x35b56a, 0xffd23f][i]));
    b.scale.setScalar(0.14);
    b.position.set(2.05 + i * 0.2, 0.66, 3.5);
    group.add(b);
  }
}

function furnishAttic(group, solid, mat, D) {
  // mezzanine loft in the west strip: stair steps up to a plank platform,
  // treasure trunk + cushion + lamp up top
  const plank = mat(C.woodLight);
  const steps = [];
  addBox(steps, 0.55, 0.55, 0.7, 0, 0.275, 0);
  addBox(steps, 0.55, 1.1, 0.7, 0, 0.55, -0.7);
  addBox(steps, 0.55, 1.65, 0.7, 0, 0.825, -1.4);
  const stM = merged(steps, plank);
  stM.position.set(-2.95, 0, -1.6);
  group.add(stM);
  solid(-3.25, 0, -3.1, -2.65, 2.2, -1.25);
  const loft = merged([addBox([], 1.7, 0.14, 1.9, 0, 2.13, 0)], plank);
  loft.position.set(-3.95, 0, -2.4);
  group.add(loft);
  solid(-4.8, 2.06, -3.35, -3.1, 2.2, -1.45);
  for (const sx of [-4.6, -3.3]) {
    const leg = merged([addBox([], 0.12, 2.06, 0.12, 0, 1.03, 0)], mat(C.wood));
    leg.position.set(sx, 0, -1.6);
    group.add(leg);
  }
  const rail = merged([addBox([], 0.08, 0.55, 1.9, 0, 2.45, 0)], mat(C.wood));
  rail.position.set(-3.15, 0, -2.4);
  group.add(rail);
  // treasure trunk
  const trunk = merged([addBox([], 0.85, 0.42, 0.55, 0, 0.21, 0), addBox([], 0.88, 0.16, 0.58, 0, 0.5, 0)], mat(0x7a4a21));
  trunk.position.set(-4.1, 2.2, -2.6);
  group.add(trunk);
  const band = merged([addBox([], 0.2, 0.44, 0.58, 0, 0, 0)], mat(0xffd23f));
  band.position.set(-4.1, 2.71, -2.6);
  group.add(band);
  const cush = merged([addBox([], 0.6, 0.16, 0.6, 0, 0, 0)], mat(0xd81e5b));
  cush.position.set(-3.5, 2.28, -1.9);
  group.add(cush);
  const lampP = [];
  addCyl(lampP, 0.04, 0.4, 0, 0.2, 0);
  const lampPole = merged(lampP, mat(C.chrome));
  lampPole.position.set(-4.6, 2.2, -1.7);
  group.add(lampPole);
  const shade = new THREE.Mesh(CY.clone().scale(0.16, 0.18, 0.16),
    mkMat(C.lamp, { emissive: C.lamp, emissiveIntensity: 0.8 }));
  shade.position.set(-4.6, 2.68, -1.7);
  group.add(shade);
}

function furnishGreenhouse(group, solid, mat, D) {
  // glass sunroom lean-to along the west strip: paned frame, plant shelves
  const frameMat = mat(0xf3ead8);
  const fr = [];
  for (const fz of [-2.2, -0.9, 0.4]) addBox(fr, 0.9, 2.1, 0.09, 0, 1.05, fz);
  addBox(fr, 0.9, 0.1, 2.7, 0, 2.14, -0.9);
  const frM = merged(fr, frameMat);
  frM.position.set(-4.15, 0, -0.9);
  group.add(frM);
  const glass = new THREE.Mesh(BR.clone().scale(0.8, 1.95, 2.6),
    mkMat(0xbfe6ff, { transparent: true, opacity: 0.28, roughness: 0.1 }));
  glass.position.set(-4.15, 1.05, -0.9);
  group.add(glass);
  for (const sz of [-2.2, -1.55, -0.9, -0.25, 0.4]) {
    const shelf = merged([addBox([], 0.72, 0.07, 0.5, 0, 0, 0)], mat(C.woodLight));
    shelf.position.set(-4.15, 0.85, sz + 0.32);
    group.add(shelf);
  }
  plantPot(group, solid, mat, -4.3, -1.9, 1.0);
  plantPot(group, solid, mat, -3.7, -0.2, 0.8, 0x7f8c99);
  plantPot(group, solid, mat, -4.3, 0.5, 1.2, 0xb46a3c);
  solid(-4.65, 0, -2.5, -3.65, 2.2, 0.7);
}

function furnishHerbGarden(group, solid, mat, D, fx) {
  // tiered herb planter + trellis in the west strip
  const box = merged([
    addBox([], 1.1, 0.45, 1.9, 0, 0.225, 0), addBox([], 1.2, 0.1, 2.0, 0, 0.5, 0)
  ], mat(C.wood));
  box.position.set(-4.0, 0, -1.2);
  group.add(box);
  solid(-4.6, 0, -2.2, -3.4, 0.55, -0.2);
  const herbM = mat(0x3fae6a);
  fx.sway = [];
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(SP.clone(), herbM);
    h.scale.set(0.22, 0.16 + (i % 3) * 0.05, 0.22);
    h.position.set(-4.28 + (i % 2) * 0.55, 0.66, -2.0 + Math.floor(i / 2) * 0.75);
    group.add(h);
    fx.sway.push(h);
  }
  const trellis = [];
  for (const tz of [-2.1, -1.2, -0.3]) addBox(trellis, 0.08, 1.8, 0.08, 0, 0.9, tz);
  addBox(trellis, 0.08, 0.08, 2.0, 0, 1.75, -1.2);
  addBox(trellis, 0.08, 0.08, 2.0, 0, 0.95, -1.2);
  const trM = merged(trellis, mat(C.woodLight));
  trM.position.set(-4.72, 0, -1.2);
  group.add(trM);
  const vine = mat(0x2f8f4f);
  for (let i = 0; i < 4; i++) {
    const v = new THREE.Mesh(SP.clone(), vine);
    v.scale.setScalar(0.14);
    v.position.set(-4.62, 0.6 + i * 0.32, -1.6 + (i % 2) * 0.8);
    group.add(v);
  }
}

function furnishFireplace(group, solid, mat, D, fx) {
  // brick hearth on the east wall gap; mantel holds candles, TV moves above
  const brick = mat(0xa9483c);
  const chim = [];
  addBox(chim, 0.55, 3.2, 1.4, 0, 1.6, 0);
  addBox(chim, 0.7, 0.16, 1.6, 0, 1.72, 0);          // mantel
  addBox(chim, 0.35, 0.7, 0.9, 0, 1.15, 0);          // firebox recess back
  const chM = merged(chim, brick);
  chM.position.set(D.x1 - 0.28, 0, 0.25);
  group.add(chM);
  solid(D.x1 - 0.55, 0, -0.45, D.x1, 2.9, 0.95);
  const glow = mkMat(0xff7b2d, { emissive: 0xff5a1f, emissiveIntensity: 1.6, transparent: true, opacity: 0.95 });
  fx.flames = [];
  for (let i = 0; i < 3; i++) {
    const fl = new THREE.Mesh(SP.clone(), glow);
    fl.scale.set(0.12, 0.2, 0.1);
    fl.position.set(D.x1 - 0.56, 0.32, -0.05 + i * 0.32);
    group.add(fl);
    fx.flames.push(fl);
  }
  const hearthLight = new THREE.PointLight(0xff9f4a, 5, 4.5, 2);
  hearthLight.position.set(D.x1 - 0.9, 0.6, 0.25);
  group.add(hearthLight);
  fx.flames.push(hearthLight);
  for (const cz of [-0.2, 0.7]) {
    const cndl = merged([addCyl([], 0.05, 0.3, 0, 0.15, 0)], mat(0xfff6e8));
    cndl.position.set(D.x1 - 0.42, 1.8, cz);
    group.add(cndl);
  }
  const logs = [];
  for (const lz of [0.08, 0.42]) addCyl(logs, 0.07, 0.62, 0, 0, lz);
  const logM = merged(logs, mat(0x5b3a24));
  logM.rotation.z = Math.PI / 2;
  logM.position.set(D.x1 - 0.5, 0.14, 0);
  group.add(logM);
}

function furnishPlanetLoft(group, solid, mat, D, fx) {
  // stargazer loft: glowing planet hanging from the ceiling + telescope
  const planetMat = mkMat(0x35a7ff, { emissive: 0x1c4f9c, emissiveIntensity: 0.7 });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), planetMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 28),
    mkMat(0xffd23f, { emissive: 0xb8860b, emissiveIntensity: 0.6 }));
  ring.rotation.x = 1.25;
  planet.position.set(-3.9, D.h - 1.15, -1.1);
  ring.position.copy(planet.position);
  group.add(planet, ring);
  const cord = merged([addCyl([], 0.015, 1.0, 0, 0.5, 0)], mat(0x555c66));
  cord.position.set(-3.9, D.h - 0.4, -1.1);
  group.add(cord);
  fx.orbit = { planet, ring };
  const stars = mkMat(0xfff6d0, { emissive: 0xffffff, emissiveIntensity: 1.2 });
  for (let i = 0; i < 10; i++) {
    const st = new THREE.Mesh(SP.clone(), stars);
    st.scale.setScalar(0.045);
    st.position.set(-4.5 + (i % 5) * 0.45, D.h - 0.35 - Math.floor(i / 5) * 0.3, -2.2 + (i % 3) * 0.8);
    group.add(st);
  }
  // telescope on a tripod in the west strip, aimed at the ceiling planet
  const tube = merged([addCyl([], 0.1, 0.9, 0, 0, 0), addCyl([], 0.13, 0.12, 0, 0.48, 0)], mat(0x2b3440));
  tube.rotation.z = 0.75;
  tube.position.set(-3.1, 1.15, 0.4);
  group.add(tube);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const m = addCyl(legs, 0.035, 1.15, 0, 0.57, 0);
    m.rotation.z = Math.cos(a) * 0.28;
    m.rotation.x = Math.sin(a) * 0.28;
  }
  const legM = merged(legs, mat(0x555c66));
  legM.position.set(-3.1, 0, 0.4);
  group.add(legM);
  solid(-3.45, 0, 0.05, -2.75, 2.0, 0.75);
}

function furnishLibrary(group, solid, mat, D) {
  // floor-to-ceiling shelves + rolling ladder + armchair in the west strip
  const shelf = [];
  addBox(shelf, 0.5, 3.0, 2.6, 0, 1.5, 0);
  for (const sy of [0.7, 1.3, 1.9, 2.5]) addBox(shelf, 0.52, 0.07, 2.5, 0.06, sy, 0);
  const shM = merged(shelf, mat(C.wood));
  shM.position.set(-4.6, 0, -1.3);
  group.add(shM);
  solid(-4.85, 0, -2.65, -4.3, 3.0, 0.05);
  const bookCols = [0xe8402a, 0x2f7de1, 0x35b56a, 0xff8a3d, 0x9b5de5, 0xffd23f];
  for (let row = 0; row < 4; row++) {
    for (let b = 0; b < 9; b++) {
      const bk = merged([addBox([], 0.16, 0.4, 0.12, 0, 0, 0)],
        mat(bookCols[(row * 3 + b) % bookCols.length]));
      bk.position.set(-4.33, 0.95 + row * 0.6, -2.35 + b * 0.26);
      group.add(bk);
    }
  }
  const lad = merged([
    addBox([], 0.5, 2.6, 0.1, 0, 1.3, 0),
    addBox([], 0.5, 0.07, 0.3, 0, 0.55, 0), addBox([], 0.5, 0.07, 0.3, 0, 1.15, 0),
    addBox([], 0.5, 0.07, 0.3, 0, 1.75, 0), addBox([], 0.5, 0.07, 0.3, 0, 2.35, 0)
  ], mat(C.woodLight));
  lad.position.set(-4.0, 0, 0.2);
  group.add(lad);
  solid(-4.25, 0, -0.05, -3.75, 2.7, 0.45);
  const chair = [];
  addBox(chair, 0.9, 0.45, 0.9, 0, 0.28, 0);
  addBox(chair, 0.9, 0.85, 0.22, 0, 0.7, -0.36);
  addBox(chair, 0.2, 0.62, 0.9, -0.37, 0.5, 0);
  addBox(chair, 0.2, 0.62, 0.9, 0.37, 0.5, 0);
  const chM = merged(chair, mat(0x8b3a3a));
  chM.position.set(-3.1, 0, 0.9);
  chM.rotation.y = 0.9;
  group.add(chM);
  solid(-3.7, 0, 0.3, -2.5, 0.9, 1.6);
  const lampP = [];
  addCyl(lampP, 0.05, 1.5, 0, 0.75, 0);
  const pole = merged(lampP, mat(C.chrome));
  pole.position.set(-2.4, 0, 1.6);
  group.add(pole);
  const shade = new THREE.Mesh(CY.clone().scale(0.2, 0.24, 0.2),
    mkMat(C.lamp, { emissive: C.lamp, emissiveIntensity: 0.9 }));
  shade.position.set(-2.4, 1.7, 1.6);
  group.add(shade);
}

function furnishPantry(group, solid, mat, D) {
  // bakery pantry: counter with cake stand, jar shelf, hanging pots
  const counter = [];
  addBox(counter, 1.0, 0.9, 1.9, 0, 0.45, 0);
  addBox(counter, 1.1, 0.1, 2.0, 0, 0.95, 0);
  const cnM = merged(counter, mat(C.cabCream));
  cnM.position.set(-4.0, 0, -1.2);
  group.add(cnM);
  solid(-4.55, 0, -2.2, -3.45, 1.0, -0.2);
  const stand = [];
  addCyl(stand, 0.05, 0.2, 0, 0.1, 0);
  const standM = merged(stand, mat(C.chrome));
  standM.position.set(-4.0, 1.0, -1.2);
  group.add(standM);
  const plate = new THREE.Mesh(CY.clone().scale(0.26, 0.04, 0.26), mat(0xffffff));
  plate.position.set(-4.0, 1.21, -1.2);
  group.add(plate);
  const cake = merged([addCyl([], 0.2, 0.18, 0, 0.09, 0), addCyl([], 0.13, 0.1, 0, 0.23, 0)],
    mkMat(0xff9ff3, { emissive: 0x6d1f7c, emissiveIntensity: 0.15 }));
  cake.position.set(-4.0, 1.23, -1.2);
  group.add(cake);
  const cherry = new THREE.Mesh(SP.clone(), mat(0xd62828));
  cherry.scale.setScalar(0.07);
  cherry.position.set(-4.0, 1.47, -1.2);
  group.add(cherry);
  for (const jz of [-1.9, -1.5]) {
    const jar = new THREE.Mesh(CY.clone().scale(0.12, 0.2, 0.12),
      mkMat(0xffd23f, { transparent: true, opacity: 0.85 }));
    jar.position.set(-3.9, 1.1, jz);
    group.add(jar);
    const lid = new THREE.Mesh(CY.clone().scale(0.13, 0.05, 0.13), mat(0xb46a3c));
    lid.position.set(-3.9, 1.31, jz);
    group.add(lid);
  }
  const rail = merged([addBox([], 0.05, 0.05, 1.6, 0, 0, 0)], mat(C.chrome));
  rail.position.set(-4.55, 2.35, -1.2);
  group.add(rail);
  for (const hz of [-1.75, -1.2, -0.65]) {
    const pot = new THREE.Mesh(CY.clone().scale(0.14, 0.16, 0.14), mat(0x9aa5b1));
    pot.position.set(-4.55, 2.15, hz);
    group.add(pot);
  }
}

function furnishSunPorch(group, solid, mat, D, fx) {
  // coral house sun porch: hammock strung between two posts + potted palm
  const postM = mat(C.wood);
  const post1 = merged([addBox([], 0.18, 2.3, 0.18, 0, 1.15, 0)], postM);
  post1.position.set(-3.7, 0, -1.9);
  group.add(post1);
  const post2 = merged([addBox([], 0.18, 2.3, 0.18, 0, 1.15, 0)], postM);
  post2.position.set(-3.7, 0, 0.7);
  group.add(post2);
  solid(-3.85, 0, -2.05, -3.55, 2.3, -1.75);
  solid(-3.85, 0, 0.55, -3.55, 2.3, 0.85);
  const hammock = new THREE.Group();
  const segs = [];
  for (let i = 0; i <= 8; i++) {
    const f = i / 8;
    addBox(segs, 0.52, 0.07, 0.3, 0, -Math.sin(f * Math.PI) * 0.5, -1.9 + f * 2.6);
  }
  const hmM = merged(segs, mat(0xff7f50));
  hammock.add(hmM);
  hammock.position.set(-3.7, 1.85, 0);
  group.add(hammock);
  fx.sway = [hammock];
  const palm = [];
  addCyl(palm, 0.09, 0.3, 0, 0.15, 0);
  const pot = merged(palm, mat(0xb46a3c));
  pot.position.set(-3.0, 0, 1.7);
  group.add(pot);
  const trunkM = merged([addCyl([], 0.05, 1.3, 0, 0.65, 0)], mat(0x8b5a2b));
  trunkM.position.set(-3.0, 0.3, 1.7);
  trunkM.rotation.z = 0.08;
  group.add(trunkM);
  const frond = mat(0x3fae6a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fr2 = merged([addBox([], 0.9, 0.05, 0.16, 0.4, 0, 0)], frond);
    fr2.position.set(-3.0, 1.68, 1.7);
    fr2.rotation.y = -a;
    fr2.rotation.z = -0.25;
    group.add(fr2);
  }
  solid(-3.3, 0, 1.4, -2.7, 0.6, 2.0);
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
/* ----------------------------------------------------------- CHURCH type */
function legoFig(mat, cloth, skin, opts = {}) {
  // Minifig-scale person: legs, torso, arms, head — same proportions as life.js
  const g = new THREE.Group();
  const skinM = mat(skin), clothM = mat(cloth);
  const dark = mat(0x22252b);
  g.add(merged([addBox([], 0.17, 0.2, 0.19, -0.085, 0.1, 0)], clothM));
  const legR = merged([addBox([], 0.17, 0.2, 0.19, 0.085, 0.1, 0)], clothM);
  g.add(legR);
  const torso = merged([addBox([], 0.34, 0.26, 0.2, 0, 0.33, 0)], opts.robe ? clothM : clothM);
  g.add(torso);
  // arms pivot at the shoulder: offset geometry inside a group at the shoulder
  const armL = new THREE.Group();
  armL.position.set(-0.225, 0.44, 0);
  armL.add(merged([addBox([], 0.11, 0.22, 0.13, 0, -0.11, 0)], skinM));
  const armR = new THREE.Group();
  armR.position.set(0.225, 0.44, 0);
  armR.add(merged([addBox([], 0.11, 0.22, 0.13, 0, -0.11, 0)], skinM));
  g.add(armL, armR);
  const head = merged([addBox([], 0.24, 0.2, 0.21, 0, 0.57, 0)], skinM);
  g.add(head);
  const eyes = merged([
    addBox([], 0.045, 0.045, 0.03, -0.06, 0.59, -0.106),
    addBox([], 0.045, 0.045, 0.03, 0.06, 0.59, -0.106)
  ], dark);
  g.add(eyes);
  if (opts.hair) g.add(merged([addBox([], 0.26, 0.07, 0.23, 0, 0.7, 0)], mat(opts.hair)));
  if (opts.beard) g.add(merged([addBox([], 0.2, 0.09, 0.06, 0, 0.5, -0.11)], mat(opts.beard)));
  if (opts.collar) g.add(merged([addBox([], 0.28, 0.06, 0.22, 0, 0.47, 0)], mat(0xffffff)));
  g.userData.parts = { armL, armR, legL: g.children[0], legR, torso, head };
  return g;
}

function sceneChurch(group, D, ctx) {
  const { solid, mat } = ctx;
  const wood = 0x6b4025, woodDark = 0x4e2e1a, stone = 0xe4dccb, gold = 0xffd23f;

  // carpeted nave runner up the center aisle (mesh only, no collider)
  const runner = merged([addBox([], 1.5, 0.05, D.z1 - D.z0 - 3.2, 0, 0.125, -1)], mat(0x8d2f3f));
  runner.position.z = 0.2;
  group.add(runner);

  // ---- raised chancel platform at the -z end (walkable: 0.3 step-up) ----
  const chancel = merged([addBox([], D.x1 - D.x0 - 1.2, 0.3, 3.6, 0, 0.15, 0)], mat(stone));
  chancel.position.set(0, 0, D.z0 + 1.9);
  group.add(chancel);
  solid(D.x0 + 0.6, 0, D.z0 + 0.1, D.x1 - 0.6, 0.3, D.z0 + 3.7);
  const step = merged([addBox([], 3.2, 0.15, 0.6, 0, 0.075, 0)], mat(stone));
  step.position.set(0, 0, D.z0 + 4.0);
  group.add(step);
  solid(-1.6, 0, D.z0 + 3.7, 1.6, 0.15, D.z0 + 4.3);

  // ---- altar + cloth + candles ----
  const altar = merged([addBox([], 1.9, 0.9, 0.9, 0, 0.45, 0), addBox([], 2.0, 0.12, 1.0, 0, 0.96, 0)], mat(stone));
  altar.position.set(0, 0.3, D.z0 + 1.3);
  group.add(altar);
  solid(-0.95, 0.3, D.z0 + 0.8, 0.95, 1.26, D.z0 + 1.8);
  const cloth = merged([addBox([], 1.95, 0.05, 0.95, 0, 1.03, 0), addBox([], 1.95, 0.34, 0.04, 0, 0.83, -0.48)], mat(0xffffff));
  cloth.position.set(0, 0.3, D.z0 + 1.3);
  group.add(cloth);

  const flameMat = mkMat(0xffb347, { emissive: 0xff9f1c, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 });
  const flames = [];
  for (const sx of [-0.62, 0.62]) {
    const cndl = merged([addCyl([], 0.045, 0.3, 0, 0.15, 0), addCyl([], 0.08, 0.05, 0, 0.025, 0)], mat(0xfff6e8));
    cndl.position.set(sx, 1.28, D.z0 + 1.3);
    group.add(cndl);
    const fl = new THREE.Mesh(SP.clone(), flameMat);
    fl.scale.set(0.04, 0.075, 0.04);
    fl.position.set(sx, 1.62, D.z0 + 1.3);
    group.add(fl);
    flames.push(fl);
  }

  // ---- big cross + LEGO Jesus on the back wall behind the pastor ----
  const cross = new THREE.Group();
  cross.add(merged([addBox([], 0.24, 3.7, 0.2, 0, 0, 0)], mat(woodDark)));
  cross.add(merged([addBox([], 2.5, 0.24, 0.2, 0, 0.75, 0)], mat(woodDark)));
  cross.add(merged([addBox([], 0.6, 0.24, 0.06, 0, 1.6, -0.02)], mat(0xf6efe3)));   // INRI plaque
  const jesus = new THREE.Group();
  const jskin = 0xd69c6d, robe = 0xf2ead6;
  jesus.add(merged([addBox([], 0.3, 0.42, 0.22, 0, 0.1, 0)], mat(robe)));            // torso
  jesus.add(merged([addBox([], 0.26, 0.22, 0.24, 0, 0.44, 0)], mat(jskin)));         // head
  jesus.add(merged([addBox([], 0.28, 0.1, 0.26, 0, 0.56, 0)], mat(0x5b3a24)));       // hair
  jesus.add(merged([addBox([], 0.04, 0.04, 0.03, -0.06, 0.45, -0.13)], mat(0x22252b)));
  jesus.add(merged([addBox([], 0.04, 0.04, 0.03, 0.06, 0.45, -0.13)], mat(0x22252b)));
  jesus.add(merged([addBox([], 0.36, 0.14, 0.24, 0, -0.16, 0)], mat(0xc0392b)));     // loincloth
  const armGeoL = merged([addBox([], 0.85, 0.13, 0.14, -0.5, 0, 0)], mat(jskin));
  const armGeoR = merged([addBox([], 0.85, 0.13, 0.14, 0.5, 0, 0)], mat(jskin));
  jesus.add(armGeoL, armGeoR);
  jesus.add(merged([addBox([], 0.12, 0.5, 0.13, -0.09, -0.47, 0)], mat(jskin)));
  jesus.add(merged([addBox([], 0.12, 0.5, 0.13, 0.09, -0.47, 0)], mat(jskin)));
  jesus.add(merged([addCyl([], 0.17, 0.045, 0, 0.585, 0)], mat(gold)));              // crown of thorns (halo gold)
  jesus.position.set(0, 0.32, -0.19);   // sits proud of the cross beams
  cross.add(jesus);
  cross.position.set(0, 3.05, D.z0 + 0.35);
  group.add(cross);

  // ---- lectern (ambo) with open book, LEGO pastor standing behind it ----
  const lect = new THREE.Group();
  lect.add(merged([addBox([], 0.16, 1.0, 0.16, 0, 0.5, 0)], mat(wood)));
  lect.add(merged([addBox([], 0.7, 0.5, 0.09, 0, 1.12, 0)], mat(wood)));
  lect.add(merged([addBox([], 0.62, 0.05, 0.4, 0, 0.98, 0.06)], mat(wood)));
  lect.add(merged([addBox([], 0.28, 0.04, 0.32, -0.16, 1.01, 0.05)], mat(0xfaf7ef)), );
  const bookR = merged([addBox([], 0.28, 0.04, 0.32, 0.16, 1.01, 0.05)], mat(0xfaf7ef));
  bookR.rotation.z = 0;
  const bookL = lect.children[3];
  bookL.rotation.z = 0.16; bookR.rotation.z = -0.16;
  lect.add(bookR);
  lect.add(merged([addBox([], 0.66, 0.06, 0.06, 0, 0.9, 0.16)], mat(gold)));
  lect.position.set(0, 0.3, D.z0 + 3.1);
  group.add(lect);
  solid(-0.42, 0.3, D.z0 + 2.85, 0.42, 1.35, D.z0 + 3.35);

  const pastor = legoFig(mat, 0x22252b, 0xffcc99, { hair: 0x6b6b6b, beard: 0xd9d9d9, collar: true });
  pastor.scale.setScalar(1.25);
  pastor.position.set(0, 0.3, D.z0 + 3.75);   // behind the lectern, under the cross
  group.add(pastor);
  solid(-0.4, 0.3, D.z0 + 3.45, 0.4, 1.3, D.z0 + 4.05);

  // ---- rows of pews, two columns split by the center aisle ----
  const pewSolid = (x0, x1, z) => {
    solid(x0, 0, z - 0.28, x1, 0.52, z + 0.28);            // seat block
    solid(x0, 0.52, z + 0.2, x1, 1.12, z + 0.32);          // backrest
  };
  for (const rowZ of [-2.6, -1.1, 0.4, 1.9]) {
    for (const [x0, x1] of [[-5.3, -1.4], [1.4, 5.3]]) {
      const pew = new THREE.Group();
      const seat = merged([addBox([], x1 - x0, 0.1, 0.52, 0, 0.47, 0)], mat(wood));
      seat.position.z = rowZ;
      const back = merged([addBox([], x1 - x0, 0.62, 0.12, 0, 0.81, 0)], mat(wood));
      back.position.z = rowZ + 0.26;
      const posts = merged([
        addBox([], 0.14, 1.0, 0.66, -(x1 - x0) / 2 + 0.07, 0.5, 0),
        addBox([], 0.14, 1.0, 0.66, (x1 - x0) / 2 - 0.07, 0.5, 0)
      ], mat(woodDark));
      posts.position.z = rowZ;
      pew.add(seat, back, posts);
      group.add(pew);
      pewSolid(x0, x1, rowZ);
    }
  }
  // hymnal racks on the aisle-side ends of the front pews
  for (const sx of [-1.15, 1.15]) {
    const rack = merged([addBox([], 0.3, 0.34, 0.1, 0, 0.85, 0)], mat(woodDark));
    rack.position.set(sx, 0, -2.6);
    group.add(rack);
    const book = merged([addBox([], 0.22, 0.26, 0.06, 0, 0, 0)], mat(0x7d1d2b));
    book.position.set(sx, 0.85, -2.66);
    group.add(book);
  }

  // ---- baptismal font near the door, candle stands either side of the step ----
  const font = merged([
    addCyl([], 0.22, 0.85, 0, 0.42, 0), addCyl([], 0.42, 0.16, 0, 0.93, 0), addCyl([], 0.34, 0.1, 0, 1.02, 0)
  ], mat(stone));
  font.position.set(D.x0 + 1.5, 0, D.z1 - 1.7);
  group.add(font);
  solid(D.x0 + 1.0, 0, D.z1 - 2.2, D.x0 + 2.0, 1.05, D.z1 - 1.2);

  const standMat = mat(gold, { metalness: 0.5, roughness: 0.35 });
  for (const sx of [-2.4, 2.4]) {
    const stand = merged([addCyl([], 0.05, 1.5, 0, 0.75, 0), addCyl([], 0.16, 0.06, 0, 0.03, 0)], standMat);
    stand.position.set(sx, 0, D.z0 + 4.5);
    group.add(stand);
    solid(sx - 0.2, 0, D.z0 + 4.3, sx + 0.2, 1.5, D.z0 + 4.7);
    const fl = new THREE.Mesh(SP.clone(), flameMat);
    fl.scale.set(0.05, 0.09, 0.05);
    fl.position.set(sx, 1.62, D.z0 + 4.5);
    group.add(fl);
    flames.push(fl);
  }

  // ---- stained-glass windows inset on both side walls + rose over the door ----
  const glassCols = [0x35a7ff, 0xe8402a, 0xffd23f, 0x43d46c, 0x9b5de5];
  let gi = 0;
  for (const wx of [D.x0 + 0.14, D.x1 - 0.14]) {
    for (let j = 0; j < 4; j++) {
      const gm = mkMat(glassCols[gi % glassCols.length], { emissive: glassCols[gi % glassCols.length], emissiveIntensity: 0.55, transparent: true, opacity: 0.85 });
      gi++;
      const pane = merged([addBox([], 0.06, 2.5, 1.1, 0, 0, 0), addBox([], 0.06, 0.5, 1.1, 0, 1.5, 0)], gm);
      pane.position.set(wx, 2.6, D.z0 + 2.6 + j * 3.1);
      group.add(pane);
      const lead = merged([addBox([], 0.08, 3.0, 0.09, 0, 0, 0), addBox([], 0.08, 0.09, 1.1, 0, 0, 0)], mat(0x3b3f46));
      lead.position.set(wx, 2.5, D.z0 + 2.6 + j * 3.1);
      group.add(lead);
    }
  }
  const rose = new THREE.Mesh(CY.clone().scale(0.85, 0.08, 0.85),
    mkMat(0xffd23f, { emissive: 0xffb347, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 }));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 4.4, D.z1 - 0.12);
  group.add(rose);

  // ---- hanging bell near the entry, gentle sway ----
  const beam = merged([addBox([], 1.6, 0.14, 0.14, 0, 0, 0)], mat(woodDark));
  beam.position.set(0, D.h - 0.5, D.z1 - 2.6);
  group.add(beam);
  const bellG = new THREE.Group();
  bellG.add(merged([addCyl([], 0.02, 0.5, 0, 0.25, 0)], mat(0x9aa5b1)));
  bellG.add(merged([addCyl([], 0.09, 0.09, 0, -0.04, 0), addCyl([], 0.2, 0.32, 0, -0.24, 0)], mat(gold)));
  bellG.position.set(0, D.h - 0.58, D.z1 - 2.6);
  group.add(bellG);

  // ---- wall hanging + offering plate by the door ----
  const tapestry = merged([addBox([], 1.1, 1.6, 0.05, 0, 0, 0), addBox([], 0.12, 0.9, 0.02, 0, 0.1, -0.03), addBox([], 0.55, 0.12, 0.02, 0, 0.3, -0.03)], mat(0x5b2c6f));
  tapestry.position.set(D.x1 - 0.2, 2.7, D.z1 - 2.2);
  group.add(tapestry);
  const plate = new THREE.Mesh(CY.clone().scale(0.24, 0.05, 0.24), mat(gold, { metalness: 0.55, roughness: 0.3 }));
  plate.position.set(D.x1 - 1.6, 1.0, D.z1 - 1.5);
  const stool = merged([addBox([], 0.5, 0.95, 0.5, 0, 0.475, 0)], mat(woodDark));
  stool.position.set(D.x1 - 1.6, 0, D.z1 - 1.5);
  group.add(stool, plate);
  solid(D.x1 - 1.9, 0, D.z1 - 1.8, D.x1 - 1.3, 1.0, D.z1 - 1.2);

  const tick = (t, dt) => {
    for (const fl of flames) {
      fl.scale.y = 0.075 * (0.85 + Math.sin(t * 9 + fl.position.x * 7) * 0.2);
    }
    bellG.rotation.z = Math.sin(t * 0.9) * 0.06;
    const p = pastor.userData.parts;
    p.armR.rotation.x = -0.5 + Math.sin(t * 1.6) * 0.3;   // pastor gestures from the lectern
  };
  return { tick, tv: null, screenMesh: null };
}

/* ------------------------------------------------------------ STORE type */
const SLUSH_FLAVORS = [
  { name: 'Blue Raspberry', color: 0x2f9bd8 },
  { name: 'Cherry', color: 0xd62828 },
  { name: 'Grape', color: 0x9b5de5 },
  { name: 'Orange', color: 0xff9f1c }
];

function sceneStore(group, D, ctx) {
  const { solid, mat } = ctx;
  const shelfGray = 0xb9c2cc, tileFloor = 0xe6ebf0;

  const floorTile = merged([addBox([], D.x1 - D.x0 - 0.5, 0.05, D.z1 - D.z0 - 0.5, 0, 0.125, 0)], mat(tileFloor));
  group.add(floorTile);

  const canRow = (colors, x, y, z, dz, n, axis) => {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(CY.clone().scale(0.09, 0.22, 0.09), mkMat(colors[i % colors.length]));
      c.position.set(x + (axis === 'x' ? i * dz : 0), y, z + (axis === 'z' ? i * dz : 0));
      group.add(c);
    }
  };

  // ---- two grocery rows (gondolas) running front-to-back, stocked both sides ----
  const buildRow = (cx) => {
    const w = 1.1, z0 = -4.6, z1 = 0.6, len = z1 - z0, cz = (z0 + z1) / 2;
    const body = merged([
      addBox([], w, 1.7, 0.12, 0, 0.85, -len / 2), addBox([], w, 1.7, 0.12, 0, 0.85, len / 2),
      addBox([], 0.12, 1.7, len, -w / 2 + 0.06, 0.85, 0), addBox([], 0.12, 1.7, len, w / 2 - 0.06, 0.85, 0),
      addBox([], w, 0.1, len, 0, 0.05, 0)
    ], mat(shelfGray));
    body.position.set(cx, 0, cz);
    group.add(body);
    solid(cx - w / 2, 0, z0, cx + w / 2, 1.7, z1);
    const shelfCols = [0xf8f9fa, 0xdde3e9];
    for (let s = 0; s < 3; s++) {
      const sy = 0.42 + s * 0.52;
      const sh = merged([addBox([], w - 0.1, 0.06, len - 0.1, 0, 0, 0)], mat(shelfCols[s % 2]));
      sh.position.set(cx, sy, cz);
      group.add(sh);
      // stock: cans, boxes, bottles and bags along every shelf, both faces
      const cols = [0xe8402a, 0x35a7ff, 0x43d46c, 0xffd23f, 0x9b5de5, 0xff9f1c];
      for (const side of [-1, 1]) {
        const zx = side < 0 ? cx - w / 2 + 0.22 : cx + w / 2 - 0.22;
        if (s === 0) canRow(cols, zx, sy + 0.17, z0 + 0.5, 0.42, 11, 'z');
        else if (s === 1) {
          for (let i = 0; i < 10; i++) {
            const b = merged([addBox([], 0.26, 0.34, 0.22, 0, 0, 0)], mkMat(cols[(i + s) % cols.length]));
            b.position.set(zx, sy + 0.2, z0 + 0.55 + i * 0.46);
            group.add(b);
          }
        } else {
          for (let i = 0; i < 9; i++) {
            const bt = merged([addCyl([], 0.08, 0.34, 0, 0.17, 0), addCyl([], 0.035, 0.1, 0, 0.39, 0)], mkMat(0x3fae6a));
            bt.position.set(zx, sy + 0.05, z0 + 0.6 + i * 0.52);
            group.add(bt);
          }
        }
      }
    }
    // endcap chip bags
    for (let i = 0; i < 4; i++) {
      const bag = merged([addBox([], 0.3, 0.42, 0.1, 0, 0, 0)], mkMat([0xffd23f, 0xe8402a, 0x2f7de1, 0x43d46c][i]));
      bag.position.set(cx, 1.45, z1 - 0.35);
      bag.rotation.x = -0.25;
      group.add(bag);
    }
    // price tag strip
    const tag = merged([addBox([], w, 0.12, 0.03, 0, 0, 0)], mat(0xffd23f));
    tag.position.set(cx, 0.32, z1 + 0.02);
    group.add(tag);
  };
  buildRow(-2.4);
  buildRow(1.4);

  // ---- produce table + fruit between the rows near the door ----
  const prod = merged([addBox([], 1.6, 0.7, 1.5, 0, 0.35, 0), addBox([], 1.7, 0.08, 1.6, 0, 0.74, 0)], mat(0x8b5a2b));
  prod.position.set(-0.5, 0, 2.6);
  group.add(prod);
  solid(-1.35, 0, 1.8, 0.35, 0.8, 3.35);
  const fruits = [0xe8402a, 0xff9f1c, 0xffd23f, 0x43d46c];
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Mesh(SP.clone(), mkMat(fruits[i % 4]));
    f.scale.setScalar(0.11);
    f.position.set(-1.1 + (i % 4) * 0.4, 0.86, 2.3 + Math.floor(i / 4) * 0.5);
    group.add(f);
  }
  // banana bunch (stepped yellow slabs)
  const banana = merged([addBox([], 0.5, 0.08, 0.16, 0, 0, 0), addBox([], 0.42, 0.08, 0.14, 0.06, 0.09, 0)], mat(0xf5d547));
  banana.position.set(-0.5, 0.85, 3.0);
  group.add(banana);

  // ---- cash register counter with register, candy rack, gum, bags ----
  const ctr = merged([
    addBox([], 3.2, 0.95, 1.0, 0, 0.475, 0), addBox([], 3.3, 0.08, 1.1, 0, 0.99, 0),
    addBox([], 3.2, 0.7, 0.1, 0, 1.33, -0.45)
  ], mat(0x35688f));
  ctr.position.set(3.4, 0, 2.8);
  group.add(ctr);
  solid(1.85, 0, 2.3, 4.95, 1.0, 3.3);
  const reg = new THREE.Group();
  reg.add(merged([addBox([], 0.7, 0.12, 0.55, 0, 0.06, 0)], mat(0x2b3440)));
  reg.add(merged([addBox([], 0.7, 0.34, 0.34, 0, 0.28, -0.08)], mat(0x39444f)));
  reg.add(merged([addBox([], 0.44, 0.2, 0.05, 0, 0.62, -0.16)], mkMat(0x7fe7a8, { emissive: 0x2f9e5f, emissiveIntensity: 0.7 })));
  reg.add(merged([addBox([], 0.5, 0.06, 0.28, 0, 0.15, 0.18)], mat(0xcfd6dd)));  // keypad
  reg.add(merged([addBox([], 0.62, 0.1, 0.4, 0, -0.05, 0.02)], mat(0xd9dee3)));  // drawer
  reg.position.set(3.9, 1.03, 2.8);
  group.add(reg);
  // candy + gum racks at the counter, chip bag display, paper bags
  for (let rI = 0; rI < 2; rI++) {
    const rackBase = merged([addBox([], 0.5, 0.66, 0.3, 0, 0.33, 0)], mat(0xd62828));
    rackBase.position.set(2.4, 1.03, 3.1);
    if (rI === 1) rackBase.position.set(2.4, 1.03, 2.5);
    group.add(rackBase);
    for (let cI = 0; cI < 3; cI++) {
      const bar = merged([addBox([], 0.4, 0.09, 0.22, 0, 0, 0)], mkMat([0x8b5a2b, 0xffd23f, 0x9b5de5][(cI + rI) % 3]));
      bar.position.set(2.4, 1.16 + cI * 0.21, 3.1 - rI * 0.6);
      group.add(bar);
    }
  }
  for (let i = 0; i < 3; i++) {
    const bagOf = merged([addBox([], 0.22, 0.34, 0.12, 0, 0, 0)], mat(0xc9a06a));
    bagOf.position.set(4.5, 1.2, 2.5 + i * 0.3);
    group.add(bagOf);
  }

  // ---- drink fridge on the -x wall: glass door, cold cans, glow ----
  const fr = new THREE.Group();
  fr.add(merged([addBox([], 0.95, 2.3, 5.2, 0, 1.15, 0)], mat(0xf1f3f5)));
  for (let s = 0; s < 3; s++) {
    const inner = merged([addBox([], 0.7, 0.06, 4.9, 0, 0, 0)], mat(0xffffff));
    inner.position.set(0.12, 0.7 + s * 0.62, 0);
    fr.add(inner);
  }
  fr.position.set(D.x0 + 0.62, 0, -2.9);
  group.add(fr);
  solid(D.x0 + 0.1, 0, -5.5, D.x0 + 1.1, 2.3, -0.3);
  canRow([0xe8402a, 0x35a7ff, 0x43d46c], D.x0 + 0.75, 0.88, -5.1, 0.4, 12, 'z');
  canRow([0xff9f1c, 0x9b5de5, 0xffd23f], D.x0 + 0.75, 1.5, -5.1, 0.4, 12, 'z');
  canRow([0x9fe0ff, 0xdc1414, 0x3fae6a], D.x0 + 0.75, 2.12, -5.1, 0.4, 12, 'z');
  const glass = new THREE.Mesh(BR.clone(), mkMat(0xa8d8f0, { transparent: true, opacity: 0.32, roughness: 0.1 }));
  glass.scale.set(0.06, 2.1, 4.9);
  glass.position.set(D.x0 + 1.15, 1.15, -2.9);
  group.add(glass);
  for (const hz of [-4.4, -1.4]) {
    const handle = merged([addCyl([], 0.035, 0.6, 0, 0, 0)], mat(0x6b7480));
    handle.position.set(D.x0 + 1.24, 1.2, hz);
    group.add(handle);
  }
  const fridgeGlow = new THREE.PointLight(0xbfe6ff, 6, 5, 2);
  fridgeGlow.position.set(D.x0 + 1.5, 1.6, -2.9);
  group.add(fridgeGlow);

  // ---- coffee station + microwave shelf on the back wall ----
  const cof = merged([
    addBox([], 1.1, 0.9, 0.65, 0, 0.45, 0), addBox([], 1.2, 0.08, 0.72, 0, 0.94, 0),
    addBox([], 0.5, 0.3, 0.12, 0, 1.1, -0.2)
  ], mat(0xb0413e));
  cof.position.set(-3.2, 0, D.z0 + 0.55);
  group.add(cof);
  solid(-3.8, 0, D.z0 + 0.2, -2.6, 1.3, D.z0 + 0.9);
  for (let i = 0; i < 2; i++) {
    const noz = merged([addCyl([], 0.05, 0.12, 0, 0, 0)], mat(0x2b3440));
    noz.position.set(-3.45 + i * 0.5, 0.85, D.z0 + 0.85);
    group.add(noz);
    const cupM = new THREE.Mesh(CY.clone().scale(0.08, 0.12, 0.08), mkMat(0xfaf7ef));
    cupM.position.set(-3.45 + i * 0.5, 0.72, D.z0 + 0.85);
    group.add(cupM);
  }
  const micRow = merged([addBox([], 1.3, 0.08, 0.55, 0, 1.3, 0), addBox([], 0.1, 1.3, 0.1, -0.55, 0.65, 0), addBox([], 0.1, 1.3, 0.1, 0.55, 0.65, 0)], mat(shelfGray));
  micRow.position.set(-1.0, 0, D.z0 + 0.5);
  group.add(micRow);
  solid(-1.7, 0, D.z0 + 0.2, -0.3, 1.38, D.z0 + 0.8);
  const mic = merged([
    addBox([], 0.8, 0.5, 0.45, 0, 0.25, 0), addBox([], 0.5, 0.34, 0.03, -0.12, 0.25, -0.24),
    addBox([], 0.2, 0.34, 0.04, 0.27, 0.25, -0.24)
  ], mat(0x2b3440));
  mic.position.set(-1.0, 1.38, D.z0 + 0.5);
  group.add(mic);
  const micGlass = merged([addBox([], 0.46, 0.3, 0.02, 0, 0, 0)], mkMat(0x1c2733, { emissive: 0x0a2b1f, emissiveIntensity: 0.6 }));
  micGlass.position.set(-1.12, 1.63, D.z0 + 0.27);
  group.add(micGlass);

  // ---- SLUSHIE MACHINE at the back (+x side): 4 flavour pads + pour button ----
  const machX = 3.4, machZ = D.z0 + 0.62;
  const mach = merged([
    addBox([], 1.7, 1.6, 0.75, 0, 0.8, 0), addBox([], 1.8, 0.1, 0.85, 0, 1.65, 0),
    addBox([], 1.7, 0.5, 0.12, 0, 0.25, 0.4)          // drip-tray backer
  ], mat(0x39444f));
  mach.position.set(machX, 0, machZ);
  group.add(mach);
  solid(machX - 0.9, 0, machZ - 0.45, machX + 0.9, 1.7, machZ + 0.6);
  const tray = merged([addBox([], 1.5, 0.06, 0.5, 0, 0, 0)], mat(0xcfd6dd));
  tray.position.set(machX, 0.56, machZ + 0.62);
  group.add(tray);
  const flavorMat = mkMat(SLUSH_FLAVORS[0].color, { emissive: SLUSH_FLAVORS[0].color, emissiveIntensity: 0.35 });
  const tank = new THREE.Mesh(BR.clone(), mkMat(SLUSH_FLAVORS[0].color, { transparent: true, opacity: 0.8, emissive: SLUSH_FLAVORS[0].color, emissiveIntensity: 0.4 }));
  tank.scale.set(0.55, 0.85, 0.5);
  tank.position.set(machX, 1.15, machZ - 0.05);
  group.add(tank);
  const tankLid = merged([addCyl([], 0.1, 0.1, 0, 0, 0)], mat(0xcfd6dd));
  tankLid.position.set(machX, 1.62, machZ - 0.05);
  group.add(tankLid);
  const noz = merged([addCyl([], 0.06, 0.16, 0, 0, 0)], mat(0x6b7480));
  noz.position.set(machX, 0.66, machZ + 0.6);
  group.add(noz);

  const interactMeshes = [];
  for (let i = 0; i < 4; i++) {
    const pad = new THREE.Mesh(BR.clone(), mkMat(SLUSH_FLAVORS[i].color, { emissive: SLUSH_FLAVORS[i].color, emissiveIntensity: 0.8 }));
    pad.scale.set(0.3, 0.16, 0.08);
    pad.position.set(machX - 0.57 + i * 0.38, 0.95, machZ + 0.42);
    pad.userData.act = { kind: 'flavor', i };
    group.add(pad);
    interactMeshes.push(pad);
  }
  const pourBtn = new THREE.Mesh(CY.clone().scale(0.12, 0.07, 0.12), mkMat(0x43d46c, { emissive: 0x2f9e4f, emissiveIntensity: 0.9 }));
  pourBtn.rotation.x = Math.PI / 2;
  pourBtn.position.set(machX, 0.72, machZ + 0.42);
  pourBtn.userData.act = { kind: 'pour' };
  group.add(pourBtn);
  interactMeshes.push(pourBtn);
  const label = merged([addBox([], 1.4, 0.26, 0.05, 0, 0, 0)], mkMat(0xffd23f, { emissive: 0xffb347, emissiveIntensity: 0.6 }));
  label.position.set(machX, 1.85, machZ + 0.32);
  group.add(label);

  // cup under the spigot + fill + pour stream
  const cup = merged([addCyl([], 0.11, 0.26, 0, 0.13, 0)], mkMat(0xffffff, { transparent: true, opacity: 0.5 }));
  cup.position.set(machX, 0.59, machZ + 0.6);
  group.add(cup);
  const cupFillMat = mkMat(SLUSH_FLAVORS[0].color);
  const cupFill = new THREE.Mesh(CY.clone(), cupFillMat);
  cupFill.scale.set(0.095, 0.001, 0.095);
  cupFill.position.set(machX, 0.6, machZ + 0.6);
  group.add(cupFill);
  const streamMat = mkMat(SLUSH_FLAVORS[0].color, { transparent: true, opacity: 0.9, emissive: SLUSH_FLAVORS[0].color, emissiveIntensity: 0.3 });
  const stream = new THREE.Mesh(CY.clone(), streamMat);
  stream.scale.set(0.045, 0.01, 0.045);
  stream.position.set(machX, 0.62, machZ + 0.6);
  stream.visible = false;
  group.add(stream);
  const drips = [];
  const dripMat = mkMat(SLUSH_FLAVORS[0].color, { transparent: true, opacity: 0.9 });
  for (let i = 0; i < 10; i++) {
    const dr = new THREE.Mesh(SP.clone(), dripMat);
    dr.scale.setScalar(0.035);
    dr.visible = false;
    dr.userData.v = 0;
    group.add(dr);
    drips.push(dr);
  }

  let flavor = 0, pour = -1;
  const setFlavor = (i) => {
    flavor = i;
    const col = SLUSH_FLAVORS[i].color;
    tank.material.color.setHex(col); tank.material.emissive.setHex(col);
    flavorMat.color.setHex(col); flavorMat.emissive.setHex(col);
    streamMat.color.setHex(col); streamMat.emissive.setHex(col);
    dripMat.color.setHex(col);
    cupFillMat.color.setHex(col);
  };
  const interact = (obj) => {
    const act = obj.userData && obj.userData.act;
    if (!act) return null;
    if (act.kind === 'flavor') {
      setFlavor(act.i);
      sfx.swap();
      return `Slushie flavour: ${SLUSH_FLAVORS[act.i].name}!`;
    }
    if (act.kind === 'pour') {
      if (pour >= 0) return 'Still pouring…';
      pour = 0;
      for (const dr of drips) { dr.visible = true; dr.userData.v = 0; }
      sfx.thud();
      return `Pouring a ${SLUSH_FLAVORS[flavor].name} slushie — mind the wobble!`;
    }
    return null;
  };

  // ---- misc convenience-store dressing ----
  const magRack = new THREE.Group();
  magRack.add(merged([addCyl([], 0.05, 1.4, 0, 0.7, 0)], mat(0x6b7480)));
  for (let i = 0; i < 4; i++) {
    const mg = merged([addBox([], 0.44, 0.6, 0.04, 0, 0, 0)], mkMat([0xffd23f, 0x35a7ff, 0xe8402a, 0x43d46c][i]));
    const a = (i / 4) * Math.PI * 2;
    mg.position.set(Math.sin(a) * 0.3, 0.85, Math.cos(a) * 0.3);
    mg.rotation.y = a;
    magRack.add(mg);
  }
  magRack.position.set(4.6, 0, 4.2);
  group.add(magRack);
  solid(4.25, 0, 3.85, 4.95, 1.4, 4.55);
  const atm = merged([addBox([], 0.9, 1.3, 0.25, 0, 0, 0), addBox([], 0.5, 0.3, 0.05, 0, 0.35, -0.15), addBox([], 0.3, 0.1, 0.05, 0, 0.02, -0.15)], mat(0x2b6e4f));
  atm.position.set(D.x1 - 0.15, 1.6, 0.4);
  group.add(atm);
  const atmScreen = merged([addBox([], 0.46, 0.26, 0.02, 0, 0, 0)], mkMat(0x43d46c, { emissive: 0x2f9e4f, emissiveIntensity: 0.9 }));
  atmScreen.position.set(D.x1 - 0.32, 1.95, 0.4);
  group.add(atmScreen);
  const bin = merged([addCyl([], 0.22, 0.7, 0, 0.35, 0)], mat(0x4a5560));
  bin.position.set(D.x0 + 0.8, 0, D.z1 - 1.2);
  group.add(bin);
  solid(D.x0 + 0.55, 0, D.z1 - 1.45, D.x0 + 1.05, 0.7, D.z1 - 0.95);
  const sign = merged([addBox([], 0.5, 0.05, 0.4, 0, 0.02, 0), addBox([], 0.45, 0.5, 0.06, 0, 0.3, 0)], mkMat(0xffd23f));
  sign.position.set(-1.2, 0.14, 1.4);
  sign.rotation.y = 0.5;
  group.add(sign);
  const baskets = merged([addBox([], 0.45, 0.28, 0.6, 0, 0.14, 0), addBox([], 0.45, 0.28, 0.6, 0, 0.2, 0.62)], mat(0xe8402a));
  baskets.position.set(-4.3, 0, 4.2);
  group.add(baskets);
  solid(-4.55, 0, 3.9, -4.05, 0.5, 4.9);
  const openSign = merged([addBox([], 1.0, 0.3, 0.08, 0, 0, 0)], mkMat(0x43d46c, { emissive: 0x43d46c, emissiveIntensity: 1.1 }));
  openSign.position.set(0, D.h - 0.55, D.z1 - 0.2);
  group.add(openSign);

  const tick = (t, dt) => {
    atmScreen.material.emissiveIntensity = 0.7 + Math.sin(t * 2.3) * 0.25;
    if (pour < 0) return;
    pour += dt;
    const dur = 1.3;
    const f = Math.min(pour / dur, 1);
    stream.visible = pour < dur;
    stream.scale.y = 0.07;
    stream.position.y = 0.585;
    for (const dr of drips) {
      dr.userData.v += 9 * dt;
      dr.position.set(machX + (Math.random() - 0.5) * 0.05, dr.position.y - dr.userData.v * dt, machZ + 0.6);
      if (dr.position.y < 0.62) { dr.userData.v = 0; dr.position.y = 0.66 + Math.random() * 0.04; }
    }
    cupFill.scale.y = 0.001 + f * 0.22;
    cupFill.position.y = 0.6 + f * 0.11;
    if (pour >= dur) {
      pour = -1;
      stream.visible = false;
      for (const dr of drips) dr.visible = false;
      sfx.place();
    }
  };
  return { tick, tv: null, screenMesh: null, interactMeshes, interact };
}

const SCENES = { home: sceneHome, farm: sceneFarm, school: sceneSchool, police: scenePolice, fire: sceneFire, church: sceneChurch, store: sceneStore };
const PALS = {
  home: { floor: 0xd9b98a, wall: 0xf6efe3 },
  farm: { floor: 0xb98a55, wall: 0xf1e3c8 },
  school: { floor: 0xd9cdb6, wall: 0xeef3ee },
  police: { floor: 0xc2ccd6, wall: 0xe7edf2 },
  fire: { floor: 0xb8bec4, wall: 0xf3e6e3 },
  church: { floor: 0xc4784f, wall: 0xf4ead6 },
  store: { floor: 0xdfe5ea, wall: 0xeef3ee }
};

/* Build (or return cached) interior for a type+variant seed. Home variant
   colours/furniture depend on the seed; civic types ignore it. */
export function makeInterior(scene, type = 'home', seed = 0) {
  const kind = SCENES[type] ? type : 'home';
  const D = INTERIOR_DEFS[kind];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const pal = kind === 'home' ? homeTheme(seed) : (PALS[kind] || PALS.home);
  const shell = buildShell(D, pal, group);
  const sceneApi = SCENES[kind](group, D, shell, seed | 0);
  const tickPad = shell.tickPad;
  return {
    type: kind,
    def: D,
    theme: kind === 'home' ? homeTheme(seed) : null,
    group,
    solids: shell.solids,
    screenMesh: sceneApi.screenMesh || null,
    tv: sceneApi.tv || null,
    interactMeshes: sceneApi.interactMeshes || null,
    interact: sceneApi.interact || null,
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
