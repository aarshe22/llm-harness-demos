window.DC = window.DC || {};

DC.FieldRequests = (function () {

  // busy: which eq.busy.kind this request's work runs as (null = instant, done via panel button on the UPS itself)
  const KINDS = [
    { id: "reboot", name: "REBOOT SERVER", action: "REBOOT", busy: "reboot-request", t: 6, exp: 55, crit: true,
      msg: "customer says '{eq} is acting weird, just reboot it please'",
      eligible: (s) => s.state === "online" },
    { id: "bounce-svc", name: "BOUNCE SERVICE", action: "BOUNCE SERVICE", busy: "reboot-request", t: 8, exp: 60, crit: true,
      msg: "app team can't reach {eq} — bounce the service",
      eligible: (s) => s.state === "online" },
    { id: "logs", name: "PULL LOGS", action: "PULL LOGS", busy: "pull-logs", t: 5, exp: 50, crit: false,
      msg: "support needs a log bundle from {eq}",
      eligible: (s) => s.state === "online" },
    { id: "patch-check", name: "VERIFY PATCH LEVEL", action: "VERIFY PATCHES", busy: "patch-check", t: 7, exp: 55, crit: false,
      msg: "auditor wants patch level verified on {eq}",
      eligible: (s) => s.state === "online" },
    { id: "cable", name: "RESEAT CABLES", action: "RESEAT CABLES", busy: "reseat", t: 9, exp: 65, crit: false,
      msg: "intermittent link on {eq} — reseat the cables",
      eligible: (s) => s.state === "online" && s.netState === "ok" },
    { id: "ups-check", name: "UPS BATTERY CHECK", action: "RUN BATTERY CHECK", busy: null, t: 0, exp: 70, crit: false,
      msg: "facilities asks for a UPS battery check",
      eligible: null },
    { id: "pwreset", name: "PASSWORD RESET", action: "PASSWORD RESET", busy: "pwreset", t: 3, exp: 45, crit: true,
      msg: "locked-out user needs a password reset on {eq}",
      eligible: (s) => s.state === "online" },
    { id: "unlock", name: "ACCOUNT UNLOCK", action: "UNLOCK ACCOUNT", busy: "pwreset", t: 2, exp: 40, crit: true,
      msg: "account lockout storm pointed at {eq} — unlock the account",
      eligible: (s) => s.state === "online" },
    { id: "grant", name: "GRANT ACCESS", action: "GRANT ACCESS", busy: "pwreset", t: 4, exp: 50, crit: false,
      msg: "new contractor needs access provisioned on {eq}",
      eligible: (s) => s.state === "online" },
    { id: "share", name: "MOUNT SHARE", action: "MOUNT SHARE", busy: "mount-share", t: 5, exp: 55, crit: false,
      msg: "user can't see the shared folder mounted from {eq}",
      eligible: (s) => s.state === "online" },
    { id: "cert", name: "RENEW CERT", action: "RENEW CERT", busy: "cert-renew", t: 7, exp: 90, crit: false,
      msg: "security team wants the TLS cert on {eq} renewed before it lapses",
      eligible: (s) => s.state === "online" },
    { id: "svc-restart", name: "RESTART SERVICE", action: "RESTART SERVICE", busy: "svc-restart", t: 8, exp: 70, crit: true,
      msg: "memory graphs on {eq} look wrong — restart the leaky service",
      eligible: (s) => s.state === "online" },
    { id: "fix-link", name: "FIX FLAPPING LINK", action: "RESEAT CABLES", busy: "reseat", t: 9, exp: 75, crit: false,
      msg: "monitoring shows the link on {eq} bouncing — reseat cables",
      eligible: (s) => s.state === "online" },
    { id: "dns", name: "FLUSH DNS", action: "FLUSH DNS", busy: "dns-flush", t: 3, exp: 50, crit: false,
      msg: "name resolution is stale on {eq} — flush the resolver cache",
      eligible: (s) => s.state === "online" },
    { id: "clock", name: "SYNC CLOCK", action: "SYNC CLOCK", busy: "clock-sync", t: 4, exp: 60, crit: false,
      msg: "audit flagged clock skew on {eq} — resync to NTP",
      eligible: (s) => s.state === "online" },
    { id: "backup-run", name: "RUN BACKUP", action: "RUN BACKUP", busy: "run-backup", t: 10, exp: 85, crit: true,
      msg: "last backup on {eq} failed — kick one off now",
      eligible: (s) => s.state === "online" },
    { id: "fetch-report", name: "FETCH REPORT", action: "FETCH REPORT", busy: "print", t: 6, exp: 80, crit: false,
      msg: "accounting needs a report printed from PRN-1 for pickup",
      eligible: null },
    { id: "clear-jam", name: "CLEAR JAM", action: "CLEAR JAM", busy: null, t: 0, exp: 75, crit: false,
      msg: "PRN-1 has a paper jam — clear the platen",
      eligible: null },
    { id: "refill-paper", name: "REFILL PAPER", action: "REFILL PAPER", busy: null, t: 0, exp: 70, crit: false,
      msg: "PRN-1 is out of paper — load the tractor feed",
      eligible: null },
    { id: "tape-mount", name: "MOUNT TAPE", action: "MOUNT TAPE", busy: null, t: 0, exp: 80, crit: false,
      msg: "backup queue stalled — load a fresh tape into TAPE-1",
      eligible: null },
    { id: "tape-export", name: "EXPORT TAPES", action: "RUN EXPORT", busy: null, t: 0, exp: 90, crit: false,
      msg: "offsite rotation due — pull the export tapes from TAPE-1",
      eligible: null },
    { id: "tape-unjam", name: "UNJAM TAPE", action: "UNJAM TAPE", busy: null, t: 0, exp: 75, crit: false,
      msg: "TAPE-1 has a tape jammed in a drive — clear the mechanism",
      eligible: null }
  ];

  const BLADE_KINDS = [
    { id: "blade-reboot", name: "BLADE REBOOT", action: "REBOOT", busy: "reboot-request", t: 8, exp: 60, crit: true,
      msg: "tenant '{eq}' demands a blade reboot",
      eligible: (s) => s.type === "blade" && s.state === "online" },
    { id: "pwreset", name: "PASSWORD RESET", action: "PASSWORD RESET", busy: "pwreset", t: 3, exp: 45, crit: true,
      msg: "{eq} tenant locked out — reset the password",
      eligible: (s) => s.type === "blade" && s.state === "online" },
    { id: "console", name: "OPEN CONSOLE SESSION", action: "OPEN CONSOLE", busy: "patch-check", t: 6, exp: 50, crit: false,
      msg: "tenant '{eq}' requested a console session",
      eligible: (s) => s.type === "blade" && s.state === "online" },
    { id: "resize", name: "APPLY RESIZE", action: "APPLY RESIZE", busy: "reseat", t: 10, exp: 70, crit: true,
      msg: "tenant '{eq}' paid for a plan upgrade — apply the resize",
      eligible: (s) => s.type === "blade" && s.state === "online" }
  ];

  let seq = 0;

  function eligibleServers(state) {
    return DC.Util.allEq(state, "server").filter((s) => s.state === "online" && !s.maint && (!s.busy || s.busy.kind === "reboot-request"));
  }

  function spawn(state) {
    if (state.paused || state.gameOver) return;
    // both WAN paths dark: most external tickets can't arrive
    if (DC.Wan && DC.Wan.dark(state) && Math.random() < 0.75) return;
    const withUps = state.eqById["UPS-1"];
    const blades = state.blades || [];
    const pool = [];
    for (const k of KINDS) {
      if (k.id === "ups-check") { if (withUps) pool.push({ k, w: 0.7, target: "UPS-1" }); continue; }
      const srvs = eligibleServers(state);
      if (srvs.length) pool.push({ k, w: 1 });
    }
    for (const k of BLADE_KINDS) {
      const cand = blades.filter((b) => k.eligible(b));
      if (cand.length) pool.push({ k, w: 1.6, target: cand[Math.floor(Math.random() * cand.length)].id });
    }
    // printer tickets
    const prn = state.eqById["PRN-1"];
    if (prn && DC.Printer && !(state.requests || []).some((r) => r.targetId === "PRN-1")) {
      if (prn.jam) pool.push({ k: KINDS.find((k) => k.id === "clear-jam"), w: 3, target: "PRN-1" });
      else if (prn.paper < 15) pool.push({ k: KINDS.find((k) => k.id === "refill-paper"), w: 3, target: "PRN-1" });
      else if (!prn.printing && prn.paper > 5) pool.push({ k: KINDS.find((k) => k.id === "fetch-report"), w: 0.8, target: "PRN-1" });
    }
    // tape library tickets
    const tape = state.eqById["TAPE-1"];
    if (tape && DC.Tape && !(state.requests || []).some((r) => r.targetId === "TAPE-1")) {
      if (tape.jam) pool.push({ k: KINDS.find((k) => k.id === "tape-unjam"), w: 3, target: "TAPE-1" });
      else if (tape.exportsPending > 2) pool.push({ k: KINDS.find((k) => k.id === "tape-export"), w: 2.2, target: "TAPE-1" });
      else if (!tape.robot && DC.Tape.fullSlots(tape) > 0 && tape.drives.some((d) => !d.tape)) pool.push({ k: KINDS.find((k) => k.id === "tape-mount"), w: 0.9, target: "TAPE-1" });
    }
    if (!pool.length) return;
    let total = 0; for (const p of pool) total += p.w;
    let r = Math.random() * total, pick = pool[0];
    for (const p of pool) { r -= p.w; if (r <= 0) { pick = p; break; } }
    const kind = pick.k;
    let target = pick.target;
    if (!target) {
      const srvs = eligibleServers(state);
      if (!srvs.length) return;
      target = srvs[Math.floor(Math.random() * srvs.length)].id;
    }
    const req = {
      id: "FR" + (++seq),
      kind: kind.id,
      name: kind.name,
      action: kind.action,
      busyKind: kind.busy,
      t: kind.t,
      exp: kind.exp,
      crit: kind.crit,
      targetId: target,
      born: state.time,
      started: false
    };
    state.requests.push(req);
    const eqName = target === "UPS-1" ? "UPS MAIN" : (state.eqById[target] ? state.eqById[target].name : target);
    DC.Events.alarm(state, "crit", "[TICKET] " + kind.name + " — " + kind.msg.replace("{eq}", eqName), target);
    DC.Audio.ticketVoice();
  }

  function reqFor(state, eq) {
    return (state.requests || []).find((r) => r.targetId === eq.id) || null;
  }

  // push a ticket for a specific fault kind (printer jams, out of paper, ...)
  function spawnFault(state, kindId, targetId) {
    const kind = KINDS.find((k) => k.id === kindId);
    if (!kind) return false;
    if ((state.requests || []).some((r) => r.targetId === targetId && r.kind === kindId)) return false;
    state.requests.push({
      id: "FR" + (++seq),
      kind: kind.id,
      name: kind.name,
      action: kind.action,
      busyKind: kind.busy,
      t: kind.t,
      exp: kind.exp,
      crit: kind.crit,
      targetId,
      born: state.time,
      started: false
    });
    DC.Events.alarm(state, "crit", "[TICKET] " + kind.name + " — " + kind.msg.replace("{eq}", targetId), targetId);
    DC.Audio.ticketVoice();
    return true;
  }

  function start(state, req) {
    if (!req || !state.requests.includes(req)) return false;
    const eq = state.eqById[req.targetId];
    if (!eq) return false;
    // printer tickets run through the Printer module, not the rack-busy loop
    if (req.targetId === "PRN-1" && DC.Printer) {
      const p = eq;
      if (req.kind === "fetch-report") {
        if (p.printing || p.jam || p.paper <= 2) return false;
        DC.Printer.startPrint(state, p, DC.Printer.REPORTS[Math.floor(Math.random() * DC.Printer.REPORTS.length)]);
      } else if (req.kind === "clear-jam") {
        if (!p.jam) return false;
        DC.Printer.clearJam(state, p);
      } else if (req.kind === "refill-paper") {
        if (p.paper >= 95) return false;
        DC.Printer.loadPaper(state, p);
      }
      req.started = true;
      eq.done = req.id;
      markDispatched(state, req);
      DC.Audio.click();
      return true;
    }
    // tape library tickets run through the Tape module
    if (req.targetId === "TAPE-1" && DC.Tape) {
      const t = eq;
      if (req.kind === "tape-mount") {
        if (DC.Tape.fullSlots(t) <= 0 || t.robot) return false;
        const slot = t.slots.find((s) => s.state === "full");
        const di = t.drives.findIndex((d) => !d.tape);
        t.robot = { kind: "mount", t: DC.Tape.JOB_T.mount, t0: DC.Tape.JOB_T.mount, slot: slot.label, driveIdx: di < 0 ? 0 : di };
      } else if (req.kind === "tape-export") {
        if (t.exportsPending <= 0) return false;
        DC.Tape.startExport(state, t); // queues if the arm is busy
      } else if (req.kind === "tape-unjam") {
        if (!t.jam) return false;
        DC.Tape.startUnjam(state, t);
      }
      req.started = true;
      eq.done = req.id;
      markDispatched(state, req);
      DC.Audio.click();
      return true;
    }
    if (req.busyKind === null) {
      // instant menial task (UPS check): completing requires visiting the equipment and clicking
      eq.done = req.id;
      markDispatched(state, req);
      DC.Audio.click();
      return true;
    }
    if (eq.busy) return false;
    if (eq.state !== "online") return false;
    eq.busy = { kind: req.busyKind, t: req.t };
    req.started = true;
    markDispatched(state, req);
    DC.Audio.click();
    return true;
  }

  // task queued: grey out alarms for this equipment so they read as "handled"
  function markDispatched(state, req) {
    for (const a of state.alarms) {
      if (a.targetId === req.targetId && !a.cleared) a.dispatched = true;
    }
  }

  function notifyBusyDone(state, eq, busyKind) {
    const req = (state.requests || []).find((r) => r.targetId === eq.id && r.busyKind === busyKind);
    if (req) complete(state, req, eq);
    return !!req;
  }

  function fail(state, req) {
    const idx = state.requests.indexOf(req);
    if (idx === -1) return;
    // SLA missed — but the work still needs doing. Ticket stays, marked LATE.
    req.late = true;
    req.exp = 90 + Math.random() * 60; // second window; if this expires too, it's gone for good
    state.metrics.rep = Math.max(0, state.metrics.rep - 4 * DC.CFG.repLoss);
    state.metrics.score = Math.max(0, state.metrics.score - 300);
    tenantDing(state, req, -8);
    DC.Events.alarm(state, "crit", "SLA MISSED: " + req.name + " — still open, complete it late", req.targetId);
    DC.Events.emit("toast", state, "SLA MISSED — " + req.name + " (still completable)", "bad");
  }

  function tenantOf(state, req) {
    const eq = state.eqById[req.targetId];
    return (eq && eq.tenant) ? eq.tenant : null;
  }

  function tenantDing(state, req, delta) {
    const t = tenantOf(state, req);
    if (t && t.sat !== undefined) t.sat = DC.Util.clamp(t.sat + delta, 0, 100);
  }

  function complete(state, req, eq) {
    const idx = state.requests.indexOf(req);
    if (idx === -1) return;
    state.requests.splice(idx, 1);
    DC.Events.stat(state, "requestsDone", 1);
    const pts = req.crit ? 200 : 100;
    state.metrics.score += pts;
    // in-SLA work is worth real reputation; late work just stops the bleeding
    const repDelta = req.late ? 0.15 * DC.CFG.repGain : 1.4 * DC.CFG.repGain;
    state.metrics.rep = Math.min(100, state.metrics.rep + repDelta);
    if (req.late) {
      // salvaged: small score, no rep gain, satisfaction partially restored
      tenantDing(state, req, +4);
      DC.Events.emit("toast", state, req.name + " DONE LATE +" + Math.round(pts / 4), "info");
      state.metrics.score += Math.round(pts / 4);
    } else {
      tenantDing(state, req, +2.5);
      DC.Events.emit("toast", state, req.name + " DONE +" + pts, "good");
    }
    DC.Events.resolve(state, eq ? eq.id : req.targetId, req.name + " completed");
    DC.Audio.good();
  }

  function tick(state, dt) {
    if (!state.requests) state.requests = [];
    for (const req of state.requests.slice()) {
      req.exp -= dt;
      if (req.exp <= 0) { fail(state, req); continue; }
      const eq = state.eqById[req.targetId];
      if (eq && eq.done === req.id) {
        eq.done = null;
        complete(state, req, eq);
      }
    }
    const timer = state.requestTimer;
    if (timer === undefined) { state.requestTimer = 25 + Math.random() * 25; return; }
    state.requestTimer = timer - dt * (0.6 + state.metrics.rep / 160);
    if (state.requestTimer <= 0) {
      state.requestTimer = 30 + Math.random() * 40;
      spawn(state);
    }
  }

  return { tick, reqFor, start, notifyBusyDone, complete, fail, spawn, spawnFault };
})();
