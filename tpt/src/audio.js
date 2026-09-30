const m = (n) => 440 * Math.pow(2, (n - 69) / 12);

const FM_PRESETS = {
  bass: { car: 'square', mod: 'sine', ratio: 1, index: 3.2, decay: 0.5, sustain: 0.12 },
  keys: { car: 'sine', mod: 'sine', ratio: 1, index: 1.8, decay: 0.35, sustain: 0.05 },
  lead: { car: 'sawtooth', mod: 'sine', ratio: 1, index: 4.5, decay: 0.7, sustain: 0.35 },
  blip: { car: 'square', mod: 'sine', ratio: 2, index: 1.2, decay: 0.4, sustain: 0.02 },
  brassy: { car: 'square', mod: 'sine', ratio: 2, index: 2.6, decay: 0.6, sustain: 0.25 }
};

const TRACKS = {
  lounge: {
    bpm: 100,
    bass: [45, 0, 52, 0, 41, 0, 48, 0, 48, 0, 55, 0, 43, 0, 55, 0],
    arp: [60, 64, 67, 64, 60, 65, 69, 65, 64, 67, 72, 67, 59, 62, 67, 62],
    lead: [76, 0, 0, 0, 72, 0, 0, 0, 76, 0, 79, 0, 76, 0, 0, 0],
    hat: true
  },
  vip: {
    bpm: 90,
    bass: [38, 0, 45, 0, 46, 0, 53, 0, 43, 0, 50, 0, 40, 0, 47, 0],
    arp: [62, 65, 69, 65, 58, 62, 65, 62, 55, 58, 62, 58, 61, 64, 68, 64],
    lead: [74, 0, 0, 72, 0, 0, 69, 0, 0, 0, 65, 0, 68, 0, 0, 0],
    hat: true
  },
  casino: {
    bpm: 122,
    bass: [48, 52, 55, 60, 59, 55, 52, 48, 53, 57, 60, 57, 55, 59, 62, 55],
    arp: [64, 67, 72, 67, 65, 69, 72, 69, 67, 72, 76, 72, 66, 71, 74, 71],
    lead: [0, 0, 79, 0, 76, 0, 0, 0, 81, 0, 79, 0, 76, 0, 74, 0],
    hat: true
  },
  ship: {
    bpm: 92,
    bass: [41, 0, 0, 46, 0, 0, 49, 0, 0, 48, 0, 0, 45, 0, 0, 41],
    arp: [60, 0, 65, 0, 60, 0, 64, 0, 60, 0, 64, 0, 59, 0, 62, 0],
    lead: [72, 0, 0, 74, 0, 0, 76, 0, 0, 0, 72, 0, 0, 0, 0, 0],
    hat: true
  },
  spa: {
    bpm: 66,
    bass: [38, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0],
    arp: [62, 0, 0, 65, 0, 0, 69, 0, 0, 0, 74, 0, 69, 0, 65, 0],
    lead: [74, 0, 0, 0, 0, 0, 0, 0, 81, 0, 0, 0, 0, 0, 0, 0],
    hat: false
  },
  space: {
    bpm: 132,
    bass: [40, 0, 40, 0, 43, 0, 43, 0, 45, 0, 45, 0, 40, 0, 40, 0],
    arp: [64, 67, 71, 76, 71, 67, 71, 76, 67, 71, 76, 79, 76, 71, 67, 64],
    lead: [0, 0, 0, 0, 0, 0, 0, 0, 83, 0, 0, 0, 81, 0, 0, 0],
    hat: true
  }
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.trackName = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.3;
      this.sfxGain.connect(this.master);
      this.noise = this._makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise() {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  fm(t, freq, dur, preset, vol, dest) {
    const car = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    const p = FM_PRESETS[preset] || FM_PRESETS.keys;
    car.type = p.car;
    mod.type = p.mod;
    car.frequency.setValueAtTime(freq, t);
    mod.frequency.setValueAtTime(freq * p.ratio, t);

    const depth = freq * p.index;
    modGain.gain.setValueAtTime(depth, t);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, depth * p.sustain), t + dur * p.decay);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * p.sustain), t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    mod.connect(modGain);
    modGain.connect(car.frequency);
    car.connect(env);
    env.connect(dest || this.sfxGain);
    mod.start(t);
    car.start(t);
    mod.stop(t + dur + 0.05);
    car.stop(t + dur + 0.05);
  }

  hat(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t);
    src.stop(t + 0.05);
  }

  setTrack(name) {
    this.ensure();
    if (this.trackName === name) return;
    this.trackName = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    clearInterval(this.timer);
    if (!this.musicOn) return;
    const track = TRACKS[name];
    if (!track) return;
    const stepDur = 60 / track.bpm / 4;
    this.timer = setInterval(() => {
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        this._playStep(track, this.step, this.nextTime);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % 16;
      }
    }, 25);
  }

  _playStep(track, s, t) {
    const b = track.bass[s];
    if (b) this.fm(t, m(b), 0.26, 'bass', 0.6, this.musicGain);
    const a = track.arp[s];
    if (a) this.fm(t, m(a), 0.13, 'keys', 0.24, this.musicGain);
    const l = track.lead[s];
    if (l) this.fm(t, m(l), 0.34, 'lead', 0.5, this.musicGain);
    if (track.hat && s % 2 === 1) this.hat(t);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
  }

  toggleMusic() {
    this.ensure();
    this.musicOn = !this.musicOn;
    if (!this.musicOn) {
      clearInterval(this.timer);
      this.timer = null;
    } else if (this.trackName) {
      const n = this.trackName;
      this.trackName = null;
      this.setTrack(n);
    }
    return this.musicOn;
  }

  blip() {
    if (!this.ctx) return;
    this.fm(this.ctx.currentTime, 660, 0.03, 'blip', 0.05);
  }

  select() {
    if (!this.ctx) return;
    this.fm(this.ctx.currentTime, 880, 0.07, 'blip', 0.1);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fm(t, m(84), 0.08, 'brassy', 0.22);
    this.fm(t + 0.06, m(91), 0.1, 'brassy', 0.22);
  }

  miss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fm(t, m(55), 0.25, 'brassy', 0.2);
    this.fm(t + 0.12, m(52), 0.3, 'brassy', 0.18);
  }

  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fm(t, m(91), 0.06, 'blip', 0.12);
    this.fm(t + 0.06, m(96), 0.14, 'blip', 0.12);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [65, 69, 72, 76, 84].forEach((n, i) => {
      this.fm(t + i * 0.12, m(n), 0.18, 'brassy', 0.2);
      this.fm(t + i * 0.12, m(n - 12), 0.18, 'bass', 0.14);
    });
  }

  lose() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [64, 60, 57, 53].forEach((n, i) => {
      this.fm(t + i * 0.14, m(n), 0.2, 'brassy', 0.16);
    });
  }
}
