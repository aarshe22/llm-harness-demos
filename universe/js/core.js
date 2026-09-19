/* =========================================================================
 * Voxel Cosmos — core.js
 * Namespace, deterministic RNG, world layout constants, quality presets,
 * shared geometry/material caches, instancing pools, canvas textures,
 * HTML labels and small utilities. Everything hangs off window.VC.
 * ========================================================================= */
(function () {
  'use strict';

  var VC = (window.VC = window.VC || {});
  VC.version = '1.0.0';

  /* ---------------- tiny event bus ---------------- */
  var listeners = {};
  VC.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); };
  VC.emit = function (evt, data) {
    var arr = listeners[evt];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) { try { arr[i](data); } catch (e) { console.error(e); } }
  };

  /* ---------------- deterministic RNG (mulberry32) ---------------- */
  VC.makeRng = function (seed) {
    var a = seed >>> 0;
    var f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (lo, hi) { return lo + (hi - lo) * f(); };
    f.int = function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * f()); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.chance = function (p) { return f() < p; };
    return f;
  };

  /* ---------------- math helpers ---------------- */
  VC.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  VC.lerp = function (a, b, t) { return a + (b - a) * t; };
  VC.smoothstep = function (t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); };
  VC.easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  VC.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  VC.damp = function (cur, target, lambda, dt) { return VC.lerp(cur, target, 1 - Math.exp(-lambda * dt)); };
  VC.shortestAngle = function (from, to) {
    var d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /* =====================================================================
   * WORLD LAYOUT  (single source of truth for the vertical universe)
   * ===================================================================== */
  VC.RADIUS = 150;
  VC.LEVELS = {
    HELL_GATES_Y: 10,
    CIRCLE_TOP_Y: 2,          // rim of the abyss at circle 1
    CIRCLE_DROP: 7.2,         // vertical drop between circles
    CIRCLE_SHRINK: 13.5,      // radius shrink between circles
    SATAN_Y: -62,
    EARTH_Y: 34,              // reference plain level of Earth
    STAIR_TOP_Y: 104,         // Pearly Gates level
    HEAVEN_BASE_Y: 100,
    CASTLE_Y: 126
  };

  VC.CIRCLES = [
    { n: 1, name: 'Limbo',      icon: '🏛', color: 0x8a7fb0, y: -4,   desc: 'The virtuous unbaptized dwell in sorrowful mist beneath a dim castle of the great poets — desire without hope.' },
    { n: 2, name: 'Lust',       icon: '🌪', color: 0xb04a6a, y: -11,  desc: 'The storm that never rests whirls the lustful through black air, as they yielded to passion in life.' },
    { n: 3, name: 'Gluttony',   icon: '🌧', color: 0x5a7a3a, y: -18,  desc: 'Ice-cold rain, hail and foul sludge beat upon the gluttons; Cerberus, the cruel three-mouthed dog, fangs them.' },
    { n: 4, name: 'Greed',      icon: '💰', color: 0xc9a227, y: -25,  desc: 'Hoarding and squandering push vast weights against one another, and cry out — what riches avail?' },
    { n: 5, name: 'Wrath',      icon: '⚔', color: 0x9a3a2a, y: -32,  desc: 'In the stagnant marsh of Styx they strike each other in mud, and beneath the water sigh great bubbles of grief.' },
    { n: 6, name: 'Heresy',     icon: '🔥', color: 0xc25a2a, y: -39,  desc: 'The city of Dis blazes; open tombs hold the heresiarchs, glowing red as the irons of the burial vaults.' },
    { n: 7, name: 'Violence',   icon: '🌲', color: 0x7a2a1e, y: -46,  desc: 'Hot sand falls like snow on the burning desert; the violent bleed in the wood of suicides, and blood boils in Phlegethon.' },
    { n: 8, name: 'Fraud',      icon: '🕸', color: 0x6a4a8a, y: -53,  desc: 'Evil Trench coils in stone spokes: the flatterers, the simoniacs, the thieves — fraud, the evil that harms another.' },
    { n: 9, name: 'Treachery',  icon: '❄', color: 0x4a7ab0, y: -60,  desc: 'The lake Cocytus is glass-cold. Traitors sit buried in ice, and at its centre the greatest sinners are frozen.' }
  ];
  VC.circleRadius = function (idx) { return VC.RADIUS - 16 - idx * VC.LEVELS.CIRCLE_SHRINK; }; // idx 0..8

  /* =====================================================================
   * QUALITY PRESETS
   * ===================================================================== */
  VC.QUALITIES = {
    low:    { dprMax: 1.0, scale: 0.40, shadows: false, shadowSize: 1024, particles: 0.45, clouds: 0.5,  maxLights: 3,  labelDivs: 14, starCount: 400,  fogNear: 90 },
    medium: { dprMax: 1.5, scale: 0.78, shadows: true,  shadowSize: 2048, particles: 0.85, clouds: 0.85, maxLights: 5,  labelDivs: 22, starCount: 900,  fogNear: 120 },
    high:   { dprMax: 2.0, scale: 1.00, shadows: true,  shadowSize: 2048, particles: 1.25, clouds: 1.0,  maxLights: 8,  labelDivs: 30, starCount: 1600, fogNear: 150 }
  };
  VC.quality = 'medium';
  VC.setQuality = function (q) {
    if (!VC.QUALITIES[q]) return;
    VC.quality = q;
    VC.emit('quality', q);
  };

  /* Population scaling helper used by all builders */
  VC.pop = function (n) {
    return Math.max(1, Math.round(n * VC.QUALITIES[VC.quality].scale));
  };

  /* Reduced motion flag */
  VC.reducedMotion = false;
  VC.motionFactor = function () { return VC.reducedMotion ? 0.22 : 1.0; };

  /* =====================================================================
   * SHARED GEOMETRY / MATERIAL / TEXTURE REGISTRY
   * ===================================================================== */
  var geoCache = {};
  VC.box = function (w, h, d) {
    var k = 'b' + w + '_' + h + '_' + d;
    if (!geoCache[k]) geoCache[k] = new THREE.BoxGeometry(w, h, d);
    return geoCache[k];
  };
  VC.boxGeo = function (w, h, d) { return new THREE.BoxGeometry(w, h, d); };
  VC.plane = function (w, h) {
    var k = 'p' + w + '_' + h;
    if (!geoCache[k]) geoCache[k] = new THREE.PlaneGeometry(w, h);
    return geoCache[k];
  };
  VC.cyl = function (rt, rb, h, seg) {
    seg = seg || 8;
    var k = 'c' + rt + '_' + rb + '_' + h + '_' + seg;
    if (!geoCache[k]) geoCache[k] = new THREE.CylinderGeometry(rt, rb, h, seg);
    return geoCache[k];
  };
  VC.cylGeo = function (rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 8); };
  VC.sphere = function (r, wseg, hseg) {
    wseg = wseg || 8; hseg = hseg || 6;
    var k = 's' + r + '_' + wseg + '_' + hseg;
    if (!geoCache[k]) geoCache[k] = new THREE.SphereGeometry(r, wseg, hseg);
    return geoCache[k];
  };
  VC.sphereGeo = function (r, wseg, hseg) { return new THREE.SphereGeometry(r, wseg || 8, hseg || 6); };
  VC.cone = function (r, h, seg) {
    seg = seg || 6;
    var k = 'k' + r + '_' + h + '_' + seg;
    if (!geoCache[k]) geoCache[k] = new THREE.ConeGeometry(r, h, seg);
    return geoCache[k];
  };
  VC.torus = function (r, tube, rseg, tseg) {
    var k = 't' + r + '_' + tube + '_' + rseg + '_' + tseg;
    if (!geoCache[k]) geoCache[k] = new THREE.TorusGeometry(r, tube, rseg || 6, tseg || 10, Math.PI);
    return geoCache[k];
  };
  VC.ico = function (r, det) {
    var k = 'i' + r + '_' + det;
    if (!geoCache[k]) geoCache[k] = new THREE.IcosahedronGeometry(r, det || 0);
    return geoCache[k];
  };

  /* Lambert material cache (flat voxel look) */
  var lambertCache = {};
  VC.mc = function (color, emissive) {
    var k = 'm' + color + '_' + (emissive || 0);
    if (!lambertCache[k]) {
      lambertCache[k] = new THREE.MeshLambertMaterial({ color: color });
      if (emissive) lambertCache[k].emissive = new THREE.Color(emissive);
    }
    return lambertCache[k];
  };
  VC.mcOpaque = function (color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color: color }, opts || {}));
  };
  VC.emissive = function (color, intensity) {
    intensity = intensity === undefined ? 1 : intensity;
    var c = new THREE.Color(color).multiplyScalar(intensity).getHex();
    return new THREE.MeshBasicMaterial({ color: c });
  };
  VC.basic = function (color, opacity, additive) {
    var m = new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity !== undefined && opacity < 1,
      opacity: opacity === undefined ? 1 : opacity,
      depthWrite: opacity === undefined || opacity >= 1
    });
    if (additive) { m.blending = THREE.AdditiveBlending; m.depthWrite = false; }
    return m;
  };
  VC.standard = function (color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: color, roughness: 0.85, metalness: 0.05, flatShading: true
    }, opts || {}));
  };

  /* Time-aware materials: builders register which registry slot to use, so
     time-of-day can recolour windows/lights across the world in one pass. */
  VC.timeMats = { windowsWarm: [], streetGlow: [], runway: [], stairGlow: [], pearlGlow: [], castleGlow: [], hellGlow: [] };
  VC.registerTimeMat = function (slot, mat, dayEmissive, nightEmissive) {
    mat.userData.dayEm = new THREE.Color(dayEmissive === undefined ? 0x000000 : dayEmissive);
    mat.userData.nightEm = new THREE.Color(nightEmissive === undefined ? 0xffffff : nightEmissive);
    mat.userData.baseColor = mat.color.clone();
    mat.userData.isTime = true;
    VC.timeMats[slot].push(mat);
    return mat;
  };

  /* ---------------- canvas textures ---------------- */
  var texCache = {};
  function makeCanvas(size, draw) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    draw(g, size);
    return c;
  }
  VC.softDisc = function () {
    if (texCache.soft) return texCache.soft;
    var c = makeCanvas(64, function (g, s) {
      var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    var t = new THREE.CanvasTexture(c);
    texCache.soft = t;
    return t;
  };
  VC.textPlacard = function (text, opts) {
    opts = opts || {};
    var key = 't' + text + JSON.stringify(opts);
    if (texCache[key]) return texCache[key];
    var w = 512, h = 128;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = opts.bg || 'rgba(12,10,16,0.72)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = opts.line || 'rgba(255,255,255,0.25)';
    g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = opts.fg || '#ffe9c8';
    g.font = (opts.font || 'bold 44px') + ' "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(opts.icon ? (opts.icon + '  ') + text : text, w / 2, h / 2 + 2);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 2;
    texCache[key] = t;
    return t;
  };
  VC.banner = function (text, sub, opts) {
    opts = opts || {};
    var key = 'bn' + text + sub + JSON.stringify(opts);
    if (texCache[key]) return texCache[key];
    var w = 512, h = 256;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = opts.bg || 'rgba(10,8,14,0.8)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = opts.line || 'rgba(255,215,140,0.5)';
    g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = 'center';
    g.fillStyle = opts.fg || '#ffca9a';
    g.font = 'bold 54px Georgia, "Times New Roman", serif';
    g.fillText(text, w / 2, h * 0.42);
    if (sub) {
      g.fillStyle = opts.fg2 || 'rgba(255,255,255,0.75)';
      g.font = 'italic 28px Georgia, serif';
      g.fillText(sub, w / 2, h * 0.70);
    }
    var t = new THREE.CanvasTexture(c);
    texCache[key] = t;
    return t;
  };
  VC.windowTexture = function () {
    if (texCache.win) return texCache.win;
    var rng = VC.makeRng(1234);
    var c = makeCanvas(64, function (g, s) {
      g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#fff';
      for (var y = 4; y < s - 6; y += 12) {
        for (var x = 4; x < s - 6; x += 10) {
          if (rng() < 0.62) g.fillRect(x, y, 6, 8);
        }
      }
    });
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    texCache.win = t;
    return t;
  };

  /* =====================================================================
   * INSTANCED POOL — build once, set matrices, animate cheaply
   * ===================================================================== */
  VC.InstPool = function (geo, mat, count, name) {
    this.max = count;
    this.n = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.name = name || 'pool';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dummy = new THREE.Object3D();
    this.data = [];
    this.rebuild = null;
  };
  VC.InstPool.prototype.add = function (pos, rot, scale, data) {
    if (this.n >= this.max) return null;
    var d = this.dummy;
    d.position.copy(pos);
    if (rot) d.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0); else d.rotation.set(0, 0, 0);
    if (scale) d.scale.copy(scale); else d.scale.set(1, 1, 1);
    d.updateMatrix();
    this.mesh.setMatrixAt(this.n, d.matrix);
    this.data.push(data || null);
    this.n++;
    this.countDirty = true;
    return this.n - 1;
  };
  VC.InstPool.prototype.setAt = function (i, pos, rot, scale) {
    var d = this.dummy;
    d.position.copy(pos);
    if (rot) d.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    if (scale) d.scale.copy(scale);
    d.updateMatrix();
    this.mesh.setMatrixAt(i, d.matrix);
    this.matDirty = true;
  };
  VC.InstPool.prototype.setColorAt = function (i, color) {
    this.mesh.setColorAt(i, color);
    this.colDirty = true;
  };
  VC.InstPool.prototype.flush = function () {
    this.mesh.count = this.n;
    if (this.n === 0) { this.mesh.visible = false; return; }
    if (this.countDirty || this.matDirty) { this.mesh.instanceMatrix.needsUpdate = true; this.matDirty = false; this.countDirty = false; }
    if (this.colDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.colDirty = false; }
  };

  /* =====================================================================
   * HTML LABELS (3D-anchored divs)
   * ===================================================================== */
  VC.labels = [];
  VC.addLabel = function (text, worldPos, opts) {
    opts = opts || {};
    var div = document.createElement('div');
    div.className = 'label-3d' + (opts.realm ? ' realm-' + opts.realm : '') + (opts.major ? ' major' : '');
    div.textContent = (opts.icon ? opts.icon + ' ' : '') + text;
    document.getElementById('app').appendChild(div);
    VC.labels.push({
      el: div, pos: worldPos.clone(),
      maxDist: opts.maxDist || 420, group: opts.group || 'poi'
    });
    return div;
  };

  /* =====================================================================
   * BOOT PROGRESS
   * ===================================================================== */
  VC.boot = {
    tasks: [],
    add: function (msg, fn, cost) { this.tasks.push({ msg: msg, fn: fn, cost: cost || 1 }); },
    run: function (done) {
      var self = this;
      var total = 0, acc = 0;
      this.tasks.forEach(function (t) { total += t.cost; });
      var fill = document.getElementById('loading-fill');
      var msgEl = document.getElementById('loading-msg');
      var i = 0;
      function step() {
        if (i >= self.tasks.length) { done(); return; }
        var t = self.tasks[i++];
        msgEl.textContent = t.msg;
        acc += t.cost;
        fill.style.width = Math.round(100 * acc / total) + '%';
        setTimeout(function () {
          try {
            t.fn();
          } catch (e) {
            console.error('Boot task failed:', t.msg, e);
            var err = document.getElementById('loading-err');
            err.classList.remove('hidden');
            err.textContent = 'World generation warning: ' + t.msg + ' — ' + e.message;
          }
          step();
        }, 0);
      }
      step();
    }
  };

  /* =====================================================================
   * SCENE HANDLES (filled by main.js)
   * ===================================================================== */
  VC.scene = null; VC.camera = null; VC.renderer = null; VC.controls = null; VC.clock = null;
  VC.world = new THREE.Group();
  VC.realms = { hell: new THREE.Group(), earth: new THREE.Group(), stair: new THREE.Group(), heaven: new THREE.Group() };
  VC.world.add(VC.realms.hell, VC.realms.earth, VC.realms.stair, VC.realms.heaven);

  VC.animators = [];
  VC.registerAnimator = function (fn, realm) { VC.animators.push({ fn: fn, realm: realm || null }); };
  VC.animated = { cerberus: null, satan: null, peter: null, dragons: [], gates: { hell: null, pearl: null } };
}());
