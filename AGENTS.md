# Brickworld Builder

Brick-toy inspired Three.js sandbox game. No build step: static files + one npm dep (`three`), served by any static server.

## Run
- `npm run dev` (serves on http://127.0.0.1:8016), or any static server from the repo root.
- `index.html` uses an import map that points `three` at `node_modules` (no bundler).

## Structure
- `src/main.js` — the whole game: World (terrain, river, bridge, village, trees, hills), Player (AABB + step-up collision), Game (input, build/remove, collectibles, HUD, camera).
- Bricks snap to a 1-unit XZ grid. `World.solids` is the single AABB collider list; `World.surfaceTop()` backs both player gravity and build snapping.

## Deployment (demo.badlandscloud.com/game/)
- Plesk + Passenger run a Node gallery app (`server.js`). It scans top-level folders in
  `httpdocs/` and only serves folders with an `index.html` **directly inside** them.
  Deploy flat into `httpdocs/game/` (never `game/game/`), owned `demo1:psacln`, dirs 755 / files 644.
- Vendored runtime deps (no install step on the server): `index.html`, `src/`, and
  `node_modules/three/{package.json, build/three.module.js, build/three.core.js, examples/jsm/utils/BufferGeometryUtils.js}`.
  r186's `three.module.js` starts with `export * from './three.core.js'` — omitting it 404s at runtime.
  Always verify the deployed URL in a real browser; a local run with full `node_modules` will not catch it.
- The server's nested original copy is parked in `/tmp/game-old`.
- `demo.json` is intentionally absent: its `modelName`/`harness`/`totalTokens` fields are real
  gallery provenance. Add one manually if the card should show them.

## Gotchas
- `mergeGeometries` needs non-indexed geometry with normals deleted before merging (see `bake()`); empty part lists must short-circuit.
- Raycast face normals need `applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(...))` — `Vector3` has no `transformNormal`.
- Colliders that must never act as build supports (trees, bridge pieces, ground) are flagged `noSupport`.
- Bridge decks are walkable because their collider tops equal deck-surface height within the step tolerance (1.05).
- three r186: `PCFSoftShadowMap` was removed (use `PCFShadowMap`); `THREE.Clock` is deprecated but works.
- Renderer uses `preserveDrawingBuffer: true` so canvas pixel checks work in headless verification.
- No LEGO trademarks, logos, set names, or minifigure designs in UI or assets; generic "brick-toy" terms only.
