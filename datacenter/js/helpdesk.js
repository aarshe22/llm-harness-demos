window.DC = window.DC || {};

DC.Helpdesk = (function () {
  const cfg = () => DC.CFG;

  function svcSeverity(state, svc) {
    if (svc.state === "offline") return 1;
    if (svc.state === "major-outage") return 1;
    if (svc.state === "partial-outage") return 0.6;
    if (svc.state === "degraded") return 0.3;
    return 0;
  }

  function evalServices(state, dt) {
    for (const svc of state.services) {
      let servers = [], storage = [], switches = [];
      for (const depId of svc.deps) {
        const eq = state.eqById[depId];
        if (!eq) continue;
        if (eq.type === "server") servers.push(eq);
        else if (eq.type === "storage") storage.push(eq);
        else if (eq.type === "switch") switches.push(eq);
      }
      const onlineServers = servers.filter((s) => s.state === "online" && DC.Network.netHealth(state, s) !== "down").length;
      const storOk = storage.every((s) => DC.Storage.arrayState(s) !== "lost" && s.controller === "ok" && (s.usedPct === undefined || s.usedPct < 100));
      const swOk = switches.every((s) => s.state === "online");
      let hot = 0;
      for (const s of servers) if (s.throttle > 0.2) hot++;
      const badPatched = servers.some((s) => s.badPatch);
      let newState;
      if (servers.length === 0) newState = "healthy";
      else if (onlineServers === 0) newState = "offline";
      else if (onlineServers < servers.length) newState = "partial-outage";
      else if (!storOk || !swOk) newState = "degraded";
      else if (hot === servers.length) newState = "degraded";
      else if (badPatched) newState = "degraded";
      else newState = "healthy";
      if (newState !== "healthy" && svc.state === "healthy") svc.outageSince = state.time;
      if (newState === "healthy" && svc.state !== "healthy") svc.outageSince = 0;
      svc.state = newState;
      if (newState !== "healthy") svc.outageTotal += dt;
      svc.degradedSince = newState === "degraded" ? svc.degradedSince + dt : 0;
    }
  }

  function ticketRate(state, svc) {
    const sev = svcSeverity(state, svc);
    if (sev <= 0) return 0;
    const dur = state.time - (svc.outageSince || state.time);
    let esc = 1 + Math.min(4, dur / 25) * cfg().ticketEscalation;
    const r = (svc.customers / 1200) * svc.crit * sev * esc * 0.015 * cfg().ticketGen;
    return r;
  }

  function tick(state, dt) {
    evalServices(state, dt);
    let open = 0;
    for (const svc of state.services) {
      const rate = ticketRate(state, svc);
      if (rate > 0) {
        svc.openTickets += rate * dt;
        state.tickets.stats.total += rate * dt;
        if (Math.random() < rate * dt * 2) {
          pushRecent(state, svc);
          DC.Events.ticketChirp();
        }
      } else if (svc.openTickets > 0) {
        const clear = Math.max(0.6, svc.openTickets * 0.5) * cfg().ticketClear;
        const resolved = Math.min(svc.openTickets, clear * dt);
        svc.openTickets = Math.max(0, svc.openTickets - resolved);
        state.tickets.stats.resolved += resolved;
        if (svc.openTickets < 0.05) svc.openTickets = 0;
        if (svc.openTickets === 0) svc.lastClear = state.time;
      }
      state.tickets.perService[svc.name] = Math.floor(svc.openTickets);
      open += svc.openTickets;
    }
    state.tickets.open = Math.floor(open);
    if (state.tickets.open > state.tickets.peak) state.tickets.peak = state.tickets.open;
    if (state.tickets.open > state.tickets.stats.worst) state.tickets.stats.worst = state.tickets.open;
    if (state.tickets.open > 120) state.metrics.sla = Math.max(80, state.metrics.sla - dt * 0.005);
  }

  function pushRecent(state, svc) {
    const flavor = DC.TICKET_FLAVOR[svc.name] || DC.GENERIC_COMPLAINTS;
    const msg = flavor[Math.floor(Math.random() * flavor.length)];
    state.tickets.recent.unshift("[" + svc.name + "] " + msg);
    if (state.tickets.recent.length > 8) state.tickets.recent.pop();
  }

  function resolveServiceTickets(state, svc) {
    return svc.openTickets;
  }

  return { tick, ticketRate, svcSeverity, evalServices };
})();
