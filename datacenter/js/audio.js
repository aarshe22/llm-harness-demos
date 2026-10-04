window.DC = window.DC || {};

DC.Audio = (function () {
  let ctx = null, master = null, ambient = null, enabled = true, volume = 0.5;

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function unlock() {
    if (ensure() && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  }
  // first user gesture resumes a suspended context (autoplay policy)
  try {
    document.addEventListener("pointerdown", unlock, { once: false });
    document.addEventListener("keydown", unlock, { once: false });
  } catch (e) {}

  function startAmbient() {
    if (!enabled || !ensure()) return;
    if (ambient) { if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} } return; }
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.connect(master);
    // deep transformer hum (58Hz saw + 116Hz sine overtone)
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 58;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 140;
    osc.connect(lp); lp.connect(g);
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 116;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    osc2.connect(g2); g2.connect(lp);
    // AC / airflow whoosh: filtered noise, slowly breathing via LFO
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.03;
    const nlp = ctx.createBiquadFilter(); nlp.type = "lowpass"; nlp.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.012;
    lfo.connect(lfoG); lfoG.connect(ng.gain);
    noise.connect(nlp); nlp.connect(ng); ng.connect(g);
    // subtle electrical buzz layer
    const buzz = ctx.createOscillator(); buzz.type = "square"; buzz.frequency.value = 174;
    const bg = ctx.createGain(); bg.gain.value = 0.006;
    const blp = ctx.createBiquadFilter(); blp.type = "lowpass"; blp.frequency.value = 500;
    buzz.connect(blp); blp.connect(bg); bg.connect(g);
    osc.start(); osc2.start(); noise.start(); lfo.start(); buzz.start();
    g.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 3);
    ambient = { gain: g, osc, osc2, noise, lfo, buzz };
  }

  function stopAmbient() {
    if (ambient && ctx) {
      ambient.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      const a = ambient;
      setTimeout(() => { try { a.osc.stop(); a.osc2.stop(); a.noise.stop(); a.lfo.stop(); a.buzz.stop(); } catch (e) {} }, 600);
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

  // descending saw buzz: power loss / UPS / generator
  function powerCrit() {
    beep(180, 0.5, "sawtooth", 0.16);
    beep(120, 0.6, "sawtooth", 0.14, 0.45);
  }

  // rising siren sweep: thermal
  function thermalCrit() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(500, t);
    o.frequency.linearRampToValueAtTime(1100, t + 0.5);
    o.frequency.linearRampToValueAtTime(500, t + 1.0);
    g.gain.setValueAtTime(0.1, t);
    g.gain.setValueAtTime(0.1, t + 0.9);
    g.gain.linearRampToValueAtTime(0.001, t + 1.05);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.1);
  }

  // harsh rapid pulse: security breach
  function secCrit() {
    for (let i = 0; i < 6; i++) beep(1400, 0.05, "sawtooth", 0.12, i * 0.09);
  }

  // low double-thud: data loss
  function dataCrit() {
    beep(90, 0.35, "triangle", 0.2);
    beep(70, 0.5, "triangle", 0.18, 0.3);
    beep(196, 0.4, "sawtooth", 0.1, 0.15);
  }

  // high double chirp: storage
  function storCrit() {
    beep(1560, 0.09, "square", 0.12);
    beep(1560, 0.09, "square", 0.12, 0.16);
    beep(780, 0.25, "square", 0.1, 0.34);
  }

  function alarm(sev, msg) {
    if (sev === "crit") {
      const m = (msg || "").toUpperCase();
      if (m.indexOf("THERMAL") !== -1 || m.indexOf(" HOT") !== -1) thermalCrit();
      else if (m.indexOf("POWER") !== -1 || m.indexOf("UPS") !== -1 || m.indexOf("GENERATOR") !== -1 || m.indexOf("BLACKOUT") !== -1 || m.indexOf("MAINS") !== -1) powerCrit();
      else if (m.indexOf("SECURITY") !== -1 || m.indexOf("COMPROMIS") !== -1 || m.indexOf("MALWARE") !== -1 || m.indexOf("INTRUSION") !== -1) secCrit();
      else if (m.indexOf("DATA LOSS") !== -1 || m.indexOf("ARRAY") !== -1) dataCrit();
      else if (m.indexOf("DRIVE") !== -1 || m.indexOf("STOR") !== -1 || m.indexOf("DISK") !== -1) storCrit();
      else { beep(880, 0.14); beep(660, 0.14, "square", 0.12, 0.18); }
    } else if (sev === "warn") { beep(520, 0.12); }
    else beep(760, 0.07, "sine", 0.07);
  }

  // garbled 2s lo-fi telephone voice: vowel-ish formant syllables in a 300-3400Hz band + crackle
  function ticketVoice() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime, dur = 2.0;
    const nSyl = 6 + Math.floor(Math.random() * 3);
    const vowels = [700, 1200, 900, 1400, 600, 1100, 800];
    // carrier: buzzy glottal source, pitch wobbles per syllable
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    const pitch = 100 + Math.random() * 50;
    src.frequency.setValueAtTime(pitch, t);
    const env = ctx.createGain(); env.gain.value = 0;
    // telephone band: highpass + lowpass
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 300;
    const lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 3400;
    // formant filter sweeps per syllable
    const fm = ctx.createBiquadFilter(); fm.type = "bandpass"; fm.Q.value = 2.2;
    fm.frequency.setValueAtTime(vowels[0], t);
    for (let i = 0; i < nSyl; i++) {
      const st = t + (i / nSyl) * dur * 0.96;
      const len = dur / nSyl * 0.62;
      src.frequency.setValueAtTime(pitch * (0.8 + Math.random() * 0.5), st);
      fm.frequency.setValueAtTime(vowels[Math.floor(Math.random() * vowels.length)], st);
      env.gain.setValueAtTime(0.0001, st);
      env.gain.linearRampToValueAtTime(0.32, st + 0.025);
      env.gain.linearRampToValueAtTime(0.14, st + len * 0.6);
      env.gain.linearRampToValueAtTime(0.0001, st + len);
    }
    src.connect(fm); fm.connect(env); env.connect(hp); hp.connect(lp2); lp2.connect(master);
    // line crackle + hiss
    const nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (Math.random() < 0.015 ? 0.7 : 0.05);
    const noise = ctx.createBufferSource(); noise.buffer = nbuf;
    const ng = ctx.createGain(); ng.gain.value = 0.06;
    const nhp = ctx.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 800;
    noise.connect(nhp); nhp.connect(ng); ng.connect(lp2);
    // ring-through blip at head, like the line picking up
    beep(1100, 0.05, "sine", 0.08);
    src.start(t + 0.12); src.stop(t + dur);
    noise.start(t); noise.stop(t + dur);
  }

  function good() { beep(620, 0.08, "sine", 0.1); beep(930, 0.1, "sine", 0.1, 0.09); }
  function fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, "triangle", 0.11, i * 0.11));
  }
  function click() { beep(1400, 0.02, "sine", 0.04); }

  function setEnabled(v) { enabled = v; if (v) startAmbient(); else stopAmbient(); }
  function setVolume(v) {
    if (typeof v !== "number" || isNaN(v)) v = 0.5;
    if (v > 1) v = v / 100;
    volume = DC.Util ? DC.Util.clamp(v, 0, 1) : Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  }

  // Dave's hammer thud: low square punch + body knock
  function workHit() {
    beep(110, 0.09, "square", 0.32);
    beep(68, 0.16, "triangle", 0.24, 0.012);
  }

  // saw rasp: descending toothy bursts
  function workSaw() {
    for (let i = 0; i < 3; i++) beep(820 - i * 110, 0.06, "sawtooth", 0.18, i * 0.055);
  }

  // task finished: rising ratchet + zip
  function workDone() {
    beep(520, 0.06, "square", 0.2);
    beep(760, 0.06, "square", 0.2, 0.08);
    beep(1040, 0.1, "square", 0.22, 0.16);
    for (let i = 0; i < 4; i++) beep(1500 + i * 140, 0.03, "sawtooth", 0.12, 0.3 + i * 0.035);
  }

  return { startAmbient, stopAmbient, beep, alarm, ticketVoice, good, fanfare, click, workHit, workSaw, workDone, setEnabled, setVolume, unlock };
})();
