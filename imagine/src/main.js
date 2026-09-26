import * as THREE from "three";

const DURATION = 76;
const SNAP = 11.12;
const LAND = 14.18;

const LINES = [
  [8.3, 10.7, "Pip", "Hold on."],
  [11.35, 13.5, "Pip", "Oh no."],
  [15.7, 17.5, "Fold", "Need a lift?"],
  [17.7, 19.3, "Pip", "Please."],
  [21.0, 23.2, "Fold", "Where's home?"],
  [23.6, 27.5, "Pip", "The yellow coat. Before morning."],
  [30.5, 31.9, "Pip", "Big paw!"],
  [32.1, 33.7, "Fold", "Ha!"],
  [36.6, 41.4, "Nim", "I know every light between here and your pocket."],
  [45.0, 47.2, "Nim", "There."],
  [55.0, 57.6, "Nim", "Almost."],
  [64.0, 68.6, "Pip", "And a pocket for the boat."],
];

const canvas = document.querySelector("#view");
const posterEl = document.querySelector("#poster");
const endEl = document.querySelector("#end");
const whoEl = document.querySelector("#who");
const lineEl = document.querySelector("#line");
const progressEl = document.querySelector("#progress");
const progressFill = progressEl.querySelector("i");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc9d4e4, 12, 42);
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.08, 80);

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
function easeIn(t) {
  const x = clamp(t, 0, 1);
  return x * x;
}

function stormAmount(time) {
  return smoothstep(7.2, 12.2, time) * (1 - smoothstep(44, 54, time));
}
function dawnAmount(time) {
  return smoothstep(45, 58, time);
}

function mat(color, roughness, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    ...extra,
  });
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  stops.forEach(([p, color]) => grd.addColorStop(p, color));
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTextures(seed, wall) {
  const paint = document.createElement("canvas");
  const glow = document.createElement("canvas");
  paint.width = glow.width = 128;
  paint.height = glow.height = 256;
  const g = paint.getContext("2d");
  const e = glow.getContext("2d");
  g.fillStyle = wall;
  g.fillRect(0, 0, 128, 256);
  e.fillStyle = "#000";
  e.fillRect(0, 0, 128, 256);
  g.fillStyle = "rgba(0,0,0,0.06)";
  for (let i = 0; i < 8; i++) g.fillRect(0, 8 + i * 32, 128, 2);
  let n = 0;
  for (let y = 16; y < 236; y += 34) {
    for (let x = 12; x < 116; x += 28) {
      n += 1;
      const lit = ((seed * 17 + n * 5) % 6) > 2;
      g.fillStyle = lit ? "#f6d594" : "#243044";
      g.fillRect(x, y, 16, 22);
      g.strokeStyle = "rgba(20,16,12,0.55)";
      g.strokeRect(x + 0.5, y + 0.5, 15, 21);
      if (lit) {
        e.fillStyle = "#ffd18a";
        e.fillRect(x + 2, y + 2, 12, 18);
      }
    }
  }
  const map = new THREE.CanvasTexture(paint);
  const em = new THREE.CanvasTexture(glow);
  map.colorSpace = THREE.SRGBColorSpace;
  em.colorSpace = THREE.SRGBColorSpace;
  return { map, em };
}

function wingTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.scale(1.15, 0.82);
  const grd = g.createRadialGradient(-20, -10, 10, 0, 0, 110);
  grd.addColorStop(0, "#fff4d2");
  grd.addColorStop(0.45, "#f0b45a");
  grd.addColorStop(1, "#c46a3a");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(10, 0, 100, 78, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(120, 60, 30, 0.45)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-70, 10);
  g.quadraticCurveTo(10, -30, 90, -8);
  g.moveTo(-60, 20);
  g.quadraticCurveTo(20, 10, 80, 30);
  g.stroke();
  g.fillStyle = "rgba(255, 236, 190, 0.8)";
  g.beginPath();
  g.ellipse(30, -16, 14, 10, 0.4, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const brass = mat(0xf0b84a, 0.36, { emissive: 0x5a3810, emissiveIntensity: 0.18 });
const brassDark = mat(0x8a5a28, 0.45);
const coatYellow = mat(0xf2c14e, 0.58);
const coatShade = mat(0xd39a32, 0.62);
const bootRed = mat(0xd24b45, 0.28);
const paperMat = mat(0xf4efe4, 0.9, { emissive: 0x6a5640, emissiveIntensity: 0.42 });
const stripeMat = mat(0xd24b4b, 0.62);
const wood = mat(0xc48a4a, 0.6);
const skin = mat(0xf0b89a, 0.55);
const plaster = mat(0xf0d7b4, 0.78);
const roofMat = mat(0x8d4038, 0.72);
const doorMat = mat(0x6b422c, 0.6);
const catFur = mat(0x8a6858, 0.72, { emissive: 0x3a2820, emissiveIntensity: 0.45 });
const catBelly = mat(0xd8b89a, 0.8);
const lampPost = mat(0x314038, 0.55);
const leafMat = mat(0xc46a3a, 0.7, { side: THREE.DoubleSide });

const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.22, metalness: 0 });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1c140e });
const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2 });
const threadMat = new THREE.MeshStandardMaterial({ color: 0xf7f1e4, roughness: 0.4, metalness: 0 });
const windowMat = new THREE.MeshStandardMaterial({
  color: 0xffe1a8,
  emissive: 0xffc56a,
  emissiveIntensity: 0.7,
  roughness: 0.4,
  metalness: 0,
});

const shadowTex = radialTexture([[0, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]]);
const glowTex = radialTexture([[0, "rgba(255,214,140,0.9)"], [0.35, "rgba(255,180,80,0.25)"], [1, "rgba(255,160,60,0)"]]);

function makeShadow() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.renderOrder = 1;
  return mesh;
}

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  fog: false,
  uniforms: {
    uTop: { value: new THREE.Color(0x89c4ea) },
    uHorizon: { value: new THREE.Color(0xf6d7a8) },
  },
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vPos = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    void main() {
      float h = clamp(normalize(vPos).y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.62, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(48, 32, 20), skyMat));

const hemi = new THREE.HemisphereLight(0xffe6c4, 0xb08968, 0.72);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe0b8, 1.35);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.4;
key.shadow.camera.far = 28;
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -7;
key.shadow.bias = -0.00025;
key.shadow.normalBias = 0.02;
scene.add(key);
scene.add(key.target);
const rim = new THREE.DirectionalLight(0x9eb6dd, 0.28);
scene.add(rim);

const ground = addMesh(scene, new THREE.PlaneGeometry(40, 16), mat(0x323848, 0.46, { metalness: 0.12 }), 9, 0, 0);
ground.rotation.x = -Math.PI / 2;
ground.castShadow = false;
const sidewalk = addMesh(scene, new THREE.PlaneGeometry(36, 3.1), mat(0x7a7164, 0.9), 9, 0.025, -1.85);
sidewalk.rotation.x = -Math.PI / 2;
sidewalk.castShadow = false;
const nearWalk = addMesh(scene, new THREE.PlaneGeometry(36, 2.6), mat(0x6e675c, 0.9), 9, 0.02, 1.85);
nearWalk.rotation.x = -Math.PI / 2;
nearWalk.castShadow = false;
const curbA = addMesh(scene, new THREE.BoxGeometry(28, 0.14, 0.18), mat(0x8c8478, 0.8), 9, 0.07, -0.72);
const curbB = addMesh(scene, new THREE.BoxGeometry(28, 0.14, 0.18), mat(0x8c8478, 0.8), 9, 0.07, 0.78);

const waterUniforms = { uTime: { value: 0 }, uStorm: { value: 0 } };
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 1.35),
  new THREE.ShaderMaterial({
    transparent: true,
    uniforms: waterUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uStorm;
      void main() {
        float rip = sin(vUv.x * 46.0 + uTime * 2.1) * sin(vUv.y * 16.0 - uTime * 1.4);
        float glint = smoothstep(0.78, 1.0, sin(vUv.x * 80.0 + uTime * 2.8 + rip));
        vec3 deep = mix(vec3(0.16, 0.42, 0.52), vec3(0.06, 0.12, 0.2), uStorm);
        vec3 lite = mix(vec3(0.55, 0.78, 0.78), vec3(0.22, 0.36, 0.5), uStorm);
        vec3 col = mix(deep, lite, 0.55 + 0.45 * rip);
        col += vec3(1.0, 0.93, 0.78) * glint * 0.28;
        gl_FragColor = vec4(col, 0.9);
      }
    `,
  }),
);
water.rotation.x = -Math.PI / 2;
water.position.set(8, 0.045, 0.02);
water.receiveShadow = true;
scene.add(water);

const dawnKey = new THREE.Color(0xffc49a);
const hemiDay = new THREE.Color(0xffe6c4);
const dayTop = new THREE.Color(0x8ec8ee);
const nightTop = new THREE.Color(0x121826);
const dawnTop = new THREE.Color(0xf09978);
const dayHor = new THREE.Color(0xf6d7a8);
const nightHor = new THREE.Color(0x2a354c);
const dawnHor = new THREE.Color(0xffd0a2);
const keyDay = new THREE.Color(0xffe0b8);
const keyNight = new THREE.Color(0x9eb4d4);

function makeBuilding(x, height, depth, seed, wall) {
  const { map, em } = facadeTextures(seed, wall);
  const material = new THREE.MeshStandardMaterial({
    map,
    emissive: 0xffe0b0,
    emissiveMap: em,
    emissiveIntensity: 0.35,
    roughness: 0.86,
    metalness: 0,
  });
  const box = addMesh(scene, new THREE.BoxGeometry(2.4, height, depth), material, x, height / 2, -4.7);
  box.userData.glow = material;
  return box;
}
const buildings = [
  makeBuilding(-1.2, 3.4, 1.6, 2, "#c9846a"),
  makeBuilding(3.4, 4.8, 1.8, 5, "#d9c4a4"),
  makeBuilding(7.2, 3.8, 1.5, 3, "#7f8c99"),
  makeBuilding(11.4, 5.4, 1.7, 8, "#b96d62"),
  makeBuilding(15.8, 4.2, 1.6, 4, "#c8a888"),
];

const house = new THREE.Group();
house.position.set(18.15, 0, -2.55);
addMesh(house, new THREE.BoxGeometry(2.8, 2.7, 2.1), plaster, 0, 1.35, 0);
addMesh(house, new THREE.BoxGeometry(3.15, 0.22, 2.5), roofMat, 0, 2.78, 0);
addMesh(house, new THREE.BoxGeometry(0.72, 1.35, 0.08), doorMat, -0.55, 0.7, 1.06);
const houseWindow = addMesh(house, new THREE.BoxGeometry(0.85, 0.7, 0.06), windowMat, 0.55, 1.55, 1.07);
houseWindow.castShadow = false;
addMesh(house, new THREE.BoxGeometry(0.9, 0.05, 0.07), doorMat, 0.55, 1.55, 1.1);
addMesh(house, new THREE.BoxGeometry(0.05, 0.7, 0.07), doorMat, 0.55, 1.55, 1.1);
addMesh(house, new THREE.BoxGeometry(1.4, 0.12, 0.7), mat(0x8d8478, 0.8), 0, 0.06, 1.25);
scene.add(house);
const windowLight = new THREE.PointLight(0xffc56e, 0.4, 6, 2);
windowLight.position.set(18.7, 1.6, -1.2);
scene.add(windowLight);

const chair = new THREE.Group();
chair.position.set(17.05, 0, -1.42);
addMesh(chair, new THREE.BoxGeometry(0.7, 0.08, 0.7), wood, 0, 0.48, 0);
for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
  addMesh(chair, new THREE.BoxGeometry(0.07, 0.48, 0.07), wood, x, 0.24, z);
}
addMesh(chair, new THREE.BoxGeometry(0.7, 0.7, 0.07), wood, 0, 0.9, -0.32);
scene.add(chair);

const lamp = new THREE.Group();
lamp.position.set(12.55, 0, -1.72);
addMesh(lamp, new THREE.CylinderGeometry(0.06, 0.08, 2.35, 12), lampPost, 0, 1.18, 0);
addMesh(lamp, new THREE.BoxGeometry(0.55, 0.08, 0.08), lampPost, 0.22, 2.32, 0);
addMesh(lamp, new THREE.BoxGeometry(0.38, 0.16, 0.38), mat(0x243028, 0.4), 0.42, 2.18, 0);
const bulb = addMesh(lamp, new THREE.SphereGeometry(0.1, 16, 12), bulbMat, 0.42, 2.08, 0);
bulb.castShadow = false;
const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
lampGlow.position.set(0.42, 2.08, 0);
lampGlow.scale.set(1.8, 1.8, 1);
lamp.add(lampGlow);
scene.add(lamp);
const lampLight = new THREE.PointLight(0xffc56a, 0, 9, 2);
lampLight.position.set(12.97, 2.08, -1.72);
scene.add(lampLight);

const coat = new THREE.Group();
scene.add(coat);
addMesh(coat, new THREE.SphereGeometry(1, 40, 28), coatYellow, 0, 0, 0).scale.set(1.22, 1.58, 0.74);
const collar = addMesh(coat, new THREE.TorusGeometry(0.42, 0.11, 10, 24), coatShade, 0, 1.12, 0);
collar.rotation.x = Math.PI / 2;
collar.scale.set(1.25, 1, 0.85);
const sleeveL = addMesh(coat, new THREE.CapsuleGeometry(0.26, 0.62, 6, 10), coatYellow, -1.05, 0.22, 0.05);
sleeveL.rotation.z = 1.15;
const sleeveR = addMesh(coat, new THREE.CapsuleGeometry(0.26, 0.62, 6, 10), coatYellow, 1.05, 0.22, 0.05);
sleeveR.rotation.z = -1.15;
addMesh(coat, new THREE.BoxGeometry(0.03, 1.7, 0.03), coatShade, 0.16, -0.05, 0.72);
const pocket = addMesh(coat, new THREE.SphereGeometry(0.24, 18, 14), coatShade, -0.46, -0.78, 0.58);
pocket.scale.set(1.15, 0.8, 0.42);
const decoBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), brass);
decoBtn.rotation.x = Math.PI / 2;
for (const y of [0.42, 0.05, -0.28]) {
  const b = decoBtn.clone();
  b.position.set(0.16, y, 0.76);
  b.castShadow = true;
  coat.add(b);
}
const buttonAnchor = new THREE.Object3D();
buttonAnchor.position.set(0.16, -0.52, 0.84);
coat.add(buttonAnchor);
const pocketAnchor = new THREE.Object3D();
pocketAnchor.position.set(-0.42, -0.72, 0.86);
coat.add(pocketAnchor);
const stitch = new THREE.Object3D();
stitch.position.set(0.16, -0.28, 0.8);
coat.add(stitch);

const bootL = addMesh(coat, new THREE.CapsuleGeometry(0.2, 0.28, 6, 10), bootRed, -0.28, -1.48, 0.15);
const bootR = addMesh(coat, new THREE.CapsuleGeometry(0.2, 0.28, 6, 10), bootRed, 0.32, -1.48, 0.15);

function makeFace(parent, scale, y, z, lidMat) {
  const eyes = [];
  const pupils = [];
  const lids = [];
  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.072 * scale, 18, 14), eyeWhite);
    eye.position.set(x * scale, y, z);
    eye.castShadow = false;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scale, 14, 12), pupilMat);
    pupil.position.set(0, -0.004 * scale, 0.045 * scale);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.016 * scale, 8, 8), hiMat);
    hi.position.set(0.016 * scale, 0.016 * scale, 0.055 * scale);
    eye.add(pupil, hi);
    if (lidMat) {
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.078 * scale, 14, 10), lidMat);
      lid.scale.set(1.15, 0.7, 0.4);
      lid.position.set(0, 0.04 * scale, 0.02 * scale);
      eye.add(lid);
      lids.push(lid);
    }
    parent.add(eye);
    eyes.push(eye);
    pupils.push(pupil);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.055 * scale, 0.011 * scale, 8, 20, Math.PI), brassDark);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, y - 0.12 * scale, z + 0.01);
  parent.add(mouth);
  const brows = [-0.11, 0.11].map((x) => {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.01 * scale, 0.07 * scale, 3, 6), brassDark);
    brow.position.set(x * scale, y + 0.12 * scale, z);
    brow.userData.baseY = brow.position.y;
    parent.add(brow);
    return brow;
  });
  return { eyes, pupils, mouth, brows, lids };
}

const pip = new THREE.Group();
scene.add(pip);
const pipBody = addMesh(pip, new THREE.CylinderGeometry(0.34, 0.34, 0.11, 40), brass);
pipBody.rotation.x = Math.PI / 2;
const pipRim = addMesh(pip, new THREE.TorusGeometry(0.34, 0.028, 8, 36), brassDark);
const holeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.13, 12);
const holeMat = mat(0x2a2118, 0.55);
for (const [x, y] of [[0.2, 0.18], [-0.2, 0.18], [0.2, -0.18], [-0.2, -0.18]]) {
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(x, y, 0);
  pip.add(hole);
}
const pipFace = makeFace(pip, 1, 0.04, 0.08);
const blushMat = new THREE.MeshStandardMaterial({ color: 0xe07a62, transparent: true, opacity: 0.38, roughness: 0.6, depthWrite: false });
for (const x of [-0.17, 0.17]) {
  const blush = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), blushMat);
  blush.scale.set(1.1, 0.62, 0.28);
  blush.position.set(x, -0.03, 0.09);
  pip.add(blush);
}
const limbs = new THREE.Group();
pip.add(limbs);
const limbMat = mat(0xe0a84a, 0.42, { emissive: 0x5a3810, emissiveIntensity: 0.1 });
function makeLimb(x, y) {
  const group = new THREE.Group();
  const stick = addMesh(group, new THREE.CapsuleGeometry(0.034, 0.11, 4, 8), limbMat, 0, -0.08, 0);
  stick.castShadow = true;
  const tip = addMesh(group, new THREE.SphereGeometry(0.046, 12, 10), limbMat, 0, -0.18, 0);
  group.position.set(x, y, 0.02);
  limbs.add(group);
  return group;
}
const armL = makeLimb(-0.36, 0.02);
const armR = makeLimb(0.36, 0.02);
const legL = makeLimb(-0.12, -0.3);
const legR = makeLimb(0.12, -0.3);

const boat = new THREE.Group();
scene.add(boat);
addMesh(boat, new THREE.BoxGeometry(1.15, 0.08, 0.62), paperMat, 0, 0.1, 0);
const sideGeo = new THREE.BoxGeometry(1.15, 0.32, 0.04);
const sideL = addMesh(boat, sideGeo, paperMat, 0, 0.18, 0.26);
sideL.rotation.x = 0.28;
sideL.scale.y = 0.72;
const sideR = addMesh(boat, sideGeo, paperMat, 0, 0.18, -0.26);
sideR.rotation.x = -0.28;
sideR.scale.y = 0.72;
const prow = addMesh(boat, new THREE.ConeGeometry(0.2, 0.4, 4), paperMat, 0.74, 0.18, 0);
prow.rotation.z = -Math.PI / 2;
addMesh(boat, new THREE.BoxGeometry(0.95, 0.05, 0.5), stripeMat, -0.02, 0.2, 0);
const boatFace = makeFace(boat, 0.72, 0.34, 0.36);
boatFace.fit = 0.45;
boatFace.eyes[0].position.set(0.58, 0.3, 0.1);
boatFace.eyes[1].position.set(0.72, 0.28, 0.08);
boatFace.mouth.position.set(0.64, 0.2, 0.12);
boatFace.brows[0].position.set(0.58, 0.38, 0.1);
boatFace.brows[1].position.set(0.72, 0.36, 0.08);
boatFace.brows[0].userData.baseY = 0.38;
boatFace.brows[1].userData.baseY = 0.36;

const moth = new THREE.Group();
scene.add(moth);
addMesh(moth, new THREE.CapsuleGeometry(0.08, 0.2, 5, 8), mat(0x8a6234, 0.65), 0, 0, 0).rotation.x = Math.PI / 2;
const wingGeo = new THREE.CircleGeometry(0.4, 22);
wingGeo.translate(0.32, 0.04, 0);
const wingMat = new THREE.MeshStandardMaterial({
  map: wingTexture(),
  roughness: 0.72,
  metalness: 0,
  side: THREE.DoubleSide,
  transparent: true,
});
const wingL = new THREE.Mesh(wingGeo, wingMat);
const wingR = new THREE.Mesh(wingGeo, wingMat);
wingR.scale.x = -1;
wingL.castShadow = wingR.castShadow = true;
moth.add(wingL, wingR);
const mothFace = makeFace(moth, 0.7, 0.04, 0.1);
mothFace.fit = 0.85;
for (const x of [-0.04, 0.04]) {
  const ant = addMesh(moth, new THREE.CapsuleGeometry(0.012, 0.16, 3, 6), mat(0x5a3a22, 0.5), x, 0.16, 0.04);
  ant.rotation.z = x < 0 ? 0.5 : -0.5;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), bulbMat);
  tip.position.set(x < 0 ? -0.08 : 0.08, 0.26, 0.04);
  moth.add(tip);
}
const mothGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
mothGlow.scale.set(0.7, 0.7, 1);
moth.add(mothGlow);

const cat = new THREE.Group();
cat.position.set(8.15, 0, 1.28);
scene.add(cat);
addMesh(cat, new THREE.SphereGeometry(0.48, 24, 18), catFur, 0, 0.42, 0).scale.set(1.25, 0.72, 0.9);
addMesh(cat, new THREE.SphereGeometry(0.28, 18, 14), catBelly, 0.05, 0.32, 0.32);
const catHead = addMesh(cat, new THREE.SphereGeometry(0.34, 22, 16), catFur, 0.15, 0.78, 0.28);
for (const x of [-0.16, 0.16]) {
  const ear = addMesh(cat, new THREE.ConeGeometry(0.1, 0.2, 8), catFur, 0.15 + x, 1.08, 0.26);
  ear.rotation.z = x < 0 ? 0.2 : -0.2;
}
const catEyes = [];
for (const x of [-0.1, 0.12]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
  eye.position.set(0.15 + x, 0.8, 0.56);
  const slit = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6), pupilMat);
  slit.position.z = 0.04;
  eye.add(slit);
  cat.add(eye);
  catEyes.push(eye);
}
addMesh(cat, new THREE.SphereGeometry(0.05, 10, 8), mat(0xe7a0a8, 0.4), 0.2, 0.72, 0.6);
const tail = new THREE.Group();
for (let i = 0; i < 5; i++) {
  addMesh(tail, new THREE.SphereGeometry(0.07 - i * 0.008, 10, 8), catFur, -0.15 - i * 0.1, 0.48 + i * 0.05, -0.15 + i * 0.02);
}
cat.add(tail);
const paw = new THREE.Group();
addMesh(paw, new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), catFur, 0, -0.1, -0.2).rotation.x = 1.1;
addMesh(paw, new THREE.SphereGeometry(0.16, 14, 12), catFur, 0.05, -0.05, -0.48);
cat.add(paw);

const hands = new THREE.Group();
scene.add(hands);
function mitten() {
  const g = new THREE.Group();
  addMesh(g, new THREE.SphereGeometry(0.16, 16, 12), skin, 0, 0, 0).scale.set(1.15, 0.8, 0.65);
  addMesh(g, new THREE.SphereGeometry(0.07, 10, 8), skin, 0.14, -0.02, 0.05);
  return g;
}
const handL = mitten();
const handR = mitten();
hands.add(handL, handR);
const needle = addMesh(hands, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), mat(0xd9dde6, 0.25, { metalness: 0.4, roughness: 0.25 }), 0, 0, 0);

const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), threadMat);
thread.castShadow = false;
scene.add(thread);

const pipShadow = makeShadow();
const boatShadow = makeShadow();
scene.add(pipShadow, boatShadow);

const leafGeo = new THREE.PlaneGeometry(0.22, 0.12);
const leaves = [];
for (let i = 0; i < 7; i++) {
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.userData.seed = i;
  scene.add(leaf);
  leaves.push(leaf);
}

const rainMat = new THREE.MeshBasicMaterial({ color: 0xd5e2f2, transparent: true, opacity: 0.4 });
const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.32, 0.012), rainMat, 240);
rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rain.frustumCulled = false;
scene.add(rain);
const rainSeed = Array.from({ length: 240 }, () => [Math.random(), Math.random(), Math.random()]);
const dummy = new THREE.Object3D();

const drops = [];
for (let i = 0; i < 12; i++) {
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd5e6f0 }));
  drop.visible = false;
  scene.add(drop);
  drops.push(drop);
}

const starPositions = new Float32Array(180 * 3);
for (let i = 0; i < 180; i++) {
  const a = Math.random() * Math.PI * 2;
  const b = Math.random() * 0.7 + 0.2;
  const r = 30;
  starPositions[i * 3] = Math.cos(a) * Math.cos(b) * r + 8;
  starPositions[i * 3 + 1] = Math.sin(b) * r * 0.7 + 6;
  starPositions[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
}
const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPositions, 3)),
  new THREE.PointsMaterial({ color: 0xfff6dd, size: 0.08, transparent: true, opacity: 0 }),
);
scene.add(stars);

function boatX(time) {
  if (time < 14) return -0.7;
  if (time < 17.35) return lerp(-0.7, 2.35, easeInOut((time - 14) / 3.35));
  if (time < 52) return lerp(2.35, 16.55, easeInOut((time - 17.35) / 34.65));
  return 16.55;
}

function walkingAnchor(time, out) {
  const bob = Math.abs(Math.sin(time * 6.2)) * 0.055;
  _e.set(0, 0.12, Math.sin(time * 6.2) * 0.035);
  _q.setFromEuler(_e);
  out.copy(buttonAnchor.position).applyQuaternion(_q);
  out.x += 0;
  out.y += 1.9 + bob;
  out.z += -1.55;
  return out;
}

function placeCoat(time) {
  const home = time < 44;
  bootL.visible = bootR.visible = home;
  if (home) {
    const step = Math.sin(time * 6.2);
    coat.position.set(0, 1.9 + Math.abs(step) * 0.055, -1.55);
    coat.rotation.set(0, 0.12, step * 0.035);
    coat.scale.setScalar(1);
    bootL.position.y = -1.5 + Math.max(0, step) * 0.1;
    bootR.position.y = -1.5 + Math.max(0, -step) * 0.1;
    bootL.rotation.x = step * 0.35;
    bootR.rotation.x = -step * 0.35;
    sleeveL.rotation.z = 1.15 + step * 0.08;
    sleeveR.rotation.z = -1.15 - step * 0.08;
  } else {
    coat.position.set(17.15, 0.95, -1.25);
    coat.rotation.set(0.28, 0.55, 0.08);
    coat.scale.setScalar(0.62);
    sleeveL.rotation.z = 1.8;
    sleeveR.rotation.z = -0.4;
  }
}

function setMouth(face, smile, open) {
  if (open > 0.45) {
    face.mouth.scale.set(0.5, 0.62, 1);
    return;
  }
  face.mouth.scale.set(0.9 + smile * 0.2, 0.22 + smile * 0.68, 1);
}

function setEyes(face, openness, look, pupilScale, browLift) {
  const blink = openness < 0.22;
  const fit = face.fit || 1;
  face.eyes.forEach((eye) => {
    eye.scale.set(fit, (blink ? 0.16 : Math.max(0.72, openness)) * fit, 0.48 * fit);
  });
  face.pupils.forEach((pupil) => {
    pupil.position.x = look * 0.018;
    pupil.scale.setScalar(pupilScale);
  });
  face.brows.forEach((brow, i) => {
    const side = i === 0 ? 1 : -1;
    brow.rotation.z = -side * 0.08;
    brow.position.y = (brow.userData.baseY || brow.position.y) + browLift * 0.03;
  });
}

function applyFace(time) {
  const fear = Math.max(
    smoothstep(10.2, 11.2, time) * (1 - smoothstep(15.2, 16.4, time)),
    smoothstep(30.3, 30.9, time) * (1 - smoothstep(32.2, 33, time)),
  );
  const cheer = smoothstep(32.5, 33.0, time) * (1 - smoothstep(33.8, 34.4, time));
  const worry = smoothstep(8.2, 9.4, time) * (1 - smoothstep(11.3, 12, time));
  const sleep = 1 - smoothstep(7.4, 8.6, time);
  const soft = smoothstep(66, 70, time);
  let open = 1;
  if (sleep > 0.2 && time < 9) open = lerp(1, 0.78, sleep);
  const blinkPhase = (time * 0.31) % 1;
  if (blinkPhase > 0.94 && time > 9 && time < 64 && fear < 0.4) open = 0.08;
  if (fear > 0.5) open = 1;
  if (cheer > 0.4) open = 0.55;
  if (soft > 0.5) open = 0.62;
  const look = time > 27 && time < 34 ? 0.8 : time > 34 && time < 44 ? -0.3 : 0.05;
  setEyes(pipFace, open, look, fear > 0.4 ? 0.72 : 1, worry * 0.7 + fear * 0.9);
  let smile = 0.8;
  if (worry > 0.45) smile = 0.35;
  if (fear > 0.4) smile = 0.05;
  if (cheer > 0.3 || soft > 0.45 || (time > 17.5 && time < 28)) smile = 1;
  setMouth(pipFace, smile, fear);

  const boatHappy = time > 15 && time < 34 ? 1 : 0.4;
  setEyes(boatFace, 0.9, 0.2, 1, 0);
  setMouth(boatFace, boatHappy, 0);
  setEyes(mothFace, 1, 0, 1, 0);
  setMouth(mothFace, 0.8, 0);
}

function posePip(time) {
  const strain = smoothstep(8.7, SNAP, time);
  walkingAnchor(SNAP, _v2);
  _v2.y -= 0.34 * 1;
  _v2.z += 0.28;
  _v2.x += 0.06;

  let squash = 1;
  if (time < SNAP) {
    walkingAnchor(time, _v);
    _v.y -= 0.34 * strain;
    _v.z += 0.28 * strain;
    _v.x += 0.06 * strain;
    pip.position.copy(_v);
    coat.updateMatrixWorld(true);
    buttonAnchor.getWorldQuaternion(pip.quaternion);
  } else if (time < LAND) {
    const u = easeIn((time - SNAP) / (LAND - SNAP));
    walkingAnchor(SNAP, _v3);
    _v3.y -= 0.34;
    _v3.z += 0.28;
    _v3.x += 0.06;
    const land = _v.set(2.35, 0.2, 0.1);
    pip.position.lerpVectors(_v3, land, u);
    pip.position.y += Math.sin(u * Math.PI) * 0.15 * (1 - u);
    pip.rotation.set(u * 5.2, 0.2, u * 8.5);
  } else if (time < 16.7) {
    pip.position.set(2.35, 0.22 + Math.sin(time * 5) * 0.03, 0.1);
    pip.rotation.set(0, 0, Math.sin(time * 4) * 0.08);
  } else if (time < 17.55) {
    const u = easeInOut((time - 16.7) / 0.85);
    boat.getWorldPosition(_v2);
    _v2.y += 0.58;
    pip.position.set(2.35, 0.22, 0.1).lerp(_v2, u);
    pip.position.y += Math.sin(u * Math.PI) * 0.28;
    pip.rotation.set(-0.2 * (1 - u), 0, 0);
    squash = 1 - Math.sin(clamp(u, 0, 1) * Math.PI) * 0.08;
  } else if (time < 52) {
    boat.getWorldPosition(_v2);
    pip.position.set(_v2.x - 0.08, _v2.y + 0.5 + Math.sin(time * 2.4) * 0.02, _v2.z);
    pip.rotation.set(Math.sin(time * 1.6) * 0.04, 0, boat.rotation.z * 0.35);
  } else if (time < 61.2) {
    const keys = [
      [52, 16.55, 0.36, 0.08],
      [54.3, 16.75, 0.5, -0.45],
      [56.7, 16.95, 0.72, -0.95],
      [59.4, 17.12, 1.05, -1.28],
      [61.2, 17.16, 1.22, -1.38],
    ];
    let i = 0;
    while (i < keys.length - 2 && time > keys[i + 1][0]) i += 1;
    const a = keys[i];
    const b = keys[i + 1];
    const u = easeInOut((time - a[0]) / (b[0] - a[0]));
    pip.position.set(lerp(a[1], b[1], u), lerp(a[2], b[2], u) + Math.sin(u * Math.PI) * 0.2, lerp(a[3], b[3], u));
    pip.rotation.set(-0.15, 0, 0);
    if (u > 0.82) squash = 1 - ((u - 0.82) / 0.18) * 0.22;
  } else {
    coat.updateMatrixWorld(true);
    buttonAnchor.getWorldPosition(_v2);
    buttonAnchor.getWorldQuaternion(_q2);
    const u = smoothstep(61.2, 64.4, time);
    const seat = _v.set(17.16, 1.22, -1.38);
    pip.position.lerpVectors(seat, _v2, u);
    _q.identity();
    pip.quaternion.slerpQuaternions(_q, _q2, u);
  }

  if (time > LAND && time < LAND + 0.55) {
    const u = (time - LAND) / 0.55;
    const s = Math.sin(u * Math.PI);
    squash = 1 - s * 0.32;
    pip.scale.set(1 + s * 0.18, squash, 1 + s * 0.18);
  } else if (time >= 61.2) {
    pip.scale.set(1, 1, 1);
  } else {
    pip.scale.set(1 + (1 - squash) * 0.4, squash, 1 + (1 - squash) * 0.4);
  }

  const alive = smoothstep(SNAP, SNAP + 0.35, time) * (1 - smoothstep(64.6, 65.5, time));
  const pop = time < SNAP + 0.6 ? alive * (1 + (1 - alive) * 0.35) : alive;
  limbs.scale.setScalar(Math.max(pop, 0.001));
  const swing = Math.sin(time * 3.1);
  const armsUp = smoothstep(32.5, 33.0, time) * (1 - smoothstep(33.8, 34.4, time));
  armL.rotation.z = lerp(0.5 + swing * 0.45, 2.2, armsUp);
  armR.rotation.z = lerp(-0.5 - swing * 0.45, -2.2, armsUp);
  legL.rotation.x = swing * 0.4;
  legR.rotation.x = -swing * 0.4;
}

function poseBoat(time) {
  const dodge = (time > 30.3 && time < 33) ? Math.sin(clamp((time - 30.45) / 0.85, 0, 1) * Math.PI) * (1 - smoothstep(31.7, 32.8, time)) * 0.62 : 0;
  boat.position.set(boatX(time), 0.02 + Math.sin(time * 2.1) * 0.03, 0.08 - dodge);
  boat.rotation.set(Math.sin(time * 1.5) * 0.06, -0.15, Math.sin(time * 1.8) * 0.07 - dodge * 0.35);
  if (time > 66 && time < 70) {
    coat.updateMatrixWorld(true);
    pocketAnchor.getWorldPosition(_v2);
    const u = easeInOut((time - 66.2) / 2.4);
    const from = _v.set(16.55, 0.2, 0.08);
    boat.position.lerpVectors(from, _v2, u);
    boat.position.y += Math.sin(u * Math.PI) * 0.35;
    const s = lerp(1, 0.28, u);
    boat.scale.setScalar(s);
    boat.rotation.set(u * 0.8, u * 1.4, 0);
  } else if (time >= 70) {
    coat.updateMatrixWorld(true);
    pocketAnchor.getWorldPosition(boat.position);
    boat.scale.setScalar(0.28);
    boat.rotation.set(0.9, 0.4, 0.2);
  } else {
    boat.scale.setScalar(1);
  }
}

function poseMoth(time) {
  const flap = Math.sin(time * (time > 36 && time < 52 ? 22 : 14));
  wingL.rotation.z = 0.35 + flap * 0.4;
  wingR.rotation.z = -0.35 - flap * 0.4;
  moth.scale.setScalar(0.82);
  if (time < 36) {
    const a = time * 1.3;
    moth.position.set(12.95 + Math.cos(a) * 0.55, 2.25 + Math.sin(time * 2) * 0.08, -1.72 + Math.sin(a) * 0.35);
  } else if (time < 42) {
    const u = easeInOut((time - 36) / 6);
    const a = 36 * 1.3;
    _v.set(boat.position.x - 0.2, 1.05, boat.position.z + 0.2);
    _v2.set(boat.position.x + 0.05, 0.78, boat.position.z + 0.42);
    moth.position.lerpVectors(_v, _v2, u);
    moth.position.y += Math.sin(u * Math.PI) * 0.18;
  } else if (time < 62) {
    moth.position.set(boat.position.x + 0.05 + Math.sin(time) * 0.06, 0.82 + Math.sin(time * 1.4) * 0.04, boat.position.z + 0.42);
    if (time > 52) {
      moth.position.set(17.0 + Math.sin(time * 1.5) * 0.35, 1.15 + (time - 52) * 0.02, -0.4);
    }
  } else {
    const u = smoothstep(62, 66, time);
    _v.set(17.2, 1.35, -0.6);
    _v2.set(18.55, 1.72, -1.35);
    moth.position.lerpVectors(_v, _v2, u);
  }
  moth.rotation.y = Math.sin(time * 0.8) * 0.4;
}

function poseCat(time) {
  const swipe = smoothstep(30.45, 31.05, time) * (1 - smoothstep(31.9, 32.5, time));
  paw.position.set(0.35, 0.42, 0.15 - swipe * 1.15);
  paw.rotation.x = -swipe * 0.6;
  cat.rotation.y = -0.5 - swipe * 0.15;
  tail.rotation.z = Math.sin(time * 2) * 0.2;
  catEyes.forEach((eye) => { eye.scale.y = swipe > 0.2 ? 0.4 : 1; });
}

function poseHands(time) {
  const show = smoothstep(62.2, 63.2, time) * (1 - smoothstep(68.6, 69.6, time));
  hands.visible = show > 0.02;
  const u = smoothstep(62.2, 64.2, time);
  coat.updateMatrixWorld(true);
  buttonAnchor.getWorldPosition(_v2);
  handR.position.set(lerp(18.3, _v2.x + 0.25, u), lerp(2.3, _v2.y + 0.15, u), lerp(-0.2, _v2.z + 0.35, u));
  handL.position.set(handR.position.x - 0.28, handR.position.y + 0.05, handR.position.z + 0.05);
  needle.position.set(handR.position.x - 0.02, handR.position.y - 0.12, handR.position.z - 0.05);
  needle.rotation.set(0.4, 0, 0.5);
  needle.visible = time > 63 && time < 66.5;
}

function poseThread(time) {
  const show = time < SNAP + 0.05;
  thread.visible = show;
  if (!show) return;
  coat.updateMatrixWorld(true);
  stitch.getWorldPosition(_v2);
  _v.copy(pip.position);
  const mid = _v3.copy(_v).lerp(_v2, 0.5);
  const len = Math.max(0.05, _v.distanceTo(_v2));
  thread.position.copy(mid);
  thread.scale.set(1, len, 1);
  _v2.sub(_v).normalize();
  thread.quaternion.setFromUnitVectors(_up, _v2);
}

function poseLeaves(time) {
  const blow = smoothstep(7.4, 9, time) * (1 - smoothstep(15, 17, time));
  leaves.forEach((leaf) => {
    const i = leaf.userData.seed;
    const u = (time * 0.35 + i * 0.17) % 1;
    leaf.visible = blow > 0.05;
    leaf.position.set(-1.2 + u * 5.5 + i * 0.1, 1.7 - u * 0.8 + Math.sin(time * 3 + i) * 0.15, -0.4 + (i - 3) * 0.18);
    leaf.rotation.set(time * 2 + i, time * 3, 0.4);
    leaf.material.opacity = blow;
    leaf.material.transparent = true;
  });
}

function poseRain(time) {
  const storm = stormAmount(time);
  rain.visible = storm > 0.08;
  if (!rain.visible) return;
  rainMat.opacity = 0.15 + storm * 0.4;
  const fx = _cam.x;
  const fy = _cam.y;
  const fz = _cam.z;
  for (let i = 0; i < rainSeed.length; i++) {
    const s = rainSeed[i];
    const fall = (s[1] + time * 0.85) % 1;
    dummy.position.set(fx + (s[0] - 0.5) * 14, fy + 5.5 - fall * 11, fz + (s[2] - 0.5) * 10);
    dummy.rotation.set(0.15, 0, 0.05);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    rain.setMatrixAt(i, dummy.matrix);
  }
  rain.instanceMatrix.needsUpdate = true;
}

function poseDrops(time) {
  const u = clamp((time - LAND) / 1.05, 0, 1);
  const on = time >= LAND && time < LAND + 1.05;
  drops.forEach((drop, i) => {
    drop.visible = on;
    if (!on) return;
    const a = i / 12 * Math.PI * 2;
    drop.position.set(2.35 + Math.cos(a) * u * 0.7, 0.18 + Math.sin(u * Math.PI) * (0.25 + (i % 4) * 0.08), 0.1 + Math.sin(a) * u * 0.45);
    drop.scale.setScalar(1 - u * 0.6);
  });
}

function shadeWorld(time) {
  const storm = stormAmount(time);
  const dawn = dawnAmount(time);
  const day = 1 - storm;
  skyMat.uniforms.uTop.value.copy(nightTop).lerp(dayTop, day).lerp(dawnTop, dawn);
  skyMat.uniforms.uHorizon.value.copy(nightHor).lerp(dayHor, day).lerp(dawnHor, dawn);
  scene.fog.color.copy(skyMat.uniforms.uHorizon.value);
  key.color.copy(keyNight).lerp(keyDay, day).lerp(dawnKey, dawn * 0.8);
  key.intensity = 0.72 + day * 0.7 + dawn * 0.2;
  hemi.intensity = 0.34 + day * 0.28;
  hemi.color.copy(keyNight).lerp(hemiDay, day);
  rim.intensity = 0.18 + storm * 0.2;
  rim.color.set(storm > 0.5 ? 0x7f97c4 : 0xffc9a0);
  const lampOn = storm * (1 - smoothstep(52, 60, time));
  lampLight.intensity = 0.6 + lampOn * 7.5;
  lampGlow.scale.setScalar(1.3 + lampOn * 1.4);
  windowLight.intensity = 0.35 + storm * 1.3 + dawn * 0.4;
  stars.material.opacity = storm * (1 - dawn) * 0.85;
  waterUniforms.uTime.value = time;
  waterUniforms.uStorm.value = storm;
  buildings.forEach((b) => { b.userData.glow.emissiveIntensity = 0.15 + storm * 0.9; });
}

function frameCamera(time) {
  const px = pip.position.x;
  const py = pip.position.y;
  const pz = pip.position.z;
  const bx = boat.position.x;
  if (time < 6.5) {
    const u = time / 6.5;
    _cam.set(lerp(1.15, 0.55, u), lerp(1.15, 1.42, u), lerp(1.55, 0.72, u));
    _look.set(0.12, lerp(0.9, 1.28, u), -1.15);
    camera.fov = lerp(38, 30, u);
  } else if (time < SNAP) {
    _cam.set(0.35, 1.48, 0.55);
    _look.set(0.16, 1.32, -0.7);
    camera.fov = 26;
  } else if (time < 15.2) {
    _cam.set(px + 0.15, py + 0.35, pz + 1.7);
    _look.set(px, py, pz);
    camera.fov = 34;
  } else if (time < 18) {
    _cam.set(px - 0.15, 0.62, 1.55);
    _look.set(px + 0.1, 0.32, 0.05);
    camera.fov = 32;
  } else if (time < 28.5) {
    _cam.set(bx - 0.35, 0.78, 2.05);
    _look.set(bx + 0.25, 0.36, 0.02);
    camera.fov = 32;
  } else if (time < 34.2) {
    _cam.set(bx - 0.8, 0.95, 2.7);
    _look.set(bx + 0.55, 0.42, 0.55);
    camera.fov = 38;
  } else if (time < 44) {
    _cam.set(bx - 0.15, 0.92, 2.45);
    _look.set(bx + 0.35, 0.7, 0.08);
    camera.fov = 42;
  } else if (time < 52) {
    _cam.set(bx - 1.4, 1.85, 4.6);
    _look.set(17.3, 1.15, -1.3);
    camera.fov = 40;
  } else if (time < 62) {
    _cam.set(16.2, 0.72 + smoothstep(52, 60, time) * 0.35, 1.35);
    _look.set(px + 0.05, py, pz);
    camera.fov = 30;
  } else if (time < 70) {
    coat.updateMatrixWorld(true);
    buttonAnchor.getWorldPosition(_look);
    buttonAnchor.getWorldQuaternion(_q);
    _v.set(0, 0.02, 1.25).applyQuaternion(_q);
    _cam.copy(_look).add(_v);
    camera.fov = 30;
  } else {
    const u = (time - 70) / 6;
    _cam.set(lerp(16.4, 14.6, u), lerp(1.5, 2.35, u), lerp(2.4, 5.4, u));
    _look.set(17.4, 1.2, -1.4);
    camera.fov = lerp(32, 42, u);
  }
  camera.position.copy(_cam);
  camera.lookAt(_look);
  camera.updateProjectionMatrix();
  key.position.set(_look.x + 5.2, _look.y + 4.8, _look.z + 0.8);
  key.target.position.set(_look.x, _look.y * 0.4, _look.z);
  rim.position.set(_look.x - 3, _look.y + 2, _look.z - 2);
}

function groundShadows() {
  pipShadow.position.set(pip.position.x, 0.035, pip.position.z);
  const ph = pip.position.y;
  pipShadow.material.opacity = clamp(0.45 - ph * 0.12, 0.06, 0.45);
  pipShadow.scale.setScalar(0.7 + ph * 0.12);
  boatShadow.position.set(boat.position.x, 0.035, boat.position.z);
  boatShadow.material.opacity = boat.scale.x < 0.5 ? 0.12 : 0.32;
  boatShadow.scale.set(1.3 * boat.scale.x, 0.7 * boat.scale.x, 1);
  pipShadow.visible = ph < 3.2;
}

function captions(time) {
  let text = "";
  let who = "";
  let alpha = 0;
  for (const [a, b, name, line] of LINES) {
    if (time < a || time > b) continue;
    const fade = Math.min(smoothstep(a, a + 0.28, time), 1 - smoothstep(b - 0.28, b, time));
    if (fade > alpha) {
      alpha = fade;
      text = line;
      who = name;
    }
  }
  whoEl.textContent = who;
  lineEl.textContent = text;
  whoEl.style.opacity = String(who ? alpha : 0);
  lineEl.style.opacity = String(alpha);
}

function apply(time) {
  placeCoat(time);
  poseBoat(time);
  posePip(time);
  poseMoth(time);
  poseCat(time);
  poseHands(time);
  poseThread(time);
  poseLeaves(time);
  poseDrops(time);
  applyFace(time);
  shadeWorld(time);
  frameCamera(time);
  poseRain(time);
  groundShadows();
  captions(time);
  renderer.render(scene, camera);
}

let audio = null;
let noteAt = -1;
let lastSound = -1;
function ensureAudio() {
  if (audio) return audio;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const wind = ctx.createGain();
  wind.gain.value = 0;
  noise.connect(filter);
  filter.connect(wind);
  wind.connect(master);
  noise.start();
  audio = { ctx, master, wind };
  return audio;
}
function tone(freq, dur, gain, type = "sine") {
  if (!audio) return;
  const { ctx, master } = audio;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}
const MELODY = [523, 587, 659, 784, 659, 587, 698, 523];
function playScore(time) {
  if (!audio) return;
  audio.wind.gain.value = stormAmount(time) * 0.015;
  const idx = Math.floor(time / 0.52);
  if (idx !== noteAt && time < DURATION) {
    noteAt = idx;
    const note = MELODY[idx % MELODY.length] * (dawnAmount(time) > 0.4 ? 1 : 1);
    tone(note, 0.46, 0.03);
    if (idx % 2 === 0) tone(note / 2, 0.5, 0.02, "triangle");
  }
  const hits = [[SNAP, 180, 0.05, "triangle"], [LAND, 90, 0.04, "sine"], [32.2, 880, 0.03, "triangle"]];
  for (const [mark, freq, gain, type] of hits) {
    if (lastSound < mark && time >= mark) tone(freq, 0.2, gain, type);
  }
  lastSound = time;
}

let t = 0;
let playing = false;
let started = false;
let posterClock = 0;
let lastNow = performance.now();

function paintPoster(dt) {
  posterClock += dt;
  apply(3.15 + Math.sin(posterClock * 0.65) * 0.2);
}

function tick(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!started) paintPoster(dt);
  else {
    if (playing) {
      t = Math.min(DURATION, t + dt);
      playScore(t);
      if (t >= DURATION) {
        playing = false;
        endEl.hidden = false;
      }
    }
    apply(t);
    progressFill.style.width = `${(t / DURATION) * 100}%`;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function start() {
  started = true;
  playing = true;
  posterEl.hidden = true;
  endEl.hidden = true;
  progressEl.hidden = false;
  if (t >= DURATION - 0.05) t = 0;
  ensureAudio();
  audio.ctx.resume();
  noteAt = Math.floor(t / 0.52) - 1;
}

function seek(next) {
  t = clamp(next, 0, DURATION);
  started = true;
  posterEl.hidden = true;
  progressEl.hidden = false;
  endEl.hidden = t < DURATION - 0.05;
  noteAt = Math.floor(t / 0.52);
  lastSound = t;
  apply(t);
  progressFill.style.width = `${(t / DURATION) * 100}%`;
}

document.querySelector("#play").addEventListener("click", start);
document.querySelector("#replay").addEventListener("click", () => { t = 0; start(); });
progressEl.addEventListener("pointerdown", (event) => {
  const rect = progressEl.getBoundingClientRect();
  seek(((event.clientX - rect.left) / rect.width) * DURATION);
});
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (!started || t >= DURATION) start();
    else playing = !playing;
  } else if (event.code === "ArrowRight") {
    seek((started ? t : 0) + 5);
  } else if (event.code === "ArrowLeft") {
    seek((started ? t : 0) - 5);
  }
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__film = {
  seek,
  play: start,
  pause() { playing = false; },
  get time() { return t; },
};
