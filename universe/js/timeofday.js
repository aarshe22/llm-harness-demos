/* =========================================================================
 * Voxel Cosmos — timeofday.js
 * Morning / Noon / Dusk / Night. One interpolated "atmosphere" object drives:
 * sky dome, fog (realm-aware), sun+moon lights and meshes, stars, window and
 * streetlight emissives, stairway/pearl/castle glow, hell glow, water sun.
 * Transitions animate smoothly.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  /* Each preset: all values lerpable. Realm fog separate for blending. */
  VC.TIME_PRESETS = {
    morning: {
      skyTop: 0x5a86c8, skyBottom: 0xffd9b8, sunColor: 0xffd9a8, sunI: 1.05,
      sunAz: 95, sunEl: 22, hemiSky: 0x9fb8e0, hemiGround: 0x5a4a3a, hemiI: 0.75,
      ambI: 0.34, star: 0.06, night: 0.06, cloudTint: 0xffe2c8, waterSun: 0.9,
      hellGlow: 1.0, stairGlow: 0.55, pearlGlow: 0.6, castleGlow: 0.6, windowsN: 0.15,
      earthFog: { c: 0xd8e4f2, near: 1.0, far: 860 },
      heavenFog: { c: 0xdceaff, near: 1.3, far: 950 },
      hellFog: { c: 0x1a0805, near: 1.1, far: 330 }
    },
    noon: {
      skyTop: 0x3d7ad0, skyBottom: 0xbfdfff, sunColor: 0xfff6dc, sunI: 1.35,
      sunAz: 20, sunEl: 62, hemiSky: 0xbcd4f0, hemiGround: 0x6a6a55, hemiI: 0.85,
      ambI: 0.42, star: 0.0, night: 0.0, cloudTint: 0xffffff, waterSun: 1.15,
      hellGlow: 0.92, stairGlow: 0.5, pearlGlow: 0.55, castleGlow: 0.55, windowsN: 0.0,
      earthFog: { c: 0xc4dcf5, near: 1.15, far: 900 },
      heavenFog: { c: 0xd8e8ff, near: 1.4, far: 1000 },
      hellFog: { c: 0x190705, near: 1.05, far: 320 }
    },
    dusk: {
      skyTop: 0x2a2a6a, skyBottom: 0xff7a3d, sunColor: 0xff8a4a, sunI: 0.85,
      sunAz: 262, sunEl: 6, hemiSky: 0x6a5a9a, hemiGround: 0x4a2a1a, hemiI: 0.6,
      ambI: 0.3, star: 0.35, night: 0.42, cloudTint: 0xffb088, waterSun: 0.75,
      hellGlow: 1.25, stairGlow: 0.85, pearlGlow: 0.9, castleGlow: 0.9, windowsN: 0.75,
      earthFog: { c: 0x8a5a6a, near: 0.85, far: 620 },
      heavenFog: { c: 0xffc8a8, near: 1.15, far: 780 },
      hellFog: { c: 0x220a06, near: 1.0, far: 280 }
    },
    night: {
      skyTop: 0x020212, skyBottom: 0x0a1030, sunColor: 0x8aa0ff, sunI: 0.28,
      sunAz: 200, sunEl: 48, hemiSky: 0x222a50, hemiGround: 0x0a0a12, hemiI: 0.4,
      ambI: 0.18, star: 1.0, night: 1.0, cloudTint: 0x5a6a9a, waterSun: 0.22,
      hellGlow: 1.55, stairGlow: 1.25, pearlGlow: 1.3, castleGlow: 1.35, windowsN: 1.0,
      earthFog: { c: 0x070a18, near: 0.9, far: 430 },
      heavenFog: { c: 0x1a2450, near: 1.15, far: 620 },
      hellFog: { c: 0x120404, near: 1.0, far: 250 }
    }
  };

  function clonePreset(p) {
    return {
      skyTop: new THREE.Color(p.skyTop), skyBottom: new THREE.Color(p.skyBottom),
      sunColor: new THREE.Color(p.sunColor), sunI: p.sunI,
      sunAz: p.sunAz * Math.PI / 180, sunEl: p.sunEl * Math.PI / 180,
      hemiSky: new THREE.Color(p.hemiSky), hemiGround: new THREE.Color(p.hemiGround), hemiI: p.hemiI,
      ambI: p.ambI, star: p.star, night: p.night, cloudTint: new THREE.Color(p.cloudTint),
      waterSun: p.waterSun, hellGlow: p.hellGlow, stairGlow: p.stairGlow, pearlGlow: p.pearlGlow,
      castleGlow: p.castleGlow, windowsN: p.windowsN,
      earthFog: { c: new THREE.Color(p.earthFog.c), near: p.earthFog.near, far: p.earthFog.far },
      heavenFog: { c: new THREE.Color(p.heavenFog.c), near: p.heavenFog.near, far: p.heavenFog.far },
      hellFog: { c: new THREE.Color(p.hellFog.c), near: p.hellFog.near, far: p.hellFog.far }
    };
  }
  function copyInto(dst, src) {
    dst.skyTop.copy(src.skyTop); dst.skyBottom.copy(src.skyBottom);
    dst.sunColor.copy(src.sunColor); dst.sunI = src.sunI;
    dst.sunAz = src.sunAz; dst.sunEl = src.sunEl;
    dst.hemiSky.copy(src.hemiSky); dst.hemiGround.copy(src.hemiGround); dst.hemiI = src.hemiI;
    dst.ambI = src.ambI; dst.star = src.star; dst.night = src.night;
    dst.cloudTint.copy(src.cloudTint); dst.waterSun = src.waterSun;
    dst.hellGlow = src.hellGlow; dst.stairGlow = src.stairGlow; dst.pearlGlow = src.pearlGlow;
    dst.castleGlow = src.castleGlow; dst.windowsN = src.windowsN;
    dst.earthFog.c.copy(src.earthFog.c); dst.earthFog.near = src.earthFog.near; dst.earthFog.far = src.earthFog.far;
    dst.heavenFog.c.copy(src.heavenFog.c); dst.heavenFog.near = src.heavenFog.near; dst.heavenFog.far = src.heavenFog.far;
    dst.hellFog.c.copy(src.hellFog.c); dst.hellFog.near = src.hellFog.near; dst.hellFog.far = src.hellFog.far;
  }
  function lerpInto(dst, src, k) {
    dst.skyTop.lerp(src.skyTop, k); dst.skyBottom.lerp(src.skyBottom, k);
    dst.sunColor.lerp(src.sunColor, k); dst.sunI = VC.lerp(dst.sunI, src.sunI, k);
    dst.sunAz += VC.shortestAngle(dst.sunAz, src.sunAz) * k; dst.sunEl = VC.lerp(dst.sunEl, src.sunEl, k);
    dst.hemiSky.lerp(src.hemiSky, k); dst.hemiGround.lerp(src.hemiGround, k); dst.hemiI = VC.lerp(dst.hemiI, src.hemiI, k);
    dst.ambI = VC.lerp(dst.ambI, src.ambI, k); dst.star = VC.lerp(dst.star, src.star, k);
    dst.night = VC.lerp(dst.night, src.night, k); dst.cloudTint.lerp(src.cloudTint, k);
    dst.waterSun = VC.lerp(dst.waterSun, src.waterSun, k);
    dst.hellGlow = VC.lerp(dst.hellGlow, src.hellGlow, k);
    dst.stairGlow = VC.lerp(dst.stairGlow, src.stairGlow, k);
    dst.pearlGlow = VC.lerp(dst.pearlGlow, src.pearlGlow, k);
    dst.castleGlow = VC.lerp(dst.castleGlow, src.castleGlow, k);
    dst.windowsN = VC.lerp(dst.windowsN, src.windowsN, k);
    dst.earthFog.c.lerp(src.earthFog.c, k); dst.earthFog.near = VC.lerp(dst.earthFog.near, src.earthFog.near, k);
    dst.earthFog.far = VC.lerp(dst.earthFog.far, src.earthFog.far, k);
    dst.heavenFog.c.lerp(src.heavenFog.c, k); dst.heavenFog.near = VC.lerp(dst.heavenFog.near, src.heavenFog.near, k);
    dst.heavenFog.far = VC.lerp(dst.heavenFog.far, src.heavenFog.far, k);
    dst.hellFog.c.lerp(src.hellFog.c, k); dst.hellFog.near = VC.lerp(dst.hellFog.near, src.hellFog.near, k);
    dst.hellFog.far = VC.lerp(dst.hellFog.far, src.hellFog.far, k);
  }

  VC.time = {
    id: 'noon',
    cur: clonePreset(VC.TIME_PRESETS.noon),
    target: clonePreset(VC.TIME_PRESETS.noon)
  };
  VC.setTimeOfDay = function (id) {
    if (!VC.TIME_PRESETS[id]) return;
    VC.time.id = id;
    VC.time.target = clonePreset(VC.TIME_PRESETS[id]);
    VC.emit('timeOfDay', id);
  };

  /* ---- scene lights ---- */
  VC.createLights = function (scene, sky) {
    var L = {};
    L.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(L.ambient);
    L.hemi = new THREE.HemisphereLight(0xbcd4f0, 0x6a6a55, 0.85);
    scene.add(L.hemi);
    L.sun = new THREE.DirectionalLight(0xffffff, 1.3);
    L.sun.castShadow = true;
    L.sun.shadow.mapSize.set(2048, 2048);
    var sc = L.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.near = 1; sc.far = 900;
    L.sun.shadow.bias = -0.0006;
    scene.add(L.sun);
    scene.add(L.sun.target);
    L.sunT = new THREE.Vector3(0, VC.LEVELS.EARTH_Y, 0);
    L.sun.target.position.copy(L.sunT);

    /* visible sun & moon meshes parented to the sky dome (follows camera) */
    L.sunMesh = new THREE.Group();
    var sunCore = new THREE.Mesh(VC.sphereGeo(16, 10, 8), VC.basic(0xfff2b0));
    sunCore.material.fog = false;
    L.sunMesh.add(sunCore);
    var glow = VC.glowSprite(0xffd27a, 90, 0.8); glow.material.fog = false;
    L.sunMesh.add(glow);
    for (var i = 0; i < 8; i++) {
      var ray = new THREE.Mesh(VC.box(3, 26, 3), VC.basic(0xffe9a0, 0.55, true));
      var a = i / 8 * Math.PI * 2;
      ray.position.set(Math.cos(a) * 24, Math.sin(a) * 24, 0);
      ray.rotation.z = a;
      L.sunMesh.add(ray);
    }
    sky.mesh.add(L.sunMesh);

    L.moonMesh = new THREE.Group();
    var moonCore = new THREE.Mesh(VC.sphereGeo(11, 8, 6), VC.basic(0xdde4ff));
    L.moonMesh.add(moonCore);
    for (var c = 0; c < 5; c++) {
      var cr = new THREE.Mesh(VC.box(3, 1.6, 3), VC.basic(0xaab0d8));
      var ca = c / 5 * Math.PI * 2;
      cr.position.set(Math.cos(ca) * 6, Math.sin(ca) * 5, 8);
      L.moonMesh.add(cr);
    }
    var mg = VC.glowSprite(0xaab8ff, 52, 0.55);
    L.moonMesh.add(mg);
    sky.mesh.add(L.moonMesh);

    /* realm fill lights so each realm reads correctly whatever the sun does */
    L.hellFill = new THREE.PointLight(0xff4414, 1.4, 320, 1.8);
    L.hellFill.position.set(0, -26, 0);
    scene.add(L.hellFill);
    L.hellLow = new THREE.PointLight(0xff6a20, 1.1, 260, 2);
    L.hellLow.position.set(0, -58, 0);
    scene.add(L.hellLow);
    L.heavenFill = new THREE.PointLight(0xfff4d0, 1.15, 300, 1.7);
    L.heavenFill.position.set(0, VC.LEVELS.HEAVEN_BASE_Y + 18, 0);
    scene.add(L.heavenFill);
    L.heavenTop = new THREE.DirectionalLight(0xfff8e8, 0.55);
    L.heavenTop.position.set(0, VC.LEVELS.CASTLE_Y + 80, 40);
    L.heavenTop.target.position.set(0, VC.LEVELS.CASTLE_Y, 0);
    scene.add(L.heavenTop, L.heavenTop.target);
    return L;
  };

  var tmpFogColor = new THREE.Color();
  var _black = new THREE.Color(0, 0, 0);
  var _c = new THREE.Color();

  /* Per-frame: interpolate, apply to everything. */
  VC.updateTimeOfDay = function (dt, camY) {
    var T = VC.time, k = 1 - Math.exp(-dt * 1.15);
    lerpInto(T.cur, T.target, k);
    var c = T.cur;
    var L = VC.lights, sky = VC.sky, scene = VC.scene;
    if (!L || !sky) return;

    /* lights */
    L.ambient.intensity = c.ambI;
    L.hemi.intensity = c.hemiI;
    L.hemi.color.copy(c.hemiSky); L.hemi.groundColor.copy(c.hemiGround);
    L.sun.color.copy(c.sunColor);
    L.sun.intensity = c.sunI;
    var sd = new THREE.Vector3(
      Math.cos(c.sunEl) * Math.cos(c.sunAz),
      Math.sin(c.sunEl),
      Math.cos(c.sunEl) * Math.sin(c.sunAz));
    L.sun.position.copy(L.sunT).addScaledVector(sd, 420);
    L.sun.target.position.copy(L.sunT);
    /* night moonlight */
    L.moonMesh.position.set(
      Math.cos(c.sunEl + Math.PI) * 0.9, Math.abs(Math.sin(c.sunEl)) * 0.6 + 0.4, Math.sin(c.sunEl + Math.PI)).multiplyScalar(520);
    L.sunMesh.position.copy(sd).multiplyScalar(540);
    L.sunMesh.rotation.z += dt * 0.05;
    L.sunMesh.visible = sd.y > -0.15;
    L.moonMesh.visible = c.night > 0.05;

    /* sky dome */
    sky.uniforms.uTop.value.copy(c.skyTop);
    sky.uniforms.uBottom.value.copy(c.skyBottom);
    sky.uniforms.uSunDir.value.copy(sd);
    sky.uniforms.uSunColor.value.copy(c.sunColor);
    sky.uniforms.uSunGlow.value = VC.lerp(0.5, 1.15, c.sunI / 1.35);
    sky.uniforms.uNight.value = c.star;

    /* realm-blended fog */
    var hW = VC.clamp((VC.LEVELS.CIRCLE_TOP_Y + 6 - camY) / 14, 0, 1);           // 1 deep in hell
    var hvW = VC.clamp((camY - (VC.LEVELS.STAIR_TOP_Y - 12)) / 16, 0, 1);         // 1 in heaven
    var eW = Math.max(0, 1 - hW - hvW);
    var f = scene.fog;
    tmpFogColor.setRGB(0, 0, 0);
    tmpFogColor.add(_c.copy(c.hellFog.c).multiplyScalar(hW));
    tmpFogColor.add(_c.copy(c.heavenFog.c).multiplyScalar(hvW));
    tmpFogColor.add(_c.copy(c.earthFog.c).multiplyScalar(eW));
    var near = c.hellFog.near * hW + c.heavenFog.near * hvW + c.earthFog.near * eW;
    var far = c.hellFog.far * hW + c.heavenFog.far * hvW + c.earthFog.far * eW;
    f.color.copy(tmpFogColor);
    var q = VC.QUALITIES[VC.quality];
    f.near = Math.max(4, (camY < 12 ? q.fogNear * 0.8 : q.fogNear * 0.9) * near * 0.9);
    f.far = far;
    VC.scene.background && VC.scene.background.isColor && VC.scene.background.copy(f.color);

    /* shader registry */
    for (var i = 0; i < VC.shaders.length; i++) {
      var m = VC.shaders[i], u = m.uniforms;
      if (u.uTime !== undefined) u.uTime.value += dt;
      if (u.uSunDir) u.uSunDir.value.copy(sd);
      if (u.uSunI !== undefined) u.uSunI.value = c.waterSun;
      if (u.uGlow !== undefined && u.uColB) u.uGlow.value = c.hellGlow;
      if (u.uNight !== undefined) u.uNight.value = c.star;
      if (u.uOpacity !== undefined && m.userData.type === 'stars') u.uOpacity.value = c.star;
      if (u.uGlow !== undefined && m.userData.type === 'energy') u.uGlow.value = VC.lerp(0.85, 1.6, c.night);
      if (u.uFogColor) {
        u.uFogColor.value.copy(f.color);
        u.uFogNear.value = f.near;
        u.uFogFar.value = f.far * (m.userData.type === 'lava' ? 0.75 : 0.9);
      }
    }

    /* registered time materials (windows, streetlamps, runway, stair glow...) */
    var nW = c.windowsN;
    applySlot(VC.timeMats.windowsWarm, nW, null);
    applySlot(VC.timeMats.streetGlow, nW, null);
    applySlot(VC.timeMats.runway, Math.max(nW * 0.9, c.night), null);
    applySlot(VC.timeMats.stairGlow, c.stairGlow * 0.8, null);
    applySlot(VC.timeMats.pearlGlow, c.pearlGlow * 0.8, null);
    applySlot(VC.timeMats.castleGlow, c.castleGlow * 0.75, null);
    applySlot(VC.timeMats.hellGlow, c.hellGlow * 0.9, null);
    if (VC.timeMats.nightTinted) applySlot(VC.timeMats.nightTinted, VC.lerp(0.2, 0.8, c.windowsN), null);

    /* cloud tint */
    if (VC._cloudMats) {
      for (var j = 0; j < VC._cloudMats.length; j++) {
        VC._cloudMats[j].color.lerp(c.cloudTint, 0.6);
      }
    }

    /* realm fills react to night for contrast */
    L.hellFill.intensity = 1.2 + c.hellGlow * 0.8;
    L.hellLow.intensity = 0.9 + c.hellGlow * 0.7;
    L.heavenFill.intensity = 0.9 + c.pearlGlow * 0.35;
    L.heavenTop.intensity = 0.45 + (1 - c.night) * 0.3;

    VC.emit('timeValues', c);
  };

  function applySlot(arr, level) {
    for (var i = 0; i < arr.length; i++) {
      var m = arr[i];
      var lvl = VC.clamp(level, 0, 1) * (m.userData.maxLevel || 1);
      if (m.emissive) {
        m.emissive.copy(m.userData.dayEm || _black).lerp(m.userData.nightEm, lvl);
      }
      if (m.userData.boostColor && m.color) {
        m.color.copy(m.userData.baseColor).lerp(_c.copy(m.userData.nightEm).multiplyScalar(1.2), lvl * 0.4);
      }
    }
  }
}());
