window.DC = window.DC || {};

DC.Tutorial = (function () {
  let active = false, step = 0, state = null, scriptedServer = null, scriptedStor = null;

  const STEPS = [
    { msg: "Welcome, operator. Drag the mouse (or press A/D) to navigate your datacenter.", check: (s) => s.tutorialMoved },
    { msg: "A drive is about to need attention. Click the ALARM on the bottom-left to jump to it.", inject: "warn-drive", check: (s) => s.tutorialJumped },
    { msg: "Click the YELLOW drive in the storage array, then click REPLACE. Replacing before failure earns PREVENTION.", check: () => scriptedStor && scriptedStor.drives.some((d) => d.state === "rebuilding") },
    { msg: "The drive is rebuilding (blue). RAID will restore redundancy. Notice PREVENTION bonus.", check: () => true, delay: 4000 },
    { msg: "Watch this server — its cooling is failing and it will overheat. Select it and shut it down with PWR before thermal shutdown.", inject: "overheat", check: (s) => scriptedServer.state === "shutdown" || scriptedServer.state === "offline" || scriptedServer.state === "booting" },
    { msg: "Good. Now power it back on with PWR ON. Controlled shutdown/boot takes a few seconds.", check: (s) => scriptedServer.state === "online" },
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
    b.innerHTML = '<div class="t-step">TUTORIAL ' + (step + 1) + "/" + STEPS.length + '</div><div class="t-msg">' + s.msg + "</div>";
  }

  function inject(st, what) {
    const servers = DC.Util.allEq(st, "server").filter((e) => e.state === "online" && e.sec === "clean");
    const stors = DC.Util.allEq(st, "storage").filter((e) => e.drives.some((d) => d.state === "ok"));
    if (what === "warn-drive" && stors.length) {
      scriptedStor = stors[0];
      DC.Storage.warnDrive(st, scriptedStor);
    } else if (what === "overheat" && servers.length) {
      scriptedServer = servers[0];
      scriptedServer.fans = "failed";
      scriptedServer.temp = 60;
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
    if (s.check(st)) {
      step++;
      if (step >= STEPS.length) { stop(); return; }
      showBanner();
      const next = STEPS[step];
      if (next && next.inject) inject(st, next.inject);
      if (next && next.check && next.check(st)) { /* immediate pass */ }
    } else if (s.inject && !s.injected) {
      s.injected = true;
      inject(st, s.inject);
    }
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
