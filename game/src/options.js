/* World options: data-driven object types, size presets, persistence, settings panel. */

export const OBJECT_TYPES = [
  { id: 'house', label: 'Houses', icon: '🏠', def: 4, max: 10 },
  { id: 'school', label: 'School', icon: '🏫', def: 1, max: 3 },
  { id: 'playground', label: 'Playgrounds', icon: '🛝', def: 2, max: 6 },
  { id: 'mountain', label: 'Mountains', icon: '⛰️', def: 4, max: 8 },
  { id: 'volcano', label: 'Volcanoes', icon: '🌋', def: 1, max: 3 },
  { id: 'tree', label: 'Trees', icon: '🌳', def: 24, max: 60 },
  { id: 'flower', label: 'Flowers', icon: '🌸', def: 90, max: 200 },
  { id: 'deco', label: 'Arch & well', icon: '⛲', def: 1, max: 1 }
];

export const SIZES = [
  { id: 'tiny', label: 'Tiny', half: 22 },
  { id: 'small', label: 'Small', half: 28 },
  { id: 'large', label: 'Large', half: 36 },
  { id: 'huge', label: 'Huge', half: 46 }
];
const MAX_HALF = 46; // hard cap: runaway-memory guard for map size

const LS_KEY = 'maddox-blox-options-v1';

export function sizeHalf(id) {
  const s = SIZES.find((x) => x.id === id) || SIZES[1];
  return Math.min(s.half, MAX_HALF);
}

export function defaultOptions() {
  const counts = {}, enabled = {};
  for (const t of OBJECT_TYPES) { counts[t.id] = t.def; enabled[t.id] = true; }
  return { size: 'small', counts, enabled };
}

export function loadOptions() {
  const o = defaultOptions();
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw || !raw.counts) return o;
    if (SIZES.some((s) => s.id === raw.size)) o.size = raw.size;
    for (const t of OBJECT_TYPES) {
      const c = raw.counts[t.id];
      if (typeof c === 'number' && isFinite(c)) o.counts[t.id] = Math.max(0, Math.min(t.max, Math.round(c)));
      if (typeof raw.enabled[t.id] === 'boolean') o.enabled[t.id] = raw.enabled[t.id];
    }
  } catch (e) { /* corrupted storage: defaults */ }
  return o;
}

export function saveOptions(o) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
}

// Builds the modal DOM. `opts` is mutated live; hooks = { onOpen, onRegen }.
export function buildOptionsPanel(opts, hooks = {}) {
  const el = document.createElement('div');
  el.id = 'options';
  el.innerHTML = `
    <div class="o-card">
      <div class="o-head"><b>World options</b><button class="o-x" title="Close">✕</button></div>
      <label class="o-sec">Map size</label>
      <div class="o-seg">${SIZES.map((s) => `<button data-size="${s.id}">${s.label}</button>`).join('')}</div>
      <label class="o-sec">Objects — count &amp; on/off</label>
      <div class="o-rows"></div>
      <div class="o-note">Changes apply when you regenerate the world.</div>
      <div class="o-actions"><button class="o-regen">♻️ Regenerate world</button></div>
    </div>`;

  const rowsWrap = el.querySelector('.o-rows');
  const syncers = [];
  for (const t of OBJECT_TYPES) {
    const row = document.createElement('div');
    row.className = 'o-row';
    row.innerHTML = `<span class="o-name">${t.icon} ${t.label}</span>
      <input type="range" min="0" max="${t.max}" step="1" aria-label="${t.label} count" />
      <b class="o-val"></b>
      <span class="o-sw"><input type="checkbox" aria-label="${t.label} enabled" /></span>`;
    const range = row.querySelector('input[type=range]');
    const chk = row.querySelector('input[type=checkbox]');
    const val = row.querySelector('.o-val');
    const sync = () => {
      range.value = opts.counts[t.id];
      val.textContent = String(opts.counts[t.id]);
      chk.checked = opts.enabled[t.id];
      row.classList.toggle('off', !opts.enabled[t.id]);
    };
    range.addEventListener('input', () => {
      opts.counts[t.id] = +range.value;
      val.textContent = range.value;
      if (opts.enabled[t.id] && +range.value === 0) { opts.enabled[t.id] = false; }
      else if (+range.value > 0 && !opts.enabled[t.id]) { opts.enabled[t.id] = true; }
      row.classList.toggle('off', !opts.enabled[t.id]);
      chk.checked = opts.enabled[t.id];
    });
    chk.addEventListener('change', () => {
      opts.enabled[t.id] = chk.checked;
      row.classList.toggle('off', !chk.checked);
    });
    rowsWrap.appendChild(row);
    syncers.push(sync);
    sync();
  }

  const segs = [...el.querySelectorAll('.o-seg button')];
  const syncSegs = () => segs.forEach((b) => b.classList.toggle('active', b.dataset.size === opts.size));
  for (const b of segs) b.addEventListener('click', () => { opts.size = b.dataset.size; syncSegs(); });

  const api = {
    el,
    isOpen: false,
    open() {
      api.refresh();
      el.classList.add('open');
      api.isOpen = true;
      if (hooks.onOpen) hooks.onOpen();
    },
    close() {
      el.classList.remove('open');
      api.isOpen = false;
      saveOptions(opts);
    },
    toggle() { if (api.isOpen) api.close(); else api.open(); },
    refresh() { syncSegs(); for (const s of syncers) s(); }
  };

  el.querySelector('.o-x').addEventListener('click', () => api.close());
  el.querySelector('.o-regen').addEventListener('click', () => {
    saveOptions(opts);
    if (hooks.onRegen) hooks.onRegen();
    api.close();
  });
  el.addEventListener('pointerdown', (e) => { if (e.target === el) api.close(); });

  return api;
}
