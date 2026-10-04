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
  let moodEl = null, moodCtx = null;
  let lastState = null;
  let operator = "dave"; // "dave" | "diane" — same job, equally sized, equally paid

  function setOperator(op) { if (op === "diane" || op === "dave") operator = op; }
  function opName() { return operator === "diane" ? "DIANE" : "DAVE"; }

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
  function drawGuy(ctx, x, fy, dir, frame, pose) {
    const female = operator === "diane";
    const f = dir * 1.9; // 1.9x size, mirrored by dir
    ctx.save();
    ctx.translate(x, fy);
    ctx.scale(f, 1.9);
    const working = pose === "work";
    const skin = female ? "#f0c4a0" : COL.skin;
    const hair = female ? "#6e3a20" : COL.hair;
    const shirt = female ? "#3a7a5c" : COL.shirt;
    // shoes (walk frames / planted when working)
    if (working) { r(ctx, -5, -2, 4, 2, COL.shoes); r(ctx, 1, -2, 4, 2, COL.shoes); }
    else if (frame === 0) { r(ctx, -4, -2, 4, 2, COL.shoes); r(ctx, 1, -2, 4, 2, COL.shoes); }
    else { r(ctx, -6, -2, 4, 2, COL.shoes); r(ctx, 3, -2, 4, 2, COL.shoes); }
    // pants (wider stance when working) / Diane: slacks
    if (female) r(ctx, -3, -8, 6, 6, female ? "#2c4a3c" : COL.pants);
    if (working) { r(ctx, -4, -8, 3, 6, female ? "#2c4a3c" : COL.pants); r(ctx, 2, -8, 3, 6, female ? "#2c4a3c" : COL.pants); }
    else if (!female) r(ctx, -3, -8, 6, 6, COL.pants);
    // shirt + collar (blazer lapels for Diane)
    r(ctx, -4, -15, 8, 7, shirt);
    if (female) { r(ctx, -4, -15, 1, 5, "#2c5f48"); r(ctx, 3, -15, 1, 5, "#2c5f48"); r(ctx, -2, -15, 4, 1, "#f0f0ff"); }
    else {
      r(ctx, -1, -15, 2, 1, "#d0d0e8");
      r(ctx, -1, -14, 1, 4, COL.tie);
    }
    r(ctx, -4, -13, 2, 2, COL.pocket);
    // lanyard + badge
    r(ctx, -3, -15, 1, 3, "#3de1ff");
    r(ctx, 2, -15, 1, 3, "#3de1ff");
    r(ctx, -1, -11, 2, 3, "#e8e8f4");
    r(ctx, -1, -10, 2, 1, "#3de1ff");
    // arms: swing while walking, reach while working
    if (working) { r(ctx, 3, -13, 3, 2, skin); r(ctx, 4, -11, 2, 2, skin); }
    else if (frame === 0) { r(ctx, -6, -13, 2, 3, skin); r(ctx, 4, -13, 2, 3, skin); }
    else { r(ctx, -6, -12, 2, 3, skin); r(ctx, 4, -14, 2, 3, skin); }
    // tool belt (both operators)
    r(ctx, -4, -9, 8, 1, "#5a4028");
    if (working) { r(ctx, -5, -8, 2, 3, COL.handle); r(ctx, 3, -8, 2, 2, COL.metal); }
    // head + hair
    r(ctx, -3, -21, 7, 6, skin);
    r(ctx, -3, -22, 7, 2, hair);
    r(ctx, 3, -22, 1, 4, hair); // sideburn
    if (female) { r(ctx, -4, -22, 1, 5, hair); r(ctx, 4, -22, 1, 5, hair); r(ctx, -4, -18, 1, 3, hair); r(ctx, 4, -18, 1, 3, hair); } // longer locks
    // nerdy glasses
    r(ctx, -1, -19, 2, 1, COL.glasses);
    r(ctx, 2, -19, 2, 1, COL.glasses);
    r(ctx, 0, -19, 2, 1, "#1d1d3a");
    r(ctx, -1, -20, 1, 1, "#9fe8ff"); // lens glint
    if (female) r(ctx, 3, -17, 1, 1, "#ffd23d"); // earring
    // working: ear protection
    if (working) { r(ctx, -4, -19, 1, 2, "#ff7d29"); r(ctx, 4, -19, 1, 2, "#ff7d29"); r(ctx, -3, -20, 7, 1, "#ff7d29"); }
    ctx.restore();
  }

  // desk scene, origin at left edge, feet baseline y=0
  function drawDeskScene(ctx, ox, fy, occupied, t, scale) {
    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(scale || 2, scale || 2); // desk scene drawn at 2x (100% larger than original)
    const female = operator === "diane";
    const skin = female ? "#f0c4a0" : COL.skin;
    const hair = female ? "#6e3a20" : COL.hair;
    const shirt = female ? "#3a7a5c" : COL.shirt;
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
      r(ctx, 21, -20, 7, 8, shirt);
      if (female) { r(ctx, 21, -20, 1, 5, "#2c5f48"); r(ctx, 25, -20, 1, 5, "#2c5f48"); }
      else { r(ctx, 23, -20, 1, 4, COL.tie); }
      r(ctx, 21, -18, 2, 2, COL.pocket);
      // head tilted back
      r(ctx, 22, -26, 7, 6, skin);
      r(ctx, 22, -27, 7, 2, hair);
      if (female) { r(ctx, 21, -27, 1, 6, hair); r(ctx, 28, -27, 1, 6, hair); r(ctx, 20, -24, 1, 4, hair); r(ctx, 29, -24, 1, 4, hair); }
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
    const phase = Math.floor(t * 3.5) % 2;
    const impact = Math.sin(t * 14) > 0.55;
    // hammer vs saw, swinging
    if (phase === 0) {
      // hammer swing \ : head + claw on a handle
      r(ctx, -11, -12, 5, 4, COL.metal);
      r(ctx, -6, -9, 2, 2, COL.metal);
      r(ctx, -5, -7, 2, 2, COL.handle); r(ctx, -3, -5, 2, 2, COL.handle); r(ctx, -1, -3, 2, 2, COL.handle);
    } else {
      // saw \ : blade with teeth + grip
      r(ctx, -2, -12, 12, 2, COL.metal);
      r(ctx, 4, -10, 2, 1, COL.metal); r(ctx, 0, -10, 2, 1, COL.metal);
      r(ctx, -3, -10, 3, 3, COL.handle);
    }
    // 4-point impact star on the hit frames
    if (impact) {
      r(ctx, 10, -15, 3, 1, COL.spark); r(ctx, 11, -16, 1, 3, COL.spark);
      r(ctx, -15, -2, 3, 1, "#fff6c8"); r(ctx, -14, -3, 1, 3, "#fff6c8");
    }
    // sparks
    if (Math.sin(t * 12) > 0.3) { r(ctx, 11, -14, 2, 2, COL.spark); }
    if (Math.sin(t * 9 + 1) > 0.4) { r(ctx, -14, -8, 2, 2, COL.spark); }
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
      drawGuy(ctx, guy.x, guy.y, facingRack ? -1 : 1, 0, "work");
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
      drawGuy(ctx, guy.x, guy.y, dir, frame, "walk");
    }
  }

  // ---------- operator cam (sidepanel) ----------
  // ---- mood model: desk = happy/dozing, queue depth drives stress up 5 states
  const MOODS = ["chill", "ok", "busy", "stressed", "onfire"];
  function moodOf(state) {
    if (guy.state === "idle") return "chill";
    const n = tasks.length + (guy.state === "walk" || guy.state === "work" ? 1 : 0);
    if (n <= 2) return "ok";
    if (n <= 4) return "busy";
    if (n <= 7) return "stressed";
    return "onfire";
  }
  const MOOD_FACE = {
    chill: { brow: 0, eyeY: 0, mouth: "zzz", blush: true, flame: 0, sweat: 0, wob: 1.4 },
    ok: { brow: 0, eyeY: 0, mouth: "flat", blush: false, flame: 0, sweat: 0, wob: 0 },
    busy: { brow: 1, eyeY: 0, mouth: "grit", blush: false, flame: 0, sweat: 1, wob: 0 },
    stressed: { brow: 2, eyeY: -1, mouth: "wob", blush: false, flame: 0, sweat: 2, wob: 1 },
    onfire: { brow: 3, eyeY: -1, mouth: "open", blush: false, flame: 3, sweat: 0, wob: 2 }
  };

  function drawMoodFaceInner(c, mood, t) {
    const f = MOOD_FACE[mood];
    const female = operator === "diane";
    const skin = female ? "#f0c4a0" : COL.skin;
    const hair = female ? "#6e3a20" : COL.hair;
    c.save();
    const scale = 3.4;
    // head 12x10 px art centered in the 80x67 tube area; wobble shakes it when stressed
    const wob = f.wob ? Math.round(Math.sin(t * (mood === "onfire" ? 18 : 8)) * f.wob) : 0;
    c.translate(40 + wob, 34); // 40 = center of the 80px-wide tube, 34 centers the 20-px head (scaled 3.4)
    c.scale(scale, scale);
    const r2 = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    // hair (catches fire at onfire; charred edges)
    r2(-7, -12, 14, 3, mood === "onfire" ? "#1a1220" : hair);
    // face
    r2(-6, -9, 12, 10, skin);
    // chin shade
    r2(-4, 0, 8, 1, "#d9a87c");
    // ears
    r2(-7, -5, 1, 3, skin); r2(6, -5, 1, 3, skin);
    // hair fringe
    r2(-6, -9, 12, 2, mood === "onfire" ? "#1a1220" : hair);
    // nose
    r2(0, -4, 1, 2, "#d9a87c");
    // fire on the hair
    if (f.flame > 0) {
      for (let i = 0; i < f.flame + 1; i++) {
        const fx = -5 + i * 4;
        const fh = 3 + Math.round(Math.abs(Math.sin(t * 9 + i * 2)) * 3);
        r2(fx, -12 - fh, 2, fh, i % 2 ? "#ff7d29" : "#ffd23d");
        r2(fx, -12 - fh - 2, 1, 2, "#ff3d1e");
        if (mood === "onfire") r2(fx, -10, 2, 1, "#0a0710"); // scorched bit
      }
    }
    // brows: raise with stress
    if (f.brow >= 1) r2(-4, -7 - (f.brow >= 2 ? 1 : 0), 3, 1, hair);
    if (f.brow >= 1) r2(1, -7 - (f.brow >= 2 ? 1 : 0), 3, 1, hair);
    if (f.brow >= 3) { r2(-4, -8, 3, 1, hair); r2(1, -8, 3, 1, hair); }
    // glasses + eyes
    r2(-4, -5, 3, 2, COL.glasses); r2(1, -5, 3, 2, COL.glasses); r2(-1, -5, 1, 2, "#1d1d3a");
    r2(-4, -5, 1, 1, "#9fe8ff"); r2(1, -5, 1, 1, "#9fe8ff"); // lens glints
    if (mood === "chill") { // sleepy closed eyes
      r2(-3, -4, 2, 1, "#1d1d3a"); r2(1, -4, 2, 1, "#1d1d3a");
    } else {
      r2(-3, -5, 1, 1, "#1d1d3a"); r2(2, -5, 1, 1, "#1d1d3a");
    }
    // mouth per mood
    if (f.mouth === "zzz") {
      r2(-2, -1, 4, 1, "#b5766a");
      if (Math.floor(t) % 3 === 0) { r2(9, -14, 3, 1, "#cfd6ff"); r2(11, -17, 2, 2, "#cfd6ff"); }
    } else if (f.mouth === "flat") r2(-2, -1, 4, 1, "#b5766a");
    else if (f.mouth === "grit") { r2(-2, -1, 4, 1, "#b5766a"); r2(-1, -2, 1, 1, "#b5766a"); r2(0, 0, 1, 1, "#b5766a"); }
    else if (f.mouth === "wob") { r2(-2, 0, 1, 1, "#b5766a"); r2(0, -1, 1, 2, "#b5766a"); r2(1, 0, 1, 1, "#b5766a"); }
    else if (f.mouth === "open") { r2(-2, -1, 4, 3, "#7a2a2a"); r2(-1, 0, 2, 1, "#e8e8f4"); }
    // blush for chill
    if (f.blush) { r2(-6, -2, 1, 1, "#e8a0a0"); r2(5, -2, 1, 1, "#e8a0a0"); }
    // sweat drops
    if (f.sweat > 0) {
      const ph = Math.sin(t * 3) > 0 ? 0 : 1;
      if (f.sweat >= 1) r2(7, -7 - ph, 1, 2, "#8fd4ff");
      if (f.sweat >= 2) r2(-8, -6 + ph, 1, 2, "#8fd4ff");
    }
    c.restore();
  }

  // pixel-art CRT monitor shell drawn around Dave's close-up
  function drawMoodCRT(c, mood, t) {
    const W = 96, H = 96;
    c.imageSmoothingEnabled = false;
    // desk background
    c.fillStyle = "#08040f";
    c.fillRect(0, 0, W, H);
    // plastic shell (beige-ish retro, with bottom-right shadow)
    c.fillStyle = "#1a1430";
    c.fillRect(2, 3, W - 4, H - 7);
    c.fillStyle = "#2c2352";
    c.fillRect(0, 0, W - 2, H - 6);
    // shell highlight/shadow edges
    c.fillStyle = "#3d3270";
    c.fillRect(1, 1, W - 4, 2);
    c.fillStyle = "#120d26";
    c.fillRect(1, H - 7, W - 4, 2);
    // screen recess
    const sx = 8, sy = 7, sw = W - 16, sh = H - 22;
    c.fillStyle = "#04030c";
    c.fillRect(sx, sy, sw, sh);
    // phosphor base glow (dark green tube tint)
    c.fillStyle = "#0c2418";
    c.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
    // the face, on the tube
    c.save();
    c.beginPath();
    c.rect(sx + 2, sy + 2, sw - 4, sh - 4);
    c.clip();
    c.translate(sx + 2, sy + 2);
    drawMoodFaceInner(c, mood, t);
    c.restore();
    // phosphor flicker (subtle whole-tube brightness wobble)
    if (Math.sin(t * 7.3) > 0.93) {
      c.fillStyle = "rgba(120, 255, 190, 0.05)";
      c.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
    }
    // scanlines
    c.fillStyle = "rgba(4, 2, 12, 0.35)";
    for (let y = sy + 2; y < sy + sh - 2; y += 2) c.fillRect(sx + 2, y, sw - 4, 1);
    // slow roll band (CRT sync wobble)
    const band = (t * 22) % (sh + 30) - 15;
    c.fillStyle = "rgba(255,255,255,0.045)";
    c.fillRect(sx + 2, sy + 2 + band, sw - 4, 5);
    // glass reflection streak (top-left curvature)
    c.fillStyle = "rgba(255,255,255,0.07)";
    c.fillRect(sx + 5, sy + 4, 14, 1);
    c.fillRect(sx + 4, sy + 5, 7, 1);
    // corner vignette (screen curvature)
    c.fillStyle = "rgba(2, 2, 8, 0.55)";
    c.fillRect(sx + 2, sy + 2, 3, 1); c.fillRect(sx + 2, sy + 2, 1, 3);
    c.fillRect(sx + sw - 5, sy + 2, 3, 1); c.fillRect(sx + sw - 3, sy + 2, 1, 3);
    c.fillRect(sx + 2, sy + sh - 3, 3, 1); c.fillRect(sx + 2, sy + sh - 3, 1, 3);
    c.fillRect(sx + sw - 5, sy + sh - 3, 3, 1); c.fillRect(sx + sw - 3, sy + sh - 3, 1, 3);
    // control panel strip below screen
    c.fillStyle = "#241c44";
    c.fillRect(4, H - 17, W - 8, 10);
    c.fillStyle = "#1a1430";
    c.fillRect(4, H - 9, W - 8, 2);
    // brand plate
    c.fillStyle = "#8d84c9";
    c.fillRect(9, H - 13, 34, 3);
    // knobs: brightness + v-hold
    const knob = (kx, hot) => {
      c.fillStyle = "#0c0920";
      c.fillRect(kx, H - 14, 6, 6);
      c.fillStyle = hot ? "#ffd23d" : "#5a5494";
      c.fillRect(kx + 1, H - 13, 4, 4);
      c.fillStyle = "#0c0920";
      c.fillRect(kx + 2, H - 14, 1, 2);
    };
    knob(50, mood === "onfire");       // brightness pegs hot when he's on fire
    knob(60, false);
    // ventilation slots on the shell top
    c.fillStyle = "#120d26";
    for (let vx = 14; vx < W - 14; vx += 6) c.fillRect(vx, 2, 3, 1);
    // power LED
    c.fillStyle = "#3dff8f";
    c.fillRect(W - 14, H - 15, 4, 4);
    c.fillStyle = "#0c2418";
    c.fillRect(W - 22, H - 14, 6, 2);
  }

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
    drawDeskScene(c, 10, 24, guy.state === "idle", t, 1);
    c.restore();
    // mood close-up inside a pixel-art CRT
    const mEl = document.getElementById("mood-cam");
    if (mEl) {
      if (mEl !== moodEl) { moodEl = mEl; moodCtx = mEl.getContext("2d"); }
      drawMoodCRT(moodCtx, moodOf(lastState || state), t);
    }
    const st = document.getElementById("tech-status");
    if (st) {
      if (guy.state === "idle") st.textContent = "OPERATOR CAM — " + opName() + " [FEET UP]";
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
    lastState = state;
    const dt = Math.min(0.09, Math.max(0.001, t - lastT || 1 / 60));
    lastT = t;
    step(state, dt);
    drawPanel(t);
  }

  return { reset, frame, drawWorld, step, setOperator, opName, status: () => guy.state, pos: () => ({ x: guy.x, y: guy.y, state: guy.state, cur: guy.cur ? guy.cur.id : null }) };
})();
