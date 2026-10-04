window.DC = window.DC || {};

// DAVE — the little nerdy IT guy. Sits at his desk (feet up) when idle;
// walks to equipment when work or alarms pop, does the hammer/wrench cloud, walks back.
DC.Tech = (function () {
  const HOME_X = -118;
  const BASE_OFF = 26;      // feet baseline below the floor line (rack bottom)
  const SIDE_OFF = 13;      // stand this far to the right of the rack
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
  let guy = { x: HOME_X, y: 0, state: "idle", workT: 0, cur: null, path: [], lastPhase: 0 };
  let scanAcc = 1, sipT = 0;
  let camEl = null, camCtx = null;

  function reset() {
    tasks = []; seenAlarm = new Set(); didSet = new Set();
    guy = { x: HOME_X, y: 0, state: "idle", workT: 0, cur: null, path: [], lastPhase: 0 };
    camEl = null; camCtx = null;
  }

  function baseY() { return DC.Render.RACK_H + BASE_OFF; }

  // where he stands to work on eq: beside the rack at the unit's height
  // returns null if the eq vanished
  function spotFor(state, id) {
    const eq = state.eqById[id];
    if (!eq) return null;
    if (id === "UPS-1") return { x: (DC.Render.upsX ? DC.Render.upsX(state) : -64) - 8, y: baseY() };  // beside the UPS cabinet
    if (eq.type === "crac") {
      const rs = state.racks.filter((r) => r.hall === eq.hall);
      if (!rs.length) return { x: HOME_X + 30, y: baseY() };
      const a = DC.Render.rackX(state.racks.indexOf(rs[0]));
      const b = DC.Render.rackX(state.racks.indexOf(rs[rs.length - 1])) + DC.Render.RACK_W;
      return { x: (a + b) / 2, y: baseY() };
    }
    const rack = state.racks[eq.rack];
    if (!rack) return { x: HOME_X + 40, y: baseY() };
    const rx = DC.Render.rackX(eq.rack);
    // vertical: feet at the unit's bottom edge (rack top = y 0)
    let yu = 0;
    for (const e of rack.equipment) { if (e === eq) break; yu += e.uh || 2; }
    const unitH = (eq.uh || 2) * DC.Render.U;
    const ty = Math.max(30, yu * DC.Render.U + unitH);
    return { x: rx + DC.Render.RACK_W + SIDE_OFF, y: ty };
  }

  function scan(state, now) {
    // jobs he finished may re-arm once truly resolved
    for (const id of [...didSet]) {
      const eq = state.eqById[id];
      if (!eq || (!eq.busy && !eq.maint)) didSet.delete(id);
    }
    // drop queued tasks whose job was resolved elsewhere (never walk to a dead job)
    tasks = tasks.filter((t) => {
      if (guy.cur && guy.cur.id === t.id) return true;
      const eq = state.eqById[t.id];
      if (t.kind === "work") return !!(eq && (eq.busy || eq.maint));
      return true; // look tasks are one-shot visits
    });
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

  // build a waypoint path from his current spot to (tx, ty): descend, cross, climb
  function planPath(from, to) {
    const path = [];
    if (Math.abs(from.y - baseY()) > 1) path.push({ x: from.x, y: baseY() });  // down first
    path.push({ x: to.x, y: baseY() });                                        // across the floor
    if (Math.abs(to.y - baseY()) > 1) path.push({ x: to.x, y: to.y });         // up beside the unit
    return path;
  }

  function beginWork() {
    guy.state = "work";
    guy.workT = 0;
    guy.lastPhase = -1; // force first impact sound immediately
  }

  function tick(state, dt, now) {
    if (guy.state === "idle") {
      sipT += dt;
      if (tasks.length) {
        guy.cur = tasks[0];
        const spot = spotFor(state, guy.cur.id);
        if (!spot) { nextTask(state); return; }
        guy.path = planPath({ x: guy.x, y: guy.y }, spot);
        if (!guy.path.length) { beginWork(); }
        else guy.state = "walk";
      }
      return;
    }
    const speed = 230 * Math.sqrt(state.speed || 1);
    if (guy.state === "walk" || guy.state === "homewalk") {
      if (!guy.path.length) {
        if (guy.state === "homewalk") { guy.state = "idle"; guy.cur = null; guy.path = []; }
        else { beginWork(); }
        return;
      }
      const wp = guy.path[0];
      const dx = wp.x - guy.x, dy = wp.y - guy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < speed * dt) {
        guy.x = wp.x; guy.y = wp.y;
        guy.path.shift();
        if (!guy.path.length) {
          if (guy.state === "homewalk") { guy.state = "idle"; guy.cur = null; guy.x = HOME_X; guy.y = baseY(); }
          else { beginWork(); }
        }
      } else {
        guy.x += (dx / dist) * speed * dt;
        guy.y += (dy / dist) * speed * dt;
      }
    } else if (guy.state === "work") {
      guy.workT += dt;
      // hammer/saw sounds while the cloud is animating
      const phase = Math.floor(guy.workT * 3.5) % 2;
      if (phase !== guy.lastPhase) {
        guy.lastPhase = phase;
        if (phase === 0) DC.Audio.workHit();                             // hammer thud
        else DC.Audio.workSaw();                                         // saw rasp
      }
      const dur = guy.cur.kind === "work" ? 1.8 + (guy.cur.id.length % 3) * 0.5 : 2.2;
      if (guy.workT > dur) nextTask(state);
    }
  }

  function nextTask(state) {
    if (guy.cur && guy.cur.kind === "work") { didSet.add(guy.cur.id); DC.Audio.workDone(); }
    tasks.shift();
    guy.cur = null;
    const here = { x: guy.x, y: guy.y };
    if (tasks.length) {
      guy.cur = tasks[0];
      const spot = spotFor(state, guy.cur.id);
      if (!spot) { tasks.shift(); guy.cur = null; }
      else guy.path = planPath(here, spot);
      if (guy.path && guy.path.length) guy.state = "walk";
      else if (guy.cur) { beginWork(); }
      else guy.path = planPath(here, { x: HOME_X, y: baseY() }), guy.state = "homewalk";
    } else if (Math.abs(guy.x - HOME_X) < 2 && Math.abs(guy.y - baseY()) < 2) {
      guy.x = HOME_X; guy.y = baseY(); guy.state = "idle";
    } else {
      guy.path = planPath(here, { x: HOME_X, y: baseY() });
      guy.state = "homewalk";
    }
  }

  // ---------- drawing ----------
  function r(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // standing / walking guy, feet at (x, fy), facing dir — drawn 1.5x scale
  function drawGuy(ctx, x, fy, dir, frame) {
    const f = dir * 1.9; // 1.9x size, mirrored by dir
    ctx.save();
    ctx.translate(x, fy);
    ctx.scale(f, 1.9);
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
    // cloud blob (bigger, with rolling lobes + shading)
    r(ctx, -22, -8, 44, 12, COL.cloud);
    r(ctx, -26, -3, 50, 7, COL.cloud);
    r(ctx, -16, -13, 26, 5, COL.cloud);
    r(ctx, -22, 0, 5, 4, COL.cloudShade);
    r(ctx, 16, -1, 6, 4, COL.cloudShade);
    r(ctx, -6, -15, 10, 2, COL.cloud);
    const phase = Math.floor(t * 3.5) % 2;
    const impact = Math.sin(t * 14) > 0.55;
    // tools crossing: hammer phase vs wrench phase
    if (phase === 0) {
      // hammer \ with head + claw
      r(ctx, -10, -10, 4, 4, COL.metal);
      r(ctx, -6, -8, 3, 2, COL.metal);
      r(ctx, -5, -6, 2, 2, COL.handle); r(ctx, -3, -4, 2, 2, COL.handle); r(ctx, -1, -2, 2, 2, COL.handle);
      // wrench /
      r(ctx, 9, 3, 4, 3, COL.metal);
      r(ctx, 6, 0, 2, 2, COL.metal); r(ctx, 4, -2, 2, 2, COL.metal); r(ctx, 2, -4, 2, 2, COL.metal);
    } else {
      r(ctx, 7, -10, 4, 4, COL.metal);
      r(ctx, 4, -7, 2, 2, COL.handle); r(ctx, 2, -5, 2, 2, COL.handle); r(ctx, 0, -3, 2, 2, COL.handle);
      r(ctx, -11, 2, 4, 3, COL.metal);
      r(ctx, -7, 0, 2, 2, COL.metal); r(ctx, -5, -2, 2, 2, COL.metal); r(ctx, -3, -4, 2, 2, COL.metal);
    }
    // orbiting bolt/nut particle
    const oa = t * 7;
    r(ctx, Math.round(Math.cos(oa) * 16) - 1, Math.round(Math.sin(oa) * 5) - 12, 2, 2, COL.metal);
    // 4-point impact stars on the hit frames
    if (impact) {
      r(ctx, 12, -14, 3, 1, COL.spark); r(ctx, 13, -15, 1, 3, COL.spark);
      r(ctx, -14, 0, 3, 1, "#fff6c8"); r(ctx, -13, -1, 1, 3, "#fff6c8");
    }
    // trailing sparks both phases
    if (Math.sin(t * 12) > 0.3) { r(ctx, 12, -13, 2, 2, COL.spark); }
    if (Math.sin(t * 9 + 1) > 0.4) { r(ctx, -15, -6, 2, 2, COL.spark); r(ctx, 3, -16, 1, 1, COL.spark); }
    // dust puff at base on impact
    if (impact) { r(ctx, -2, 2, 3, 1, COL.cloudShade); r(ctx, 2, 3, 2, 1, COL.cloudShade); }
    ctx.restore();
  }

  function drawWorld(ctx, state, floorY, time) {
    // his desk always exists in the world, left of rack 0
    drawDeskScene(ctx, HOME_X - 12, floorY + BASE_OFF, guy.state === "idle", time);
    // guy in the world when on a job
    if (guy.state === "idle") return;
    const frame = Math.floor(time * 8) % 2;
    if (guy.state === "work" && guy.cur) {
      const eq = state.eqById[guy.cur.id];
      const facingRack = eq && state.racks[eq.rack];
      drawGuy(ctx, guy.x, guy.y, facingRack ? -1 : 1, 0);
      let cy = floorY - 40;
      if (eq && state.racks[eq.rack]) {
        let yu = 0;
        for (const e of state.racks[eq.rack].equipment) { if (e === eq) break; yu += e.uh || 2; }
        const unitH = (eq.uh || 2) * DC.Render.U;
        cy = Math.max(30, yu * DC.Render.U + unitH / 2);
      }
      drawWorkCloud(ctx, guy.x - 6, cy, time);
    } else {
      const wp = guy.path && guy.path[0];
      let dir = -1;
      if (wp) dir = wp.x >= guy.x ? 1 : -1;
      else if (guy.cur) {
        const spot = spotFor(state, guy.cur.id);
        if (spot) dir = spot.x >= guy.x ? 1 : -1;
      }
      drawGuy(ctx, guy.x, guy.y, dir, frame);
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

  // deterministic driver for tests/tooling: advance Dave's sim by dt directly
  function step(state, dt) {
    scanAcc += dt;
    if (scanAcc > 0.25) { scanAcc = 0; scan(state, state.time); }
    if (!state.paused && !state.gameOver) tick(state, dt, state.time);
  }

  function frame(state, t) {
    if (!state) return;
    const dt = Math.min(0.09, Math.max(0.001, t - lastT || 1 / 60));
    lastT = t;
    step(state, dt);
    drawPanel(t);
  }

  return { reset, frame, drawWorld, step, status: () => guy.state, pos: () => ({ x: guy.x, y: guy.y, state: guy.state, cur: guy.cur ? guy.cur.id : null }) };
})();
