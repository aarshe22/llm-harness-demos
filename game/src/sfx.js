/* Synthesized sound kit (WebAudio, zero assets): one-shots + named loops. */

class Sfx {
  constructor() { this.ac = null; this.master = null; this._loops = new Map(); this._flame = null; }
  ensure() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') this.ac.resume();
    return true;
  }
  _noiseBuf() {
    if (!this._nb) {
      const n = this.ac.sampleRate * 1.5;
      this._nb = this.ac.createBuffer(1, n, this.ac.sampleRate);
      const d = this._nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return this._nb;
  }
  _env(g, t0, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.06, dur));
  }
  _noise(t0, dur, peak, f0, f1, type = 'lowpass', q = 1) {
    const src = this.ac.createBufferSource(); src.buffer = this._noiseBuf(); src.loop = true;
    const flt = this.ac.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(30, f0), t0);
    if (f1) flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = this.ac.createGain(); this._env(g, t0, peak, dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }
  _tone(t0, dur, peak, type, f0, f1) {
    const o = this.ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ac.createGain(); this._env(g, t0, peak, dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  /* ---------------- one-shots ---------------- */
  place()    { if (this.ensure()) { const t = this.ac.currentTime; this._tone(t, 0.07, 0.22, 'square', 620, 900); this._noise(t, 0.05, 0.1, 2500, 900, 'highpass'); } }
  swap()     { if (this.ensure()) { const t = this.ac.currentTime; this._tone(t, 0.06, 0.2, 'square', 700, 1200); this._tone(t + 0.05, 0.06, 0.16, 'square', 900, 1500); } }
  sword()    { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 0.16, 0.5, 3800, 600, 'bandpass', 2); } }
  hammer()   { if (this.ensure()) { const t = this.ac.currentTime; this._tone(t, 0.14, 0.6, 'square', 320, 70); this._noise(t, 0.2, 0.7, 1500, 200); } }
  fireTick() { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 0.09, 0.12, 900, 300); } }
  launch()   { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 0.45, 0.5, 500, 2600, 'bandpass', 1.5); this._tone(t, 0.4, 0.3, 'sawtooth', 180, 60); } }
  explode()  { if (this.ensure()) { const t = this.ac.currentTime;
    this._noise(t, 0.85, 1.0, 2200, 60); this._tone(t, 0.5, 0.9, 'sine', 120, 30); this._noise(t, 0.25, 0.5, 5000, 800, 'highpass'); } }
  crack()    { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 0.12, 0.35, 2600, 900, 'highpass'); } }
  thud()     { if (this.ensure()) { const t = this.ac.currentTime; this._tone(t, 0.2, 0.5, 'sine', 90, 40); this._noise(t, 0.15, 0.3, 800, 150); } }
  hurt()     { if (this.ensure()) { const t = this.ac.currentTime; this._tone(t, 0.18, 0.32, 'square', 440, 130); } }
  destroy()  { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 0.6, 0.8, 1800, 120); this._tone(t, 0.35, 0.6, 'sine', 150, 45); } }
  thunder()  { if (this.ensure()) { const t = this.ac.currentTime;
    this._noise(t, 1.6, 0.85, 900, 40); this._tone(t, 1.2, 0.7, 'sine', 70, 28); this._noise(t + 0.12, 0.8, 0.5, 300, 60); } }
  meteorWhistle() { if (this.ensure()) { const t = this.ac.currentTime;
    this._tone(t, 1.1, 0.32, 'sine', 1600, 180); this._noise(t, 1.1, 0.22, 4000, 400, 'bandpass', 3); } }
  wave()     { if (this.ensure()) { const t = this.ac.currentTime; this._noise(t, 1.8, 0.7, 600, 90); this._tone(t, 1.4, 0.4, 'sine', 55, 32); } }
  /* ---------------- flame loop ---------------- */
  setFlame(on) {
    if (on) {
      if (!this.ensure() || this._flame) return;
      const t = this.ac.currentTime;
      const src = this.ac.createBufferSource(); src.buffer = this._noiseBuf(); src.loop = true;
      const flt = this.ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 750; flt.Q.value = 0.8;
      const lfo = this.ac.createOscillator(); lfo.frequency.value = 7;
      const lg = this.ac.createGain(); lg.gain.value = 240;
      lfo.connect(lg); lg.connect(flt.frequency); lfo.start(t);
      const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.15, t + 0.07);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(t);
      this._flame = { src, g, lfo };
    } else if (this._flame) {
      const t = this.ac.currentTime;
      const { src, g, lfo } = this._flame;
      this._flame = null;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.12);
      src.stop(t + 0.2); lfo.stop(t + 0.2);
    }
  }
  /* ---------------- named loops (weather) ---------------- */
  loop(key, { type = 'lowpass', f = 700, q = 0.7, gain = 0.14, lfo = 0, lfoDepth = 0 } = {}) {
    if (!this.ensure() || this._loops.has(key)) return;
    const t = this.ac.currentTime;
    const src = this.ac.createBufferSource(); src.buffer = this._noiseBuf(); src.loop = true;
    const flt = this.ac.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.3);
    let osc = null;
    if (lfo) {
      osc = this.ac.createOscillator(); osc.frequency.value = lfo;
      const lg = this.ac.createGain(); lg.gain.value = lfoDepth;
      osc.connect(lg); lg.connect(flt.frequency); osc.start(t);
    }
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t);
    this._loops.set(key, { src, g, osc });
  }
  unloop(key) {
    const L = this._loops.get(key);
    if (!L) return;
    this._loops.delete(key);
    const t = this.ac.currentTime;
    L.g.gain.cancelScheduledValues(t);
    L.g.gain.setValueAtTime(Math.max(0.0001, L.g.gain.value), t);
    L.g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    L.src.stop(t + 0.35);
    if (L.osc) L.osc.stop(t + 0.35);
  }
  unloopAll() { for (const k of [...this._loops.keys()]) this.unloop(k); }
}

export const sfx = new Sfx();
