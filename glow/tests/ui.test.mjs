import test from "node:test";
import assert from "node:assert/strict";
import { touchOverlayVisible } from "../src/ui.js";

test("touch overlay stays off on title and menus", () => {
  for (const phase of ["title", "custom", "settings", "pause", "dead"]) {
    assert.equal(touchOverlayVisible(phase, true), false);
    assert.equal(touchOverlayVisible(phase, false), false);
  }
});

test("touch overlay is play-only on coarse pointers", () => {
  assert.equal(touchOverlayVisible("play", true), true);
  assert.equal(touchOverlayVisible("play", false), false);
});
