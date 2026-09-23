/* World options: data-driven object types, size presets, persistence, settings panel. */

export const OBJECT_TYPES = [
  { id: 'house', label: 'Houses', icon: '🏠', def: 4, max: 20 },
  { id: 'school', label: 'School', icon: '🏫', def: 1, max: 3 },
  { id: 'church', label: 'Churches', icon: '⛪', def: 1, max: 4 },
  { id: 'store', label: 'Convenience stores', icon: '🏪', def: 1, max: 4 },
  { id: 'playground', label: 'Playgrounds', icon: '🛝', def: 2, max: 6 },
  { id: 'mountain', label: 'Mountains', icon: '⛰️', def: 4, max: 8 },
  { id: 'volcano', label: 'Volcanoes', icon: '🌋', def: 1, max: 3 },
  { id: 'tree', label: 'Trees', icon: '🌳', def: 24, max: 60 },
  { id: 'flower', label: 'Flowers', icon: '🌸', def: 90, max: 200 },
  { id: 'deco', label: 'Arch & well', icon: '⛲', def: 1, max: 1 }
];

/* Each preset changes the real playable half-extent (half) AND the generation
   capacity multipliers: towns (extra villages), rural hamlets, farms,
   collectible spots, trees. `zones` = distinct terrain zones the world carves.
   The 400% expansion: every step of the ladder doubled its linear extent
   (4x the classic playable area), applied evenly across Tiny..Huge. Capacity
   fields scale with the new land so distribution improves, not dilutes:
   trees/flowers are absolute count multipliers, spots scale the collectible
   budget (40 * spots). */
export const SIZES = [
  { id: 'tiny', label: 'Tiny', half: 44, towns: 0, rural: 0, farms: 0, spots: 0.9, trees: 0.6, flowers: 1.2, zones: 1, train: 0 },
  { id: 'small', label: 'Small', half: 60, towns: 2, rural: 2, farms: 3, spots: 1.8, trees: 2.0, flowers: 2.5, zones: 3, train: 0 },
  { id: 'large', label: 'Large', half: 96, towns: 5, rural: 5, farms: 7, spots: 3.0, trees: 4.0, flowers: 4.2, zones: 5, train: 1 },
  { id: 'huge', label: 'Huge', half: 144, towns: 10, rural: 8, farms: 12, spots: 4.4, trees: 7.0, flowers: 6.5, zones: 6, train: 1 }
];
const MAX_HALF = 160; // hard cap: runaway-memory guard for map size

const LS_KEY = 'maddox-blox-options-v1';

export function sizeHalf(id) {
  const s = SIZES.find((x) => x.id === id) || SIZES[1];
  return Math.min(s.half, MAX_HALF);
}

export function sizePreset(id) {
  return SIZES.find((x) => x.id === id) || SIZES[1];
}

export function defaultOptions() {
  const counts = {}, enabled = {};
  for (const t of OBJECT_TYPES) { counts[t.id] = t.def; enabled[t.id] = true; }
  return { size: 'large', counts, enabled, sound: true, debug: false };
}

export function loadOptions() {
  const o = defaultOptions();
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw || !raw.counts) return o;
    if (SIZES.some((s) => s.id === raw.size)) o.size = raw.size;
    if (typeof raw.sound === 'boolean') o.sound = raw.sound;
    if (typeof raw.debug === 'boolean') o.debug = raw.debug;
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
      <label class="o-sec">Sound &amp; voice</label>
      <div class="o-row o-toggles">
        <button class="o-toggle o-snd" title="Read aloud weapon, block and weather selections; click to mute everything"></button>
      </div>
      <label class="o-sec">Developer</label>
      <div class="o-row o-toggles">
        <button class="o-toggle o-dbg" title="Logs player physics frames to find fall-through bugs"></button>
        <button class="o-copy" title="Copy all captured debug rows to the clipboard">📋 Copy debug log</button>
      </div>
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

  /* Sound/voice + fall-debug toggles take effect immediately (no regen), and
     persist with the rest of the options. */
  const sndBtn = el.querySelector('.o-snd');
  const dbgBtn = el.querySelector('.o-dbg');
  const copyBtn = el.querySelector('.o-copy');
  const syncSound = () => {
    sndBtn.classList.toggle('on', !!opts.sound);
    sndBtn.textContent = opts.sound ? '🔊 Sound & voice: on' : '🔇 Sound & voice: muted';
  };
  const syncDebug = () => {
    dbgBtn.classList.toggle('on', !!opts.debug);
    dbgBtn.textContent = opts.debug ? '🐞 Fall-debug logging: ON' : '🐞 Fall-debug logging: off';
  };
  sndBtn.addEventListener('click', () => {
    opts.sound = !opts.sound;
    syncSound();
    saveOptions(opts);
    if (hooks.onSound) hooks.onSound(opts.sound);
  });
  dbgBtn.addEventListener('click', () => {
    opts.debug = !opts.debug;
    syncDebug();
    saveOptions(opts);
    if (hooks.onDebug) hooks.onDebug(opts.debug);
  });
  copyBtn.addEventListener('click', () => {
    const msg = window.DBG ? window.DBG.dump() : 'no logger';
    copyBtn.textContent = '✅ copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy debug log'; }, 2000);
    if (console && console.log) console.log(`[dbg] ${msg}`);
  });
  syncSound();
  syncDebug();

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
    refresh() { syncSegs(); for (const s of syncers) s(); syncSound(); syncDebug(); },
    syncDebug() { syncDebug(); }
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
