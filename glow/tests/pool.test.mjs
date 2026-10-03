import test from "node:test";
import assert from "node:assert/strict";
import { createPredatorPool } from "../src/pool.js";

function fakeFactory(kind, pos) {
  return {
    kind,
    home: pos.clone ? pos.clone() : { ...pos, copy(p) { Object.assign(this, p); return this; } },
    root: {
      position: { copy(p) { Object.assign(this, p); } },
      visible: true,
      removeFromParent() {},
    },
    vel: { set() {} },
    trailTarget: { copy() {} },
    state: "roam",
    t: 0,
    interest: 0,
    escaped: false,
  };
}

test("predator pool reuses instances", () => {
  const pos = { x: 1, y: 2, z: 3, copy(p) { Object.assign(this, p); return this; }, clone() { return { ...this, copy: this.copy, clone: this.clone }; } };
  const pool = createPredatorPool(fakeFactory);
  const a = pool.acquire("owl", pos, null);
  const b = pool.acquire("owl", pos, null);
  assert.notEqual(a, b);
  pool.release(a);
  const c = pool.acquire("owl", pos, null);
  assert.equal(c, a);
  const s = pool.stats();
  assert.equal(s.created, 2);
  assert.equal(s.acquired, 3);
  assert.equal(s.released, 1);
});
