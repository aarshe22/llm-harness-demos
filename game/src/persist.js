/* Persistent world damage log, keyed by preset + options signature.
   A world regenerates by bumping its salt (fresh sig-independent state), so
   reload replays damage onto the deterministic layout; regenerate resets it. */
const KEY = 'maddox-blox-world-v1';

export function sigOf(opts) {
  const c = opts.counts, e = opts.enabled;
  const parts = [opts.size];
  for (const k of Object.keys(c).sort()) parts.push(`${k}=${c[k]}${e[k] ? '1' : '0'}`);
  let h = 0;
  const s = parts.join(';');
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function loadAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    return all && typeof all === 'object' ? all : {};
  } catch (e) { return {}; }
}

export function getState(sizeId, sig) {
  const e = loadAll()[sizeId];
  if (!e || e.sig !== sig || typeof e.salt !== 'number') return null;
  return e;
}

export function setState(sizeId, state) {
  try {
    const all = loadAll();
    all[sizeId] = { ...state, entries: (state.entries || []).slice(-900) };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { /* private mode */ }
}

export function clearState(sizeId) {
  try {
    const all = loadAll();
    delete all[sizeId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { /* ignore */ }
}
