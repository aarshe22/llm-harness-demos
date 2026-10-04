window.DC = window.DC || {};

// DAVE — the little nerdy IT guy. Sits at his desk (feet up) when idle;
// walks to equipment when work or alarms pop, does the hammer/wrench cloud, walks back.
DC.Tech = (function () {
  const HOME_X = -118;
  const COL = {
    skin: "#f2c79a", hair: "#33254a", shirt: "#e8e8f4", tie: "#e0485a", pants: "#3a3a5c",
    shoes: "#f5f5ff", glasses: "#3de1ff", pocket: "#ffd23d",
    desk: "#7a4a22", deskHi: "#8f5c2c", monitor: "#0a0722", screen: "#0f3d1e", code: "#3dff8f",
    mug: "#d9d9e0", coffee: "#4a2a18", chair: "#55406e",
    cloud: "#e8ecf5", cloudShade: "#c2c8d8", handle: "#8a5528", metal: "#9aa0ad", spark: "#ffd23d"
  };

  let tasks = [];          // [{id, kind:'work'|'look'}]
  let seenAlarm = new Set();
  let didSet = new Set();  // jobs he already visited — cleared when the job truly ends
  let guy = { x: HOME_X, state: "idle", workT: 0, cur: null };
  let scanAcc = 1, sipT = 0;
  let camEl = null, camCtx = null;

  function reset() {
    tasks = []; seenAlarm = new Set(); didSet = new Set();
    guy = { x: HOME_X, state: "idle", workT: 0, cur: null };
    camEl = null; camCtx = null;
  }

  function posFor(state, id) {
    const eq = state.eqById[id];
    if (!eq) return null;
    if (eq.type === "crac") {
      const rs = state.racks.filter((r) => r.hall === eq.hall);
      if (!rs.length) return HOME_X + 30;
      const a = DC.Render.rackX(state.racks.indexOf(rs[0]));
      const b = DC.Render.rackX(state.racks.indexOf(rs[rs.length - 1])) + DC.Render.RACK_W;
      return (a + b) / 2;
    }
    const rack = state.racks[eq.rack];
    if (!rack) return HOME_X + 40;
    return DC.Render.rackX(eq.rack) + DC.Render.RACK_W / 2;
  }

  function scan(state, now) {
    // jobs he finished may re-arm once truly resolved
    for (const id of [...didSet]) {
      const eq = state.eqById[id];
      if (!eq || (!eq.busy && !eq.maint)) didSet.delete(id);
    }
    for (const eq of DC.Util.allEq(state)) {
      if ((eq.busy || eq.maint) && eq.id) {
        if (didSet.has(eq.id)) continue;
        if (tasks.some((t) => t.id === eq.id)) continue;
        if (guy.cur && guy.cur.id === eq.id && guy.state !== "idle") continue;
        tasks.push({ id: eq.id, kind: "work" });
      }
    }
    for (const a of state.alarms) {
      if (!a.targetId || now - a.time > 3) continue;
      if (seenAlarm.has(a.id)) continue;
      seenAlarm.add(a.id);
      if (tasks.some((t) => t.id === a.targetId)) continue;
      tasks.push({ id: a.targetId, kind: "look" });
      if (seenAlarm.size > 120) seenAlarm = new Set([...seenAlarm].slice(-40));
    }
  }

  function tick(state, dt, now) {
    if (guy.state === "idle") {
      sipT += dt;
      if (tasks.length) { guy.state = "walk"; guy.cur = tasks[0]; }
      return;
    }
    const speed = 230 * Math.sqrt(state.speed || 1);
    if (guy.state === "walk" || guy.state === "homewalk") {
      const tx = guy.state === "homewalk" ? HOME_X : posFor(state, guy.cur.id);
      if (tx === null) { nextTask(state); return; }
      const d = tx - guy.x;
      if (Math.abs(d) < speed * dt) {
        guy.x = tx;
        if (guy.state === "homewalk") { guy.state = "idle"; guy.cur = null; }
        else { guy.state = "work"; guy.workT = 0; }
      } else guy.x += Math.sign(d) * speed * dt;
    } else if (guy.state === "work") {
      guy.workT += dt;
      const dur = guy.cur.kind === "work" ? 1.8 + (guy.cur.id.length % 3) * 0.5 : 2.2;
      if (guy.workT > dur) nextTask(state);
    }
  }

  function nextTask(state) {
    if (guy.cur && guy.cur.kind === "work") didSet.add(guy.cur.id);
    tasks.shift();
    guy.cur = null;
    if (tasks.length) { guy.state = "walk"; guy.cur = tasks[0]; }
    else if (Math.abs(guy.x - HOME_X) < 2) { guy.x = HOME_X; guy.state = "idle"; }
    else guy.state = "homewalk";
  }

  // ---------- drawing ----------
  function r(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // standing / walking guy, feet at (x, fy), facing dir
  function drawGuy(ctx, x, fy, dir, frame) {
    const f = dir; // 1 right, -1 left
    ctx.save();
    ctx.translate(x, fy);
    ctx.scale(f, 1);
    // shoes (walk frames)
    if (frame === 0) { r(ctx, -4, -2, 4, 2, COL.shoes); r(ctx, 1, -2, 4, 2, COL.shoes); }
    else { r(ctx, -6, -2, 4, 2, COL.shoes); r(ctx, 3, -2, 4, 2, COL.shoes); }
    // pants
    r(ctx, -3, -8, 6, 6, COL.pants);
    // shirt + tie + pocket protector
    r(ctx, -4, -15, 8, 7, COL.shirt);
    r(ctx, -1, -15, 1, 4, COL.tie);
    r(ctx, -4, -13, 2, 2, COL.pocket);
    // head + hair
    r(ctx, -3, -21, 7, 6, COL.skin);
    r(ctx, -3, -22, 7, 2, COL.hair);
    // nerdy glasses
    r(ctx, -1, -19, 2, 1, COL.glasses);
    r(ctx, 2, -19, 2, 1, COL.glasses);
    r(ctx, 0, -19, 2, 1, "#1d1d3a");
    ctx.restore();
  }

  // desk scene, origin at left edge, feet baseline y=0
  function drawDeskScene(ctx, ox, fy, occupied, t) {
    ctx.save();
    ctx.translate(ox, fy);
    // desk
    r(ctx, 0, -12, 26, 3, COL.deskHi);
    r(ctx, 0, -9, 26, 2, COL.desk);
    r(ctx, 1, -7, 2, 7, COL.desk);
    r(ctx, 23, -7, 2, 7, COL.desk);
    // monitor with scrolling code
    r(ctx, 3, -22, 11, 9, COL.monitor);
    r(ctx, 4, -21, 9, 7, COL.screen);
    for (let i = 0; i < 4; i++) {
      const w = 2 + ((Math.floor(t * 2) * 7 + i * 5) % 6);
      r(ctx, 5, -20 + i * 2, w, 1, COL.code);
    }
    // mug with steam
    const sip = occupied && Math.sin(t * 0.9) > 0.86;
    r(ctx, 19, -16, 4, 4, COL.mug);
    r(ctx, 19, -15, 4, 1, sip ? COL.mug : COL.coffee);
    if (occupied && !sip && Math.sin(t * 3) > 0.4) { r(ctx, 20, -18, 1, 1, "#cfd6ff"); r(ctx, 22, -19, 1, 1, "#cfd6ff"); }
    // chair
    r(ctx, 27, -18, 3, 16, COL.chair);
    // guy: feet up on the desk, leaning back
    if (occupied) {
      // shoes ON the desk
      r(ctx, 8, -14, 4, 2, COL.shoes);
      r(ctx, 13, -14, 4, 2, COL.shoes);
      // legs stretched from chair over to the desk
      r(ctx, 14, -12, 8, 2, COL.pants);
      // body leaning back in chair
      r(ctx, 21, -20, 7, 8, COL.shirt);
      r(ctx, 23, -20, 1, 4, COL.tie);
      r(ctx, 21, -18, 2, 2, COL.pocket);
      // head tilted back
      r(ctx, 22, -26, 7, 6, COL.skin);
      r(ctx, 22, -27, 7, 2, COL.hair);
      r(ctx, 24, -24, 2, 1, COL.glasses);
      r(ctx, 27, -24, 2, 1, COL.glasses);
      // sip: mug lifted
      if (sip) { r(ctx, 17, -22, 4, 3, COL.mug); }
    }
    ctx.restore();
  }

  // hammer & wrench activity cloud
  function drawWorkCloud(ctx, cx, cy, t) {
    ctx.save();
    ctx.translate(cx, cy);
    const bob = Math.floor(Math.sin(t * 4) * 2);
    ctx.translate(0, bob);
    // cloud blob
    r(ctx, -16, -6, 32, 10, COL.cloud);
    r(ctx, -20, -2, 38, 6, COL.cloud);
    r(ctx, -12, -10, 20, 4, COL.cloud);
    r(ctx, -18, -4, 4, 4, COL.cloudShade);
    r(ctx, 14, -2, 4, 4, COL.cloudShade);
    // tools crossing: two phases
    const phase = Math.floor(t * 5) % 2;
    if (phase === 0) {
      // hammer \
      r(ctx, -8, -8, 3, 3, COL.metal);
      r(ctx, -6, -6, 2, 2, COL.handle); r(ctx, -4, -4, 2, 2, COL.handle); r(ctx, -2, -2, 2, 2, COL.handle);
      // wrench /
      r(ctx, 8, 2, 3, 3, COL.metal);
      r(ctx, 5, 0, 2, 2, COL.metal); r(ctx, 3, -2, 2, 2, COL.metal);
    } else {
      r(ctx, 6, -8, 3, 3, COL.metal);
      r(ctx, 4, -6, 2, 2, COL.handle); r(ctx, 2, -4, 2, 2, COL.handle); r(ctx, 0, -2, 2, 2, COL.handle);
      r(ctx, -9, 1, 3, 3, COL.metal);
      r(ctx, -6, -1, 2, 2, COL.metal); r(ctx, -4, -3, 2, 2, COL.metal);
    }
    // sparks
    if (phase === 0 && Math.sin(t * 12) > 0.5) { r(ctx, 10, -12, 2, 2, COL.spark); r(ctx, -12, 2, 2, 2, COL.spark); }
    ctx.restore();
  }

  function drawWorld(ctx, state, floorY, time) {
    // his desk always exists in the world, left of rack 0
    drawDeskScene(ctx, HOME_X - 12, floorY + 26, guy.state === "idle", time);
    // guy in the world when on a job
    if (guy.state === "idle") return;
    const dir = guy.state === "homewalk" ? -1 : (guy.x < posFor(state, guy.cur.id) ? 1 : -1);
    const frame = Math.floor(time * 8) % 2;
    if (guy.state === "work" && guy.cur) {
      drawGuy(ctx, guy.x, floorY + 26, 1, 0);
      const eq = state.eqById[guy.cur.id];
      let cy = floorY - 40;
      if (eq && state.racks[eq.rack]) {
        let yu = 0;
        for (const e of state.racks[eq.rack].equipment) { if (e === eq) break; yu += e.uh || 2; }
        cy = Math.max(20, yu * DC.Render.U - 6);
      }
      drawWorkCloud(ctx, guy.x, cy, time);
    } else {
      drawGuy(ctx, guy.x, floorY + 26, dir, frame);
    }
  }

  // ---------- operator cam (sidepanel) ----------
  function drawPanel(t) {
    const el = document.getElementById("tech-cam");
    if (!el) return;
    if (el !== camEl) { camEl = el; camCtx = el.getContext("2d"); }
    const c = camCtx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#08040f";
    c.fillRect(0, 0, 144, 88);
    c.save();
    c.scale(2.4, 2.4);
    // mini floor
    c.fillStyle = "#1c1547";
    c.fillRect(0, 22, 60, 2);
    drawDeskScene(c, 10, 24, guy.state === "idle", t);
    c.restore();
    const st = document.getElementById("tech-status");
    if (st) {
      if (guy.state === "idle") st.textContent = "OPERATOR CAM — DAVE [FEET UP]";
      else {
        const eq = guy.cur ? guy.cur.id : "";
        st.textContent = (guy.state === "work" ? "WORKING: " : guy.state === "homewalk" ? "HEADING BACK" : "EN ROUTE: ") + eq;
      }
    }
  }

  let lastT = 0;

  function frame(state, t) {
    if (!state) return;
    const dt = Math.min(0.09, Math.max(0.001, t - lastT || 1 / 60));
    lastT = t;
    scanAcc += dt;
    if (scanAcc > 0.25) { scanAcc = 0; scan(state, state.time); }
    if (!state.paused && !state.gameOver) tick(state, dt, state.time);
    drawPanel(t);
  }

  return { reset, frame, drawWorld, status: () => guy.state };
})();
