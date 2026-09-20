/* Voxel Golf — UI layer: HUD, input, minimap, audio, screens. */
/* global GAME, UI */
const UI = (function () {
'use strict';

const $ = id => document.getElementById(id);
let soundOn = true, audioCtx = null, meterMode = false;
let courseSel = localStorage.getItem('voxelgolf.course') || 'pebble_beach';
let lastMsgTO = null;

/* ---------------- audio ---------------- */
function ensureAudio() {
  if (!soundOn) return null;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function noiseBuf(ctx, dur) {
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function fxSwing(power) {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 0.22);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = 700 + power * 14; bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.25 * (0.4 + power / 130), t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t); src.stop(t + 0.22);
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 190;
  og.gain.setValueAtTime(0.16, t + 0.05); og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  o.connect(og).connect(ctx.destination); o.start(t + 0.05); o.stop(t + 0.12);
}
function fxPutt() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.05);
  g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.08);
}
function fxBounce(sand) {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, sand ? 0.3 : 0.06);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = sand ? 500 : 1600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(sand ? 0.3 : 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (sand ? 0.3 : 0.06));
  src.connect(lp).connect(g).connect(ctx.destination); src.start(t);
}
function fxSplash() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 0.5);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(250, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(lp).connect(g).connect(ctx.destination); src.start(t);
}
function fxSink() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  [660, 880, 1100].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.11);
    g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.11 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.3);
    o.connect(g).connect(ctx.destination); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.32);
  });
}
function fxUI() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 720;
  g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.06);
}

/* ---------------- toast ---------------- */
function toast(msg, ms) {
  const el = $('msg-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(lastMsgTO);
  lastMsgTO = setTimeout(() => el.classList.remove('show'), ms || 2200);
}

/* ---------------- start screen ---------------- */
function buildCourseList() {
  const list = $('course-list');
  list.innerHTML = '';
  const ids = Object.keys(window.GOLF_COURSES)
    .map(id => ({ id, c: window.GOLF_COURSES[id] }))
    .filter(o => Object.keys(o.c.holes).length >= 9)
    .sort((a, b) => a.c.name.localeCompare(b.c.name));
  for (const { id, c } of ids) {
    const holes = Object.values(c.holes);
    const par = holes.reduce((a, h) => a + (h.par || 4), 0);
    const yds = holes.reduce((a, h) => a + (h.yards_est || 0), 0);
    const div = document.createElement('div');
    div.className = 'course-item' + (id === courseSel ? ' sel' : '');
    div.innerHTML = '<div class="ci-name">' + c.name + '</div>' +
      '<div class="ci-meta">' + c.location + ' · Par ' + par + ' · ' + yds + ' yds</div>';
    div.onclick = () => {
      courseSel = id;
      localStorage.setItem('voxelgolf.course', id);
      fxUI();
      document.querySelectorAll('.course-item').forEach(el => el.classList.remove('sel'));
      div.classList.add('sel');
    };
    list.appendChild(div);
  }
}

/* ---------------- HUD ---------------- */
function renderState() {
  const st = GAME.state;
  const hd = GAME.api.holeData();
  if (!hd) return;
  $('hc-hole').textContent = 'H' + hd.hole;
  $('hc-par').textContent = 'PAR ' + hd.par;
  $('hc-yds').textContent = hd.yds + ' yds';
  $('hc-si').textContent = st.si[hd.hole] || '-';
  $('hc-score').textContent = 'Strokes: ' + st.strokes;
  const w = st.wind;
  $('hc-wind').textContent = w.spd;
  $('hc-wind-ico').style.transform = 'rotate(' + (w.deg + 90) + 'deg)';
  const d = GAME.api.pinDist();
  $('mm-dist').textContent = 'Pin ' + d + ' yds';
  $('dist-to-pin').textContent = 'TO PIN ' + d;
  const lieName = GAME.LIE_NAME[st.lie] || 'LIE';
  const badge = $('lie-badge');
  badge.textContent = lieName;
  badge.className = 'lie ' + (GAME.LIE_CLASS[st.lie] || 'fair');
  renderClubs();
  const pf = $('power-fill');
  pf.style.width = st.power + '%';
}
function renderClubs() {
  const bar = $('clubbar');
  const st = GAME.state;
  if (!bar.childElementCount) {
    for (const c of GAME.CLUBS) {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.id = c.id;
      b.textContent = c.label;
      b.onclick = () => { fxUI(); GAME.api.setAutoClub(false); GAME.api.setClub(c.id); };
      bar.appendChild(b);
    }
  }
  const sug = GAME.api.suggest();
  for (const el of bar.children) {
    el.classList.toggle('sel', el.dataset.id === st.club);
    el.classList.toggle('sug', el.dataset.id === sug && !st.autoClub);
    if (el.dataset.id === st.club) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  $('club-auto').classList.toggle('on', !!st.autoClub);
}

/* ---------------- minimap ---------------- */
function drawPolys(ctx, polys, scale, ox, oy, fill) {
  ctx.fillStyle = fill;
  for (const f of polys) {
    ctx.beginPath();
    for (let i = 0; i < f.length; i += 2) {
      const x = ox + (f[i] - scale.x0) * scale.k, y = oy + (f[i + 1] - scale.z0) * scale.kk;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
}
function drawMinimap(canvas, big) {
  const mm = GAME.api.minimap();
  if (!mm) return;
  const ctx = canvas.getContext('2d');
  const wpx = canvas.width, hpx = canvas.height;
  ctx.clearRect(0, 0, wpx, hpx);
  const b = mm.bounds, bw = b.x1 - b.x0, bh = b.z1 - b.z0;
  const k = Math.min(wpx / bw, hpx / bh) * (big ? 0.92 : 0.88);
  const k2 = k;
  const ox = (wpx - bw * k) / 2, oy = (hpx - bh * k2) / 2;
  const scale = { x0: b.x0, z0: b.z0, k, kk: k2 };
  const X = p => ox + (p[0] - b.x0) * k, Y = p => oy + (p[1] - b.z0) * k2;
  ctx.save();
  ctx.globalAlpha = 0.25;
  drawPolys(ctx, mm.polys.fairway, scale, ox, oy, '#2c4a25');
  ctx.restore();
  drawPolys(ctx, mm.polys.fairway, scale, ox, oy, '#41873a');
  drawPolys(ctx, mm.polys.tee, scale, ox, oy, '#5cb85c');
  drawPolys(ctx, mm.polys.green, scale, ox, oy, '#6fd06f');
  drawPolys(ctx, mm.polys.bunker, scale, ox, oy, '#e6d29c');
  drawPolys(ctx, mm.polys.water, scale, ox, oy, '#3d9bd8');
  // aim line
  const bx = X(mm.ball), by = Y(mm.ball);
  const a = mm.aim * Math.PI / 180;
  ctx.strokeStyle = 'rgba(255,213,74,.9)'; ctx.lineWidth = big ? 2 : 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(bx, by);
  ctx.lineTo(bx + Math.sin(a) * (big ? 90 : 44), by + Math.cos(a) * (big ? 90 : 44));
  ctx.stroke(); ctx.setLineDash([]);
  // pin
  const px = X(mm.pin), py = Y(mm.pin);
  ctx.fillStyle = '#ff4040';
  ctx.beginPath(); ctx.arc(px, py, big ? 4 : 3, 0, 7); ctx.fill();
  // ball
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, big ? 5 : 4, 0, 7); ctx.fill(); ctx.stroke();
  // wind arrow
  const wx = wpx - (big ? 60 : 30), wy = big ? 60 : 28;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  const wd = mm.wind.deg * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(wx - Math.cos(wd) * 12, wy - Math.sin(wd) * 12);
  ctx.lineTo(wx + Math.cos(wd) * 12, wy + Math.sin(wd) * 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx + Math.cos(wd) * 12, wy + Math.sin(wd) * 12);
  ctx.lineTo(wx + Math.cos(wd + 2.6) * 6, wy + Math.sin(wd + 2.6) * 6);
  ctx.moveTo(wx + Math.cos(wd) * 12, wy + Math.sin(wd) * 12);
  ctx.lineTo(wx + Math.cos(wd - 2.6) * 6, wy + Math.sin(wd - 2.6) * 6);
  ctx.stroke();
  if (big) {
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(mm.wind.spd + ' mph', wx - 14, wy + 30);
  }
}

/* ---------------- scorecard ---------------- */
function openScorecard() {
  const c = GAME.state.course; if (!c) return;
  const nums = Object.keys(c.holes).map(Number).sort((a, b) => a - b);
  let html = '<table><tr><th class="sc-lbl">Hole</th>';
  let pT = 0, yT = 0, sT = 0;
  for (const h of nums) { html += '<th>' + h + '</th>'; }
  html += '<th>OUT</th><th>IN</th><th>T</th></tr>';
  const row = (lbl, fn, cls) => {
    html += '<tr><td class="sc-lbl">' + lbl + '</td>';
    let outSum = 0, inSum = 0;
    for (const h of nums) {
      const v = fn(h);
      if (h <= 9) outSum += v || 0; else inSum += v || 0;
      const now = GAME.state.holeNum === h ? ' class="now"' : '';
      html += '<td' + now + (cls ? ' ' + cls : '') + '>' + (v === '' ? '' : v) + '</td>';
    }
    html += '<td>' + outSum + '</td><td>' + inSum + '</td><td><b>' + (outSum + inSum) + '</b></td></tr>';
    void pT; void yT; void sT;
  };
  row('Par', h => { const p = c.holes[h].par || 4; return p; });
  row('SI', h => GAME.state.si[h] || '');
  row('Yds', h => c.holes[h].yards_est || '');
  row('Score', h => {
    const ix = nums.indexOf(h);
    const s = GAME.state.scores[ix];
    return s === undefined ? '' : s;
  });
  html += '</table>';
  $('sc-table').innerHTML = html;
  $('scorecard').classList.remove('hidden');
}

/* ---------------- shot distance announce ---------------- */
let preShotPos = null;
function hookShotFlow() {
  GAME.on('shot', () => {
    const b = GAME.state.ball;
    preShotPos = { x: GAME.state.prevShot.x, z: GAME.state.prevShot.z };
    void b;
  });
  GAME.on('rest', () => {
    if (!preShotPos) return;
    const b = GAME.state.ball;
    const d = Math.round(Math.hypot(b.x - preShotPos.x, b.z - preShotPos.z));
    if (d > 2) toast(d + ' yd — ' + GAME.api.pinDist() + ' to pin', 1600);
    renderState();
  });
}

/* ---------------- input ---------------- */
function setupInput(canvas) {
  const ptrs = new Map();
  let sling = null, orbit = null, pinch = null;
  const minDim = () => Math.min(innerWidth, innerHeight);

  const gameApi = GAME.api;

  function worldBasis() {
    const cam = GAME.cam;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const fl = Math.hypot(dir.x, dir.z) || 1;
    // ground forward = projected camera dir; ground right = cross(fwd, up) = (-fz, fx)
    return { fx: dir.x / fl, fz: dir.z / fl, rx: -dir.z / fl, rz: dir.x / fl };
  }

  canvas.addEventListener('pointerdown', e => {
    ensureAudio();
    if (e.button === 2 || e.button === 1) {
      orbit = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, mode: 'orbit' });
      e.preventDefault();
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const p = [...ptrs.values()];
      pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      sling = null; GAME.state.power = 0; renderState();
      return;
    }
    if (GAME.state.phase === 'aim' && !meterMode && e.button === 0) {
      sling = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    } else if (GAME.state.phase !== 'aim') {
      orbit = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const rec = ptrs.get(e.pointerId);
    const prev = { x: rec.x, y: rec.y };
    rec.x = e.clientX; rec.y = e.clientY;
    if (pinch && ptrs.size >= 2) {
      const p = [...ptrs.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      if (pinch.d > 10) gameApi.zoomBy(pinch.d / d);
      gameApi.orbit((cx - pinch.x) * 0.006, (cy - pinch.y) * 0.004);
      pinch.d = d; pinch.x = cx; pinch.y = cy;
      void prev;
      return;
    }
    if (sling && GAME.state.phase === 'aim') {
      const dx = e.clientX - sling.x, dy = e.clientY - sling.y;
      const len = Math.hypot(dx, dy);
      const basis = worldBasis();
      const wx = basis.rx * (-dx) + basis.fx * (dy);
      const wz = basis.rz * (-dx) + basis.fz * (dy);
      if (len > 6 && Math.hypot(wx, wz) > 1e-4) {
        gameApi.setAim(Math.atan2(wx, wz) * 180 / Math.PI);
      }
      GAME.state.power = clamp(100 * len / (minDim() * 0.42), 0, 100);
      $('power-wrap').classList.remove('hidden');
      renderState();
      e.preventDefault();
    } else if (orbit) {
      gameApi.orbit((e.clientX - orbit.x) * 0.005, (e.clientY - orbit.y) * 0.004);
      orbit = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, { passive: false });

  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (sling && GAME.state.phase === 'aim') {
      const p = GAME.state.power;
      $('power-wrap').classList.add('hidden');
      if (p >= 5) {
        GAME.api.shoot(p);
      }
      GAME.state.power = 0;
      sling = null;
      renderState();
    }
    orbit = null;
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    gameApi.zoomBy(e.deltaY > 0 ? 1.12 : 0.9);
    e.preventDefault();
  }, { passive: false });

  /* keyboard */
  let meterOn = false, meterRAF = 0, meterT0 = 0;
  function meterLoop(t) {
    if (!meterOn) return;
    const el = (t - meterT0) / 1000;
    const v = (Math.sin(el * 2 * Math.PI * 1.3 - Math.PI / 2) + 1) / 2 * 100;
    GAME.state.power = v;
    $('power-mark').style.left = v + '%';
    $('power-fill').style.width = v + '%';
    meterRAF = requestAnimationFrame(meterLoop);
  }
  function meterStart() {
    if (meterOn || GAME.state.phase !== 'aim') return;
    meterOn = true; meterT0 = performance.now();
    $('power-wrap').classList.remove('hidden');
    $('power-mark').style.display = 'block';
    meterRAF = requestAnimationFrame(meterLoop);
  }
  function meterStop() {
    if (!meterOn) return;
    meterOn = false; cancelAnimationFrame(meterRAF);
    const p = GAME.state.power;
    $('power-wrap').classList.add('hidden');
    $('power-mark').style.display = 'none';
    GAME.state.power = 0;
    if (p >= 5) GAME.api.shoot(p);
    renderState();
  }
  const held = {};
  addEventListener('keydown', e => {
    ensureAudio();
    const st = GAME.state;
    const fast = e.shiftKey ? 5 : 1;
    if (e.repeat && ['Space'].includes(e.code)) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': gameApi.nudgeAim(-0.25 * fast); e.preventDefault(); break;
      case 'ArrowRight': case 'KeyD': gameApi.nudgeAim(0.25 * fast); e.preventDefault(); break;
      case 'KeyQ': gameApi.cycleClub(-1); break;
      case 'KeyE': gameApi.cycleClub(1); break;
      case 'Digit1': setShape(-1); break;
      case 'Digit2': setShape(0); break;
      case 'Digit3': setShape(1); break;
      case 'KeyV': gameApi.cycleCamera(); break;
      case 'KeyM': toggleBigMap(); break;
      case 'KeyR': toast('Press REDO button to restart hole', 1400); break;
      case 'Tab':
        e.preventDefault();
        $('scorecard').classList.toggle('hidden');
        if (!$('scorecard').classList.contains('hidden')) openScorecard();
        break;
      case 'KeyH': $('screen-help').classList.toggle('hidden'); break;
      case 'Escape':
        document.querySelectorAll('.overlay:not(#loading)').forEach(el => el.classList.add('hidden'));
        $('screen-help').classList.add('hidden');
        break;
      case 'Space':
        e.preventDefault();
        if (!held.Space) { held.Space = true; meterStart(); }
        break;
    }
    void st;
  });
  addEventListener('keyup', e => {
    if (e.code === 'Space') { held.Space = false; meterStop(); }
  });
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* big map overlay */
let bigMapOpen = false;
function toggleBigMap() {
  bigMapOpen = !bigMapOpen;
  let el = $('bigmap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bigmap'; el.className = 'overlay hidden';
    el.style.cssText = 'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(5,20,12,.55)';
    el.innerHTML = '<canvas id="bigmap-cv" width="560" height="560" style="background:rgba(10,30,20,.85);border-radius:16px;border:1px solid rgba(255,255,255,.25);max-width:92vw;max-height:92vh"></canvas>';
    document.body.appendChild(el);
    el.addEventListener('click', () => toggleBigMap());
  }
  el.classList.toggle('hidden', !bigMapOpen);
}

/* shape buttons */
function setShape(s) {
  GAME.api.setShape(s);
  document.querySelectorAll('.shape-btn').forEach(b => b.classList.toggle('on', +b.dataset.s === s));
}

/* ---------------- boot ---------------- */
function boot() {
  buildCourseList();
  const canvas = $('gl');
  const quality = (localStorage.getItem('voxelgolf.quality')) || 'auto';
  soundOn = localStorage.getItem('voxelgolf.sound') !== '0';
  $('btn-sound').textContent = soundOn ? '🔊' : '🔇';

  GAME.boot(canvas, { quality });

  // events
  GAME.on('state', () => renderState());
  GAME.on('club', () => renderClubs());
  GAME.on('autoclub', () => renderClubs());
  GAME.on('loading', d => $('loading').classList.toggle('hidden', !d.on));
  GAME.on('hole', d => {
    $('hud').classList.remove('hidden');
    renderState();
    mmDraw();
  });
  GAME.on('shot', d => {
    if (d.type === 'putt') fxPutt(); else fxSwing(d.power || 60);
    if (navigator.vibrate) navigator.vibrate(18);
  });
  GAME.on('impact', d => { fxBounce(d.sand); if (navigator.vibrate) navigator.vibrate(d.sand ? 30 : 10); });
  GAME.on('splash', d => { d.sand ? fxBounce(true) : fxSplash(); });
  GAME.on('penalty', d => toast(d.why, 2600));
  GAME.on('toast', d => toast(d.msg, d.persist ? 6000 : 2200));
  GAME.on('holed', d => {
    fxSink();
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    $('hs-score').textContent = d.strokes;
    $('hs-label').textContent = GAME.scoreLabel(d.strokes, d.par);
    $('hs-title').textContent = 'Hole ' + GAME.state.holeNum + ' complete';
    $('screen-hole').classList.remove('hidden');
  });
  GAME.on('round', d => {
    $('screen-hole').classList.add('hidden');
    $('rs-total').textContent = d.total;
    $('rs-label').textContent = d.over === 0 ? 'EVEN PAR' : (d.over > 0 ? '+' + d.over : d.over) + ' (' + d.par + ')';
    $('rs-best').textContent = d.best ? 'Best: ' + d.best.total + ' (' + (d.best.over >= 0 ? '+' : '') + d.best.over + ') on ' + d.best.date : '';
    $('rs-card').innerHTML = miniCard(d);
    $('screen-round').classList.remove('hidden');
    $('hud').classList.add('hidden');
  });
  hookShotFlow();

  /* buttons */
  $('btn-start').onclick = () => {
    fxUI();
    $('screen-start').classList.add('hidden');
    $('hud').classList.remove('hidden');
    GAME.api.startRound(courseSel);
  };
  $('btn-help').onclick = () => { fxUI(); $('screen-help').classList.remove('hidden'); };
  $('btn-help-close').onclick = () => $('screen-help').classList.add('hidden');
  $('opt-sound').checked = soundOn;
  $('opt-sound').onchange = e => {
    soundOn = e.target.checked;
    localStorage.setItem('voxelgolf.sound', soundOn ? '1' : '0');
    $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
  };
  $('opt-meter').onchange = e => { meterMode = e.target.checked; };
  $('opt-quality').value = quality;
  $('opt-quality').onchange = e => localStorage.setItem('voxelgolf.quality', e.target.value);

  $('btn-next-hole').onclick = () => {
    fxUI();
    $('screen-hole').classList.add('hidden');
    GAME.api.nextHole();
  };
  $('btn-again').onclick = () => {
    $('screen-round').classList.add('hidden');
    GAME.api.restartRound();
  };
  $('btn-lobby').onclick = () => {
    $('screen-round').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
    buildCourseList();
  };
  $('btn-sc-close').onclick = () => $('scorecard').classList.add('hidden');
  $('btn-card').onclick = () => { fxUI(); openScorecard(); $('scorecard').classList.remove('hidden'); };
  $('btn-map').onclick = () => { fxUI(); toggleBigMap(); };
  $('btn-cam').onclick = () => { fxUI(); GAME.api.cycleCamera(); };
  $('btn-drop').onclick = () => { fxUI(); GAME.api.dropUnplayable(); };
  $('btn-restart-hole').onclick = () => {
    if (confirm('Restart this hole?')) GAME.api.restartHole();
  };
  $('btn-sound').onclick = () => {
    soundOn = !soundOn;
    localStorage.setItem('voxelgolf.sound', soundOn ? '1' : '0');
    $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
  };
  $('btn-menu').onclick = () => {
    if (!GAME.state.course || confirm('Leave to lobby? Current round will be lost.')) {
      $('screen-round').classList.add('hidden');
      $('screen-hole').classList.add('hidden');
      $('hud').classList.add('hidden');
      $('screen-start').classList.remove('hidden');
      buildCourseList();
    }
  };
  document.querySelectorAll('.shape-btn').forEach(b => { b.onclick = () => { fxUI(); setShape(+b.dataset.s); }; });
  $('club-auto').onclick = () => { fxUI(); GAME.api.setAutoClub(!GAME.state.autoClub); };

  setupInput(canvas);

  /* minimap loop */
  let mmAcc = 0;
  function mmDraw() {
    const cv = $('minimap');
    drawMinimap(cv, false);
    if (bigMapOpen) {
      const bc = $('bigmap-cv');
      if (bc) drawMinimap(bc, true);
    }
  }
  setInterval(() => {
    if (GAME.state.course && GAME.state.phase !== 'loading') {
      mmAcc = 0;
      drawMinimap($('minimap'), false);
      if (bigMapOpen) { const bc = $('bigmap-cv'); if (bc) drawMinimap(bc, true); }
    }
  }, 180);
  void mmAcc; void mmDraw;

  // prevent page scroll on touch
  document.addEventListener('touchmove', e => {
    if (e.target === canvas) e.preventDefault();
  }, { passive: false });
}

function miniCard(d) {
  const c = GAME.state.course;
  let html = '<table><tr><td class="sc-lbl">Hole</td>';
  for (const h of d.nums) html += '<td>' + h + '</td>';
  html += '<td><b>T</b></td></tr>';
  html += '<tr><td class="sc-lbl">Par</td>';
  for (const h of d.nums) html += '<td>' + (c.holes[h].par || 4) + '</td>';
  html += '<td><b>' + d.par + '</b></td></tr>';
  html += '<tr><td class="sc-lbl">Score</td>';
  d.nums.forEach((h, i) => {
    const s = d.scores[i] || 0, p = c.holes[h].par || 4;
    const cls = s < p ? 'under' : s > p ? 'over' : 'even';
    html += '<td class="' + cls + '">' + s + '</td>';
  });
  html += '<td><b>' + d.total + '</b></td></tr></table>';
  return html;
}

return { boot };
})();
