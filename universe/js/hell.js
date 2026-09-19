/* =========================================================================
 * Voxel Cosmos — hell.js
 * The infernal funnel: black-stone outer plain, nine terraced circles,
 * Gates of Hell with animated slabs + inscription, Cerberus chained at the
 * gate, Acheron & Charon, Minos, per-circle landmarks (castle of Limbo,
 * whirlwind souls, Cerberus-kin in sludge, hoarders' boulders, Styx & the
 * burning city of Dis, flaming tombs, Phlegethon / suicide wood / burning
 * desert, Malebolge trenches & Geryon, Cocytus ice), tormented souls (one
 * instanced pool with per-circle behaviours), demons, fire-dragons, embers,
 * sleet, snow and bubbles — all pooled particles.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var part = VC.part;
  var L = VC.LEVELS;
  var CY = function (i) { return VC.CIRCLES[i].y; };
  var CR = function (i) { return VC.circleRadius(i); };

  var rng, hell;
  var soulsPool, soulsData = [];
  var embers, dragonFire, rain, snow, bubbles;
  var rainBeh, snowBeh, bubBeh;
  var hotSpots = [];
  var weightsPool = null, weightItems = [];
  var flyingDemons = [], groundDemons = [], centaurs = [], poets = [];
  var castleTorches = [], towerFlames = [], suicideTrees = [], fireJets = [], simoniacs = [];
  var geryonCoil = [], geryonHeads = [];
  var minosCoils = [], minosBody = null;
  var gateObj = null, braziers = [], charonBoat = null, charonSouls = [];
  var bigDragon = null;
  var disWinMats = [];
  var emberTimer = 0, bubbleTimer = 0;
  var _sv = new THREE.Vector3(), _ss = new THREE.Vector3(1, 1, 1);

  /* =================================================================== */
  VC.buildHell = function () {
    rng = VC.makeRng(13337);
    hell = VC.realms.hell;

    buildAbyss();
    buildGatesOfHell();
    buildCerberusMain();
    buildAcheron();
    buildLimbo();
    buildLust();
    buildGluttony();
    buildGreed();
    buildWrath();
    buildHeresy();
    buildViolence();
    buildFraud();
    buildTreachery();
    buildMinos();
    buildSouls();
    buildWeights();
    buildDemonsAndDragons();
    buildParticles();
    VC.mergeVoxelGroup(hell);

    VC.scene.add(hell);

    VC.registerAnimator(function (t, dt, camPos) {
      var inHell = camPos.y < L.CIRCLE_TOP_Y + 50;
      updateSouls(t, dt);
      updateWeights(t, dt);
      updateDemons(t, dt);
      updateCharon(t, dt);
      updateGate(dt, t);
      if (inHell || camPos.length() < 340) {
        updateParticles(t, dt, camPos, inHell);
        if (VC.animated.cerberus) VC.updateCerberus(VC.animated.cerberus, dt, t, camPos);
        if (VC.animated.gluttonyHound) updateGluttonyHound(dt, t);
        if (VC.animated.satan) VC.updateSatan(VC.animated.satan, dt, t, camPos);
        updateDragonsAll(t, dt, camPos);
      }
      pulseDis(t);
    }, 'hell');

    VC.addLabel('The Abyss of Hell', new THREE.Vector3(0, 10, -150), { realm: 'hell', major: true });
  };

  /* ---------------- abyss funnel geometry ---------------- */
  function buildAbyss() {
    var ST = new THREE.Group();
    ST.userData.noMerge = false;
    hell.add(ST);
    var _oldAdd = hell.add.bind(hell);
    hell.add = function (o) { ST.add(o); return ST; };
    var plain = new THREE.Mesh(new THREE.RingGeometry(133, 168, 64, 3), VC.mc(0x1a1421));
    plain.rotation.x = -Math.PI / 2;
    plain.position.y = 2;
    hell.add(plain);
    /* dark speckle on the plain */
    var speckle = new THREE.InstancedMesh(VC.ico(0.8, 0), VC.mc(0x241a2e), VC.pop(120));
    var d = new THREE.Object3D();
    for (var s = 0; s < speckle.count; s++) {
      var a = rng.range(0, Math.PI * 2), r = rng.range(136, 165);
      d.position.set(Math.cos(a) * r, 2.3, Math.sin(a) * r);
      d.rotation.set(rng(), rng() * 6, rng());
      d.scale.setScalar(rng.range(0.5, 2.2));
      d.updateMatrix();
      speckle.setMatrixAt(s, d.matrix);
    }
    hell.add(speckle);

    /* outer cliff of the whole pit */
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(168, 176, 76, 52, 1, true), VC.mc(0x0c0a12));
    wall.material.side = THREE.BackSide;
    wall.position.y = -36;
    hell.add(wall);
    /* skirt: earth underside down to plain */
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(170, 161, 34, 52, 1, true), VC.mc(0x161119));
    skirt.material.side = THREE.DoubleSide;
    skirt.position.y = 19;
    hell.add(skirt);

    /* terraces */
    for (var i = 0; i < 9; i++) {
      var rOut = CR(i), rIn = Math.max(1, CR(i) - L.CIRCLE_SHRINK);
      var y = CY(i);
      var tint = new THREE.Color(VC.CIRCLES[i].color).multiplyScalar(0.2).getHex();
      var ring = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 52, 1), VC.mc(tint));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y;
      hell.add(ring);
      if (i < 8) {
        var step = new THREE.Mesh(
          new THREE.CylinderGeometry(rIn - 0.5, rIn - 0.5, L.CIRCLE_DROP, 52, 1, true),
          VC.mc(0x0f0c15));
        step.position.y = y - L.CIRCLE_DROP / 2;
        hell.add(step);
      }
      /* rubble + broken pillars */
      var nR = VC.pop(24);
      for (var k = 0; k < nR; k++) {
        var ra = rng.range(0, Math.PI * 2), rr = rng.range(rIn + 2, rOut - 2), s2 = rng.range(0.5, 2.6);
        var rock = new THREE.Mesh(VC.ico(s2, 0), rng.chance(0.25) ? VC.mc(tint) : VC.mc(0x181220));
        rock.position.set(Math.cos(ra) * rr, y + s2 * 0.35, Math.sin(ra) * rr);
        rock.rotation.set(rng(), rng() * 6, rng());
        hell.add(rock);
      }
      if (i % 2 === 1) {
        var pa = rng.range(0, Math.PI * 2), pr = (rOut + rIn) / 2;
        var pillar = new THREE.Mesh(VC.cyl(1.4, 1.9, rng.range(5, 11), 6), VC.mc(0x1e1826));
        pillar.position.set(Math.cos(pa) * pr, y + 4, Math.sin(pa) * pr);
        pillar.rotation.z = rng.range(-0.1, 0.1);
        hell.add(pillar);
      }
    }
    hell.add = _oldAdd;
    VC.mergeVoxelGroup(ST);
  }

  /* ---------------- Gates of Hell ---------------- */
  function buildGatesOfHell() {
    var G = new THREE.Group();
    var gz = -118;
    var stone = VC.mc(0x1e1826), stoneD = VC.mc(0x120d18);

    /* plaza shelf cantilevered over the abyss */
    var plaza = new THREE.Mesh(new THREE.CylinderGeometry(44, 47, 4, 40), VC.mc(0x1b1522));
    plaza.position.set(0, 0.2, 10);
    G.add(plaza);
    var plazaTop = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 0.6, 40), VC.mc(0x241b2c));
    plazaTop.position.set(0, 2.3, 10);
    G.add(plazaTop);
    /* balustrade on the abyss edge */
    var rail = new THREE.Mesh(new THREE.TorusGeometry(42.5, 0.7, 4, 40, Math.PI * 1.05), stoneD);
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = Math.PI * 0.475;
    rail.position.set(0, 3.6, 10);
    G.add(rail);

    G.add(part(48, 5, 17, stoneD, 0, -0.5, 0));
    [-15, 15].forEach(function (x) {
      var p = new THREE.Group();
      p.position.set(x, 2, 0);
      p.add(part(7, 34, 7, stone, 0, 17, 0));
      p.add(part(9, 2.2, 9, stoneD, 0, 35, 0));
      var cap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 6, 4), stoneD);
      cap.position.y = 39; cap.rotation.y = Math.PI / 4;
      p.add(cap);
      for (var b = 0; b < 5; b++) {
        var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 4), VC.mc(0x0d0a10));
        tooth.position.set(x > 0 ? -3.8 : 3.8, 27 - b * 4.2, 0);
        tooth.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        p.add(tooth);
      }
      /* torches on the outer faces */
      var tr = VC.makeTorch(3);
      tr.position.set(x > 0 ? 3.8 : -3.8, 20, 3.8);
      tr.rotation.z = x > 0 ? -1.2 : 1.2;
      p.add(tr);
      gateTorches.push(tr);
      hotSpots.push([x + (x > 0 ? 4 : -4), 24, gz + 4]);
      G.add(p);
    });
    G.add(part(44, 8, 9.5, stone, 0, 38, 0));
    var insTex = VC.banner('LASCIATE OGNE SPERANZA', 'PER ME SI VA NE LA CITÀ DOLENTE', {
      bg: 'rgba(8,4,10,0.94)', line: 'rgba(255,90,30,0.6)', fg: '#ff7a3a', fg2: 'rgba(255,170,110,0.8)'
    });
    var ins = VC.makeBanner(insTex, 36, 16, { fog: false });
    ins.position.set(0, 38, 4.9);
    G.add(ins);
    var ins2 = ins.clone();
    ins2.rotation.y = Math.PI;
    ins2.position.z = -4.9;
    G.add(ins2);

    /* slabs — hinge on outer edges, swing inward (-z) */
    function slab(side) {
      var pivot = new THREE.Group();
      pivot.position.set(side * 12, 2, 0);
      var m = VC.mc(0x241814, 0x140300);
      var sm = new THREE.Group();
      sm.position.set(side * 6, 11, 0);
      sm.add(part(12, 22, 1.8, m, 0, 0, 0));
      var rune = VC.tmat('hellGlow', 'rune', function () { return VC.emissive(0xff4a10, 1); }, 0x240500, 0xff5a14);
      for (var rI = 0; rI < 4; rI++) {
        sm.add(part(9, 0.4, 0.2, rune, 0, -7 + rI * 4.6, 1));
      }
      for (var sI = 0; sI < 3; sI++) {
        sm.add(part(1.5, 1.5, 0.7, VC.mc(0xcfc4ae), 0, 7 - sI * 6.5, 1.1));
      }
      pivot.add(sm);
      return pivot;
    }
    var left = slab(-1), right = slab(1);
    G.add(left, right);

    /* braziers flanking the entrance (visitor side) */
    [-22, 22].forEach(function (x) {
      var br = new THREE.Group();
      br.position.set(x, 2, 8);
      br.add(part(2.4, 3.6, 2.4, stoneD, 0, 1.8, 0));
      br.add(part(3.4, 1.1, 3.4, VC.mc(0x30201a), 0, 4.1, 0));
      var fl = VC.makeFlame(4.5);
      fl.position.y = 4.6;
      br.add(fl);
      br.userData.flame = fl;
      br.userData.noMerge = true;
      G.add(br);
      braziers.push(br);
      hotSpots.push([x, 9, gz + 8]);
    });

    /* chains anchoring Cerberus to the pillars */
    [-1, 1].forEach(function (s) {
      G.add(VC.makeChain(
        new THREE.Vector3(s * 14, 28, 1),
        new THREE.Vector3(s * 5, 12, gz + 19 - gz),
        0.8, 15, VC.mc(0x2b2b34)));
    });

    G.position.set(0, 2, gz);
    hell.add(G);

    var openness = 0, target = 0, startOpen = 0, animT = 0, animDur = 2.4;
    gateObj = {
      group: G, isOpen: false, k: 0,
      setOpen: function (v, dur) {
        target = v ? 1 : 0;
        startOpen = openness;
        this.isOpen = !!v;
        animT = 0;
        animDur = dur || 2.4;
        VC.emit('hellGate', !!v);
      }
    };
    VC.animated.gates.hell = gateObj;

    function openUpdate(dt, t) {
      animT += dt;
      var kk = VC.easeInOut(VC.clamp(animT / animDur, 0, 1));
      openness = startOpen + (target - startOpen) * kk;
      var o = VC.smoothstep(VC.clamp(openness, 0, 1));
      left.rotation.y = o * 1.9;    /* inward swing */
      right.rotation.y = -o * 1.9;
      gateObj.k = o;
      for (var b = 0; b < braziers.length; b++) VC.animateFlame(braziers[b].userData.flame, t + b, 1 + o);
      for (var gt = 0; gt < gateTorches.length; gt++) VC.animateFlame(gateTorches[gt].userData.flame, t + gt * 0.5, 1);
    }
    updateGate = openUpdate;
  }
  var updateGate = function () { };
  var gateTorches = [];

  /* ---------------- Cerberus at the gate ---------------- */
  function buildCerberusMain() {
    var C = VC.buildCerberus(rng);
    C.group.position.set(0, 2.2, -99);
    C.group.userData.noMerge = true;
    hell.add(C.group);
    VC.animated.cerberus = C;
    VC.addLabel('CERBERUS — Guardian of the Gate', new THREE.Vector3(0, 24, -99), { realm: 'hell', major: true });
    /* mouth smoke */
    C.smoke = new VC.ParticleField(180, { name: 'cerberusSmoke' });
    hell.add(C.smoke.points);
    VC.registerAnimator(function (t, dt, camPos) {
      var near = camPos.distanceTo(C.group.position) < 210;
      C.smoke.points.visible = near;
      if (!near) { C.smoke.step(0, null); return; }
      if (Math.floor(t * 14) !== Math.floor((t - dt) * 14)) {
        for (var h = 0; h < C.heads.length; h++) {
          var wp = new THREE.Vector3();
          C.heads[h].skull.getWorldPosition(wp);
          wp.y += 0.5;
          C.smoke.spawn(wp.x, wp.y, wp.z, rng.range(-0.7, 0.7), rng.range(1.4, 2.6), rng.range(-0.7, 0.7),
            2.0, 3.4, 0.3, 0.13, 0.07);
        }
      }
      C.smoke.step(dt, function (i, i3, ddt) {
        C.smoke.vel[i3 + 1] += ddt * 0.4;
      });
    }, 'hell');
  }

  /* ---------------- Acheron + Charon ---------------- */
  function buildAcheron() {
    var ch = new THREE.Mesh(
      new THREE.RingGeometry(108, 132, 36, 1, 1.25, 0.9),
      VC.waterMaterial({ deep: 0x080a16, shallow: 0x202a48, amp: 0.3, opacity: 1 }));
    ch.rotation.x = -Math.PI / 2;
    ch.position.y = 1.7;
    hell.add(ch);

    /* ferry */
    var boat = new THREE.Group();
    var hull = VC.mc(0x241610);
    boat.add(part(3.4, 1.2, 9, hull, 0, 0.4, 0));
    boat.add(part(3, 0.5, 7.4, hull, 0, 1.0, 0));
    boat.add(part(3.4, 1.7, 1, hull, 0, 1.1, -4.4));
    boat.add(part(0.3, 7, 0.3, VC.mc(0x3a2a18), -1.2, 3.6, 3.4));
    var lantern = new THREE.Mesh(VC.sphereGeo(0.5, 6, 4), VC.emissive(0xffb030, 1.2));
    lantern.position.set(-1.2, 7.3, 3.4);
    boat.add(lantern);
    var lg = VC.glowSprite(0xff9020, 3.6, 0.8);
    lg.position.set(-1.2, 7.3, 3.4);
    boat.add(lg);
    /* Charon */
    var chg = new THREE.Group();
    chg.add(part(1.05, 2.4, 0.8, VC.mc(0x504a3e), 0, 1.7, -1));
    chg.add(part(0.7, 0.7, 0.62, VC.mc(0x6a5a48), 0, 3.2, -1));
    chg.add(part(0.5, 0.3, 0.66, VC.mc(0x2a241c), 0, 3.55, -1));   /* hood */
    var eye = VC.emissive(0xffd020, 1.4);
    chg.add(part(0.16, 0.12, 0.08, eye, -0.17, 3.25, -0.66));
    chg.add(part(0.16, 0.12, 0.08, eye, 0.17, 3.25, -0.66));
    boat.add(chg);
    for (var s = 0; s < 3; s++) {
      var sl = VC.makeSoul(VC.mc(0xbcc8dc, 0x1a2438));
      sl.position.set(rng.range(-1, 1), 1.3, rng.range(-3.4, 1.4));
      sl.scale.setScalar(0.72);
      boat.add(sl);
      charonSouls.push(sl);
    }
    boat.position.set(-16, 1.3, 120);
    boat.userData.noMerge = true;
    hell.add(boat);
    charonBoat = boat;
    VC.addLabel('River Acheron', new THREE.Vector3(14, 7, 122), { realm: 'hell' });
    VC.addLabel('Charon’s Ferry', new THREE.Vector3(-16, 9, 120), { realm: 'hell' });
    VC.addLabel('The Gates of Hell', new THREE.Vector3(0, 52, -118), { realm: 'hell', major: true });
  }
  var charonA = 1.4, charonDir = 1;
  function updateCharon(t, dt) {
    if (!charonBoat) return;
    charonA += charonDir * dt * 0.055 * VC.motionFactor();
    if (charonA > 2.02) charonDir = -1;
    if (charonA < 1.38) charonDir = 1;
    var r = 120;
    var x = Math.cos(charonA) * r, z = Math.sin(charonA) * r;
    var ahead = charonA + charonDir * 0.05;
    charonBoat.position.set(x, 1.35 + Math.sin(t * 1.3) * 0.12, z);
    charonBoat.rotation.y = -Math.atan2(Math.sin(ahead), Math.cos(ahead)) + charonDir * Math.PI / 2;
    charonBoat.rotation.z = Math.sin(t * 1.1) * 0.03;
    for (var s = 0; s < charonSouls.length; s++) {
      charonSouls[s].position.y = 1.3 + Math.sin(t * 2 + s) * 0.06;
    }
  }

  /* ---------------- Circle 1: Limbo ---------------- */
  function buildLimbo() {
    var a = Math.PI * 0.66, r = CR(0) - 12;
    var lx = Math.cos(a) * r, lz = Math.sin(a) * r, ly = CY(0);
    var castle = new THREE.Group();
    castle.add(part(16, 12, 16, VC.mc(0x302a3e), 0, 6, 0));
    castle.add(part(18, 2, 18, VC.mc(0x262034), 0, 13, 0));
    [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(function (p) {
      castle.add(part(4.4, 20, 4.4, VC.mc(0x3a344e), p[0], 10, p[1]));
      var t2 = VC.makeTorch(2.2);
      t2.position.set(p[0], 20.2, p[1]);
      castle.add(t2);
      castleTorches.push(t2);
      hotSpots.push([lx + p[0], ly + 23, lz + p[1]]);
    });
    var win = VC.tmat('hellGlow', 'limboWin', function () { return VC.emissive(0x9a8fc8, 0.5); }, 0x2a2440, 0x9a8fc8);
    castle.add(part(6, 3, 0.5, win, 0, 8, 8.2));
    castle.position.set(lx, ly, lz);
    castle.rotation.y = -a + Math.PI / 2;
    hell.add(castle);
    VC.addLabel('Limbo — Castle of the Seven Virtuous', new THREE.Vector3(lx, ly + 27, lz), { realm: 'hell' });
    for (var p2 = 0; p2 < VC.pop(7); p2++) {
      var poet = VC.makeHumanoid({ robe: true, shirt: 0x6a627e, skin: 0xc0b0a0, hair: 0x3a3a44 });
      poet.position.set(lx + rng.range(-20, 20), ly + 0.2, lz + rng.range(12, 30));
      poet.rotation.y = rng.range(0, 6.28);
      hell.add(poet);
      poets.push(poet);
    }
    /* sorrowful mist */
    var mist = VC.cloudPuffMesh(VC.pop(80), VC.cloudMaterial(0x7a7694, 0.28));
    VC.fillCloudPuffs(mist, [
      { x: lx + 6, y: ly + 2.5, z: lz + 22, r: 22 },
      { x: lx - 24, y: ly + 2, z: lz - 6, r: 16 }
    ], rng, { puffsPer: 40 });
    hell.add(mist);
  }

  /* ---------------- Circle 2: Lust ---------------- */
  function buildLust() {
    buildMinos();
    var a = Math.PI * 1.12, r = CR(1) - 6;
    var gustar = VC.makeDemon(rng, { scale: 2.3, color: 0x6a3050, wings: true, wingColor: 0x4a1a34 });
    gustar.position.set(Math.cos(a) * r, CY(1) + 22, Math.sin(a) * r);
    gustar.userData.noMerge = true;
    hell.add(gustar);
    groundDemons.push({ g: gustar, hover: true, baseY: CY(1) + 22, phase: 1.2 });
    VC.addLabel('Lust — The Storm That Never Rests', new THREE.Vector3(Math.cos(Math.PI * 0.9) * 70, CY(1) + 15, Math.sin(Math.PI * 0.9) * 70), { realm: 'hell' });
  }

  /* ---------------- Circle 3: Gluttony ---------------- */
  function buildGluttony() {
    var sludge = new THREE.Mesh(
      new THREE.CircleGeometry(CR(2) - 5, 44),
      VC.lavaMaterial({ a: 0x0e1a08, b: 0x4a6a24, hot: 0x9ac04a, speed: 0.35, scale: 0.06, opacity: 0.98 }));
    sludge.rotation.x = -Math.PI / 2;
    sludge.position.y = CY(2) + 0.5;
    hell.add(sludge);
    hotSpots.push([0, CY(2) + 1, 0]);
    var mini = VC.buildCerberus(rng);
    mini.group.scale.setScalar(0.33);
    mini.group.position.set(0, CY(2) + 0.4, 0);
    mini.group.userData.noMerge = true;
    hell.add(mini.group);
    VC.animated.gluttonyHound = mini;
    VC.addLabel('Gluttony — The Eternal Cold Rain', new THREE.Vector3(Math.cos(Math.PI * 0.15) * (CR(2) - 8), CY(2) + 13, Math.sin(Math.PI * 0.15) * (CR(2) - 8)), { realm: 'hell' });
  }
  function updateGluttonyHound(dt, t) {
    var H = VC.animated.gluttonyHound, mf = VC.motionFactor();
    var tt = t * 1.3;
    for (var hh = 0; hh < H.heads.length; hh++) {
      var h = H.heads[hh];
      h.pivot.rotation.y = (hh - 1) * -0.34 + Math.sin(tt + h.phase) * 0.4 * mf;
      h.pivot.rotation.x = Math.sin(tt * 0.7 + h.phase) * 0.12;
      h.jaw.rotation.x = 0.2 + Math.max(0, Math.sin(tt * 4 + h.phase)) * 0.45 * mf;
    }
    var hb = Math.sin(tt * 1.7) * 0.03;
    H.body.scale.set(1 + hb, 1 + hb, 1 + hb);
  }

  /* ---------------- Circle 4: Greed ---------------- */
  function buildGreed() {
    var coins = new THREE.InstancedMesh(VC.cyl(1.3, 1.3, 0.28, 8), VC.mc(0xc9a227, 0x241a00), VC.pop(150));
    var d = new THREE.Object3D();
    for (var c = 0; c < coins.count; c++) {
      var ca = rng.range(0, Math.PI * 2), cr = rng.range(82, 92);
      d.position.set(Math.cos(ca) * cr, CY(3) + 0.15 + (c % 5) * 0.24, Math.sin(ca) * cr);
      d.rotation.set(Math.PI / 2 + rng.range(-0.5, 0.5), rng() * 6, rng.range(-0.5, 0.5));
      d.updateMatrix();
      coins.setMatrixAt(c, d.matrix);
    }
    hell.add(coins);
    /* a great hoard mound */
    var mound = new THREE.Group();
    for (var m = 0; m < VC.pop(26); m++) {
      var s = rng.range(1.5, 4);
      mound.add(new THREE.Mesh(VC.ico(s, 0), rng.chance(0.5) ? VC.mc(0xc9a227, 0x301f00) : VC.mc(0x8a7a3a))
        .translateY(rng.range(0, 6)).translateX(rng.range(-8, 8)).translateZ(rng.range(-8, 8)));
    }
    mound.position.set(Math.cos(2.2) * 87, CY(3) + 1, Math.sin(2.2) * 87);
    hell.add(mound);
    VC.addLabel('Greed — Hoarders and Spendthrifts', new THREE.Vector3(Math.cos(Math.PI * 1.5) * CR(3), CY(3) + 13, Math.sin(Math.PI * 1.5) * CR(3)), { realm: 'hell' });
  }

  /* ---------------- Circle 5: Wrath ---------------- */
  function buildWrath() {
    var styx = new THREE.Mesh(
      new THREE.CircleGeometry(CR(4) - 6, 44),
      VC.waterMaterial({ deep: 0x170f04, shallow: 0x4a3418, amp: 0.5, opacity: 0.97 }));
    styx.rotation.x = -Math.PI / 2;
    styx.position.y = CY(4) + 1.05;
    hell.add(styx);
    VC.addLabel('Wrath — The Black Marsh of Styx', new THREE.Vector3(Math.cos(Math.PI * 0.75) * (CR(4) - 10), CY(4) + 12, Math.sin(Math.PI * 0.75) * (CR(4) - 10)), { realm: 'hell' });
  }

  /* ---------------- Circle 6: Heresy ---------------- */
  function buildHeresy() {
    var wallR = CR(5) - 6;
    var disWall = new THREE.Mesh(new THREE.CylinderGeometry(wallR, wallR + 1.2, 10, 40, 1, true), VC.mc(0x28111a, 0x1a0400));
    disWall.material.side = THREE.DoubleSide;
    disWall.position.set(0, CY(5) + 5, 0);
    hell.add(disWall);
    var disWin = VC.registerTimeMat('hellGlow',
      new THREE.MeshLambertMaterial({ color: 0x3a0f06, emissive: 0xff4010 }), 0x501400, 0xff4a18);
    disWinMats.push(disWin);
    var towers = VC.pop(16);
    for (var tw = 0; tw < towers; tw++) {
      var ta = tw / towers * Math.PI * 2;
      var tx = Math.cos(ta) * wallR, tz = Math.sin(ta) * wallR;
      var twh = rng.range(12, 22);
      var tower = new THREE.Mesh(VC.cyl(2.2, 3, twh, 6), VC.mc(0x2e141c));
      tower.position.set(tx, CY(5) + 10 + twh / 2, tz);
      hell.add(tower);
      var win = new THREE.Mesh(VC.box(0.7, twh * 0.5, 0.7), disWin);
      win.position.set(tx * 0.99, CY(5) + 10 + twh / 2, tz * 0.99);
      hell.add(win);
      if (tw % 3 === 0) {
        var fl = VC.makeFlame(3.2);
        fl.position.set(tx, CY(5) + 10 + twh + 1, tz);
        hell.add(fl);
        towerFlames.push(fl);
        hotSpots.push([tx, CY(5) + 12 + twh, tz]);
      }
    }
    /* the gate of Dis */
    var disGate = new THREE.Group();
    disGate.add(part(12, 16, 4, VC.mc(0x38181f), 0, 8, 0));
    disGate.add(part(4, 12, 4.5, VC.mc(0x1c0a10), 0, 6, 0));
    disGate.position.set(0, CY(5), wallR);
    hell.add(disGate);
    /* burning open tombs */
    var nT = VC.pop(60);
    var tombs = new THREE.InstancedMesh(VC.boxGeo(2.6, 3, 2.2), VC.mc(0x2e1a14), nT);
    var tombGlow = new THREE.InstancedMesh(VC.boxGeo(1.7, 0.4, 1.6), VC.emissive(0xff4a10, 1.2), nT);
    var d = new THREE.Object3D();
    for (var tb = 0; tb < nT; tb++) {
      var tba = rng.range(0, Math.PI * 2), tbr = rng.range(54, 64);
      d.position.set(Math.cos(tba) * tbr, CY(5) + 1.5, Math.sin(tba) * tbr);
      d.rotation.set(0, rng() * 6, 0);
      d.updateMatrix();
      tombs.setMatrixAt(tb, d.matrix);
      d.position.y = CY(5) + 3.1;
      d.updateMatrix();
      tombGlow.setMatrixAt(tb, d.matrix);
      if (tb % 10 === 0) hotSpots.push([d.position.x, CY(5) + 3.4, d.position.z]);
    }
    hell.add(tombs, tombGlow);
    VC.addLabel('Heresy — The Burning City of Dis', new THREE.Vector3(Math.cos(Math.PI * 0.4) * wallR, CY(5) + 26, Math.sin(Math.PI * 0.4) * wallR), { realm: 'hell', major: true });
  }
  function pulseDis(t) {
    var p = 0.75 + Math.sin(t * 3.1) * 0.12 + Math.sin(t * 17.3) * 0.05;
    for (var i = 0; i < disWinMats.length; i++) {
      disWinMats[i].emissive.setHex(0xff4010).multiplyScalar(p);
    }
  }

  /* ---------------- Circle 7: Violence ---------------- */
  function buildViolence() {
    /* Phlegethon: river of boiling blood */
    var blood = new THREE.Mesh(
      new THREE.RingGeometry(40, 47, 40, 1),
      VC.lavaMaterial({ a: 0x3c0505, b: 0xa01810, hot: 0xff5a30, speed: 1.6, scale: 0.12, opacity: 1 }));
    blood.rotation.x = -Math.PI / 2;
    blood.position.y = CY(6) + 0.9;
    hell.add(blood);
    hotSpots.push([0, CY(6) + 1.5, 43], [43, CY(6) + 1.5, 0], [-43, CY(6) + 1.5, 0], [0, CY(6) + 1.5, -43]);
    /* burning desert with fire jets at the centre */
    var jets = VC.pop(16);
    for (var j = 0; j < jets; j++) {
      var ja = rng.range(0, Math.PI * 2), jr = rng.range(18, 36);
      var jet = new THREE.Group();
      var fcone = new THREE.Mesh(new THREE.ConeGeometry(1.1, rng.range(4, 9), 5), VC.emissive(0xff7a20, 1));
      jet.add(fcone);
      jet.position.set(Math.cos(ja) * jr, CY(6) + 1.5, Math.sin(ja) * jr);
      jet.userData.noMerge = true;
      hell.add(jet);
      fireJets.push(jet);
      hotSpots.push([jet.position.x, CY(6) + 3, jet.position.z]);
    }
    /* hot sand: shimmering floor inside r<20 */
    var sand = new THREE.Mesh(new THREE.CircleGeometry(39, 32),
      VC.lavaMaterial({ a: 0x2a1508, b: 0x7a5020, hot: 0xc88a3a, speed: 0.25, scale: 0.05, opacity: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = CY(6) + 0.4;
    hell.add(sand);
    /* suicide wood on the outer arc */
    var woodN = VC.pop(24);
    for (var w = 0; w < woodN; w++) {
      var wa = rng.range(0, Math.PI * 2), wr = rng.range(48, 52.5);
      var tree = new THREE.Group();
      var trunk = new THREE.Mesh(VC.box(1.1, rng.range(8, 14), 1.1), VC.mc(0x2c1a10));
      trunk.rotation.z = rng.range(-0.18, 0.18);
      tree.add(trunk);
      for (var b = 0; b < 4; b++) {
        var br = new THREE.Mesh(VC.box(0.45, rng.range(2.6, 5), 0.45), VC.mc(0x241408));
        br.position.set(rng.range(-1, 1), rng.range(3.5, 7.5), rng.range(-1, 1));
        br.rotation.z = rng.range(-1.1, 1.1);
        tree.add(br);
      }
      var wound = new THREE.Mesh(VC.box(0.35, 1.3, 0.35), VC.emissive(0xc02010, 0.9));
      wound.position.set(0.62, 4.4, 0);
      tree.add(wound);
      tree.woundM = wound;
      tree.position.set(Math.cos(wa) * wr, CY(6) + 5.5, Math.sin(wa) * wr);
      hell.add(tree);
      suicideTrees.push(tree);
    }
    /* centaurs patrol the inner bank of the blood river */
    for (var c = 0; c < 3; c++) {
      var cent = VC.makeDemon(rng, { scale: 1.8, color: 0x5a3018 });
      cent.userData.orbitA = c / 3 * Math.PI * 2;
      cent.userData.orbitR = 47.5;
      hell.add(cent);
      centaurs.push(cent);
    }
    VC.addLabel('Violence — Phlegethon & the Suicide Wood', new THREE.Vector3(Math.cos(Math.PI * 1.25) * 44, CY(6) + 16, Math.sin(Math.PI * 1.25) * 44), { realm: 'hell' });
  }

  /* ---------------- Circle 8: Fraud (Malebolge) ---------------- */
  function buildFraud() {
    var cy = CY(7);
    var rings = [[37, 31], [28, 22], [19, 13]];
    for (var m = 0; m < rings.length; m++) {
      var rO = rings[m][0], rI = rings[m][1];
      var ditch = new THREE.Mesh(
        new THREE.RingGeometry(rI, rO, 36, 1),
        VC.energyMaterial({ color: 0x8a3aff, opacity: 0.75 }));
      ditch.rotation.x = -Math.PI / 2;
      ditch.position.y = cy - 1.6 + m * 0.8;
      hell.add(ditch);
      /* rim walls */
      var rimO = new THREE.Mesh(new THREE.CylinderGeometry(rO + 0.6, rO + 1, 4.5, 36, 1, true), VC.mc(0x2a1c38));
      rimO.material.side = THREE.DoubleSide;
      rimO.position.y = cy + 0.8;
      hell.add(rimO);
      /* spokes/bridges */
      var brN = 5;
      for (var b = 0; b < brN; b++) {
        var ba = b / brN * Math.PI * 2 + m * 0.4;
        var mid = (rO + rI) / 2;
        var bridge = new THREE.Mesh(VC.box(rO - rI + 3, 1.1, 2.6), VC.mc(0x3c2c4a));
        bridge.position.set(Math.cos(ba) * mid, cy + 2.2 - m * 0.7, Math.sin(ba) * mid);
        bridge.rotation.y = -ba;
        hell.add(bridge);
      }
    }
    /* simony holes with burning legs near the outer wall */
    for (var s = 0; s < VC.pop(12); s++) {
      var sa = rng.range(0, Math.PI * 2), sr = rng.range(38.5, CR(7) - 3);
      var legsG = new THREE.Group();
      var legsM = VC.mc(0x6a5a4a);
      legsG.add(part(0.45, 1.7, 0.45, legsM, -0.36, 0.85, 0));
      legsG.add(part(0.45, 1.7, 0.45, legsM, 0.36, 0.85, 0));
      var sole = VC.tmat('hellGlow', 'sole', function () { return VC.emissive(0xffa020, 1); }, 0x301800, 0xffb830);
      legsG.add(part(0.5, 0.24, 0.62, sole, -0.36, 1.75, 0.08));
      legsG.add(part(0.5, 0.24, 0.62, sole, 0.36, 1.75, 0.08));
      legsG.position.set(Math.cos(sa) * sr, cy + 0.2, Math.sin(sa) * sr);
      legsG.userData.noMerge = true;
      hell.add(legsG);
      simoniacs.push(legsG);
    }
    /* Geryon coiled at the centre */
    var g = new THREE.Group();
    var coil = new THREE.Group();
    var prev = coil;
    for (var i = 0; i < 14; i++) {
      var nx = new THREE.Group();
      var s2 = 2.4 - i * 0.13;
      nx.add(part(s2, s2, 2, VC.mc(i % 2 ? 0x4a2a5a : 0x3a1a3a), 0, 0, 1));
      nx.rotation.y = 0.5;
      nx.position.set(0, 0.5, 0);
      prev.add(nx);
      prev = nx;
      geryonCoil.push(nx);
    }
    g.add(coil);
    for (var f = 0; f < 3; f++) {
      var head = new THREE.Group();
      head.add(part(2, 1.8, 2, VC.mc(0xc8a060), 0, 0, 0));
      head.add(part(0.4, 0.3, 0.2, VC.emissive(0xffd040, 1.2), -0.55, 0.35, 1));
      head.add(part(0.4, 0.3, 0.2, VC.emissive(0xffd040, 1.2), 0.55, 0.35, 1));
      head.add(part(1.5, 0.5, 1.1, VC.mc(0x3a2018), 0, -0.75, 0.9));
      head.position.set((f - 1) * 1.5, 0.8 + f * 0.3, 2.2);
      prev.add(head);
      geryonHeads.push(head);
    }
    g.position.set(32, cy + 2.2, 0);
    g.userData.noMerge = true;
    hell.add(g);
    VC.addLabel('Fraud — Malebolge, the Evil Trenches', new THREE.Vector3(Math.cos(Math.PI * 0.35) * 50, cy + 14, Math.sin(Math.PI * 0.35) * 50), { realm: 'hell' });
    VC.addLabel('Geryon', new THREE.Vector3(32, cy + 9, 4), { realm: 'hell' });
  }

  /* ---------------- Circle 9: Treachery ---------------- */
  function buildTreachery() {
    var ice = new THREE.Mesh(
      new THREE.CircleGeometry(24, 36),
      VC.waterMaterial({ deep: 0x84b4dc, shallow: 0xe8f4ff, amp: 0.05, opacity: 0.92 }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.y = CY(8) + 0.4;
    hell.add(ice);
    /* broken ice shards */
    var shards = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 3, 4), VC.mc(0xbcd8ef, 0x1a2a3a), VC.pop(40));
    var d = new THREE.Object3D();
    for (var s = 0; s < shards.count; s++) {
      var a = rng.range(0, Math.PI * 2), r = rng.range(4, 24);
      d.position.set(Math.cos(a) * r, CY(8) + 1, Math.sin(a) * r);
      d.rotation.set(rng.range(-0.5, 0.5), rng() * 6, rng.range(-0.5, 0.5));
      d.scale.setScalar(rng.range(0.4, 1.4));
      d.updateMatrix();
      shards.setMatrixAt(s, d.matrix);
    }
    hell.add(shards);
    VC.addLabel('Treachery — The Frozen Lake Cocytus', new THREE.Vector3(Math.cos(Math.PI * 0.9) * 20, CY(8) + 7, Math.sin(Math.PI * 0.9) * 20), { realm: 'hell' });

    /* Satan enthroned at the centre */
    var S = VC.buildSatan();
    S.group.userData.noMerge = true;
    hell.add(S.group);
    VC.animated.satan = S;
    VC.addLabel('SATAN — Emperor of the Kingdom of Woe', new THREE.Vector3(0, CY(8) + 50, 10), { realm: 'hell', major: true });
  }

  /* ---------------- Minos (threshold of Circle 2) ---------------- */
  function buildMinos() {
    var g = new THREE.Group();
    minosBody = VC.makeDemon(rng, { scale: 2.7, color: 0x5a2a10 });
    g.add(minosBody);
    var tail = new THREE.Group();
    tail.position.set(0, 1.8, -1.6);
    var prev = tail;
    for (var i = 0; i < 10; i++) {
      var nx = new THREE.Group();
      nx.add(part(0.95 - i * 0.05, 0.95 - i * 0.05, 0.9, VC.mc(0x3a1a0a), 0, 0, 0.42));
      prev.add(nx);
      prev = nx;
      minosCoils.push(nx);
    }
    g.add(tail);
    g.add(part(9, 1.2, 9, VC.mc(0x1c1420), 0, -0.6, 0));
    g.position.set(91, CY(1) + 1.7, 65);
    g.rotation.y = -2.35;
    g.userData.noMerge = true;
    hell.add(g);
    VC.addLabel('Minos the Judge', new THREE.Vector3(91, CY(1) + 9, 65), { realm: 'hell' });
  }

  /* ---------------- Souls ---------------- */
  function buildSouls() {
    var soulGeo = VC.box(0.5, 1.5, 0.4);
    var soulMat = VC.mc(0xc8d4e8, 0x24334d);
    var total = VC.pop(330);
    soulsPool = new VC.InstPool(soulGeo, soulMat, total, 'souls');
    hell.add(soulsPool.mesh);
    var counts = [22, 60, 34, 40, 46, 22, 34, 38, 34];
    var tints = [0x9a92c8, 0xd0a0c0, 0x9aa87a, 0xd8c070, 0xa8744a, 0xd88a5a, 0xc05a3a, 0x9a7ac8, 0xa8c8e8]
      .map(function (h) { return new THREE.Color(h); });
    for (var ci = 0; ci < 9; ci++) {
      var n = VC.pop(counts[ci]);
      var rMax = Math.max(8, CR(ci) - 6);
      for (var s = 0; s < n; s++) {
        var ang = rng.range(0, Math.PI * 2);
        var radRanges = [[120, 133], [10, 116], [6, 101], [82, 92], [8, 74],
                         [54, 64], [16, 52], [13, 38], [4, 22]];
        var rad = rng.range(radRanges[ci][0], radRanges[ci][1]);
        var idx = soulsPool.add(new THREE.Vector3(), null, new THREE.Vector3(1, 1, 1), null);
        if (idx === null) break;
        soulsPool.setColorAt(idx, tints[ci].clone().multiplyScalar(rng.range(0.7, 1.1)));
        soulsData.push({ i: idx, ci: ci, ang: ang, rad: rad, ph: rng.range(0, 6.28), sp: rng.range(0.75, 1.3), partner: null });
      }
    }
    /* pair up wrathful fighters */
    for (var f = 0; f < soulsData.length; f++) {
      if (soulsData[f].ci === 4 && !soulsData[f].partner) {
        for (var g = f + 1; g < soulsData.length; g++) {
          if (soulsData[g].ci === 4 && !soulsData[g].partner) {
            soulsData[f].partner = soulsData[g];
            soulsData[g].partner = soulsData[f];
            break;
          }
        }
      }
    }
    soulsPool.flush();
  }

  function updateSouls(t, dt) {
    if (!soulsPool) return;
    var mf = VC.motionFactor();
    var tt = t * mf;
    for (var sI = 0; sI < soulsData.length; sI++) {
      var s = soulsData[sI];
      var x, y, z, rx = 0, ry = 0, sy = 1;
      switch (s.ci) {
        case 0:
          x = Math.cos(s.ang) * s.rad + Math.sin(tt * 0.2 + s.ph) * 2;
          z = Math.sin(s.ang) * s.rad + Math.cos(tt * 0.17 + s.ph) * 2;
          y = CY(0) + 1 + Math.sin(tt * 0.5 + s.ph) * 0.15;
          break;
        case 1: {
          var la = s.ang + tt * 0.6 * s.sp;
          var lr = s.rad * (0.82 + 0.18 * Math.sin(tt * 0.5 + s.ph));
          x = Math.cos(la) * lr; z = Math.sin(la) * lr;
          y = CY(1) + 4 + (s.rad % 17) + Math.sin(tt * 1.2 + s.ph) * 2.5;
          rx = 1.3; ry = -la; sy = 0.55;
          break;
        }
        case 2:
          x = Math.cos(s.ang) * s.rad; z = Math.sin(s.ang) * s.rad;
          y = CY(2) + 0.75 + Math.sin(tt * 2 + s.ph) * 0.05;
          rx = 1.5; ry = s.ang; sy = 0.8;
          break;
        case 3: {
          var dir = (s.rad % 2 < 1) ? 1 : -1;
          var ga = s.ang + tt * 0.07 * dir;
          var gr = 82 + (s.rad % 10);
          x = Math.cos(ga) * gr; z = Math.sin(ga) * gr;
          y = CY(3) + 0.85;
          ry = -ga + dir * 1.35; rx = -0.45;
          break;
        }
        case 4:
          if (s.partner) {
            var mid = (s.ang + s.partner.ang) / 2 + Math.sin(tt * 0.1 + s.ph) * 0.02;
            var mrad = (s.rad + s.partner.rad) / 2;
            var lunge = Math.sin(tt * 2.2 + s.ph) * 0.5 + 0.5;
            x = Math.cos(mid) * (mrad - 1.5 + lunge * 1.3);
            z = Math.sin(mid) * (mrad - 1.5 + lunge * 1.3);
            ry = -mid;
          } else {
            x = Math.cos(s.ang + Math.sin(tt * 0.3 + s.ph) * 0.05) * s.rad;
            z = Math.sin(s.ang) * s.rad;
          }
          y = CY(4) + 0.9 + Math.sin(tt * 2.6 + s.ph) * 0.45;
          break;
        case 5:
          x = Math.cos(s.ang) * s.rad; z = Math.sin(s.ang) * s.rad;
          y = CY(5) + 1.4 + Math.max(0, Math.sin(tt * 0.4 + s.ph)) * 1.5;
          sy = 1.15;
          break;
        case 6:
          if (s.rad < 39) {           /* burning desert: cower */
            x = Math.cos(s.ang) * s.rad; z = Math.sin(s.ang) * s.rad;
            y = CY(6) + 0.8 + Math.abs(Math.sin(tt * 3 + s.ph)) * 0.4;
            rx = 0.7;
          } else if (s.rad < 47.5) {  /* blood river: swim the current */
            var ba = s.ang + tt * 0.14;
            x = Math.cos(ba) * 43.5; z = Math.sin(ba) * 43.5;
            y = CY(6) + 1.05;
            rx = 1.4; ry = -ba; sy = 0.7;
          } else {                    /* wood: bleed among branches */
            x = Math.cos(s.ang) * s.rad; z = Math.sin(s.ang) * s.rad;
            y = CY(6) + 5 + Math.sin(tt * 0.8 + s.ph) * 0.25;
            rx = 1.5; sy = 0.9;
          }
          break;
        case 7: {
          var fa = s.ang + tt * 0.06;
          var frings = [34, 25, 16];
          var fr = frings[Math.floor(s.rad) % 3];
          var dunk = Math.max(0, Math.sin(tt * 1.3 + s.ph));
          x = Math.cos(fa) * fr; z = Math.sin(fa) * fr;
          y = CY(7) - 0.5 + dunk * 1.7;
          break;
        }
        default:
          x = Math.cos(s.ang) * s.rad; z = Math.sin(s.ang) * s.rad;
          y = CY(8) + 0.75 + Math.sin(tt * 9 + s.ph) * 0.03;
          sy = 0.35;
      }
      _sv.set(x, y, z);
      _ss.set(1, sy, 1);
      soulsPool.setAt(s.i, _sv, { x: rx, y: ry, z: 0 }, _ss);
    }
    soulsPool.flush();
  }

  /* ---------------- Greed boulders ---------------- */
  function buildWeights() {
    weightsPool = new VC.InstPool(VC.ico(2.1, 0), VC.mc(0x6a5a3a, 0x14100a), VC.pop(22), 'weights');
    hell.add(weightsPool.mesh);
    for (var i = 0; i < weightsPool.max; i++) {
      weightItems.push({ i: i, ang: (i / weightsPool.max) * Math.PI * 2, dir: i % 2 ? 1 : -1, rad: i % 2 ? 84 : 89 });
    }
    weightsPool.flush();
  }
  var _wv = new THREE.Vector3(), _ws = new THREE.Vector3(1.7, 1.4, 1.7);
  function updateWeights(t, dt) {
    if (!weightsPool) return;
    var mf = VC.motionFactor();
    for (var i = 0; i < weightItems.length; i++) {
      var w = weightItems[i];
      w.ang += w.dir * dt * 0.13 * mf;
      _wv.set(Math.cos(w.ang) * w.rad, CY(3) + 2.3, Math.sin(w.ang) * w.rad);
      weightsPool.setAt(w.i, _wv, { y: -w.ang }, _ws);
    }
    weightsPool.flush();
  }

  /* ---------------- Demons & Dragons ---------------- */
  function buildDemonsAndDragons() {
    for (var f = 0; f < VC.pop(5); f++) {
      var dem = VC.makeDemon(rng, { scale: 1.6, wings: true, wingColor: 0x2a0810 });
      hell.add(dem);
      flyingDemons.push({
        g: dem, a: rng.range(0, 6.28), r: rng.range(45, 135),
        y: rng.range(4, -42), sp: rng.range(0.12, 0.3) * (rng.chance(0.5) ? 1 : -1),
        bob: rng.range(0, 6.28)
      });
    }
    var patrolCircles = [0, 3, 5, 6, 7];
    for (var g = 0; g < patrolCircles.length; g++) {
      var ci = patrolCircles[g];
      var gd = VC.makeDemon(rng, { scale: 1.35, color: rng.chance(0.5) ? 0x7a2418 : 0x54222e });
      gd.userData.circle = ci;
      hell.add(gd);
      groundDemons.push({ g: gd, orbit: true, a: rng.range(0, 6.28), r: Math.max(10, CR(ci) - 10), ci: ci });
    }
    var big = VC.buildDragon(rng, { scale: 2.4, radius: 185, height: 6, speed: 0.13 });
    hell.add(big.group);
    var med = VC.buildDragon(rng, { scale: 1.2, radius: 118, height: 10, speed: 0.19, body: 0x241a2a });
    hell.add(med.group);
    var sm = VC.buildDragon(rng, { scale: 0.8, radius: 40, height: 26, speed: 0.26, body: 0x1c2430 });
    hell.add(sm.group);
    VC.animated.dragons = [big, med, sm];
    bigDragon = big;
  }
  function updateDragonsAll(t, dt, camPos) {
    var ds = VC.animated.dragons;
    if (!ds) return;
    for (var i = 0; i < ds.length; i++) VC.updateDragon(ds[i], dt, t, camPos, i === 0 ? dragonFire : null);
  }

  function updateDemons(t, dt) {
    var mf = VC.motionFactor();
    var i;
    for (i = 0; i < flyingDemons.length; i++) {
      var f = flyingDemons[i];
      f.a += f.sp * dt * mf;
      f.g.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(t * 0.6 + f.bob) * 5, Math.sin(f.a) * f.r);
      f.g.rotation.y = -f.a + Math.PI / 2 + (f.sp > 0 ? Math.PI : 0);
      var rig = f.g.userData.rig;
      if (rig.wings) {
        var flap = Math.sin(t * 5 + i) * 0.7 * mf;
        rig.wings[0].rotation.y = flap;
        rig.wings[1].rotation.y = -flap;
      }
      rig.head.rotation.x = Math.sin(t * 1.4 + i) * 0.15;
    }
    for (i = 0; i < groundDemons.length; i++) {
      var g = groundDemons[i];
      var rig2 = g.g.userData.rig;
      if (g.hover) {
        g.g.position.y = g.baseY + Math.sin(t * 0.8 + g.phase) * 1.6;
        g.g.rotation.y += dt * 0.3;
        if (rig2.wings) {
          rig2.wings[0].rotation.y = Math.sin(t * 3.4) * 0.55;
          rig2.wings[1].rotation.y = -Math.sin(t * 3.4) * 0.55;
        }
      } else if (g.orbit) {
        g.a += dt * 0.24 * mf;
        g.g.position.set(Math.cos(g.a) * g.r, CY(g.ci) + 1.2, Math.sin(g.a) * g.r);
        g.g.rotation.y = -g.a;
        VC.animateWalk(rig2, t, 0.85, 1);
      }
    }
    for (i = 0; i < centaurs.length; i++) {
      var ce = centaurs[i];
      ce.userData.orbitA += dt * 0.2 * mf;
      ce.position.set(Math.cos(ce.userData.orbitA) * ce.userData.orbitR, CY(6) + 1.3, Math.sin(ce.userData.orbitA) * ce.userData.orbitR);
      ce.rotation.y = -ce.userData.orbitA + Math.PI;
      var rig3 = ce.userData.rig;
      rig3.armR.rotation.x = -0.4 - Math.max(0, Math.sin(t * 2.4 + i * 2)) * 0.9;
    }
    for (i = 0; i < poets.length; i++) {
      VC.animateWalk(poets[i].userData.rig, t + i * 10, 0.24, 0.5);
      poets[i].position.x += Math.sin(t * 0.2 + i) * 0.004;
      poets[i].rotation.y += Math.sin(t * 0.11 + i) * 0.002;
    }
    for (i = 0; i < simoniacs.length; i++) {
      simoniacs[i].rotation.x = Math.sin(t * 3 + i * 2) * 0.22;
    }
    for (i = 0; i < geryonCoil.length; i++) {
      geryonCoil[i].rotation.y = 0.5 + Math.sin(t * 0.9 + i * 0.4) * 0.14 * mf;
    }
    for (i = 0; i < geryonHeads.length; i++) {
      geryonHeads[i].rotation.y = Math.sin(t * 1.2 + i * 2) * 0.5;
    }
    for (i = 0; i < fireJets.length; i++) {
      var jet = fireJets[i];
      var k = 0.5 + Math.abs(Math.sin(t * 1.4 + i * 1.7)) * 1.7;
      jet.scale.y = k;
      jet.visible = k > 0.62;
    }
    for (i = 0; i < castleTorches.length; i++) VC.animateFlame(castleTorches[i].userData.flame, t + i, 0.7);
    for (i = 0; i < towerFlames.length; i++) VC.animateFlame(towerFlames[i], t + i * 0.5, 1);
    /* Minos tail coils */
    if (minosCoils.length) {
      var c = (Math.sin(t * 0.5) * 0.5 + 0.5) * 0.6;
      for (i = 0; i < minosCoils.length; i++) {
        minosCoils[i].rotation.y = Math.sin(t * 1.1 + i * 0.35) * c;
      }
      var mrig = minosBody.userData.rig;
      mrig.head.rotation.y = Math.sin(t * 0.6) * 0.45;
      VC.animateWalk(mrig, t, 0.3, 0.35);
    }
  }

  /* ---------------- Particles ---------------- */
  function buildParticles() {
    var q = VC.QUALITIES[VC.quality];
    embers = new VC.ParticleField(Math.round(850 * q.particles), { name: 'hellEmbers' });
    hell.add(embers.points);
    dragonFire = new VC.ParticleField(Math.round(360 * q.particles), { name: 'dragonFire' });
    hell.add(dragonFire.points);
    rain = new VC.ParticleField(Math.round(650 * q.particles), { name: 'gluttonySleet', additive: false });
    hell.add(rain.points);
    snow = new VC.ParticleField(Math.round(320 * q.particles), { name: 'cocytusSnow', additive: false });
    hell.add(snow.points);
    bubbles = new VC.ParticleField(Math.round(220 * q.particles), { name: 'styxBubbles' });
    hell.add(bubbles.points);

    var rainR = CR(2) - 6, cy2 = CY(2) + 0.5, cy8 = CY(8);
    var i;
    for (i = 0; i < rain.count; i++) {
      var a = rng.range(0, Math.PI * 2), r = rng.range(0, rainR);
      rain.spawn(Math.cos(a) * r, cy2 + rng.range(2, 30), Math.sin(a) * r, 0, -30, 0, 1.6, 1.2, 0.72, 0.82, 0.95);
    }
    rainBeh = function (idx, i3) {
      if (rain.pos[i3 + 1] < cy2) {
        var a2 = rng.range(0, Math.PI * 2), r2 = rng.range(0, rainR);
        rain.pos[i3] = Math.cos(a2) * r2; rain.pos[i3 + 1] = cy2 + 28; rain.pos[i3 + 2] = Math.sin(a2) * r2;
        rain.life[idx] = 1.2;
      }
    };
    for (i = 0; i < snow.count; i++) {
      var a3 = rng.range(0, Math.PI * 2), r3 = rng.range(0, 30);
      snow.spawn(Math.cos(a3) * r3, cy8 + rng.range(1, 18), Math.sin(a3) * r3, rng.range(-1.2, 1.2), -3.2, rng.range(-1.2, 1.2), 4.5, 1.7, 0.85, 0.92, 1);
    }
    snowBeh = function (idx, i3) {
      if (snow.pos[i3 + 1] < cy8 + 0.5) {
        var a4 = rng.range(0, Math.PI * 2), r4 = rng.range(0, 34);
        snow.pos[i3] = Math.cos(a4) * r4; snow.pos[i3 + 1] = cy8 + 16; snow.pos[i3 + 2] = Math.sin(a4) * r4;
        snow.life[idx] = 4.5;
      }
    };
    bubBeh = function (idx, i3) {
      if (bubbles.pos[i3 + 1] > CY(4) + 2.8) bubbles.life[idx] = 0;
    };
  }

  function updateParticles(t, dt, camPos, inHell) {
    var mf = VC.motionFactor();
    emberTimer -= dt;
    if (inHell && emberTimer <= 0) {
      emberTimer = 0.05 / Math.max(mf, 0.3);
      for (var k = 0; k < 2; k++) {
        var hs = hotSpots[Math.floor(Math.random() * hotSpots.length)];
        if (!hs) break;
        var dist = Math.abs(hs[1] - camPos.y) + Math.hypot(hs[0] - camPos.x, hs[2] - camPos.z) * 0.25;
        if (dist > 260) continue;
        embers.spawn(
          hs[0] + (Math.random() - 0.5) * 3, hs[1], hs[2] + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2.4, 4 + Math.random() * 7, (Math.random() - 0.5) * 2.4,
          2.4 + Math.random() * 2, 1.5 + Math.random() * 2.2,
          1, 0.33 + Math.random() * 0.3, 0.06);
      }
    }
    embers.step(dt, function (i, i3, ddt) {
      embers.vel[i3 + 1] -= ddt * 2.4;
      embers.vel[i3] += Math.sin(embers.pos[i3 + 1] * 0.3 + t * 2) * ddt * 2.5;
    });
    rain.step(dt, rainBeh);
    snow.step(dt, snowBeh);
    bubbleTimer -= dt;
    if (inHell && bubbleTimer <= 0) {
      bubbleTimer = 0.12;
      var a = rng.range(0, Math.PI * 2), r = rng.range(8, CR(4) - 8);
      bubbles.spawn(Math.cos(a) * r, CY(4) + 0.8, Math.sin(a) * r, 0, 1.8, 0, 1.4, 2.6, 0.55, 0.4, 0.2);
    }
    bubbles.step(dt, bubBeh);
    dragonFire.step(dt, function (i, i3, ddt) {
      dragonFire.vel[i3 + 1] -= ddt * 6;
      var kk = dragonFire.life[i] / dragonFire.maxLife[i];
      dragonFire.col[i3 + 1] = 0.18 + (1 - kk) * 0.25;
    });
    rain.points.visible = Math.abs(camPos.y - CY(2)) < 48 && Math.hypot(camPos.x, camPos.z) < 240;
    snow.points.visible = Math.abs(camPos.y - CY(8)) < 44;
    bubbles.points.visible = Math.abs(camPos.y - CY(4)) < 44;
    embers.points.visible = inHell || camPos.y < 30;
    dragonFire.points.visible = embers.points.visible;
  }

  /* ---------------- public hooks ---------------- */
  VC.hell = {
    get gate() { return gateObj; },
    get charon() { return charonBoat; },
    get bigDragon() { return bigDragon; }
  };
}());
