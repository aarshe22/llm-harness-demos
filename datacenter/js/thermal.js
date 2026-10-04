window.DC = window.DC || {};

DC.Thermal = (function () {
  const U = () => DC.Util;
  const cfg = () => DC.CFG;

  function cracOutput(crac) {
    if (crac.fault) return 0.08;
    return crac.status === "ok" ? 1 : 0.5;
  }

  function hallCooling(state, hall) {
    let cap = 0;
    for (const cid of hall.cracs) {
      const cr = state.eqById[cid];
      if (cr) cap += cracOutput(cr);
    }
    let eff = cfg().coolCapacity;
    if (state.upgrades && state.upgrades.includes("HOT_AISLE")) eff *= 1.25;
    if (state.upgrades && state.upgrades.includes("LIQUID")) eff *= 1.5;
    return cap * eff * 30;
  }

  function heatOf(eq) {
    let heat = 0;
    if (eq.type === "server" && eq.state === "online") {
      const roleDef = DC.ROLES[eq.role] || { heat: 1 };
      heat = 0.3 + (eq.load / 100) * 1.2 * roleDef.heat;
      if (eq.fans !== "ok") heat += 0.5;
    } else if (eq.type === "storage" && eq.state === "online") {
      heat = 0.5;
      if (eq.rebuild) heat += 0.4;
    } else if (eq.type === "switch" && eq.state === "online") {
      heat = 0.2;
    }
    return heat;
  }

  function tick(state, dt) {
    for (const hall of state.halls) {
      const hallRacks = state.racks.filter((r) => r.hall === state.halls.indexOf(hall));
      let heat = 0;
      for (const rack of hallRacks) for (const eq of rack.equipment) heat += heatOf(eq);
      let heatMul = cfg().heatGen;
      if (state.upgrades && state.upgrades.includes("EFF_FANS")) heatMul *= 0.82;
      const cooling = hallCooling(state, hall);
      const target = 21 + (heat * heatMul - cooling) * 0.5;
      const rise = cfg().tempRise;
      hall.temp += DC.Util.clamp(target - hall.temp, -1, 1) * dt * 0.12 * rise;
      hall.temp = U().clamp(hall.temp, 8, 60);
      for (const cid of hall.cracs) {
        const cr = state.eqById[cid];
        if (cr && cr.busy) { cr.busy.t -= dt; if (cr.busy.t <= 0) { finishCrac(state, cr); } }
      }
      for (const rack of hallRacks) rack.temp = hall.temp;
      if (hall.leak) {
        for (const rack of hallRacks) rack.temp += 1.5;
        for (const rack of hallRacks) for (const eq of rack.equipment) if (eq.type === "pdu" && !eq.tripped && Math.random() < dt * 0.004) DC.Power.tripBreaker(state, eq);
      }
    }
    for (const rack of state.racks) {
      for (const eq of rack.equipment) {
        if (eq.type !== "server" && eq.type !== "blade") continue;
        const hall = U().hallOf(state, rack);
        const ambient = hall.temp;
        let tgt = ambient + 8 + (eq.load / 100) * 26;
        if (eq.fans !== "ok") tgt += 12;
        if (eq.rebuild) tgt += 4;
        if (eq.state !== "online") tgt = ambient + 2;
        eq.temp += DC.Util.clamp(tgt - eq.temp, -1, 1) * dt * 0.08;
        eq.temp = DC.Util.clamp(eq.temp, 15, 95);
        if (eq.state === "online") {
          if (eq.temp > 65) eq.throttle = DC.Util.clamp((eq.temp - 65) / 13, 0, 1);
          else eq.throttle = 0;
          // an active repair keeps the box alive — the tech is hands-on
          if (eq.temp > 78 && !(eq.busy && (eq.busy.kind === "repair" || eq.busy.kind === "reseat" || eq.busy.kind === "reimage"))) {
            eq.state = "thermal-shutdown";
            eq.busy = null;
            DC.Events.onThermalShutdown(state, eq);
          }
        }
      }
    }
    state.metrics.temp = state.halls[0] ? state.halls[0].temp : 21.5;
    if (state.metrics.temp > state.stats.peakTemp) state.stats.peakTemp = state.metrics.temp;
    let coolCap = 0, coolNeed = 0;
    for (const cr of state.coolingUnits) { if (!cr.fault) coolCap += cracOutput(cr); else coolCap += 0.08; }
    for (const r of state.racks) for (const e of r.equipment) coolNeed += heatOf(e);
    state.metrics.coolPct = Math.round(DC.Util.clamp((coolCap * cfg().coolCapacity * 30) / Math.max(0.1, coolNeed) * 100, 0, 140));
    if (state.metrics.coolPct > 100) state.metrics.coolPct = 100;
  }

  function finishCrac(state, cr) {
    const action = cr.busy;
    cr.busy = null;
    if (action.kind === "repair") {
      cr.fault = null;
      cr.status = "ok";
      cr.filterDirty = 0;
      DC.Events.resolve(state, cr.id, "Cooling repaired");
      DC.Events.alarm(state, "info", cr.name + " repaired, cooling restored", cr.id);
    } else if (action.kind === "clean") {
      cr.filterDirty = 0;
      cr.status = "ok";
      DC.Events.resolve(state, cr.id, "Filter cleaned");
      DC.Events.alarm(state, "info", cr.name + " filter cleaned", cr.id);
    }
  }

  function failCRAC(state, cr, fault) {
    if (cr.fault) return false;
    cr.fault = fault;
    cr.status = "fault";
    DC.Events.alarm(state, "crit", cr.name + " " + fault.desc, cr.id);
    DC.Events.stat(state, "hvacFailures", 1);
    return true;
  }

  function cracRepairTime(cr) {
    if (!cr.fault) return 0;
    return cr.fault.repair || 8;
  }

  return { tick, failCRAC, cracRepairTime, hallCooling };
})();
