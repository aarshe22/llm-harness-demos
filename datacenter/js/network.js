window.DC = window.DC || {};

DC.Network = (function () {
  const cfg = () => DC.CFG;

  function serverConnected(state, srv) {
    if (srv.netState === "disconnected") return false;
    if (srv.state !== "online") return false;
    return true;
  }

  function rackSwitchDown(state, rack) {
    const sw = rack.equipment.find((e) => e.type === "switch");
    return sw ? sw.state !== "online" : false;
  }

  function netHealth(state, eq) {
    if (eq.type === "server") {
      if (!serverConnected(state, eq)) return "down";
      const rack = DC.Util.rackOf(state, eq);
      if (rack && rackSwitchDown(state, rack) && !state.upgrades.includes("NET_FABRIC")) return "down";
      if (rack && rackSwitchDown(state, rack) && state.upgrades.includes("NET_FABRIC")) return "degraded";
      if (eq.sec === "compromised" || eq.sec === "spreading") return "degraded";
      return "ok";
    }
    if (eq.type === "switch") return eq.state === "online" ? "ok" : "down";
    return "ok";
  }

  function tick(state, dt) {
    let online = 0, total = 0;
    for (const sw of DC.Util.allEq(state, "switch")) {
      if (sw.busy) {
        sw.busy.t -= dt;
        if (sw.busy.t <= 0) {
          sw.busy = null;
          sw.state = "online";
          sw.fault = null;
          DC.Events.resolve(state, sw.id, "Switch restarted");
          DC.Events.alarm(state, "info", sw.name + " back online", sw.id);
        }
      }
    }
    for (const srv of DC.Util.allEq(state, "server")) {
      if (srv.sec === "spreading") {
        srv.secTimer = (srv.secTimer || 0) - dt;
        if (srv.secTimer <= 0) spread(state, srv);
      }
      if (srv.state === "online" && srv.busy) {
        srv.busy.t -= dt;
        if (srv.busy.t <= 0) finishServerBusy(state, srv);
      }
      if (srv.state === "booting" || srv.state === "shutdown") {
        srv.busy.t -= dt;
        if (srv.busy.t <= 0) {
          if (srv.state === "booting") { srv.state = "online"; srv.temp = 25; DC.Events.resolve(state, srv.id, "Back online"); DC.Events.alarm(state, "info", srv.name + " boot complete", srv.id); }
          else { srv.state = "offline"; DC.Events.alarm(state, "info", srv.name + " powered off", srv.id); }
          srv.busy = null;
        }
      }
      if (srv.state === "online" && netHealth(state, srv) === "ok") online++;
      total++;
    }
    state.metrics.netPct = total ? Math.round((online / total) * 100) : 100;
  }

  function finishServerBusy(state, srv) {
    const kind = srv.busy.kind;
    srv.busy = null;
    if (kind === "repair") {
      srv.fans = "ok";
      srv.fanHealth = 1;
      if (srv.psuA === "failed") srv.psuA = "ok";
      if (srv.psuB === "failed") srv.psuB = "ok";
      DC.Events.resolve(state, srv.id, "Hardware repaired");
      DC.Events.alarm(state, "info", srv.name + " hardware repaired", srv.id);
      DC.Events.stat(state, "serversRepaired", 1);
    } else if (kind === "clean") {
      srv.sec = "clean";
      srv.secTimer = 0;
      DC.Events.resolve(state, srv.id, "Malware cleaned");
      DC.Events.alarm(state, "info", srv.name + " cleaned", srv.id);
    } else if (kind === "scan") {
      srv.sec = srv.sec === "suspect" ? "infected" : srv.sec;
      DC.Events.alarm(state, "info", srv.name + " scan complete" + (srv.sec === "infected" ? " — infection confirmed" : " — clean"), srv.id);
    } else if (kind === "reimage") {
      srv.sec = "clean";
      srv.secTimer = 0;
      srv.state = "booting";
      srv.busy = { kind: "boot", t: 10 };
      DC.Events.resolve(state, srv.id, "Reimaged");
      DC.Events.alarm(state, "info", srv.name + " reimaged, booting", srv.id);
    } else if (kind === "recover") {
      eq.badPatch = false;
      DC.Events.resolve(state, eq.id, "Patch recovered");
      DC.Events.alarm(state, "info", eq.name + " recovered to last-known-good state", eq.id);
    } else if (kind === "stop-proc") {
      srv.runaway = null;
      srv.load = Math.max(10, srv.load - 30);
      DC.Events.resolve(state, srv.id, "Runaway process stopped");
      DC.Events.alarm(state, "info", srv.name + " runaway process stopped", srv.id);
    } else if (kind === "clear-logs") {
      srv.diskFull = false;
      DC.Events.resolve(state, srv.id, "Logs cleared");
      DC.Events.alarm(state, "info", srv.name + " disk space recovered", srv.id);
    } else if (kind === "backup-retry") {
      DC.Events.resolve(state, srv.id, "Backup retried");
    }
  }

  function spread(state, srv) {
    srv.sec = "compromised";
    srv.secTimer = 0;
    const rack = DC.Util.rackOf(state, srv);
    if (!rack) return;
    let speed = 0.02 * cfg().propSpeed;
    if (state.upgrades.includes("FIREWALL")) speed *= 0.5;
    for (const other of rack.equipment) {
      if (other.type === "server" && other !== srv && other.sec === "clean" && other.state === "online") {
        if (Math.random() < speed) {
          other.sec = "spreading";
          other.secTimer = 8 + Math.random() * 10;
          DC.Events.alarm(state, "crit", other.name + " security compromise detected", other.id);
          DC.Events.stat(state, "secIncidents", 1);
        }
      }
    }
  }

  function startSecurity(state, srv) {
    if (srv.sec !== "clean" || srv.state !== "online") return false;
    srv.sec = "spreading";
    srv.secTimer = 10 + Math.random() * 8;
    DC.Events.alarm(state, "crit", srv.name + " SUSPICIOUS NETWORK ACTIVITY — possible intrusion", srv.id);
    DC.Events.stat(state, "secIncidents", 1);
    return true;
  }

  function failSwitch(state, sw) {
    if (sw.state !== "online") return false;
    sw.state = "failed";
    const rack = DC.Util.rackOf(state, sw);
    DC.Events.alarm(state, "crit", (rack ? rack.name + " " : "") + sw.name + " FAILED — segment unreachable", sw.id);
    return true;
  }

  function pwr(state, srv, on) {
    if (on) {
      if (srv.state === "offline" || srv.state === "thermal-shutdown") {
        srv.state = "booting";
        srv.busy = { kind: "boot", t: 12 };
        return true;
      }
    } else if (srv.state === "online") {
      srv.state = "shutdown";
      srv.busy = { kind: "shutdown", t: 8 };
      return true;
    }
    return false;
  }

  function toggleNet(state, srv) {
    if (srv.netState === "ok") {
      srv.netState = "disconnected";
      DC.Events.alarm(state, "info", srv.name + " disconnected from network", srv.id);
    } else {
      srv.netState = "ok";
      DC.Events.alarm(state, "info", srv.name + " reconnected to network", srv.id);
    }
    return true;
  }

  return { tick, netHealth, failSwitch, startSecurity, spread, pwr, toggleNet, serverConnected, rackSwitchDown };
})();
