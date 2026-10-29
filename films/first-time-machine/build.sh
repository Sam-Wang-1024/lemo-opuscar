#!/bin/sh
# One command: "Who Built the First Time Machine?" (Archive Light Table)
#   sh films/first-time-machine/build.sh          voice, checks, cues, picture, score + mix, master, subtitles, checks, poster
#   FETCH=1 sh films/first-time-machine/build.sh  first re-download the scans (~25 MB of pages) and fonts, rebuild textures
# Needs the library set up with `setup.sh deps voice music` and the salamander, vsco2ce, vcsl, freepats sample libraries.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$(cd "$HERE/../.." && pwd)}               # clone mode: <repo>/films/<name>/
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
NAME=first-time-machine
RAW="$HERE/assets/raw"
cd "$LIB"

[ -f core/tts/kokoro-v1.0.onnx ] || sh tools/fetch.sh voice
for l in salamander vsco2ce vcsl freepats; do [ -d "core/audio/instruments/$l" ] || sh tools/fetch.sh instruments $l; done

# fonts (Google Fonts, OFL)
if [ "${FETCH:-0}" = "1" ] || [ ! -f "$HERE/fonts/PlexMono-400.woff2" ]; then "$PY" -I "$HERE/tools/fonts.py" "$HERE"; fi

# archive scans (public domain) -> textures (skipped when present; FETCH=1 re-downloads)
sh "$HERE/tools/assets.sh"

# voice: Kokoro (af_heart), speech-to-text check; the lines come from film.data.json (the Studio editor writes it)
node "$HERE/tools/sync.mjs" "$HERE"
"$PY" core/tts/tts.py "$HERE/voice/lines.json" "$HERE/voice/out"
WHISPER_MODEL=small.en "$PY" core/tts/asr_check.py "$HERE/voice/lines.json" "$HERE/voice/out" --lang en
node "$HERE/tools/export.mjs" "$HERE" > /dev/null     # cues and timeline from the real durations; fails on overlap

# picture, events, score + mix, master, subtitles
node core/render/events.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"
"$PY" "$HERE/mix.py"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/$NAME.mp4" 24 1
"$PY" core/render/srt.py "$HERE/out/cues_srt.json" "$HERE/$NAME.srt"

# checks
node core/render/readcheck.mjs "$HERE" > "$HERE/out/readcheck.txt" && echo "readcheck ok"

# poster: inside the picture, the time ship rising
node core/render/still.mjs "$HERE" 27.6 --q 'nosubs=1' --prefix pf_ --out "$HERE/out" > /dev/null
cp "$HERE/out/pf_27.6.jpg" "$HERE/poster.jpg"
echo "done: $HERE/$NAME.mp4"
