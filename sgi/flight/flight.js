// SGI Flight Simulator — Gary Tarolli & Rob Mace. Shared port for both
// historic builds: flight-1988 (colormap-era flat-shaded world) and
// flight-1994 "Version 3.4" (RGB, lighting, fog, terrain texture loaded from
// the original hills.grid / hills.t, time-of-day, HUD).
import { createRenderer, hud, toast, THREE } from '../shared/sgi.js';

const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; if (e.key === 'Escape') location.href = '../'; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

export async function startFlight({ mode }) {
  const is94 = mode === 1994;
  const renderer = createRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, 1, 1, 300000);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize', resize);
  const toastEl = hud({
    title: is94 ? 'Flight 3.4' : 'Flight',
    author: 'Rob Mace & Gary Tarolli', year: String(mode),
    blurb: is94
      ? 'The flight everyone remembers from IRIX: lit, fogged, textured world, eight aircraft, heads-up display. Terrain is the original hills.grid; starts at your local clock time, so expect night in the evening.'
      : 'The 1988–89 colour-index flight from the IRIS 4D demo tape: flat-shaded land, one plane in the sky, meters composited in the bitplanes.',
    controls: is94
      ? '↑↓ pitch · ←→ roll · z/x throttle · F1 fog · F2 texture · H HUD · n/N time · 1-3 plane · esc'
      : '↑↓ pitch · ←→ roll · z/x throttle · esc',
  });

  // ---------- HUD ----------
  const hudCv = document.createElement('canvas');
  hudCv.width = 512; hudCv.height = 256;
  Object.assign(hudCv.style, { position: 'fixed', left: '50%', bottom: '8px', transform: 'translateX(-50%)', width: '560px', opacity: '.9', pointerEvents: 'none' });
  document.body.appendChild(hudCv);
  const hg = hudCv.getContext('2d');
  let hudOn = true;

  // ---------- world / terrain ----------
  const world = new THREE.Group();
  scene.add(world);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(sun, new THREE.AmbientLight(0x8899bb, 0.6));

  let terrain = null, heightGrid = null, texOn = true, fogOn = true;
  let timeOfDay = is94 ? (new Date().getHours() * 60 + new Date().getMinutes()) : 13 * 60;

  function terrainHeight(x, z) {
    if (!heightGrid) return 0;
    const { xs, zs, elv, step, xmin, zmin } = heightGrid;
    const i = Math.max(0, Math.min(xs, Math.floor((x - xmin) / step)));
    const j = Math.max(0, Math.min(zs, Math.floor((z - zmin) / step)));
    return elv[i * (zs + 1) + j];
  }

  async function buildTerrain94() {
    const buf = await (await fetch('../flight-1994/data/hills.grid')).arrayBuffer();
    const dv = new DataView(buf);
    const xs = dv.getInt32(0, false), zs = dv.getInt32(4, false); // big-endian IRIX
    const elv = new Float32Array((xs + 1) * (zs + 1));
    let off = 8;
    for (let z = 0; z <= zs; z++)
      for (let x = 0; x <= xs; x++) {
        // flatten the airport area like the runway placement does
        elv[x * (zs + 1) + z] = (Math.abs(x * 2000 - xs * 1000) < 9000 && Math.abs(z * 2000 - zs * 1000) < 5000) ? 600 : dv.getFloat32(off, false) * 2000;
        off += 4;
      }
    heightGrid = { xs, zs, elv, step: 2000, xmin: 0, zmin: 0 };
    const geo = new THREE.PlaneGeometry(xs * 2000, zs * 2000, xs, zs);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let z = 0; z <= zs; z++)
      for (let x = 0; x <= xs; x++)
        posA.setY(z * (xs + 1) + x, elv[x * (zs + 1) + z]);
    geo.computeVertexNormals();
    geo.translate(xs * 1000, 0, zs * 1000);

    const tbuf = await (await fetch('../flight-1994/data/hills.t')).arrayBuffer();
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(128, 128);
    const tb = new Uint8Array(tbuf);
    for (let i = 0; i < 128 * 128; i++) {
      const v = tb[i];
      img.data[i * 4] = 90 + v * 0.5; img.data[i * 4 + 1] = 110 + v * 0.65; img.data[i * 4 + 2] = 60 + v * 0.3; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 20);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9fb27a, map: tex, flatShading: false });
    terrain = new THREE.Mesh(geo, mat);
    terrain.userData.tex = tex;
    world.add(terrain);
    scene.background = new THREE.Color(0x87a5c9);
    scene.fog = new THREE.Fog(0x87a5c9, 5000, 90000);
    return heightGrid;
  }

  function buildTerrain88() {
    const xs = 24, zs = 12, step = 3000;
    const elv = new Float32Array((xs + 1) * (zs + 1));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noise = [...Array(64)].map(rnd);
    for (let z = 0; z <= zs; z++)
      for (let x = 0; x <= xs; x++) {
        const onRunway = Math.abs(x - xs / 2) < 3 && Math.abs(z - zs / 2) < 2;
        const h = onRunway ? 400 :
          500 + 900 * (Math.sin(x * 0.8) * Math.cos(z * 0.6) + 0.5 * Math.sin(x * 2.3 + z * 1.7)) +
          200 * noise[(x * 7 + z * 13) & 63];
        elv[x * (zs + 1) + z] = h;
      }
    heightGrid = { xs, zs, elv, step, xmin: 0, zmin: 0 };
    const geo = new THREE.PlaneGeometry(xs * step, zs * step, xs, zs);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let z = 0; z <= zs; z++)
      for (let x = 0; x <= xs; x++) p.setY(z * (xs + 1) + x, elv[x * (zs + 1) + z]);
    geo.computeVertexNormals();
    geo.translate(xs * step / 2, 0, zs * step / 2);
    // colormap-era flat land: facet colors from a green→tan ramp by height
    const colors = [];
    const col = new THREE.Color();
    const idx = geo.toNonIndexed();
    const pa = idx.attributes.position;
    for (let f = 0; f < pa.count / 3; f++) {
      const h = (pa.getY(f * 3) + pa.getY(f * 3 + 1) + pa.getY(f * 3 + 2)) / 3;
      const t = Math.max(0, Math.min(1, (h - 100) / 1400));
      col.setHSL(0.33 - t * 0.25, 0.45, 0.28 + t * 0.22);
      for (let v = 0; v < 3; v++) colors.push(col.r, col.g, col.b);
    }
    idx.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrain = new THREE.Mesh(idx, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    world.add(terrain);
    // runway strip
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(2000, 20000),
      new THREE.MeshBasicMaterial({ color: 0x555560 }));
    rw.rotation.x = -Math.PI / 2;
    rw.position.set(xs * step / 2, 402, zs * step / 2);
    world.add(rw);
    scene.background = new THREE.Color(0x5566aa);
    return heightGrid;
  }

  if (is94) await buildTerrain94(); else buildTerrain88();

  // ---------- aircraft ----------
  const PLANE_NAMES = ['f-16', 'c-150', '747'];
  let planeGroup = null;
  function buildPlane(kind) {
    if (planeGroup) world.remove(planeGroup);
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: kind === 1 ? 0xd8d8c0 : 0xb8c4d8, flatShading: true });
    const scale = kind === 2 ? 3 : 1;
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * scale, 1.2 * scale, 30 * scale, 8), mat);
    fuse.rotation.x = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(24 * scale, 0.6 * scale, 5 * scale), mat);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 5 * scale, 3 * scale), mat);
    fin.position.set(0, 3 * scale, 12 * scale);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(8 * scale, 0.5 * scale, 3 * scale), mat);
    tail.position.set(0, 1 * scale, 12 * scale);
    g.add(fuse, wing, fin, tail);
    if (kind === 1) { // prop spinner
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), new THREE.MeshBasicMaterial({ color: 0x222 }));
      p.position.z = -16;
      g.add(p);
    }
    planeGroup = g;
    world.add(g);
  }
  buildPlane(0);

  // ---------- physics ----------
  const st = {
    pos: new THREE.Vector3(), q: new THREE.Quaternion(),
    speed: 0, throttle: 0, crash: 0,
  };
  const home = { x: heightGrid.xs * heightGrid.step / 2 + (is94 ? 900 : 0), z: heightGrid.zs * heightGrid.step / 2 };
  function reset() {
    st.pos.set(home.x, terrainHeight(home.x, home.z) + 6, home.z - 8000);
    st.q.identity();
    st.speed = 0; st.throttle = 0.6; st.crash = 0;
  }
  reset();

  const fwd = new THREE.Vector3(), upv = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();

  // explosions
  const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true }));
  boom.visible = false;
  world.add(boom);
  let boomT = 0;

  function step(dt) {
    if (st.crash > 0) {
      st.crash += dt;
      boom.scale.setScalar(1 + st.crash * 90);
      boom.material.opacity = Math.max(0, 1 - st.crash / 1.4);
      if (st.crash > 1.5) { toast(toastEl, 'press z to fly again'); }
      if (st.crash > 1.5 && keys['z']) reset();
      return;
    }
    // controls (arrow keys pitch/roll, z/x throttle like the real thing)
    if (keys['ArrowUp']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.9 * dt));
    if (keys['ArrowDown']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.9 * dt));
    if (keys['ArrowLeft']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.4 * dt));
    if (keys['ArrowRight']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.4 * dt));
    if (keys['q']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6 * dt));
    if (keys['e']) st.q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.6 * dt));
    if (keys['z']) st.throttle = Math.min(1, st.throttle + 0.35 * dt);
    if (keys['x']) st.throttle = Math.max(0, st.throttle - 0.35 * dt);
    if (is94) {
      if (keys['F1']) { keys['F1'] = false; fogOn = !fogOn; toast(toastEl, `fog ${fogOn ? 'on' : 'off'}`); }
      if (keys['F2']) { keys['F2'] = false; texOn = !texOn; if (terrain) terrain.material.map = texOn ? terrain.userData.tex : null; terrain.material.needsUpdate = true; toast(toastEl, `terrain texture ${texOn ? 'on' : 'off'}`); }
      if (keys['h'] || keys['H']) { keys['h'] = keys['H'] = false; hudOn = !hudOn; hudCv.style.display = hudOn ? '' : 'none'; }
      if (keys['n']) { keys['n'] = false; timeOfDay = (timeOfDay + 5) % 1440; }
      if (keys['N']) { keys['N'] = false; timeOfDay = (timeOfDay - 5 + 1440) % 1440; }
      if (keys['1']) buildPlane(0);
      if (keys['2']) buildPlane(1);
      if (keys['3']) buildPlane(2);
    }

    st.speed += (st.throttle * 260 - st.speed * 0.35) * dt;   // thrust vs drag
    fwd.set(0, 0, -1).applyQuaternion(st.q);
    upv.set(0, 1, 0).applyQuaternion(st.q);
    const lift = Math.min(1, st.speed * st.speed * 0.00002);  // lifts with speed²
    const v = fwd.clone().multiplyScalar(st.speed * 10);
    v.y += (lift - 1) * 55 * dt * 10;                          // net lift minus g
    st.pos.addScaledVector(v, dt);

    const gh = terrainHeight(st.pos.x, st.pos.z) + 4;
    if (st.pos.y < gh) {
      if (st.speed > 60) {
        st.crash = 0.01; st.pos.y = gh;
        boom.position.copy(st.pos); boom.visible = true;
        toast(toastEl, 'you crashed');
      } else { st.pos.y = gh; st.speed *= 0.98; }
    }
    planeGroup.position.copy(st.pos);
    planeGroup.quaternion.copy(st.q);
  }

  function updateSky() {
    if (!is94) return;
    const ang = ((timeOfDay - 360) / 1440) * Math.PI * 2;
    const alt = Math.sin(ang);                        // sun altitude -1..1
    sun.position.set(Math.cos(ang) * 50000, alt * 50000, 20000);
    const day = Math.max(0, Math.min(1, alt * 1.6 + 0.35));
    const sky = new THREE.Color().setHSL(0.6, 0.45, 0.05 + day * 0.55);
    scene.background = sky;
    if (scene.fog) { scene.fog.color = sky; scene.fog.far = 30000 + day * 60000; scene.fog.near = fogOn ? 4000 : 9e6; }
    sun.intensity = 0.1 + day * 2.2;
    sun.color.setHSL(0.09 + day * 0.06, 0.6 - day * 0.4, 0.55);
  }

  function drawHUD() {
    if (!hudOn) return;
    hg.clearRect(0, 0, 512, 256);
    hg.fillStyle = is94 ? 'rgba(0,20,0,.45)' : 'rgba(0,0,40,.5)';
    hg.fillRect(0, 0, 512, 90);
    hg.strokeStyle = hg.fillStyle = is94 ? '#35ff5b' : '#8fd0ff';
    hg.font = '16px ui-monospace, monospace';
    const knots = Math.round(st.speed * 0.9);
    const alt = Math.round(st.pos.y);
    const hdg = Math.round(((-Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI) + 360 * 3) % 360) % 360;
    hg.fillText(`SPD ${String(knots).padStart(4)} KTS`, 18, 26);
    hg.fillText(`ALT ${String(alt).padStart(5)} FT`, 18, 50);
    hg.fillText(`HDG ${String(hdg).padStart(3)}°`, 18, 74);
    hg.fillText(`THR ${'█'.repeat(Math.round(st.throttle * 10))}${'░'.repeat(10 - Math.round(st.throttle * 10))}`, 200, 26);
    hg.fillText(is94 ? `TIME ${String(Math.floor(timeOfDay / 60)).padStart(2, '0')}:${String(timeOfDay % 60).padStart(2, '0')}` : 'COLOUR INDEX MODE', 200, 50);
    if (is94) hg.fillText('SGI FLIGHT SIMULATOR 3.4', 200, 74);
    else hg.fillText('FLIGHT  1988  IRIS 4D', 200, 74);
  }

  renderer.setAnimationLoop(() => {
    const dt = 1 / 60;
    step(dt);
    updateSky();
    drawHUD();
    // chase camera
    const behind = st.pos.clone().addScaledVector(fwd, -60).addScaledVector(upv, 18);
    camera.position.lerp(behind, 0.08);
    const look = st.pos.clone().addScaledVector(fwd, 120);
    camera.up.copy(upv);
    camera.lookAt(look);
    renderer.render(scene, camera);
  });
  toast(toastEl, 'takeoff roll: hold z for full throttle', 4000);
}
