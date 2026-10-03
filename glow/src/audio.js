export function fillBrown(data) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    data[i] = last;
  }
  return data;
}

/** Cricket-like pulse train: high-rate pulses with slow chorus swells. */
export function fillCricketBed(data, sampleRate) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.78 + (Math.random() * 2 - 1) * 0.22;
    const t = i / sampleRate;
    const pulse = Math.max(0, Math.sin(t * 26 * Math.PI * 2));
    const pulse2 = Math.max(0, Math.sin(t * 31.4 * Math.PI * 2 + 1.7));
    const swell = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.23 * Math.PI * 2));
    data[i] = last * (Math.pow(pulse, 10) * 0.7 + Math.pow(pulse2, 12) * 0.5) * swell;
  }
  return data;
}

export function createAudio() {
  let ctx = null;
  let master = 0.85;
  let ambOut = null;
  let started = false;
  let nextChirp = 0.4;
  let nextFrog = 2.2;
  let nextOwl = 7;
  let nextRustle = 1.5;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(hz, dur, vol = 0.06, type = "sine", slide = 0) {
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(hz, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, hz + slide), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * master), c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    } catch {
      /* autoplay */
    }
  }

  function bufferFrom(seconds, fill) {
    const c = ac();
    const n = Math.max(1, Math.floor(c.sampleRate * seconds));
    const buf = c.createBuffer(1, n, c.sampleRate);
    fill(buf.getChannelData(0), c.sampleRate);
    return buf;
  }

  function loopNoise(buf, dest, gainVal, filterType, freq, q = 1) {
    const c = ac();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.value = gainVal;
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start();
    return { src, g, filt };
  }

  function lfoGain(target, rate, depth, offset) {
    const c = ac();
    target.gain.value = offset;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = rate;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target.gain);
    o.start();
    return o;
  }

  function startLayers() {
    if (started) return;
    started = true;
    const c = ac();
    ambOut = c.createGain();
    ambOut.gain.value = 0.22 * master;
    ambOut.connect(c.destination);

    const pad1 = c.createOscillator();
    pad1.type = "sine";
    pad1.frequency.value = 55;
    const pad2 = c.createOscillator();
    pad2.type = "triangle";
    pad2.frequency.value = 82.4;
    const pad3 = c.createOscillator();
    pad3.type = "sine";
    pad3.frequency.value = 110;
    const pf = c.createBiquadFilter();
    pf.type = "lowpass";
    pf.frequency.value = 220;
    const pg = c.createGain();
    pg.gain.value = 0.22;
    pad1.connect(pf);
    pad2.connect(pf);
    pad3.connect(pf);
    pf.connect(pg);
    pg.connect(ambOut);
    pad1.start();
    pad2.start();
    pad3.start();

    const brown = bufferFrom(4, fillBrown);
    const windSrc = c.createBufferSource();
    windSrc.buffer = brown;
    windSrc.loop = true;
    const windHp = c.createBiquadFilter();
    windHp.type = "highpass";
    windHp.frequency.value = 160;
    const windLp = c.createBiquadFilter();
    windLp.type = "lowpass";
    windLp.frequency.value = 900;
    const windG = c.createGain();
    windG.gain.value = 0.42;
    windSrc.connect(windHp);
    windHp.connect(windLp);
    windLp.connect(windG);
    windG.connect(ambOut);
    windSrc.start();
    lfoGain(windG, 0.06, 0.14, 0.42);

    const rustle = loopNoise(brown, ambOut, 0.12, "bandpass", 1400, 0.8);
    lfoGain(rustle.g, 0.11, 0.06, 0.12);

    const cricketBuf = bufferFrom(6, fillCricketBed);
    const cr1 = loopNoise(cricketBuf, ambOut, 0.28, "bandpass", 4200, 6);
    const cr2 = loopNoise(cricketBuf, ambOut, 0.16, "bandpass", 5600, 8);
    cr2.src.playbackRate.value = 1.17;
    lfoGain(cr1.g, 0.04, 0.08, 0.28);
    lfoGain(cr2.g, 0.07, 0.05, 0.16);
  }

  function chirp() {
    tone(2400 + Math.random() * 900, 0.035, 0.01, "square");
  }

  function frog() {
    const hz = 310 + Math.random() * 90;
    tone(hz, 0.12, 0.018, "sine", -80);
    tone(hz * 0.72, 0.16, 0.01, "triangle", -40);
  }

  function distantOwl() {
    tone(118 + Math.random() * 18, 0.42, 0.028, "sine", -22);
    tone(88, 0.55, 0.016, "triangle", -12);
  }

  function leafBurst() {
    tone(180 + Math.random() * 80, 0.18, 0.008, "triangle", -60);
  }

  function tick(dt) {
    if (!started) return;
    nextChirp -= dt;
    nextFrog -= dt;
    nextOwl -= dt;
    nextRustle -= dt;
    if (nextChirp <= 0) {
      chirp();
      if (Math.random() < 0.55) chirp();
      nextChirp = 0.18 + Math.random() * 0.7;
    }
    if (nextFrog <= 0) {
      frog();
      if (Math.random() < 0.35) frog();
      nextFrog = 2.4 + Math.random() * 5.5;
    }
    if (nextOwl <= 0) {
      distantOwl();
      nextOwl = 9 + Math.random() * 16;
    }
    if (nextRustle <= 0) {
      leafBurst();
      nextRustle = 3 + Math.random() * 7;
    }
  }

  return {
    unlock: () => {
      try {
        ac();
        startLayers();
      } catch {
        /* headless / autoplay */
      }
    },
    tick,
    setMaster: (v) => {
      master = v;
      if (ambOut) ambOut.gain.value = 0.22 * master;
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
    started: () => started,
  };
}
