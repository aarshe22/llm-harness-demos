import test from "node:test";
import assert from "node:assert/strict";
import { createAudio, fillBrown, fillCricketBed } from "../src/audio.js";

test("brown noise stays bounded and not silent", () => {
  const d = fillBrown(new Float32Array(2048));
  let max = 0;
  let sum = 0;
  for (const v of d) {
    assert.ok(Number.isFinite(v));
    max = Math.max(max, Math.abs(v));
    sum += Math.abs(v);
  }
  assert.ok(max > 0.001);
  assert.ok(max < 2);
  assert.ok(sum / d.length > 0.0005);
});

test("cricket bed has pulse energy and silence between pulses", () => {
  const sr = 22050;
  const d = fillCricketBed(new Float32Array(sr), sr);
  let max = 0;
  let quiet = 0;
  for (const v of d) {
    assert.ok(Number.isFinite(v));
    max = Math.max(max, Math.abs(v));
    if (Math.abs(v) < 0.002) quiet += 1;
  }
  assert.ok(max > 0.01);
  assert.ok(quiet > d.length * 0.15);
});

test("createAudio exposes unlock/tick and is idle until unlock", () => {
  const a = createAudio();
  assert.equal(typeof a.unlock, "function");
  assert.equal(typeof a.tick, "function");
  assert.equal(typeof a.setMaster, "function");
  assert.equal(a.started(), false);
  a.tick(0.5);
  assert.equal(a.started(), false);
});
