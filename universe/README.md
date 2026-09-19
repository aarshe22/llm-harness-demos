# Voxel Cosmos — Hell · Earth · Heaven

A self-contained, fully procedural Three.js voxel universe: Dante's nine circles of
Hell, a living Earth, the Stairway to Heaven, and the Kingdom of Heaven — one
continuous vertical world you can explore, navigate, and ride through on an
automatic cinematic tour.

## Launch

**Double-click `index.html`.** That is all.

- Works directly from `file://` in current Chrome, Edge, and Firefox.
- No web server, no npm/Vite/Webpack, no build step, no internet connection.
- Three.js is vendored locally in `vendor/three.min.js` (classic non-module build);
  everything else — geometry, terrain, materials, shaders, sounds — is generated
  procedurally at load time with a fixed seed, so the same universe is built on
  every visit.

## What's inside

| Path | Contents |
| --- | --- |
| `index.html` | Launch page, UI overlay markup, classic `<script>` tags |
| `css/main.css` | Responsive UI (desktop / tablet / mobile) |
| `js/core.js` | Seeded RNG, easings, material registry, quality presets, boot sequencer |
| `js/shaders.js` | Procedural shaders: sky, water, lava, clouds, stars, energy |
| `js/timeofday.js` | Morning / Noon / Dusk / Night system with smooth transitions |
| `js/controls.js` | Orbit / zoom / pan + touch (no external OrbitControls needed) |
| `js/nav.js` | 42 destinations, collision-safe corridor camera flights |
| `js/builders.js` | Shared voxel builders (angels, souls, heads, buildings, props) |
| `js/merge.js` | Static-geometry merging for draw-call reduction |
| `js/actors.js` | Cerberus, Satan, dragons, animals, vehicles — hierarchical animated rigs |
| `js/hell.js` | Nine circles, Gates of Hell, Acheron/Charon, Minos, Dis, Cocytus… |
| `js/earth.js` | Terrain, rivers, waterfall, volcano, city, old town, farm, airport… |
| `js/stairway.js` | Luminous staircase, angels, ascending souls |
| `js/heaven.js` | Pearly Gates, Saint Peter, clouds, gardens, fountains, castle |
| `js/audio.js` | Web Audio ambience (realm crossfade, roars, bells) — opt-in |
| `js/tour.js` | Auto tour, Cerberus and Saint Peter gate rites |
| `js/ui.js` | Panels, POI navigator, captions, toggles, keyboard shortcuts |
| `vendor/three.min.js` | Vendored Three.js (classic script build) |
| `tools/` | Headless verification scripts (development only — not needed to run) |

## Keyboard shortcuts

| Key | Action | | Key | Action |
| --- | --- | --- | --- | --- |
| `1` `2` `3` | Jump to Hell / Earth / Heaven | | `G` | Start/stop auto tour |
| `[` `]` | Previous / next destination | | `N` | Skip tour stop |
| `Space` | Pause tour | | `T` `Y` `U` `I` | Morning / Noon / Dusk / Night |
| `L` | Toggle labels | | `R` | Reduced motion |
| `M` | Mute | | `F` | Fullscreen |
| `P` | Toggle side panel | | `H` / `?` | Help |

## Notes

- Sound starts only after you press **Sound** (browser autoplay policy).
- Quality selector (Low/Medium/High) adapts DPR, shadows, particle counts and
  populations; weak devices are auto-detected at boot.
- `tools/` and `package.json` exist only for the headless test harness
  (Playwright + SwiftShader) and are not required for the experience.
