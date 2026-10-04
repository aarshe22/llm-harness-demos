window.DC = window.DC || {};

DC.Events = {
  handlers: {},
  on: function (ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
  emit: function (ev, a, b, c) { const h = this.handlers[ev]; if (h) for (const f of h) f(a, b, c); },

  alarm: function (state, sev, msg, targetId) {
    state.alarms.unshift({ id: "AL" + Math.random().toString(36).slice(2, 8), sev, msg, targetId, time: state.time, new: true });
    if (state.alarms.length > 60) state.alarms.pop();
    DC.Events.emit("alarm", state, sev, msg);
    if (sev === "crit") DC.Audio.alarm("crit", msg);
    else if (sev === "warn") DC.Audio.alarm("warn", msg);
  },
  resolve: function (state, targetId, what) {
    const inc = state.incidents.find((i) => i.targetId === targetId && !i.resolved);
    if (inc) { inc.resolved = true; inc.resolvedAt = state.time; }
    for (const a of state.alarms) if (a.targetId === targetId) a.cleared = true;
    DC.Events.emit("resolved", state, targetId);
  },
  prevent: function (state, what, tickets) {
    state.stats.preventions++;
    const pts = 250;
    state.metrics.score += pts;
    state.tickets.stats.prevented += tickets || 0;
    state.metrics.rep = Math.min(100, state.metrics.rep + 0.8 * DC.CFG.repGain);
    DC.Events.emit("toast", state, "PREVENTION +" + pts + (tickets ? "  ·  TICKETS PREVENTED +" + tickets : ""), "good", what);
    DC.Audio.good();
  },
  stat: function (state, key, n) { if (state.stats[key] !== undefined) state.stats[key] += n; },
  dataLoss: function (state, msg, targetId) {
    state.stats.dataLoss++;
    state.metrics.dataPct = Math.max(0, state.metrics.dataPct - 10);
    state.metrics.rep = Math.max(0, state.metrics.rep - 8 * DC.CFG.repLoss);
    state.metrics.score = Math.max(0, state.metrics.score - 1000);
    DC.Events.alarm(state, "crit", "DATA LOSS: " + msg, targetId);
    DC.Events.emit("toast", state, "DATA LOSS — " + msg, "bad");
  },
  onThermalShutdown: function (state, eq) {
    DC.Events.alarm(state, "crit", eq.name + " THERMAL SHUTDOWN", eq.id);
  },
  ticketChirp: function () { DC.Audio.beep(1300, 0.03, "sine", 0.025); }
};

DC.Incidents = (function () {
  const cfg = () => DC.CFG;

  function incidentFor(state, kind) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    switch (kind) {
      case "drive-fail": {
        const stor = DC.Util.allEq(state, "storage").filter((s) => s.state === "online" && s.controller === "ok" && DC.Storage.failedCount(s) === 0 && s.drives.some((d) => d.state === "ok"));
        if (!stor.length) return null;
        const st = pick(stor);
        const idx = st.drives.findIndex((d) => d.state === "ok");
        return { run: () => DC.Storage.failDrive(state, st, idx), targetId: st.id };
      }
      case "drive-warn": {
        const stor = DC.Util.allEq(state, "storage").filter((s) => s.drives.some((d) => d.state === "ok"));
        if (!stor.length) return null;
        const st = pick(stor);
        return { run: () => DC.Storage.warnDrive(state, st), targetId: st.id };
      }
      case "psu-fail": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && s.psuA === "ok" && s.psuB === "ok");
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => {
            if (Math.random() < 0.5) srv.psuA = "failed"; else srv.psuB = "failed";
            DC.Events.alarm(state, "warn", srv.name + " PSU failure — running on remaining PSU", srv.id);
          },
          targetId: srv.id
        };
      }
      case "fan-fail": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && s.fans === "ok");
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => { srv.fans = "failed"; DC.Events.alarm(state, "warn", srv.name + " FAN 2 FAILED — cooling reduced", srv.id); },
          targetId: srv.id
        };
      }
      case "runaway": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && !s.runaway);
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => { srv.runaway = "proc-worker"; srv.load = Math.min(100, srv.load + 45); DC.Events.alarm(state, "warn", srv.name + " runaway process — CPU pinned", srv.id); },
          targetId: srv.id
        };
      }
      case "disk-full": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && !s.diskFull);
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => { srv.diskFull = true; DC.Events.alarm(state, "warn", srv.name + " LOG VOLUME FULL", srv.id); },
          targetId: srv.id
        };
      }
      case "ecc": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && s.ecc < 3);
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => {
            srv.ecc++;
            if (srv.ecc >= 3) DC.Events.alarm(state, "warn", srv.name + " DIMM FAILURE LIKELY — replace memory", srv.id);
            else DC.Events.alarm(state, "info", srv.name + " ECC correctable error " + srv.ecc + "/3", srv.id);
          },
          targetId: srv.id
        };
      }
      case "controller": {
        const stor = DC.Util.allEq(state, "storage").filter((s) => s.state === "online" && s.controller === "ok");
        if (!stor.length) return null;
        const st = pick(stor);
        return {
          run: () => { st.controller = "fault"; DC.Events.alarm(state, "crit", st.name + " CONTROLLER FAULT", st.id); },
          targetId: st.id
        };
      }
      case "pdu-trip": {
        const pdus = [];
        for (const r of state.racks) for (const e of r.equipment) if (e.type === "pdu" && !e.tripped) pdus.push({ p: e, load: r.drawKW || 0 });
        if (!pdus.length) return null;
        const t = pick(pdus);
        return {
          run: () => {
            if (DC.Power.tripBreaker(state, t.p)) DC.Events.emit("incident", state, "pdu");
          },
          targetId: t.p.id
        };
      }
      case "utility": {
        return {
          run: () => { DC.Power.utilityOutage(state, 25 + Math.random() * 40); },
          targetId: null
        };
      }
      case "crac": {
        const cracs = state.coolingUnits.filter((c) => !c.fault);
        if (!cracs.length) return null;
        const cr = pick(cracs);
        const faults = [
          { key: "fan", desc: "fan failure", repair: 10 },
          { key: "filter", desc: "filter clogged", repair: 6 },
          { key: "compressor", desc: "compressor fault", repair: 16 },
          { key: "pump", desc: "pump pressure low", repair: 12 },
          { key: "leak", desc: "COOLANT LEAK — pressure falling", repair: 14 },
          { key: "breaker", desc: "breaker tripped", repair: 4 }
        ];
        const f = pick(faults);
        return { run: () => { DC.Thermal.failCRAC(state, cr, f); }, targetId: cr.id };
      }
      case "switch-fail": {
        const sws = DC.Util.allEq(state, "switch").filter((s) => s.state === "online");
        if (!sws.length) return null;
        const sw = pick(sws);
        return { run: () => DC.Network.failSwitch(state, sw), targetId: sw.id };
      }
      case "security": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online" && s.sec === "clean" && s.netState === "ok");
        if (!servers.length) return null;
        const srv = pick(servers);
        return { run: () => DC.Network.startSecurity(state, srv), targetId: srv.id };
      }
      case "backup-fail": {
        const servers = DC.Util.allEq(state, "server").filter((s) => s.state === "online");
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => {
            DC.Events.alarm(state, "warn", "BACKUP FAILED on " + srv.name, srv.id);
            srv.backupFailed = true;
          },
          targetId: srv.id
        };
      }
      case "water-leak": {
        const hall = pick(state.halls);
        if (hall.leak) return null;
        return {
          run: () => {
            hall.leak = true;
            DC.Events.alarm(state, "crit", hall.name + " WATER LEAK detected — electrical risk rising", null);
          },
          targetId: null
        };
      }
      case "cluster-node-fail": {
        if (!state.clusters || !state.clusters.length) return null;
        const cl = pick(state.clusters);
        const nodes = cl.nodes.map((id) => state.eqById[id]).filter((n) => n && n.state === "online");
        if (!nodes.length) return null;
        const n = pick(nodes);
        return {
          run: () => {
            n.state = "offline";
            n.busy = null;
            DC.Events.alarm(state, "crit", n.name + " NODE DOWN — cluster failover pending", n.id);
          },
          targetId: n.id
        };
      }
      case "cluster-storage-fail": {
        if (!state.clusters || !state.clusters.length) return null;
        const cl = pick(state.clusters);
        const st = state.eqById[cl.storage];
        if (!st || st.controller !== "ok") return null;
        const oks = st.drives.filter((d) => d.state === "ok");
        if (!oks.length) return null;
        const d = pick(oks);
        return { run: () => DC.Storage.failDrive(state, st, st.drives.indexOf(d)), targetId: st.id };
      }
      case "battery-stress": {
        const ups = state.eqById["UPS-1"];
        if (!ups || !ups.batteries || !ups.batteries.some((b) => !b.dead)) return null;
        return { run: () => DC.Maintenance.batteryStress(state), targetId: "UPS-1" };
      }
      case "mem-leak": {
        const servers = DC.Util.allEq(state).filter((s) => (s.type === "server" || s.type === "blade") && s.state === "online" && !s.memLeak && s.load < 85);
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => DC.Conditions.startLeak(state, srv, pick(["worker-svc", "java-heap", "nginx-cache", "auditd", "backup-agent"])),
          targetId: srv.id
        };
      }
      case "cert-expiring": {
        const servers = DC.Util.allEq(state).filter((s) => (s.type === "server" || s.type === "blade") && s.state === "online" && s.certDays !== undefined && s.certDays > 21);
        if (!servers.length) return null;
        const srv = pick(servers);
        return {
          run: () => { srv.certDays = Math.min(srv.certDays, 6 + Math.random() * 6); DC.Events.alarm(state, "warn", srv.name + " TLS certificate expires in " + Math.ceil(srv.certDays) + "d — renew soon", srv.id); },
          targetId: srv.id
        };
      }
      case "ntp-skew": {
        const servers = DC.Util.allEq(state).filter((s) => (s.type === "server" || s.type === "blade") && s.state === "online" && (!s.clockSkew || s.clockSkew === 0));
        if (!servers.length) return null;
        const srv = pick(servers);
        return { run: () => DC.Conditions.startSkew(state, srv), targetId: srv.id };
      }
      case "flap-link": {
        const servers = DC.Util.allEq(state).filter((s) => (s.type === "server" || s.type === "blade") && s.state === "online" && s.netState === "ok");
        if (!servers.length) return null;
        const srv = pick(servers);
        return { run: () => DC.Conditions.flapLink(state, srv), targetId: srv.id };
      }
      case "wan-degrade": {
        const wans = (state.wans || []).filter((w) => w.state === "ok" && w.maintT <= 0);
        if (!wans.length) return null;
        const w = pick(wans);
        return { run: () => DC.Wan.degrade(state, w, 70 + Math.random() * 150, false), targetId: w.id };
      }
      case "wan-outage": {
        const wans = (state.wans || []).filter((w) => w.state === "ok" || w.state === "degraded");
        if (!wans.length) return null;
        const w = pick(wans);
        return { run: () => DC.Wan.fail(state, w, 110 + Math.random() * 220), targetId: w.id };
      }
      case "fw-attack": {
        const wans = (state.wans || []).filter((w) => w.fw && !w.fw.overloaded && !w.fw.busy);
        if (!wans.length) return null;
        const w = pick(wans);
        return { run: () => DC.Wan.startAttack(state, w), targetId: w.fw.id };
      }
    }
    return null;
  }

  function weightedKinds(state) {
    const dna = state.dna;
    const w = {
      "drive-fail": 10 * cfg().driveFail,
      "drive-warn": 6 * cfg().warnRate,
      "psu-fail": 7,
      "fan-fail": 6,
      "runaway": 5,
      "disk-full": 4,
      "ecc": 3,
      "controller": 3,
      "pdu-trip": 5,
      "utility": 3 * cfg().utilFail,
      "crac": 7,
      "switch-fail": 5 * cfg().netFail,
      "security": 4 * cfg().securityRate,
      "backup-fail": 3,
      "water-leak": 1.5 * cfg().leaks,
      "cluster-node-fail": state.clusters && state.clusters.length ? 5 : 0,
      "cluster-storage-fail": state.clusters && state.clusters.length ? 4 * cfg().driveFail : 0,
      "battery-stress": 2.5,
      "mem-leak": 5,
      "cert-expiring": 4,
      "ntp-skew": 3,
      "flap-link": 4,
      "wan-degrade": 3.2 * cfg().wanFail,
      "wan-outage": 2.2 * cfg().wanFail,
      "fw-attack": 3.4 * cfg().fwAttack
    };
    if (dna.failurePersonality === "storage") { w["drive-fail"] *= 2; w["controller"] *= 2; }
    if (dna.failurePersonality === "thermal") w["crac"] *= 2;
    if (dna.failurePersonality === "electrical") { w["pdu-trip"] *= 2.2; w["utility"] *= 1.8; }
    if (dna.failurePersonality === "network") { w["switch-fail"] *= 2.2; w["security"] *= 1.5; }
    const rackScale = 0.7 + state.racks.length * 0.09;
    for (const k in w) w[k] *= rackScale * cfg().failureFreq;
    return w;
  }

  function spawn(state) {
    if (state.paused || state.gameOver || state.growth.expansionPending) return;
    const kinds = weightedKinds(state);
    let total = 0; for (const k in kinds) total += kinds[k];
    let r = Math.random() * total;
    let chosen = null;
    for (const k in kinds) { r -= kinds[k]; if (r <= 0) { chosen = k; break; } }
    if (!chosen) return;
    const inc = incidentFor(state, chosen);
    if (inc && inc.run) {
      inc.run();
      state.incidents.push({ id: "INC" + Math.random().toString(36).slice(2, 7), kind: chosen, targetId: inc.targetId, start: state.time, resolved: false });
      if (state.incidents.length > 200) state.incidents = state.incidents.filter((i) => !i.resolved).concat(state.incidents.filter((i) => i.resolved).slice(-20));
    }
  }

  function activeLoad(state) {
    let crit = 0, warn = 0;
    for (const a of state.alarms) {
      if (a.cleared || state.time - a.time > 40) continue;
      if (a.sev === "crit") crit++; else if (a.sev === "warn") warn++;
    }
    return crit * 2 + warn;
  }

  function tick(state, dt) {
    const d = state.director;
    const load = activeLoad(state);
    if (load >= 8) d.state = "CRISIS";
    else if (load >= 4) d.state = "BUSY";
    else if (load >= 2) d.state = "PRESSURE";
    else if (load === 0) { if (d.state === "CRISIS" || d.state === "BUSY") d.state = "RECOVERY"; else d.state = "CALM"; }
    else d.state = "CALM";
    d.intensity = load;
    if (d.state === "RECOVERY") { d.timer -= dt * 0.3; }
    else if (d.state === "CALM") d.timer -= dt;
    else if (d.state === "PRESSURE") d.timer -= dt * 0.55;
    else if (d.state === "BUSY") d.timer -= dt * 0.2;
    else if (d.timer > 2) d.timer -= dt * 0.05;
    if (d.timer <= 0) {
      spawn(state);
      const base = 26 / cfg().difficulty;
      const variance = 0.55 + Math.random() * 0.9;
      let t = base * variance;
      if (d.state === "CRISIS") t = Math.max(6, t * 2.2);
      if (d.state === "BUSY") t = Math.max(8, t * 1.5);
      if (d.state === "RECOVERY") t *= 1.6;
      d.timer = t;
    }
  }

  return { tick, spawn, incidentFor, activeLoad };
})();
