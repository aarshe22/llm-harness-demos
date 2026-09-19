/* =========================================================================
 * Voxel Cosmos — ui.js
 * Overlay controller: realm tabs, grouped POI navigator, destination
 * caption, toasts, time-of-day, quality, toggles, tour controls, modals,
 * fullscreen, keyboard shortcuts, FPS readout, instructions fade.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var $ = function (id) { return document.getElementById(id); };
  var UI = VC.ui = {};

  var toastTimer = null;

  UI.init = function () {
    /* ---------- POI navigator ---------- */
    var groups = [
      { key: 'overview', label: 'The Cosmos', realm: 'overview' },
      { key: 'hell', label: 'Hell', realm: 'hell' },
      { key: 'earth', label: 'Earth', realm: 'earth' },
      { key: 'stair', label: 'Stairway', realm: 'stair' },
      { key: 'heaven', label: 'Heaven', realm: 'heaven' }
    ];
    var list = $('poi-list');
    groups.forEach(function (g) {
      var items = VC.destinations.filter(function (d) { return d.group === g.key; });
      if (!items.length) return;
      var wrap = document.createElement('div');
      wrap.className = 'poi-group ' + (g.realm === 'overview' ? 'earth' : (g.realm === 'stair' ? 'heaven' : g.realm));
      var head = document.createElement('div');
      head.className = 'poi-head';
      head.innerHTML = '<span class="dot"></span><span>' + g.label + '</span><span class="chev">▼</span>';
      head.addEventListener('click', function () { wrap.classList.toggle('closed'); });
      wrap.appendChild(head);
      var itemsEl = document.createElement('div');
      itemsEl.className = 'poi-items';
      items.forEach(function (d) {
        var b = document.createElement('button');
        b.className = 'poi' + (d.special ? ' special' : '');
        b.setAttribute('data-id', d.id);
        b.innerHTML = '<span class="poi-ico">' + (d.icon || '◆') + '</span><span>' + d.title + '</span>';
        b.addEventListener('click', function () {
          if (VC.audio) VC.audio.uiTick(660);
          VC.nav.go(d.id);
        });
        itemsEl.appendChild(b);
      });
      wrap.appendChild(itemsEl);
      list.appendChild(wrap);
    });

    /* ---------- realm tabs ---------- */
    document.querySelectorAll('.realm-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = btn.getAttribute('data-realm');
        if (VC.audio) VC.audio.uiTick(520);
        VC.jumpRealm(r);
      });
    });

    /* ---------- time buttons ---------- */
    document.querySelectorAll('.time-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (VC.audio) VC.audio.uiTick(760);
        VC.setTimeOfDay(btn.getAttribute('data-time'));
      });
    });

    /* ---------- quality ---------- */
    document.querySelectorAll('.q-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.q-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        VC.setQuality(btn.getAttribute('data-quality'));
      });
    });

    /* ---------- destinations prev/next ---------- */
    $('btn-prev').addEventListener('click', function () { VC.nav.cycle(-1); });
    $('btn-next').addEventListener('click', function () { VC.nav.cycle(1); });

    /* ---------- tour ---------- */
    $('btn-tour').addEventListener('click', function () {
      if (VC.tour.active) VC.tourStop(); else VC.tourStart();
    });
    $('btn-pause').addEventListener('click', function () { VC.tourPause(); });
    $('btn-skip').addEventListener('click', function () { VC.tourSkip(); });
    $('btn-stop').addEventListener('click', function () { VC.tourStop(); });

    /* ---------- toggles ---------- */
    $('btn-labels').addEventListener('click', function () {
      VC.showLabels = !VC.showLabels;
      this.classList.toggle('active', VC.showLabels);
    });
    $('btn-motion').addEventListener('click', function () {
      VC.reducedMotion = !VC.reducedMotion;
      this.classList.toggle('active', VC.reducedMotion);
    });
    $('btn-fps').addEventListener('click', function () {
      var f = $('fps');
      f.classList.toggle('hidden');
      this.classList.toggle('active', !f.classList.contains('hidden'));
    });
    $('btn-reset').addEventListener('click', function () {
      if (VC.nav.current) { VC.nav.flyTo(VC.nav.current, { speedMul: 0.8 }); }
      else VC.nav.flyTo('universe');
    });
    $('btn-audio').addEventListener('click', function () {
      var ok = VC.audio.enable();
      this.classList.toggle('active', !!ok);
      $('btn-mute').classList.remove('active');
    });
    $('btn-mute').addEventListener('click', function () {
      var m = !VC.audio.muted;
      VC.audio.setMuted(m);
      this.classList.toggle('active', m);
      $('btn-audio').classList.toggle('active', !m && VC.audio.on);
    });

    /* ---------- fullscreen / modals / panel ---------- */
    $('btn-fullscreen').addEventListener('click', function () {
      if (!document.fullscreenElement) {
        (document.documentElement.requestFullscreen || function () { })
          .call(document.documentElement);
      } else if (document.exitFullscreen) document.exitFullscreen();
    });
    $('btn-help').addEventListener('click', function () { $('help-modal').classList.toggle('hidden'); });
    $('btn-about').addEventListener('click', function () { $('about-modal').classList.toggle('hidden'); });
    document.querySelectorAll('.modal-close').forEach(function (b) {
      b.addEventListener('click', function () {
        $(b.getAttribute('data-close')).classList.add('hidden');
      });
    });
    document.querySelectorAll('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) m.classList.add('hidden'); });
    });
    $('btn-menu').addEventListener('click', function () {
      $('sidepanel').classList.toggle('collapsed');
    });

    /* ---------- keyboard ---------- */
    window.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (k === '1') VC.jumpRealm('hell');
      else if (k === '2') VC.jumpRealm('earth');
      else if (k === '3') VC.jumpRealm('heaven');
      else if (k === '[') VC.nav.cycle(-1);
      else if (k === ']') VC.nav.cycle(1);
      else if (k === 'g') VC.tour.active ? VC.tourStop() : VC.tourStart();
      else if (k === 'n' && VC.tour.active) VC.tourSkip();
      else if (k === 't') VC.setTimeOfDay('morning');
      else if (k === 'y') VC.setTimeOfDay('noon');
      else if (k === 'u') VC.setTimeOfDay('dusk');
      else if (k === 'i') VC.setTimeOfDay('night');
      else if (k === 'l') $('btn-labels').click();
      else if (k === 'r') $('btn-motion').click();
      else if (k === 'f') $('btn-fullscreen').click();
      else if (k === 'm') $('btn-mute').click();
      else if (k === 'p') $('btn-menu').click();
      else if (k === 'h') $('help-modal').classList.toggle('hidden');
      else if (k === '?' ) $('help-modal').classList.toggle('hidden');
      else if (k === 'escape') {
        document.querySelectorAll('.modal').forEach(function (m) { m.classList.add('hidden'); });
      } else if (k === ' ') {
        if (VC.tour.active) { e.preventDefault(); VC.tourPause(); }
      }
    });

    /* ---------- events from the world ---------- */
    VC.on('navStart', function (d) {
      UI.showDestination(d.id);
      document.querySelectorAll('button.poi').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-id') === d.id);
      });
      /* open the group of the active destination */
      document.querySelectorAll('button.poi').forEach(function (b) {
        if (b.getAttribute('data-id') === d.id) {
          var grp = b.closest('.poi-group');
          if (grp) grp.classList.remove('closed');
        }
      });
    });
    VC.on('cerberusRoar', function () { if (VC.audio && VC.audio.on) VC.audio.cerberusRoar(); });
    VC.on('hellGate', function (open) { if (open && VC.audio && VC.audio.on) VC.audio.hellGateOpen(); });
    VC.on('pearlGate', function (open) { if (open && VC.audio && VC.audio.on) VC.audio.pearlGateOpen(); });
    VC.on('peterGreet', function () { if (VC.audio && VC.audio.on) VC.audio.peterBell(); });
    VC.on('eruption', function () { if (VC.audio && VC.audio.on) VC.audio.eruption(); });
    VC.on('timeOfDay', function (id) {
      document.querySelectorAll('.time-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-time') === id);
      });
    });
    VC.on('quality', function () {
      /* particle fields keep their size; quality mainly affects dpr/shadow —
         applied each frame in main; nothing else to refresh. */
    });

    /* instructions fade */
    setTimeout(function () {
      $('instructions').classList.add('fade');
    }, 9000);

    UI.tourPaused(false);
  };

  /* ---------- caption / toast ---------- */
  UI.showDestination = function (id) {
    var d = VC.destById[id];
    if (!d) return;
    var cap = $('caption');
    cap.className = d.realm || '';
    $('caption-title').textContent = (d.icon ? d.icon + '  ' : '') + d.title;
    $('caption-desc').textContent = d.desc || '';
    cap.classList.remove('hidden');
    clearTimeout(UI._capT);
    UI._capT = setTimeout(function () { cap.classList.add('hidden'); }, 9000);
  };
  UI.toast = function (msg, dur) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, dur || 4200);
  };

  /* ---------- tour ui ---------- */
  UI.tourStarted = function () {
    $('btn-tour').textContent = '⏹ Tour Running — Click to Stop';
    $('btn-tour').classList.add('stop');
    $('tour-controls').classList.remove('hidden');
    $('tour-progress').classList.remove('hidden');
  };
  UI.tourStopped = function () {
    $('btn-tour').textContent = '▶ Auto Tour';
    $('btn-tour').classList.remove('stop');
    $('tour-controls').classList.add('hidden');
    $('tour-progress').classList.add('hidden');
    $('tour-progress-fill').style.width = '0%';
  };
  UI.tourPaused = function (p) {
    $('btn-pause').textContent = p ? '▶ Resume' : '⏸ Pause';
  };

  /* ---------- realm pill + jump ---------- */
  var lastPill = '';
  UI.updateRealmPill = function (realm) {
    if (realm === lastPill) return;
    lastPill = realm;
    var pill = $('realm-pill');
    pill.className = 'pill ' + (realm === 'stair' ? 'transit' : realm);
    pill.textContent = ({ hell: 'HELL', earth: 'EARTH', heaven: 'HEAVEN', stair: 'STAIRWAY', space: 'BETWEEN REALMS' })[realm] || 'EARTH';
    document.querySelectorAll('.realm-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-realm') === realm);
    });
  };

  VC.jumpRealm = function (realm) {
    if (VC.tour.active) VC.tourStop();
    var id = realm === 'hell' ? 'cerberus' : realm === 'heaven' ? 'heaven' : 'earth';
    if (VC.tour.active) VC.tourStop();
    VC.nav.flyTo(id, {});
    VC.emit('navSelect', VC.destById[id]);
  };
}());
