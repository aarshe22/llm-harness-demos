window.DC = window.DC || {};

DC.Growth = (function () {
  const cfg = () => DC.CFG;

  function serviceHealthPct(state) {
    let ok = 0;
    for (const s of state.services) if (s.state === "healthy") ok++;
    return state.services.length ? ok / state.services.length : 1;
  }

  function tick(state, dt) {
    const m = state.metrics;
    // "keeping on top of it": no unresolved alarms, few open tickets.
    // busy-but-handled (Dave working jobs) still counts as clean.
    const clean = DC.Incidents.activeLoad(state) === 0 && state.tickets.open < 8;

    if (clean) {
      state.growth.cleanTime += dt;
      state.stats.longestClean = Math.max(state.stats.longestClean, state.growth.cleanTime);
    } else state.growth.cleanTime = 0;

    // ---- reputation: responsive to operator performance ----
    // build: clean operations, healthy services, and completed work all lift rep.
    const allSvc = state.services;
    const healthyFrac = allSvc.length ? allSvc.filter((s) => s.state === "healthy").length / allSvc.length : 1;
    const repRate = (0.02 + (m.sla - 95) * 0.004 + healthyFrac * 0.025) * cfg().repGain;
    if (clean) m.rep = Math.min(100, m.rep + repRate * dt);
    else if (m.rep > 40 && healthyFrac > 0.5) m.rep = Math.min(100, m.rep + repRate * 0.4 * dt);
    // drain: ticket pressure
    if (state.tickets.open > 30) m.rep = Math.max(0, m.rep - dt * 0.02 * cfg().repLoss);
    if (state.tickets.open > 80) m.rep = Math.max(0, m.rep - dt * 0.06 * cfg().repLoss);
    // drain: overdue maintenance (slow response to planned work)
    if (state.maintenance) {
      let over = 0;
      for (const it of state.maintenance.items) if (it.state === "pending") over += Math.min(4, it.overdue / 60);
      if (over > 0) m.rep = Math.max(0, m.rep - over * dt * 0.004 * cfg().repLoss);
    }

    let outageWeight = 0;
    for (const svc of state.services) {
      if (svc.state === "offline") outageWeight += svc.crit;
      else if (svc.state === "partial-outage") outageWeight += svc.crit * 0.4;
      state.stats.impactTime += svc.state === "offline" ? dt : 0;
    }
    if (outageWeight > 0) m.rep = Math.max(0, m.rep - outageWeight * dt * 0.05 * cfg().repLoss);

    const demandTarget = DC.Util.clamp((m.rep - 40) * 1.6, 0, 100);
    m.demand += DC.Util.clamp(demandTarget - m.demand, -1, 1) * dt * 0.1 * cfg().demandGrowth * (state.dna.growthRate || 1);
    m.demand = DC.Util.clamp(m.demand, 0, 100);

    const growthFactor = clean ? 1 : (m.rep > 40 ? 0.5 : -0.2);
    const custDelta = m.customers * 0.00012 * growthFactor * cfg().customerGrowth * (state.dna.growthRate || 1) * dt;
    m.customers = Math.max(100, Math.round(m.customers + custDelta));
    if (m.customers > state.growth.customersPeak) state.growth.customersPeak = m.customers;

    const totalSec = Math.max(1, state.time);
    const downWeight = state.services.reduce((a, s) => a + (s.state === "offline" ? 1 : s.state === "partial-outage" ? 0.4 : s.state === "degraded" ? 0.1 : 0) * s.crit, 0);
    const slaTarget = 99.99 - Math.min(9.99, (downWeight / state.services.length) * 25);
    m.sla += DC.Util.clamp(slaTarget - m.sla, -0.05, 0.002) * dt * 0.05;

    m.score += dt * (m.customers / 900) * (0.4 + m.rep / 160) * (m.sla / 100);
    m.uptime += dt;
    m.serversTotal = DC.Util.allEq(state, "server").length;
    m.serversOnline = DC.Util.allEq(state, "server").filter((s) => s.state === "online").length;

    let worstCollapse = 0;
    if (m.rep < 15) worstCollapse = Math.max(worstCollapse, (15 - m.rep) / 15);
    if (m.sla < 90) worstCollapse = Math.max(worstCollapse, (90 - m.sla) / 20);
    if (state.tickets.open > 250) worstCollapse = Math.max(worstCollapse, (state.tickets.open - 250) / 150);
    if (m.temp > 38) worstCollapse = Math.max(worstCollapse, (m.temp - 38) / 8);
    if (state.power.utility === "out" && state.power.upsDischarge >= 100 && !state.power.generatorRunning) worstCollapse = Math.max(worstCollapse, 0.4);
    let lostSvcs = 0;
    for (const svc of state.services) if (svc.state === "offline") lostSvcs++;
    if (lostSvcs >= Math.max(3, state.services.length * 0.6)) worstCollapse = Math.max(worstCollapse, 0.5);

    if (worstCollapse > 0) state.growth.collapseMeter = Math.min(1.2, state.growth.collapseMeter + dt * worstCollapse * 0.01);
    else state.growth.collapseMeter = Math.max(0, state.growth.collapseMeter - dt * 0.02);

    if (state.growth.collapseMeter >= 1 && !state.gameOver) {
      state.gameOver = true;
      state.gameOverReason = collapseReason(state);
    }

    updateThermometer(state, dt, clean, outageWeight);
    checkExpansion(state);
    checkUpgrades(state, dt);
    checkAchievements(state);
  }

  function updateThermometer(state, dt, clean, outageWeight) {
    const m = state.metrics;
    let rate = (0.3 + m.rep * 0.006) * cfg().demandGrowth;
    if (!clean) rate *= 0.2;
    rate -= outageWeight * 0.35;
    if (state.tickets.open > 30) rate -= 0.3;
    if (state.tickets.open > 80) rate -= 0.5;
    rate = Math.max(-1.5, Math.min(rate, 3));
    m.growthPct = DC.Util.clamp((m.growthPct || 0) + rate * dt, 0, 100);
    if (m.growthPct >= 100) {
      m.growthPct = 0;
      growthEvent(state);
    }
  }

  function growthEvent(state) {
    const rr = { f: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)], chance: (p) => Math.random() < p };
    const bump = 1.05 + rr.f(0, 0.06);
    for (const s of state.services) s.customers = Math.round(s.customers * bump);
    state.metrics.customers = state.services.reduce((a, s) => a + s.customers, 0);
    if (state.metrics.customers > state.growth.customersPeak) state.growth.customersPeak = state.metrics.customers;
    let installed = 0;
    for (const rack of state.racks) {
      if (installed >= 4) break;
      const free = DC.Facility.freeForServer(rack);
      if (free < 2) continue;
      const idx = state.racks.indexOf(rack);
      let eq;
      if (free >= 4 && rr.chance(0.25)) {
        eq = DC.Facility.makeStorage(rr, idx);
        eq.age = 0.05;
      } else {
        eq = DC.Facility.makeServer(rr, rr.pick(Object.keys(DC.ROLES)), idx, state.dna);
        if (state.services.length && rr.chance(0.6)) {
          const svc = rr.pick(state.services);
          if (svc.deps.indexOf(eq.id) === -1) svc.deps.push(eq.id);
        }
      }
      rack.equipment.push(eq);
      state.eqById[eq.id] = eq;
      eq.fresh = true;
      eq.freshT = 0;
      installed++;
    }
    DC.Facility.nameServers(state);
    state.metrics.score += 500;
    DC.Events.emit("toast", state, "GROWTH — new customers onboarded" + (installed ? " · new hardware installed" : ""), "good");
    DC.Audio.fanfare();
    const lastHall = state.halls.length - 1;
    if (lastHall >= 0 && DC.Facility.hallFull(state, lastHall) && state.racks.length < DC.CFG.maxRacks) {
      const res = DC.Facility.createHall(state);
      DC.Events.emit("toast", state, res.hall.name + " CONSTRUCTED — " + res.newRacks.length + " racks online", "good");
      DC.Game.animateExpansion(res.newRacks, false);
      DC.Audio.fanfare();
    }
  }

  function checkExpansion(state) {
    const g = state.growth;
    if (g.expansionPending || state.gameOver) return;
    const anyRoom = state.racks.some((r) => DC.Facility.freeForServer(r) >= 2);
    if (!anyRoom && state.racks.length < cfg().maxRacks) {
      g.expansionPending = DC.Facility.generateExpansionOptions(state);
      state.director.timer = Math.max(state.director.timer, 45);
      DC.Events.emit("expansion", state);
      DC.Audio.fanfare();
    }
  }

  function collapseReason(state) {
    const m = state.metrics;
    if (m.temp > 38) return "CATASTROPHIC THERMAL FAILURE — facility cooked";
    if (state.power.utility === "out" && !state.power.generatorRunning) return "EXTENDED TOTAL POWER FAILURE";
    if (state.tickets.open > 250) return "TOTAL HELPDESK COLLAPSE — all customers lost";
    if (m.sla < 90) return "SLA COLLAPSE — contracts terminated";
    return "REPUTATION COLLAPSE — business failed";
  }

  function checkExpansion(state) {
    const g = state.growth;
    if (g.expansionPending || state.gameOver) return;
    const threshold = 80 * cfg().expansionThreshold;
    if (state.metrics.demand >= threshold && state.racks.length < cfg().maxRacks) {
      g.expansionPending = DC.Facility.generateExpansionOptions(state);
      state.director.timer = Math.max(state.director.timer, 45);
      DC.Events.emit("expansion", state);
      DC.Audio.fanfare();
    }
  }

  function checkUpgrades(state, dt) {
    const g = state.growth;
    if (g.upgradePending || state.gameOver) return;
    g.nextUpgradeAt -= dt;
    if (g.nextUpgradeAt <= 0) {
      const offers = generateUpgradeOffers(state);
      if (offers.length) {
        g.upgradePending = offers;
        DC.Events.emit("upgrade", state);
      } else {
        g.nextUpgradeAt = 120;
      }
    }
  }

  function generateUpgradeOffers(state) {
    const pool = [];
    const has = (k) => state.upgrades.includes(k);
    const add = (k, w) => { if (!has(k)) pool.push({ key: k, w }); };
    const m = state.metrics;
    if (m.coolPct < 80) { add("HOT_AISLE", 5); add("REDUNDANT_CRAC", 4); add("EFF_FANS", 3); add("LIQUID", 2); }
    if (m.powerPct > 75) { add("SMART_PDU", 4); add("BIG_UPS", 3); add("DUAL_FEEDS", 4); }
    if (state.stats.hvacFailures > 0) add("REDUNDANT_CRAC", 5);
    if (state.power.utility === "out" || state.stats.powerIncidents > 0) { add("GENERATOR", 5); add("BIG_UPS", 4); }
    if (state.stats.secIncidents > 0) { add("FIREWALL", 5); add("EDR", 4); }
    if (state.stats.dataLoss > 0) { add("REBUILD_CTRL", 5); add("BACKUP_APPL", 5); add("NVME", 3); }
    if (m.netPct < 100 || state.racks.length > 8) add("NET_FABRIC", 3);
    add("MONITORING", 2);
    add("PREDICTIVE", 2);
    add("LOAD_BALANCER", 2);
    pool.sort((a, b) => b.w - a.w);
    return pool.slice(0, 3).map((p) => {
      const def = DC.UPGRADES[p.key];
      return { key: p.key, name: def.name, desc: def.desc, risk: def.risk };
    });
  }

  function applyUpgrade(state, key) {
    state.upgrades.push(key);
    state.growth.upgradeCount++;
    state.stats.upgradesInstalled++;
    state.growth.nextUpgradeAt = 260 / cfg().upgradeRate + Math.random() * 160;
    DC.Events.alarm(state, "info", "UPGRADE INSTALLED: " + DC.UPGRADES[key].name, null);
    DC.Events.emit("toast", state, "UPGRADE INSTALLED — " + DC.UPGRADES[key].name, "good");
    DC.Audio.fanfare();
  }

  function checkAchievements(state) {
    const A = state.achievements;
    const m = state.metrics;
    const unlock = (id, name, desc) => {
      if (A.find((a) => a.id === id)) return;
      A.push({ id, name, desc });
      DC.Events.emit("toast", state, "ACHIEVEMENT — " + name, "info");
    };
    if (m.sla >= 99.99 && state.time > 600) unlock("FIVE_NINES", "FIVE NINES", "Maintain exceptional SLA past 10 minutes.");
    if (state.growth.cleanTime > 300 && state.racks.length >= 10) unlock("SILENT_NIGHT", "SILENT NIGHT", "Operate a large facility with near-zero tickets.");
    if (state.stats.arraysSaved > 0) unlock("HOT_SWAP_HERO", "HOT SWAP HERO", "Save an array moments before redundancy loss.");
    if (state.stats.hvacFailures >= 3 && m.temp < 30 && state.time > 300) unlock("COOL_UNDER_PRESSURE", "COOL UNDER PRESSURE", "Recover from major cooling failure.");
    if (state.stats.secIncidents >= 2 && state.stats.dataLoss === 0 && state.time > 300) unlock("UNPLUG_IT", "UNPLUG IT", "Contain security incidents with no data loss.");
    if (state.stats.dataLoss === 0 && state.time > 900) unlock("NO_DATA_LEFT_BEHIND", "NO DATA LEFT BEHIND", "No data loss for a long run.");
    if (state.racks.length > 20) unlock("RACK_CITY", "RACK CITY", "Grow beyond 20 racks.");
    if (state.racks.length > 40) unlock("MEGACENTER", "MEGACENTER", "Grow beyond 40 racks.");
    if (m.rep >= 80 && m.customers > 30000) unlock("CUSTOMER_FAVORITE", "CUSTOMER FAVORITE", "High reputation with a huge customer base.");
  }

  return { tick, applyUpgrade, generateUpgradeOffers, growthEvent };
})();
