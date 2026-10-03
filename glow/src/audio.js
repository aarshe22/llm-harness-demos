export function createAudio() {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(hz, dur, vol = 0.06, type = "sine") {
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = hz;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch {
      /* autoplay policy */
    }
  }
  let pad = null;
  function ambience(on, vol = 0.04) {
    const c = ac();
    if (on && !pad) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = 62;
      g.gain.value = vol;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      pad = { o, g };
    }
    if (!on && pad) {
      pad.o.stop();
      pad = null;
    }
    if (pad) pad.g.gain.value = vol;
  }
  return {
    unlock: () => {
      ac();
      ambience(true);
    },
    setMaster: (v) => {
      if (pad) pad.g.gain.value = 0.04 * v;
    },
    chime: () => tone(880 + Math.random() * 200, 0.12, 0.05, "triangle"),
    danger: () => tone(80, 0.4, 0.1, "sawtooth"),
    hoot: () => tone(140, 0.45, 0.07, "sine"),
    flutter: () => tone(190, 0.04, 0.02, "sine"),
    near: () => tone(520, 0.08, 0.05, "square"),
  };
}
