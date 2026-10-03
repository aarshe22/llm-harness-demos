import * as THREE from "../vendor/three.module.js";

/**
 * Instanced trunks are a unit cylinder scaled by instanceMatrix.
 * Sampling sin(local.y) made two fat horizontal washers that stretched with height.
 * Map around the cylinder (atan) and along world-scaled height instead.
 */
const VERT = /* glsl */ `
varying vec3 vW;
varying vec2 vCyl;
varying vec3 vN;
void main() {
  float sy = length((instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vCyl = vec2(atan(position.x, position.z), (position.y + 0.5) * max(sy, 0.001));
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = world.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform vec3 glowColor;
uniform float pulse;
uniform float detail;
varying vec3 vW;
varying vec2 vCyl;
varying vec3 vN;
void main() {
  float d = max(detail, 1.0);
  float ang = vCyl.x;
  float h = vCyl.y;
  float grain = sin(ang * (10.0 + d * 4.0) + h * 0.38 * d);
  float grain2 = sin(ang * (6.0 + d * 1.5) - h * 0.21 * d + 1.3);
  float veins = smoothstep(0.52, 0.9, grain * 0.62 + grain2 * 0.28 + 0.5);
  float moss = smoothstep(0.18, 0.72, 0.5 + 0.5 * sin(vW.x * 0.55 + vW.z * 0.48 + h * 0.12));
  vec3 bark = vec3(0.03, 0.024, 0.018);
  vec3 crack = glowColor * (0.4 + 0.65 * pulse);
  vec3 col = mix(bark, crack, veins * 0.88);
  col += glowColor * moss * 0.16;
  float rim = pow(1.0 - max(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
  col += glowColor * rim * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`;

const cache = new Map();

export function barkMaterial(hex, detail = 1) {
  const d = Number(detail) || 1;
  const key = `${hex | 0}:${d.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(hex) },
      pulse: { value: 1 },
      detail: { value: d },
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
