# Brickworld Builder

Brick-toy inspired Three.js sandbox game. No build step: static files + one npm dep (`three`), served by any static server.

## Run
- `npm run dev` (serves on http://127.0.0.1:8016), or any static server from the repo root.
- `index.html` uses an import map that points `three` at `node_modules` (no bundler).

## Structure
- `src/main.js` — the whole game: World (terrain, river, bridge, village, trees, hills), Player (AABB + step-up collision), Game (input, build/remove, collectibles, HUD, camera).
- Bricks snap to a 1-unit XZ grid. `World.solids` is the single AABB collider list; `World.surfaceTop()` backs both player gravity and build snapping.

## Gotchas
- `mergeGeometries` needs non-indexed geometry with normals deleted before merging (see `bake()`); empty part lists must short-circuit.
- Raycast face normals need `applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(...))` — `Vector3` has no `transformNormal`.
- Colliders that must never act as build supports (trees, bridge pieces, ground) are flagged `noSupport`.
- Bridge decks are walkable because their collider tops equal deck-surface height within the step tolerance (1.05).
- three r186: `PCFSoftShadowMap` was removed (use `PCFShadowMap`); `THREE.Clock` is deprecated but works.
- Renderer uses `preserveDrawingBuffer: true` so canvas pixel checks work in headless verification.
- No LEGO trademarks, logos, set names, or minifigure designs in UI or assets; generic "brick-toy" terms only.
