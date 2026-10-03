window.DC = window.DC || {};

DC.Save = (function () {
  const KEY = "datacenter_save_v1";
  const SETTINGS_KEY = "datacenter_settings_v1";

  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return Object.assign({}, DC.DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DC.DEFAULT_SETTINGS);
  }

  function save(state) {
    if (!state || state.gameOver) return;
    try {
      const slim = JSON.parse(JSON.stringify(state));
      slim.alarms = [];
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (!st || !st.racks) return null;
      st.eqById = {};
      for (const r of st.racks) for (const e of r.equipment) st.eqById[e.id] = e;
      for (const cr of st.coolingUnits || []) st.eqById[cr.id] = cr;
      for (const g of st.powerUnits || []) st.eqById[g.id] = g;
      return st;
    } catch (e) { return null; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  return { save, load, clear, hasSave, saveSettings, loadSettings };
})();
