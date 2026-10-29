"""Score, foley, beds and voice for "Who Built the First Time Machine?" -> out/mix.wav (+ out/stems/*.wav).
Reads out/timeline.json (tools/export.mjs), events.json (core/render/events.mjs) and voice/out/*.wav.
Score: 72 BPM, D minor. One five-note motif (D F A G E): felt piano in 1895, glass harp in 1887, and in 1881 the
retrograde (E G A F D) played on bowed vibraphone and as reversed piano, the music running backward with the clock.
The verdict plays it forward again and lands on D major for "the name". Foley: ballast hum and a relay at the end,
the loupe on glass, paper for lit lines, reversed paper and year ticks on the glides back in time, a clock ticking
backward on The Sun. Beds: hum on the table, air inside the picture of the time ship."""
import sys, os, json
import numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, noise, bp, lp, hp, env_exp, t_, norm, compress, clack, whoosh, thump, brown, limit

TL = json.load(open(os.path.join(HERE, 'out', 'timeline.json')))
EVJ = json.load(open(os.path.join(HERE, 'events.json')))['ev']
HIT, BEAT, DUR = TL['hit'], TL['beat'], TL['dur']
N = int((DUR + 0.5) * SR)
S.seed(7)
st = lambda: np.zeros((N, 2), np.float32)
music, foley, beds, voice = st(), st(), st(), st()
b = lambda n: n * BEAT
tt = np.arange(N) / SR
def seg(t, a, c): return np.clip((t - a) / (c - a), 0, 1)
def fit(x): return x[:N] if len(x) >= N else np.pad(x, ((0, N - len(x)), (0, 0)))

MOTIF = ['D', 'F', 'A', 'G', 'E']
def mo(octv, rev=False): return [f'{n}{octv}' for n in (MOTIF[::-1] if rev else MOTIF)]

# ---------------- score ----------------
EV = []
def P(t, pitch, dur, vel, pan=0.0, inst='piano', gain=1.0): EV.append((t, inst, pitch, dur, vel, pan, gain))
def L(t, inst, pitch, dur, vel, pan=0.0, attack=.5, release=.8): EV.append(dict(t=t, inst=inst, pitch=pitch, dur=dur, vel=vel, pan=pan, attack=attack, release=release))

# A. 1895: felt piano, the motif with "An Invention", D minor -> B flat -> G minor
P(0.05, 'D2', 6.0, .34, -.1); P(0.05, 'A2', 6.0, .28, .1)
for i, n in enumerate(mo(4)): P(HIT['lineInv'] + i * b(1), n, b(1.6), .40 - .02 * i, .15 * (i % 2 * 2 - 1))
for p in ['D3', 'A3', 'F4']: P(HIT['lineTitle'], p, b(3), .34, 0)
for p in ['Bb2', 'F3', 'D4']: P(HIT['rise1'], p, b(3), .32, -.1)
L(HIT['rise1'], 'cellos', 'D3', HIT['back1'] - HIT['rise1'], .26, -.3, attack=1.2, release=.6)
for i, n in enumerate(['G3', 'Bb3', 'D4', 'F4']): P(HIT['line4d'] + i * b(0.5), n, b(1.5), .30, .1)
# B. 1887: glass harp motif an octave up, a bowed-vibraphone bed, cellos underneath
L(HIT['drop2'], 'vibraphone_bowed', 'A4', HIT['rise3'] - HIT['drop2'], .30, .2, attack=1.0, release=1.0)
L(HIT['dive2'], 'cellos', 'D3', HIT['rise3'] - HIT['dive2'], .30, -.3, attack=1.4, release=1.0)
for i, n in enumerate(mo(5)): P(HIT['lineAna'] + i * b(1), n, b(2), .48, .2 * (i % 2 * 2 - 1), 'glass', .8)
P(HIT['line1887'], 'A5', 2.5, .5, .3, 'glass', .7)
for i, n in enumerate(['D4', 'F4', 'A4', 'D5', 'F5', 'A5']): P(HIT['lineMont'] + i * b(0.5), n, b(1.2), .28 + .03 * i, .15 * (i % 2 * 2 - 1), 'harp', .8)
# into the picture: the ship rises on a swell of bowed metal and high strings
E = HIT['enter']
for pitch, inst, pan, v in [('F4', 'vibraphone_bowed', -.2, .40), ('D5', 'vibraphone_bowed', .2, .38), ('A4', 'violins', .3, .34), ('D5', 'violins', -.1, .30), ('F3', 'violas', -.3, .30)]:
    L(E - 0.6, inst, pitch, HIT['rise3'] - E + 0.6, v, pan, attack=1.2, release=1.0)
P(E, 'D6', 3.0, .45, .2, 'glass', .6)
# C. 1881: the retrograde. Bowed vibraphone E G A F D under the headline; a low drone for the hands
for i, n in enumerate(mo(4, True)): L(HIT['lineHead'] + i * b(1), 'vibraphone_bowed', n, b(1.4), .42, .2 * (i % 2 * 2 - 1), attack=.25, release=.6)
L(HIT['lineHands'] - 0.4, 'contrabass', 'D2', HIT['rise4'] - HIT['lineHands'] + 0.4, .36, 0, attack=1.0, release=1.2)
L(HIT['lineHands'] - 0.4, 'cellos', 'A2', HIT['rise4'] - HIT['lineHands'] + 0.4, .30, -.3, attack=1.4, release=1.2)
# D. the verdict: the motif forward again, one note per index row, then D major for "the name"
for i, n in enumerate(mo(4)): P(HIT['index'] + i * b(1), n, b(1.8), .34, .15 * (i % 2 * 2 - 1))
P(HIT['row1881'], 'D5', 2.0, .45, -.2, 'glass', .7); P(HIT['row1887'], 'A5', 2.0, .45, .2, 'glass', .7)
for p in ['D2', 'D3', 'A3', 'D4', 'F#4', 'A4', 'D5']: P(HIT['row1895'], p, 5.0, .46, 0)
for pitch, inst, pan, v in [('D3', 'cellos', -.3, .36), ('A3', 'violas', -.1, .32), ('F#4', 'violins', .25, .30), ('D5', 'violins', .1, .26), ('D2', 'contrabass', 0, .30)]:
    L(HIT['row1895'], inst, pitch, HIT['lightsOut'] - HIT['row1895'] + 0.3, v, pan, attack=.4, release=1.6)
P(HIT['row1895'], 'D6', 3.5, .45, -.2, 'glass', .7)
P(HIT['row1895'], 'F#5', 3.5, .36, .2, 'vibraphone', .7)

mus = fit(S.render(EV, dur=DUR + 0.5, master=False))
# the retrograde as a reversed piano: render the motif, flip it in time, so each note swells in and stops dead
REV = []
for i, n in enumerate(mo(4)): REV.append((i * b(1), 'piano', n, b(2.2), .46, .15 * (i % 2 * 2 - 1), 1.0))
rp = S.render(REV, dur=b(8), master=False)[::-1]
t_end = HIT['lineTime'] + b(1)                       # the reversed phrase ends exactly on the beat after the line lights
rp_full = np.zeros_like(mus); s0 = int((t_end - len(rp) / SR) * SR); rp_full[s0:s0 + len(rp)] = rp[:max(0, min(len(rp), N - s0))]
mus = mus + rp_full * .9
mus = S.room(mus, size=.6, mix=.24)
# silences: the two glides back in time and the breath before the lights go out
gate = np.ones(N)
for a, c in [(HIT['back1'] + 0.1, HIT['drop2'] - 0.02), (HIT['back2'] + 0.2, HIT['drop4'] - 0.02)]:
    gate *= 1 - (seg(tt, a, a + 0.5) * (1 - seg(tt, c, c + 0.01)))
music += (mus * gate[:, None]).astype(np.float32)

# ---------------- foley ----------------
def glass_tap(v=1.0, pitch=1.0):
    d = .5; x = clack(1.6 * pitch, v); x = np.pad(x, (0, int(d * SR) - len(x)))
    ring_ = sum(a * np.sin(2 * np.pi * f * pitch * t_(d)) * env_exp(d, tau) for f, a, tau in [(3150, .25, .09), (5230, .15, .05), (1870, .12, .12)])
    return norm(x * .8 + ring_ * .5) * v
def paper(d=.45, v=1.0):
    x = bp(noise(d), 1800, 7000) * np.sin(np.pi * np.linspace(0, 1, int(round(d * SR)))) ** 1.5
    return norm(x) * v
def rpaper(d=.9, v=1.0):                             # a paper slide played backward: it swells and stops
    x = bp(noise(d), 1500, 6500) * np.linspace(0, 1, int(round(d * SR))) ** 2.5
    x[-int(.004 * SR):] *= np.linspace(1, 0, int(.004 * SR))
    return norm(x) * v
def tick(v=1.0, f=2200):
    d = .05; x = bp(noise(d), 2500, 9000) * env_exp(d, .003) + np.sin(2 * np.pi * f * t_(d)) * env_exp(d, .006) * .4
    return norm(x) * v
def rclock(v=1.0):                                   # a clock tick with its envelope reversed: tick runs backward
    d = .09; x = (bp(noise(d), 1800, 6000) * .7 + np.sin(2 * np.pi * 1350 * t_(d)) * .3) * env_exp(d, .012)[::-1]
    return norm(x) * v
def pen(d=.34, v=1.0):
    x = bp(noise(d), 2500, 6500) * (1 + .5 * np.sin(2 * np.pi * 37 * t_(d))) * np.sin(np.pi * np.linspace(0, 1, int(round(d * SR)))) ** .6
    return norm(x) * v
def relay(v=1.0):
    return norm(np.concatenate([clack(.7, 1.0), np.zeros(int(.03 * SR)), clack(.9, .6)])) * v

for e in EVJ:
    t0 = e['t']
    if e['type'] == 'loupe': add(foley, glass_tap(1.0), t0 - 0.02, .6, .1)
    elif e['type'] == 'lift': add(foley, glass_tap(.45, 1.2), t0, .22, .1); add(foley, whoosh(.4, .6), t0, .22, -.2)
    elif e['type'] == 'line': add(foley, paper(1.0, .8), t0, .2, .25)
    elif e['type'] == 'tick': add(foley, tick(.9, 2000 + 25 * (e['year'] - 1880)), t0, .32, .3)
    elif e['type'] == 'ring': add(foley, glass_tap(.6, 1.5), t0, .25, .3)
    elif e['type'] == 'row': add(foley, tick(.7), t0 + 0.3, .25, .3)
    elif e['type'] == 'out': add(foley, relay(1.0), t0, .5, -.1)
for k in ('dive2', 'dive3', 'dive4'): add(foley, whoosh(.9, .7), HIT[k], .3, 0)
for k in ('rise1', 'rise2', 'rise3', 'rise4'): add(foley, whoosh(.7, .5), HIT[k], .22, .1)
# the glides back in time: reversed paper slides under the year ticks
for a, c in [(HIT['back1'], HIT['drop2']), (HIT['back2'], HIT['drop4'])]:
    for i, t0 in enumerate(np.arange(a + 0.2, c - 0.6, 0.85)): add(foley, rpaper(.8, .8), t0, .24, .3 * (i % 2 * 2 - 1))
# the pen under "the name"
add(foley, pen(.36, 1.0), HIT['row1895'] + 0.45, .32, -.2)
# a clock ticking backward under The Sun, one tick a beat, from the headline to the rise
for t0 in np.arange(HIT['lineHead'], HIT['rise4'], BEAT): add(foley, rclock(.8), t0 - 0.09, .2, -.25)

# ---------------- beds ----------------
hum = sum(a * np.sin(2 * np.pi * f * tt + p) for f, a, p in [(100, .5, 0), (200, .35, 1), (300, .2, 2), (400, .12, 3), (1200, .03, 0)])
hum = hum * (1 + .1 * np.sin(2 * np.pi * .7 * tt)) + bp(noise(DUR + .5)[:N], 3000, 8000) * .05
on = 1 - seg(tt, HIT['lightsOut'], HIT['lightsOut'] + 0.06)
inside = seg(tt, HIT['enter'] - 0.8, HIT['enter']) * (1 - seg(tt, HIT['rise3'], HIT['rise3'] + 0.8))
glides = np.maximum(seg(tt, HIT['back1'], HIT['back1'] + .4) * (1 - seg(tt, HIT['drop2'] - .3, HIT['drop2'])),
                    seg(tt, HIT['back2'], HIT['back2'] + .4) * (1 - seg(tt, HIT['drop4'] - .3, HIT['drop4'])))
hl = hum * on * (1 - .8 * inside) * (1 + .5 * glides)
beds[:, 0] += (hl * .05).astype(np.float32); beds[:, 1] += (hl * .05).astype(np.float32)
air = lp(brown(DUR + .5)[:N], 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.21 * tt + 1) ** 2)
aw = norm(air) * inside
beds[:, 0] += (aw * .18).astype(np.float32); beds[:, 1] += (np.roll(aw, 1100) * .18).astype(np.float32)

# ---------------- voice ----------------
for v in TL['voice']:
    x, sr = sf.read(os.path.join(HERE, 'voice', 'out', v['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR)
    x = compress(x / max(1e-6, np.abs(x).max()) * .9, thr=.22, ratio=3.0)
    x = hp(x, 70)
    add(voice, x.astype(np.float32), v['t'], 1.0, 0)

# ---------------- mix ----------------
def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
vo = voice.mean(1); env = np.convolve(np.abs(vo) > .02, np.ones(int(.25 * SR)) / (.25 * SR), 'same'); env = np.clip(env * 3, 0, 1)
duck = 1 - 0.45 * env
vr = rms(voice[np.abs(voice).max(1) > .01])
mr = rms(music[np.abs(music).max(1) > .005])
music *= (vr / mr) * 10 ** (-11 / 20)
music *= duck[:, None].astype(np.float32)
foley *= (vr / max(rms(foley[np.abs(foley).max(1) > .01]), 1e-6)) * 10 ** (-10 / 20)
beds *= (vr / max(rms(beds[np.abs(beds).max(1) > .002]), 1e-6)) * 10 ** (-24 / 20)
# the editor's stem gains (dB) and mutes, from film.data.json
MIXD = json.load(open(os.path.join(HERE, 'film.data.json'), encoding='utf-8')).get('mix', {})
for nm, x in (('music', music), ('foley', foley), ('beds', beds), ('voice', voice)):
    x *= 0.0 if MIXD.get('mute', {}).get(nm) else 10 ** (MIXD.get(nm, 0) / 20)
from scipy.signal import butter, sosfilt
hpf = butter(4, 38, 'high', fs=SR, output='sos')
for x in (music, foley, beds):
    x[:] = sosfilt(hpf, x, axis=0)
mix = music + foley + beds + voice
pk0 = np.abs(mix).max(); lvl = rms(mix)
ceil = min(pk0, lvl * 10 ** (11.5 / 20)) if pk0 > 0 else 1.0
mix = np.stack([limit(mix[:, 0], ceil), limit(mix[:, 1], ceil)], 1).astype(np.float32)
peak = max(float(np.abs(mix).max()), 1e-6); mix *= .89 / peak
os.makedirs(os.path.join(HERE, 'out', 'stems'), exist_ok=True)
for nm, x in (('music', music), ('foley', foley), ('beds', beds), ('voice', voice)): sf.write(os.path.join(HERE, 'out', 'stems', nm + '.wav'), (x / peak * .89).astype(np.float32), SR)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
print('mix written', round(len(mix) / SR, 2), 's; peak', round(float(peak), 3))
print('\n'.join(S.credits(sorted({e[1] if isinstance(e, tuple) else e['inst'] for e in EV} | {'piano'}))))
