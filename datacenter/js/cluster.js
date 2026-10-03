window.DC = window.DC || {};

DC.Cluster = (function () {

  function get(state, id) { return (state.clusters || []).find((c) => c.id === id) || null; }

  function clusterOf(state, eqId) {
    return (state.clusters || []).find((c) => c.nodes.indexOf(eqId) !== -1 || c.storage === eqId) || null;
  }

  function node(state, cl, role) {
    if (!cl) return null;
    const id = cl.nodes[role === "A" ? 0 : 1];
    return state.eqById[id] || null;
  }

  function storage(state, cl) {
    if (!cl || !cl.storage) return null;
    return state.eqById[cl.storage] || null;
  }

  function assignedLoad(cl, role) {
    return cl.workloads.filter((w) => w.node === role).reduce((a, w) => a + w.load, 0);
  }

  function peerRole(role) { return role === "A" ? "B" : "A"; }

  function startMigration(state, cl, fromRole, auto) {
    if (!cl || cl.migrating) return false;
    const src = node(state, cl, fromRole);
    const dst = node(state, cl, peerRole(fromRole));
    if (!src || !dst || dst.state !== "online") return false;
    if (assignedLoad(cl, fromRole) === 0) return false;
    cl.migrating = { from: fromRole, t: 10 };
    DC.Events.alarm(state, "info", (auto ? "AUTO-FAILOVER: " : "MIGRATING: ") + src.name + " workloads → " + dst.name, src.id);
    DC.Events.stat(state, "migrations", 1);
    return true;
  }

  function migrate(state, clusterId, fromRole) {
    return startMigration(state, get(state, clusterId), fromRole, false);
  }

  function stranded(state, cl) {
    return cl.workloads.some((w) => {
      const n = node(state, cl, w.node);
      return n && n.state !== "online" && n.state !== "booting";
    });
  }

  function status(state, cl) {
    const A = node(state, cl, "A"), B = node(state, cl, "B"), st = storage(state, cl);
    const anyUp = [A, B].some((n) => n && (n.state === "online" || n.state === "booting"));
    if (!anyUp) return "down";
    if (st) {
      const as = DC.Storage.arrayState(st);
      if (as === "lost" || st.controller === "fault") return "down";
      if (as === "critical") return "degraded";
    }
    if (stranded(state, cl)) return "degraded";
    if (cl.migrating) return "degraded";
    return "healthy";
  }

  function isUp(state, cl) { return status(state, cl) !== "down"; }

  function tick(state, dt) {
    for (const cl of state.clusters || []) {
      const A = node(state, cl, "A"), B = node(state, cl, "B");
      for (const [n, role] of [[A, "A"], [B, "B"]]) {
        if (n) {
          const extra = (n.runaway ? 45 : 0) + (n.badPatch ? 30 : 0);
          n.load = DC.Util.clamp((n.baseLoad || 20) + assignedLoad(cl, role) + extra, 5, 100);
        }
      }
      if (cl.migrating) {
        cl.migrating.t -= dt;
        if (cl.migrating.t <= 0) {
          const from = cl.migrating.from;
          const to = peerRole(from);
          cl.workloads.forEach((w) => { if (w.node === from) w.node = to; });
          const dst = node(state, cl, to);
          cl.migrating = null;
          DC.Events.alarm(state, "info", "Cluster " + cl.id + " — workloads now on node " + to, dst ? dst.id : null);
        }
      }
      for (const role of ["A", "B"]) {
        const n = node(state, cl, role);
        const peer = node(state, cl, peerRole(role));
        if (!n || !peer) continue;
        const nDown = n.state === "offline" || n.state === "thermal-shutdown";
        const nStruggling = state.upgrades.includes("LOAD_BALANCER") && n.state === "online" && (n.runaway || n.throttle > 0.5);
        const peerReady = peer.state === "online" && assignedLoad(cl, peerRole(role)) < 75;
        if ((nDown || nStruggling) && assignedLoad(cl, role) > 0 && peerReady) {
          if (startMigration(state, cl, role, true)) break;
        }
      }
    }
  }

  return { get, clusterOf, node, storage, assignedLoad, peerRole, migrate, status, isUp, tick };
})();
