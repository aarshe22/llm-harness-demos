/* =========================================================================
 * Voxel Cosmos — actors.js
 * The major hierarchical characters, each an animation STATE MACHINE with
 * a public API used by navigation/tour sequences:
 *   Cerberus  — three independently animated heads, head-tracking, barks,
 *               synchronized 3-head ROAR, lunges, chains, underlighting.
 *   SaintPeter— idle / greet / raise-keys / open-gate blessings + chime.
 *   Satan     — seated colossus, wing beats, three weeping faces, tremor.
 *   Dragons   — abyss circling wyrm with jaw-flame breath bursts (VC.dragons)
 *   Angels    — flight paths, harp plucking, descents.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var part = VC.part;

  /* =====================================================================
   * CERBERUS
   * ===================================================================== */
  VC.buildCerberus = function (rng) {
    var stone = VC.mc(0x221e26);
    var stoneD = VC.mc(0x15121a);
    var eyeM = VC.emissive(0xffb020, 1.4);
    var mouthM = VC.emissive(0xff4a10, 1.2);
    var tooth = VC.mc(0xcfc8b8);

    var G = new THREE.Group();

    /* body */
    var body = new THREE.Group();
    body.add(part(8, 6, 12, stone, 0, 5, 0));
    body.add(part(9, 2.4, 13, stoneD, 0, 2.2, 0));
    /* spine ridge */
    for (var s = 0; s < 7; s++) {
      body.add(part(1, 1.6 - s * 0.08, 1, stoneD, 0, 8.4 - 0.05 * s, -4.5 + s * 1.5));
    }
    /* haunches */
    body.add(part(6, 5.5, 4, stone, 0, 4.6, -7));
    /* tail */
    var tail = new THREE.Group();
    tail.position.set(0, 5.5, -9.5);
    var seg = tail;
    for (var tI = 0; tI < 4; tI++) {
      var nx = new THREE.Group();
      nx.position.set(0, -0.2, -2.2);
      nx.add(part(1.4 - tI * 0.24, 1.4 - tI * 0.24, 2.4, stoneD, 0, 0, -1));
      seg.add(nx); seg = nx;
    }
    body.add(tail);
    /* legs with simple walk pivots */
    var legs = [];
    [[-3.2, 4.4], [3.2, 4.4], [-3.2, -5.5], [3.2, -5.5]].forEach(function (p) {
      var lg = new THREE.Group();
      lg.position.set(p[0], 4, p[1]);
      lg.add(part(2.4, 4.4, 2.6, stone, 0, -2.2, 0));
      lg.add(part(2.6, 1, 3.4, stoneD, 0, -4.5, 0.5));
      for (var c = 0; c < 3; c++) lg.add(part(0.5, 0.7, 0.9, tooth, -0.8 + c * 0.8, -4.9, 2));
      body.add(lg); legs.push(lg);
    });
    G.add(body);

    /* neck roots at front-top of body */
    var neckRoot = new THREE.Group();
    neckRoot.position.set(0, 7, 5.5);
    body.add(neckRoot);

    function makeHead(idx, side) {
      var pivot = new THREE.Group();                 // yaw/pitch pivot
      var neck = new THREE.Group();                  // segmented neck
      var n1 = new THREE.Group(), n2 = new THREE.Group();
      n1.add(part(1.7, 1.7, 2.6, stone, 0, 0, 1.2));
      n2.position.z = 2.4;
      n2.add(part(1.4, 1.4, 2.2, stone, 0, 0, 1));
      neck.add(n1, n2);
      var skull = new THREE.Group();
      skull.position.z = 3.6;
      skull.add(part(2.4, 2.2, 3.2, stone, 0, 0, 0));           // cranium
      skull.add(part(1.6, 0.6, 1.2, stone, 0, -0.2, -1.6));     // back crest
      /* ears */
      skull.add(part(0.5, 1.4, 0.3, stoneD, -0.9, 1.5, -0.6));
      skull.add(part(0.5, 1.4, 0.3, stoneD, 0.9, 1.5, -0.6));
      /* eyes */
      var eyeL = part(0.5, 0.3, 0.15, eyeM, -0.6, 0.5, 1.5);
      var eyeR = part(0.5, 0.3, 0.15, eyeM, 0.6, 0.5, 1.5);
      skull.add(eyeL, eyeR);
      var eyeGlowL = VC.glowSprite(0xffa020, 1.6, 0.8); eyeGlowL.position.set(-0.6, 0.5, 1.7);
      var eyeGlowR = VC.glowSprite(0xffa020, 1.6, 0.8); eyeGlowR.position.set(0.6, 0.5, 1.7);
      skull.add(eyeGlowL, eyeGlowR);
      /* upper muzzle + teeth */
      skull.add(part(1.3, 0.9, 2.2, stone, 0, -0.35, 2.4));
      for (var tc = 0; tc < 4; tc++) {
        skull.add(part(0.22, 0.42, 0.22, tooth, -0.45 + tc * 0.3, -0.85, 1.7 + (tc % 2) * 0.7));
      }
      /* articulated jaw */
      var jaw = new THREE.Group();
      jaw.position.set(0, -0.9, 1.4);
      jaw.add(part(1.2, 0.5, 2.1, stoneD, 0, -0.2, 1.1));
      for (var j = 0; j < 4; j++) {
        jaw.add(part(0.2, 0.36, 0.2, tooth, -0.4 + j * 0.27, 0.12, 0.6 + (j % 2) * 0.7));
      }
      var mouthGlow = VC.glowSprite(0xff5010, 3.2, 0.9);
      mouthGlow.position.set(0, 0.2, 2);
      jaw.add(mouthGlow);
      skull.add(jaw);
      /* head light so mouths read in the dark */
      var hl = new THREE.PointLight(0xff5a20, 0.9, 22, 2);
      hl.position.set(0, 0, 3);
      skull.add(hl);

      neck.add(skull);
      pivot.add(neck);
      return { pivot: pivot, skull: skull, jaw: jaw, eyeGlowL: eyeGlowL, eyeGlowR: eyeGlowR, hl: hl, mouthGlow: mouthGlow, neck: [n1, n2] };
    }

    /* three heads with distinct temperaments (personality params) */
    var heads = [];
    var layout = [
      { x: -3.0, y: 0.6, z: 0, phase: 0.0, amp: 1.0, name: 'sullen' },   // left
      { x: 0, y: 2.6, z: 0.6, phase: 2.1, amp: 1.25, name: 'watchful' }, // centre, taller
      { x: 3.0, y: 0.6, z: 0, phase: 4.2, amp: 1.0, name: 'snappy' }     // right
    ];
    layout.forEach(function (ly) {
      var h = makeHead();
      h.pivot.position.set(ly.x, ly.y, ly.z);
      h.pivot.rotation.y = -ly.x * 0.16;
      neckRoot.add(h.pivot);
      h.phase = ly.phase; h.amp = ly.amp; h.name = ly.name;
      heads.push(h);
    });
    G.userData.heads = heads;

    G.position.set(0, VC.LEVELS.HELL_GATES_Y - 5.6, -100);
    return {
      group: G, heads: heads, legs: legs, tail: tail, body: body,
      state: 'idle', stateT: 0, roarT: 0, tracked: false, aggro: 0,
      triggerRoar: function (dur) {
        this.state = 'roar'; this.stateT = 0; this.roarDur = dur || 4;
        VC.emit('cerberusRoar');
      },
      triggerLunge: function () { this.state = 'lunge'; this.stateT = 0; }
    };
  };

  VC.updateCerberus = function (C, dt, t, camPos) {
    C.stateT += dt;
    var mf = VC.motionFactor();
    /* proximity aggro: heads track camera when close */
    var d = C.group.position.distanceTo(camPos);
    C.tracked = d < 130;
    C.aggro = VC.damp(C.aggro, C.tracked ? VC.clamp(1.4 - d / 100, 0.35, 1) : 0.12, 2, dt);
    var isRoar = C.state === 'roar', isLunge = C.state === 'lunge';
    if (isRoar && C.stateT > (C.roarDur || 4)) { C.state = 'idle'; C.stateT = 0; }
    if (isLunge && C.stateT > 1.6) { C.state = 'idle'; C.stateT = 0; }

    /* body breathing + tremor */
    var breath = Math.sin(t * 1.4) * 0.02 * mf;
    C.body.scale.set(1 + breath, 1 + breath * 1.4, 1 + breath);
    var shake = isRoar ? Math.sin(t * 40) * 0.02 : (C.aggro > 0.5 ? Math.sin(t * 17) * 0.006 : 0);
    C.body.position.x = shake * 4;
    C.body.position.y = isLunge ? Math.sin(Math.min(C.stateT / 1.6, 1) * Math.PI) * 0.9 : 0;
    C.body.position.z = isLunge ? -Math.sin(Math.min(C.stateT / 1.6, 1) * Math.PI) * 2.2 : 0;

    /* tail wag / thrash */
    C.tail.rotation.y = Math.sin(t * (isRoar ? 9 : 1.6)) * (isRoar ? 0.5 : 0.2) * mf;

    /* legs: restless shift during aggro */
    for (var i = 0; i < C.legs.length; i++) {
      C.legs[i].rotation.x = Math.sin(t * 2 + i * 1.7) * 0.05 * C.aggro * mf;
    }

    /* heads */
    var roarMix = 0;
    if (isRoar) {
      var rt = C.stateT / (C.roarDur || 4);
      roarMix = rt < 0.18 ? rt / 0.18 : (rt > 0.75 ? (1 - rt) / 0.25 : 1);
      roarMix = VC.clamp(roarMix, 0, 1);
    }
    var lungeMix = isLunge ? Math.sin(Math.min(C.stateT / 1.6, 1) * Math.PI) : 0;

    for (var hI = 0; hI < C.heads.length; hI++) {
      var h = C.heads[hI];
      /* target yaw/pitch: track camera when close, else proud idle scan */
      var wantYaw = -h.phase * 0 + (hI - 1) * -0.16;
      var wantPitch = 0.06;
      if (C.tracked) {
        var v = new THREE.Vector3().subVectors(camPos, C.group.position);
        var yawW = Math.atan2(v.x, v.z) - (hI - 1) * 0.14;
        yawW = VC.shortestAngle(h.pivot.rotation.y, yawW);
        wantYaw = h.pivot.rotation.y + yawW * 0.5;
        wantPitch = VC.clamp(-Math.atan2(v.y - (C.group.position.y + 9), Math.sqrt(v.x * v.x + v.z * v.z)) + 0.1, -0.6, 0.6);
      } else {
        wantYaw = (hI - 1) * -0.16 + Math.sin(t * 0.4 + h.phase) * 0.3 * h.amp;
        wantPitch = Math.sin(t * 0.5 + h.phase) * 0.1;
      }
      var trackL = VC.clamp(2.2 + C.aggro * 3, 0, 8);
      h.pivot.rotation.y = VC.damp(h.pivot.rotation.y, wantYaw, trackL, dt);
      h.pivot.rotation.x = VC.damp(h.pivot.rotation.x, wantPitch - roarMix * 0.45 + lungeMix * 0.4, trackL, dt);
      /* necks: growl ripple */
      h.neck[0].rotation.x = Math.sin(t * 3 + h.phase) * 0.05 * C.aggro - roarMix * 0.25;
      h.neck[1].rotation.x = Math.sin(t * 3.4 + h.phase + 1) * 0.06 * C.aggro - roarMix * 0.2;

      /* jaw: idle pant, growl, full roar — heads slightly out of phase */
      var jawT = t * 2.2 + h.phase;
      var idleJaw = (0.06 + Math.max(0, Math.sin(jawT)) * 0.10) * C.aggro;
      var growlJaw = Math.max(0, Math.sin(t * 9 + h.phase)) * 0.16 * C.aggro;
      var roarJaw = roarMix * (0.92 + Math.sin(t * 26 + hI * 2) * 0.08);
      var lungeJaw = lungeMix * 0.7;
      var jawOpen = VC.clamp(Math.max(idleJaw + growlJaw, roarJaw, lungeJaw), 0, 1.05);
      h.jaw.rotation.x = jawOpen;

      /* eyes/mouths brighten with arousal */
      var glowK = 0.35 + C.aggro * 0.5 + roarMix * 0.8;
      h.eyeGlowL.material.opacity = VC.clamp(glowK, 0, 1);
      h.eyeGlowR.material.opacity = VC.clamp(glowK, 0, 1);
      h.mouthGlow.material.opacity = VC.clamp(jawOpen * 1.1, 0, 1) * (0.4 + glowK * 0.6);
      h.mouthGlow.scale.setScalar(2 + jawOpen * 2.4);
      h.hl.intensity = 0.5 + jawOpen * 1.6 + roarMix * 2.2;
    }

    /* periodic single-head bark while idle (independent personality moments) */
    if (C.state === 'idle' && C.aggro > 0.3) {
      var per = 3.2 + C.heads[2].phase;
      if (C.stateT % per > per - 0.45) {
        var hh = C.heads[2];
        hh.jaw.rotation.x = Math.max(hh.jaw.rotation.x, Math.sin((C.stateT % per - (per - 0.45)) / 0.45 * Math.PI) * 0.55);
      }
      if (C.stateT % 6 > 6 - 0.6) {
        var hh2 = C.heads[0];
        hh2.jaw.rotation.x = Math.max(hh2.jaw.rotation.x, Math.sin((C.stateT % 6 - (6 - 0.6)) / 0.6 * Math.PI) * 0.4);
      }
    }
  };

  /* =====================================================================
   * SAINT PETER
   * ===================================================================== */
  VC.buildPeter = function () {
    var fig = VC.makeHumanoid({
      robe: true, shirt: 0xf2efe6, skin: 0xd8a888, hair: 0xe8e8ee, beard: true,
      halo: true, keys: true, book: true, scale: 2.1
    });
    /* gold trim sash */
    var rig = fig.userData.rig;
    rig.torso.add(part(0.66, 0.18, 0.44, VC.emissive(0xffd23a, 0.85), 0, 0.18, 0));
    /* gold mantle */
    rig.torso.add(part(0.86, 0.5, 0.5, VC.mc(0xd8b23a), 0, 0.62, 0));
    fig.position.set(0, VC.LEVELS.STAIR_TOP_Y + 1.2, 111);
    /* he faces down the stair (south) */
    fig.rotation.y = Math.PI;
    return {
      group: fig, rig: rig, state: 'idle', stateT: 0,
      greet: function () { this.state = 'greet'; this.stateT = 0; VC.emit('peterGreet'); },
      raiseKeys: function (dur) { this.state = 'keys'; this.stateT = 0; this.keysDur = dur || 3; },
      bless: function () { this.state = 'bless'; this.stateT = 0; }
    };
  };

  VC.updatePeter = function (P, dt, t) {
    P.stateT += dt;
    var rig = P.rig;
    var mf = VC.motionFactor();
    /* base gentle idle */
    var idleArmL = Math.sin(t * 0.9) * 0.06, idleArmR = Math.sin(t * 0.9 + 1) * 0.05;
    var headNod = Math.sin(t * 0.5) * 0.05;
    var armL = idleArmL, armR = idleArmR, headX = headNod, bodyY = 0;

    if (P.state === 'greet') {
      var k = VC.easeOut(VC.clamp(P.stateT / 0.8, 0, 1));
      var back = VC.easeOut(VC.clamp((P.stateT - 2.6) / 0.9, 0, 1));
      var raise = Math.min(k, back);
      armR = -1.9 * raise;                 // wave
      var wob = Math.sin(P.stateT * 9) * 0.25 * raise * mf;
      armR += wob;
      headX = -0.12 * raise;
      if (P.stateT > 3.4) { P.state = 'idle'; }
    } else if (P.state === 'keys') {
      var kd = P.keysDur || 3;
      var up = VC.easeInOut(VC.clamp(P.stateT / (kd * 0.4), 0, 1));
      var hold = P.stateT < kd * 0.75 ? 1 : VC.clamp(1 - (P.stateT - kd * 0.75) / (kd * 0.25), 0, 1);
      var kRaise = up * hold;
      armR = -2.6 * kRaise;
      armL = -0.5 * kRaise;
      headX = -0.25 * kRaise;
      bodyY = 0.06 * kRaise;
      if (P.stateT > kd) { P.state = 'bless'; P.stateT = 0; }
    } else if (P.state === 'bless') {
      var bk = VC.easeInOut(VC.clamp(P.stateT / 1.0, 0, 1));
      var rel = P.stateT > 2.4 ? VC.easeOut(VC.clamp((P.stateT - 2.4) / 1.0, 0, 1)) : 1;
      var b = bk * rel;
      armL = -1.2 * b; armR = -1.2 * b;
      headX = 0.12 * b;
      if (P.stateT > 3.6) { P.state = 'idle'; }
    }
    rig.armL.rotation.x = VC.damp(rig.armL.rotation.x, armL, 7, dt);
    rig.armR.rotation.x = VC.damp(rig.armR.rotation.x, armR, 7, dt);
    rig.head.rotation.x = VC.damp(rig.head.rotation.x, headX, 6, dt);
    rig.hips.position.y = VC.damp(rig.hips.position.y, bodyY, 6, dt);
    var keys = P.group.userData.keys;
    if (keys) keys.rotation.z = Math.sin(t * 1.3) * 0.08;
  };

  /* =====================================================================
   * SATAN
   * ===================================================================== */
  VC.buildSatan = function () {
    var g = new THREE.Group();
    var skin = VC.mc(0x2e0d12);
    var skinD = VC.mc(0x1c070a);
    var ice = VC.mc(0x8aa8c8, 0x1a2a3a);
    var eyeM = VC.emissive(0xff2010, 1.5);

    /* throne block */
    var throne = new THREE.Group();
    throne.add(part(26, 30, 12, VC.mc(0x17141d), 0, 15, -8));
    throne.add(part(30, 6, 16, VC.mc(0x100d15), 0, 3, -4));
    for (var pI = 0; pI < 2; pI++) {
      throne.add(part(4, 40, 4, VC.mc(0x1f1a26), pI ? 15 : -15, 20, -10));
      var fp = VC.makeFlame(5); fp.position.set(pI ? 15 : -15, 41, -10);
      throne.add(fp);
      throne.userData['flame' + pI] = fp;
    }
    g.add(throne);

    /* figure */
    var hips = new THREE.Group();
    hips.position.y = 6;
    g.add(hips);
    hips.add(part(14, 16, 8, skin, 0, 10, 0));            // torso
    hips.add(part(16, 5, 9, skinD, 0, 3, 0));             // lap
    /* legs down into ice */
    [-4.5, 4.5].forEach(function (x) {
      hips.add(part(4.5, 14, 5, skin, x, -1, 2));
    });
    /* wings (6 = three pairs), pivot at shoulders */
    var wings = [];
    for (var w = 0; w < 3; w++) {
      [-1, 1].forEach(function (sx) {
        var wp = new THREE.Group();
        wp.position.set(sx * 5, 16 - w * 3.4, -5);
        var m1 = new THREE.Mesh(VC.boxGeo(16, 1.2, 7), VC.mc(0x1a0a10));
        m1.position.set(sx * 8, 0, -2);
        m1.rotation.y = sx * 0.5;
        wp.add(m1);
        for (var f = 0; f < 3; f++) {
          var fm = new THREE.Mesh(VC.boxGeo(12 - f * 3, 0.7, 4.5), VC.mc(0x240a14));
          fm.position.set(sx * (9 + f * 3), -1 - f * 1.4, -3 - f);
          fm.rotation.y = sx * (0.6 + f * 0.2);
          wp.add(fm);
        }
        g.add(wp); wings.push({ p: wp, sx: sx, w: w });
      });
    }
    /* arms */
    var aL = new THREE.Group(), aR = new THREE.Group();
    aL.position.set(-8.2, 16, 0); aR.position.set(8.2, 16, 0);
    aL.add(part(3, 11, 3.4, skin, 0, -5, 0));
    aR.add(part(3, 11, 3.4, skin, 0, -5, 0));
    /* one claw grips a sinner head each side */
    aL.add(part(2.2, 2.2, 2.2, VC.mc(0xc8b8a0), 0, -11, 0.5));
    aR.add(part(2.2, 2.2, 2.2, VC.mc(0xc8b8a0), 0, -11, 0.5));
    hips.add(aL, aR);

    /* three heads */
    var heads = [];
    [-1, 0, 1].forEach(function (c, i) {
      var h = new THREE.Group();
      h.position.set(c * 5.4, 21 + (i === 1 ? 1.6 : 0), 0.5 + (i === 1 ? 0.6 : 0));
      var hcol = i === 1 ? skin : (i === 0 ? VC.mc(0x22111a) : VC.mc(0x1a1214));
      h.add(part(5, 5.4, 4.6, hcol, 0, 0, 0));
      h.add(part(1.6, 2.4, 1, VC.mc(0x120a10), -1.6, 3.6, 0));
      h.add(part(1.6, 2.4, 1, VC.mc(0x120a10), 1.6, 3.6, 0));
      h.add(part(1.4, 0.9, 0.4, eyeM, -1.3, 0.8, 2.3));
      h.add(part(1.4, 0.9, 0.4, eyeM, 1.3, 0.8, 2.3));
      var mouthGlow = VC.glowSprite(i === 1 ? 0xff3020 : 0x4060ff, 4, 0.7);
      mouthGlow.position.set(0, -1.4, 2.4);
      h.add(mouthGlow);
      /* tears of ice */
      h.add(part(0.5, 1.6, 0.3, ice, -1.3, -0.4, 2.35));
      h.add(part(0.5, 1.6, 0.3, ice, 1.3, -0.4, 2.35));
      hips.add(h);
      heads.push({ h: h, phase: i * 2.1, glow: mouthGlow, center: i === 1 });
    });
    /* halo of hellish cold */
    var crown = new THREE.PointLight(0x5070ff, 1.1, 90, 2);
    crown.position.set(0, 24, 6);
    hips.add(crown);
    var redLight = new THREE.PointLight(0xff2810, 2.2, 130, 1.9);
    redLight.position.set(0, 12, 18);
    hips.add(redLight);

    g.position.set(0, VC.LEVELS.SATAN_Y - 6, 0);
    return {
      group: g, hips: hips, heads: heads, wings: wings, aL: aL, aR: aR,
      throne: throne, crown: crown, red: redLight, state: 'idle', tremor: 0,
      tremble: function (k) { this.tremor = k; }
    };
  };

  VC.updateSatan = function (S, dt, t, camPos) {
    var mf = VC.motionFactor();
    var slow = t * 0.55;
    /* wing beat: slow and heavy */
    for (var i = 0; i < S.wings.length; i++) {
      var w = S.wings[i];
      var ph = slow + w.w * 0.5;
      var beat = (Math.sin(ph) * 0.5 + 0.5) * 0.6 + 0.1;
      w.p.rotation.z = w.sx * (-beat) * mf;
      w.p.rotation.y = w.sx * Math.sin(ph + 0.6) * 0.12 * mf;
    }
    /* breathing + tremor */
    var breath = Math.sin(t * 0.8) * 0.01;
    S.hips.scale.set(1 + breath, 1, 1 + breath);
    var tremor = S.tremor * mf;
    S.hips.position.x = Math.sin(t * 33) * 0.35 * tremor;
    S.hips.position.z = Math.cos(t * 29) * 0.3 * tremor;
    S.tremor = VC.damp(S.tremor, 0, 1.2, dt);
    /* heads: centre gazes at camera, others droop/sway */
    for (var hI = 0; hI < S.heads.length; hI++) {
      var hd = S.heads[hI];
      if (hd.center) {
        var v = new THREE.Vector3().subVectors(camPos, S.group.position);
        var yaw = Math.atan2(v.x, v.z);
        var pit = -Math.atan2(v.y - (S.group.position.y + 28), Math.sqrt(v.x * v.x + v.z * v.z));
        hd.h.rotation.y = VC.damp(hd.h.rotation.y, VC.clamp(VC.shortestAngle(0, yaw), -0.7, 0.7), 1.2, dt);
        hd.h.rotation.x = VC.damp(hd.h.rotation.x, VC.clamp(pit, -0.5, 0.5), 1.2, dt);
      } else {
        hd.h.rotation.y = Math.sin(t * 0.4 + hd.phase) * 0.22;
        hd.h.rotation.x = Math.sin(t * 0.3 + hd.phase) * 0.1 + 0.15;
      }
      hd.glow.material.opacity = 0.5 + Math.sin(t * 2 + hd.phase) * 0.2 + S.tremor * 0.4;
    }
    /* arms crush sinners slightly */
    S.aL.rotation.x = Math.sin(t * 1.1) * 0.08 - 0.1;
    S.aR.rotation.x = Math.sin(t * 1.1 + 2) * 0.08 - 0.1;
    S.crown.intensity = 0.9 + Math.sin(t * 1.7) * 0.25 + S.tremor;
    S.red.intensity = 1.9 + Math.sin(t * 7.3) * 0.35 + S.tremor * 2;
    /* throne torches */
    VC.animateFlame(S.throne.userData.flame0, t, 1);
    VC.animateFlame(S.throne.userData.flame1, t, 1);
  };

  /* =====================================================================
   * FIRE DRAGONS
   * ===================================================================== */
  VC.buildDragon = function (rng, opts) {
    opts = opts || {};
    var s = opts.scale || 1;
    var g = new THREE.Group();
    var bodyM = VC.mc(opts.body || 0x2a1512);
    var emberM = VC.emissive(0xff5a10, 1.1);
    var eyeM = VC.emissive(0xffd23a, 1.4);

    var body = new THREE.Group();
    body.add(part(3 * s, 3 * s, 9 * s, bodyM, 0, 0, 0));
    body.add(part(3.4 * s, 1.6 * s, 8 * s, emberM, 0, 1.2 * s, 0));   // glowing spine
    /* neck+head */
    var neck = new THREE.Group(); neck.position.set(0, 1 * s, 4.4 * s);
    neck.add(part(2 * s, 2 * s, 3.4 * s, bodyM, 0, 0.6 * s, 1.4 * s));
    var head = new THREE.Group(); head.position.set(0, 0.7 * s, 3.2 * s);
    head.add(part(2.2 * s, 1.8 * s, 3.4 * s, bodyM, 0, 0, 1.4 * s));
    head.add(part(1.4 * s, 1 * s, 2 * s, bodyM, 0, -0.2 * s, 3.4 * s));
    head.add(part(0.5 * s, 0.4 * s, 0.3 * s, eyeM, -0.7 * s, 0.7 * s, 2.4 * s));
    head.add(part(0.5 * s, 0.4 * s, 0.3 * s, eyeM, 0.7 * s, 0.7 * s, 2.4 * s));
    head.add(part(0.5 * s, 1.6 * s, 0.5 * s, VC.mc(0x120a08), -0.7 * s, 1.5 * s, 0.6 * s));
    head.add(part(0.5 * s, 1.6 * s, 0.5 * s, VC.mc(0x120a08), 0.7 * s, 1.5 * s, 0.6 * s));
    var jaw = new THREE.Group();
    jaw.position.set(0, -0.8 * s, 1.8 * s);
    jaw.add(part(1.3 * s, 0.6 * s, 2.6 * s, VC.mc(0x1a0c0a), 0, -0.2 * s, 1.1 * s));
    var throat = VC.glowSprite(0xff6010, 3 * s, 0);
    throat.position.set(0, 0.1 * s, 2.6 * s);
    jaw.add(throat);
    head.add(jaw);
    var headLight = new THREE.PointLight(0xff5a10, 0, 60 * s, 2);
    head.add(headLight);
    neck.add(head);
    body.add(neck);
    /* tail segments */
    var tailSegs = [];
    var seg = body;
    for (var i = 0; i < 5; i++) {
      var nx = new THREE.Group();
      nx.position.set(0, 0.2 - i * 0.25, -3.2);
      nx.add(part((2.4 - i * 0.35) * s, (2.2 - i * 0.3) * s, 3 * s, bodyM, 0, 0, -1.2 * s));
      nx.add(part((2.5 - i * 0.35) * s, 0.9 * s, 2.4 * s, emberM, 0, (1 - i * 0.12) * s, -1.2 * s));
      seg.add(nx); seg = nx; tailSegs.push(nx);
    }
    /* wings: membrane sections */
    var wings = [];
    [-1, 1].forEach(function (sx) {
      var wp = new THREE.Group();
      wp.position.set(sx * 1.4 * s, 1.6 * s, 0.6 * s);
      for (var b = 0; b < 3; b++) {
        var mem = new THREE.Mesh(
          VC.boxGeo((7 - b * 1.4) * s, 0.24 * s, (4.6 - b * 0.8) * s),
          VC.mc(0x3a1008));
        mem.material.side = THREE.DoubleSide;
        mem.position.set(sx * (3.4 + b * 2.6) * s, (0.6 - b * 0.5) * s, -b * 0.8 * s);
        mem.rotation.y = sx * (0.35 + b * 0.3);
        mem.rotation.z = sx * (0.1 - b * 0.14);
        wp.add(mem);
        var bone = new THREE.Mesh(VC.boxGeo((7.4 - b * 1.4) * s, 0.4 * s, 0.4 * s), VC.mc(0x160a08));
        bone.position.copy(mem.position); bone.position.y += 0.2 * s;
        bone.rotation.copy(mem.rotation);
        wp.add(bone);
      }
      body.add(wp); wings.push({ p: wp, sx: sx });
    });
    /* legs tucked */
    [-1, 1].forEach(function (sx) {
      body.add(part(1 * s, 1.6 * s, 1.2 * s, bodyM, sx * 1.6 * s, -1.8 * s, 1.6 * s));
    });
    g.add(body);
    g.userData.noMerge = true;
    g.visible = false;
    return {
      group: g, body: body, neck: neck, head: head, jaw: jaw, tailSegs: tailSegs,
      wings: wings, throat: throat, headLight: headLight,
      phase: rng.range(0, 6.28), radius: opts.radius || 150, height: opts.height || -14,
      speed: opts.speed || 0.16, fireT: rng.range(0, 5), breathing: 0,
      opts: opts
    };
  };

  VC.updateDragon = function (D, dt, t, camPos, pfield) {
    var mf = VC.motionFactor();
    var a = t * D.speed + D.phase;
    /* circle the abyss (optional bob), face travel direction */
    var bobY = Math.sin(t * 0.5 + D.phase) * 4;
    var r = D.radius + Math.sin(t * 0.23 + D.phase) * 18;
    var px = Math.cos(a) * r, pz = Math.sin(a) * r;
    var py = D.height + bobY;
    D.group.position.set(px, py, pz);
    D.group.rotation.y = -a + Math.PI / 2 + Math.PI;
    D.group.rotation.z = Math.sin(t * 0.5 + D.phase) * 0.12;
    /* wing flap */
    var flap = Math.sin(t * (2.2 + D.speed * 3) + D.phase);
    for (var i = 0; i < D.wings.length; i++) {
      D.wings[i].p.rotation.z = D.wings[i].sx * flap * 0.55 * mf;
    }
    /* tail undulation */
    for (var sI = 0; sI < D.tailSegs.length; sI++) {
      D.tailSegs[sI].rotation.y = Math.sin(t * 2 + sI * 0.9 + D.phase) * 0.18 * mf;
      D.tailSegs[sI].rotation.x = Math.sin(t * 1.5 + sI * 0.6) * 0.07 * mf;
    }
    /* fire breath cycle */
    D.fireT -= dt;
    var near = camPos.distanceTo(D.group.position);
    D.group.visible = near < 520;
    if (D.fireT < 0 && D.fireT > -1.6) {
      D.breathing = VC.clamp((1.6 + D.fireT) / 0.4, 0, 1) * (D.fireT > -1.2 ? 1 : (-D.fireT - 0.4) / 0.8);
      D.jaw.rotation.x = 0.55 * D.breathing;
      D.throat.material.opacity = 0.95 * D.breathing;
      D.headLight.intensity = 3 * D.breathing;
      D.neck.rotation.x = -0.25 * D.breathing;
      if (pfield && D.breathing > 0.3 && (Math.floor(t * 30) % 2 === 0)) {
        var dir = new THREE.Vector3(0, 0, 1).applyQuaternion(D.group.quaternion);
        var o = new THREE.Vector3(0, 0.7, 6).applyQuaternion(D.group.quaternion).add(D.group.position);
        for (var k = 0; k < 4; k++) {
          pfield.spawn(
            o.x + rngJ(), o.y + rngJ() * 0.4, o.z + rngJ(),
            dir.x * 34 + rngJ() * 3, dir.y * 34 - 3 + rngJ() * 2, dir.z * 34 + rngJ() * 3,
            1.3, 4 + Math.random() * 5, 1, 0.42, 0.08);
        }
      }
    } else {
      if (D.fireT < -1.6) D.fireT = rng2(2.5, 6);
      D.breathing = VC.damp(D.breathing, 0, 8, dt);
      D.jaw.rotation.x = VC.damp(D.jaw.rotation.x, 0.04, 6, dt);
      D.throat.material.opacity *= 0.85;
      D.headLight.intensity = VC.damp(D.headLight.intensity, 0.4, 6, dt);
      D.neck.rotation.x = VC.damp(D.neck.rotation.x, 0, 5, dt);
    }
    /* body glow flicker */
    D.body.rotation.x = Math.sin(t * 3.7 + D.phase) * 0.02;
  };
  function rngJ() { return (Math.random() - 0.5) * 2; }
  function rng2(a, b) { return a + Math.random() * (b - a); }

  /* =====================================================================
   * ANGEL helpers (VC.makeHumanoid with wings)
   * ===================================================================== */
  VC.buildAngel = function (opts) {
    opts = opts || {};
    var fig = VC.makeHumanoid({
      robe: true, shirt: opts.shirt || 0xf5f2e8, skin: 0xe8c0a8, hair: opts.hair || 0xe8d8b0,
      halo: true, wings: true, scale: opts.scale || 1.35,
      wingMat: VC.mc(0xffffff)
    });
    if (opts.harp) {
      var harp = VC.makeHarp();
      harp.position.set(0.45, 0.55, 0.5);
      harp.rotation.z = 0.15;
      fig.userData.rig.hips.add(harp);
      fig.userData.harp = harp;
    }
    return {
      group: fig, rig: fig.userData.rig, harp: fig.userData.harp,
      data: { phase: Math.random() * 6.28, pluck: Math.random() * 6 }
    };
  };
  VC.animateAngel = function (A, dt, t, flapAmp) {
    var wings = A.rig.wings;
    if (wings) {
      var f = Math.sin(t * 2.6 + A.data.phase);
      wings[0].rotation.y = f * (flapAmp === undefined ? 0.7 : flapAmp);
      wings[1].rotation.y = -f * (flapAmp === undefined ? 0.7 : flapAmp);
    }
    if (A.harp) {
      A.data.pluck -= dt;
      if (A.data.pluck < 0) A.data.pluck = 0.25 + Math.random() * 0.5;
      var pl = Math.max(0, Math.sin((0.3 - A.data.pluck) * 22));
      A.harp.rotation.x = pl * 0.16;
      A.rig.armL.rotation.x = -0.9 + Math.sin(t * 3.1 + A.data.phase) * 0.18;
      A.rig.armR.rotation.x = -0.7 + Math.cos(t * 3.7 + A.data.phase) * 0.22;
    }
    A.rig.head.rotation.y = Math.sin(t * 0.5 + A.data.phase) * 0.3;
  };
}());
