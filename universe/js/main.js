/* =========================================================================
 * Voxel Cosmos — main.js
 * Renderer/scene bootstrap, staged procedural world generation behind a
 * progress overlay, quality application, sun-shadow following, star field
 * management, realm-weighted audio mixing and the master frame loop.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  var canvas, renderer, scene, camera, sky, stars = null, controls;
  var frames = 0, fpsT = 0, lastT = 0, tGlobal = 0;
  var seenAnimErr = {};

  function boot() {
    canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, powerPreference: 'high-performance', stencil: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VC.QUALITIES[VC.quality].dprMax));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    VC.renderer = renderer;
    scene = VC.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc4dcf5, 120, 900);

    camera = VC.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.6, 2400);
    camera.position.set(220, 150, 320);

    controls = VC.controls = new VC.VoxelControls(camera, canvas);
    controls.target.set(0, 30, 40);
    controls.syncFromCamera();

    VC.clock = new THREE.Clock();

    /* sky + stars */
    sky = VC.createSkyDome();
    scene.add(sky.mesh);
    VC.sky = sky;

    VC.lights = VC.createLights(scene, sky);

    buildStars();

    /* world */
    scene.add(VC.world);

    VC.boot.add('Seeding the cosmos…', function () { }, 0.2);
    VC.boot.add('Forging the Abyss of Hell…', function () { VC.buildHell(); }, 3);
    VC.boot.add('Enthroning the Guardian of the Gate…', function () { }, 0.2);
    VC.boot.add('Raising Earth: mountains, rivers, seas…', function () { VC.buildEarth(); }, 4);
    VC.boot.add('Building cities, farms and airports…', function () { }, 0.2);
    VC.boot.add('Unfurling the Stairway to Heaven…', function () { VC.buildStairway(); }, 2);
    VC.boot.add('Gathering the clouds of Paradise…', function () { VC.buildHeaven(); }, 3);
    VC.boot.add('Polishing stars and finalising atmospheres…', function () {
      VC.setTimeOfDay('noon');
      VC.ui.init();
    }, 1);
    VC.boot.run(function () {
      /* opening shot: universe overview */
      var d = VC.destById.universe;
      controls.setFrom(new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]), new THREE.Vector3(d.target[0], d.target[1], d.target[2]));
      VC.nav.current = d;
      var load = document.getElementById('loading');
      load.classList.add('done');
      setTimeout(function () { load.style.display = 'none'; }, 1000);
      VC.ui.showDestination('universe');
      lastT = performance.now();
      renderer.setAnimationLoop(frame);
    });

    window.addEventListener('resize', onResize);
  }

  function buildStars() {
    if (stars) { scene.remove(stars); stars.geometry.dispose(); }
    var n = VC.QUALITIES[VC.quality].starCount;
    stars = VC.makeStars(n, 900, new THREE.Vector3(0, 140, 90));
    scene.add(stars);
    VC.stars = stars;
  }

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VC.QUALITIES[VC.quality].dprMax));
    renderer.setSize(w, h, false);
  }

  /* per-frame quality application (pixel ratio / shadows / star count) */
  var curQ = null;
  function applyQuality() {
    var q = VC.QUALITIES[VC.quality];
    if (curQ === VC.quality) return;
    curQ = VC.quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dprMax));
    renderer.shadowMap.enabled = q.shadows;
    if (VC.lights) {
      VC.lights.sun.castShadow = q.shadows;
      if (VC.lights.sun.shadow.mapSize.x !== q.shadowSize) {
        VC.lights.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (VC.lights.sun.shadow.map) { VC.lights.sun.shadow.map.dispose(); VC.lights.sun.shadow.map = null; }
      }
    }
    buildStars();
    scene.traverse(function (o) { if (o.material) o.material.needsUpdate = false; });
  }
  VC.applyQuality = applyQuality;

  /* sun shadow follows camera for crisp local shadows */
  function updateShadow() {
    if (!VC.lights || !VC.lights.sun.castShadow) return;
    VC.lights.sunT.copy(VC.controls.target);
  }

  /* realm weights for audio mix + pill */
  var audioTickT = 0;
  function audioTick(dt) {
    if (!VC.audio.on) return;
    audioTickT += dt;
    if (audioTickT < 0.35) return;
    audioTickT = 0;
    var y = VC.camera.position.y;
    var hv = VC.clamp((y - 92) / 20, 0, 1);
    var hl = VC.clamp((6 - y) / 14, 0, 1);
    var e = Math.max(0, 1 - hv - hl);
    VC.audio.setRealmWeights({ hell: hl, earth: e, heaven: hv });
  }

  function frame() {
    var now = performance.now();
    /* rawDt ≈ wall-clock time between frames; dt is clamped for particle &
       physics stability. Guided camera flights and the tour step on rawDt so
       they finish on schedule even on very slow (software) renderers. */
    var rawDt = Math.min(2.0, Math.max(0.0005, (now - lastT) / 1000));
    var dt = Math.min(0.05, rawDt);
    lastT = now;
    tGlobal += dt;

    applyQuality();
    updateShadow();

    /* camera first: world animators read the finished camera */
    if (VC.flight.active) VC.nav.step(rawDt);
    else if (!VC.tour.active) controls.update(dt);
    else { VC.tourStep(rawDt); if (!VC.flight.active) controls.update(dt * 0.0); }

    if (VC.tour.active && !VC.tour.paused) VC.ui && $('tour-progress-fill') &&
      ($('tour-progress-fill').style.width = Math.round(VC.tourProgress() * 100) + '%');
    if (VC.tourRiteActive()) VC.tourRiteStep(rawDt);

    for (var i = 0; i < VC.animators.length; i++) {
      var a = VC.animators[i];
      try {
        a.fn(tGlobal, dt, VC.camera.position);
      } catch (e) {
        var k = '' + e.message;
        if (!seenAnimErr[k]) { seenAnimErr[k] = 1; console.error('animator error:', e); }
      }
    }

    VC.updateTimeOfDay(dt, VC.camera.position.y);
    VC.updateLabels();
    audioTick(dt);

    /* realm pill */
    if (VC.ui && VC.ui.updateRealmPill) VC.ui.updateRealmPill(VC.realmAt(VC.camera.position.y, VC.camera.position.z));

    renderer.render(scene, camera);

    /* fps */
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      var f = document.getElementById('fps');
      if (f && !f.classList.contains('hidden')) {
        f.textContent = Math.round(frames / fpsT) + ' FPS · ' + renderer.info.render.calls + ' draws';
      }
      frames = 0; fpsT = 0;
    }
  }

  /* small helper for the tour progress bar */
  function $id(id) { return document.getElementById(id); }
  var $ = $id;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
}());
