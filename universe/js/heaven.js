/* =========================================================================
 * Voxel Cosmos — heaven.js
 * Cloud islands & bridges, Pearly Gates + Saint Peter (greeting, keys,
 * gate-opening), angel orchestra with harps, cloud gardens, Fountain of
 * Light, Hall of Good Souls, the celestial avenue and the Kingdom of
 * Heaven castle (courtyard, banners, radiant throne hall, choir), doves.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var part = VC.part;
  var L = VC.LEVELS;

  var rng, heaven;
  var gateAngels = [], waitingSouls = [];
  var islands = [], banners = [], towers = [], gardenTrees = [];
  var hallSouls = [], choirAngels = [], harpAngels = [];
  var heavenSouls = [], heavenAngels = [];
  var pearlGates = null, fountain = null, fountainLight = null, throneLight = null;
  var orchestraConductor = null, motes = null, doveField = null, doveTimer = 0;
  var MAT = {};

  function mats() {
    MAT = VC.heavenMats;
    if (!MAT.white) {
      MAT.white = VC.mc(0xf4f1e8);
      MAT.ivory = VC.mc(0xf8f2dc);
      MAT.gold = VC.mc(0xe8c860, 0x302200);
      MAT.marble = VC.mc(0xffffff);
      MAT.pearl = VC.tmat('pearlGlow', 'pearl', function () {
        return new THREE.MeshPhongMaterial({ color: 0xf6ecf4, emissive: 0x2a2233, shininess: 90 });
      }, 0x141020, 0xffe9c8);
      MAT.stairGlow = VC.tmat('stairGlow', 'stairStep', function () {
        return new THREE.MeshLambertMaterial({ color: 0xefe8d8, emissive: 0x1a1408 });
      }, 0x0a0802, 0xffe9b0);
      MAT.castleGlow = VC.tmat('castleGlow', 'castleTrim', function () {
        return new THREE.MeshLambertMaterial({ color: 0xf0e8d0, emissive: 0x1c1408 });
      }, 0x0a0802, 0xffeec2);
    }
  }

  VC.buildHeaven = function () {
    rng = VC.makeRng(9999);
    heaven = VC.realms.heaven;
    mats();

    buildPearlyGates();
    buildCloudIslands();
    buildCelestialAvenue();
    buildCastle();
    buildGardensAndFountain();
    buildHallOfSouls();
    buildOrchestra();
    buildSoulsAndAngels();

    var q = VC.QUALITIES[VC.quality];
    motes = new VC.ParticleField(Math.round(420 * q.particles), { name: 'heavenMotes' });
    heaven.add(motes.points);
    doveField = new VC.ParticleField(Math.round(90 * q.particles), { name: 'doves', additive: false });
    heaven.add(doveField.points);

    /* cloud sea backdrop */
    var sea = VC.cloudPuffMesh(VC.pop(220), VC.cloudMaterial(0xf6f8ff, 0.92));
    VC.fillCloudPuffs(sea, [
      { x: -90, y: L.HEAVEN_BASE_Y - 4, z: 200, r: 30 },
      { x: 90, y: L.HEAVEN_BASE_Y - 6, z: 220, r: 32 },
      { x: 0, y: L.HEAVEN_BASE_Y - 8, z: 300, r: 40 },
      { x: -120, y: L.HEAVEN_BASE_Y - 2, z: 120, r: 26 },
      { x: 120, y: L.HEAVEN_BASE_Y - 3, z: 130, r: 26 },
      { x: 0, y: L.CASTLE_Y - 16, z: 250, r: 30 }
    ], rng, { puffsPer: 40, scale: 1.2 });
    heaven.add(sea);

    VC.scene.add(heaven);
    VC.registerAnimator(update, 'heaven');
  };

  /* ---------------- Pearly Gates + Saint Peter ---------------- */
  function buildPearlyGates() {
    var G = new THREE.Group();
    var gz = 106, gy = L.STAIR_TOP_Y + 1;
    var gold = MAT.gold, pearl = MAT.pearl;

    G.add(new THREE.Mesh(VC.box(34, 2.4, 30), MAT.marble).translateY(-1.2).translateZ(4));
    G.add(new THREE.Mesh(VC.box(28, 3, 24), VC.cloudMaterial(0xf4f6ff, 0.95)).translateY(-3.6).translateZ(4));

    [-9, 9].forEach(function (x) {
      G.add(part(2.4, 22, 2.4, gold, x, 11, 0));
      G.add(part(3.4, 1.4, 3.4, VC.mc(0xf8eab8), x, 22.6, 0));
      var capS = new THREE.Mesh(VC.sphereGeo(1.6, 8, 6), MAT.castleGlow);
      capS.position.set(x, 24.6, 0);
      G.add(capS);
      var haloRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 6, 14), pearl);
      haloRing.position.set(x, 26.4, 0);
      haloRing.rotation.x = Math.PI / 2;
      G.add(haloRing);
      var tA = VC.buildAngel({ scale: 0.8, shirt: 0xf8f4e6 });
      tA.group.position.set(x, 23.4, 1.8);
      tA.group.scale.set(0.8 * (x > 0 ? -1 : 1), 0.8, 0.8);
      G.add(tA.group);
      gateAngels.push(tA);
    });
    var arch = new THREE.Mesh(new THREE.TorusGeometry(9.4, 1.3, 8, 20, Math.PI), gold);
    arch.position.set(0, 22, 0);
    G.add(arch);
    var archInner = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.5, 6, 18, Math.PI), pearl);
    archInner.position.set(0, 22, 0.2);
    G.add(archInner);

    var tex = VC.banner('VENITE BENEDICTI PATRIS', '· THE GATES ARE OPEN ·', {
      bg: 'rgba(30,24,8,0.30)', line: 'rgba(255,235,170,0.85)', fg: '#fff3d0', fg2: 'rgba(255,244,210,0.9)'
    });
    var bannerM = VC.makeBanner(tex, 17, 6, { fog: false });
    bannerM.position.set(0, 26.4, 0.9);
    G.add(bannerM);

    function door(side) {
      var pivot = new THREE.Group();
      pivot.position.set(side * 8.6, 0, 0);
      var dg = new THREE.Group();
      dg.position.set(-side * 4.3, 10.6, 0);
      dg.add(part(8.6, 21.2, 1, pearl, 0, 0, 0));
      var archD = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.55, 6, 10, Math.PI), pearl);
      archD.position.set(0, 10.4, 0);
      dg.add(archD);
      for (var rI = 0; rI < 5; rI++) {
        for (var cI = 0; cI < 2; cI++) {
          var stud = new THREE.Mesh(VC.sphereGeo(0.42, 6, 4), MAT.ivory);
          stud.position.set(-2 + cI * 4, -7 + rI * 3.6, 0.62);
          dg.add(stud);
        }
      }
      dg.add(part(8.7, 0.5, 0.3, gold, 0, 3.4, 0.55));
      dg.add(part(8.7, 0.5, 0.3, gold, 0, -5.6, 0.55));
      pivot.add(dg);
      return pivot;
    }
    var leftD = door(-1), rightD = door(1);
    G.add(leftD, rightD);

    var spill = new THREE.Mesh(VC.plane(17, 22),
      new THREE.MeshBasicMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    spill.position.set(0, 11, -1.5);
    G.add(spill);
    var spillShaft = VC.makeLightShaft(3, 12, 26, 0xfff4d0, 0.0);
    spillShaft.position.set(0, 14, -8);
    spillShaft.rotation.x = Math.PI / 2;
    G.add(spillShaft);

    var topA = VC.buildAngel({ scale: 1.5, shirt: 0xfffaee });
    topA.group.position.set(0, 30.4, 0.6);
    topA.group.rotation.y = Math.PI;
    topA.group.userData.rig.armL.rotation.z = 0.9;
    topA.group.userData.rig.armR.rotation.z = -0.9;
    G.add(topA.group);
    gateAngels.push(topA);

    leftD.userData.noMerge = true;
    rightD.userData.noMerge = true;
    gateAngels.forEach(function (ga) { ga.group.userData.noMerge = true; });
    topA.group.userData.noMerge = true;
    G.position.set(0, gy, gz);
    heaven.add(G);
    VC.mergeVoxelGroup(G);

    var open = 0, target = 0, startOpen = 0, animT = 0, dur = 2.6;
    pearlGates = {
      group: G, isOpen: false, k: 0,
      setOpen: function (v, d) {
        target = v ? 1 : 0;
        startOpen = open;
        this.isOpen = !!v;
        animT = 0;
        dur = d || 2.6;
        VC.emit('pearlGate', !!v);
      }
    };
    VC.animated.gates.pearl = pearlGates;
    pearlGates._upd = function (dt, t) {
      animT += dt;
      var k = VC.easeInOut(VC.clamp(animT / dur, 0, 1));
      open = startOpen + (target - startOpen) * k;
      var o = VC.smoothstep(VC.clamp(open, 0, 1));
      leftD.rotation.y = -o * 1.75;
      rightD.rotation.y = o * 1.75;
      pearlGates.k = o;
      spill.material.opacity = o * 0.5;
      spillShaft.material.opacity = o * 0.22;
      for (var gA = 0; gA < gateAngels.length; gA++) {
        VC.animateAngel(gateAngels[gA], dt, t + gA, 0.35);
      }
    };

    var P = VC.buildPeter();
    heaven.add(P.group);
    VC.animated.peter = P;

    for (var w = 0; w < VC.pop(9); w++) {
      var ws = VC.makeHumanoid({ robe: true, shirt: 0xf2eee2, skin: 0xd8c0b0, hair: 0xd0c8b8, halo: true, scale: rng.range(0.85, 1.05) });
      var wa = rng.range(0, Math.PI * 2);
      ws.position.set(Math.cos(wa) * rng.range(7, 14), gy + 0.05, gz + rng.range(5, 20));
      ws.rotation.y = rng.range(-0.8, 0.8) + Math.PI;
      heaven.add(ws);
      waitingSouls.push({ g: ws, ph: rng() * 6.28, baseY: gy + 0.05 });
    }
    VC.addLabel('The Pearly Gates', new THREE.Vector3(0, gy + 34, gz), { realm: 'heaven', major: true });
  }

  /* ---------------- islands & bridges ---------------- */
  function island(x, y, z, r) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(VC.cyl(r, r * 1.08, 2.2, 9), MAT.marble));
    var puffs = VC.cloudPuffMesh(VC.pop(30), VC.cloudMaterial(0xeef2ff, 0.96));
    VC.fillCloudPuffs(puffs, [{ x: 0, y: -2.6, z: 0, r: r * 0.72 }], rng, { puffsPer: 30, scale: 1.15 });
    g.add(puffs);
    g.position.set(x, y, z);
    heaven.add(g);
    islands.push({ g: g, baseY: y, ph: rng() * 6.28 });
    return g;
  }
  function bridge(x1, z1, x2, z2, y) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.hypot(dx, dz);
    var bg = new THREE.Group();
    bg.add(new THREE.Mesh(VC.box(5.4, 0.6, len), MAT.white));
    [-1, 1].forEach(function (sx) {
      bg.add(part(0.5, 1.1, len, MAT.gold, sx * 2.9, 0.85, 0));
    });
    bg.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    bg.rotation.y = Math.atan2(dx, dz);
    heaven.add(bg);
    return bg;
  }
  function buildCloudIslands() {
    var HB = L.HEAVEN_BASE_Y;
    island(-46, HB + 4, 152, 16);
    island(46, HB + 3, 148, 17);
    island(-30, HB + 5, 186, 15);
    island(44, HB + 4.5, 194, 14);
    island(-64, HB + 1, 118, 10);
    island(66, HB + 1.5, 116, 11);
    island(0, HB + 0.5, 205, 12);
    island(-88, HB + 10, 190, 9);
    island(92, HB + 8, 210, 8);
    island(0, HB + 14, 310, 10);
    bridge(0, 120, -38, 146, HB + 5);
    bridge(0, 120, 38, 144, HB + 4.4);
    bridge(-40, 158, -30, 180, HB + 5.4);
    bridge(40, 156, 42, 182, HB + 4.2);
    bridge(-24, 188, -8, 200, HB + 5.8);
    bridge(30, 190, 12, 202, HB + 5.2);
    bridge(0, 212, 0, 234, L.CASTLE_Y - 7);
  }

  /* ---------------- celestial avenue ---------------- */
  function buildCelestialAvenue() {
    var ay = L.CASTLE_Y - 6.5;
    heaven.add(new THREE.Mesh(VC.box(14, 1.2, 44), MAT.ivory).translateY(ay).translateZ(236));
    heaven.add(new THREE.Mesh(VC.box(14, 1.2, 12), MAT.stairGlow).translateY(L.CASTLE_Y - 10).translateZ(210));
    var nL = 12;
    var lamps = new THREE.InstancedMesh(VC.boxGeo(0.9, 0.9, 0.9),
      VC.tmat('castleGlow', 'avenueLamp', function () { return VC.emissive(0xfff2c8, 1.15); }, 0x201808, 0xfff4d0), nL);
    var poles = new THREE.InstancedMesh(VC.boxGeo(0.4, 2.6, 0.4), MAT.gold, nL);
    var d = new THREE.Object3D();
    for (var i = 0; i < nL; i++) {
      var sx = i % 2 ? 1 : -1;
      var pz = 214 + Math.floor(i / 2) * 7;
      d.position.set(sx * 8.4, ay + 2.6, pz);
      d.updateMatrix();
      lamps.setMatrixAt(i, d.matrix);
      d.position.y = ay + 1.2;
      d.updateMatrix();
      poles.setMatrixAt(i, d.matrix);
    }
    heaven.add(lamps, poles);
    var bTex = VC.banner('SANCTUS SANCTUS SANCTUS', '', { bg: 'rgba(250,244,224,0.92)', line: 'rgba(212,175,55,0.9)', fg: '#8a6a1a' });
    for (var b = 0; b < 4; b++) {
      var bg = new THREE.Group();
      bg.add(part(0.3, 9, 0.3, MAT.gold, 0, 4.5, 0));
      var bn = VC.makeBanner(bTex, 3.4, 4.4, {});
      bn.position.set(1.8, 6.2, 0);
      bg.add(bn);
      bg.position.set((b % 2 ? 1 : -1) * 10.5, ay, 218 + Math.floor(b / 2) * 16);
      heaven.add(bg);
      banners.push({ g: bn, ph: b });
    }
    VC.addLabel('The Celestial Avenue', new THREE.Vector3(0, ay + 8, 232), { realm: 'heaven' });
  }

  /* ---------------- Kingdom of Heaven ---------------- */
  function buildCastle() {
    var cy = L.CASTLE_Y - 6;
    var cG = new THREE.Group();
    cG.position.set(0, cy, 250);
    heaven.add(cG);

    cG.add(part(34, 1.6, 30, MAT.marble, 0, 0, 0));
    cG.add(part(36, 10, 2.6, MAT.white, 0, 5.6, -14));
    cG.add(part(36, 10, 2.6, MAT.white, 0, 5.6, 16));
    cG.add(part(2.6, 10, 30, MAT.white, -17.7, 5.6, 1));
    cG.add(part(2.6, 10, 30, MAT.white, 17.7, 5.6, 1));

    var merlons = new THREE.InstancedMesh(VC.boxGeo(1.6, 1.6, 1.6), MAT.ivory, 40);
    var d = new THREE.Object3D();
    var mI = 0;
    function merlonRow(x0, z0, x1, z1, n) {
      for (var i = 0; i <= n && mI < merlons.count; i++) {
        d.position.set(VC.lerp(x0, x1, i / n), 11.4, VC.lerp(z0, z1, i / n));
        d.updateMatrix();
        merlons.setMatrixAt(mI++, d.matrix);
      }
    }
    merlonRow(-17, -14, 17, -14, 8);
    merlonRow(-17, 16, 17, 16, 8);
    merlonRow(-17.7, -13, -17.7, 15, 7);
    merlonRow(17.7, -13, 17.7, 15, 7);
    merlons.count = mI;
    cG.add(merlons);

    var gh = new THREE.Group();
    var ghWin = VC.tmat('castleGlow', 'gateWin', function () { return VC.emissive(0xffe9b0, 1); }, 0x241c08, 0xffeebc);
    gh.add(part(12, 13, 4, MAT.white, 0, 6.5, 0));
    gh.add(part(6, 9, 4.4, VC.mc(0xe8e0cc), 0, 4.5, 0));
    gh.add(part(4.4, 2.6, 0.4, ghWin, 0, 10.4, 2.2));
    gh.position.set(0, 0, -14.8);
    cG.add(gh);

    [[-17, -14], [17, -14], [-17, 16], [17, 16]].forEach(function (p, i) {
      var tw = new THREE.Group();
      tw.add(new THREE.Mesh(VC.cyl(3, 3.4, 20, 8), MAT.ivory));
      var roofT = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 8), MAT.gold);
      roofT.position.y = 14;
      tw.add(roofT);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.16, 6, 12), MAT.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 11;
      tw.add(ring);
      var twWin = new THREE.Mesh(VC.box(0.8, 6, 0.8), ghWin);
      twWin.position.set(0, 6, 3.2);
      tw.add(twWin);
      tw.add(part(0.18, 3, 0.18, MAT.gold, 0, 19.6, 0));
      var fl = new THREE.Mesh(VC.plane(2.4, 1.4), new THREE.MeshLambertMaterial({ color: 0xf8e8b0, side: THREE.DoubleSide }));
      fl.position.set(1.3, 20, 0);
      tw.add(fl);
      towers.push({ flag: fl, ph: i * 1.4 });
      tw.position.set(p[0], 1.2, p[1]);
      cG.add(tw);
    });

    /* radiant central hall */
    var hall = new THREE.Group();
    hall.add(part(16, 12, 14, MAT.ivory, 0, 6, 0));
    hall.add(part(18, 1.4, 16, MAT.gold, 0, 12.6, 0));
    var dome = new THREE.Mesh(VC.sphereGeo(5.6, 10, 6),
      VC.tmat('castleGlow', 'dome', function () {
        return new THREE.MeshPhongMaterial({ color: 0xfff8e0, emissive: 0x221a08, shininess: 120 });
      }, 0x100c04, 0xfff2c0));
    dome.position.y = 16.2;
    hall.add(dome);
    var spire = new THREE.Mesh(VC.cone(1.2, 4, 4), MAT.gold);
    spire.position.y = 22.6;
    hall.add(spire);
    var crossBall = new THREE.Mesh(VC.sphereGeo(0.8, 6, 4), MAT.castleGlow);
    crossBall.position.y = 25;
    hall.add(crossBall);
    var wm = VC.tmat('castleGlow', 'halWin', function () {
      return new THREE.MeshLambertMaterial({ color: 0xffecc8, emissive: 0x221808 });
    }, 0x181004, 0xfff0c0);
    for (var wN = 0; wN < 6; wN++) {
      var side = wN < 3 ? 1 : -1;
      var off = (wN % 3 - 1) * 4.6;
      hall.add(part(0.4, 5.4, 2.2, wm, side * 8.1, 6.4, off));
    }
    throneLight = new THREE.PointLight(0xfff0c8, 1.6, 70, 2);
    throneLight.position.set(0, 8, 2);
    hall.add(throneLight);
    hall.add(part(4, 4, 3, MAT.gold, 0, 2, 2));
    hall.add(part(4, 6, 0.8, MAT.gold, 0, 5.4, 0.8));
    var haloT = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 6, 14), MAT.castleGlow);
    haloT.position.set(0, 8.6, 1.4);
    hall.add(haloT);
    var radiance = VC.glowSprite(0xfff6d8, 16, 0.55);
    radiance.position.set(0, 6, 2.6);
    hall.add(radiance);
    hall.position.set(0, 1.2, 4);
    cG.add(hall);

    /* choir on the courtyard steps */
    for (var chI = 0; chI < VC.pop(6); chI++) {
      var ca = VC.buildAngel({ scale: 0.75, harp: chI % 2 === 0, shirt: 0xfff8e8 });
      ca.group.position.set(-12 + chI * 4.8, cy + 1.4, 246);
      ca.group.rotation.y = Math.PI;
      heaven.add(ca.group);
      choirAngels.push(ca);
    }

    /* courtyard fountain */
    cG.add(new THREE.Mesh(VC.cyl(2.4, 2.8, 1.6, 10), MAT.marble).translateY(1.6));
    var cfWater = new THREE.Mesh(new THREE.CircleGeometry(2.1, 12), VC.waterMaterial({ deep: 0x9fd6f0, shallow: 0xffffff, amp: 0.2 }));
    cfWater.rotation.x = -Math.PI / 2;
    cfWater.position.set(0, 2.45, 0);
    cG.add(cfWater);

    VC.addLabel('Kingdom of Heaven', new THREE.Vector3(0, cy + 36, 250), { realm: 'heaven', major: true });
    VC.addLabel('Radiant Throne Hall', new THREE.Vector3(0, cy + 24, 254), { realm: 'heaven' });
    VC.addLabel('Castle Courtyard', new THREE.Vector3(0, cy + 8, 246), { realm: 'heaven' });
    towers.forEach(function (tw) { tw.flag.userData.noMerge = true; });
    VC.mergeVoxelGroup(cG);
    VC.castleCenter = new THREE.Vector3(0, cy + 10, 250);
  }

  /* ---------------- gardens & fountain of light ---------------- */
  function buildGardensAndFountain() {
    var gy = L.HEAVEN_BASE_Y + 5.2;
    var lawn = new THREE.Mesh(new THREE.CircleGeometry(13, 24), VC.mc(0x6ab06a));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(46, gy + 1.2, 148);
    heaven.add(lawn);
    var flowers = new THREE.InstancedMesh(VC.boxGeo(0.3, 0.8, 0.3), VC.mc(0xffffff), VC.pop(90));
    var d = new THREE.Object3D();
    var fc = [0xff8aa0, 0xffd86a, 0xffffff, 0xc8a0ff];
    for (var i = 0; i < flowers.count; i++) {
      var a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng()) * 11;
      d.position.set(46 + Math.cos(a) * r, gy + 1.9, 148 + Math.sin(a) * r);
      d.rotation.y = rng() * 6;
      d.updateMatrix();
      flowers.setMatrixAt(i, d.matrix);
      flowers.setColorAt(i, new THREE.Color(fc[i % 4]));
    }
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    heaven.add(flowers);
    var treeMat = VC.tmat('castleGlow', 'treeGlow', function () {
      return new THREE.MeshLambertMaterial({ color: 0x9ad8a0, emissive: 0x101c10 });
    }, 0x08120a, 0xc8f0c0);
    for (var tr = 0; tr < VC.pop(8); tr++) {
      var tg = new THREE.Group();
      tg.add(part(0.5, 3.4, 0.5, VC.mc(0xc8b89a), 0, 1.7, 0));
      var crown = new THREE.Mesh(VC.ico(rng.range(1.6, 2.4), 0), treeMat);
      crown.position.y = 4.2;
      tg.add(crown);
      var ta = rng.range(0, Math.PI * 2), trr = rng.range(5, 12);
      tg.position.set(46 + Math.cos(ta) * trr, gy + 1.2, 148 + Math.sin(ta) * trr);
      heaven.add(tg);
      gardenTrees.push({ g: tg, crown: crown, ph: rng() * 6.28 });
    }
    var pool = new THREE.Mesh(new THREE.CircleGeometry(4.6, 20),
      VC.waterMaterial({ deep: 0xaee2f8, shallow: 0xffffff, amp: 0.2, opacity: 0.9 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(50, gy + 1.26, 151);
    heaven.add(pool);
    var poolRim = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.4, 6, 20), MAT.marble);
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.set(50, gy + 1.32, 151);
    heaven.add(poolRim);
    VC.addLabel('Cloud Gardens', new THREE.Vector3(46, gy + 10, 148), { realm: 'heaven' });

    var fy = L.HEAVEN_BASE_Y + 6.2;
    var fp = new THREE.Group();
    fp.add(new THREE.Mesh(VC.cyl(4.6, 5.2, 1.2, 14), MAT.marble));
    fp.add(new THREE.Mesh(VC.cyl(2.6, 3, 0.8, 12), MAT.ivory).translateY(1.4));
    fp.add(new THREE.Mesh(VC.cyl(0.5, 0.7, 3.4, 8), MAT.gold).translateY(2.8));
    var jet = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 8, 1, true),
      VC.energyMaterial({ color: 0xfff2c8, opacity: 0.85 }));
    jet.position.y = 6.4;
    fp.add(jet);
    var fglow = VC.glowSprite(0xfff6d8, 10, 0.6);
    fglow.position.y = 6;
    fp.add(fglow);
    fountainLight = new THREE.PointLight(0xfff0c0, 1.2, 46, 2);
    fountainLight.position.y = 5;
    fp.add(fountainLight);
    fp.position.set(-30, fy, 186);
    heaven.add(fp);
    fountain = { g: fp, jet: jet };
    VC.addLabel('Fountain of Light', new THREE.Vector3(-30, fy + 11, 186), { realm: 'heaven' });
  }

  /* ---------------- Hall of Good Souls ---------------- */
  function buildHallOfSouls() {
    var hy = L.HEAVEN_BASE_Y + 5.5;
    var hg = new THREE.Group();
    hg.add(part(16, 1, 12, MAT.marble, 0, 0, 0));
    for (var c = 0; c < 8; c++) {
      var col = new THREE.Mesh(VC.cyl(0.7, 0.85, 6.4, 8), MAT.white);
      col.position.set(c < 4 ? -7 : 7, 3.6, -4 + (c % 4) * 2.7);
      hg.add(col);
    }
    hg.add(part(17, 0.9, 13, MAT.ivory, 0, 7.2, 0));
    var roofGlow = VC.tmat('castleGlow', 'hallRoofGlow', function () { return VC.emissive(0xffeec0, 0.9); }, 0x181206, 0xfff2cc);
    hg.add(part(12, 0.3, 8, roofGlow, 0, 7.8, 0));
    hg.position.set(44, hy + 1.1, 194);
    heaven.add(hg);
    for (var s = 0; s < VC.pop(9); s++) {
      var soul = VC.makeHumanoid({ robe: true, shirt: 0xf4f0e4, skin: 0xd8c0b0, hair: 0xd8d0c0, halo: true, scale: 0.9 });
      soul.position.set(44 + rng.range(-5.5, 5.5), hy + 2.2, 194 + rng.range(-4, 4));
      soul.rotation.y = rng.range(-0.5, 0.5);
      heaven.add(soul);
      hallSouls.push({ g: soul, ph: rng() * 6.28, baseY: hy + 2.2 });
    }
    VC.addLabel('Hall of Good Souls', new THREE.Vector3(44, hy + 12, 194), { realm: 'heaven' });
  }

  /* ---------------- angel orchestra ---------------- */
  function buildOrchestra() {
    var oy = L.HEAVEN_BASE_Y + 5.8;
    var stage = new THREE.Group();
    stage.add(new THREE.Mesh(VC.cyl(9, 10, 1.4, 12), MAT.marble));
    var ring = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.3, 6, 20), MAT.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9;
    stage.add(ring);
    stage.position.set(-46, oy, 152);
    heaven.add(stage);
    var kinds = ['harp', 'harp', 'harp', 'trumpet', 'lyre', 'lyre'];
    for (var a = 0; a < kinds.length; a++) {
      var aa = a / kinds.length * Math.PI * 2;
      var ang = VC.buildAngel({ scale: 1.15, harp: kinds[a] === 'harp', shirt: 0xfffaf0 });
      ang.group.position.set(-46 + Math.cos(aa) * 5.6, oy + 1, 152 + Math.sin(aa) * 5.6);
      ang.group.rotation.y = -aa + Math.PI;
      heaven.add(ang.group);
      harpAngels.push(ang);
      if (kinds[a] === 'trumpet') {
        var tp = new THREE.Mesh(VC.cyl(0.12, 0.3, 1.6, 6), MAT.gold);
        tp.rotation.z = Math.PI / 2 - 0.4;
        tp.position.set(0.5, 0.6, 0.7);
        ang.group.userData.rig.hips.add(tp);
      }
    }
    orchestraConductor = VC.buildAngel({ scale: 1.3, shirt: 0xfff2d8 });
    orchestraConductor.group.position.set(-46, oy + 1, 152);
    heaven.add(orchestraConductor.group);
    VC.addLabel('Angel Orchestra', new THREE.Vector3(-46, oy + 10, 152), { realm: 'heaven' });
  }

  /* ---------------- free souls & angels ---------------- */
  function buildSoulsAndAngels() {
    for (var s = 0; s < VC.pop(16); s++) {
      var soul = VC.makeSoul(VC.mc(0xf4f2e8, 0x2a2a18), true);
      soul.scale.setScalar(rng.range(0.8, 1.3));
      heaven.add(soul);
      heavenSouls.push({
        g: soul, cx: rng.range(-60, 60), cz: rng.range(120, 210),
        r: rng.range(6, 26), y: L.HEAVEN_BASE_Y + rng.range(4, 22),
        a: rng() * 6.28, sp: rng.range(0.04, 0.14) * (rng.chance(0.5) ? 1 : -1), ph: rng() * 6.28
      });
    }
    for (var a = 0; a < VC.pop(7); a++) {
      var ang = VC.buildAngel({ scale: 1.1, harp: rng.chance(0.3) });
      heaven.add(ang.group);
      heavenAngels.push({
        ang: ang, cx: rng.range(-70, 70), cz: rng.range(110, 230),
        r: rng.range(14, 40), y: L.HEAVEN_BASE_Y + rng.range(8, 30),
        a: rng() * 6.28, sp: rng.range(0.08, 0.2) * (rng.chance(0.5) ? 1 : -1), ph: rng() * 6.28
      });
    }
  }

  /* ---------------- frame update ---------------- */
  function update(t, dt, camPos) {
    var mf = VC.motionFactor();
    var near = camPos.y > 82;
    var i;
    if (pearlGates) pearlGates._upd(dt, t);
    if (VC.animated.peter) VC.updatePeter(VC.animated.peter, dt, t);
    for (i = 0; i < waitingSouls.length; i++) {
      var w = waitingSouls[i];
      w.g.position.y = w.baseY + Math.sin(t * 0.9 + w.ph) * 0.12;
      VC.animateWalk(w.g.userData.rig, t + w.ph, 0.12, 0.2);
    }
    for (i = 0; i < heavenSouls.length; i++) {
      var s = heavenSouls[i];
      s.a += s.sp * dt * mf;
      s.g.position.set(s.cx + Math.cos(s.a) * s.r, s.y + Math.sin(t * 0.6 + s.ph) * 1.2, s.cz + Math.sin(s.a) * s.r);
      s.g.rotation.y = -s.a;
      s.g.visible = near && camPos.distanceTo(s.g.position) < 170;
    }
    for (i = 0; i < heavenAngels.length; i++) {
      var an = heavenAngels[i];
      an.a += an.sp * dt * mf;
      an.ang.group.position.set(an.cx + Math.cos(an.a) * an.r, an.y + Math.sin(t * 0.8 + an.ph) * 2, an.cz + Math.sin(an.a) * an.r);
      an.ang.group.rotation.y = -an.a + Math.PI / 2;
      VC.animateAngel(an.ang, dt, t + an.ph, 0.75);
      an.ang.group.visible = near && camPos.distanceTo(an.ang.group.position) < 190;
    }
    for (i = 0; i < harpAngels.length; i++) VC.animateAngel(harpAngels[i], dt, t + i, 0.25);
    for (i = 0; i < choirAngels.length; i++) VC.animateAngel(choirAngels[i], dt, t + i * 0.7, 0.2);
    if (orchestraConductor) {
      var rig = orchestraConductor.group.userData.rig;
      rig.armR.rotation.x = -1.2 + Math.sin(t * 2.2) * 0.5;
      rig.armL.rotation.x = -1 + Math.sin(t * 2.2 + Math.PI) * 0.4;
    }
    for (i = 0; i < hallSouls.length; i++) {
      var hs = hallSouls[i];
      hs.g.position.y = hs.baseY + Math.sin(t * 0.8 + hs.ph) * 0.1;
    }
    for (i = 0; i < gardenTrees.length; i++) {
      var gt = gardenTrees[i];
      gt.crown.scale.setScalar(1 + Math.sin(t * 1.4 + gt.ph) * 0.06);
    }
    if (fountain) {
      fountain.jet.scale.y = 1 + Math.sin(t * 2.2) * 0.18;
      fountain.jet.rotation.y = t * 0.6;
      fountainLight.intensity = 1 + Math.sin(t * 1.6) * 0.3;
    }
    if (throneLight) throneLight.intensity = 1.5 + Math.sin(t * 1.2) * 0.4;
    for (i = 0; i < islands.length; i++) {
      var isl = islands[i];
      isl.g.position.y = isl.baseY + Math.sin(t * 0.35 + isl.ph) * 0.5 * mf;
    }
    for (i = 0; i < banners.length; i++) banners[i].g.rotation.z = Math.sin(t * 1.2 + banners[i].ph) * 0.06;
    for (i = 0; i < towers.length; i++) towers[i].flag.rotation.y = Math.sin(t * 2 + towers[i].ph) * 0.3;

    motes.points.visible = near;
    doveField.points.visible = near;
    if (near) {
      if (Math.floor(t * 12) !== Math.floor((t - dt) * 12)) {
        motes.spawn(rng.range(-80, 80), L.HEAVEN_BASE_Y + rng.range(0, 34), rng.range(110, 260),
          rng.range(-0.4, 0.4), rng.range(0.4, 1.2), rng.range(-0.4, 0.4), 4, 1.8, 1, 0.94, 0.72);
      }
      motes.step(dt, function (idx, i3, ddt) {
        motes.pos[i3] += Math.sin(motes.pos[i3 + 1] * 0.4 + t) * ddt * 0.6;
      });
      doveTimer -= dt;
      if (doveTimer <= 0) {
        doveTimer = 0.22;
        var da = t * 0.9 + rng.range(-0.4, 0.4);
        doveField.spawn(Math.cos(da) * (26 + rng.range(-5, 5)), L.CASTLE_Y + 8 + Math.sin(t * 2 + da) * 3,
          250 + Math.sin(da) * 28,
          -Math.sin(da) * 26, Math.cos(t * 3) * 1.2, Math.cos(da) * 26, 2.6, 1.5, 1, 1, 1);
      }
      doveField.step(dt, null);
    }
  }
}());
