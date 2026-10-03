# PLAN.md — fidelity, then new levels

Status as of 2026-10-03. Original six-site game is **playable and structurally close**; it is **not** a cycle-accurate clone. User intent: lock behavior to the 2600 game, **then expand levels**.

## Phase A — Baseline (done)

- [x] Ingest ROM + 1982 PDF manual + Debro disassembly
- [x] Static canvas remake (`index.html` / `game.js` / `gfx.js`)
- [x] Title → mothership drop-off → forest
- [x] Six overworld screens + well interior + HOME scoring
- [x] Wrap tables, pit IDs, candy, three phone pieces, flower revive extra life
- [x] FBI / scientist / Elliott, variations 1–3, A/B switches in the HTML UI
- [x] Energy, run vs walk, powers, call-ship timer, landing / leave-without-E.T. paths
- [x] Browser smoke: title, start, forest, wrap to Washington, HUD 9999→drain

## Phase B — Close remaining original gaps

Do this **before** large new maps so expansions inherit correct rules. Check each item against `et.asm`, not against this list alone.

### Simulation

- [ ] Pixel-perfect well collision (hardware PF vs current 8×9 walk sprite test). Eight-pit overlap must yield `ID_PIT_OUT_OF_RANGE` and no object.
- [ ] Dual-graphic sprites (ASM `*_A` / `*_B` 2LK). Today many objects draw a single frame.
- [ ] Neck extend/descend timing (`frameCount & 3`, height table 10–13).
- [ ] Scientist carry: E.T. locks to scientist sprite; escape only when run flag set; FBI/Elliott sent home.
- [ ] FBI activation every 256 frames when inactive (`P1_NO_MOVE`), not only `frame === 0`.
- [ ] Candy respawn clock: `secondTimer & $0F == 0` and `frameCount & $3F == 23`.
- [ ] Hidden phone blink (`frameCount` ror ×3).
- [ ] Landing timer icon (`START_LANDING_TIMER` 63 NTSC; faster anim when `< 8`).
- [ ] Mothership pickup vs drop-off bit flags (`ET_GOING_HOME`, `MOTHERSHIP_LEAVING`) and color cycle.
- [ ] Game-select on title (original SELECT); RESET vs fire held (`fireResetStatus`).
- [ ] Easter eggs (Yar / Indy in flower pit, HSW initials at `$69`, artist initials) — optional, low priority.

### Presentation

- [ ] Status bar: telephone construction icon from collected H/S/W bits (not a generic glyph).
- [ ] Title: six-digit E.T. face graphic + copyright line (not just E/T letters).
- [ ] HOME: Elliott pacing 28–92, eat-candy open/close icon while 770s tally.
- [ ] NTSC palette: replace the rough `ntsc()` helper with a known 128-color 2600 table.
- [ ] Reflect humans when moving left (`HumanHorizReflectionTable`).
- [ ] Scanline/overscan framing closer to 2600 (optional CRT shader — do not let it hide gameplay bugs).

### Audio

- [ ] Theme on title / death / HOME (`ThemeMusicFrequencyTable`, note delay 11).
- [ ] Walk, run, fall, levitate, channel 0 SFX bytes from ASM.

### Code health (helps Phase C)

- [ ] Split `game.js` into modules or clear sections: `tables`, `sim`, `draw`, `input` without adding a bundler (or use ES modules + import map).
- [ ] `levels/` JSON or JS data file for screens so original IDs 0–5 stay frozen.
- [ ] Deterministic seed dump (frame/second at round start) for reproducing phone/flower/zone layouts.
- [ ] Minimal automated checks: wrap table lengths, PF 64 rows, zone map 128 bytes.

## Phase C — Expand levels (user’s next goal)

**Do not mutate screens 0–5** once B is “good enough.” Add new site IDs ≥ 9 (8 is TITLE) or a `worldId` wrapper: world 0 = original, world 1+ = expansions.

Suggested expansion contract:

1. Each site declares: `id`, `pf1`, `pf2`, `bg`/`pf` colors, `wrap` {N,S,E,W → screen + optional spawn x/y}, `pits` (collision recipe or PF-only), `candy` {x,y,bit}, `zoneMap` index or inline 8 bytes.
2. `callHomeScreenId` and landing site must exist in that world.
3. Still exactly three phone pieces unless a world explicitly sets `phoneCount`.
4. Humans: reuse AI; optionally add spawn buildings as extra DC-like rooms.
5. Keep energy economy unless the world sets `energyStart` / `fallCost` overrides.
6. UI: world/level select next to variation 1–3, default world 0 = authentic cart.

First expansion ideas (only after data-driven screens):

- Extra well layouts (copy four-diamond math, new PF art).
- A second forest with a different landing timer.
- A “night Washington” with tighter human `HUMAN_YMAX`.
- Multi-round campaign: beating HOME on world 0 unlocks world 1 without changing original scoring.

## Phase D — Polish / ship

- [ ] Touch/gamepad
- [ ] Pause without the well trick (manual suggested falling in as pause)
- [ ] README level-authoring notes
- [ ] Optional Pinokio launcher only if the user wants it under `PINOKIO_HOME` (do not invent a launcher in this workspace)

## Verification checklist (every gameplay PR)

1. Title: Fire/Reset starts drop-off, then forest.
2. Walk off each edge of screens 0–5; land on the ASM neighbor with the ASM spawn x/y.
3. Fall in a well, energy −296, Fire levitates, emerge on the same overworld cell (nudge L/R so you do not fall back in).
4. Collect candy (max 9), eat in eat-candy zone (+360).
5. Reveal phone with find-phone zone; pick up in the matching pit.
6. FBI contact with/without phones; scientist grab + run escape; Elliott 9-candy fetch.
7. Three pieces → call-ship (no illegal human) → timer → stand on forest landing.
8. HOME score: energy, 490s, 770s; Fire starts next round.
9. Variation 3: no FBI. Variation 2: no scientist. Difficulty A/B as labeled.
10. After **new** levels: original world 0 still passes 1–9.

## Out of scope unless asked

- Cycle-accurate TIA emulator
- PAL timing (`START_LANDING_TIMER = 57`, different frame delays)
- Shipping copyrighted ROM inside a public host (ROM stays local for extraction)
- Rewriting the game in an engine (Phaser, Unity, etc.)
