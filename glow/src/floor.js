import * as THREE from "../vendor/three.module.js";

/** World-space forest floor so adjacent chunks share one moss/leaf pattern. */
const VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform vec3 glowColor;
uniform float pulse;
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  float n = sin(p.x * 0.31) + sin(p.y * 0.27) + sin((p.x + p.y) * 0.19);
  float litter = sin(p.x * 1.9) * sin(p.y * 1.7) * 0.5 + 0.5;
  float moss = smoothstep(0.15, 0.82, 0.52 + 0.22 * n);
  float veins = smoothstep(0.62, 0.92, sin(p.x * 0.85 + p.y * 0.4) * sin(p.y * 0.7) * 0.5 + 0.5);
  vec3 soil = vec3(0.028, 0.034, 0.024);
  vec3 duff = vec3(0.045, 0.055, 0.032);
  vec3 col = mix(soil, duff, litter * 0.55);
  col += glowColor * moss * (0.18 + 0.12 * pulse);
  col += glowColor * veins * 0.22 * pulse;
  float specks = smoothstep(0.88, 0.99, sin(p.x * 4.6) * sin(p.y * 4.1) * 0.5 + 0.5);
  col += glowColor * specks * 0.45 * pulse;
  gl_FragColor = vec4(col, 1.0);
}
`;

const cache = new Map();

export function forestFloorMaterial(hex) {
  const key = `${hex | 0}`;
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(hex) },
      pulse: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  cache.set(key, mat);
  return mat;
}

export function tickFloor(t) {
  const p = 0.82 + 0.18 * Math.sin(t * 0.55);
  for (const m of cache.values()) m.uniforms.pulse.value = p;
}
