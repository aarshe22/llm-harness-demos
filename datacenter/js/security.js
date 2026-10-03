window.DC = window.DC || {};

DC.Security = (function () {
  function secState(state) {
    let worst = "NORMAL";
    for (const s of DC.Util.allEq(state).filter((e) => e.type === "server" || e.type === "blade")) {
      if (s.sec === "spreading" || s.sec === "compromised") worst = "CRITICAL";
      else if (s.sec === "suspect" && worst === "NORMAL") worst = "SUSPICIOUS";
    }
    return worst;
  }

  function quarantine(state, srv) {
    if (srv.state !== "online") return false;
    srv.netState = "disconnected";
    srv.sec = "isolated";
    srv.busy = { kind: "clean", t: 14 };
    DC.Events.alarm(state, "info", srv.name + " quarantined — cleaning", srv.id);
    return true;
  }

  function clean(state, srv) {
    if (srv.state !== "online") return false;
    srv.busy = { kind: "clean", t: 14 };
    DC.Events.alarm(state, "info", srv.name + " cleaning...", srv.id);
    return true;
  }

  function reimage(state, srv) {
    srv.busy = { kind: "reimage", t: 20 };
    DC.Events.alarm(state, "info", srv.name + " reimaging...", srv.id);
    return true;
  }

  function containedBeforeSpread(srv) {
    return srv.sec === "isolated" || (srv.sec === "suspect");
  }

  function tick(state, dt) {
    state.metrics.sec = secState(state);
    let healthy = 0, total = 0;
    for (const s of DC.Util.allEq(state).filter((e) => e.type === "server" || e.type === "blade")) {
      total++;
      if (s.sec === "clean") healthy++;
    }
    state.metrics.dataPct = total ? Math.round((healthy / total) * 100) : 100;
  }

  return { tick, quarantine, clean, reimage, secState };
})();
