#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OUT="trashblock.zip"

rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  background.js \
  popup.html \
  popup.css \
  popup.js \
  blocked.html \
  blocked.css \
  blocked.js \
  icons/

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
