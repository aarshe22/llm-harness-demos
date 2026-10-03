window.DC = window.DC || {};

DC.Audio = (function () {
  let ctx = null, master = null, ambient = null, enabled = true, volume = 0.5;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function startAmbient() {
    if (!enabled || !ensure() || ambient) return;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.connect(master);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 58;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 140;
    osc.connect(lp); lp.connect(g);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.03;
    const nlp = ctx.createBiquadFilter(); nlp.type = "lowpass"; nlp.frequency.value = 700;
    noise.connect(nlp); nlp.connect(ng); ng.connect(g);
    osc.start(); noise.start();
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    ambient = { gain: g, osc, noise };
  }

  function stopAmbient() {
    if (ambient && ctx) {
      ambient.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      const a = ambient;
      setTimeout(() => { try { a.osc.stop(); a.noise.stop(); } catch (e) {} }, 600);
      ambient = null;
    }
  }

  function beep(freq, dur, type, vol, when) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function alarm(sev) {
    if (sev === "crit") { beep(880, 0.14); beep(660, 0.14, "square", 0.12, 0.18); }
    else if (sev === "warn") beep(520, 0.12);
    else beep(760, 0.07, "sine", 0.07);
  }
  function good() { beep(620, 0.08, "sine", 0.1); beep(930, 0.1, "sine", 0.1, 0.09); }
  function fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, "triangle", 0.11, i * 0.11));
  }
  function click() { beep(1400, 0.02, "sine", 0.04); }

  function setEnabled(v) { enabled = v; if (v) startAmbient(); else stopAmbient(); }
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }

  return { startAmbient, stopAmbient, beep, alarm, good, fanfare, click, setEnabled, setVolume };
})();
