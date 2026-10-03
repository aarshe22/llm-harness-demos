import * as THREE from "../vendor/three.module.js";

const VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform vec3 glowColor;
uniform float pulse;
varying vec3 vPos;
varying vec3 vN;
void main() {
  float rings = sin(vPos.y * 9.0 + vPos.x * 2.4) * sin(vPos.y * 3.1 + 1.7);
  float veins = smoothstep(0.42, 0.92, rings * 0.5 + 0.5);
  float moss = smoothstep(0.15, 0.55, 0.5 + 0.5 * sin(vPos.x * 14.0 + vPos.z * 11.0));
  vec3 bark = vec3(0.035, 0.028, 0.02);
  vec3 crack = glowColor * (0.35 + 0.65 * pulse);
  vec3 col = mix(bark, crack, veins * 0.85);
  col += glowColor * moss * 0.12;
  float rim = pow(1.0 - max(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
  col += glowColor * rim * 0.15;
  gl_FragColor = vec4(col, 1.0);
}
`;

const cache = new Map();

export function barkMaterial(hex) {
  const key = hex | 0;
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

export function tickBark(t) {
  const p = 0.75 + 0.25 * Math.sin(t * 0.7);
  for (const m of cache.values()) m.uniforms.pulse.value = p;
}
