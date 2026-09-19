/* =========================================================================
 * Voxel Cosmos — nav.js
 * VC.PLACES: shared landmark coordinates (single source for builders & POIs).
 * VC.destinations: every navigable point (target, camera pos, title, desc).
 * VC.nav: guided camera flights with terrain clearance (corridor sampling),
 * realm detection, destination cycling and 3D label projection.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  /* ---------------- landmark layout ---------------- */
  var L = VC.LEVELS;
  var E = L.EARTH_Y;
  VC.PLACES = {
    earth: { y: E },
    city:     { x: 6, z: 8, y: E + 1 },
    oldtown:  { x: -34, z: -2, y: E + 1 },
    airport:  { x: -78, z: 72, y: E + 1 },
    volcano:  { x: -108, z: -68, y: E },
    peaks:    { x: 92, z: -88, y: E },
    farm:     { x: 78, z: 30, y: E + 1 },
    windmill: { x: 97, z: 12, y: E + 1 },
    waterfall:{ x: 124, z: 58, y: E },
    forest:   { x: 118, z: -18, y: E + 1 },
    bridge:   { x: 92, z: 66, y: E + 1 },
    lake:     { x: 120, z: 92, y: E - 1 },
    riverN:   { x: 150, z: 140, y: E - 1 },   // river origin (mountains)
    stairBase:{ x: 0, z: 176, y: E },
    pier:     { x: -8, z: 138, y: E - 1 }
  };
  VC.RIVER = {
    fn: function (z) { return 0.55 * Math.sin(z * 0.018) + 0.3 * Math.sin(z * 0.006 + 1.7); },
    mouthZ: -170, sourceZ: 145
  };

  /* ---------------- destinations ---------------- */
  function cY(i) { return VC.CIRCLES[i].y; }
  function cR(i) { return VC.circleRadius(i); }
  function at(i, angFrac) {
    var a = angFrac * Math.PI * 2;
    var r = cR(i) - 6.75;           /* middle of the terrace band */
    return [Math.cos(a) * r, cY(i), Math.sin(a) * r];
  }
  function P(name) { return [VC.PLACES[name].x, VC.PLACES[name].y, VC.PLACES[name].z]; }

  var D = [];
  function dest(o) { D.push(o); return o; }

  dest({ id: 'universe', realm: 'space', group: 'overview', icon: '🌌', title: 'The Three Realms',
    desc: 'One continuous vertical cosmos: the nine circles of Hell below, the living world of Earth, and the Kingdom of Heaven above, joined by the Stairway.',
    target: [0, 24, 0], pos: [0, 44, 390] });

  /* ---- Hell ---- */
  dest({ id: 'cerberus', realm: 'hell', group: 'hell', icon: '🐕', special: 'cerberus', major: true,
    title: 'Cerberus and the Gates of Hell',
    desc: '“Lasciate ogne speranza, voi ch\u2019intrate.” The three-throated guardian sleeps before the bronze gates, chained to black stone pillars — but your coming has woken him.',
    target: [0, L.HELL_GATES_Y + 4, -116], pos: [0, L.HELL_GATES_Y + 12, -78] });
  VC.CIRCLES.forEach(function (c, i) {
    var angles = [0.08, 0.32, 0.55, 0.78, 0.18, 0.42, 0.65, 0.88, 0.5];
    var p = at(i, angles[i]);
    var dl = Math.hypot(p[0], p[2]) || 1;
    var ox = p[0] / dl, oz = p[2] / dl;
    dest({ id: 'circle' + c.n, realm: 'hell', group: 'hell', icon: c.icon, circle: i, major: true,
      title: 'Circle ' + ['I','II','III','IV','V','VI','VII','VIII','IX'][i] + ' — ' + c.name,
      desc: c.desc,
      target: p, pos: [p[0] + ox * 22, p[1] + 14, p[2] + oz * 22] });
  });
  dest({ id: 'acheron', realm: 'hell', group: 'hell', icon: '⛵',
    title: 'The River Acheron & Charon’s Ferry',
    desc: 'Old Charon, eyes of whirling ember, poles his bark across the dark water, ferrying each soul to its fitting circle.',
    target: [-9, -0.5, 119], pos: [6, 9, 152] });
  dest({ id: 'minos', realm: 'hell', group: 'hell', icon: '⚖',
    title: 'Minos the Judge',
    desc: 'At the entrance of the second circle Minos counts the sins of every shade and coils his tail to assign its degree.',
    target: [91, -9.5, 65], pos: [116, 3, 84] });
  dest({ id: 'dragon', realm: 'hell', group: 'hell', icon: '🐉', major: true,
    title: 'The Fire-Dragon of the Abyss',
    desc: 'A monstrous wyrm of basalt and flame laps the whole abyss in slow flight, raining ember and voxel fire upon the circles.',
    target: [100, 4, 156], pos: [150, 16, 214] });
  dest({ id: 'satan', realm: 'hell', group: 'hell', icon: '😈', major: true, special: 'satan',
    title: 'Satan’s Throne at the Bottom of the World',
    desc: 'The Emperour of the woeful kingdom sits frozen in the lake of Cocytus, three faces weeping, beating six bat wings — the centre of all sin.',
    target: [0, -57, 0], pos: [0, -47, 58] });

  /* ---- Earth ---- */
  dest({ id: 'earth', realm: 'earth', group: 'earth', icon: '🌍', major: true,
    title: 'Earth Overview',
    desc: 'The middle realm: mountains, rivers, farmland and the busy human world of the capital city, harbouring the foot of the sacred Stairway.',
    target: [0, E + 6, 10], pos: [0, E + 62, 240] });
  dest({ id: 'city', realm: 'earth', group: 'earth', icon: '🏙', major: true,
    title: 'The Capital City',
    desc: 'Towers, shops and civic blocks grid around avenues and parks; cars, buses and pedestrians move while the airport hums beyond.',
    target: P('city').slice(), pos: [VC.PLACES.city.x - 66, E + 38, VC.PLACES.city.z + 96] });
  dest({ id: 'oldtown', realm: 'earth', group: 'earth', icon: '🏘',
    title: 'The Old Town',
    desc: 'Timber-and-plaster houses, a market square, cobbles and lampposts — the quiet quarter that predates the towers.',
    target: P('oldtown').slice(), pos: [VC.PLACES.oldtown.x - 30, E + 18, VC.PLACES.oldtown.z + 42] });
  dest({ id: 'apark', realm: 'earth', group: 'earth', icon: '🛫', major: true,
    title: 'Airport Terminal',
    desc: 'A glass terminal, apron and hangars beside the runway. Watch the airliner lift off toward the horizon.',
    target: [VC.PLACES.airport.x, E + 6, VC.PLACES.airport.z], pos: [VC.PLACES.airport.x - 30, E + 16, VC.PLACES.airport.z + 58] });
  dest({ id: 'tower', realm: 'earth', group: 'earth', icon: '🗼',
    title: 'Airport Control Tower',
    desc: 'The watch tower’s glass cab sweeps its view across runways lit by lines of lamps after dark.',
    target: [VC.PLACES.airport.x + 26, E + 16, VC.PLACES.airport.z - 6], pos: [VC.PLACES.airport.x + 44, E + 20, VC.PLACES.airport.z + 18] });
  dest({ id: 'volcano', realm: 'earth', group: 'earth', icon: '🌋', major: true,
    title: 'The Volcano Summit',
    desc: 'Mount Voxelius vents smoke and, at intervals, erupts fountains of incandescent rock down its flanks.',
    target: [VC.PLACES.volcano.x, E + 30, VC.PLACES.volcano.z], pos: [VC.PLACES.volcano.x + 46, E + 46, VC.PLACES.volcano.z + 52] });
  dest({ id: 'peaks', realm: 'earth', group: 'earth', icon: '🏔',
    title: 'Mountain Overlook',
    desc: 'Snow-capped ranges where the rivers are born, waterfalls step down to the plains, and eagles wheel above the pines.',
    target: [VC.PLACES.peaks.x, E + 34, VC.PLACES.peaks.z], pos: [VC.PLACES.peaks.x + 52, E + 52, VC.PLACES.peaks.z + 62] });
  dest({ id: 'farm', realm: 'earth', group: 'earth', icon: '🚜',
    title: 'The Farm',
    desc: 'Fenced fields of wheat and vegetables, a red barn, a silo, and cows, ducks, cats and dogs about their day.',
    target: P('farm').slice(), pos: [VC.PLACES.farm.x - 34, E + 16, VC.PLACES.farm.z + 46] });
  dest({ id: 'windmill', realm: 'earth', group: 'earth', icon: '🌬',
    title: 'The Windmill',
    desc: 'A working mill, its sails turning steadily above the pastures, grinding the harvest of the valley.',
    target: P('windmill').slice(), pos: [VC.PLACES.windmill.x - 22, E + 12, VC.PLACES.windmill.z + 28] });
  dest({ id: 'waterfall', realm: 'earth', group: 'earth', icon: '💧',
    title: 'The Waterfall',
    desc: 'A white cataract tumbling from the highlands to a misty pool, fed by mountain snowmelt.',
    target: [VC.PLACES.waterfall.x, E + 10, VC.PLACES.waterfall.z], pos: [VC.PLACES.waterfall.x + 36, E + 14, VC.PLACES.waterfall.z + 30] });
  dest({ id: 'bridge', realm: 'earth', group: 'earth', icon: '🌉',
    title: 'The River Bridge',
    desc: 'A stone arch carries the high road across the river; fishing boats drift beneath its arches.',
    target: P('bridge').slice(), pos: [VC.PLACES.bridge.x - 28, E + 12, VC.PLACES.bridge.z + 38] });
  dest({ id: 'forest', realm: 'earth', group: 'earth', icon: '🌲',
    title: 'The Forest',
    desc: 'Pines, oaks and birches in layered green; deer paths, birdsong particles and the smell of resin.',
    target: P('forest').slice(), pos: [VC.PLACES.forest.x + 26, E + 12, VC.PLACES.forest.z + 36] });
  dest({ id: 'balloon', realm: 'earth', group: 'earth', icon: '🎈',
    title: 'Hot-Air Balloon Viewpoint',
    desc: 'A striped balloon drifts over the river valley, its burner winking against the morning sky.',
    target: [60, E + 42, 96], pos: [88, E + 46, 116] });
  dest({ id: 'heli', realm: 'earth', group: 'earth', icon: '🚁',
    title: 'Helicopter Viewpoint',
    desc: 'A rotor ship hovers over the lake — from here the whole middle realm is a map.',
    target: [VC.PLACES.lake.x, E + 26, VC.PLACES.lake.z], pos: [VC.PLACES.lake.x + 24, E + 30, VC.PLACES.lake.z + 26] });

  /* ---- Stairway ---- */
  dest({ id: 'stairfoot', realm: 'earth', group: 'stair', icon: '🕊',
    title: 'Entrance to the Stairway',
    desc: 'A marble plaza and chapel on the far shore; the luminous stair climbs from here into the sky, and good souls are already ascending.',
    target: P('stairBase').slice(), pos: [34, E + 12, 208] });
  dest({ id: 'stairmid', realm: 'heaven', group: 'stair', icon: '☁',
    title: 'Stairway Midpoint',
    desc: 'Halfway between worlds: look down and Earth is a painted map; look up and the gates shine through the clouds.',
    target: [0, 70, 140], pos: [36, 74, 158] });

  /* ---- Heaven ---- */
  dest({ id: 'heaven', realm: 'heaven', group: 'heaven', icon: '😇', major: true,
    title: 'Heaven Overview',
    desc: 'Cloud islands joined by white-and-gold bridges, gardens, choirs and the Kingdom of Heaven’s towers at the far avenue.',
    target: [0, L.HEAVEN_BASE_Y + 10, 120], pos: [0, L.HEAVEN_BASE_Y + 46, 262] });
  dest({ id: 'pearl', realm: 'heaven', group: 'heaven', icon: '⛩', special: 'peter', major: true,
    title: 'Saint Peter and the Pearly Gates',
    desc: 'At the stair’s summit Saint Peter keeps the Book of Life and the golden keys; when he lifts the keys, the gates open on the celestial avenue.',
    target: [0, L.STAIR_TOP_Y + 6, 106], pos: [0, L.STAIR_TOP_Y + 14, 140] });
  dest({ id: 'orchestra', realm: 'heaven', group: 'heaven', icon: '🎻',
    title: 'Angel Orchestra',
    desc: 'A raised cloud stage where voxel angels play harps, lyres and trumpets in slow, gentle motion.',
    target: [-62, L.HEAVEN_BASE_Y + 8, 160], pos: [-40, L.HEAVEN_BASE_Y + 16, 188] });
  dest({ id: 'gardens', realm: 'heaven', group: 'heaven', icon: '🌷',
    title: 'Cloud Gardens',
    desc: 'Lawns, blossoms, reflecting pools and luminous trees laid over the great cloud islands.',
    target: [56, L.HEAVEN_BASE_Y + 5, 156], pos: [78, L.HEAVEN_BASE_Y + 14, 184] });
  dest({ id: 'fountain', realm: 'heaven', group: 'heaven', icon: '⛲',
    title: 'Fountain of Light',
    desc: 'A basin of living brightness; its droplets rise as motes of light and return as peace.',
    target: [-40, L.HEAVEN_BASE_Y + 6, 188], pos: [-16, L.HEAVEN_BASE_Y + 14, 208] });
  dest({ id: 'hall', realm: 'heaven', group: 'heaven', icon: '🕯',
    title: 'Hall of Good Souls',
    desc: 'A colonnaded hall where the good souls of the world rest in luminous repose.',
    target: [44, L.HEAVEN_BASE_Y + 9, 196], pos: [66, L.HEAVEN_BASE_Y + 16, 216] });
  dest({ id: 'castle', realm: 'heaven', group: 'heaven', icon: '🏰', major: true,
    title: 'The Kingdom of Heaven',
    desc: 'Ivory and gold, translucent as frost: towers, courtyards and banners around a radiant central hall.',
    target: [0, L.CASTLE_Y + 8, 252], pos: [0, L.CASTLE_Y + 30, 316] });
  dest({ id: 'courtyard', realm: 'heaven', group: 'heaven', icon: '🚩',
    title: 'Castle Courtyard',
    desc: 'The choir of angels gathers between the banners and fountains of the inner court.',
    target: [0, L.CASTLE_Y + 4, 246], pos: [0, L.CASTLE_Y + 12, 272] });
  dest({ id: 'throne', realm: 'heaven', group: 'heaven', icon: '✨', major: true,
    title: 'The Radiant Throne Hall',
    desc: 'Light itself seems to be the architecture here — an uncreated sunrise at the heart of the castle.',
    target: [0, L.CASTLE_Y + 12, 262], pos: [0, L.CASTLE_Y + 18, 284] });
  dest({ id: 'overlook', realm: 'heaven', group: 'heaven', icon: '🔭',
    title: 'The Celestial Overlook',
    desc: 'The last railing of paradise: far below, the whole created world — and a faint red glow at its underside.',
    target: [0, L.HEAVEN_BASE_Y + 2, 66], pos: [0, L.HEAVEN_BASE_Y + 14, 30] });
  dest({ id: 'finale', realm: 'space', group: 'heaven', icon: '🌌',
    title: 'The Connected Universe',
    desc: 'From above the Kingdom, the stair, the city and the smoking pit: one cosmos, all the way down, all the way up.',
    target: [0, 70, 60], pos: [-60, 200, 460] });

  VC.destinations = D;
  VC.destById = {};
  D.forEach(function (d) { VC.destById[d.id] = d; });

  /* =====================================================================
   * GUIDED FLIGHT
   * ===================================================================== */
  var flight = {
    active: false, t: 0, dur: 3,
    corridorP: [], corridorT: [],
    onUpdate: null, onComplete: null,
    _v: new THREE.Vector3(), _w: new THREE.Vector3()
  };
  VC.flight = flight;

  /* Single source of truth for "solid ground level at (x,z) as seen from
     camera altitude y". Shared by corridor building and the audit tests so
     camera flights never clip realm structures. */
  function floorBelow(x, y, z) {
    /* cloud islands only obstruct approaches from above; flying beneath
       their undersides is open space and visually fine */
    if (z > 195 && Math.abs(x) < 110 && y > L.CASTLE_Y - 8) return L.CASTLE_Y - 4;
    if (z > 145 && z <= 195 && Math.abs(x) < 90 && y > L.HEAVEN_BASE_Y) return L.HEAVEN_BASE_Y + 6;
    if (z > 108 && z <= 178 && Math.abs(x) < 26) {     /* stair column */
      if (y > 88) return L.CASTLE_Y - 4;               /* cross above the stair top */
      if (y < L.STAIR_TOP_Y + 14) {                    /* stair deck in Earth space */
        var f = VC.clamp((172 - z) / 56, 0, 1);
        return E + 2 + f * (L.STAIR_TOP_Y - L.EARTH_Y);
      }
    }
    if (y > L.EARTH_Y + 48) return -1e9;               /* open sky above Earth */
    if (y > VC.LEVELS.CIRCLE_TOP_Y + 10) {             /* Earth band */
      if (Math.abs(x) > 170 || Math.abs(z) > 170) return -1e9; /* outside the slab */
      return L.EARTH_Y + (VC.terrain ? VC.terrain.height(x, z) : 0);
    }
    var rr = Math.hypot(x, z);                          /* Hell band */
    if (rr > 134) return 4;                             /* outer plain */
    for (var i = 0; i < 9; i++) {
      if (rr >= VC.circleRadius(i) - L.CIRCLE_SHRINK) return VC.CIRCLES[i].y + 2;
    }
    return -1e9;                                        /* deepest pit: open below */
  }
  VC.floorBelow = floorBelow;

  function groundFloor(x, y, z) {
    var f = floorBelow(x, y, z);
    return f < -1e8 ? 0 : f;
  }
  VC.groundFloor = groundFloor;

  /* build a corridor of positions+targets that clears obstacles */
  function buildCorridor(camPos, target, camPos1, target1) {
    var N = 16, corridorP = [], corridorT = [];
    for (var i = 0; i <= N; i++) {
      var s = i / N;
      var e = VC.easeInOut(s);
      var p = new THREE.Vector3().lerpVectors(camPos, camPos1, e);
      var t = new THREE.Vector3().lerpVectors(target, target1, e);
      corridorT.push(t);
      /* terrain clearance only for realm landings: y-lerp reaches the
         destination exactly at s=1, so force clearance there */
      var f = Math.max(groundFloor(p.x, p.y, p.z),
        (VC.terrain && VC.terrain.height) ? VC.terrain.height(p.x, p.z) + 1 : 0);
      if (f > p.y) p.y = VC.lerp(f, Math.max(f, target.y + 8), s * s); // bias: settle late
      corridorP.push(p);
    }
    corridorP[N].copy(camPos1); corridorP[0].copy(camPos);
    /* smooth interior only — endpoints stay exactly at the cinematic pose */
    for (var pass = 0; pass < 3; pass++) {
      for (var j = 1; j < N; j++) {
        var a = corridorP[j - 1], b = corridorP[j], c = corridorP[j + 1];
        b.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      }
      corridorP[N].copy(camPos1); corridorP[0].copy(camPos);
    }
    return { corridorP: corridorP, corridorT: corridorT };
  }

  function sampleCorridor(arr, f) {
    var i = VC.clamp(f, 0, 0.9999) * (arr.length - 1);
    var i0 = Math.floor(i), i1 = Math.min(i0 + 1, arr.length - 1);
    var k = i - i0;
    return new THREE.Vector3().lerpVectors(arr[i0], arr[i1], k);
  }

  VC.nav = {
    current: null,
    flyTo: function (idOrDest, opts) {
      opts = opts || {};
      var d = (typeof idOrDest === 'string') ? VC.destById[idOrDest] : idOrDest;
      if (!d) return;
      var controls = VC.controls;
      var camPos1 = new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]);
      var target1 = new THREE.Vector3(d.target[0], d.target[1], d.target[2]);
      var cor = buildCorridor(VC.camera.position, controls.target, camPos1, target1);
      var dist = VC.camera.position.distanceTo(camPos1);
      flight.corridorP = cor.corridorP;
      flight.corridorT = cor.corridorT;
      flight.t = 0;
      flight.dur = VC.clamp(dist / 85 + 1.4, 1.8, 5.2) * (opts.speedMul || 1);
      flight.onUpdate = opts.onUpdate || null;
      flight.onComplete = opts.onComplete || null;
      flight.active = true;
      flight.fromNav = !opts.tour;
      VC.controls.enabled = false;
      VC.nav.current = d;
      VC.emit('navStart', d);
    },
    step: function (dt) {
      if (!flight.active) return;
      flight.t += dt;
      var k = VC.clamp(flight.t / flight.dur, 0, 1);
      var e = VC.easeInOut(k);
      var p = sampleCorridor(flight.corridorP, e);
      var tg = sampleCorridor(flight.corridorT, e);
      VC.camera.position.copy(p);
      VC.controls.target.copy(tg);
      VC.camera.lookAt(tg);
      if (flight.onUpdate) flight.onUpdate(e, k);
      if (k >= 1) {
        flight.active = false;
        if (!flight.tourHolds) VC.controls.enabled = true;
        VC.controls.setFrom(VC.camera.position, tg);
        var cb = flight.onComplete;
        flight.onComplete = null; flight.onUpdate = null;
        VC.emit('navEnd', VC.nav.current);
        if (cb) cb();
      }
    },
    stop: function () {
      if (!flight.active) return;
      flight.active = false;
      flight.onUpdate = null; flight.onComplete = null;
      VC.controls.enabled = true;
      VC.controls.setFrom(VC.camera.position, VC.controls.target);
    },
    cycle: function (dir) {
      var idx = -1;
      for (var i = 0; i < D.length; i++) if (D[i] === VC.nav.current) { idx = i; break; }
      idx = ((idx === -1 ? 1 : idx + dir) % D.length + D.length) % D.length;
      VC.nav.go(D[idx].id);
    },
    go: function (id, opts) {
      /* special destinations route through their scripted sequences */
      if (!opts && VC.nav.specials) {
        var d = VC.destById[id];
        if (d && d.special && VC.nav.specials[d.special]) {
          VC.nav.specials[d.special]();
          return;
        }
      }
      VC.nav.flyTo(id, opts);
      VC.emit('navSelect', VC.destById[id]);
    }
  };
  VC.nav.specials = {};

  /* ---------------- realm detection ---------------- */
  VC.realmAt = function (y, z) {
    if (z > 145 && y > 92) return 'heaven';
    if (z > 140 && y > 40) return 'stair';
    if (y < VC.LEVELS.CIRCLE_TOP_Y + 8 && Math.sqrt(VC.camera.position.x * VC.camera.position.x + VC.camera.position.z * VC.camera.position.z) < VC.RADIUS + 60) return 'hell';
    if (y < VC.LEVELS.CIRCLE_TOP_Y + 8) return 'hell';
    if (y > 95) return 'heaven';
    return 'earth';
  };

  /* ---------------- label projection ---------------- */
  var _lp = new THREE.Vector3();
  VC.updateLabels = function () {
    var cam = VC.camera, W = VC.renderer.domElement.clientWidth, H = VC.renderer.domElement.clientHeight;
    var maxLabels = VC.QUALITIES[VC.quality].labelDivs;
    var shown = 0;
    var show = VC.showLabels !== false;
    var camPos = cam.position;
    /* sort roughly by distance so closest labels win the budget */
    var arr = VC.labels.map(function (l, i) {
      return { l: l, d: l.pos.distanceToSquared(camPos), i: i };
    }).sort(function (a, b) { return a.d - b.d; });
    var vis = {};
    for (var n = 0; n < arr.length; n++) {
      var l = arr[n].l, d2 = arr[n].d;
      var el = l.el;
      var vis2 = show && shown < maxLabels && d2 < l.maxDist * l.maxDist && d2 > 90;
      if (vis2) {
        _lp.copy(l.pos).project(cam);
        if (_lp.z > 1 || Math.abs(_lp.x) > 1.25 || Math.abs(_lp.y) > 1.25) vis2 = false;
      }
      if (vis2) {
        shown++;
        vis[l.el] = true;
        var x = (_lp.x * 0.5 + 0.5) * W, y = (-_lp.y * 0.5 + 0.5) * H;
        el.style.transform = 'translate(-50%,-50%) translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        var dist = Math.sqrt(d2);
        el.style.opacity = VC.clamp(1.15 - dist / l.maxDist, 0.12, 1);
        el.style.display = 'block';
      }
    }
    for (var i = 0; i < VC.labels.length; i++) {
      var e2 = VC.labels[i].el;
      if (!vis[e2]) e2.style.display = 'none';
    }
  };
  VC.showLabels = true;
}());
