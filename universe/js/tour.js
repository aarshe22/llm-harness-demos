/* =========================================================================
 * Voxel Cosmos — tour.js
 * Special destination sequences (Cerberus gate rite, Saint Peter rite) and
 * the automatic tour: a genuine cinematic sequence of flight legs, waits and
 * scripted events across the whole universe with pause / resume / skip /
 * stop. The tour always regains clean manual control when stopped.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  /* =====================================================================
   * SPECIAL SEQUENCES (also used inside the tour)
   * ===================================================================== */
  function cerberusSequence(done) {
    var C = VC.animated.cerberus, gate = VC.hell ? VC.hell.gate : null;
    var steps = [
      /* approach in front of Cerberus */
      { leg: { pos: [0, 20, -70], target: [0, 16, -99] }, dur: 4.2, at0: function () { VC.ui.toast('You stand before the Gates of Hell…'); } },
      /* wait: heads track you; barks */
      { wait: 3.0, at0: function () { if (C) C.triggerLunge(); } },
      /* closer, menacing */
      { leg: { pos: [0, 17, -84], target: [0, 18, -99] }, dur: 2.6 },
      /* THE ROAR */
      { wait: 0.2, at0: function () {
        if (C) C.triggerRoar(4.2);
        VC.ui.toast('CERBERUS ROARS — the three throats of Hell!');
      } },
      { wait: 3.4 },
      /* gates grind open */
      { wait: 0.1, at0: function () {
        if (gate) gate.setOpen(true, 2.6);
        VC.ui.toast('The Gates of Hell swing wide.');
      } },
      { leg: { pos: [0, 15, -92], target: [0, 12, -118] }, dur: 2.6 },
      /* pass between the pillars into Limbo */
      { leg: { pos: [0, 6, -126], target: [0, 0, -90] }, dur: 3.6, at0: function () { VC.ui.toast('You descend into Limbo. All hope… abandoned.'); } },
      { wait: 1.6 }
    ];
    runSteps(steps, function () {
      VC.ui.showDestination('circle1');
      if (done) done();
    });
  }

  function peterSequence(done) {
    var P = VC.animated.peter, gates = VC.animated.gates.pearl;
    var steps = [
      { leg: { pos: [0, 120, 138], target: [0, 113, 110] }, dur: 4.0, at0: function () { VC.ui.toast('Saint Peter looks up from the Book of Life…'); } },
      { wait: 0.3, at0: function () { if (P) P.greet(); if (VC.audio) VC.audio.peterBell(); } },
      { wait: 2.2, at0: function () { VC.ui.toast('“Well done, good and faithful servant. Enter.”'); } },
      { wait: 1.4, at0: function () { if (P) P.raiseKeys(3); } },
      { wait: 2.0 },
      { wait: 0.1, at0: function () { if (gates) gates.setOpen(true, 3.0); if (VC.audio) VC.audio.pearlGateOpen(); VC.ui.toast('The Pearly Gates open upon the celestial avenue.'); } },
      { leg: { pos: [0, 114, 116], target: [0, 112, 80] }, dur: 3.0 },
      /* fly through the gate toward the castle */
      { leg: { pos: [0, 116, 86], target: [0, 120, 250] }, dur: 4.2, at0: function () { VC.ui.showDestination('castle'); } },
      { wait: 1.8 }
    ];
    runSteps(steps, function () {
      if (done) done();
    });
  }

  /* generic mini sequencer for special rites */
  var rite = { active: false, steps: [], i: 0, t: 0, done: null };
  function runSteps(steps, done) {
    rite.active = true;
    rite.steps = steps; rite.i = -1; rite.t = 0; rite.done = done;
    nextStep();
    VC.controls.enabled = false;
  }
  function nextStep() {
    rite.i++;
    if (rite.i >= rite.steps.length) {
      rite.active = false;
      VC.controls.enabled = true;
      VC.controls.setFrom(VC.camera.position, VC.controls.target);
      var d = rite.done; rite.done = null;
      if (d) d();
      return;
    }
    var st = rite.steps[rite.i];
    rite.t = 0;
    if (st.at0) st.at0();
    if (st.leg) {
      try {
        VC.nav.flyTo(st.leg.target ? { target: st.leg.target, pos: st.leg.pos } : st.leg,
          { speedMul: 1, tour: true });
      } catch (e) { console.error('rite leg failed', e); }
      if (!VC.flight.active) {
        VC.controls.setFrom(new THREE.Vector3(st.leg.pos[0], st.leg.pos[1], st.leg.pos[2]),
          new THREE.Vector3(st.leg.target[0], st.leg.target[1], st.leg.target[2]));
      }
    }
  }
  VC.tourRiteStep = function (dt) {
    if (!rite.active) return;
    var st = rite.steps[rite.i];
    if (!st) return;
    rite.t += dt;
    if (st.leg) {
      if (!VC.flight.active && rite.t > 0.3) nextStep();
    } else if (rite.t >= st.wait) {
      nextStep();
    }
  };
  VC.tourRiteActive = function () { return rite.active; };

  /* =====================================================================
   * THE AUTOMATIC TOUR
   * ===================================================================== */
  var tour = {
    active: false, paused: false, steps: [], i: -1, t: 0, speed: 1,
    _savedDest: null
  };
  VC.tour = tour;

  function legTour(id, opts) {
    var d = VC.destById[id];
    if (!d) return null;
    return { kind: 'leg', id: id, dur: (opts && opts.dur) || 3.4, hold: (opts && opts.hold) || 2.0,
      speedMul: (opts && opts.speedMul) || 1 };
  }
  function waitTour(sec) { return { kind: 'wait', wait: sec }; }
  function actTour(fn) { return { kind: 'act', fn: fn }; }

  VC.tourBuild = function () {
    var S = [];
    S.push({ kind: 'leg', id: 'universe', dur: 5, hold: 3.5 });
    /* --- Hell --- */
    S.push({ kind: 'leg', id: 'cerberus', dur: 5, hold: 1.6 });
    S.push(actTour(function () {
      if (VC.audio) VC.audio.cerberusRoar();
      if (VC.animated.cerberus) VC.animated.cerberus.triggerRoar(4);
      VC.ui.toast('CERBERUS ROARS as you approach the Gates!');
    }));
    S.push(waitTour(2.2));
    S.push(actTour(function () {
      var g = VC.hell.gate; if (g) g.setOpen(true, 2.6);
      if (VC.audio) VC.audio.hellGateOpen();
      VC.ui.toast('The Gates of Hell grind open.');
    }));
    S.push(waitTour(1.6));
    VC.CIRCLES.forEach(function (c, i) {
      S.push({ kind: 'leg', id: 'circle' + c.n, dur: 3.6, hold: 3.0 });
      if (c.n === 1) S.push(actTour(function () {
        var ch = VC.hell.charon;
        if (ch) ch.userData.tour = true;
      }));
    });
    S.push({ kind: 'leg', id: 'acheron', dur: 3.2, hold: 2.4 });
    S.push({ kind: 'leg', id: 'satan', dur: 4.6, hold: 4.0 });
    S.push(actTour(function () {
      if (VC.animated.satan) VC.animated.satan.tremble(1.4);
      VC.ui.toast('The ground of the world trembles beneath his wings.');
    }));
    S.push(waitTour(1.4));
    /* --- rise to Earth --- */
    S.push({ kind: 'leg', id: 'earth', dur: 6, hold: 3.0 });
    S.push(actTour(function () { VC.ui.toast('Up from the abyss — the world of the living.'); }));
    var earthStops = ['city', 'oldtown', 'bridge', 'forest', 'waterfall', 'farm', 'windmill', 'volcano', 'peaks', 'apark', 'tower', 'balloon', 'heli'];
    earthStops.forEach(function (id) {
      S.push({ kind: 'leg', id: id, dur: 3.2, hold: 2.2 });
    });
    /* --- stairway --- */
    S.push({ kind: 'leg', id: 'stairfoot', dur: 3.4, hold: 2.2 });
    S.push({ kind: 'leg', id: 'stairmid', dur: 4.6, hold: 2.6 });
    /* --- Peter --- */
    S.push({ kind: 'leg', id: 'pearl', dur: 4.4, hold: 1.2 });
    S.push(actTour(function () {
      if (VC.animated.peter) VC.animated.peter.greet();
      if (VC.audio) VC.audio.peterBell();
      VC.ui.toast('“Venite, benedicti Patris mei.” — Saint Peter welcomes you.');
    }));
    S.push(waitTour(2.0));
    S.push(actTour(function () {
      if (VC.animated.peter) VC.animated.peter.raiseKeys(3);
    }));
    S.push(waitTour(1.8));
    S.push(actTour(function () {
      var g = VC.animated.gates.pearl; if (g) g.setOpen(true, 3);
      if (VC.audio) VC.audio.pearlGateOpen();
      VC.ui.toast('The Pearly Gates open — behold the Kingdom of Heaven.');
    }));
    S.push(waitTour(1.2));
    /* --- Heaven --- */
    ['orchestra', 'gardens', 'fountain', 'hall', 'castle', 'courtyard', 'throne', 'overlook'].forEach(function (id) {
      S.push({ kind: 'leg', id: id, dur: 3.2, hold: 2.4 });
    });
    S.push({ kind: 'leg', id: 'finale', dur: 6, hold: 6 });
    S.push(actTour(function () { VC.ui.toast('One cosmos. All the way down — all the way up. The tour is complete.'); }));
    return S;
  };

  var builtSteps = null;

  VC.tourStart = function () {
    if (tour.active) { VC.tourStop(); return; }
    if (!builtSteps) builtSteps = VC.tourBuild();
    tour.steps = builtSteps.slice();
    tour.i = -1; tour.t = 0; tour.active = true; tour.paused = false;
    VC.ui.tourStarted();
    nextTourStep();
  };
  VC.tourPause = function () { tour.paused = !tour.paused; VC.ui.tourPaused(tour.paused); };
  VC.tourSkip = function () {
    if (!tour.active) return;
    var st = tour.steps[tour.i];
    if (!st) return;
    if (st.kind === 'leg') {
      var d = VC.destById[st.id];
      if (d) {
        VC.nav.stop();
        VC.nav.flyTo(d, { speedMul: 0.22, tour: true });
      }
      tour.t = st.dur + st.hold - 0.2;
    } else {
      tour.t = 1e9;
    }
  };
  VC.tourStop = function () {
    tour.active = false; tour.paused = false;
    rite.active = false; rite.done = null;
    VC.nav.stop();
    VC.controls.enabled = true;
    VC.controls.setFrom(VC.camera.position, VC.controls.target);
    VC.ui.tourStopped();
  };

  function nextTourStep() {
    tour.i++;
    if (tour.i >= tour.steps.length) {
      VC.tourStop();
      return;
    }
    tour.t = 0;
    var st = tour.steps[tour.i];
    if (st.kind === 'leg') {
      var d = VC.destById[st.id];
      if (!d) { nextTourStep(); return; }
      try {
        VC.nav.flyTo(d, { speedMul: st.speedMul * (d.id === 'universe' ? 1.1 : 1), tour: true });
      } catch (e) { console.error('tour leg failed', e); }
      if (!VC.flight.active) {
        VC.controls.setFrom(new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]),
          new THREE.Vector3(d.target[0], d.target[1], d.target[2]));
      }
      VC.ui.showDestination(st.id);
    } else if (st.kind === 'act') {
      try { st.fn(); } catch (e) { console.error(e); }
    }
  }

  VC.tourStep = function (dt) {
    if (!tour.active) return;
    if (tour.paused) return;
    tour.t += dt;
    var st = tour.steps[tour.i];
    if (!st) return;
    if (st.kind === 'leg') {
      if (!VC.flight.active && tour.t >= st.dur + st.hold) nextTourStep();
      else if (VC.flight.active && tour.t > st.dur + 8) { nextTourStep(); } /* stuck guard */
      else if (!VC.flight.active && tour.t >= st.dur && tour.t < st.dur + st.hold) { /* holding */ }
    } else if (st.kind === 'wait') {
      if (tour.t >= st.wait) nextTourStep();
    } else if (st.kind === 'act') {
      if (tour.t > 0.1) nextTourStep();
    }
  };
  VC.tourProgress = function () {
    if (!tour.active || !tour.steps.length) return 0;
    return (tour.i + Math.min(1, tour.t / 6)) / tour.steps.length;
  };

  /* ---- register specials into nav ---- */
  VC.nav.specials.cerberus = function () {
    if (tour.active) return;         /* tour drives its own version */
    VC.ui.showDestination('cerberus');
    cerberusSequence();
  };
  VC.nav.specials.peter = function () {
    if (tour.active) return;
    VC.ui.showDestination('pearl');
    peterSequence();
  };
  VC.nav.specials.satan = function () {
    VC.nav.flyTo('satan', {});
    setTimeout(function () {
      if (VC.animated.satan) VC.animated.satan.tremble(1.2);
      VC.ui.toast('The Father of Lies regards you.');
    }, 3600);
  };
}());
