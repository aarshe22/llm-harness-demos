# sgi — SGI demos re-implemented in three.js

Ports of every working demo from [sgi-demos.org](https://sgi-demos.org/browse/)
(the [sgi-demos](https://github.com/sgi-demos/sgi-demos) Emscripten project)
re-implemented from their C sources on top of [three.js](https://threejs.org).

Open `index.html` over any static server:

```
node server.js          # from the repo root, then
open http://localhost:4173/sgi/
```

## The demos

| Demo | What is authentic | How it is ported |
|---|---|---|
| `jello` | Spring list, integrator (dt .5 / dw .9 / damp .3 / fric .3), colours | Direct port of the `iterate()` loop; gouraud colours `(100c+30, 50c+15, 200c+50)`; halftone shadow texture |
| `logo` | Tube/elbow part construction, joint unfold 180°→90°, lavender material + two lights | Matrix-chain walk mirroring `draw_thing()`, geometry rebuilt per frame like the original |
| `bounce` | The six original `*.bin` models (parsed from the original big-endian fastobj format), ball bounce physics, room/light materials | Point-lights ride the balls; right-click pup menu toggles each light, freeze, object, and loads models |
| `ep-1988` | 4-mirror triangle-stream `drawit()` walk, LFO attract values, spectrum colormap | Ring buffer + `twixt/foldtwixt`; smear/fade via ping-pong render targets |
| `ep-1989` | **Tristram's mello script** (embedded verbatim) + trapezoidal oscillator engine from `epscript.c` | Same engine + script interpreter, one-for-one with `eps_trapezoid` / `eps_exprand` |
| `ep-1994` | HLS smooth-colour path, `M` look toggle | Same engine, colour model swapped to `hls_to_rgb` |
| `gview` | **The original Barcelona.gfo** radiosity model (2,676 Gouraud polygons) | ASCII GFO parser; fly-through / turntable with the binary's documented motion constants |
| `newave` | Spring force stencil from `getforce()`, `dt` per speed menu, colour ramp `191·dot+832`, grid 13/17/21 | Wave sim + editor (`edit → poke → go`), pup menus ported |
| `insect` | **All parts.c coordinate tables** (extracted via C transpile), `dolegs()` IK, `move_insect()` gait, Eclipse ramps | Face tables → BufferGeometry, software `getpolycolor` shading, projected shadow matrix |
| `ideas` | Light rig (white key, cool fill, dim under-light) and motion-track feel | Track-driven camera, assembling letters, lamp + SGI-logo stand-in |
| `flight-1988` | Flat-shaded colormap-era look, meters | Arcade flight model, facet-coloured terrain, HUD meters |
| `flight-1994` | **The original hills.grid terrain + hills.t texture**, fog, HUD, clock-based time of day, F1/F2/H/n-N keys | Grid parsed big-endian exactly as `read_grid()` does; per-vertex elevation |
| `arena` | First-person mech-combat-in-a-maze gameplay | Maze + flat colour-index-style walls, IK-less wandering mechs, tracers, explosions, shield HUD |
| `buttonfly` | Menu tree of `menus/m_demos` (Bounce models submenu, More Demos), purple-vs-blue semantics, bevelled button proportions | Buttons launch the ports in this folder — the launcher launches the demos |
| `cedit` | 10×10 UI frame, slider tracks at x=1/3/5, pick-with-LMB + `modmapcolor` semantics | Indexed test image through a live 256-entry DataTexture palette |
| `twilight` | **Identical star field**: drand48(0)-seeded, 2,500 + 200 stars, `star_color()` blend | JS re-implementation of drand48 (bit-exact), gradient shader from the two-quad blend |
| `performer-town` | webfly spirit: tour a fogged low-poly town | Instanced buildings on the classic Performer street grid, auto tour + free flight |

Shared helpers in `shared/sgi.js` (drand48, spectrum colormap, hls_to_rgb,
fastobj loader, pup menus, halftone texture); three.js vendored in `vendor/`
so every folder works on a plain static host.

## Keys per demo

Every demo shows its controls in the corner overlay; `esc` returns to the
gallery everywhere.

## Credits / provenance

Original sources studied from `github.com/sgi-demos/sgi-demos` (demo tapes /
Toolbox, authors cited in each HUD). Data files (`*.bin`, `Barcelona.gfo`,
`hills.grid`, `hills.t`) are the originals, redistributed as demo content.
This is a learning port, not affiliated with SGI/HPE.
