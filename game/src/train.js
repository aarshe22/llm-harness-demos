/* Ring railway + LEGO steam train with distance-attenuated, doppler-shifted
   whistle. Track geometry lives in World.buildRingRail(); this drives the
   consist around world.railR and emits steam + sound. */
import * as THREE from 'three';
import { BR, CY, mkMat, clamp } from './brickkit.js';
import { sfx } from './sfx.js';

export class Train {
  constructor(world, scene, rand) {
    this.world = world;
    this.scene = scene;
    this.rand = rand;
    this.R = world.railR;
    this.loop = 8 * this.R;
    this.u = this.loop * 0.12;
    this.speed = 8;
    this.pos = new THREE.Vector3();
    this.group = new THREE.Group();
    scene.add(this.group);
    this._phase = 0;
    this._smokeT = 0;
    this._nextW = 2;
    this._whistleUntil = 0;
    this._prevD = null;
    this.whistle = { gain: null, osc: null, osc2: null };
    this.buildTrain();
  }

  dispose() {
    this.scene.remove(this.group);
    this._killWhistle();
  }

  legoGuy(shirt) {
    const g = new THREE.Group();
    const skin = mkMat(0xffcc99), pants = mkMat(0x22252b);
    const b = (mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(BR, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
      g.add(m); return m;
    };
    b(pants, 0.16, 0.22, 0.18, -0.08, 0.11, 0);
    b(pants, 0.16, 0.22, 0.18, 0.08, 0.11, 0);
    b(mkMat(shirt), 0.32, 0.28, 0.2, 0, 0.36, 0);
    b(skin, 0.24, 0.2, 0.2, 0, 0.6, 0);
    b(mkMat(0xdc1414), 0.26, 0.06, 0.24, 0, 0.72, 0);
    return g;
  }

  buildTrain() {
    const b = (parent, mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(BR, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
      parent.add(m); return m;
    };
    const red = mkMat(0xb4321f), black = mkMat(0x22252b), brass = mkMat(0xf5aa0f, { metalness: 0.6, roughness: 0.3 });
    const wheel = (x, z) => {
      const d = new THREE.Mesh(CY, black);
      d.scale.set(0.34, 0.34, 0.34);
      d.rotation.z = Math.PI / 2;
      d.position.set(x, 0.42, z);
      return d;
    };
    const loco = new THREE.Group();
    b(loco, black, 1.6, 0.5, 3.4, 0, 0.75, 0);
    const boiler = new THREE.Mesh(CY, red);
    boiler.scale.set(0.66, 2.3, 0.66);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 1.2, -0.55);
    loco.add(boiler);
    b(loco, black, 0.8, 0.8, 0.18, 0, 1.2, -1.72);
    b(loco, black, 0.42, 0.62, 0.42, 0, 1.62, -1.15);          // stack
    b(loco, brass, 0.54, 0.1, 0.54, 0, 1.97, -1.15);
    b(loco, red, 1.4, 1.15, 1.25, 0, 1.35, 0.95);              // cab
    b(loco, mkMat(0x9fd4ff), 1.0, 0.5, 0.08, 0, 1.55, 0.32);   // cab window
    b(loco, red, 1.7, 0.12, 3.6, 0, 0.46, 0);                  // running board
    b(loco, brass, 0.18, 0.22, 0.18, 0, 1.85, 0.35);           // bell
    const lamp = b(loco, mkMat(0xfff2c0, { emissive: 0xffd23f, emissiveIntensity: 1.4 }), 0.28, 0.28, 0.16, 0, 1.7, -1.82);
    const wheels = [];
    for (const z of [-1.1, -0.1, 0.9]) {
      const w1 = wheel(-0.78, z), w2 = wheel(0.78, z);
      loco.add(w1, w2);
      wheels.push(w1, w2);
    }
    const driver = this.legoGuy(0x22252b);
    driver.position.set(0, 1.05, 1.05);
    loco.add(driver);
    loco.userData = { wheels, lamp };

    this.cars = [loco];
    const carCols = [0x2f7de1, 0x2aa876];
    for (let i = 0; i < 2; i++) {
      const car = new THREE.Group();
      b(car, black, 1.4, 0.22, 2.8, 0, 0.48, 0);
      b(car, mkMat(carCols[i]), 1.3, 0.95, 2.5, 0, 1.06, 0);
      b(car, mkMat(0xf0e2c0), 1.4, 0.12, 2.6, 0, 1.6, 0);
      const cw = [];
      for (const z of [-0.85, 0.85]) {
        const w1 = wheel(-0.62, z), w2 = wheel(0.62, z);
        car.add(w1, w2);
        cw.push(w1, w2);
      }
      const pax = this.legoGuy(i ? 0x8e44ad : 0xdc1414);
      pax.position.set(0, 0.6, 0.2);
      car.add(pax);
      car.userData = { wheels: cw };
      this.cars.push(car);
    }
    for (const c of this.cars) {
      c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(c);
    }
    this.loco = loco;
  }

  /* u along the clockwise perimeter from the SW corner: 0=SW, +x along south
     edge, right up the east side, back along the north, down the west. */
  pathPoint(u) {
    const R = this.R, L = 2 * R, loop = this.loop;
    u = ((u % loop) + loop) % loop;
    const k = Math.floor(u / L);
    const s = u - k * L;
    if (k === 0) return { x: -R + s, z: -R, yaw: Math.PI / 2 };     // heading +X
    if (k === 1) return { x: R, z: -R + s, yaw: Math.PI };          // heading +Z
    if (k === 2) return { x: R - s, z: R, yaw: -Math.PI / 2 };      // heading -X
    return { x: -R, z: R - s, yaw: 0 };                             // heading -Z
  }

  update(dt, camera) {
    this._phase += dt;
    this.u = (this.u + dt * this.speed) % this.loop;
    const spacing = 4.0;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const p = this.pathPoint(this.u - i * spacing);
      car.position.set(p.x, 0.3, p.z);
      car.rotation.y = p.yaw;
      for (const w of (car.userData.wheels || [])) w.rotation.x += dt * (this.speed / 0.34);
    }
    const front = this.pathPoint(this.u);
    this.pos.set(front.x, 0, front.z);
    // steam puffs off the stack
    this._smokeT -= dt;
    if (this._smokeT <= 0 && this.world.fx && this.world.fx.spawn) {
      this._smokeT = 0.14;
      this.world.fx.spawn(front.x, 2.6, front.z, 'smoke', 2);
    }
    if (!camera) { this._setWhistle(0, 1); return; }
    const d = camera.position.distanceTo(this.loco.position);
    // distance attenuation: full inside 25 m, silent past ~140 m
    const vol = clamp(1 - (d - 25) / 115, 0, 1);
    // doppler from range rate (approaching raises pitch)
    let rate = 0;
    if (this._prevD !== null) rate = (this._prevD - d) / Math.max(1e-3, dt);
    this._prevD = d;
    const dop = clamp(1 + rate / 55, 0.8, 1.25);
    // whistle schedule: honks more often/longer when the player is near
    this._nextW -= dt * (d < 45 ? 1.8 : 1);
    if (this._nextW <= 0) {
      this._nextW = 5 + Math.random() * 4;
      this._whistleUntil = this._phase + (d < 45 ? 1.3 : 0.6);
    }
    this._setWhistle(this._phase < this._whistleUntil ? vol : 0, dop);
  }

  /* Two-tone steam whistle: a pair of detuned sawtooth oscillators through a
     lowpass, gain + frequency ride live so it doppler-bends smoothly. */
  _ensureWhistle() {
    if (this.whistle.gain || !sfx.ensure()) return;
    const t = sfx.ac.currentTime;
    const gain = sfx.ac.createGain();
    gain.gain.value = 0.0001;
    const flt = sfx.ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 1600;
    flt.Q.value = 2;
    const o1 = sfx.ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 480;
    const o2 = sfx.ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 605;
    o1.connect(flt); o2.connect(flt);
    flt.connect(gain); gain.connect(sfx.master);
    o1.start(t); o2.start(t);
    this.whistle = { gain, osc: o1, osc2: o2, flt };
  }

  _setWhistle(vol, dop) {
    if (vol <= 0.001) {
      if (this.whistle.gain && this.whistle.gain.gain.value > 0.0002) {
        const t = sfx.ac.currentTime;
        this.whistle.gain.gain.cancelScheduledValues(t);
        this.whistle.gain.gain.setTargetAtTime(0.0001, t, 0.08);
      }
      return;
    }
    this._ensureWhistle();
    if (!this.whistle.gain) return;
    const t = sfx.ac.currentTime;
    this.whistle.gain.gain.setTargetAtTime(0.09 * vol, t, 0.06);
    this.whistle.osc.frequency.setTargetAtTime(480 * dop, t, 0.1);
    this.whistle.osc2.frequency.setTargetAtTime(605 * dop, t, 0.1);
  }

  _killWhistle() {
    const { gain, osc, osc2 } = this.whistle;
    if (!gain) return;
    const t = sfx.ac.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    osc.stop(t + 0.25); osc2.stop(t + 0.25);
    this.whistle = { gain: null };
  }
}
