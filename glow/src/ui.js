export function createUI(root, api) {
  root.innerHTML = `
    <div class="safe">
      <div class="hud-top hidden" id="hud">
        <div class="flies" id="flies">0</div>
        <div class="energy"><i id="energy"></i></div>
      </div>
      <pre class="debug hidden" id="debug"></pre>
      <div class="panel" id="title">
        <h1>GLOW</h1>
        <p class="tag">THE FOREST IS WATCHING</p>
        <p class="blurb">A tiny white moth. No weapons. Shine to see — and to be seen.</p>
        <button id="play">ENTER THE FOREST</button>
        <button id="calm" class="ghost">CALM PRESET</button>
        <button id="customBtn" class="ghost">CUSTOM GAME</button>
        <p class="help">WASD fly · mouse steer · Shift boost · E / RMB dim · C camera · Esc pause · F3 debug</p>
      </div>
      <div class="panel hidden" id="custom">
        <h2>CUSTOM GAME</h2>
        <label>Trees <input type="range" id="tree_density" min="0" max="5" step="0.05"></label>
        <label>Fireflies <input type="range" id="firefly_population" min="0" max="5" step="0.05"></label>
        <label>Predators <input type="range" id="owl_population" min="0" max="3" step="0.05"></label>
        <label>Glow <input type="range" id="player_normal_glow" min="0.5" max="2" step="0.05"></label>
        <label>Trail <input type="range" id="trail_brightness" min="0" max="3" step="0.05"></label>
        <label>Danger growth <input type="range" id="difficulty_growth" min="0" max="2" step="0.05"></label>
        <p class="warn" id="warn"></p>
        <button id="applyCustom">APPLY</button>
        <button id="resetCustom" class="ghost">RESET TO DEFAULTS</button>
        <button id="closeCustom" class="ghost">CLOSE</button>
      </div>
      <div class="panel hidden" id="pause">
        <h2>PAUSED</h2>
        <button id="resume">RESUME</button>
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
  const sliders = ["tree_density", "firefly_population", "owl_population", "player_normal_glow", "trail_brightness", "difficulty_growth"];

  $("#play").onclick = () => api.play();
  $("#calm").onclick = () => api.calm();
  $("#customBtn").onclick = () => show("custom");
  $("#applyCustom").onclick = () => {
    const patch = {};
    for (const id of sliders) patch[id] = Number($("#" + id).value);
    api.applyCustom(patch);
    show("title");
  };
  $("#resetCustom").onclick = () => {
    api.resetCustom();
    sync();
  };
  $("#closeCustom").onclick = () => show("title");
  $("#resume").onclick = () => api.resume();
  $("#toMenu").onclick = () => api.menu();
  $("#again").onclick = () => api.again();
  $("#deadMenu").onclick = () => api.menu();

  function show(name) {
    for (const id of ["title", "custom", "pause", "dead"]) {
      $("#" + id).classList.toggle("hidden", id !== name);
    }
    $("#hud").classList.toggle("hidden", name !== null && name !== "play");
  }

  function setPhase(phase) {
    if (phase === "play") {
      for (const id of ["title", "custom", "pause", "dead"]) $("#" + id).classList.add("hidden");
      $("#hud").classList.remove("hidden");
    } else show(phase);
  }

  function sync() {
    const c = api.config();
    for (const id of sliders) {
      if (c[id] != null) $("#" + id).value = c[id];
    }
    $("#warn").textContent = api.warning();
  }

  function hud(flies, energy) {
    $("#flies").textContent = String(flies);
    $("#energy").style.transform = `scaleX(${Math.max(0.08, energy)})`;
  }

  function stats(text) {
    $("#stats").textContent = text;
  }

  function debug(text, on) {
    $("#debug").classList.toggle("hidden", !on);
    $("#debug").textContent = text;
  }

  const coarse = matchMedia("(pointer: coarse)").matches;
  $("#touch").classList.toggle("hidden", !coarse);
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
      x: (e.clientX - r.left - r.width / 2) / 48,
      y: -(e.clientY - r.top - r.height / 2) / 48,
    };
  }

  sync();
  return { setPhase, hud, stats, debug, sync, show };
}
