window.DC = window.DC || {};

// The big tractor-feed dot matrix printer on metal legs, right of the firewalls.
// Customer tickets ask for reports; it jams and runs out of paper on its own.
DC.Printer = (function () {
  const cfg = () => DC.CFG;
  const REPORTS = ["WEEKLY UPTIME", "CUSTOMER INVOICE", "UTILIZATION REPORT", "TENANT BILLING", "SLA SUMMARY", "CAPACITY PLAN"];

  function get(state) { return state.eqById["PRN-1"]; }

  function ensure(state) {
    const p = get(state);
    if (p) return p;
    const mk = { id: "PRN-1", type: "printer", name: "PRN-1", paper: 75, jam: null, printing: null, state: "idle", busy: null };
    state.eqById["PRN-1"] = mk;
    return mk;
  }

  function jam(state, p) {
    if (p.jam) return false;
    p.jam = { severity: Math.random() < 0.3 ? 2 : 1, since: state.time };
    DC.Events.alarm(state, "warn", "PRN-1 PAPER JAM — open the cover and clear the platen", "PRN-1");
    DC.Audio.alarm && DC.Audio.alarm("warn");
    if (DC.FieldRequests) DC.FieldRequests.spawnFault(state, "clear-jam", "PRN-1");
    return true;
  }

  function clearJam(state, p) {
    if (!p.jam) return false;
    p.jam = null;
    DC.Events.resolve(state, "PRN-1", "Jam cleared");
    DC.Events.alarm(state, "info", "PRN-1 jam cleared — feed resumes", "PRN-1");
    if (DC.FieldRequests) {
      const req = (state.requests || []).find((r) => r.targetId === "PRN-1" && r.kind === "clear-jam");
      if (req) DC.FieldRequests.complete(state, req, p);
    }
    return true;
  }

  function loadPaper(state, p) {
    p.paper = 100;
    DC.Events.alarm(state, "info", "PRN-1 paper tray refilled", "PRN-1");
    DC.Audio.click && DC.Audio.click();
    if (DC.FieldRequests) {
      const req = (state.requests || []).find((r) => r.targetId === "PRN-1" && r.kind === "refill-paper");
      if (req) DC.FieldRequests.complete(state, req, p);
    }
    return true;
  }

  // customer ticket: fetch a report (handled through FieldRequests with targetId PRN-1)
  function startPrint(state, p, report) {
    if (p.printing || (p.busy && p.busy.kind === "print")) return false;
    if (p.jam) return false;
    if (p.paper <= 2) { jam(state, p); return false; }
    p.printing = { report: report || "REPORT", t: 6, t0: 6 };
    DC.Events.alarm(state, "info", "PRN-1 printing " + p.printing.report + "...", "PRN-1");
    return true;
  }

  function tick(state, dt) {
    const p = get(state);
    if (!p) return;
    // paper drains slowly, faster while printing
    const drain = (p.printing ? 1.6 : 0.35) * dt * cfg().printerRate;
    p.paper = Math.max(0, p.paper - drain);
    if (p.paper <= 0 && !p.jam) {
      DC.Events.alarm(state, "warn", "PRN-1 OUT OF PAPER — refill the tractor feed", "PRN-1");
      p.paper = 0.01; // keep it just above 0 so refill registers
      if (DC.FieldRequests) DC.FieldRequests.spawnFault(state, "refill-paper", "PRN-1");
    }
    // jam chance rises when low on paper or when printing hard
    const jamP = dt * 0.00012 * cfg().printerFail * (p.printing ? 2.2 : 1) * (p.paper < 15 ? 2 : 1);
    if (!p.jam && Math.random() < jamP) jam(state, p);
    // printing progress (pauses while jammed)
    if (p.printing) {
      if (!p.jam) {
        p.printing.t -= dt;
        if (p.printing.t <= 0) {
          const rep = p.printing.report;
          p.printing = null;
          DC.Events.alarm(state, "info", "PRN-1 finished " + rep + " — report in the tray", "PRN-1");
          if (DC.FieldRequests) {
            const req = (state.requests || []).find((r) => r.targetId === "PRN-1" && r.started);
            if (req) DC.FieldRequests.complete(state, req, p);
          }
        }
      }
    }
    // jam escalates if ignored: 1 -> 2 after 90s
    if (p.jam && p.jam.severity === 1 && state.time - p.jam.since > 90) {
      p.jam.severity = 2;
      DC.Events.alarm(state, "crit", "PRN-1 jam WORSENED — feed motors stalled, clear it now", "PRN-1");
    }
    // printer down while badly jammed hurts SLA slightly
    if (p.jam && p.jam.severity === 2) state.printerDown = (state.printerDown || 0) + dt;
    else state.printerDown = 0;
  }

  return { get, ensure, tick, jam, clearJam, loadPaper, startPrint, REPORTS };
})();
