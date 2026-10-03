# Godot HTML5 export

The gallery plays the Three.js prototype at `../index.html`.

This folder holds a **real Godot 4.3 Web (WASM) export** of the GDScript project. It does not replace the gallery demo.

Preset: Web, `variant/thread_support=false` (official `web_nothreads_release` template), `vram_texture_compression/for_mobile=false` (ETC2/ASTC is not imported, which previously made `--export-release Web` fail with an empty configuration-error string).

```bash
# Official 4.3 templates in ~/.local/share/godot/export_templates/4.3.stable/
./tools/export-web.sh   # overwrites glow/godot-html/index.* (keeps this README)
```
