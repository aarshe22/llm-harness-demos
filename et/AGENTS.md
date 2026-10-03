# AGENTS.md — E.T. 2600 JS remake

This file is the handoff contract for any model or human continuing this repo. Read it before changing gameplay, maps, or scoring.

## What this project is

A browser remake of Atari’s 1982 *E.T. the Extra-Terrestrial* (2600), meant to match the original rules and six-site world as closely as practical, plus a **movie world** with one 2600-style site per film sequence, plus a **3D cart view** (Three.js split first-person / chase) that must not fork `tick()`. It is not an emulator. Logic lives in JavaScript; graphics were extracted from the ROM via the labeled disassembly.

Designer: Howard Scott Warshaw. Artist: Jerome Domurat. NTSC 8K bankswitched cart.

## Sources of truth (in this order)

1. **Original ROM** in this folder: `E.T. the Extra-Terrestrial.A26` (8192 bytes).
   - MD5 `615a3bf251a38eb6638cdc7ffbde5480`
   - SHA1 `9e34f9ca51573c92918720f8a259b9449a0cd65e`
2. **1982 manual:** `E.T._The_Extra-Terrestrial_1982_Atari.pdf`
3. **Labeled 6502 source (Dennis Debro, 2006):** https://gist.github.com/tluyben/f8b19965eaab6d236f9b
   - If the gist is unavailable, fetch raw and keep a local copy as `reference/et.asm`. Do not treat blog posts or memory as equal to this file.
4. **This remake’s code:** `game.js` + `gfx.js` — implementation, not spec. When JS disagrees with the disassembly, fix JS (until a documented expansion level says otherwise).

Do not “simplify” energy, wrap tables, or human AI from Wikipedia. Copy constants and tables from the ASM.

## Layout

| Path | Role |
|------|------|
| `index.html` | Shell, World / Sequence / variation / difficulty UI |
| `style.css` | Page chrome only (not the 2600 look) |
| `game.js` | All simulation + 2D canvas draw (IIFE, no build step) |
| `view3d.js` | `window.ET_VIEW3D` — Three.js split view for world 2 (same `G` / `tick`) |
| `campaign.js` | `window.ET_CAMPAIGN` — 34 movie sites (playfields, items, win types) |
| `gfx.js` | `window.ET_GFX` playfields, sprites, 128-byte `powerZoneMap` |
| `pinokio.json` | Static-app metadata |
| `README.md` | Player-facing |
| `PLAN.md` | Roadmap and known gaps |
| `AGENTS.md` | This file |

No bundler, no tests yet, no `package.json`. Serve the folder (`python3 -m http.server`) or open `index.html`. Canvas is 640×768 (160×192 × 4).

## Coordinate system (must keep)

- World X: `0..119`. Wrap at `XMAX+1` (120). `x` going negative (255-style) wraps left.
- World Y: playfield kernel rows `0..63`. E.T. wrap when `y >= 59`. Signed wrap: `y < 128` is down, else up (matches 6502 `CMP #59` / `BPL`).
- Draw: TIA-like 160-wide field. Inner playfield maps `x` with `16 + x * (128/120)`. Each world Y is 2 canvas lines.
- Sprites: 8 pixels wide; E.T. walk is 9 ROM rows × 2 scanlines. Human/object heights follow ASM `H_* / 2` as ROM bytes, drawn at `rowScale` 2.
- Number fonts in `gfx.js` are stored kernel-down; `drawDigit` already flips rows. Other sprites are top-byte-first (game kernel `Y=0` at top).

## Screen IDs

```
0 FOUR_DIAMOND   1 EIGHT_PITS   2 ARROW_PITS   3 WIDE_DIAMOND
4 FOREST         5 DC           6 PIT          7 HOME         8 TITLE
9 CAMP           (movie world overlay only; do not reuse as a cart screen)
```

World 0 uses IDs 0–8 only. World 1 loads `campaign.js` scenes onto `ID.CAMP` and must not mutate wrap tables or PF for screens 0–5. World 2 is the same simulation as world 0, rendered by `view3d.js` (Three.js). Do not fork `tick()` for the 3D view.

**Graphics vs collision names are swapped in the ASM pointer table.** `PF_KEY` in `game.js` is the correct pairing:

- ID 0 uses `widePF*` graphics, four-diamond pit numbering (top/left/right/bottom).
- ID 3 uses `fourPF` graphics, 2×2 wide-diamond pit numbering (ids 12–15).

Wrap tables `LEFT_S/RIGHT_S/UP_S/DOWN_S` and companion X/Y tables must stay in lockstep. Topology:

- Pit screens 0–3 wrap east/west among themselves.
- Up from 0–3 → forest (4). Down from 0–3 → DC (5).
- Forest left/right → screens 3 and 1 with special spawn coords.
- DC left/right → screens 1 and 3. Forest down → arrow pits (2). DC up → four-diamond (0).

## Power zones

4×4 coarse grid from E.T. position (see `powerZoneAt` / ASM `DetermineCurrentPowerZone`). Pointer is `powerZoneLSBValues[screen>>1]` scrambled then `AND #$78` into `ET_GFX.powerZoneMap` (16 maps × 8 bytes).

Zone ids 0–12 match ASM. Call-ship only valid on `callHomeScreenId`. Landing only in forest. Find-phone not in forest. Call-Elliott blanked in forest.

Fire while **not moving** extends neck then `usePower()`. Fire **with** direction sets run. In a well, levitate is the pit-zone power (Fire; original also uses Fire+Up while levitating).

## Energy and score (BCD)

Two-byte BCD energy, max `$99$99` = 9999.

| Event | Delta |
|--------|--------|
| Walk step | −1 |
| Extra run step | −1 |
| Power / neck max | −19 |
| Fall to well bottom | −296 (`$02$69`) |
| Levitate (every 8 frames) | −1 |
| Eat candy | +360 (`$03$60`) |
| Elliott revive | +1500 (`$15$00`) |

Held candy is the **high nibble** of `heldCandy` (init `$0A` = 0 pieces). Max 9.

Score on HOME: remaining energy at frame 96, 490× held candy at 192, then 770 per candy given to Elliott, animated. After 31+ candy, next-round energy/score tables `NEXT_ENERGY` / `NEXT_SCORE`.

## Humans

Only one human on a screen. Attributes: D7 = return home, low nibble = 2600 joystick bits (`1=up,2=down,4=left,8=right`; `0x0f` = idle). `HUMAN_DIR[objectScreen*8 + currentScreen]` (or `+5` when returning home).

- Game 1: Elliott, FBI, Scientist
- Game 2: no scientist (`selection >= 2`)
- Game 3: no FBI (`selection >= 3`)
- Right difficulty A: human frame delay `$5D` (faster). B: `$3B`.
- Left difficulty A: Elliott blocks call/land. B: Elliott allowed.

FBI: steal one phone if E.T. has any, else clear candy to `$0A`. Scientist: carry until player **runs**. Elliott: give phone if he holds one; else take candy; 9 candy → he takes a remaining piece.

## Round start

`mothership = 0x84` (present, drop-off, not going-home). Ship Y 240 / E.T. Y 244 increment until ship height 32, then leave. Then forest play. Phone pits and zone LSBs seeded from `frame` / `second` and `RAND_INC`.

## Conventions for agents

- Keep `game.js` vanilla ES; no React/build unless the user asks.
- New movie beats go in `campaign.js` as another `scenes[]` entry (pf, pal, spawn, items, win). Do not fork `tick()` per scene.
- New cart-faithful levels should be **data** (playfield bytes, wrap edges, zone maps, spawn tables), not a fork of `tick()`.
- When matching the original, prefer literal ASM tables over “feel.”
- Do not commit unless the user asks. Do not destroy databases (N/A here).
- After any visible gameplay/UI change, verify in the browser: start, walk, wrap, fall in a well, levitate, HUD energy. A screenshot is not enough.
- Do not paste large copyrighted manual text into the repo; point at the PDF.
- `gfx.js` is generated-style data. If you re-extract from ASM, keep keys `pf.*`, `sprites.*`, `powerZoneMap`.

## How to re-extract graphics

Disassembly comments include `|XXXX....|` bitmaps. A Python scrape of `.byte $HH` from labels into `gfx.js` was used once (Wide/Eight/Arrow/Four/Forest/Washington/Pit/Home PF, sprites, icons, 128 power-zone bytes). Pit PF arrays are 64 rows indexed by world Y.

## Audio

Placeholder `beep()` via Web Audio. Original is TIA (channels, `ThemeMusicFrequencyTable`, walking/falling/levitate). Replacing beeps with closer TIA emulation is optional polish, not blocking for levels.
