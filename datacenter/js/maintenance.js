window.DC = window.DC || {};

DC.Maintenance = (function () {

  const OS_TASKS = [
    { name: "OS SECURITY PATCH", t: 14, bad: 0.10 },
    { name: "KERNEL UPDATE", t: 20, bad: 0.14 },
    { name: "FIRMWARE UPDATE", t: 24, bad: 0.16 },
    { name: "CONTAINER RUNTIME UPDATE", t: 16, bad: 0.10 }
  ];
  const APP_TASKS = [
    { name: "APP HOTFIX", t: 10, bad: 0.12 },
    { name: "DB SCHEMA MIGRATION", t: 22, bad: 0.18 },
    { name: "TLS CERT ROTATION", t: 8, bad: 0.08 },
    { name: "CACHE LIBRARY UPDATE", t: 12, bad: 0.10 }
  ];
  const CRAC_TASKS = [
    { name: "FAN BEARING SERVICE", t: 14 },
    { name: "COOLANT PRESSURE SERVICE", t: 18 },
    { name: "COMPRESSOR SERVICE", t: 22 },
    { name: "INTAKE FILTER SERVICE", t: 10 }
  ];

  function initState(state) {
    state.maintenance = {
      seq: 0,
      items: [],
      nextOS: 100 + Math.random() * 120,
      nextApp: 160 + Math.random() * 140,
      nextCrac: 220 + Math.random() * 200,
      nextGen: 320 + Math.random() * 300,
      nextMains: 420 + Math.random() * 420,
      mainsWarned: false,
      mainsTimer: 0
    };
    const ups = state.eqById["UPS-1"];
    if (ups && !ups.batteries) {
      ups.batteries = [];
      for (let i = 0; i < 8; i++) ups.batteries.push({ health: 60 + Math.random() * 40, warned: false, dead: false });
    }
    for (const cr of state.coolingUnits) if (cr.wear === undefined) cr.wear = Math.random() * 0.3;
    for (const g of state.powerUnits) if (g.health === undefined) g.health = 100;
  }

  function onlineServers(state) {
    return DC.Util.allEq(state, "server").filter((s) => s.state === "online" && !s.maint);
  }

  function push(state, item) {
    item.id = "MT" + (++state.maintenance.seq);
    state.maintenance.items.push(item);
    if (state.maintenance.items.length > 40) state.maintenance.items = state.maintenance.items.filter((i) => i.state !== "done").concat(state.maintenance.items.filter((i) => i.state === "done").slice(-8));
    return item;
  }

  function schedule(state, dt) {
    const m = state.maintenance;
    m.nextOS -= dt;
    m.nextApp -= dt;
    m.nextCrac -= dt;
    m.nextGen -= dt;
    m.nextMains -= dt;

    if (m.nextOS <= 0) {
      m.nextOS = 140 + Math.random() * 260;
      const srvs = onlineServers(state);
      if (srvs.length) {
        const srv = srvs[Math.floor(Math.random() * srvs.length)];
        const t = OS_TASKS[Math.floor(Math.random() * OS_TASKS.length)];
        push(state, { kind: "os", name: t.name, t: t.t, t0: t.t, badChance: t.bad, targetId: srv.id, state: "pending", overdue: 0 });
        DC.Events.alarm(state, "info", "MAINTENANCE WINDOW: " + t.name + " available on " + srv.name, srv.id);
      }
    }
    if (m.nextApp <= 0) {
      m.nextApp = 170 + Math.random() * 240;
      const srvs = onlineServers(state);
      if (srvs.length) {
        const srv = srvs[Math.floor(Math.random() * srvs.length)];
        const t = APP_TASKS[Math.floor(Math.random() * APP_TASKS.length)];
        push(state, { kind: "app", name: t.name, t: t.t, t0: t.t, badChance: t.bad, targetId: srv.id, state: "pending", overdue: 0 });
        DC.Events.alarm(state, "info", "MAINTENANCE WINDOW: " + t.name + " available on " + srv.name, srv.id);
      }
    }
    if (m.nextCrac <= 0) {
      m.nextCrac = 260 + Math.random() * 260;
      const cracs = state.coolingUnits.filter((c) => !c.fault && !c.maint);
      if (cracs.length) {
        const cr = cracs[Math.floor(Math.random() * cracs.length)];
        const t = CRAC_TASKS[Math.floor(Math.random() * CRAC_TASKS.length)];
        push(state, { kind: "crac", name: t.name, t: t.t, t0: t.t, targetId: cr.id, state: "pending", overdue: 0 });
        DC.Events.alarm(state, "info", "COOLING MAINTENANCE available: " + t.name + " on " + cr.name, cr.id);
      }
    }
    if (m.nextGen <= 0) {
      m.nextGen = 340 + Math.random() * 320;
      const gens = state.powerUnits.filter((g) => !g.busy);
      if (gens.length) {
        const g = gens[Math.floor(Math.random() * gens.length)];
        const fuelLow = g.fuel < 60;
        push(state, { kind: fuelLow ? "refuel" : "gen-service", name: fuelLow ? "REFUEL" : "TEST RUN & SERVICE", t: fuelLow ? 8 : 16, t0: fuelLow ? 8 : 16, targetId: g.id, state: "pending", overdue: 0 });
        DC.Events.alarm(state, "info", "GENERATOR MAINTENANCE due: " + g.name, g.id);
      }
    }
    if (m.nextMains <= 0 && !m.mainsTimer) {
      m.mainsTimer = 20;
      m.mainsWarned = true;
      DC.Events.alarm(state, "warn", "UTILITY: grid operator scheduled feed maintenance in 20s — expect outage", null);
    }
    if (m.mainsTimer > 0) {
      m.mainsTimer -= dt;
      if (m.mainsTimer <= 0) {
        m.mainsTimer = 0;
        m.mainsWarned = false;
        DC.Power.utilityOutage(state, 25 + Math.random() * 35);
        m.nextMains = 500 + Math.random() * 500;
      }
    }
  }

  function apply(state, itemId) {
    const item = state.maintenance.items.find((i) => i.id === itemId && i.state === "pending");
    if (!item) return false;
    return activate(state, item);
  }

  function startDirect(state, kind, targetId) {
    const eq = state.eqById[targetId];
    if (!eq && kind !== "battery") return false;
    let pool, extra = {}, tid = targetId;
    if (kind === "os") pool = OS_TASKS;
    else if (kind === "app") pool = APP_TASKS;
    else if (kind === "crac") pool = CRAC_TASKS;
    else if (kind === "refuel") pool = [{ name: "REFUEL", t: 8, bad: 0 }];
    else if (kind === "gen-service") pool = [{ name: "TEST RUN & SERVICE", t: 16, bad: 0 }];
    else if (kind === "battery") { pool = [{ name: "REPLACE BATTERY", t: 6, bad: 0 }]; extra.battIdx = targetId.battIdx; tid = "UPS-1"; }
    if (!pool) return false;
    const t = pool[Math.floor(Math.random() * pool.length)];
    const item = push(state, { kind, name: t.name, t: t.t, t0: t.t, badChance: t.bad || 0, targetId: tid, state: "pending", overdue: 0 });
    Object.assign(item, extra);
    return activate(state, item);
  }

  function activate(state, item) {
    const eq = state.eqById[item.targetId];
    if (item.kind === "os" || item.kind === "app") {
      if (!eq || eq.state !== "online" || eq.maint) return false;
      eq.maint = { name: item.name, t: item.t, t0: item.t0 };
    } else if (item.kind === "crac") {
      if (!eq || eq.fault || eq.maint) return false;
      eq.maint = { name: item.name, t: item.t, t0: item.t0 };
    }
    item.state = "active";
    return true;
  }

  function complete(state, item) {
    const eq = state.eqById[item.targetId];
    item.state = "done";
    // on-time maintenance builds rep; dragging your feet on planned work erodes it
    if (item.overdue > 60) {
      state.metrics.rep = Math.max(0, state.metrics.rep - Math.min(2, item.overdue / 100) * DC.CFG.repLoss);
      DC.Events.emit("toast", state, item.name + " DONE LATE — rep hit", "info");
    } else if (item.overdue > 5) {
      state.metrics.rep = Math.min(100, state.metrics.rep + 0.3 * DC.CFG.repGain);
    } else {
      state.metrics.rep = Math.min(100, state.metrics.rep + 0.6 * DC.CFG.repGain);
    }
    if (item.kind === "os" || item.kind === "app") {
      if (!eq) return;
      delete eq.maint;
      if (Math.random() < (item.badChance || 0)) {
        eq.badPatch = true;
        DC.Events.stat(state, "badPatches", 1);
        DC.Events.alarm(state, "crit", item.name + " FAILED on " + eq.name + " — services unstable, RECOVER required", eq.id);
      } else {
        DC.Events.stat(state, "patches", 1);
        DC.Events.alarm(state, "info", item.name + " applied on " + eq.name, eq.id);
      }
    } else if (item.kind === "crac") {
      if (!eq) return;
      delete eq.maint;
      eq.wear = 0;
      eq.filterDirty = 0;
      DC.Events.resolve(state, eq.id, "Serviced");
      DC.Events.alarm(state, "info", eq.name + " " + item.name.toLowerCase() + " complete", eq.id);
    } else if (item.kind === "refuel") {
      if (eq) { eq.fuel = 100; DC.Events.alarm(state, "info", eq.name + " refuelled", eq.id); }
    } else if (item.kind === "gen-service") {
      if (eq) { eq.health = 100; DC.Events.alarm(state, "info", eq.name + " serviced — reliability restored", eq.id); }
    } else if (item.kind === "battery") {
      const ups = state.eqById["UPS-1"];
      if (ups && ups.batteries && ups.batteries[item.battIdx] !== undefined) {
        ups.batteries[item.battIdx] = { health: 100, warned: false, dead: false };
        DC.Events.stat(state, "batteriesReplaced", 1);
        DC.Events.alarm(state, "info", "UPS battery string " + (item.battIdx + 1) + " replaced", "UPS-1");
      }
    }
  }

  function batteryStress(state) {
    const ups = state.eqById["UPS-1"];
    if (!ups || !ups.batteries || !ups.batteries.length) return;
    const alive = ups.batteries.filter((b) => !b.dead);
    if (!alive.length) return;
    const b = alive[Math.floor(Math.random() * alive.length)];
    b.health = Math.max(0, b.health - 25);
    DC.Events.alarm(state, "warn", "UPS battery string " + (ups.batteries.indexOf(b) + 1) + " health " + Math.round(b.health) + "% — replacement recommended", "UPS-1");
  }

  function upsFactor(state) {
    const ups = state.eqById["UPS-1"];
    if (!ups || !ups.batteries || !ups.batteries.length) return 1;
    let healthy = 0;
    for (const b of ups.batteries) {
      if (b.dead) continue;
      healthy += DC.Util.clamp(b.health / 100, 0, 1);
    }
    return 0.25 + 0.75 * (healthy / ups.batteries.length);
  }

  function tick(state, dt) {
    const m = state.maintenance;
    if (!m) return;
    schedule(state, dt);

    for (const item of m.items) {
      if (item.state === "pending") {
        item.overdue += dt;
        if (item.overdue > 150 && !item.warned) {
          item.warned = true;
          DC.Events.alarm(state, "warn", "MAINTENANCE OVERDUE: " + item.name, item.targetId);
        }
      } else if (item.state === "active") {
        item.t -= dt;
        const eq = state.eqById[item.targetId];
        if (eq && eq.maint) eq.maint.t = item.t;
        if (item.kind === "os" || item.kind === "app") {
          if (!eq || eq.state !== "online") { item.state = "pending"; item.overdue = 0; if (eq) delete eq.maint; continue; }
        }
        if (item.t <= 0) complete(state, item);
      }
    }
    m.items = m.items.filter((i) => i.state !== "done");

    const ups = state.eqById["UPS-1"];
    if (ups && ups.batteries) {
      ups.batteries.forEach((b, i) => {
        if (b.dead) return;
        b.health -= dt * 0.012;
        if (b.health <= 30 && !b.warned) {
          b.warned = true;
          DC.Events.alarm(state, "warn", "UPS battery string " + (i + 1) + " degraded (" + Math.round(b.health) + "%) — replace soon", "UPS-1");
        }
        if (b.health <= 0) {
          b.dead = true;
          DC.Events.alarm(state, "crit", "UPS BATTERY STRING " + (i + 1) + " DEAD — runtime reduced, replace battery", "UPS-1");
        }
      });
    }
    for (const cr of state.coolingUnits) {
      cr.wear = Math.min(1, (cr.wear || 0) + dt * 0.0012);
      if (cr.wear > 0.75 && !cr.fault && !cr.maint && Math.random() < dt * 0.0016) {
        DC.Thermal.failCRAC(state, cr, { key: "wear", desc: "wear fault — service overdue", repair: 12 });
      }
    }
    for (const g of state.powerUnits) {
      if (g.health === undefined) g.health = 100;
      g.health = Math.max(25, g.health - dt * 0.004);
    }
  }

  function pendingCount(state) {
    if (!state.maintenance) return 0;
    return state.maintenance.items.filter((i) => i.state !== "done").length;
  }

  return { initState, tick, apply, startDirect, replaceBattery: (state, i) => startDirect(state, "battery", { id: "UPS-1", battIdx: i }), batteryStress, upsFactor, pendingCount, refuel: (state, id) => startDirect(state, "refuel", id) };
})();
