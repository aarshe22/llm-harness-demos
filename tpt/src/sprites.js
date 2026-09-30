import * as THREE from 'three';

export const PIXEL = 0.06;

const OUT = '#0d0a12';

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + 255 * amt, g + 255 * amt, b + 255 * amt);
}

function Buf(w, h) {
  this.w = w;
  this.h = h;
  this.d = new Array(w * h).fill(null);
}
Buf.prototype.set = function (x, y, c) {
  if (x >= 0 && y >= 0 && x < this.w && y < this.h && c) this.d[y * this.w + x] = c;
};
Buf.prototype.get = function (x, y) {
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
  return this.d[y * this.w + x];
};
Buf.prototype.rect = function (x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
};

const SPECS = {
  terry: {
    skin: '#e8b07f', hair: '#2b1b12', style: 'flam',
    suit: '#f5f2e8', chest: '#e8b07f', chain: '#ffd23f',
    pants: '#f5f2e8', boots: '#55402a', mouth: '#b06a6a'
  },
  gus: {
    skin: '#c98a5f', hair: '#2b1b12', style: 'afro',
    suit: '#3ec46d', chest: '#26222e', eyewear: 'shades',
    pants: '#c9b98a', boots: '#3a2417'
  },
  marge: {
    skin: '#e8b07f', hair: '#c23b3b', style: 'bob',
    suit: '#f5f2e8', chest: '#e8b07f', apron: '#26222e',
    pants: '#26222e', boots: '#8a8f9c', mouth: '#d96a8f'
  },
  dj: {
    skin: '#8a5a3a', hair: '#14100f', style: 'bald', headphones: true,
    suit: '#e07a2f', chest: '#241a33',
    pants: '#233a6b', boots: '#14100f'
  },
  bruno: {
    skin: '#d99a5f', hair: '#1b1b22', style: 'bald', build: 'wide',
    suit: '#1b1b22', chest: '#26222e', tie: '#f5f2e8', eyewear: 'shades',
    pants: '#1b1b22', boots: '#0d0a12'
  },
  kate: {
    skin: '#e8b07f', hair: '#c81f6c', style: 'updo',
    suit: '#8b3fd6', chest: '#8b3fd6', pants: '#8b3fd6',
    boots: '#14100f', mouth: '#d96a8f'
  },
  sterling: {
    skin: '#c98a5f', hair: '#2b1b12', style: 'bald', hat: 'captain',
    suit: '#f5f2e8', chest: '#1b2a4a',
    pants: '#26222e', boots: '#0d0a12'
  },
  droid: {
    metal: '#9aa0b4', style: 'dome', eye: '#ff3b3b',
    suit: '#9aa0b4', chest: '#26222e', pants: '#6b7188', boots: '#22222e'
  }
};
SPECS.pepper = { ...SPECS.marge, hair: '#1b1b22', style: 'updo', suit: '#8a1030', apron: null, pants: '#1b1b22', mouth: '#c81f6c' };
SPECS.cassino = { ...SPECS.bruno, suit: '#f5f2e8', pants: '#f5f2e8', chest: '#f5f2e8', tie: '#c81f6c', eyewear: null };
SPECS.steward = { ...SPECS.gus, suit: '#d8dae8', chest: '#1b2a4a', eyewear: null, pants: '#3a2417' };
SPECS.zenqueen = { ...SPECS.kate, hair: '#141014', suit: '#2fa08f', pants: '#2fa08f' };

function drawCharacter(o) {
  const b = new Buf(24, 32);
  const metal = o.metal;
  const skin = metal || o.skin;
  const skinD = shade(skin, -0.12);
  const skinL = shade(skin, 0.08);
  const hair = metal ? shade(metal, -0.08) : o.hair;
  const hairD = shade(hair || '#000000', -0.12);
  const hairL = shade(hair || '#000000', 0.14);
  const suit = o.suit || skin;
  const suitD = shade(suit, -0.12);
  const pants = o.pants || suit;
  const pantsD = shade(pants, -0.12);
  const boots = o.boots || '#1a1a22';
  const wide = o.build === 'wide' ? 1 : 0;
  const bx0 = 5 - wide;
  const bx1 = 18 + wide;
  const hx0 = 5 - wide;
  const hx1 = 18 + wide;

  // legs + boots
  b.rect(8, 22, 10, 28, pants);
  b.rect(13, 22, 15, 28, pants);
  b.rect(10, 23, 10, 28, pantsD);
  b.rect(15, 23, 15, 28, pantsD);
  b.rect(7, 29, 10, 31, boots);
  b.rect(13, 29, 16, 31, boots);
  b.rect(7, 31, 16, 31, shade(boots, -0.1));

  // torso + arms
  b.rect(bx0, 13, bx1, 21, suit);
  b.rect(bx1 - 1, 13, bx1, 21, suitD);
  b.rect(bx0, 13, bx0 + 2, 21, suit);
  b.rect(bx0 + 2, 16, bx0 + 2, 21, suitD);
  b.rect(bx1 - 2, 13, bx1 - 2, 21, suitD);
  b.rect(hx0, 22, hx0 + 2, 23, skin);
  b.rect(hx1 - 2, 22, hx1, 23, skin);

  // belt + chest
  b.rect(8, 21, 15, 21, shade(suit, -0.28));
  b.rect(11, 21, 12, 21, o.chain || shade(suit, -0.28));
  b.rect(10, 13, 13, 15, o.chest);
  b.rect(11, 16, 12, 17, o.chest);
  if (o.apron) b.rect(9, 15, 14, 20, o.apron);
  if (o.tie) b.rect(11, 14, 12, 18, o.tie);
  if (o.chain) {
    b.rect(9, 13, 10, 13, o.chain);
    b.rect(13, 13, 14, 13, o.chain);
    b.rect(11, 14, 12, 15, o.chain);
  }

  // neck + head
  b.rect(10, 11, 13, 12, skin);
  b.rect(10, 12, 13, 12, skinD);
  b.rect(8, 3, 15, 11, skin);
  b.rect(14, 3, 15, 11, skinD);
  b.rect(8, 11, 15, 11, skinD);
  b.set(7, 7, skin);
  b.set(16, 7, skin);
  b.rect(9, 3, 13, 3, skinL);

  // eyes / brows / mouth
  if (o.eyewear === 'shades') {
    b.rect(8, 6, 15, 7, '#14100f');
    b.set(9, 6, '#4a4f5e');
    b.set(14, 6, '#4a4f5e');
  } else if (metal) {
    b.rect(9, 6, 10, 7, o.eye || '#ff3b3b');
    b.rect(13, 6, 14, 7, o.eye || '#ff3b3b');
    b.rect(10, 9, 13, 9, '#26222e');
    b.rect(10, 14, 13, 17, '#26222e');
    b.rect(11, 15, 12, 16, '#3ec46d');
  } else {
    b.rect(9, 6, 10, 7, '#f5f2e8');
    b.rect(13, 6, 14, 7, '#f5f2e8');
    b.set(10, 7, o.eye || '#14100f');
    b.set(13, 7, o.eye || '#14100f');
    b.rect(9, 5, 10, 5, hairD);
    b.rect(13, 5, 14, 5, hairD);
    b.rect(10, 9, 13, 9, o.mouth || shade(skin, -0.35));
  }

  // hair
  if (hair) {
    if (o.style === 'flam') {
      b.rect(6, 1, 17, 1, hair);
      b.rect(5, 2, 18, 3, hair);
      b.rect(6, 4, 6, 8, hair);
      b.rect(17, 4, 17, 8, hair);
      b.rect(7, 5, 7, 7, hairD);
      b.rect(16, 5, 16, 7, hairD);
      b.rect(9, 2, 14, 2, hairL);
    } else if (o.style === 'afro') {
      b.rect(8, 0, 15, 0, hair);
      b.rect(6, 1, 17, 1, hair);
      b.rect(5, 2, 18, 3, hair);
      b.rect(4, 3, 7, 5, hair);
      b.rect(16, 3, 19, 5, hair);
      b.rect(9, 1, 14, 1, hairL);
    } else if (o.style === 'bob') {
      b.rect(7, 1, 16, 1, hair);
      b.rect(6, 2, 17, 4, hair);
      b.rect(6, 5, 7, 13, hair);
      b.rect(16, 5, 17, 13, hair);
      b.rect(9, 2, 14, 2, hairL);
    } else if (o.style === 'updo') {
      b.rect(9, 0, 14, 1, hair);
      b.rect(7, 2, 16, 4, hair);
      b.rect(6, 4, 6, 11, hair);
      b.rect(17, 4, 17, 11, hair);
      b.rect(9, 1, 13, 1, hairL);
    } else if (o.style === 'dome') {
      b.rect(8, 1, 15, 2, shade(metal, -0.05));
      b.rect(11, 0, 12, 0, o.eye || '#ff3b3b');
      b.rect(9, 3, 14, 3, shade(metal, 0.1));
    } else if (o.style === 'bald' && !metal) {
      b.rect(9, 3, 14, 3, shade(o.skin, 0.14));
    }
  }

  // hat / headphones accessories
  if (o.hat === 'captain') {
    b.rect(9, 0, 14, 0, '#f5f2e8');
    b.rect(8, 1, 15, 2, '#f5f2e8');
    b.rect(8, 3, 15, 3, '#14100f');
    b.rect(11, 3, 12, 3, '#ffd23f');
    b.rect(7, 4, 16, 4, '#14100f');
  }
  if (o.headphones) {
    b.rect(8, 1, 15, 1, '#8a8f9c');
    b.rect(6, 5, 7, 8, '#222230');
    b.rect(16, 5, 17, 8, '#222230');
    b.set(6, 6, '#1ec9ff');
    b.set(17, 6, '#1ec9ff');
  }

  return b;
}

function bufToCanvas(b, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = b.w * scale;
  canvas.height = b.h * scale;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (c) ctx.fillStyle = c;
      else if (b.get(x + 1, y) || b.get(x - 1, y) || b.get(x, y + 1) || b.get(x, y - 1)) ctx.fillStyle = OUT;
      else continue;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCharacter(id) {
  const spec = SPECS[id] || SPECS.terry;
  const b = drawCharacter(spec);
  const canvas = bufToCanvas(b, 2);
  const w = b.w * PIXEL;
  const h = b.h * PIXEL;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.height = h;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(w * 0.38, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  mesh.add(shadow);
  return mesh;
}

export function makeSpriteFor(key) {
  return makeCharacter(key);
}

/* ---------------- items ---------------- */

function drawItem(id) {
  const b = new Buf(16, 16);
  const s = shade;
  if (id === 'comb') {
    b.rect(2, 4, 13, 6, '#6e4526');
    b.rect(2, 4, 13, 4, s('#6e4526', 0.1));
    for (let x = 3; x < 14; x += 2) b.rect(x, 7, x, 12, s('#6e4526', -0.08));
  } else if (id === 'drink') {
    b.rect(3, 3, 12, 4, '#1ec9ff');
    b.rect(4, 5, 11, 5, '#1ec9ff');
    b.rect(5, 6, 10, 7, '#2a8fd6');
    b.rect(6, 8, 9, 8, '#1e6ea8');
    b.rect(7, 9, 8, 12, '#8a8f9c');
    b.rect(5, 13, 10, 13, '#8a8f9c');
    b.rect(4, 2, 5, 3, '#3ec46d');
    b.rect(10, 1, 11, 3, '#c81f6c');
  } else if (id === 'chip') {
    b.rect(4, 3, 11, 4, '#ffd23f');
    b.rect(3, 5, 12, 10, '#ffd23f');
    b.rect(4, 11, 11, 12, '#ffd23f');
    b.rect(4, 4, 10, 5, s('#ffd23f', 0.14));
    b.rect(6, 7, 9, 8, '#b8892a');
    b.rect(7, 7, 8, 7, '#fff2b0');
  } else if (id === 'hat') {
    b.rect(6, 2, 9, 2, '#f5f2e8');
    b.rect(5, 3, 10, 4, '#f5f2e8');
    b.rect(4, 5, 11, 6, '#14100f');
    b.rect(6, 5, 9, 5, '#ffd23f');
    b.rect(3, 7, 12, 8, '#14100f');
    b.rect(5, 3, 9, 3, s('#f5f2e8', 0.1));
  } else if (id === 'skewer') {
    b.rect(7, 0, 8, 15, '#8a8f9c');
    b.rect(6, 3, 9, 6, '#3ec46d');
    b.rect(5, 7, 10, 10, '#c23b3b');
    b.rect(6, 11, 9, 13, '#ffd23f');
    b.rect(7, 3, 8, 4, s('#3ec46d', 0.12));
  } else if (id === 'mud') {
    b.rect(4, 4, 11, 5, '#6e4a2e');
    b.rect(3, 6, 12, 11, '#8a5a3a');
    b.rect(4, 12, 11, 13, s('#8a5a3a', -0.1));
    b.rect(4, 6, 10, 7, '#a8734a');
    b.rect(5, 8, 7, 9, s('#a8734a', 0.08));
  } else if (id === 'pom') {
    b.rect(3, 2, 5, 4, '#d8dae8');
    b.rect(10, 2, 12, 4, '#d8dae8');
    b.rect(6, 1, 9, 4, '#f5f2e8');
    b.rect(4, 5, 11, 8, '#d8dae8');
    b.rect(7, 9, 8, 13, '#3a2417');
    b.rect(5, 3, 10, 6, '#f5f2e8');
  }
  return b;
}

export function itemIconDataURL(id) {
  return bufToCanvas(drawItem(id), 3).toDataURL();
}

export const ITEM_LABELS = {
  comb: 'AFRO COMB',
  drink: 'BLUE SUEDE',
  chip: 'LUCKY CHIP',
  hat: "CAPTAIN'S HAT",
  skewer: 'BUFFET SKEWER',
  mud: 'MUD TUB',
  pom: 'ZERO-G POM-POM'
};

/* ---------------- environment textures ---------------- */

export function makeCheckerTexture(c1, c2, cells = 8) {
  const size = cells * 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const step = size / cells;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let ty = 0; ty < cells; ty++) {
    for (let tx = 0; tx < cells; tx++) {
      const base = (tx + ty) % 2 === 0 ? c1 : c2;
      const x = tx * step;
      const y = ty * step;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, step, step);
      ctx.fillStyle = shade(base, 0.06);
      ctx.fillRect(x, y, step, 1);
      ctx.fillRect(x, y, 1, step);
      ctx.fillStyle = shade(base, -0.08);
      ctx.fillRect(x, y + step - 1, step, 1);
      ctx.fillRect(x + step - 1, y, 1, step);
      if (rnd() > 0.65) {
        ctx.fillStyle = shade(base, rnd() > 0.5 ? 0.04 : -0.05);
        ctx.fillRect(x + 2 + Math.floor(rnd() * (step - 4)), y + 2 + Math.floor(rnd() * (step - 4)), 2, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeTextTexture(text, color, glow, width = 512, height = 128, fontPx = 52) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.font = `bold ${fontPx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(text, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeStarsTexture(base) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 60; i++) {
    const b = rnd() > 0.85;
    ctx.fillStyle = b ? '#ffffff' : '#8a8fd8';
    ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeMirrorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 48, 72);
  grad.addColorStop(0, '#dfe8f8');
  grad.addColorStop(0.5, '#8f9dc0');
  grad.addColorStop(1, '#4c5473');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 48, 72);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) ctx.fillRect(8 + i * 5, 62 - i * 12, 3, 14);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
