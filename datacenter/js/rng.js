window.DC = window.DC || {};

DC.Rng = (function () {
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function make(seed) {
    if (typeof seed === "string") seed = hashSeed(seed);
    if (!seed || seed <= 0) seed = (Math.random() * 0xffffffff) >>> 0 || 1;
    const next = mulberry32(seed);
    const api = {
      seed: seed,
      seedStr: seed.toString(16).toUpperCase().padStart(8, "0"),
      next: next,
      f: (a, b) => a + next() * (b - a),
      i: (a, b) => Math.floor(a + next() * (b - a + 1)),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      pickW: (arr, wfn) => {
        let total = 0; const ws = arr.map((x) => { const w = Math.max(0.0001, wfn(x)); total += w; return w; });
        let r = next() * total;
        for (let k = 0; k < arr.length; k++) { r -= ws[k]; if (r <= 0) return arr[k]; }
        return arr[arr.length - 1];
      },
      shuffle: (arr) => {
        const a = arr.slice();
        for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(next() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
        return a;
      }
    };
    return api;
  }
  return { make, hashSeed };
})();
