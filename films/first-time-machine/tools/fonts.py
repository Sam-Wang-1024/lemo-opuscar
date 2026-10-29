"""Every font the page uses, fetched from Google Fonts (all SIL OFL 1.1) into fonts/, subset to the characters needed:
IBM Plex Mono 400/500 (identifiers, dates, readings), Inter 400/500/600 (labels, subtitles),
Libre Caslon Text 400 + italic 400 (the title and the quoted lines). Re-run after a text edit adds new glyphs. usage: python -I tools/fonts.py <film_dir>"""
import sys, os, re, urllib.request, urllib.parse
D = sys.argv[1]
os.makedirs(os.path.join(D, 'fonts'), exist_ok=True)
src = ''.join(open(os.path.join(D, f), encoding='utf-8').read() for f in ('film.js', 'timeline.js', 'film.data.json'))
extra = ''.join(sorted(set(c for c in src if ord(c) > 126)))
text = ''.join(chr(c) for c in range(32, 127)) + extra
print('extra glyphs:', extra)
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read()
for fam, spec, out in (('IBM Plex Mono', 'wght@400', 'PlexMono-400.woff2'), ('IBM Plex Mono', 'wght@500', 'PlexMono-500.woff2'),
                       ('Inter', 'wght@400', 'Inter-400.woff2'), ('Inter', 'wght@500', 'Inter-500.woff2'), ('Inter', 'wght@600', 'Inter-600.woff2'),
                       ('Libre Caslon Text', 'ital,wght@0,400', 'Caslon-400.woff2'), ('Libre Caslon Text', 'ital,wght@1,400', 'Caslon-400i.woff2')):
    css = get('https://fonts.googleapis.com/css2?family=' + urllib.parse.quote(fam) + ':' + spec + '&text=' + urllib.parse.quote(text)).decode()
    urls = re.findall(r'url\((https://[^)]+)\)', css)
    assert len(urls) == 1, css[:400]
    data = get(urls[0]); open(os.path.join(D, 'fonts', out), 'wb').write(data)
    print(out, len(data), 'bytes')
for fam in ('ibmplexmono', 'inter', 'librecaslontext'):
    open(os.path.join(D, 'fonts', f'OFL-{fam}.txt'), 'wb').write(get(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{fam}/OFL.txt'))
print('licence texts written')
