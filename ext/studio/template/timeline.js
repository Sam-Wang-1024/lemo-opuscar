// The film's single timeline. Everything editable lives in film.data.json (the Studio film editor writes it);
// this module loads it the same way in the browser and in Node, so the page, tools/export.mjs and mix.py
// (via out/timeline.json) all read one source. Never hard-code a time, line or on-screen text elsewhere.
const DATA = typeof window === 'undefined'
  ? JSON.parse((await import('fs')).readFileSync(new URL('./film.data.json', import.meta.url), 'utf8'))
  : await (await fetch(new URL('./film.data.json', import.meta.url), { cache: 'no-store' })).json();
export { DATA };
export const BPM = DATA.bpm, BEAT = 60 / BPM, DUR = DATA.dur;
export const b = n => +(n * BEAT).toFixed(4);          // beat -> seconds
export const HIT = DATA.hit;                           // key moments (seconds) — the page times everything from these
export const VOICE = DATA.voice;                       // narration lines; durations come from voice/out/dur.json
export const SUBS = DATA.subs;                         // subtitle cues, one line each (split long lines with `from`)
export const TX = DATA.texts;                          // every on-screen text, by card: TX.<card>[row]
export const MIX = DATA.mix;                           // stem gains (dB) and mutes, applied by mix.py
