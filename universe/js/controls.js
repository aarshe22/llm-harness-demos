/* =========================================================================
 * Voxel Cosmos — controls.js
 * Self-contained orbit / zoom / pan camera controls (no addons, no modules).
 * Mouse: left-drag orbit, right-drag or shift-drag pan, wheel zoom.
 * Touch: 1 finger orbit, 2 fingers pinch-zoom + pan. Inertial damping.
 * VC.nav temporarily disables `enabled` during guided flights.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;

  function VoxelControls(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 40, 60);
    this.enabled = true;
    this.minDistance = 3;
    this.maxDistance = 780;
    this.minPolar = 0.03;
    this.maxPolar = Math.PI - 0.03;
    this.rotateSpeed = 1.0;
    this.panSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.damping = 6.5;

    this._sph = new THREE.Spherical();
    this._sphGoal = new THREE.Spherical();
    this._panGoal = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._pointers = new Map();
    this._lastPinch = 0;
    this._lastMid = new THREE.Vector2();
    this._state = 0; // 0 none, 1 rotate, 2 pan
    this._prev = new THREE.Vector2();
    this._moved = false;
    this._init(dom);
    this.syncFromCamera();
  }

  VoxelControls.prototype.syncFromCamera = function () {
    this._offset.copy(this.camera.position).sub(this.target);
    this._sph.setFromVector3(this._offset);
    this._sphGoal.copy(this._sph);
    this._panGoal.set(0, 0, 0);
  };
  VoxelControls.prototype.setFrom = function (pos, tgt) {
    this.target.copy(tgt);
    this.camera.position.copy(pos);
    this.syncFromCamera();
  };

  VoxelControls.prototype._init = function (dom) {
    var self = this;
    function need(e) { return self.enabled; }

    dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    dom.addEventListener('pointerdown', function (e) {
      if (!need(e)) return;
      dom.setPointerCapture(e.pointerId);
      self._pointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
      self._moved = false;
      if (self._pointers.size === 1) {
        self._prev.set(e.clientX, e.clientY);
        self._state = (e.button === 2 || e.shiftKey) ? 2 : 1;
      } else if (self._pointers.size === 2) {
        self._state = 3; // pinch/pan
        var pts = Array.from(self._pointers.values());
        self._lastPinch = pts[0].distanceTo(pts[1]);
        self._lastMid.set((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      }
    });

    dom.addEventListener('pointermove', function (e) {
      if (!self._pointers.has(e.pointerId)) return;
      self._pointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
      if (!self.enabled) return;
      if (self._pointers.size === 1 && self._state === 1) {
        self._rotateDelta((e.clientX - self._prev.x) * self.rotateSpeed, (e.clientY - self._prev.y) * self.rotateSpeed);
        self._prev.set(e.clientX, e.clientY);
        self._moved = true;
      } else if (self._pointers.size === 1 && self._state === 2) {
        self._panDelta((e.clientX - self._prev.x) * self.panSpeed, (e.clientY - self._prev.y) * self.panSpeed);
        self._prev.set(e.clientX, e.clientY);
        self._moved = true;
      } else if (self._pointers.size === 2) {
        var pts = Array.from(self._pointers.values());
        var dist = pts[0].distanceTo(pts[1]);
        var mid = new THREE.Vector2((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        if (self._lastPinch > 0) {
          var k = self._lastPinch / Math.max(dist, 1);
          self._zoom(k * 0.06 * self.zoomSpeed);
        }
        self._panDelta((mid.x - self._lastMid.x) * self.panSpeed * 0.8, (mid.y - self._lastMid.y) * self.panSpeed * 0.8);
        self._lastPinch = dist;
        self._lastMid.copy(mid);
        self._moved = true;
      }
    });

    function up(e) {
      self._pointers.delete(e.pointerId);
      if (self._pointers.size === 0) self._state = 0;
      else if (self._pointers.size === 1) {
        self._state = 1;
        var p = Array.from(self._pointers.values())[0];
        self._prev.copy(p);
      }
      self._lastPinch = 0;
    }
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);

    dom.addEventListener('wheel', function (e) {
      if (!self.enabled) return;
      e.preventDefault();
      var dir = e.deltaY > 0 ? 1 : -1;
      var mode = e.deltaMode; // 1 = lines
      self._zoom(dir * (mode === 1 ? 0.06 : Math.min(Math.abs(e.deltaY) / 380, 0.35)) * self.zoomSpeed);
    }, { passive: false });

    window.addEventListener('resize', function () {
      self._lastPinch = 0;
    });
  };

  VoxelControls.prototype._rotateDelta = function (dx, dy) {
    var h = this.dom.clientHeight || 1;
    this._sphGoal.theta -= (dx / h) * Math.PI * 1.6;
    this._sphGoal.phi = VC.clamp(this._sphGoal.phi - (dy / h) * Math.PI * 1.2, this.minPolar, this.maxPolar);
  };
  VoxelControls.prototype._panDelta = function (dx, dy) {
    var dist = this._sphGoal.radius;
    var h = this.dom.clientHeight || 1;
    var scale = 2 * Math.tan((this.camera.fov / 2) * Math.PI / 180) * dist / h;
    var te = this.camera.matrix.elements;
    var vx = new THREE.Vector3(te[0], te[1], te[2]);
    var vy = new THREE.Vector3(te[4], te[5], te[6]);
    this._panGoal.addScaledVector(vx, -dx * scale);
    this._panGoal.addScaledVector(vy, dy * scale);
  };
  VoxelControls.prototype._zoom = function (k) {
    var r = this._sphGoal.radius;
    if (k > 0) r *= (1 + k); else r /= (1 - k);
    this._sphGoal.radius = VC.clamp(r, this.minDistance, this.maxDistance);
  };

  VoxelControls.prototype.update = function (dt) {
    var l = 1 - Math.exp(-this.damping * dt);
    this._sph.radius = VC.lerp(this._sph.radius, this._sphGoal.radius, l);
    this._sph.theta += VC.shortestAngle(this._sph.theta, this._sphGoal.theta) * l;
    this._sph.phi = VC.lerp(this._sph.phi, this._sphGoal.phi, l);
    this.target.addScaledVector(this._panGoal, l);
    this._panGoal.multiplyScalar(1 - l);
    this._offset.setFromSpherical(this._sph);
    this.camera.position.copy(this.target).add(this._offset);
    this.camera.lookAt(this.target);
  };
  VoxelControls.prototype.hasMoved = function () { return this._moved; };
  VC.VoxelControls = VoxelControls;
}());
