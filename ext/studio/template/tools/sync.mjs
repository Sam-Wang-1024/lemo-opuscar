// film.data.json -> voice/lines.json (the input of core/tts/tts.py and asr_check.py). Run before the voice step.
// usage: node tools/sync.mjs <film_dir>
import fs from 'fs'; import path from 'path';
const D = path.resolve(process.argv[2] || '.');
const data = JSON.parse(fs.readFileSync(path.join(D, 'film.data.json'), 'utf8'));
const lines = data.voice.map(v => ({ id: v.id, text: v.text, voice: v.voice, speed: v.speed, ...(v.asr ? { asr: v.asr } : {}) }));
fs.mkdirSync(path.join(D, 'voice'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(lines, null, 1));
console.log('voice/lines.json:', lines.length, 'lines');
