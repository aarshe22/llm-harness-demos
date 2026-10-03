# Godot HTML5 export

The gallery plays the Three.js prototype at `../index.html`.

This folder is the target for a Godot 4.3 **Web** export (`export_presets.cfg` → `godot-html/index.html`) so the GDScript project can be shipped as WASM without overwriting the gallery demo.

```bash
# Install Godot 4.3 export templates, then:
./tools/export-web.sh
```

Until templates are installed on the machine, `index.html` here is a launcher into the playable gallery prototype.
