import { SLIDER_DEFS, readSliderValue } from "./config.js";

/** Touch chrome is play-only and only for coarse/touch pointers. */
export function touchOverlayVisible(phase, coarse) {
  return phase === "play" && !!coarse;
}

export function prefersCoarsePointer() {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(pointer: coarse)").matches;
}

export function createUI(root, api) {
  const sections = [...new Set(SLIDER_DEFS.map((s) => s.section))];
  const sliderHtml = sections
    .map((sec) => {
      const rows = SLIDER_DEFS.filter((s) => s.section === sec)
        .map(
          (s) =>
            `<label>${s.label} <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}"></label>`
        )
        .join("");
      return `<h3>${sec}</h3>${rows}`;
    })
    .join("");

  root.innerHTML = `
    <div class="safe">
      <div class="hud-top hidden" id="hud">
        <div class="flies" id="flies">0</div>
        <div class="energy"><i id="energy"></i></div>
        <div class="biome" id="biome"></div>
      </div>
      <pre class="debug hidden" id="debug"></pre>
      <div class="panel" id="title">
        <h1>GLOW</h1>
        <p class="tag">THE FOREST IS WATCHING</p>
        <p class="blurb">A tiny white moth. No weapons. Shine to see — and to be seen.</p>
        <button id="play">ENTER THE FOREST</button>
        <button id="calm" class="ghost">CALM PRESET</button>
        <button id="danger" class="ghost">DANGER PRESET</button>
        <button id="customBtn" class="ghost">CUSTOM GAME</button>
        <button id="settingsBtn" class="ghost">SETTINGS</button>
        <p class="help">WASD fly · mouse steer · Shift boost · E / RMB dim · C camera · Esc pause · F3 debug</p>
      </div>
      <div class="panel scroll hidden" id="custom">
        <h2>CUSTOM GAME</h2>
        <div class="sliders">${sliderHtml}</div>
        <p class="warn" id="warn"></p>
        <button id="applyCustom">APPLY</button>
        <button id="resetCustom" class="ghost">RESET TO DEFAULTS</button>
        <button id="closeCustom" class="ghost">CLOSE</button>
      </div>
      <div class="panel hidden" id="settings">
        <h2>SETTINGS</h2>
        <label>Render scale <input type="range" id="render_scale" min="0.5" max="1.25" step="0.05"></label>
        <label>Master volume <input type="range" id="master_volume" min="0" max="1" step="0.05"></label>
        <label class="check"><input type="checkbox" id="invert_y"> Invert look Y</label>
        <label class="check"><input type="checkbox" id="high_vis"> High-visibility fireflies</label>
        <label class="check"><input type="checkbox" id="reduced_flash"> Reduced flash</label>
        <button id="applySettings">SAVE</button>
        <button id="closeSettings" class="ghost">CLOSE</button>
      </div>
      <div class="panel hidden" id="pause">
        <h2>PAUSED</h2>
        <button id="resume">RESUME</button>
        <button id="pauseSettings" class="ghost">SETTINGS</button>
        <button id="toMenu" class="ghost">MAIN MENU</button>
      </div>
      <div class="panel hidden" id="dead">
        <h1>GLOW</h1>
        <p class="tag">THE FOREST CLAIMED YOU</p>
        <pre id="stats"></pre>
        <button id="again">RETURN TO FOREST</button>
        <button id="deadMenu" class="ghost">MAIN MENU</button>
      </div>
      <div class="touch hidden" id="touch">
        <div class="joy" id="joy"></div>
        <div class="steer" id="steer"></div>
        <div class="btns">
          <button data-act="boost">BOOST</button>
          <button data-act="dim">DIM</button>
          <button data-act="rise">RISE</button>
          <button data-act="descend">DESCEND</button>
          <button data-act="camera">CAM</button>
          <button data-act="pause">II</button>
        </div>
      </div>
    </div>`;

  const $ = (id) => root.querySelector(id);
  const sliders = SLIDER_DEFS.map((s) => s.id);

  $("#play").onclick = () => api.play();
  $("#calm").onclick = () => api.calm();
  $("#danger").onclick = () => api.danger();
  $("#customBtn").onclick = () => show("custom");
  $("#settingsBtn").onclick = () => show("settings");
  $("#pauseSettings").onclick = () => show("settings");
  $("#applyCustom").onclick = () => {
    const patch = {};
    for (const id of sliders) patch[id] = Number($("#" + CSS.escape(id))?.value);
    api.applyCustom(patch);
    show("title");
  };
  $("#resetCustom").onclick = () => {
    api.resetCustom();
    sync();
  };
  $("#closeCustom").onclick = () => show("title");
  $("#applySettings").onclick = () => {
    api.applySettings({
      render_scale: Number($("#render_scale").value),
      master_volume: Number($("#master_volume").value),
      invert_y: $("#invert_y").checked,
      high_vis: $("#high_vis").checked,
      reduced_flash: $("#reduced_flash").checked,
    });
    show("title");
  };
  $("#closeSettings").onclick = () => show("title");
  $("#resume").onclick = () => api.resume();
  $("#toMenu").onclick = () => api.menu();
  $("#again").onclick = () => api.again();
  $("#deadMenu").onclick = () => api.menu();

  function coarseNow() {
    return prefersCoarsePointer();
  }

  function syncTouch(phase) {
    $("#touch").classList.toggle("hidden", !touchOverlayVisible(phase, coarseNow()));
  }

  function show(name) {
    for (const id of ["title", "custom", "settings", "pause", "dead"]) {
      $("#" + id).classList.toggle("hidden", id !== name);
    }
    $("#hud").classList.toggle("hidden", name !== "play");
    syncTouch(name);
  }

  function setPhase(phase) {
    if (phase === "play") {
      for (const id of ["title", "custom", "settings", "pause", "dead"]) $("#" + id).classList.add("hidden");
      $("#hud").classList.remove("hidden");
      syncTouch("play");
    } else show(phase);
  }

  function sync() {
    const c = api.config();
    for (const def of SLIDER_DEFS) {
      const el = $("#" + CSS.escape(def.id));
      const v = readSliderValue(c, def.id);
      if (el && v != null) el.value = v;
    }
    $("#warn").textContent = api.warning();
    const s = api.settings();
    $("#render_scale").value = s.render_scale;
    $("#master_volume").value = s.master_volume;
    $("#invert_y").checked = s.invert_y;
    $("#high_vis").checked = s.high_vis;
    $("#reduced_flash").checked = s.reduced_flash;
  }

  function hud(flies, energy, biomeName = "") {
    $("#flies").textContent = String(flies);
    $("#energy").style.transform = `scaleX(${Math.max(0.08, energy)})`;
    $("#biome").textContent = biomeName;
  }

  function stats(text) {
    $("#stats").textContent = text;
  }

  function debug(text, on) {
    $("#debug").classList.toggle("hidden", !on);
    $("#debug").textContent = text;
  }

  syncTouch("title");
  const mq = typeof matchMedia === "function" ? matchMedia("(pointer: coarse)") : null;
  mq?.addEventListener?.("change", () => {
    const playing = $("#hud") && !$("#hud").classList.contains("hidden") && $("#title").classList.contains("hidden");
    syncTouch(playing ? "play" : "title");
  });
  const joy = $("#joy");
  const steer = $("#steer");
  joy.addEventListener("pointerdown", (e) => {
    joy.setPointerCapture(e.pointerId);
    api.setJoy(offset(e, joy));
  });
  joy.addEventListener("pointermove", (e) => {
    if (e.buttons) api.setJoy(offset(e, joy));
  });
  joy.addEventListener("pointerup", () => api.setJoy({ x: 0, y: 0 }));
  steer.addEventListener("pointerdown", (e) => {
    steer.setPointerCapture(e.pointerId);
  });
  steer.addEventListener("pointermove", (e) => {
    if (e.buttons) api.addSteer(e.movementX, e.movementY);
  });
  root.querySelectorAll("[data-act]").forEach((b) => {
    const act = b.getAttribute("data-act");
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      api.touch(act, true);
    });
    b.addEventListener("pointerup", () => api.touch(act, false));
    b.addEventListener("pointercancel", () => api.touch(act, false));
  });

  function offset(e, el) {
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - r.width / 2) / 32,
      y: -(e.clientY - r.top - r.height / 2) / 32,
    };
  }

  sync();
  return { setPhase, hud, stats, debug, sync, show };
}
