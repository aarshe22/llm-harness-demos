// Sleek synthesized score and weapon voices. No external samples.

export function createAudio() {
  const api = {
    ctx: null,
    master: null,
    muted: false,
    volume: 0.8,
    noise: null,
    next: 0,
    step: 0,
    lastLaser: 0,

    ensure() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },

    resume() {
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setVolume(v) {
      this.volume = v;
      if (this.master && !this.muted) this.master.gain.value = v;
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      return this.muted;
    },

    tone(time, freq, dur, type, gain, slide) {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(40, freq), time);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), time + dur);
      g.gain.setValueAtTime(gain, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(time);
      o.stop(time + dur + 0.02);
    },

    noiseBurst(time, dur, gain, freq) {
      if (!this.ctx || this.muted || !this.noise) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, time);
      filter.frequency.exponentialRampToValueAtTime(140, time + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(time);
      src.stop(time + dur + 0.02);
    },

    laser() {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (t - this.lastLaser < 0.045) return;
      this.lastLaser = t;
      this.tone(t, 920 + Math.random() * 120, 0.05, 'sine', 0.03, 280);
    },

    tick() {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(t, 540, 0.06, 'triangle', 0.03, 180);
    },

    boom(power = 1) {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.noiseBurst(t, 0.38, 0.16 * power, 700 + power * 500);
      this.tone(t, 110, 0.28, 'sine', 0.07 * power, 42);
    },

    hit() {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.noiseBurst(t, 0.18, 0.12, 320);
      this.tone(t, 140, 0.16, 'sine', 0.06, 60);
    },

    chime() {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(t, 660, 0.12, 'sine', 0.04, 880);
      this.tone(t + 0.08, 990, 0.16, 'sine', 0.035, 1320);
    },

    launch() {
      this.resume();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(t, 220, 0.4, 'sine', 0.05, 660);
      this.tone(t + 0.06, 330, 0.35, 'triangle', 0.03, 990);
    },

    updateMusic(enabled, root, tension) {
      if (!enabled || !this.ctx || this.muted) {
        this.next = 0;
        return;
      }
      const now = this.ctx.currentTime;
      if (!this.next || this.next < now) this.next = now + 0.02;
      const interval = tension ? 0.28 : 0.46;
      const steps = [0, 7, 3, 10, 5, 12, 7, 3];
      let guard = 0;
      while (this.next < now + 0.22 && guard < 4) {
        const semi = steps[this.step % steps.length];
        const f = root * Math.pow(2, semi / 12);
        if (this.step % 4 === 0) this.tone(this.next, root * (tension ? 0.5 : 1), tension ? 0.5 : 1.1, 'sine', 0.045, root);
        if (this.step % 2 === 0) this.tone(this.next, f * 2, 0.16, 'triangle', tension ? 0.02 : 0.012, f * 2);
        if (tension && this.step % 4 === 2) this.tone(this.next, f * 3, 0.1, 'sine', 0.012, f * 2);
        this.next += interval;
        this.step++;
        guard++;
      }
    },
  };
  return api;
}
