import * as THREE from "../vendor/three.module.js";

/** Cheap 2-pass additive bloom. Disabled automatically if a target cannot be allocated. */
export function createBloom(renderer) {
  let enabled = true;
  let w = 1;
  let h = 1;
  const pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
  let bright;
  let blur;
  try {
    bright = new THREE.WebGLRenderTarget(256, 144, pars);
    blur = new THREE.WebGLRenderTarget(256, 144, pars);
  } catch {
    return { enabled: false, resize() {}, render() {} };
  }

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geo = new THREE.PlaneGeometry(2, 2);
  const extract = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, threshold: { value: 0.62 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor = vec4(c.rgb * smoothstep(threshold, threshold + 0.25, l), 1.0);
      }`,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec2 px = dir / vec2(256.0, 144.0);
        vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
        c += texture2D(tDiffuse, vUv + px).rgb * 0.316;
        c += texture2D(tDiffuse, vUv - px).rgb * 0.316;
        c += texture2D(tDiffuse, vUv + px * 2.0).rgb * 0.070;
        c += texture2D(tDiffuse, vUv - px * 2.0).rgb * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const compose = new THREE.ShaderMaterial({
    uniforms: { sceneMap: { value: null }, bloomMap: { value: null }, strength: { value: 0.85 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      uniform sampler2D bloomMap; uniform float strength; varying vec2 vUv;
      void main(){
        gl_FragColor = vec4(texture2D(bloomMap, vUv).rgb * strength, 1.0);
      }`,
  });
  const sceneRt = new THREE.WebGLRenderTarget(2, 2, pars);
  const q1 = new THREE.Mesh(geo, extract);
  const q2 = new THREE.Mesh(geo, blurMat);
  const q3 = new THREE.Mesh(geo, compose);
  const qs = new THREE.Scene();

  function resize(width, height) {
    w = Math.max(2, width);
    h = Math.max(2, height);
    sceneRt.setSize(w, h);
  }

  function render(scene, camera, reduced) {
    if (!enabled || !renderer) return false;
    const strength = reduced ? 0.35 : 0.9;
    compose.uniforms.strength.value = strength;
    renderer.setRenderTarget(sceneRt);
    renderer.render(scene, camera);
    extract.uniforms.tDiffuse.value = sceneRt.texture;
    qs.children = [q1];
    renderer.setRenderTarget(bright);
    renderer.render(qs, quadCam);
    blurMat.uniforms.tDiffuse.value = bright.texture;
    blurMat.uniforms.dir.value.set(1, 0);
    qs.children = [q2];
    renderer.setRenderTarget(blur);
    renderer.render(qs, quadCam);
    blurMat.uniforms.tDiffuse.value = blur.texture;
    blurMat.uniforms.dir.value.set(0, 1);
    qs.children = [q2];
    renderer.setRenderTarget(bright);
    renderer.render(qs, quadCam);
    compose.uniforms.bloomMap.value = bright.texture;
    qs.children = [q3];
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.render(qs, quadCam);
    renderer.autoClear = true;
    return true;
  }

  return { enabled: true, resize, render };
}
