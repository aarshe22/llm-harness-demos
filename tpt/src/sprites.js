import * as THREE from 'three';

const PAL = {
  K: '#14100f', H: '#2b1b12', S: '#e8b07f', W: '#f5f2e8',
  L: '#d99a5f', G: '#ffd23f', B: '#3a2417', R: '#c23b3b',
  A: '#26222e', O: '#e07a2f', U: '#8b3fd6', P: '#c9b98a',
  M: '#d96a8f', D: '#1ec9ff', X: '#1b1b22', N: '#8a8f9c',
  Y: '#c81f6c', Z: '#3ec46d', '0': '#0f3b2e'
};

const CHAR_GRIDS = {
  terry: [
    '..HHHHHHHHHH..',
    '.HHHHHHHHHHHH.',
    '.HHHSSSSSSHHH.',
    '..SSSSSSSSSS..',
    '..SKSSSSSSKS..',
    '..SSSSSSSSSS..',
    '..SSSSMMSSSS..',
    '...SSSSSSSS...',
    '...WWWWWWWW...',
    '..WWWWGGWWWW..',
    '.WWWWWLLWWWWW.',
    '..WWWWLLWWWW..',
    '.SWWWWWWWWWWWS',
    '.WWWWWWWWWWWW.',
    '.PPPPPPPPPPPP.',
    '.PPP..PP..PPP.',
    '.PPP..PP..PPP.',
    '.PPP..PP..PPP.',
    '.BBB..BB..BBB.'
  ],
  gus: [
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HHHHHHHHHH..',
    '..HHKKKKKKHH..',
    '..SSSSSSSSSS..',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
    '...ZZZZZZZZ...',
    '..ZZZZZZZZZZ..',
    '.ZZZZZZZZZZZZ.',
    '.ZZZZZZZZZZZZ.',
    '.ZZZZZZZZZZZZ.',
    '..PPPPPPPPPP..',
    '.PPP..PP..PPP.',
    '.PPP..PP..PPP.',
    '.BBB..BB..BBB.'
  ],
  marge: [
    '..RRRRRRRRRR..',
    '.RRRRRRRRRRRR.',
    '.RRRSSSSSSRRR.',
    '..SKSSSSSSKS..',
    '..SSSSSSSSSS..',
    '..SSSSMMSSSS..',
    '...SSSSSSSS...',
    '...WWWWWWWW...',
    '..WWWWWWWWWW..',
    '.WWWWAAAAWWWW.',
    '.WWWWAAAAWWWW.',
    '.WWWWAAAAWWWW.',
    '..AAAAAAAAAA..',
    '..AAAAAAAAAA..',
    '...AAA..AAA...',
    '...NN....NN...'
  ],
  dj: [
    '..NNNNNNNNNN..',
    '.NNNSSSSSSNNN.',
    '..SKSSSSSSKS..',
    '..SSSSSSSSSS..',
    '..SSSSMMSSSS..',
    '...SSSSSSSS...',
    '...OOOOOOOO...',
    '..OOOOOOOOOO..',
    '.OOOOOOOOOOOO.',
    '.OOOOOOOOOOOO.',
    '..DDDDDDDDDD..',
    '.DDD..DD..DDD.',
    '.DDD..DD..DDD.',
    '.BBB..BB..BBB.'
  ],
  bruno: [
    '...SSSSSSSS...',
    '..SSSSSSSSSS..',
    '..SKKKKKKKKS..',
    '..SSSSSSSSSS..',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXXXXWWXXXXX.',
    '.XXXXXWWXXXXX.',
    '.XXXXXXXXXXXX.',
    '.XXXXXXXXXXXX.',
    '..XXXXXXXXXX..',
    '.XXX..XX..XXX.',
    '.XXX..XX..XXX.',
    '.BBB..BB..BBB.'
  ],
  kate: [
    '..YYYYYYYYYY..',
    '.YYYYYYYYYYYY.',
    '.YYYSSSSSSYYY.',
    '..SKSSSSSSKS..',
    '..SSSSSSSSSS..',
    '..SSSSMMSSSS..',
    '...SSSSSSSS...',
    '...UUUUUUUU...',
    '..UUUUUUUUUU..',
    '.UUUUUUUUUUUU.',
    '.UUUUUUUUUUUU.',
    '..UUUUUUUUUU..',
    '.UUU..UU..UUU.',
    '.UUU..UU..UUU.',
    '.BBB..BB..BBB.'
  ],
  sterling: [
    '...WWWWWWWW...',
    '..WWWWWWWWWW..',
    '..WWGGGGGGWW..',
    '..SSKSSSSKSS..',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
    '..WWWWWWWWWW..',
    '.WWWWWWWWWWWW.',
    '.WWWWGGGGWWWW.',
    '.WWWWWWWWWWWW.',
    '..WWWWWWWWWW..',
    '..AAAAAAAAAA..',
    '.AAA..AA..AAA.',
    '.AAA..AA..AAA.',
    '.BBB..BB..BBB.'
  ],
  droid: [
    '...NNNNNNNN...',
    '..NNNNNNNNNN..',
    '..NRRNNNNRRN..',
    '..NNKKKKKKNN..',
    '...NNNNNNNN...',
    '..NNNKKKKNNN..',
    '...NNNNNNNN...',
    '..NNNNNNNNNN..',
    '.NNNNNNNNNNNN.',
    '.NNNN0000NNNN.',
    '.NNNNNNNNNNNN.',
    '..NNNNNNNNNN..',
    '..NNN.NN.NNN..',
    '..NNN.NN.NNN..',
    '..KKK.KK.KKK..'
  ]
};

export const RECOLORS = {
  pepper: { base: 'marge', pal: { A: '#8a1030', R: '#1b1b22', W: '#f0d0a0' } },
  cassino: { base: 'bruno', pal: { X: '#f5f2e8', W: '#c81f6c' } },
  zenqueen: { base: 'kate', pal: { Y: '#141014', U: '#2fa08f' } },
  steward: { base: 'gus', pal: { Z: '#d8dae8', P: '#c9a13b' } }
};

const ITEM_GRIDS = {
  comb: [
    '..BBBBBBBB..',
    '..BBBBBBBB..',
    '.B.B.B.B.B.B',
    '.B.B.B.B.B.B',
    '.B.B.B.B.B.B'
  ],
  drink: [
    '.BOBBBBBBBB.',
    '..BBBBBBBB..',
    '...BBBBBB...',
    '....BBBB....',
    '.....NN.....',
    '....NNNN....'
  ],
  chip: [
    '..GGGGGGGG..',
    '.GGGGGGGGGG.',
    '.GGGWWGGGGG.',
    '.GGGGGGGGGG.',
    '..GGGGGGGG..'
  ],
  hat: [
    '..WWWWWWWW..',
    '.WWWWWWWWWW.',
    '.WKKKKKKKKW.',
    '.WGGGGGGGGW.',
    'WWWWWWWWWWWW'
  ],
  skewer: [
    '.....KK.....',
    '.....ZZ.....',
    '.....RR.....',
    '.....WW.....',
    '.....KK.....',
    '.....KK.....'
  ],
  mud: [
    '.BBBBBBBBBB.',
    '.BSSSSSSSSB.',
    '.BSSSSSSSSB.',
    '.BBBBBBBBBB.'
  ],
  pom: [
    '.NNN....NNN.',
    'NNNNN.NNNNN.',
    '.NNNNNNNNNN.',
    '..NNNNNNNN..',
    '....WWWW....'
  ]
};

function pixelCanvas(rows, palette = PAL) {
  const cols = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = palette[ch] || '#f0f';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function pixelTexture(rows, palette = PAL) {
  const tex = new THREE.CanvasTexture(pixelCanvas(rows, palette));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const PIXEL = 0.085;

export function makeCharacter(id, palette = PAL) {
  const rows = CHAR_GRIDS[id];
  const w = rows[0].length * PIXEL;
  const h = rows.length * PIXEL;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ map: pixelTexture(rows, palette), transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.height = h;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(w * 0.38, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  mesh.add(shadow);
  return mesh;
}

export function makeSpriteFor(key) {
  if (RECOLORS[key]) {
    const r = RECOLORS[key];
    return makeCharacter(r.base, { ...PAL, ...r.pal });
  }
  return makeCharacter(key);
}

export function itemIconDataURL(id) {
  return pixelCanvas(ITEM_GRIDS[id]).toDataURL();
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

export function makeCheckerTexture(c1, c2, cells = 8) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x * step, y * step, step, step);
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
  ctx.fillStyle = 'rgba(0,0,0,0)';
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
  canvas.width = 32;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 32, 48);
  grad.addColorStop(0, '#cfd8e8');
  grad.addColorStop(0.5, '#7f8db0');
  grad.addColorStop(1, '#3c4463');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 5; i++) ctx.fillRect(6 + i * 3, 40 - i * 8, 2, 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
