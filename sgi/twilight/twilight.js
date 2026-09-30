// Twilight — Howard Look, SGI, 1991. Colour-gradient sky with 2,500 small
// stars and a scattering of large ones, seeded so the stars are stable.
import { createRenderer, hud, makeDrand48, THREE } from '../shared/sgi.js';

const TRANSITION = 0.2, NUM_SMALL = 2500, NUM_BIG = 200;
const orange = [255, 72, 0], blueish = [0, 110, 189], black = [0, 0, 0];

const renderer = createRenderer();
const scene = new THREE.Scene();
let W = innerWidth, H = innerHeight;
const cam = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
cam.position.z = 1;
const resize = () => {
  W = innerWidth; H = innerHeight;
  cam.left = 0; cam.right = W; cam.top = H; cam.bottom = 0;
  cam.updateProjectionMatrix();
  build();
};
window.addEventListener('resize', resize);
hud({
  title: 'Twilight', author: 'Howard Look', year: 1991,
  blurb: 'A root-window sky: an orange-to-blue gradient with 2,500 small stars and a scattering of large ones, seeded with drand48 so they never move.',
  controls: 'esc: back',
});

function starColor(y, maxY) {
  let r, g, b, ratio, a;
  if (y > maxY / 2) return [255, 255, 255];
  if (y < TRANSITION * maxY) {
    ratio = y / (maxY * TRANSITION);
    r = orange[0] * (1 - ratio) + blueish[0] * ratio;
    g = orange[1] * (1 - ratio) + blueish[1] * ratio;
    b = orange[2] * (1 - ratio) + blueish[2] * ratio;
  } else {
    ratio = (y - maxY * TRANSITION) / (maxY - maxY * TRANSITION);
    r = blueish[0] * (1 - ratio); g = blueish[1] * (1 - ratio); b = blueish[2] * (1 - ratio);
  }
  a = y / (maxY / 2);
  r = r * (1 - a) + 255 * a; g = g * (1 - a) + 255 * a; b = b * (1 - a) + 255 * a;
  return [r & 0xff, g & 0xff, b & 0xff];
}

let group = null;
function build() {
  if (group) { scene.remove(group); group.traverse(o => o.geometry?.dispose()); }
  group = new THREE.Group();
  scene.add(group);

  // sky gradient: orange at bottom -> blueish at TRANSITION -> black at top
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
    uniforms: { H: { value: H } },
    vertexShader: `varying float vy; void main(){ vy = position.y + ${H / 2}.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying float vy; uniform float H;
      void main(){
        float T = 0.2;
        vec3 orange=vec3(255.,72.,0.)/255., blueish=vec3(0.,110.,189.)/255.;
        vec3 c;
        float y = vy;
        if (y < T*H) { float r=y/(T*H); c = mix(orange,blueish,r); }
        else { float r=(y-T*H)/(H-T*H); c = blueish*(1.0-r); }
        gl_FragColor = vec4(c,1.0);
      }`,
    depthWrite: false,
  }));
  sky.position.set(W / 2, H / 2, 0);
  group.add(sky);

  const rnd = makeDrand48(0); // seed so stars are always the same

  // small stars
  const sp = [], sc = [];
  for (let i = 0; i < NUM_SMALL; i++) {
    const x = W * rnd(), y = H * rnd();
    sp.push(x, y, 0.1);
    const [r, g, b] = starColor(y, H);
    sc.push(r / 255, g / 255, b / 255);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  group.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, sizeAttenuation: false })));

  // big stars: sboxf cross (two thin boxes), scaled by a random size
  const bg = new THREE.PlaneGeometry(1, 3);
  const bg2 = new THREE.PlaneGeometry(3, 1);
  for (let i = 0; i < NUM_BIG; i++) {
    const x = W * rnd(), y = H * rnd(), size = rnd();
    const [r, g, b] = starColor(y, H);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r / 255, g / 255, b / 255), transparent: true });
    const s = Math.max(1.5, size * 6);
    const a = new THREE.Mesh(bg, mat), c = new THREE.Mesh(bg2, mat);
    a.position.set(x, y, 0.2); c.position.set(x, y, 0.2);
    a.scale.setScalar(s); c.scale.setScalar(s);
    group.add(a, c);
  }
}
build();
window.addEventListener('keydown', e => { if (e.key === 'Escape') location.href = '../'; });
renderer.setAnimationLoop(() => renderer.render(scene, cam));
