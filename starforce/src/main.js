import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAudio } from './audio.js';

const TUNE_DEFAULTS = {
  moveSpeed: 15.8,
  focusSpeed: 7.4,
  lane: 12.2,
  mouseResponse: 11,
  fireRate: 0.115,
  shotSpeed: 56,
  damage: 1,
  weapon: 0,
  autofire: true,
  lives: 3,
  bombs: 3,
  regen: 14,
  incoming: 1,
  nova: 14,
  invincible: false,
  scrollBase: 17,
  scrollRamp: 9,
  spawnGap: 1,
  enemySpeed: 1,
  hostileSpeed: 1,
  enemyHp: 1,
  biomeLength: 1300,
  bossGap: 1750,
  chainStep: 8,
  bloom: 0.72,
  bloomRadius: 0.38,
  bloomThreshold: 0.42,
  camHeight: 7.4,
  camDistance: 8.6,
  shipScale: 1.28,
  shake: 1,
  fov: 60,
  fogFar: 190,
  volume: 0.8,
};

const tune = { ...TUNE_DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('starforce-tune') || '{}');
  for (const key of Object.keys(TUNE_DEFAULTS)) {
    if (typeof saved[key] === typeof TUNE_DEFAULTS[key]) tune[key] = saved[key];
  }
} catch { /* keep defaults */ }

const BIOMES = [
  { name: 'NEON ABYSS', fog: '#070112', skyTop: '#14082a', skyBot: '#05010c', ground: '#14081c', edge: '#2a1038', glow: '#3de7ff', root: 55 },
  { name: 'CRYSTAL DRIFT', fog: '#041018', skyTop: '#123040', skyBot: '#061018', ground: '#071820', edge: '#123848', glow: '#b8fbff', root: 62 },
  { name: 'EMBER REACH', fog: '#140704', skyTop: '#3a1408', skyBot: '#120604', ground: '#1a0c08', edge: '#4a1c0c', glow: '#ffb15a', root: 49 },
  { name: 'VERDANT SIGNAL', fog: '#03140c', skyTop: '#0c3020', skyBot: '#04140c', ground: '#07180e', edge: '#14502c', glow: '#7dff9a', root: 65.41 },
  { name: 'SOLAR VEIL', fog: '#120e06', skyTop: '#3a2a10', skyBot: '#100c06', ground: '#161208', edge: '#4a3814', glow: '#ffe08a', root: 73.42 },
];

const WEAPONS = ['VECTOR', 'TRIDENT', 'HALO', 'LANCER', 'ASCENDANT'];
const ENEMY_HP = { wisp: 1, lancer: 2, weaver: 2, turret: 3, splitter: 3, brute: 10, sat: 6, relic: 1 };
const ENEMY_R = { wisp: 0.55, lancer: 0.62, weaver: 0.6, turret: 0.75, splitter: 0.7, brute: 1.15, sat: 0.55, relic: 0.48 };
const ENEMY_EXTRA = { wisp: 6, lancer: 16, weaver: 8, turret: 0, splitter: 7, brute: 4, sat: 0, relic: 0 };
const ENEMY_COLOR = {
  wisp: 0xff5d8f,
  lancer: 0xffb020,
  weaver: 0xd08cff,
  turret: 0xff4d2e,
  splitter: 0xff7a3c,
  brute: 0xff3355,
  sat: 0xffe28a,
  relic: 0xffe9a8,
};
const SHOOTS = { turret: 1.45, weaver: 2.1, splitter: 1.7, brute: 1.25, sat: 1.65 };

const audio = createAudio();
const quick = new URLSearchParams(location.search).has('quick');

const hud = document.getElementById('hud');
const dock = document.getElementById('dock');
const hint = document.getElementById('hint');
const titleEl = document.getElementById('title');
const overEl = document.getElementById('gameover');
const pauseEl = document.getElementById('paused');
const bossBar = document.getElementById('bossbar');
const banner = document.getElementById('banner');
const popups = document.getElementById('popups');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const grazeEl = document.getElementById('graze');
const sectorEl = document.getElementById('sector');
const biomeEl = document.getElementById('biome');
const distEl = document.getElementById('dist');
const bestEl = document.getElementById('best');
const titleBest = document.getElementById('title-best');
const shieldFill = document.getElementById('shieldfill');
const bossFill = document.getElementById('bossfill');
const weaponName = document.getElementById('weapon-name');
const pipsEl = document.getElementById('pips');
const novasEl = document.getElementById('novas');
const livesEl = document.getElementById('lives');
const statsEl = document.getElementById('stats');
const hurtEl = document.getElementById('hurt');
const muteBtn = document.getElementById('mute');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'view';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070112, 48, 190);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 13.4, 18.6);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.38, 0.42);
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(bloomPass);

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(baseTexture, vUv);
        vec4 bloom = texture2D(bloomTexture, vUv);
        gl_FragColor = vec4(base.rgb + bloom.rgb, 1.0);
      }
    `,
  }),
  'baseTexture'
);
mixPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());

function markBloom(mesh) {
  mesh.layers.enable(1);
  return mesh;
}

function glowMat(hex, intensity = 1.6) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color });
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(220,250,255,0.75)');
  grd.addColorStop(0.55, 'rgba(120,210,255,0.2)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTex = makeGlowTexture();

const groundUniforms = {
  uScroll: { value: 0 },
  uTime: { value: 0 },
  uA: { value: new THREE.Color(BIOMES[0].ground) },
  uB: { value: new THREE.Color(BIOMES[0].edge) },
  uC: { value: new THREE.Color(BIOMES[0].glow) },
  uFog: { value: new THREE.Color(BIOMES[0].fog) },
};

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 300, 80, 140),
  new THREE.ShaderMaterial({
    uniforms: groundUniforms,
    vertexShader: `
      uniform float uScroll;
      varying float vHeight;
      varying float vRawZ;
      varying float vPattern;
      varying float vX;

      void main() {
        vec3 pos = position;
        float patternZ = mod(pos.z - uScroll + 400.0, 400.0);
        float edge = smoothstep(9.0, 34.0, abs(pos.x));
        float dunes = sin(patternZ * 6.2831853 / 400.0 + pos.x * 0.05);
        float ripples = sin(patternZ * 6.2831853 / 80.0) * sin(pos.x * 0.18);
        float h = (dunes * 0.85 + ripples * 0.55) * edge * 2.4;
        pos.y += h;
        vHeight = h;
        vRawZ = pos.z;
        vPattern = patternZ;
        vX = pos.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uA;
      uniform vec3 uB;
      uniform vec3 uC;
      uniform vec3 uFog;
      uniform float uTime;
      varying float vHeight;
      varying float vRawZ;
      varying float vPattern;
      varying float vX;

      float grid(vec2 uv) {
        vec2 g = abs(fract(uv - 0.5) - 0.5);
        vec2 w = max(fwidth(uv), vec2(0.002));
        vec2 a = smoothstep(vec2(0.0), w * 1.6, g);
        return 1.0 - min(a.x, a.y);
      }

      void main() {
        float minor = grid(vec2(vX * 0.32, vPattern * 0.32));
        float major = grid(vec2(vX * 0.08, vPattern * 0.08));
        float beam = exp(-abs(vX) * 1.05);
        float flow = 0.5 + 0.5 * sin(vPattern * 0.22 - uTime * 4.0);
        float chev = smoothstep(0.02, 0.0, abs(fract(vPattern * 0.05) - 0.12));
        chev *= exp(-abs(vX) * 0.28);
        float nearShip = 1.0 - smoothstep(-2.0, 16.0, vRawZ);

        vec3 col = mix(uA, uB, smoothstep(0.15, 1.8, vHeight) * 0.85 + smoothstep(6.0, 24.0, abs(vX)) * 0.35);
        col *= 0.28;
        col += uC * minor * 0.42;
        col += uC * major * 0.9;
        col += uC * beam * flow * 0.72 * nearShip;
        col += uC * chev * 0.45 * nearShip;

        float spec = step(0.993, fract(sin(dot(floor(vec2(vX, vPattern) * 0.35), vec2(127.1, 311.7))) * 43758.5));
        col += vec3(0.75, 0.92, 1.0) * spec * 0.35;

        float fade = smoothstep(150.0, 36.0, abs(vRawZ));
        col = mix(uFog, col, fade);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
ground.geometry.rotateX(-Math.PI / 2);
markBloom(ground);
scene.add(ground);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color(BIOMES[0].skyTop) },
    uBot: { value: new THREE.Color(BIOMES[0].skyBot) },
  },
  vertexShader: `
    varying vec3 vP;
    void main() {
      vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vP;
    uniform vec3 uTop;
    uniform vec3 uBot;
    void main() {
      float h = normalize(vP).y * 0.5 + 0.5;
      gl_FragColor = vec4(mix(uBot, uTop, smoothstep(0.05, 0.75, h)), 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), skyMat));

const starPositions = new Float32Array(800 * 3);
for (let i = 0; i < 800; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 160;
  starPositions[i * 3 + 1] = Math.random() * 48 + 4;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
}
const stars = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({
    color: 0xd7f4ff,
    size: 0.16,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
);
stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene.add(stars);

function makeNebula(x, y, z, scale) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color: new THREE.Color(BIOMES[0].glow),
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale * 0.62, 1);
  scene.add(sprite);
  return sprite;
}
const nebulas = [
  makeNebula(-28, 10, -40, 78),
  makeNebula(32, 14, -70, 90),
  makeNebula(0, 18, -20, 70),
];

const planetMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: {
    uTime: { value: 0 },
    uA: { value: new THREE.Color('#16345c') },
    uB: { value: new THREE.Color('#d8fbff') },
  },
  vertexShader: `
    varying vec3 vN;
    varying vec3 vP;
    void main() {
      vN = normalize(normalMatrix * normal);
      vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vN;
    varying vec3 vP;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform float uTime;
    void main() {
      vec3 n = normalize(vN);
      float fres = pow(1.0 - max(dot(n, normalize(vec3(0.15, 0.35, 0.9))), 0.0), 1.5);
      float bands = 0.5 + 0.5 * sin(vP.y * 9.0 + sin(vP.x * 3.0 + uTime * 0.15));
      float cities = step(0.86, fract(sin(dot(floor(vP.xy * 5.0), vec2(12.9, 78.2))) * 43758.5));
      vec3 col = mix(uA, uB, bands * 0.28 + fres);
      col += uB * cities * fres * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const planet = new THREE.Group();
planet.position.set(6, 9.5, -78);
const planetBody = new THREE.Mesh(new THREE.SphereGeometry(13, 48, 32), planetMat);
planet.add(planetBody);
const planetRing = new THREE.Mesh(new THREE.TorusGeometry(18, 0.12, 8, 64), glowMat(0xd8fbff, 1.3));
planetRing.rotation.x = 1.15;
planetRing.rotation.y = 0.4;
markBloom(planetRing);
planet.add(planetRing);
const corona = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex,
  color: 0xcff6ff,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
}));
corona.scale.set(42, 42, 1);
corona.position.z = 8;
markBloom(corona);
planet.add(corona);
scene.add(planet);

const hemi = new THREE.HemisphereLight(0x8eb4ff, 0x1a1020, 0.38);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e4, 0.55);
sun.position.set(-12, 22, 14);
scene.add(sun);
const fxLight = new THREE.PointLight(0x88eeff, 0, 16, 2);
scene.add(fxLight);

const hullMat = new THREE.MeshStandardMaterial({
  color: 0xd7e6f0,
  metalness: 0.48,
  roughness: 0.34,
  emissive: 0x163040,
  emissiveIntensity: 0.45,
});
const engineMat = glowMat(0x9af7ff, 2.5);
const ship = new THREE.Group();

const shape = new THREE.Shape();
shape.moveTo(0, 1.4);
shape.lineTo(0.16, 0.45);
shape.lineTo(1.2, -0.5);
shape.lineTo(0.38, -0.28);
shape.lineTo(0.2, -0.95);
shape.lineTo(0, -0.7);
shape.lineTo(-0.2, -0.95);
shape.lineTo(-0.38, -0.28);
shape.lineTo(-1.2, -0.5);
shape.lineTo(-0.16, 0.45);
const hullGeo = new THREE.ExtrudeGeometry(shape, {
  depth: 0.16,
  bevelEnabled: true,
  bevelThickness: 0.035,
  bevelSize: 0.028,
  bevelSegments: 2,
  curveSegments: 6,
});
hullGeo.center();
hullGeo.rotateX(-Math.PI / 2);
const hull = new THREE.Mesh(hullGeo, hullMat);
ship.add(hull);

const canopy = new THREE.Mesh(
  new THREE.SphereGeometry(0.2, 16, 12),
  new THREE.MeshStandardMaterial({
    color: 0xb9f3ff,
    emissive: 0x1c6f88,
    emissiveIntensity: 0.9,
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: 0.9,
  })
);
canopy.scale.set(1, 0.62, 1.5);
canopy.position.set(0, 0.12, -0.25);
ship.add(canopy);

function stripe(x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), engineMat);
  mesh.position.set(x, 0.07, z);
  markBloom(mesh);
  ship.add(mesh);
}
stripe(0.62, -0.05, 0.55, 0.06);
stripe(-0.62, -0.05, 0.55, 0.06);
stripe(0, -0.55, 0.06, 0.7);

const engineL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.28, 8), hullMat);
engineL.rotation.x = Math.PI / 2;
engineL.position.set(-0.22, 0.02, 0.62);
ship.add(engineL);
const engineR = engineL.clone();
engineR.position.x = 0.22;
ship.add(engineR);

function engineGlow(x) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xbff8ff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.95,
  }));
  sprite.position.set(x, 0.02, 0.86);
  sprite.scale.set(0.28, 0.28, 1);
  ship.add(sprite);
  return sprite;
}
const exhausts = [engineGlow(-0.22), engineGlow(0.22)];
const engineLight = new THREE.PointLight(0x9af4ff, 2.4, 7, 2);
engineLight.position.set(0, 0.2, 0.7);
ship.add(engineLight);

const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.42), hullMat);
fin.position.set(0, 0.18, 0.28);
ship.add(fin);

const shieldBubble = new THREE.Mesh(
  new THREE.TorusGeometry(1.05, 0.025, 8, 28),
  new THREE.MeshBasicMaterial({
    color: 0x9af6ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
markBloom(shieldBubble);
ship.add(shieldBubble);

ship.scale.setScalar(1.28);
scene.add(ship);

const focusRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.018, 8, 28), glowMat(0xe7fbff, 2.2));
markBloom(focusRing);
focusRing.visible = false;
scene.add(focusRing);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.95, 20),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

const drones = [0, 1].map(() => {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat(0xd8fbff, 2.2));
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
});

const GEOS = {
  wisp: new THREE.TetrahedronGeometry(0.48, 0),
  lancer: new THREE.ConeGeometry(0.36, 1.15, 5),
  weaver: new THREE.TorusGeometry(0.38, 0.08, 8, 16),
  turret: new THREE.CylinderGeometry(0.5, 0.68, 0.62, 6),
  splitter: new THREE.IcosahedronGeometry(0.5, 0),
  brute: new THREE.DodecahedronGeometry(0.72, 0),
  sat: new THREE.SphereGeometry(0.36, 12, 10),
  relic: new THREE.OctahedronGeometry(0.42, 0),
};
GEOS.lancer.rotateX(Math.PI / 2);

const trimMat = glowMat(BIOMES[0].glow, 1.8);
const hazardMat = glowMat(0xff3355, 1.7);
const metalMat = new THREE.MeshBasicMaterial({ color: 0x121a24 });

function take(pool) {
  for (let i = 0; i < pool.length; i++) if (!pool[i].alive) return pool[i];
  return null;
}

function bury(pool) {
  for (const item of pool) {
    item.alive = false;
    if (item.mesh) item.mesh.visible = false;
  }
}

let serial = 1;
const enemies = Array.from({ length: 48 }, () => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff5d8f });
  const mesh = new THREE.Mesh(GEOS.wisp, mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, type: 'wisp', x: 0, y: 1.2, z: 0, hp: 1, r: 0.5, extra: 6, cool: 1, phase: 0, baseX: 0, aimX: 0, age: 0, spin: 1, angle: 0, id: 0, flash: 0 };
});

const pbullets = Array.from({ length: 100 }, () => {
  const mat = glowMat(0x9af7ff, 2.4);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, alive: false, x: 0, z: 0, vx: 0, vz: 0, r: 0.45, pierce: false, hits: 0, dmg: 1, last: 0, lastAt: -1 };
});

const ebullets = Array.from({ length: 180 }, () => {
  const mat = glowMat(0xff4d8d, 1.8);
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, alive: false, x: 0, z: 0, vx: 0, vz: 0, r: 0.28, life: 5, grazed: false };
});

const particles = Array.from({ length: 180 }, () => {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 1,
  });
  const mesh = new THREE.Sprite(mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.4 };
});

const rings = Array.from({ length: 10 }, () => {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 28), mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, life: 0, max: 0.5, grow: 8 };
});

const pickups = Array.from({ length: 14 }, () => {
  const mat = glowMat(0x9af7ff, 2);
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, kind: 'power', x: 0, z: 0, r: 0.7 };
});
const pickupGeo = {
  power: new THREE.OctahedronGeometry(0.32, 0),
  nova: new THREE.TorusGeometry(0.28, 0.07, 8, 14),
  shield: new THREE.SphereGeometry(0.26, 12, 10),
};

function createStructure() {
  const group = new THREE.Group();
  const mono = new THREE.Group();
  const monolith = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.5, 0.7), metalMat);
  monolith.position.y = 1.75;
  const mlight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.12), trimMat);
  mlight.position.y = 1.85;
  markBloom(mlight);
  mono.add(monolith, mlight);

  const base = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.26, 6), metalMat);
  pad.position.y = 0.13;
  const pglow = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.04, 6, 18), trimMat);
  pglow.rotation.x = Math.PI / 2;
  pglow.position.y = 0.3;
  markBloom(pglow);
  base.add(pad, pglow);

  const hazard = new THREE.Group();
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.55, 5), metalMat);
  spike.position.y = 0.78;
  const coreMat = hazardMat.clone();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), coreMat);
  core.position.y = 1.2;
  markBloom(core);
  hazard.add(spike, core);

  group.add(mono, base, hazard);
  group.visible = false;
  scene.add(group);
  return { mesh: group, parts: { deco: mono, base, hazard }, coreMat, alive: false, kind: 'deco', hp: 0, r: 1, x: 0, z: 0, flash: 0 };
}
const structures = Array.from({ length: 22 }, createStructure);

const crystals = Array.from({ length: 10 }, () => {
  const mat = glowMat(0xbff8ff, 1.8);
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, x: 0, z: 0, baseY: 2, phase: 0, spin: 1, r: 0.75 };
});

const gateMat = glowMat(0xffe29a, 2);
const gate = {
  mesh: markBloom(new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.055, 10, 36), gateMat)),
  alive: false,
  taken: false,
  x: 0,
  z: 0,
};
gate.mesh.visible = false;
scene.add(gate.mesh);

const bossCoreMat = glowMat(0xffd27a, 1.5);
const boss = {
  mesh: new THREE.Group(),
  alive: false,
  hp: 200,
  maxHp: 200,
  x: 0,
  z: -40,
  age: 0,
  fire: 1.2,
  stun: 0,
  hit: 0,
};
const bossCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0), bossCoreMat);
markBloom(bossCore);
const bossRing = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 8, 32), glowMat(0xfff6d0, 1.8));
bossRing.rotation.x = Math.PI / 2;
markBloom(bossRing);
const bossShellMat = new THREE.MeshBasicMaterial({
  color: 0xbfefff,
  transparent: true,
  opacity: 0.12,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const bossShell = new THREE.Mesh(new THREE.SphereGeometry(2.35, 24, 16), bossShellMat);
markBloom(bossShell);
boss.mesh.add(bossCore, bossRing, bossShell);
boss.mesh.visible = false;
scene.add(boss.mesh);

const streaks = Array.from({ length: 18 }, () => {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xcff7ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 2.4), mat);
  markBloom(mesh);
  mesh.position.set((Math.random() - 0.5) * 30, 1 + Math.random() * 6, (Math.random() - 0.5) * 80);
  scene.add(mesh);
  return mesh;
});

const player = {
  x: 0, z: 8, vx: 0, vz: 0, level: 0, shield: 100, shieldDelay: 0,
  lives: 3, bombs: 3, invuln: 0, cd: 0, over: 0, novaCd: 0, punch: 0, droneCd: 0,
};
const pointer = { x: 0, z: 8 };
let steer = 'mouse';
let mode = 'title';
let paused = false;
let time = 0;
let scroll = 0;
let shake = 0;
const keys = new Set();

const state = {
  score: 0,
  distance: 0,
  combo: 0,
  comboTimer: 0,
  bestCombo: 0,
  graze: 0,
  kills: 0,
  biomeIndex: 0,
  biomeBlend: 1,
  nextBoss: quick ? 40 : tune.bossGap * 0.68,
  calm: 0,
  slow: 0,
  spawn: 0.4,
  sinceRelic: 12,
  nextGate: quick ? 30 : 420,
  lifeScore: 0,
  bombMark: 0,
};

const shown = { lives: -1, level: -1, bombs: -1, biome: '' };

function loadBest() {
  try { return JSON.parse(localStorage.getItem('starforce-best') || '{}'); }
  catch { return {}; }
}
function saveBest() {
  const prev = loadBest();
  const best = {
    score: Math.max(prev.score || 0, state.score),
    distance: Math.max(prev.distance || 0, state.distance),
  };
  try { localStorage.setItem('starforce-best', JSON.stringify(best)); } catch { /* ignore */ }
  return best;
}
function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }

function paintBest() {
  const best = loadBest();
  const label = best.score ? `BEST ${fmt(best.score)}` : 'NO RECORD YET';
  titleBest.textContent = label;
  bestEl.textContent = best.score ? `BEST ${fmt(best.score)}` : 'BEST —';
}
paintBest();

function scrollSpeed() {
  if (mode !== 'play') return tune.scrollBase * 0.7;
  return tune.scrollBase + Math.min(1, state.distance / 12000) * tune.scrollRamp;
}
function heat() { return Math.min(1, state.distance / 10000); }
function mult() { return 1 + Math.floor(state.combo / Math.max(1, tune.chainStep)); }

function announce(title, sub = '') {
  banner.innerHTML = `<strong>${title}</strong>${sub ? `<span>${sub}</span>` : ''}`;
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
}

function popup(text, x, z, kind = '') {
  const v = new THREE.Vector3(x, 2.1, z);
  v.project(camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = `pop ${kind}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  popups.appendChild(el);
  setTimeout(() => el.remove(), 720);
  while (popups.childElementCount > 16) popups.firstChild.remove();
}

function addScore(n, x, z, kind = '') {
  const gain = Math.round(n * mult());
  state.score += gain;
  if (x !== undefined) popup(kind === 'graze' ? 'GRAZE' : `+${fmt(gain)}`, x, z, kind);
  if (state.score - state.lifeScore >= 50000) {
    state.lifeScore += 50000;
    player.lives = Math.min(6, player.lives + 1);
    announce('EXTRA STAR', 'WING RESTORED');
    audio.chime();
  }
}

function burst(x, y, z, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const p = take(particles);
    if (!p) return;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random());
    p.alive = true;
    p.life = p.max = 0.22 + Math.random() * 0.38;
    p.vx = Math.cos(a) * s;
    p.vz = Math.sin(a) * s;
    p.vy = 1.2 + Math.random() * 4.5;
    p.size = 0.22 + Math.random() * 0.75;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mat.color.set(color);
    p.mat.opacity = 1;
  }
}

function shockwave(x, z, color, grow = 8) {
  const ring = take(rings);
  if (!ring) return;
  ring.alive = true;
  ring.life = ring.max = 0.48;
  ring.grow = grow;
  ring.mesh.visible = true;
  ring.mesh.position.set(x, 1.2, z);
  ring.mesh.scale.setScalar(0.4);
  ring.mat.color.set(color);
  ring.mat.opacity = 0.9;
}

function flashHurt() {
  hurtEl.classList.add('on');
  setTimeout(() => hurtEl.classList.remove('on'), 70);
}

function laneEdge() {
  return (Math.random() < 0.5 ? -1 : 1) * (6.5 + Math.random() * 5.5);
}

function activateStructure(s, z) {
  const roll = Math.random();
  s.kind = roll < 0.42 ? 'deco' : roll < 0.72 ? 'base' : 'hazard';
  s.alive = true;
  s.mesh.visible = true;
  s.parts.deco.visible = s.kind === 'deco';
  s.parts.base.visible = s.kind === 'base';
  s.parts.hazard.visible = s.kind === 'hazard';
  s.hp = s.kind === 'base' ? 1 : s.kind === 'hazard' ? 3 : 0;
  s.r = s.kind === 'hazard' ? 0.85 : 1.15;
  s.x = s.kind === 'deco' ? laneEdge() * 1.15 : s.kind === 'hazard'
    ? (Math.random() < 0.7 ? laneEdge() * 0.72 : (Math.random() * 2 - 1) * 6)
    : (Math.random() * 2 - 1) * 7.5;
  s.z = z;
  s.flash = 0;
  s.coreMat.color.set(0xff3355).multiplyScalar(1.7);
  const scale = s.kind === 'deco' ? 0.85 + Math.random() * 1.35 : 1;
  s.mesh.scale.setScalar(scale);
  s.mesh.position.set(s.x, 0, s.z);
}

function activateCrystal(c, z) {
  c.alive = true;
  c.mesh.visible = true;
  c.x = Math.random() < 0.5 ? (Math.random() * 2 - 1) * 5.2 : laneEdge();
  c.z = z;
  c.baseY = 1.5 + Math.random() * 2.1;
  c.phase = Math.random() * Math.PI * 2;
  c.spin = 0.8 + Math.random() * 1.6;
  c.mat.color.copy(trimMat.color);
}

function layoutScenery() {
  bury(structures);
  bury(crystals);
  structures.forEach((s, i) => activateStructure(s, -12 - i * 7.5));
  crystals.forEach((c, i) => activateCrystal(c, -16 - i * 16));
}
layoutScenery();

function spawnEnemy(type, x, z, extra = {}) {
  const e = take(enemies);
  if (!e) return null;
  e.alive = true;
  e.type = type;
  e.id = ++serial;
  e.x = x;
  e.z = z;
  e.y = type === 'turret' ? 0.42 : type === 'relic' ? 2.3 : 1.25;
  const scaleHp = (type === 'wisp' || type === 'relic' ? 1 : 1 + heat() * 1.35) * tune.enemyHp;
  e.hp = Math.max(1, Math.round((extra.hp || ENEMY_HP[type]) * scaleHp));
  e.r = ENEMY_R[type];
  e.extra = ENEMY_EXTRA[type];
  e.cool = 0.35 + Math.random() * 0.8;
  e.phase = Math.random() * Math.PI * 2;
  e.baseX = x;
  e.aimX = x;
  e.age = 0;
  e.spin = type === 'relic' ? 4 : type === 'turret' ? 0.2 : 1.4;
  e.angle = extra.angle || 0;
  e.flash = 0;
  e.mesh.geometry = GEOS[type];
  e.mesh.visible = true;
  e.mesh.scale.setScalar(type === 'brute' ? 1.15 : 1);
  e.mat.color.set(ENEMY_COLOR[type]).multiplyScalar(type === 'relic' ? 1.8 : 1.35);
  e.mesh.position.set(e.x, e.y, e.z);
  return e;
}

function formation(type, count) {
  const base = (Math.random() * 2 - 1) * 5.5;
  for (let i = 0; i < count; i++) {
    const x = THREE.MathUtils.clamp(base + (i - (count - 1) / 2) * 2.15, -11.5, 11.5);
    spawnEnemy(type, x, -50 - i * 1.7);
  }
}

function spawnPlayerShot(x, z, vx, vz, pierce = false) {
  const b = take(pbullets);
  if (!b) return;
  b.alive = true;
  b.x = x;
  b.z = z;
  b.vx = vx;
  b.vz = vz;
  b.pierce = pierce;
  b.hits = 0;
  b.dmg = (pierce ? 2 : 1) * tune.damage;
  b.r = pierce ? 0.7 : 0.5;
  b.last = 0;
  b.lastAt = -1;
  b.mesh.visible = true;
  b.mesh.scale.set(1, 1, pierce ? 2.5 : 1);
  b.mesh.position.set(x, 1.2, z);
}

function fire() {
  const focus = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const f = focus ? 0.45 : 1;
  const shot = tune.shotSpeed / 56;
  const x = player.x;
  const z = player.z - 0.9;
  spawnPlayerShot(x - 0.32, z, -0.35 * f * shot, -56 * shot);
  spawnPlayerShot(x + 0.32, z, 0.35 * f * shot, -56 * shot);
  if (player.level >= 1) spawnPlayerShot(x, z - 0.2, 0, -60 * shot);
  if (player.level >= 2) {
    spawnPlayerShot(x - 0.2, z, -7.5 * f * shot, -50 * shot);
    spawnPlayerShot(x + 0.2, z, 7.5 * f * shot, -50 * shot);
  }
  if (player.level >= 3) spawnPlayerShot(x, z - 0.4, 0, -72 * shot, true);
  if (player.level >= 4 && player.droneCd <= 0) {
    player.droneCd = 0.26;
    spawnPlayerShot(drones[0].position.x, drones[0].position.z, 0, -54);
    spawnPlayerShot(drones[1].position.x, drones[1].position.z, 0, -54);
  }
  audio.laser();
  exhausts.forEach((s) => { s.scale.setScalar(0.95); });
}

function spawnEBullet(x, z, vx, vz, scale = 1) {
  const b = take(ebullets);
  if (!b) return;
  b.alive = true;
  b.x = x;
  b.z = z;
  b.vx = vx * tune.hostileSpeed;
  b.vz = vz * tune.hostileSpeed + scrollSpeed() * 0.42;
  b.life = 5.5;
  b.grazed = false;
  b.r = 0.26 * scale;
  b.mesh.visible = true;
  b.mesh.scale.setScalar(scale);
  b.mesh.position.set(x, 1.15, z);
}

function aimedVolley(x, z, speed, count, spread) {
  const dx = player.x - x;
  const dz = player.z - z;
  const base = Math.atan2(dx, dz);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    spawnEBullet(x, z, Math.sin(a) * speed, Math.cos(a) * speed, count > 1 ? 1.15 : 1);
  }
}

function radialVolley(x, z, count, speed, spin) {
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    spawnEBullet(x, z, Math.cos(a) * speed, Math.sin(a) * speed);
  }
}

function dropPickup(kind, x, z) {
  const p = take(pickups);
  if (!p) return;
  p.alive = true;
  p.kind = kind;
  p.x = x;
  p.z = z;
  p.mesh.geometry = pickupGeo[kind];
  p.mesh.visible = true;
  const hex = kind === 'nova' ? 0xff7a9a : kind === 'shield' ? 0x8dffb0 : 0x9af7ff;
  p.mat.color.set(hex).multiplyScalar(1.8);
  p.mesh.position.set(x, 1.3, z);
}

function killEnemy(e, scored = true) {
  if (!e.alive) return;
  e.alive = false;
  e.mesh.visible = false;
  burst(e.x, e.y, e.z, ENEMY_COLOR[e.type], e.type === 'brute' ? 16 : 8, e.type === 'brute' ? 7 : 4);
  if (e.type === 'brute' || e.type === 'relic' || e.type === 'sat') {
    shockwave(e.x, e.z, ENEMY_COLOR[e.type], 5);
    audio.boom(e.type === 'relic' ? 0.8 : 0.55);
  } else audio.tick();
  fxLight.position.set(e.x, 2, e.z);
  fxLight.color.set(ENEMY_COLOR[e.type]);
  fxLight.intensity = e.type === 'brute' ? 9 : 4;
  if (!scored) return;
  state.kills++;
  state.combo++;
  state.comboTimer = 2.7;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const worth = { wisp: 100, lancer: 140, weaver: 160, turret: 200, splitter: 180, brute: 400, sat: 350, relic: 10000 };
  addScore(worth[e.type] || 100, e.x, e.z, e.type === 'relic' ? 'relic' : '');
  if (state.combo === 20 || state.combo === 50 || state.combo === 100) {
    announce(`CHAIN ${state.combo}`, `MULTIPLIER x${mult()}`);
  }
  if (e.type === 'splitter') {
    spawnEnemy('wisp', e.x - 0.8, e.z - 0.4);
    spawnEnemy('wisp', e.x + 0.8, e.z - 0.4);
  }
  if (e.type === 'brute') dropPickup(Math.random() < 0.7 ? 'power' : 'nova', e.x, e.z);
  else if (e.type === 'sat') dropPickup(Math.random() < 0.5 ? 'power' : 'shield', e.x, e.z);
  else if (e.type === 'relic') dropPickup('nova', e.x, e.z);
  else if (player.shield < 55 && state.kills % 9 === 0) dropPickup('shield', e.x, e.z);
}

function hurt(amount) {
  if (tune.invincible || player.invuln > 0 || mode !== 'play') return;
  player.shield -= amount * tune.incoming;
  player.shieldDelay = 2.15;
  player.invuln = 0.28;
  shake = Math.min(1.2, shake + 0.45);
  audio.hit();
  flashHurt();
  if (player.shield > 0) return;
  if (player.lives <= 1) {
    player.lives = 0;
    player.shield = 0;
    endGame();
    return;
  }
  player.lives -= 1;
  player.shield = 100;
  player.invuln = 2.3;
  player.x = 0;
  player.z = 9;
  pointer.x = 0;
  pointer.z = 9;
  bury(ebullets);
  burst(player.x, 1.2, player.z, 0x9ee7ff, 18, 8);
  shockwave(player.x, player.z, 0x9ee7ff, 10);
  announce('STAR LOST', `${player.lives} REMAINING`);
}

function damageStructure(s, dmg) {
  if (!s.alive || s.hp <= 0) return;
  s.hp -= dmg;
  s.flash = 0.08;
  s.coreMat.color.set(0xffffff);
  if (s.hp > 0) return;
  const kind = s.kind;
  burst(s.x, 1, s.z, kind === 'hazard' ? 0xff4455 : 0x9af7ff, 10, 5);
  audio.tick();
  addScore(kind === 'hazard' ? 150 : 80, s.x, s.z);
  activateStructure(s, -90 - Math.random() * 40);
}

function nova() {
  if (mode !== 'play' || paused || player.bombs <= 0 || player.novaCd > 0) return;
  player.bombs--;
  player.novaCd = 0.28;
  state.slow = 0.5;
  shake = 1;
  shockwave(player.x, player.z, 0xbff8ff, 16);
  burst(player.x, 1.2, player.z, 0xd8fbff, 22, 12);
  audio.boom(1.35);
  fxLight.position.set(player.x, 2, player.z);
  fxLight.color.set(0xbff8ff);
  fxLight.intensity = 14;
  for (const e of enemies) {
    if (!e.alive) continue;
    e.hp -= tune.nova;
    if (e.hp <= 0) killEnemy(e);
  }
  if (boss.alive) {
    boss.hp -= tune.nova * 2.6;
    boss.hit = 0.12;
    if (boss.hp <= 0) defeatBoss();
  }
  for (const s of structures) {
    if (!s.alive || s.hp <= 0) continue;
    if (Math.hypot(s.x - player.x, s.z - player.z) < 16) damageStructure(s, 3);
  }
  bury(ebullets);
}

function collectPickup(p) {
  if (p.kind === 'power') {
    if (player.level >= 4) {
      player.over = 5.5;
      addScore(1000, p.x, p.z);
      announce('OVERCHARGE');
    } else {
      player.level++;
      announce(WEAPONS[player.level], 'WEAPON ONLINE');
    }
    player.shield = Math.min(100, player.shield + 15);
    player.punch = 0.22;
  } else if (p.kind === 'nova') {
    player.bombs = Math.min(5, player.bombs + 1);
    popup('NOVA', p.x, p.z);
  } else {
    player.shield = Math.min(100, player.shield + 40);
    popup('SHIELD', p.x, p.z);
  }
  audio.chime();
  burst(p.x, 1.3, p.z, 0xd8fbff, 8, 3);
  p.alive = false;
  p.mesh.visible = false;
}

function collectCrystal(c) {
  if (!c.alive) return;
  c.alive = false;
  c.mesh.visible = false;
  addScore(200, c.x, c.z, 'crystal');
  audio.tick();
  burst(c.x, c.baseY, c.z, 0xd8fbff, 6, 3);
  activateCrystal(c, -80 - Math.random() * 30);
}

function startBoss() {
  for (const e of enemies) if (e.alive) { e.alive = false; e.mesh.visible = false; }
  bury(ebullets);
  boss.alive = true;
  boss.maxHp = Math.min(520, 210 + Math.floor(state.distance / tune.biomeLength) * 36);
  boss.hp = boss.maxHp;
  boss.x = 0;
  boss.z = -52;
  boss.age = 0;
  boss.fire = 1.1;
  boss.stun = 0;
  boss.mesh.visible = true;
  player.invuln = Math.max(player.invuln, 1.15);
  for (let i = 0; i < 4; i++) spawnEnemy('sat', 0, -20, { angle: (i / 4) * Math.PI * 2 });
  announce('AEGIS CORE', 'BREAK THE SATELLITES');
  audio.boom(0.7);
  audio.chime();
}

function defeatBoss() {
  if (!boss.alive) return;
  boss.alive = false;
  boss.mesh.visible = false;
  state.combo++;
  state.comboTimer = 2.7;
  addScore(8000, boss.x, boss.z);
  burst(boss.x, 1.6, boss.z, 0xffe29a, 28, 10);
  shockwave(boss.x, boss.z, 0xffe29a, 14);
  audio.boom(1.5);
  fxLight.position.set(boss.x, 3, boss.z);
  fxLight.color.set(0xffe29a);
  fxLight.intensity = 16;
  shake = 1.15;
  state.slow = 0.7;
  state.calm = 3.2;
  state.nextBoss = state.distance + tune.bossGap;
  for (const e of enemies) if (e.alive && e.type === 'sat') killEnemy(e);
  dropPickup('power', boss.x - 1.2, boss.z);
  dropPickup('nova', boss.x + 1.2, boss.z);
  announce('CORE SHATTERED', 'SECTOR CLEAR');
}

function maybeRelic(dt) {
  state.sinceRelic -= dt;
  if (boss.alive || state.distance < 700 || state.sinceRelic > 0) return;
  if (Math.random() > 0.55) return;
  state.sinceRelic = 42;
  spawnEnemy('relic', -13.5, player.z - 8);
  announce('RELIC CONTACT', 'A GOLDEN STREAK');
  audio.chime();
}

function tickDirector(dt) {
  if (boss.alive) return;
  if (state.calm > 0) {
    state.calm -= dt;
    return;
  }
  if (state.distance >= state.nextBoss) {
    startBoss();
    return;
  }
  maybeRelic(dt);
  state.spawn -= dt;
  if (state.spawn > 0) return;
  const h = heat();
  state.spawn = THREE.MathUtils.lerp(1.2, 0.32, h) * (0.78 + Math.random() * 0.45) * tune.spawnGap;
  if (quick) state.spawn *= 0.45;
  const d = state.distance;
  if (d < 280) {
    formation('wisp', 3 + (Math.random() < 0.4 ? 1 : 0));
    return;
  }
  if (d < 700) {
    if (Math.random() < 0.55) formation('wisp', 4);
    else formation('lancer', 2);
    if (Math.random() < 0.35) spawnEnemy('turret', laneEdge(), -60);
    return;
  }
  const roll = Math.random();
  if (roll < 0.26) formation('wisp', 4 + Math.floor(h * 3));
  else if (roll < 0.44) formation('lancer', 2 + Math.floor(h * 2));
  else if (roll < 0.6) formation('weaver', 2 + (Math.random() < h ? 1 : 0));
  else if (roll < 0.74) {
    spawnEnemy('turret', laneEdge(), -62);
    if (h > 0.35 && Math.random() < 0.55) spawnEnemy('turret', laneEdge(), -70);
  } else if (roll < 0.88) formation('splitter', 1 + Math.floor(h * 2));
  else formation('brute', 1);
}

function updateEnemies(dt) {
  const scrollV = scrollSpeed();
  for (const e of enemies) {
    if (!e.alive) continue;
    e.age += dt;
    if (e.type === 'sat') {
      if (!boss.alive) { e.alive = false; e.mesh.visible = false; continue; }
      e.angle += dt * 0.95;
      e.x = boss.x + Math.cos(e.angle) * 4.3;
      e.z = boss.z + Math.sin(e.angle) * 2.5;
      e.y = 1.85 + Math.sin(e.angle * 2) * 0.25;
    } else if (e.type === 'relic') {
      e.x += 9.5 * dt;
      e.z += scrollV * 0.25 * dt;
      e.y = 2.3 + Math.sin(time * 5) * 0.25;
      if (e.x > 15) { e.alive = false; e.mesh.visible = false; continue; }
    } else if (e.type === 'lancer') {
      if (e.age < 1.05) e.aimX = player.x;
      e.x += (e.aimX - e.x) * Math.min(1, 3.2 * dt);
      e.z += (scrollV + e.extra * tune.enemySpeed) * dt;
    } else if (e.type === 'weaver') {
      e.x = e.baseX + Math.sin(e.age * 2.3 + e.phase) * 3.4;
      e.z += (scrollV + e.extra * tune.enemySpeed) * dt;
    } else if (e.type === 'wisp' || e.type === 'splitter') {
      e.x = e.baseX + Math.sin(e.age * 1.5 + e.phase) * (e.type === 'splitter' ? 2.4 : 1.6);
      e.z += (scrollV + e.extra * tune.enemySpeed) * dt;
    } else {
      e.z += (scrollV + e.extra * tune.enemySpeed) * dt;
    }

    if (e.type !== 'sat' && e.type !== 'relic' && e.z > 18) {
      e.alive = false;
      e.mesh.visible = false;
      continue;
    }

    const rate = SHOOTS[e.type];
    if (rate && e.z < player.z - 1 && e.z > -42) {
      e.cool -= dt;
      if (e.cool < 0.2) e.flash = Math.max(e.flash, 0.05);
      if (e.cool <= 0) {
        e.cool = rate * (e.type === 'sat' ? 1 : 1 - heat() * 0.25);
        if (e.type === 'brute') aimedVolley(e.x, e.z, 12, 3, 0.2);
        else if (e.type === 'turret') aimedVolley(e.x, e.z, 10, 1, 0);
        else aimedVolley(e.x, e.z, 13, 1, 0);
      }
    }

    if (e.flash > 0) {
      e.flash -= dt;
      e.mat.color.set(0xffffff);
    } else e.mat.color.set(ENEMY_COLOR[e.type]).multiplyScalar(e.type === 'relic' ? 1.8 : 1.35);

    e.mesh.position.set(e.x, e.y, e.z);
    if (e.type === 'lancer') e.mesh.lookAt(e.x, e.y, e.z + 8);
    else {
      e.mesh.rotation.x = 0;
      e.mesh.rotation.z = 0;
      e.mesh.rotation.y += dt * e.spin;
    }

    const dx = player.x - e.x;
    const dz = player.z - e.z;
    if (dx * dx + dz * dz < (0.48 + e.r) * (0.48 + e.r)) {
      hurt(e.type === 'brute' || e.type === 'sat' ? 30 : 18);
      if (e.type === 'wisp' || e.type === 'lancer' || e.type === 'relic') killEnemy(e);
    }
  }
}

function updateBoss(dt) {
  if (!boss.alive) {
    bossBar.classList.add('hidden');
    return;
  }
  bossBar.classList.remove('hidden');
  boss.age += dt;
  boss.x = Math.sin(boss.age * 0.65) * 6.4;
  boss.z = THREE.MathUtils.lerp(boss.z, -15.2, 1 - Math.exp(-1.15 * dt));
  boss.mesh.position.set(boss.x, 1.7, boss.z);
  boss.mesh.rotation.y += dt * 0.45;
  bossRing.rotation.z += dt * 0.8;
  bossShellMat.opacity = 0.05 + Math.max(0, boss.hp / boss.maxHp) * 0.14;
  bossFill.style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
  if (boss.hit > 0) {
    boss.hit -= dt;
    bossCoreMat.color.set(0xffffff);
  } else bossCoreMat.color.set(0xffd27a).multiplyScalar(1.5);

  const dx = player.x - boss.x;
  const dz = player.z - boss.z;
  if (dx * dx + dz * dz < 2.6 * 2.6) hurt(26);

  if (boss.stun > 0) {
    boss.stun -= dt;
    return;
  }
  if (boss.z < -30) return;
  boss.fire -= dt;
  if (boss.fire > 0) return;
  const phase = boss.hp / boss.maxHp;
  if (phase > 0.66) {
    boss.fire = 1.12;
    radialVolley(boss.x, boss.z, 11, 8.5, boss.age * 1.4);
  } else if (phase > 0.33) {
    boss.fire = 0.82;
    aimedVolley(boss.x, boss.z, 13, 5, 0.16);
  } else {
    boss.fire = 0.52;
    radialVolley(boss.x, boss.z, 14, 9.5, boss.age * 3.1);
    if (Math.random() < 0.45) formation('wisp', 3);
  }
}

function bulletHits(b, x, z, r) {
  const dx = b.x - x;
  const dz = b.z - 0.25 - z;
  const rad = b.r + r;
  return dx * dx + dz * dz < rad * rad;
}

function updatePlayerShots(dt) {
  for (const b of pbullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.mesh.position.set(b.x, 1.2, b.z);
    b.mesh.lookAt(b.x + b.vx, 1.2, b.z + b.vz);
    if (b.z < -95 || Math.abs(b.x) > 20) {
      b.alive = false;
      b.mesh.visible = false;
      continue;
    }
    let spent = false;
    for (const e of enemies) {
      if (!e.alive || !bulletHits(b, e.x, e.z, e.r)) continue;
      if (b.last === e.id && time - b.lastAt < 0.12) continue;
      b.last = e.id;
      b.lastAt = time;
      e.hp -= b.dmg;
      e.flash = 0.06;
      if (e.hp <= 0) killEnemy(e);
      else burst(b.x, 1.2, b.z, 0xffffff, 3, 2);
      if (!b.pierce || ++b.hits > 5) { spent = true; break; }
    }
    if (!spent && boss.alive && bulletHits(b, boss.x, boss.z, 2.15)) {
      boss.hp -= b.dmg;
      boss.hit = 0.07;
      burst(b.x, 1.6, b.z, 0xffe29a, 3, 2);
      if (boss.hp <= 0) defeatBoss();
      if (!b.pierce || ++b.hits > 5) spent = true;
    }
    if (!spent) {
      for (const s of structures) {
        if (!s.alive || s.hp <= 0 || !bulletHits(b, s.x, s.z, s.r)) continue;
        damageStructure(s, b.dmg);
        if (!b.pierce) { spent = true; break; }
      }
    }
    if (!spent) {
      for (const c of crystals) {
        if (!c.alive || !bulletHits(b, c.x, c.z, c.r)) continue;
        collectCrystal(c);
        if (!b.pierce) { spent = true; break; }
      }
    }
    if (spent) {
      b.alive = false;
      b.mesh.visible = false;
    }
  }
}

function updateEnemyShots(dt) {
  const hurtR = 0.46;
  const grazeR = 1.18;
  for (const b of ebullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    b.mesh.position.set(b.x, 1.15, b.z);
    b.mesh.rotation.y += dt * 4;
    b.mesh.rotation.x += dt * 2;
    if (b.life <= 0 || b.z > 22 || b.z < -90 || Math.abs(b.x) > 26) {
      b.alive = false;
      b.mesh.visible = false;
      continue;
    }
    const dx = b.x - player.x;
    const dz = b.z - player.z;
    const d2 = dx * dx + dz * dz;
    if (!b.grazed && d2 < grazeR * grazeR && d2 > hurtR * hurtR) {
      b.grazed = true;
      state.graze++;
      state.score += 20 * mult();
      state.comboTimer = Math.max(state.comboTimer, 1.15);
      if (state.graze % 3 === 0) popup('GRAZE', player.x, player.z, 'graze');
    }
    if (d2 < hurtR * hurtR) {
      b.alive = false;
      b.mesh.visible = false;
      hurt(18 + heat() * 10);
    }
  }
}

function updateWorld(dt) {
  const v = scrollSpeed();
  scroll = (scroll + v * dt) % 400;
  groundUniforms.uScroll.value = scroll;
  state.distance += mode === 'play' ? v * dt : 0;

  for (const s of structures) {
    if (!s.alive) continue;
    s.z += v * dt;
    if (s.flash > 0) s.flash -= dt;
    else if (s.kind === 'hazard') s.coreMat.color.set(0xff3355).multiplyScalar(1.7);
    if (s.z > 20) activateStructure(s, -100 - Math.random() * 36);
    s.mesh.position.set(s.x, 0, s.z);
    if (s.kind === 'hazard' && mode === 'play') {
      const dx = player.x - s.x;
      const dz = player.z - s.z;
      if (dx * dx + dz * dz < (0.48 + s.r) * (0.48 + s.r)) {
        hurt(26);
        const len = Math.hypot(dx, dz) || 1;
        player.x += (dx / len) * 0.55;
      }
    }
  }

  for (const c of crystals) {
    if (!c.alive) continue;
    c.z += v * dt;
    if (c.z > 18) activateCrystal(c, -90 - Math.random() * 40);
    const y = c.baseY + Math.sin(time * 1.6 + c.phase) * 0.35;
    c.mesh.position.set(c.x, y, c.z);
    c.mesh.rotation.y += dt * c.spin;
    if (mode === 'play' && Math.abs(player.x - c.x) < 1.05 && Math.abs(player.z - c.z) < 1.15) collectCrystal(c);
  }

  if (mode === 'play' && state.distance >= state.nextGate && !gate.alive) {
    gate.alive = true;
    gate.taken = false;
    gate.x = (Math.random() * 2 - 1) * 6.5;
    gate.z = -62;
    gate.mesh.visible = true;
  }
  if (gate.alive) {
    const gz = gate.z;
    const pz = player.prevZ ?? player.z;
    gate.z += v * dt;
    gate.mesh.position.set(gate.x, 1.35, gate.z);
    gate.mesh.rotation.z = time * 0.5;
    const near = 1 - THREE.MathUtils.clamp(Math.abs(gate.z - player.z) / 28, 0, 1);
    gate.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.03 + near * 0.08);
    if (!gate.taken && mode === 'play') {
      const before = gz - pz;
      const after = gate.z - player.z;
      if (before <= 0 && after >= 0 && Math.abs(player.x - gate.x) < 2.25) {
        gate.taken = true;
        addScore(750, gate.x, gate.z, 'gate');
        shockwave(gate.x, gate.z, 0xffe29a, 7);
        audio.chime();
        gate.alive = false;
        gate.mesh.visible = false;
        state.nextGate = state.distance + 680 + Math.random() * 220;
      }
    }
    if (gate.alive && gate.z > 16) {
      gate.alive = false;
      gate.mesh.visible = false;
      state.nextGate = state.distance + 680;
    }
  }

  const pos = stars.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let z = pos.getZ(i) + v * dt * 0.45;
    if (z > 40) z = -170;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  nebulas.forEach((n, i) => {
    n.position.z += v * dt * (0.12 + i * 0.04);
    if (n.position.z > 30) n.position.z = -110;
  });
  for (const s of streaks) {
    s.position.z += v * dt * 1.7;
    if (s.position.z > 24) {
      s.position.z = -70 - Math.random() * 20;
      s.position.x = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 8);
      s.position.y = 1.2 + Math.random() * 5;
    }
  }
}

function updatePickups(dt) {
  const v = scrollSpeed();
  for (const p of pickups) {
    if (!p.alive) continue;
    const dx = player.x - p.x;
    const dz = player.z - p.z;
    const dist = Math.hypot(dx, dz);
    p.z += v * dt;
    if (dist < 6.5) {
      p.x += dx * 4.5 * dt;
      p.z += dz * 4.5 * dt;
    }
    p.mesh.position.set(p.x, 1.25 + Math.sin(time * 3 + p.x) * 0.15, p.z);
    p.mesh.rotation.y += dt * 2;
    if (dist < 1.05) collectPickup(p);
    else if (p.z > 18) { p.alive = false; p.mesh.visible = false; }
  }
}

function blendBiome(dt) {
  const idx = Math.floor(state.distance / tune.biomeLength) % BIOMES.length;
  if (idx !== state.biomeIndex) {
    state.biomeIndex = idx;
    state.biomeBlend = 0;
    if (mode === 'play') announce(BIOMES[idx].name, `SECTOR ${String(Math.floor(state.distance / tune.biomeLength) + 1).padStart(2, '0')}`);
  }
  state.biomeBlend = Math.min(1, state.biomeBlend + dt * 0.35);
  const to = BIOMES[idx];
  const from = BIOMES[(idx - 1 + BIOMES.length) % BIOMES.length];
  const t = mode === 'title' ? 1 : state.biomeBlend;
  const A = groundUniforms.uA.value;
  const B = groundUniforms.uB.value;
  const C = groundUniforms.uC.value;
  const F = groundUniforms.uFog.value;
  A.copy(new THREE.Color(from.ground)).lerp(new THREE.Color(to.ground), t);
  B.copy(new THREE.Color(from.edge)).lerp(new THREE.Color(to.edge), t);
  C.copy(new THREE.Color(from.glow)).lerp(new THREE.Color(to.glow), t);
  F.copy(new THREE.Color(from.fog)).lerp(new THREE.Color(to.fog), t);
  skyMat.uniforms.uTop.value.copy(new THREE.Color(from.skyTop)).lerp(new THREE.Color(to.skyTop), t);
  skyMat.uniforms.uBot.value.copy(new THREE.Color(from.skyBot)).lerp(new THREE.Color(to.skyBot), t);
  scene.fog.color.copy(F);
  hemi.color.copy(C);
  trimMat.color.copy(C).multiplyScalar(1.7);
  planetMat.uniforms.uB.value.copy(C);
  planetMat.uniforms.uA.value.copy(B);
  corona.material.color.copy(C);
  nebulas.forEach((n, i) => {
    n.material.color.copy(i === 2 ? B : C);
    n.material.opacity = 0.1 + (i === 1 ? 0.06 : 0);
  });
  if (to.name !== shown.biome) {
    shown.biome = to.name;
    biomeEl.textContent = to.name;
  }
}

function updateShip(realDt, focus) {
  const bob = Math.sin(time * 1.7) * (mode === 'play' ? 0.035 : 0.08);
  ship.position.set(player.x, 1.12 + bob, player.z);
  ship.visible = mode !== 'over';
  const bank = THREE.MathUtils.clamp(-player.vx * 0.045, -0.6, 0.6);
  ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, bank, 1 - Math.exp(-8 * realDt));
  ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, 0.16 + player.vz * 0.012, 1 - Math.exp(-6 * realDt));
  const punch = 1 + Math.max(0, player.punch) * 0.12;
  ship.scale.setScalar(tune.shipScale * punch);
  const pulse = 0.7 + Math.sin(time * 28) * 0.18;
  exhausts.forEach((s) => {
    const target = (player.over > 0 ? 0.46 : 0.3) * pulse;
    s.scale.lerp(new THREE.Vector3(target, target, 1), 0.2);
  });
  engineMat.color.set(player.over > 0 ? 0xffe1a8 : 0x9af7ff).multiplyScalar(2.5);
  engineLight.color.copy(engineMat.color);
  engineLight.intensity = 2.2 + Math.sin(time * 30) * 0.4;
  shieldBubble.material.opacity = player.invuln > 0
    ? 0.22 + Math.sin(time * 26) * 0.12
    : player.shield < 30 ? 0.08 : 0;
  focusRing.visible = focus && mode === 'play';
  focusRing.position.set(player.x, 1.15, player.z);
  focusRing.rotation.z = time * 1.5;
  shadow.position.set(player.x, 0.07, player.z);
  const showDrones = player.level >= 4 && mode === 'play';
  const ang = time * 2.5;
  drones.forEach((d, i) => {
    d.visible = showDrones;
    const a = ang + i * Math.PI;
    d.position.set(player.x + Math.cos(a) * 1.2, 1.35, player.z + Math.sin(a) * 0.65);
    d.rotation.y += realDt * 3;
  });
}

let trailAcc = 0;
const trails = Array.from({ length: 22 }, () => {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0x9af7ff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const mesh = new THREE.Sprite(mat);
  markBloom(mesh);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat, alive: false, life: 0, max: 0.3 };
});

function updateTrails(dt) {
  trailAcc -= dt;
  if (trailAcc <= 0 && mode !== 'over' && !paused) {
    trailAcc = 0.028;
    const t = take(trails);
    if (t) {
      t.alive = true;
      t.life = t.max = 0.3;
      t.mesh.visible = true;
      t.mesh.position.set(player.x, 1.02, player.z + 0.8);
      t.mat.color.copy(engineMat.color);
    }
  }
  for (const t of trails) {
    if (!t.alive) continue;
    t.life -= dt;
    t.mesh.position.z += scrollSpeed() * dt * 0.2;
    const k = Math.max(0, t.life / t.max);
    t.mat.opacity = k * 0.5;
    const s = 0.28 + (1 - k) * 0.7;
    t.mesh.scale.set(s, s, 1);
    if (t.life <= 0) { t.alive = false; t.mesh.visible = false; }
  }
}

function updateFx(dt) {
  for (const p of particles) {
    if (!p.alive) continue;
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 5 * dt;
    const k = Math.max(0, p.life / p.max);
    p.mat.opacity = k;
    const s = p.size * (0.6 + k);
    p.mesh.scale.set(s, s, 1);
    if (p.life <= 0) { p.alive = false; p.mesh.visible = false; }
  }
  for (const ring of rings) {
    if (!ring.alive) continue;
    ring.life -= dt;
    const k = 1 - Math.max(0, ring.life / ring.max);
    ring.mesh.scale.setScalar(0.3 + k * ring.grow);
    ring.mat.opacity = (1 - k) * 0.85;
    if (ring.life <= 0) { ring.alive = false; ring.mesh.visible = false; }
  }
  fxLight.intensity += (0 - fxLight.intensity) * (1 - Math.exp(-3.2 * dt));
}

function refreshHud() {
  scoreEl.textContent = fmt(state.score);
  comboEl.textContent = `x${mult()} · ${state.combo} HIT`;
  grazeEl.textContent = `GRAZE ${state.graze}`;
  const sector = Math.floor(state.distance / tune.biomeLength) + 1;
  sectorEl.textContent = `SECTOR ${String(sector).padStart(2, '0')}`;
  distEl.textContent = `${(state.distance * 0.05).toFixed(1)} km`;
  shieldFill.style.transform = `scaleX(${THREE.MathUtils.clamp(player.shield / 100, 0, 1)})`;
  shieldFill.classList.toggle('low', player.shield < 32);
  if (shown.lives !== player.lives) {
    shown.lives = player.lives;
    livesEl.innerHTML = '';
    for (let i = 0; i < player.lives; i++) {
      const icon = document.createElement('i');
      icon.className = 'on';
      livesEl.appendChild(icon);
    }
  }
  if (shown.level !== player.level) {
    shown.level = player.level;
    weaponName.textContent = WEAPONS[player.level];
    pipsEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const pip = document.createElement('i');
      if (i <= player.level) pip.className = 'on';
      pipsEl.appendChild(pip);
    }
  }
  if (shown.bombs !== player.bombs) {
    shown.bombs = player.bombs;
    novasEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const pip = document.createElement('i');
      if (i < player.bombs) pip.className = 'on';
      novasEl.appendChild(pip);
    }
  }
}

function resetGame() {
  state.score = 0;
  state.distance = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.bestCombo = 0;
  state.graze = 0;
  state.kills = 0;
  state.biomeIndex = 0;
  state.biomeBlend = 1;
  state.nextBoss = quick ? 40 : tune.bossGap * 0.68;
  state.calm = 1.1;
  state.slow = 0;
  state.spawn = 0.3;
  state.sinceRelic = 18;
  state.nextGate = quick ? 20 : 420;
  state.lifeScore = 0;
  state.bombMark = 0;
  player.x = 0;
  player.z = 8;
  player.vx = 0;
  player.vz = 0;
  player.level = Math.round(tune.weapon);
  player.shield = 100;
  player.shieldDelay = 0;
  player.lives = Math.round(tune.lives);
  player.bombs = Math.round(tune.bombs);
  player.invuln = 1.5;
  player.cd = 0;
  player.over = 0;
  player.novaCd = 0;
  player.punch = 0;
  pointer.x = 0;
  pointer.z = 8;
  boss.alive = false;
  boss.mesh.visible = false;
  gate.alive = false;
  gate.mesh.visible = false;
  bury(enemies);
  bury(pbullets);
  bury(ebullets);
  bury(pickups);
  layoutScenery();
  shown.lives = -1;
  shown.level = -1;
  shown.bombs = -1;
}

function startGame() {
  resetGame();
  mode = 'play';
  paused = false;
  document.body.classList.add('playing');
  titleEl.classList.add('hidden');
  overEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hud.classList.remove('hidden');
  dock.classList.remove('hidden');
  hint.classList.remove('hidden');
  hint.classList.remove('gone');
  setTimeout(() => hint.classList.add('gone'), 8000);
  announce('LAUNCH', 'FINAL STAR ONLINE');
  audio.resume();
  audio.launch();
}

function endGame() {
  mode = 'over';
  burst(player.x, 1.2, player.z, 0x9ee7ff, 24, 9);
  shockwave(player.x, player.z, 0x9ee7ff, 12);
  audio.boom(1.2);
  ship.visible = false;
  const best = saveBest();
  paintBest();
  const rows = [
    ['Score', fmt(state.score)],
    ['Best', fmt(best.score)],
    ['Distance', `${(state.distance * 0.05).toFixed(1)} km`],
    ['Sector', String(Math.floor(state.distance / tune.biomeLength) + 1).padStart(2, '0')],
    ['Best chain', String(state.bestCombo)],
    ['Graze', String(state.graze)],
    ['Kills', String(state.kills)],
  ];
  statsEl.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  overEl.classList.remove('hidden');
  bossBar.classList.add('hidden');
}

function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  pauseEl.classList.toggle('hidden', !paused);
}

function steerPlayer(dt) {
  const focus = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const keyX = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const keyZ = (keys.has('KeyW') || keys.has('ArrowUp') ? -1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  if (keyX || keyZ) steer = 'keys';
  const prevX = player.x;
  const prevZ = player.z;
  if (steer === 'keys') {
    const sp = (focus ? tune.focusSpeed : tune.moveSpeed) * (player.over > 0 ? 1.06 : 1);
    player.x += keyX * sp * dt;
    player.z += keyZ * sp * dt;
  } else {
    const response = focus ? tune.mouseResponse * 0.6 : tune.mouseResponse;
    const k = 1 - Math.exp(-response * dt);
    player.x += (pointer.x - player.x) * k;
    player.z += (pointer.z - player.z) * k;
  }
  player.x = THREE.MathUtils.clamp(player.x, -tune.lane, tune.lane);
  player.z = THREE.MathUtils.clamp(player.z, 2.6, 11.4);
  const safeDt = Math.max(dt, 0.0001);
  player.vx = (player.x - prevX) / safeDt;
  player.vz = (player.z - prevZ) / safeDt;
  player.prevZ = prevZ;
  return focus;
}

function updatePlay(dt, realDt) {
  if (player.invuln > 0) player.invuln -= dt;
  if (player.over > 0) player.over -= dt;
  if (player.novaCd > 0) player.novaCd -= dt;
  if (player.punch > 0) player.punch -= dt;
  if (player.droneCd > 0) player.droneCd -= dt;
  if (player.shieldDelay > 0) player.shieldDelay -= dt;
  else player.shield = Math.min(100, player.shield + tune.regen * dt);
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }
  if (state.distance - state.bombMark > 1500) {
    state.bombMark = state.distance;
    if (player.bombs < 5) {
      player.bombs++;
      announce('NOVA ONLINE', 'CHARGE RESTORED');
    }
  }

  const focus = steerPlayer(dt);
  document.body.classList.toggle('focusing', focus);
  player.cd -= dt;
  const fireEvery = (focus ? tune.fireRate * 0.74 : tune.fireRate) * (player.over > 0 ? 0.68 : 1);
  if (tune.autofire && player.cd <= 0) {
    player.cd = fireEvery;
    fire();
  }
  tickDirector(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updatePlayerShots(dt);
  updateEnemyShots(dt);
  updatePickups(dt);
  updateWorld(dt);
  updateShip(realDt, focus);
  updateTrails(realDt);
  refreshHud();
  audio.updateMusic(true, BIOMES[state.biomeIndex].root, boss.alive);
}

function updateScenic(realDt) {
  document.body.classList.remove('focusing');
  if (mode === 'title') {
    player.x = Math.sin(time * 0.35) * 0.35;
    player.z = 8;
    player.vx = Math.cos(time * 0.35) * 0.12;
    player.vz = 0;
  }
  updateWorld(realDt);
  updateShip(realDt, false);
  updateTrails(realDt);
  for (const e of enemies) if (e.alive) {
    e.z += scrollSpeed() * realDt;
    e.mesh.position.z = e.z;
    if (e.z > 20) { e.alive = false; e.mesh.visible = false; }
  }
}

const camBase = { x: 0, y: 7.4 };
let qualityChecked = false;
let fpsAccum = 0;
let fpsFrames = 0;

function renderFrame(realDt) {
  time += realDt;
  groundUniforms.uTime.value = time;
  planetMat.uniforms.uTime.value = time;
  planet.rotation.y += realDt * 0.08;
  blendBiome(realDt);
  updateFx(realDt);

  const playing = mode === 'play' && !paused;
  if (playing && state.slow > 0) state.slow -= realDt;
  const scale = playing && state.slow > 0 ? 0.42 : 1;
  if (playing) updatePlay(Math.min(0.033, realDt) * scale, realDt);
  else if (!paused) updateScenic(Math.min(0.033, realDt));

  shake = Math.max(0, shake - realDt * 1.6);
  const sx = (Math.random() - 0.5) * shake * 0.7;
  const sy = (Math.random() - 0.5) * shake * 0.45;
  const focus = document.body.classList.contains('focusing');
  camBase.x += (player.x * 0.78 - camBase.x) * (1 - Math.exp(-5 * realDt));
  const camY = focus ? tune.camHeight - 1 : tune.camHeight;
  camBase.y += (camY - camBase.y) * (1 - Math.exp(-4 * realDt));
  camera.position.set(camBase.x + sx * tune.shake, camBase.y + sy * tune.shake, player.z + (focus ? tune.camDistance - 1.2 : tune.camDistance));
  camera.lookAt(player.x * 0.62, 1.05, player.z - 5.5);
  if (camera.fov !== tune.fov) {
    camera.fov = tune.fov;
    camera.updateProjectionMatrix();
  }
  bloomPass.strength = tune.bloom;
  bloomPass.radius = tune.bloomRadius;
  bloomPass.threshold = tune.bloomThreshold;
  scene.fog.near = Math.min(48, tune.fogFar * 0.25);
  scene.fog.far = tune.fogFar;
  audio.setVolume(tune.volume);

  camera.layers.set(1);
  bloomComposer.render();
  mixPass.uniforms.bloomTexture.value = bloomComposer.readBuffer.texture;
  camera.layers.set(0);
  finalComposer.render();

  if (!qualityChecked) {
    fpsAccum += realDt;
    fpsFrames++;
    if (fpsAccum > 2.4) {
      qualityChecked = true;
      const fps = fpsFrames / fpsAccum;
      if (fps < 42) {
        renderer.setPixelRatio(1);
        bloomComposer.setPixelRatio(1);
        finalComposer.setPixelRatio(1);
      }
    }
  }
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  bloomComposer.setSize(innerWidth, innerHeight);
  finalComposer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

function setPointer(e) {
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.x = THREE.MathUtils.clamp(nx * tune.lane, -tune.lane, tune.lane);
  pointer.z = THREE.MathUtils.lerp(2.8, 11.2, THREE.MathUtils.clamp((ny + 1) / 2, 0, 1));
}

function overTune(e) {
  return Boolean(e.target && e.target.closest && e.target.closest('#tune, #tune-open, #tune-title'));
}

addEventListener('pointermove', (e) => {
  if (mode !== 'play' || overTune(e)) return;
  steer = 'mouse';
  setPointer(e);
});
addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || overTune(e)) return;
  if (e.pointerType === 'touch') {
    steer = 'mouse';
    setPointer(e);
    if (!e.isPrimary) nova();
  }
  if (e.button === 2) nova();
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Enter' && (mode === 'title' || mode === 'over')) startGame();
  if (e.code === 'Space' && !e.repeat) nova();
  if (e.code === 'KeyT' && !e.repeat) {
    setTuneOpen(document.getElementById('tune').classList.contains('hidden'));
    return;
  }
  if (e.code === 'Escape' && !document.getElementById('tune').classList.contains('hidden')) {
    setTuneOpen(false);
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    muteBtn.textContent = muted ? 'Muted' : 'Sound';
  }
  if ((e.code === 'KeyR') && mode === 'over') startGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
document.getElementById('launch').addEventListener('click', startGame);
document.getElementById('relaunch').addEventListener('click', startGame);
document.getElementById('resume').addEventListener('click', togglePause);
muteBtn.addEventListener('click', () => {
  audio.resume();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? 'Muted' : 'Sound';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') {
    paused = true;
    pauseEl.classList.remove('hidden');
  }
});

const TUNE_FIELDS = [
  { group: 'Flight', key: 'moveSpeed', label: 'Strafe', min: 4, max: 36, step: 0.5 },
  { group: 'Flight', key: 'focusSpeed', label: 'Focus speed', min: 3, max: 22, step: 0.5 },
  { group: 'Flight', key: 'lane', label: 'Lane width', min: 6, max: 18, step: 0.1 },
  { group: 'Flight', key: 'mouseResponse', label: 'Mouse follow', min: 2, max: 24, step: 0.5 },
  { group: 'Weapons', key: 'fireRate', label: 'Fire interval', min: 0.04, max: 0.28, step: 0.005 },
  { group: 'Weapons', key: 'shotSpeed', label: 'Shot speed', min: 20, max: 120, step: 1 },
  { group: 'Weapons', key: 'damage', label: 'Shot damage', min: 0.5, max: 6, step: 0.1 },
  { group: 'Weapons', key: 'weapon', label: 'Weapon level', min: 0, max: 4, step: 1 },
  { group: 'Weapons', key: 'autofire', label: 'Autofire', type: 'toggle' },
  { group: 'Survival', key: 'lives', label: 'Lives', min: 1, max: 6, step: 1 },
  { group: 'Survival', key: 'bombs', label: 'Nova charges', min: 0, max: 5, step: 1 },
  { group: 'Survival', key: 'regen', label: 'Shield regen', min: 0, max: 40, step: 1 },
  { group: 'Survival', key: 'incoming', label: 'Damage taken', min: 0, max: 3, step: 0.05 },
  { group: 'Survival', key: 'nova', label: 'Nova power', min: 4, max: 48, step: 1 },
  { group: 'Survival', key: 'invincible', label: 'Invincible', type: 'toggle' },
  { group: 'World', key: 'scrollBase', label: 'World speed', min: 4, max: 40, step: 0.5 },
  { group: 'World', key: 'scrollRamp', label: 'Speed ramp', min: 0, max: 24, step: 0.5 },
  { group: 'World', key: 'spawnGap', label: 'Spawn spacing', min: 0.25, max: 2.5, step: 0.05 },
  { group: 'World', key: 'enemySpeed', label: 'Enemy rush', min: 0.2, max: 2.5, step: 0.05 },
  { group: 'World', key: 'hostileSpeed', label: 'Enemy shots', min: 0.2, max: 2.5, step: 0.05 },
  { group: 'World', key: 'enemyHp', label: 'Enemy hull', min: 0.5, max: 4, step: 0.1 },
  { group: 'World', key: 'biomeLength', label: 'World length', min: 400, max: 4000, step: 50 },
  { group: 'World', key: 'bossGap', label: 'Boss spacing', min: 400, max: 4000, step: 50 },
  { group: 'World', key: 'chainStep', label: 'Hits per multiplier', min: 1, max: 20, step: 1 },
  { group: 'Visuals', key: 'bloom', label: 'Glow strength', min: 0, max: 2, step: 0.01 },
  { group: 'Visuals', key: 'bloomRadius', label: 'Glow radius', min: 0, max: 1, step: 0.01 },
  { group: 'Visuals', key: 'bloomThreshold', label: 'Glow threshold', min: 0, max: 1, step: 0.01 },
  { group: 'Visuals', key: 'camHeight', label: 'Camera height', min: 4, max: 16, step: 0.1 },
  { group: 'Visuals', key: 'camDistance', label: 'Camera distance', min: 4, max: 18, step: 0.1 },
  { group: 'Visuals', key: 'shipScale', label: 'Ship scale', min: 0.6, max: 2.2, step: 0.02 },
  { group: 'Visuals', key: 'shake', label: 'Screen shake', min: 0, max: 2, step: 0.05 },
  { group: 'Visuals', key: 'fov', label: 'Field of view', min: 40, max: 90, step: 1 },
  { group: 'Visuals', key: 'fogFar', label: 'Fog distance', min: 60, max: 320, step: 2 },
  { group: 'Audio', key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01 },
];

function formatTune(field, value) {
  if (field.step >= 1) return String(Math.round(value));
  if (field.step >= 0.1) return Number(value).toFixed(1);
  if (field.step >= 0.01) return Number(value).toFixed(2);
  return Number(value).toFixed(3);
}

function pushLiveStats() {
  player.level = Math.round(tune.weapon);
  player.lives = Math.round(tune.lives);
  player.bombs = Math.round(tune.bombs);
  shown.level = -1;
  shown.lives = -1;
  shown.bombs = -1;
  if (mode === 'play') refreshHud();
}

let tuneSave = 0;
function rememberTune() {
  clearTimeout(tuneSave);
  tuneSave = setTimeout(() => {
    try { localStorage.setItem('starforce-tune', JSON.stringify(tune)); } catch { /* ignore */ }
  }, 180);
}

function setTuneOpen(open) {
  const panel = document.getElementById('tune');
  const button = document.getElementById('tune-open');
  panel.classList.toggle('hidden', !open);
  document.body.classList.toggle('tuning', open);
  button.textContent = open ? 'Close' : 'Tune';
}

function mountTunePanel() {
  const opener = document.createElement('button');
  opener.id = 'tune-open';
  opener.type = 'button';
  opener.textContent = 'Tune';
  opener.addEventListener('click', () => {
    setTuneOpen(document.getElementById('tune').classList.contains('hidden'));
  });

  const panel = document.createElement('aside');
  panel.id = 'tune';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'Control panel');
  panel.innerHTML = `
    <header>
      <div>
        <p>Control</p>
        <span>Live tuning</span>
      </div>
      <button type="button" id="tune-close">Close</button>
    </header>
    <div id="tune-body"></div>
    <footer>
      <span class="tune-note">Saved on this machine</span>
      <button type="button" id="tune-reset">Reset</button>
    </footer>
  `;
  const body = panel.querySelector('#tune-body');
  let lastGroup = '';
  for (const field of TUNE_FIELDS) {
    if (field.group !== lastGroup) {
      lastGroup = field.group;
      const heading = document.createElement('h3');
      heading.textContent = field.group;
      body.appendChild(heading);
    }
    if (field.type === 'toggle') {
      const row = document.createElement('label');
      row.className = 'tune-check';
      const name = document.createElement('span');
      name.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(tune[field.key]);
      input.addEventListener('change', () => {
        tune[field.key] = input.checked;
        rememberTune();
      });
      row.append(name, input);
      body.appendChild(row);
      field.input = input;
      continue;
    }
    const row = document.createElement('label');
    row.className = 'tune-row';
    const name = document.createElement('span');
    name.textContent = field.label;
    const value = document.createElement('span');
    value.className = 'tune-val';
    value.textContent = formatTune(field, tune[field.key]);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(tune[field.key]);
    input.addEventListener('input', () => {
      tune[field.key] = Number(input.value);
      value.textContent = formatTune(field, tune[field.key]);
      if (field.key === 'weapon' || field.key === 'lives' || field.key === 'bombs') pushLiveStats();
      rememberTune();
    });
    row.append(name, value, input);
    body.appendChild(row);
    field.input = input;
    field.valueEl = value;
  }

  panel.querySelector('#tune-close').addEventListener('click', () => setTuneOpen(false));
  panel.querySelector('#tune-reset').addEventListener('click', () => {
    Object.assign(tune, TUNE_DEFAULTS);
    for (const field of TUNE_FIELDS) {
      if (field.type === 'toggle') field.input.checked = Boolean(tune[field.key]);
      else {
        field.input.value = String(tune[field.key]);
        field.valueEl.textContent = formatTune(field, tune[field.key]);
      }
    }
    pushLiveStats();
    rememberTune();
  });

  document.body.append(opener, panel);
  document.getElementById('tune-title').addEventListener('click', () => setTuneOpen(true));
  audio.setVolume(tune.volume);
}

mountTunePanel();

let last = performance.now();
function frame(now) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  renderFrame(realDt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
