window.DC = window.DC || {};

DC.Render = (function () {
  const RACK_W = 110, GAP = 44, U = 22, RACK_U = 42;
  const FLOOR_PAD = 90;

  function rackX(idx) { return idx * (RACK_W + GAP) + 60; }

  function totalWidth(state) {
    return state.racks.length * (RACK_W + GAP) + 160;
  }

  function eqRect(eq, rack) {
    let y = 0;
    const sorted = rack.equipment;
    const idx = sorted.indexOf(eq);
    for (let i = 0; i < idx; i++) y += sorted[i].uh;
    return { x: 0, yTop: y, h: eq.uh };
  }

  function draw(state, ctx, cam, w, h, time) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#060a12");
    grad.addColorStop(0.6, "#070c14");
    grad.addColorStop(1, "#04070c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(w / 2 + cam.x, h * 0.72);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, 0);

    const floorY = RACK_U * U + 26;
    const worldW = totalWidth(state);
    ctx.fillStyle = "#080d15";
    ctx.fillRect(-100, floorY, worldW + 200, 300);
    ctx.strokeStyle = "#101b28";
    ctx.lineWidth = 1;
    for (let x = -100; x < worldW + 200; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, floorY + 260); ctx.stroke();
    }
    ctx.fillStyle = "#0a1019";
    ctx.fillRect(-100, floorY, worldW + 200, 8);

    const halfW = (w / 2) / cam.zoom;
    const visX0 = cam.x - halfW - 200, visX1 = cam.x + halfW + 200;

    state.racks.forEach((rack, i) => {
      const x = rackX(i);
      if (x < visX0 - 200 || x > visX1) return;
      drawRack(ctx, state, rack, x, floorY, time);
    });

    drawHalls(ctx, state, floorY);
    drawCRACs(ctx, state, floorY, time);
    ctx.restore();
  }

  function drawHalls(ctx, state, floorY) {
    ctx.font = "bold 16px monospace";
    let i = 0;
    while (i < state.racks.length) {
      const hallIdx = state.racks[i].hall;
      let j = i;
      while (j < state.racks.length && state.racks[j].hall === hallIdx) j++;
      const hall = state.halls[hallIdx] || state.halls[0];
      const x0 = rackX(i) - 30, x1 = rackX(j - 1) + RACK_W + 30;
      ctx.strokeStyle = "rgba(74,168,255,0.18)";
      ctx.setLineDash([6, 8]);
      ctx.strokeRect(x0, -46, x1 - x0, floorY + 60);
      ctx.setLineDash([]);
      ctx.fillStyle = hall.leak ? "#ff8f9a" : "rgba(122,168,220,0.75)";
      ctx.fillText(hall.name + (hall.leak ? "  ⚠ WATER LEAK" : ""), x0 + 8, -26);
      if (hall.leak) {
        ctx.fillStyle = "rgba(74,168,255," + (0.25 + 0.15 * Math.sin(Date.now() / 300)) + ")";
        ctx.fillRect(x0, floorY, x1 - x0, 300);
      }
      i = j;
    }
  }

  function drawCRACs(ctx, state, floorY, time) {
    state.coolingUnits.forEach((cr, i) => {
      const hallRacks = state.racks.filter((r) => r.hall === cr.hall);
      if (!hallRacks.length) return;
      const groupIdx = state.racks.indexOf(hallRacks[Math.min(hallRacks.length - 1, 2)]);
      const x = rackX(groupIdx);
      const on = !cr.fault;
      const blink = on && Math.sin(time * 2 + i) > 0;
      ctx.fillStyle = "#0b1220";
      ctx.strokeStyle = on ? "#173247" : "#4a1f26";
      ctx.fillRect(x - 20, floorY + 30, 60, 46);
      ctx.strokeRect(x - 20, floorY + 30, 60, 46);
      ctx.fillStyle = "#4a5c70";
      ctx.font = "9px monospace";
      ctx.fillText(cr.name, x - 16, floorY + 46);
      ctx.fillStyle = on ? (cr.status === "ok" ? "#34d17c" : "#ffb340") : "#ff4d5e";
      if (blink || cr.fault) { ctx.beginPath(); ctx.arc(x + 28, floorY + 40, 3, 0, Math.PI * 2); ctx.fill(); }
      if (cr.fault) {
        ctx.fillStyle = "#ff4d5e";
        ctx.font = "bold 9px monospace";
        ctx.fillText("FAULT", x - 16, floorY + 62);
      }
    });
  }

  function drawRack(ctx, state, rack, x, floorY, time) {
    const h = RACK_U * U;
    const rackHasCrit = state.alarms.some((a) => a.sev === "crit" && !a.cleared && a.time > state.time - 30 && eqInRack(state, a.targetId) === rack);
    ctx.fillStyle = "#0a0e15";
    ctx.fillRect(x - 5, -6, RACK_W + 10, h + 12);
    if (rackHasCrit) {
      const pulse = 0.35 + 0.25 * Math.sin(time * 5);
      ctx.strokeStyle = "rgba(255,77,94," + pulse + ")";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 7, -8, RACK_W + 14, h + 16);
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = "#0d1320";
    ctx.fillRect(x, 0, RACK_W, h);
    ctx.strokeStyle = "#1c2836";
    ctx.strokeRect(x, 0, RACK_W, h);

    ctx.fillStyle = "#38495c";
    ctx.font = "8px monospace";
    for (let u = 42; u >= 1; u -= 3) {
      const y = (42 - u) * U;
      ctx.fillText(String(u), x - 17, y + 10);
      ctx.fillStyle = "#182331";
      ctx.fillRect(x - 2, y, 2, U - 2);
      ctx.fillStyle = "#38495c";
    }

    if (rack.fresh && rack.freshT < 1) {
      ctx.fillStyle = "rgba(20,40,60," + (1 - rack.freshT) * 0.9 + ")";
      ctx.fillRect(x, 0, RACK_W, h);
      ctx.fillStyle = "#4aa8ff";
      ctx.font = "bold 11px monospace";
      ctx.fillText("INSTALLING…", x + 10, h / 2);
    }

    for (const eq of rack.equipment) {
      drawEq(ctx, state, eq, rack, x, time);
    }
  }

  function eqInRack(state, targetId) {
    if (!targetId) return null;
    const eq = state.eqById[targetId];
    if (!eq) return null;
    return state.racks[eq.rack] || null;
  }

  function drawEq(ctx, state, eq, rack, x, time) {
    const rect = eqRect(eq, rack);
    const y = rect.yTop * U;
    const h = rect.h * U;
    const blink = Math.sin(time * 3 + x) > 0;

    if (eq.type === "server") {
      const tempColor = eq.temp > 72 ? "#ff4d5e" : eq.temp > 60 ? "#ff8c3a" : eq.temp > 48 ? "#ffb340" : null;
      ctx.fillStyle = eq.state === "online" ? "#111927" : "#0b0f16";
      ctx.fillRect(x + 3, y + 1, RACK_W - 6, h - 3);
      ctx.strokeStyle = tempColor || (eq.state === "online" ? "#223140" : "#141c26");
      ctx.strokeRect(x + 3, y + 1, RACK_W - 6, h - 3);
      ctx.fillStyle = eq.state === "online" ? "#8aa2b8" : "#3a4a5a";
      ctx.font = "9px monospace";
      const label = eq.name + " " + (eq.runaway ? "⚠100%CPU" : "");
      ctx.fillText(label, x + 8, y + 12);
      ctx.fillStyle = "#3d5268";
      ctx.font = "7px monospace";
      ctx.fillText((eq.state === "online" ? Math.round(eq.load) + "%" : eq.state.toUpperCase()), x + 8, y + h - 5);
      if (eq.state === "online") {
        ctx.fillStyle = eq.sec !== "clean" ? "#ff4d5e" : "#34d17c";
        if (blink || eq.sec !== "clean" || eq.runaway) { ctx.beginPath(); ctx.arc(x + RACK_W - 12, y + 8, 2.5, 0, Math.PI * 2); ctx.fill(); }
        if (tempColor) { ctx.fillStyle = tempColor; ctx.fillRect(x + RACK_W - 20, y + 5, 4, 6); }
        if (eq.psuA === "failed" || eq.psuB === "failed" || eq.fans === "failed") { ctx.fillStyle = "#ffb340"; ctx.fillRect(x + RACK_W - 27, y + 5, 4, 6); }
      } else if (eq.state === "booting") {
        ctx.fillStyle = "#4aa8ff"; ctx.font = "7px monospace"; ctx.fillText("BOOTING", x + RACK_W - 40, y + 12);
      } else if (eq.state === "thermal-shutdown") {
        ctx.fillStyle = "#ff4d5e"; ctx.font = "7px monospace"; ctx.fillText("THERMAL OFF", x + RACK_W - 48, y + 12);
      } else if (eq.state === "shutdown") {
        ctx.fillStyle = "#ffb340"; ctx.font = "7px monospace"; ctx.fillText("SHUTTING DOWN", x + RACK_W - 52, y + 12);
      }
    } else if (eq.type === "storage") {
      ctx.fillStyle = "#10161f";
      ctx.fillRect(x + 3, y + 1, RACK_W - 6, h - 3);
      ctx.strokeStyle = "#223140";
      ctx.strokeRect(x + 3, y + 1, RACK_W - 6, h - 3);
      const cols = Math.min(12, eq.drives.length), rows = Math.ceil(eq.drives.length / cols);
      const dw = (RACK_W - 20) / cols, dh = Math.min(7, (h - 14) / rows);
      eq.drives.forEach((d, i) => {
        const cx = x + 10 + (i % cols) * dw, cy = y + 6 + Math.floor(i / cols) * (dh + 1);
        let color = "#1d7a4c";
        if (d.state === "warn") color = "#9a7a1e";
        else if (d.state === "failed") color = "#ff4d5e";
        else if (d.state === "rebuilding") color = (blink ? "#4aa8ff" : "#1c4a72");
        else if (d.state === "missing") color = "#10161d";
        ctx.fillStyle = color;
        ctx.fillRect(cx, cy, dw - 1.5, dh);
      });
      if (eq.controller === "fault") { ctx.fillStyle = "#ff4d5e"; ctx.font = "bold 8px monospace"; ctx.fillText("CTRL FAULT", x + 8, y + h - 3); }
    } else if (eq.type === "switch") {
      ctx.fillStyle = eq.state === "online" ? "#0f1a26" : "#0b0f16";
      ctx.fillRect(x + 3, y + 1, RACK_W - 6, h - 3);
      const ports = 12;
      for (let p = 0; p < ports; p++) {
        ctx.fillStyle = eq.state === "online" ? (blink && p % 3 === 0 ? "#34d17c" : "#1d5a3c") : "#26303a";
        ctx.fillRect(x + 8 + p * 8, y + h / 2 - 1.5, 5, 3);
      }
      ctx.fillStyle = "#5b7285"; ctx.font = "8px monospace";
      ctx.fillText(eq.name, x + 8, y + 10);
      if (eq.state === "failed") { ctx.fillStyle = "#ff4d5e"; ctx.font = "bold 8px monospace"; ctx.fillText("LINK DOWN", x + RACK_W - 55, y + 10); }
    } else if (eq.type === "pdu") {
      ctx.fillStyle = eq.tripped ? "#1a0d10" : "#0d1420";
      ctx.fillRect(x + 3, y + 2, RACK_W - 6, h - 5);
      ctx.fillStyle = eq.tripped ? "#ff4d5e" : "#34d17c";
      if (blink || eq.tripped) { ctx.beginPath(); ctx.arc(x + 12, y + h / 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#3d5268"; ctx.font = "8px monospace";
      ctx.fillText(eq.name + " " + eq.loadPct + "%", x + 20, y + h / 2 + 3);
      if (eq.tripped) { ctx.fillStyle = "#ff4d5e"; ctx.font = "bold 8px monospace"; ctx.fillText("BREAKER TRIPPED", x + 55, y + h / 2 + 3); }
    }
  }

  function hitTest(state, cam, w, h, mx, my) {
    const worldX = (mx - w / 2 - cam.x) / cam.zoom + cam.x;
    const worldY = (my - h * 0.72) / cam.zoom;
    for (let i = 0; i < state.racks.length; i++) {
      const x = rackX(i);
      if (worldX >= x && worldX <= x + RACK_W && worldY >= -20 && worldY <= RACK_U * U) {
        let u = 0;
        for (const eq of state.racks[i].equipment) {
          if (worldY >= u * U && worldY < (u + eq.uh) * U) return { eq, rack: state.racks[i] };
          u += eq.uh;
        }
        return null;
      }
    }
    return null;
  }

  return { draw, hitTest, rackX, RACK_W, GAP, U, totalWidth };
})();
