window.DC = window.DC || {};

DC.UI = (function () {
  let state = null, selected = null, built = false;
  const el = (id) => document.getElementById(id);

  function chipId(id) { return "chip-" + id; }

  function build() {
    const root = el("ui-root");
    root.innerHTML = `
      <div id="topbar">
        <div class="tb-logo">DATACENTER</div>
        <div class="chip" id="${chipId("uptime")}"><div class="lbl">UPTIME</div><div class="val">00:00:00</div></div>
        <div class="chip" id="${chipId("score")}"><div class="lbl">SCORE</div><div class="val">0</div></div>
        <div class="chip clickable" id="${chipId("tickets")}"><div class="lbl">TICKETS</div><div class="val">0</div></div>
        <div class="chip" id="${chipId("sla")}"><div class="lbl">SLA</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("rep")}"><div class="lbl">REP</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("customers")}"><div class="lbl">CUSTOMERS</div><div class="val">0</div></div>
        <div class="chip" id="${chipId("temp")}"><div class="lbl">TEMP</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("power")}"><div class="lbl">POWER</div><div class="val">—</div></div>
        <div class="chip clickable" id="${chipId("cooling")}"><div class="lbl">COOLING</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("net")}"><div class="lbl">NET</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("data")}"><div class="lbl">DATA</div><div class="val">—</div></div>
        <div class="chip" id="${chipId("sec")}"><div class="lbl">SEC</div><div class="val">NORMAL</div></div>
        <div class="chip" id="${chipId("inc")}"><div class="lbl">INCIDENTS</div><div class="val">0</div></div>
        <div id="tb-right">
          <button id="btn-help">HELP [F1]</button>
          <button id="btn-pause">PAUSE [SPC]</button>
        </div>
      </div>
      <div id="alarmbar" style="display:none">
        <div class="hdr"><span>ALARMS</span><span id="alarm-count"></span></div>
        <div class="list" id="alarm-list"></div>
      </div>
      <div id="sidepanel">
        <div class="hdr"><span class="title" id="sp-title"></span><span class="close" id="sp-close">✕</span></div>
        <div class="body" id="sp-body"></div>
      </div>
      <div class="toast-wrap" id="toasts"></div>
      <div id="tutorial-banner" style="display:none"></div>
    `;
    el("sp-close").onclick = () => select(null);
    el("btn-pause").onclick = () => DC.Game.togglePause();
    el("btn-help").onclick = () => showHelp();
    el(chipId("tickets")).onclick = () => showHelpdesk();
    el(chipId("cooling")).onclick = () => showCooling();
    el(chipId("power")).onclick = () => showPower();
    built = true;
  }

  function toast(msg, cls) {
    const wrap = el("toasts");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast " + (cls || "info");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.5s"; }, 3800);
    setTimeout(() => t.remove(), 4400);
    while (wrap.children.length > 4) wrap.firstChild.remove();
  }

  function valCls(v, warn, bad) {
    if (v >= bad) return "r";
    if (v >= warn) return "a";
    return "g";
  }

  function update() {
    if (!state || !built) return;
    const m = state.metrics;
    const set = (id, html, cls, pulse) => {
      const c = el(chipId(id));
      if (!c) return;
      c.querySelector(".val").innerHTML = html;
      c.className = "chip" + (cls ? " " + cls : "") + (pulse ? " pulse" : "");
    };
    set("uptime", DC.Util.fmtUptime(m.uptime));
    set("score", Math.floor(m.score).toLocaleString());
    const t = state.tickets.open;
    set("tickets", String(t), t <= 5 ? "g" : t <= 20 ? "a" : t <= 50 ? "o" : "r", t > 50);
    set("sla", m.sla.toFixed(2) + "%", m.sla > 99.5 ? "g" : m.sla > 97 ? "a" : "r");
    set("rep", Math.round(m.rep) + "%", m.rep > 60 ? "g" : m.rep > 30 ? "a" : "r");
    set("customers", m.customers.toLocaleString());
    set("temp", m.temp.toFixed(1) + "C", m.temp > 32 ? "r" : m.temp > 27 ? "a" : "g");
    set("power", m.powerPct + "%", m.powerPct > 95 ? "r" : m.powerPct > 80 ? "a" : "g");
    set("cooling", m.coolPct + "%", m.coolPct < 60 ? "r" : m.coolPct < 85 ? "a" : "g");
    set("net", m.netPct + "%", m.netPct < 80 ? "a" : "g");
    set("data", m.dataPct + "%", m.dataPct < 80 ? "r" : m.dataPct < 95 ? "a" : "g");
    set("sec", m.sec, m.sec === "CRITICAL" ? "r" : m.sec === "SUSPICIOUS" ? "a" : "g", m.sec === "CRITICAL");
    set("inc", String(activeIncidents(state)), activeIncidents(state) > 0 ? "a" : "g");

    const ab = el("alarmbar");
    const recent = state.alarms.filter((a) => !a.cleared);
    if (recent.length) {
      ab.style.display = "flex";
      el("alarm-count").textContent = recent.length;
      const list = el("alarm-list");
      list.innerHTML = "";
      recent.slice(0, 7).forEach((a) => {
        const d = document.createElement("div");
        d.className = "alarm sev-" + (a.sev === "crit" ? "crit" : a.sev === "warn" ? "warn" : "info");
        d.innerHTML = '<div class="dot"></div><div class="msg">' + a.msg + '</div><div class="tm">' + DC.Util.fmtUptime(a.time) + "</div>";
        d.onclick = () => { state.tutorialJumped = true; DC.Game.jumpTo(a.targetId); a.cleared = a.cleared || a.sev !== "crit"; };
        list.appendChild(d);
      });
    } else ab.style.display = "none";
    if (selected) renderPanel();
  }

  function activeIncidents(state) {
    return state.alarms.filter((a) => a.sev === "crit" && !a.cleared && state.time - a.time < 120).length;
  }

  function select(eq) {
    selected = eq;
    const sp = el("sidepanel");
    if (!sp) return;
    if (!eq) { sp.classList.remove("open"); DC.Game.setSelected(null); return; }
    sp.classList.add("open");
    DC.Game.setSelected(eq);
    renderPanel();
  }

  function statRow(k, v, cls) {
    return '<div class="statrow"><span class="k">' + k + '</span><span class="v ' + (cls || "") + '">' + v + "</span></div>";
  }

  function renderPanel() {
    const eq = selected;
    if (!eq) return;
    el("sp-title").textContent = eq.name || eq.id;
    const body = el("sp-body");
    let html = "";
    const actions = [];
    if (eq.type === "server") {
      html += statRow("MODEL", eq.model);
      html += statRow("ROLE", eq.role);
      html += statRow("CPU", eq.cpu + " cores");
      html += statRow("MEM", eq.mem + " GB");
      html += statRow("LOAD", Math.round(eq.load) + "%", eq.load > 90 ? "r" : eq.load > 75 ? "a" : "g");
      html += statRow("TEMP", eq.temp.toFixed(1) + "C", eq.temp > 72 ? "r" : eq.temp > 60 ? "o" : eq.temp > 48 ? "a" : "g");
      if (eq.throttle > 0.1) html += statRow("STATUS", "THERMAL THROTTLING", "r");
      html += statRow("PSU A", eq.psuA.toUpperCase(), eq.psuA === "ok" ? "g" : "r");
      html += statRow("PSU B", eq.psuB.toUpperCase(), eq.psuB === "ok" ? "g" : "r");
      html += statRow("FANS", eq.fans.toUpperCase(), eq.fans === "ok" ? "g" : "a");
      html += statRow("NET", eq.netState === "ok" ? "CONNECTED" : "DISCONNECTED", eq.netState === "ok" ? "g" : "a");
      html += statRow("SECURITY", eq.sec.toUpperCase(), eq.sec === "clean" ? "g" : "r");
      html += statRow("STATE", eq.state.toUpperCase(), eq.state === "online" ? "g" : "a");
      if (eq.ecc > 0) html += statRow("ECC ERRORS", eq.ecc + "/3", eq.ecc >= 3 ? "r" : "a");
      if (eq.diskFull) html += statRow("DISK", "LOG VOLUME FULL", "r");
      if (eq.busy) html += statRow("BUSY", eq.busy.kind.toUpperCase() + " " + Math.ceil(eq.busy.t) + "s", "b");
      if (eq.state === "online") {
        actions.push(["PWR", () => { DC.Network.pwr(state, eq, false); select(null); }]);
        actions.push(["NET", () => { DC.Network.toggleNet(state, eq); }]);
        actions.push(["KVM", () => { DC.KVM.show(state, eq); }]);
        if (eq.fans !== "ok" || eq.psuA === "failed" || eq.psuB === "failed" || (eq.ecc >= 3)) actions.push(["MAINT", () => { eq.busy = { kind: "repair", t: 12 }; DC.Audio.click(); select(null); }]);
        if (eq.runaway) actions.push(["STOP PROCESS", () => { eq.busy = { kind: "stop-proc", t: 5 }; select(null); }]);
        if (eq.diskFull) actions.push(["CLEAR LOGS", () => { eq.busy = { kind: "clear-logs", t: 4 }; select(null); }]);
        if (eq.ecc >= 3) actions.push(["REPLACE DIMM", () => { eq.ecc = 0; DC.Events.prevent(state, "DIMM replaced", 0); select(null); }]);
        if (eq.sec === "suspect") actions.push(["SCAN", () => { eq.busy = { kind: "scan", t: 6 }; select(null); }]);
        if (eq.sec === "spreading" || eq.sec === "infected" || eq.sec === "compromised") {
          actions.push(["QUARANTINE", () => { DC.Security.quarantine(state, eq); select(null); }]);
          actions.push(["REIMAGE", () => { DC.Security.reimage(state, eq); select(null); }]);
        }
        if (eq.backupFailed) actions.push(["RETRY BACKUP", () => { eq.backupFailed = false; DC.Events.resolve(state, eq.id, "backup"); }]);
      } else if (eq.state === "offline" || eq.state === "thermal-shutdown") {
        actions.push(["PWR ON", () => { DC.Network.pwr(state, eq, true); select(null); }]);
      }
      if (eq.state === "shutdown" || eq.busy) actions.push(["(busy...)", null]);
    } else if (eq.type === "storage") {
      html += statRow("MODEL", eq.model);
      html += statRow("RAID", "RAID " + eq.raid);
      const as = DC.Storage.arrayState(eq);
      html += statRow("ARRAY", as.toUpperCase(), as === "ok" ? "g" : as === "degraded" ? "a" : as === "critical" ? "o" : "r");
      html += statRow("CONTROLLER", eq.controller.toUpperCase(), eq.controller === "ok" ? "g" : "r");
      html += '<div class="drives">';
      eq.drives.forEach((d, i) => {
        html += '<div class="drive ' + d.state + '" data-drive="' + i + '" title="Drive ' + (i + 1) + (d.state === "rebuilding" ? " — REBUILD " + Math.round(d.rebuild) + "%" : "") + '"></div>';
      });
      html += "</div>";
      if (eq.rebuild) {
        const d = eq.drives[eq.rebuild.idx];
        html += statRow("REBUILD", Math.round(d.rebuild) + "%", "b");
      }
      if (eq.controller === "fault") {
        actions.push(["RESET CTRL", () => { eq.busy = { kind: "ctrl-reset", t: 8 }; select(null); }]);
        actions.push(["REPLACE CTRL", () => { eq.busy = { kind: "ctrl-replace", t: 16 }; select(null); }]);
      }
    } else if (eq.type === "switch") {
      html += statRow("ROLE", eq.role.toUpperCase());
      html += statRow("PORTS", String(eq.ports));
      html += statRow("STATE", eq.state.toUpperCase(), eq.state === "online" ? "g" : "r");
      if (eq.state === "failed") actions.push(["RESTART", () => { eq.busy = { kind: "restart", t: 10 }; select(null); }]);
    } else if (eq.type === "pdu") {
      html += statRow("LOAD", eq.loadPct + "%", eq.loadPct > 85 ? "a" : "g");
      html += statRow("BREAKER", eq.tripped ? "TRIPPED" : "OK", eq.tripped ? "r" : "g");
      if (eq.tripped) actions.push(["RESET BREAKER", () => { DC.Power.resetBreaker(state, eq); select(null); }]);
    } else if (eq.type === "crac") {
      html += statRow("STATUS", (eq.fault ? "FAULT: " + eq.fault.desc : "OK"), eq.fault ? "r" : "g");
      html += statRow("OUTPUT", Math.round((eq.fault ? 8 : 100)) + "%", eq.fault ? "r" : "g");
      if (eq.fault) actions.push(["REPAIR (" + Math.round(eq.fault.repair) + "s)", () => { eq.busy = { kind: "repair", t: eq.fault.repair }; select(null); }]);
    } else if (eq.type === "ups") {
      html += statRow("CHARGE", Math.round(100 - state.power.upsDischarge) + "%", state.power.upsDischarge > 60 ? "r" : state.power.upsDischarge > 25 ? "a" : "g");
      html += statRow("STATE", state.power.utility === "ok" ? "ONLINE" : "ON BATTERY", state.power.utility === "ok" ? "g" : "a");
    } else if (eq.type === "generator") {
      html += statRow("STATE", eq.state.toUpperCase(), eq.state === "running" ? "g" : eq.state === "fault" ? "r" : "a");
      html += statRow("FUEL", Math.round(eq.fuel) + "%", eq.fuel < 20 ? "r" : "g");
      if (eq.state === "standby" || eq.state === "fault") actions.push(["START", () => { DC.Power.startGenerator(state, eq); select(null); }]);
    }
    body.innerHTML = html;
    body.querySelectorAll(".drive").forEach((dEl) => {
      dEl.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(dEl.getAttribute("data-drive"), 10);
        DC.Storage.replaceDrive(state, eq, idx);
        renderPanel();
      };
    });
    const bar = document.createElement("div");
    bar.className = "actionbar";
    actions.forEach(([label, fn]) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (!fn) { b.disabled = true; }
      else b.onclick = (e) => { e.stopPropagation(); DC.Audio.click(); fn(); };
      bar.appendChild(b);
    });
    if (actions.length) body.appendChild(bar);
  }

  function modal(title, bodyHtml, wide, onOpen) {
    closeModal();
    const root = el("ui-root");
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.id = "modal";
    ov.innerHTML = '<div class="modal' + (wide ? " wide" : "") + '"><div class="m-hdr"><span class="title">' + title + '</span><span class="close" id="modal-x">✕</span></div><div class="m-body" id="modal-body">' + bodyHtml + "</div></div>";
    root.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
    el("modal-x").onclick = closeModal;
    if (onOpen) onOpen(el("modal-body"));
    return el("modal-body");
  }

  function closeModal() { const m = el("modal"); if (m) m.remove(); }
  function modalOpen() { return !!el("modal"); }

  function showHelpdesk() {
    let rows = "";
    for (const svc of state.services) {
      if (svc.openTickets < 0.5 && svc.state === "healthy") continue;
      rows += '<div class="statrow"><span class="k">' + svc.name + '</span><span class="v ' + (svc.openTickets > 20 ? "r" : svc.openTickets > 5 ? "a" : "g") + '">' + Math.floor(svc.openTickets) + "</span></div>";
    }
    if (!rows) rows = "<p style='color:var(--green)'>No open tickets. The helpdesk is quiet... for now.</p>";
    let recent = "";
    for (const r of state.tickets.recent.slice(0, 5)) recent += '<div style="color:var(--dim);padding:2px 0">"' + r + '"</div>';
    modal("HELPDESK", `
      <div class="statrow"><span class="k">OPEN</span><span class="v ${state.tickets.open > 20 ? "r" : state.tickets.open > 5 ? "a" : "g"}">${state.tickets.open}</span></div>
      <div class="statrow"><span class="k">PEAK</span><span class="v">${state.tickets.peak}</span></div>
      <div class="statrow"><span class="k">TOTAL GENERATED</span><span class="v">${Math.floor(state.tickets.stats.total)}</span></div>
      <div class="statrow"><span class="k">RESOLVED</span><span class="v g">${Math.floor(state.tickets.stats.resolved)}</span></div>
      <div class="statrow"><span class="k">PREVENTED</span><span class="v g">${state.tickets.stats.prevented}</span></div>
      <div class="statrow"><span class="k">WORST STORM</span><span class="v">${state.tickets.stats.worst}</span></div>
      <h3 style="color:var(--blue);margin:12px 0 4px;font-size:11px;letter-spacing:1px">BY SERVICE</h3>
      ${rows}
      <h3 style="color:var(--blue);margin:12px 0 4px;font-size:11px;letter-spacing:1px">RECENT</h3>
      ${recent || "<div style='color:var(--dim)'>—</div>"}
    `);
  }

  function showCooling() {
    let rows = "";
    for (const cr of state.coolingUnits) {
      rows += '<div class="optcard"><div class="opt-title">' + cr.name + " — HALL A</div>";
      if (cr.fault) {
        rows += '<div class="opt-line"><span class="k">FAULT</span><span class="v r">' + cr.fault.desc.toUpperCase() + "</span></div>";
        rows += '<div style="margin-top:6px"><button id="crac-fix-' + cr.id + '">REPAIR (' + Math.round(cr.fault.repair) + "s)</button></div>";
      } else if (cr.filterDirty > 0.7) {
        rows += '<div class="opt-line"><span class="k">FILTER</span><span class="v a">DIRTY — clean recommended</span></div>';
        rows += '<div style="margin-top:6px"><button id="crac-fix-' + cr.id + '">CLEAN FILTER</button></div>';
      } else {
        rows += '<div class="opt-line"><span class="k">STATUS</span><span class="v g">NOMINAL</span></div>';
      }
      rows += "</div>";
    }
    const body = modal("COOLING SYSTEM", rows);
    body.querySelectorAll("button[id^=crac-fix]").forEach((b) => {
      b.onclick = () => {
        const id = b.id.replace("crac-fix-", "");
        const cr = state.eqById[id];
        if (cr.fault) cr.busy = { kind: "repair", t: cr.fault.repair };
        else if (cr.filterDirty > 0.7) cr.busy = { kind: "clean", t: 5 };
        closeModal();
        DC.Audio.click();
      };
    });
  }

  function showExpansion() {
    const opts = state.growth.expansionPending || DC.Facility.generateExpansionOptions(state);
    let html = "<p style='color:var(--blue);letter-spacing:1px;margin-bottom:10px'>NEW BUSINESS OPPORTUNITY — DEMAND " + Math.round(state.metrics.demand) + "%</p><p style='margin-bottom:12px'>Select an expansion. The datacenter will grow. So will your problems.</p>";
    opts.forEach((o, i) => {
      html += `<div class="optcard" data-opt="${i}">
        <div class="opt-title">OPTION ${String.fromCharCode(65 + i)} — ${o.key}</div>
        <div class="opt-line"><span class="k">RACKS</span><span>+${o.rackCount}</span></div>
        <div class="opt-line"><span class="k">CUSTOMERS</span><span>+${o.customers.toLocaleString()}</span></div>
        <div class="opt-line"><span class="k">POWER DEMAND</span><span>+${Math.round((o.power - 1) * 100)}%</span></div>
        <div class="opt-line"><span class="k">HEAT</span><span>+${Math.round((o.heat - 1) * 100)}%</span></div>
        <div class="opt-line"><span class="k">WORKLOAD</span><span>${o.flavor}</span></div>
        <div class="opt-line"><span class="k">REPUTATION</span><span class="v g">+${o.repBonus}</span></div>
        <div class="opt-risk">RISK: ${o.risk}</div>
      </div>`;
    });
    const body = modal("EXPANSION AVAILABLE", html, true);
    body.querySelectorAll(".optcard").forEach((card) => {
      card.onclick = () => {
        const i = parseInt(card.getAttribute("data-opt"), 10);
        const o = opts[i];
        const payload = Object.assign({}, o, { crit: o.key === "ENTERPRISE CUSTOMER" ? 1.5 : 1.0 });
        const res = DC.Facility.applyExpansion(state, payload);
        state.growth.expansionPending = null;
        closeModal();
        toast("EXPANSION " + o.key + " — +" + o.rackCount + " racks, +" + o.customers.toLocaleString() + " customers", "good");
        DC.Game.animateExpansion(res.newRacks, res.addLeft);
        DC.Audio.fanfare();
      };
    });
  }

  function showUpgrade() {
    const offers = state.growth.upgradePending;
    let html = "<p style='color:var(--blue);letter-spacing:1px;margin-bottom:10px'>FACILITY UPGRADE AVAILABLE — choose one:</p>";
    offers.forEach((o, i) => {
      html += '<div class="optcard" data-up="' + i + '"><div class="opt-title">' + o.name + "</div><div style='font-size:11px;line-height:1.5'>" + o.desc + (o.risk ? "<div class='opt-risk'>RISK: " + o.risk + "</div>" : "") + "</div></div>";
    });
    const body = modal("UPGRADE AVAILABLE", html, false);
    body.querySelectorAll(".optcard").forEach((card) => {
      card.onclick = () => {
        const o = offers[parseInt(card.getAttribute("data-up"), 10)];
        state.growth.upgradePending = null;
        DC.Growth.applyUpgrade(state, o.key);
        closeModal();
      };
    });
  }

  function showPower() {
    const p = state.power;
    let html = '<div class="statrow"><span class="k">UTILITY</span><span class="v ' + (p.utility === "ok" ? "g" : "r") + '">' + (p.utility === "ok" ? "OK" : "OUT — " + Math.ceil(p.utilityTimer) + "s to restore") + "</span></div>";
    html += '<div class="statrow"><span class="k">LOAD</span><span class="v ' + (state.metrics.powerPct > 90 ? "r" : state.metrics.powerPct > 75 ? "a" : "g") + '">' + state.metrics.powerPct + "%</span></div>";
    if (p.utility !== "ok") html += '<div class="statrow"><span class="k">UPS CHARGE</span><span class="v ' + (p.upsDischarge > 60 ? "r" : "a") + '">' + Math.round(100 - p.upsDischarge) + "%</span></div>";
    html += '<div class="statrow"><span class="k">GENERATOR</span><span class="v ' + (p.generatorRunning ? "g" : "a") + '">' + (p.generatorRunning ? "RUNNING" : state.powerUnits.length ? "STANDBY" : "NOT INSTALLED") + "</span></div>";
    html += "<h3 style='color:var(--blue);margin:12px 0 4px;font-size:11px;letter-spacing:1px'>UNITS</h3>";
    for (const g of state.powerUnits) {
      html += '<div class="optcard"><div class="opt-title">' + g.name + "</div><div class='opt-line'><span class='k'>STATE</span><span class='v " + (g.state === "running" ? "g" : g.state === "fault" ? "r" : "a") + "'>" + g.state.toUpperCase() + '</span></div><div class="opt-line"><span class="k">FUEL</span><span>' + Math.round(g.fuel) + '%</span></div>';
      if (g.state === "standby" || g.state === "fault") html += '<div style="margin-top:6px"><button id="gen-start-' + g.id + '">START GENERATOR</button></div>';
      html += "</div>";
    }
    let tripped = [];
    for (const r of state.racks) for (const e of r.equipment) if (e.type === "pdu" && e.tripped) tripped.push(e);
    if (tripped.length) {
      html += "<h3 style='color:var(--red);margin:12px 0 4px;font-size:11px;letter-spacing:1px'>TRIPPED BREAKERS</h3>";
      for (const t of tripped) html += '<div class="optcard"><div class="opt-title">' + (DC.Util.rackOf(state, t) || { name: "?" }).name + " — BREAKER TRIPPED</div><div style='margin-top:6px'><button id='pdu-reset-" + t.id + "'>RESET BREAKER</button></div></div>";
    }
    const body = modal("POWER SYSTEM", html);
    body.querySelectorAll("button[id^=gen-start]").forEach((b) => {
      b.onclick = () => {
        const g = state.powerUnits.find((x) => x.id === b.id.replace("gen-start-", ""));
        if (g) DC.Power.startGenerator(state, g);
        closeModal();
      };
    });
    body.querySelectorAll("button[id^=pdu-reset]").forEach((b) => {
      b.onclick = () => {
        const pdu = state.eqById[b.id.replace("pdu-reset-", "")];
        if (pdu) DC.Power.resetBreaker(state, pdu);
        closeModal();
      };
    });
  }

  function showHelp() {
    modal("ONLINE HELP", helpContent(), true);
  }

  function helpContent() {
    return `
      <div id="help-content">
      <h3>GETTING STARTED</h3>
      <p>You are the sole operator of a growing datacenter. Keep services online, keep tickets low, keep your reputation high. Success attracts more business — and more datacenter to manage.</p>
      <h3>CONTROLS</h3>
      <ul>
        <li>Drag / middle-drag / A / D / ← → : pan the datacenter</li>
        <li>Mouse wheel or +/- : zoom</li>
        <li>Click equipment in a rack to inspect and control it</li>
        <li>Click alarms (bottom-left) to jump to problems</li>
        <li>SPACE: pause · F1: help</li>
      </ul>
      <h3>HELPDESK</h3>
      <p>Outages generate customer tickets. Longer outages produce tickets faster. Restoring a service clears its tickets. The TICKETS chip opens the helpdesk panel.</p>
      <h3>COMPUTE</h3>
      <p>Servers host services. Watch TEMP (throttling at 65C+, shutdown at 78C+). Use PWR for controlled shutdown/boot, NET to isolate, KVM for the console, MAINT for hardware repairs.</p>
      <h3>STORAGE & RAID</h3>
      <p>Storage arrays hold drives. Yellow = predictive failure (replace before it fails for PREVENTION). Red = failed. Arrays tolerate failures up to their RAID redundancy; extra failures cause DATA LOSS. Blue drives are rebuilding.</p>
      <h3>COOLING</h3>
      <p>CRAC units cool each hall. If cooling capacity is exceeded, everything heats up: throttling, rebuilds slow, then thermal shutdowns. Click the COOLING chip to inspect and repair units.</p>
      <h3>POWER</h3>
      <p>Rack PDUs can trip breakers. Utility failures drain the UPS; start the generator if you have one, or shed load by shutting servers down.</p>
      <h3>SECURITY</h3>
      <p>Suspicious servers can spread malware across their rack. QUARANTINE stops spread but disconnects the server (may impact services). REIMAGE guarantees cleanup.</p>
      <h3>GROWTH</h3>
      <p>Good performance raises REPUTATION, which raises DEMAND. At the threshold you choose an expansion: new racks physically appear and the facility grows. UPGRADES offer permanent facility improvements with tradeoffs.</p>
      <h3>SCORING</h3>
      <p>Score accrues from uptime, customers, and reputation. Preventing failures beats fixing them. Data loss, ticket storms, and outages hurt. If SLA, reputation, or temperature collapse completely, the run ends.</p>
      </div>
    `;
  }

  function showStats(final) {
    const s = state.stats, m = state.metrics;
    const rows = [
      ["RUN SEED", state.seedStr],
      ["UPTIME", DC.Util.fmtUptime(m.uptime)],
      ["SCORE", Math.floor(m.score).toLocaleString()],
      ["SLA", m.sla.toFixed(2) + "%"],
      ["REPUTATION", Math.round(m.rep) + "%"],
      ["FINAL RACKS", String(state.racks.length)],
      ["CUSTOMERS SERVED", m.customers.toLocaleString()],
      ["PEAK CUSTOMERS", state.growth.customersPeak.toLocaleString()],
      ["EXPANSIONS", String(s.expansions)],
      ["UPGRADES", String(s.upgradesInstalled)],
      ["SERVERS REPAIRED", String(s.serversRepaired)],
      ["DRIVES REPLACED", String(s.drivesReplaced)],
      ["ARRAYS SAVED", String(s.arraysSaved)],
      ["DATA LOSS EVENTS", String(s.dataLoss)],
      ["HVAC FAILURES", String(s.hvacFailures)],
      ["POWER INCIDENTS", String(s.powerIncidents)],
      ["SECURITY INCIDENTS", String(s.secIncidents)],
      ["PREVENTIONS", String(s.preventions)],
      ["TOTAL TICKETS", String(Math.floor(state.tickets.stats.total))],
      ["PEAK OPEN TICKETS", String(state.tickets.peak)],
      ["TICKETS PREVENTED", String(state.tickets.stats.prevented)],
      ["CUSTOMER IMPACT TIME", DC.Util.fmtUptime(s.impactTime)],
      ["LONGEST CLEAN STREAK", DC.Util.fmtUptime(s.longestClean)]
    ];
    let html = '<div class="statgrid">';
    for (const [k, v] of rows) html += '<div class="statrow"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
    html += "</div>";
    if (!final) modal("STATISTICS", html, true);
    return html;
  }

  function showAchievements() {
    let html = "";
    for (const a of state.achievements) html += '<div class="ach"><div class="an">' + a.name + '</div><div class="ad">' + a.desc + "</div></div>";
    if (!html) html = "<p style='color:var(--dim)'>No achievements yet this run.</p>";
    modal("ACHIEVEMENTS", html || "—", false);
  }

  function bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (!DC.Game.running()) return;
      if (e.key === "F1") { e.preventDefault(); if (modalOpen()) closeModal(); else showHelp(); }
      if (e.key === "Escape") {
        if (DC.KVM.isOpen()) { DC.KVM.hide(); return; }
        if (modalOpen()) closeModal();
      }
      if (e.key === " " && !modalOpen() && !DC.KVM.isOpen()) { e.preventDefault(); DC.Game.togglePause(); }
    });
  }

  function init(st) {
    state = st;
    build();
    bindKeys();
    DC.Events.on("toast", (s, msg, cls) => toast(msg, cls));
  }

  return {
    init, update, select, toast, showExpansion, showUpgrade, showHelpdesk, showCooling, showPower,
    showHelp, showStats, showAchievements, closeModal, modalOpen, helpContent, setSelected: select
  };
})();
