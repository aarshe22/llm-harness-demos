window.DC = window.DC || {};

DC.Power = (function () {
  const cfg = () => DC.CFG;

  function capacity(state) {
    const base = state.racks.length * 2.4 + 2;
    return base * (state.power.capacityGrowth || 1) * cfg().powerCapacity;
  }

  function tick(state, dt) {
    let draw = 0;
    for (const rack of state.racks) {
      let rackDraw = 0;
      for (const eq of rack.equipment) {
        if (eq.type === "server" && eq.state === "online") rackDraw += (eq.power * (0.45 + eq.load / 160)) / 1000;
        else if (eq.type === "storage" && eq.state === "online") rackDraw += 0.55;
        else if (eq.type === "switch" && eq.state === "online") rackDraw += 0.15;
      }
      rack.drawKW = rackDraw;
      draw += rackDraw;
      for (const eq of rack.equipment) {
        if (eq.type === "pdu") {
          eq.loadPct = Math.min(100, Math.round((rackDraw / Math.max(2.2, capacity(state) / state.racks.length)) * 100));
        }
      }
    }
    const cap = capacity(state);
    const pct = DC.Util.clamp((draw / cap) * 100, 0, 150);
    state.metrics.powerPct = Math.round(pct);
    if (pct > state.stats.peakPower) state.stats.peakPower = pct;

    const p = state.power;
    if (p.utility === "ok") {
      p.upsDischarge = Math.max(0, p.upsDischarge - dt * 4);
    } else {
      p.utilityTimer -= dt;
      const ups = state.eqById["UPS-1"];
      const upsCap = ups ? (state.upgrades.includes("BIG_UPS") ? 2.2 : 1) : 1;
      p.upsDischarge += (dt * 100) / (90 * upsCap);
      if (p.upsDischarge >= 100) {
        if (p.generatorRunning) {
          p.upsDischarge = 100;
        } else {
          blackoutRacks(state, dt);
        }
      }
      if (p.utilityTimer <= 0) {
        p.utility = "ok";
        p.upsDischarge = 0;
        for (const rack of state.racks) {
          for (const eq of rack.equipment) {
            if ((eq.type === "server" || eq.type === "storage") && eq.state === "offline") {
              eq.state = "booting";
              eq.busy = { kind: "boot", t: 10 };
            }
          }
        }
        DC.Events.alarm(state, "info", "Utility power restored — equipment rebooting", null);
      }
    }
    for (const g of state.powerUnits) {
      if (g.startup > 0) {
        g.startup -= dt;
        if (g.startup <= 0) {
          g.state = "running";
          p.generatorRunning = true;
          DC.Events.alarm(state, "info", g.name + " online — load supported", g.id);
        }
      }
      if (g.state === "running") {
        g.fuel = Math.max(0, g.fuel - dt * 0.05);
        if (g.fuel <= 0) {
          g.state = "standby";
          p.generatorRunning = state.powerUnits.some((o) => o !== g && o.state === "running");
          DC.Events.alarm(state, "crit", g.name + " OUT OF FUEL — load unsupported", g.id);
        }
      }
    }
  }

  function blackoutRacks(state, dt) {
    for (const rack of state.racks) {
      for (const eq of rack.equipment) {
        if (eq.type === "server" && eq.state === "online") {
          eq.state = "offline";
          DC.Events.alarm(state, "crit", eq.name + " lost power", eq.id);
        }
      }
    }
  }

  function utilityOutage(state, dur) {
    const p = state.power;
    if (p.utility !== "ok") return false;
    p.utility = "out";
    p.utilityTimer = dur;
    DC.Events.alarm(state, "crit", "UTILITY POWER FAILURE — UPS on battery", null);
    DC.Events.stat(state, "powerIncidents", 1);
    for (const g of state.powerUnits) {
      if (g.state === "standby") {
        if (DC.Rng.make(g.id + state.time).chance(0.1)) {
          g.state = "fault";
          DC.Events.alarm(state, "crit", g.name + " failed to start — manual start required", g.id);
        } else {
          g.startup = 9;
          DC.Events.alarm(state, "warn", g.name + " starting...", g.id);
        }
      }
    }
    return true;
  }

  function startGenerator(state, g) {
    if (g.state === "fault") { g.state = "starting"; g.startup = 6; DC.Events.alarm(state, "info", g.name + " manual start...", g.id); return true; }
    if (g.state === "standby") { g.startup = 9; DC.Events.alarm(state, "info", g.name + " starting...", g.id); return true; }
    return false;
  }

  function tripBreaker(state, pdu) {
    if (pdu.tripped) return false;
    pdu.tripped = true;
    const rack = DC.Util.rackOf(state, pdu);
    if (rack) {
      for (const eq of rack.equipment) {
        if (eq.type === "pdu" || eq.type === "switch") continue;
        if (eq.state === "online") {
          if (eq.type === "server" && (eq.psuA === "ok" && eq.psuB === "ok") && state.upgrades.includes("DUAL_FEEDS")) continue;
          eq.state = "offline";
        }
      }
      DC.Events.alarm(state, "crit", rack.name + " PDU breaker tripped — rack unpowered", pdu.id);
      DC.Events.stat(state, "powerIncidents", 1);
    }
    return true;
  }

  function resetBreaker(state, pdu) {
    if (!pdu.tripped) return false;
    const rack = DC.Util.rackOf(state, pdu);
    pdu.tripped = false;
    if (rack) {
      for (const eq of rack.equipment) {
        if ((eq.type === "server" || eq.type === "storage") && eq.state === "offline") {
          eq.state = "booting";
          eq.busy = { kind: "boot", t: 10 };
        }
      }
    }
    DC.Events.alarm(state, "info", (rack ? rack.name : "PDU") + " breaker reset — equipment rebooting", pdu.id);
    DC.Events.resolve(state, pdu.id, "Breaker reset");
    return true;
  }

  return { tick, utilityOutage, tripBreaker, resetBreaker, startGenerator, capacity };
})();
