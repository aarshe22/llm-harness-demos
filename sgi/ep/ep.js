// Electropaint engine — port of ep.c (David Tristram). A 128-slot ring buffer
// of slider samples; each frame the newest samples are drawn as triangles
// through the mirror-fold matrix walk, colours cycling the spectrum colormap
// (1988/89) or smooth HLS (1994), with optional smear/fade persistence.
import { createRenderer, hud, toast, spectrumColor, hlsToRgb, makeRand, THREE } from '../shared/sgi.js';

const NPNTS = 128, NCOLORS = 128, SQRT3 = Math.sqrt(3);
const TRI = [[0, 0], [0.2, 0], [0.1, SQRT3 / 10]];
const ID = { wrist: 101, spin: 80, flip: 87, arm: 94, twist: 38, wheel: 73, zoom: 31, size: 108, n: 52, outline: 18, hue: 123, light: 130 };

// ---------- Tristram's "mello script" + trapezoidal engine (epscript.c) ----------
const MELLO_SCRIPT = [
  'actset: 29, 1.0', 'actset: 17, 0.0', 'actset: 18, 1.0', 'actset: 31, 0.06',
  'actset: 38, 60.0', 'actset: 108, 1.2', 'actset: 52, 40.0',
  'seqdo: 1', 'seqdo: 2', 'seqdo: 3', 'seqdo: 4', 'seqdo: 5', 'seqdo: 6', 'seqdo: 7', 'seqdo: 8',
  'seqname: 1', 'duration: 160', 'actlim1: 101, -1.5', 'actlim2: 101,  1.5',
  'seqname: 2', 'duration: 60', 'actset: 127, 0.0',
  'actlim1: 123, 0.544053', 'actlim2: 123, 1.295',
  'duration: 80', 'actlim1: 130, 0.0', 'actlim2: 130, 1.0',
  'seqname: 3', 'duration: 120', 'actlim1: 73, 0.137', 'actlim2: 73, -0.137',
  'seqname: 4', 'duration: 100', 'actlim1: 80,  0.23', 'actlim2: 80, -0.23',
  'randdelay: 1000', 'duration: 40', 'actlim1: 80,  5.23', 'actlim2: 80, -5.23',
  'randdelay: 200', 'seqloop:',
  'seqname: 5', 'duration: 50', 'actlim1: 87,  2.0', 'actlim2: 87, -2.0',
  'randdelay: 1200', 'actlim1: 87,  10.0', 'actlim2: 87, -10.0',
  'randdelay: 220', 'seqloop:',
  'seqname: 6', 'duration: 90', 'actlim1: 94, -2.0', 'actlim2: 94,  2.0',
  'seqname: 7', 'duration: 2250', 'actlim1: 38, 200.0', 'actlim2: 38, -200.0',
  'seqname: 8', 'duration: 5000', 'actlim1: 18, 0.2', 'actlim2: 18, 1.0',
].join('\n');

function makeScript(rand) {
  const act = new Float64Array(256);
  const seqs = [];
  let cur = null, pend = { dur: 60, lim1: 0 };
  for (const raw of MELLO_SCRIPT.split('\n')) {
    let m;
    if ((m = raw.match(/^actset:\s*(\d+)\s*,\s*([-\d.]+)/))) act[+m[1]] = +m[2];
    else if ((m = raw.match(/^seqdo:\s*(\d+)/))) (seqs[+m[1]] ||= { steps: [], cur: 0, timer: 0, dlen: 0 }).active = 1;
    else if ((m = raw.match(/^seqname:\s*(\d+)/))) cur = (seqs[+m[1]] ||= { steps: [], cur: 0, timer: 0, dlen: 0 });
    else if ((m = raw.match(/^duration:\s*(\d+)/))) pend.dur = +m[1];
    else if ((m = raw.match(/^actlim1:\s*(\d+)\s*,\s*([-\d.]+)/))) pend = { dur: pend.dur, lim1: +m[2] };
    else if ((m = raw.match(/^actlim2:\s*(\d+)\s*,\s*([-\d.]+)/)))
      cur && cur.steps.push({ osc: 1, id: +m[1], lim1: pend.lim1, lim2: +m[2], dur: Math.max(1, pend.dur) });
    else if ((m = raw.match(/^randdelay:\s*(\d+)/))) cur && cur.steps.push({ osc: 0, dur: Math.max(1, +m[1]) });
  }
  const exprand = (n) => Math.max(0, Math.min(6 * n, Math.floor(-n * Math.log((rand() + 1) / (0x7fff + 2)))));
  for (const q of seqs) if (q && q.steps[0] && !q.steps[0].osc) q.dlen = exprand(q.steps[0].dur);
  const trap = (a, b, ph) => {
    ph = ((ph % 360) + 360) % 360;
    if (ph < 60) return a + (b - a) * (ph / 60);
    if (ph < 180) return b;
    if (ph < 240) return a + (b - a) * ((240 - ph) / 60);
    return a;
  };
  return {
    act,
    step() {
      for (const q of seqs) {
        if (!q || !q.active || !q.steps.length) continue;
        const st = q.steps[q.cur];
        let len;
        if (st.osc) { act[st.id] = trap(st.lim1, st.lim2, 360 * q.timer / st.dur); len = st.dur; }
        else len = q.dlen;
        if (++q.timer >= len) {
          q.timer = 0;
          if (++q.cur >= q.steps.length) q.cur = 0;
          if (!q.steps[q.cur].osc) q.dlen = exprand(q.steps[q.cur].dur);
        }
      }
    },
  };
}

// ep-1988: plain sliders steered by one slow LFO each (attractmode in ep.c).
function makeLFO() {
  let t = 0;
  const lfo = (p, lo, hi, ph) => lo + (hi - lo) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t / p + ph)));
  const act = new Float64Array(256);
  return {
    act,
    step() {
      t++;
      act[9] = lfo(70, 0.03, 0.10, 0);      // speed
      act[52] = lfo(90, 20, 80, 1);         // n
      act[31] = lfo(85, -0.25, 0.25, 2);    // zoom
      act[38] = lfo(55, -40, 40, 3);        // twist
      act[73] = lfo(65, -30, 30, 4);        // wheel
      act[80] = lfo(40, -12, 12, 5);        // spin
      act[87] = lfo(47, -12, 12, 6);        // flip
      act[94] = lfo(60, 0, 2.2, 0.7);       // arm
      act[101] = lfo(52, 0, 1.8, 1.4);      // wrist
      act[108] = lfo(75, 0.4, 2.5, 2.1);    // size
      act[116] = lfo(50, -6, 6, 2.8);       // maprate
      act[117] = lfo(80, 0, 40, 3.5);       // maprange
      act[18] = 1; act[123] = 0.5; act[130] = 0.5;
    },
  };
}

export function startEp({ mode = 1989 }) {
  const renderer = createRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000000);
  camera.position.z = 10; // polarview(10, 0, 0, 0)
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize', resize);

  const toastEl = hud({
    title: `Electropaint ${mode}`, author: 'David A. Tristram', year: mode,
    blurb: mode === 1988
      ? 'Panel Library v7, posted to comp.sys.sgi Aug 18 1988: four mirrored copies of a triangle stream steered by plain sliders under slow oscillators, spectrum colour-index map.'
      : mode === 1989
        ? 'IRIS GL Electropaint on Panel Library 9.6, driven by Tristram\u2019s own "mello" script: self-animating sliders, mirror-fold ribbons, spectrum colormap.'
        : 'The OpenGL screensaver of every idle IRIX desk: the default script in smooth HLS colour. M toggles the shipped 1994 look.',
    controls: 'O outline · I fat · U fill · R ribbon · Q smear · W fade · E bg · S stop' +
      (mode === 1994 ? ' · M look' : '') + ' · esc',
  });

  const rand = makeRand(42);
  const engine = mode === 1988 ? makeLFO() : makeScript(rand);
  const a = engine.act;
  const st = {
    n: 0, t: 0, wheel: 0, gflip: 0, gspin: 0, gcol: NCOLORS / 2,
    smear: true, fade: true, fill: true, outline: true, fatline: true,
    ribbons: false, stop: false, bgOn: false, look1994: mode !== 1994,
  };
  if (mode === 1994) { st.fill = true; st.look1994 = false; }

  const F = () => new Float64Array(NPNTS);
  const B = {
    x: F(), y: F(), arm: F(), wrist: F(), size: F(), maprange: F(),
    flip: F(), spin: F(), hue: F(), light: F(),
    outline: new Uint8Array(NPNTS),
  };

  // ---------- geometry pools ----------
  const MAXTRI = 4 * NPNTS;
  const fillPos = new Float32Array(MAXTRI * 9), fillCol = new Float32Array(MAXTRI * 9);
  const linePos = new Float32Array(MAXTRI * 18), lineCol = new Float32Array(MAXTRI * 18);
  const fillGeo = new THREE.BufferGeometry(), lineGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(fillPos, 3));
  fillGeo.setAttribute('color', new THREE.BufferAttribute(fillCol, 3));
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const fillMesh = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const lineMesh = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
  fillMesh.frustumCulled = lineMesh.frustumCulled = false;
  scene.add(fillMesh, lineMesh);

  const twixt = (arr, j, t) => arr[j] * t + arr[(j - 1 + NPNTS) % NPNTS] * (1 - t);
  const foldtwixt = (arr, j, t, range) => {
    const k = (j - 1 + NPNTS) % NPNTS, d = arr[j] - arr[k];
    if (d > range / 2) return arr[j] * t + (arr[k] + range) * (1 - t);
    if (d < -range / 2) return (arr[j] + range) * t + arr[k] * (1 - t);
    return arr[j] * t + arr[k] * (1 - t);
  };
  const wrap = (c) => { c %= NCOLORS; return c < 0 ? c + NCOLORS : c; };

  // ---------- keys ----------
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const map = {
      o: () => st.outline = !st.outline, i: () => st.fatline = !st.fatline,
      u: () => st.fill = !st.fill, r: () => st.ribbons = !st.ribbons,
      q: () => st.smear = !st.smear, w: () => st.fade = !st.fade,
      e: () => st.bgOn = !st.bgOn, s: () => st.stop = !st.stop,
      m: () => { if (mode === 1994) st.look1994 = !st.look1994; },
      escape: () => (location.href = '../'),
    };
    if (!map[k]) return;
    map[k]();
    if (k !== 'escape') toast(toastEl, `${k.toUpperCase()} → ${['outline', 'fat lines', 'fill', 'ribbon', 'smear', 'fade', 'background', 'stop', 'look 1994'][['o', 'i', 'u', 'r', 'q', 'w', 'e', 's', 'm'].indexOf(k)]}: ${({ o: st.outline, i: st.fatline, u: st.fill, r: st.ribbons, q: st.smear, w: st.fade, e: st.bgOn, s: st.stop, m: !st.look1994 })[k] ? 'on' : 'off'}`);
  });

  // ---------- drawit ----------
  const v = new THREE.Vector3();
  function drawit() {
    let fn = 0, ln = 0;
    const nlimit = Math.max(2, Math.min(NPNTS - 2, Math.floor(a[ID.n])));
    const mirrors = mode === 1994 && !st.look1994 ? 1 : 4;
    const Sx = new THREE.Matrix4().makeScale(1, -1, 1);
    const Rz180 = new THREE.Matrix4().makeRotationZ(Math.PI);
    const cur = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(st.wheel));
    let col = st.gcol;
    const deg = THREE.MathUtils.degToRad;

    for (let i = st.n; i > st.n - nlimit; i--) {
      const j = ((i % NPNTS) + NPNTS) % NPNTS;
      const tx = twixt(B.x, j, st.t), ty = twixt(B.y, j, st.t);
      const tarm = twixt(B.arm, j, st.t), twrist = twixt(B.wrist, j, st.t);
      const tsize = twixt(B.size, j, st.t);
      const tspin = foldtwixt(B.spin, j, st.t, 360), tflip = foldtwixt(B.flip, j, st.t, 360);
      let r, g, b, or, og, ob;
      if (mode === 1994 && !st.look1994) {
        const th = foldtwixt(B.hue, j, st.t, 1.0), tl = foldtwixt(B.light, j, st.t, 1.0);
        [r, g, b] = hlsToRgb(th, tl, 1);
        let h2 = th + 0.5; if (h2 > 1) h2 -= 1;
        [or, og, ob] = hlsToRgb(h2, 1 - tl, 1);
      } else {
        [r, g, b] = spectrumColor(wrap(col), NCOLORS);
        [or, og, ob] = spectrumColor(wrap(col + NCOLORS / 2), NCOLORS);
        col -= B.maprange[j];
      }
      const sample = new THREE.Matrix4()
        .makeTranslation(tx, ty, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(deg(tspin)))
        .multiply(new THREE.Matrix4().makeTranslation(0, tarm, 0))
        .multiply(new THREE.Matrix4().makeRotationY(deg(tflip)))
        .multiply(new THREE.Matrix4().makeTranslation(twrist, 0, 0))
        .multiply(new THREE.Matrix4().makeScale(tsize, tsize, 1));

      const accs = [cur];
      if (mirrors > 1) accs.push(cur.clone().multiply(Sx), cur.clone().multiply(Sx).multiply(Rz180), cur.clone().multiply(Sx).multiply(Rz180).multiply(Sx));
      for (const ac of accs) {
        const m = ac.clone().multiply(sample);
        const pts = TRI.map(p => v.set(p[0], p[1], 0).applyMatrix4(m).clone());
        if (st.fill && fn < MAXTRI - 1) {
          const o = fn * 9;
          pts.forEach((p, i2) => {
            fillPos[o + i2 * 3] = p.x; fillPos[o + i2 * 3 + 1] = p.y; fillPos[o + i2 * 3 + 2] = p.z;
            fillCol[o + i2 * 3] = r; fillCol[o + i2 * 3 + 1] = g; fillCol[o + i2 * 3 + 2] = b;
          });
          fn++;
        }
        if ((st.outline && B.outline[j]) && ln < MAXTRI - 1) {
          const o = ln * 18, seq = [0, 1, 1, 2, 2, 0];
          seq.forEach((vi, k) => {
            linePos[o + k * 3] = pts[vi].x; linePos[o + k * 3 + 1] = pts[vi].y; linePos[o + k * 3 + 2] = pts[vi].z;
            lineCol[o + k * 3] = or; lineCol[o + k * 3 + 1] = og; lineCol[o + k * 3 + 2] = ob;
          });
          ln++;
        }
      }
      cur.multiply(Sx).multiply(Rz180).multiply(Sx); // == cur * Rz180
    }
    fillGeo.setDrawRange(0, fn * 3);
    lineGeo.setDrawRange(0, ln * 6);
    fillGeo.attributes.position.needsUpdate = lineGeo.attributes.position.needsUpdate = true;
    fillGeo.attributes.color.needsUpdate = lineGeo.attributes.color.needsUpdate = true;
    fillMesh.visible = st.fill;
    lineMesh.visible = !(!st.outline && st.fill);
  }

  // ---------- smear / fade persistence ----------
  const dpr = Math.min(devicePixelRatio, 2);
  const rt = new THREE.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fadeScene = new THREE.Scene();
  const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.08, depthTest: false }));
  fadeQuad.frustumCulled = false;
  fadeScene.add(fadeQuad);
  const outScene = new THREE.Scene();
  const outQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ depthTest: false }));
  outQuad.frustumCulled = false;
  outScene.add(outQuad);

  let bkgCol = new THREE.Color(0);
  renderer.setAnimationLoop(() => {
    if (st.stop) { render(); return; }
    engine.step();
    const speed = mode === 1988 ? Math.max(0.03, a[9]) : 1.0;
    const maprate = mode === 1988 ? a[116] : 0.4;
    const maprange = mode === 1988 ? a[117] : 18.0;

    st.t += speed;
    let newn = false;
    if (st.t >= 1.0) newn = true;
    st.n += Math.floor(st.t);
    st.t %= 1.0;
    const j = ((st.n % NPNTS) + NPNTS) % NPNTS;
    B.x[j] = 0; B.y[j] = 0;
    B.arm[j] = Math.max(0, a[ID.arm]);
    B.wrist[j] = a[ID.wrist];
    B.size[j] = Math.max(0.05, a[ID.size]);
    B.maprange[j] = maprange;
    B.hue[j] = ((a[ID.hue] % 1) + 1) % 1;
    B.light[j] = Math.min(0.95, Math.max(0.05, 0.1 + 0.8 * (((a[ID.light] % 1) + 1) % 1)));
    B.outline[j] = a[ID.outline] > 0.5 ? 1 : 0;
    st.gcol = wrap(st.gcol + speed * maprate);
    if (newn) {
      st.gflip = (st.gflip + a[ID.flip]) % 360;
      st.gspin = (st.gspin + a[ID.spin]) % 360;
      B.flip[j] = st.gflip; B.spin[j] = st.gspin;
    }
    st.wheel = ((st.wheel - speed * a[ID.wheel]) % 360 + 360) % 360;

    const bgIdx = wrap(st.gcol + NCOLORS / 2);
    bkgCol = st.bgOn ? new THREE.Color(...spectrumColor(bgIdx, NCOLORS)) : new THREE.Color(0);

    drawit();
    render();
  });

  function render() {
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    if (!st.smear) {
      scene.background = bkgCol;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } else {
      scene.background = null;
      renderer.setRenderTarget(rt);
      renderer.autoClear = false;
      fadeQuad.material.color.copy(bkgCol);
      fadeQuad.material.opacity = st.fade ? 0.016 : 0.004;
      fadeQuad.visible = true;
      renderer.render(fadeScene, quadCam);       // fadebackground
      renderer.render(scene, camera);            // drawit into the buffer
      renderer.autoClear = true;
      renderer.setRenderTarget(null);
      outQuad.material.map = rt.texture;
      renderer.render(outScene, quadCam);
    }
  }
}
