import test from "node:test";
import assert from "node:assert/strict";
import { detectionScore, trailInterest, finalScore, overglowReady, pickBiome, lodTreeSplit, altitudeBand, wildlifeAltitude } from "../src/rules.js";
import { defaultConfig, SLIDER_DEFS, applySliderPatch, readSliderValue } from "../src/config.js";

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

test("biome pick is deterministic", () => {
  const w = defaultConfig().biome_weights;
  const a = pickBiome(3, 5, 170403, w);
  const b = pickBiome(3, 5, 170403, w);
  assert.equal(a, b);
  assert.notEqual(pickBiome(3, 5, 1, w), undefined);
});
