import test from "node:test";
import assert from "node:assert/strict";
import { detectionScore, trailInterest, finalScore, overglowReady, pickBiome, lodTreeSplit, altitudeBand, wildlifeAltitude, clampFidelity, fidelityProfile, stepCruiseAltitude, mothTrackWave, mothFlightY, treeCollider, treeHitRadius, hitsTree, MOTH_HIT_R } from "../src/rules.js";
import { defaultConfig, SLIDER_DEFS, applySliderPatch, readSliderValue } from "../src/config.js";
test("moth holds cruise altitude; pitch does not sink", () => {
  const start = 8;
  assert.equal(stepCruiseAltitude(start, 0, 1 / 60, 10), start);
  assert.equal(stepCruiseAltitude(start, 0, 2, 10), start);
  const up = stepCruiseAltitude(start, 1, 0.5, 10);
  const down = stepCruiseAltitude(start, -1, 0.5, 10);
  assert.ok(up > start);
  assert.ok(down < start);
  assert.equal(stepCruiseAltitude(0, -1, 1, 10), 0.6);
  assert.equal(stepCruiseAltitude(80, 1, 1, 10), 42);
});

test("flight track wave is mean-zero and undulates", () => {
  assert.equal(mothTrackWave(0, 0, 0), 0);
  const amp = 0.42;
  let sum = 0;
  let lo = Infinity;
  let hi = -Infinity;
  const n = 240;
  for (let i = 0; i < n; i++) {
    const w = mothTrackWave(i * 0.4, i / 60, amp);
    sum += w;
    lo = Math.min(lo, w);
    hi = Math.max(hi, w);
  }
  assert.ok(hi > amp * 0.5);
  assert.ok(lo < -amp * 0.5);
  assert.ok(Math.abs(sum / n) < amp * 0.2);
  const y0 = mothFlightY(8, 0, 0, amp);
  const y1 = mothFlightY(8, 3, 1, amp);
  assert.notEqual(y0, y1);
  assert.ok(Math.abs(y0 - 8) <= amp * 1.4);
});

test("detection falls off with distance", () => {
  const near = detectionScore(8, 34, 1, 1, 1.3, true, 1);
  const far = detectionScore(40, 34, 1, 1, 1.3, true, 1);
  assert.ok(near > 0.2);
  assert.equal(far, 0);
});

test("dim glow is harder to see", () => {
  const bright = detectionScore(12, 34, 1.5, 1, 1.3, true, 1);
  const dim = detectionScore(12, 34, 0.15, 1, 1.3, true, 1);
  assert.ok(bright > dim * 4);
});

test("trail interest is a product", () => {
  assert.equal(trailInterest(1, 1, 1, 1, 1), 1);
  assert.ok(trailInterest(0.2, 0.2, 1, 1, 1) < 0.05);
});

test("scoring and overglow", () => {
  assert.ok(finalScore(10, 30, 50, 2, 1, 1) > 200);
  assert.equal(overglowReady(8, 1), true);
  assert.equal(overglowReady(3, 1), false);
});

test("LOD split preserves tree count", () => {
  const s = lodTreeSplit(20);
  assert.equal(s.near + s.far, 20);
  assert.ok(s.near > 0 && s.far > 0);
});

test("altitude ecology bands", () => {
  assert.equal(altitudeBand(16), "canopy");
  assert.equal(altitudeBand(8), "mid");
  assert.equal(altitudeBand(3), "understory");
  assert.equal(altitudeBand(0.8), "ground");
  assert.ok(wildlifeAltitude("owl") > wildlifeAltitude("bobcat"));
});

test("custom sliders cover config and biome weights", () => {
  assert.ok(SLIDER_DEFS.length >= 40);
  const cfg = defaultConfig();
  applySliderPatch(cfg, { tree_density: 2.5, "bw.blackwood": 2 });
  assert.equal(cfg.tree_density, 2.5);
  assert.equal(readSliderValue(cfg, "bw.blackwood"), 2);
});

test("fidelity multiplier clamps to 1–8 and defaults to 1", () => {
  assert.equal(clampFidelity(undefined), 1);
  assert.equal(clampFidelity(null), 1);
  assert.equal(clampFidelity("nope"), 1);
  assert.equal(clampFidelity(0), 1);
  assert.equal(clampFidelity(-3), 1);
  assert.equal(clampFidelity(1), 1);
  assert.equal(clampFidelity(4.4), 4);
  assert.equal(clampFidelity(4.6), 5);
  assert.equal(clampFidelity(8), 8);
  assert.equal(clampFidelity(9), 8);
  assert.equal(clampFidelity("3"), 3);
});

test("x1 forest meshes are defined; x8 is denser", () => {
  const cheap = fidelityProfile(1);
  const rich = fidelityProfile(8);
  assert.equal(cheap.level, 1);
  assert.ok(cheap.treeNearSeg >= 14);
  assert.ok(cheap.floorSeg >= 16);
  assert.equal(cheap.treeCanopy, true);
  assert.equal(cheap.plantShapes, true);
  assert.equal(cheap.predParts, true);
  assert.equal(cheap.predWings, true);
  assert.equal(cheap.mothWings, 4);
  assert.equal(cheap.mothAbdomen, true);
  assert.notEqual(cheap.mothWingGeo, "plane");
  assert.ok(rich.treeNearSeg > cheap.treeNearSeg);
  assert.ok(rich.mothBodySeg > cheap.mothBodySeg);
  assert.ok(rich.floorSeg > cheap.floorSeg);
  assert.ok(rich.barkDetail > cheap.barkDetail);
  assert.ok(rich.bloomBoost > cheap.bloomBoost);
});

test("tree colliders are cones for pine and cylinders for fern, height-aware", () => {
  const pine = treeCollider(true, 0.5, 12);
  const fern = treeCollider(false, 0.5, 10);
  assert.equal(pine.shape, "cone");
  assert.equal(fern.shape, "cylinder");
  assert.equal(pine.height, 12);
  assert.ok(pine.radius > fern.radius);
  assert.equal(treeHitRadius("cone", 4, 10, -0.1), 0);
  assert.equal(treeHitRadius("cone", 4, 10, 11), 0);
  assert.equal(treeHitRadius("cone", 4, 10, 0), 4);
  assert.ok(Math.abs(treeHitRadius("cone", 4, 10, 5) - 2) < 1e-9);
  assert.equal(treeHitRadius("cylinder", 1.5, 8, 4), 1.5);
  assert.equal(treeHitRadius("cylinder", 1.5, 8, 9), 0);
  assert.ok(hitsTree(0, 0, 1, MOTH_HIT_R));
  assert.equal(hitsTree(4, 0, 1, MOTH_HIT_R), false);
  assert.equal(hitsTree(0.2, 0, 0, MOTH_HIT_R), false);
});

test("biome pick is deterministic", () => {
  const w = defaultConfig().biome_weights;
  const a = pickBiome(3, 5, 170403, w);
  const b = pickBiome(3, 5, 170403, w);
  assert.equal(a, b);
  assert.notEqual(pickBiome(3, 5, 1, w), undefined);
});
