#!/bin/sh
# Downloads and prepares everything the page reads that git doesn't hold (scans, footage, data -> textures).
# Must be idempotent: exit early when the prepared files exist; FETCH=1 forces a fresh download.
# The Studio film editor runs this as the "assets" step, so a fresh clone can build from the editor alone.
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd)
LIB=${LIB:-$(cd "$HERE/../.." && pwd)}
PY="$LIB/.venv/bin/python"
# Replace with this film's downloads, e.g.:
# if [ "${FETCH:-0}" != "1" ] && [ -f "$HERE/assets/tex/<last-texture>" ]; then echo "textures present"; exit 0; fi
# mkdir -p "$HERE/assets/raw" && curl -sSL -o "$HERE/assets/raw/<file>" "<url>"
# "$PY" -I "$HERE/tools/prep.py" "$HERE"
echo "no assets to fetch"
