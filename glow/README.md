# GLOW

Endless night-forest survival as a tiny glowing white moth. There are no weapons. Brightness is both your lantern and your liability.

This folder contains:

1. **Godot 4.3 project** (`project.godot`) — the engine specified in the design plan. Open the folder in Godot 4.3+ and press Play.
2. **Browser prototype** (`index.html`) — same loop, playable in the demo gallery without the Godot editor.

## Godot

```bash
godot --path glow
godot --headless --path glow --script res://scripts/core/headless_test.gd
```

Controls: WASD fly, mouse look (altitude holds; no gravity sink), Space/Ctrl climb/descend, Shift boost, E or RMB dim, C camera, Esc pause, Alt+Enter fullscreen, F3 debug.

## Browser

Open `/glow/` from the gallery server, or `npx --yes serve glow`. Node tests: `node --test glow/tests/rules.test.mjs`.

Godot HTML5 export (does not replace the gallery `index.html`):

```bash
# Official 4.3 templates → ~/.local/share/godot/export_templates/4.3.stable/
./tools/export-web.sh   # writes real WASM to glow/godot-html/
```

The committed `glow/godot-html/index.wasm` is a Godot 4.3 **nothreads** release build. Re-export after GDScript changes.
