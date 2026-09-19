/* =========================================================================
 * Voxel Cosmos — stairway.js
 * The luminous stair from Earth's sacred plaza to the Pearly Gates:
 * glowing steps, golden rails, floating platforms, light shafts, cloud
 * banks thickening with altitude, ascending good souls, descending angels.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var part = VC.part;
  var L = VC.LEVELS;

  var rng, stair;
  var stairSouls = [], stairAngels = [];
  var platforms = [], shafts = [], cloudDrifts = [];
  var MAT = {};

  function mats() {
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
  VC.heavenMats = MAT;

  /* stair parametrisation shared with heaven */
  function stairPoint(s) {
    return {
      x: 0,
      y: VC.lerp(L.EARTH_Y + 2, L.STAIR_TOP_Y + 1, s),
      z: VC.lerp(172, 116, s)
    };
  }
  VC.stairPoint = stairPoint;

  VC.buildStairway = function () {
    rng = VC.makeRng(7777);
    stair = VC.realms.stair;
    mats();

    /* --- steps / rails / posts / lamps --- */
    var N = VC.pop(74);
    var steps = new THREE.InstancedMesh(VC.boxGeo(8.2, 0.7, 2.1), MAT.stairGlow, N);
    var rails = new THREE.InstancedMesh(VC.boxGeo(0.5, 0.5, 2.0), MAT.gold, N * 2);
    var posts = new THREE.InstancedMesh(VC.boxGeo(0.34, 1.5, 0.34), MAT.gold, N * 2);
    var lampMat = VC.tmat('stairGlow', 'stairLamp', function () { return VC.emissive(0xfff0c0, 1.1); }, 0x221a08, 0xfff2c8);
    var lamps = new THREE.InstancedMesh(VC.boxGeo(0.7, 0.7, 0.7), lampMat, Math.ceil(N / 4) * 2);
    var d = new THREE.Object3D();
    var iL = 0, i;
    for (i = 0; i < N; i++) {
      var s = i / (N - 1);
      var p = stairPoint(s);
      var lift = Math.sin(s * Math.PI * 3.2) * 1.1;
      var sway = Math.sin(s * Math.PI * 2.1) * 3.4;
      d.position.set(p.x + sway, p.y + lift, p.z);
      d.rotation.set(Math.sin(s * Math.PI * 3.2) * 0.12, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      steps.setMatrixAt(i, d.matrix);
      [-1, 1].forEach(function (sx) {
        var j = i * 2 + (sx > 0 ? 1 : 0);
        d.position.set(p.x + sway + sx * 4.4, p.y + lift + 0.95, p.z);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        rails.setMatrixAt(j, d.matrix);
        d.position.y = p.y + lift + 0.25;
        d.updateMatrix();
        posts.setMatrixAt(j, d.matrix);
      });
      if (i % 4 === 0) {
        [-1, 1].forEach(function (sx) {
          d.position.set(p.x + sway + sx * 4.4, p.y + lift + 1.6, p.z);
          d.updateMatrix();
          lamps.setMatrixAt(iL++, d.matrix);
        });
      }
    }
    lamps.count = iL;
    stair.add(steps, rails, posts, lamps);

    /* support fins */
    for (var sI = 0; sI < N; sI += 6) {
      var sp = stairPoint(sI / (N - 1));
      var fin = new THREE.Mesh(VC.box(1.2, 3.4, 1.2), MAT.gold);
      fin.position.set(sp.x + Math.sin((sI / (N - 1)) * Math.PI * 2.1) * 3.4, sp.y - 2.4, sp.z);
      stair.add(fin);
    }

    /* floating platforms */
    for (var k = 0; k < 6; k++) {
      var s2 = (k + 0.5) / 6;
      var p2 = stairPoint(s2);
      var side = k % 2 ? 1 : -1;
      var plat = new THREE.Group();
      plat.add(new THREE.Mesh(VC.box(6, 1.2, 6), MAT.marble));
      var under = new THREE.Mesh(VC.box(4.6, 1.6, 4.6), VC.cloudMaterial(0xf2f4ff, 0.92));
      under.position.y = -1.3;
      plat.add(under);
      plat.add(part(0.7, 3.2, 0.7, MAT.gold, 0, 2.2, 0));
      var tip = new THREE.Mesh(VC.cone(0.6, 1.2, 4), MAT.gold);
      tip.position.y = 4.2;
      plat.add(tip);
      plat.position.set(p2.x + side * 13, p2.y - 1.5, p2.z + 3);
      plat.userData.noMerge = true;
      stair.add(plat);
      platforms.push({ g: plat, baseY: p2.y - 1.5, ph: k * 1.3 });
    }

    /* light shafts */
    for (var ls = 0; ls < 5; ls++) {
      var p3 = stairPoint((ls + 0.5) / 5);
      var shaft = VC.makeLightShaft(2.5, 7, 40 + ls * 6, 0xfff6d8, 0.16);
      shaft.position.set(p3.x + (ls % 2 ? 9 : -9), p3.y + 16, p3.z);
      stair.add(shaft);
      shafts.push(shaft);
    }

    /* cloud banks */
    var cloudDefs = [
      { y: L.EARTH_Y + 16, r: 12, n: 26 }, { y: 62, r: 14, n: 30 },
      { y: 80, r: 16, n: 34 }, { y: 96, r: 18, n: 40 }
    ];
    cloudDefs.forEach(function (cd, ci) {
      var im = VC.cloudPuffMesh(VC.pop(cd.n), VC.cloudMaterial(ci > 1 ? 0xfffaf0 : 0xf2f6ff, 0.9));
      VC.fillCloudPuffs(im, [
        { x: 0, y: cd.y, z: 150 + ci * 6, r: cd.r },
        { x: 14, y: cd.y - 2, z: 140, r: cd.r * 0.7 },
        { x: -15, y: cd.y + 1, z: 160, r: cd.r * 0.6 }
      ], rng, { puffsPer: Math.ceil(cd.n / 3) });
      stair.add(im);
      cloudDrifts.push({ im: im, spd: 0.05 + ci * 0.02 });
    });

    /* souls & angels */
    for (var sN = 0; sN < VC.pop(12); sN++) {
      var fig = VC.makeHumanoid({ robe: true, shirt: 0xf2f2fa, skin: 0xd8c0b0, hair: 0xd8d0c0, halo: true, scale: 0.95 });
      stair.add(fig);
      stairSouls.push({ g: fig, s: sN / 12, sp: rng.range(0.012, 0.02) });
    }
    for (var a = 0; a < VC.pop(4); a++) {
      var ang = VC.buildAngel({ scale: 1.25, shirt: 0xfaf6e8 });
      stair.add(ang.group);
      stairAngels.push({ ang: ang, s: rng.range(0.2, 0.9), dir: a % 2 ? 1 : -1, ph: rng() * 6.28 });
    }

    VC.addLabel('The Stairway to Heaven', new THREE.Vector3(0, 64, 168), { realm: 'heaven', major: true });

    VC.scene.add(stair);
    VC.registerAnimator(function (t, dt, camPos) {
      var near = Math.abs(camPos.x) < 170 && camPos.z > 55 && camPos.y > 26 && camPos.y < 135;
      var mf = VC.motionFactor();
      var i2;
      for (i2 = 0; i2 < stairSouls.length; i2++) {
        var so = stairSouls[i2];
        so.s += so.sp * dt * mf;
        if (so.s > 1) so.s = 0;
        var ps = stairPoint(so.s);
        var sw = Math.sin(so.s * Math.PI * 2.1) * 3.4;
        so.g.position.set(ps.x + sw + Math.sin(t * 0.8 + i2) * 1.2, ps.y + 0.5 + Math.sin(t * 1.1 + i2 * 2) * 0.4, ps.z + Math.cos(t * 0.6 + i2) * 1.4);
        so.g.rotation.y = Math.sin(t * 0.3 + i2) * 0.4;
        VC.animateWalk(so.g.userData.rig, t, 0.5, 0.6);
        so.g.visible = near && camPos.distanceTo(so.g.position) < 140;
      }
      for (i2 = 0; i2 < stairAngels.length; i2++) {
        var an = stairAngels[i2];
        an.s += an.dir * dt * 0.02 * mf;
        if (an.s > 1) { an.s = 1; an.dir = -1; }
        if (an.s < 0.05) { an.s = 0.05; an.dir = 1; }
        var pa = stairPoint(an.s);
        an.ang.group.position.set(pa.x + Math.sin(t * 0.5 + an.ph) * 6 + 7 * an.dir, pa.y + 5 + Math.sin(t * 0.8 + an.ph) * 1.5, pa.z + Math.cos(t * 0.4 + an.ph) * 4);
        an.ang.group.rotation.y = Math.sin(t * 0.4 + an.ph) * 0.8;
        VC.animateAngel(an.ang, dt, t + an.ph, 0.8);
        an.ang.group.visible = near && camPos.distanceTo(an.ang.group.position) < 150;
      }
      for (i2 = 0; i2 < platforms.length; i2++) {
        var pl = platforms[i2];
        pl.g.position.y = pl.baseY + Math.sin(t * 0.7 + pl.ph) * 0.5;
        pl.g.rotation.y = Math.sin(t * 0.2 + pl.ph) * 0.06;
      }
      for (i2 = 0; i2 < shafts.length; i2++) {
        shafts[i2].material.opacity = 0.12 + Math.sin(t * 0.8 + i2 * 1.7) * 0.05;
      }
      for (i2 = 0; i2 < cloudDrifts.length; i2++) {
        cloudDrifts[i2].im.rotation.y += dt * cloudDrifts[i2].spd * 0.12 * mf;
      }
    }, 'stair');
  };
}());
