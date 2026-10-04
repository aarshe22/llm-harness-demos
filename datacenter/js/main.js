  window.DC = window.DC || {};

DC.Game = (function () {
  let state = null, canvas = null, ctx = null;
  let cam = { x: 0, y: 0, zoom: 0.73 };
  let ptr = { id: null, down: false, dist: 0, x: 0, y: 0 };
  let dragMoved = false;
  let keys = {};
  let raf = null, lastT = 0, simAcc = 0, uiAcc = 0, saveAcc = 0;
  let inMenu = true;
  let selectedId = null;

  const SIM_DT = 0.1;

  function running() { return !inMenu && state && !state.gameOver; }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!inMenu && state) {
      cam.y = DC.Render.CAM_Y;
      cam.zoom = DC.Util.clamp(cam.zoom, 0.26, 1.6);
    }
  }

  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    bindInput();
    showMenu();
    raf = requestAnimationFrame(loop);
  }

  function applyLoadedSettings() {
    const s = DC.Save.loadSettings();
    DC.applySettings(s);
    DC.Audio.setEnabled(!!s.audio);
    DC.Audio.setVolume(s.volume);
    document.body.classList.toggle("light", !!s.light);
    return s;
  }

  // equal-opportunity operator pick: Dave or Diane, same job, same pay
  function showOperatorPick(onPick, onBack) {
    const root = document.getElementById("ui-root");
    root.innerHTML = "";
    const menu = document.createElement("div");
    menu.className = "menu-screen";
    menu.innerHTML = `
      <div class="menu-title" style="font-size:26px">CHOOSE YOUR OPERATOR</div>
      <div class="menu-sub">EQUAL OPPORTUNITY EMPLOYER · SAME DESK · SAME PAY</div>
      <div class="menu-btns">
        <button id="op-dave">DAVE</button>
        <button id="op-diane">DIANE</button>
        <button id="op-back">BACK</button>
      </div>
      <div class="menu-note">DAVE: TIES + TOOLBELT · DIANE: POWER SUIT + TOOLBELT</div>
      <canvas id="op-dave-cam" width="120" height="120" class="op-cam"></canvas>
      <canvas id="op-diane-cam" width="120" height="120" class="op-cam"></canvas>
    `;
    root.appendChild(menu);
    const dave = menu.querySelector("#op-dave-cam").getContext("2d");
    const diane = menu.querySelector("#op-diane-cam").getContext("2d");
    let raf = 0;
    const frame = (tms) => {
      const t = tms / 1000;
      drawAvatarPortrait(dave, "dave", t);
      drawAvatarPortrait(diane, "diane", t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const stop = () => cancelAnimationFrame(raf);
    menu.querySelector("#op-dave").onclick = () => { stop(); menu.remove(); onPick("dave"); };
    menu.querySelector("#op-diane").onclick = () => { stop(); menu.remove(); onPick("diane"); };
    menu.querySelector("#op-back").onclick = () => { stop(); menu.remove(); onBack && onBack(); };
  }

  // big idle-animated head portrait for the operator select screen
  function drawAvatarPortrait(c, op, t) {
    const female = op === "diane";
    const skin = female ? "#f0c4a0" : "#f2c79a";
    const hair = female ? "#6e3a20" : "#33254a";
    const shirt = female ? "#3a7a5c" : "#e8e8f4";
    const tie = female ? null : "#e0485a";
    // blink cycle: closed for ~0.12s every ~3.2s
    const blink = (t % 3.2) > 3.05;
    // brow micro-movement
    const browLift = Math.sin(t * 0.7) > 0.85 ? 1 : 0;
    // wry smile: corner rises on a slow cycle
    const wry = Math.sin(t * 0.35) > 0.2;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#120d26";
    c.fillRect(0, 0, 120, 120);
    c.save();
    c.translate(60, 64);
    c.scale(5, 5);
    const r2 = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    // shoulders / power suit
    r2(-11, 8, 22, 6, shirt);
    r2(-11, 8, 4, 6, female ? "#2c5f48" : "#c8c8e0");
    r2(7, 8, 4, 6, female ? "#2c5f48" : "#c8c8e0");
    if (tie) { r2(-1, 8, 2, 5, tie); }
    else { r2(-3, 8, 6, 1, "#f0f0ff"); r2(-2, 9, 4, 2, "#e8f4ff"); }
    // toolbelt peeking at collar
    r2(-6, 7, 2, 2, "#5a4028"); r2(4, 7, 2, 2, "#5a4028");
    // neck
    r2(-2, 5, 4, 3, skin);
    // head: 16x14
    r2(-8, -9, 16, 14, skin);
    // ears
    r2(-9, -2, 1, 4, skin); r2(8, -2, 1, 4, skin);
    // hair
    r2(-9, -11, 18, 4, hair);
    r2(-9, -8, 2, 8, hair); // side hair
    r2(7, -8, 2, 8, hair);
    if (female) { r2(-11, -6, 2, 10, hair); r2(9, -6, 2, 10, hair); } // long locks
    // brows (lift on the micro-movement)
    r2(-6, -5 - browLift, 4, 1, hair);
    r2(2, -5 - browLift, 4, 1, hair);
    // eyes: open or blink
    if (blink) { r2(-5, -2, 3, 1, "#1d1d3a"); r2(2, -2, 3, 1, "#1d1d3a"); }
    else { r2(-5, -3, 3, 2, "#fff"); r2(2, -3, 3, 2, "#fff"); r2(-4, -3, 2, 2, "#2a4a7a"); r2(3, -3, 2, 2, "#2a4a7a"); }
    // nose
    r2(0, -1, 1, 2, "#d9a87c");
    // wry mouth: one corner up
    if (wry) { r2(-2, 2, 3, 1, "#b5766a"); r2(1, 1, 2, 1, "#b5766a"); }
    else { r2(-2, 2, 4, 1, "#b5766a"); }
    // Dave's glasses
    if (!female) { r2(-6, -3, 5, 1, "#3de1ff"); r2(1, -3, 5, 1, "#3de1ff"); r2(-1, -3, 1, 1, "#1d1d3a"); }
    // Diane: earrings
    else { r2(-9, 2, 1, 2, "#ffd23d"); r2(8, 2, 1, 2, "#ffd23d"); }
    c.restore();
  }

  function showMenu() {
    inMenu = true;
    const s = DC.Save.loadSettings();
    const hasSave = DC.Save.hasSave();
    const root = document.getElementById("ui-root");
    root.innerHTML = "";
    const menu = document.createElement("div");
    menu.className = "menu-screen";
    menu.innerHTML = `
      <div class="menu-title">DATACENTER</div>
      <div class="menu-sub">INFRASTRUCTURE · CRISIS · GROWTH</div>
      <div class="menu-btns">
        ${hasSave ? '<button id="m-continue">CONTINUE</button>' : ""}
        <button id="m-play">PLAY</button>
        <button id="m-challenges">CHALLENGES</button>
        <button id="m-custom">CUSTOM GAME</button>
        <button id="m-help">HELP</button>
        <button id="m-wipe" class="danger" style="display:${hasSave ? "block" : "none"}">DELETE SAVE</button>
      </div>
      <div class="menu-note">A SOLE-OPERATOR SIMULATION · ORIGINAL PROTOTYPE</div>
      <div class="menu-settings">
        <button id="m-sound"></button>
        <label class="vol-wrap"><span class="vol-lbl">VOL</span><input id="m-vol" type="range" min="0" max="100" step="1"></label>
      </div>
    `;
    root.appendChild(menu);
    const beginRun = (seed, challenge, op) => {
      DC.Save.saveSettings(Object.assign(DC.Save.loadSettings(), { operator: op || "dave" }));
      if (DC.Tech) DC.Tech.setOperator(op || "dave");
      menu.remove();
      newGame(seed, challenge);
    };
    const pickThen = (seed, challenge) => showOperatorPick(
      (op) => beginRun(seed, challenge, op),
      () => { menu.remove(); showMenu(); }
    );
    const startRun = (seed, challenge) => pickThen(seed, challenge);
    if (hasSave) menu.querySelector("#m-continue").onclick = () => { menu.remove(); continueGame(); };
    menu.querySelector("#m-play").onclick = () => pickThen(String(Date.now()), null);
    menu.querySelector("#m-challenges").onclick = () => showChallenges(menu, startRun);
    menu.querySelector("#m-custom").onclick = () => showCustomGame(menu, startRun);
    menu.querySelector("#m-help").onclick = () => {
      DC.UI.modal("ONLINE HELP", DC.UI.helpContent(), true);
    };
    menu.querySelector("#m-wipe").onclick = () => { DC.Save.clear(); menu.remove(); showMenu(); };
    const soundBtn = menu.querySelector("#m-sound");
    const volInput = menu.querySelector("#m-vol");
    soundBtn.textContent = "SOUND: " + (s.audio ? "ON" : "OFF");
    soundBtn.classList.toggle("off", !s.audio);
    volInput.value = Math.round((s.volume > 1 ? s.volume / 100 : s.volume) * 100);
    soundBtn.onclick = () => {
      s.audio = !s.audio;
      DC.Audio.setEnabled(s.audio);
      if (s.audio) { DC.Audio.unlock(); DC.Audio.click(); }
      DC.Save.saveSettings(s);
      soundBtn.textContent = "SOUND: " + (s.audio ? "ON" : "OFF");
      soundBtn.classList.toggle("off", !s.audio);
    };
    volInput.oninput = () => {
      s.volume = parseInt(volInput.value, 10) / 100;
      DC.Audio.setVolume(s.volume);
      DC.Save.saveSettings(s);
    };
  }

  function newGame(seed, challengeName) {
    if (challengeName && DC.CHALLENGES[challengeName]) {
      DC.applySettings(Object.assign({}, DC.DEFAULT_SETTINGS, DC.CHALLENGES[challengeName]));
    } else {
      applyLoadedSettings();
    }
    state = DC.Facility.generate(seed, DC.CFG, challengeName);
    bootRun();
    const s = DC.Save.loadSettings();
    if (!s.tutorialDone && !challengeName) DC.Tutorial.start(state);
  }

  function continueGame() {
    applyLoadedSettings();
    const st = DC.Save.load();
    if (!st) { showMenu(); return; }
    state = st;
    if (!state.clusters) state.clusters = [];
    if (!state.maintenance && DC.Maintenance) DC.Maintenance.initState(state);
    if (!state.upgrades) state.upgrades = [];
    if (state.metrics && state.metrics.growthPct === undefined) state.metrics.growthPct = 0;
    if (!state.requests) state.requests = [];
    ["patches", "badPatches", "batteriesReplaced", "migrations", "requestsDone"].forEach((k) => { if (state.stats[k] === undefined) state.stats[k] = 0; });
    if (state.eqById["UPS-1"]) state.eqById["UPS-1"].id = "UPS-1";
    if (DC.Wan) DC.Wan.ensure(state);
    if (!state.speed) state.speed = 1;
    // tenant satisfaction (new field)
    for (const b of state.blades || []) {
      if (b.tenant && b.tenant.sat === undefined) b.tenant.sat = 50;
    }
    bootRun();
  }

  function bootRun() {
    inMenu = false;
    document.getElementById("ui-root").innerHTML = "";
    DC.Events.handlers = {};
    DC.UI.init(state);
    cam.x = DC.Render.totalWidth(state) / 2;
    cam.y = DC.Render.CAM_Y;
    cam.zoom = defaultZoom();
    DC.Audio.startAmbient();
    updateSpeedBtn();
    if (DC.Tech) DC.Tech.reset();
  }

  function jumpTo(targetId) {
    if (!targetId) return;
    const eq = state.eqById[targetId];
    if (!eq) return;
    const rack = state.racks[eq.rack];
    if (rack) {
      cam.x = DC.Render.rackX(state.racks.indexOf(rack)) + DC.Render.RACK_W / 2;
    } else if (targetId === "UPS-1") {
      cam.x = DC.Render.upsX(state) + 20;
    }
    DC.UI.select(eq);
  }

  function defaultZoom() {
    // 3% further out than the height-derived fit
    return DC.Util.clamp((window.innerHeight - 150) / DC.Render.RACK_H * 0.97, 0.3, 0.9);
  }

  function resetZoomView() {
    if (!state) return;
    cam.zoom = defaultZoom();
    cam.y = DC.Render.CAM_Y;
    cam.x = DC.Render.totalWidth(state) / 2;
    clampCam();
  }

  const SPEEDS = [0.5, 1, 2, 4];
  const SPEED_NAMES = { 0.5: "EASY", 1: "NORMAL", 2: "BOOST", 4: "MAX" };
  const SPEED_KEYS = { 1: 0.5, 2: 1, 3: 2, 4: 4 };

  function speedBtn() { return document.getElementById("btn-speed"); }

  function updateSpeedBtn() {
    const b = speedBtn();
    if (b && state) b.textContent = "SPD ×" + state.speed + " " + (SPEED_NAMES[state.speed] || "");
  }

  function setSpeed(mult) {
    if (!state) return;
    state.speed = mult;
    updateSpeedBtn();
    DC.Audio.click();
  }

  function cycleSpeed() {
    if (!state) return;
    const idx = SPEEDS.indexOf(state.speed || 1);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  }

  function togglePause() {
    if (!running()) return;
    state.paused = !state.paused;
    const btn = document.getElementById("btn-pause");
    if (btn) btn.textContent = state.paused ? "RESUME [SPC]" : "PAUSE [SPC]";
    if (state.paused) showPauseOverlay(); else hidePauseOverlay();
  }

  function showPauseOverlay() {
    const root = document.getElementById("ui-root");
    const ov = document.createElement("div");
    ov.className = "pause-overlay";
    ov.id = "pause-ov";
    ov.innerHTML = '<div class="pt">PAUSED</div><button id="p-resume">RESUME</button><button id="p-stats">STATISTICS</button><button id="p-ach">ACHIEVEMENTS</button><button id="p-quit">SAVE & QUIT TO MENU</button>';
    root.appendChild(ov);
    ov.querySelector("#p-resume").onclick = () => togglePause();
    ov.querySelector("#p-stats").onclick = () => DC.UI.showStats();
    ov.querySelector("#p-ach").onclick = () => DC.UI.showAchievements();
    ov.querySelector("#p-quit").onclick = () => {
      DC.Save.save(state);
      hidePauseOverlay();
      state = null;
      showMenu();
    };
  }

  function hidePauseOverlay() {
    const ov = document.getElementById("pause-ov");
    if (ov) ov.remove();
  }

  function animateExpansion(newRacks, addLeft) {
    for (const r of newRacks) { r.fresh = true; r.freshT = 0; }
  }

  function gameOverScreen() {
    DC.Save.clear();
    DC.Audio.stopAmbient();
    DC.Audio.beep(220, 0.8, "sawtooth", 0.15);
    const root = document.getElementById("ui-root");
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.style.zIndex = 90;
    ov.innerHTML = '<div class="modal wide"><div class="m-hdr"><span class="title" style="color:#ff4d5e">DATACENTER OFFLINE</span></div><div class="m-body" id="go-body"></div><div class="m-ftr"><button id="go-menu">MAIN MENU</button></div></div>';
    root.appendChild(ov);
    ov.querySelector("#go-body").innerHTML = '<p style="color:#ff8f9a;margin-bottom:10px">' + state.gameOverReason + "</p>" + statsHtml();
    ov.querySelector("#go-menu").onclick = () => { ov.remove(); state = null; showMenu(); };
  }

  function statsHtml() {
    const s = state.stats, m = state.metrics;
    const rows = [
      ["RUN SEED", state.seedStr], ["UPTIME", DC.Util.fmtUptime(m.uptime)], ["SCORE", Math.floor(m.score).toLocaleString()],
      ["SLA", m.sla.toFixed(2) + "%"], ["REPUTATION", Math.round(m.rep) + "%"], ["FINAL RACKS", String(state.racks.length)],
      ["CUSTOMERS", m.customers.toLocaleString()], ["EXPANSIONS", String(s.expansions)], ["UPGRADES", String(s.upgradesInstalled)],
      ["PREVENTIONS", String(s.preventions)], ["DATA LOSS", String(s.dataLoss)], ["TOTAL TICKETS", String(Math.floor(state.tickets.stats.total))],
      ["PEAK TICKETS", String(state.tickets.peak)], ["TICKETS PREVENTED", String(state.tickets.stats.prevented)]
    ];
    let html = '<div class="statgrid">';
    for (const [k, v] of rows) html += '<div class="statrow"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
    return html + "</div>";
  }

  function tick(dt) {
    if (!state || state.paused || inMenu) return;
    DC.Cluster.tick(state, dt);
    DC.Thermal.tick(state, dt);
    DC.Power.tick(state, dt);
    DC.Storage.tick(state, dt);
    DC.Network.tick(state, dt);
    DC.Wan.tick(state, dt);
    DC.Security.tick(state, dt);
    DC.Conditions.tick(state, dt);
    DC.Maintenance.tick(state, dt);
    DC.Helpdesk.tick(state, dt);
    DC.FieldRequests.tick(state, dt);
    DC.Incidents.tick(state, dt);
    DC.Growth.tick(state, dt);
    try { DC.Tutorial.tick(state, dt); } catch (e) { try { DC.Tutorial.stop(); } catch (e2) {} }
    state.time += dt;
    for (const hall of state.halls) {
      if (hall.leak) {
        hall.leakRisk = (hall.leakRisk || 0) + dt;
        if (Math.random() < dt * 0.01) {
          const pdu = DC.Util.allEq(state, "pdu").filter((p) => !p.tripped);
          if (pdu.length) DC.Power.tripBreaker(state, pdu[Math.floor(Math.random() * pdu.length)]);
        }
      }
    }
    for (const cr of state.coolingUnits) {
      if (!cr.fault) cr.filterDirty = Math.min(1, (cr.filterDirty || 0) + dt * 0.0006);
    }
    for (const rack of state.racks) {
      if (rack.fresh && rack.freshT < 1) { rack.freshT = Math.min(1, rack.freshT + dt / 2.5); if (rack.freshT >= 1) rack.fresh = false; }
      for (const eq of rack.equipment) {
        if (eq.fresh && eq.freshT < 1) { eq.freshT = Math.min(1, eq.freshT + dt / 1.5); if (eq.freshT >= 1) eq.fresh = false; }
      }
    }
    if (state.gameOver && !state.gameOverShown) { state.gameOverShown = true; gameOverScreen(); }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (!inMenu && state) {
      handleCamKeys(dt);
      simAcc += dt * state.speed;
      let steps = 0;
      const maxSteps = 6 + (state.speed || 1) * 4;
      while (simAcc >= SIM_DT && steps < maxSteps) { tick(SIM_DT); simAcc -= SIM_DT; steps++; }
      if (simAcc > 1) simAcc = 0;
      uiAcc += dt;
      if (uiAcc > 0.25) { uiAcc = 0; DC.UI.update(); }
      saveAcc += dt;
      if (saveAcc > 15) { saveAcc = 0; DC.Save.save(state); }
      DC.Render.draw(state, ctx, cam, canvas.width, canvas.height, t / 1000);
      DC.Render.setZoomRef(cam.zoom);
      if (DC.Tech) DC.Tech.frame(state, t / 1000);
    }
  }

  function handleCamKeys(dt) {
    const spd = 600 / cam.zoom * dt;
    let moved = false;
    if (keys["a"] || keys["ArrowLeft"]) { cam.x += spd; moved = true; }
    if (keys["d"] || keys["ArrowRight"]) { cam.x -= spd; moved = true; }
    if (keys["w"] || keys["ArrowUp"]) { cam.y += spd; moved = true; }
    if (keys["s"] || keys["ArrowDown"]) { cam.y -= spd; moved = true; }
    if (moved) markMoved();
    clampCam();
  }

  function markMoved() { if (state) state.tutorialMoved = true; }

  function clampCam() {
    if (!state) return;
    const halfView = (window.innerWidth / 2) / cam.zoom;
    const pad = 140;
    const total = DC.Render.totalWidth(state);
    const min = -pad + halfView, max = total + pad - halfView;
    if (min > max) cam.x = total / 2;
    else cam.x = DC.Util.clamp(cam.x, min, max);
    const viewH = window.innerHeight / cam.zoom;
    const worldTop = -DC.Render.CEIL_H - 20, worldBottom = DC.Render.RACK_H + DC.Render.FLOOR_H;
    const minY = worldTop + viewH / 2, maxY = worldBottom - viewH / 2;
    cam.y = minY > maxY ? (worldTop + worldBottom) / 2 : DC.Util.clamp(cam.y, minY, maxY);
    cam.zoom = DC.Util.clamp(cam.zoom, 0.26, 1.6);
  }

  function endPointer(e, allowSelect) {
    if (!ptr.down) return;
    if (e.pointerId !== undefined && ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.down = false;
    ptr.id = null;
    canvas.classList.remove("dragging");
    if (allowSelect && !dragMoved && state && !inMenu) {
      if (DC.Render.zoomResetHit(canvas.width, canvas.height, cam, e.clientX, e.clientY)) {
        DC.Audio.click();
        resetZoomView();
        dragMoved = false;
        return;
      }
      const hit = DC.Render.hitTest(state, cam, canvas.width, canvas.height, e.clientX, e.clientY);
      if (hit) { DC.Audio.click(); DC.UI.select(hit.eq); }
      else DC.UI.select(null);
    }
    dragMoved = false;
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      keys[e.key] = true;
      if (["a", "d", "w", "s", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) !== -1) markMoved();
      if (running() && e.key >= "1" && e.key <= "4" && SPEED_KEYS[e.key]) setSpeed(SPEED_KEYS[e.key]);
    });
    window.addEventListener("keyup", (e) => { keys[e.key] = false; });
    const clearInput = () => {
      keys = {};
      ptr.down = false;
      ptr.id = null;
      dragMoved = false;
      canvas.classList.remove("dragging");
    };
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); });

    canvas.addEventListener("pointerdown", (e) => {
      if (ptr.down) return;
      e.preventDefault();
      ptr = { id: e.pointerId, down: true, dist: 0, x: e.clientX, y: e.clientY };
      dragMoved = false;
      canvas.classList.add("dragging");
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!ptr.down || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      ptr.x = e.clientX; ptr.y = e.clientY;
      ptr.dist += Math.abs(dx) + Math.abs(dy);
      if (ptr.dist > 6) {
        dragMoved = true;
        markMoved();
        cam.x -= dx / cam.zoom;
        cam.y -= dy / cam.zoom;
        clampCam();
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (!ptr.down) return;
      const onCanvas = e.target === canvas || ptr.id === e.pointerId;
      endPointer(e, onCanvas);
    });
    window.addEventListener("pointercancel", (e) => endPointer(e, false));

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      cam.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
      clampCam();
    }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("beforeunload", () => { if (state && !inMenu && !state.gameOver) DC.Save.save(state); });
  }

  function showChallenges(menu, startRun) {
    const names = Object.keys(DC.CHALLENGES);
    let html = "";
    names.forEach((n) => { html += '<button style="text-align:left;letter-spacing:1px" data-c="' + n + '">' + n.replace(/_/g, " ") + "</button>"; });
    html += '<button data-c="">BACK</button>';
    menu.innerHTML = '<div class="menu-title" style="font-size:26px">CHALLENGES</div><div class="menu-btns">' + html + "</div>";
    menu.querySelectorAll("button[data-c]").forEach((b) => {
      b.onclick = () => {
        const c = b.getAttribute("data-c");
        if (!c) showMenu();
        else startRun(String(Date.now()), c);
      };
    });
  }

  function showCustomGame(menu, startRun) {
    const s = DC.Save.loadSettings();
    const sliders = [
      ["difficulty", "OVERALL DIFFICULTY", 50, 200],
      ["failureFreq", "FAILURE FREQUENCY", 0, 500],
      ["escalation", "INCIDENT ESCALATION", 0, 300],
      ["startingRacks", "STARTING RACKS (0 = random)", 0, 12, 1],
      ["maxRacks", "MAXIMUM RACKS", 4, 60],
      ["startCustomerLoad", "STARTING CUSTOMER LOAD %", 25, 300],
      ["customerGrowth", "CUSTOMER GROWTH", 0, 300],
      ["expansionRate", "EXPANSION RATE", 0, 300],
      ["upgradeRate", "UPGRADE RATE", 0, 300],
      ["repGain", "REPUTATION GAIN", 0, 300],
      ["repLoss", "REPUTATION LOSS", 0, 300],
      ["demandGrowth", "DEMAND GROWTH", 0, 300],
      ["expansionThreshold", "EXPANSION THRESHOLD", 50, 200],
      ["ticketGen", "TICKET GENERATION", 0, 500],
      ["ticketEscalation", "TICKET ESCALATION", 0, 500],
      ["ticketClear", "TICKET CLEARING SPEED", 25, 500],
      ["driveFail", "DRIVE FAILURE RATE", 0, 500],
      ["rebuildSpeed", "REBUILD SPEED", 25, 300],
      ["warnRate", "PREDICTIVE WARNING RATE", 0, 300],
      ["coolCapacity", "COOLING CAPACITY", 50, 200],
      ["heatGen", "HEAT GENERATION", 50, 200],
      ["tempRise", "TEMP RISE SPEED", 25, 300],
      ["powerCapacity", "POWER CAPACITY", 50, 200],
      ["utilFail", "UTILITY FAILURE", 0, 500],
      ["netFail", "NETWORK FAILURE", 0, 500],
      ["wanFail", "WAN OUTAGE RATE", 0, 500],
      ["wanMaint", "WAN MAINT WINDOWS", 0, 500],
      ["fwAttack", "FIREWALL ATTACKS", 0, 500],
      ["securityRate", "SECURITY INCIDENT RATE", 0, 500],
      ["propSpeed", "SECURITY PROPAGATION", 25, 300],
      ["leaks", "WATER LEAKS", 0, 500]
    ];
    let html = '<div style="max-height:52vh;overflow-y:auto">';
    for (const [k, label, min, max, step] of sliders) {
      html += '<div class="slider-row"><span class="sk">' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + (step || 5) + '" value="' + s[k] + '" data-k="' + k + '"><span class="sv" id="sv-' + k + '">' + s[k] + "</span></div>";
    }
    html += "</div>";
    html += '<div class="slider-row"><span class="sk">RUN SEED (blank = random)</span><input id="seed-input" style="background:#0a0f16;border:1px solid var(--line);color:var(--txt);padding:4px 8px;font-family:inherit" placeholder="e.g. 8F3A21BC"></div>';
    const root = document.getElementById("ui-root");
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal wide"><div class="m-hdr"><span class="title">CUSTOM GAME</span></div><div class="m-body">' + html + '</div><div class="m-ftr"><button id="cg-reset">RESET TO DEFAULTS</button><button id="cg-start" class="good">LAUNCH RUN</button><button id="cg-back">BACK</button></div></div>';
    root.appendChild(ov);
    ov.querySelectorAll("input[type=range]").forEach((inp) => {
      inp.oninput = () => { s[inp.getAttribute("data-k")] = parseInt(inp.value, 10); document.getElementById("sv-" + inp.getAttribute("data-k")).textContent = inp.value; };
    });
    ov.querySelector("#cg-reset").onclick = () => {
      Object.assign(s, DC.DEFAULT_SETTINGS);
      ov.querySelectorAll("input[type=range]").forEach((inp) => {
        const k = inp.getAttribute("data-k");
        inp.value = s[k];
        document.getElementById("sv-" + k).textContent = s[k];
      });
    };
    ov.querySelector("#cg-back").onclick = () => { ov.remove(); };
    ov.querySelector("#cg-start").onclick = () => {
      DC.Save.saveSettings(s);
      applyLoadedSettings();
      const seed = ov.querySelector("#seed-input").value.trim() || String(Date.now());
      ov.remove();
      pickThen(seed, null);
    };
  }

  return { init, running, newGame, togglePause, cycleSpeed, setSpeed, jumpTo, setSelected: (e) => { selectedId = e ? e.id : null; }, animateExpansion, get state() { return state; }, get cam() { return cam; }, get selectedId() { return selectedId; }, showMenu };
})();

window.addEventListener("DOMContentLoaded", () => DC.Game.init());
