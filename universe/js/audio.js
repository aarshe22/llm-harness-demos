/* =========================================================================
 * Voxel Cosmos — audio.js
 * Fully procedural Web Audio ambience (no assets). Starts only after the
 * user enables sound. Layers crossfade with the camera realm:
 *   Hell   — filtered-noise rumble, fire hiss, occasional chain clank
 *   Earth  — wind, water shimmer, birdsong chirps, distant city hum
 *   Heaven — soft choir-like stacked drones, bells, harp arpeggios
 * SFX: Cerberus roar (3 detuned growls), gate-open groan, pearl chime,
 *      Peter's bell, eruption boom, UI ticks.
 * Master mute + volume; everything degrades silently if Web Audio is absent.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var A = VC.audio = { on: false, muted: false, ctx: null, ready: false };

  var ctx, master, layers = {}, nodes = [];
  var realmGain = { hell: null, earth: null, heaven: null };
  var scheduler = null, lastBird = 0, lastChime = 0, lastHarp = 0;

  function noiseBuffer(sec) {
    var n = ctx.sampleRate * sec;
    var b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function loopNoise(gain, freq, q, type) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3);
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g);
    return { src: src, filter: f, gain: g };
  }
  function drone(freqs, gainv, type) {
    var g = ctx.createGain();
    g.gain.value = gainv;
    freqs.forEach(function (fr, i) {
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = fr;
      o.detune.value = (i % 2 ? 4 : -4);
      var og = ctx.createGain();
      og.gain.value = 0.5 / freqs.length;
      o.connect(og); og.connect(g);
      o.start();
      nodes.push(o);
    });
    return g;
  }

  A.init = function () {
    if (A.ready) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    /* --- realm layers --- */
    var hell = ctx.createGain(); hell.gain.value = 0;
    var r1 = loopNoise(0.5, 90, 0.6);            /* deep rumble */
    r1.gain.connect(hell); r1.src.start();
    var r2 = loopNoise(0.10, 900, 0.8, 'bandpass');   /* fire hiss */
    r2.gain.connect(hell); r2.src.start();
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    var lfoG = ctx.createGain(); lfoG.gain.value = 24;
    lfo.connect(lfoG); lfoG.connect(r1.filter.frequency); lfo.start();
    nodes.push(lfo);
    realmGain.hell = hell; hell.connect(master); nodes.push(r1.src, r2.src);

    var earth = ctx.createGain(); earth.gain.value = 0;
    var e1 = loopNoise(0.20, 480, 0.5, 'bandpass');   /* wind */
    e1.gain.connect(earth); e1.src.start();
    var e2 = loopNoise(0.07, 2400, 1.2, 'bandpass');  /* water shimmer */
    e2.gain.connect(earth); e2.src.start();
    var e3 = loopNoise(0.05, 220, 0.7);               /* city hum */
    e3.gain.connect(earth); e3.src.start();
    realmGain.earth = earth; earth.connect(master); nodes.push(e1.src, e2.src, e3.src);

    var heaven = ctx.createGain(); heaven.gain.value = 0;
    var h1 = drone([220, 277, 330, 440], 0.055, 'sine');   /* choir-ish stack */
    h1.connect(heaven);
    var h2 = drone([110, 165], 0.05, 'triangle');
    h2.connect(heaven);
    realmGain.heaven = heaven; heaven.connect(master);

    A.ready = true;
    scheduler = setInterval(tick, 350);
    return true;
  };

  A.enable = function () {
    if (!A.ready && !A.init()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    A.on = true;
    applyMute();
    return true;
  };
  A.disable = function () {
    A.on = false;
    if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  };
  A.setMuted = function (m) {
    A.muted = m;
    if (!m && !A.on) return A.enable();
    applyMute();
    if (!m && ctx.state === 'suspended') ctx.resume();
  };
  function applyMute() {
    if (!master) return;
    master.gain.setTargetAtTime(A.on && !A.muted ? 0.55 : 0, ctx.currentTime, 0.25);
  }

  /* --- realm crossfade (called from main loop, cheap) --- */
  var targetMix = { hell: 0, earth: 0, heaven: 0 };
  A.setRealmWeights = function (w) {
    targetMix = w;
    if (!A.ready || !A.on) return;
    for (var k in realmGain) {
      realmGain[k].gain.setTargetAtTime(w[k] || 0, ctx.currentTime, 0.6);
    }
  };

  /* --- tiny procedural events --- */
  function tick() {
    if (!A.on || A.muted || !ctx || ctx.state !== 'running') return;
    var t = ctx.currentTime;
    var camY = VC.camera ? VC.camera.position.y : 40;
    if (targetMix.earth > 0.5 && t - lastBird > 1.6 + Math.random() * 3) {
      lastBird = t;
      chirp(1800 + Math.random() * 1400, 0.05 + Math.random() * 0.06);
    }
    if (targetMix.heaven > 0.5 && t - lastHarp > 2.4 + Math.random() * 3) {
      lastHarp = t;
      harp();
    }
    if (targetMix.heaven > 0.5 && t - lastChime > 9 + Math.random() * 8) {
      lastChime = t;
      bell(660, 0.09);
    }
    if (targetMix.hell > 0.6 && Math.random() < 0.14) chain();
  }

  function env(node, t0, a, d, peak) {
    node.gain.cancelScheduledValues(t0);
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(freq, type, dur, peak, slide) {
    if (!A.ready || !A.on || A.muted) return;
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    var g = ctx.createGain();
    env(g, t0, 0.008, dur, peak);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function chirp(f, peak) {
    if (!A.ready || !A.on || A.muted) return;
    var t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * (1 + Math.random() * 0.5), t0 + 0.07);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + 0.14);
    var g = ctx.createGain();
    env(g, t0, 0.006, 0.16, peak * 0.6);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.25);
  }
  function bell(f, peak) {
    if (!A.ready) return;
    tone(f, 'sine', 2.2, peak);
    tone(f * 2.76, 'sine', 1.4, peak * 0.4);
    tone(f * 5.4, 'sine', 0.8, peak * 0.2);
  }
  function harp() {
    if (!A.ready || !A.on || A.muted) return;
    var scale = [440, 494, 523, 587, 659, 784, 880];
    var n = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          tone(scale[Math.floor(Math.random() * scale.length)], 'triangle', 1.2, 0.035);
        }, i * 90);
      })(i);
    }
  }
  function chain() {
    if (!A.ready || !A.on || A.muted) return;
    var t0 = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 1600; f.Q.value = 6;
    var g = ctx.createGain();
    env(g, t0, 0.004, 0.22, 0.05);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 0.3);
  }

  /* --- big set-pieces --- */
  A.cerberusRoar = function () {
    if (!A.enable()) return;
    var t0 = ctx.currentTime;
    [58, 74, 46].forEach(function (fr, i) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * 2.2, t0);
      o.frequency.exponentialRampToValueAtTime(fr * 0.9, t0 + 1.8);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(700, t0);
      f.frequency.linearRampToValueAtTime(240, t0 + 1.8);
      var g = ctx.createGain();
      env(g, t0 + i * 0.07, 0.12, 1.9, 0.22);
      /* growl noise */
      var n = ctx.createBufferSource();
      n.buffer = noiseBuffer(2);
      var nf = ctx.createBiquadFilter();
      nf.type = 'bandpass'; nf.frequency.value = 300 + i * 120; nf.Q.value = 2;
      var ng = ctx.createGain();
      env(ng, t0 + i * 0.07, 0.15, 1.7, 0.09);
      n.connect(nf); nf.connect(ng); ng.connect(master);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0 + i * 0.07); o.stop(t0 + 2.2);
      n.start(t0 + i * 0.07); n.stop(t0 + 2.1);
    });
  };
  A.hellGateOpen = function () {
    if (!A.enable()) return;
    var t0 = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(160, t0);
    f.frequency.linearRampToValueAtTime(420, t0 + 2.2);
    var g = ctx.createGain();
    env(g, t0, 0.35, 2.6, 0.3);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 3);
    tone(42, 'square', 2.4, 0.12, 0.7);
    tone(84, 'sawtooth', 2.2, 0.05, 0.8);
  };
  A.pearlGateOpen = function () {
    if (!A.enable()) return;
    [523, 659, 784, 1046].forEach(function (fr, i) {
      setTimeout(function () { bell(fr, 0.08); }, i * 160);
    });
    /* airy swell */
    var t0 = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.5);
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    var g = ctx.createGain();
    env(g, t0, 0.8, 1.8, 0.07);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 2.6);
  };
  A.peterBell = function () {
    if (!A.enable()) return;
    bell(880, 0.09);
    setTimeout(function () { bell(1174, 0.06); }, 320);
  };
  A.eruption = function () {
    if (!A.on || A.muted || !ctx || ctx.state !== 'running') return;
    var t0 = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1.4);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t0);
    f.frequency.exponentialRampToValueAtTime(90, t0 + 1.3);
    var g = ctx.createGain();
    env(g, t0, 0.02, 1.3, 0.28);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 1.5);
    tone(55, 'sine', 1.2, 0.14, 0.6);
  };
  A.uiTick = function (freq) {
    if (!A.on || A.muted || !ctx) return;
    tone(freq || 880, 'sine', 0.07, 0.03);
  };
}());
