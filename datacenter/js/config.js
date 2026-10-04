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
  STANDARD: {},
  RELAXED: { difficulty: 60, failureFreq: 50, ticketGen: 60, repLoss: 60 },
  REALISTIC: { difficulty: 140, failureFreq: 130, ticketGen: 130, coolCapacity: 85 },
  RAPID_GROWTH: { expansionRate: 250, demandGrowth: 220, customerGrowth: 200, expansionThreshold: 70 },
  MEGA_DATACENTER: { maxRacks: 60, expansionRate: 220, demandGrowth: 200, expansionThreshold: 60 },
  CHAOS: { difficulty: 200, failureFreq: 300, escalation: 250, ticketGen: 220 },
  STORAGE_NIGHTMARE: { driveFail: 350, rebuildSpeed: 60, warnRate: 200, difficulty: 130 },
  THERMAL_NIGHTMARE: { coolCapacity: 55, heatGen: 160, tempRise: 180, difficulty: 130 },
  CYBER_NIGHTMARE: { securityRate: 400, propSpeed: 200, difficulty: 130 },
  POWER_CRISIS: { utilFail: 400, powerCapacity: 70, difficulty: 130 },
  HELPDESK_HELL: { ticketGen: 400, ticketEscalation: 300, customerGrowth: 180 }
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
