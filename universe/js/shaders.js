/* =========================================================================
 * Voxel Cosmos — shaders.js
 * Procedural sky dome, stars, animated water & lava materials (no textures),
 * pooled CPU particle fields, voxel cloud puffs, light shafts, sprites.
 * All ShaderMaterials register with VC.shaders so time-of-day + time updates
 * happen in a single pass. Fog is applied manually (manualFog=true) so these
 * shaders stay independent of internal Three.js fog chunk conventions.
 * ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  VC.shaders = [];

  /* Shared manual-fog GLSL chunk */
  var FOG_PARS = [
    'uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;',
    'float applyFog(float dist){ return clamp((uFogFar - dist)/(uFogFar - uFogNear), 0.0, 1.0); }'
  ].join('\n');

  function attachFog(mat) {
    mat.uniforms.uFogColor = { value: new THREE.Color(0xbfd9ff) };
    mat.uniforms.uFogNear = { value: 120 };
    mat.uniforms.uFogFar = { value: 900 };
    mat.userData.manualFog = true;
    VC.shaders.push(mat);
    return mat;
  }

  /* ---------------- sky dome ---------------- */
  VC.createSkyDome = function () {
    var uniforms = {
      uTop: { value: new THREE.Color(0x3f7fd0) },
      uBottom: { value: new THREE.Color(0xbfd9ff) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uSunColor: { value: new THREE.Color(0xfff2c0) },
      uSunGlow: { value: 1.0 },
      uNight: { value: 0.0 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uTop, uBottom, uSunColor, uSunDir;',
        'uniform float uSunGlow, uNight;',
        'float hash(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = clamp(d.y*0.5+0.5, 0.0, 1.0);',
        '  vec3 col = mix(uBottom, uTop, pow(h, 0.72));',
        '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
        '  col += uSunColor * pow(sd, 220.0) * 2.4 * uSunGlow;',
        '  col += uSunColor * pow(sd, 14.0) * 0.32 * uSunGlow;',
        '  col += uSunColor * pow(sd, 3.0) * 0.07 * uSunGlow;',
        '  if (uNight > 0.01 && d.y > -0.05) {',
        '    vec3 g = floor(d * 240.0);',
        '    float s = hash(g);',
        '    if (s > 0.9952) col += vec3(0.9,0.95,1.0) * uNight * (0.35+0.65*hash(g+3.7));',
        '  }',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    mesh.scale.setScalar(600);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    mesh.name = 'sky';
    mat.userData.type = 'sky';
    VC.shaders.push(mat);
    return { mesh: mesh, uniforms: uniforms };
  };

  /* ---------------- star field (Points) ---------------- */
  VC.makeStars = function (count, radius, center) {
    var rng = VC.makeRng(777);
    var pos = new Float32Array(count * 3);
    var phase = new Float32Array(count);
    var v = new THREE.Vector3();
    for (var i = 0; i < count; i++) {
      v.set(rng.range(-1, 1), rng.range(0.02, 1), rng.range(-1, 1)).normalize().multiplyScalar(radius);
      pos[i * 3] = v.x + center.x; pos[i * 3 + 1] = v.y + center.y; pos[i * 3 + 2] = v.z + center.z;
      phase[i] = rng.range(0, 6.28);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        'attribute float phase;',
        'uniform float uTime; varying float vTw;',
        'void main(){',
        '  vTw = 0.55 + 0.45*sin(uTime*1.7 + phase*13.0);',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  gl_PointSize = 2.0 * (300.0/max(-mv.z,1.0)) * vTw + 1.0;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uOpacity; varying float vTw;',
        'void main(){',
        '  float a = smoothstep(0.5, 0.08, length(gl_PointCoord-0.5));',
        '  gl_FragColor = vec4(vec3(0.85,0.9,1.0), a*vTw*uOpacity);',
        '}'
      ].join('\n')
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.name = 'stars';
    mat.userData.type = 'stars';
    VC.shaders.push(mat);
    return pts;
  };

  /* ---------------- animated water ---------------- */
  VC.waterMaterial = function (opts) {
    opts = opts || {};
    var uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(opts.deep || 0x1b4a8a) },
      uShallow: { value: new THREE.Color(opts.shallow || 0x3f8fd0) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.2) },
      uSunI: { value: 1.0 },
      uOpacity: { value: opts.opacity === undefined ? 0.93 : opts.opacity },
      uAmp: { value: opts.amp === undefined ? 1 : opts.amp }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, transparent: true, side: THREE.DoubleSide, fog: false,
      vertexShader: [
        'uniform float uTime; uniform float uAmp;',
        'varying vec3 vWorld; varying float vW; varying float vDist;',
        'void main(){',
        '  vec3 p = position;',
        '  float w = sin(p.x*0.35 + uTime*1.6)*0.5 + sin(p.y*0.4 - uTime*1.2)*0.5;',
        '  p.z += w * 0.26 * uAmp;',           /* plane rotated -90X: local z is world up */
        '  vW = w;',
        '  vec4 wp = modelMatrix * vec4(p,1.0);',
        '  vWorld = wp.xyz;',
        '  vec4 mv = viewMatrix * wp;',
        '  vDist = -mv.z;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        FOG_PARS,
        'uniform vec3 uDeep, uShallow, uSunDir; uniform float uTime, uSunI, uOpacity;',
        'varying vec3 vWorld; varying float vW; varying float vDist;',
        'void main(){',
        '  vec3 n = normalize(vec3(cos(vWorld.x*0.35+uTime*1.6)*0.30, 1.0, cos(vWorld.z*0.4-uTime*1.2)*0.30));',
        '  float diff = max(dot(n, normalize(uSunDir)), 0.0);',
        '  vec3 col = mix(uDeep, uShallow, clamp(vW*0.35+0.5,0.0,1.0));',
        '  col *= (0.55 + 0.6*diff*uSunI);',
        '  vec3 V = normalize(cameraPosition - vWorld);',
        '  vec3 R = reflect(-normalize(uSunDir), n);',
        '  float spec = pow(max(dot(R, V), 0.0), 48.0);',
        '  col += vec3(1.0,0.95,0.8) * spec * uSunI;',
        '  col += uShallow * pow(1.0 - max(dot(n, V),0.0), 3.0) * 0.25;',
        '  col = mix(uFogColor, col, applyFog(vDist));',
        '  gl_FragColor = vec4(col, uOpacity);',
        '}'
      ].join('\n')
    });
    mat.userData.type = 'water';
    return attachFog(mat);
  };

  /* ---------------- animated lava / molten rock ---------------- */
  VC.lavaMaterial = function (opts) {
    opts = opts || {};
    var uniforms = {
      uTime: { value: 0 },
      uColA: { value: new THREE.Color(opts.a || 0x300802) },
      uColB: { value: new THREE.Color(opts.b || 0xff5a10) },
      uColHot: { value: new THREE.Color(opts.hot || 0xffd23a) },
      uSpeed: { value: opts.speed || 1 },
      uScale: { value: opts.scale || 0.09 },
      uGlow: { value: 1 },
      uOpacity: { value: opts.opacity === undefined ? 1 : opts.opacity }
    };
    var transparent = uniforms.uOpacity.value < 1;
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, transparent: transparent, side: THREE.DoubleSide, fog: false, depthWrite: !transparent,
      vertexShader: [
        'varying vec3 vWorld; varying float vDist;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz;',
        '  vec4 mv = viewMatrix * wp; vDist = -mv.z;',
        '  gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        FOG_PARS,
        'uniform vec3 uColA, uColB, uColHot; uniform float uTime, uSpeed, uScale, uGlow, uOpacity;',
        'varying vec3 vWorld; varying float vDist;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
        'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }',
        'float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.07; a*=0.5; } return v; }',
        'void main(){',
        '  vec2 q = vWorld.xz*uScale;',
        '  float t = uTime*0.12*uSpeed;',
        '  float n = fbm(q + vec2(t, -t*0.7) + fbm(q*0.6 - t*0.4));',
        '  vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.75, n));',
        '  col = mix(col, uColHot, smoothstep(0.55, 0.66, n)*0.4);',
        '  col *= uGlow;',
        '  col = mix(uFogColor, col, applyFog(vDist));',
        '  gl_FragColor = vec4(col, uOpacity); }'
      ].join('\n')
    });
    mat.userData.type = 'lava';
    return attachFog(mat);
  };

  /* ---------------- energy / magical glow sheet ---------------- */
  VC.energyMaterial = function (opts) {
    opts = opts || {};
    var uniforms = {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(opts.color || 0x9a5aff) },
      uSpeed: { value: opts.speed || 1 }, uGlow: { value: 1 }, uOpacity: { value: opts.opacity || 0.85 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: [
        'varying vec3 vWorld; varying float vDist;',
        'void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWorld = wp.xyz;',
        ' vec4 mv = viewMatrix*wp; vDist=-mv.z; gl_Position = projectionMatrix*mv; }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uTime,uSpeed,uGlow,uOpacity;',
        'varying vec3 vWorld; varying float vDist;',
        'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
        ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }',
        'void main(){',
        '  float n = noise(vWorld.xz*0.3 + uTime*0.6*uSpeed) * noise(vWorld.xz*0.11 - uTime*0.3*uSpeed);',
        '  float fade = clamp((260.0-vDist)/120.0, 0.0, 1.0);',
        '  float a = pow(n*2.2, 1.6)*uOpacity*fade;',
        '  gl_FragColor = vec4(uColor*uGlow*(0.5+n), a); }'
      ].join('\n')
    });
    mat.userData.type = 'energy';
    VC.shaders.push(mat);
    return mat;
  };

  /* =====================================================================
   * PARTICLE FIELD — CPU-pooled Points (no allocation per frame)
   * ===================================================================== */
  VC.ParticleField = function (count, opts) {
    opts = opts || {};
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.head = 0;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('acolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: VC.softDisc() } },
      transparent: true, depthWrite: false, fog: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: [
        'attribute vec3 acolor; attribute float alpha; attribute float psize;',
        'varying vec3 vCol; varying float vA;',
        'void main(){',
        '  vCol = acolor; vA = alpha;',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  gl_PointSize = psize * (420.0 / max(-mv.z, 4.0));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap; varying vec3 vCol; varying float vA;',
        'void main(){',
        '  vec4 t = texture2D(uMap, gl_PointCoord);',
        '  gl_FragColor = vec4(vCol, t.a * vA);',
        '  if (gl_FragColor.a < 0.01) discard;',
        '}'
      ].join('\n')
    });
    this.mat = mat;
    this.geo = geo;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = opts.name || 'particles';
    this.posAttr = geo.getAttribute('position');
    this.colAttr = geo.getAttribute('acolor');
    this.aAttr = geo.getAttribute('alpha');
    this.sAttr = geo.getAttribute('psize');
    this.enabled = true;
  };
  VC.ParticleField.prototype.spawn = function (x, y, z, vx, vy, vz, life, size, r, g, b) {
    var i = this.head; this.head = (this.head + 1) % this.count;
    var i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.sAttr.array[i] = size;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.aAttr.array[i] = 1;
  };
  VC.ParticleField.prototype.step = function (dt, behaviour) {
    if (!this.enabled) return;
    var pos = this.pos, vel = this.vel, life = this.life, maxLife = this.maxLife;
    for (var i = 0; i < this.count; i++) {
      if (life[i] <= 0) { this.aAttr.array[i] = 0; continue; }
      life[i] -= dt;
      var i3 = i * 3;
      if (behaviour) behaviour(i, i3, dt, life[i] / maxLife[i]);
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      var k = life[i] / maxLife[i];
      this.aAttr.array[i] = k > 0.75 ? (1 - k) * 4 : Math.min(1, k / 0.35);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.aAttr.needsUpdate = true;
    this.sAttr.needsUpdate = true;
  };
  VC.ParticleField.prototype.setFade = function (f) { this.points.visible = f > 0.01; };

  /* =====================================================================
   * CLOUDS — instanced voxel puffs
   * ===================================================================== */
  VC.cloudMaterial = function (color, opacity) {
    var m = VC.mcOpaque(color || 0xffffff, { transparent: true, opacity: opacity === undefined ? 0.94 : opacity });
    m.userData.timeSlot = 'cloud';
    if (!VC._cloudMats) VC._cloudMats = [];
    VC._cloudMats.push(m);
    return m;
  };
  VC.cloudPuffMesh = function (count, mat) {
    var im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, count);
    im.name = 'cloudPuffs';
    return im;
  };
  VC.fillCloudPuffs = function (im, centers, rng, opts) {
    opts = opts || {};
    var d = new THREE.Object3D(), idx = 0;
    var puffsPer = opts.puffsPer || 14;
    for (var c = 0; c < centers.length; c++) {
      var cc = centers[c];
      var n = VC.pop(puffsPer);
      for (var p = 0; p < n && idx < im.count; p++) {
        d.position.set(
          cc.x + rng.range(-cc.r, cc.r) * 0.8,
          cc.y + rng.range(-cc.r, cc.r) * 0.16,
          cc.z + rng.range(-cc.r, cc.r) * 0.8);
        var s = rng.range(0.55, 1.4) * cc.r * (opts.scale || 1);
        d.scale.set(s * rng.range(1.1, 1.9), s * rng.range(0.3, 0.55), s * rng.range(1.1, 1.9));
        d.rotation.set(0, rng.range(0, Math.PI), 0);
        d.updateMatrix();
        im.setMatrixAt(idx++, d.matrix);
      }
    }
    im.count = idx;
    im.instanceMatrix.needsUpdate = true;
    return im;
  };

  /* ---------------- light shaft (god ray cone) ---------------- */
  VC.makeLightShaft = function (rTop, rBottom, height, color, opacity) {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 64;
    var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
    var tex = new THREE.CanvasTexture(c);
    var geo = new THREE.CylinderGeometry(rTop, rBottom, height, 10, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      color: color, alphaMap: tex, transparent: true, opacity: opacity === undefined ? 0.22 : opacity,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5;
    return mesh;
  };

  /* ---------------- glow billboard ---------------- */
  VC.glowSprite = function (color, size, opacity) {
    var mat = new THREE.SpriteMaterial({
      map: VC.softDisc(), color: color, transparent: true,
      opacity: opacity === undefined ? 0.85 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var s = new THREE.Sprite(mat);
    s.scale.setScalar(size);
    return s;
  };
}());
