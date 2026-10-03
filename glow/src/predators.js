import * as THREE from "../vendor/three.module.js";
import { detectionScore, fidelityProfile } from "./rules.js";
import { detectionMul } from "./moth.js";

const VISION = { owl: 34, crow: 28, bat: 14, bobcat: 18, dragonfly: 16, fox: 14, frog: 10 };
const SPD = { owl: 13, crow: 11.5, bat: 16, dragonfly: 16, bobcat: 9, fox: 10, frog: 6 };
const SPEC = { owl: 1.3, crow: 1.1, bat: 0.55, bobcat: 0.9, dragonfly: 1.0, fox: 0.9, frog: 0.7 };
const TRAIL = { owl: 1.2, crow: 1.0, bat: 0.25, bobcat: 0.8, fox: 1.2, dragonfly: 0.6, frog: 0.3 };

export function createPredator(kind, pos, fidelity = 1) {
  const p = fidelityProfile(fidelity);
  const root = new THREE.Group();
  const radial = p.predRadial;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0e,
    emissive: kind === "owl" || kind === "bobcat" ? 0xe6281a : 0xb38033,
    emissiveIntensity: 0.35,
    roughness: p.level === 1 ? 0.7 : 0.45,
  });
  const aerial = kind === "owl" || kind === "crow";
  const ground = kind === "bobcat" || kind === "fox";
  let body;
  if (aerial) {
    body = new THREE.Mesh(
      p.level === 1 ? new THREE.BoxGeometry(0.7, 0.35, 1.1) : new THREE.SphereGeometry(0.32, radial, Math.max(6, radial - 2)),
      bodyMat
    );
    if (p.level > 1) body.scale.set(0.85, 0.7, 1.55);
  } else if (ground) {
    body = new THREE.Mesh(
      p.level === 1 ? new THREE.BoxGeometry(0.7, 0.45, 1.3) : new THREE.SphereGeometry(0.34, radial, Math.max(6, radial - 2)),
      bodyMat
    );
    if (p.level > 1) body.scale.set(0.7, 0.55, 1.7);
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(0.26, radial, Math.max(6, p.level === 1 ? 6 : radial - 2)), bodyMat);
  }
  root.add(body);

  const extras = [];
  if (p.predParts) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, radial, Math.max(6, radial - 2)), bodyMat);
    head.position.set(0, 0.08, -0.42);
    root.add(head);
    extras.push(head);
    if (ground) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bodyMat);
      tail.scale.set(0.5, 0.5, 2.2);
      tail.position.set(0, 0.05, 0.55);
      root.add(tail);
      extras.push(tail);
    }
  }

  let wingL = null;
  let wingR = null;
  if (p.predWings && (aerial || kind === "bat" || kind === "dragonfly")) {
    const wMat = new THREE.MeshStandardMaterial({
      color: 0x141418,
      emissive: 0x331108,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
      transparent: kind === "dragonfly",
      opacity: kind === "dragonfly" ? 0.35 : 1,
    });
    const wGeo = new THREE.PlaneGeometry(kind === "owl" ? 0.9 : 0.7, 0.28);
    wingL = new THREE.Mesh(wGeo, wMat);
    wingR = wingL.clone();
    wingL.position.set(-0.4, 0.05, 0);
    wingR.position.set(0.4, 0.05, 0);
    root.add(wingL, wingR);
  }

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, p.level === 1 ? 6 : Math.min(12, 4 + p.level), p.level === 1 ? 6 : 8),
    new THREE.MeshBasicMaterial({ color: 0xff2614 })
  );
  eye.position.set(0.12, 0.1, -0.4);
  root.add(eye);
  if (p.predParts) {
    const eye2 = eye.clone();
    eye2.position.x = -0.12;
    root.add(eye2);
  }
  root.position.copy(pos);
  return {
    kind,
    root,
    body,
    wingL,
    wingR,
    extras,
    home: pos.clone(),
    vel: new THREE.Vector3(),
    state: kind === "owl" ? "perch" : "roam",
    t: 0,
    interest: 0,
    trailTarget: pos.clone(),
    escaped: false,
    fidelity: p.level,
  };
}

export function updatePredator(p, moth, trail, cfg, dt, hooks) {
  p.t += dt;
  const pos = p.root.position;
  const mpos = moth.root.position;
  const dist = pos.distanceTo(mpos);
  const range = VISION[p.kind] || 12;
  const moveF = clamp01(moth.vel.length() / 16, 0.25, 1.4);
  p.interest = detectionScore(dist, range, detectionMul(moth), moveF, SPEC[p.kind] || 0.85, true, 1);
  const info = trail.interestAt(pos, TRAIL[p.kind] || 0.5, cfg);
  if (info.interest > p.interest * 0.7) {
    p.interest = Math.max(p.interest, info.interest);
    p.trailTarget.copy(info.position);
    if (["idle", "roam", "perch", "observe"].includes(p.state) && info.interest > 0.28) p.state = "trail";
  }

  if (["perch", "idle", "roam", "observe"].includes(p.state) && p.interest > 0.42) {
    p.state = "alert";
    if (p.kind === "owl") hooks?.hoot?.();
  } else if (p.state === "alert") {
    if (p.interest > 0.55) p.state = "chase";
    else if (p.interest < 0.2) p.state = "search";
  } else if (p.state === "trail") {
    if (p.interest > 0.6) p.state = "chase";
    else if (pos.distanceTo(p.trailTarget) < 1.4) p.state = "search";
  } else if (p.state === "chase") {
    if (p.interest < 0.18) {
      p.state = "search";
      if (!p.escaped) {
        p.escaped = true;
        hooks?.escaped?.();
      }
    }
  } else if (p.state === "search") {
    if (p.interest > 0.4) p.state = "chase";
    else if (p.t > 8) p.state = "return";
  } else if (p.state === "return" && pos.distanceTo(p.home) < 2) {
    p.state = p.kind === "owl" ? "perch" : "roam";
    p.escaped = false;
    p.t = 0;
  }

  let dest = p.home.clone();
  let spd = SPD[p.kind] || 6;
  if (p.state === "perch") spd *= 0.15;
  else if (p.state === "roam" || p.state === "idle") {
    dest = p.home.clone().add(new THREE.Vector3(Math.sin(p.t * 0.4), Math.cos(p.t * 0.25) * 0.4, Math.cos(p.t * 0.33)).multiplyScalar(6));
  } else if (p.state === "alert" || p.state === "observe") {
    dest.copy(mpos);
    spd *= 0.35;
  } else if (p.state === "trail") dest.copy(p.trailTarget);
  else if (p.state === "chase") {
    dest.copy(mpos);
    if (p.kind === "crow") dest.add(new THREE.Vector3(-Math.sin(moth.yaw), 0, -Math.cos(moth.yaw)).multiplyScalar(3));
    if ((p.kind === "bobcat" || p.kind === "fox") && mpos.y > 4.5) dest.y = 1.2;
    if (p.kind === "frog") {
      spd *= 0.2;
      if (dist < 7 && mpos.y < 4) {
        dest.copy(mpos);
        spd = 28;
      }
    }
  } else if (p.state === "search") {
    dest.copy(mpos).add(new THREE.Vector3(Math.sin(p.t), 0.4, Math.cos(p.t)).multiplyScalar(5));
  }

  const to = dest.sub(pos);
  if (to.length() > 0.05) {
    to.normalize().multiplyScalar(spd);
    p.vel.lerp(to, 1 - Math.exp(-3 * dt));
  }
  if (["bobcat", "fox", "frog"].includes(p.kind) && (p.kind !== "frog" || p.state !== "chase")) {
    p.vel.y = 0;
    pos.y = Math.max(0.4, pos.y);
  }
  pos.addScaledVector(p.vel, dt);
  p.root.lookAt(pos.clone().add(p.vel));
  if (p.wingL && p.wingR) {
    const flap = Math.sin(p.t * (p.state === "chase" ? 18 : 8)) * 0.45;
    p.wingL.rotation.z = 0.35 + flap;
    p.wingR.rotation.z = -0.35 - flap;
  }

  const reach = p.kind === "frog" ? 1.6 : 1.15;
  if (dist < 0.55 && ["chase", "attack", "alert"].includes(p.state)) return "kill";
  if (dist < reach && ["chase", "attack", "alert"].includes(p.state)) return "near";
  return null;
}

function clamp01(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
