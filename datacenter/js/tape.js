window.DC = window.DC || {};

// TAPE-1 — dual-LTO-drive tape library with 100 slots, robot arm, jams and exports.
DC.Tape = (function () {
  const cfg = () => DC.CFG;
  const JOB_T = { mount: 8, unjam: 12, export: 5 };

  function get(state) { return state.eqById["TAPE-1"]; }

  function ensure(state) {
    const t = get(state);
    if (t) return t;
    const slots = [];
    for (let i = 0; i < 100; i++) slots.push({ label: "L" + String(i + 1).padStart(3, "0"), state: "full", barcoded: true });
    const mk = { id: "TAPE-1", type: "tape", name: "TAPE LIBRARY", drives: [{ id: "LTO-A", state: "ok", tape: null, progress: 0 }, { id: "LTO-B", state: "ok", tape: null, progress: 0 }], slots, robot: null, jam: null, exportsPending: 0, state: "idle", busy: null };
    state.eqById["TAPE-1"] = mk;
    return mk;
  }

  function freeSlots(t) { return t.slots.filter((s) => s.state === "empty").length; }
  function fullSlots(t) { return t.slots.filter((s) => s.state === "full").length; }

  function jam(t) {
    if (t.jam) return false;
    t.jam = { since: 0, severity: 1 };
    return true;
  }

  // a drive finishes its job — or jams trying
  function driveDone(state, t, di) {
    const d = t.drives[di];
    const slot = t.slots.find((s) => s.label === d.tape);
    if (slot && slot.state === "full") slot.state = "empty"; // tape written, now exportable
    d.tape = null;
    d.progress = 0;
    DC.Events.alarm(state, "info", "TAPE-1 " + d.id + " job complete — tape ready for export", "TAPE-1");
    t.exportsPending++;
  }

  function tick(state, dt) {
    const t = get(state);
    if (!t) return;
    // exports piling up too long: the arm auto-runs one (prevents starvation)
    if (t.exportsPending > 5 && !t.robot) t.robot = { kind: "export", t: JOB_T.export, t0: JOB_T.export };
    // queued export from a ticket: grab the arm as soon as it's free
    if (t.exportQueued && !t.robot && t.exportsPending > 0) {
      t.exportQueued = false;
      t.robot = { kind: "export", t: JOB_T.export, t0: JOB_T.export };
    }
    // aging: random tapes get pulled for export (helpdesk demand driver)
    if (Math.random() < dt * 0.004 * cfg().printerFail) {
      t.exportsPending++;
      if (t.exportsPending % 3 === 1) DC.Events.alarm(state, "warn", "TAPE-1 " + t.exportsPending + " tapes ready for offsite export", "TAPE-1");
    }
    // drives run write jobs when idle and tapes available
    t.drives.forEach((d, di) => {
      if (t.jam && t.jam.drive === di) return;
      if (d.state !== "ok") return;
      if (d.tape) {
        d.progress += dt;
        if (d.progress > 45 + (di * 7)) {
          if (Math.random() < 0.02 * cfg().printerFail) {
            t.jam = { since: state.time, severity: 1, drive: di };
            DC.Events.alarm(state, "warn", "TAPE-1 TAPE JAM in " + d.id + " — clear the mechanism", "TAPE-1");
            if (DC.FieldRequests) DC.FieldRequests.spawnFault(state, "tape-unjam", "TAPE-1");
          } else driveDone(state, t, di);
        }
      } else if ((t.jam === null || t.jam.drive !== di) && t.exportsPending <= 3) {
        // robot mounts a fresh tape (exports take priority on the arm)
        const full = fullSlots(t);
        if (full > 0 && !t.robot) {
          const slot = t.slots.find((s) => s.state === "full");
          t.robot = { kind: "mount", t: JOB_T.mount, t0: JOB_T.mount, slot: slot.label, driveIdx: di };
        }
      }
    });
    // robot arm progress
    if (t.robot) {
      t.robot.t -= dt;
      if (t.robot.t <= 0) {        const r = t.robot;
        t.robot = null;
        if (r.kind === "mount") {
          const d = t.drives[r.driveIdx];
          d.tape = r.slot;
          d.progress = 0;
          DC.Events.alarm(state, "info", "TAPE-1 mounted " + r.slot + " into " + d.id, "TAPE-1");
        } else if (r.kind === "export") {
          t.exportsPending = Math.max(0, t.exportsPending - 1);
          const slot = t.slots.find((s) => s.state === "empty" && !t.drives.some((d) => d.tape === s.label));
          if (slot) slot.state = "full"; // re-shelved after offsite pull
          DC.Events.alarm(state, "info", "TAPE-1 export complete — offsite courier log updated", "TAPE-1");
          if (DC.FieldRequests) {
            const req = (state.requests || []).find((rq) => rq.targetId === "TAPE-1" && rq.kind === "tape-export" && rq.started);
            if (req) DC.FieldRequests.complete(state, req, t);
          }
        }
      }
    }
    // unjam robot work
    if (t.jam && t.robot && t.robot.kind === "unjam") {
      t.robot.t -= dt;
      if (t.robot.t <= 0) {
        t.robot = null;
        t.jam = null;
        DC.Events.resolve(state, "TAPE-1", "Jam cleared");
        DC.Events.alarm(state, "info", "TAPE-1 jam cleared — drive back in service", "TAPE-1");
        if (DC.FieldRequests) {
          const req = (state.requests || []).find((rq) => rq.targetId === "TAPE-1" && rq.kind === "tape-unjam");
          if (req) DC.FieldRequests.complete(state, req, t);
        }
      }
    }
  }

  // manual ops (panel buttons)
  function startExport(state, t) {
    if (t.exportsPending <= 0) return false;
    if (t.robot) { t.exportQueued = true; return true; } // arm busy: runs as soon as it frees
    t.robot = { kind: "export", t: JOB_T.export, t0: JOB_T.export };
    return true;
  }
  function startUnjam(state, t) {
    if (!t.jam) return false;
    t.robot = { kind: "unjam", t: JOB_T.unjam, t0: JOB_T.unjam };
    return true;
  }

  return { get, ensure, tick, startExport, startUnjam, freeSlots, fullSlots, JOB_T };
})();
