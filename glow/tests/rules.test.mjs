import test from "node:test";
import assert from "node:assert/strict";
import { detectionScore, trailInterest, finalScore, overglowReady, pickBiome } from "../src/rules.js";
import { defaultConfig } from "../src/config.js";

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

test("biome pick is deterministic", () => {
  const w = defaultConfig().biome_weights;
  const a = pickBiome(3, 5, 170403, w);
  const b = pickBiome(3, 5, 170403, w);
  assert.equal(a, b);
  assert.notEqual(pickBiome(3, 5, 1, w), undefined);
});
