window.DC = window.DC || {};

DC.Tutorial = (function () {
  let active = false, step = 0, state = null, scriptedServer = null, scriptedStor = null;

  const STEPS = [
    { msg: "Welcome, operator. Drag the mouse (or press A/D) to navigate your datacenter.", check: (s) => s.tutorialMoved },
    { msg: "A drive is about to need attention. Click the ALARM on the bottom-left to jump to it.", inject: "warn-drive", check: (s) => s.tutorialJumped },
    { msg: "Click the YELLOW drive in the storage array, then click REPLACE. Replacing before failure earns PREVENTION.", check: () => scriptedStor && scriptedStor.drives.some((d) => d.state === "rebuilding") },
    { msg: "The drive is rebuilding (blue). RAID will restore redundancy. Notice PREVENTION bonus.", check: () => true, delay: 4000 },
    { msg: "Watch this server — its cooling is failing and it will overheat. Select it and shut it down with PWR before thermal shutdown.", inject: "overheat", check: () => !!scriptedServer && scriptedServer.state !== "online" },
    { msg: "Good. Now power it back on with PWR ON. Controlled shutdown/boot takes a few seconds.", check: () => !!scriptedServer && scriptedServer.state === "online" },
    { msg: "Open the KVM to inspect the console: select the server and click KVM.", check: () => DC.KVM.isOpen() },
    { msg: "Simulated intrusion: a server shows SUSPICIOUS activity. Quarantine or reimage it before it spreads.", inject: "hack", check: (s) => s.alarms.some((a) => a.msg.includes("cleaned") || a.msg.includes("reimaged")) },
    { msg: "The HVAC breaker just tripped. Click the COOLING chip in the top bar and repair the unit.", inject: "crac", check: (s) => s.coolingUnits.every((c) => !c.fault) },
    { msg: "Excellent. Outages generate tickets; restoring services clears them. Your REPUTATION drives DEMAND — demand brings EXPANSIONS. You're on your own now, operator.", final: true, check: () => true, delay: 6000 }
  ];

  function start(st) {
    active = true; step = 0; state = st;
    DC.Events.emit("toast", st, "TUTORIAL — follow the prompts", "info");
    showBanner();
  }

  function showBanner() {
    const b = document.getElementById("tutorial-banner");
    if (!b) return;
    const s = STEPS[step];
    if (!s) { b.style.display = "none"; return; }
    b.style.display = "block";
    b.innerHTML = '<div class="t-step">TUTORIAL ' + (step + 1) + "/" + STEPS.length + '</div><div class="t-msg">' + s.msg + '</div><div style="margin-top:8px"><button id="tut-skip" style="font-size:8px;padding:5px 10px">SKIP TUTORIAL</button></div>';
    const sk = b.querySelector("#tut-skip");
    if (sk) sk.onclick = () => { DC.Audio.click(); stop(); };
  }

  function inject(st, what) {
    const servers = DC.Util.allEq(st, "server").filter((e) => e.state === "online" && e.sec === "clean");
    const stors = DC.Util.allEq(st, "storage").filter((e) => e.drives.some((d) => d.state === "ok"));
    if (what === "warn-drive" && stors.length) {
      scriptedStor = stors[0];
      DC.Storage.warnDrive(st, scriptedStor);
    } else if (what === "overheat") {
      // any server works; if none are clean pick any online one — the lesson must always be armed
      let pick = servers[0];
      if (!pick) pick = DC.Util.allEq(st, "server").find((e) => e.state === "online");
      if (!pick) return; // truly nothing online; tick() re-arms next frame
      scriptedServer = pick;
      scriptedServer.fans = "failed";
      scriptedServer.temp = Math.max(scriptedServer.temp, 60);
      DC.Events.alarm(st, "warn", scriptedServer.name + " FAN FAILURE — temperature rising", scriptedServer.id);
    } else if (what === "hack" && servers.length) {
      const srv = servers.find((s) => s !== scriptedServer) || servers[0];
      srv.sec = "suspect";
      DC.Events.alarm(st, "warn", srv.name + " SUSPICIOUS ACTIVITY — investigate via KVM", srv.id);
    } else if (what === "crac") {
      const cr = st.coolingUnits[0];
      if (cr && !cr.fault) DC.Thermal.failCRAC(st, cr, { key: "breaker", desc: "breaker tripped", repair: 4 });
    }
  }

  function tick(st, dt) {
    if (!active) return;
    const s = STEPS[step];
    if (!s) { stop(); return; }
    if (s.delay) { s.delay -= dt * 1000; if (s.delay > 0) return; delete s.delay; }
    // re-arm: the scripted equipment may have been resolved by outside forces (thermal death,
    // auto-repair, save/load) — re-inject so the lesson is always doable
    if (s.inject && s.injected && !s.ensure(st)) { s.injected = false; }
    let ok = false;
    try { ok = s.check(st); } catch (e) { ok = false; }
    if (ok) {
      // heal the scripted server's fans once the shutdown lesson is done — it stays playable
      if (step === 4 && scriptedServer && scriptedServer.fans !== "ok") { scriptedServer.fans = "ok"; scriptedServer.fanHealth = 1; }
      step++;
      if (step >= STEPS.length) { stop(); return; }
      showBanner();
      const next = STEPS[step];
      if (next && next.inject) { next.injected = true; inject(st, next.inject); }
    } else if (s.inject && !s.injected) {
      s.injected = true;
      inject(st, s.inject);
    }
  }

  // ensure predicates: re-inject when the scripted prop is gone/invalid
  function ensureFor(what) {
    if (what === "overheat") return () => !!scriptedServer && scriptedServer.fans === "failed" && scriptedServer.state === "online";
    if (what === "warn-drive") return () => !!scriptedStor && scriptedStor.drives.some((d) => d.state === "warn");
    if (what === "hack") return () => { try { return DC.Util.allEq(state, "server").some((e) => e.sec === "suspect"); } catch (e) { return true; } };
    if (what === "crac") return () => { try { return state.coolingUnits.some((c) => !!c.fault); } catch (e) { return true; } };
    return () => true;
  }

  function start(st) {
    active = true; step = 0; state = st; scriptedServer = null; scriptedStor = null;
    for (const s of STEPS) { s.injected = false; delete s.delay; }
    // attach ensure predicates
    for (const s of STEPS) if (s.inject) s.ensure = ensureFor(s.inject);
    DC.Events.emit("toast", st, "TUTORIAL — follow the prompts", "info");
    showBanner();
  }

  function stop() {
    active = false;
    const b = document.getElementById("tutorial-banner");
    if (b) b.style.display = "none";
    const s = DC.Save.loadSettings();
    s.tutorialDone = true;
    DC.Save.saveSettings(s);
    if (state) DC.Save.save(state);
    DC.Events.emit("toast", state, "TUTORIAL COMPLETE — good luck", "good");
  }

  return { start, tick, isActive: () => active };
})();
