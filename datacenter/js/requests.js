window.DC = window.DC || {};

DC.FieldRequests = (function () {

  const KINDS = [
    { id: "reboot", name: "REBOOT SERVER", t: 6, exp: 55, crit: true,
      msg: "customer says '{eq} is acting weird, just reboot it please'",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "reboot-request", t: 6 }; } },
    { id: "bounce-svc", name: "BOUNCE SERVICE", t: 8, exp: 60, crit: true,
      msg: "app team can't reach {eq} — bounce the service",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "reboot-request", t: 8 }; } },
    { id: "logs", name: "PULL LOGS", t: 5, exp: 50, crit: false,
      msg: "support needs a log bundle from {eq}",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "pull-logs", t: 5 }; } },
    { id: "patch-check", name: "VERIFY PATCH LEVEL", t: 7, exp: 55, crit: false,
      msg: "auditor wants patch level verified on {eq}",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "patch-check", t: 7 }; } },
    { id: "cable", name: "RESEAT CABLES", t: 9, exp: 65, crit: false,
      msg: "intermittent link on {eq} — reseat the cables",
      eligible: (s) => s.state === "online" && s.netState === "ok",
      start: (state, eq) => { eq.busy = { kind: "reseat", t: 9 }; } },
    { id: "ups-check", name: "UPS BATTERY CHECK", t: 6, exp: 70, crit: false,
      msg: "facilities asks for a UPS battery check",
      eligible: null,
      start: (state, eq) => { state.requestTimer = 0; } },
    { id: "pwreset", name: "PASSWORD RESET", t: 3, exp: 45, crit: true,
      msg: "locked-out user needs a password reset on {eq}",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "pwreset", t: 3 }; } },
    { id: "unlock", name: "ACCOUNT UNLOCK", t: 2, exp: 40, crit: true,
      msg: "account lockout storm pointed at {eq} — unlock the account",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "pwreset", t: 2 }; } },
    { id: "grant", name: "GRANT ACCESS", t: 4, exp: 50, crit: false,
      msg: "new contractor needs access provisioned on {eq}",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "pwreset", t: 4 }; } },
    { id: "share", name: "MOUNT SHARE", t: 5, exp: 55, crit: false,
      msg: "user can't see the shared folder mounted from {eq}",
      eligible: (s) => s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "reboot-request", t: 5 }; } }
  ];

  const BLADE_KINDS = [
    { id: "blade-reboot", name: "BLADE REBOOT", t: 8, exp: 60, crit: true,
      msg: "tenant '{eq}' demands a blade reboot",
      eligible: (s) => s.type === "blade" && s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "reboot-request", t: 8 }; } },
    { id: "pwreset", name: "PASSWORD RESET", t: 3, exp: 45, crit: true,
      msg: "{eq} tenant locked out — reset the password",
      eligible: (s) => s.type === "blade" && s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "pwreset", t: 3 }; } },
    { id: "console", name: "OPEN CONSOLE SESSION", t: 6, exp: 50, crit: false,
      msg: "tenant '{eq}' requested a console session",
      eligible: (s) => s.type === "blade" && s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "patch-check", t: 6 }; } },
    { id: "resize", name: "APPLY RESIZE", t: 10, exp: 70, crit: true,
      msg: "tenant '{eq}' paid for a plan upgrade — apply the resize",
      eligible: (s) => s.type === "blade" && s.state === "online",
      start: (state, eq) => { eq.busy = { kind: "reseat", t: 10 }; } }
  ];

  let seq = 0;

  function eligibleServers(state) {
    return DC.Util.allEq(state, "server").filter((s) => s.state === "online" && !s.maint && (!s.busy || s.busy.kind === "reboot-request"));
  }

  function spawn(state) {
    if (state.paused || state.gameOver) return;
    const withUps = state.eqById["UPS-1"];
    const blades = state.blades || [];
    const pool = [];
    for (const k of KINDS) {
      if (k.id === "ups-check") { if (withUps) pool.push({ k, w: 0.7 }); continue; }
      const srvs = eligibleServers(state);
      if (srvs.length) pool.push({ k, w: 1 });
    }
    for (const k of BLADE_KINDS) {
      if (blades.some((b) => k.eligible(b))) pool.push({ k, w: 1.6 });
    }
    if (!pool.length) return;
    let total = 0; for (const p of pool) total += p.w;
    let r = Math.random() * total, pick = pool[0];
    for (const p of pool) { r -= p.w; if (r <= 0) { pick = p; break; } }
    const kind = pick.k;
    let target = "UPS-1";
    if (kind.id === "blade-reboot" || kind.id === "console" || kind.id === "resize") {
      target = blades.filter((b) => kind.eligible(b))[0].id;
    } else if (kind.id === "pwreset" || kind.id === "unlock" || kind.id === "grant" || kind.id === "share") {
      const cand = state.blades && state.blades.filter((b) => kind.eligible(b));
      if (cand && cand.length && Math.random() < 0.35) target = cand[Math.floor(Math.random() * cand.length)].id;
      else {
        const srvs = eligibleServers(state);
        target = srvs[Math.floor(Math.random() * srvs.length)].id;
      }
    } else if (kind.id !== "ups-check") {
      const srvs = eligibleServers(state);
      target = srvs[Math.floor(Math.random() * srvs.length)].id;
    }
    const req = {
      id: "FR" + (++seq),
      kind: kind.id,
      name: kind.name,
      t: kind.t,
      exp: kind.exp,
      crit: kind.crit,
      targetId: target,
      born: state.time
    };
    state.requests.push(req);
    const eqName = target === "UPS-1" ? "UPS MAIN" : (state.eqById[target] ? state.eqById[target].name : target);
    DC.Events.alarm(state, "crit", "[TICKET] " + kind.name + " — " + kind.msg.replace("{eq}", eqName), target);
    DC.Audio.alarm("crit");
  }

  function fail(state, req) {
    const idx = state.requests.indexOf(req);
    if (idx === -1) return;
    state.requests.splice(idx, 1);
    state.metrics.rep = Math.max(0, state.metrics.rep - 4 * DC.CFG.repLoss);
    state.metrics.score = Math.max(0, state.metrics.score - 300);
    DC.Events.alarm(state, "crit", "TICKET MISSED: " + req.name + " — customer escalated", req.targetId);
    DC.Events.emit("toast", state, "TICKET MISSED — " + req.name, "bad");
  }

  function complete(state, req, eq) {
    const idx = state.requests.indexOf(req);
    if (idx !== -1) state.requests.splice(idx, 1);
    DC.Events.stat(state, "requestsDone", 1);
    const pts = req.crit ? 200 : 100;
    state.metrics.score += pts;
    state.metrics.rep = Math.min(100, state.metrics.rep + 0.5 * DC.CFG.repGain);
    DC.Events.emit("toast", state, req.name + " DONE +" + pts, "good");
    DC.Audio.good();
  }

  function tenantName(state, eq) {
    if (!eq || !eq.tenant) return eq ? eq.name : "?";
    return eq.tenant.name;
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

  function completeById(state, eq) {
    const req = (state.requests || []).find((r) => r.targetId === eq.id);
    if (req) complete(state, req, eq);
  }

  return { tick, completeById, fail, spawn };
})();
