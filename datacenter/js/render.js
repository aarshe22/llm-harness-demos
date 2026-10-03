window.DC = window.DC || {};

DC.Render = (function () {
  const PX = 2;
  const RACK_W = 128, GAP = 48, U = 24, RACK_U = 42;
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
    drawHalls(ctx, state, floorY);
    drawCRACs(ctx, state, floorY, time);

    state.racks.forEach((rack, i) => {
      const x = rackX(i);
      drawRack(ctx, state, rack, x, floorY, time);
    });

    ctx.restore();
    drawCRT(ctx, w, h, time);
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
    PAL.cable.forEach((col, i) => {
      const cy = floorY + 34 + i * 14;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55;
      for (let x = -140; x < worldW + 100; x += 26) ctx.fillRect(x + ((i * 7) % 13), cy, 14, PX);
      ctx.globalAlpha = 1;
    });
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

  function drawCRACs(ctx, state, floorY, time) {
    state.coolingUnits.forEach((cr) => {
      const hallRacks = state.racks.filter((r) => r.hall === cr.hall);
      if (!hallRacks.length) return;
      const anchor = state.racks.indexOf(hallRacks[Math.min(hallRacks.length - 1, 2)]);
      const x = rackX(anchor) - 26;
      const y = floorY + 10;
      const fault = !!cr.fault;
      ctx.fillStyle = PAL.rackIn;
      ctx.fillRect(x, y, 68, 58);
      ctx.strokeStyle = fault ? PAL.ledRed : PAL.rackEdge;
      ctx.lineWidth = PX;
      ctx.strokeRect(x, y, 68, 58);
      ctx.lineWidth = 1;
      pxText(ctx, cr.name, x + 6, y + 14, 8, PAL.text);
      const spin = time * (fault ? 1 : 9);
      ctx.strokeStyle = fault ? PAL.ledRed : PAL.cold;
      for (let b = 0; b < 2; b++) {
        const a = spin + b * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 34);
        ctx.lineTo(x + 20 + Math.cos(a) * 12, y + 34 + Math.sin(a) * 12);
        ctx.stroke();
      }
      ctx.strokeStyle = PAL.rackEdge;
      ctx.beginPath();
      ctx.arc(x + 20, y + 34, 13, 0, Math.PI * 2);
      ctx.stroke();
      const led = fault ? (Math.sin(time * 8) > 0 ? PAL.ledRed : "#5a1020") : PAL.ledGreen;
      ctx.fillStyle = led;
      if (fault || Math.sin(time * 3) > 0) ctx.fillRect(x + 48, y + 26, 6, 6);
      if (fault) {
        if (Math.sin(time * 6) > 0) pxText(ctx, "FAULT", x + 6, y + 54, 8, PAL.ledRed);
      }
    });
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
    else if (eq.type === "storage") drawStorage(ctx, eq, x, bx, bw, y, h, time, blink);
    else if (eq.type === "switch") drawSwitch(ctx, eq, bx, bw, y, h, time, blink);
    else if (eq.type === "pdu") drawPDU(ctx, eq, bx, bw, y, h, time, blink);
  }

  function drawServer(ctx, eq, x, bx, bw, y, h, time, blink) {
    const online = eq.state === "online";
    ctx.fillStyle = online ? "#141038" : "#0b0820";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    let edge = PAL.rackEdge;
    if (online && eq.temp > 72) edge = PAL.ledRed;
    else if (online && eq.temp > 58) edge = PAL.hot;
    else if (online && eq.temp > 46) edge = PAL.ledAmber;
    if (eq.runaway && blink) edge = PAL.ledPink;
    ctx.strokeStyle = edge;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    pxText(ctx, eq.name, bx + 6, y + 16, 8, online ? PAL.text : PAL.textDim);
    ctx.fillStyle = PAL.textDim;
    ctx.font = 8 + 'px "Press Start 2P", monospace';
    if (online) {
      const lw = Math.floor((bw - 40) * (eq.load / 100) / PX) * PX;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(bx + 6, y + h - 14, bw - 40, 6);
      ctx.fillStyle = eq.load > 90 ? PAL.ledPink : eq.load > 75 ? PAL.ledAmber : PAL.ledGreen;
      ctx.fillRect(bx + 6, y + h - 14, lw, 6);
      const leds = [[PAL.ledGreen, blink], [eq.netState === "ok" ? PAL.ledCyan : PAL.textDark, blink && Math.random() > 0.3], [eq.temp > 58 ? PAL.ledRed : eq.temp > 46 ? PAL.ledAmber : PAL.cold, true]];
      leds.forEach(([col, on], i) => {
        if (!on) col = "#1b1445";
        ctx.fillStyle = col;
        ctx.fillRect(bx + bw - 28 + (i % 2) * 10, y + 8 + Math.floor(i / 2) * 10, 6, 6);
      });
      ctx.fillStyle = "#0a0722";
      for (let i = 0; i < 4; i++) ctx.fillRect(bx + 8 + i * 7, y + h - 5, 4, PX);
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

  function drawStorage(ctx, eq, x, bx, bw, y, h, time, blink) {
    ctx.fillStyle = "#120e2e";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    const as = DC.Storage.arrayState(eq);
    ctx.strokeStyle = as === "lost" ? PAL.ledRed : as === "critical" ? PAL.ledRed : as === "degraded" ? PAL.ledAmber : PAL.rackEdge;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    pxText(ctx, eq.name, bx + 6, y + 15, 8, PAL.text);
    const cols = 8, rows = Math.ceil(eq.drives.length / cols);
    const dw = Math.floor((bw - 52) / cols / PX) * PX, dh = Math.floor((h - 26) / rows / PX) * PX;
    eq.drives.forEach((d, i) => {
      const cx = bx + 44 + (i % cols) * (dw + 2), cy = y + 8 + Math.floor(i / cols) * (dh + 2);
      let col = PAL.ledGreen;
      if (d.state === "warn") col = PAL.ledAmber;
      else if (d.state === "failed") col = blink ? PAL.ledRed : "#5a1020";
      else if (d.state === "rebuilding") col = blink ? PAL.ledCyan : "#155a72";
      else if (d.state === "missing") col = "#0a0722";
      ctx.fillStyle = col;
      ctx.fillRect(cx, cy, dw, Math.min(dh, 10));
    });
    if (eq.controller === "fault" && blink) pxText(ctx, "CTRL!", bx + 6, y + h - 6, 8, PAL.ledRed);
    else if (eq.rebuild) {
      const d = eq.drives[eq.rebuild.idx];
      const p = d ? d.rebuild / 100 : 0;
      ctx.fillStyle = "#0a0722";
      ctx.fillRect(bx + 44, y + h - 12, bw - 52, 6);
      ctx.fillStyle = PAL.ledBlue;
      ctx.fillRect(bx + 44, y + h - 12, Math.floor((bw - 52) * p / PX) * PX, 6);
    }
  }

  function drawSwitch(ctx, eq, bx, bw, y, h, time, blink) {
    const on = eq.state === "online";
    ctx.fillStyle = on ? "#101640" : "#0b0820";
    ctx.fillRect(bx, y + 2, bw, h - 4);
    ctx.strokeStyle = on ? PAL.rackEdge : PAL.ledRed;
    ctx.lineWidth = PX;
    ctx.strokeRect(bx, y + 2, bw, h - 4);
    ctx.lineWidth = 1;
    pxText(ctx, eq.name, bx + 6, y + 14, 8, on ? PAL.text : PAL.textDim);
    if (on) {
      for (let p = 0; p < 10; p++) {
        const on2 = Math.sin(time * 6 + p * 1.3) > -0.3;
        ctx.fillStyle = on2 ? (p % 4 === 0 ? PAL.ledCyan : PAL.ledGreen) : "#1b1445";
        ctx.fillRect(bx + 6 + p * 7, y + h - 12, 5, 6);
      }
    } else if (blink) {
      pxText(ctx, "DOWN", bx + 40, y + h - 8, 8, PAL.ledRed);
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
    ctx.fillText(eq.id, bx + 18, y + h / 2 + 4);
    const lw = Math.floor((bw - 60) * (eq.loadPct / 100) / PX) * PX;
    ctx.fillStyle = "#0a0722";
    ctx.fillRect(bx + 52, y + h / 2 - 3, bw - 60, 6);
    ctx.fillStyle = eq.loadPct > 85 ? PAL.ledAmber : PAL.ledGreen;
    ctx.fillRect(bx + 52, y + h / 2 - 3, lw, 6);
  }

  function hitTest(state, cam, w, h, mx, my) {
    const p = worldFromScreen(mx, my, w, h, cam);
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
    draw, hitTest, rackX, RACK_W, GAP, U, RACK_H, CAM_Y, totalWidth, worldFromScreen
  };
})();
