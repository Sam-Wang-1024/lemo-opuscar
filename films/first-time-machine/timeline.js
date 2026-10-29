// Who Built the First Time Machine? — the single timeline. Everything editable lives in film.data.json
// (written by the Studio film editor); this module loads it the same way in the browser and in Node, so film.js
// (picture), tools/export.mjs (voice cues, subtitles) and mix.py (via out/timeline.json) all read one source.
const DATA = typeof window === 'undefined'
  ? JSON.parse((await import('fs')).readFileSync(new URL('./film.data.json', import.meta.url), 'utf8'))
  : await (await fetch(new URL('./film.data.json', import.meta.url), { cache: 'no-store' })).json();
export { DATA };
export const BPM = DATA.bpm, BEAT = 60 / BPM, DUR = DATA.dur;
export const b = n => +(n * BEAT).toFixed(4);          // beat -> seconds
export const HIT = DATA.hit;                           // key actions (seconds), on the 72 BPM grid
export const VOICE = DATA.voice;                       // narration (Kokoro); t = start; durations from voice/out/dur.json
export const SUBS = DATA.subs;                         // one English line per cue (split long lines with `from`)
export const TX = DATA.texts;                          // every on-screen text, by card
export const MIX = DATA.mix;                           // stem gains (dB) and mutes for mix.py
