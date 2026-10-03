window.DC = window.DC || {};

DC.Storage = (function () {
  const cfg = () => DC.CFG;

  function redLevel(raid) {
    return raid === 1 || raid === 10 ? 1 : raid === 5 ? 1 : 2;
  }

  function failedCount(st) { return st.drives.filter((d) => d.state === "failed" || d.state === "missing").length; }

  function arrayState(st) {
    const failed = failedCount(st);
    if (failed === 0) return "ok";
    if (failed < redLevel(st.raid)) return "degraded";
    if (failed < redLevel(st.raid) + 1) return "critical";
    return "lost";
  }

  function tick(state, dt) {
    const allStor = DC.Util.allEq(state, "storage");
    if (allStor.length) {
      let healthy = 0;
      for (const st of allStor) {
        const as = arrayState(st);
        if (as === "ok" && st.controller === "ok") healthy++;
      }
      state.metrics.dataPct = Math.round((healthy / allStor.length) * 100);
    }
    for (const st of allStor) {
      if (st.controller === "ok" && st.state === "online") {
        for (const d of st.drives) {
          if (d.state === "ok") {
          const ageR = 0.00004 * (1 + (st.age || 0.2)) * cfg().driveFail;
          if (Math.random() < ageR * dt) DC.Storage.failDrive(state, st, st.drives.indexOf(d));
          }
        }
      }
      if (st.rebuild) {
        const rIdx = st.rebuild.idx;
        const d = st.drives[rIdx];
        if (!d || d.state !== "rebuilding") { st.rebuild = null; }
        else {
          let speed = 2.2 * cfg().rebuildSpeed;
          if (state.upgrades.includes("NVME")) speed *= 1.6;
          if (state.upgrades.includes("REBUILD_CTRL")) speed *= 1.4;
          const rack = DC.Util.rackOf(state, st);
          if (rack && rack.temp > 30) speed *= 0.6;
          d.rebuild += speed * dt;
          if (d.rebuild >= 100) {
            d.state = "ok";
            d.rebuild = 0;
            st.rebuild = null;
            DC.Events.alarm(state, "info", st.name + " rebuild complete", st.id);
          }
        }
      }
      if (st.busy) {
        st.busy.t -= dt;
        if (st.busy.t <= 0) {
          const kind = st.busy.kind;
          st.busy = null;
          if (kind === "ctrl-reset") { st.controller = "ok"; DC.Events.resolve(state, st.id, "Controller reset"); DC.Events.alarm(state, "info", st.name + " controller reset complete", st.id); }
          else if (kind === "ctrl-replace") { st.controller = "ok"; DC.Events.resolve(state, st.id, "Controller replaced"); DC.Events.alarm(state, "info", st.name + " controller replaced", st.id); }
        }
      }
    }
  }

  function replaceDrive(state, st, idx) {
    const d = st.drives[idx];
    if (!d || (d.state !== "failed" && d.state !== "warn" && d.state !== "missing")) return false;
    const wasWarn = d.state === "warn";
    const wasFailed = d.state === "failed";
    const before = arrayState(st);
    d.state = "rebuilding";
    d.rebuild = 0;
    st.rebuild = { idx: idx };
    DC.Events.stat(state, "drivesReplaced", 1);
    if (wasWarn) {
      DC.Events.prevent(state, "Predictive drive replaced", 8);
    }
    if (wasFailed && before === "critical") DC.Events.stat(state, "arraysSaved", 1);
    DC.Events.resolve(state, st.id, "Drive replaced");
    DC.Events.alarm(state, "info", st.name + " drive " + (idx + 1) + " replacement started", st.id);
    return true;
  }

  function dataLoss(state, st) {
    st.drives.forEach((d) => { if (d.state === "failed") { d.state = "missing"; } });
    DC.Events.dataLoss(state, st.name + " array failure — data lost", st.id);
  }

  function failDrive(state, st, idx) {
    const d = st.drives[idx];
    if (!d || d.state !== "ok") return false;
    d.state = "failed";
    const as = arrayState(st);
    DC.Events.alarm(state, "crit", st.name + " drive " + (idx + 1) + " FAILED — array " + as.toUpperCase(), st.id);
    if (as === "lost") dataLoss(state, st);
    return true;
  }

  function warnDrive(state, st, idx) {
    let d;
    if (idx !== undefined && st.drives[idx] && st.drives[idx].state === "ok") d = st.drives[idx];
    else {
      const oks = st.drives.filter((d2) => d2.state === "ok");
      if (!oks.length) return false;
      d = oks[Math.floor(Math.random() * oks.length)];
    }
    d.state = "warn";
    DC.Events.alarm(state, "warn", st.name + " drive " + (st.drives.indexOf(d) + 1) + " predictive failure", st.id);
    return true;
  }

  return { tick, replaceDrive, failDrive, warnDrive, arrayState, failedCount, redLevel };
})();
