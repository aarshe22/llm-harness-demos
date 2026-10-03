import * as THREE from "../vendor/three.module.js";
import { detectionScore } from "./rules.js";
import { detectionMul } from "./moth.js";

const VISION = { owl: 34, crow: 28, bat: 14, bobcat: 18, dragonfly: 16, fox: 14, frog: 10 };
const SPD = { owl: 13, crow: 11.5, bat: 16, dragonfly: 16, bobcat: 9, fox: 10, frog: 6 };
const SPEC = { owl: 1.3, crow: 1.1, bat: 0.55, bobcat: 0.9, dragonfly: 1.0, fox: 0.9, frog: 0.7 };
const TRAIL = { owl: 1.2, crow: 1.0, bat: 0.25, bobcat: 0.8, fox: 1.2, dragonfly: 0.6, frog: 0.3 };

export function createPredator(kind, pos) {
  const root = new THREE.Group();
  const geo =
    kind === "owl" || kind === "crow"
      ? new THREE.BoxGeometry(0.7, 0.35, 1.1)
      : kind === "bobcat" || kind === "fox"
        ? new THREE.BoxGeometry(0.7, 0.45, 1.3)
        : new THREE.SphereGeometry(0.26, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0e,
    emissive: kind === "owl" || kind === "bobcat" ? 0xe6281a : 0xb38033,
    emissiveIntensity: 0.35,
  });
  root.add(new THREE.Mesh(geo, mat));
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2614 })
  );
  eye.position.set(0.12, 0.1, -0.4);
  root.add(eye);
  root.position.copy(pos);
  return {
    kind,
    root,
    home: pos.clone(),
    vel: new THREE.Vector3(),
    state: kind === "owl" ? "perch" : "roam",
    t: 0,
    interest: 0,
    trailTarget: pos.clone(),
    escaped: false,
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

  const reach = p.kind === "frog" ? 1.6 : 1.15;
  if (dist < 0.55 && ["chase", "attack", "alert"].includes(p.state)) return "kill";
  if (dist < reach && ["chase", "attack", "alert"].includes(p.state)) return "near";
  return null;
}

function clamp01(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
