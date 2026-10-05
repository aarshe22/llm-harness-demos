window.DC = window.DC || {};

DC.DEFAULT_SETTINGS = {
  audio: true,
  volume: 0.5,
  difficulty: 100,
  failureFreq: 100,
  escalation: 100,
  startingRacks: 0,
  maxRacks: 40,
  startCustomerLoad: 100,
  customerGrowth: 100,
  expansionRate: 100,
  upgradeRate: 100,
  repGain: 100,
  repLoss: 100,
  demandGrowth: 100,
  expansionThreshold: 100,
  ticketGen: 100,
  ticketEscalation: 100,
  ticketClear: 100,
  driveFail: 100,
  rebuildSpeed: 100,
  warnRate: 100,
  coolCapacity: 100,
  heatGen: 100,
  tempRise: 100,
  powerCapacity: 100,
  utilFail: 100,
  netFail: 100,
  securityRate: 100,
  wanFail: 100,
  wanMaint: 100,
  fwAttack: 100,
  printerRate: 100,
  printerFail: 100,
  propSpeed: 100,
  leaks: 100
};

DC.CHALLENGES = {
  RELAXED: { difficulty: 60, failureFreq: 45, ticketGen: 55, repLoss: 50 },
  REALISTIC: { difficulty: 150, failureFreq: 150, ticketGen: 150, coolCapacity: 85, powerCapacity: 90, driveFail: 120 },
  RAPID_GROWTH: { expansionRate: 300, demandGrowth: 250, customerGrowth: 220, expansionThreshold: 65, startCustomerLoad: 150 },
  MEGA_DATACENTER: { startingRacks: 10, maxRacks: 60, expansionRate: 240, demandGrowth: 210, expansionThreshold: 55, startCustomerLoad: 220, ticketGen: 160 },
  CHAOS: { difficulty: 200, failureFreq: 300, escalation: 260, ticketGen: 230, ticketClear: 70, coolCapacity: 85, powerCapacity: 80, securityRate: 220, driveFail: 220, utilFail: 220 },
  STORAGE_NIGHTMARE: { driveFail: 380, rebuildSpeed: 55, warnRate: 220, difficulty: 140, failureFreq: 140 },
  THERMAL_NIGHTMARE: { coolCapacity: 50, heatGen: 170, tempRise: 190, difficulty: 140, failureFreq: 130 },
  CYBER_NIGHTMARE: { securityRate: 420, propSpeed: 220, difficulty: 140, failureFreq: 130 },
  POWER_CRISIS: { utilFail: 420, powerCapacity: 65, difficulty: 140, failureFreq: 130, coolCapacity: 90 },
  HELPDESK_HELL: { ticketGen: 420, ticketEscalation: 320, ticketClear: 60, customerGrowth: 190, difficulty: 130 }
};

// shown to the right of the challenge list so players know what to expect
DC.CHALLENGE_INFO = {
  RELAXED: "A quiet shift. Fewer failures, gentler tickets, forgiving reputation. For learning the ropes or unwinding.",
  REALISTIC: "Everything a little harder than default: more failures, more tickets, tighter cooling and power. No single gimmick — just a demanding floor.",
  RAPID_GROWTH: "Customers flood in fast. Expansion prompts come constantly — keep up or drown in demand you can't serve.",
  MEGA_DATACENTER: "You start with 10 racks and a huge customer base. Scale to 60 racks while ticket load grows with you.",
  CHAOS: "Everything breaks at once: hardware, power, cooling, security — while tickets pile up faster than you can clear them. Good luck.",
  STORAGE_NIGHTMARE: "Drives fail constantly and rebuilds crawl. Keep spare capacity or lose customer data.",
  THERMAL_NIGHTMARE: "Weak cooling, hot hardware, fast-rising temps. One CRAC fault and you're into thermal shutdowns.",
  CYBER_NIGHTMARE: "Malware everywhere and spreading fast. Isolate, clean, reimage — and hope your racks don't infect each other.",
  POWER_CRISIS: "The grid fails constantly and your capacity is thin. UPS, generators and load management are life support.",
  HELPDESK_HELL: "A ticket avalanche that escalates fast and clears slow. Customers walk if you can't keep up."
};

DC.CFG = {};

DC.Util = {
  allEq: function (state, type) {
    const out = [];
    for (const r of state.racks) for (const e of r.equipment) if (!type || e.type === type) out.push(e);
    return out;
  },
  eq: function (state, id) { return state.eqById[id]; },
  rackOf: function (state, eq) { return state.racks[eq.rack] || null; },
  hallOf: function (state, rack) { return state.halls[rack.hall] || state.halls[0]; },
  online: function (eq) { return eq.state === "online"; },
  fmtUptime: function (s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  },
  clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
  lerp: function (a, b, t) { return a + (b - a) * t; }
};

DC.applySettings = function (s) {
  const c = {};
  c.difficulty = s.difficulty / 100;
  c.failureFreq = s.failureFreq / 100;
  c.escalation = s.escalation / 100;
  c.startingRacks = s.startingRacks;
  c.maxRacks = s.maxRacks;
  c.startCustomerLoad = s.startCustomerLoad / 100;
  c.customerGrowth = s.customerGrowth / 100;
  c.expansionRate = s.expansionRate / 100;
  c.upgradeRate = s.upgradeRate / 100;
  c.repGain = s.repGain / 100;
  c.repLoss = s.repLoss / 100;
  c.demandGrowth = s.demandGrowth / 100;
  c.expansionThreshold = s.expansionThreshold / 100;
  c.ticketGen = s.ticketGen / 100;
  c.ticketEscalation = s.ticketEscalation / 100;
  c.ticketClear = s.ticketClear / 100;
  c.driveFail = s.driveFail / 100;
  c.rebuildSpeed = s.rebuildSpeed / 100;
  c.warnRate = s.warnRate / 100;
  c.coolCapacity = s.coolCapacity / 100;
  c.heatGen = s.heatGen / 100;
  c.tempRise = s.tempRise / 100;
  c.powerCapacity = s.powerCapacity / 100;
  c.utilFail = s.utilFail / 100;
  c.netFail = s.netFail / 100;
  c.securityRate = s.securityRate / 100;
  c.wanFail = s.wanFail / 100;
  c.wanMaint = s.wanMaint / 100;
  c.fwAttack = s.fwAttack / 100;
  c.printerRate = s.printerRate / 100;
  c.printerFail = s.printerFail / 100;
  c.propSpeed = s.propSpeed / 100;
  c.leaks = s.leaks / 100;
  DC.CFG = c;
};
