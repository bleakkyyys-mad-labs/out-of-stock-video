// The rotoscope: ink and tone drawn over the film, one cel per footage frame.
// Every frame is a pure function of its index (the boil, the grain, the story), so a render is repeatable.
// loadRoto() is the renderer (the video engine draws the dancer through it too); start() is the page around it.
//   ?clip=altman     which traced clip (roto/<clip>/trace.json + film/)
//   ?render          no UI; the headless renderer drives ROTO_RENDER(frame)
const OUT = 1080;
const Q = new URLSearchParams(location.search);
const CLIP = Q.get("clip") || "altman";

// ---------------------------------------------------------------- noise (integer hash, value noise)
function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sstep = t => t * t * (3 - 2 * t);
function vn2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sstep(x - xi), fy = sstep(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const ramp = (f, a, b) => clamp01((f - a) / (b - a));

// ---------------------------------------------------------------- geometry
// The boil: a smooth displacement FIELD over the frame, re-dealt every other frame (drawn "on twos").
// A field, not per-contour noise, so a fill and the ink on its edge wobble together.
function boil(p, seed, amp, scale = 46) {
  if (!amp) return p;
  const q = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i] / scale, y = p[i + 1] / scale;
    q[i] = p[i] + (vn2(x, y, seed) - 0.5) * 2 * amp;
    q[i + 1] = p[i + 1] + (vn2(x + 17.3, y - 9.1, seed + 7) - 0.5) * 2 * amp;
  }
  return q;
}
function chaikin(p, closed, iters = 2) {
  for (let it = 0; it < iters; it++) {
    const n = p.length / 2; if (n < 3) return p;
    const q = new Float32Array(4 * n + 4); let k = 0;
    if (!closed) { q[k++] = p[0]; q[k++] = p[1]; }
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n, ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
      q[k++] = 0.75 * ax + 0.25 * bx; q[k++] = 0.75 * ay + 0.25 * by;
      q[k++] = 0.25 * ax + 0.75 * bx; q[k++] = 0.25 * ay + 0.75 * by;
    }
    if (!closed) { q[k++] = p[2 * n - 2]; q[k++] = p[2 * n - 1]; }
    p = q.subarray(0, k);
  }
  return p;
}
function area(p) {
  let a = 0; const n = p.length / 2;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return Math.abs(a / 2);
}
function centroidY(p) { let s = 0; for (let i = 1; i < p.length; i += 2) s += p[i]; return s / (p.length / 2); }
// smooth closed outline for fills: quadratic curves through the edge midpoints
function addSmooth(path, p) {
  const n = p.length / 2; if (n < 3) return;
  path.moveTo((p[2 * n - 2] + p[0]) / 2, (p[2 * n - 1] + p[1]) / 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    path.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * j]) / 2, (p[2 * i + 1] + p[2 * j + 1]) / 2);
  }
  path.closePath();
}

// ---------------------------------------------------------------- ink: variable-width strokes, bucketed by width
const SHADE = (() => { const x = 0.5, y = 0.87, l = Math.hypot(x, y); return [x / l, y / l]; })();   // away from the key light
class Ink {
  constructor() { this.b = new Map(); this.end = new Map(); }
  seg(ax, ay, bx, by, w) {
    if (w < 0.25) return;
    const k = Math.round(w * 4); let p = this.b.get(k);
    if (!p) this.b.set(k, p = new Path2D());
    const e = this.end.get(k);                              // same width as the last piece and joined to it:
    if (!e || e[0] !== ax || e[1] !== ay) p.moveTo(ax, ay); // keep one continuous stroke (fewer caps to raster)
    p.lineTo(bx, by); this.end.set(k, [bx, by]);
  }
  // p: smoothed points. Region on the LEFT of travel (the tracer guarantees it), so outward = (ty, -tx).
  // o: { w, lo, hi (weight on the lit / shadow side), taper (px, open lines), seed }, frac: drawn fraction
  line(p, closed, o, frac = 1) {
    const n = p.length / 2; if (n < 2 || frac <= 0) return;
    const segs = closed ? n : n - 1;
    let total = 0; const L = new Float32Array(segs);
    for (let i = 0; i < segs; i++) { const j = (i + 1) % n; L[i] = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); total += L[i]; }
    const lim = total * frac; let s = 0;
    for (let i = 0; i < segs && s < lim; i++) {
      const j = (i + 1) % n, l = L[i] || 1e-6;
      const ax = p[2 * i], ay = p[2 * i + 1]; let bx = p[2 * j], by = p[2 * j + 1];
      if (s + l > lim) { const f = (lim - s) / l; bx = ax + (bx - ax) * f; by = ay + (by - ay) * f; }
      const tx = (p[2 * j] - ax) / l, ty = (p[2 * j + 1] - ay) / l;
      let w = o.w;
      if (o.hi !== undefined) w *= o.lo + (o.hi - o.lo) * Math.max(0, ty * SHADE[0] - tx * SHADE[1]);
      w *= 0.82 + 0.36 * vn2(s * 0.018, i * 0.001, o.seed | 0);                  // the hand's pressure
      if (!closed && o.taper) w *= Math.min(1, 0.2 + Math.min(s, total - s) / o.taper);
      if (frac < 1) w *= Math.min(1, 0.35 + (lim - s) / 14);                     // the nib lifting at the head
      this.seg(ax, ay, bx, by, w);
      s += l;
    }
  }
  draw(ctx, style) {
    ctx.strokeStyle = style; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [k, p] of this.b) { ctx.lineWidth = k / 4; ctx.stroke(p); }
  }
}

// ---------------------------------------------------------------- the face, drawn (the footage's eyes are 10x4 px)
// Anchored on the measured eyes; everything else hangs off the eye line: brows above, nose and the smirk below.
function cubic(a, b, c, d, n = 14) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    p.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
            u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return p;
}
function taper(ctx, pts, w0, w1, color) {                 // a stroke whose width runs w0 -> w1
  ctx.strokeStyle = color; ctx.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = w0 + (w1 - w0) * (i - 0.5) / (pts.length - 1);
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
}
function drawFace(ctx, face, F, seed, amp) {
  if (!face || !face.eyes.length) return;
  const b = face.box, fcx = (b[0] + b[2]) / 2, fw = b[2] - b[0];
  const eyes = face.eyes.map(e => {
    const [x, y] = boil(new Float32Array([e[0], e[1]]), seed, amp);
    return { x, y, w: Math.max(19, e[2] * 1.22), open: e[3] };
  });
  let ang = 0, mid, span, turn = 0;
  if (eyes.length === 2) {
    ang = Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x);
    mid = [(eyes[0].x + eyes[1].x) / 2, (eyes[0].y + eyes[1].y) / 2];
    span = Math.hypot(eyes[1].x - eyes[0].x, eyes[1].y - eyes[0].y);
    eyes[0].o = -1; eyes[1].o = 1;
  } else {                                                // one eye: the head is turned toward the side it sits on,
    const e = eyes[0]; e.o = Math.sign(e.x - fcx) || 1;  // and the far eye is hidden behind the nose
    span = Math.max(0.42 * fw, e.w * 1.6); turn = e.o;
    mid = [e.x + turn * span * 0.4, e.y];
  }
  const U = [Math.cos(ang), Math.sin(ang)], V = [-Math.sin(ang), Math.cos(ang)];
  const at = (c, u, v) => [c[0] + U[0] * u + V[0] * v, c[1] + U[1] * u + V[1] * v];
  for (const e of eyes) {
    const c = [e.x, e.y], w = e.w, o = e.o, P = (u, v) => at(c, o * u * w, v * w);
    const inner = P(-0.5, 0.05), outer = P(0.5, -0.02);
    // brow: heavy at the inner end, level and low: the smug one
    taper(ctx, cubic(P(-0.55, -0.6), P(-0.2, -0.78), P(0.25, -0.8), P(0.62, -0.66), 10), w * 0.15, w * 0.05, F.brow);
    if (e.open) {
      const upper = cubic(inner, P(-0.25, -0.33), P(0.28, -0.33), outer), lower = cubic(outer, P(0.22, 0.2), P(-0.25, 0.2), inner);
      const almond = new Path2D(); almond.moveTo(...upper[0]); for (const p of upper.slice(1)) almond.lineTo(...p); for (const p of lower.slice(1)) almond.lineTo(...p); almond.closePath();
      ctx.save(); ctx.clip(almond);
      ctx.fillStyle = F.sclera; ctx.fill(almond);
      const ic = P(0.02 + 0.08 * turn * o, 0.03);
      ctx.fillStyle = F.irisDark; ctx.beginPath(); ctx.arc(ic[0], ic[1], w * 0.31, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ic[0], ic[1], w * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = F.sclera; ctx.fill();                  // a paper base: a dot-tone iris is dots on nothing
      ctx.fillStyle = F.iris; ctx.fill();
      ctx.fillStyle = F.pupil; ctx.beginPath(); ctx.arc(ic[0], ic[1], w * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = F.lidShade; ctx.beginPath(); const ls = cubic(P(-0.6, -0.5), P(-0.2, -0.05), P(0.3, -0.05), P(0.6, -0.5), 10);
      ctx.moveTo(...ls[0]); for (const p of ls) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
      const hl = at(ic, -w * 0.09, -w * 0.1);
      ctx.fillStyle = F.glint; ctx.beginPath(); ctx.arc(hl[0], hl[1], w * 0.075, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      taper(ctx, upper, w * 0.07, w * 0.16, F.lash);                                    // the lid, heavy to the outside
      taper(ctx, [outer, P(0.6, -0.1), P(0.68, -0.2)], w * 0.14, w * 0.03, F.lash);     // the flick
      taper(ctx, lower.slice(0, 7), w * 0.05, w * 0.015, F.lash);
    } else {                                               // closed: the lid line, eased down, still flicked
      taper(ctx, cubic(inner, P(-0.2, 0.14), P(0.25, 0.14), outer), w * 0.06, w * 0.13, F.lash);
      taper(ctx, [outer, P(0.62, -0.12)], w * 0.12, w * 0.03, F.lash);
    }
  }
  // nose: a tick of shadow; mouth: the smirk, one corner up
  const k = eyes.length === 2 ? 1 : 0.7, nose = at(mid, span * (turn ? 0.15 * turn : 0.08), span * 0.42);
  taper(ctx, [nose, at(nose, span * 0.05, span * 0.1), at(nose, -span * 0.03, span * 0.13)], 2.2, 1.2, F.nose);
  const m = at(mid, span * (turn ? 0.08 * turn : 0.02), span * 0.86), M = (u, v) => at(m, u * span * k, v * span);
  taper(ctx, cubic(M(-0.27, -0.01), M(-0.1, 0.05), M(0.12, 0.05), M(0.28, -0.07), 12), 1.4, 2.6, F.mouth);
  taper(ctx, [M(0.28, -0.07), M(0.33, -0.1)], 1.8, 0.8, F.mouth);
  taper(ctx, cubic(M(-0.08, 0.13), M(-0.02, 0.16), M(0.06, 0.16), M(0.1, 0.13), 6), 1.8, 1.8, F.lip);
}

// ---------------------------------------------------------------- tones (screen-registered, like printed screentone)
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function dotTone(ctx, color, pitch, r, deg) {
  const c = canvas(pitch, pitch), x = c.getContext("2d");
  x.fillStyle = color; x.beginPath(); x.arc(pitch / 2, pitch / 2, r, 0, Math.PI * 2); x.fill();
  const pat = ctx.createPattern(c, "repeat"); pat.setTransform(new DOMMatrix().rotate(deg)); return pat;
}
function lineTone(ctx, color, pitch, w, deg) {
  const c = canvas(pitch, pitch), x = c.getContext("2d");
  x.fillStyle = color; x.fillRect(0, (pitch - w) / 2, pitch, w);
  const pat = ctx.createPattern(c, "repeat"); pat.setTransform(new DOMMatrix().rotate(deg)); return pat;
}

// ---------------------------------------------------------------- the two looks
// CEL: back toward the reference art (charcoal suit, lavender shirt shadows, the green rim light Grok dropped).
// PRINT: a manga inker's pass (solid-black suit, white-line gloss, dot tone, the green rim printed off-register).
function palettes(ctx) {
  return {
    cel: {
      body: "#25222d", sheen: "#3e3a4b", light: "#f6f4f9", lightShade: "#bdb3d8", skin: "#f8d2b6", skinShade: "#e3a08b",
      ink: "#110f16", lines: "#0c0b10", rim: "#8dff3d", rim2: "#d6ffc0", floor: dotTone(ctx, "rgba(12,30,8,0.55)", 6, 2.1, 45),
      outline: { w: 3.3, lo: 0.55, hi: 1.7 }, border: { w: 1.9, lo: 0.6, hi: 1.35 }, inner: { w: 1.5, taper: 12 },
      boil: 0.6, register: [0, 0],
      face: { sclera: "#fbfaf7", iris: "#7f96c2", irisDark: "#2f3a62", pupil: "#100e18", glint: "#ffffff", lidShade: "rgba(70,56,110,0.38)",
              lash: "#0e0c12", brow: "#17121b", nose: "#c4826f", mouth: "#3b1d22", lip: "rgba(196,120,105,0.55)" },
    },
    print: {
      body: "#0f0e12", sheen: lineTone(ctx, "#efe9dc", 5, 1.5, -32), light: "#f1ecdf",
      lightShade: dotTone(ctx, "#15131a", 6, 1.45, 45), skin: "#f3e5d6", skinShade: dotTone(ctx, "#15131a", 6, 1.15, 45),
      ink: "#0f0e12", lines: "#efe9dc", rim: "#7dff35", rim2: "#7dff35", floor: dotTone(ctx, "#15131a", 6, 2.3, 45),
      outline: { w: 4.1, lo: 0.5, hi: 1.8 }, border: { w: 2.2, lo: 0.6, hi: 1.5 }, inner: { w: 1.3, taper: 12 },
      boil: 0.95, register: [2.2, -1.6],
      face: { sclera: "#f6f2e8", iris: dotTone(ctx, "#15131a", 3, 0.75, 45), irisDark: "#15131a", pupil: "#0f0e12", glint: "#f6f2e8",
              lidShade: "rgba(15,14,18,0.28)", lash: "#0f0e12", brow: "#0f0e12", nose: "#0f0e12", mouth: "#0f0e12", lip: "rgba(15,14,18,0.35)" },
      plate: ["#6dff2e", 7, -5],          // the green plate, printed off-register behind the black
    },
  };
}

// ---------------------------------------------------------------- the stories
// FINAL, the creator's pick (9/25 night: "we can use that screenshot as the final look"): the print look on paper, the blue
// pencil left on. It opens on the creator's GPT-Image 2 illustration in colour; a halftone print pass sweeps it into ink;
// the pencil rigs him; he steps into the dance. The last frame is an impact frame, so the loop back to the
// colour illustration lands on a hit.
const INTRO = 40;                                        // frames before the dance (1.67 s at 24 fps)
const LOOK = { film: 0, pencil: 1, pencilFrac: 1, ink: 1, inkFrac: 1, fill: 1, palette: "print", paper: 1, invert: 0, wipe: -1 };
function finalShot(t, N) {
  if (t < INTRO) return { still: true, print: ramp(t, 10, 25), pencil: ramp(t, 20, 34), handoff: ramp(t, 34, INTRO) };
  return { still: false, f: t - INTRO, s: { ...LOOK, invert: t === INTRO + N - 1 ? 1 : 0 } };
}
// DEMO: the technique, over the film: film -> blue-pencil roughs -> ink chases the pencil -> colour floods in
// -> (the spin) impact frame, the paper world -> the film wipes back in -> loop.
function story(f, n) {
  const s = { film: 1, pencil: 0, pencilFrac: 0, ink: 0, inkFrac: 0, fill: 0, palette: "cel", paper: 0, invert: 0, wipe: -1 };
  const at = x => Math.round(x * (n - 1));
  s.pencilFrac = ramp(f, at(0.04), at(0.24)); s.pencil = f >= at(0.04) ? 1 - ramp(f, at(0.33), at(0.38)) : 0;
  s.inkFrac = ramp(f, at(0.14), at(0.32)); s.ink = f >= at(0.14) ? 1 : 0;
  s.fill = ramp(f, at(0.36), at(0.44));                                     // ink over film holds, then colour floods up
  const CUT = at(0.58);                                                     // mid-spin
  if (f >= CUT) { s.palette = "print"; s.paper = 1; s.film = 0; }
  if (f === CUT) s.invert = 1;
  if (f >= at(0.82)) s.wipe = ramp(f, at(0.82), at(1));                      // the film comes back from the left
  return s;
}

// ---------------------------------------------------------------- the renderer
// loadRoto(base, cv, opts): the traced clip at `base` (trace.json, film/, the still), drawn into canvas cv.
//   opts.film      (default true)  decode the footage (the demo and free modes draw it; the final look doesn't)
//   opts.grain     (default true)  the page's own grain (the video engine adds its own in post)
//   opts.border    (px, default 0) an ink panel border: the dancer as a manga panel, for the video
//   opts.portraits ({name: url})   more colour illustrations of the same pose, placed like the still
//   opts.ground    ("paper" | "none", default paper)  "none" = transparent: just him (the video masks the paper out)
//   opts.floor     (a CSS colour)  the halftone floor shadow's ink (dark dots vanish on a dark scene)
//   opts.exact     (default false) raster on the CPU: the GPU canvas is not bit-exact across its own history
//                  (measured: +-1 in ~500 px of a cel, depending on the cel drawn before it), so a render that
//                  must repeat to the bit (the video's captures and its determinism check) asks for this
export async function loadRoto(base, cv, opts = {}) {
  const doc = await (await fetch(`${base}/trace.json`)).json();
  const N = doc.count, sc = OUT / (doc.w * doc.q);
  // traced data -> output pixels. m = [scale, tx, ty] from traced units to output px
  const decode = (fr, m) => {
    const X = (v, i) => (i % 2 ? v * m[0] + m[2] : v * m[0] + m[1]);
    const o = { gesture: [] };
    o.head = fr.head ? [X(fr.head[0], 0), X(fr.head[1], 1), fr.head[2] * m[0], fr.head[3] * m[0]] : null;
    for (const k in fr) if (k !== "face" && k !== "head") o[k] = fr[k].map(a => { const f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = X(a[i], i); return f; });
    if (fr.face) o.face = { box: fr.face.box.map((v, i) => X(v, i)), eyes: fr.face.eyes.map(e => [X(e[0], 0), X(e[1], 1), e[2] * m[0], e[3]]) };
    return o;
  };
  const frames = doc.frames.map(fr => decode(fr, [sc, 0, 0]));
  // the creator's illustration: traced at its own size, placed where the dance's first frame stands; it borrows that floor
  let still = null;
  if (doc.still) {
    const [k, tx, ty] = doc.still.xform, px = OUT / doc.w;
    const m = [k * px / doc.q, tx * px, ty * px];
    still = { fr: decode(doc.still.frame, m), img: await createImageBitmap(await (await fetch(`${base}/${doc.still.img}`)).blob()),
              x: tx * px, y: ty * px, w: doc.still.w * k * px, h: doc.still.h * k * px };
    still.fr.floor = frames[0].floor;
  }
  const portraits = {};
  for (const [name, url] of Object.entries(opts.portraits || {})) portraits[name] = await createImageBitmap(await (await fetch(url)).blob());
  // the footage, decoded up front (a lazily decoded JPEG stalls the frame that first draws it)
  const film = opts.film === false ? [] : await Promise.all(Array.from({ length: N }, async (_, i) =>
    createImageBitmap(await (await fetch(`${base}/film/f${String(i).padStart(3, "0")}.jpg`)).blob())));
  const T = still ? INTRO + N : N;

  cv.width = OUT; cv.height = OUT;
  const c2d = c => c.getContext("2d", opts.exact ? { willReadFrequently: true } : undefined);
  const ctx = c2d(cv);
  const rimC = canvas(OUT, OUT), rim = c2d(rimC);
  const layer = canvas(OUT, OUT), lay = c2d(layer);
  const stageC = canvas(OUT, OUT), stage = c2d(stageC);
  const maskC = canvas(OUT, OUT), mask = c2d(maskC);
  const P = palettes(ctx);
  if (opts.floor) for (const k in P) P[k].floor = dotTone(ctx, opts.floor, 6, 2.3, 45);
  const bare = opts.ground === "none";
  const ground = () => { reset(ctx); if (bare) ctx.clearRect(0, 0, OUT, OUT); else ctx.drawImage(paper, 0, 0); };
  // grain and paper fibre tiles, from the hash (deterministic)
  const grain = canvas(256, 256); {
    const g = c2d(grain), im = g.createImageData(256, 256), D = im.data;
    for (let i = 0; i < 256 * 256; i++) { const v = 128 + (hash(i, 991) - 0.5) * 255; D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = v; D[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  }
  const paper = canvas(OUT, OUT); {
    const g = c2d(paper), im = g.createImageData(OUT, OUT), D = im.data;
    for (let y = 0; y < OUT; y++) for (let x = 0; x < OUT; x++) {
      const fib = vn2(x / 3, y / 18, 5) * 0.5 + vn2(x / 18, y / 3, 6) * 0.5, blot = vn2(x / 160, y / 160, 9);
      const d = Math.hypot(x - OUT / 2, y - OUT / 2) / OUT;
      const k = (0.93 + 0.07 * fib) * (0.97 + 0.03 * blot) * (1 - 0.22 * d * d), o = (y * OUT + x) * 4;
      D[o] = 236 * k; D[o + 1] = 228 * k; D[o + 2] = 212 * k; D[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }

  function prep(list, seed, amp) { return list.map(p => boil(p, seed, amp)); }
  function pathOf(list, minArea = 0) { const p = new Path2D(); for (const q of list) if (!minArea || area(q) >= minArea) addSmooth(p, q); return p; }
  const reset = g => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; };

  // ---- the figure onto g (no ground): tone and colour, blue pencil, ink. f only seeds the flood line's wobble.
  function figure(g, fr, s, seed, f) {
    const pal = P[s.palette], amp = pal.boil;
    const body = prep(fr.body, seed, amp), light = prep(fr.light, seed, amp), skin = prep(fr.skin, seed, amp);
    const bodyP = pathOf(body), lightP = pathOf(light), skinP = pathOf(skin);
    let figTop = OUT, figBot = 0;                                 // the figure's height, for the draw-on order and the flood
    for (const q of body) for (let i = 1; i < q.length; i += 2) { figTop = Math.min(figTop, q[i]); figBot = Math.max(figBot, q[i]); }
    if (figBot <= figTop) { figTop = 0; figBot = OUT; }

    // the tone/colour layer, drawn on its own canvas so it can flood up from the floor
    if (s.fill > 0) {
      reset(lay); lay.clearRect(0, 0, OUT, OUT);
      lay.fillStyle = pal.floor; lay.fill(pathOf(prep(fr.floor, seed, amp * 2)), "evenodd");
      if (pal.plate) {
        lay.fillStyle = pal.plate[0]; lay.translate(pal.plate[1], pal.plate[2]); lay.fill(bodyP, "evenodd"); lay.setTransform(1, 0, 0, 1, 0, 0);
      }
      lay.fillStyle = pal.body; lay.fill(bodyP, "evenodd");
      lay.fillStyle = pal.sheen; lay.fill(pathOf(prep(fr.sheen, seed, amp)), "evenodd");
      lay.fillStyle = pal.light; lay.fill(lightP, "evenodd");
      lay.fillStyle = pal.lightShade; lay.fill(pathOf(prep(fr.lightShade, seed, amp)), "evenodd");
      lay.fillStyle = pal.skin; lay.fill(skinP, "evenodd");
      lay.fillStyle = pal.skinShade; lay.fill(pathOf(prep(fr.skinShade, seed, amp)), "evenodd");
      // rim light: the body minus itself nudged away from the light, kept off the shirt and skin
      const rims = [[pal.rim, 5.0, -0.2, 0.95], [pal.rim2, -3.0, -1.2, s.palette === "print" ? 0 : 0.75]];
      for (const [col, dx, dy, a] of rims) {
        if (!a) continue;
        reset(rim); rim.clearRect(0, 0, OUT, OUT);
        rim.fillStyle = col; rim.fill(bodyP, "evenodd");
        rim.globalCompositeOperation = "destination-out";
        rim.setTransform(1, 0, 0, 1, -dx, -dy); rim.fill(bodyP, "evenodd");
        rim.setTransform(1, 0, 0, 1, 0, 0); rim.fill(lightP, "evenodd"); rim.fill(skinP, "evenodd");
        lay.globalAlpha = a; lay.drawImage(rimC, pal.register[0], pal.register[1]); lay.globalAlpha = 1;
      }
      drawFace(lay, fr.face, pal.face, seed, amp);        // the face lives with the colour: it floods in with it
      if (s.fill < 1) {                                   // the flood line, boiling like everything else
        lay.globalCompositeOperation = "destination-in"; lay.beginPath();
        const y0 = figBot - (figBot - figTop) * s.fill;
        lay.moveTo(0, OUT);
        for (let x = 0; x <= OUT; x += 24) lay.lineTo(x, y0 + (vn2(x / 90, f * 0.3, 3) - 0.5) * 40);
        lay.lineTo(OUT, OUT); lay.closePath(); lay.fillStyle = "#000"; lay.fill();
        lay.globalCompositeOperation = "source-over";
      }
      g.drawImage(layer, 0, 0);
    }

    // blue-pencil roughs, the animator's first pass: construction first (the head oval, the line of action),
    // then the contours, looser than the ink, three passes, each one overshooting where it closes
    if (s.pencil > 0 && s.pencilFrac > 0) {
      const ink = new Ink(), pf = s.pencilFrac, cons = clamp01(pf / 0.35);
      if (fr.head) {
        const [hx, hy, rx, ry] = fr.head, n = 44;
        for (const k of [0, 1]) {
          const pts = new Float32Array(2 * (n + 1)), rot = (hash(seed, k, 9) - 0.5) * 0.6;
          for (let i = 0; i <= n; i++) {
            const a = -2.2 + rot + (i / n) * Math.PI * 2 * 1.14;
            pts[2 * i] = hx + Math.cos(a) * rx * (1 + 0.05 * k); pts[2 * i + 1] = hy + Math.sin(a) * ry * (1 - 0.04 * k);
          }
          ink.line(boil(pts, seed + 70 + k, 3.5, 40), false, { w: 2.0, taper: 24, seed: seed + k }, cons);
        }
      }
      for (const q of fr.gesture) for (const k of [0, 1]) ink.line(chaikin(boil(q, seed + 80 + k, 5, 70), false), false, { w: 2.2, taper: 60, seed: seed + 9 }, cons);
      for (const k of [0, 1, 2]) {
        const ps = seed + 50 + k * 31;
        for (const list of [fr.body, fr.light, fr.skin]) for (const q0 of list) {
          if (area(q0) < 60) continue;
          const n = q0.length / 2, extra = Math.max(2, Math.round(n * 0.1)), open = new Float32Array(2 * (n + extra));
          for (let i = 0; i < n + extra; i++) { open[2 * i] = q0[2 * (i % n)]; open[2 * i + 1] = q0[2 * (i % n) + 1]; }
          const q = chaikin(boil(open, ps, 3.4, 34), false, 1);   // one smoothing pass: a line this loose needs no more
          const d = 0.2 + clamp01((centroidY(q) - figTop) / (figBot - figTop)) * 0.35;
          ink.line(q, false, { w: 1.7, taper: 18, seed: ps }, clamp01((pf - d) / 0.45));
        }
      }
      g.globalAlpha = 0.85 * s.pencil; ink.draw(g, "#3a78ff"); g.globalAlpha = 1;
    }

    // the ink
    if (s.ink > 0 && s.inkFrac > 0) {
      const ink = new Ink(), white = new Ink(), frac = q => clamp01((s.inkFrac - clamp01((centroidY(q) - figTop) / (figBot - figTop)) * 0.45) / 0.55);
      for (const q of fr.lines.map(p => boil(p, seed, amp))) (s.palette === "print" ? white : ink).line(chaikin(q, false), false, { ...pal.inner, seed }, frac(q));
      for (const list of [light, skin]) for (const q of list) if (area(q) >= 40) ink.line(chaikin(q, true), true, { ...pal.border, seed: seed + 3 }, frac(q));
      for (const q of body) if (area(q) >= 30) ink.line(chaikin(q, true), true, { ...pal.outline, seed: seed + 5 }, frac(q));
      white.draw(g, pal.lines);
      ink.draw(g, pal.ink);
    }
  }

  // ---- grain on everything (the video's look); the impact frame inverts it all; the panel border last
  function finish(s, t) {
    reset(ctx);
    if (opts.grain !== false) {
      ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = s.paper ? 0.16 : 0.08;
      const gx = Math.floor(hash(t, 5) * 256), gy = Math.floor(hash(t, 6) * 256);
      for (let y = -gy; y < OUT; y += 256) for (let x = -gx; x < OUT; x += 256) ctx.drawImage(grain, x, y);
      reset(ctx);
    }
    if (s.invert) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT); reset(ctx); }
    if (opts.border) { const b = opts.border; ctx.lineWidth = b; ctx.strokeStyle = "#0f0e12"; ctx.strokeRect(b / 2, b / 2, OUT - b, OUT - b); }
  }

  // ---- one dance frame f in settings s. t = the timeline frame (seeds the grain), defaults to f
  function renderDance(f, s, t = f) {
    f = ((f % N) + N) % N;
    reset(ctx);
    if (s.paper) ground();
    else { ctx.imageSmoothingQuality = "high"; ctx.drawImage(film[f], 0, 0, OUT, OUT); }
    figure(ctx, frames[f], s, Math.floor(f / 2) * 13 + 1, f);
    if (s.wipe >= 0) {                                    // the film wipes back in from the left, a pencil line on its edge
      const x0 = -40 + (OUT + 80) * sstep(s.wipe), edge = [], seed = Math.floor(f / 2) * 13 + 1;
      for (let y = 0; y <= OUT; y += 20) edge.push([x0 + (vn2(y / 70, seed, 4) - 0.5) * 26, y]);
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0);
      for (const [x, y] of edge) ctx.lineTo(x, y);
      ctx.lineTo(0, OUT); ctx.closePath(); ctx.clip();
      ctx.drawImage(film[f], 0, 0, OUT, OUT); ctx.restore();
      ctx.beginPath(); edge.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.lineWidth = 3; ctx.strokeStyle = "#0f0e12"; ctx.stroke();
    }
    finish(s, t);
  }

  // ---- halftone transitions: a mask of dots that grow behind a front travelling along D
  function dotMask(k, D = [0.6, -0.8], band = 280, G = 18) {
    reset(mask); mask.clearRect(0, 0, OUT, OUT); mask.fillStyle = "#000";
    const ds = [[0, 0], [OUT, 0], [0, OUT], [OUT, OUT]].map(([x, y]) => x * D[0] + y * D[1]);
    const d0 = Math.min(...ds), d1 = Math.max(...ds), front = d0 - band + (d1 - d0 + 2 * band) * sstep(k);
    mask.beginPath();
    for (let j = 0; j * G < OUT + G; j++) for (let i = 0; i * G < OUT + G; i++) {
      const x = i * G + (j % 2) * G / 2, y = j * G;                 // a staggered (45-degree) lattice, like print
      const u = clamp01((front - (x * D[0] + y * D[1])) / band);
      if (u <= 0) continue;
      const r = u * G * 0.78;
      mask.moveTo(x + r, y); mask.arc(x, y, r, 0, Math.PI * 2);
    }
    mask.fill();
  }

  // ---- the intro: the creator's illustration in colour -> print -> the pencil rigs him -> he steps into the dance
  function renderIntro(t, sh) {
    const seed = Math.floor(t / 2) * 13 + 7, fr = still.fr;
    ground();
    if (sh.handoff > 0) figure(ctx, frames[0], { ...LOOK, pencil: 0 }, 1, 0);   // the dance's first frame comes up underneath
    if (sh.print < 1) {                                                // the illustration itself, on a borrowed floor
      ctx.fillStyle = P.print.floor; ctx.fill(pathOf(prep(fr.floor, seed, 1.9)), "evenodd");
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(still.img, still.x, still.y, still.w, still.h);
    }
    if (sh.print > 0) {
      reset(stage); stage.clearRect(0, 0, OUT, OUT);
      figure(stage, fr, { ...LOOK, pencil: sh.pencil > 0 && !sh.handoff ? 1 : 0, pencilFrac: sh.pencil }, seed, t);
      if (sh.print < 1) { dotMask(sh.print); stage.globalCompositeOperation = "destination-in"; stage.drawImage(maskC, 0, 0); reset(stage); }
      // the hand-off, head first: dots of the still drop out and the dancer is underneath (never both at once:
      // the still stands wider than the clip's first frame, and a plain crossfade double-exposes the legs)
      if (sh.handoff > 0) { dotMask(sh.handoff, [0.12, 0.99], 240, 18); stage.globalCompositeOperation = "destination-out"; stage.drawImage(maskC, 0, 0); reset(stage); }
      ctx.drawImage(stageC, 0, 0);
    }
    // through the hand-off the pencil is the dancer's, drawn once, on top: the rough shows where he's going
    if (sh.handoff > 0) figure(ctx, frames[0], { ...LOOK, fill: 0, ink: 0 }, 1, 0);
    finish(LOOK, t);
  }

  // ---- a colour illustration of the pose on paper (the still itself, or a registered variant of it)
  function renderPortrait(name, t) {
    ground();
    ctx.fillStyle = P.print.floor; ctx.fill(pathOf(prep(still.fr.floor, Math.floor(t / 2) * 13 + 7, 1.9)), "evenodd");
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(portraits[name] || still.img, still.x, still.y, still.w, still.h);
    finish(LOOK, t);
  }

  // ---- modes: FINAL (the default), DEMO (the technique over the film), FREE (the layers, by hand)
  const free = { ...LOOK };
  function render(t, m) {
    if (m === "free") return renderDance(t, free);
    if (m === "demo") return renderDance(t, story(((t % N) + N) % N, N));
    t = ((t % T) + T) % T;
    if (!still) return renderDance(t, LOOK);
    const sh = finalShot(t, N);
    return sh.still ? renderIntro(t, sh) : renderDance(sh.f, sh.s, t);
  }
  return {
    canvas: cv, N, T, INTRO, fps: doc.fps, free, counts: { final: T, demo: N, free: N },
    // the still and its registered variants as images, where the still sits on this canvas, and its face (canvas px)
    images: { still: still && still.img, ...portraits }, stillRect: still && { x: still.x, y: still.y, w: still.w, h: still.h },
    stillFace: still && still.fr.face ? still.fr.face.box : null,
    render,                                                            // (t, "final" | "demo" | "free")
    portrait: renderPortrait,                                          // (name, t): colour on paper
    intro: rho => renderIntro(rho, finalShot(rho, N)),                 // the final story's intro frame rho (0 .. INTRO-1)
    dance: f => renderDance(f, LOOK, f),                               // dance frame f in the final look
    body: f => bodyOf(frames[f]),                                      // where he stands in dance frame f (canvas px)
  };
}

// a traced frame's silhouette: its centre by area (cx) and its top and bottom, in the frame's own units
function bodyOf(fr) {
  let A = 0, CX = 0, top = Infinity, bottom = -Infinity;
  for (const p of fr.body) for (let i = 0, n = p.length / 2; i < n; i++) {
    const j = (i + 1) % n, x0 = p[2 * i], y0 = p[2 * i + 1], x1 = p[2 * j], y1 = p[2 * j + 1], cr = x0 * y1 - x1 * y0;
    A += cr; CX += (x0 + x1) * cr; top = Math.min(top, y0); bottom = Math.max(bottom, y0);
  }
  return { cx: CX / (3 * A), top, bottom };
}

export async function start() {
  const R = await loadRoto(CLIP, document.getElementById("roto"), { exact: Q.has("render") });   // captures: CPU, bit-exact
  const { N, T, free, counts, render } = R, count = m => counts[m];
  window.ROTO_FREE = free;                                  // the free-mode switches (the page keys, and the bench)
  window.ROTO_RENDER = (t, m = "final") => { render(t, m); return true; };
  window.ROTO_INFO = { count: T, counts, fps: R.fps, w: OUT, h: OUT };
  // warm-up: every look once, so the first play doesn't pay the browser's first-use costs (measured: a 1.9 s stall)
  // (presented through animation frames, not read back: a readback can knock the canvas off the GPU for good)
  const warm = [["final", 5], ["final", 18], ["final", 30], ["final", 37], ["final", 60], ["final", T - 1],
                ["demo", 30], ["demo", 50], ["demo", 90], ["demo", 130]];
  for (const [m, t] of warm) { render(t, m); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  render(0, "final");
  window.ROTO_READY = true;
  if (Q.has("render")) return;

  const hud = document.getElementById("hud");
  const state = { f: 0, playing: true, mode: "final", t0: performance.now(), f0: 0 };
  const show = () => {
    render(state.f, state.mode);
    const n = count(state.mode), onoff = v => (v ? "on" : "off");
    hud.textContent = `${String(state.f).padStart(3, "0")}/${n - 1}  ${state.playing ? "▶" : "❚❚"}  ` + (state.mode !== "free" ? state.mode.toUpperCase() :
      `FREE  pencil ${onoff(free.pencil)} · ink ${onoff(free.ink)} · tone ${onoff(free.fill)} · look ${free.palette} · ground ${free.paper ? "paper" : "film"}`);
  };
  const loop = now => {
    if (state.playing) {
      const f = (state.f0 + Math.floor((now - state.t0) / 1000 * R.fps)) % count(state.mode);
      if (f !== state.f) { state.f = f; show(); }
    }
    requestAnimationFrame(loop);
  };
  const toFree = () => { if (state.mode !== "free") { state.mode = "free"; state.f %= N; } };
  addEventListener("keydown", e => {
    const k = e.key.toLowerCase(), re = () => { state.t0 = performance.now(); state.f0 = state.f; }, n = count(state.mode);
    if (k === " ") { state.playing = !state.playing; re(); e.preventDefault(); }
    else if (k === "arrowright") { state.playing = false; state.f = (state.f + 1) % n; }
    else if (k === "arrowleft") { state.playing = false; state.f = (state.f - 1 + n) % n; }
    else if (k === "s") { state.mode = state.mode === "final" ? "demo" : "final"; state.f = 0; }
    else if (k === "f") { toFree(); free.film = free.film ? 0 : 1; free.paper = 1 - free.film; }
    else if (k === "r") { toFree(); free.pencil = free.pencil ? 0 : 1; }
    else if (k === "i") { toFree(); free.ink = free.ink ? 0 : 1; }
    else if (k === "t") { toFree(); free.fill = free.fill ? 0 : 1; }
    else if (k === "p") { toFree(); free.palette = free.palette === "cel" ? "print" : "cel"; }
    else return;
    re(); show();
  });
  show(); requestAnimationFrame(loop);
}
