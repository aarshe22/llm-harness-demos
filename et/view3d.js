/**
 * Three.js split view for the 1982 cart simulation (world 2).
 * Left: first person. Right: above and behind E.T. Does not change tick().
 */
(function () {
  "use strict";

  const SX = 1;
  const SZ = 1.35;
  const W = 120;
  const D = 64;

  let renderer, scene, fpsCam, chaseCam, stage, canvas;
  let worldGroup, etGroup, shipMesh;
  let humanMeshes = [];
  let candyMesh, phoneMesh, flowerMesh;
  let enabled = false;
  let lastScreen = -999;
  let yaw = 0;
    let pitch = -0.02;
  let labelsEl = null;

  function toX(x) { return (x - W * 0.5) * SX; }
  function toZ(y) { return (y - D * 0.5) * SZ; }

  function rgb(css) {
    return new THREE.Color(css);
  }

  function mat(colorCss, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color: rgb(colorCss) }, opts || {}));
  }

  function api() {
    return window.ET_GAME;
  }

  function actorHeight(G, obj) {
    const y = (obj.y !== undefined ? obj.y : G.et.y) & 255;
    if (G.screen === api().ID.PIT) {
      if (obj === G.et) {
        if (G.et.pit & 0x80) return Math.max(0.4, 7 - (y / 49) * 6.5);
        if (G.et.pit & 0x40) return Math.max(0.6, 1.2 + Math.max(0, 40 - y) * 0.12);
        if (G.et.pit & 0x20) return 0.85;
      }
      return 0.85;
    }
    if ((G.mothership & 0x80) && y > 70) return 3 + Math.max(0, 256 - y) * 0.08;
    return 1.15;
  }

  function facing(G) {
    if (G.et.face !== undefined) return G.et.face;
    const m = G.et.motion & 0x0f;
    if ((m & 1) === 0) return 0;
    if ((m & 2) === 0) return Math.PI;
    if ((m & 4) === 0) return -Math.PI / 2;
    if ((m & 8) === 0) return Math.PI / 2;
    return 0;
  }

  function makeEt() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 4, 8), mat("rgb(180,140,70)"));
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat("rgb(210,175,90)"));
    head.name = "head";
    head.position.y = 2.15;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 6, 12), mat("rgb(245,245,245)"));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.72;
    g.add(body, head, collar);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  function makeHuman(id) {
    const col = id === 1 ? "rgb(232,160,32)" : "rgb(220,220,220)";
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.3, 4, 8), mat(col));
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat("rgb(240,200,160)"));
    head.position.y = 2.15;
    g.add(body, head);
    return g;
  }

  function makeShip() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.45, 20), mat("rgb(200,80,40)"));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("rgb(255,180,60)"));
    dome.position.y = 0.4;
    g.add(disc, dome);
    return g;
  }

  function clearWorld() {
    if (!worldGroup) return;
    while (worldGroup.children.length) {
      const c = worldGroup.children[0];
      worldGroup.remove(c);
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }
  }

  function addBox(parent, x, y, z, w, h, d, css) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(css));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function rebuild(G) {
    const game = api();
    clearWorld();
    const screen = G.screen;
    const pfCss = game.ntsc(game.PF_COLORS[Math.min(screen, 8)]);
    scene.background = rgb(screen === game.ID.FOREST ? "rgb(40,70,110)" : screen === game.ID.DC ? "rgb(30,40,70)" : "rgb(70,90,140)");
    scene.fog.color.copy(scene.background);

    const floorCol = screen === game.ID.FOREST ? "rgb(50,90,40)"
      : screen === game.ID.DC ? "rgb(70,70,78)"
        : screen === game.ID.PIT ? "rgb(20,16,12)"
          : screen === game.ID.HOME ? "rgb(40,60,90)"
            : "rgb(180,150,70)";
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * SX + 8, D * SZ + 8), mat(floorCol));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    worldGroup.add(floor);

    if (screen === game.ID.PIT) {
      addBox(worldGroup, 0, 4, 0, 18, 8, 18, "rgb(25,18,12)");
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 16), mat("rgb(8,6,4)"));
      hole.position.y = 0.05;
      worldGroup.add(hole);
      lastScreen = screen;
      return;
    }

    const isPitField = screen < game.ID.FOREST;
    const dummy = new THREE.Object3D();
    const maxN = 2500;

    if (screen !== game.ID.FOREST) {
      const step = 1;
      const wallGeo = new THREE.BoxGeometry(step * SX * 0.95, isPitField ? 0.15 : (screen === game.ID.DC ? 5.5 : 3.2), step * SZ * 0.95);
      const wallMat = mat(isPitField ? "rgb(20,12,8)" : pfCss);
      const inst = new THREE.InstancedMesh(wallGeo, wallMat, maxN);
      inst.castShadow = !isPitField;
      inst.receiveShadow = true;
      let n = 0;
      for (let y = 0; y < D; y += step) {
        for (let x = 0; x < W; x += step) {
          if (!game.pfBit(screen, x, y)) continue;
          dummy.position.set(toX(x), isPitField ? -0.35 : (screen === game.ID.DC ? 2.7 : 1.6), toZ(y));
          dummy.updateMatrix();
          inst.setMatrixAt(n++, dummy.matrix);
          if (n >= maxN) break;
        }
        if (n >= maxN) break;
      }
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      if (n > 0) worldGroup.add(inst);
    }

    if (isPitField) {
      const step = 1;
      const shaft = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.55 * step, 0.45 * step, 7, 6),
        mat("rgb(12,8,4)"),
        maxN
      );
      let k = 0;
      for (let y = 0; y < D; y += step) {
        for (let x = 0; x < W; x += step) {
          if (!game.pfBit(screen, x, y)) continue;
          dummy.position.set(toX(x), -3.4, toZ(y));
          dummy.updateMatrix();
          shaft.setMatrixAt(k++, dummy.matrix);
          if (k >= maxN) break;
        }
        if (k >= maxN) break;
      }
      shaft.count = k;
      shaft.instanceMatrix.needsUpdate = true;
      if (k > 0) worldGroup.add(shaft);
    }

    if (screen === game.ID.FOREST) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5), mat("rgb(70,45,25)"), 800);
      const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 2.8, 6), mat("rgb(30,80,35)"), 800);
      let t = 0;
      for (let y = 0; y < D; y += 3) {
        for (let x = 0; x < W; x += 3) {
          if (!game.pfBit(screen, x, y)) continue;
          dummy.position.set(toX(x), 1.1, toZ(y));
          dummy.updateMatrix();
          trunk.setMatrixAt(t, dummy.matrix);
          dummy.position.y = 3.1;
          dummy.updateMatrix();
          leaves.setMatrixAt(t, dummy.matrix);
          t++;
          if (t >= 800) break;
        }
        if (t >= 800) break;
      }
      trunk.count = t;
      leaves.count = t;
      trunk.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
      worldGroup.add(trunk, leaves);
    }

    lastScreen = screen;
  }

  function init() {
    if (renderer) return true;
    if (typeof THREE === "undefined") return false;
    stage = document.getElementById("stage");
    canvas = document.getElementById("view3d");
    if (!stage || !canvas) return false;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(640, 768, false);
    renderer.shadowMap.enabled = true;
    renderer.autoClear = false;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x284878, 28, 90);
    scene.add(new THREE.HemisphereLight(0xb0d0ff, 0x334422, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.9);
    sun.position.set(-20, 40, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    fpsCam = new THREE.PerspectiveCamera(70, 320 / 768, 0.1, 200);
    chaseCam = new THREE.PerspectiveCamera(55, 320 / 768, 0.1, 200);
    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    etGroup = makeEt();
    scene.add(etGroup);
    shipMesh = makeShip();
    shipMesh.visible = false;
    scene.add(shipMesh);
    humanMeshes = [0, 1, 2].map((id) => {
      const h = makeHuman(id);
      h.visible = false;
      scene.add(h);
      return h;
    });
    candyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat("rgb(255,210,40)"));
    candyMesh.visible = false;
    scene.add(candyMesh);
    phoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), mat("rgb(40,180,255)"));
    phoneMesh.visible = false;
    scene.add(phoneMesh);
    flowerMesh = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), mat("rgb(50,160,50)"));
    flowerMesh.visible = false;
    scene.add(flowerMesh);

    labelsEl = document.getElementById("view3dLabels");
    canvas.addEventListener("click", () => {
      canvas.requestPointerLock && canvas.requestPointerLock();
    });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * 0.004;
      pitch = Math.max(-1.1, Math.min(0.6, pitch - e.movementY * 0.003));
    });
    return true;
  }

  function placeCameras(G) {
    const ex = toX(G.et.x);
    const ez = toZ(G.et.y & 255);
    const ey = actorHeight(G, G.et);
    const face = facing(G);
    const lookYaw = document.pointerLockElement === canvas ? yaw : face;
    const head = ey + (G.et.neck & 0x80 ? 0.55 + (G.et.neck & 3) * 0.18 : 0.95);
    fpsCam.position.set(ex, head, ez);
    fpsCam.rotation.order = "YXZ";
    fpsCam.rotation.y = -lookYaw;
    fpsCam.rotation.x = pitch;
    const back = 16;
    const lift = 5.2;
    chaseCam.position.set(
      ex - Math.sin(face) * back * 0.35,
      ey + lift,
      ez + Math.cos(face) * back
    );
    chaseCam.lookAt(ex, ey + 1.4, ez);
  }

  function updateActors(G) {
    const game = api();
    const y = G.et.y & 255;
    etGroup.position.set(toX(G.et.x), 0, toZ(y > 70 && G.screen !== game.ID.PIT ? 32 : y));
    const h = actorHeight(G, G.et);
    etGroup.position.y = G.screen === game.ID.PIT ? 0 : 0;
    etGroup.scale.setScalar(1);
    etGroup.position.y = (G.mothership & 0x80) && y > 70 ? h - 1.1 : 0;
    const head = etGroup.getObjectByName("head");
    if (head) head.position.y = G.et.neck & 0x80 ? 2.15 + (G.et.neck & 3) * 0.35 : 2.15;
    etGroup.rotation.y = -facing(G);
    etGroup.visible = G.screen !== game.ID.TITLE;

    G.humans.forEach((hum, i) => {
      const m = humanMeshes[i];
      const onScreen = hum.screen === G.screen && G.screen !== game.ID.TITLE;
      m.visible = !!(onScreen && (G.currentObj === i || (G.screen === game.ID.HOME && i === 1)));
      if (!m.visible) return;
      m.position.set(toX(hum.x), 0, toZ(hum.y & 255));
    });

    candyMesh.visible = G.candyY < 64 && G.screen < game.ID.FOREST;
    if (candyMesh.visible) candyMesh.position.set(toX(G.candyX), 0.4, toZ(G.candyY));

    phoneMesh.visible = G.hiddenPhoneY < 64;
    if (phoneMesh.visible) phoneMesh.position.set(toX(G.hiddenPhoneX), 0.3, toZ(G.hiddenPhoneY));

    const flying = !!(G.mothership & 0x80);
    shipMesh.visible = flying;
    if (flying) {
      const sy = G.shipY & 255;
      shipMesh.position.set(toX(G.shipX), (sy > 70 ? 6 + (256 - sy) * 0.1 : Math.max(2, 12 - sy * 0.15)), toZ(Math.min(40, sy)));
    }
  }

  function renderSplit() {
    const w = canvas.width;
    const h = canvas.height;
    fpsCam.aspect = (w * 0.5) / h;
    fpsCam.updateProjectionMatrix();
    chaseCam.aspect = (w * 0.5) / h;
    chaseCam.updateProjectionMatrix();
    renderer.setScissorTest(true);
    etGroup.visible = false;
    renderer.setViewport(0, 0, w * 0.5, h);
    renderer.setScissor(0, 0, w * 0.5, h);
    renderer.clear();
    renderer.render(scene, fpsCam);
    etGroup.visible = true;
    renderer.setViewport(w * 0.5, 0, w * 0.5, h);
    renderer.setScissor(w * 0.5, 0, w * 0.5, h);
    renderer.render(scene, chaseCam);
    renderer.setScissorTest(false);
  }

  function setEnabled(on) {
    enabled = !!on && init();
    if (enabled) lastScreen = -999;
    if (canvas) canvas.hidden = !enabled;
    if (labelsEl) labelsEl.hidden = !enabled;
    if (stage) stage.classList.toggle("mode-3d", enabled);
    const hud = document.getElementById("game");
    if (hud) hud.classList.toggle("hud-overlay", enabled);
  }

  function sync() {
    const game = api();
    if (!game) return;
    const want = game.G.world === 2 && game.G.screen !== game.ID.TITLE;
    if (want !== enabled) setEnabled(want);
    if (!enabled) return;
    const G = game.G;
    if (G.screen !== lastScreen) rebuild(G);
    updateActors(G);
    placeCameras(G);
    renderSplit();
  }

  window.ET_VIEW3D = { sync, setEnabled };
})();
