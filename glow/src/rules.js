/** Pure gameplay math — mirrored by Godot `GlowRules`. */

export function detectionScore(distance, visionRange, glow, movement, species, los, envVis) {
  const distF = Math.min(1, Math.max(0, 1 - distance / Math.max(0.001, visionRange)));
  return distF * glow * movement * species * (los ? 1 : 0.25) * envVis;
}

export function trailInterest(brightness, freshness, sensitivity, distanceFactor, attract) {
  return brightness * freshness * sensitivity * distanceFactor * attract;
}

export function finalScore(fireflies, survival, distance, escaped, nearMisses, overglow) {
  return Math.floor(
    fireflies * 12 + survival * 2 + distance * 0.4 + escaped * 40 + nearMisses * 25 + overglow * 30
  );
}

export function overglowReady(combo, thresholdScale) {
  return combo >= Math.floor(8 * thresholdScale);
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

/** Visual fidelity multiplier. Cheap default is 1; 8 is richest meshes. */
export function clampFidelity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.round(n)));
}

export const MOTH_MIN_Y = 0.6;
export const MOTH_MAX_Y = 42;

/** Cruise altitude only changes on explicit rise/descend. Pitch does not sink the moth. */
export function stepCruiseAltitude(cruiseAlt, rise, dt, verticalSpeed) {
  return clamp(Number(cruiseAlt) + Number(rise) * Number(verticalSpeed) * Number(dt), MOTH_MIN_Y, MOTH_MAX_Y);
}

/**
 * Mean-zero undulation along the flown track (distance) plus a slow time beat.
 * The glow trail should snake; this is not gravity.
 */
export function mothTrackWave(distance, t, amp = 0.42) {
  const a = Number(amp) || 0;
  const d = Number(distance) || 0;
  const time = Number(t) || 0;
  return Math.sin(d * 0.55 + time * 2.15) * a + Math.sin(d * 0.22 + time * 0.85) * a * 0.38;
}

export function mothFlightY(cruiseAlt, distance, t, amp) {
  return clamp(cruiseAlt + mothTrackWave(distance, t, amp), MOTH_MIN_Y, MOTH_MAX_Y);
}

/** Mesh knobs. Even x1 is a defined bioluminescent forest; x8 is denser still. */
export function fidelityProfile(level) {
  const f = clampFidelity(level);
  return {
    level: f,
    mothBodySeg: 16 + f * 3,
    mothBodyRings: 12 + f * 2,
    mothWings: 4,
    mothAntennae: true,
    mothWingVeins: true,
    mothWingGeo: f < 5 ? "rounded" : "shaped",
    mothAbdomen: true,
    mothHaloSeg: 14 + f * 2,
    treeNearSeg: Math.min(32, 14 + f * 2),
    treeFarSeg: Math.min(20, 10 + f),
    treeCanopy: true,
    plantSeg: Math.min(24, 10 + f * 2),
    plantRings: Math.min(16, 8 + f),
    plantShapes: true,
    flySeg: Math.min(20, 10 + f),
    predRadial: Math.min(28, 12 + f * 2),
    predWings: true,
    predParts: true,
    predAnim: true,
    barkDetail: 1.35 + (f - 1) * 0.4,
    moonSeg: 20 + f * 4,
    bloomBoost: 1.12 + (f - 1) * 0.07,
    floorSeg: Math.min(36, 16 + f * 2),
  };
}

export const BIOMES = {
  moonlit_grove: { name: "Moonlit Grove", glow: 0x73b2ff, trees: 0.45, flies: 1.0, dark: 0.15 },
  emerald_hollow: { name: "Emerald Hollow", glow: 0x33f273, trees: 1.0, flies: 1.1, dark: 0.2 },
  violet_fungal: { name: "Violet Fungal Forest", glow: 0xb847ff, trees: 0.9, flies: 1.0, dark: 0.25 },
  blackwood: { name: "Blackwood", glow: 0x1c2028, trees: 1.2, flies: 0.35, dark: 0.85 },
  firefly_meadow: { name: "Firefly Meadow", glow: 0xffd940, trees: 0.4, flies: 2.2, dark: 0.1 },
  crystal_creek: { name: "Crystal Creek", glow: 0x40d9ff, trees: 0.7, flies: 1.2, dark: 0.2 },
  ancient_grove: { name: "Ancient Grove", glow: 0x598c4d, trees: 1.4, flies: 0.8, dark: 0.3 },
  thornwood: { name: "Thornwood", glow: 0x733340, trees: 1.1, flies: 0.7, dark: 0.35 },
  mist_basin: { name: "Mist Basin", glow: 0x8cbdb3, trees: 0.8, flies: 0.9, dark: 0.55 },
  fallen_forest: { name: "Fallen Forest", glow: 0x665238, trees: 0.85, flies: 0.9, dark: 0.3 },
};

export const BIOME_IDS = Object.keys(BIOMES);

export function hash2(x, z, seed) {
  let n = (seed * 374761393 + x * 668265263 + z * 1274126177) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return (n >>> 0) / 4294967296;
}

/** Altitude bands used by wildlife ecology. */
export function altitudeBand(y) {
  if (y >= 14) return "canopy";
  if (y >= 5) return "mid";
  if (y >= 2) return "understory";
  return "ground";
}

export function wildlifeAltitude(kind) {
  const map = {
    owl: 10,
    crow: 14,
    bat: 9,
    dragonfly: 5,
    mantis: 2.4,
    frog: 1.0,
    snake: 0.5,
    bobcat: 0.6,
    fox: 0.5,
    raccoon: 0.8,
    spider: 3.5,
  };
  return map[kind] ?? 4;
}

/** Near/far tree instance split for LOD. Near keeps collision. */
export function lodTreeSplit(count, farRatio = 0.55) {
  const far = Math.floor(count * farRatio);
  const near = Math.max(0, count - far);
  return { near, far, total: count };
}

export function pickBiome(wx, wz, seed, weights) {
  let total = 0;
  const ids = [];
  const wts = [];
  for (const id of BIOME_IDS) {
    const w = weights[id] ?? 1;
    if (w > 0) {
      ids.push(id);
      wts.push(w);
      total += w;
    }
  }
  if (!ids.length) return "moonlit_grove";
  let t = hash2(wx, wz, seed) * total;
  for (let i = 0; i < ids.length; i++) {
    t -= wts[i];
    if (t <= 0) return ids[i];
  }
  return ids[0];
}
