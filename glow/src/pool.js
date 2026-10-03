/** Reuse predator instances instead of allocating per chunk / event. */

export function createPredatorPool(factory) {
  const free = new Map();
  let created = 0;
  let acquired = 0;
  let released = 0;

  function list(kind) {
    if (!free.has(kind)) free.set(kind, []);
    return free.get(kind);
  }

  function acquire(kind, pos, parent) {
    const bucket = list(kind);
    let p = bucket.pop();
    if (!p) {
      p = factory(kind, pos);
      created += 1;
    }
    p.kind = kind;
    p.home.copy(pos);
    p.root.position.copy(pos);
    p.vel.set(0, 0, 0);
    p.state = kind === "owl" ? "perch" : "roam";
    p.t = 0;
    p.interest = 0;
    p.escaped = false;
    p.trailTarget.copy(pos);
    p.root.visible = true;
    if (parent) parent.add(p.root);
    acquired += 1;
    return p;
  }

  function release(p) {
    if (!p) return;
    p.root.visible = false;
    p.root.removeFromParent();
    p.interest = 0;
    p.state = "idle";
    list(p.kind).push(p);
    released += 1;
  }

  function stats() {
    let idle = 0;
    for (const b of free.values()) idle += b.length;
    return { created, acquired, released, idle };
  }

  return { acquire, release, stats };
}
