import * as THREE from "../vendor/three.module.js";
import { clamp, overglowReady, fidelityProfile } from "./rules.js";

function wingGeometry(profile) {
  if (profile.mothWingGeo === "plane") return new THREE.PlaneGeometry(0.42, 0.22);
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  if (profile.mothWingGeo === "shaped") {
    s.bezierCurveTo(0.06, 0.2, 0.26, 0.2, 0.44, 0.06);
    s.bezierCurveTo(0.4, -0.08, 0.16, -0.14, 0, -0.03);
  } else {
    s.quadraticCurveTo(0.22, 0.14, 0.42, 0.02);
    s.quadraticCurveTo(0.22, -0.1, 0, -0.02);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s, profile.level >= 6 ? 12 : 6);
}

export function createMoth(scene, fidelity = 1) {
  const p = fidelityProfile(fidelity);
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    emissive: 0xd8eeff,
    emissiveIntensity: 2.2,
    roughness: p.level === 1 ? 0.25 : 0.18,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, p.mothBodySeg, p.mothBodyRings), bodyMat);
  if (p.level > 1) body.scale.set(0.92, 0.85, 1.28);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xcfe9ff,
    emissive: 0xaad8ff,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: p.level === 1 ? 0.45 : 0.52,
    side: THREE.DoubleSide,
    roughness: 0.15,
  });
  const wingGeo = wingGeometry(p);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = wingL.clone();
  wingL.position.set(-0.16, 0.04, 0);
  wingR.position.set(0.16, 0.04, 0);
  if (p.mothWingGeo !== "plane") {
    wingL.rotation.y = Math.PI;
    wingR.rotation.y = 0;
  }
  root.add(body, wingL, wingR);

  let hindL = null;
  let hindR = null;
  if (p.mothWings >= 4) {
    const hindMat = wingMat.clone();
    hindMat.opacity = 0.38;
    hindL = new THREE.Mesh(wingGeo, hindMat);
    hindR = hindL.clone();
    hindL.scale.setScalar(0.62);
    hindR.scale.setScalar(0.62);
    hindL.position.set(-0.12, 0.0, 0.06);
    hindR.position.set(0.12, 0.0, 0.06);
    if (p.mothWingGeo !== "plane") {
      hindL.rotation.y = Math.PI;
    }
    root.add(hindL, hindR);
  }

  let abdomen = null;
  if (p.mothAbdomen) {
    abdomen = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, p.mothBodySeg, p.mothBodyRings),
      bodyMat
    );
    abdomen.position.set(0, -0.02, 0.12);
    abdomen.scale.set(0.7, 0.55, 1.4);
    root.add(abdomen);
  }

  let antL = null;
  let antR = null;
  if (p.mothAntennae) {
    const antGeo = new THREE.CylinderGeometry(0.008, 0.003, 0.22, Math.max(4, Math.min(10, p.level)));
    const antMat = new THREE.MeshStandardMaterial({
      color: 0xe8f4ff,
      emissive: 0xb8dcff,
      emissiveIntensity: 0.8,
      roughness: 0.35,
    });
    antL = new THREE.Mesh(antGeo, antMat);
    antR = antL.clone();
    antL.position.set(-0.04, 0.12, -0.08);
    antR.position.set(0.04, 0.12, -0.08);
    antL.rotation.z = 0.35;
    antR.rotation.z = -0.35;
    antL.rotation.x = -0.7;
    antR.rotation.x = -0.7;
    root.add(antL, antR);
  }

  if (p.mothWingVeins) {
    const vein = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.36, 0.04, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.3, -0.06, 0),
    ]);
    const veinMat = new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.45 });
    const vL = new THREE.LineSegments(vein, veinMat);
    const vR = vL.clone();
    vL.position.copy(wingL.position);
    vR.position.copy(wingR.position);
    vR.scale.x = -1;
    root.add(vL, vR);
  }

  const light = new THREE.PointLight(0xd8eeff, 2.2, 10, 2);
  root.add(light);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, p.mothHaloSeg, Math.max(8, p.mothHaloSeg - 2)),
    new THREE.MeshBasicMaterial({
      color: 0xe8f6ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const bloomHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, Math.max(8, p.mothHaloSeg - 2), 8),
    new THREE.MeshBasicMaterial({
      color: 0xb8e6ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  root.add(halo, bloomHalo);
  root.position.set(24, 6, 24);
  scene.add(root);

  return {
    root,
    body,
    wingL,
    wingR,
    hindL,
    hindR,
    antL,
    antR,
    abdomen,
    light,
    halo,
    bloomHalo,
    fidelity: p.level,
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    bank: 0,
    bob: 0,
    glow: 1,
    energy: 1,
    overglow: 0,
    combo: 0,
    comboT: 0,
    health: 1,
    state: "healthy",
    web: 0,
    distance: 0,
    invuln: 0,
    dead: false,
  };
}

export function copyMothState(from, to) {
  to.root.position.copy(from.root.position);
  to.vel.copy(from.vel);
  to.yaw = from.yaw;
  to.pitch = from.pitch;
  to.bank = from.bank;
  to.bob = from.bob;
  to.glow = from.glow;
  to.energy = from.energy;
  to.overglow = from.overglow;
  to.combo = from.combo;
  to.comboT = from.comboT;
  to.health = from.health;
  to.state = from.state;
  to.web = from.web;
  to.distance = from.distance;
  to.invuln = from.invuln;
  to.dead = from.dead;
}

export function updateMoth(m, input, cfg, dt, look) {
  if (m.dead) return;
  m.yaw -= look.x;
  m.pitch = clamp(m.pitch - look.y, -1.15, 1.15);

  const dimming = input.dim && m.overglow <= 0.15;
  const boosting = input.boost;
  let targetGlow = 1 * cfg.player_normal_glow;
  if (boosting) targetGlow = 1.55 * cfg.boost_brightness;
  if (dimming) {
    targetGlow = 0.15 / Math.max(0.35, cfg.dim_effectiveness);
    m.energy = Math.max(0, m.energy - dt * 0.28);
    if (m.energy <= 0) targetGlow = 0.55;
  } else {
    m.energy = Math.min(cfg.glow_energy_capacity, m.energy + dt * 0.22);
  }
  if (m.overglow > 0) {
    m.overglow = Math.max(0, m.overglow - dt);
    targetGlow = Math.max(targetGlow, 1.85);
  }
  m.comboT = Math.max(0, m.comboT - dt);
  if (m.comboT <= 0) m.combo = 0;
  m.glow += (targetGlow - m.glow) * (1 - Math.exp(-8 * dt));

  const forward = new THREE.Vector3(-Math.sin(m.yaw), 0, -Math.cos(m.yaw));
  const right = new THREE.Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw));
  let wish = forward.clone().multiplyScalar(input.move.y).add(right.multiplyScalar(input.move.x));
  if (wish.lengthSq() < 1e-6) wish = forward.clone().multiplyScalar(0.15);
  else wish.normalize();

  let maxS = cfg.max_speed * (boosting ? 1.55 : 1) * (dimming ? 0.78 : 1);
  if (m.overglow > 0) maxS *= 1.08;
  if (m.web > 0) {
    maxS *= 0.28;
    m.web = Math.max(0, m.web - dt);
  }
  const target = wish.multiplyScalar(maxS);
  target.y = input.rise * cfg.vertical_speed + -m.pitch * cfg.vertical_speed * 0.65;
  m.vel.lerp(target, 1 - Math.exp(-cfg.acceleration * dt * 0.2));
  m.vel.multiplyScalar(1 - cfg.drag * dt * 0.12);

  const before = m.root.position.clone();
  m.root.position.addScaledVector(m.vel, dt);
  m.root.position.y = clamp(m.root.position.y, 0.6, 42);
  m.distance += before.distanceTo(m.root.position);

  m.bank += (-input.move.x * cfg.bank_strength - m.bank) * (1 - Math.exp(-6 * dt));
  m.bob += dt * (8 + m.vel.length() * 0.35);
  m.root.rotation.set(m.pitch * 0.35, m.yaw, m.bank);
  m.body.position.y = 0.04 + Math.sin(m.bob) * cfg.hover_bob_amount;
  const flap = Math.sin(performance.now() * 0.028 * (m.state === "healthy" ? 1 : 1.7)) * 0.7;
  m.wingL.rotation.z = 0.55 + flap;
  m.wingR.rotation.z = -0.55 - flap;
  if (m.hindL) m.hindL.rotation.z = 0.35 + flap * 0.75;
  if (m.hindR) m.hindR.rotation.z = -0.35 - flap * 0.75;
  if (m.antL) m.antL.rotation.x = -0.7 + Math.sin(m.bob * 1.4) * 0.12;
  if (m.antR) m.antR.rotation.x = -0.7 + Math.sin(m.bob * 1.4 + 0.4) * 0.12;
  if (m.abdomen) m.abdomen.position.y = -0.02 + Math.sin(m.bob * 0.8) * 0.012;

  m.light.intensity = 1.4 * m.glow;
  m.light.distance = 8 * m.glow * cfg.player_light_radius;
  m.body.material.emissiveIntensity = 2.2 * m.glow;
  m.halo.material.opacity = 0.1 + m.glow * 0.18;
  if (m.bloomHalo) m.bloomHalo.material.opacity = 0.05 + m.glow * 0.1;
  m.invuln = Math.max(0, m.invuln - dt);
}

export function collectFirefly(m, cfg) {
  m.combo += 1;
  m.comboT = 4.2;
  if (overglowReady(m.combo, cfg.overglow_threshold) && m.overglow <= 0) {
    m.overglow = 6 * cfg.overglow_duration;
    return true;
  }
  return false;
}

export function hit(m, kind, amount = 0.28) {
  if (m.dead || m.invuln > 0) return false;
  if (kind === "predator") {
    m.health = 0;
    m.state = "dead";
    m.dead = true;
    return true;
  }
  m.health = Math.max(0, m.health - amount);
  m.invuln = 0.55;
  m.state = m.health < 0.35 ? "critical" : "damaged";
  if (m.health <= 0) {
    m.dead = true;
    m.state = "dead";
    return true;
  }
  return false;
}

export function collectRadius(m, cfg) {
  return 1.6 + m.glow * 1.4 * cfg.firefly_attraction;
}

export function detectionMul(m) {
  return m.glow * (m.overglow > 0 ? 1.35 : 1);
}
