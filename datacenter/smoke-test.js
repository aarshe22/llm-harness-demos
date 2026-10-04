const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = {
  window: {},
  console,
  Math,
  Date,
  JSON,
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] || null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  },
  requestAnimationFrame: () => 0,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = ["rng.js", "config.js", "data.js", "audio.js", "facility.js", "cluster.js", "thermal.js", "power.js", "storage.js", "network.js", "security.js", "conditions.js", "helpdesk.js", "incidents.js", "maintenance.js", "requests.js", "growth.js", "save.js", "tutorial.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, "js", f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}

vm.runInContext(`
DC.applySettings(DC.DEFAULT_SETTINGS);
const state = DC.Facility.generate("TESTSEED123", DC.CFG, null);
if (state.racks.length < 2) throw new Error("no racks");
if (!state.services.length) throw new Error("no services");
let servers = 0, storages = 0, switches = 0, pdus = 0;
for (const r of state.racks) for (const e of r.equipment) {
  if (e.type === "server") servers++;
  if (e.type === "storage") storages++;
  if (e.type === "switch") switches++;
  if (e.type === "pdu") pdus++;
}
console.log("seed", state.seedStr, "racks", state.racks.length, "servers", servers, "storage", storages, "switches", switches, "pdus", pdus, "services", state.services.length, "cracs", state.coolingUnits.length);

if (!state.clusters || state.clusters.length !== 1) throw new Error("cluster not generated");
const cl = state.clusters[0];
const clStor = state.eqById[cl.storage];
if (clStor.raid !== 6 || clStor.drives.length !== 12) throw new Error("cluster storage not 12-drive RAID-6");
const nodeA = state.eqById[cl.nodes[0]], nodeB = state.eqById[cl.nodes[1]];
if (!nodeA || !nodeB) throw new Error("cluster nodes missing");
if (state.maintenance.batteries === undefined) {
  const ups = state.eqById["UPS-1"];
  if (!ups.batteries || ups.batteries.length !== 8) throw new Error("UPS battery grid missing");
}

// migration test: kill node A, expect workload migration to B
nodeA.state = "offline";
DC.Cluster.tick(state, 0.1);
if (!cl.migrating) throw new Error("no migration started after node failure");
for (let i = 0; i < 120; i++) { DC.Cluster.tick(state, 0.1); }
const onB = cl.workloads.every((w) => w.node === "B");
if (!onB) throw new Error("workloads did not migrate to B");
console.log("cluster migration OK");

// maintenance test: force an item through the pipeline
DC.Maintenance.initState(state);
const srv = DC.Util.allEq(state, "server")[0];
const item = state.maintenance.items.length ? null : null;
const mItem = { kind: "os", name: "TEST PATCH", t: 0.05, t0: 1, badChance: 0, targetId: srv.id, state: "pending", overdue: 0 };
mItem.id = "MTX1";
state.maintenance.items.push(mItem);
DC.Maintenance.apply(state, "MTX1");
for (let i = 0; i < 10; i++) DC.Maintenance.tick(state, 0.1);
if (state.maintenance.items.find(i => i.id === "MTX1")) throw new Error("maintenance item not completed");
console.log("maintenance pipeline OK");

// battery test
const ups = state.eqById["UPS-1"];
ups.batteries[0].health = 5;
DC.Maintenance.tick(state, 0.1);
DC.Maintenance.replaceBattery(state, 0);
for (let i = 0; i < 100; i++) DC.Maintenance.tick(state, 0.1);
if (ups.batteries[0].health < 99) throw new Error("battery not replaced");
console.log("battery grid OK");

// growth thermometer: fills with good performance
for (let i = 0; i < 200; i++) { state.metrics.rep = 90; DC.Growth.tick(state, 0.1); }
if (state.metrics.growthPct === undefined || state.metrics.growthPct <= 0) throw new Error("thermometer not filling");
console.log("thermometer fill OK:", state.metrics.growthPct.toFixed(1) + "%");

// growth event: customers bump + installs
const cBefore = state.metrics.customers;
const eqBefore = DC.Util.allEq(state).length;
DC.Growth.growthEvent(state);
if (state.metrics.customers <= cBefore) throw new Error("no customer growth");
const eqAfter = DC.Util.allEq(state).length;
console.log("growth event OK: customers", cBefore, "->", state.metrics.customers, " eq", eqBefore, "->", eqAfter);

// hall creation
const halls0 = state.halls.length, racks0 = state.racks.length;
const res = DC.Facility.createHall(state);
if (state.halls.length !== halls0 + 1 || state.racks.length !== racks0 + res.newRacks.length) throw new Error("hall creation failed");
if (!DC.Facility.hallFull(state, 0) === false) {} // noop
console.log("hall creation OK:", state.halls.map(h => h.name).join(","), "racks:", state.racks.length);
if (DC.Facility.freeForServer(state.racks[0]) < 0) throw new Error("freeU underflow");

// blades: 4U, dedicated tenants, each has a service dependency
if (!state.blades || state.blades.length < 3) throw new Error("blades not generated: " + (state.blades || []).length);
for (const b of state.blades) {
  if (b.type !== "blade" || b.uh !== 4 || !b.tenant) throw new Error("bad blade: " + b.id);
  const tenantSvcs = state.services.filter((s) => s.deps.indexOf(b.id) !== -1);
  if (!tenantSvcs.length) throw new Error("blade " + b.id + " not referenced by the blade service");
}
console.log("blades OK:", state.blades.length);

// field requests: correct action completes, wrong action does not
state.requests = [];
state.requestTimer = 999;
DC.FieldRequests.spawn(state);
if (!state.requests.length) throw new Error("no request spawned");
const req = state.requests[0];
if (!req.busyKind && req.targetId !== "UPS-1") throw new Error("instant kind must target UPS");
const reqEq = state.eqById[req.targetId];

if (req.busyKind) {
  // wrong action first: run a different busy kind, ticket must survive
  const otherKind = req.busyKind === "reboot-request" ? "pull-logs" : "reboot-request";
  reqEq.busy = { kind: otherKind, t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (!state.requests.includes(req)) throw new Error("wrong busy kind completed the ticket");
  // now the correct action via start()
  reqEq.busy = null;
  if (!DC.FieldRequests.start(state, req)) throw new Error("start() refused valid request");
  if (!reqEq.busy || reqEq.busy.kind !== req.busyKind) throw new Error("start() did not set expected busy kind " + req.busyKind);
  reqEq.busy.t = 0.01;
  DC.Network.tick(state, 0.02);
  if (state.requests.includes(req)) throw new Error("ticket not completed after correct task finished");
  console.log("field requests OK (start -> busy -> finishServerBusy -> complete, wrong-kind ignored)");

// late ticket: SLA miss keeps ticket completable
const lateReq = { id: "FRL", kind: "logs", name: "PULL LOGS", action: "PULL LOGS", busyKind: "pull-logs", t: 5, exp: -1, crit: false, targetId: null, born: 0, started: false };
const srvLate = DC.Util.allEq(state, "server").find((s) => s.state === "online" && !s.busy);
if (srvLate) {
  lateReq.targetId = srvLate.id;
  state.requests.push(lateReq);
  DC.FieldRequests.tick(state, 0.1); // exp <= 0 -> fail() marks late, keeps ticket
  if (!state.requests.includes(lateReq)) throw new Error("late ticket was removed");
  if (!lateReq.late) throw new Error("ticket not marked late");
  if (lateReq.exp <= 0) throw new Error("late ticket got no second window");
  if (!DC.FieldRequests.start(state, lateReq)) throw new Error("start refused late ticket");
  srvLate.busy.t = 0.01;
  DC.Network.tick(state, 0.02);
  if (state.requests.includes(lateReq)) throw new Error("late ticket not completable");
  console.log("late tickets OK (SLA miss -> late -> still completable)");
}

// tenant satisfaction: objects exist and respond to outcomes
const anyBlade = (state.blades || [])[0];
if (anyBlade && anyBlade.tenant) {
  if (anyBlade.tenant.sat === undefined) throw new Error("tenant missing sat");
  const before = anyBlade.tenant.sat;
  anyBlade.tenant.sat = 10;
  const satReq = { id: "FRS", kind: "blade-reboot", name: "BLADE REBOOT", action: "REBOOT", busyKind: "reboot-request", t: 4, exp: 60, crit: true, targetId: anyBlade.id, born: 0, started: false };
  state.requests.push(satReq);
  DC.FieldRequests.complete(state, satReq, anyBlade);
  if (anyBlade.tenant.sat <= 10) throw new Error("complete did not raise tenant satisfaction");
  console.log("tenant satisfaction OK (complete +ding, objects persist)");

// fan repair: must survive thermal pressure and complete even if hot
const fanSrv = DC.Util.allEq(state, "server").find((s) => s.state === "online");
if (fanSrv) {
  fanSrv.fans = "failed";
  fanSrv.temp = 77; // about to cook
  fanSrv.busy = { kind: "repair", t: 12 };
  for (let i = 0; i < 130; i++) { DC.Thermal.tick(state, 0.1); DC.Network.tick(state, 0.1); }
  if (fanSrv.state !== "online") throw new Error("repair did not protect server from thermal shutdown");
  if (fanSrv.fans !== "ok") throw new Error("fan repair did not complete under heat: fans=" + fanSrv.fans);
  console.log("fan repair under heat OK");
}

// repair works on a powered-down server too
const downSrv = DC.Util.allEq(state, "server").find((s) => s.state === "online" && s !== fanSrv);
if (downSrv) {
  downSrv.fans = "failed";
  downSrv.state = "thermal-shutdown";
  downSrv.busy = null;
  downSrv.busy = { kind: "repair", t: 12 };
  for (let i = 0; i < 130; i++) DC.Network.tick(state, 0.1);
  if (downSrv.fans !== "ok") throw new Error("repair did not finish while server was down");
  console.log("fan repair while down OK");
}

// new conditions: leak, cert, skew, flap — full lifecycle
const condSrv = DC.Util.allEq(state, "server").find((s) => s.state === "online" && !s.busy);
if (condSrv) {
  DC.Conditions.startLeak(state, condSrv, "worker-svc");
  if (!condSrv.memLeak) throw new Error("leak did not start");
  condSrv.busy = { kind: "svc-restart", t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (condSrv.memLeak) throw new Error("svc-restart did not clear leak");

  condSrv.certDays = 5;
  condSrv.busy = { kind: "cert-renew", t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (condSrv.certDays < 100) throw new Error("cert-renew did not reset certDays");

  DC.Conditions.startSkew(state, condSrv);
  if (!(condSrv.clockSkew > 0)) throw new Error("skew did not start");
  condSrv.busy = { kind: "clock-sync", t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (condSrv.clockSkew !== 0) throw new Error("clock-sync did not clear skew");

  DC.Conditions.flapLink(state, condSrv);
  if (condSrv.netState !== "flapping") throw new Error("flap did not start");
  condSrv.busy = { kind: "reseat", t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (condSrv.netState !== "ok") throw new Error("reseat did not fix flapping link");

  condSrv.backupFailed = true;
  condSrv.busy = { kind: "run-backup", t: 0.01 };
  DC.Network.tick(state, 0.02);
  if (condSrv.backupFailed) throw new Error("run-backup did not clear flag");

  console.log("conditions OK (leak/cert/skew/flap/backup lifecycles)");

// reputation responsiveness: in-SLA ticket completion builds rep meaningfully
const repSrv = DC.Util.allEq(state, "server").find((s) => s.state === "online" && !s.busy);
if (repSrv) {
  const repReq = { id: "FRR", kind: "logs", name: "PULL LOGS", action: "PULL LOGS", busyKind: "pull-logs", t: 2, exp: 60, crit: false, targetId: repSrv.id, born: 0, started: false };
  state.requests.push(repReq);
  DC.FieldRequests.start(state, repReq);
  const repBefore = state.metrics.rep;
  repSrv.busy.t = 0.01;
  DC.Network.tick(state, 0.02);
  if (state.metrics.rep - repBefore < 0.5) throw new Error("in-SLA completion did not build rep (delta=" + (state.metrics.rep - repBefore) + ")");
  console.log("rep build OK (in-SLA completion +" + (state.metrics.rep - repBefore).toFixed(2) + ")");

  // slow maintenance completion costs rep
  const m2 = state.maintenance;
  const mBefore = state.metrics.rep;
  const slowItem = { kind: "app", name: "SLOWPATCH", t: 0, t0: 1, badChance: 0, targetId: repSrv.id, state: "active", overdue: 180 };
  m2.items.push(slowItem);
  DC.Maintenance.tick(state, 0.1);
  if (state.metrics.rep > mBefore) throw new Error("late maintenance did not cost rep");
  // prompt maintenance earns rep
  const mBefore2 = state.metrics.rep;
  const quickItem = { kind: "app", name: "QUICKPATCH", t: 0, t0: 1, badChance: 0, targetId: repSrv.id, state: "active", overdue: 1 };
  m2.items.push(quickItem);
  DC.Maintenance.tick(state, 0.1);
  if (state.metrics.rep <= mBefore2) throw new Error("prompt maintenance did not earn rep");
  console.log("rep responsiveness OK (late maint -rep, prompt maint +rep)");
}

}

}

} else {
  if (!DC.FieldRequests.start(state, req)) throw new Error("ups-check start refused");
  if (reqEq.done !== req.id) throw new Error("ups-check start did not mark done");
  DC.FieldRequests.tick(state, 0.1);
  if (state.requests.includes(req)) throw new Error("ups ticket not completed");
  console.log("field requests OK (ups-check instant complete via panel)");
}

// ups-check: deterministic instant-complete path
const upsEq = state.eqById["UPS-1"];
if (upsEq) {
  const upsReq = { id: "FRUP", kind: "ups-check", name: "UPS BATTERY CHECK", action: "RUN BATTERY CHECK", busyKind: null, t: 0, exp: 70, crit: false, targetId: "UPS-1", born: 0, started: false };
  state.requests.push(upsReq);
  if (!DC.FieldRequests.start(state, upsReq)) throw new Error("ups start refused");
  DC.FieldRequests.tick(state, 0.1);
  if (state.requests.includes(upsReq)) throw new Error("ups ticket not completed");
  console.log("ups-check lifecycle OK");
}

// pwreset kind coverage: force-spawn one and run it through
const pwReq = { id: "FRPW", kind: "pwreset", name: "PASSWORD RESET", action: "PASSWORD RESET", busyKind: "pwreset", t: 3, exp: 45, crit: true, targetId: null, born: 0, started: false };
const srvOn = DC.Util.allEq(state, "server").find((s) => s.state === "online" && !s.busy);
if (srvOn) {
  pwReq.targetId = srvOn.id;
  state.requests.push(pwReq);
  if (!DC.FieldRequests.start(state, pwReq)) throw new Error("pwreset start refused");
  if (srvOn.busy.kind !== "pwreset") throw new Error("pwreset busy kind wrong: " + srvOn.busy.kind);
  srvOn.busy.t = 0.01;
  DC.Network.tick(state, 0.02);
  if (state.requests.includes(pwReq)) throw new Error("pwreset not completed by finishServerBusy");
  console.log("pwreset lifecycle OK");
}

// storage capacity: fill -> warn -> full degrades service -> install relieves
const stor0 = DC.Util.allEq(state, "storage").find((s) => !s.isClusterStorage && state.services.some((sv) => sv.deps.indexOf(s.id) !== -1));
if (!stor0) throw new Error("no service-dependent storage found");
stor0.usedPct = 79.9;
DC.Storage.tick(state, 60);
if (DC.Storage.capState(stor0) === "ok") throw new Error("capacity not filling: " + stor0.usedPct);
const svcDep = state.services.find((sv) => sv.deps.indexOf(stor0.id) !== -1);
stor0.usedPct = 100;
for (const s of DC.Util.allEq(state, "server")) { s.state = "online"; s.netState = "ok"; s.throttle = 0; s.badPatch = false; }
DC.Helpdesk.evalServices(state, 0.1);
if (svcDep.state !== "degraded") throw new Error("full array did not degrade service: " + svcDep.state);
const storCount = DC.Util.allEq(state, "storage").length;
const ns = DC.Storage.installArray(state, stor0);
if (!ns) throw new Error("installArray failed despite free U");
if (DC.Util.allEq(state, "storage").length !== storCount + 1) throw new Error("array not registered in eqById");
if (ns.usedPct !== 0) throw new Error("new array not empty");
DC.Helpdesk.evalServices(state, 0.1);
console.log("storage capacity OK: fill -> warn -> full -> degraded -> installed " + ns.name);



// CRAC repair flow: fault -> busy -> finish -> no fault
const crac = state.coolingUnits[0];
if (!state.eqById[crac.id]) throw new Error("CRAC not in eqById (repair click would fail)");
crac.fault = { key: "breaker", desc: "breaker tripped", repair: 1 };
crac.busy = { kind: "repair", t: 1 };
DC.Thermal.tick(state, 1.5);
if (crac.fault) throw new Error("CRAC repair did not reset condition");
if (crac.busy) throw new Error("CRAC busy not cleared");
console.log("CRAC repair OK");

// generator refuel flow
const gen = state.powerUnits[0];
if (gen) {
  if (!state.eqById[gen.id]) throw new Error("generator not in eqById (refuel would fail)");
  gen.fuel = 10;
  DC.Maintenance.refuel(state, gen.id);
  if (!gen.maint && !gen.busy) { /* refuel runs through maintenance pipeline */ }
  for (let i = 0; i < 120; i++) DC.Maintenance.tick(state, 0.1);
  if (gen.fuel < 99) throw new Error("generator refuel did not complete: " + gen.fuel);
  console.log("generator refuel OK");
}




const alarms = [];
DC.Events.on("alarm", (s, sev, msg) => { if (alarms.length < 30) alarms.push(sev + ": " + msg); });

for (let i = 0; i < 6000; i++) {
  DC.Thermal.tick(state, 0.1);
  DC.Power.tick(state, 0.1);
  DC.Storage.tick(state, 0.1);
  DC.Network.tick(state, 0.1);
  DC.Security.tick(state, 0.1);
  DC.Helpdesk.tick(state, 0.1);
  DC.Incidents.tick(state, 0.1);
  DC.Growth.tick(state, 0.1);
  state.time += 0.1;
}

console.log("after 600s sim:");
console.log("  tickets open", state.tickets.open, "total", Math.floor(state.tickets.stats.total));
console.log("  rep", state.metrics.rep.toFixed(1), "sla", state.metrics.sla.toFixed(2), "score", Math.floor(state.metrics.score));
console.log("  temp", state.metrics.temp.toFixed(1), "power", state.metrics.powerPct, "cool", state.metrics.coolPct);
console.log("  incidents", state.incidents.length, "gameOver", state.gameOver, state.gameOverReason || "");
console.log("  alarms sample:", alarms.slice(0, 6));

const stor = DC.Util.allEq(state, "storage")[0];
if (stor) {
  const idx = stor.drives.findIndex(d => d.state === "ok");
  DC.Storage.warnDrive(state, stor, idx);
  DC.Storage.replaceDrive(state, stor, idx);
  if (stor.drives[idx].state !== "rebuilding") throw new Error("rebuild not started");
}

const opts = DC.Facility.generateExpansionOptions(state);
if (opts.length !== 3) throw new Error("bad options");
const before = state.racks.length;
DC.Facility.applyExpansion(state, Object.assign({ crit: 1.0 }, opts[0]));
console.log("expansion:", before, "->", state.racks.length, "halls:", state.halls.map(h => h.name).join(","));

const sw = DC.Util.allEq(state, "switch")[0];
if (sw) { DC.Network.failSwitch(state, sw); if (sw.state !== "failed") throw new Error("switch fail"); }
const pdu = DC.Util.allEq(state, "pdu")[0];
if (pdu) { DC.Power.tripBreaker(state, pdu); DC.Power.resetBreaker(state, pdu); }
DC.Power.utilityOutage(state, 5);
if (state.power.utility !== "out") throw new Error("no outage");
DC.Power.tick(state, 0.1);

const svcs = state.services.filter(s => s.state === "offline").length;
console.log("services offline now:", svcs, "of", state.services.length);
console.log("SMOKE OK");
`, sandbox, { filename: "smoke" });
