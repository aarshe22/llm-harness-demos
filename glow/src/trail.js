import * as THREE from "../vendor/three.module.js";

export class LogicalTrail {
  constructor() {
    this.samples = [];
    this.clock = 0;
    this.accum = 0;
    this.line = null;
  }

  attach(scene) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(180 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      color: 0xb8e6ff,
      transparent: true,
      opacity: 0.55,
    });
    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  push(pos, intensity, dir, vel, dt, cfg) {
    this.clock += dt;
    this.accum += dt;
    if (this.accum >= 0.045) {
      this.accum = 0;
      this.samples.push({
        position: pos.clone(),
        time: this.clock,
        intensity,
        direction: dir.clone(),
        velocity: vel.clone(),
      });
    }
    const life = cfg.trail_lifetime * cfg.trail_length;
    this.samples = this.samples.filter((s) => this.clock - s.time <= life).slice(-180);
    this.draw();
  }

  draw() {
    if (!this.line) return;
    const attr = this.line.geometry.attributes.position;
    for (let i = 0; i < this.samples.length; i++) {
      const p = this.samples[i].position;
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.samples.length);
    const last = this.samples[this.samples.length - 1];
    this.line.material.opacity = last ? Math.min(0.75, 0.2 + last.intensity * 0.35) : 0;
  }

  interestAt(pos, sensitivity, cfg) {
    let best = 0;
    let bestPos = pos;
    let bestDir = new THREE.Vector3(0, 0, 1);
    const life = cfg.trail_lifetime;
    for (const s of this.samples) {
      const fresh = Math.min(1, Math.max(0, 1 - (this.clock - s.time) / Math.max(0.2, life)));
      const dist = pos.distanceTo(s.position);
      const distF = Math.min(1, Math.max(0, 1 - dist / 28));
      const v = s.intensity * fresh * sensitivity * distF * cfg.trail_predator_attract;
      if (v > best) {
        best = v;
        bestPos = s.position;
        bestDir = s.direction;
      }
    }
    return { interest: best, position: bestPos, direction: bestDir };
  }
}
