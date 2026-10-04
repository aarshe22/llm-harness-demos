window.DC = window.DC || {};

DC.Facility = (function () {
  let eqCounter = 0;
  function nextId(prefix) { eqCounter++; return prefix + "-" + String(eqCounter).padStart(3, "0"); }

  function generateDNA(rng) {
    return {
      facilityAge: rng.f(0.3, 5),
      computeBias: rng.f(0.35, 0.75),
      networkComplexity: rng.f(0.3, 1),
      powerRedundancy: rng.f(0.3, 1),
      coolingRedundancy: rng.f(0.3, 1),
      hwAge: rng.f(0.1, 0.8),
      criticality: rng.f(0.7, 1.3),
      growthRate: rng.f(0.7, 1.4),
      failurePersonality: rng.pick(["electrical", "thermal", "storage", "network", "balanced"]),
      expansionStyle: rng.pick(["right", "left", "alternate"]),
      customerMix: rng.pick(["many-small", "mixed", "few-large"])
    };
  }

  function makeServer(rng, role, rackIdx, dna, opts) {
    const model = rng.pick(DC.SERVER_MODELS);
    const roleDef = DC.ROLES[role];
    return {
      id: nextId(opts && opts.roleTag ? opts.roleTag : role.split(" ")[0].slice(0, 4).toUpperCase()),
      type: "server",
      rack: rackIdx,
      uh: 2,
      name: null,
      model: model.name,
      role: role,
      cpu: model.cores,
      mem: model.mem,
      load: rng.f(roleDef.load[0], roleDef.load[1]),
      power: model.power,
      temp: 30 + rng.f(0, 6),
      state: "online",
      netState: "ok",
      psuA: "ok",
      psuB: "ok",
      fans: "ok",
      fanHealth: rng.f(0.7, 1),
      health: 100,
      age: Math.max(0.05, dna.hwAge * rng.f(0.4, 1.8)),
      ecc: 0,
      diskFull: false,
      runaway: null,
      sec: "clean",
      busy: null,
      throttle: 0,
      memLeak: null,
      certDays: Math.floor(rng.f(30, 240)),
      clockSkew: 0
    };
  }

  function makeStorage(rng, rackIdx) {
    const drives = [];
    const n = rng.pick([12, 16, 24]);
    for (let i = 0; i < n; i++) drives.push({ state: "ok", wear: rng.f(0, 12), rebuild: 0 });
    return {
      id: nextId("STOR"),
      type: "storage",
      rack: rackIdx,
      uh: 4,
      name: null,
      model: rng.pick(["VaultMax 4600", "VaultMax 8200", "DataVault DX"]),
      raid: rng.pick([1, 5, 6, 10]),
      drives: drives,
      rebuild: null,
      controller: "ok",
      age: 0,
      state: "online",
      busy: null
    };
  }

  function makeSwitch(rng, rackIdx, role) {
    return {
      id: nextId(role === "core" ? "CORE" : role === "agg" ? "AGG" : "SW"),
      type: "switch",
      rack: rackIdx,
      uh: role === "core" ? 2 : 1,
      name: null,
      role: role,
      ports: rng.pick([24, 48]),
      state: "online",
      fault: null,
      busy: null
    };
  }

  function makePDU(rng, rackIdx) {
    return { id: nextId("PDU"), type: "pdu", rack: rackIdx, uh: 1, name: null, breaker: "ok", tripped: false, loadPct: 0 };
  }

  function makeUPS(rng) {
    return { id: "UPS-1", type: "ups", rack: -1, uh: 4, name: "UPS MAIN", charge: 100, state: "standby", capacity: 1, busy: null };
  }

  function makeCRAC(rng, hall) {
    const n = nextId("CRAC");
    return {
      id: n,
      type: "crac",
      hall: hall,
      uh: 0,
      name: n,
      capacity: 1,
      status: "ok",
      fault: null,
      output: 1,
      filterDirty: 0,
      busy: null
    };
  }

  function buildRack(rng, idx, dna, hall, opts) {
    const rack = { id: idx, name: "RACK " + String(idx + 1).padStart(2, "0"), hall: hall, equipment: [], temp: 22 };
    const isCompute = opts ? opts.compute : rng.chance(dna.computeBias);
    let u = 2;
    if (opts && opts.storage !== undefined) {
      for (let i = 0; i < opts.storage; i++) { const s = makeStorage(rng, idx); s.age = Math.max(0.05, dna.hwAge * rng.f(0.4, 1.8)); rack.equipment.push(s); u += 4; }
    }
    if (opts && opts.servers !== undefined) {
      for (let i = 0; i < opts.servers; i++) {
        if (u + 2 > 40) break;
        const role = rng.pick(Object.keys(DC.ROLES));
        rack.equipment.push(makeServer(rng, role, idx, dna));
        u += 2;
      }
    } else if (isCompute) {
      while (u + 2 <= 40 && rng.chance(0.75)) {
        const role = rng.pick(Object.keys(DC.ROLES));
        rack.equipment.push(makeServer(rng, role, idx, dna));
        u += 2;
      }
      if (u + 1 <= 40 && rng.chance(0.7)) { rack.equipment.push(makeSwitch(rng, idx, "access")); u += 1; }
    } else {
      const nStor = rng.i(1, 2);
      for (let i = 0; i < nStor && u + 4 <= 36; i++) { const s = makeStorage(rng, idx); s.age = Math.max(0.05, dna.hwAge * rng.f(0.4, 1.8)); rack.equipment.push(s); u += 4; }
      while (u + 2 <= 38 && rng.chance(0.7)) {
        const role = rng.pick(["BACKUP", "DATABASE", "CACHE", "MIDDLEWARE", "MONITORING"]);
        rack.equipment.push(makeServer(rng, role, idx, dna));
        u += 2;
      }
      if (u + 1 <= 40 && rng.chance(0.7)) { rack.equipment.push(makeSwitch(rng, idx, "access")); u += 1; }
    }
    rack.equipment.push(makePDU(rng, idx));
    return rack;
  }

  function freeForServer(rack) {
    let used = 2;
    for (const e of rack.equipment) used += e.uh;
    return 40 - used;
  }

  function hallFull(state, hallIdx) {
    const racks = state.racks.filter((r) => r.hall === hallIdx);
    if (!racks.length) return false;
    return racks.every((r) => freeForServer(r) < 2);
  }

  function createHall(state) {
    const rng = DC.Rng.make(state.seedStr + ":hall:" + state.halls.length);
    const hallIdx = state.halls.length;
    const hall = { name: "HALL " + String.fromCharCode(65 + hallIdx), cracs: [], temp: 21.5 };
    state.halls.push(hall);
    const n = rng.i(3, 4);
    const newRacks = [];
    for (let i = 0; i < n; i++) {
      const rid = state.nextRackId++;
      const rack = buildRack(rng, rid, state.dna, hallIdx, { compute: rng.chance(0.7) });
      rack.name = "RACK " + String(rid + 1).padStart(2, "0");
      rack.fresh = true;
      rack.freshT = 0;
      state.racks.push(rack);
      newRacks.push(rack);
    }
    nameServers(state);
    for (const rack of state.racks) for (const eq of rack.equipment) { eq.rack = state.racks.indexOf(rack); if (!state.eqById[eq.id]) state.eqById[eq.id] = eq; }
    const cr = makeCRAC(rng, hallIdx);
    cr.hallName = hall.name;
    state.coolingUnits.push(cr);
    hall.cracs.push(cr.id);
    state.eqById[cr.id] = cr;
    const t = rng.pick(DC.SERVICE_TYPES);
    const servers = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "server"));
    const stor = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "storage"));
    const sw = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "switch"));
    const svc = {
      id: "SVCH" + hallIdx + "_" + Math.floor(rng.f(0, 9999)),
      name: t.key,
      type: t,
      customers: Math.round(rng.f(t.customers[0], t.customers[1]) * (DC.CFG.startCustomerLoad || 1)),
      crit: t.crit * state.dna.criticality,
      deps: [],
      state: "healthy",
      outageSince: 0, outageTotal: 0, openTickets: 0, degradedSince: 0
    };
    if (servers.length) svc.deps = rng.shuffle(servers).slice(0, Math.min(3, servers.length)).map((s) => s.id);
    if (stor.length && rng.chance(0.6)) svc.deps.push(rng.pick(stor).id);
    if (sw.length) svc.deps.push(rng.pick(sw).id);
    state.services.push(svc);
    state.metrics.customers += svc.customers;
    return { hall, newRacks };
  }

  function makeBlade(rng, rackIdx, hallIdx) {
    const n = nextId("BLD");
    return {
      id: n,
      type: "blade",
      rack: rackIdx,
      uh: 4,
      name: n,
      model: rng.pick(["TenantBlade X2", "TenantBlade X4", "MultiWatt B9"]),
      state: "online",
      netState: "ok",
      load: rng.f(15, 45),
      baseLoad: rng.f(10, 25),
      power: rng.pick([340, 420, 520]),
      temp: 30 + rng.f(0, 5),
      psuA: "ok", psuB: "ok",
      fans: "ok", fanHealth: rng.f(0.7, 1),
      age: rng.f(0.1, 0.9),
      ecc: 0,
      diskFull: false,
      runaway: null,
      sec: "clean",
      busy: null,
      throttle: 0,
      memLeak: null,
      certDays: Math.floor(rng.f(30, 240)),
      clockSkew: 0,
      tenant: null,
      hall: hallIdx
    };
  }

  function createBlades(state, rng) {
    state.blades = [];
    const tenants = [
      { name: "NORTHWIND LTD", crit: 1.2, sat: 72 },
      { name: "ACME CLOUD", crit: 1.4, sat: 72 },
      { name: "GLOBEX CORP", crit: 1.6, sat: 72 },
      { name: "INITECH", crit: 1.0, sat: 72 },
      { name: "SOYLENT DATA", crit: 1.3, sat: 72 },
      { name: "PIERRE PAYMENTS", crit: 1.5, sat: 72 }
    ];
    const shuffled = rng.shuffle(tenants.slice());
    for (let i = 0; i < shuffled.length; i++) {
      let placed = false;
      for (const rack of state.racks) {
        if (freeForServer(rack) >= 4) {
          const b = makeBlade(rng, state.racks.indexOf(rack), rack.hall);
          b.tenant = shuffled[i];
          rack.equipment.push(b);
          state.eqById[b.id] = b;
          state.blades.push(b);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
    if (state.blades.length) {
      DC.Events && 0;
      const bladeSvc = {
        id: "SVCB0",
        name: "TENANT BLADES",
        type: { key: "TENANT BLADES", customers: 1, crit: 1.2, tickets: 0.4 },
        customers: 1,
        crit: 1.2 * state.dna.criticality,
        deps: state.blades.map((b) => b.id),
        state: "healthy",
        outageSince: 0, outageTotal: 0, openTickets: 0, degradedSince: 0,
        bladeService: true
      };
      state.services.push(bladeSvc);
    }
  }

  function nameServers(state) {
    const counters = {};
    for (const rack of state.racks) {
      for (const eq of rack.equipment) {
        if (!eq.name) continue;
        let m;
        if ((m = eq.name.match(/^([A-Z]{2,4})-(\d+)$/))) counters[m[1]] = Math.max(counters[m[1]] || 0, parseInt(m[2], 10));
      }
    }
    for (const rack of state.racks) {
      for (const eq of rack.equipment) {
        if (eq.name) continue;
        if (eq.type === "server") {
          let tag = eq.role.split(" ")[0].toUpperCase().slice(0, 4);
          counters[tag] = (counters[tag] || 0) + 1;
          eq.name = tag + "-" + String(counters[tag]).padStart(2, "0");
        } else if (eq.type === "storage") {
          counters.STOR = (counters.STOR || 0) + 1;
          eq.name = "STOR-" + String(counters.STOR).padStart(2, "0");
        } else if (eq.type === "switch") {
          counters.SW = (counters.SW || 0) + 1;
          eq.name = "SW-" + String(counters.SW).padStart(2, "0");
        }
      }
    }
  }

  function rackUsedU(rack) { return rack.equipment.reduce((a, e) => a + e.uh, 0); }

  function createCluster(state, rng) {
    let best = null, bestN = 0;
    for (const r of state.racks) {
      const n = r.equipment.filter((e) => e.type === "server").length;
      if (n > bestN) { bestN = n; best = r; }
    }
    if (!best || bestN < 2) return null;
    const servers = best.equipment.filter((e) => e.type === "server");
    const A = servers[0], B = servers[1];
    for (const [eq, role] of [[A, "A"], [B, "B"]]) {
      eq.role = "VIRTUALIZATION";
      eq.name = "CLU-" + role;
      eq.clRole = role;
      eq.baseLoad = rng.f(8, 18);
      eq.load = eq.baseLoad;
    }
    const storRack = rackUsedU(best) + 4 <= 42 ? best : state.racks.reduce((a, r) => (rackUsedU(r) < rackUsedU(a) ? r : a), best);
    const stor = makeStorage(rng, state.racks.indexOf(storRack));
    stor.drives = [];
    for (let i = 0; i < 12; i++) stor.drives.push({ state: "ok", wear: rng.f(0, 8), rebuild: 0 });
    stor.raid = 6;
    stor.name = "STOR-CL";
    stor.isClusterStorage = true;
    storRack.equipment.push(stor);
    state.eqById[stor.id] = stor;
    const cl = {
      id: "CL-01",
      nodes: [A.id, B.id],
      storage: stor.id,
      workloads: [{ node: "A", load: 40 }, { node: "B", load: 20 }],
      migrating: null
    };
    const svc = state.services.find((s) => /DATABASE|FILE SERVICE|API|CHECKOUT/.test(s.name)) || state.services[0];
    if (svc) {
      for (const dep of [stor.id, A.id, B.id]) if (svc.deps.indexOf(dep) === -1) svc.deps.push(dep);
    }
    return cl;
  }

  function generateServices(rng, racks, dna, eqById, cfg) {
    const servers = [];
    const storages = [];
    const switches = [];
    for (const rack of racks) for (const eq of rack.equipment) {
      if (eq.type === "server") servers.push(eq);
      else if (eq.type === "storage") storages.push(eq);
      else if (eq.type === "switch") switches.push(eq);
    }
    const shuffled = rng.shuffle(servers);
    let used = new Set();
    const types = rng.shuffle(DC.SERVICE_TYPES.slice());
    const nSvc = Math.min(types.length, Math.max(4, Math.round(racks.length * 1.2)));
    const services = [];
    const largeCustomer = dna.customerMix === "few-large";
    for (let i = 0; i < nSvc; i++) {
      const t = types[i % types.length];
      const needServers = t.key === "DNS" ? 2 : rng.i(1, 3);
      const deps = [];
      let picked = 0;
      for (const s of shuffled) {
        if (picked >= needServers) break;
        if (used.has(s.id)) continue;
        deps.push(s.id); used.add(s.id); picked++;
      }
      if (picked === 0 && shuffled.length) { const s = shuffled[0]; deps.push(s.id); used.add(s.id); }
      if (storages.length && rng.chance(t.key === "FILE SERVICE" || t.key === "DATABASE" ? 0.9 : 0.45)) deps.push(rng.pick(storages).id);
      if (switches.length) deps.push(rng.pick(switches).id);
      let custBase = rng.f(t.customers[0], t.customers[1]);
      if (largeCustomer && i === 0) custBase *= rng.f(2.5, 4);
      const svc = {
        id: "SVC" + i,
        name: t.key,
        type: t,
        customers: Math.round(custBase * cfg.startCustomerLoad),
        crit: t.crit * dna.criticality,
        deps: deps,
        state: "healthy",
        outageSince: 0,
        outageTotal: 0,
        openTickets: 0,
        degradedSince: 0
      };
      services.push(svc);
    }
    return services;
  }

  function generate(seedStr, cfg, challengeName) {
    const rng = DC.Rng.make(seedStr);
    const dna = generateDNA(rng);
    const rackCount = cfg.startingRacks > 0 ? cfg.startingRacks : rng.i(3, 6);
    const state = {
      seedStr: seedStr,
      dna: dna,
      challenge: challengeName || null,
      racks: [],
      halls: [{ name: "HALL A", cracs: [], temp: 21.5 }],
      services: [],
      coolingUnits: [],
      powerUnits: [],
      eqById: {},
      upgrades: [],
      nextRackId: rackCount
    };
    for (let i = 0; i < rackCount; i++) state.racks.push(buildRack(rng, i, dna, 0));
    nameServers(state);
    for (const rack of state.racks) for (const eq of rack.equipment) state.eqById[eq.id] = eq;
    state.eqById["UPS-1"] = makeUPS(rng);
    DC.Wan.ensure(state);
    const cracCount = Math.max(1, Math.ceil(rackCount / 5));
    for (let i = 0; i < cracCount; i++) {
      const cr = makeCRAC(rng, 0);
      cr.hallName = "HALL A";
      state.coolingUnits.push(cr);
      state.halls[0].cracs.push(cr.id);
      state.eqById[cr.id] = cr;
    }
    if (rng.chance(dna.powerRedundancy)) {
      const g = { id: nextId("GEN"), type: "generator", name: "GEN-01", state: "standby", fuel: 100, health: 100, startup: 0 };
      state.powerUnits.push(g);
      state.eqById[g.id] = g;
    }
    state.services = generateServices(rng, state.racks, dna, state.eqById, cfg);
    state.clusters = [];
    const cl = createCluster(state, rng);
    if (cl) state.clusters.push(cl);
    createBlades(state, rng);
    if (DC.Maintenance) DC.Maintenance.initState(state);
    state.incidents = [];
    state.alarms = [];
    state.tickets = { open: 0, peak: 0, perService: {}, recent: [], stats: { total: 0, resolved: 0, prevented: 0, worst: 0 } };
    state.metrics = {
      uptime: 0, score: 0, sla: 99.99, rep: 62, demand: 20,
      customers: state.services.reduce((a, s) => a + s.customers, 0),
      temp: 21.5, powerPct: 0, coolPct: 0, netPct: 100, dataPct: 100, sec: "NORMAL", incidents: 0,
      serversOnline: 0, serversTotal: 0, growthPct: 0
    };
    state.power = { utility: "ok", utilityTimer: 0, upsDischarge: 0, generatorRunning: false };
    state.director = { state: "CALM", timer: rng.f(20, 40), intensity: 0 };
    state.growth = { expansionCount: 0, upgradeCount: 0, cleanTime: 0, expansionPending: null, upgradePending: null, nextUpgradeAt: rng.f(240, 420), collapseMeter: 0, customersPeak: state.metrics.customers };
    state.stats = {
      serversRepaired: 0, drivesReplaced: 0, arraysSaved: 0, dataLoss: 0, hvacFailures: 0,
      powerIncidents: 0, secIncidents: 0, preventions: 0, peakTemp: 21.5, peakPower: 0,
      impactTime: 0, longestClean: 0, expansions: 0, upgradesInstalled: 0,
      patches: 0, badPatches: 0, batteriesReplaced: 0, migrations: 0
    };
    state.achievements = [];
    state.time = 0;
    state.speed = 1;
    state.paused = false;
    state.gameOver = false;
    state.gameOverReason = null;
    return state;
  }

  function applyExpansion(state, option) {
    const rng = DC.Rng.make(state.seedStr + ":exp:" + state.growth.expansionCount);
    const dna = state.dna;
    const addLeft = dna.expansionStyle === "left" || (dna.expansionStyle === "alternate" && state.growth.expansionCount % 2 === 1);
    let hallIdx;
    if (state.growth.expansionCount > 0 && (state.growth.expansionCount + 1) % 3 === 0) {
      hallIdx = state.halls.length;
      const hall = { name: "HALL " + String.fromCharCode(65 + hallIdx), cracs: [], temp: 21.5 };
      state.halls.push(hall);
    } else if (addLeft) {
      hallIdx = state.racks.length ? state.racks[0].hall : 0;
    } else {
      hallIdx = 0;
    }
    const compute = option.key.includes("COMPUTE") || option.key.includes("CLOUD") || option.key.includes("EDGE");
    const newRacks = [];
    for (let i = 0; i < option.rackCount; i++) {
      const rid = state.nextRackId++;
      let opts;
      if (compute) opts = { compute: true };
      else opts = { storage: option.storPerRack || 1, servers: Math.max(2, Math.floor(option.serversPerRack || 4)) };
      const rack = buildRack(rng, rid, dna, hallIdx, opts);
      rack.name = "RACK " + String(rid + 1).padStart(2, "0");
      rack.fresh = true;
      rack.freshT = 0;
      if (addLeft) { state.racks.unshift(rack); } else { state.racks.push(rack); }
      newRacks.push(rack);
    }
    nameServers(state);
    for (const rack of state.racks) for (const eq of rack.equipment) { eq.rack = state.racks.indexOf(rack); if (!state.eqById[eq.id]) state.eqById[eq.id] = eq; }
    while (state.coolingUnits.length < Math.ceil(state.racks.length / 5)) {
      const cr = makeCRAC(rng, hallIdx);
      cr.hallName = "HALL " + String.fromCharCode(65 + hallIdx);
      state.coolingUnits.push(cr);
      if (state.halls[hallIdx]) state.halls[hallIdx].cracs.push(cr.id);
      state.eqById[cr.id] = cr;
    }
    const addCust = Math.round(option.customers * (DC.CFG.startCustomerLoad || 1));
    const svc = {
      id: "SVCE" + state.growth.expansionCount + "_" + Math.floor(Math.random() * 9999),
      name: option.newService || "EXPANSION SERVICE",
      type: DC.SERVICE_TYPES.find((t) => t.key === (option.newService || "CUSTOMER PORTAL")) || DC.SERVICE_TYPES[0],
      customers: addCust,
      crit: option.crit || 1.1,
      deps: [],
      state: "healthy",
      outageSince: 0, outageTotal: 0, openTickets: 0, degradedSince: 0
    };
    const newServers = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "server"));
    const newStor = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "storage"));
    const newSw = newRacks.flatMap((r) => r.equipment.filter((e) => e.type === "switch"));
    if (newServers.length) svc.deps = svc.deps.concat(rng.shuffle(newServers).slice(0, Math.min(newServers.length, rng.i(2, 3))).map((s) => s.id));
    if (newStor.length && rng.chance(0.6)) svc.deps.push(rng.pick(newStor).id);
    if (newSw.length) svc.deps.push(rng.pick(newSw).id);
    state.services.push(svc);
    state.metrics.customers += addCust;
    state.metrics.rep = Math.min(100, state.metrics.rep + option.repBonus);
    state.growth.expansionCount++;
    state.metrics.demand = 10;
    state.stats.expansions++;
    state.power.capacityGrowth = (state.power.capacityGrowth || 1) * option.power;
    return { newRacks, addLeft };
  }

  function generateExpansionOptions(state) {
    const rng = DC.Rng.make(state.seedStr + ":opt:" + state.growth.expansionCount);
    const cfg = DC.CFG;
    const templates = rng.shuffle(DC.EXPANSION_TEMPLATES.slice()).slice(0, 3);
    return templates.map((t) => {
      const rackCount = rng.i(t.racks[0], t.racks[1]);
      const serversPerRack = t.key === "STORAGE EXPANSION" ? rng.i(2, 3) : rng.i(4, 7);
      const storPerRack = t.key === "STORAGE EXPANSION" ? rng.i(2, 3) : rng.i(0, 1);
      return {
        key: t.key,
        flavor: t.flavor,
        rackCount: rackCount,
        serversPerRack: serversPerRack,
        storPerRack: storPerRack,
        customers: Math.round(rng.f(t.customers[0], t.customers[1]) * cfg.startCustomerLoad),
        power: t.power,
        heat: t.heat,
        repBonus: t.repBonus,
        newService: rng.pick(DC.SERVICE_TYPES).key,
        risk: rackCount >= 3 ? "Higher cooling & power demand" : (t.repBonus >= 8 ? "High ticket risk if it degrades" : "More equipment to maintain")
      };
    });
  }

  return { generate, applyExpansion, generateExpansionOptions, makeServer, makeStorage, makeSwitch, makePDU, makeBlade, nameServers, freeForServer, hallFull, createHall };
})();
