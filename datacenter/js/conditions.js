window.DC = window.DC || {};

// Common day-2 datacenter conditions: memory leaks, expiring certs, clock skew,
// flapping links, disk pressure. Each has a hands-on fix action so Dave (or you)
// can always resolve it.
DC.Conditions = (function () {

  function servers(state) {
    return DC.Util.allEq(state).filter((e) => e.type === "server" || e.type === "blade");
  }

  function tick(state, dt) {
    for (const eq of servers(state)) {
      // init for old saves
      if (eq.certDays === undefined) eq.certDays = Math.floor(30 + Math.random() * 210);
      if (eq.clockSkew === undefined) eq.clockSkew = 0;
      if (eq.memLeak === undefined) eq.memLeak = null;

      // certificate clock: warn at 14 days, expire at 0 -> degraded service
      if (eq.state === "online") {
        eq.certDays -= dt * (60 / 60); // 1 "day" per real minute — readable pacing
        if (eq.certDays <= 0) {
          eq.certDays = 0;
          if (!eq.certExpired) {
            eq.certExpired = true;
            DC.Events.alarm(state, "crit", eq.name + " TLS CERTIFICATE EXPIRED — clients failing", eq.id);
            DC.Audio.alarm("warn");
          }
        } else if (eq.certDays < 14 && !eq.certWarned) {
          eq.certWarned = true;
          DC.Events.alarm(state, "warn", eq.name + " TLS certificate expires in " + Math.ceil(eq.certDays) + "d — renew soon", eq.id);
        }
        // memory leak: slow load creep until restarted
        if (eq.memLeak) {
          eq.load = Math.min(140, eq.load + eq.memLeak * dt);
          if (eq.load > 95 && !eq.leakWarned) {
            eq.leakWarned = true;
            DC.Events.alarm(state, "warn", eq.name + " MEMORY LEAK — " + eq.memLeak.name + " RSS climbing, restart the service", eq.id);
          }
          if (eq.load >= 140) { // OOM territory: process crashes, load resets, service blips
            eq.memLeak = null;
            eq.leakWarned = false;
            eq.load = 55;
            DC.Events.alarm(state, "crit", eq.name + " OOM KILL — " + "service restarted itself under memory pressure", eq.id);
          }
        }
        // clock skew drifts when NTP is unhappy
        if (eq.clockSkew > 0) {
          eq.clockSkew = Math.min(9.9, eq.clockSkew + dt * 0.05);
        }
      }
    }
  }

  function startLeak(state, eq, procName) {
    if (eq.memLeak) return false;
    eq.memLeak = { name: procName || "worker-svc" };
    eq.leakWarned = false;
    DC.Events.alarm(state, "warn", eq.name + " memory leak detected in " + eq.memLeak.name, eq.id);
    return true;
  }

  function startSkew(state, eq) {
    if (eq.clockSkew > 0) return false;
    eq.clockSkew = 1.2;
    DC.Events.alarm(state, "warn", eq.name + " NTP drift — clock skew " + eq.clockSkew.toFixed(1) + "s and climbing", eq.id);
    return true;
  }

  function flapLink(state, eq) {
    if (eq.netState !== "ok") return false;
    eq.netState = "flapping";
    DC.Events.alarm(state, "warn", eq.name + " LINK FLAPPING — reseat the cables", eq.id);
    return true;
  }

  function expireCert(state, eq) {
    if (eq.certDays <= 0 && eq.certExpired) return false;
    eq.certDays = 0;
    return true;
  }

  function finish(state, eq, kind) {
    if (kind === "svc-restart") {
      eq.memLeak = null;
      eq.leakWarned = false;
      eq.load = Math.max(20, eq.load * 0.5);
      DC.Events.resolve(state, eq.id, "Service restarted");
      DC.Events.alarm(state, "info", eq.name + " service restarted — memory reclaimed", eq.id);
    } else if (kind === "cert-renew") {
      eq.certDays = Math.floor(180 + Math.random() * 120);
      eq.certExpired = false;
      eq.certWarned = false;
      DC.Events.resolve(state, eq.id, "Certificate renewed");
      DC.Events.alarm(state, "info", eq.name + " certificate renewed — valid ~" + eq.certDays + "d", eq.id);
    } else if (kind === "clock-sync") {
      eq.clockSkew = 0;
      DC.Events.resolve(state, eq.id, "Clock resynced");
      DC.Events.alarm(state, "info", eq.name + " clock resynced to NTP", eq.id);
    } else if (kind === "dns-flush") {
      DC.Events.resolve(state, eq.id, "DNS cache flushed");
      DC.Events.alarm(state, "info", eq.name + " DNS cache flushed", eq.id);
    } else if (kind === "run-backup") {
      eq.backupFailed = false;
      DC.Events.resolve(state, eq.id, "Backup completed");
      DC.Events.alarm(state, "info", eq.name + " backup completed successfully", eq.id);
    }
  }

  return { tick, startLeak, startSkew, flapLink, expireCert, finish };
})();
