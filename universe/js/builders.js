/* =========================================================================
 * Voxel Cosmos — builders.js
 * Reusable voxel character/prop factories with hierarchical animated parts:
 * humanoids (souls, pedestrians, angels, demons), quadrupeds (animals),
 * harps, wings, halos, plus walk/step animation helpers.
 * All materials shared via VC.mc / VC.emissive caches.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  /* shared, cached time-aware materials (created once, reused by all props) */
  var sharedTime = {};
  VC.tmat = function (slot, key, factory, dayEm, nightEm, opts) {
    if (!sharedTime[key]) {
      var m = factory();
      VC.registerTimeMat(slot, m, dayEm, nightEm);
      if (opts) Object.assign(m.userData, opts);
      sharedTime[key] = m;
    }
    return sharedTime[key];
  };

  function part(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(VC.box(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  VC.part = part;

  /* ---- soul: small luminous capsule figure (pale wisp) ---- */
  VC.makeSoul = function (mat, glowMat) {
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var body = part(0.42, 0.85, 0.32, mat, 0, 0.45, 0);
    var head = part(0.34, 0.3, 0.28, mat, 0, 1.05, 0);
    g.add(body, head);
    if (glowMat) {
      var gl = VC.glowSprite(0xbfd8ff, 1.5, 0.5);
      gl.position.y = 0.8;
      g.add(gl);
    }
    return g;
  };

  /* ---- humanoid with articulated rig ---- */
  /* opts: skin, shirt, pants, hair, robe(bool), cape(color), halo(bool),
     keys(bool), book(bool), legs(bool), scale */
  VC.makeHumanoid = function (opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var mBody = opts.robe ? (opts.robeMat || VC.mc(opts.shirt || 0xffffff)) : VC.mc(opts.shirt || 0x4a6a9a);
    var mLeg = VC.mc(opts.pants || 0x33394a);
    var mSkin = VC.mc(opts.skin || 0xd8a080);
    var mHair = VC.mc(opts.hair || 0x40301f);

    var hips = new THREE.Group();
    g.add(hips);

    var torso, legs = [], arms = [];
    if (opts.robe) {
      torso = part(0.62, 1.1, 0.4, mBody, 0, 1.25, 0);
      var skirt = part(0.78, 0.7, 0.55, mBody, 0, 0.6, 0);
      hips.add(skirt);
    } else {
      torso = part(0.55, 0.9, 0.34, mBody, 0, 1.35, 0);
      legs = [
        new THREE.Group(), new THREE.Group()
      ];
      legs[0].position.set(-0.14, 0.9, 0); legs[1].position.set(0.14, 0.9, 0);
      legs.forEach(function (lg) {
        lg.add(part(0.18, 0.92, 0.2, mLeg, 0, -0.46, 0));
        hips.add(lg);
      });
    }
    hips.add(torso);
    var head = new THREE.Group();
    head.position.set(0, opts.robe ? 2.0 : 2.05, 0);
    head.add(part(0.42, 0.42, 0.38, mSkin, 0, 0.18, 0));
    if (!opts.bald) head.add(part(0.44, 0.16, 0.4, mHair, 0, 0.4, -0.01));
    /* beard optional */
    if (opts.beard) head.add(part(0.3, 0.26, 0.1, mHair, 0, 0.02, 0.17));
    hips.add(head);

    var aL = new THREE.Group(), aR = new THREE.Group();
    aL.position.set(-0.36, opts.robe ? 1.75 : 1.72, 0);
    aR.position.set(0.36, opts.robe ? 1.75 : 1.72, 0);
    var armMat = opts.robe ? mBody : mSkin;
    aL.add(part(0.16, 0.8, 0.18, armMat, 0, -0.4, 0));
    aR.add(part(0.16, 0.8, 0.18, armMat, 0, -0.4, 0));
    hips.add(aL, aR);

    if (opts.cape !== undefined && opts.cape !== null) {
      var cape = part(0.72, 1.5, 0.1, VC.mc(opts.cape), 0, 1.3, -0.26);
      hips.add(cape);
      g.userData.cape = cape;
    }
    if (opts.halo) {
      var halo = new THREE.Mesh(VC.torus(0.34, 0.05, 6, 12), VC.emissive(0xffe9a0, 1.15));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.62;
      head.add(halo);
      g.userData.halo = halo;
    }
    if (opts.wings) {
      var wm = opts.wingMat || VC.mc(0xffffff);
      var wL = new THREE.Group(), wR = new THREE.Group();
      var geoW = VC.box(0.9, 0.55, 0.1);
      var f1 = new THREE.Mesh(geoW, wm); f1.position.set(-0.42, 0.12, 0);
      var f2 = new THREE.Mesh(VC.box(0.75, 0.42, 0.1), wm); f2.position.set(-0.7, -0.16, 0.04); f2.rotation.z = -0.35;
      wL.add(f1, f2);
      var wRc = wL.clone();
      wRc.scale.x = -1;
      wL.position.set(-0.22, 1.7, -0.26);
      wRc.position.set(0.22, 1.7, -0.26);
      hips.add(wL, wRc);
      g.userData.wings = [wL, wRc];
    }
    g.userData.rig = { hips: hips, torso: torso, head: head, armL: aL, armR: aR, legs: legs };
    if (g.userData.wings) g.userData.rig.wings = g.userData.wings;

    if (opts.keys) {
      var keys = new THREE.Group();
      var gold = VC.emissive(0xffd23a, 1.05);
      var k1 = new THREE.Group();
      k1.add(part(0.07, 0.5, 0.07, gold, 0, 0.25, 0));
      k1.add(part(0.2, 0.07, 0.07, gold, 0.08, 0.5, 0));
      k1.add(part(0.07, 0.18, 0.07, gold, 0.15, 0.42, 0));
      var k2 = k1.clone(); k2.rotation.z = 0.5; k2.position.x = 0.14;
      keys.add(k1, k2);
      keys.position.set(0.3, -0.75, 0.16);
      aR.add(keys);
      g.userData.keys = keys;
    }
    if (opts.book) {
      var lectern = new THREE.Group();
      var wood = VC.mc(0x8a5a2a);
      lectern.add(part(0.34, 0.85, 0.34, wood, 0, -0.42, 0));
      lectern.add(part(0.5, 0.16, 0.42, VC.mc(0x6a4520), 0, 0.06, 0));
      var book = part(0.42, 0.1, 0.32, VC.mc(0xf5f0e0), 0, 0.18, 0.02);
      book.rotation.x = -0.35;
      lectern.add(book);
      var glowPage = part(0.44, 0.05, 0.3, VC.emissive(0xffe9b0, 0.7), 0, 0.24, 0.02);
      glowPage.rotation.x = -0.35;
      lectern.add(glowPage);
      lectern.position.set(0, 1.0, 0.55);
      hips.add(lectern);
      g.userData.lectern = lectern;
      g.userData.book = book;
    }
    g.scale.setScalar(scale);
    return g;
  };

  /* walk animation: t seconds, speed steps/sec, amplitude */
  VC.animateWalk = function (rig, t, speed, amp) {
    if (!rig) return;
    amp = amp === undefined ? 1 : amp;
    var s = t * speed * Math.PI * 2;
    if (rig.legs && rig.legs.length) {
      rig.legs[0].rotation.x = Math.sin(s) * 0.62 * amp;
      rig.legs[1].rotation.x = -Math.sin(s) * 0.62 * amp;
    }
    if (rig.armL) {
      rig.armL.rotation.x = -Math.sin(s) * 0.5 * amp;
      rig.armR.rotation.x = Math.sin(s) * 0.5 * amp;
    }
    if (rig.hips) rig.hips.position.y = Math.abs(Math.sin(s)) * 0.05 * amp;
  };

  /* ---- quadruped (dog / cow / deer...) ---- */
  /* opts: body(color), legsN, size, head, tail, horns, udder, neck(long) */
  VC.makeQuadruped = function (opts) {
    opts = opts || {};
    var size = opts.size || 1;
    var m = VC.mc(opts.body || 0x8a5a3a);
    var md = VC.mc(opts.dark || new THREE.Color(opts.body || 0x8a5a3a).multiplyScalar(0.6).getHex());
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var bodyL = opts.longBody ? 1.5 : 1.0;
    var body = part(0.55 * size, 0.5 * size, bodyL * size, m, 0, 0.62 * size, 0);
    g.add(body);
    var legs = [];
    for (var i = 0; i < 4; i++) {
      var lg = new THREE.Group();
      lg.position.set((i % 2 ? 0.2 : -0.2) * size, 0.42 * size, (i < 2 ? 0.32 : -0.32) * bodyL * size);
      lg.add(part(0.12 * size, 0.44 * size, 0.12 * size, md, 0, -0.22 * size, 0));
      g.add(lg); legs.push(lg);
    }
    var neck = new THREE.Group();
    neck.position.set(0, 0.82 * size, bodyL * size * 0.45);
    var nk = part(0.28 * size, (opts.longNeck ? 0.8 : 0.34) * size, 0.28 * size, m, 0, (opts.longNeck ? 0.3 : 0.1) * size, 0.05 * size);
    neck.add(nk);
    var head = new THREE.Group();
    head.position.set(0, (opts.longNeck ? 0.68 : 0.3) * size, 0.1 * size);
    head.add(part(0.34 * size, 0.3 * size, 0.4 * size, m, 0, 0, 0.05 * size));
    head.add(part(0.2 * size, 0.16 * size, 0.16 * size, md, 0, -0.04 * size, 0.26 * size));
    if (opts.horns) {
      var hg = VC.mc(0xd8cfc0);
      head.add(part(0.07 * size, 0.26 * size, 0.07 * size, hg, -0.18 * size, 0.2 * size, 0));
      head.add(part(0.07 * size, 0.26 * size, 0.07 * size, hg, 0.18 * size, 0.2 * size, 0));
    }
    if (opts.ears) {
      head.add(part(0.09 * size, 0.16 * size, 0.06 * size, md, -0.16 * size, 0.2 * size, -0.05 * size));
      head.add(part(0.09 * size, 0.16 * size, 0.06 * size, md, 0.16 * size, 0.2 * size, -0.05 * size));
    }
    neck.add(head);
    g.add(neck);
    var tail = new THREE.Group();
    tail.position.set(0, 0.8 * size, -bodyL * size * 0.5);
    tail.add(part(0.08 * size, 0.4 * size, 0.08 * size, md, 0, -0.14 * size, -0.08 * size));
    g.add(tail);
    if (opts.spots) {
      for (var s = 0; s < 3; s++) {
        var sp = part(0.22 * size, 0.06 * size, 0.26 * size, VC.mc(0x151515),
          (s % 2 ? 0.14 : -0.14) * size, 0.88 * size, (s - 1) * 0.35 * size);
        g.add(sp);
      }
    }
    if (opts.udder) g.add(part(0.2 * size, 0.16 * size, 0.26 * size, VC.mc(0xf0b8b0), 0, 0.42 * size, -0.35 * size));
    g.userData.rig = { legs: legs, head: head, neck: neck, tail: tail, body: body };
    return g;
  };
  /* gallop/trot for quadruped rigs */
  VC.animateQuadruped = function (rig, t, speed, amp) {
    if (!rig) return;
    var s = t * speed;
    var ph = [0, Math.PI, Math.PI, 0];
    for (var i = 0; i < rig.legs.length; i++) {
      rig.legs[i].rotation.x = Math.sin(s + ph[i]) * 0.7 * (amp || 1);
    }
    rig.tail.rotation.z = Math.sin(s * 0.7) * 0.22;
    rig.head.rotation.x = Math.sin(s * 0.5) * 0.08;
  };

  /* ---- harp (props) ---- */
  VC.makeHarp = function (color) {
    var g = new THREE.Group();
    var gold = VC.mc(color || 0xd8b23a);
    g.add(part(0.08, 0.75, 0.08, gold, 0, 0.37, 0));            // neck
    g.add(part(0.42, 0.08, 0.08, gold, 0.2, 0, 0));             // base
    g.add(part(0.08, 0.55, 0.08, gold, 0.38, 0.26, 0));         // pillar
    for (var i = 0; i < 5; i++) {
      g.add(part(0.016, 0.5, 0.016, VC.emissive(0xfff2c0, 0.9), 0.06 + i * 0.07, 0.3, 0));
    }
    return g;
  };

  /* ---- banner with texture ---- */
  VC.makeBanner = function (tex, w, h, matOpts) {
    var geo = new THREE.PlaneGeometry(w, h);
    var mat = new THREE.MeshLambertMaterial(Object.assign({
      map: tex, side: THREE.DoubleSide, transparent: true
    }, matOpts || {}));
    return new THREE.Mesh(geo, mat);
  };

  /* ---- placard sign ---- */
  VC.makeSign = function (text, sub, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var tex = VC.banner(text, sub, opts.signOpts);
    var w = opts.width || 12, h = opts.height || 6;
    var board = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, fog: false }));
    board.position.y = h / 2;
    g.add(board);
    if (opts.post !== false) {
      var pm = VC.mc(opts.postColor || 0x4a3826);
      g.add(part(0.5, h, 0.5, pm, -w / 2 + 0.6, 0, 0));
      g.add(part(0.5, h, 0.5, pm, w / 2 - 0.6, 0, 0));
    }
    return g;
  };

  /* ---- flame cluster (mesh-based fire, no particles needed) ---- */
  VC.makeFlame = function (h, colors) {
    colors = colors || [0xff4400, 0xff9a20, 0xffe27a];
    var g = new THREE.Group();
    g.userData.noMerge = true;
    for (var i = 0; i < 3; i++) {
      var m = new THREE.Mesh(VC.ico(h * (0.32 - i * 0.07), 0), VC.emissive(colors[i], 1));
      m.position.y = h * (0.25 + i * 0.24);
      m.userData.flamePhase = i;
      m.userData.flameH = h;
      g.add(m);
      g.userData.animated = true;
    }
    g.userData.parts = g.children.slice();
    return g;
  };
  VC.animateFlame = function (flameGroup, t, scaleAmp) {
    var parts = flameGroup.userData.parts;
    if (!parts) return;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var k = 1 + Math.sin(t * (9 + i * 4) + p.position.y * 7) * 0.24 * (scaleAmp || 1);
      p.scale.set(k, 1.15 + Math.sin(t * 12 + i) * 0.3 * (scaleAmp || 1), k);
      p.rotation.y = t * 2 + i;
    }
  };

  /* ---- simple torch ---- */
  VC.makeTorch = function (h, mat) {
    var g = new THREE.Group();
    g.userData.noMerge = true;
    g.add(part(0.16, h, 0.16, mat || VC.mc(0x3a2a1a), 0, h / 2, 0));
    var fl = VC.makeFlame(h * 0.5);
    fl.position.y = h;
    g.add(fl);
    g.userData.flame = fl;
    return g;
  };

  /* ---- chain: instanced links along a curve ---- */
  VC.makeChain = function (from, to, linkR, segs, mat) {
    var n = segs || 14;
    var im = new THREE.InstancedMesh(
      new THREE.TorusGeometry(linkR, linkR * 0.32, 4, 6),
      mat || VC.mc(0x2a2a30), n);
    var d = new THREE.Object3D();
    var a = new THREE.Vector3(), b = new THREE.Vector3();
    for (var i = 0; i <= n - 1; i++) {
      var t = i / (n - 1);
      d.position.lerpVectors(from, to, t);
      /* slight sag */
      d.position.y -= Math.sin(t * Math.PI) * from.distanceTo(to) * 0.12;
      d.rotation.set(Math.PI / 2, 0, t % 2 ? Math.PI / 2 : 0);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    return im;
  };

  /* ---- house / building generator ---- */
  /* opts: w,d,h, wall, roof(color or 'flat'), roofTone, windows(bool),
     shopfront(color), tower(bool) */
  VC.makeHouse = function (rng, opts) {
    opts = opts || {};
    var w = opts.w || 6, d = opts.d || 5, h = opts.h || 5;
    var g = new THREE.Group();
    var wall = VC.mc(opts.wall || 0xd8cbb8);
    g.add(part(w, h, d, wall, 0, h / 2, 0));
    if (opts.roof !== 'flat') {
      var rh = h * 0.4;
      var roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.74, rh, 4),
        VC.mc(opts.roof || 0x9a4a2a));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + rh / 2;
      g.add(roof);
    } else {
      g.add(part(w * 0.9, 0.4, d * 0.9, VC.mc(typeof opts.roof === 'number' ? opts.roof : 0x7a7a84), 0, h + 0.2, 0));
    }
    if (opts.windows !== false) {
      var wm = VC.tmat('windowsWarm', 'houseWin', function () {
        return new THREE.MeshLambertMaterial({ color: 0x39435e });
      }, 0x000000, 0xffc870, { maxLevel: opts.winLevel === undefined ? 1 : opts.winLevel });
      var nX = Math.max(1, Math.round(w / 2.4)), nY = Math.max(1, Math.round(h / 2.6));
      for (var f = 0; f < 2; f++) {
        for (var x = 0; x < nX; x++) {
          for (var y = 0; y < nY; y++) {
            var px = -w / 2 + (x + 0.5) * (w / nX);
            var py = 1.2 + y * (h - 1.2) / nY;
            var win = part(0.9, 1.1, 0.1, wm, px, py, f ? d / 2 + 0.02 : -d / 2 - 0.02);
            g.add(win);
          }
        }
      }
    }
    if (opts.shopfront) {
      g.add(part(w * 0.7, 1.6, 0.2, VC.mc(opts.shopfront), 0, 1.1, d / 2 + 0.06));
      g.add(part(w * 0.74, 0.5, 0.3, VC.mc(0xffffff), 0, 2.15, d / 2 + 0.1));
    }
    if (opts.door !== false) {
      g.add(part(1, 1.8, 0.12, VC.mc(opts.doorColor || 0x5a3a20), rng.range(-w / 4, w / 4), 0.9, d / 2 + 0.05));
    }
    return g;
  };

  VC.makeTower = function (rng, opts) {
    opts = opts || {};
    var w = opts.w || 8, h = opts.h || 24, d = opts.d || 8;
    var g = new THREE.Group();
    var wall = opts.wallMat || VC.mc(opts.wall || 0x9aa4b8);
    g.add(part(w, h, d, wall, 0, h / 2, 0));
    /* crown */
    g.add(part(w + 0.8, 0.8, d + 0.8, wall, 0, h + 0.4, 0));
    for (var c = 0; c < 4; c++) {
      var sx = c % 2 ? w / 2 + 0.2 : -w / 2 - 0.2;
      var sz = c < 2 ? d / 2 + 0.2 : -d / 2 - 0.2;
      g.add(part(1, 1.6, 1, wall, sx, h + 1.2, sz));
    }
    /* window band texture */
    if (opts.windows !== false) {
      var rx = Math.max(1, Math.round(w / 4)), ry = Math.max(2, Math.round(h / 6));
      var wm = VC.tmat('windowsWarm', 'band_' + rx + '_' + ry, function () {
        var m = new THREE.MeshLambertMaterial({ map: VC.windowTexture(), color: 0x2a3350, emissive: 0x000000 });
        m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
        m.map.repeat.set(rx, ry);
        return m;
      }, 0x000000, 0xffd28a, { boostColor: true, maxLevel: opts.winLevel === undefined ? 1 : opts.winLevel });
      var band = part(w + 0.1, h - 2, d + 0.1, wm, 0, h / 2 + 0.5, 0);
      g.add(band);
    }
    if (opts.antenna) {
      g.add(part(0.4, opts.antenna, 0.4, VC.mc(0x888890), 0, h + opts.antenna / 2 + 2, 0));
      var beacon = new THREE.Mesh(VC.sphereGeo(0.5, 6, 4), VC.emissive(0xff3030, 1));
      beacon.position.y = h + opts.antenna + 2;
      g.add(beacon);
      g.userData.beacon = beacon;
    }
    return g;
  };

  /* ---- car / truck / bus on a path ---- */
  VC.makeCar = function (opts) {
    opts = opts || {};
    var L2 = opts.len || 2.6, W = 1.3;
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var body = VC.mc(opts.color || 0xcc3333);
    var dark = VC.mc(0x1a1d24);
    g.add(part(W, 0.5, L2, body, 0, 0.45, 0));
    if (!opts.flat) g.add(part(W * 0.86, 0.42, L2 * 0.5, VC.mc(0x223048), 0, 0.9, -L2 * 0.06));
    if (opts.tall) g.add(part(W, 1.1, L2 * 0.72, body, 0, 1.05, L2 * 0.12)); // truck cab/bus body
    var wheels = [];
    [-1, 1].forEach(function (sx) {
      [L2 * 0.3, -L2 * 0.3].forEach(function (sz) {
        var wh = new THREE.Mesh(VC.cyl(0.28, 0.28, 0.2, 6), dark);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(sx * W / 2, 0.28, sz);
        g.add(wh); wheels.push(wh);
      });
    });
    var lampMat = VC.tmat('streetGlow', 'headlamp', function () { return VC.emissive(0xfff2c0, 1); }, 0x443c20, 0xfff2c0);
    var tailMat = VC.tmat('streetGlow', 'taillamp', function () { return VC.emissive(0xff2020, 0.8); }, 0x300404, 0xff3030);
    var hl = [];
    hl.push(part(0.26, 0.18, 0.08, lampMat, -W * 0.3, 0.5, L2 / 2 + 0.02));
    hl.push(part(0.26, 0.18, 0.08, lampMat, W * 0.3, 0.5, L2 / 2 + 0.02));
    hl.push(part(0.24, 0.16, 0.08, tailMat, -W * 0.3, 0.5, -L2 / 2 - 0.02));
    hl.push(part(0.24, 0.16, 0.08, tailMat, W * 0.3, 0.5, -L2 / 2 - 0.02));
    g.add(hl[0], hl[1], hl[2], hl[3]);
    g.userData.wheels = wheels;
    return g;
  };

  /* ---- airplane ---- */
  VC.makePlane = function (opts) {
    opts = opts || {};
    var s = opts.scale || 1;
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var white = VC.mc(opts.body || 0xe8ecf2);
    var accent = VC.mc(opts.accent || 0xd03030);
    var fus = new THREE.Group();
    fus.add(part(1.1 * s, 1.1 * s, 7 * s, white, 0, 0, 0));
    var nose = new THREE.Mesh(VC.sphereGeo(0.55 * s, 6, 5), white);
    nose.position.z = 3.5 * s; nose.scale.z = 1.4;
    fus.add(nose);
    fus.add(part(0.9 * s, 0.35 * s, 1.2 * s, VC.mc(0x223048), 0, 0.2 * s, 2.2 * s)); // windshield
    var wing = part(7.4 * s, 0.18 * s, 1.5 * s, accent, 0, 0, 0.3 * s);
    fus.add(wing);
    var tailW = part(2.6 * s, 0.14 * s, 0.9 * s, accent, 0, 0, -2.9 * s);
    var tailF = part(0.14 * s, 1.4 * s, 1.2 * s, accent, 0, 0.8 * s, -3 * s);
    fus.add(tailW, tailF);
    [-1, 1].forEach(function (sx) {
      var eng = new THREE.Mesh(VC.cylGeo(0.32 * s, 0.32 * s, 1.4 * s, 8), VC.mc(0x8a94a8));
      eng.rotation.x = Math.PI / 2;
      eng.position.set(sx * 1.9 * s, -0.35 * s, 0.4 * s);
      fus.add(eng);
    });
    /* gear for taxi */
    if (opts.gear !== false) {
      [-1, 1].forEach(function (sx) {
        fus.add(part(0.16 * s, 0.7 * s, 0.16 * s, VC.mc(0x333), sx * 0.8 * s, -0.9 * s, 0.4 * s));
      });
      fus.add(part(0.16 * s, 0.7 * s, 0.16 * s, VC.mc(0x333), 0, -0.9 * s, 2.6 * s));
    }
    g.add(fus);
    g.userData.fus = fus;
    /* nav lights */
    var rg = VC.registerTimeMat('runway', VC.emissive(0xff3050, 1));
    var gn = VC.registerTimeMat('runway', VC.emissive(0x30ff60, 1));
    var l1 = new THREE.Mesh(VC.sphereGeo(0.12 * s, 4, 3), rg); l1.position.set(-3.7 * s, 0, 0.3 * s);
    var l2 = new THREE.Mesh(VC.sphereGeo(0.12 * s, 4, 3), gn); l2.position.set(3.7 * s, 0, 0.3 * s);
    fus.add(l1, l2);
    return g;
  };

  /* ---- helicopter ---- */
  VC.makeHelicopter = function (opts) {
    opts = opts || {};
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var body = VC.mc(opts.color || 0x2a5a8a);
    g.add(part(1.5, 1.3, 3, body, 0, 0, 0));
    g.add(part(0.5, 0.5, 2.4, body, 0, 0.3, -2.4));
    g.add(part(0.16, 1, 0.16, body, 0, 0.9, -3.3));
    var glass = VC.mc(0x88c8e8, 0x112233);
    g.add(part(1.3, 0.8, 0.2, glass, 0, 0.15, 1.45));
    var mR = new THREE.Group();
    for (var i = 0; i < 4; i++) {
      var bl = part(0.22, 0.08, 6.4, VC.mc(0x22262e), 0, 0, 0);
      bl.rotation.y = i * Math.PI / 2;
      mR.add(bl);
    }
    mR.position.y = 0.85;
    g.add(mR);
    var tR = new THREE.Group();
    for (var j = 0; j < 2; j++) {
      var tb = part(0.08, 1.6, 0.08, VC.mc(0x22262e), 0, 0, 0);
      tb.rotation.x = j * Math.PI / 2;
      tR.add(tb);
    }
    tR.position.set(0.3, 0.9, -3.4);
    tR.rotation.z = Math.PI / 2;
    g.add(tR);
    skid(g);
    g.userData.rotor = mR;
    g.userData.tailRotor = tR;
    return g;
    function skid(gr) {
      [-0.7, 0.7].forEach(function (x) {
        gr.add(part(0.12, 0.12, 2.6, VC.mc(0x333), x, -1.15, 0));
        gr.add(part(0.1, 0.5, 0.1, VC.mc(0x333), x, -0.8, 0.6));
        gr.add(part(0.1, 0.5, 0.1, VC.mc(0x333), x, -0.8, -0.6));
      });
    }
  };

  /* ---- hot air balloon ---- */
  VC.makeBalloon = function (rng) {
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var stripes = [0xff5040, 0xffd24a, 0x40b8ff, 0xffffff];
    for (var i = 0; i < 8; i++) {
      var geo = VC.boxGeo(1.05, 2.4, 1.05);
      var m = new THREE.Mesh(geo, VC.mc(stripes[i % 4]));
      var a = i / 8 * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.35, 0.9, Math.sin(a) * 1.35);
      m.rotation.y = -a;
      m.scale.set(1.28, 1.55, 1.28);
      g.add(m);
    }
    g.add(part(2.2, 1.2, 2.2, VC.mc(0xff8040), 0, -0.4, 0));
    var rope = VC.mc(0x4a3a2a);
    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(function (p) {
      g.add(part(0.08, 1.6, 0.08, rope, p[0], -1.6, p[1]));
    });
    var basket = new THREE.Group();
    basket.add(part(1.4, 0.9, 1.4, VC.mc(0x8a5a30), 0, 0, 0));
    basket.position.y = -2.6;
    g.add(basket);
    var burner = VC.glowSprite(0xffa040, 1.4, 0.9);
    burner.position.y = -1.3;
    g.add(burner);
    g.userData.burner = burner;
    return g;
  };

  /* ---- boat ---- */
  VC.makeBoat = function (rng, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var hull = VC.mc(opts.hull || 0xffffff);
    g.add(part(1.6, 0.7, 4.2, hull, 0, 0, 0));
    var bow = new THREE.Mesh(VC.boxGeo(1.5, 0.6, 1.2), hull);
    bow.position.z = 2.5; bow.rotation.y = 0.5;
    g.add(bow);
    g.add(part(1.4, 0.5, 2.4, VC.mc(opts.cabin || 0xcc4422), 0, 0.6, -0.8));
    if (opts.mast) {
      g.add(part(0.12, 3.2, 0.12, VC.mc(0x5a4a30), 0, 1.7, 0.6));
      var sail = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.2), new THREE.MeshLambertMaterial({ color: 0xf5f5f0, side: THREE.DoubleSide }));
      sail.position.set(0.8, 2.4, 0.6); sail.rotation.y = Math.PI / 2;
      g.add(sail);
    }
    if (opts.lights) {
      var lm = VC.registerTimeMat('runway', VC.emissive(0xfff0b0, 1));
      var l1 = new THREE.Mesh(VC.sphereGeo(0.15, 4, 3), lm); l1.position.set(0, 1.3, 1.6);
      g.add(l1);
    }
    return g;
  };

  /* ---- demon: horned flyer/brute ---- */
  VC.makeDemon = function (rng, opts) {
    opts = opts || {};
    var s = opts.scale || 1;
    var g = new THREE.Group();
    g.userData.noMerge = true;
    var skin = VC.mc(opts.color || 0x7a2020);
    var dark = VC.mc(0x220808);
    var hips = new THREE.Group();
    g.add(hips);
    hips.add(part(0.7 * s, 1.1 * s, 0.5 * s, skin, 0, 1.1 * s, 0));
    var head = new THREE.Group(); head.position.y = 1.9 * s;
    head.add(part(0.5 * s, 0.45 * s, 0.45 * s, skin, 0, 0.2 * s, 0));
    var eyeM = VC.emissive(0xffdd30, 1.2);
    head.add(part(0.12 * s, 0.08 * s, 0.06 * s, eyeM, -0.13 * s, 0.24 * s, 0.23 * s));
    head.add(part(0.12 * s, 0.08 * s, 0.06 * s, eyeM, 0.13 * s, 0.24 * s, 0.23 * s));
    head.add(part(0.12 * s, 0.3 * s, 0.12 * s, dark, -0.22 * s, 0.5 * s, 0));
    head.add(part(0.12 * s, 0.3 * s, 0.12 * s, dark, 0.22 * s, 0.5 * s, 0));
    hips.add(head);
    var legs = [];
    [-0.2, 0.2].forEach(function (x) {
      var lg = new THREE.Group(); lg.position.set(x * s, 0.6 * s, 0);
      lg.add(part(0.22 * s, 0.65 * s, 0.24 * s, skin, 0, -0.3 * s, 0));
      hips.add(lg); legs.push(lg);
    });
    var aL = new THREE.Group(), aR = new THREE.Group();
    aL.position.set(-0.5 * s, 1.5 * s, 0); aR.position.set(0.5 * s, 1.5 * s, 0);
    aL.add(part(0.2 * s, 0.9 * s, 0.2 * s, skin, 0, -0.4 * s, 0));
    aR.add(part(0.2 * s, 0.9 * s, 0.2 * s, skin, 0, -0.4 * s, 0));
    aR.add(part(0.5 * s, 0.12 * s, 0.12 * s, dark, 0.18 * s, -0.9 * s, 0));  // whip
    hips.add(aL, aR);
    var wings = null;
    if (opts.wings) {
      wings = [new THREE.Group(), new THREE.Group()];
      var wm = VC.mc(opts.wingColor || 0x33080c);
      [-1, 1].forEach(function (sx, i) {
        var w = wings[i];
        var m1 = new THREE.Mesh(VC.boxGeo(1.4 * s, 0.9 * s, 0.08 * s), wm);
        m1.position.set(sx * 0.8 * s, 0.3 * s, 0);
        w.add(m1);
        var m2 = new THREE.Mesh(VC.boxGeo(1.1 * s, 0.6 * s, 0.08 * s), wm);
        m2.position.set(sx * 1.6 * s, -0.1 * s, 0.1); m2.rotation.z = sx * -0.5;
        w.add(m2);
        w.position.set(sx * 0.4 * s, 1.6 * s, -0.3 * s);
        hips.add(w);
      });
    }
    g.userData.rig = { hips: hips, head: head, armL: aL, armR: aR, legs: legs, wings: wings };
    return g;
  };
}());
