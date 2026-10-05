window.DC = window.DC || {};

DC.Render = (function () {
  const PX = 2;
  const RACK_W = 160, GAP = 56, U = 18, RACK_U = 42;
  const RACK_H = RACK_U * U;
  const FLOOR_H = 240;
  const CEIL_H = 130;
  const CAM_Y = RACK_H / 2;

  const PAL = {
    bgTop: "#1a1245", bgBot: "#080418",
    wall: "#120d30", wallSeam: "#1b1445", wallVent: "#0a0722",
    floorA: "#1c1547", floorB: "#161040", floorLine: "#2b1f66", floorEdge: "#4d3dff",
    rack: "#181233", rackIn: "#100c26", rackEdge: "#4d3dff", rackHi: "#7a5cff", rivet: "#3d3585",
    ledGreen: "#3dff8f", ledCyan: "#3de1ff", ledAmber: "#ffc23d", ledRed: "#ff3d6e", ledBlue: "#6b7bff", ledPink: "#ff7ad9",
    text: "#c8c2ff", textDim: "#7d74d0", textDark: "#4d4494",
    cable: ["#ff3d6e", "#3de1ff", "#ffc23d", "#3dff8f"],
    hot: "#ff7a3d", cold: "#3de1ff"
  };

  function snap(v) { return Math.round(v / PX) * PX; }

  function rackX(idx) { return 60 + idx * (RACK_W + GAP); }
  function totalWidth(state) { return state.racks.length * (RACK_W + GAP) + 180; }

  function screenCenter(w, h) { return { x: w / 2, y: 44 + (h - 44) / 2 + 14 }; }

  function worldFromScreen(mx, my, w, h, cam) {
    const c = screenCenter(w, h);
    return {
      x: (mx - c.x) / cam.zoom + cam.x,
      y: (my - c.y) / cam.zoom + cam.y
    };
  }

  function eqRect(eq, rack) {
    let y = 0;
    const idx = rack.equipment.indexOf(eq);
    for (let i = 0; i < idx; i++) y += rack.equipment[i].uh;
    return { yTop: y, h: eq.uh };
  }

  function glowRect(ctx, x, y, w, h, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x - PX, y - PX, w + PX * 2, h + PX * 2);
    ctx.globalAlpha = 1;
  }

  // rotating pixel marquee: dashes crawl clockwise around the rect border
  function marquee(ctx, x, y, w, h, color, time, seg, gap) {
    seg = seg || 6; gap = gap === undefined ? 6 : gap;
    const step = seg + gap;
    const t = Math.floor(time * 10) % step;
    ctx.fillStyle = color;
    // top edge (left->right) and bottom edge (right->left)
    for (let d = -t; d < w; d += step) {
      if (d + seg > 0) ctx.fillRect(x + d, y, Math.min(seg, w - d), PX);
      const b = w - (d + seg);
      if (b + seg > 0 && b < w) ctx.fillRect(x + Math.max(b, 0), y + h - PX, Math.min(seg, w - Math.max(b, 0)), PX);
    }
    // left edge (bottom->top) and right edge (top->bottom)
    for (let d = -t; d < h; d += step) {
      if (d + seg > 0) ctx.fillRect(x, y + h - d - PX, PX, Math.min(seg, h - d));
      const r = d;
      if (r + seg > 0 && r < h) ctx.fillRect(x + w - PX, y + Math.max(r, 0), PX, Math.min(seg, h - Math.max(r, 0)));
    }
  }

  function pxText(ctx, txt, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.fillStyle = color;
    ctx.textAlign = align || "left";
    ctx.fillText(txt, x, y);
    ctx.textAlign = "left";
  }

  function draw(state, ctx, cam, w, h, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PAL.bgTop);
    grad.addColorStop(1, PAL.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    phaseT = time; // drives the zoom-reset blink
    const c = screenCenter(w, h);
    ctx.translate(snap(c.x), snap(c.y));
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const worldW = totalWidth(state);
    const floorY = RACK_H;

    drawWall(ctx, worldW, floorY, time);
    drawCeiling(ctx, worldW, time);
    drawFloor(ctx, worldW, floorY);
    drawLightCones(ctx, worldW, floorY, time);
    drawUPS(ctx, state, floorY, time);
    drawWANs(ctx, state, floorY, time);
    drawPRN(ctx, state, time);
    drawHalls(ctx, state, floorY);
    drawCRACs(ctx, state, floorY, time);

    state.racks.forEach((rack, i) => {
      const x = rackX(i);
      drawRack(ctx, state, rack, x, floorY, time);
    });

    if (window.DC.Tech) DC.Tech.drawWorld(ctx, state, floorY, time);

    ctx.restore();
    drawZoomReset(ctx, w);
    drawCRT(ctx, w, h, time);
  }

  const CAM_ZOOM_DEFAULT = 0.73; // matched by main.js defaultZoom (3% out from 0.75)
  let camZoomDefault = CAM_ZOOM_DEFAULT;

  // growth now lives in the topbar (horizontal gradient bar); only the zoom-reset
  // touchpoint remains on the canvas, parked below the two-row topbar
  function drawZoomReset(ctx, w) {
    const x = w - 32;
    const zy = 96; // below the two-row topbar
    const active = Math.abs(camZoomDefault - lastZoom) > 0.01;
    ctx.fillStyle = "#0b0820";
    ctx.fillRect(x - 9, zy, 18, 12);
    ctx.strokeStyle = active ? (performanceNowPhase() ? PAL.ledGreen : PAL.rackEdge) : PAL.rackEdge;
    ctx.lineWidth = PX;
    ctx.strokeRect(x - 9, zy, 18, 12);
    ctx.lineWidth = 1;
    // [*] — the square reads as "zoom frame"; asterisk = "fit/reset"
    pxText(ctx, "[*]", x - 12, zy + 9, 8, active ? PAL.ledGreen : PAL.textDim);
    lastZoomRect = { x: x - 15, y: zy - 4, w: 30, h: 20 };
  }

  let phaseT = 0;
  function performanceNowPhase() { return (phaseT * 3 % 1) > 0.5; }

  let lastZoomRect = null;
  let lastZoom = 0.75;
  function setZoomRef(z) { lastZoom = z; }
  // lastZoomRect is in screen px (thermometer is drawn post-restore in screen space)
  function zoomResetHit(w, h, cam, mx, my) {
    if (!lastZoomRect) return false;
    return mx >= lastZoomRect.x && mx <= lastZoomRect.x + lastZoomRect.w && my >= lastZoomRect.y && my <= lastZoomRect.y + lastZoomRect.h;
  }

  function drawWall(ctx, worldW, floorY, time) {
    ctx.fillStyle = PAL.wall;
    ctx.fillRect(-140, -CEIL_H, worldW + 280, CEIL_H + floorY);
    ctx.fillStyle = PAL.wallSeam;
    for (let x = -140; x < worldW + 140; x += 120) ctx.fillRect(x, -CEIL_H, PX, CEIL_H + floorY);
    ctx.fillStyle = PAL.wallVent;
    for (let x = 40; x < worldW + 100; x += 260) {
      ctx.fillRect(x, -CEIL_H + 30, 44, 20);
      ctx.fillStyle = PAL.wallSeam;
      for (let i = 0; i < 4; i++) ctx.fillRect(x, -CEIL_H + 34 + i * 4, 44, PX);
      ctx.fillStyle = PAL.wallVent;
    }
  }

  function drawCeiling(ctx, worldW, time) {
    ctx.fillStyle = "#0b0722";
    ctx.fillRect(-140, -CEIL_H, worldW + 280, CEIL_H - 24);
    ctx.fillStyle = "#1b1445";
    ctx.fillRect(-140, -30, worldW + 280, 8);
    ctx.fillStyle = "#0b0722";
    for (let x = -100; x < worldW + 100; x += 24) ctx.fillRect(x, -34, 10, 6);
    let ci = 0;
    for (let x = 20; x < worldW + 40; x += 220) {
      ctx.fillStyle = "#2b1f66";
      ctx.fillRect(x, -CEIL_H + 18, 44, PX);
      ctx.fillStyle = "#4d3dff";
      ctx.fillRect(x + 18, -CEIL_H + 18, PX, 10);
      const flick = Math.sin(time * 7 + ci * 2.7) > -0.96 ? 1 : 0.3;
      ctx.globalAlpha = flick;
      ctx.fillStyle = "#ffe9a8";
      ctx.fillRect(x + 2, -CEIL_H + 20, 40, 6);
      ctx.globalAlpha = 1;
      ci++;
    }
    ctx.fillStyle = "#0d0a26";
    for (let x = 60; x < worldW; x += 90) ctx.fillRect(x, -CEIL_H, 6, CEIL_H - 26);
  }

  function drawFloor(ctx, worldW, floorY) {
    ctx.fillStyle = PAL.floorA;
    ctx.fillRect(-140, floorY, worldW + 280, FLOOR_H);
    ctx.fillStyle = PAL.floorB;
    const tile = 48;
    for (let y = floorY; y < floorY + FLOOR_H; y += tile) {
      for (let x = -140, k = 0; x < worldW + 140; x += tile, k++) {
        if (((x / tile) | 0) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.fillStyle = PAL.floorLine;
    for (let x = -140; x < worldW + 140; x += tile) ctx.fillRect(x, floorY, PX, FLOOR_H);
    for (let y = floorY; y < floorY + FLOOR_H; y += tile) ctx.fillRect(-140, y, worldW + 280, PX);
    ctx.fillStyle = PAL.floorEdge;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-140, floorY, worldW + 280, PX);
    ctx.globalAlpha = 1;
  }

  function drawLightCones(ctx, worldW, floorY, time) {
    let ci = 0;
    for (let x = 20; x < worldW + 40; x += 220) {
      const flick = 0.05 + 0.02 * Math.sin(time * 2 + ci);
      ctx.globalAlpha = Math.max(0.03, flick);
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath();
      ctx.moveTo(x + 2, -CEIL_H + 26);
      ctx.lineTo(x + 42, -CEIL_H + 26);
      ctx.lineTo(x + 130, floorY);
      ctx.lineTo(x - 86, floorY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ci++;
    }
  }

  function drawHalls(ctx, state, floorY) {
    let i = 0;
    while (i < state.racks.length) {
      const hallIdx = state.racks[i].hall;
      let j = i;
      while (j < state.racks.length && state.racks[j].hall === hallIdx) j++;
      const hall = state.halls[hallIdx] || state.halls[0];
      const x0 = rackX(i) - 34, x1 = rackX(j - 1) + RACK_W + 34;
      ctx.strokeStyle = hall.leak ? "#ff3d6e" : PAL.rackHi;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = PX;
      ctx.strokeRect(x0, -CEIL_H + 42, x1 - x0, floorY + CEIL_H - 20);
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      const blink = hall.leak && Math.sin(Date.now() / 200) > 0;
      pxText(ctx, hall.name + (hall.leak ? " !WATER LEAK" : ""), x0 + 8, -CEIL_H + 66, 8, blink ? PAL.ledRed : PAL.ledCyan);
      if (hall.leak) {
        ctx.fillStyle = "rgba(61,225,255," + (0.15 + 0.1 * Math.sin(Date.now() / 250)) + ")";
        ctx.fillRect(x0, floorY - CEIL_H, x1 - x0, 200);
      }
      i = j;
    }
  }

  // the UPS lives on the bottom row, right of the last CRAC condenser
  // bottom aux row layout: desk under rack 0, then CRAC condensers, UPS, WAN circuits
  // with firewalls, and the tractor-feed printer — spread evenly, never past the
  // left edge of rack 0 or the right edge of the last rack, never below the floor art.
  const DESK_W = 78;       // desk art at 3x (26 * 3)
  const UPS_W = 58, UPS_H = 90;
  const CRAC_W = 68, CRAC_H = 90;
  const WAN_W = 38, WAN_H = 30, FW_W = 44, FW_H = 36, PIPE_MIN = 24;
  const PRN_W = 96, PRN_H = 118;
  const ROW_DROP = 34;     // a few pixel rows lower than the old +10

  function auxRow(state) {
    const left = rackX(0);
    const right = rackX(state.racks.length - 1) + RACK_W;
    const y = RACK_H + ROW_DROP;
    const nCrac = (state.coolingUnits || []).length;
    const nWan = (state.wans || []).length;
    const units = [];
    for (let i = 0; i < nCrac; i++) units.push({ w: CRAC_W, kind: "crac", i });
    if (state.eqById["UPS-1"]) units.push({ w: UPS_W, kind: "ups" });
    for (let i = 0; i < nWan; i++) units.push({ w: WAN_W + PIPE_MIN + FW_W, kind: "wan", i });
    if (state.eqById["PRN-1"]) units.push({ w: PRN_W, kind: "prn" });
    const itemsW = units.reduce((a, u) => a + u.w, 0);
    const start = left + 6; // desk occupies [left, left+DESK_W]; art starts 6px in
    const cursor0 = start + DESK_W + 8;
    const avail = (right - 6) - cursor0 - itemsW;
    const gaps = Math.max(1, units.length - 1);
    const gap = units.length > 1 ? DC.Util.clamp(avail / gaps, 8, 72) : 0;
    const out = { left, right, y, start, cracXs: [], wanXs: [], upsX: null, prnX: null };
    let cursor = cursor0;
    for (const u of units) {
      if (u.kind === "crac") { out.cracXs[u.i] = cursor; cursor += u.w + gap; }
      else if (u.kind === "ups") { out.upsX = cursor; cursor += u.w + gap; }
      else if (u.kind === "wan") {
        const pipe = PIPE_MIN + Math.max(0, gap - 8);
        out.wanXs[u.i] = { bx: cursor, pipe, fx: cursor + WAN_W + 4 + pipe + 4 };
        cursor += u.w + gap;
      }
      else if (u.kind === "prn") { out.prnX = cursor; cursor += u.w; }
    }
    return out;
  }

  function upsX(state) { const a = auxRow(state); return a.upsX !== null ? a.upsX : -64; }
  function printerX(state) { const a = auxRow(state); return a.prnX !== null ? a.prnX : rackX(state.racks.length - 1) + RACK_W + 40; }
  // left edge of the leftmost drawn CRAC condenser (legacy anchor)
  function cracLeftX(state) {
    const a = auxRow(state);
    return a.cracXs.length ? a.cracXs[0] : null;
  }

  function drawUPS(ctx, state, floorY, time) {
    const ups = state.eqById["UPS-1"];
    if (!ups) return;
    const x = upsX(state), w = UPS_W, h = UPS_H;
    const y = RACK_H + ROW_DROP;
    if (y < floorY) return;
    ctx.fillStyle = "#0d0a26";
    ctx.fillRect(x, y, w, h);
    const stress = state.power.upsDischarge || 0;
    let edge = PAL.rackEdge;
    if (stress > 60) edge = PAL.ledRed;
    else if (stress > 25) edge = PAL.ledAmber;
    if (state.power.utility !== "ok" && (time * 4 % 1) > 0.5) edge = PAL.ledRed;
    ctx.strokeStyle = edge;
    ctx.lineWidth = PX;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1;
    pxText(ctx, "UPS", x + 6, y + 12, 8, PAL.text);
    // charge bar
    const charge = DC.Util.clamp(100 - stress, 0, 100);
    ctx.fillStyle = "#0a0722";
    ctx.fillRect(x + 6, y + 18, w - 12, 6);
    ctx.fillStyle = charge > 60 ? PAL.ledGreen : charge > 25 ? PAL.ledAmber : PAL.ledRed;
    ctx.fillRect(x + 6, y + 18, Math.floor((w - 12) * charge / 100 / PX) * PX, 6);
    // battery strings: 8 LEDs
    if (ups.batteries) {
      ups.batteries.forEach((b, i) => {
        const col = b.dead ? PAL.ledRed : b.health < 30 ? PAL.ledAmber : PAL.ledGreen;
        ctx.fillStyle = col;
        ctx.fillRect(x + 7 + (i % 4) * 9, y + 34 + Math.floor(i / 4) * 12, 6, 8);
      });
    }
    // mains LED
    ctx.fillStyle = state.power.utility === "ok" ? PAL.ledGreen : (blinkFast(time) ? PAL.ledRed : "#1b1445");
    ctx.fillRect(x + 6, y + h - 12, 6, 6);
    pxText(ctx, "MAINS", x + 16, y + h - 6, 8, PAL.textDim);
    if (ups.fresh && ups.freshT < 1) freshFlash(ctx, ups, x, y, w, h);
  }

  // redundant WAN backbone: two pipes with pulsing flows + firewalls, bottom row right of the UPS
  function wanStateCol(w, time) {
    if (w.state === "failed") return PAL.ledRed;
    if (w.state === "degraded") return PAL.ledAmber;
    if (w.fw.overloaded) return PAL.ledAmber;
    return PAL.ledGreen;
  }

  function wanGeom(state) {
    const a = auxRow(state);
    const first = a.wanXs[0];
    return {
      bx: first ? first.bx : upsX(state) + UPS_W + 22,
      xs: a.wanXs,
      rowY: a.y,
      rowH: 46, pipeLen: first ? first.pipe : 84, wanW: WAN_W, wanH: WAN_H, fwW: FW_W, fwH: FW_H
    };
  }

  function drawWANs(ctx, state, floorY, time) {
    if (!state.wans || !state.wans.length) return;
    const g = wanGeom(state);
    state.wans.forEach((w, i) => {
      const y = g.rowY + 2 + i * g.rowH;
      const X = g.xs && g.xs[i] ? g.xs[i] : null;
      const col = wanStateCol(w, time);
      // handoff box
      const x0 = X ? X.bx : g.bx;
      ctx.fillStyle = "#0d0a26";
      ctx.fillRect(x0, y, g.wanW, g.wanH);
      ctx.strokeStyle = col;
      ctx.lineWidth = PX;
      ctx.strokeRect(x0, y, g.wanW, g.wanH);
      ctx.lineWidth = 1;
      pxText(ctx, w.id, x0 + 4, y + 11, 8, PAL.text);
      pxText(ctx, w.carrier.split(" ")[0].slice(0, 6).toUpperCase(), x0 + 4, y + 22, 8, PAL.textDim);
      // pipe
      const px0 = x0 + g.wanW + 4, px1 = px0 + g.pipeLen, py = y + Math.floor(g.wanH / 2);
      ctx.strokeStyle = "#1b1445";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px0, py);
      ctx.lineTo(px1, py);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px0, py - 2);
      ctx.lineTo(px1, py - 2);
      ctx.moveTo(px0, py + 2);
      ctx.lineTo(px1, py + 2);
      ctx.stroke();
      // pulsing data flow dashes (slower when degraded, none when failed)
      if (w.state !== "failed") {
        const spd = w.state === "degraded" ? 14 : 40;
        ctx.fillStyle = w.state === "degraded" ? PAL.ledAmber : PAL.ledCyan;
        for (let k = 0; k < 3; k++) {
          const dx = px0 + ((time * spd + k * (g.pipeLen / 3)) % (g.pipeLen - 8));
          ctx.fillRect(dx, py - 1, 7, 2);
        }
      }
      // firewall box
      const fx = px1 + 4, fy = y - 3;
      const fw = w.fw;
      const fcol = fw.overloaded ? PAL.ledRed : fw.busy ? PAL.ledAmber : PAL.rackEdge;
      ctx.fillStyle = "#0d0a26";
      ctx.fillRect(fx, fy, g.fwW, g.fwH);
      ctx.strokeStyle = fcol;
      ctx.lineWidth = PX;
      ctx.strokeRect(fx, fy, g.fwW, g.fwH);
      ctx.lineWidth = 1;
      pxText(ctx, fw.id, fx + 4, fy + 11, 8, PAL.text);
      // cpu bar
      const cw = g.fwW - 10;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(fx + 5, fy + 16, cw, 5);
      const cpu = Math.min(100, fw.cpu || 0);
      ctx.fillStyle = cpu > 85 ? PAL.ledRed : cpu > 60 ? PAL.ledAmber : PAL.ledGreen;
      ctx.fillRect(fx + 5, fy + 16, Math.floor(cw * cpu / 100 / PX) * PX, 5);
      pxText(ctx, "CPU " + Math.round(cpu) + "%", fx + 5, fy + 30, 8, PAL.textDim);
      if (fw.overloaded && (time * 3 % 1) > 0.5) { ctx.fillStyle = PAL.ledRed; ctx.fillRect(fx + g.fwW - 10, fy + 3, 5, 5); }
      pxText(ctx, "MAINT", x0, y + g.wanH + 10, 8, w.maintT > 0 ? PAL.ledAmber : "#3a3570");
    });
  }

  function blinkFast(time) { return (time * 5 % 1) > 0.5; }

  function drawCRACs(ctx, state, floorY, time) {
    const a = auxRow(state);
    state.coolingUnits.forEach((cr, ci) => {
      const x = a.cracXs[ci] !== undefined ? a.cracXs[ci] : rackX(ci * 5) - 26;
      const y = a.y;
      const fault = !!cr.fault;
      const CH = CRAC_H;
      ctx.fillStyle = PAL.rackIn;
      ctx.fillRect(x, y, 68, CH);
      ctx.strokeStyle = fault ? PAL.ledRed : PAL.rackEdge;
      ctx.lineWidth = PX;
      ctx.strokeRect(x, y, 68, CH);
      ctx.lineWidth = 1;
      pxText(ctx, cr.name, x + 6, y + 14, 8, PAL.text);
      const spin = time * (fault ? 1 : 9);
      ctx.strokeStyle = fault ? PAL.ledRed : PAL.cold;
      for (let b = 0; b < 2; b++) {
        const a = spin + b * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 44);
        ctx.lineTo(x + 20 + Math.cos(a) * 13, y + 44 + Math.sin(a) * 13);
        ctx.stroke();
      }
      ctx.strokeStyle = PAL.rackEdge;
      ctx.beginPath();
      ctx.arc(x + 20, y + 44, 14, 0, Math.PI * 2);
      ctx.stroke();
      const led = fault ? (Math.sin(time * 8) > 0 ? PAL.ledRed : "#5a1020") : PAL.ledGreen;
      ctx.fillStyle = led;
      if (fault || Math.sin(time * 3) > 0) ctx.fillRect(x + 48, y + 36, 6, 6);
      if (cr.maint) {
        const p = cr.maint.t0 ? 1 - cr.maint.t / cr.maint.t0 : 0;
        ctx.fillStyle = "#0a0722";
        ctx.fillRect(x + 6, y + 66, 44, 6);
        ctx.fillStyle = PAL.ledCyan;
        ctx.fillRect(x + 6, y + 66, Math.floor(44 * p / PX) * PX, 6);
        if (Math.sin(time * 4) > 0) pxText(ctx, "SRV", x + 52, y + 72, 8, PAL.ledCyan);
      } else if (cr.filterDirty > 0.7 && !fault) {
        ctx.fillStyle = PAL.ledAmber;
        if (Math.sin(time * 2) > 0) ctx.fillRect(x + 48, y + 52, 6, 6);
      }
      if (fault) {
        if (Math.sin(time * 6) > 0) pxText(ctx, "FAULT", x + 6, y + 80, 8, PAL.ledRed);
      }
    });
  }

  // PRN-1 — the big classic dot-matrix tractor-feed printer on metal legs
  function drawPRN(ctx, state, time) {
    const p = state.eqById["PRN-1"];
    if (!p) return;
    const x = printerX(state), y = RACK_H + ROW_DROP;
    const W = PRN_W, H = PRN_H;
    const printing = !!p.printing;
    const jammed = !!p.jam;
    const noPaper = p.paper <= 2;

    // ---- metal legs (tubular steel with cross brace + adjustable feet)
    const legT = y + 62, legB = y + H - 2;
    ctx.fillStyle = "#3d4356";
    ctx.fillRect(x + 6, legT, 5, legB - legT);        // left front leg
    ctx.fillRect(x + W - 11, legT, 5, legB - legT);   // right front leg
    ctx.fillRect(x + 14, legT + 6, 3, legB - legT - 6);  // left rear leg (offset)
    ctx.fillRect(x + W - 17, legT + 6, 3, legB - legT - 6);
    // cross brace
    ctx.strokeStyle = "#3d4356";
    ctx.beginPath();
    ctx.moveTo(x + 8, legB - 8); ctx.lineTo(x + W - 9, legT + 10);
    ctx.moveTo(x + W - 9, legB - 8); ctx.lineTo(x + 8, legT + 10);
    ctx.stroke();
    // feet
    ctx.fillStyle = "#181528";
    ctx.fillRect(x + 4, legB - 2, 9, 4);
    ctx.fillRect(x + W - 13, legB - 2, 9, 4);

    // ---- tractor feed sprockets (behind the body, paper runs between them)
    const sprocketY = y + 44;
    for (const sx of [x + 16, x + W - 16]) {
      ctx.fillStyle = "#23203c";
      ctx.beginPath(); ctx.arc(sx, sprocketY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4a4666";
      ctx.beginPath(); ctx.arc(sx, sprocketY, 7, 0, Math.PI * 2); ctx.stroke();
      // teeth
      const rot = time * (printing ? 5 : 0.4);
      for (let tI = 0; tI < 6; tI++) {
        const ang = rot + tI * Math.PI / 3;
        ctx.fillStyle = "#6a6688";
        ctx.fillRect(sx + Math.cos(ang) * 7 - 1, sprocketY + Math.sin(ang) * 7 - 1, 2, 2);
      }
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(sx - 1, sprocketY - 1, 2, 2);
    }

    // ---- fanfold paper: rises from behind, zigzag over the top
    if (!noPaper) {
      const paperX = x + 22, paperW = W - 44;
      ctx.fillStyle = "#e8e4d0";
      // vertical rise behind the body
      const riseH = 26 + (printing ? (Math.floor(time * 22) % 4) : 0);
      ctx.fillRect(paperX, y - 34, paperW, riseH);
      // printed green-bar lines scrolling while printing
      const scroll = printing ? Math.floor(time * 26) % 6 : 2;
      for (let ln = 0; ln < 5; ln++) {
        const ly = y - 33 + ((ln * 5 + scroll) % 26);
        ctx.fillStyle = ln % 2 ? "#9fd8a8" : "#2f7d46";
        ctx.fillRect(paperX + 3, ly, paperW - 6, 1);
        if (printing && (ln + Math.floor(time * 8)) % 3 === 0) {
          ctx.fillStyle = "#2b2b2b";
          ctx.fillRect(paperX + 4, ly, 6 + ((ln * 13 + Math.floor(time * 6)) % (paperW - 18)), 1);
        }
      }
      // perforation edges
      ctx.fillStyle = "#b8b49c";
      for (let py = y - 33; py < y - 10; py += 4) { ctx.fillRect(paperX - 2, py, 2, 1); ctx.fillRect(paperX + paperW, py, 2, 1); }
      // kinked paper on jam
      if (jammed) {
        ctx.fillStyle = "#d8d4c0";
        ctx.fillRect(paperX - 6, y + 2, 8, 5);
        ctx.fillRect(paperX - 9, y + 6, 6, 4);
        ctx.fillRect(paperX + paperW - 2, y + 4, 8, 5);
      }
    }

    // ---- body: putty-beige cabinet with shade band
    const by = y + 22, bh = 42;
    ctx.fillStyle = "#c9c3b0";
    ctx.fillRect(x, by, W, bh);
    ctx.fillStyle = "#b0aa96"; // lower shade
    ctx.fillRect(x, by + bh - 10, W, 10);
    ctx.fillStyle = "#ded9c6"; // top bevel
    ctx.fillRect(x, by, W, 4);
    // dark paper exit slot + tear bar
    ctx.fillStyle = "#0a0722";
    ctx.fillRect(x + 14, by + 4, W - 28, 3);
    ctx.fillStyle = "#8a5528";
    ctx.fillRect(x + 10, by + 8, W - 20, 2);
    // panel: LEDs + buttons (left)
    const ledY = by + 16;
    const blink = (time * 5 % 1) > 0.5;
    ctx.fillStyle = PAL.ledGreen;
    ctx.fillRect(x + 6, ledY, 4, 4);                       // POWER
    ctx.fillStyle = jammed ? (blink ? PAL.ledRed : "#5a1020") : "#2a2440";
    ctx.fillRect(x + 14, ledY, 4, 4);                      // ERROR
    ctx.fillStyle = noPaper ? (blink ? PAL.ledAmber : "#5a4310") : "#2a2440";
    ctx.fillRect(x + 22, ledY, 4, 4);                      // PAPER
    // buttons
    ctx.fillStyle = "#3d3a55";
    ctx.fillRect(x + 6, ledY + 10, 5, 6);
    ctx.fillRect(x + 15, ledY + 10, 5, 6);
    // label
    pxText(ctx, "PRN-1", x + W - 26, by + 26, 8, "#4a4666");
    pxText(ctx, "24-PIN TRACTOR", x + W - 44, by + 36, 8, "#7a7690");
    // ribbon access door line
    ctx.fillStyle = "#a59f8c";
    ctx.fillRect(x + 30, by + 14, W - 60, 1);
    ctx.fillRect(x + 30, by + 30, W - 60, 1);

    // paper stacking tray in front
    ctx.fillStyle = "#23203c";
    ctx.fillRect(x + 20, by + bh + 2, W - 40, 10);
    ctx.fillStyle = "#181528";
    ctx.fillRect(x + 22, by + bh + 4, W - 44, 8);
    if (p.printing && p.printing.t < p.printing.t0 - 2) {
      // finished pages stacking up
      ctx.fillStyle = "#e8e4d0";
      const pages = Math.min(3, Math.floor((p.printing.t0 - p.printing.t)));
      for (let pg = 0; pg < pages; pg++) ctx.fillRect(x + 26 + pg, by + bh + 1 - pg * 2, W - 52 - pg * 2, 2);
    }
  }

  function drawRack(ctx, state, rack, x, floorY, time) {
    const h = RACK_H;
    const critInRack = rack.equipment.some((eq) => eqAlarm(state, eq) === "crit");
    if (critInRack) {
      const pulse = 0.4 + 0.3 * Math.sin(time * 6);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PAL.ledRed;
      ctx.fillRect(x - 5, -5, RACK_W + 10, PX);
      ctx.fillRect(x - 5, h + 3, RACK_W + 10, PX);
      ctx.fillRect(x - 5, 0, PX, h);
      ctx.fillRect(x + RACK_W + 3, 0, PX, h);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#04030c";
    ctx.fillRect(x - 4, -2, RACK_W + 8, h + 10);
    ctx.fillStyle = PAL.rack;
    ctx.fillRect(x, 0, RACK_W, h);
    ctx.strokeStyle = PAL.rackEdge;
    ctx.lineWidth = PX;
    ctx.strokeRect(x, 0, RACK_W, h);
    ctx.lineWidth = 1;
    ctx.fillStyle = PAL.rackIn;
    ctx.fillRect(x + 8, 2, RACK_W - 16, h - 4);
    ctx.fillStyle = PAL.rivet;
    [[x + 2, 2], [x + RACK_W - 4, 2], [x + 2, h - 4], [x + RACK_W - 4, h - 4]].forEach(([rx, ry]) => ctx.fillRect(rx, ry, PX, PX));
    ctx.fillStyle = PAL.textDark;
    for (let u = 42; u >= 3; u -= 3) {
      const yy = (42 - u) * U;
      ctx.fillRect(x + 1, yy, 5, PX);
      if (u % 6 === 0) pxText(ctx, String(u), x - 16, yy + 12, 8, PAL.textDim);
    }
    if (rack.fresh && rack.freshT < 1) {
      ctx.fillStyle = "rgba(10,6,30,0.85)";
      ctx.fillRect(x + 8, 2, RACK_W - 16, h - 4);
      const p = Math.floor((time * 6) % 4);
      ctx.strokeStyle = PAL.ledCyan;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x + 14, 14, RACK_W - 28, 30);
      ctx.setLineDash([]);
      pxText(ctx, "INSTALL", x + 24, 34, 8, PAL.ledCyan);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i <= p ? PAL.ledCyan : "#1b1445";
        ctx.fillRect(x + 24 + i * 10, 42, 8, 6);
      }
    }
    for (const eq of rack.equipment) drawEq(ctx, state, eq, rack, x, time);
  }

  function eqAlarm(state, eq) {
    if (eq.type === "server" && (eq.state === "thermal-shutdown" || eq.sec === "spreading" || eq.sec === "compromised")) return "crit";
    if (eq.type === "storage" && (DC.Storage.arrayState(eq) === "critical" || eq.controller === "fault")) return "crit";
    if (eq.type === "pdu" && eq.tripped) return "crit";
    if (eq.type === "switch" && eq.state === "failed") return "crit";
    if (eq.type === "server" && (eq.psuA === "failed" || eq.psuB === "failed" || eq.fans === "failed" || eq.diskFull)) return "warn";
    return null;
  }

  function drawEq(ctx, state, eq, rack, x, time) {
    const rect = eqRect(eq, rack);
    const y = snap(rect.yTop * U);
    const h = snap(rect.h * U);
    const bx = x + 10, bw = RACK_W - 20;
    const blink = Math.sin(time * 5 + bx) > 0;

    if (eq.type === "server") drawServer(ctx, eq, x, bx, bw, y, h, time, blink);
    else if (eq.type === "blade") drawBlade(ctx, eq, x, bx, bw, y, h, time, blink);
    else if (eq.type === "storage") drawStorage(ctx, eq, x, bx, bw, y, h, time, blink);
    else if (eq.type === "switch") drawSwitch(ctx, eq, bx, bw, y, h, time, blink);
    else if (eq.type === "pdu") drawPDU(ctx, eq, bx, bw, y, h, time, blink);
  }

  function freshFlash(ctx, eq, bx, y, bw, h) {
    if (!eq.fresh || eq.freshT >= 1) return;
    ctx.globalAlpha = (1 - eq.freshT) * 0.55;
    ctx.fillStyle = PAL.ledCyan;
    ctx.fillRect(bx, y + 2, bw, h - 4);
    ctx.globalAlpha = 1;
  }

  function drawServer(ctx, eq, x, bx, bw, y, h, time, blink) {
    const online = eq.state === "online";
    ctx.fillStyle = online ? "#141038" : "#0b0820";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    let edge = PAL.ledGreen;
    if (online && eq.temp > 72) edge = PAL.ledRed;
    else if (online && eq.temp > 65) edge = PAL.hot;
    else if (online && eq.temp > 60) edge = PAL.ledAmber;
    if (eq.runaway && blink) edge = PAL.ledPink;
    if (online || edge !== PAL.ledGreen) marquee(ctx, bx, y + 2, bw, h - 4, edge, time);
    pxText(ctx, eq.name, bx + 6, y + 16, 8, online ? PAL.text : PAL.textDim);
    ctx.fillStyle = PAL.textDim;
    ctx.font = 8 + 'px "Press Start 2P", monospace';
    if (online) {
      const lw = Math.floor((bw - 40) * (eq.load / 100) / PX) * PX;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(bx + 6, y + h - 14, bw - 40, 6);
      ctx.fillStyle = eq.load > 90 ? PAL.ledPink : eq.load > 75 ? PAL.ledAmber : PAL.ledGreen;
      ctx.fillRect(bx + 6, y + h - 14, lw, 6);
      const leds = [[PAL.ledGreen, blink], [eq.netState === "ok" ? PAL.ledCyan : PAL.textDark, blink && Math.random() > 0.3], [eq.temp > 68 ? PAL.ledRed : eq.temp > 60 ? PAL.ledAmber : PAL.cold, true]];
      leds.forEach(([col, on], i) => {
        if (!on) col = "#1b1445";
        ctx.fillStyle = col;
        ctx.fillRect(bx + bw - 28 + (i % 2) * 10, y + 8 + Math.floor(i / 2) * 10, 6, 6);
      });
      ctx.fillStyle = "#0a0722";
      for (let i = 0; i < 4; i++) ctx.fillRect(bx + 8 + i * 7, y + h - 5, 4, PX);
      if (eq.maint) {
        const p = eq.maint.t0 ? 1 - eq.maint.t / eq.maint.t0 : 0;
        ctx.fillStyle = "#0a0722";
        ctx.fillRect(bx + 6, y + h - 14, bw - 40, 6);
        ctx.fillStyle = PAL.ledCyan;
        ctx.fillRect(bx + 6, y + h - 14, Math.floor((bw - 40) * p / PX) * PX, 6);
        if (blink) pxText(ctx, "UPD", bx + bw - 44, y + 16, 8, PAL.ledCyan);
      }
      if (eq.badPatch && blink) pxText(ctx, "BAD!", bx + 6, y + 27, 8, PAL.ledPink);
      if (eq.clRole) pxText(ctx, eq.clRole, bx + bw - 12, y + h - 6, 8, PAL.ledPink);
      freshFlash(ctx, eq, bx, y, bw, h);
    } else {
      const states = { "booting": ["BOOT", PAL.ledCyan], "shutdown": ["HALT", PAL.ledAmber], "thermal-shutdown": ["HOT!", PAL.ledRed], "offline": ["OFF", PAL.textDark] };
      const [txt, col] = states[eq.state] || ["OFF", PAL.textDark];
      if (blink || eq.state === "offline") pxText(ctx, txt, bx + 6, y + h - 8, 8, col);
      if (eq.state === "booting" && eq.busy) {
        const p = 1 - eq.busy.t / 12;
        ctx.fillStyle = "#0a0722";
        ctx.fillRect(bx + 40, y + h - 16, bw - 50, 6);
        ctx.fillStyle = PAL.ledCyan;
        ctx.fillRect(bx + 40, y + h - 16, Math.floor((bw - 50) * p / PX) * PX, 6);
      }
    }
  }

  const TENANT_COLORS = ["#3de1ff", "#ff7ad9", "#ffc23d", "#3dff8f", "#7a5cff", "#ff7a3d"];

  function drawBlade(ctx, eq, x, bx, bw, y, h, time, blink) {
    const online = eq.state === "online";
    const tc = TENANT_COLORS[(eq.name || "").split("-").pop() % TENANT_COLORS.length || 0];
    ctx.fillStyle = online ? "#151438" : "#0b0820";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    let edge = PAL.ledGreen;
    if (online && eq.temp > 72) edge = PAL.ledRed;
    else if (online && eq.temp > 65) edge = PAL.hot;
    else if (online && eq.temp > 60) edge = PAL.ledAmber;
    if (eq.runaway && blink) edge = PAL.ledPink;
    if (online || edge !== PAL.ledGreen) marquee(ctx, bx, y + 2, bw, h - 4, edge, time);
    // row 1: blade id (left) + tenant color chip (right)
    pxText(ctx, eq.name, bx + 6, y + 15, 8, PAL.text);
    ctx.fillStyle = tc;
    ctx.fillRect(bx + bw - 14, y + 6, 8, 8);
    // row 2: tenant name in tenant color, clear of row 1 and the LEDs
    if (eq.tenant) {
      ctx.font = 8 + 'px "Press Start 2P", monospace';
      ctx.fillStyle = tc;
      ctx.fillText((eq.tenant.name || "?").split(" ")[0].slice(0, 8), bx + 6, y + 28);
    }
    // load bar sits at the bottom of the 4U box
    const lw = Math.floor((bw - 40) * (eq.load / 100) / PX) * PX;
    ctx.fillStyle = "#0a0722";
    ctx.fillRect(bx + 6, y + h - 14, bw - 40, 6);
    ctx.fillStyle = eq.load > 90 ? PAL.ledPink : eq.load > 75 ? PAL.ledAmber : PAL.ledGreen;
    ctx.fillRect(bx + 6, y + h - 14, lw, 6);
    if (online) {
      const led2 = blink ? PAL.ledGreen : "#1b1445";
      ctx.fillStyle = led2;
      ctx.fillRect(bx + bw - 14, y + 18, 8, 8);
      ctx.fillStyle = eq.temp > 68 ? PAL.ledRed : eq.temp > 60 ? PAL.ledAmber : PAL.cold;
      ctx.fillRect(bx + bw - 14, y + 30, 8, 8);
      ctx.fillStyle = "#0a0720";
      for (let i = 0; i < 5; i++) ctx.fillRect(bx + 8 + i * 7, y + h - 5, 4, PX);
      if (eq.busy && eq.busy.t0) {
        const p = 1 - eq.busy.t / eq.busy.t0;
        ctx.fillStyle = PAL.ledCyan;
        ctx.fillRect(bx + 6, y + h - 14, Math.floor((bw - 40) * p / PX) * PX, 6);
      }
    } else {
      const [txt, col] = eq.state === "booting" ? ["BOOT", PAL.ledCyan] : eq.state === "thermal-shutdown" ? ["HOT!", PAL.ledRed] : ["OFF", PAL.textDark];
      if (blink || eq.state === "offline") pxText(ctx, txt, bx + bw - 40, y + h - 8, 8, col);
    }
    freshFlash(ctx, eq, bx, y, bw, h);
  }

  function drawStorage(ctx, eq, x, bx, bw, y, h, time, blink) {
    ctx.fillStyle = "#120e2e";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    const as = DC.Storage.arrayState(eq);
    ctx.strokeStyle = as === "lost" ? PAL.ledRed : as === "critical" ? PAL.ledRed : as === "degraded" ? PAL.ledAmber : PAL.rackEdge;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    pxText(ctx, eq.name, bx + 6, y + 14, 8, PAL.text);
    const cols = 8, rows = Math.ceil(eq.drives.length / cols);
    const dw = Math.floor((bw - 52) / cols / PX) * PX, dh = Math.floor((h - 40) / Math.max(1, rows) / PX) * PX;
    eq.drives.forEach((d, i) => {
      const cx = bx + 44 + (i % cols) * (dw + 2), cy = y + 22 + Math.floor(i / cols) * (dh + 2);
      let col = PAL.ledGreen;
      if (d.state === "warn") col = PAL.ledAmber;
      else if (d.state === "failed") col = blink ? PAL.ledRed : "#5a1020";
      else if (d.state === "rebuilding") col = blink ? PAL.ledCyan : "#155a72";
      else if (d.state === "missing") col = "#0a0722";
      ctx.fillStyle = col;
      ctx.fillRect(cx, cy, dw, Math.min(dh, 10));
    });
    if (eq.controller === "fault" && blink) pxText(ctx, "CTRL!", bx + 6, y + h - 6, 8, PAL.ledRed);
    else if (DC.Storage.capState && DC.Storage.capState(eq) !== "ok") {
      const cs = DC.Storage.capState(eq);
      const capPct = Math.round(eq.usedPct || 0);
      const col = cs === "full" ? PAL.ledRed : PAL.ledAmber;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(bx + 44, y + h - 12, bw - 52, 6);
      ctx.fillStyle = col;
      ctx.fillRect(bx + 44, y + h - 12, Math.floor((bw - 52) * capPct / 100 / PX) * PX, 6);
      if (blink && cs === "full") pxText(ctx, "FULL!", bx + 6, y + h - 6, 8, PAL.ledRed);
      else if (blink) pxText(ctx, String(capPct) + "%", bx + 6, y + h - 6, 8, PAL.ledAmber);
    }
    else if (eq.rebuild) {
      const d = eq.drives[eq.rebuild.idx];
      const p = d ? d.rebuild / 100 : 0;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(bx + 44, y + h - 12, bw - 52, 6);
      ctx.fillStyle = PAL.ledBlue;
      ctx.fillRect(bx + 44, y + h - 12, Math.floor((bw - 52) * p / PX) * PX, 6);
    }
    freshFlash(ctx, eq, bx, y, bw, h);
  }

  function drawSwitch(ctx, eq, bx, bw, y, h, time, blink) {
    const on = eq.state === "online";
    ctx.fillStyle = on ? "#101640" : "#0b0820";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    ctx.strokeStyle = on ? PAL.rackEdge : PAL.ledRed;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    pxText(ctx, eq.name, bx + 6, y + 13, 8, on ? PAL.text : PAL.textDim);
    if (on) {
      for (let p = 0; p < 10; p++) {
        const on2 = Math.sin(time * 6 + p * 1.3) > -0.3;
        ctx.fillStyle = on2 ? (p % 4 === 0 ? PAL.ledCyan : PAL.ledGreen) : "#1b1445";
        ctx.fillRect(bx + 64 + p * 7, y + h / 2 - 3, 5, 6);
      }
    } else if (blink) {
      pxText(ctx, "DOWN", bx + 84, y + 13, 8, PAL.ledRed);
    }
  }

  function drawPDU(ctx, eq, bx, bw, y, h, time, blink) {
    ctx.fillStyle = eq.tripped ? "#1c0a18" : "#0d0a26";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    ctx.strokeStyle = eq.tripped ? PAL.ledRed : PAL.rackEdge;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    const ledCol = eq.tripped ? (blink ? PAL.ledRed : "#5a1020") : PAL.ledGreen;
    ctx.fillStyle = ledCol;
    ctx.fillRect(bx + 6, y + h / 2 - 3, 6, 6);
    ctx.fillStyle = PAL.textDim;
    ctx.font = 8 + 'px "Press Start 2P", monospace';
    ctx.fillText(eq.id, bx + 6, y + h / 2 + 4);
    const lw = Math.floor((bw - 96) * (eq.loadPct / 100) / PX) * PX;
    ctx.fillStyle = "#0a0722";
    ctx.fillRect(bx + 78, y + h / 2 - 3, bw - 86, 6);
    ctx.fillStyle = eq.loadPct > 85 ? PAL.ledAmber : PAL.ledGreen;
    ctx.fillRect(bx + 78, y + h / 2 - 3, lw, 6);
  }

  function hitTest(state, cam, w, h, mx, my) {
    const p = worldFromScreen(mx, my, w, h, cam);
    let hitWan = null;
    const ups = state.eqById["UPS-1"];
    if (ups) {
      const ux = upsX(state);
      if (p.x >= ux - 4 && p.x <= ux + UPS_W + 4 && p.y >= RACK_H + ROW_DROP - 4 && p.y <= RACK_H + ROW_DROP + UPS_H + 4) return { eq: ups, rack: null };
    }
    // tractor-feed printer
    const prn = state.eqById["PRN-1"];
    if (prn) {
      const px0 = printerX(state);
      if (p.x >= px0 - 4 && p.x <= px0 + PRN_W + 4 && p.y >= RACK_H + ROW_DROP - 40 && p.y <= RACK_H + ROW_DROP + PRN_H + 4) return { eq: prn, rack: null };
    }
    // WAN pipes + firewalls (bottom row, right of UPS)
    if (state.wans) {
      const g = wanGeom(state);
      state.wans.forEach((w) => {
        const i = state.wans.indexOf(w);
        const y = g.rowY + 2 + i * g.rowH;
        const X = g.xs && g.xs[i] ? g.xs[i] : null;
        const bx = X ? X.bx : g.bx;
        const fx = X ? X.fx : g.bx + g.wanW + 4 + g.pipeLen + 4;
        if (p.x >= bx - 2 && p.x <= bx + g.wanW + 2 && p.y >= y - 2 && p.y <= y + g.wanH + 2) { hitWan = w; }
        if (p.x >= fx - 2 && p.x <= fx + g.fwW + 2 && p.y >= y - 5 && p.y <= y - 5 + g.fwH + 2) { hitWan = w.fw; }
      });
      if (hitWan) return { eq: hitWan, rack: null };
    }
    for (let i = 0; i < state.racks.length; i++) {
      const x = rackX(i);
      if (p.x >= x && p.x <= x + RACK_W && p.y >= -20 && p.y <= RACK_H) {
        let u = 0;
        for (const eq of state.racks[i].equipment) {
          if (p.y >= u * U && p.y < (u + eq.uh) * U) return { eq, rack: state.racks[i] };
          u += eq.uh;
        }
        return null;
      }
    }
    return null;
  }

  let vignetteCache = null, vignetteKey = "";
  function drawCRT(ctx, w, h, time) {
    ctx.fillStyle = "rgba(5,2,16,0.16)";
    const fl = 0.14 + 0.04 * Math.sin(time * 60);
    ctx.globalAlpha = fl;
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
    const key = w + "x" + h;
    if (vignetteKey !== key) {
      vignetteKey = key;
      vignetteCache = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      vignetteCache.addColorStop(0, "rgba(0,0,0,0)");
      vignetteCache.addColorStop(1, "rgba(2,0,10,0.55)");
    }
    ctx.fillStyle = vignetteCache;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    draw, hitTest, rackX, RACK_W, GAP, U, RACK_H, CAM_Y, CEIL_H, FLOOR_H, totalWidth, worldFromScreen, upsX, cracLeftX, printerX, auxRow, zoomResetHit, setZoomRef
  };
})();
