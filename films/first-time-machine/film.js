// Who Built the First Time Machine? — Archive Light Table. render(t) for the whole film.
// One continuous camera over one light table, travelling backward in time: 1895 (right) -> 1887 -> 1881 (left).
// World units: 250 per inch. Every item sits on the table with a centre, a rotation and a scale (texture px -> world).
// Picture: one WebGL2 fragment shader (table, backlit paper, the loupe, the picture space of page 63);
// marks, readings, the year counter, subtitles, the index and the end card on a 2D canvas above it.
import { HIT, DUR, TX } from './timeline.js';

const W = 1920, H = 1080;
const SIG = '#1f6bff', INK = '#15171a', PAPER = 'rgba(248,248,245,0.97)', DIMP = 'rgba(248,248,245,0.66)';

// ---------------- helpers ----------------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ss = x => x * x * (3 - 2 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, x) => a + (b - a) * x;
const lerp2 = (a, b, x) => [lerp(a[0], b[0], x), lerp(a[1], b[1], x)];
function track(keys) {                              // monotone cubic (Fritsch–Carlson), [t, v]
  const n = keys.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  for (let i = 0; i < n; i++) m.push(i === 0 || i === n - 1 ? 0 : (d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (t > keys[i + 1][0]) i++;
    const h = keys[i + 1][0] - keys[i][0], u = (t - keys[i][0]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * keys[i][1] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * keys[i + 1][1] + (u3 - u2) * h * m[i + 1];
  };
}
const track2 = keys => { const x = track(keys.map(k => [k[0], k[1][0]])), y = track(keys.map(k => [k[0], k[1][1]])); return t => [x(t), y(t)]; };
const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; };

// ---------------- the table ----------------
// c: centre (world), r: rotation (deg), k: world units per texture px, size: texture px. True sizes:
// The Sun 18.4 × 23.5 in; the 1887 book 4.6 × 7.5 in; the 1895 book 4.5 × 7.4 in.
const IT = {
  gc:  { tex: 'gaspar_cover.jpg', c: [1450, 2080], r: 7, k: 0.840, size: [1420, 2321] },
  gt:  { tex: 'gaspar_title.jpg', c: [1250, -450], r: 2.2, k: 0.4343, size: [2623, 4317] },
  g63: { tex: 'g63_bg.jpg', c: [2700, 480], r: -2.8, k: 0.406, size: [2863, 4619] },
  wc:  { tex: 'wells_cover.jpg', c: [4950, 2120], r: -6, k: 1.034, size: [1280, 1838] },
  wt:  { tex: 'wells_title.jpg', c: [4700, -350], r: -2, k: 0.878, size: [1280, 2108] },
  w3:  { tex: 'wells_p3.jpg', c: [6080, 560], r: 2.5, k: 0.640, size: [1920, 2893] },
  sun: { tex: 'sun.jpg', c: [-3300, 480], r: -1.2, k: 0.837, size: [5512, 7021] },
};
const ORDER = ['gc', 'gt', 'g63', 'wc', 'wt', 'w3', 'sun'];
const toW = (it, p) => { const o = rot([(p[0] - it.size[0] / 2) * it.k, (p[1] - it.size[1] / 2) * it.k], it.r * Math.PI / 180); return [it.c[0] + o[0], it.c[1] + o[1]]; };
const TABLE = [-6300, -3300, 7400, 3950];             // light panel (world)

// text lines that light up (texture px): [x0, y0, x1, y1]; a sentence is a list of lines lit one after another
const BANDS = {
  inv:   ['wt', [[338, 539, 619, 577]]],
  title: ['wt', [[197, 349, 764, 412]]],
  fourd: ['w3', [[940, 1961, 1328, 2022], [150, 2034, 1337, 2090], [150, 2116, 1326, 2172]]],
  ana:   ['gt', [[463, 1137, 2499, 1291]]],
  y1887: ['gt', [[1422, 3869, 1566, 3924]]],
  mont:  ['g63', [[714, 581, 2386, 666], [353, 682, 1095, 761]]],
  head:  ['sun', [[259, 318, 951, 352]]],
  hands: ['sun', [[262, 5479, 929, 5506], [236, 5514, 583, 5537]]],
  time:  ['sun', [[1013, 5944, 1664, 5969], [974, 5975, 1664, 6002], [972, 6010, 1228, 6032]]],
};
const BKEYS = Object.keys(BANDS);
const BT = { inv: HIT.lineInv, title: HIT.lineTitle, fourd: HIT.line4d, ana: HIT.lineAna, y1887: HIT.line1887 - 0.3, mont: HIT.lineMont, head: HIT.lineHead, hands: HIT.lineHands, time: HIT.lineTime };
const BDUR = { fourd: 2.2, mont: 1.6, hands: 1.5, time: 1.9 };
const litP = (k, t) => eio(seg(t, BT[k], BT[k] + (BDUR[k] || 0.9)));
// the paper dims around a lit line while it is read
const DIMS = {
  wt: t => ss(seg(t, HIT.lineInv - 0.4, HIT.lineInv + 0.3)) * (1 - ss(seg(t, HIT.rise1, HIT.lift1))),
  w3: t => ss(seg(t, HIT.line4d - 0.4, HIT.line4d + 0.3)) * (1 - ss(seg(t, HIT.back1, HIT.back1 + 0.6))),
  gt: t => ss(seg(t, HIT.lineAna - 0.4, HIT.lineAna + 0.3)) * (1 - ss(seg(t, HIT.rise2, HIT.rise2 + 0.6))),
  g63: t => ss(seg(t, HIT.lineMont - 0.4, HIT.lineMont + 0.3)) * (1 - ss(seg(t, HIT.enter - 1.0, HIT.enter - 0.2))),
  sun: t => ss(seg(t, HIT.lineHead - 0.4, HIT.lineHead + 0.3)) * (1 - ss(seg(t, HIT.rise4, HIT.rise4 + 0.6))),
};

// page 63: the picture space. Rows below the horizon come nearer; the ship is its own layer on the focus plane
const G63_HZ = 2830, G63_NEAR = 3220;
const SHIP = [1262, 2248, 1418, 2368];

// ---------------- camera ----------------
const LENS_RW = 350, MAG = 2.5;                       // a 2.8 in loupe at 2.5×
const L1W = toW(IT.wt, [480, 470]);
const W3L = toW(IT.w3, [740, 2066]);
const L2W = toW(IT.gt, [1460, 2350]);
const L3W = toW(IT.g63, [1400, 1500]);
const L4W = toW(IT.sun, [640, 560]);
const TABLE_C = [560, 330];
const D1L = L1W, PUSH = 3.4;
const CAM = [
  // t, centre, zoom, rotation (deg)
  [0.0, L1W, PUSH, 2.0],
  [HIT.rise1, L1W, PUSH, 2.0],
  [HIT.lift1, [L1W[0] + 260, L1W[1] + 120], 0.40, 1.0],
  [HIT.line4d - 0.6, [W3L[0] - 60, W3L[1] - 20], 0.88, -2.5],
  [HIT.back1, [W3L[0] + 40, W3L[1] - 10], 1.02, -2.5],
  [HIT.back1 + 1.3, [3300, 250], 0.165, 0],
  [HIT.drop2 - 0.4, [L2W[0] + 90, L2W[1] - 80], 0.36, -1.5],
  [HIT.dive2, L2W, 0.38, -2.2],
  [HIT.dive2 + 1.0, L2W, PUSH, -2.2],
  [HIT.rise2, L2W, PUSH, -2.2],
  [HIT.drop3 - 0.15, [L3W[0] - 70, L3W[1] + 60], 0.40, 1.5],
  [HIT.dive3, L3W, 0.42, 2.8],
  [HIT.dive3 + 1.0, L3W, PUSH, 2.8],
  [HIT.rise3, L3W, PUSH, 2.8],
  [HIT.back2, [L3W[0] - 250, L3W[1] - 100], 0.36, 1.5],
  [HIT.back2 + 1.4, [-900, 150], 0.15, 0],
  [HIT.drop4 - 0.3, [L4W[0] + 120, L4W[1] + 100], 0.46, 0.6],
  [HIT.dive4, L4W, 0.48, 1.2],
  [HIT.dive4 + 1.0, L4W, PUSH, 1.2],
  [HIT.rise4, L4W, PUSH, 1.2],
  [HIT.rise4 + 1.25, [L4W[0] + 2400, L4W[1] + 400], 0.24, 0.5],
  [HIT.index + 0.8, [4990, 1880], 0.078, 0],          // the table on the left half, the index on the right
  [DUR, [4900, 1860], 0.0765, 0],
];
const camC = track2(CAM.map(k => [k[0], k[1]]));
const camLZ = track(CAM.map(k => [k[0], Math.log(k[2])]));
const camR = track(CAM.map(k => [k[0], k[3]]));
const camAt = t => ({ c: camC(t), z: Math.exp(camLZ(t)), th: camR(t) * Math.PI / 180 });
function w2s(w, cam) { const d = rot([(w[0] - cam.c[0]) * cam.z, (w[1] - cam.c[1]) * cam.z], cam.th); return [W / 2 + d[0], H / 2 + d[1]]; }

// ---------------- the four dives ----------------
// each dive: where the loupe sits, when it lands / lifts, and the inside of the lens (S: screen px per world unit,
// ic: world point at the lens centre) as tracks that start and end at the physical loupe (S = zoom × 2.5)
const phys = (t, lw) => ({ S: camAt(t).z * MAG, ic: lw });
function dive(lw, tDrop, tLift, keysS, keysC) {
  const s0 = phys(tDrop, lw), s1 = phys(tLift, lw);
  return { lw, tDrop, tLift, S: track([[tDrop, s0.S], ...keysS, [tLift, s1.S]]), C: track2([[tDrop, lw], ...keysC, [tLift, lw]]) };
}
const P = (k, p) => toW(IT[k], p);
const D1 = dive(D1L, -1, HIT.lift1,
  [[0, 1.85], [HIT.widen, 1.85], [HIT.widen + 0.9, 1.12], [HIT.rise1, 1.12]],
  [[0, P('wt', [478, 562])], [HIT.widen, P('wt', [478, 562])], [HIT.widen + 0.9, P('wt', [480, 470])], [HIT.rise1, P('wt', [480, 470])]]);
const D2 = dive(L2W, HIT.drop2, HIT.rise2 + 0.6,
  [[HIT.dive2, 0.95], [HIT.dive2 + 0.85, 1.55], [HIT.line1887 - 0.9, 1.5], [HIT.line1887 - 0.2, 1.9], [HIT.rise2, 1.9]],
  [[HIT.dive2, L2W], [HIT.dive2 + 0.85, P('gt', [1480, 1225])], [HIT.line1887 - 0.9, P('gt', [1480, 1260])], [HIT.line1887 - 0.2, P('gt', [1494, 3780])], [HIT.rise2, P('gt', [1494, 3760])]]);
const D3 = dive(L3W, HIT.drop3, HIT.rise3 + 0.6,
  [[HIT.dive3, 1.05], [HIT.dive3 + 0.85, 1.62], [HIT.enter - 0.9, 1.62], [HIT.enter, 2.05], [HIT.rise3, 2.15]],
  [[HIT.dive3, L3W], [HIT.dive3 + 0.85, P('g63', [1380, 700])], [HIT.enter - 0.9, P('g63', [1390, 705])], [HIT.enter, P('g63', [1350, 2640])], [HIT.rise3, P('g63', [1350, 2600])]]);
const HANDS_C = P('sun', [600, 5508]), TIME_C = P('sun', [1318, 5990]);
const D4 = dive(L4W, HIT.drop4, HIT.rise4 + 0.6,
  [[HIT.dive4, 1.2], [HIT.dive4 + 0.85, 1.75], [HIT.trackHands, 1.75], [HIT.trackHands + 1.25, 0.62], [HIT.lineHands - 0.3, 1.75], [HIT.trackTime, 1.75], [HIT.lineTime - 0.2, 1.75], [HIT.rise4, 1.6]],
  [[HIT.dive4, L4W], [HIT.dive4 + 0.85, P('sun', [605, 336])], [HIT.trackHands, P('sun', [605, 336])], [HIT.trackHands + 1.25, P('sun', [620, 2900])], [HIT.lineHands - 0.3, HANDS_C], [HIT.trackTime, HANDS_C], [HIT.lineTime - 0.2, TIME_C], [HIT.rise4, TIME_C]]);
const DIVES = [D1, D2, D3, D4];

function shot(t) {
  const cam = camAt(t);
  let dv = null; for (const d of DIVES) if (t >= d.tDrop - 0.4 && t <= d.tLift + 0.4) dv = d;
  const st = { cam, t, on: 0, A: 0, lift: 1, ls: [0, 0], R: 0, S: 1, ic: [0, 0], k: 0.16, enter: 0, sh: [0, 0], dz: 0, ship: [0, 0], shipK: 1, dive: dv };
  if (dv) {
    const inn = seg(t, dv.tDrop - 0.4, dv.tDrop), out = seg(t, dv.tLift, dv.tLift + 0.4);
    st.on = 1; st.A = eo(inn) * (1 - ss(out)); st.lift = 1 + 0.35 * (1 - eo(inn)) + 0.35 * eo(out);
    st.ls = w2s(dv.lw, cam); st.R = LENS_RW * cam.z * st.lift;
    const tt = clamp(t, dv.tDrop, dv.tLift);
    st.S = dv.S(tt); st.ic = dv.C(tt);
    if (t < dv.tDrop || t > dv.tLift) st.S = cam.z * MAG * st.lift;
    // the lens distortion relaxes once we are inside and returns as we rise
    const t0 = dv === D1 ? -1 : dv.tDrop + 0.5, t1 = dv === D1 ? 0 : dv.tDrop + 1.4;
    st.k = 0.16 * (1 - ss(seg(t, t0, t1))) + 0.16 * ss(seg(t, dv.tLift - 1.0, dv.tLift));
  }
  if (dv === D3) {                                    // into the picture: depth, a dolly, and the ship rising
    st.enter = ss(seg(t, HIT.enter - 0.8, HIT.enter)) * (1 - ss(seg(t, HIT.rise3, HIT.rise3 + 0.8)));
    const p = ss(seg(t, HIT.enter - 0.5, HIT.rise3 + 0.4));
    st.sh = [-60 * p, 150 * p]; st.dz = 0.42 * p;
    const f = eio(seg(t, HIT.enter - 0.3, HIT.rise3 + 0.5));
    st.ship = [10 * f, -78 * f]; st.shipK = 1 - 0.12 * f;          // texture px
  }
  return st;
}
// inside the lens: world point (with its nearness n in the picture space) -> screen
function int2s(w, n, st) {
  const sc = 1 + st.dz * st.enter * n;
  const q = [((w[0] - st.ic[0]) * sc + st.sh[0] * st.enter * n) * st.S, ((w[1] - st.ic[1]) * sc + st.sh[1] * st.enter * n) * st.S];
  const r = rot(q, st.cam.th); return [st.ls[0] + r[0], st.ls[1] + r[1]];
}
const inLens = (st, dv) => st.dive === dv && st.A > 0.5;
// a world point on screen, through the lens when the lens is on it
const at = (st, w, dv) => inLens(st, dv) && st.t >= dv.tDrop && st.t <= dv.tLift ? int2s(w, 0, st) : w2s(w, st.cam);

// ---------------- WebGL ----------------
const cv = document.getElementById('gl');
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
const ov = document.getElementById('ov').getContext('2d');
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const f1 = v => (+v).toFixed(2);
const bandCode = k => {                               // GLSL expression: how lit this pixel of the item is
  const [, lines] = BANDS[k], i = BKEYS.indexOf(k), n = lines.length;
  return lines.map((b, j) => `band(px, vec4(${b.map(f1).join(',')}), clamp(uLit[${i}]*${n}.-${j}., 0., 1.), ${Math.max(10, (b[3] - b[1]) * 0.35).toFixed(1)})`).reduce((a, s) => a ? `max(${a}, ${s})` : s, '');
};
const itemCode = () => ORDER.map((k, i) => {
  const bs = BKEYS.filter(b => BANDS[b][0] === k).map(bandCode);
  const lit = bs.length ? bs.reduce((a, s) => a ? `max(${a}, ${s})` : s, '') : '0.';
  const col = k === 'sun' ? `vec3(tg(t_${k}, u, fp/uIt[${i}].w).r)*vec3(1.0, 0.985, 0.955)` : (k === 'g63' ? 'g63(w, u, fp, interior)' : `tg(t_${k}, u, fp/uIt[${i}].w).rgb`);
  return `  u = itemUV(uIt[${i}], t_${k}, w);
  if (inside(u)){ vec2 px = u*vec2(textureSize(t_${k}, 0)); col = paper(L, ${col}, ${lit}, uDim[${i}]); edge = max(edge, rim(u, t_${k})); }`;
}).join('\n');
const FS = `#version 300 es
precision highp float;
uniform sampler2D ${ORDER.map(k => 't_' + k).join(', ')}, t_ship;
uniform vec4 uIt[${ORDER.length}];                  // centre.xy, rotation (rad), world per texel
uniform float uLit[${BKEYS.length}], uDim[${ORDER.length}];
uniform vec2 uCam; uniform float uZ, uRot, uT, uLight, uGlow;
uniform vec2 uLensC; uniform float uLensR, uLensOn, uLensA, uLift;
uniform vec2 uIntC; uniform float uS, uK, uEnter, uDz, uShipK;
uniform vec2 uSh, uShip;
uniform vec4 uGlowBox;
out vec4 o;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
vec2 rot(vec2 v, float a){ float c=cos(a), s=sin(a); return vec2(c*v.x-s*v.y, s*v.x+c*v.y); }
vec4 tg(sampler2D t, vec2 uv, float fpx){ vec2 sz = vec2(textureSize(t, 0)); vec2 f = vec2(fpx)/sz; return textureGrad(t, uv, vec2(f.x, 0.), vec2(0., f.y)); }
vec2 itemUV(vec4 it, sampler2D t, vec2 w){ vec2 sz = vec2(textureSize(t, 0)); return (rot(w - it.xy, -it.z)/it.w + sz*0.5)/sz; }
bool inside(vec2 uv){ return uv.x > 0. && uv.y > 0. && uv.x < 1. && uv.y < 1.; }
float rim(vec2 u, sampler2D t){ vec2 sz = vec2(textureSize(t, 0)); vec2 d = min(u, 1. - u)*sz; return 1. - smoothstep(0., 22., min(d.x, d.y)); }
float band(vec2 px, vec4 b, float p, float fe){                 // a text line lit left to right up to progress p
  float ex = smoothstep(b.x - 30., b.x + 10., px.x) * (1. - smoothstep(mix(b.x, b.z, p) - 10., mix(b.x, b.z, p) + 40., px.x));
  float ey = smoothstep(b.y - fe, b.y + fe*0.33, px.y) * (1. - smoothstep(b.w - fe*0.33, b.w + fe, px.y));
  return ex * ey * step(0.001, p);
}
vec3 lightTable(vec2 w){
  vec2 lo = vec2(${TABLE[0]}., ${TABLE[1]}.), hi = vec2(${TABLE[2]}., ${TABLE[3]}.);
  vec2 d = min(w - lo, hi - w); float e = min(d.x, d.y);
  vec2 cd = (w - vec2(${TABLE_C[0]}., ${TABLE_C[1]}.)) / vec2(9500., 6000.);
  float L = (1. - 0.12*dot(cd, cd)) + (vn(w*0.04) - 0.5)*0.010 + (vn(w*0.006) - 0.5)*0.012;
  vec2 gb = max(max(uGlowBox.xy - w, w - uGlowBox.zw), 0.);
  float glow = uGlow * exp(-dot(gb, gb)/(2.*160.*160.));
  float on = max(uLight, glow);
  vec3 lit = vec3(0.966, 0.975, 0.988)*L*on + vec3(0.032, 0.034, 0.038)*(1. - on);
  vec3 frame = (vec3(0.33, 0.34, 0.35) + 0.05*vn(vec2(w.x*0.006, w.y*1.2)) - 0.14*smoothstep(0., 90., e + 90.))*(0.35 + 0.65*uLight);
  vec3 desk = vec3(0.050, 0.053, 0.058) + 0.012*vn(w*0.009);
  return e > 0. ? lit : (e > -90. ? frame : desk);
}
vec3 paper(vec3 L, vec3 tex, float lit, float dim){
  vec3 base = L * tex * 1.03 + vec3(0.02)*(1. - uLight);
  vec3 ink = L * pow(tex, vec3(1.7)) * 1.16;
  return mix(base * mix(1., 0.74, dim), ink, lit);
}
// page 63 of El Anacronópete; in its picture space the rows below the horizon come nearer and the ship rises
vec3 g63(vec2 w, vec2 u, float fp, bool interior){
  vec4 it = uIt[${ORDER.indexOf('g63')}];
  if (!(interior && uEnter > 0.)) return tg(t_g63, u, fp/it.w).rrr;
  vec2 sz = vec2(textureSize(t_g63, 0));
  vec2 d = w - uIntC, p = w;
  for (int i=0;i<4;i++){
    float py = itemUV(it, t_g63, p).y*sz.y;
    float n = clamp((py - ${G63_HZ}.)/${G63_NEAR - G63_HZ}., 0., 1.);
    p = uIntC + (d - uSh*uEnter*n) / (1. + uDz*uEnter*n);
  }
  vec2 pu = itemUV(it, t_g63, p);
  float v = tg(t_g63, pu, fp/it.w).r;
  // the ship: its own layer, on the far plane, drifting up and away
  vec2 spx = itemUV(it, t_g63, w)*sz - uShip*uEnter;
  vec2 c0 = vec2(${(SHIP[0] + SHIP[2]) / 2}., ${(SHIP[1] + SHIP[3]) / 2}.);
  vec2 su = ((spx - c0)/uShipK + c0 - vec2(${SHIP[0]}., ${SHIP[1]}.)) / vec2(${SHIP[2] - SHIP[0]}., ${SHIP[3] - SHIP[1]}.);
  if (inside(su)){ vec2 la = tg(t_ship, su, fp/it.w/uShipK).ra; v = mix(v, la.x, la.y*uEnter); }
  // the sky breathes a little
  v += uEnter*0.025*(vn(p*vec2(0.004, 0.02) + vec2(uT*0.25, 0.)) - 0.5);
  return vec3(v);
}
float speck(vec2 p, float cell, float thr){
  vec2 g = floor(p/cell), f = p/cell - g;
  if (h21(g) < thr) return 0.;
  vec2 c = vec2(.2) + .6*vec2(h21(g+3.1), h21(g+7.7)); float r = .05 + .12*h21(g+1.3);
  return smoothstep(r, r*.35, length(f - c));
}
vec3 scene(vec2 w, bool interior, float fp){
  vec3 L = lightTable(w), col = L; vec2 u; float edge = 0.;
${itemCode()}
  col *= 1. - 0.10*edge;                              // paper edges catch a little shadow
  float dd = speck(w, 26., 0.955)*0.5 + speck(w + 31., 7., 0.975)*0.35;
  col *= 1. - dd*(interior ? (1. - uEnter) : 0.8)*0.55;
  return col;
}
void main(){
  vec2 s = vec2(gl_FragCoord.x, 1080. - gl_FragCoord.y);
  vec2 w = uCam + rot(s - vec2(960., 540.), -uRot) / uZ;
  vec2 dl = s - uLensC; float r = length(dl), rho = r / max(uLensR, 1.);
  vec3 table = scene(w, false, 1. / uZ);
  vec3 col = table;
  if (uLensOn > .5){
    vec2 sd = s - (uLensC + vec2(26., 34.)*(uLift - 1.)*uLensR/120.);
    float sr = length(sd)/uLensR;
    vec3 under = table * (1. - 0.22*(uLift - 1.)/0.35*uLensA*smoothstep(1.55, 1.05, sr));
    vec3 lc;
    if (rho < 1.0){
      vec3 c3;
      for (int i=0;i<3;i++){
        float k = uK*(1. + float(i-1)*0.10);
        vec2 q = dl / (1. + k*rho*rho) * (1. - float(i-1)*0.004*uK/0.16);
        vec2 wi = uIntC + rot(q, -uRot) / uS;
        c3[i] = scene(wi, true, 1. / uS)[i];
      }
      lc = c3;
      lc *= 1. - 0.30*smoothstep(0.78, 1.0, rho)*(1. - uEnter);
      vec2 hp = dl/uLensR - vec2(-0.38, -0.46); lc += vec3(0.06)*exp(-dot(hp,hp)*7.)*(1. - uEnter);
      vec2 hp2 = dl/uLensR - vec2(0.42, 0.50); lc += vec3(0.025)*exp(-dot(hp2,hp2)*14.)*(1. - uEnter);
    } else if (rho < 1.065){
      float u = (rho - 1.0)/0.065; vec2 nd = dl / max(r, 1.);
      float lit = max(0., dot(nd, normalize(vec2(-0.55, -0.83))));
      float bev = exp(-pow((u - 0.18)/0.09, 2.))*0.9 + exp(-pow((u - 0.85)/0.07, 2.))*0.5;
      lc = vec3(0.040, 0.042, 0.046) + vec3(0.62, 0.64, 0.66)*pow(lit, 5.)*bev + 0.05*bev + vn(vec2(atan(dl.y, dl.x)*180., u*4.))*0.02;
    } else if (rho < 1.30){
      float u = (rho - 1.065)/0.235;
      vec2 s2 = uLensC + dl*(0.955 + 0.045*u);
      vec2 w2 = uCam + rot(s2 - vec2(960., 540.), -uRot) / uZ;
      lc = scene(w2, false, 1. / uZ)*0.93 + 0.035*uLight;
      lc *= 1. - 0.45*exp(-pow(u/0.05, 2.));
      lc += vec3(0.20, 0.21, 0.22)*exp(-pow((u - 0.93)/0.035, 2.))*uLight;
      lc *= 1. - 0.25*exp(-pow((u - 1.0)/0.015, 2.));
    } else {
      lc = under * (1. - (0.07*exp(-pow((rho - 1.31)/0.05, 2.)) + 0.03*exp(-pow((rho - 1.3)/0.25, 2.)))*(2. - uLift));
    }
    col = mix(under, lc, uLensA);
  }
  vec2 sv = (s - vec2(960., 540.)) / vec2(1100., 760.);
  col *= 1. - 0.10*dot(sv, sv);
  float g = h21(s + fract(uT*24.*0.6180339)*vec2(311.7, 217.3)) - 0.5;
  col += g*(0.016 + 0.014*uEnter);
  o = vec4(clamp(col, 0., 1.), 1.);
}`;
function shd(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, shd(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shd(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
const UL = {}; const U = n => UL[n] ?? (UL[n] = gl.getUniformLocation(prog, n));
function tex(unit, src) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });

// ---------------- overlay ----------------
let TXT = [];                                       // text registry for readcheck (id, text, box)
function text(c, id, s, x, y, font, color, opt = {}) {         // opt.key: 'card.row' in film.data.json texts
  c.font = font; c.fillStyle = color; c.textBaseline = 'alphabetic'; c.textAlign = opt.align || 'left';
  c.fillText(s, x, y);
  if (id && c.globalAlpha > 0.6) {
    const m = c.measureText(s), wdt = m.width, x0 = opt.align === 'right' ? x - wdt : opt.align === 'center' ? x - wdt / 2 : x;
    const tf = c.getTransform(), p0 = tf.transformPoint({ x: x0, y: y - m.actualBoundingBoxAscent }), p1 = tf.transformPoint({ x: x0 + wdt, y: y + m.actualBoundingBoxDescent });
    TXT.push({ id, key: opt.key, text: s, x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y) });
  }
  c.textAlign = 'left';
  return c.measureText(s).width;
}
function wipe(c, x, y, w, h, k) { c.beginPath(); c.rect(x, y, w * k, h); c.clip(); }
function ring(c, p, r, k, lw = 2.4, col = SIG) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(p[0], p[1], r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke(); }
function dot(c, p, r = 3, col = SIG) { c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill(); }
function plate(c, x, y, w, h, a = 1) { c.fillStyle = `rgba(14,15,17,${0.76 * a})`; c.beginPath(); c.roundRect(x, y, w, h, 3); c.fill(); }
const fade = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(eo(seg(t, a, a + fi)), 1 - seg(t, b - fo, b));

let CUES = [];
const NOSUBS = /nosubs=1/.test(location.search);
function subtitles(c, t) {
  if (NOSUBS) return;
  for (const q of CUES) {
    if (t < q.t0 || t >= q.t1) continue;
    const a = Math.min(seg(t, q.t0, q.t0 + 0.12), 1 - seg(t, q.t1 - 0.12, q.t1));
    c.save(); c.globalAlpha = a;
    c.font = '500 34px Inter'; const wm = c.measureText(q.en).width + 64, x0 = (W - wm) / 2, y0 = 962;
    plate(c, x0, y0, wm, 66, 1.05);
    c.fillStyle = SIG; c.fillRect(x0, y0, wm, 3);
    text(c, null, q.en, W / 2, y0 + 45, '500 34px Inter', 'rgba(250,250,247,0.98)', { align: 'center' });
    c.restore();
  }
}

// a reading card: small label, lines, source; screen-anchored, wiped in from the left
function card(c, t, t0, t1, x, y, rows, id) {         // x < 0: right-aligned, |x| from the right edge
  const a = fade(t, t0, t1, 0.45, 0.35); if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  let h = 28; const ws = [];
  rows = rows.map((r, i) => [r[0], r[1], TX[id][i] ?? '', r[2]]);
  for (const r of rows) { c.font = r[0]; ws.push(c.measureText(r[2]).width); h += r[3]; }
  const wmax = Math.max(...ws) + 56;
  if (x < 0) x = W + x - wmax;
  wipe(c, x - 2, y - 2, wmax + 4, h + 4, eo(seg(t, t0, t0 + 0.5)));
  plate(c, x, y, wmax, h);
  c.fillStyle = SIG; c.fillRect(x, y, 3, h);
  let yy = y + 10;
  rows.forEach((r, i) => { yy += r[3]; text(c, `${id}${i}`, r[2], x + 28, yy - 10, r[0], r[1], { key: `${id}.${i}` }); });
  c.restore();
}
// world-anchored underline beneath a lit line (texture px box), drawn as the line lights
function underline(c, st, k, dv, t, out) {
  const [itk, lines] = BANDS[k], it = IT[itk], p = litP(k, t), n = lines.length;
  const a = 1 - seg(t, out, out + 0.4); if (p <= 0 || a <= 0) return;
  c.save(); c.globalAlpha = a; c.strokeStyle = SIG; c.lineWidth = 3;
  lines.forEach((b, j) => {
    const q = clamp(p * n - j, 0, 1); if (q <= 0) return;
    const y = b[3] + (b[3] - b[1]) * 0.22;
    const A = at(st, toW(it, [b[0], y]), dv), B = at(st, toW(it, [lerp(b[0], b[2], q), y]), dv);
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
  });
  c.restore();
}

// the year counter: the glide runs backward through time
const YEARS = [[HIT.back1 + 0.2, HIT.drop2 - 0.25, 1895, 1887], [HIT.back2 + 0.25, HIT.drop4 - 0.25, 1887, 1881]];
const yearAt = t => { for (const [a, b, y0, y1] of YEARS) if (t >= a - 0.6 && t <= b + 0.9) return [Math.round(lerp(y0, y1, ss(seg(t, a, b)))), a, b, y0, y1]; return null; };
function counter(c, t) {
  const y = yearAt(t); if (!y) return;
  const [yr, a, b, y0, y1] = y, al = fade(t, a - 0.6, b + 0.9, 0.3, 0.4);
  c.save(); c.globalAlpha = al;
  const x = W - 96 - 340, yy = 80;
  plate(c, x, yy, 340, 118);
  c.fillStyle = SIG; c.fillRect(x, yy + 115, 340 * ss(seg(t, a, b)), 3);
  text(c, null, '◀◀', x + 28, yy + 78, '500 34px "Plex Mono"', SIG);
  text(c, null, String(yr), x + 112, yy + 86, '500 72px "Plex Mono"', PAPER);
  text(c, null, `${y0} → ${y1}`, x + 112, yy + 108, '400 16px "Plex Mono"', DIMP);
  c.restore();
}

// world-anchored item tags: year and holder, revealed when the camera first meets an item
const TAGS = [
  { it: 'wt', at: [0, -1000], t0: 8.6, n: 0 },
  { it: 'gt', at: [0, -1010], t0: 15.0, n: 2 },
  { it: 'sun', at: [-1700, -3010], t0: 31.8, n: 4 },
];
function tableTags(c, t, st) {
  for (const g of TAGS) {
    const a = eo(seg(t, g.t0, g.t0 + 0.5)) * (1 - seg(t, HIT.index + 0.3, HIT.index + 0.8)); if (a <= 0) continue;
    const it = IT[g.it], p = w2s([it.c[0] + rot(g.at, it.r * Math.PI / 180)[0], it.c[1] + rot(g.at, it.r * Math.PI / 180)[1]], st.cam);
    c.save(); c.translate(p[0], p[1]); c.rotate(st.cam.th + it.r * Math.PI / 180);
    const sc = clamp(st.cam.z / 0.35, 0.5, 1.4); c.scale(sc, sc); c.globalAlpha = a;
    const w0 = text(c, null, TX.tags[g.n], 0, 0, '500 24px "Plex Mono"', SIG);
    text(c, null, TX.tags[g.n + 1], w0 + 14, 0, '500 21px Inter', INK);
    c.restore();
  }
}

function overlay(t, st) {
  const c = ov; TXT = [];
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const lensClip = () => { if (st.on && st.A > 0.5) { c.beginPath(); c.rect(0, 0, W, H); c.arc(st.ls[0], st.ls[1], st.R * 1.31, 0, Math.PI * 2, true); c.clip('evenodd'); } };
  c.save(); lensClip(); tableTags(c, t, st); c.restore();

  // ---- 1895: Wells
  underline(c, st, 'inv', D1, t, HIT.widen + 0.4);
  underline(c, st, 'title', D1, t, HIT.rise1 + 0.3);
  card(c, t, HIT.lineInv + 0.3, HIT.rise1 + 0.6, 96, 96, [
    ['500 20px "Plex Mono"', SIG, 34],
    ['italic 400 40px Caslon', PAPER, 48],
    ['400 22px Inter', DIMP, 34],
  ], 'wells');
  underline(c, st, 'fourd', null, t, HIT.back1);
  card(c, t, HIT.line4d - 0.7, HIT.back1 + 0.65, 96, 96, [
    ['500 20px "Plex Mono"', SIG, 34],
    ['400 24px Inter', PAPER, 38],
  ], 'fourd');

  // ---- 1887: Gaspar
  underline(c, st, 'ana', D2, t, HIT.line1887 - 0.6);
  if (st.dive === D2 && t > HIT.line1887 - 0.2) {
    const k = seg(t, HIT.line1887, HIT.line1887 + 0.45), o = 1 - seg(t, HIT.rise2, HIT.rise2 + 0.3);
    if (k > 0 && o > 0) { c.save(); c.globalAlpha = o; ring(c, at(st, P('gt', [1494, 3897]), D2), 112 * IT.gt.k * st.S, eo(k), 3); c.restore(); }
  }
  card(c, t, HIT.line1887 + 0.3, HIT.drop3 + 1.2, -96, 96, [
    ['500 20px "Plex Mono"', SIG, 34],
    ['500 76px "Plex Mono"', PAPER, 82],
    ['italic 400 30px Caslon', PAPER, 42],
    ['400 22px Inter', DIMP, 36],
  ], 'gaspar');
  underline(c, st, 'mont', D3, t, HIT.enter - 0.8);
  card(c, t, HIT.lineMont + 0.4, HIT.rise3 + 0.3, 96, 80, [
    ['500 20px "Plex Mono"', SIG, 32],
    ['italic 400 30px Caslon', PAPER, 44],
    ['400 23px Inter', DIMP, 36],
  ], 'mont');
  if (st.dive === D3 && st.enter > 0.5) {
    const sp = int2s(P('g63', [1340 + st.ship[0], 2240 + st.ship[1]]), 0, st);
    const k = seg(t, HIT.enter + 0.2, HIT.enter + 0.6), o = 1 - seg(t, HIT.rise3, HIT.rise3 + 0.3);
    if (k > 0 && o > 0) {
      c.save(); c.globalAlpha = o;
      ring(c, [sp[0], sp[1] + 70], 9 * eo(k), 1, 2); dot(c, [sp[0], sp[1] + 70], 3);
      const lk = eo(seg(t, HIT.enter + 0.3, HIT.enter + 0.7));
      c.strokeStyle = SIG; c.lineWidth = 2; c.beginPath(); c.moveTo(sp[0] + 9, sp[1] + 70); c.lineTo(sp[0] + 9 + 180 * lk, sp[1] + 70 - 120 * lk); c.stroke();
      if (lk > 0.95) {
        c.save(); wipe(c, sp[0] + 190, sp[1] - 110, 520, 120, eo(seg(t, HIT.enter + 0.7, HIT.enter + 1.1)));
        text(c, 'ship-a', TX.ship[0], sp[0] + 200, sp[1] - 62, '600 30px Inter', INK, { key: 'ship.0' });
        text(c, 'ship-b', TX.ship[1], sp[0] + 200, sp[1] - 28, '400 21px "Plex Mono"', 'rgba(21,23,26,0.72)', { key: 'ship.1' });
        c.restore();
      }
      c.restore();
    }
  }

  // ---- 1881: The Sun
  underline(c, st, 'head', D4, t, HIT.trackHands);
  card(c, t, HIT.lineHead + 0.35, HIT.lineHands - 0.4, -96, 96, [
    ['500 20px "Plex Mono"', SIG, 34],
    ['500 52px "Plex Mono"', PAPER, 62],
    ['400 23px Inter', PAPER, 36],
  ], 'sun');
  underline(c, st, 'hands', D4, t, HIT.trackTime);
  underline(c, st, 'time', D4, t, HIT.rise4);
  card(c, t, HIT.lineTime + 0.45, HIT.rise4 + 0.4, -96, 96, [
    ['500 20px "Plex Mono"', SIG, 34],
    ['italic 400 40px Caslon', PAPER, 50],
  ], 'mitchell');

  counter(c, t);
  if (t > HIT.index - 0.1) indexPanel(c, t, st);
  if (t > HIT.endCard - 0.1) endCard(c, t);
  subtitles(c, t);
}

// the verdict: every item's tag flies from the table into one index, read forward in time
const ROWS = [
  [...TX.row1881, 'sun', HIT.row1881, 'row1881'],
  [...TX.row1887, 'gt', HIT.row1887, 'row1887'],
  [...TX.row1895, 'wt', HIT.row1895, 'row1895'],
];
function indexPanel(c, t, st) {
  const x0 = 1232, y0 = 150, rw = 600, rh = 132;
  const pa = eo(seg(t, HIT.index, HIT.index + 0.5));
  c.save(); c.globalAlpha = pa;
  const arrived = ROWS.reduce((acc, r) => acc + eio(seg(t, r[5] - 0.2, r[5] + 0.3)), 0);
  plate(c, x0 - 32, y0 - 34, rw + 64, 92 + arrived * rh, 1.15);
  text(c, 'ix-h', TX.index[0], x0, y0 + 22, 'italic 400 36px Caslon', PAPER, { key: 'index.0' });
  text(c, 'ix-h2', TX.index[1], x0 + rw, y0 + 18, '500 18px "Plex Mono"', SIG, { align: 'right', key: 'index.1' });
  c.restore();
  ROWS.forEach((r, i) => {
    const k = eio(seg(t, r[5] - 0.2, r[5] + 0.3)); if (k <= 0) return;
    const from = w2s(IT[r[4]].c, st.cam), to = [x0, y0 + 96 + i * rh];
    const p = lerp2(from, to, k), done = k >= 1;
    c.save(); c.globalAlpha = Math.min(1, k * 2);
    c.strokeStyle = 'rgba(250,250,247,0.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, to[1] - 34); c.lineTo(x0 + rw, to[1] - 34); c.stroke();
    text(c, done ? `ix${i}a` : null, r[0], p[0], p[1] + 20, '500 44px "Plex Mono"', PAPER, { key: `${r[6]}.0` });
    text(c, done ? `ix${i}b` : null, r[1], p[0] + 150, p[1] + 18, '600 34px Inter', SIG, { key: `${r[6]}.1` });
    text(c, done ? `ix${i}c` : null, r[2], p[0] + 150, p[1] + 52, '400 21px Inter', DIMP, { key: `${r[6]}.2` });
    text(c, done ? `ix${i}d` : null, r[3], p[0] + 150, p[1] + 78, '400 15px "Plex Mono"', 'rgba(250,250,247,0.45)', { key: `${r[6]}.3` });
    c.restore();
  });
}
function endCard(c, t) {
  const k = eo(seg(t, HIT.endCard, HIT.endCard + 0.6)); if (k <= 0) return;
  const x = 96, y = 848;
  c.save(); c.globalAlpha = k; wipe(c, x - 34, y - 96, 960, 260, k);
  plate(c, x - 30, y - 86, 900, 200, 1.15);
  text(c, 'end-a', TX.end[0], x, y, 'italic 400 54px Caslon', PAPER, { key: 'end.0' });
  c.fillStyle = SIG; c.fillRect(x, y + 28, 820, 2);
  text(c, 'end-b', TX.end[1], x, y + 70, '500 20px "Plex Mono"', DIMP, { key: 'end.1' });
  c.restore();
}

// ---------------- events for the mixer ----------------
function events() {
  const ev = [];
  for (const d of DIVES) { if (d.tDrop > 0) ev.push({ t: d.tDrop, type: 'loupe' }); ev.push({ t: d.tLift, type: 'lift' }); }
  for (const k of BKEYS) { const n = BANDS[k][1].length; for (let j = 0; j < n; j++) ev.push({ t: +(BT[k] + j * (BDUR[k] || 0.9) / n).toFixed(3), type: 'line' }); }
  let prev = null;
  for (let t = 0; t < DUR; t += 1 / 240) { const y = yearAt(t), v = y && t >= y[1] - 0.01 && t <= y[2] + 0.01 ? y[0] : null; if (v !== null && prev !== null && v !== prev) ev.push({ t: +t.toFixed(3), type: 'tick', year: v }); prev = v; }
  ev.push({ t: HIT.line1887, type: 'ring' });
  for (const r of ROWS) ev.push({ t: r[5], type: 'row' });
  ev.push({ t: HIT.lightsOut, type: 'out' });
  return ev.sort((a, b) => a.t - b.t);
}

// ---------------- page contract ----------------
function setU(st, t) {
  const cam = st.cam;
  gl.uniform2f(U('uCam'), ...cam.c); gl.uniform1f(U('uZ'), cam.z); gl.uniform1f(U('uRot'), cam.th); gl.uniform1f(U('uT'), t);
  const off = seg(t, HIT.lightsOut, HIT.lightsOut + 0.12);
  gl.uniform1f(U('uLight'), 1 - off * 0.97); gl.uniform1f(U('uGlow'), off);
  const gb0 = toW(IT.sun, [230, 300]), gb1 = toW(IT.sun, [980, 370]);
  gl.uniform4f(U('uGlowBox'), Math.min(gb0[0], gb1[0]), Math.min(gb0[1], gb1[1]), Math.max(gb0[0], gb1[0]), Math.max(gb0[1], gb1[1]));
  gl.uniform2f(U('uLensC'), ...st.ls); gl.uniform1f(U('uLensR'), st.R); gl.uniform1f(U('uLensOn'), st.on); gl.uniform1f(U('uLensA'), st.A); gl.uniform1f(U('uLift'), st.lift);
  gl.uniform2f(U('uIntC'), ...st.ic); gl.uniform1f(U('uS'), st.S); gl.uniform1f(U('uK'), st.k);
  gl.uniform1f(U('uEnter'), st.enter); gl.uniform1f(U('uDz'), st.dz); gl.uniform2f(U('uSh'), ...st.sh);
  gl.uniform2f(U('uShip'), ...st.ship); gl.uniform1f(U('uShipK'), st.shipK);
  gl.uniform1fv(U('uLit'), BKEYS.map(k => litP(k, t)));
  gl.uniform1fv(U('uDim'), ORDER.map(k => DIMS[k] ? DIMS[k](t) : 0));
}
window.DUR = DUR;
window.render = t => {
  const st = shot(t);
  gl.viewport(0, 0, W, H); setU(st, t);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  overlay(t, st);
  gl.finish();
};
window.TEXTS = t => { window.render(t); return TXT; };
window.EV = events();
async function load() {
  for (const f of ['400 20px Inter', '500 20px Inter', '600 20px Inter', '400 20px "Plex Mono"', '500 20px "Plex Mono"', '400 20px Caslon', 'italic 400 20px Caslon']) await document.fonts.load(f);
  const ims = await Promise.all([...ORDER.map(k => img('assets/tex/' + IT[k].tex)), img('assets/tex/g63_ship.png')]);
  ORDER.forEach((k, i) => { tex(i, ims[i]); gl.uniform1i(U('t_' + k), i); });
  tex(ORDER.length, ims[ORDER.length]); gl.uniform1i(U('t_ship'), ORDER.length);
  gl.uniform4fv(U('uIt'), ORDER.flatMap(k => [IT[k].c[0], IT[k].c[1], IT[k].r * Math.PI / 180, IT[k].k]));
  try { const r = await fetch('out/cues.json'); if (r.ok) CUES = await r.json(); } catch {}
  window.SUBCHECK_CUES = CUES;
}
load().then(() => { window.render(0); window.READY = true; });
