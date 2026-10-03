import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { defaultConfig } from "../src/config.js";
import { createWorld, collideMoth } from "../src/world.js";
import { createMoth } from "../src/moth.js";

test("browser modules parse and a chunk can spawn", () => {
  const scene = new THREE.Scene();
  const moth = createMoth(scene, 1);
  const world = createWorld(scene, defaultConfig(), 1);
  world.stream(moth.root.position);
  assert.ok(world.chunks.size >= 1);
  assert.ok(world.all("trees").length > 0);
  assert.ok(world.all("trees").every((t) => typeof t.pine === "boolean"));
  assert.ok(world.all("trees").every((t) => t.height > 4));
  const solids = world.all("solids");
  assert.equal(solids.length, world.all("trees").length);
  assert.ok(solids.every((s) => s.shape === "cone" || s.shape === "cylinder"));
  assert.ok(solids.every((s) => s.height > 4 && s.radius > 0));
});

test("tree collision is a height-capped cone or cylinder, not an infinite column", () => {
  const moth = { root: { position: new THREE.Vector3(0.1, 2, 0) }, vel: new THREE.Vector3() };
  const world = {
    all(f) {
      if (f === "solids") return [{ pos: new THREE.Vector3(0, 0, 0), radius: 1.5, height: 8, shape: "cylinder" }];
      return [];
    },
  };
  assert.equal(collideMoth(moth, world), "hard");
  moth.root.position.y = 12;
  moth.root.position.x = 0.1;
  assert.equal(collideMoth(moth, world), null);
  moth.root.position.set(0.05, 1, 0);
  world.all = (f) => (f === "solids" ? [{ pos: new THREE.Vector3(0, 0, 0), radius: 4, height: 10, shape: "cone" }] : []);
  assert.equal(collideMoth(moth, world), "hard");
  moth.root.position.set(3.5, 8, 0);
  assert.equal(collideMoth(moth, world), null);
});
