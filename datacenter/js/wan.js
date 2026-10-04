window.DC = window.DC || {};

// Two redundant WAN backbone uplinks, each terminating in a firewall.
// Links: ok -> degraded (yellow) -> failed (red). Planned carrier maint
// windows warn ahead of time. Firewalls take attack load and need
// reboots / firmware / policy work from the operator.
DC.Wan = (function () {
  const cfg = () => DC.CFG;
  const CARRIERS = ["LEVELPATH TELECOM", "GRAYLINE FIBER", "NORTHWIRE", "APEX BACKBONE"];

  function ensure(state) {
    if (state.wans && state.wans.length) return state.wans;
    const carriers = CARRIERS.slice();
    const mk = (i) => {
      const fw = {
        id: "FW-" + (i + 1), type: "fw", name: "FW " + (i + 1), wanId: "WAN-" + (i + 1),
        cpu: 12, fwDays: Math.floor(30 + Math.random() * 200), policyDays: Math.floor(5 + Math.random() * 40),
        busy: null, overloaded: false
      };
      return {
        id: "WAN-" + (i + 1), type: "wan", name: i === 0 ? "WAN ALPHA" : "WAN BETA",
        carrier: carriers.splice(Math.floor(Math.random() * carriers.length), 1)[0],
        state: "ok", eta: 0, load: 30 + Math.random() * 35,
        maintWarn: 0, maintT: 0, maintDur: 0, asked: false,
        fw: fw
      };
    };
    state.wans = [mk(0), mk(1)];
    for (const w of state.wans) { state.eqById[w.id] = w; state.eqById[w.fw.id] = w.fw; }
    return state.wans;
  }

  function alive(state) { return state.wans && state.wans.length; }

  // 0..1 — how badly WAN trouble should hurt the business
  function impact(state) {
    if (!alive(state)) return 0;
    let down = 0, deg = 0;
    for (const w of state.wans) {
      if (w.state === "failed") down++;
      else if (w.state === "degraded") deg++;
      else if (w.fw.overloaded) deg += 0.5;
    }
    return state.wans.length ? Math.min(1, (down * 0.45 + deg * 0.18) / state.wans.length * 2) : 0;
  }

  // true when the facility has no working external path
  function dark(state) {
    return alive(state) && state.wans.every((w) => w.state === "failed");
  }

  function alarmKind(sev, msg, id) { return (state) => DC.Events.alarm(state, sev, msg, id); }

  function degrade(state, w, dur, planned) {
    if (w.state !== "ok") return false;
    w.state = "degraded";
    w.eta = dur;
    w.asked = false;
    w.planned = !!planned;
    DC.Events.alarm(state, planned ? "warn" : "warn", w.name + " DEGRADED — " + (planned ? "carrier maintenance in progress" : "carrier path congestion, packet loss rising"), w.id);
    return true;
  }

  function fail(state, w, dur) {
    if (w.state === "failed") return false;
    w.state = "failed";
    w.eta = dur;
    w.asked = false;
    w.planned = false;
    DC.Events.alarm(state, "crit", w.name + " DOWN — " + w.carrier + " reports an outage (ETA " + Math.round(dur) + "s)", w.id);
    DC.Audio && DC.Audio.powerCrit && DC.Audio.powerCrit();
    return true;
  }

  function restore(state, w) {
    w.state = "ok";
    w.eta = 0;
    DC.Events.resolve(state, w.id, "Link restored");
    DC.Events.alarm(state, "info", w.name + " link restored — " + w.carrier, w.id);
  }

  function startAttack(state, w) {
    if (!w.fw || w.fw.overloaded || w.fw.busy) return false;
    w.fw.attackT = 30 + Math.random() * 60;
    w.fw.attackRate = 6 + Math.random() * 7;
    DC.Events.alarm(state, "warn", "INBOUND ATTACK on " + w.name + " — " + w.fw.name + " CPU climbing", w.fw.id);
    return true;
  }

  function startJob(state, fw, kind, t) {
    if (fw.busy) return false;
    fw.busy = { kind, t, t0: t };
    DC.Events.alarm(state, "info", fw.name + " " + kind.replace("fw-", "") + " started", fw.id);
    return true;
  }

  function finishJob(state, fw) {
    const kind = fw.busy.kind;
    fw.busy = null;
    if (kind === "fw-reboot") {
      fw.cpu = 15;
      if (fw.overloaded) { fw.overloaded = false; DC.Events.resolve(state, fw.id, "recovered"); }
      DC.Events.alarm(state, "info", fw.name + " rebooted — CPU normalized", fw.id);
    } else if (kind === "fw-update") {
      fw.fwDays = 0;
      fw.cpu = Math.max(10, fw.cpu - 25);
      DC.Events.stat(state, "fwUpdates", 1);
      DC.Events.alarm(state, "info", fw.name + " firmware updated", fw.id);
    } else if (kind === "fw-policy") {
      fw.policyDays = 0;
      fw.shieldT = 240; // hardened rules blunt attacks for a while
      DC.Events.alarm(state, "info", fw.name + " policy pushed — attack surface reduced", fw.id);
    }
    DC.Audio && DC.Audio.good && DC.Audio.good();
  }

  function tick(state, dt) {
    if (!alive(state)) return;
    let anyDark = true;
    for (const w of state.wans) {
      const fw = w.fw;
      // carrier repair clocks
      if (w.state === "degraded" || w.state === "failed") {
        w.eta -= dt;
        if (w.eta <= 0) restore(state, w);
        else if (!w.asked && w.eta < 20) w.asked = false; // noop, keep clock honest
      }
      // planned maintenance windows
      if (w.maintT > 0) {
        w.maintT -= dt;
        if (w.maintT <= 0) {
          w.maintWarn = 0;
          degrade(state, w, w.maintDur, true);
          w.maintDur = 0;
        } else if (w.maintT < 90 && !w.maintWarn) {
          w.maintWarn = 1;
          DC.Events.alarm(state, "warn", w.carrier + " PLANNED MAINTENANCE on " + w.name + " in " + Math.round(w.maintT) + "s — expect degradation", w.id);
        }
      } else if (w.state === "ok" && Math.random() < dt * 0.00018 * cfg().wanMaint) {
        w.maintDur = 70 + Math.random() * 110;
        w.maintT = 130 + Math.random() * 90; // warn ~90s ahead
      }
      // firewall aging + attack load
      fw.fwDays += dt / 60;
      fw.policyDays += dt / 60;
      if (fw.shieldT > 0) fw.shieldT -= dt;
      if (fw.attackT > 0) {
        fw.attackT -= dt;
        fw.cpu += fw.attackRate * (fw.shieldT > 0 ? 0.45 : 1) * dt;
      } else {
        fw.cpu = Math.max(8, fw.cpu - 2.2 * dt);
        if (fw.overloaded && fw.cpu < 55) { fw.overloaded = false; DC.Events.resolve(state, fw.id, "cooled"); }
      }
      if (fw.cpu >= 100 && !fw.overloaded) {
        fw.overloaded = true;
        DC.Events.alarm(state, "crit", fw.name + " OVERLOADED — traffic through " + w.name + " unreliable", fw.id);
        DC.Audio && DC.Audio.alarm && DC.Audio.alarm("crit");
      }
      // attack scheduler
      if (fw.attackT <= 0 && !fw.overloaded && !fw.busy && Math.random() < dt * 0.00022 * cfg().fwAttack * (1 + fw.policyDays / 90)) {
        startAttack(state, w);
      }
      // busy jobs
      if (fw.busy) {
        fw.busy.t -= dt;
        if (fw.busy.t <= 0) finishJob(state, fw);
      }
      // a path is only fully usable when the link is up and fw is healthy
      if (w.state === "ok" && !fw.overloaded) anyDark = false;
      else if (w.state === "degraded" && !fw.overloaded) anyDark = false;
    }
    state.wanHealth = anyDark ? "down" : (state.wans.some((w) => w.state !== "ok" || w.fw.overloaded) ? "degraded" : "ok");
  }

  // operator actions ------------------------------------------------------
  function contactCarrier(state, w) {
    if (!w.eta) return false;
    if (w.asked) return false;
    w.asked = true;
    w.eta = Math.max(8, w.eta * 0.55);
    DC.Events.alarm(state, "info", "Ticket opened with " + w.carrier + " — ETA improved", w.id);
    return true;
  }

  return { ensure, tick, impact, dark, degrade, fail, startAttack, startJob, contactCarrier, alive };
})();
