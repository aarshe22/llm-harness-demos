window.DC = window.DC || {};

DC.Game = (function () {
  let state = null, canvas = null, ctx = null;
  let cam = { x: 0, y: 0, zoom: 0.75 };
  let dragging = false, dragMoved = false, lastMx = 0, draggingMid = false;
  let keys = {};
  let raf = null, lastT = 0, simAcc = 0, uiAcc = 0, saveAcc = 0;
  let inMenu = true;

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
    DC.Audio.setEnabled(s.audio);
    DC.Audio.setVolume(s.volume / 100);
    return s;
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
    `;
    root.appendChild(menu);
    const startRun = (seed, challenge) => {
      menu.remove();
      newGame(seed, challenge);
    };
    if (hasSave) menu.querySelector("#m-continue").onclick = () => { menu.remove(); continueGame(); };
    menu.querySelector("#m-play").onclick = () => startRun(String(Date.now()), null);
    menu.querySelector("#m-challenges").onclick = () => showChallenges(menu, startRun);
    menu.querySelector("#m-custom").onclick = () => showCustomGame(menu, startRun);
    menu.querySelector("#m-help").onclick = () => {
      DC.UI.modal("ONLINE HELP", DC.UI.helpContent(), true);
    };
    menu.querySelector("#m-wipe").onclick = () => { DC.Save.clear(); menu.remove(); showMenu(); };
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
    bootRun();
  }

  function bootRun() {
    inMenu = false;
    document.getElementById("ui-root").innerHTML = "";
    DC.Events.handlers = {};
    DC.UI.init(state);
    cam.x = DC.Render.totalWidth(state) / 2;
    cam.y = DC.Render.CAM_Y;
    cam.zoom = DC.Util.clamp((window.innerHeight - 150) / DC.Render.RACK_H, 0.3, 0.9);
    DC.Audio.startAmbient();
  }

  function jumpTo(targetId) {
    if (!targetId) return;
    const eq = state.eqById[targetId];
    if (!eq) return;
    const rack = state.racks[eq.rack];
    if (rack) {
      cam.x = DC.Render.rackX(state.racks.indexOf(rack)) + DC.Render.RACK_W / 2;
      DC.UI.select(eq);
    }
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
    DC.Thermal.tick(state, dt);
    DC.Power.tick(state, dt);
    DC.Storage.tick(state, dt);
    DC.Network.tick(state, dt);
    DC.Security.tick(state, dt);
    DC.Helpdesk.tick(state, dt);
    DC.Incidents.tick(state, dt);
    DC.Growth.tick(state, dt);
    DC.Tutorial.tick(state, dt);
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
      while (simAcc >= SIM_DT && steps < 6) { tick(SIM_DT); simAcc -= SIM_DT; steps++; }
      if (simAcc > 1) simAcc = 0;
      uiAcc += dt;
      if (uiAcc > 0.25) { uiAcc = 0; DC.UI.update(); }
      saveAcc += dt;
      if (saveAcc > 15) { saveAcc = 0; DC.Save.save(state); }
      DC.Render.draw(state, ctx, cam, canvas.width, canvas.height, t / 1000);
    }
  }

  function handleCamKeys(dt) {
    const spd = 600 / cam.zoom * dt;
    if (keys["a"] || keys["ArrowLeft"]) { cam.x += spd; markMoved(); }
    if (keys["d"] || keys["ArrowRight"]) { cam.x -= spd; markMoved(); }
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
    cam.zoom = DC.Util.clamp(cam.zoom, 0.26, 1.6);
    cam.y = DC.Render.CAM_Y;
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      keys[e.key] = true;
      if (e.key === "a" || e.key === "d") markMoved();
    });
    window.addEventListener("keyup", (e) => { keys[e.key] = false; });
    canvas.addEventListener("mousedown", (e) => {
      dragging = true; dragMoved = false; lastMx = e.clientX;
      canvas.classList.add("dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastMx;
      if (Math.abs(dx) > 3) { dragMoved = true; markMoved(); }
      cam.x += dx / cam.zoom;
      lastMx = e.clientX;
      clampCam();
    });
    window.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("dragging");
      if (!dragMoved && state && !inMenu && e.target === canvas) {
        const hit = DC.Render.hitTest(state, cam, canvas.width, canvas.height, e.clientX, e.clientY);
        if (hit) { DC.Audio.click(); DC.UI.select(hit.eq); }
        else DC.UI.select(null);
      }
    });
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
      menu.remove();
      newGame(seed, null);
    };
  }

  return { init, running, newGame, togglePause, jumpTo, setSelected: (e) => {}, animateExpansion, get state() { return state; }, get cam() { return cam; }, showMenu };
})();

window.addEventListener("DOMContentLoaded", () => DC.Game.init());
