import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { defaultConfig } from "../src/config.js";
import { createWorld } from "../src/world.js";
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
});
