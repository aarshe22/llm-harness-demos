import * as THREE from "../vendor/three.module.js";
import { defaultConfig, applyCalm, applyDanger, performanceWarning } from "./config.js";
import { BIOMES, finalScore } from "./rules.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { LogicalTrail } from "./trail.js";
import { createMoth, updateMoth, collectFirefly, hit, collectRadius } from "./moth.js";
import { createWorld, collideMoth } from "./world.js";
import { updatePredator } from "./predators.js";
import { createUI } from "./ui.js";

const SAVE_KEY = "glow-save-v1";

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}
function writeSave(d) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(d));
}

const canvas = document.getElementById("view");
const overlay = document.getElementById("ui");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x071018, 0.018);

const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 420);
const clock = new THREE.Clock();

let cfg = Object.assign(defaultConfig(), loadSave().custom || {});
let preset = loadSave().preset || "default";
const defaults = defaultConfig();

const input = createInput(canvas);
const audio = createAudio();
const moth = createMoth(scene);
const trail = new LogicalTrail();
trail.attach(scene);
let world = createWorld(scene, cfg);
world.stream(moth.root.position);

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(16 * cfg.moon_size, 24, 18),
  new THREE.MeshBasicMaterial({ color: 0xd6e6ff })
);
moon.position.set(90, 72, -190);
scene.add(moon);
const moonLight = new THREE.DirectionalLight(0x88a0cc, 0.18 * cfg.moon_brightness);
moonLight.position.set(40, 60, -80);
scene.add(moonLight);
const amb = new THREE.AmbientLight(0x102030, 0.16);
scene.add(amb);

const starGroup = new THREE.Group();
scene.add(starGroup);
(function stars() {
  const n = Math.floor(220 * cfg.star_density);
  const g = new THREE.SphereGeometry(0.16, 6, 6);
  const m = new THREE.MeshBasicMaterial({ color: 0xd0e6ff });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(g, m);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.55 + 0.15, Math.random() - 0.5).normalize();
    s.position.copy(dir.multiplyScalar(210));
    starGroup.add(s);
  }
})();

let phase = "title";
let paused = false;
let playTime = 0;
let fireflies = 0;
let score = 0;
let escaped = 0;
let nearMisses = 0;
let overglowEvents = 0;
const regions = new Set();
let camMode = loadSave().camera === "first" ? "first" : "follow";
let camBlend = camMode === "first" ? 0 : 1;
let debugOn = false;
let lastNear = 0;

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function resetRun() {
  playTime = 0;
  fireflies = 0;
  score = 0;
  escaped = 0;
  nearMisses = 0;
  overglowEvents = 0;
  regions.clear();
  moth.root.position.set(24, 6, 24);
  moth.vel.set(0, 0, 0);
  moth.glow = 1;
  moth.energy = 1;
  moth.overglow = 0;
  moth.combo = 0;
  moth.health = 1;
  moth.state = "healthy";
  moth.dead = false;
  moth.distance = 0;
  moth.web = 0;
}

function play() {
  audio.unlock();
  resetRun();
  phase = "play";
  paused = false;
  canvas.requestPointerLock?.();
  ui.setPhase("play");
}

const ui = createUI(overlay, {
  play,
  calm() {
    cfg = defaultConfig();
    applyCalm(cfg);
    preset = "calm";
    rebuildWorld();
    play();
  },
  applyCustom(patch) {
    Object.assign(cfg, patch);
    cfg.crow_population = cfg.owl_population;
    cfg.bat_population = cfg.owl_population * 0.9;
    preset = "custom";
    const save = loadSave();
    save.custom = { ...cfg };
    save.preset = preset;
    writeSave(save);
    rebuildWorld();
  },
  resetCustom() {
    cfg = defaultConfig();
    preset = "default";
    ui.sync();
  },
  resume() {
    paused = false;
    phase = "play";
    canvas.requestPointerLock?.();
    ui.setPhase("play");
  },
  menu() {
    phase = "title";
    paused = false;
    document.exitPointerLock?.();
    ui.setPhase("title");
  },
  again() {
    play();
  },
  config: () => cfg,
  warning: () => performanceWarning(cfg),
  setJoy(v) {
    input.state.joy.x = v.x;
    input.state.joy.y = v.y;
  },
  addSteer(x, y) {
    input.state.look.x += x;
    input.state.look.y += y;
  },
  touch(act, down) {
    if (act === "boost") input.state.boost = down;
    if (act === "dim") input.state.dim = down;
    if (act === "rise") input.state.keys[down ? "add" : "delete"]?.("Space");
    if (act === "descend") input.state.keys[down ? "add" : "delete"]?.("ControlLeft");
    if (act === "camera" && down) toggleCam();
    if (act === "pause" && down) togglePause();
  },
});

function rebuildWorld() {
  scene.remove(world.group);
  world = createWorld(scene, cfg);
  world.stream(moth.root.position);
}

function toggleCam() {
  camMode = camMode === "follow" ? "first" : "follow";
  const s = loadSave();
  s.camera = camMode;
  writeSave(s);
}

function togglePause() {
  if (phase !== "play" && phase !== "pause") return;
  paused = !paused;
  phase = paused ? "pause" : "play";
  if (paused) document.exitPointerLock?.();
  else canvas.requestPointerLock?.();
  ui.setPhase(paused ? "pause" : "play");
}

addEventListener("keydown", (e) => {
  if (e.code === "KeyC") toggleCam();
  if (e.code === "Escape") {
    e.preventDefault();
    if (phase === "play") togglePause();
    else if (phase === "pause") togglePause();
  }
  if (e.code === "F3") debugOn = !debugOn;
  if (e.code === "Enter" && e.altKey) {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase === "play") togglePause();
});

function updateFireflies(dt) {
  const radius = collectRadius(moth, cfg);
  for (const f of world.all("flies")) {
    if (f.userData.collected) continue;
    f.userData.t += dt;
    f.position.y += Math.sin(f.userData.t * 2.4) * 0.008;
    const d = f.position.distanceTo(moth.root.position);
    if (d < 11 && moth.glow > 0.35) {
      f.position.lerp(moth.root.position, dt * moth.glow * cfg.firefly_attraction * 0.9);
    }
    if (d < radius * 0.45) {
      f.userData.collected = true;
      f.visible = false;
      const n = f.userData.rare ? 3 : 1;
      fireflies += n;
      score += Math.floor(12 * n * cfg.firefly_score_value);
      if (collectFirefly(moth, cfg)) overglowEvents += 1;
      audio.chime();
    }
  }
}

function updateCamera(dt) {
  const target = camMode === "first" ? 0 : 1;
  camBlend += (target - camBlend) * (1 - Math.exp(-dt / 0.35));
  const portrait = innerHeight > innerWidth;
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(moth.root.quaternion);
  const up = new THREE.Vector3(0, 1, 0);
  const follow = moth.root.position.clone().add(up.clone().multiplyScalar(portrait ? 3.1 : 2.4)).add(back.multiplyScalar(portrait ? 7.4 : 6.2));
  const fp = moth.root.position.clone().add(new THREE.Vector3(0, 0.12, -0.18).applyQuaternion(moth.root.quaternion));
  const pos = fp.lerp(follow, camBlend);
  camera.position.lerp(pos, 1 - Math.exp(-8 * dt));
  const ahead = moth.root.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(moth.root.quaternion).multiplyScalar(6));
  if (portrait && camBlend > 0.5) ahead.y += 1.6;
  camera.lookAt(ahead);
  camera.fov = THREE.MathUtils.lerp(78, 62, camBlend) + moth.vel.length() * 0.35;
  camera.updateProjectionMatrix();
}

function die() {
  phase = "dead";
  paused = true;
  document.exitPointerLock?.();
  audio.danger();
  const final = finalScore(fireflies, playTime, moth.distance, escaped, nearMisses, overglowEvents);
  score = Math.max(score, final);
  const s = loadSave();
  s.high_score = Math.max(s.high_score || 0, score);
  s.longest_survival = Math.max(s.longest_survival || 0, playTime);
  s.longest_distance = Math.max(s.longest_distance || 0, moth.distance);
  s.most_fireflies = Math.max(s.most_fireflies || 0, fireflies);
  writeSave(s);
  ui.stats(
    `FIREFLIES ${fireflies}\nSURVIVAL ${playTime.toFixed(0)}s\nDISTANCE ${moth.distance.toFixed(0)}\nESCAPED ${escaped}\nNEAR MISSES ${nearMisses}\nREGIONS ${regions.size}\nOVERGLOW ${overglowEvents}\nSCORE ${score}\nBEST ${s.high_score}`
  );
  ui.setPhase("dead");
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const st = input.poll();
  if (phase === "play" && !paused) {
    playTime += dt;
    const look = input.consumeLook(cfg.mouse_sensitivity);
    updateMoth(moth, st, cfg, dt, look);
    const col = collideMoth(moth, world);
    if (col === "hard" && hit(moth, "hard", 0.22)) die();
    if (col === "web") moth.web = 1.5;
    trail.push(moth.root.position, moth.glow * cfg.trail_brightness, new THREE.Vector3(0, 0, -1).applyQuaternion(moth.root.quaternion), moth.vel, dt, cfg);
    world.stream(moth.root.position);
    updateFireflies(dt);
    const biome = world.currentBiome(moth.root.position);
    regions.add(biome);
    scene.fog.density = 0.014 * cfg.fog_density * (BIOMES[biome].dark * 0.6 + 0.7);
    for (const p of world.all("preds")) {
      const ev = updatePredator(p, moth, trail, cfg, dt, {
        hoot: () => audio.hoot(),
        escaped: () => {
          escaped += 1;
          score += 40;
        },
      });
      if (ev === "kill" && hit(moth, "predator")) die();
      if (ev === "near" && performance.now() - lastNear > 800) {
        lastNear = performance.now();
        nearMisses += 1;
        score += 25;
        audio.near();
      }
    }
    if (moth.dead && phase === "play") die();
    ui.hud(fireflies, moth.energy);
  }
  if (phase !== "title") updateCamera(dt);
  else {
    camera.position.set(18, 9, 38);
    camera.lookAt(moth.root.position);
  }
  moon.rotation.y += dt * 0.01;
  renderer.render(scene, camera);
  if (debugOn) {
    const b = world.currentBiome(moth.root.position);
    ui.debug(
      `FPS ${Math.round(1 / dt)}\nxyz ${moth.root.position.x.toFixed(1)} ${moth.root.position.y.toFixed(1)} ${moth.root.position.z.toFixed(1)}\nspd ${moth.vel.length().toFixed(1)}\nbiome ${BIOMES[b]?.name}\nchunks ${world.chunks.size}\nglow ${moth.glow.toFixed(2)}\nseed ${cfg.seed_value}\n${preset}`,
      true
    );
  } else ui.debug("", false);
}

tick();
void applyDanger;
