window.DC = window.DC || {};

DC.KVM = (function () {
  let open = false, srv = null, state = null, timer = null;

  function lines(state, srv) {
    const L = [];
    const roleDef = DC.ROLES[srv.role] || {};
    L.push("DATACENTER KVM :: " + srv.name + "  (" + srv.model + ")");
    L.push("");
    L.push("$ uptime");
    const upDays = Math.floor(state.time / 60);
    L.push(" " + String(upDays).padStart(2, "0") + ":" + String(Math.floor(state.time % 60)).padStart(2, "0") + " up " + Math.floor(srv.age * 365 + upDays) + " days,  1 user,  load average: " + (srv.load / 12).toFixed(2) + " " + (srv.load / 14).toFixed(2) + " " + (srv.load / 16).toFixed(2));
    L.push("");
    L.push("$ taskmon");
    L.push(" PID   TASK                 CPU   MEM");
    const tasks = [
      ["3112", srv.role.toLowerCase().replace(/ /g, "-") + "-worker", Math.round(srv.load), "18%"],
      ["9120", "postgres", Math.round(srv.load * 0.4), "31%"],
      ["7281", "backup-agent", "8", "4%"],
      ["2712", "monitoring", "2", "1%"]
    ];
    if (srv.runaway) tasks.unshift(["6666", srv.runaway, "100", "64%"]);
    for (const t of tasks) L.push(" " + t[0].padEnd(6) + t[1].padEnd(21) + String(t[2]).padStart(3) + "%  " + t[3]);
    L.push("");
    L.push(" TEMP    " + srv.temp.toFixed(1) + "C" + (srv.throttle > 0.1 ? "   ⚠ THERMAL THROTTLING" : ""));
    L.push(" NET RX  " + (Math.random() * 2.4).toFixed(1) + "Gb/s    NET TX  " + (Math.random() * 1.8).toFixed(1) + "Gb/s");
    L.push(" PSU A   " + srv.psuA.toUpperCase() + "     PSU B  " + srv.psuB.toUpperCase() + "   FANS " + srv.fans.toUpperCase());
    L.push(" SEC     " + srv.sec.toUpperCase());
    if (srv.diskFull) L.push(" ⚠ LOG VOLUME FULL — clear logs required");
    if (srv.ecc >= 3) L.push(" ⚠ DIMM FAILURE LIKELY — ECC errors: " + srv.ecc);
    if (srv.backupFailed) L.push(" ⚠ LAST BACKUP: FAILED");
    if (srv.state !== "online") L.push("\n SYSTEM " + srv.state.toUpperCase());
    return L;
  }

  function show(st, server) {
    state = st; srv = server; open = true;
    const root = document.getElementById("ui-root");
    const div = document.createElement("div");
    div.id = "kvm-overlay";
    div.innerHTML = '<div id="kvm"><div class="kvm-close" id="kvm-x">[ X ]</div><div class="kvm-title" id="kvm-title"></div><div class="kvm-out" id="kvm-out"></div><div class="kvm-btns" id="kvm-btns"></div></div>';
    root.appendChild(div);
    document.getElementById("kvm-x").onclick = hide;
    div.addEventListener("click", (e) => { if (e.target === div) hide(); });
    renderLines(true);
  }

  function renderLines(instant) {
    const out = document.getElementById("kvm-out");
    if (!out) return;
    document.getElementById("kvm-title").textContent = "DATACENTER KVM :: " + srv.name;
    out.textContent = lines(state, srv).join("\n");
    const btns = document.getElementById("kvm-btns");
    btns.innerHTML = "";
    if (!srv.busy && srv.state === "online") {
      mkBtn(btns, "$ stop runaway proc", srv.runaway ? () => { srv.busy = { kind: "stop-proc", t: 5 }; DC.Audio.click(); refresh(); } : null);
      mkBtn(btns, "$ clear logs", srv.diskFull ? () => { srv.busy = { kind: "clear-logs", t: 4 }; DC.Audio.click(); refresh(); } : null);
      mkBtn(btns, "$ scan", srv.sec === "suspect" || srv.sec === "infected" ? () => { srv.busy = { kind: "scan", t: 6 }; DC.Audio.click(); refresh(); } : null);
      mkBtn(btns, "$ quarantine", srv.sec === "spreading" || srv.sec === "infected" || srv.sec === "compromised" ? () => { DC.Security.quarantine(state, srv); hide(); } : null);
      mkBtn(btns, "$ reimage", srv.sec === "compromised" || srv.sec === "infected" ? () => { DC.Security.reimage(state, srv); hide(); } : null);
      mkBtn(btns, "$ retry backup", srv.backupFailed ? () => { srv.backupFailed = false; DC.Events.resolve(state, srv.id, "backup"); DC.Audio.click(); refresh(); } : null);
    }
  }

  function mkBtn(btns, label, fn) {
    const b = document.createElement("button");
    b.textContent = label;
    if (!fn) b.disabled = true;
    else b.onclick = fn;
    btns.appendChild(b);
  }

  function refresh() { setTimeout(() => { if (open) { renderLines(); } }, 400); }

  function hide() {
    open = false;
    const el = document.getElementById("kvm-overlay");
    if (el) el.remove();
  }

  return { show, hide, isOpen: () => open };
})();
