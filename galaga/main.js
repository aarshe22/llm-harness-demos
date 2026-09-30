import * as THREE from './vendor/three.module.js';

/* ============================================================
   GALAGA 3D — projective-assault re-imagining
   Palette decoded from the original arcade color PROM (prom-5.5n)
   ============================================================ */

const PAL = {
  white:   0xdeffff, red: 0xff0000, yellow: 0xffdd00, gold: 0xff9700,
  magenta: 0xff00ff, cyan: 0x00ffff, ltblue: 0xb8b8ff, orange: 0xde4700,
  green:   0x00ff40, dgreen: 0x219700, mblue: 0x0068ff, purple: 0x9700ff,
  blue:    0x0000ff, teal: 0x0097ae,
};

const EMBLEMS = [0x9700ff, 0x00ff40, 0xff0000, 0xff9700, 0x0068ff, 0xff00ff, 0xffdd00];

// world bounds
const PX = 12.5;                 // player horizontal limit
const PLAYER_Z = 20;             // player plane (near camera)
const FC = new THREE.Vector3(0, 10, -24); // formation center base

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const lsGet = () => { try { return +(localStorage.getItem('galaga3d_hi') || 0); } catch { return 0; } };
const lsSet = v => { try { localStorage.setItem('galaga3d_hi', v); } catch {} };

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000014);
scene.fog = new THREE.Fog(0x000014, 55, 150);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
const CAM_HOME = V3(0, 7.2, 34);
const CAM_LOOK = V3(0, 2.5, -8);
camera.position.copy(CAM_HOME);
camera.lookAt(CAM_LOOK);

scene.add(new THREE.HemisphereLight(0x8899ff, 0x101028, 1.0));
const dl = new THREE.DirectionalLight(0xffffff, 1.1);
dl.position.set(6, 14, 10);
scene.add(dl);
const shipLight = new THREE.PointLight(0x66ccff, 6, 14);
scene.add(shipLight);

/* ---------------- starfield / floor (depth cues) ---------------- */
{
  const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cA = new THREE.Color(PAL.white), cB = new THREE.Color(PAL.ltblue), cC = new THREE.Color(PAL.mblue);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-70, 70); pos[i * 3 + 1] = rand(-25, 55); pos[i * 3 + 2] = rand(-150, 28);
    const c = pick([cA, cA, cB, cC]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  window.STARS = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.45, vertexColors: true, transparent: true, opacity: 0.9,
    depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(STARS);
}
{
  const grid = new THREE.GridHelper(400, 100, 0x0033aa, 0x001144);
  grid.position.y = -6;
  grid.position.z = -60;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);
  const ceil = new THREE.GridHelper(400, 100, 0x002277, 0x000d33);
  ceil.position.y = 42; ceil.position.z = -60;
  ceil.material.transparent = true; ceil.material.opacity = 0.35;
  scene.add(ceil);
}

/* ---------------- audio ---------------- */
const SFX = {
  ctx: null,
  ensure() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(f0, f1, dur, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  },
  boom() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, n = this.ctx.sampleRate * 0.35;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    s.connect(f).connect(g).connect(this.ctx.destination); s.start(t);
  },
  fire() { this.tone(880, 180, 0.08, 'square', 0.07); },
  dive() { this.tone(220, 900, 0.3, 'sawtooth', 0.06); },
  capture() { this.tone(400, 1400, 0.5, 'sine', 0.12); },
  rescue() {[0,1,2].forEach(i=>setTimeout(()=>this.tone(500+i*300,500+i*320,0.12,'square',0.1),i*90)); },
  clear() {[523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,f,0.14,'square',0.1),i*120)); },
};

/* ---------------- models ---------------- */
const mat = (color, emissive = 0.4, opts = {}) => new THREE.MeshPhongMaterial({
  color, emissive: new THREE.Color(color).multiplyScalar(emissive),
  shininess: 50, flatShading: true, ...opts,
});

function buildFighter() {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 4), mat(PAL.white, 0.35));
  nose.rotation.x = -Math.PI / 2; nose.position.z = -0.9; nose.rotation.y = Math.PI / 4;
  g.add(nose);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 1.5), mat(PAL.white, 0.3));
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.8), mat(PAL.ltblue, 0.4));
  wing.position.z = 0.35; g.add(wing);
  const wingEdgeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.7), mat(PAL.cyan, 0.7));
  wingEdgeL.position.set(-1.25, 0.12, 0.35); g.add(wingEdgeL);
  const wingEdgeR = wingEdgeL.clone(); wingEdgeR.position.x = 1.25; g.add(wingEdgeR);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.6), mat(PAL.mblue, 0.6));
  fin.position.set(0, 0.4, 0.6); g.add(fin);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.9 }));
  glow.position.z = 0.95; glow.name = 'engine';
  g.add(glow);
  return g;
}

function buildBee() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(PAL.yellow, 0.5));
  body.scale.set(1, 0.85, 1.3); g.add(body);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), mat(PAL.mblue, 0.5));
  band.scale.set(0.8, 0.7, 0.5); band.position.z = 0.25; g.add(band);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat(PAL.white, 0.6));
  head.position.z = 0.55; g.add(head);
  const wg = new THREE.SphereGeometry(0.34, 8, 8);
  const wl = new THREE.Mesh(wg, mat(PAL.ltblue, 0.5, { transparent: true, opacity: 0.95 }));
  wl.scale.set(1.7, 0.22, 1.05); wl.position.set(-0.55, 0.12, -0.05); g.add(wl);
  const wr = new THREE.Mesh(wg, mat(PAL.ltblue, 0.5, { transparent: true, opacity: 0.95 }));
  wr.scale.set(1.7, 0.22, 1.05); wr.position.set(0.55, 0.12, -0.05); g.add(wr);
  g.userData.wings = [wl, wr];
  return g;
}

function buildButterfly() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(PAL.red, 0.55));
  body.scale.set(0.8, 0.8, 1.4); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(PAL.white, 0.7));
  head.position.z = 0.6; g.add(head);
  const wg = new THREE.SphereGeometry(0.5, 8, 8);
  const mk = (x, c) => {
    const w = new THREE.Mesh(wg, mat(c, 0.45));
    w.scale.set(1.8, 0.25, 1.15); w.position.set(x, 0.1, -0.12);
    w.rotation.z = -Math.sign(x) * 0.25; g.add(w); return w;
  };
  const wl = mk(-0.85, PAL.white), wr = mk(0.85, PAL.white);
  const spotG = new THREE.SphereGeometry(0.14, 6, 6);
  [-1, 1].forEach(s => {
    const sp = new THREE.Mesh(spotG, mat(PAL.mblue, 0.8));
    sp.position.set(s * 0.95, 0.22, -0.12); g.add(sp);
  });
  g.userData.wings = [wl, wr];
  return g;
}

function buildBoss() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(PAL.teal, 0.6));
  dome.position.y = 0.1; g.add(dome);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(PAL.green, 0.5));
  under.scale.set(1, 0.55, 1.2); under.position.y = -0.12; g.add(under);
  const wg = new THREE.BoxGeometry(1.5, 0.28, 1.1);
  const wl = new THREE.Mesh(wg, mat(PAL.purple, 0.6));
  wl.position.set(-0.95, -0.05, 0); g.add(wl);
  const wr = new THREE.Mesh(wg, mat(PAL.purple, 0.6));
  wr.position.set(0.95, -0.05, 0); g.add(wr);
  const eyeG = new THREE.SphereGeometry(0.1, 6, 6);
  const e1 = new THREE.Mesh(eyeG, new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  e1.position.set(-0.2, 0.25, 0.52); g.add(e1);
  const e2 = e1.clone(); e2.position.x = 0.2; g.add(e2);
  g.userData.wings = [wl, wr];
  g.scale.setScalar(1.25);
  return g;
}

function buildBeam() {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 3.2, 14, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  beam.visible = false;
  scene.add(beam);
  return beam;
}

/* ---------------- particles / explosions ---------------- */
const fx = [];
function spawnExplosion(pos, color, count = 42, speed = 9) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), v = [];
  for (let i = 0; i < count; i++) {
    p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
    v.push(V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.25, 1) * speed));
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({
    color, size: 0.5, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  scene.add(pts);
  fx.push({ pts, v, life: 0.75 });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  flash.position.copy(pos);
  scene.add(flash);
  fx.push({ pts: flash, v: [], life: 0.22, flash: true });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) {
      scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose();
      fx.splice(i, 1); continue;
    }
    if (f.flash) { f.pts.scale.setScalar(1 + (0.22 - f.life) * 14); continue; }
    const a = f.pts.geometry.attributes.position;
    for (let j = 0; j < f.v.length; j++) {
      a.array[j * 3] += f.v[j].x * dt;
      a.array[j * 3 + 1] += f.v[j].y * dt - 6 * dt * (0.75 - f.life);
      a.array[j * 3 + 2] += f.v[j].z * dt;
    }
    a.needsUpdate = true;
    f.pts.material.opacity = f.life / 0.75;
  }
}

/* ---------------- game state ---------------- */
const G = {
  state: 'title',           // title | intro | playing | clear | over
  paused: false,
  score: 0, hi: lsGet(), next1up: 20000,
  lives: 2, stage: 0, t: 0,
  enemies: [], bullets: [], bombs: [], rescues: [],
  dual: false, invuln: 0, respawnT: 0,
  diveT: 3, shootT: 2, bossT: 9, activeCapture: null,
  bonusHits: 0, bonusActive: false, clearT: 0,
};

const player = {
  group: new THREE.Group(), x: 0, vx: 0,
  fighter: buildFighter(), fighter2: null,
  state: 'normal',          // normal | captured
  captureT: 0, captureFrom: V3(0,0,0), captureTo: V3(0,0,0),
};
player.group.add(player.fighter);
player.group.position.set(0, 1.2, PLAYER_Z);
scene.add(player.group);
const beam = buildBeam();

/* ---------------- HUD ---------------- */
const $ = id => document.getElementById(id);
const elScore = $('score'), elHi = $('hiscore'), elNext = $('nextScore');
const elBanner = $('banner'), elMsg = $('centerMsg'), elLives = $('lives');
const elStageNum = $('stageNum'), elStageEmb = $('stageEmblem');
const elOverlay = $('overlay'), elPaused = $('paused');

const pad = n => String(n).padStart(8, '0');
function addScore(n) {
  G.score += n;
  if (G.score > G.hi) { G.hi = G.score; lsSet(G.hi); }
  if (G.score >= G.next1up) { G.next1up += 20000; G.lives++; SFX.rescue(); }
}
function hud() {
  elScore.textContent = pad(G.score);
  elHi.textContent = pad(G.hi);
  elNext.textContent = pad(G.next1up);
  elLives.innerHTML = '';
  for (let i = 0; i < Math.min(G.lives, 5); i++) {
    const d = document.createElement('div'); d.className = 'life-ship'; elLives.appendChild(d);
  }
  elStageNum.textContent = 'STAGE ' + Math.max(1, G.stage);
  elStageEmb.style.background = '#' + EMBLEMS[(G.stage - 1 + 7) % EMBLEMS.length].toString(16).padStart(6, '0');
}
function banner(txt, ms, bonus) {
  elBanner.textContent = txt;
  elBanner.className = bonus ? 'bonus' : '';
  elBanner.style.display = 'block';
  setTimeout(() => elBanner.style.display = 'none', ms);
}
function msg(txt, ms, color = '#deffff') {
  elMsg.textContent = txt || '';
  elMsg.style.color = color;
  elMsg.style.display = txt ? 'block' : 'none';
  if (txt && ms) setTimeout(() => elMsg.style.display = 'none', ms);
}

/* ---------------- waves / formation ---------------- */
function entryCurve(style, side, target) {
  let pts;
  if (style === 'top') {
    pts = [V3(rand(-20, 20), 36, -80), V3(rand(-14, 14), 28, -50), V3(rand(-18, 18), 16, -34), target.clone()];
  } else if (style === 'toploop') {
    pts = [V3(side * 8, 36, -70), V3(side * 22, 22, -40), V3(side * 10, 12, -26), V3(-side * 12, 13, -30), target.clone()];
  } else { // sideloop
    pts = [V3(side * 42, rand(8, 16), -14), V3(side * 26, 16, -30), V3(side * 8, 12, -26), target.clone()];
  }
  return new THREE.CatmullRomCurve3(pts);
}

function spawnWave(stage) {
  G.enemies.forEach(e => scene.remove(e.obj));
  G.enemies = []; G.bullets.forEach(b => scene.remove(b.m)); G.bullets = [];
  G.bombs.forEach(b => scene.remove(b.m)); G.bombs = [];
  G.rescues.forEach(r => scene.remove(r.obj)); G.rescues = [];
  beam.visible = false; G.activeCapture = null;
  G.bonusActive = stage >= 3 && (stage - 3) % 4 === 0;
  G.bonusHits = 0;

  const plan = [];
  const nBoss = 4, nGoe = 8 + Math.min(2, Math.floor(stage / 3)), nZako = 16 + Math.min(8, 2 * stage);
  const rows = [];
  if (G.bonusActive) {
    const all = nBoss + nGoe + nZako;
    for (let i = 0; i < all; i++) plan.push({ type: i < nBoss ? 'boss' : i < nBoss + nGoe ? 'goeiu' : 'zako', row: 0, i, n: all });
  } else {
    rows.push({ type: 'boss', n: nBoss, y: 0 });
    rows.push({ type: 'goeiu', n: nGoe, y: -2.1 });
    rows.push({ type: 'zako', n: Math.ceil(nZako / 2), y: -4.2 });
    rows.push({ type: 'zako', n: nZako - Math.ceil(nZako / 2), y: -6.3 });
    rows.forEach((r, ri) => { for (let i = 0; i < r.n; i++) plan.push({ type: r.type, row: ri, i, n: r.n, y: r.y }); });
  }

  plan.forEach((p, idx) => {
    const obj = p.type === 'boss' ? buildBoss() : p.type === 'goeiu' ? buildButterfly() : buildBee();
    const grp = p.type === 'boss' ? 1 : (p.row >= 1 && !G.bonusActive) ? 0 : 2;
    const side = grp === 1 ? 1 : grp === 0 ? -1 : (idx % 2 ? 1 : -1);
    const slot = G.bonusActive
      ? V3(side * 60, rand(4, 12), 30)
      : V3((p.i - (p.n - 1) / 2) * 2.7, FC.y + p.y, FC.z + (p.row % 2) * 1.2);
    const style = G.bonusActive ? pick(['top', 'toploop', 'sideloop']) : ['toploop', 'toploop', 'sideloop', 'sideloop', 'top'][grp % 5];
    const e = {
      type: p.type, obj, slot, state: 'enter',
      t: -1 - (grp * 0.45 + p.i * 0.18),
      dur: (G.bonusActive ? rand(6, 7.5) : 5.2 - Math.min(1.5, stage * 0.12)) * rand(0.92, 1.08),
      curve: null, style, side,
      r: p.type === 'boss' ? 1.45 : p.type === 'goeiu' ? 1.2 : 1.05,
      capturedBy: null, capturedFighter: null,
      flap: rand(0, 6),
    };
    e.curve = entryCurve(style, side, slot);
    const p0 = e.curve.getPoint(0);
    obj.position.copy(p0);
    scene.add(obj);
    G.enemies.push(e);
  });
}

function slotPos(e) {
  const t = G.t;
  const fcx = FC.x + 3.2 * Math.sin(t * 0.17), fcz = FC.z + 5 * Math.sin(t * 0.22);
  const breathe = 1 + 0.07 * Math.sin(t * 0.5);
  const jx = 0.25 * Math.sin(t * 1.1 + e.flap * 7), jy = 0.2 * Math.sin(t * 1.3 + e.flap * 3);
  return V3(
    fcx + (e.slot.x - FC.x) * breathe + jx,
    FC.y + (e.slot.y - FC.y) + jy,
    fcz + (e.slot.z - FC.z)
  );
}

/* ---------------- dive / capture ---------------- */
function startDive(e, capture = false) {
  e.state = capture ? 'capture' : 'dive';
  const tx = THREE.MathUtils.clamp(player.x + rand(-2.5, 2.5), -PX, PX);
  const cur = e.obj.position.clone();
  let pts;
  if (capture) {
    pts = [cur, V3(cur.x + rand(-4, 4), 13, cur.z + 8), V3(tx, 9.5, 6), V3(tx, 9.5, 9)];
  } else {
    const ex = THREE.MathUtils.clamp(tx + rand(-4, 4), -PX - 2, PX + 2);
    pts = [cur, V3(cur.x + rand(-6, 6), Math.max(cur.y + 2, 13), cur.z + 5),
           V3(tx + rand(-3, 3), 6, 4), V3(tx, 1.6, PLAYER_Z), V3(ex, -4, 34)];
  }
  e.curve = new THREE.CatmullRomCurve3(pts);
  e.t = 0;
  e.dur = capture ? rand(2.6, 3.0) : Math.max(2.2, 4.2 - G.stage * 0.18) * rand(0.9, 1.1);
  e.bombT = rand(0.3, 0.9);
  e.captureOn = false;
  if (capture) { G.activeCapture = e; SFX.capture(); } else SFX.dive();
}

function throwBomb(pos) {
  const dir = V3((player.x - pos.x) * 0.6, -7, 24).normalize().multiplyScalar(rand(16, 20));
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: PAL.magenta }));
  m.position.copy(pos);
  scene.add(m);
  G.bombs.push({ m, vel: dir });
}

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  keys[e.code] = true;
  SFX.ensure();
  if (e.code === 'Enter' || (e.code === 'Space' && G.state === 'title')) startGame();
  if (e.code === 'KeyP' && (G.state === 'playing' || G.state === 'intro' || G.state === 'clear')) {
    G.paused = !G.paused;
    elPaused.style.display = G.paused ? 'flex' : 'none';
  }
});
addEventListener('keyup', e => keys[e.code] = false);

/* ---------------- flow ---------------- */
function startGame() {
  if (G.state !== 'title' && G.state !== 'over') return;
  elOverlay.classList.add('hidden');
  G.score = 0; G.lives = 2; G.stage = 0; G.dual = false;
  removeFighter2();
  respawnAtHome();
  nextStage();
}
function nextStage() {
  G.stage++;
  G.state = 'intro';
  G.invuln = 2;
  spawnWave(G.stage);
  if (G.bonusActive) banner('CHALLENGING STAGE', 2200, true);
  else banner('STAGE ' + G.stage, 1800);
  msg('READY', 1400);
  hud();
  setTimeout(() => { if (G.state === 'intro') G.state = 'playing'; }, 2000);
}
function stageClear() {
  G.state = 'clear';
  SFX.clear();
  if (G.bonusActive) {
    const b = 10000 + G.bonusHits * 100;
    addScore(b);
    msg('PERFECT !!  +' + b, 2400, '#ffff40');
  } else msg('STAGE CLEAR', 2200, '#00ffff');
  G.clearT = 2.6;
}
function gameOver() {
  G.state = 'over';
  msg('GAME OVER', 3000, '#ff4040');
  setTimeout(() => {
    if (G.state === 'over') {
      elOverlay.classList.remove('hidden');
      $('pressStart').textContent = 'PRESS ENTER — HI-SCORE ' + pad(G.hi);
    }
  }, 3000);
}

function respawnAtHome() {
  scene.add(player.group);            // re-parent if it was carried off by a boss
  player.group.position.set(0, 1.2, PLAYER_Z);
  player.group.rotation.set(0, 0, 0);
  player.group.visible = true;
  player.state = 'normal';
  player.x = 0; player.vx = 0;
  G.invuln = 2.5;
}

function removeFighter2() {
  if (player.fighter2) { player.group.remove(player.fighter2); player.fighter2 = null; }
  G.dual = false;
}
function addFighter2() {
  if (player.fighter2) return;
  player.fighter2 = buildFighter();
  player.fighter2.position.x = -1.6;
  player.group.add(player.fighter2);
  G.dual = true;
}

function hitPlayer() {
  if (G.invuln > 0 || player.state === 'captured' || G.state !== 'playing') return;
  const p = player.group.position.clone();
  spawnExplosion(p, PAL.cyan, 60, 12);
  SFX.boom();
  G.shake = 0.7;
  if (G.dual) {
    removeFighter2();
    G.invuln = 1.6;
    msg('DECOY FIGHTER LOST', 1200, '#ff9700');
    return;
  }
  player.group.visible = false;
  G.lives--;
  hud();
  if (G.lives < 0) { gameOver(); return; }
  G.respawnT = 1.6;
}

function playerCaptured(boss) {
  removeFighter2();   // decoy cannot be dragged off — it is lost
  player.state = 'captured';
  player.captureT = 0;
  player.captureFrom.copy(player.group.position);
  SFX.capture();
  msg('FIGHTER CAPTURED!', 1800, '#00e5ff');
  G.lives--;
  hud();
  G.shake = 0.5;
}

/* ---------------- collisions ---------------- */
const tmpV = new THREE.Vector3();
function fighterPos(f) { return f ? tmpV.copy(f.position).add(player.group.position) : player.group.position; }

function fire() {
  if (G.state !== 'playing' || G.bullets.length >= (G.dual ? 8 : 5)) return;
  if (player.cool > 0) return;
  player.cool = 0.16;
  SFX.fire();
  const xs = G.dual && player.fighter2 ? [-1.6, 0] : [0];
  for (const ox of xs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6),
      new THREE.MeshBasicMaterial({ color: PAL.white }));
    m.rotation.x = Math.PI / 2;
    m.position.set(player.x + ox, 1.4, PLAYER_Z - 1);
    scene.add(m);
    G.bullets.push({ m });
  }
}

function collisions() {
  // player bullets vs enemies
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    for (let j = G.enemies.length - 1; j >= 0; j--) {
      const e = G.enemies[j];
      if (e.state === 'dead') continue;
      if (b.m.position.distanceToSquared(e.obj.position) < e.r * e.r) {
        scene.remove(b.m); G.bullets.splice(i, 1);
        killEnemy(e);
        break;
      }
    }
  }
  if (G.state !== 'playing') return;
  // bombs vs player fighters
  const f1 = player.group.position, f2 = player.fighter2 ? fighterPos(player.fighter2) : null;
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const b = G.bombs[i];
    let hit = false;
    if (player.state === 'normal') {
      if (b.m.position.distanceToSquared(f2 || f1) < 1.0) hit = true;
      if (!hit && f2 && b.m.position.distanceToSquared(f1) < 1.0) { hit = true; }
    }
    if (hit) {
      scene.remove(b.m); G.bombs.splice(i, 1);
      const nearF2 = f2 && b.m.position.distanceToSquared(f2) < b.m.position.distanceToSquared(f1);
      if (f2 && nearF2) {
        spawnExplosion(f2.clone().setY(f2.y), PAL.cyan, 40, 10);
        SFX.boom();
        removeFighter2();
        G.invuln = 1.4;
        msg('DECOY FIGHTER LOST', 1200, '#ff9700');
      } else hitPlayer();
      break;
    }
  }
  // diving enemies vs player
  for (const e of G.enemies) {
    if ((e.state === 'dive') && e.obj.position.distanceToSquared(player.group.position) < 1.8) {
      killEnemy(e, true);
      hitPlayer();
      break;
    }
  }
}

function killEnemy(e, ram = false) {
  e.state = 'dead';
  let pts = e.type === 'boss' ? 150 : e.type === 'goeiu' ? 80 : 50;
  if (e.obj.position.z > -10 || ram) pts *= 2;
  const col = e.type === 'boss' ? PAL.purple : e.type === 'goeiu' ? PAL.red : PAL.yellow;
  spawnExplosion(e.obj.position.clone(), col, 46, 10);
  SFX.boom();
  scene.remove(e.obj);

  // captured fighter rescue
  if (e.capturedFighter) {
    const cf = e.capturedFighter;
    e.capturedFighter = null;
    if (e.obj.position.z > -6 && G.state === 'playing' && !player.fighter2 && G.lives >= 0) {
      const obj = buildFighter();
      obj.position.copy(e.obj.position);
      scene.add(obj);
      G.rescues.push({
        obj, t: 0, dur: rand(2.2, 2.8),
        curve: new THREE.CatmullRomCurve3([
          e.obj.position.clone(),
          V3(e.obj.position.x + rand(-6, 6), 12, 0),
          V3(rand(-6, 6), 8, 10),
          V3(player.x, 1.6, PLAYER_Z + 0.5),
        ]),
      });
      SFX.rescue();
      msg('FIGHTER RESCUED!', 1600, '#00ff80');
    } else {
      spawnExplosion(cf.position.clone().add(e.obj.position), PAL.cyan, 30, 8);
      scene.remove(cf);
    }
  }
  if (G.activeCapture === e) { beam.visible = false; G.activeCapture = null; }
  if (G.bonusActive) { G.bonusHits++; addScore(100); }
  else addScore(pts);
  hud();
}

/* ---------------- update ---------------- */
const clock = new THREE.Clock();
player.cool = 0;

function updatePlayer(dt) {
  if (player.state === 'captured') {
    player.captureT += dt;
    const k = Math.min(player.captureT / 1.4, 1);
    const target = G.activeCapture ? G.activeCapture.obj.position : player.captureFrom;
    player.group.position.lerpVectors(player.captureFrom, tmpV.copy(target).setY(target.y - 0.8), k);
    player.group.rotation.z += dt * 6;
    if (k >= 1 && G.activeCapture) {
      const boss = G.activeCapture;
      boss.state = 'formation';
      boss.capturedFighter = player.group;
      boss.obj.add(player.group);
      player.group.position.set(0, -1.4, 0.4);
      player.group.rotation.set(0, 0, 0);
      beam.visible = false;
      G.activeCapture = null;
      player.state = 'normal';
      player.group.visible = false;
      if (G.lives < 0) gameOver();
      else G.respawnT = 1.2;
    } else if (k >= 1 && !G.activeCapture) {
      // captor was shot down mid-transport — fighter flies home
      respawnAtHome();
      msg('FIGHTER RESCUED!', 1600, '#00ff80');
      SFX.rescue();
    }
    beam.position.copy(G.activeCapture ? G.activeCapture.obj.position : player.group.position);
    return;
  }

  if (!player.group.visible) {
    G.respawnT -= dt;
    if (G.respawnT <= 0 && G.lives >= 0 && (G.state === 'playing' || G.state === 'clear')) {
      respawnAtHome();
    }
    return;
  }

  const acc = 60, max = 17;
  let ax = 0;
  if (keys.ArrowLeft || keys.KeyA) ax -= acc;
  if (keys.ArrowRight || keys.KeyD) ax += acc;
  player.vx += ax * dt;
  if (ax === 0) player.vx *= Math.pow(0.0001, dt);
  player.vx = THREE.MathUtils.clamp(player.vx, -max, max);
  player.x = THREE.MathUtils.clamp(player.x + player.vx * dt, -PX, PX);
  player.group.position.x = player.x;
  player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, -player.vx / max * 0.45, 1 - Math.pow(0.001, dt));
  player.group.rotation.y = player.vx / max * 0.12;
  player.group.position.y = 1.2 + Math.sin(G.t * 2) * 0.08;

  const eng = player.fighter.getObjectByName('engine');
  if (eng) eng.scale.setScalar(1 + Math.sin(G.t * 30) * 0.3 + Math.abs(player.vx) * 0.04);

  if (G.invuln > 0) {
    G.invuln -= dt;
    player.group.visible = (G.t * 12 | 0) % 2 === 0;
    if (G.invuln <= 0) player.group.visible = true;
  }

  player.cool -= dt;
  if (keys.Space) fire();
}

function updateEnemies(dt) {
  const alive = [];
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.state === 'dead') { G.enemies.splice(i, 1); continue; }
    alive.push(e);

    const wings = e.obj.userData.wings;
    if (wings) {
      const s = Math.sin(G.t * 22 + e.flap * 9);
      wings[0].rotation.z = s * 0.5; wings[1].rotation.z = -s * 0.5;
      wings[0].position.y = 0.1 + s * 0.08; wings[1].position.y = 0.1 + s * 0.08;
    }

    if (e.state === 'enter') {
      e.t += dt / e.dur;
      if (e.t < 0) continue;
      const k = Math.min(e.t, 1);
      const p = e.curve.getPoint(k);
      e.obj.position.copy(p);
      const nx = e.curve.getPoint(Math.min(k + 0.02, 1));
      e.obj.lookAt(nx);
      if (k >= 1) {
        if (G.bonusActive) {   // flies off into the distance / past — bonus stage
          e.state = 'bonusExit';
          e.curve = new THREE.CatmullRomCurve3([
            p.clone(), V3(rand(-10,10), rand(2,8), 10), V3(rand(-30,30), rand(0,10), 50)]);
          e.t = 0; e.dur = 3;
        } else e.state = 'formation';
      }
    } else if (e.state === 'bonusExit') {
      e.t += dt / e.dur;
      if (e.t >= 1) { e.state = 'dead'; continue; }
      e.obj.position.copy(e.curve.getPoint(e.t));
      e.obj.lookAt(e.curve.getPoint(Math.min(e.t + 0.02, 1)));
    } else if (e.state === 'formation') {
      e.obj.position.lerp(slotPos(e), 1 - Math.pow(0.02, dt));
      e.obj.lookAt(tmpV.set(player.x, 2, PLAYER_Z));
    } else if (e.state === 'dive') {
      e.t += dt / e.dur;
      if (e.t >= 1) {   // escaped — return via new entry path
        e.state = 'enter';
        e.curve = entryCurve(e.style, e.side, slotPos(e));
        e.t = -rand(0.5, 1.2);
        e.dur = rand(4.5, 5.5);
        continue;
      }
      const k = e.t;
      e.obj.position.copy(e.curve.getPoint(k));
      e.obj.lookAt(e.curve.getPoint(Math.min(k + 0.015, 1)));
      e.bombT -= dt;
      if (e.bombT <= 0 && k > 0.2 && k < 0.8 && G.stage > 1 && G.enemies.length > 4) {
        e.bombT = rand(0.7, 1.6);
        throwBomb(e.obj.position);
      }
    } else if (e.state === 'capture') {
      e.t += dt / e.dur;
      const k = Math.min(e.t, 1);
      e.obj.position.copy(e.curve.getPoint(k));
      e.obj.lookAt(tmpV.set(player.x, e.obj.position.y, PLAYER_Z));
      if (k >= 1 && !e.captureOn) { e.captureOn = true; beam.visible = true; SFX.capture(); }
      if (e.captureOn) {
        beam.position.copy(e.obj.position);
        beam.position.y -= 6.6;
        beam.rotation.y += dt * 3;
        beam.material.opacity = 0.15 + 0.12 * Math.sin(G.t * 10);
        if (player.state === 'normal' && player.group.visible && G.invuln <= 0 &&
            G.state === 'playing' && Math.abs(player.x - e.obj.position.x) < 3.0 &&
            e.obj.position.z > 3) {
          playerCaptured(e);
        }
        if (G.t > (e.captureSince || (e.captureSince = G.t)) + 6) {
          e.state = 'dive'; e.t = 0; e.captureSince = null;
          G.activeCapture = null;
          e.curve = new THREE.CatmullRomCurve3([
            e.obj.position.clone(), V3(e.obj.position.x + rand(-6,6), 8, 14),
            V3(player.x, 1.6, PLAYER_Z), V3(player.x + rand(-4,4), -4, 34)]);
          e.dur = 3.2;
          beam.visible = false;
        }
      }
    }
  }

  // formation random fire
  G.shootT -= dt;
  if (G.shootT <= 0 && G.state === 'playing' && !G.bonusActive && G.stage > 1) {
    G.shootT = Math.max(0.7, 2.4 - G.stage * 0.12) * rand(0.7, 1.3);
    const shooters = G.enemies.filter(en => en.state === 'formation');
    if (shooters.length) throwBomb(pick(shooters).obj.position);
  }

  // dive scheduling
  if (G.state === 'playing' && !G.bonusActive) {
    G.diveT -= dt;
    if (G.diveT <= 0) {
      G.diveT = Math.max(1.1, 3.6 - G.stage * 0.25) * rand(0.7, 1.3);
      const cands = G.enemies.filter(en => en.state === 'formation' && en.type !== 'boss' && !en.capturedFighter);
      if (cands.length) startDive(pick(cands));
    }
    G.bossT -= dt;
    if (G.bossT <= 0) {
      G.bossT = rand(7, 13);
      const bosses = G.enemies.filter(en => en.state === 'formation' && en.type === 'boss');
      if (bosses.length) {
        const b = pick(bosses);
        const wantCapture = !G.activeCapture && player.state === 'normal' && player.group.visible && Math.random() < 0.55;
        startDive(b, wantCapture);
      }
    }
  }
}

function updateProjectiles(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.m.position.z -= 70 * dt;
    if (b.m.position.z < -90) { scene.remove(b.m); G.bullets.splice(i, 1); }
  }
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const b = G.bombs[i];
    b.m.position.addScaledVector(b.vel, dt);
    if (b.m.position.z > PLAYER_Z + 8 || b.m.position.y < -8) { scene.remove(b.m); G.bombs.splice(i, 1); }
  }
  for (let i = G.rescues.length - 1; i >= 0; i--) {
    const r = G.rescues[i];
    r.t += dt / r.dur;
    if (r.t >= 1) {
      scene.remove(r.obj); G.rescues.splice(i, 1);
      addFighter2();
      msg('DUAL FIGHTER!', 1600, '#00ff80');
      continue;
    }
    r.obj.position.copy(r.curve.getPoint(r.t));
    r.obj.lookAt(r.curve.getPoint(Math.min(r.t + 0.02, 1)));
  }
}

function updateCamera(dt) {
  G.shake = (G.shake || 0) * Math.pow(0.02, dt);
  const sx = (Math.random() - 0.5) * G.shake * 1.6, sy = (Math.random() - 0.5) * G.shake * 1.6;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.x * 0.18, 1 - Math.pow(0.01, dt)) + sx;
  camera.position.y = CAM_HOME.y + sy;
  camera.position.z = CAM_HOME.z;
  camera.lookAt(tmpV.copy(CAM_LOOK).setX(player.x * 0.12));
}

/* ---------------- main loop ---------------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.paused) return;
  G.t += dt;

  // stars drift toward camera for a sense of forward motion
  const sp = STARS.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    let z = sp.array[i * 3 + 2] + 2.5 * dt;
    if (z > 28) z = -150;
    sp.array[i * 3 + 2] = z;
  }
  sp.needsUpdate = true;

  shipLight.position.set(player.x, 3, PLAYER_Z - 1);

  if (G.state === 'playing' || G.state === 'intro' || G.state === 'clear') {
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    collisions();
    if (G.state === 'clear') {
      G.clearT -= dt;
      if (G.clearT <= 0) nextStage();
    } else if (G.state === 'playing' && G.enemies.length === 0) {
      stageClear();
    }
  }

  updateFx(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
hud();
requestAnimationFrame(loop);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
