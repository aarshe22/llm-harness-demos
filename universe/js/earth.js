/* =========================================================================
 * Voxel Cosmos — earth.js
 * The living middle realm: procedural terrain (mountains, hills, plains),
 * rivers, lake, waterfalls, erupting volcano, forests & farms, the capital
 * city (grid streets, towers, shops, civic hall, parks, streetlights), old
 * town, airport with taking-off airliner + world-circling plane + helicopter
 * + runway lights, railway tram, moving cars/buses, pedestrian crowds,
 * cows/ducks/cats/dogs, hot-air balloon, boats, drifting clouds, birds.
 * Heavy use of InstancedMesh; animated by one realm animator.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var part = VC.part;
  var E = VC.LEVELS.EARTH_Y;

  var rng, earth;
  var cars = [], pedestrians = null, pedData = [], birds = [], cloudLayers = [];
  var _scratchObj = { pos: null, yaw: 0 };

  function part2(w, h, d) { return VC.box(w, h, d); }
  var animals = [], boats = [], cows = [], dogs = [], cats = [], ducks = [];
  var windmillBlades = null, beacon = null, towerBeacon = null;
  var planeTaxi = null, planeFlyer = null, heli = null, heliTail = null, balloon = null, tram = null, tramA = 0;
  var volcanoParticles = null, volcanoSmoke = null, waterfallSpray = null, petalField = null;
  var volcanoTimer = 0, eruptT = 0;
  var streetLights = [];
  var heliRotor = null, balloonBurner = null;
  var _tv = new THREE.Vector3();

  /* ---------------- terrain height field ---------------- */
  function smoothPine(x0, z0, r0, x, z, k) {
    var d = Math.hypot(x - x0, z - z0);
    if (d > r0) return 0;
    var t = 1 - d / r0;
    return t * t * (3 - 2 * t) * k;
  }
  function height(x, z) {
    var PL = VC.PLACES;
    var d = Math.hypot(x, z);
    /* base gentle relief */
    var h = 2.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.018) +
      1.6 * Math.sin(x * 0.05 - z * 0.045) + 1.0 * Math.sin(z * 0.03);
    /* river valley carve */
    var rx = VC.RIVER.fn(z) * 120;
    var rd = Math.abs(x - rx);
    if (rd < 22) h -= VC.smoothstep(1 - rd / 22) * 6.5;
    /* mountain ridge NE */
    var md = Math.hypot(x - PL.peaks.x, z - PL.peaks.z);
    if (md < 100) {
      var mk = smoothPine(PL.peaks.x, PL.peaks.z, 100, x, z, 1);
      h += (Math.sin(x * 0.06) * Math.sin(z * 0.055) * 0.5 + 0.7) * 46 * mk;
      h += Math.max(0, Math.sin(x * 0.11 + 2) * Math.sin(z * 0.1)) * 8 * mk;
    }
    /* secondary hills far west */
    h += smoothPine(-120, 30, 60, x, z, 1) * (14 + Math.sin(x * 0.1) * Math.sin(z * 0.12) * 5);
    /* waterfall hill */
    var fhd = Math.hypot(x - 134, z - 50);
    if (fhd < 46) {
      var fhh = 1 - fhd / 46; fhh = fhh * fhh * 34;
      h += fhh;
      h -= smoothPine(124, 58, 11, x, z, 1) * fhh * 0.9;
    }
    /* volcano */
    var vd = Math.hypot(x - PL.volcano.x, z - PL.volcano.z);
    if (vd < 55) {
      var cone = 38 * (1 - vd / 55);
      h = Math.max(h, cone - 2);
      if (vd < 15) h = Math.max(h, 28);      // crater floor
      if (vd < 15 && h > 30) h = 30;
    }
    /* flatten pads */
    h -= smoothPine(PL.city.x, PL.city.z, 58, x, z, h) * 0.98;                 // city plain
    h *= 1 - smoothPine(PL.city.x, PL.city.z, 52, x, z, 0.92);
    h = h * (1 - smoothPine(PL.airport.x, PL.airport.z, 42, x, z, 0.95));
    h = h * (1 - smoothPine(PL.oldtown.x, PL.oldtown.z, 26, x, z, 0.95));
    h = h * (1 - smoothPine(PL.farm.x, PL.farm.z, 34, x, z, 0.92));
    h = h * (1 - smoothPine(PL.windmill.x, PL.windmill.z, 16, x, z, 0.9));
    h = h * (1 - smoothPine(PL.stairBase.x, PL.stairBase.z, 26, x, z, 0.95));
    h = h * (1 - smoothPine(PL.bridge.x, PL.bridge.z, 14, x, z, 0.9));
    /* lake basin */
    h = h * (1 - smoothPine(PL.lake.x, PL.lake.z, 34, x, z, 1.05)) - smoothPine(PL.lake.x, PL.lake.z, 30, x, z, 4.2);
    /* stair plaza */
    if (Math.abs(x) < 20 && z > 166) h = h * (1 - VC.clamp((z - 166) / 8, 0, 1) * 0.9);
    /* rim drop into the abyss */
    if (d > 150) h = VC.lerp(h, -14, VC.smoothstep((d - 150) / 18));
    return h;
  }
  VC.terrain = { height: height };

  function colorFor(x, z, h, col) {
    var PL = VC.PLACES;
    var c = col; /* [r,g,b] scratch */
    var rx = VC.RIVER.fn(z) * 120;
    if (Math.hypot(x - PL.volcano.x, z - PL.volcano.z) < 52) {
      var vd = Math.hypot(x - PL.volcano.x, z - PL.volcano.z);
      var ash = VC.clamp(1 - vd / 52, 0, 1);
      mix(c, 0x3a3236, ash * 0.85);
      if (vd < 12) mix(c, 0x5a2a14, 0.7);
      return;
    }
    if (h > 40) { mix(c, 0xffffff, VC.clamp((h - 40) / 14, 0, 1) * 0.95); return; }
    if (h > 30) { mix(c, 0x8a8a92, 0.75); return; }
    if (h > 22) { mix(c, 0x4e6a4a, 0.7); return; }
    if (h < -1.6 && Math.hypot(x - rx) < 16) { mix(c, 0x6a5a3a, 0.8); return; }
    var g = VC.clamp(0.25 + h * 0.05, 0, 1);
    mix(c, 0x3f7a3a, 0.55 + g * 0.3);
    /* trails & dry patches */
    var n = Math.sin(x * 0.13 + z * 0.1) * Math.sin(x * 0.07 - z * 0.16);
    if (n > 0.72) mix(c, 0x8a7a4a, 0.5);
  }
  var _c1 = new THREE.Color();
  function mix(c, hex, k) {
    _c1.setHex(hex);
    c[0] = VC.lerp(c[0], _c1.r, k);
    c[1] = VC.lerp(c[1], _c1.g, k);
    c[2] = VC.lerp(c[2], _c1.b, k);
  }

  /* =================================================================== */
  VC.buildEarth = function () {
    rng = VC.makeRng(4242);
    earth = VC.realms.earth;

    buildTerrain();
    buildWaters();
    buildVolcano();
    buildForests();
    buildCity();
    buildOldTown();
    buildFarm();
    buildAirport();
    buildRailway();
    buildRoadsAndTraffic();
    buildWildlife();
    buildCloudsAndWeather();
    buildStairPlaza();

    VC.scene.add(earth);

    VC.registerAnimator(function (t, dt, camPos) {
      updateTraffic(t, dt, camPos);
      updatePedestrians(t, dt, camPos);
      updateAnimals(t, dt, camPos);
      updateAir(t, dt, camPos);
      updateWaterLife(t, dt);
      updateVolcano(t, dt, camPos);
      updateClouds(dt);
      updateStreetLights();
    }, 'earth');
  };

  /* ---------------- terrain mesh ---------------- */
  function buildTerrain() {
    var SEG = 150, SIZE = 340;
    var verts = (SEG + 1) * (SEG + 1);
    var pos = new Float32Array(verts * 3);
    var col = new Float32Array(verts * 3);
    var idx = [];
    var scratch = [0, 0, 0];
    var vi = 0;
    for (var iz = 0; iz <= SEG; iz++) {
      for (var ix = 0; ix <= SEG; ix++) {
        var x = (ix / SEG - 0.5) * SIZE;
        var z = (iz / SEG - 0.5) * SIZE;
        var h = height(x, z);
        pos[vi * 3] = x; pos[vi * 3 + 1] = h; pos[vi * 3 + 2] = z;
        var base = VC.clamp(0.35 + h * 0.008, 0.25, 0.75);
        scratch[0] = 0.28 * base; scratch[1] = 0.55 * base; scratch[2] = 0.22 * base;
        colorFor(x, z, h, scratch);
        col[vi * 3] = scratch[0]; col[vi * 3 + 1] = scratch[1]; col[vi * 3 + 2] = scratch[2];
        vi++;
      }
    }
    for (var iz2 = 0; iz2 < SEG; iz2++) {
      for (var ix2 = 0; ix2 < SEG; ix2++) {
        var a = iz2 * (SEG + 1) + ix2, b = a + 1, c = a + SEG + 1, dd = c + 1;
        idx.push(a, c, b, b, c, dd);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = true;
    mesh.position.y = E;
    mesh.name = 'terrain';
    earth.add(mesh);

    /* rim wall so the plain reads as a slab */
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(168, 160, 34, 56, 1, true), VC.mc(0x5a4a36));
    skirt.material.side = THREE.DoubleSide;
    skirt.position.y = E - 16;
    earth.add(skirt);
    var cap = new THREE.Mesh(new THREE.RingGeometry(150, 172, 56), VC.mc(0x2e2418));
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = E - 33;
    earth.add(cap);
  }

  /* ---------------- rivers, lake, waterfalls ---------------- */
  var waterMats = [];
  function buildWaters() {
    var riverMat = VC.waterMaterial({ deep: 0x1c4a7a, shallow: 0x4a90d0, amp: 0.6 });
    waterMats.push(riverMat);
    /* river ribbon following x = f(z)*120 */
    function ribbon(x0z, x1z, width) {
      var pos = [], col = [], idx2 = [];
      var n = 40;
      for (var i = 0; i <= n; i++) {
        var z = VC.lerp(x0z, x1z, i / n);
        var xc = VC.RIVER.fn(z) * 120;
        var w = width * (0.8 + 0.5 * (i / n));
        pos.push(xc - w / 2, -z, 0, xc + w / 2, -z, 0);
      }
      for (var i2 = 0; i2 < n; i2++) {
        var a = i2 * 2;
        idx2.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(idx2);
      g.rotateX(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    }
    var river = new THREE.Mesh(ribbon(-170, 148, 5.5), riverMat);
    river.position.y = E - 1.1;
    earth.add(river);
    /* tributary joining near the lake */
    var trib = new THREE.Mesh(ribbon2(150, 100, 118, 95, 3.5), riverMat);
    trib.position.y = E - 1.0;
    earth.add(trib);

    /* lake */
    var lake = new THREE.Mesh(new THREE.CircleGeometry(30, 40), VC.waterMaterial({ deep: 0x16406a, shallow: 0x3f88c8, amp: 0.4 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(VC.PLACES.lake.x, E - 1.2, VC.PLACES.lake.z);
    earth.add(lake);

    /* mountain waterfall near (132,58): drop of ~26 */
    var wfX = VC.PLACES.waterfall.x, wfZ = VC.PLACES.waterfall.z;
    var fallGeo = new THREE.PlaneGeometry(6.5, 24, 1, 6);
    var fall = new THREE.Mesh(fallGeo, VC.waterMaterial({ deep: 0x9fd0ee, shallow: 0xffffff, amp: 1.6, opacity: 0.85 }));
    fall.position.set(wfX, E + 10, wfZ);
    fall.rotation.y = Math.PI / 2;
    earth.add(fall);
    var poolF = new THREE.Mesh(new THREE.CircleGeometry(9, 24), VC.waterMaterial({ deep: 0x1c5a8a, shallow: 0x7ac0e8, amp: 0.5 }));
    poolF.rotation.x = -Math.PI / 2;
    poolF.position.set(wfX - 3, E - 0.4, wfZ);
    earth.add(poolF);
    var creek = new THREE.Mesh(ribbon2(wfX - 4, wfZ, VC.PLACES.lake.x - 12, VC.PLACES.lake.z - 18, 3.5), riverMat);
    creek.position.y = E + 0.3;
    earth.add(creek);

    /* waterfall spray particles */
    waterfallSpray = new VC.ParticleField(VC.pop(220), { name: 'fallsSpray', additive: false });
    earth.add(waterfallSpray.points);
    waterfallSpray.points.position.set(wfX, E, wfZ);

    /* stone bridge over river at z=66 */
    var px = VC.RIVER.fn(66) * 120;
    var bridge = new THREE.Group();
    var arch = new THREE.Mesh(new THREE.TorusGeometry(4.5, 1.4, 6, 10, Math.PI), VC.mc(0x9a9084));
    arch.position.y = 1.6;
    bridge.add(arch);
    bridge.add(part(20, 1.2, 7, VC.mc(0xb0a898), 0, 6.2, 0));
    bridge.add(part(20, 0.8, 0.8, VC.mc(0xc8c0b0), 0, 7.1, 3.2));
    bridge.add(part(20, 0.8, 0.8, VC.mc(0xc8c0b0), 0, 7.1, -3.2));
    bridge.position.set(px, E, 66);
    earth.add(bridge);

    VC.addLabel('River Bridge', new THREE.Vector3(px, E + 12, 66), { realm: 'earth' });
    VC.addLabel('Waterfall', new THREE.Vector3(wfX, E + 14, wfZ), { realm: 'earth' });
    VC.addLabel('Lake Serene', new THREE.Vector3(VC.PLACES.lake.x, E + 6, VC.PLACES.lake.z), { realm: 'earth' });

    function ribbon2(x0, z0, x1, z1, width) {
      var pos2 = [], idx3 = [];
      var n2 = 12;
      var dirx = z1 - z0, dirz = -(x1 - x0);
      var dl = Math.hypot(dirx, dirz) || 1;
      dirx /= dl; dirz /= dl;
      for (var i3 = 0; i3 <= n2; i3++) {
        var f = i3 / n2;
        var cx = VC.lerp(x0, x1, f), cz = VC.lerp(z0, z1, f);
        var w2 = width / 2 * (0.7 + 0.5 * Math.sin(f * 3) * 0.4 + 0.3);
        pos2.push(cx - dirx * w2, -(cz - dirz * w2), 0, cx + dirx * w2, -(cz + dirz * w2), 0);
      }
      for (var i4 = 0; i4 < n2; i4++) {
        var a2 = i4 * 2;
        idx3.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2);
      }
      var g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos2), 3));
      g2.setIndex(idx3);
      g2.rotateX(-Math.PI / 2);
      g2.computeVertexNormals();
      return g2;
    }
  }

  /* ---------------- volcano ---------------- */
  var craterGlow = null;
  function buildVolcano() {
    var vx = VC.PLACES.volcano.x, vz = VC.PLACES.volcano.z;
    craterGlow = new THREE.Mesh(new THREE.CircleGeometry(8.5, 20),
      VC.lavaMaterial({ a: 0x400a02, b: 0xff5a10, hot: 0xffe27a, speed: 1.2, scale: 0.2 }));
    craterGlow.rotation.x = -Math.PI / 2;
    craterGlow.position.set(vx, E + 28.6, vz);
    earth.add(craterGlow);
    /* lava flows down the flank */
    var flow = new THREE.Mesh(ribbonSeg(vx + 6, vz + 6, vx + 34, vz + 26, 3),
      VC.lavaMaterial({ a: 0x2c0802, b: 0xd04a10, hot: 0xffb03a, speed: 0.5, scale: 0.15 }));
    flow.position.y = E + 12;
    flow.rotation.x = 0.5;
    earth.add(flow);
    /* smoke column */
    volcanoSmoke = new VC.ParticleField(VC.pop(240), { name: 'volcanoSmoke', additive: false });
    earth.add(volcanoSmoke.points);
    volcanoParticles = new VC.ParticleField(VC.pop(200), { name: 'lavaBomb' });
    earth.add(volcanoParticles.points);
    VC.addLabel('Mount Voxelius', new THREE.Vector3(vx, E + 44, vz), { realm: 'earth', major: true });

    function ribbonSeg(x0, z0, x1, z1, w) {
      var pos3 = [], idx4 = [];
      var n3 = 10;
      var dx = x1 - x0, dz = z1 - z0, dl = Math.hypot(dx, dz);
      var nx = -dz / dl, nz = dx / dl;
      for (var i5 = 0; i5 <= n3; i5++) {
        var f = i5 / n3;
        var cx = VC.lerp(x0, x1, f), cz = VC.lerp(z0, z1, f);
        var off = Math.sin(f * 5) * 3;
        pos3.push(cx + nx * (w / 2 + off), 0, cz + nz * (w / 2 + off), cx - nx * (w / 2 - off * 0.4), 0, cz - nz * (w / 2 - off * 0.4));
      }
      for (var i6 = 0; i6 < n3; i6++) {
        var a3 = i6 * 2;
        idx4.push(a3, a3 + 1, a3 + 2, a3 + 1, a3 + 3, a3 + 2);
      }
      var g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos3), 3));
      g3.setIndex(idx4);
      g3.computeVertexNormals();
      return g3;
    }
  }
  function updateVolcano(t, dt, camPos) {
    var vx = VC.PLACES.volcano.x, vz = VC.PLACES.volcano.z;
    var near = Math.hypot(camPos.x - vx, camPos.z - vz) < 260;
    volcanoSmoke.points.visible = near;
    volcanoParticles.points.visible = near;
    if (!near) return;
    var mf = VC.motionFactor();
    if (Math.floor(t * 6) !== Math.floor((t - dt) * 6)) {
      volcanoSmoke.spawn(vx + rng.range(-4, 4), E + 30.5, vz + rng.range(-4, 4),
        rng.range(-2, 2), rng.range(4, 7), rng.range(-2, 2), 6, 7, 0.45, 0.4, 0.42);
    }
    volcanoSmoke.step(dt, function (i, i3, ddt) {
      volcanoSmoke.vel[i3 + 1] += ddt * 0.4;
    });
    volcanoTimer -= dt * mf;
    if (volcanoTimer <= 0) {
      volcanoTimer = rng.range(6, 11);
      eruptT = 1.6;
      VC.emit('eruption');
    }
    if (eruptT > 0) {
      eruptT -= dt;
      for (var k = 0; k < 5; k++) {
        var a = rng.range(0, Math.PI * 2), sp = rng.range(2, 9);
        volcanoParticles.spawn(vx, E + 29.5, vz,
          Math.cos(a) * sp, rng.range(16, 26), Math.sin(a) * sp,
          rng.range(1.6, 2.6), 2 + Math.random() * 2.5, 1, 0.35, 0.05);
      }
    }
    volcanoParticles.step(dt, function (i, i3, ddt) {
      volcanoParticles.vel[i3 + 1] -= ddt * 22;
      var kk = volcanoParticles.life[i] / volcanoParticles.maxLife[i];
      volcanoParticles.col[i3 + 1] = 0.12 + kk * 0.4;
    });
  }

  /* ---------------- forests & fields decor ---------------- */
  function buildForests() {
    var trunkGeo = VC.boxGeo(0.5, 3, 0.5);
    var pineGeo = new THREE.ConeGeometry(2.2, 6.5, 5);
    var oakGeo = VC.ico(2.4, 0);
    var birchGeo = VC.boxGeo(0.42, 3.6, 0.42);
    var bushGeo = VC.ico(1.1, 0);
    var nTrees = VC.pop(460);
    var trunks = new THREE.InstancedMesh(trunkGeo, VC.mc(0x5a3a22), nTrees);
    var pineMat = VC.mc(0x2a6a3a);
    var pines = new THREE.InstancedMesh(pineGeo, pineMat, nTrees);
    var oakMat = VC.mc(0x4a8a3a);
    var oaks = new THREE.InstancedMesh(oakGeo, oakMat, nTrees);
    var birches = new THREE.InstancedMesh(birchGeo, VC.mc(0xd8d4c8), nTrees);
    var birchTops = new THREE.InstancedMesh(VC.ico(1.7, 0), VC.mc(0x8aba4a), nTrees);
    var iTr = 0, iPi = 0, iOa = 0, iBi = 0;
    var d = new THREE.Object3D();
    var zones = [
      { x: VC.PLACES.forest.x, z: VC.PLACES.forest.z, r: 34, p: 0.85 },
      { x: 60, z: -100, r: 44, p: 0.8 },
      { x: -40, z: 120, r: 26, p: 0.7 },
      { x: 118, z: 60, r: 22, p: 0.65 },
      { x: -140, z: -20, r: 40, p: 0.7 },
      { x: 140, z: 110, r: 26, p: 0.6 },
      { x: -30, z: -130, r: 34, p: 0.7 }
    ];
    var placed = 0;
    while (placed < nTrees) {
      var zn = zones[Math.floor(rng() * zones.length)];
      var a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng()) * zn.r;
      var x = zn.x + Math.cos(a) * rr, z = zn.z + Math.sin(a) * rr;
      var h = height(x, z);
      if (h > 30 || h < -1) continue;
      if (Math.abs(x) < 16 && z > 160) continue;
      var kind = rng();
      var scl = rng.range(0.75, 1.5);
      d.rotation.set(0, rng() * 6, 0);
      d.scale.setScalar(scl);
      if (kind < zn.p) {
        d.position.set(x, E + h + 3.4 * scl, z); d.updateMatrix();
        pines.setMatrixAt(iPi++, d.matrix);
        d.position.set(x, E + h + 1.2 * scl, z); d.updateMatrix();
        trunks.setMatrixAt(iTr++, d.matrix);
      } else if (kind < zn.p + 0.1) {
        d.position.set(x, E + h + 1.8 * scl, z); d.updateMatrix();
        birches.setMatrixAt(iBi, d.matrix);
        d.position.y = E + h + 3.9 * scl; d.updateMatrix();
        birchTops.setMatrixAt(iBi, d.matrix); iBi++;
        d.position.set(x, E + h + 1.8 * scl, z); d.updateMatrix();
        trunks.setMatrixAt(iTr++, d.matrix);
      } else {
        d.position.set(x, E + h + 2.4 * scl, z); d.updateMatrix();
        oaks.setMatrixAt(iOa++, d.matrix);
        d.position.set(x, E + h + 1.1 * scl, z); d.updateMatrix();
        trunks.setMatrixAt(iTr++, d.matrix);
      }
      placed++;
    }
    pines.count = iPi; trunks.count = iTr; oaks.count = iOa; birches.count = iBi;
    birchTops.count = iBi;
    /* pine cones stacked: give each pine a second lower cone */
    pines.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    oaks.instanceMatrix.needsUpdate = true;
    birches.instanceMatrix.needsUpdate = true;
    birchTops.instanceMatrix.needsUpdate = true;
    trunks.castShadow = false;
    earth.add(trunks, pines, oaks, birches, birchTops);

    /* grass tufts + flowers + rocks on the plains */
    var grass = new THREE.InstancedMesh(VC.boxGeo(0.5, 1.1, 0.5), VC.mc(0x4a8a42), VC.pop(500));
    var flowers = new THREE.InstancedMesh(VC.boxGeo(0.35, 0.8, 0.35), VC.mc(0xffffff), VC.pop(120));
    var flowerColors = [0xff5a7a, 0xffd23a, 0xffffff, 0xb07aff];
    var rocks = new THREE.InstancedMesh(VC.ico(0.9, 0), VC.mc(0x8a8a92), VC.pop(160));
    var gI = 0, fI = 0, rI = 0;
    for (var g = 0; g < grass.count + flowers.count + rocks.count; g++) {
      var xg = rng.range(-150, 150), zg = rng.range(-150, 150);
      var hg = height(xg, zg);
      if (hg < 0 || hg > 24) continue;
      if (Math.hypot(xg - VC.PLACES.city.x, zg - VC.PLACES.city.z) < 56) continue;
      d.position.set(xg, E + hg + 0.4, zg);
      d.rotation.set(0, rng() * 6, 0);
      d.scale.setScalar(rng.range(0.6, 1.4));
      d.updateMatrix();
      var roll = rng();
      if (roll < 0.62 && gI < grass.count) grass.setMatrixAt(gI++, d.matrix);
      else if (roll < 0.8 && fI < flowers.count) {
        flowers.setMatrixAt(fI, d.matrix);
        flowers.setColorAt(fI, _c1.setHex(flowerColors[Math.floor(rng() * 4)]));
        fI++;
      } else if (rI < rocks.count) {
        d.scale.setScalar(rng.range(0.5, 2.4));
        d.updateMatrix();
        rocks.setMatrixAt(rI++, d.matrix);
      }
    }
    grass.count = gI; flowers.count = fI; rocks.count = rI;
    [grass, flowers, rocks].forEach(function (im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    earth.add(grass, flowers, rocks);
    VC.addLabel('The Forest', new THREE.Vector3(VC.PLACES.forest.x, E + 14, VC.PLACES.forest.z), { realm: 'earth' });

    /* petal field near forest */
    petalField = new VC.ParticleField(VC.pop(120), { name: 'petals', additive: false });
    earth.add(petalField.points);
  }

  /* ---------------- city ---------------- */
  function buildCity() {
    var PL = VC.PLACES;
    var cx = PL.city.x, cz = PL.city.z;
    var cityG = new THREE.Group();
    earth.add(cityG);

    /* ground plate */
    var plate = new THREE.Mesh(VC.plane(108, 108), VC.mc(0x5a5a62));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(cx, E + 0.05, cz);
    cityG.add(plate);

    var vStreets = [-22, -6, 10, 26, 42].map(function (x) { return cx + x - 16; });
    var hStreets = [-40, -24, -8, 8, 24, 40].map(function (z) { return cz + z; });
    var roadMat = VC.mc(0x2c2c32);
    var lineMat = VC.mc(0xd8d0a8);
    var sideMat = VC.mc(0x84848c);

    function street(x0, z0, x1, z1) {
      var len = Math.hypot(x1 - x0, z1 - z0);
      var r = new THREE.Mesh(part2(len, 0.14, 5.2), roadMat);
      r.position.set((x0 + x1) / 2, E + 0.14, (z0 + z1) / 2);
      r.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      cityG.add(r);
      /* dashed centerline */
      var dashes = Math.floor(len / 5);
      for (var i = 0; i < dashes; i++) {
        if (i % 2) continue;
        var f = (i + 0.5) / dashes;
        var dl = new THREE.Mesh(part2(1.8, 0.05, 0.35), lineMat);
        dl.position.set(VC.lerp(x0, x1, f), E + 0.23, VC.lerp(z0, z1, f));
        dl.rotation.y = r.rotation.y;
        cityG.add(dl);
      }
      /* sidewalks */
      [-1, 1].forEach(function (s) {
        var sw = new THREE.Mesh(part2(len, 0.22, 1.6), sideMat);
        sw.position.set((x0 + x1) / 2, E + 0.22, (z0 + z1) / 2);
        sw.rotation.y = r.rotation.y;
        sw.translateZ(s * 3.6);
        cityG.add(sw);
      });
    }
    var x0v = cx - 62, x1v = cx + 62, z0h = cz - 52, z1h = cz + 52;
    vStreets.forEach(function (x) { street(x, z0h, x, z1h); });
    hStreets.forEach(function (z) { street(x0v, z, x1v, z); });

    /* blocks */
    var blockX = [], blockZ = [];
    var boundsX = [x0v].concat(vStreets).concat([x1v]);
    var boundsZ = [z0h].concat(hStreets).concat([z1h]);
    var parkBlock = { ix: 3, iz: 4 };
    var civicBlock = { ix: 2, iz: 0 };
    for (var ix = 0; ix < boundsX.length - 1; ix++) {
      for (var iz = 0; iz < boundsZ.length - 1; iz++) {
        var bx0 = boundsX[ix] + 4, bx1 = boundsX[ix + 1] - 4;
        var bz0 = boundsZ[iz] + 4, bz1 = boundsZ[iz + 1] - 4;
        if (bx1 - bx0 < 5 || bz1 - bz0 < 5) continue;
        var bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
        if (ix === parkBlock.ix && iz === parkBlock.iz) { buildPark(bcx, bcz); continue; }
        if (ix === civicBlock.ix && iz === civicBlock.iz) { buildCivic(bcx, bcz); continue; }
        var distC = Math.hypot(bcx - cx, bcz - cz);
        var tallness = VC.clamp(1 - distC / 62, 0.1, 1);
        var n = rng.int(2, 4);
        for (var b = 0; b < n; b++) {
          var fx = rng.range(bx0 + 3, bx1 - 3), fz = rng.range(bz0 + 3, bz1 - 3);
          var roll = rng();
          var bld;
          if (roll < tallness * 0.55) {
            var hh = 10 + tallness * rng.range(14, 34);
            bld = VC.makeTower(rng, {
              w: rng.range(6, 9), d: rng.range(6, 9), h: hh,
              wall: rng.chance(0.5) ? 0x8aa0c8 : 0x6a7a94,
              antenna: hh > 30 ? rng.range(4, 8) : 0
            });
          } else if (roll < 0.78) {
            bld = VC.makeHouse(rng, {
              w: rng.range(5, 8), d: rng.range(5, 7), h: rng.range(4, 7),
              wall: rng.pick([0xd8cbb8, 0xc8a888, 0xa8b8c8, 0xe0d8c8]),
              roof: rng.pick([0x9a4a2a, 0x6a4a3a, 0x8a8a92]),
              shopfront: rng.chance(0.4) ? rng.pick([0x4a8a5a, 0x4a6a9a, 0x9a4a5a]) : 0
            });
          } else {
            bld = VC.makeHouse(rng, {
              w: rng.range(6, 10), d: rng.range(6, 8), h: rng.range(5, 8),
              wall: 0xb8b0a4, roof: 'flat',
              shopfront: rng.pick([0xcc5a3a, 0x3a7a9a, 0x5a9a4a])
            });
          }
          bld.position.set(fx, E + 0.2, fz);
          bld.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
          cityG.add(bld);
        }
      }
    }

    /* streetlights along main avenues (instanced) + 2 real night lamps */
    var lampPos = [];
    hStreets.forEach(function (z) {
      for (var x = x0v + 8; x < x1v; x += 16) lampPos.push([x, z + 3.6]);
    });
    vStreets.forEach(function (x) {
      for (var z = z0h + 8; z < z1h; z += 16) lampPos.push([x + 3.6, z]);
    });
    var poles = new THREE.InstancedMesh(VC.boxGeo(0.28, 5.4, 0.28), VC.mc(0x3c4048), lampPos.length);
    var heads = new THREE.InstancedMesh(VC.boxGeo(0.9, 0.3, 0.5),
      VC.tmat('streetGlow', 'lampHead', function () { return VC.emissive(0xffe8b0, 1); }, 0x221e14, 0xfff0c0),
      lampPos.length);
    var d2 = new THREE.Object3D();
    lampPos.forEach(function (p, i) {
      d2.position.set(p[0], E + 2.9, p[1]);
      d2.rotation.set(0, rng() * 3, 0);
      d2.updateMatrix();
      poles.setMatrixAt(i, d2.matrix);
      d2.position.y = E + 5.7;
      d2.updateMatrix();
      heads.setMatrixAt(i, d2.matrix);
    });
    cityG.add(poles, heads);
    /* a couple of real lights for night mood near the plaza */
    var plazaLight = new THREE.PointLight(0xffe0a0, 0, 40, 2);
    plazaLight.position.set(cx, E + 8, cz);
    cityG.add(plazaLight);
    streetLights.push(plazaLight);
    var plazaLight2 = new THREE.PointLight(0xffe0a0, 0, 36, 2);
    plazaLight2.position.set(cx - 24, E + 8, cz + 24);
    cityG.add(plazaLight2);
    streetLights.push(plazaLight2);

    /* big park on the east edge */
    buildPark(cx + 46, cz - 20);

    VC.mergeVoxelGroup(cityG);
    VC.addLabel('The Capital City', new THREE.Vector3(cx, E + 46, cz), { realm: 'earth', major: true });
  }

  function buildPark(cx, cz) {
    var park = new THREE.Mesh(VC.plane(24, 24), VC.mc(0x3f7a3a));
    park.rotation.x = -Math.PI / 2;
    park.position.set(cx, E + 0.28, cz);
    earth.add(park);
    var d = new THREE.Object3D();
    var trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4.6, 5), VC.mc(0x2a6a3a), 14);
    for (var i = 0; i < 14; i++) {
      d.position.set(cx + rng.range(-9, 9), E + 2.6, cz + rng.range(-9, 9));
      d.rotation.y = rng() * 6; d.updateMatrix();
      trees.setMatrixAt(i, d.matrix);
    }
    earth.add(trees);
    var pond = new THREE.Mesh(new THREE.CircleGeometry(4, 18), VC.waterMaterial({ deep: 0x1c4a7a, shallow: 0x4a90d0, amp: 0.3 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx + 3, E + 0.32, cz - 3);
    earth.add(pond);
    var bench = new THREE.Group();
    bench.add(part(2.2, 0.15, 0.8, VC.mc(0x6a4a2a), 0, 0.6, 0));
    bench.add(part(2.2, 0.7, 0.12, VC.mc(0x6a4a2a), 0, 1, -0.35));
    bench.position.set(cx - 5, E + 0.28, cz + 2);
    earth.add(bench);
  }

  function buildCivic(cx, cz) {
    var civic = new THREE.Group();
    civic.add(part(16, 8, 10, VC.mc(0xe0d8c8), 0, 4, 0));
    civic.add(part(18, 1.4, 11.5, VC.mc(0xcfc8b4), 0, 8.6, 0));
    var dome = new THREE.Mesh(VC.sphereGeo(4.4, 10, 6), VC.mc(0x3a8a5a));
    dome.position.y = 11.6;
    civic.add(dome);
    civic.add(part(1.2, 3, 1.2, VC.mc(0xe0d8c8), 0, 14.6, 0));
    var statue = new THREE.Mesh(VC.sphereGeo(0.7, 6, 4), VC.emissive(0xffe9b0, 0.6));
    statue.position.y = 16.4;
    civic.add(statue);
    /* columns */
    for (var c = 0; c < 6; c++) {
      civic.add(new THREE.Mesh(VC.cyl(0.55, 0.65, 6.4, 8), VC.mc(0xd8d0bc)).translateX(-7 + c * 2.8).translateY(3.2).translateZ(5.6));
    }
    civic.add(part(10, 0.8, 3, VC.mc(0xcfc8b4), 0, 0.4, 7.6));
    civic.position.set(cx, E + 0.2, cz);
    earth.add(civic);
  }

  /* ---------------- old town ---------------- */
  function buildOldTown() {
    var ox = VC.PLACES.oldtown.x, oz = VC.PLACES.oldtown.z;
    var OT = new THREE.Group();
    earth.add(OT);
    /* cobbled square */
    var square = new THREE.Mesh(VC.plane(20, 20), VC.mc(0x8a7a68));
    square.rotation.x = -Math.PI / 2;
    square.position.set(ox, E + 0.12, oz);
    OT.add(square);
    /* well */
    var well = new THREE.Group();
    well.add(new THREE.Mesh(VC.cyl(1.4, 1.6, 1.4, 8), VC.mc(0x7a7470)));
    well.add(part(0.25, 2.2, 0.25, VC.mc(0x5a3a20), -1.1, 1.8, 0));
    well.add(part(0.25, 2.2, 0.25, VC.mc(0x5a3a20), 1.1, 1.8, 0));
    var wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.4, 4), VC.mc(0x8a4a2a));
    wellRoof.position.y = 3.2; wellRoof.rotation.y = Math.PI / 4;
    well.add(wellRoof);
    well.position.set(ox, E + 0.2, oz);
    OT.add(well);
    /* ring of timber houses */
    for (var hI = 0; hI < 10; hI++) {
      var a = hI / 10 * Math.PI * 2;
      var r = 15 + (hI % 2) * 3;
      var hs = VC.makeHouse(rng, {
        w: rng.range(4.6, 6.4), d: rng.range(4.4, 6), h: rng.range(4.6, 6.8),
        wall: rng.pick([0xd8c4a4, 0xc8b090, 0xe0d0b0]), roof: 0x8a4a2a
      });
      hs.position.set(ox + Math.cos(a) * r, E + 0.15, oz + Math.sin(a) * r);
      hs.rotation.y = -a + Math.PI / 2;
      OT.add(hs);
    }
    /* market stalls */
    var stallColors = [0xd05a4a, 0x4a8a5a, 0x4a6ab0, 0xd0a03a];
    for (var m = 0; m < 6; m++) {
      var st = new THREE.Group();
      st.add(part(2.6, 0.14, 1.6, VC.mc(0x8a6a4a), 0, 1, 0));
      st.add(part(0.15, 1.2, 0.15, VC.mc(0x6a4a30), -1.1, 0.6, 0.6));
      st.add(part(0.15, 1.2, 0.15, VC.mc(0x6a4a30), 1.1, 0.6, 0.6));
      var awning = part(2.9, 0.16, 1.9, VC.mc(stallColors[m % 4]), 0, 1.9, 0);
      awning.rotation.x = 0.18;
      st.add(awning);
      st.position.set(ox + rng.range(-6, 6), E + 0.2, oz + rng.range(-6, 6));
      st.rotation.y = rng() * 6;
      OT.add(st);
    }
    /* clock tower */
    var ct = new THREE.Group();
    ct.add(part(4, 14, 4, VC.mc(0xd8c8a8), 0, 7, 0));
    var ctRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 4), VC.mc(0x6a4a3a));
    ctRoof.position.y = 16; ctRoof.rotation.y = Math.PI / 4;
    ct.add(ctRoof);
    var face = new THREE.Mesh(VC.cyl(1.4, 1.4, 0.2, 12), VC.mc(0xf5f0e0));
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 11, 2.1);
    ct.add(face);
    var hand = part(0.14, 1.1, 0.08, VC.mc(0x222222), 0, 11.4, 2.25);
    hand.userData.noMerge = true;
    ct.add(hand);
    ct.userData.hand = hand;
    ct.userData.noMerge = true;
    OT.add(ct);
    ct.position.set(ox - 9, E + 0.2, oz + 11);
    ct.userData.baseRot = 0;
    clockTower = ct;
    VC.mergeVoxelGroup(OT);
    VC.addLabel('The Old Town', new THREE.Vector3(ox, E + 16, oz), { realm: 'earth' });
  }
  var clockTower = null;

  /* ---------------- farm ---------------- */
  function buildFarm() {
    var fx = VC.PLACES.farm.x, fz = VC.PLACES.farm.z;
    var farmG = new THREE.Group();
    earth.add(farmG);
    var _oldE = earth.add.bind(earth);
    /* barn */
    var barn = new THREE.Group();
    barn.add(part(12, 6, 8, VC.mc(0xa83a2a), 0, 3, 0));
    var barnRoof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 12.6, 4, 1, false, Math.PI / 4), VC.mc(0x8a8a90));
    barnRoof.rotation.z = Math.PI / 2;
    barnRoof.scale.y = 0.62;
    barnRoof.position.y = 7.4;
    barn.add(barnRoof);
    barn.add(part(3.4, 4, 0.3, VC.mc(0xf0e8d8), 0, 2.2, 4.1));
    barn.add(part(0.6, 3.4, 0.3, VC.mc(0x6a2a1a), 0, 2.2, 4.25));
    barn.position.set(fx, E + 0.2, fz);
    farmG.add(barn);
    /* silo */
    var silo = new THREE.Group();
    silo.add(new THREE.Mesh(VC.cyl(2.4, 2.4, 12, 10), VC.mc(0xc8c8cc)));
    silo.add(new THREE.Mesh(VC.sphereGeo(2.4, 10, 5), VC.mc(0x9a9aa2)).translateY(6));
    silo.position.set(fx + 10, E + 6.2, fz - 3);
    farmG.add(silo);
    /* fenced fields with crops */
    var fieldDefs = [[fx - 16, fz + 12, 18, 14], [fx - 16, fz - 8, 18, 12], [fx + 8, fz + 16, 14, 10]];
    var posts = new THREE.InstancedMesh(VC.boxGeo(0.25, 1.8, 0.25), VC.mc(0x8a6a44), VC.pop(300));
    var rails = new THREE.InstancedMesh(VC.boxGeo(2.4, 0.16, 0.14), VC.mc(0x8a6a44), VC.pop(300));
    var crops = new THREE.InstancedMesh(VC.boxGeo(0.5, 1.5, 0.5), VC.mc(0xc8b04a, 0x1a1400), VC.pop(600));
    var d = new THREE.Object3D();
    var iP = 0, iR = 0, iC = 0;
    fieldDefs.forEach(function (fd) {
      var x0 = fd[0], z0 = fd[1], w = fd[2], dd = fd[3];
      /* fence perimeter */
      function fenceSeg(x1, z1, x2, z2) {
        var len = Math.hypot(x2 - x1, z2 - z1);
        var n2 = Math.floor(len / 2.4);
        for (var i = 0; i <= n2 && iP < posts.count; i++) {
          var f = i / n2;
          d.position.set(VC.lerp(x1, x2, f), E + 1, VC.lerp(z1, z2, f));
          d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
          posts.setMatrixAt(iP++, d.matrix);
          if (i < n2 && iR < rails.count) {
            d.position.set(VC.lerp(x1, x2, (i + 0.5) / n2), E + 1.3, VC.lerp(z1, z2, (i + 0.5) / n2));
            d.rotation.set(0, Math.atan2(-(z2 - z1), x2 - x1), 0);
            d.updateMatrix();
            rails.setMatrixAt(iR++, d.matrix);
          }
        }
      }
      fenceSeg(x0, z0, x0 + w, z0);
      fenceSeg(x0 + w, z0, x0 + w, z0 + dd);
      fenceSeg(x0 + w, z0 + dd, x0, z0 + dd);
      fenceSeg(x0, z0 + dd, x0, z0);
      /* crop rows */
      for (var cz2 = z0 + 1.4; cz2 < z0 + dd - 1; cz2 += 1.6) {
        for (var cx2 = x0 + 1.2; cx2 < x0 + w - 1; cx2 += 1.4) {
          if (iC >= crops.count) break;
          d.position.set(cx2 + rng.range(-0.2, 0.2), E + height(cx2, cz2) * 0 + 1, cz2 + rng.range(-0.2, 0.2));
          d.rotation.set(0, rng() * 6, 0);
          d.scale.set(rng.range(0.7, 1.2), rng.range(0.7, 1.3), rng.range(0.7, 1.2));
          d.updateMatrix();
          crops.setMatrixAt(iC++, d.matrix);
        }
      }
    });
    posts.count = iP; rails.count = iR; crops.count = iC;
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    crops.instanceMatrix.needsUpdate = true;
    farmG.add(posts, rails, crops);

    /* pond for ducks */
    var fpond = new THREE.Mesh(new THREE.CircleGeometry(5, 20), VC.waterMaterial({ deep: 0x1c4a7a, shallow: 0x5aa0d0, amp: 0.25 }));
    fpond.rotation.x = -Math.PI / 2;
    fpond.position.set(fx + 14, E - 0.3, fz + 12);
    farmG.add(fpond);

    /* windmill */
    var wx = VC.PLACES.windmill.x, wz = VC.PLACES.windmill.z;
    var mill = new THREE.Group();
    mill.add(new THREE.Mesh(VC.cyl(2.4, 3.4, 10, 8), VC.mc(0xd8cbb0)));
    var millRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.6, 8), VC.mc(0x8a4a2a));
    millRoof.position.y = 6.2;
    mill.add(millRoof);
    var blades = new THREE.Group();
    for (var b = 0; b < 4; b++) {
      var blade = new THREE.Group();
      blade.add(part(0.5, 6.4, 0.24, VC.mc(0xf0e8d8), 0, 3.4, 0));
      blade.add(part(1.3, 5.2, 0.1, VC.mc(0xd8d0c0), 0.7, 3, 0.14));
      blade.rotation.z = b * Math.PI / 2;
      blades.add(blade);
    }
    blades.position.set(0, 4.6, 3.2);
    blades.userData.noMerge = true;
    mill.add(blades);
    windmillBlades = blades;
    mill.add(part(0.6, 0.6, 1.4, VC.mc(0x4a4a52), 0, 4.6, 3.6));
    mill.position.set(wx, E + 5.4, wz);
    farmG.add(mill);

    /* animals */
    function farmQuads() {
      for (var cI = 0; cI < VC.pop(5); cI++) {
        var cow = VC.makeQuadruped({ body: 0xffffff, dark: 0x2a2a2a, size: 1.15, spots: true, ears: true, udder: true, horns: true });
        cow.position.set(fx + rng.range(-14, 6), E + 0.1, fz + rng.range(2, 20));
        earth.add(cow);
        cows.push({ g: cow, rig: cow.userData.rig, home: { x: fx, z: fz + 10 }, r: 13, a: rng() * 6.28, sp: rng.range(0.05, 0.12) });
      }
      for (var dI = 0; dI < VC.pop(3); dI++) {
        var dog = VC.makeQuadruped({ body: 0x8a5a30, size: 0.6, ears: true });
        dog.position.set(fx + rng.range(-6, 8), E + 0.1, fz + rng.range(-4, 8));
        earth.add(dog);
        dogs.push({ g: dog, rig: dog.userData.rig, home: { x: fx + 4, z: fz + 2 }, r: 8, a: rng() * 6.28, sp: rng.range(0.25, 0.5) });
      }
      for (var c2 = 0; c2 < VC.pop(3); c2++) {
        var cat = VC.makeQuadruped({ body: 0x3a3a40, size: 0.42, ears: true });
        cat.position.set(fx + rng.range(8, 12), E + 0.1, fz + rng.range(2, 10));
        earth.add(cat);
        cats.push({ g: cat, rig: cat.userData.rig, home: { x: fx + 10, z: fz + 6 }, r: 5, a: rng() * 6.28, sp: rng.range(0.12, 0.3) });
      }
      for (var k = 0; k < VC.pop(6); k++) {
        var duck = new THREE.Group();
        duck.add(part(0.4, 0.34, 0.6, VC.mc(0xf5f0e0), 0, 0.3, 0));
        duck.add(part(0.24, 0.24, 0.24, VC.mc(0xf5f0e0), 0, 0.55, 0.24));
        duck.add(part(0.14, 0.08, 0.16, VC.mc(0xf0a020), 0, 0.52, 0.44));
        duck.position.set(fx + 14 + rng.range(-3.4, 3.4), E - 0.1, fz + 12 + rng.range(-3.4, 3.4));
        earth.add(duck);
        ducks.push({ g: duck, a: rng() * 6.28, r: rng.range(1, 3.4), sp: rng.range(0.2, 0.4), cx: fx + 14, cz: fz + 12 });
      }
    }
    farmQuads();

    VC.mergeVoxelGroup(farmG);
    VC.addLabel('Green Acres Farm', new THREE.Vector3(fx, E + 12, fz), { realm: 'earth' });
    VC.addLabel('The Windmill', new THREE.Vector3(wx, E + 14, wz), { realm: 'earth' });
  }

  /* ---------------- airport ---------------- */
  var runwayLights = [];
  function buildAirport() {
    var ax = VC.PLACES.airport.x, az = VC.PLACES.airport.z;
    var rotY = 0.35; /* runway heading */
    var ap = new THREE.Group();
    ap.position.set(ax, E, az);
    ap.rotation.y = rotY;
    earth.add(ap);
    /* apron */
    ap.add(part(120, 0.16, 40, VC.mc(0x3c3f46), 0, 0.12, 0));
    /* runway */
    ap.add(part(110, 0.2, 9, VC.mc(0x24262c), 0, 0.2, 0));
    for (var i = 0; i < 18; i++) {
      ap.add(part(3.4, 0.06, 0.6, VC.mc(0xe8e8e0), -52 + i * 6.2, 0.32, 0));
    }
    /* threshold stripes */
    [-1, 1].forEach(function (s) {
      for (var tI = 0; tI < 5; tI++) {
        ap.add(part(1.4, 0.06, 3.4, VC.mc(0xe8e8e0), s * 53, 0.32, -3 + tI * 1.7));
      }
    });
    /* taxiway */
    ap.add(part(8, 0.18, 26, VC.mc(0x4a4d55), 30, 0.16, 18));
    ap.add(part(50, 0.18, 8, VC.mc(0x4a4d55), 8, 0.16, 30));
    /* runway lights */
    var rlMat = VC.tmat('runway', 'rwLight', function () { return VC.emissive(0xfff0a0, 1); }, 0x22200a, 0xfff0a0);
    var rlGeo = VC.boxGeo(0.3, 0.3, 0.3);
    var rlCount = 48;
    var rl = new THREE.InstancedMesh(rlGeo, rlMat, rlCount);
    var d = new THREE.Object3D();
    for (var rI = 0; rI < rlCount; rI++) {
      var side = rI % 2 ? 1 : -1;
      var along = Math.floor(rI / 2) / (rlCount / 2 - 1);
      d.position.set(-55 + along * 110, 0.4, side * 5.2);
      d.updateMatrix();
      rl.setMatrixAt(rI, d.matrix);
    }
    ap.add(rl);
    /* approach lights */
    var apMat = VC.tmat('runway', 'apprLight', function () { return VC.emissive(0x40ff70, 1); }, 0x082210, 0x40ff70);
    for (var aI = 0; aI < 6; aI++) {
      var al = new THREE.Mesh(rlGeo, apMat);
      al.position.set(-62 - aI * 4, 0.4, 0);
      ap.add(al);
    }
    /* terminal */
    var term = new THREE.Group();
    term.add(part(30, 6, 10, VC.mc(0xd8dce2), 0, 3, 0));
    var glassMat = VC.tmat('windowsWarm', 'apGlass', function () {
      var m = new THREE.MeshLambertMaterial({ color: 0x7ab0d8, emissive: 0x000000 });
      m.userData.maxLevel = 0.8;
      return m;
    }, 0x000000, 0xffe2a0);
    term.add(part(28, 3.4, 0.4, glassMat, 0, 3.2, 5.3));
    term.add(part(10, 1.6, 12, VC.mc(0xc8ccd4), 0, 6.8, 0));
    /* jet bridges */
    for (var j = 0; j < 2; j++) {
      var jb = part(1.6, 1.6, 8, VC.mc(0xb8bcc4), -8 + j * 16, 3, 9);
      jb.rotation.y = (j ? -0.3 : 0.3);
      term.add(jb);
    }
    term.position.set(-6, 0.2, 34);
    ap.add(term);
    /* control tower */
    var ct = new THREE.Group();
    ct.add(new THREE.Mesh(VC.cyl(1.6, 2.4, 18, 8), VC.mc(0xc8ccd4)));
    ct.add(part(7, 3.4, 7, glassMat, 0, 19.4, 0));
    ct.add(part(8, 0.8, 8, VC.mc(0x9aa0ac), 0, 21.4, 0));
    var beaconMesh = new THREE.Mesh(VC.sphereGeo(0.6, 6, 4), VC.emissive(0xff3010, 1.2));
    beaconMesh.position.y = 22.2;
    ct.add(beaconMesh);
    var sweep = VC.makeLightShaft(0.3, 3, 30, 0xffd0a0, 0.1);
    sweep.rotation.x = Math.PI / 2;
    sweep.position.y = 22.2;
    ct.add(sweep);
    towerBeacon = { light: beaconMesh, sweep: sweep };
    ct.position.set(26, 0.2, 26);
    ap.add(ct);
    /* hangars */
    for (var hI = 0; hI < 2; hI++) {
      var hg = new THREE.Group();
      var shell = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 14, 10, 1, true, 0, Math.PI), VC.mc(0x8a909c));
      shell.rotation.z = Math.PI / 2;
      shell.position.y = 0;
      hg.add(shell);
      hg.add(part(0.3, 6, 12.4, VC.mc(0x5a606c), 0, 3, 0));
      hg.position.set(-40, 0.2, 20 + hI * 16);
      ap.add(hg);
    }
    /* planes */
    planeTaxi = VC.makePlane({ scale: 0.9 });
    earth.add(planeTaxi);
    planeFlyer = VC.makePlane({ scale: 1.0, accent: 0x3a6ac8, gear: false });
    earth.add(planeFlyer);
    /* parked plane near terminal */
    var parked = VC.makePlane({ scale: 0.8 });
    parked.position.set(ax - 18, E + 0.9, az + 16);
    parked.rotation.y = rotY;
    earth.add(parked);

    VC.addLabel('Voxel International Airport', new THREE.Vector3(ax, E + 26, az), { realm: 'earth', major: true });

    /* store runway transform for plane logic */
    airportX = ax; airportZ = az; airportRot = rotY;
  }
  var airportX = 0, airportZ = 0, airportRot = 0;

  /* takeoff/land/taxi cycle in local runway space, transformed out */
  var planeCycle = 0;
  function localToWorld(lx, lz) {
    var c = Math.cos(airportRot), s = Math.sin(airportRot);
    return [airportX + lx * c - lz * s, airportZ + lx * s + lz * c];
  }
  function updateAir(t, dt, camPos) {
    /* ---- shuttle plane: taxi → takeoff → fly → land ---- */
    var cycleLen = 34;
    planeCycle = (planeCycle + dt) % cycleLen;
    var ph = planeCycle;
    var lx, lz = 0, ly, rot = 0;
    if (ph < 10) {              /* taxi from apron */
      var k = ph / 10;
      lx = VC.lerp(38, -50, k);
      lz = VC.lerp(30 * (1 - VC.smoothstep(VC.clamp(k * 2, 0, 1)), 0), 1);
      ly = 0.95;
      rot = (k < 0.5 ? -1.4 * (1 - VC.smoothstep(k * 2)) : 0);
    } else if (ph < 16) {       /* takeoff roll + rotate */
      var k2 = (ph - 10) / 6;
      lx = VC.lerp(-50, 55, k2);
      ly = k2 < 0.55 ? 0.95 : Math.pow((k2 - 0.55) / 0.45, 1.6) * 26;
      lz = 0;
      rot = 0;
    } else if (ph < 28) {       /* climb out & circuit high (wraps offscreen) */
      var k3 = (ph - 16) / 12;
      lx = VC.lerp(55, 190, k3);
      ly = 26 + k3 * 60;
      lz = Math.sin(k3 * 2.4) * 30;
      rot = 0;
    } else {                    /* far return — hidden reset */
      var k4 = (ph - 28) / 6;
      lx = VC.lerp(190, 38, k4);
      ly = 86 - k4 * 84;
      lz = 30 * (1 - k4) + 0;
      lz = VC.lerp(30, 0, VC.smoothstep(VC.clamp(k4 * 1.6, 0, 1)));
      rot = 0;
      if (k4 > 0.985) ly = 0.95;
    }
    var wp = localToWorld(lx, lz);
    var nx2 = (ph + 0.06) % cycleLen;
    var nlx = nx2 < 10 ? VC.lerp(38, -50, nx2 / 10) :
      (nx2 < 16 ? VC.lerp(-50, 55, (nx2 - 10) / 6) :
      (nx2 < 28 ? VC.lerp(55, 190, (nx2 - 16) / 12) : VC.lerp(190, 38, (nx2 - 28) / 6)));
    var wp2 = localToWorld(nlx, lz);
    planeTaxi.position.set(wp[0], E + ly, wp[1]);
    var ddx = wp2[0] - wp[0], ddz = wp2[1] - wp[1];
    if (Math.hypot(ddx, ddz) > 0.002) planeTaxi.rotation.y = Math.atan2(ddx, ddz);
    planeTaxi.rotation.x = ph >= 10 && ph < 14 ? 0.12 : 0;
    planeTaxi.visible = camPos.distanceTo(planeTaxi.position) < 460;

    /* ---- world-circling airliner ---- */
    var a = t * 0.055 + 2;
    var r = 205;
    planeFlyer.position.set(Math.cos(a) * r, E + 74 + Math.sin(t * 0.1) * 6, Math.sin(a) * r);
    planeFlyer.rotation.y = -a - Math.PI / 2;
    planeFlyer.visible = camPos.distanceTo(planeFlyer.position) < 560;
    VC.planeSky = planeFlyer;

    /* ---- helicopter loops over the lake ---- */
    if (heli) {
      var ha = t * 0.32;
      var hr = 26 + Math.sin(t * 0.18) * 10;
      heli.position.set(VC.PLACES.lake.x + Math.cos(ha) * hr, E + 24 + Math.sin(t * 0.7) * 2, VC.PLACES.lake.z + Math.sin(ha) * hr);
      heli.rotation.y = -ha + Math.PI;
      heli.rotation.z = Math.sin(t * 0.32) * 0.06;
      heliRotor.rotation.y += dt * 26 * VC.motionFactor();
      if (heliTail) heliTail.rotation.x += dt * 30 * VC.motionFactor();
    } else {
      heli = VC.makeHelicopter({ color: 0x2a6a4a });
      earth.add(heli);
      heliRotor = heli.userData.rotor;
      heliTail = heli.userData.tailRotor;
    }
    /* ---- balloon drifts ---- */
    if (!balloon) {
      balloon = VC.makeBalloon(rng);
      balloon.scale.setScalar(2.2);
      earth.add(balloon);
      balloonBurner = balloon.userData.burner;
    }
    var ba = t * 0.028 + 1;
    balloon.position.set(60 + Math.cos(ba) * 30, E + 40 + Math.sin(t * 0.23) * 3, 96 + Math.sin(ba) * 22);
    balloon.rotation.y = -ba;
    if (balloonBurner) balloonBurner.material.opacity = 0.5 + Math.max(0, Math.sin(t * 2.4)) * 0.5;

    /* ---- control tower beacon ---- */
    if (towerBeacon) {
      towerBeacon.sweep.rotation.y += dt * 1.1 * VC.motionFactor();
      towerBeacon.light.material.color.setHex(0xff3010);
      var blink = (Math.sin(t * 4) > 0) ? 1.2 : 0.15;
      towerBeacon.light.scale.setScalar(0.6 + blink * 0.5);
    }
    if (clockTower) clockTower.userData.hand.rotation.z = -t * 0.2;
  }

  /* ---------------- railway / tram ---------------- */
  function buildRailway() {
    /* line from (-160, -110) to (150, -128) gentle curve; we use a straight embankment */
    var x0 = -150, z0 = -112, x1 = 20, z1 = -124;
    var len = Math.hypot(x1 - x0, z1 - z0);
    var yaw = Math.atan2(-(z1 - z0), x1 - x0);
    var emb = new THREE.Mesh(part2(len, 2.4, 5), VC.mc(0x6a5a4a));
    emb.position.set((x0 + x1) / 2, E + 0.6, (z0 + z1) / 2);
    emb.rotation.y = yaw;
    earth.add(emb);
    [-1, 1].forEach(function (s) {
      var rail = new THREE.Mesh(part2(len, 0.14, 0.2), VC.mc(0xb8b8c0));
      rail.position.set((x0 + x1) / 2, E + 1.86, (z0 + z1) / 2);
      rail.rotation.y = yaw;
      rail.translateZ(s * 0.9);
      earth.add(rail);
    });
    /* sleepers */
    var slN = VC.pop(90);
    var sl = new THREE.InstancedMesh(VC.boxGeo(3, 0.18, 0.5), VC.mc(0x4a3826), slN);
    var d = new THREE.Object3D();
    for (var i = 0; i < slN; i++) {
      var f = i / slN;
      d.position.set(VC.lerp(x0, x1, f), E + 1.76, VC.lerp(z0, z1, f));
      d.rotation.set(0, yaw, 0);
      d.updateMatrix();
      sl.setMatrixAt(i, d.matrix);
    }
    earth.add(sl);
    /* tram cars */
    tram = new THREE.Group();
    for (var c = 0; c < 3; c++) {
      var car = new THREE.Group();
      car.add(part(2.6, 2.6, 9, VC.mc(c === 0 ? 0xc83a2a : 0xd8d8e0), 0, 1.7, 0));
      car.add(part(2.7, 0.9, 8.2, VC.mc(0x22303f), 0, 2.3, 0));
      car.add(part(2.8, 0.3, 9.2, VC.mc(0x3a3a42), 0, 3.1, 0));
      car.position.z = -c * 10;
      tram.add(car);
    }
    tram.userData.yaw = yaw;
    tram.userData.noMerge = true;
    earth.add(tram);
    /* station */
    var stat = new THREE.Group();
    stat.add(part(12, 3.4, 5, VC.mc(0xc8bca4), 0, 1.7, 0));
    stat.add(part(13, 0.6, 6, VC.mc(0x6a4a3a), 0, 3.8, 0));
    stat.position.set(x0 + 20, E + 1.2, z0 - 6);
    stat.rotation.y = yaw;
    earth.add(stat);
    VC.addLabel('Tram Line', new THREE.Vector3(0, E + 8, -125), { realm: 'earth' });
    tram.userData.line = [x0, z0, x1, z1];
  }

  /* ---------------- roads & traffic ---------------- */
  function roadPath(pts) {
    return pts.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  }
  function drawRoad(path, width) {
    for (var i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1];
      var len = a.distanceTo(b);
      var r = new THREE.Mesh(part2(len, 0.2, width), VC.mc(0x3a3a40));
      r.position.set((a.x + b.x) / 2, E + 0.2, (a.z + b.z) / 2);
      r.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      earth.add(r);
    }
  }
  function buildRoadsAndTraffic() {
    var cx = VC.PLACES.city.x, cz = VC.PLACES.city.z;
    /* city perimeter loop */
    var loop1 = roadPath([
      [cx - 38, cz - 34], [cx + 22, cz - 34], [cx + 22, cz + 34], [cx - 38, cz + 34]
    ]);
    drawRoad(loop1.concat([loop1[0]]), 4.6);
    /* main roads out to landmarks */
    var toFarm = roadPath([[cx + 22, cz + 8], [VC.PLACES.windmill.x - 2, cz + 10], [VC.PLACES.farm.x, cz + 26]]);
    drawRoad(toFarm, 4.4);
    var toAirport = roadPath([[cx - 38, cz - 8], [VC.PLACES.airport.x + 30, cz - 20], [VC.PLACES.airport.x + 30, VC.PLACES.airport.z + 42]]);
    drawRoad(toAirport, 4.4);
    var toOld = roadPath([[cx - 38, cz], [VC.PLACES.oldtown.x + 10, cz - 4]]);
    drawRoad(toOld, 4);
    var toStair = roadPath([[cx + 10, cz + 34], [4, 150], [0, 168]]);
    drawRoad(toStair, 4.4);

    function addTraffic(path, n, kinds, speed) {
      for (var i = 0; i < n; i++) {
        var kind = kinds[i % kinds.length];
        var v;
        if (kind === 'car') v = VC.makeCar({ color: rng.pick([0xcc3a3a, 0x3a6acc, 0xe8e8f0, 0x3a3a42, 0xd8b23a, 0x40a06a]) });
        else if (kind === 'bus') v = VC.makeCar({ color: 0xd07a2a, len: 4.6, tall: true });
        else v = VC.makeCar({ color: 0x8a8a92, len: 3.6, tall: true, flat: true });
        earth.add(v);
        cars.push({
          g: v, path: path, s: (i / n) * pathLength(path),
          sp: speed * rng.range(0.8, 1.15)
        });
      }
    }
    function pathLength(path) {
      var l = 0;
      for (var i = 0; i < path.length - 1; i++) l += path[i].distanceTo(path[i + 1]);
      return l;
    }
    addTraffic(loop1.concat([loop1[0]]), VC.pop(12), ['car', 'car', 'car', 'bus'], 7);
    addTraffic(toFarm.concat(toFarm.slice().reverse()), VC.pop(6), ['car', 'truck'], 9);
    addTraffic(toAirport.concat(toAirport.slice().reverse()), VC.pop(6), ['car', 'truck'], 9);
    addTraffic(toOld.concat(toOld.slice().reverse()), VC.pop(4), ['car'], 8);

    /* pedestrians — instanced simple figures along sidewalk loops */
    var pedN = VC.pop(46);
    pedestrians = new VC.InstPool(VC.box(0.42, 1.5, 0.34), VC.mc(0xffffff), pedN, 'peds');
    var pedCols = [0x9a4a4a, 0x4a6a9a, 0x40704a, 0x9a8a4a, 0x7a5a9a, 0xd0d0d8, 0x40404a];
    pedPaths = [
      loop1.concat([loop1[0]]),
      roadPath([[cx - 38, cz - 30], [cx + 18, cz - 30], [cx + 18, cz + 30], [cx - 38, cz + 30]]).concat([roadPath([[cx - 38, cz - 30]])[0]]),
      roadPath([[VC.PLACES.oldtown.x + 8, VC.PLACES.oldtown.z + 8], [VC.PLACES.oldtown.x - 8, VC.PLACES.oldtown.z + 8], [VC.PLACES.oldtown.x - 8, VC.PLACES.oldtown.z - 8], [VC.PLACES.oldtown.x + 8, VC.PLACES.oldtown.z - 8]]),
      roadPath([[VC.PLACES.farm.x - 12, VC.PLACES.farm.z + 26], [VC.PLACES.farm.x + 12, VC.PLACES.farm.z + 22]])
    ];
    for (var pI = 0; pI < pedN; pI++) {
      var pathI = pI < 20 ? 0 : (pI < 34 ? 1 : (pI < 42 ? 2 : 3));
      pathI = Math.min(pathI, pedPaths.length - 1);
      pedestrians.add(new THREE.Vector3(), null, new THREE.Vector3(1, 1, 1));
      pedestrians.setColorAt(pI, _c1.setHex(pedCols[pI % pedCols.length]));
      pedData.push({ i: pI, pathI: pathI, s: rng() * pathLength(pedPaths[pathI]), sp: rng.range(1.1, 2.2) * (rng.chance(0.5) ? 1 : -1) });
    }
    pedestrians.flush();
    earth.add(pedestrians.mesh);
    pedLengths = pedPaths.map(pathLength);
  }
  var pedPaths = [], pedLengths = [];

  function followPath(obj, path, len, s) {
    s = ((s % len) + len) % len;
    var acc = 0;
    for (var i = 0; i < path.length - 1; i++) {
      var seg = path[i].distanceTo(path[i + 1]);
      if (acc + seg >= s) {
        var f = (s - acc) / seg;
        obj.pos = new THREE.Vector3().lerpVectors(path[i], path[i + 1], f);
        obj.yaw = Math.atan2(-(path[i + 1].z - path[i].z), path[i + 1].x - path[i].x);
        return obj.pos;
      }
      acc += seg;
    }
    obj.pos = path[0]; obj.yaw = 0;
    return obj.pos;
  }

  function updateTraffic(t, dt, camPos) {
    var mf = VC.motionFactor();
    var i;
    for (i = 0; i < cars.length; i++) {
      var c = cars[i];
      c.s += c.sp * dt * mf;
      var path = c.path;
      var len = 0;
      if (!c.len) {
        for (var k = 0; k < path.length - 1; k++) len += path[k].distanceTo(path[k + 1]);
        c.len = len;
      }
      followPath(_scratchObj, path, c.len, c.s);
      c.g.position.set(_scratchObj.pos.x, E + 0.32, _scratchObj.pos.z);
      c.g.rotation.y = -_scratchObj.yaw;
      var vis = camPos.distanceTo(c.g.position) < 260;
      c.g.visible = vis;
    }
    /* tram */
    if (tram) {
      var ln = tram.userData.line;
      tramA = (Math.sin(t * 0.06) * 0.5 + 0.5);
      var tx = VC.lerp(ln[0] + 6, ln[2] - 6, tramA);
      var tz = VC.lerp(ln[1] + 4, ln[3] - 4, tramA);
      tram.position.set(tx, E + 1.9, tz);
      tram.rotation.y = tram.userData.yaw + (Math.cos(t * 0.06) < 0 ? Math.PI : 0);
      tram.visible = camPos.distanceTo(tram.position) < 340;
    }
  }

  function updatePedestrians(t, dt, camPos) {
    if (!pedestrians) return;
    var show = camPos.y > 20 && camPos.y < 90;
    pedestrians.mesh.visible = show;
    if (!show) return;
    var mf = VC.motionFactor();
    for (var i = 0; i < pedData.length; i++) {
      var p = pedData[i];
      p.s += p.sp * dt * mf;
      followPath(_scratchObj, pedPaths[p.pathI], pedLengths[p.pathI], p.s);
      _tv.set(_scratchObj.pos.x, E + 0.95 + Math.abs(Math.sin(t * 6 + i)) * 0.05, _scratchObj.pos.z);
      pedestrians.setAt(p.i, _tv, { y: -_scratchObj.yaw }, { x: 1, y: 1 + Math.abs(Math.sin(t * 6 + i)) * 0.06, z: 1 });
    }
    pedestrians.flush();
  }

  /* ---------------- animals & wildlife ---------------- */
  function buildWildlife() { /* animals are created in buildFarm / lazily in updaters */ }
  function updateAnimals(t, dt, camPos) {
    var mf = VC.motionFactor();
    function herd(list, speedAmp) {
      for (var i = 0; i < list.length; i++) {
        var an = list[i];
        an.a += an.sp * dt * mf * (i % 2 ? 1 : -1);
        var rr = an.r * (0.6 + 0.4 * Math.sin(t * 0.2 + i));
        an.g.position.x = an.home.x + Math.cos(an.a) * rr + Math.sin(t * 0.1 + i * 3) * 2;
        an.g.position.z = an.home.z + Math.sin(an.a) * rr;
        var groundY = E + Math.max(0, height(an.g.position.x, an.g.position.z) * 0.2) + 0.1;
        an.g.position.y = VC.damp(an.g.position.y, groundY, 4, dt);
        an.g.rotation.y = -an.a + Math.PI / 2;
        VC.animateQuadruped(an.rig, t, an.sp * 6, speedAmp * mf);
        an.g.visible = camPos.distanceTo(an.g.position) < 170;
      }
    }
    herd(cows, 1);
    herd(dogs, 1.5);
    herd(cats, 1);
    for (var k = 0; k < ducks.length; k++) {
      var dk = ducks[k];
      dk.a += dk.sp * dt * mf;
      dk.g.position.x = dk.cx + Math.cos(dk.a) * dk.r;
      dk.g.position.z = dk.cz + Math.sin(dk.a) * dk.r;
      dk.g.position.y = E - 0.1 + Math.sin(t * 3 + k) * 0.05;
      dk.g.rotation.y = -dk.a;
      dk.g.visible = camPos.distanceTo(dk.g.position) < 120;
    }
    if (windmillBlades) windmillBlades.rotation.z -= dt * 0.9 * mf;
    /* birds: two flocks circling */
    if (!birds.length) {
      for (var b = 0; b < VC.pop(14); b++) {
        var bird = new THREE.Group();
        var wm = VC.mc(0x2a2a30);
        var w1 = part(0.8, 0.06, 0.24, wm, -0.4, 0, 0);
        var w2 = part(0.8, 0.06, 0.24, wm, 0.4, 0, 0);
        w1.rotation.z = 0.4; w2.rotation.z = -0.4;
        bird.add(part(0.2, 0.16, 0.5, wm, 0, 0, 0), w1, w2);
        bird.userData.wings = [w1, w2];
        earth.add(bird);
        var zone = b < 7 ? { cx: VC.PLACES.peaks.x, cz: VC.PLACES.peaks.z, y: E + 56, r: 40 } :
          { cx: VC.PLACES.farm.x, cz: VC.PLACES.farm.z, y: E + 18, r: 24 };
        birds.push({ g: bird, zone: zone, a: rng() * 6.28, sp: rng.range(0.25, 0.5), ph: rng() * 6.28, rr: rng.range(0.5, 1.2) });
      }
    }
    for (var bi = 0; bi < birds.length; bi++) {
      var bd = birds[bi];
      bd.a += bd.sp * dt * mf;
      bd.g.position.set(
        bd.zone.cx + Math.cos(bd.a) * bd.zone.r * bd.rr,
        bd.zone.y + Math.sin(t * 0.6 + bd.ph) * 4,
        bd.zone.cz + Math.sin(bd.a) * bd.zone.r * bd.rr);
      bd.g.rotation.y = -bd.a + Math.PI / 2;
      var flap = Math.sin(t * 9 + bd.ph) * 0.6;
      bd.g.userData.wings[0].rotation.z = 0.4 + flap;
      bd.g.userData.wings[1].rotation.z = -0.4 - flap;
      bd.g.visible = camPos.distanceTo(bd.g.position) < 220;
    }
  }

  /* ---------------- boats, water life ---------------- */
  var boatList = [];
  function updateWaterLife(t, dt) {
    if (!boatList.length) {
      var bx = VC.RIVER.fn(60) * 120;
      [
        { z0: 58, z1: 138, x0: 0 },
        { z0: 138, z1: 58, x0: 0 },
        { lake: true }
      ].forEach(function (def, i) {
        var bt = VC.makeBoat(rng, { mast: i < 2, hull: 0xf0f0f0, lights: true });
        bt.scale.setScalar(1.2);
        earth.add(bt);
        boatList.push({ g: bt, def: def, s: rng() });
      });
    }
    for (var i = 0; i < boatList.length; i++) {
      var b = boatList[i];
      b.s += dt * 0.012 * VC.motionFactor();
      var f = (Math.sin(b.s * Math.PI * 2) * 0.5 + 0.5);
      if (b.def.lake) {
        var a = b.s * Math.PI * 2 + i;
        b.g.position.set(VC.PLACES.lake.x + Math.cos(a) * 18, E - 0.7 + Math.sin(t * 1.4 + i) * 0.08, VC.PLACES.lake.z + Math.sin(a) * 18);
        b.g.rotation.y = -a + Math.PI / 2;
      } else {
        var z = VC.lerp(b.def.z0, b.def.z1, f);
        var x = VC.RIVER.fn(z) * 120 + (i ? 1.6 : -1.6);
        var zAhead = z + (b.def.z1 > b.def.z0 ? 2 : -2);
        b.g.position.set(x, E - 0.7 + Math.sin(t * 1.6 + i) * 0.08, z);
        b.g.rotation.y = -Math.atan2(zAhead - z, VC.RIVER.fn(zAhead) * 120 - x);
      }
      b.g.rotation.z = Math.sin(t * 1.2 + i * 2) * 0.03;
    }
    /* waterfall spray */
    var wf = VC.PLACES.waterfall;
    if (waterfallSpray && Math.abs(wf.x) < 999) {
      waterfallSpray.points.visible = true;
      if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
        for (var k = 0; k < 3; k++) {
          waterfallSpray.spawn(rng.range(-3.5, 3.5), -11 + rng.range(0, 1.5), rng.range(-3, 3),
            rng.range(-1.5, 1.5), rng.range(2, 4.5), rng.range(-1.5, 1.5), 0.9, 2.0, 0.92, 0.96, 1);
        }
      }
      waterfallSpray.step(dt, function (i, i3, ddt) {
        waterfallSpray.vel[i3 + 1] -= ddt * 6;
      });
    }
    /* petals near the forest */
    if (petalField) {
      var camY = VC.camera.position.y;
      petalField.points.visible = camY > E - 12 && camY < E + 40 &&
        Math.hypot(VC.camera.position.x - VC.PLACES.forest.x, VC.camera.position.z - VC.PLACES.forest.z) < 90;
      if (petalField.points.visible && Math.floor(t * 6) !== Math.floor((t - dt) * 6)) {
        petalField.spawn(VC.PLACES.forest.x + rng.range(-26, 26), E + rng.range(4, 12), VC.PLACES.forest.z + rng.range(-26, 26),
          rng.range(-1.4, 1.4), -0.6, rng.range(-1.4, 1.4), 5, 0.9, 1, 0.75, 0.8);
      }
      petalField.step(dt, function (i, i3, ddt) {
        petalField.pos[i3] += Math.sin(petalField.pos[i3 + 1] * 0.5 + t * 2) * ddt * 1.2;
      });
    }
  }

  /* ---------------- clouds & weather ---------------- */
  function buildCloudsAndWeather() {
    var layers = [
      { y: E + 30, r: 40, n: 7, spd: 1.6, op: 0.92 },
      { y: E + 52, r: 60, n: 6, spd: -1.1, op: 0.7 },
      { y: E + 76, r: 90, n: 5, spd: 0.7, op: 0.5 }
    ];
    layers.forEach(function (lay, li) {
      var centers = [];
      for (var i = 0; i < lay.n; i++) {
        var a = rng.range(0, Math.PI * 2), r = rng.range(90, 150);
        centers.push({ x: Math.cos(a) * r, y: lay.y + rng.range(-4, 4), z: Math.sin(a) * r, r: lay.r * rng.range(0.5, 1) });
      }
      var im = VC.cloudPuffMesh(VC.pop(110), VC.cloudMaterial(0xffffff, lay.op));
      VC.fillCloudPuffs(im, centers, rng, { puffsPer: 16 });
      earth.add(im);
      cloudLayers.push({ im: im, spd: lay.spd, y: lay.y });
    });
  }
  function updateClouds(dt) {
    for (var i = 0; i < cloudLayers.length; i++) {
      var cl = cloudLayers[i];
      var g = cl.im;
      g.rotation.y += dt * cl.spd * 0.008 * VC.motionFactor();
    }
  }

  /* ---------------- streetlights at night ---------------- */
  function updateStreetLights() {
    var n = VC.time ? VC.time.cur.windowsN : 0;
    for (var i = 0; i < streetLights.length; i++) {
      streetLights[i].intensity = n * 1.6;
    }
  }

  /* ---------------- stair plaza on earth ---------------- */
  function buildStairPlaza() {
    var px = VC.PLACES.stairBase.x, pz = VC.PLACES.stairBase.z;
    var SP = new THREE.Group();
    earth.add(SP);
    var plaza = new THREE.Mesh(VC.plane(34, 34), VC.mc(0xe8e4da));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(px, E + 0.3, pz + 4);
    SP.add(plaza);
    var plaza2 = new THREE.Mesh(VC.plane(40, 12), VC.mc(0xd8d4ca));
    plaza2.rotation.x = -Math.PI / 2;
    plaza2.position.set(px, E + 0.28, pz - 12);
    SP.add(plaza2);
    /* chapel */
    var chapel = new THREE.Group();
    chapel.add(part(8, 7, 12, VC.mc(0xe8e2d4), 0, 3.5, 0));
    var chRoof = new THREE.Mesh(new THREE.ConeGeometry(7.4, 5, 4), VC.mc(0xb0a080));
    chRoof.position.y = 9.4; chRoof.rotation.y = Math.PI / 4;
    chapel.add(chRoof);
    chapel.add(new THREE.Mesh(VC.sphereGeo(1.2, 8, 6), VC.mc(0xf0ead8)).translateY(12.4).translateZ(0));
    var cross = VC.tmat('stairGlow', 'plazaCross', function () { return VC.emissive(0xffe9b0, 1); }, 0x4a3c18, 0xfff2c0);
    chapel.add(part(0.4, 2.4, 0.4, cross, 0, 14.2, 0));
    chapel.add(part(1.2, 0.4, 0.4, cross, 0, 14.4, 0));
    chapel.add(part(2.4, 4, 0.4, VC.mc(0x7a6a4a), 0, 2, 6.2));
    chapel.position.set(px - 18, E, pz + 2);
    SP.add(chapel);
    /* cypress avenue up the stair */
    for (var c = 0; c < 10; c++) {
      [-1, 1].forEach(function (s) {
        var cyp = new THREE.Mesh(new THREE.ConeGeometry(1, 5, 5), VC.mc(0x2a5a3a));
        cyp.position.set(px + s * 8, E + 2.6, pz + 10 + c * 3);
        SP.add(cyp);
      });
    }
    /* souls gathered at the foot */
    for (var so = 0; so < VC.pop(8); so++) {
      var soul = VC.makeHumanoid({ robe: true, shirt: 0xe8e8f0, skin: 0xd8c0b0, hair: 0xd8d0c0, halo: true });
      soul.scale.setScalar(0.9);
      soul.position.set(px + rng.range(-10, 10), E + 0.3, pz + rng.range(-8, 12));
      soul.rotation.y = rng.range(-0.6, 0.6);
      soul.userData.noMerge = true;
      SP.add(soul);
      stairSouls.push({ g: soul, ph: rng() * 6.28, x0: soul.position.x, z0: soul.position.z });
    }
    VC.addLabel('Stairway to Heaven — Entrance', new THREE.Vector3(px, E + 18, pz), { realm: 'earth', major: true });
    VC.mergeVoxelGroup(SP);
    VC.addLabel('Holy Chapel of the Ascension', new THREE.Vector3(px - 18, E + 16, pz + 2), { realm: 'earth' });
  }
  var stairSouls = [];
  VC.earthStairSouls = stairSouls;
}());
