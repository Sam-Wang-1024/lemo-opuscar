// Render the film as an image sequence, like Blender's output: one file per frame, straight from the page
// (lossless PNG by default, no video compression, no mastering grain). Frame numbers are 0-based, matching the
// Studio editor's "f" counter: frame_0000.png is t = 0.
// usage: node tools/frames.mjs <film_dir> [--start F] [--end F] [--fps 24] [--format png|jpg] [--quality 95]
//                              [--workers 4] [--nosubs] [--out <dir>]      (--end is inclusive; default: the whole film)
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const LIB = process.env.LIB || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { openDemo, closeServer, requireDemo } = await import(pathToFileURL(path.join(LIB, 'core/render/page.mjs')).href);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(args[0] || '.');
requireDemo(dir);
const FPS = +opt('--fps', 24), FMT = opt('--format', 'png'), QUAL = +opt('--quality', 95), WK = Math.max(1, +opt('--workers', 4));
if (!['png', 'jpg'].includes(FMT)) { console.error('--format must be png or jpg'); process.exit(2); }
const q = args.includes('--nosubs') ? 'nosubs=1' : '';

const probe = await openDemo(dir, { q }); const DUR = await probe.page.evaluate(() => window.DUR); await probe.browser.close();
const last = Math.round(DUR * FPS) - 1;
const A = Math.max(0, Math.round(+opt('--start', 0))), B = Math.min(last, Math.round(+opt('--end', last)));
if (!(B >= A)) { console.error(`bad frame range ${A}..${B} (the film has frames 0..${last})`); process.exit(2); }
const d0 = new Date(), p2 = n => String(n).padStart(2, '0');   // local time, as the user reads it
const stamp = `${d0.getFullYear()}${p2(d0.getMonth() + 1)}${p2(d0.getDate())}-${p2(d0.getHours())}${p2(d0.getMinutes())}${p2(d0.getSeconds())}`;
const out = path.resolve(opt('--out', path.join(dir, 'frames', `${stamp}_${String(A).padStart(4, '0')}-${String(B).padStart(4, '0')}_${FMT}`)));
fs.mkdirSync(out, { recursive: true });
const pad = Math.max(4, String(last).length);
const N = B - A + 1, per = Math.ceil(N / WK), t0 = Date.now();
console.log(`frames ${A}..${B} (${N}) at ${FPS} fps as ${FMT.toUpperCase()} → ${out}`);

let stop = false;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop = true; });
await Promise.all([...Array(WK)].map(async (_, w) => {
  const a = A + w * per, b = Math.min(B + 1, a + per); if (a >= b) return;
  const { browser, page } = await openDemo(dir, { q });
  for (let f = a; f < b && !stop; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const file = path.join(out, `frame_${String(f).padStart(pad, '0')}.${FMT}`);
    await page.screenshot(FMT === 'png' ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: QUAL });
    if ((f - a) % 24 === 0 || f === b - 1) console.log(`w${w} ${f - a + 1}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
}));
closeServer();
if (stop) { console.error('stopped; the frames rendered so far are in ' + out); process.exit(1); }
fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ fps: FPS, start: A, end: B, count: N, format: FMT, subtitles: !q,
  pattern: `frame_%0${pad}d.${FMT}`, rendered: new Date().toISOString() }, null, 1));
console.log(`done ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}`);
