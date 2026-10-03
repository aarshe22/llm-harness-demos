#!/usr/bin/env bash
# Export the Godot project to glow/godot-html/ (does not replace the gallery index.html).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-godot}"
if [[ ! -x "$(command -v "$GODOT")" ]]; then
  if [[ -x /tmp/godot-dl/Godot_v4.3-stable_linux.x86_64 ]]; then
    GODOT=/tmp/godot-dl/Godot_v4.3-stable_linux.x86_64
  fi
fi
OUT="$ROOT/godot-html"
mkdir -p "$OUT"
# Keep the human README; Godot overwrites index.html + engine files only.
echo "Exporting Web → $OUT/index.html with $GODOT"
"$GODOT" --headless --path "$ROOT" --export-release Web "$OUT/index.html"
echo "done"
