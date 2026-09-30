import * as THREE from 'three';
import { makeCharacter, makeCheckerTexture, makeTextTexture, makeMirrorTexture, makeSpriteFor, makeStarsTexture } from './sprites.js';

function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function plane(parent, w, h, color, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

function neon(parent, text, color, glow, x, y, z, w = 4.5, h = 1.1, rotY = 0) {
  const tex = makeTextTexture(text, color, glow);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

function floorMesh(parent, w, d, c1, c2, repeat) {
  const tex = makeCheckerTexture(c1, c2);
  tex.repeat.set(repeat, repeat / 2);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  m.rotation.x = -Math.PI / 2;
  m.userData.floor = true;
  parent.add(m);
  return m;
}

function character(parent, id, x, z, rotY = 0) {
  const spr = makeCharacter(id);
  spr.position.set(x, 0, z);
  spr.rotation.y = rotY;
  parent.add(spr);
  return spr;
}

export const CLUB_BOUNDS = { minX: -7.6, maxX: 7.6, minZ: -2.4, maxZ: 4.8 };
export const VIP_BOUNDS = { minX: -3.9, maxX: 3.9, minZ: -2.8, maxZ: 3.2 };

export const CLUB_COLLIDERS = [
  { minX: -8.6, maxX: -4.3, minZ: -3.3, maxZ: -1.7 },
  { minX: -3.4, maxX: 3.4, minZ: -5.2, maxZ: -2.6 },
  { minX: -8.6, maxX: -6.7, minZ: 1.2, maxZ: 4.0 },
  { minX: -3.6, maxX: -2.2, minZ: 3.6, maxZ: 4.7 },
  { minX: 5.4, maxX: 8.2, minZ: -3.1, maxZ: -2.3 }
];

export const VIP_COLLIDERS = [
  { minX: 2.2, maxX: 3.9, minZ: 1.0, maxZ: 2.6 }
];

export function buildClub() {
  const g = new THREE.Group();
  const sprites = {};

  floorMesh(g, 17, 9, '#241a33', '#3a1f4a', 8).position.set(0, 0, 1.2);
  const floor = g.children[g.children.length - 1];
  floor.userData.floor = true;

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x17102a });
  const backL =   box(g, 11.8, 6, 0.4, 0x17102a, -2.5, 3, -3.2);
  backL.userData.wall = true;
  box(g, 2.0, 6, 0.4, 0x17102a, 4.35, 3, -3.2);
  box(g, 2.6, 6, 0.4, 0x17102a, 6.6, 3, -3.2);
  box(g, 0.6, 6, 3.6, 0x17102a, 8.3, 3, -1.5);
  plane(g, 17, 6, 0x1a1230, 0, 3, 5.7).rotation.y = Math.PI;
  plane(g, 9, 6, 0x150f26, -8.4, 3, 1.2, Math.PI / 2);

  box(g, 4, 1.05, 1.1, 0x6e2f3f, -6.4, 0.52, -2.4);
  box(g, 4.2, 0.12, 1.3, 0xd8c9a8, -6.4, 1.1, -2.4);
  box(g, 3.6, 2.2, 0.3, 0x3a2417, -6.4, 1.4, -3.0);
  const bottleColors = [0x3ec46d, 0xffd23f, 0xc81f6c, 0x1ec9ff, 0xe07a2f, 0x8b3fd6];
  for (let i = 0; i < 6; i++) {
    box(g, 0.18, 0.55, 0.18, bottleColors[i], -7.7 + i * 0.5, 2.15, -3.0);
    box(g, 0.06, 0.2, 0.06, bottleColors[i], -7.7 + i * 0.5, 2.52, -3.0);
  }
  box(g, 3.7, 0.08, 0.5, 0x2a1a12, -6.4, 1.8, -2.98);
  for (let i = 0; i < 3; i++) {
    const sx = -7.4 + i * 1.0;
    box(g, 0.5, 0.65, 0.5, 0x8a5a2b, sx, 0.32, -1.1);
    box(g, 0.55, 0.09, 0.55, 0xc81f6c, sx, 0.68, -1.1);
  }
  sprites.marge = character(g, 'marge', -6.5, -2.85);
  neon(g, 'THE SWEET LIFE', '#ff4fd8', '#ff4fd8', -2.5, 4.2, -3.0, 6.5, 1.4);
  neon(g, 'BAR', '#ffd23f', '#ffd23f', -6.4, 4.0, -2.95, 1.6, 0.55);

  box(g, 2.2, 0.9, 0.9, 0x2b4a3a, -7.6, 0.45, 2.6);
  box(g, 2.4, 1.5, 0.35, 0x2b4a3a, -7.6, 0.9, 3.2);
  box(g, 0.9, 0.5, 0.7, 0x3a2417, -6.6, 0.25, 1.4);
  sprites.gus = character(g, 'gus', -6.2, 2.3, -0.5);

  const mirror = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 2.1),
    new THREE.MeshBasicMaterial({ map: makeMirrorTexture() })
  );
  mirror.position.set(-8.15, 1.7, 0.2);
  mirror.rotation.y = Math.PI / 2;
  g.add(mirror);
  box(g, 0.12, 2.35, 1.65, 0xc9a13b, -8.22, 1.7, 0.2);

  box(g, 1.2, 0.7, 0.9, 0x6e5a3a, -2.9, 0.35, 4.1);
  box(g, 1.0, 0.25, 0.7, 0x8a7048, -2.7, 0.82, 4.15);
  box(g, 0.7, 0.35, 0.5, 0x55402a, -3.15, 0.85, 4.0);

  box(g, 6.8, 0.5, 2.6, 0x3d2a55, 0, 0.25, -3.9);
  box(g, 7.2, 0.55, 2.9, 0x241a33, 0, 0.27, -3.9);
  for (const sx of [-1.3, 1.3]) {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12),
      new THREE.MeshLambertMaterial({ color: 0x111116 })
    );
    deck.position.set(sx, 1.0, -3.9);
    g.add(deck);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    label.position.set(sx, 1.01, -3.9);
    g.add(label);
    box(g, 0.2, 0.4, 0.2, 0x8a8f9c, sx, 0.8, -3.9);
  }
  box(g, 0.8, 0.35, 0.5, 0x222230, 0, 0.92, -3.9);
  box(g, 0.8, 0.1, 0.5, 0x1ec9ff, 0, 1.13, -3.9);
  for (const sx of [-3.7, 3.7]) {
    box(g, 0.8, 2.2, 0.8, 0x111116, sx, 1.1, -3.7);
    box(g, 0.6, 0.6, 0.1, 0x3a2417, sx, 1.6, -3.28);
    box(g, 0.6, 0.6, 0.1, 0x3a2417, sx, 0.9, -3.28);
  }
  sprites.dj = character(g, 'dj', 0.15, -3.6, 0);

  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 0),
    new THREE.MeshBasicMaterial({ color: 0xf5f2e8, flatShading: true })
  );
  ball.position.set(0, 4.3, 0);
  ball.userData.ball = true;
  g.add(ball);
  box(g, 0.08, 1.4, 0.08, 0x555566, 0, 5.2, 0);

  const danceFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.2),
    new THREE.MeshLambertMaterial({ color: 0x152a4a })
  );
  danceFloor.rotation.x = -Math.PI / 2;
  danceFloor.position.set(0, 0.015, 0.4);
  g.add(danceFloor);
  for (let i = 0; i < 5; i++) {
    const sq = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1ec9ff : 0xff4fd8, transparent: true, opacity: 0.25 })
    );
    sq.rotation.x = -Math.PI / 2;
    sq.rotation.z = Math.PI / 4;
    sq.position.set(-1.6 + i * 0.8, 0.02, 0.4 + (i % 2 ? 0.5 : -0.5));
    sq.userData.lightTile = i;
    g.add(sq);
  }

  for (const px of [5.7, 8.0]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.95, 8),
      new THREE.MeshLambertMaterial({ color: 0xc9a13b })
    );
    post.position.set(px, 0.47, -2.7);
    g.add(post);
  }
  box(g, 2.3, 0.1, 0.1, 0xc81f6c, 6.85, 0.78, -2.7);
  box(g, 0.2, 3.6, 0.3, 0xc9a13b, 5.4, 1.8, -3.15);
  box(g, 0.2, 3.6, 0.3, 0xc9a13b, 8.05, 1.8, -3.15);
  box(g, 2.9, 0.3, 0.35, 0xc9a13b, 6.7, 3.75, -3.15);
  neon(g, 'VIP', '#ffd23f', '#ffd23f', 6.7, 3.3, -3.0, 1.4, 0.5);
  sprites.bruno = character(g, 'bruno', 6.7, -2.05, Math.PI * 0.02);

  g.add(new THREE.AmbientLight(0xbfa8e0, 2.6));
  const p1 = new THREE.PointLight(0xff4fd8, 90, 16); p1.position.set(0, 4, 0); g.add(p1);
  const p2 = new THREE.PointLight(0x1ec9ff, 65, 14); p2.position.set(-5.5, 3.4, -1.5); g.add(p2);
  const p3 = new THREE.PointLight(0xffd23f, 50, 14); p3.position.set(6, 3.2, 1.5); g.add(p3);
  const p4 = new THREE.PointLight(0x8b3fd6, 45, 12); p4.position.set(3, 3, -3); g.add(p4);

  const hotspots = [
    { id: 'marge', label: 'Marge the Bartender', pos: { x: -6.5, z: -2.85 }, stand: { x: -6.0, z: -1.2 } },
    { id: 'gus', label: 'Glamour Gus', pos: { x: -6.2, z: 2.3 }, stand: { x: -5.1, z: 2.3 } },
    { id: 'box', label: 'Lost & Found Box', pos: { x: -2.9, z: 4.1 }, stand: { x: -2.9, z: 3.1 } },
    { id: 'mirror', label: 'Fancy Mirror', pos: { x: -8.15, z: 0.2 }, stand: { x: -6.7, z: 0.2 } },
    { id: 'dj', label: 'DJ Velvet Fingers', pos: { x: 0.15, z: -3.6 }, stand: { x: 0.15, z: -2.3 } },
    { id: 'bruno', label: 'Bruno the Bouncer', pos: { x: 6.7, z: -2.05 }, stand: { x: 6.7, z: -0.9 } },
    { id: 'gate', label: 'VIP Door', pos: { x: 6.7, z: -2.9 }, stand: { x: 6.7, z: -1.5 } },
    { id: 'sign', label: 'The Neon', pos: { x: -2.5, z: -3.1 }, stand: { x: -2.5, z: -1.6 } }
  ];

  return { group: g, floor, sprites, hotspots, bounds: CLUB_BOUNDS, colliders: CLUB_COLLIDERS, lights: { p1, p2, ball } };
}

export function buildVIP() {
  const g = new THREE.Group();
  const sprites = {};

  floorMesh(g, 9, 7, '#1c1030', '#40145e', 4).position.set(0, 0, 0);
  const floor = g.children[g.children.length - 1];
  floor.userData.floor = true;
  box(g, 9.6, 6, 0.4, 0x1a0f2e, 0, 3, -3.4);
  box(g, 9.6, 6, 0.4, 0x1a0f2e, 0, 3, 3.7).rotation.y = Math.PI;
  box(g, 0.4, 6, 7.4, 0x22123a, -4.8, 3, 0);
  box(g, 0.4, 6, 7.4, 0x22123a, 4.8, 3, 0);

  const dance = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.6),
    new THREE.MeshLambertMaterial({ color: 0x2a1250 })
  );
  dance.rotation.x = -Math.PI / 2;
  dance.position.set(0, 0.015, -0.3);
  g.add(dance);
  for (let i = 0; i < 9; i++) {
    const sq = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: [0xff4fd8, 0x1ec9ff, 0xffd23f][i % 3], transparent: true, opacity: 0.3 })
    );
    sq.rotation.x = -Math.PI / 2;
    sq.rotation.z = Math.PI / 4;
    sq.position.set(-1.6 + (i % 3) * 1.6, 0.02, -1.4 + Math.floor(i / 3) * 1.1);
    sq.userData.lightTile = i;
    g.add(sq);
  }

  box(g, 1.4, 0.75, 1.4, 0x2a1a3d, 3.0, 0.38, 1.8);
  box(g, 1.6, 0.08, 1.6, 0xd8c9a8, 3.0, 0.78, 1.8);
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a6e3f })
  );
  bottle.position.set(3.0, 1.12, 1.8);
  g.add(bottle);
  for (const gx of [2.6, 3.4]) {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.04, 0.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8e8ff })
    );
    glass.position.set(gx, 0.92, 1.55);
    g.add(glass);
  }

  const trophy = box(g, 0.5, 0.5, 0.5, 0xffd23f, -3.2, 1.15, 1.9);
  box(g, 1.2, 0.85, 1.2, 0x111116, -3.2, 0.42, 1.9);
  box(g, 0.3, 0.35, 0.3, 0xc9a13b, -3.2, 1.55, 1.9);
  trophy.userData.trophy = true;

  neon(g, 'VIP', '#ffd23f', '#ffd23f', 0, 4.2, -3.2, 2.2, 0.9);
  neon(g, 'BOOGIE ZONE', '#1ec9ff', '#1ec9ff', 0, 3.2, -3.2, 4.0, 0.7);

  const door = box(g, 1.4, 2.8, 0.25, 0x6e2f3f, 3.2, 1.4, 3.45);
  door.userData.door = true;
  box(g, 0.15, 0.15, 0.15, 0xffd23f, 2.7, 1.4, 3.3);

  sprites.kate = character(g, 'kate', 0, -0.6, 0);

  g.add(new THREE.AmbientLight(0xe0a8f0, 2.8));
  const p1 = new THREE.PointLight(0xff4fd8, 80, 14); p1.position.set(0, 4, -0.3); g.add(p1);
  const p2 = new THREE.PointLight(0xffd23f, 45, 12); p2.position.set(3, 3, 2); g.add(p2);
  const p3 = new THREE.PointLight(0x1ec9ff, 38, 12); p3.position.set(-3, 3, 1); g.add(p3);

  const hotspots = [
    { id: 'kate', label: 'Champagne Kate', pos: { x: 0, z: -0.6 }, stand: { x: 0, z: 0.8 } },
    { id: 'trophy', label: 'The Golden Boogie Cup', pos: { x: -3.2, z: 1.9 }, stand: { x: -2.2, z: 1.9 } },
    { id: 'champagne', label: 'Champagne Table', pos: { x: 3.0, z: 1.8 }, stand: { x: 1.8, z: 1.8 } },
    { id: 'exit', label: 'Back to the Club', pos: { x: 3.2, z: 3.4 }, stand: { x: 3.2, z: 2.95 } }
  ];

  return { group: g, floor, sprites, hotspots, bounds: VIP_BOUNDS, colliders: VIP_COLLIDERS };
}

export function buildCasino() {
  const g = new THREE.Group();
  const sprites = {};
  floorMesh(g, 15, 10, '#3a1020', '#55182a', 8).position.set(0, 0, 0);
  const floor = g.children[g.children.length - 1];
  floor.userData.floor = true;

  box(g, 15.6, 6, 0.4, 0x2a0f1c, 0, 3, -5.1);
  box(g, 15.6, 6, 0.4, 0x2a0f1c, 0, 3, 5.1).rotation.y = Math.PI;
  box(g, 0.4, 6, 10.6, 0x331224, -7.6, 3, 0);
  box(g, 0.4, 6, 10.6, 0x331224, 7.6, 3, 0);

  for (let i = 0; i < 3; i++) {
    const z = -2 + i * 2;
    box(g, 1.1, 1.7, 0.9, 0x3a2a6e, 6.6, 0.85, z);
    box(g, 0.8, 0.5, 0.1, 0xffd23f, 6.6, 1.45, z - 0.46);
    box(g, 0.8, 0.35, 0.1, 0x1ec9ff, 6.6, 0.85, z - 0.46);
    box(g, 0.3, 0.25, 0.1, 0xff4fd8, 6.6, 0.45, z - 0.46);
  }
  neon(g, 'SLOTS', '#ffd23f', '#ffd23f', 7.35, 3.6, 0, 2.6, 0.7, -Math.PI / 2);

  for (const r of [1.35, 0.95, 0.55]) {
    const tier = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.85, 0.28, 14),
      new THREE.MeshLambertMaterial({ color: 0xd8c9a8 })
    );
    tier.position.set(-4, 0.35 + (1.35 - r) * 1.6, -0.5);
    g.add(tier);
  }
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16),
    new THREE.MeshLambertMaterial({ color: 0x1ec9ff })
  );
  water.position.set(-4, 0.22, -0.5);
  g.add(water);

  box(g, 1.0, 1.1, 1.0, 0x8a4a2b, -1.5, 0.55, -3.8);
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c7a3f })
  );
  leaves.position.set(-1.5, 1.8, -3.8);
  g.add(leaves);

  box(g, 6, 0.4, 2.2, 0x241a33, 0, 0.2, -4.0);
  const micStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 1.5, 8),
    new THREE.MeshLambertMaterial({ color: 0x111116 })
  );
  micStand.position.set(1.4, 1.15, -4.0);
  g.add(micStand);
  const mic = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a8f9c })
  );
  mic.position.set(1.4, 1.95, -4.0);
  g.add(mic);

  neon(g, 'THE GILDED FLUSH', '#ffd23f', '#ff4fd8', 0, 4.4, -4.9, 7.5, 1.3);

  sprites.pepper = makeSpriteFor('pepper');
  sprites.pepper.position.set(2.6, 0, -0.8);
  sprites.pepper.rotation.y = -0.35;
  g.add(sprites.pepper);
  sprites.cassino = makeSpriteFor('cassino');
  sprites.cassino.position.set(-0.4, 0.4, -3.6);
  g.add(sprites.cassino);

  g.add(new THREE.AmbientLight(0xe0c0a8, 2.6));
  const p1 = new THREE.PointLight(0xffd23f, 80, 15); p1.position.set(0, 4, 0); g.add(p1);
  const p2 = new THREE.PointLight(0xff4fd8, 60, 14); p2.position.set(-4, 3.4, -1); g.add(p2);
  const p3 = new THREE.PointLight(0x3ec46d, 36, 12); p3.position.set(5, 3, 3); g.add(p3);

  const hotspots = [
    { id: 'pepper', label: 'Pit Boss Pepper', pos: { x: 2.6, z: -0.8 }, stand: { x: 2.6, z: 0.3 } },
    { id: 'slot', label: 'The One-Armed Bandit', pos: { x: 6.6, z: 0 }, stand: { x: 5.4, z: 0 } },
    { id: 'plant', label: 'Suspicious Fern', pos: { x: -1.5, z: -3.8 }, stand: { x: -1.5, z: -2.6 } },
    { id: 'fountain', label: 'Wishing Fountain', pos: { x: -4, z: -0.5 }, stand: { x: -4, z: 1.6 } },
    { id: 'cassino', label: 'Cassino the Lounge Lizard', pos: { x: -0.4, z: -3.6 }, stand: { x: -0.4, z: -2.3 } }
  ];
  const bounds = { minX: -7.1, maxX: 7.1, minZ: -4.6, maxZ: 4.6 };
  const colliders = [
    { minX: 6.0, maxX: 7.4, minZ: -3.2, maxZ: 3.2 },
    { minX: -5.6, maxX: -2.4, minZ: -2.1, maxZ: 1.1 },
    { minX: -2.1, maxX: -0.9, minZ: -4.4, maxZ: -3.2 },
    { minX: -3.1, maxX: 3.1, minZ: -5.1, maxZ: -2.9 }
  ];
  return { group: g, floor, sprites, hotspots, bounds, colliders };
}

export function buildShip() {
  const g = new THREE.Group();
  const sprites = {};
  floorMesh(g, 13, 9, '#4a2e17', '#6e4526', 10).position.set(0, 0, 0);
  const floor = g.children[g.children.length - 1];
  floor.userData.floor = true;

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 14),
    new THREE.MeshBasicMaterial({ map: makeStarsTexture('#06213f') })
  );
  sea.position.set(0, 4, -7);
  g.add(sea);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 16),
    new THREE.MeshBasicMaterial({ color: 0xf5f2e8 })
  );
  moon.position.set(6, 5.4, -6.95);
  g.add(moon);

  box(g, 13.4, 0.12, 0.3, 0xd8c9a8, 0, 1.0, -4.7);
  box(g, 0.3, 0.12, 9.4, 0xd8c9a8, -6.5, 1.0, 0);
  box(g, 0.3, 0.12, 9.4, 0xd8c9a8, 6.5, 1.0, 0);
  for (let i = -6; i <= 6; i += 1.5) {
    box(g, 0.12, 1.0, 0.12, 0xd8c9a8, i, 0.5, -4.7);
  }

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 20),
    new THREE.MeshLambertMaterial({ color: 0x1e9cd6 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(2, 0.02, -1);
  g.add(pool);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.12, 6, 24),
    new THREE.MeshLambertMaterial({ color: 0xd8c9a8 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(2, 0.06, -1);
  g.add(rim);

  box(g, 3.6, 0.9, 1.3, 0x6e4526, 0, 0.45, -3.6);
  box(g, 3.8, 0.1, 1.5, 0xd8c9a8, 0, 0.95, -3.6);
  for (let i = 0; i < 4; i++) {
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10),
      new THREE.MeshLambertMaterial({ color: 0xc9c9d8 })
    );
    tray.position.set(-1.2 + i * 0.85, 1.03, -3.6);
    g.add(tray);
  }
  const hatPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a2417 })
  );
  hatPole.position.set(5.6, 0.9, 2.4);
  g.add(hatPole);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 0.18, 10),
    new THREE.MeshLambertMaterial({ color: 0xf5f2e8 })
  );
  cap.position.set(5.6, 1.85, 2.4);
  g.add(cap);

  neon(g, 'S.S. EXCESS', '#1ec9ff', '#1ec9ff', 0, 3.0, -4.85, 5.5, 1.0);
  neon(g, 'MIDNIGHT LIDO', '#ff4fd8', '#ff4fd8', -5.6, 2.6, -4.85, 4.2, 0.8);

  sprites.steward = makeSpriteFor('steward');
  sprites.steward.position.set(4.6, 0, 0.4);
  sprites.steward.rotation.y = -0.5;
  g.add(sprites.steward);
  sprites.sterling = makeSpriteFor('sterling');
  sprites.sterling.position.set(0, 0, 1.8);
  sprites.sterling.rotation.y = Math.PI;
  g.add(sprites.sterling);

  g.add(new THREE.AmbientLight(0xbfc8e0, 2.6));
  const p1 = new THREE.PointLight(0xffd23f, 52, 14); p1.position.set(0, 4, -3.5); g.add(p1);
  const p2 = new THREE.PointLight(0x1ec9ff, 45, 14); p2.position.set(2, 3, -1); g.add(p2);
  const p3 = new THREE.PointLight(0xff4fd8, 30, 12); p3.position.set(-4, 3, 1); g.add(p3);

  const hotspots = [
    { id: 'steward', label: 'Steward Pip', pos: { x: 4.6, z: 0.4 }, stand: { x: 4.3, z: -1.3 } },
    { id: 'hatrack', label: "Captain's Hat Rack", pos: { x: 5.6, z: 2.4 }, stand: { x: 4.4, z: 2.4 } },
    { id: 'tray', label: 'Midnight Buffet', pos: { x: 0, z: -3.6 }, stand: { x: 0, z: -2.4 } },
    { id: 'sterling', label: 'Officer Sterling', pos: { x: 0, z: 1.8 }, stand: { x: 0, z: 0.6 } },
    { id: 'rail', label: 'Ship Rail', pos: { x: -3.5, z: -4.6 }, stand: { x: -3.5, z: -3.4 } }
  ];
  const bounds = { minX: -6.0, maxX: 6.0, minZ: -4.1, maxZ: 4.1 };
  const colliders = [
    { minX: -1.9, maxX: 1.9, minZ: -4.3, maxZ: -2.9 },
    { minX: 0.2, maxX: 3.8, minZ: -2.8, maxZ: 0.8 }
  ];
  return { group: g, floor, sprites, hotspots, bounds, colliders };
}

export function buildSpa() {
  const g = new THREE.Group();
  const sprites = {};
  floorMesh(g, 11, 8, '#1f4a44', '#2c6258', 7).position.set(0, 0, 0);
  const floor = g.children[g.children.length - 1];
  floor.userData.floor = true;

  box(g, 11.6, 6, 0.4, 0x1a4038, 0, 3, -4.1);
  box(g, 11.6, 6, 0.4, 0x1a4038, 0, 3, 4.1).rotation.y = Math.PI;
  box(g, 0.4, 6, 8.6, 0x214a42, -5.6, 3, 0);
  box(g, 0.4, 6, 8.6, 0x214a42, 5.6, 3, 0);

  const mud = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 18),
    new THREE.MeshLambertMaterial({ color: 0x6e4a2e })
  );
  mud.rotation.x = -Math.PI / 2;
  mud.position.set(-3, 0.05, -1);
  g.add(mud);
  const mudRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.14, 6, 22),
    new THREE.MeshLambertMaterial({ color: 0x8a7048 })
  );
  mudRim.rotation.x = -Math.PI / 2;
  mudRim.position.set(-3, 0.09, -1);
  g.add(mudRim);

  box(g, 2.3, 2.5, 3.0, 0x7a5230, 4.3, 1.25, 0);
  box(g, 0.1, 1.7, 1.0, 0x3a2417, 3.12, 0.9, 0);
  box(g, 2.5, 0.25, 3.2, 0x9a6a40, 4.3, 2.6, 0);

  box(g, 1.8, 0.8, 1.1, 0xd8e8e0, 0, 0.4, 2.6);
  for (let i = 0; i < 5; i++) {
    const slice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8),
      new THREE.MeshLambertMaterial({ color: 0x7ac46d })
    );
    slice.position.set(-0.6 + i * 0.3, 0.83, 2.6);
    g.add(slice);
  }

  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x8b3fd6 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(-0.8, 0.03, -0.6);
  g.add(mat);

  neon(g, 'SPRINGS O SERENITY', '#2fa08f', '#1ec9ff', 0, 4.2, -3.95, 8.5, 1.2);
  neon(g, 'NAMASTE LATER', '#ff4fd8', '#ff4fd8', -3, 2.9, -3.95, 4.2, 0.8);

  sprites.zen = makeSpriteFor('steward');
  sprites.zen.position.set(2.6, 0, 2.2);
  sprites.zen.rotation.y = -0.7;
  g.add(sprites.zen);
  sprites.zenqueen = makeSpriteFor('zenqueen');
  sprites.zenqueen.position.set(-0.8, 0, -1.1);
  g.add(sprites.zenqueen);

  g.add(new THREE.AmbientLight(0xcfe8de, 2.6));
  const p1 = new THREE.PointLight(0x2fa08f, 58, 14); p1.position.set(0, 4, 0); g.add(p1);
  const p2 = new THREE.PointLight(0xffd23f, 10, 10); p2.position.set(4, 3, 0); g.add(p2);
  const p3 = new THREE.PointLight(0xff4fd8, 8, 10); p3.position.set(-3, 3, -1); g.add(p3);

  const hotspots = [
    { id: 'zen', label: 'Attendant Zen', pos: { x: 2.6, z: 2.2 }, stand: { x: 1.6, z: 2.2 } },
    { id: 'mudpool', label: 'Volcanic Mud Pool', pos: { x: -3, z: -1 }, stand: { x: -3, z: 0.8 } },
    { id: 'sauna', label: 'The Sauna', pos: { x: 3.6, z: 0 }, stand: { x: 2.6, z: 0 } },
    { id: 'cukes', label: 'Cucumber Station', pos: { x: 0, z: 2.6 }, stand: { x: 0, z: 1.6 } },
    { id: 'zenqueen', label: 'Zen Queen Mireille', pos: { x: -0.8, z: -1.1 }, stand: { x: -0.8, z: 0.5 } }
  ];
  const bounds = { minX: -5.1, maxX: 5.1, minZ: -3.6, maxZ: 3.6 };
  const colliders = [
    { minX: -4.4, maxX: -1.6, minZ: -2.4, maxZ: 0.4 },
    { minX: 3.1, maxX: 5.5, minZ: -1.6, maxZ: 1.6 },
    { minX: -0.9, maxX: 0.9, minZ: 2.0, maxZ: 3.2 }
  ];
  return { group: g, floor, sprites, hotspots, bounds, colliders };
}

export function buildSpace() {
  const g = new THREE.Group();
  const sprites = {};
  const starFloor = makeStarsTexture('#0b0b2e');
  starFloor.repeat.set(6, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 9),
    new THREE.MeshLambertMaterial({ map: starFloor })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.userData.floor = true;
  g.add(floor);

  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 4.5),
    new THREE.MeshBasicMaterial({ map: makeStarsTexture('#02020f') })
  );
  win.position.set(0, 3, -4.4);
  g.add(win);
  box(g, 13.6, 6, 0.4, 0x14142e, 0, 3, -4.6);
  const viewport = new THREE.Mesh(
    new THREE.PlaneGeometry(12.2, 3.6),
    new THREE.MeshBasicMaterial({ map: win.material.map })
  );
  viewport.position.set(0, 3, -4.38);
  g.add(viewport);
  box(g, 13.6, 6, 0.4, 0x181834, 0, 3, 4.6).rotation.y = Math.PI;
  box(g, 0.4, 6, 9.6, 0x1c1c3a, -6.6, 3, 0);
  box(g, 0.4, 6, 9.6, 0x1c1c3a, 6.6, 3, 0);

  for (let i = -1; i <= 1; i++) {
    box(g, 2.6, 1.2, 1.0, 0x22224a, i * 3, 0.6, -3.6);
    box(g, 2.2, 0.12, 0.7, [0xff4fd8, 0x1ec9ff, 0xffd23f][i + 1], i * 3, 1.25, -3.6);
  }
  box(g, 1.8, 2.3, 1.2, 0x2a2a55, -5.5, 1.15, 0);
  box(g, 0.2, 1.6, 0.9, 0x1ec9ff, -4.62, 1.15, 0);

  neon(g, 'STARSHIP CLASS-C', '#ffd23f', '#1ec9ff', 0, 4.6, -4.3, 8.0, 1.1);
  neon(g, 'DECK OF LEISURE', '#ff4fd8', '#ff4fd8', 0, 3.6, 4.45, 5.5, 0.9, Math.PI);

  sprites.droid = makeSpriteFor('droid');
  sprites.droid.position.set(0, 0, 0.6);
  g.add(sprites.droid);

  g.add(new THREE.AmbientLight(0xbfbfe8, 2.4));
  const p1 = new THREE.PointLight(0x1ec9ff, 58, 15); p1.position.set(0, 4, 0); g.add(p1);
  const p2 = new THREE.PointLight(0xff4fd8, 12, 11); p2.position.set(4, 3, -2); g.add(p2);
  const p3 = new THREE.PointLight(0xffd23f, 8, 10); p3.position.set(-5, 3, 1); g.add(p3);

  const hotspots = [
    { id: 'locker', label: 'Crew Locker 42', pos: { x: -5.5, z: 0 }, stand: { x: -4.2, z: 0 } },
    { id: 'console', label: 'Gravity Console', pos: { x: 0, z: -3.6 }, stand: { x: 0, z: -2.4 } },
    { id: 'viewport', label: 'The View', pos: { x: 4.5, z: -4.3 }, stand: { x: 4.5, z: -2.5 } },
    { id: 'droid', label: 'R-1N, Dance Android', pos: { x: 0, z: 0.6 }, stand: { x: 0, z: 1.9 } }
  ];
  const bounds = { minX: -6.1, maxX: 6.1, minZ: -3.9, maxZ: 4.1 };
  const colliders = [
    { minX: -4.6, maxX: 4.6, minZ: -4.2, maxZ: -3.0 },
    { minX: -6.5, maxX: -4.5, minZ: -0.7, maxZ: 0.7 }
  ];
  return { group: g, floor, sprites, hotspots, bounds, colliders };
}

export const ROOM_BUILDERS = {
  lounge: buildClub,
  vip: buildVIP,
  casino: buildCasino,
  ship: buildShip,
  spa: buildSpa,
  space: buildSpace
};
