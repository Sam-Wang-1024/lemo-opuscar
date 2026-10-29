#!/bin/sh
# The film's archive scans (public domain) -> the textures its page reads. Skipped when the textures exist;
# FETCH=1 downloads again. Used by build.sh and by the Studio film editor's "assets" step.
#   sh tools/assets.sh            (run from anywhere; LIB defaults to the library two folders up)
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd)
LIB=${LIB:-$(cd "$HERE/../.." && pwd)}
PY="$LIB/.venv/bin/python"
RAW="$HERE/assets/raw"
if [ "${FETCH:-0}" != "1" ] && [ -f "$HERE/assets/tex/g63_ship.png" ]; then echo "textures present"; exit 0; fi
mkdir -p "$RAW" && cd "$RAW"
IA=https://archive.org/download
# The Sun (New York), 18 Sept 1881, page 2 — Internet Archive nysun18810918, image 0001
curl -sSL -o sun.jp2 "$IA/nysun18810918/nysun18810918_jp2.zip/nysun18810918_jp2%2Fnysun18810918_0001.jp2"
ffmpeg -loglevel error -y -i sun.jp2 sun_1881-09-18_p2.png && rm sun.jp2
# Enrique Gaspar, El Anacronópete, Barcelona 1887 — Internet Archive gaspar-el-anacronopete-1887 (from HathiTrust uc1.$b65866)
G="$IA/gaspar-el-anacronopete-1887/Gaspar%20El%20Anacronopete_1887_jp2.zip/Gaspar%20El%20Anacronopete_1887_jp2%2FGaspar%20El%20Anacronopete_1887_"
for i in 0000 0006 0066; do curl -sSL -o g.jp2 "$G$i.jp2"; ffmpeg -loglevel error -y -i g.jp2 gaspar_1887_ia$i.png; rm g.jp2; done
# H. G. Wells, The Time Machine, London: Heinemann 1895 — Wikimedia Commons DjVu (from HathiTrust 001693893), pages 1, 7, 15
for p in 1 7 15; do
  U=$(curl -sS -A "LemoOpuscar/1.0" "https://commons.wikimedia.org/w/api.php?action=query&titles=File:The%20Time%20Machine%20(H.%20G.%20Wells,%20William%20Heinemann,%201895).djvu&prop=imageinfo&iiprop=url&iiurlparam=page$p-2089px&format=json" | "$PY" -c "import sys,json;print(list(json.load(sys.stdin)['query']['pages'].values())[0]['imageinfo'][0]['thumburl'])")
  curl -sSL -A "LemoOpuscar/1.0" -o "wells_1895_djvu$p.jpg" "$U"; sleep 1
done
cd "$LIB"
"$PY" -I "$HERE/tools/prep.py" "$HERE"
echo "textures ready"
