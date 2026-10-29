#!/bin/sh
# Scaffold a film that the Studio film editor (Mochi Studio → Video Editor → Films) can open, edit and rebuild.
# Writes into films/<name>/ only what is missing: timeline.js, film.data.json, studio.json and tools/
# (sync, export, frames, assets). See STUDIO.md for the contract the page, mix.py and build.sh must follow.
#   sh ext/studio/new-film.sh <name> [--lang en|zh] [--fps 24] [--title "Title"] [--style <slug>]
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
NAME=$1; [ -n "$NAME" ] || { echo "usage: sh ext/studio/new-film.sh <name> [--lang en|zh] [--fps 24] [--title T] [--style S]"; exit 2; }
case "$NAME" in *[!A-Za-z0-9._-]*|.*) echo "✗ name: letters, digits, . _ - only"; exit 2;; esac
shift; LANG_=en; FPS=24; TITLE=$NAME; STYLE=""
while [ $# -gt 0 ]; do case "$1" in
  --lang) LANG_=$2; shift 2;; --fps) FPS=$2; shift 2;; --title) TITLE=$2; shift 2;; --style) STYLE=$2; shift 2;;
  *) echo "unknown option $1"; exit 2;; esac; done
case "$LANG_" in en|zh) ;; *) echo "✗ --lang en or zh"; exit 2;; esac
F="$ROOT/films/$NAME"; T="$ROOT/ext/studio/template"
mkdir -p "$F/tools"
for f in timeline.js tools/sync.mjs tools/export.mjs tools/frames.mjs tools/assets.sh; do
  [ -e "$F/$f" ] || cp "$T/$f" "$F/$f"
done
chmod +x "$F/tools/assets.sh"

"$ROOT/.venv/bin/python" - "$F" "$NAME" "$LANG_" "$FPS" "$TITLE" "$STYLE" <<'PY'
import json, os, sys
F, name, lang, fps, title, style = sys.argv[1:]
fps = int(fps)
data = os.path.join(F, 'film.data.json')
if not os.path.exists(data):
    json.dump({"title": title, "style": style, "fps": fps, "bpm": 120, "dur": 30,
               "hit": {}, "voice": [], "subs": [], "texts": {},
               "mix": {"music": 0, "foley": 0, "beds": 0, "voice": 0, "mute": {}}, "sections": []},
              open(data, 'w'), indent=1, ensure_ascii=False)
man = os.path.join(F, 'studio.json')
if not os.path.exists(man):
    tts = (["$PY", "core/tts/tts_zh.py", "$FILM/voice/lines.json", "$FILM/voice/out"] if lang == 'zh'
           else ["$PY", "core/tts/tts.py", "$FILM/voice/lines.json", "$FILM/voice/out"])
    asr = ["$PY", "core/tts/asr_check.py", "$FILM/voice/lines.json", "$FILM/voice/out", "--lang", lang] + (["--model", "small.en"] if lang == 'en' else [])
    after_text = ["video", "master", "readcheck"]
    json.dump({
        "name": name, "output": f"{name}.mp4", "fps": fps, "data": "film.data.json",
        "stems": {s: f"out/stems/{s}.wav" for s in ("music", "foley", "beds", "voice")},
        "voice_dir": "voice/out",
        "steps": {
            "assets": [["sh", "$FILM/tools/assets.sh"]],
            "voice": [["$NODE", "$FILM/tools/sync.mjs", "$FILM"], tts, asr],
            "cues": [["$NODE", "$FILM/tools/export.mjs", "$FILM"], ["$PY", "core/render/srt.py", "$FILM/out/cues_srt.json", f"$FILM/{name}.srt"]],
            "events": [["$NODE", "core/render/events.mjs", "$FILM"]],
            "mix": [["$PY", "$FILM/mix.py"]],
            "video": [["$NODE", "core/render/video.mjs", "$FILM", "--fps", str(fps), "--workers", "4", "--out", "$FILM/out/video.mp4"]],
            "master": [["sh", "core/render/mux.sh", "$FILM/out/video.mp4", "$FILM/out/mix.wav", f"$FILM/{name}.mp4", str(fps), "1"]],
            "readcheck": [["$NODE", "core/render/readcheck.mjs", "$FILM"]],
        },
        "order": ["assets", "voice", "cues", "events", "mix", "video", "master", "readcheck"],
        "depends": {
            "hit": ["cues", "events", "mix", "video", "master", "readcheck"],
            "voice": ["voice", "cues", "events", "mix", "video", "master", "readcheck"],
            "voice_time": ["cues", "events", "mix", "video", "master", "readcheck"],
            "subs": ["cues", "video", "master"],
            "texts": after_text,
            "mix": ["mix", "master"],
            "sections": [],
            "title": [], "style": [],
            "bpm": ["cues", "events", "mix", "video", "master"],
            "dur": ["cues", "events", "mix", "video", "master"],
        },
    }, open(man, 'w'), indent=1)
PY
echo "films/$NAME is editable-ready: timeline.js, film.data.json, studio.json, tools/ — next: write index.html,"
echo "the page, mix.py and build.sh against them (STUDIO.md). A page that self-hosts subset fonts adds a"
echo "\"fonts\" step to studio.json (first-time-machine/studio.json has one) and lists it under depends.texts."
