(() => {
  "use strict";

  const ID = {
    FOUR_DIAMOND: 0,
    EIGHT_PITS: 1,
    ARROW_PITS: 2,
    WIDE_DIAMOND: 3,
    FOREST: 4,
    DC: 5,
    PIT: 6,
    HOME: 7,
    TITLE: 8,
  };

  const ZONE = {
    BLANK: 0, WARP_LEFT: 1, WARP_RIGHT: 2, WARP_UP: 3, WARP_DOWN: 4,
    FIND_PHONE: 5, EAT_CANDY: 6, RETURN_HOME: 7, CALL_ELLIOTT: 8,
    CALL_SHIP: 9, LANDING: 10, PIT: 11, FLOWER: 12,
  };

  const OBJ = { FBI: 0, ELLIOTT: 1, SCIENTIST: 2, H: 3, S: 4, W: 5, FLOWER: 6, SHIP: 7 };

  const XMAX = 119;
  const ET_YMAX = 58;
  const H_MOTHERSHIP = 32;
  const START_LANDING_TIMER = 63;
  const MAX_ENERGY = 0x99;
  const MAX_HOLD_CANDY = 9 << 4;
  const INIT_TRIES = 3;
  const FRAME_DELAY = { ET_WALK: 0x3f, ET_RUN: 0x81, HUMAN_FAST: 0x5d, HUMAN_SLOW: 0x3b };

  const PF_COLORS = [0xc0, 0xc0, 0xc0, 0xc0, 0xc0, 0x08, 0x00, 0x72, 0x00];
  const BG_COLORS = [0xd4, 0xd4, 0xd4, 0xd4, 0xd4, 0x84, 0x06, 0x9c, 0x80];
  const ET_COLORS = [0x0e, 0xde, 0xdc, 0xda, 0xda, 0xda, 0x00];

  const CANDY_V = [32, 32, 32, 32];
  const CANDY_H = [60, 60, 38, 38];
  const PHONE_PIT_Y = [19, 32, 32, 44, 11, 32, 32, 52, 21, 21, 45, 45, 15, 15, 47, 47];
  const PHONE_PIT_X = [62, 25, 101, 62, 62, 30, 95, 62, 25, 100, 28, 96, 30, 95, 30, 95];

  const LEFT_H = [119, 119, 119, 119, 68, 68];
  const RIGHT_H = [1, 1, 1, 1, 58, 58];
  const UP_H = [0, 117, 0, 4, 0, 0];
  const DOWN_H = [0, 4, 0, 117, 0, 0];
  const LEFT_V = [0, 0, 0, 0, 4, 53];
  const RIGHT_V = [0, 0, 0, 0, 4, 53];
  const UP_V = [8, 36, 57, 36, 8, 57];
  const DOWN_V = [2, 28, 50, 28, 2, 50];
  const LEFT_S = [1, 2, 3, 0, 3, 1];
  const RIGHT_S = [3, 0, 1, 2, 1, 3];
  const UP_S = [4, 4, 4, 4, 0, 0];
  const DOWN_S = [5, 5, 5, 5, 2, 2];

  const HUMAN_TX = [28, 60, 94];
  const HUMAN_TY = [15, 47, 15];
  const HUMAN_YMAX = [48, 52, 48];
  const HUMAN_H = [14, 11, 14];

  const HUMAN_DIR = [
    0x0f, 0x0b, 0x0e, 0x07, 0x0e, 0x0d, 0xf0, 0xf0,
    0x07, 0x0f, 0x0b, 0x0e, 0x0e, 0x0d, 0xf0, 0xf0,
    0x0e, 0x07, 0x0f, 0x0b, 0x0e, 0x0d, 0xf0, 0xf0,
    0x0b, 0x0d, 0x07, 0x0f, 0x0e, 0x0d, 0xf0, 0xf0,
    0x0e, 0x07, 0x0d, 0x0b, 0x0f, 0x0d, 0xf0, 0xf0,
    0x0e, 0x0b, 0x0d, 0x07, 0x0e, 0x0f, 0xf0, 0xf0,
  ];

  const CANDY_MASK = [0xfe, 0xfd, 0xfb, 0xf7];
  const CANDY_BIT = [1, 2, 4, 8];
  const EXTRA_REDUCE = [4, 3, 3, 2, 3, 2, 2, 1, 3, 2, 2, 1, 2, 1, 1, 0];
  const RAND_INC = [115, 13, 91, 213];
  const HELD_SCORE = [0, 490, 980, 1470, 1960, 2450, 2940, 3430, 3920, 4410];
  const NEXT_ENERGY = [0x99, 0x92, 0x84, 0x76, 0x68, 0x59, 0x51, 0x42];
  const NEXT_SCORE = [0, 0x10, 0x22, 0x34, 0x45, 0x63, 0x78, 0x99];

  const PF_KEY = [
    ["widePF1", "widePF2"],
    ["eightPF", "eightPF"],
    ["arrowPF1", "arrowPF2"],
    ["fourPF", "fourPF"],
    ["forestPF1", "forestPF2"],
    ["washPF1", "washPF2"],
    ["pitPF1", "pitPF2"],
    ["homePF1", "homePF2"],
    ["forestPF1", "forestPF2"],
  ];

  const NTSC_HUE = [
    [0, 0, 0], [30, 30, 0], [50, 20, 0], [60, 10, 0],
    [70, 0, 20], [50, 0, 60], [20, 0, 70], [0, 10, 70],
    [0, 30, 70], [0, 50, 40], [0, 50, 10], [0, 40, 0],
    [10, 40, 0], [30, 30, 0], [40, 20, 0], [40, 10, 0],
  ];

  function ntsc(c) {
    const hue = (c >> 4) & 15;
    const lum = (c & 14) / 14;
    if (hue === 0) {
      const g = Math.round(lum * 255);
      return `rgb(${g},${g},${g})`;
    }
    const [r, g, b] = NTSC_HUE[hue];
    const k = 40 + lum * 215;
    return `rgb(${Math.min(255, r * k / 70 | 0)},${Math.min(255, g * k / 70 | 0)},${Math.min(255, b * k / 70 | 0)})`;
  }

  function bcdToInt(hi, lo) {
    return ((hi >> 4) * 1000) + ((hi & 15) * 100) + ((lo >> 4) * 10) + (lo & 15);
  }

  function addBcd16(hi, lo, addHi, addLo) {
    let n = bcdToInt(hi, lo) + ((addHi >> 4) * 1000) + ((addHi & 15) * 100) + ((addLo >> 4) * 10) + (addLo & 15);
    if (n > 9999) n = 9999;
    return [(n / 1000 | 0) << 4 | ((n / 100 | 0) % 10), ((n / 10 | 0) % 10) << 4 | (n % 10)];
  }

  function subBcd16(hi, lo, subHi, subLo) {
    let n = bcdToInt(hi, lo) - (((subHi >> 4) * 1000) + ((subHi & 15) * 100) + ((subLo >> 4) * 10) + (subLo & 15));
    if (n < 0) n = -1;
    if (n < 0) return [0, 0, true];
    return [(n / 1000 | 0) << 4 | ((n / 100 | 0) % 10), ((n / 10 | 0) % 10) << 4 | (n % 10), false];
  }

  const canvas = document.getElementById("game");
  canvas.addEventListener("click", () => canvas.focus());
  canvas.focus();
  const ctx = canvas.getContext("2d");
  const SCALE = 4;
  const FIELD_W = 160;
  const FIELD_H = 192;

  const keys = new Set();
  const keysEdge = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "z", "x"].includes(k) || e.code === "Space") {
      e.preventDefault();
    }
    if (!keys.has(k)) keysEdge.add(k);
    keys.add(k);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  let audioCtx = null;
  function beep(freq, dur, vol = 0.04, type = "square") {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* ignore */ }
  }

  const G = {
    screen: ID.TITLE,
    frame: 0,
    second: 0,
    selection: 1,
    diffLeftA: false,
    diffRightA: false,
    fireHeld: false,
    et: { x: 65, y: 30, motion: 0x0f, frac: 0, neck: 0, pit: 0, anim: 2, run: false, carried: false },
    hold: { x: 0, y: 0, screen: 0 },
    energyHi: 0x99,
    energyLo: 0x99,
    heldCandy: 0x0a,
    extraCandy: 16,
    collectedCandy: 0,
    candyStatus: 0,
    candyX: 60,
    candyY: 127,
    score: 3,
    tries: INIT_TRIES - 1,
    playerDead: false,
    elliottRevive: false,
    lost: false,
    flower: 0,
    phones: [0, 0, 0],
    zone: 0,
    zonePtr: 0,
    zoneLSB: [0, 0, 0],
    callHome: 0,
    pitNumber: 0,
    landingTimer: -1,
    mothership: 0,
    shipX: 56,
    shipY: 240,
    shipH: 16,
    humans: [
      { id: 0, screen: -1, x: 28, y: 15, attr: 0xff, anim: 0 },
      { id: 1, screen: -1, x: 60, y: 47, attr: 0xff, anim: 0 },
      { id: 2, screen: -1, x: 94, y: 15, attr: 0xff, anim: 0 },
    ],
    currentObj: -1,
    objInPit: -1,
    humanFrac: 0,
    hiddenPhoneX: 0,
    hiddenPhoneY: 127,
    startingScreen: ID.TITLE,
    eatAnim: 0,
    homeElliottDir: 0,
    scoringPhase: 0,
  };

  function pfFor(screen) {
    const gfx = window.ET_GFX.pf;
    const [a, b] = PF_KEY[Math.min(screen, 8)];
    return [gfx[a], gfx[b]];
  }

  function pfBit(screen, x, y) {
    if (y < 0 || y > 63) return 0;
    const [pf1, pf2] = pfFor(screen);
    const p1 = pf1[y] | 0;
    const p2 = pf2[y] | 0;
    const tia = 16 + Math.round(x * (128 / 120));
    const bit = (tia / 4) | 0;
    if (bit < 4 || bit > 35) return bit < 4 || bit > 35 ? 0 : 1;
    let col = bit - 4;
    if (col < 8) return (p1 >> (7 - col)) & 1;
    col -= 8;
    if (col < 8) return (p2 >> col) & 1;
    col -= 8;
    if (col < 8) return (p2 >> (7 - col)) & 1;
    col -= 8;
    return (p1 >> col) & 1;
  }

  function etHitsPlayfield() {
    if (G.screen >= ID.FOREST) return false;
    const spr = window.ET_GFX.sprites.ETWalkSprite_A0;
    for (let row = 0; row < spr.length; row++) {
      const bits = spr[row];
      const py = G.et.y + row;
      for (let b = 0; b < 8; b++) {
        if ((bits >> (7 - b)) & 1) {
          if (pfBit(G.screen, G.et.x + b, py)) return true;
        }
      }
    }
    return false;
  }

  function etHitsSprite(ox, oy, w, h) {
    return G.et.x < ox + w && G.et.x + 8 > ox && G.et.y < oy + h && G.et.y + 9 > oy;
  }

  function powerZoneAt() {
    if (G.screen === ID.PIT) {
      if (G.objInPit === (0x80 | OBJ.FLOWER) && Math.abs(G.et.x - 41) < 16) return ZONE.FLOWER;
      return ZONE.PIT;
    }
    if (G.screen >= ID.PIT) return ZONE.BLANK;
    let idx = (G.et.x >> 3) & 0x0c;
    idx |= (G.et.y >> 4);
    const odd = idx & 1;
    const y = idx >> 1;
    let byte = window.ET_GFX.powerZoneMap[(G.zonePtr + y) & 127];
    let z = odd ? (byte >> 4) : (byte & 0x0f);
    if (z === ZONE.FIND_PHONE && G.screen >= ID.FOREST) z = ZONE.BLANK;
    if (z === ZONE.CALL_ELLIOTT && G.screen === ID.FOREST) z = ZONE.BLANK;
    if (z === ZONE.LANDING && G.screen !== ID.FOREST) z = ZONE.BLANK;
    if (z === ZONE.CALL_SHIP && G.screen !== G.callHome) z = ZONE.BLANK;
    return z;
  }

  function calcZonePtr() {
    if (G.screen >= ID.PIT) return;
    const odd = G.screen & 1;
    const v = G.zoneLSB[G.screen >> 1] | 0;
    let lsb = odd ? ((v << 3) & 0xff) : (v >> 1);
    G.zonePtr = lsb & 0x78;
  }

  function placeCandy() {
    G.candyY = 127;
    if (G.screen < ID.FOREST && (G.candyStatus & CANDY_BIT[G.screen])) {
      G.candyX = CANDY_H[G.screen];
      G.candyY = CANDY_V[G.screen];
    }
  }

  function setScreen(id) {
    G.screen = id;
    G.hiddenPhoneY = 127;
    G.phones = G.phones.map((p) => p & ~0x40);
    if (G.mothership & 0x80 && !(G.mothership & 0x40)) {
      /* drop-off already handled */
    }
    G.currentObj = -1;
    G.objInPit = -1;
    if (id === ID.PIT) return;
    if (id === ID.HOME) return;
    for (let i = 2; i >= 0; i--) {
      if (G.humans[i].screen === id) {
        G.currentObj = i;
        break;
      }
    }
    calcZonePtr();
    placeCandy();
  }

  function incrementEnergy(hi, lo) {
    const [nh, nl] = addBcd16(G.energyHi, G.energyLo, hi, lo);
    G.energyHi = nh;
    G.energyLo = nl;
  }

  function decrementEnergy(hi, lo) {
    const [nh, nl, dead] = subBcd16(G.energyHi, G.energyLo, hi, lo);
    G.energyHi = nh;
    G.energyLo = nl;
    if (dead) G.playerDead = true;
  }

  function startRound(newGame) {
    if (newGame) {
      G.extraCandy = 16;
      G.lost = false;
      G.tries = INIT_TRIES - 1;
      G.playerDead = false;
      G.elliottRevive = false;
      G.collectedCandy = 0;
      G.score = 3;
      G.et.pit = 0;
      G.et.neck = 0;
      G.et.carried = false;
    }
    G.fireHeld = true;
    G.mothership = 0x84;
    G.startingScreen = 0x84;
    G.humans.forEach((h) => {
      h.attr = 0xff;
      h.screen = -1;
    });
    G.landingTimer = -1;
    G.heldCandy = 0x0a;
    G.callHome = (G.frame ^ G.second) & 7;
    if (G.callHome >= ID.PIT) G.callHome -= ID.FOREST;
    const x = G.second & 3;
    G.flower = G.frame & 15;
    G.phones[1] = (G.flower + RAND_INC[x]) & 15;
    G.phones[0] = (G.phones[1] + RAND_INC[x]) & 15;
    G.phones[2] = (G.phones[0] + RAND_INC[x]) & 15;
    const t = G.frame & 3;
    G.zoneLSB[0] = G.second;
    G.zoneLSB[1] = (G.second + RAND_INC[t]) & 255;
    G.zoneLSB[2] = (G.zoneLSB[1] + RAND_INC[t]) & 255;
    if (G.extraCandy >= 31) {
      const idx = (G.extraCandy - 31) >> 1;
      G.energyHi = NEXT_ENERGY[idx] || 0x42;
      G.energyLo = G.energyHi;
      G.score += (NEXT_SCORE[idx] || 0) * 100;
      G.extraCandy = 31;
    } else {
      G.energyHi = MAX_ENERGY;
      G.energyLo = MAX_ENERGY;
    }
    G.et.x = 61;
    G.et.y = 244 & 255;
    G.shipX = 56;
    G.shipY = 240;
    G.shipH = 16;
    G.screen = ID.FOREST;
    G.candyStatus = 0;
    calcZonePtr();
    beep(180, 0.4, 0.05, "sawtooth");
  }

  function wrapTo(tableS, tableX, tableY, from) {
    const ns = tableS[from];
    const nx = tableX[from];
    const ny = tableY[from];
    if (nx) G.et.x = nx;
    if (ny) G.et.y = ny;
    setScreen(ns);
  }

  function humanOnScreen(id) {
    return G.humans.some((h, i) => i !== undefined && h.screen === id);
  }

  function spawnHumanAtDC(h) {
    if (humanOnScreen(ID.DC)) return;
    h.screen = ID.DC;
    h.x = HUMAN_TX[h.id];
    h.y = HUMAN_TY[h.id];
    h.attr = 0x0b;
    if (G.screen === ID.DC) G.currentObj = h.id;
  }

  function takePhoneOrCandyByFBI() {
    for (let i = 2; i >= 0; i--) {
      if (G.phones[i] & 0x80) {
        G.phones[i] = 0x20 | (G.frame & 15);
        beep(140, 0.15);
        return;
      }
    }
    G.heldCandy = 0x0a;
    beep(120, 0.2);
  }

  function collideHumans() {
    if (G.screen === ID.PIT || G.screen >= ID.HOME) return;
    if (G.currentObj < 0 || G.currentObj > 2) return;
    const h = G.humans[G.currentObj];
    if (h.screen !== G.screen) return;
    if (h.attr & 0x80) return;
    if (!etHitsSprite(h.x, h.y, 8, HUMAN_H[h.id])) return;
    if (h.id === OBJ.FBI) {
      takePhoneOrCandyByFBI();
      h.attr |= 0x80;
    } else if (h.id === OBJ.SCIENTIST) {
      G.et.carried = true;
      G.humans[0].attr |= 0x80;
      G.humans[1].attr |= 0x80;
      h.attr |= 0x80;
      beep(90, 0.3);
    } else {
      beep(320, 0.12);
      if (G.playerDead) {
        if (G.tries >= 0) {
          G.tries -= 1;
          incrementEnergy(0x15, 0x00);
          G.playerDead = false;
          G.elliottRevive = false;
          h.screen = -1;
          h.attr = 0xff;
          G.currentObj = -1;
        } else {
          G.lost = true;
          G.screen = ID.HOME;
          G.scoringPhase = 0;
        }
        return;
      }
      let gave = false;
      for (let i = 0; i < 3; i++) {
        if (G.phones[i] & 0x10) {
          G.phones[i] = 0x80;
          gave = true;
          break;
        }
      }
      if (!gave) {
        const held = G.heldCandy >> 4;
        if (held) {
          G.collectedCandy += held;
          if (held >= 9) {
            for (let i = 2; i >= 0; i--) {
              if ((G.phones[i] & 0xf0) === 0) {
                G.phones[i] = 0x10;
                break;
              }
            }
          }
          G.heldCandy &= 0x0f;
        }
      }
      h.attr |= 0x80;
    }
  }

  function collidePitObject() {
    if (G.screen !== ID.PIT) return;
    if (G.objInPit < 0) return;
    const id = G.objInPit & 0x0f;
    if (id === OBJ.FLOWER) {
      if (etHitsSprite(41, 50, 8, 8) && G.zone === ZONE.FLOWER && G.et.neck & 0x80) return;
      return;
    }
    if (id >= OBJ.H && id <= OBJ.W && etHitsSprite(41, 50, 8, 10)) {
      G.phones[id - OBJ.H] = 0x80;
      G.objInPit = -1;
      beep(400, 0.12);
    }
  }

  function placeInPit() {
    if (G.et.neck & 0x80) return;
    G.hold.x = G.et.x;
    G.hold.y = G.et.y;
    G.hold.screen = G.screen;
    const hx = G.et.x;
    const hy = G.et.y;
    let pit;
    if (G.screen === ID.FOUR_DIAMOND) {
      if (hx < 41) pit = 1;
      else if (hx >= 81) pit = 2;
      else pit = hy < 29 ? 0 : 3;
    } else if (G.screen === ID.EIGHT_PITS) {
      let yq = 0;
      if (hy >= 19 && hy < 40) {
        yq = hx < 64 ? 1 : 2;
        pit = 4 | yq;
      } else {
        if (hy >= 40) yq = 3;
        if (hx < 32 || hx >= 96) pit = 255;
        else pit = 4 | yq;
      }
    } else if (G.screen === ID.ARROW_PITS) {
      let t = 8;
      if (hx >= 59) t += 1;
      if (hy >= 33) t += 2;
      pit = t;
    } else {
      let t = 12;
      if (hx >= 59) t += 1;
      if (hy >= 33) t += 2;
      pit = t;
    }
    G.pitNumber = pit;
    G.et.x = 69;
    G.et.y = 3;
    G.et.pit = 0x80;
    G.objInPit = -1;
    if (!G.playerDead && pit !== 255) {
      for (let i = 0; i < 3; i++) {
        if ((G.phones[i] & 0xf0) === 0 && (G.phones[i] & 15) === pit) {
          G.objInPit = 0x80 | (OBJ.H + i);
          break;
        }
      }
      if (G.objInPit < 0 && (G.flower & 15) === pit) G.objInPit = 0x80 | OBJ.FLOWER;
    }
    setScreen(ID.PIT);
    beep(90, 0.2, 0.05, "triangle");
  }

  function usePower() {
    const z = G.zone;
    decrementEnergy(0x00, 0x19);
    if (G.selection < 2 && G.humans[2].screen < 0) G.humans[2].attr &= 0x7f;
    if (z === ZONE.WARP_LEFT) wrapTo(LEFT_S, LEFT_H, LEFT_V, G.screen);
    else if (z === ZONE.WARP_RIGHT) wrapTo(RIGHT_S, RIGHT_H, RIGHT_V, G.screen);
    else if (z === ZONE.WARP_UP) wrapTo(UP_S, UP_H, UP_V, G.screen);
    else if (z === ZONE.WARP_DOWN) wrapTo(DOWN_S, DOWN_H, DOWN_V, G.screen);
    else if (z === ZONE.FIND_PHONE) {
      for (let i = 0; i < 3; i++) {
        if ((G.phones[i] & 0xf0) === 0 && ((G.phones[i] & 15) >> 2) === G.screen) {
          G.phones[i] |= 0x40;
          beep(520, 0.15);
          break;
        }
      }
    } else if (z === ZONE.EAT_CANDY) {
      if ((G.heldCandy >> 4) > 0) {
        G.heldCandy -= 0x10;
        incrementEnergy(0x03, 0x60);
        beep(280, 0.1);
      }
    } else if (z === ZONE.RETURN_HOME) {
      if (G.currentObj >= 0 && G.currentObj <= 2) G.humans[G.currentObj].attr |= 0x80;
    } else if (z === ZONE.CALL_ELLIOTT) {
      G.humans[1].attr &= 0x7f;
      beep(360, 0.12);
    } else if (z === ZONE.CALL_SHIP) {
      const obj = G.currentObj;
      const humanPresent = obj >= 0 && obj <= 2;
      let ok = !humanPresent;
      if (humanPresent && !G.diffLeftA && obj === OBJ.ELLIOTT) ok = true;
      if (ok && (G.phones[0] & 0x80) && (G.phones[1] & 0x80) && (G.phones[2] & 0x80) && G.landingTimer < 0) {
        G.landingTimer = START_LANDING_TIMER;
        G.humans.forEach((h) => { h.attr = 0x8f; });
        beep(200, 0.4, 0.06, "sawtooth");
      }
    } else if (z === ZONE.PIT) {
      G.et.pit = 0x40;
      G.et.y -= 2;
    } else if (z === ZONE.FLOWER) {
      if ((G.flower & 0x80) === 0) {
        G.tries += 1;
        G.flower |= 0x80;
        beep(480, 0.2);
      }
    }
  }

  function joystick() {
    let up = keys.has("arrowup") || keys.has("w");
    let down = keys.has("arrowdown") || keys.has("s");
    let left = keys.has("arrowleft") || keys.has("a");
    let right = keys.has("arrowright") || keys.has("d");
    let fire = keys.has(" ") || keys.has("z") || keys.has("x");
    let motion = 0;
    if (!up) motion |= 1;
    if (!down) motion |= 2;
    if (!left) motion |= 4;
    if (!right) motion |= 8;
    if (motion === 0) motion = 0x0f;
    G.et.motion = (G.et.motion & 0xf0) | motion;
    const fireEdge = keysEdge.has(" ") || keysEdge.has("z") || keysEdge.has("x");
    keysEdge.clear();
    return { up, down, left, right, fire, fireEdge, moving: motion !== 0x0f };
  }

  function moveObject(dirBits, obj) {
    if ((dirBits & 1) === 0) obj.y -= 1;
    if ((dirBits & 2) === 0) obj.y += 1;
    if ((dirBits & 4) === 0) obj.x -= 1;
    if ((dirBits & 8) === 0) obj.x += 1;
  }

  function signedWrapY() {
    if ((G.et.y & 255) < 59) return false;
    if (G.et.y < 128) {
      wrapTo(DOWN_S, DOWN_H, DOWN_V, G.screen);
    } else {
      wrapTo(UP_S, UP_H, UP_V, G.screen);
    }
    return true;
  }

  function maybeWrap() {
    if (G.screen >= ID.PIT) return;
    const x = G.et.x & 255;
    if (x >= 120) {
      if (G.et.x < 128) wrapTo(RIGHT_S, RIGHT_H, RIGHT_V, G.screen);
      else wrapTo(LEFT_S, LEFT_H, LEFT_V, G.screen);
      return;
    }
    signedWrapY();
  }

  function updateHumans() {
    if (G.et.neck & 0x80) return;
    if (G.mothership & 0x80) return;
    const delay = G.diffRightA ? FRAME_DELAY.HUMAN_FAST : FRAME_DELAY.HUMAN_SLOW;
    const sum = G.humanFrac + delay;
    G.humanFrac = sum & 255;
    if (sum <= 255) return;

    for (let i = 0; i < 3; i++) {
      const h = G.humans[i];
      if (h.screen < 0) continue;
      if (h.screen === ID.DC && (h.attr & 0x80)) {
        if (h.x === HUMAN_TX[i] && h.y === HUMAN_TY[i]) {
          h.screen = -1;
          if (i === 0) G.phones = G.phones.map((p) => p & ~0x20);
          if (i === 1) {
            if (!G.et.carried && !G.playerDead && G.phones.some((p) => p & 0x10)) h.attr &= 0x7f;
          }
          if (i === 2) G.et.carried = false;
          if (G.currentObj === i) G.currentObj = -1;
          continue;
        }
        if (h.y < HUMAN_TY[i]) h.y++;
        else if (h.y > HUMAN_TY[i]) h.y--;
        if (h.x < HUMAN_TX[i]) h.x++;
        else if (h.x > HUMAN_TX[i]) h.x--;
        continue;
      }
      if (h.screen === G.screen && !(h.attr & 0x80)) {
        if (h.y >= HUMAN_YMAX[i]) h.y--;
        if (h.y < G.et.y) h.y++;
        else if (h.y > G.et.y) h.y--;
        if (h.x < G.et.x) h.x++;
        else if (h.x > G.et.x) h.x--;
        continue;
      }
      const a = h.attr;
      const from = h.screen;
      if ((a & 1) === 0) {
        h.y--;
        if (h.y < 0) {
          const ns = UP_S[from];
          if (humanOnScreen(ns)) { h.y += 2; }
          else {
            h.screen = ns;
            if (UP_V[from]) h.y = Math.min(UP_V[from], HUMAN_YMAX[i] - 1);
            if (UP_H[from]) h.x = UP_H[from];
            G.currentObj = h.screen === G.screen ? i : (G.currentObj === i ? -1 : G.currentObj);
          }
        }
      } else if ((a & 2) === 0) {
        h.y++;
        if (h.y > HUMAN_YMAX[i]) {
          const ns = DOWN_S[from];
          if (humanOnScreen(ns)) { h.y -= 2; }
          else {
            h.screen = ns;
            if (DOWN_V[from]) h.y = Math.min(DOWN_V[from], HUMAN_YMAX[i] - 1);
            if (DOWN_H[from]) h.x = DOWN_H[from];
            G.currentObj = h.screen === G.screen ? i : (G.currentObj === i ? -1 : G.currentObj);
          }
        }
      } else if ((a & 4) === 0) {
        h.x--;
        if (h.x < 0) {
          const ns = LEFT_S[from];
          if (humanOnScreen(ns)) { h.x += 2; }
          else {
            h.screen = ns;
            if (LEFT_V[from]) h.y = Math.min(LEFT_V[from], HUMAN_YMAX[i] - 1);
            if (LEFT_H[from]) h.x = LEFT_H[from];
            G.currentObj = h.screen === G.screen ? i : (G.currentObj === i ? -1 : G.currentObj);
          }
        }
      } else if ((a & 8) === 0) {
        h.x++;
        if (h.x > XMAX) {
          const ns = RIGHT_S[from];
          if (humanOnScreen(ns)) { h.x -= 2; }
          else {
            h.screen = ns;
            if (RIGHT_V[from]) h.y = Math.min(RIGHT_V[from], HUMAN_YMAX[i] - 1);
            if (RIGHT_H[from]) h.x = RIGHT_H[from];
            G.currentObj = h.screen === G.screen ? i : (G.currentObj === i ? -1 : G.currentObj);
          }
        }
      }
    }
  }

  function steerHumans() {
    const who = G.frame & 3;
    if (who > 2) return;
    const h = G.humans[who];
    if (h.screen < 0) {
      if (h.id === OBJ.FBI && G.selection >= 3) return;
      if (h.id === OBJ.SCIENTIST && G.selection >= 2) return;
      if (!(h.attr & 0x80)) spawnHumanAtDC(h);
      return;
    }
    if (G.screen >= ID.PIT) return;
    let idx;
    if (h.attr & 0x80) idx = 5 + h.screen * 8;
    else idx = G.screen + h.screen * 8;
    const dir = HUMAN_DIR[idx] & 0x0f;
    if (dir === 0x0f) return;
    h.attr = (h.attr & 0xf0) | dir;
  }

  function updateMothership() {
    if (!(G.mothership & 0x80)) return true;
    const goingHome = G.mothership & 0x40;
    const leaving = G.mothership & 1;
    if (!goingHome && !leaving) {
      if ((G.frame & 3) === 0) {
        G.shipY = (G.shipY + 1) & 255;
        G.et.y = (G.et.y + 1) & 255;
        const v = G.shipY;
        if (v < 128 && v >= H_MOTHERSHIP) G.mothership = 0x81;
      }
      if ((G.frame & 7) === 0) beep(80 + (G.frame & 31), 0.05, 0.03, "sawtooth");
      return true;
    }
    if (!goingHome && leaving) {
      G.shipY = (G.shipY - 1) & 255;
      if (G.shipY < 128 && G.shipY < 240) {
        G.mothership = 0;
      }
      return true;
    }
    if (goingHome && !leaving) {
      if ((G.frame & 3) === 0) {
        G.shipY = (G.shipY + 1) & 255;
        if (((G.et.y - 4) & 255) === G.shipY) G.mothership |= 1;
      }
      return true;
    }
    G.et.y = (G.et.y - 1) & 255;
    G.shipY = (G.shipY - 1) & 255;
    if (G.shipY < 128 && G.shipY < 200) {
      G.mothership = 0;
      G.screen = ID.HOME;
      G.scoringPhase = 0;
      G.et.x = 60;
      G.et.y = 48;
    }
    return true;
  }

  function collectCandy() {
    if (G.screen >= ID.FOREST) return;
    if (G.candyY > 63) return;
    if (Math.abs(G.et.x + 4 - G.candyX) < 8 && Math.abs(G.et.y + 4 - G.candyY) < 8) {
      if ((G.heldCandy & 0xf0) < MAX_HOLD_CANDY) {
        G.heldCandy += 0x10;
        G.candyY = 127;
        G.candyStatus &= CANDY_MASK[G.screen];
        beep(660, 0.08);
      }
    }
  }

  function tick() {
    G.frame = (G.frame + 1) & 255;
    if ((G.frame & 0x3f) === 0) G.second = (G.second + 1) & 255;

    G.selection = Number(document.getElementById("variation").value);
    G.diffRightA = document.getElementById("diffRight").value === "A";
    G.diffLeftA = document.getElementById("diffLeft").value === "A";

    if (G.screen === ID.TITLE) {
      if (keysEdge.has(" ") || keysEdge.has("z") || keys.has("enter")) {
        keysEdge.clear();
        startRound(true);
      }
      return;
    }

    if (G.screen === ID.HOME) {
      homeTick();
      return;
    }

    if (G.mothership & 0x80) {
      updateMothership();
      G.zone = powerZoneAt();
      return;
    }

    if ((G.frame === 0) && G.selection < 3 && G.humans[0].screen < 0 && !G.et.carried) {
      G.humans[0].attr = 0x0f;
    }

    if ((G.second & 0x0f) === 0 && (G.frame & 0x3f) === 23) {
      const x = G.candyStatus & 0x0f;
      const next = G.extraCandy - EXTRA_REDUCE[x];
      if (next >= 0) {
        G.extraCandy = next;
        G.candyStatus |= 0x0f;
        placeCandy();
      }
    }

    const joy = joystick();
    if (G.playerDead) {
      if (!G.elliottRevive) {
        G.elliottRevive = true;
        G.humans.forEach((h) => { h.attr = 0x80; });
        G.humans[1].attr = 0x0e;
        G.humans[1].screen = G.screen === ID.PIT ? G.hold.screen : G.screen;
        G.humans[1].x = 5;
        G.humans[1].y = 5;
        G.currentObj = 1;
      }
    }

    if (!G.playerDead && joy.fire) {
      if (!G.fireHeld) {
        G.fireHeld = true;
        if (joy.moving) G.et.run = true;
        else if (!G.et.carried && !(G.et.neck & 0x80)) {
          G.et.neck = 0x80;
          if (G.et.y > 0) G.et.y--;
        }
      }
    } else if (!joy.fire) {
      G.fireHeld = false;
      G.et.run = false;
    }

    if (G.et.carried) {
      const s = G.humans[2];
      if (s.screen !== G.screen && s.screen >= 0) setScreen(s.screen);
      if (s.screen >= 0) {
        G.et.x = s.x;
        G.et.y = s.y;
      }
      if (G.et.run) G.et.carried = false;
    }

    if (G.et.neck & 0x80) {
      if ((G.frame & 3) === 0) {
        if (!(G.et.neck & 0x40)) {
          G.et.neck = (G.et.neck + 1) | 0x80;
          if ((G.et.neck & 7) >= 4) {
            G.et.neck = 0xc3;
            usePower();
          } else if (G.et.y > 0) G.et.y--;
        } else if (!(G.et.pit & 0x40)) {
          G.et.neck--;
          G.et.y++;
          if ((G.et.neck & 7) === 7) G.et.neck = 0;
        }
      }
    }

    if (G.et.pit & 0x80) {
      if ((G.et.y & 255) < 49) G.et.y++;
      else {
        decrementEnergy(0x02, 0x69);
        G.et.pit = 0x20;
        beep(70, 0.25, 0.05, "triangle");
      }
    } else if (G.et.pit & 0x40) {
      if ((G.frame & 7) === 0) decrementEnergy(0, 1);
      G.et.y -= 2;
      if (G.et.y <= 2 && G.screen === ID.PIT) {
        G.et.x = G.hold.x;
        G.et.y = G.hold.y;
        G.et.pit = 0;
        setScreen(G.hold.screen);
      } else if (G.et.y >= 45) G.et.pit = 0x20;
    } else if (G.et.pit & 0x20 && G.screen === ID.PIT) {
      G.et.motion |= 0x03;
      if (G.et.x < 32) G.et.motion |= 4;
      if (G.et.x >= 88) G.et.motion |= 8;
    }

    if (!G.playerDead && !G.et.carried && (G.et.pit === 0 || (G.et.pit & 0x20))) {
      const bits = G.et.motion & 0x0f;
      if (bits !== 0x0f) {
        const delay = G.et.run ? FRAME_DELAY.ET_RUN : FRAME_DELAY.ET_WALK;
        const prev = G.et.frac;
        G.et.frac = (G.et.frac + delay) & 255;
        if (prev + delay > 255) {
          moveObject(bits, G.et);
          decrementEnergy(0, 1);
          if (G.et.run && (G.et.pit === 0)) {
            moveObject(bits, G.et);
            decrementEnergy(0, 1);
          }
        }
      }
    }

    if (G.et.pit === 0 && G.screen < ID.PIT) maybeWrap();
    if (G.et.pit === 0 && G.screen < ID.FOREST && !(G.et.neck & 0x80) && etHitsPlayfield()) placeInPit();

    collectCandy();
    collideHumans();
    collidePitObject();
    steerHumans();
    updateHumans();

    if (G.landingTimer >= 0 && (G.frame & 0x1f) === 0) {
      G.landingTimer--;
      if (G.landingTimer < 0) {
        const human = G.currentObj >= 0 && G.currentObj <= 2;
        let land = G.zone === ZONE.LANDING && !human;
        if (G.zone === ZONE.LANDING && human && !G.diffLeftA && G.currentObj === OBJ.ELLIOTT) land = true;
        if (land) {
          G.mothership = 0xc0;
          G.shipY = 240;
          G.shipX = Math.max(0, G.et.x - 5);
          const held = G.heldCandy >> 4;
          let extra = Math.floor((held + G.collectedCandy) * 1.5);
          if (extra < 16) extra = 16;
          G.extraCandy = extra;
          beep(160, 0.5, 0.06, "sawtooth");
        } else beep(80, 0.3);
      } else if ((G.landingTimer & 7) === 7) beep(240, 0.05);
    }

    G.zone = powerZoneAt();
    G.hiddenPhoneY = 127;
    for (let i = 2; i >= 0; i--) {
      if (G.phones[i] & 0x40) {
        const pit = G.phones[i] & 15;
        G.hiddenPhoneX = PHONE_PIT_X[pit];
        G.hiddenPhoneY = (G.frame & 8) ? PHONE_PIT_Y[pit] : 127;
        break;
      }
    }

    if ((G.frame & 3) === 0) G.et.anim = (G.et.anim + 2) % 3;
  }

  function homeTick() {
    G.frame = (G.frame + 1) & 255;
    const joy = joystick();
    if (G.homeElliottDir) G.humans[1].x++;
    else G.humans[1].x--;
    if (G.humans[1].x < 28 || G.humans[1].x > 92) G.homeElliottDir ^= 1;
    if (G.scoringPhase === 0 && G.frame === 96) {
      G.score += bcdToInt(G.energyHi, G.energyLo);
      beep(300, 0.1);
    }
    if (G.scoringPhase === 0 && G.frame === 192) {
      G.score += HELD_SCORE[G.heldCandy >> 4] || 0;
      beep(340, 0.1);
    }
    if (G.frame === 255) G.scoringPhase = 1;
    if (G.scoringPhase === 1 && G.collectedCandy > 0 && (G.frame & 0x1f) === 0) {
      G.collectedCandy--;
      G.score += 770;
      G.eatAnim ^= 1;
      beep(400, 0.08);
    }
    if (G.scoringPhase === 1 && G.collectedCandy === 0 && (joy.fireEdge || joy.fire) && !G.lost) {
      startRound(false);
    }
    if (G.lost && joy.fireEdge) {
      G.screen = ID.TITLE;
    }
    G.humans[1].y = 15;
    G.et.x = 60;
    G.et.y = 48;
    G.currentObj = 1;
  }

  function drawSprite(bytes, x, y, color, reflect = false, rowScale = 2) {
    const px = 16 + Math.round(x * (128 / 120));
    for (let row = 0; row < bytes.length; row++) {
      let bits = bytes[row];
      if (reflect) {
        let r = 0;
        for (let i = 0; i < 8; i++) if (bits & (1 << i)) r |= 1 << (7 - i);
        bits = r;
      }
      for (let b = 0; b < 8; b++) {
        if ((bits >> (7 - b)) & 1) {
          ctx.fillStyle = typeof color === "function" ? color(row) : color;
          ctx.fillRect((px + b) * SCALE, (24 + (y + row) * rowScale) * SCALE, SCALE, SCALE * rowScale);
        }
      }
    }
  }

  function drawPF(screen) {
    const [pf1, pf2] = pfFor(screen);
    const bg = ntsc(BG_COLORS[Math.min(screen, 8)]);
    const fg = ntsc(PF_COLORS[Math.min(screen, 8)]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 24 * SCALE, FIELD_W * SCALE, 128 * SCALE);
    ctx.fillStyle = fg;
    for (let y = 0; y < 64; y++) {
      for (let bit = 0; bit < 40; bit++) {
        let on = 0;
        if (bit >= 4 && bit <= 35) {
          let col = bit - 4;
          const p1 = pf1[y] | 0;
          const p2 = pf2[y] | 0;
          if (col < 8) on = (p1 >> (7 - col)) & 1;
          else if (col < 16) on = (p2 >> (col - 8)) & 1;
          else if (col < 24) on = (p2 >> (7 - (col - 16))) & 1;
          else on = (p1 >> (col - 24)) & 1;
        }
        if (on) ctx.fillRect(bit * 4 * SCALE, (24 + y * 2) * SCALE, 4 * SCALE, 2 * SCALE);
      }
    }
  }

  function drawIcon(id, x, y, color) {
    const bytes = window.ET_GFX.sprites.icons.slice(id * 8, id * 8 + 8);
    ctx.fillStyle = color;
    for (let row = 0; row < 8; row++) {
      const bits = bytes[row];
      for (let b = 0; b < 8; b++) {
        if ((bits >> (7 - b)) & 1) ctx.fillRect((x + b) * SCALE, (y + row) * SCALE, SCALE, SCALE);
      }
    }
  }

  function drawDigit(n, x, y) {
    const fonts = window.ET_GFX.sprites.numbers;
    const off = (n & 15) * 8;
    ctx.fillStyle = ntsc(0x0e);
    for (let row = 0; row < 8; row++) {
      const bits = fonts[off + (7 - row)] || 0;
      for (let b = 0; b < 8; b++) {
        if ((bits >> (7 - b)) & 1) ctx.fillRect((x + b) * SCALE, (y + row) * SCALE, SCALE, SCALE);
      }
    }
  }

  function drawBcdPair(v, x, y) {
    drawDigit(v >> 4, x, y);
    drawDigit(v & 15, x + 8, y);
  }

  function humanSprite(h) {
    const s = window.ET_GFX.sprites;
    if (h.id === 0) return s[`FBIAgent_${h.anim % 8}`];
    if (h.id === 1) return s[`Elliott_${h.anim % 7}`];
    return s[`Scientist_${h.anim % 6}`];
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = ntsc(0x52);
    ctx.fillRect(0, 0, FIELD_W * SCALE, 24 * SCALE);

    if (G.screen === ID.TITLE) {
      ctx.fillStyle = ntsc(0xd4);
      ctx.fillRect(0, 24 * SCALE, FIELD_W * SCALE, 128 * SCALE);
      const E = window.ET_GFX.sprites.ETTitle_E;
      const T = window.ET_GFX.sprites.ETTitle_T;
      ctx.fillStyle = ntsc(0x24);
      for (let row = 0; row < 16; row++) {
        for (let b = 0; b < 8; b++) {
          if ((E[15 - row] >> (7 - b)) & 1) ctx.fillRect((40 + b * 4) * SCALE, (40 + row * 2) * SCALE, 4 * SCALE, 2 * SCALE);
          if ((T[15 - row] >> (7 - b)) & 1) ctx.fillRect((88 + b * 4) * SCALE, (40 + row * 2) * SCALE, 4 * SCALE, 2 * SCALE);
        }
      }
      ctx.fillStyle = ntsc(0xce);
      ctx.font = `${12 * SCALE}px monospace`;
      ctx.fillText("PRESS FIRE", 36 * SCALE, 140 * SCALE);
      drawDigit(G.selection, 76, 170);
      drawIcon(6, 20, 4, ntsc(0x9c));
      return;
    }

    const phoneCount = [G.phones[0], G.phones[1], G.phones[2]].filter((p) => p & 0x80).length;
    drawIcon(0, 16, 8, ntsc(0x4a));
    const tel = window.ET_GFX.sprites.telephone.slice((3 - phoneCount) * 8, (4 - phoneCount) * 8) || window.ET_GFX.sprites.telephone.slice(0, 8);
    ctx.fillStyle = ntsc(0x4a);
    for (let row = 0; row < 8; row++) {
      const bits = tel[row] || 0;
      for (let b = 0; b < 8; b++) if ((bits >> (7 - b)) & 1) ctx.fillRect((72 + b) * SCALE, (8 + row) * SCALE, SCALE, SCALE);
    }
    if (G.zone) drawIcon(G.zone, 96, 8, ntsc(0x9c));
    if (G.landingTimer >= 0) {
      const idx = Math.min(7, G.landingTimer >> 3);
      const cd = window.ET_GFX.sprites.countdown.slice(idx * 8, idx * 8 + 8);
      ctx.fillStyle = ntsc(0xfa);
      for (let row = 0; row < 8; row++) {
        const bits = cd[row] || 0;
        for (let b = 0; b < 8; b++) if ((bits >> (7 - b)) & 1) ctx.fillRect((128 + b) * SCALE, (8 + row) * SCALE, SCALE, SCALE);
      }
    }

    drawPF(G.screen);

    if (G.candyY < 64 && G.screen < ID.FOREST) {
      ctx.fillStyle = ntsc(0x4e);
      const cx = 16 + Math.round(G.candyX * (128 / 120));
      ctx.fillRect(cx * SCALE, (24 + G.candyY * 2) * SCALE, 4 * SCALE, 4 * SCALE);
    }
    if (G.hiddenPhoneY < 64) {
      ctx.fillStyle = ntsc(0x1e);
      const hx = 16 + Math.round(G.hiddenPhoneX * (128 / 120));
      ctx.fillRect(hx * SCALE, (24 + G.hiddenPhoneY * 2) * SCALE, 8 * SCALE, 4 * SCALE);
    }

    if (G.screen === ID.PIT && G.objInPit >= 0) {
      const id = G.objInPit & 0x0f;
      const s = window.ET_GFX.sprites;
      let spr = s.Flower_A3;
      if (id === OBJ.H) spr = s.H_PhonePiece_0;
      if (id === OBJ.S) spr = s.S_PhonePiece_0;
      if (id === OBJ.W) spr = s.W_PhonePiece_0;
      if (id === OBJ.FLOWER) {
        const fr = (G.flower >> 4) & 3;
        spr = s[`Flower_A${fr}`] || s.Flower_A0;
      }
      drawSprite(spr, 41, 50, ntsc(id === OBJ.FLOWER ? 0x3a : 0x2e));
    }

    const drawHuman = (h) => {
      if ((G.frame & 3) === 0) h.anim = (h.anim + 1) % 8;
      const col = h.id === 0 ? 0x0e : h.id === 1 ? 0x2a : 0x0e;
      drawSprite(humanSprite(h), h.x, h.y, ntsc(col), false, 2);
    };
    if (G.screen === ID.HOME) drawHuman(G.humans[1]);
    else if (G.currentObj >= 0 && G.currentObj <= 2 && G.humans[G.currentObj].screen === G.screen) {
      drawHuman(G.humans[G.currentObj]);
    }

    if (G.mothership & 0x80) {
      const sy = G.shipY & 255;
      if (sy < 64) drawSprite(window.ET_GFX.sprites.MotherShip, G.shipX, sy, (row) => ntsc(0x48 + (row & 6)), false, 2);
    }

    let etSpr = window.ET_GFX.sprites[`ETWalkSprite_A${G.et.anim}`];
    if (G.playerDead) etSpr = window.ET_GFX.sprites.ETDead_0;
    else if (G.et.neck & 0x80) {
      const n = Math.min(3, G.et.neck & 3);
      etSpr = window.ET_GFX.sprites[`ETExtensionSprite_A${n}`];
    }
    const ey = G.et.y & 255;
    if (ey < 64) drawSprite(etSpr, G.et.x, ey, (row) => ntsc(ET_COLORS[Math.min(row, ET_COLORS.length - 1)]));

    ctx.fillStyle = ntsc(0x9a);
    ctx.fillRect(0, 152 * SCALE, FIELD_W * SCALE, 40 * SCALE);
    drawDigit(G.heldCandy >> 4, 16, 168);
    if (G.screen === ID.HOME) {
      const s = G.score;
      const d5 = (s / 10000 | 0) % 10;
      const d4 = (s / 1000 | 0) % 10;
      const d3 = (s / 100 | 0) % 10;
      const d2 = (s / 10 | 0) % 10;
      const d1 = s % 10;
      drawDigit(d5, 48, 168);
      drawDigit(d4, 56, 168);
      drawDigit(d3, 64, 168);
      drawDigit(d2, 72, 168);
      drawDigit(d1, 80, 168);
    } else {
      drawBcdPair(G.energyHi, 48, 168);
      drawBcdPair(G.energyLo, 64, 168);
    }
  }

  function loop() {
    tick();
    draw();
    requestAnimationFrame(loop);
  }

  document.getElementById("startBtn").addEventListener("click", () => startRound(true));
  G.screen = ID.TITLE;
  requestAnimationFrame(loop);
})();
