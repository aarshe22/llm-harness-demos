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

const files = ["rng.js", "config.js", "data.js", "audio.js", "facility.js", "cluster.js", "thermal.js", "power.js", "storage.js", "network.js", "security.js", "helpdesk.js", "incidents.js", "maintenance.js", "growth.js", "save.js", "tutorial.js"];
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
