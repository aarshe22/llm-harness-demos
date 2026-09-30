import * as THREE from 'three';
import { ROOM_BUILDERS } from './world.js';
import { makeCharacter } from './sprites.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { createGame } from './game.js';

const ROOM_TRACKS = {
  lounge: 'lounge',
  vip: 'vip',
  casino: 'casino',
  ship: 'ship',
  spa: 'spa',
  space: 'space'
};

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const VIEW_H = 6.6;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
camera.position.set(0, 5.4, 10);
camera.lookAt(0, 1.3, 0);

const PIXEL_SCALE = 3;
const rt = new THREE.WebGLRenderTarget(320, 180, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: true
});

const quadMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: rt.texture },
    uRes: { value: new THREE.Vector2(320, 180) },
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float scan = mod(floor(vUv.y * uRes.y), 2.0) < 1.0 ? 0.92 : 1.0;
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.95, 0.35, d);
      c.rgb *= mix(0.52, 1.0, vig) * scan;
      float grain = 0.018 * sin(gl_FragCoord.x * 7.0 + uTime * 11.0)
                          * sin(gl_FragCoord.y * 9.0 - uTime * 7.0);
      c.rgb += grain;
      c.rgb = pow(clamp(c.rgb, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2));
      gl_FragColor = c;
    }
  `,
  depthTest: false,
  depthWrite: false
});
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadScene = new THREE.Scene();
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

const ui = new UI();
const sound = new Sound();

const api = {
  sound,
  enterRoom,
  interstitial: (...args) => ui.showInterstitial(...args),
  victory: (text) => { sound.stopMusic(); sound.win(); ui.showVictory(text); },
  toast: (msg) => ui.toast(msg),
  sash: (on) => { sash.visible = on; },
  roomTrack: () => ROOM_TRACKS[roomKey] || 'lounge'
};

const game = createGame({ ui, api });
ui.onBlip = () => sound.blip();
ui.onHit = () => sound.hit();
ui.onMiss = () => sound.miss();

const rooms = {};
let roomKey = null;
let current = null;

function buildRoom(key) {
  const inst = ROOM_BUILDERS[key]();
  inst.proxies = [];
  for (const h of inst.hotspots) {
    const proxy = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 2.7),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.set(h.pos.x, 1.35, h.pos.z);
    proxy.userData.hot = h;
    inst.group.add(proxy);
    inst.proxies.push(proxy);
  }
  inst.anim = [];
  inst.group.traverse((o) => {
    if (o.userData.ball || o.userData.lightTile !== undefined) inst.anim.push(o);
  });
  scene.add(inst.group);
  inst.group.visible = false;
  return inst;
}

function enterRoom(key, spawn, toastMsg) {
  if (!rooms[key]) rooms[key] = buildRoom(key);
  const next = rooms[key];
  const go = () => {
    if (current) current.group.visible = false;
    current = next;
    roomKey = key;
    current.group.visible = true;
    if (spawn) {
      player.position.set(spawn.x, 0, spawn.z);
      playerTarget = null;
      moveCb = null;
    }
    camX = player.position.x * 0.5;
    sound.setTrack(ROOM_TRACKS[key]);
    if (toastMsg) ui.toast(toastMsg);
    game.onRoom(key);
  };
  if (current) ui.fadeSwitch(go);
  else go();
}

const player = makeCharacter('terry');
player.rotation.x = -0.08;
scene.add(player);

const sash = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.14, 0.7),
  new THREE.MeshLambertMaterial({ color: 0xc81f6c })
);
sash.rotation.z = 0.9;
sash.position.y = 1.05;
sash.visible = false;
player.add(sash);

let playerTarget = null;
let moveCb = null;
let stuckTimer = 0;
const SPEED = 2.4;
const MARGIN = 0.22;

const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.14, 0.24, 20),
  new THREE.MeshBasicMaterial({ color: 0x1ec9ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let markerT = 1;

function insideRect(x, z, r) {
  return x > r.minX - MARGIN && x < r.maxX + MARGIN && z > r.minZ - MARGIN && z < r.maxZ + MARGIN;
}

function walkTo(x, z, cb) {
  playerTarget = { x, z };
  moveCb = cb || null;
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects([current.floor, ...current.proxies], false);
}

canvas.addEventListener('pointermove', (ev) => {
  if (!current) return;
  const hits = pick(ev);
  const hot = hits.find((h) => h.object.userData.hot);
  if (hot && !ui.isOpen) {
    ui.setCursorLabel(hot.object.userData.hot.label, ev.clientX, ev.clientY);
    canvas.style.cursor = 'pointer';
  } else {
    ui.setCursorLabel(null);
    canvas.style.cursor = 'default';
  }
});

function triggerHotspot(h) {
  const d = Math.hypot(player.position.x - h.stand.x, player.position.z - h.stand.z);
  sound.ensure();
  sound.select();
  if (d < 0.45) game.interact(h.id);
  else walkTo(h.stand.x, h.stand.z, () => game.interact(h.id));
}

canvas.addEventListener('pointerdown', (ev) => {
  if (cmdInput) cmdInput.blur();
  if (!current || ui.isOpen || ui.danceActive) return;
  if (document.getElementById('intro').classList.contains('hidden') === false) return;
  const hits = pick(ev);
  const hot = hits.find((h) => h.object.userData.hot);
  if (hot) {
    triggerHotspot(hot.object.userData.hot);
    return;
  }
  const fl = hits.find((h) => h.object === current.floor);
  if (fl) {
    sound.ensure();
    const b = current.bounds;
    const tx = THREE.MathUtils.clamp(fl.point.x, b.minX, b.maxX);
    const tz = THREE.MathUtils.clamp(fl.point.z, b.minZ, b.maxZ);
    marker.position.set(tx, 0.03, tz);
    marker.visible = true;
    markerT = 0;
    walkTo(tx, tz);
  }
});

/* -------- typed commands -------- */

const cmdInput = document.getElementById('cmd');
cmdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCommand(cmdInput.value);
    cmdInput.value = '';
    cmdInput.blur();
  }
  if (e.key === 'Escape') cmdInput.blur();
  e.stopPropagation();
});

function findHotspot(q) {
  const t = q.toLowerCase().replace(/^(to|at)\s+/, '');
  if (!t) return null;
  return current.hotspots.find((h) => h.id.includes(t) || h.label.toLowerCase().includes(t)) || null;
}

function runCommand(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return;
  if (['help', 'h', '?'].includes(s)) {
    ui.say('COMMAND LINE', 'TALK <who> - talk to someone. LOOK/EXAMINE <thing> - poke it. USE/TAKE <thing> - grab or use it. GO/OPEN <door> - leave or enter. OBJ - current goal. INV - your stuff. Plus: CLICK to walk, WASD / arrow keys to move. You can always just click people and things too.', () => ui.say('COMMAND LINE', 'This room: ' + current.hotspots.map((h) => h.label).join(' | ')));
    return;
  }
  if (['obj', 'objective', 'quest', 'goal'].includes(s)) {
    ui.say('OBJECTIVE', game.objective());
    return;
  }
  if (['inv', 'inventory', 'items'].includes(s)) {
    ui.say('INVENTORY', ui.items.length ? ui.items.map((i) => ITEM_LABELS_SHORT(i)).join(', ') : 'Empty pockets. Tragic.');
    return;
  }
  const m = s.match(/^(talk|speak|talk\s+to|use|look|look\s+at|examine|x|take|grab|get|open|go|go\s+to|enter)\s+(.+)$/);
  const target = m ? m[2] : s;
  const hot = findHotspot(target);
  if (hot) triggerHotspot(hot);
  else ui.toast('NOTHING HERE MATCHES: ' + target);
}

function ITEM_LABELS_SHORT(id) {
  const L = { comb: 'Afro Comb', drink: 'Blue Suede', chip: 'Lucky Chip', hat: "Captain's Hat", skewer: 'Buffet Skewer', mud: 'Mud Tub', pom: 'Zero-G Pom-Pom' };
  return L[id] || id;
}

/* -------- WASD / arrow walking -------- */

const held = new Set();
const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
window.addEventListener('keydown', (e) => {
  const inInput = e.target && e.target.tagName === 'INPUT';
  if (inInput) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      cmdInput.blur();
      held.add(e.code);
      e.preventDefault();
    }
    return;
  }
  held.add(e.code);
  if (e.code === 'Slash') cmdInput.focus();
  if (MOVE_CODES.includes(e.code) || e.code === 'Space') e.preventDefault();
  if (e.key === 'Escape' && ui.isOpen && !ui.danceActive) ui.close();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

function tryMove(dx, dz) {
  const b = current.bounds;
  let px = player.position.x;
  let pz = player.position.z;
  const nx = THREE.MathUtils.clamp(px + dx, b.minX, b.maxX);
  const nz = THREE.MathUtils.clamp(pz + dz, b.minZ, b.maxZ);
  let blockedX = false;
  let blockedZ = false;
  for (const r of current.colliders) {
    if (insideRect(nx, pz, r)) blockedX = true;
    if (insideRect(px, nz, r)) blockedZ = true;
  }
  if (!blockedX) px = nx;
  if (!blockedZ) pz = nz;
  if (Math.abs(dx) > 0.001) player.scale.x = dx < 0 ? -1 : 1;
  player.position.x = px;
  player.position.z = pz;
  return px !== player.position.x || pz !== player.position.z || Math.hypot(dx, dz) > 0;
}

document.getElementById('music-btn').addEventListener('click', () => {
  const on = sound.toggleMusic();
  document.getElementById('music-btn').innerHTML = '&#9834; MUSIC: ' + (on ? 'ON' : 'OFF');
});

let camX = 0;
let time = 0;
let last = performance.now();
let objTimer = 0;

function update(dt) {
  time += dt;

  let mx = 0;
  let mz = 0;
  if (held.has('KeyW') || held.has('ArrowUp')) mz -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) mz += 1;
  if (held.has('KeyA') || held.has('ArrowLeft')) mx -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) mx += 1;
  const wasd = mx !== 0 || mz !== 0;
  if (wasd) {
    playerTarget = null;
    moveCb = null;
    const len = Math.hypot(mx, mz);
    tryMove((mx / len) * SPEED * dt, (mz / len) * SPEED * dt);
    player.userData.moving = true;
  } else if (playerTarget) {
    const beforeX = player.position.x;
    const beforeZ = player.position.z;
    const dx = playerTarget.x - player.position.x;
    const dz = playerTarget.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    const stepLen = Math.min(SPEED * dt, dist);
    if (dist > 0.001) {
      const nx = player.position.x + (dx / dist) * stepLen;
      const nz = player.position.z + (dz / dist) * stepLen;
      const b = current.bounds;
      const cx = THREE.MathUtils.clamp(nx, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(nz, b.minZ, b.maxZ);
      let px = player.position.x;
      let pz = player.position.z;
      let blockedX = false;
      let blockedZ = false;
      for (const r of current.colliders) {
        if (insideRect(cx, pz, r)) { blockedX = true; }
        if (insideRect(px, cz, r)) { blockedZ = true; }
      }
      if (!blockedX) px = cx;
      if (!blockedZ) pz = cz;
      if (Math.abs(dx) > 0.01) player.scale.x = dx < 0 ? -1 : 1;
      player.position.x = px;
      player.position.z = pz;
      player.userData.moving = true;

      const moved = Math.hypot(px - beforeX, pz - beforeZ);
      const arrived = Math.hypot(playerTarget.x - px, playerTarget.z - pz) < 0.08;
      if (arrived) {
        playerTarget = null;
        const cb = moveCb;
        moveCb = null;
        if (cb) cb();
      } else if (moved < 0.0008) {
        stuckTimer += dt;
        if (stuckTimer > 0.3) {
          playerTarget = null;
          const cb = moveCb;
          moveCb = null;
          if (cb) cb();
        }
      } else {
        stuckTimer = 0;
      }
    }
  } else {
    player.userData.moving = false;
    stuckTimer = 0;
  }

  if (marker.visible) {
    markerT += dt * 2;
    if (markerT >= 1) marker.visible = false;
    else {
      marker.scale.setScalar(1 + markerT * 1.2);
      marker.material.opacity = 0.8 * (1 - markerT);
    }
  }

  const moving = player.userData.moving;
  player.position.y = moving ? Math.abs(Math.sin(time * 9)) * 0.05 : Math.sin(time * 2) * 0.02;

  if (current) {
    for (const o of current.anim) {
      if (o.userData.ball) o.rotation.y = time * 0.8;
      if (o.userData.lightTile !== undefined && o.material) {
        o.material.opacity = 0.1 + 0.28 * (0.5 + 0.5 * Math.sin(time * 3 + (o.userData.lightTile || 0) * 1.7));
      }
    }
  }

  const wanted = player.position.x * 0.5;
  camX += (wanted - camX) * Math.min(1, dt * 4);
  camera.position.x = camX;
  camera.lookAt(camX, 1.3, 0);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.round(rect.width) || innerWidth);
  const h = Math.max(200, Math.round(rect.height) || innerHeight);
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.left = (-VIEW_H * aspect) / 2;
  camera.right = (VIEW_H * aspect) / 2;
  camera.top = VIEW_H / 2;
  camera.bottom = -VIEW_H / 2;
  camera.updateProjectionMatrix();
  const rtH = Math.max(180, Math.round(h / PIXEL_SCALE));
  const rtW = Math.max(240, Math.round(rtH * aspect));
  rt.setSize(rtW, rtH);
  quadMat.uniforms.uRes.value.set(rtW, rtH);
  const dbg = document.getElementById('debug');
  if (dbg && dbg.style.display === 'block') dbg.textContent = debugLine(w, h, rtW, rtH);
}
function debugLine(w, h, rtW, rtH) {
  return `canvas ${w}x${h} | rt ${rtW}x${rtH} | inner ${innerWidth}x${innerHeight}` +
    ` | room ${roomKey} | pos ${player.position.x.toFixed(1)},${player.position.z.toFixed(1)}` +
    ` | moving ${!!playerTarget} | keys ${held.size}`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
resize();

window.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    const dbg = document.getElementById('debug');
    dbg.style.display = dbg.style.display === 'block' ? 'none' : 'block';
    e.preventDefault();
  }
});

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (current) {
    update(dt);
    objTimer += dt;
    if (objTimer > 0.5) {
      objTimer = 0;
      ui.setObjective(game.objective());
      const dbg = document.getElementById('debug');
      if (dbg && dbg.style.display === 'block') {
        dbg.textContent = debugLine(
          Math.round(canvas.getBoundingClientRect().width),
          Math.round(canvas.getBoundingClientRect().height),
          rt.width, rt.height
        );
      }
    }
  }
  quadMat.uniforms.uTime.value = time;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

ui.showIntro(() => {
  sound.ensure();
  ui.showHUD(true);
  ui.toast('CLICK TO WALK  •  CLICK PEOPLE / THINGS TO ACT  •  ESC CLOSES DIALOGUE');
  setTimeout(() => ui.toast('CHAPTER 1: SWEET LIFE LOUNGE'), 900);
  enterRoom('lounge', { x: 0, z: 4 });
});

window.LSL = { player, sound, ui, game, get room() { return roomKey; }, get target() { return playerTarget; } };
