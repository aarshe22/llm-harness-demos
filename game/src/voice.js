/* Text-to-speech for mode/weapon/block/weather selections via speechSynthesis.
   Respects the sound option (muted = silent), debounces repeats, and cancels
   any queued speech before each new utterance so rapid taps stay snappy. */
class Voice {
  constructor() {
    this.enabled = true;
    this._last = '';
    this._lastT = 0;
  }
  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  speak(text) {
    if (!this.enabled || !text) return;
    if (!('speechSynthesis' in window)) return;
    const now = performance.now();
    // swallow double-fires of the same phrase (key + click both select)
    if (text === this._last && now - this._lastT < 600) return;
    this._last = text; this._lastT = now;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.pitch = 1.05; u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable: ignore */ }
  }
}
export const voice = new Voice();
