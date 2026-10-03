export function createAudio() {
  let ctx = null;
  let master = 0.85;
  const nodes = [];

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
      g.gain.setValueAtTime(vol * master, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch {
      /* autoplay */
    }
  }

  function noiseBuffer(seconds) {
    const c = ac();
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last;
    }
    return buf;
  }

  let started = false;
  function startLayers() {
    if (started) return;
    started = true;
    const c = ac();
    const out = c.createGain();
    out.gain.value = 0.045 * master;
    out.connect(c.destination);

    const pad1 = c.createOscillator();
    pad1.type = "sine";
    pad1.frequency.value = 58;
    const pad2 = c.createOscillator();
    pad2.type = "triangle";
    pad2.frequency.value = 87.5;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 240;
    pad1.connect(filt);
    pad2.connect(filt);
    filt.connect(out);
    pad1.start();
    pad2.start();

    const wind = c.createBufferSource();
    wind.buffer = noiseBuffer(3);
    wind.loop = true;
    const wg = c.createGain();
    wg.gain.value = 0.35;
    const wf = c.createBiquadFilter();
    wf.type = "highpass";
    wf.frequency.value = 180;
    wind.connect(wf);
    wf.connect(wg);
    wg.connect(out);
    wind.start();

    nodes.push(out, pad1, pad2, wind);
    startLayers._out = out;
  }

  function chirp() {
    tone(1400 + Math.random() * 400, 0.04, 0.012, "square");
  }

  return {
    unlock: () => {
      ac();
      startLayers();
    },
    setMaster: (v) => {
      master = v;
      if (startLayers._out) startLayers._out.gain.value = 0.045 * master;
    },
    chime: () => {
      tone(880 + Math.random() * 160, 0.14, 0.05, "triangle");
      tone(1320, 0.1, 0.02, "sine");
    },
    danger: () => tone(72, 0.45, 0.11, "sawtooth"),
    hoot: () => {
      tone(128, 0.35, 0.07, "sine");
      tone(96, 0.5, 0.04, "triangle");
    },
    flutter: () => tone(190 + Math.random() * 40, 0.05, 0.018, "sine"),
    near: () => tone(540, 0.09, 0.05, "square"),
    insect: chirp,
  };
}
