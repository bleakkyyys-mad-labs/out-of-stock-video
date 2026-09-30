// THE CHORUS, redesigned (the creator's brainstorm, 9/29; "Build please" 05:17).
//
// The creator's notes, in the creator's words: the questions' text was the main complaint -- "It feels tacky, from the font style, and the
// way it just animates in and out" -- with the creator's kinetic-type reference (yk3Av-CCYFUNeaKv.mp4) as the bar for both;
// "red and strobing flashes was a tad harsh"; the skyline becomes "diagrams of buildings, front facing view"; the wafer
// line comes off the screen ("fully exclude"); "It's compute for us! No compute for thee!" stays exactly as it was;
// "start as blue and white, utopian, the buildings or whatever being drawn, then it goes the red when it switches to
// Compute for us"; the storm keeps its old choreography ("I liked the shattered parts being sucked into the structure
// part you had before"); and the drawing grows across the three choruses ("I want to see it actually").
//
// So each chorus has two halves, split on the frame the AltMan's smug face lands on "COMPUTE":
//   BLUE  the drop's first eleven seconds. A blueprint. The site is drawn a stroke group per sung syllable (site.js),
//         and the two questions are set the way the creator's reference sets type (below). No kick flash, no glow on the type.
//   RED   the answer, unchanged, in front of the same buildings in red on the night, their windows lit on the kick,
//         the storm flying into them.
//
// THE TYPE, read off the creator's reference frame by frame (, the notes in the project memory): three voices of one family
// (wide heavy caps for the hit word, a condensed heavy italic for the second hit, small light italic lowercase for the
// connectives, the connectives stacked to the hit word's height and the SAME white -- the contrast is size and case,
// never brightness, lesson L88), an outlined repeat, a knock-out label, marks drawn on like marker. Every word arrives on
// its own syllable in two to four frames (the hit words slam with a trail of copies, the little words rise out of a
// blur, the repeat comes into focus from a huge blur behind, the label wipes in); the line builds into one block that
// holds, boils a pixel on twos and drifts; then the whole block leaves in a few frames (it falls, or it whips) and its
// key word stays behind on the sheet as a huge cropped ghost. The same two blocks in the same places in all three
// choruses (the creator's reference's trick: its chorus repeats with only the paper changing); the drawing is what grows.
import * as song from "./song.js";
import { ctx2d, EXACT } from "./type.js";
import { glyph, layout, capHeight, OUTLINE_UNIT, drawGlyph, strokeGlyph, outline as otext, measure } from "./outline.js";
import { W, H } from "./frame.js";
import { buildSite, drawSite, viewOf, plotter, BLUE } from "./site.js";

const { h32, lines, lineWords } = song;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const k = 1.7; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

const INK = BLUE.ink, STOCK = "#1d4e93", SHADOW = "#0b2855";
const LW = 1920, LH = 1080;                           // the lockup layer is laid out at 16:9 (scaled into the portrait frame)

// =====================================================================================================================
// the two questions, as blocks. conn: the connective lines (each a list of sung words); hit: the hit word as shown.
// The words are bound to the sung words in reading order, which is the order they are sung
// =====================================================================================================================
const LOCKS = {
  q1: { side: "left", exit: "fall", ghost: "STOCK", rows: [
    { conn: [["out"], ["of"]], hit: "STOCK,", voice: "wide", enter: "smear", dir: [-1, 0] },
    { conn: [["or", "out"], ["of"]], hit: "STOCK", voice: "outline", enter: "focus" },
    { conn: [["for"]], hit: "ME?", voice: "label", enter: "label" },
  ] },
  q2: { side: "right", exit: "whip", ghost: "MEMORY", rows: [
    { conn: [["before"], ["it", "was"]], hit: "MADE,", voice: "wide", enter: "smear", dir: [1, 0] },
    { conn: [["who"]], hit: "SIGNED", voice: "condit", enter: "smear", dir: [0, 1], mark: "signature" },
    { conn: [["three", "years"], ["of"]], hit: "MEMORY?", voice: "label", enter: "label", mark: "tally" },
  ] },
};
const FAM = { wide: "wide", outline: "cond", condit: "condit", label: "wide" };
const capR = fam => capHeight(fam, 1000) / 1000;          // cap height per px of font size

// lay a block out: every row fitted to the block's width (the justified column the reference's lockups make), its hit
// word's cap height between 110 and 206 px, the connectives stacked to that height. Pure layout, made once per block
const LAID = new Map();
function laid(spec) {
  if (LAID.has(spec)) return LAID.get(spec);
  const BW = 1440, X0 = spec.side === "left" ? 150 : LW - 150 - BW;
  let y = 150;
  const toks = [], rows = [];
  spec.rows.forEach((r, ri) => {
    const fam = FAM[r.voice], two = r.conn.length > 1, label = r.voice === "label";
    const at = C => {
      const hs = C / capR(fam), cs = C * (two ? 0.54 : 0.66), pitch = C * 0.52;
      const cw = Math.max(...r.conn.map(ws => measure("conn", ws.join(" "), cs)));
      const pad = label ? C * 0.15 : 0, gap = C * 0.12, hw = measure(fam, r.hit, hs);
      const tail = r.mark === "tally" ? C * 1.05 : 0;          // a stretch of bare label for the tally strokes
      return { C, hs, cs, pitch, cw, pad, gap, hw, w: cw + gap + hw + pad * 2 + tail };
    };
    const a = at(100), C = clamp(BW / a.w * 100, 110, 206), L = at(C);
    const x0 = label || spec.side === "left" ? X0 : X0 + BW - L.w, yb = y + L.pad + C;
    // the connectives, left-aligned in their stack; a word at a time
    r.conn.forEach((ws, li) => {
      const by = two ? (li === 0 ? yb - L.pitch : yb) : yb;
      let x = x0;
      ws.forEach(w => { toks.push({ text: w, fam: "conn", size: L.cs, x, y: by, C: L.cs * capR("conn"), voice: "conn", enter: "rise", row: ri }); x += measure("conn", w + " ", L.cs); });
    });
    const hx = x0 + L.cw + L.gap;
    const hit = { text: r.hit, fam, size: L.hs, x: hx + L.pad, y: yb, C, hw: L.hw, voice: r.voice, enter: r.enter, dir: r.dir, row: ri, hit: true, mark: r.mark };
    if (label) Object.assign(hit, { sx: hx, sy: yb - C - L.pad, sw: X0 + BW - hx, sh: C + 2 * L.pad, pad: L.pad });
    toks.push(hit);
    rows.push({ y, yb, C, x0 });
    y = yb + L.pad + C * (r.mark === "signature" ? 0.46 : 0.24);    // (room under a row for the signature drawn under it)
  });
  toks.forEach((t, i) => { t.id = i; });
  const out = { toks, rows, box: { x: X0, y: 150, w: BW, h: y - 150 } };
  LAID.set(spec, out);
  return out;
}
const clean = s => s.toUpperCase().replace(/[^A-Z0-9']/g, "");
// bind a block's tokens to a line's sung words, in order (a word the take didn't sing is skipped, never guessed)
function lockup(spec, li, exitAt) {
  const lay = laid(spec), ws = lineWords(li);
  let k = 0;
  const toks = lay.toks.map(tk => {
    const want = clean(tk.text);
    let j = k;
    while (j < ws.length && clean(ws[j].w) !== want) j++;
    const word = j < ws.length ? ws[j] : null;
    if (word) k = j + 1;
    return { ...tk, word };
  });
  const t0 = toks.find(x => x.word)?.word.t ?? song.lineStart(li);
  return { spec, li, toks, box: lay.box, t0, exitAt, find: w => toks.find(x => x.word && x.word.w === w)?.word };
}

// =====================================================================================================================
// the letters: each word drawn once as outlines (lesson L80) into its own canvas -- sharp with a light worn-print
// speckle, a blurred copy for the entrances, and a silhouette for the extrude -- then only ever drawn from
// =====================================================================================================================
const ART = new Map();
const mkCanvas = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; };
function seedOf(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
// the worn print: little holes and a few scratches through the ink (the creator's reference's texture, kept light: this is the
// utopia's clean sheet, not its grunge)
function speckle(g, w, h, seed, density = 1) {
  g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.strokeStyle = "#000";
  const n = Math.round(w * h / 1500 * density);
  for (let i = 0; i < n; i++) {
    const r = 0.6 + Math.pow(h32(seed, i, 3), 2.2) * 3.4;
    g.globalAlpha = 0.4 + h32(seed, i, 4) * 0.6;
    g.beginPath(); g.arc(h32(seed, i, 1) * w, h32(seed, i, 2) * h, r, 0, 7); g.fill();
  }
  g.lineWidth = 1.1; g.globalAlpha = 0.45;
  for (let i = 0; i < Math.max(2, Math.round(w / 260)); i++) {
    const x = h32(seed, i, 5) * w, y = h32(seed, i, 6) * h, a = (h32(seed, i, 7) - 0.5) * 0.5, l = 40 + h32(seed, i, 8) * 120;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.restore();
}
function art(fam, text, size, mode = "fill", strokeW = 0) {
  const key = `${fam}|${text}|${size.toFixed(2)}|${mode}|${strokeW}`;
  let a = ART.get(key);
  if (a) return a;
  const L = layout(fam, text, size), k = size / OUTLINE_UNIT;
  let top = 0, bot = 0;
  for (const ch of text) { const g = glyph(fam, ch); top = Math.min(top, g.top * k); bot = Math.max(bot, g.bottom * k); }
  const pad = Math.ceil(size * 0.06) + 22, w = Math.ceil(L.w + pad * 2), h = Math.ceil(bot - top + pad * 2), ox = pad, oy = pad - top;
  const stroke = mode === "outline" || mode === "ghost";
  const letters = (g, col) => {
    g.fillStyle = col; g.strokeStyle = col;
    for (let i = 0; i < text.length; i++) {
      g.save(); g.translate(ox + L.xs[i], oy);
      if (stroke) strokeGlyph(g, fam, text[i], size, strokeW); else drawGlyph(g, fam, text[i], size);
      g.restore();
    }
  };
  const sharp = mkCanvas(w, h), sg = ctx2d(sharp);
  letters(sg, INK);
  if (mode !== "ghost") speckle(sg, w, h, seedOf(key), mode === "outline" ? 0.35 : 1);
  const sil = mkCanvas(w, h); letters(ctx2d(sil), SHADOW);
  const blur = mkCanvas(w, h), bg = ctx2d(blur);
  bg.filter = `blur(${Math.max(5, Math.round(size * 0.03))}px)`; bg.drawImage(sharp, 0, 0); bg.filter = "none";
  a = { sharp, sil, blur, ox, oy, w: L.w };
  ART.set(key, a);
  return a;
}
// the knock-out label: a white strip with the word in the paper's own blue, worn like the rest
function labelArt(tk) {
  const key = `label|${tk.text}|${tk.size.toFixed(2)}|${tk.sw.toFixed(1)}`;
  let a = ART.get(key);
  if (a) return a;
  const m = 24, w = Math.ceil(tk.sw + m * 2), h = Math.ceil(tk.sh + m * 2), L = layout(tk.fam, tk.text, tk.size);
  const sharp = mkCanvas(w, h), g = ctx2d(sharp);
  g.fillStyle = INK; g.fillRect(m, m, tk.sw, tk.sh);
  g.fillStyle = STOCK;
  for (let i = 0; i < tk.text.length; i++) { g.save(); g.translate(m + tk.pad + L.xs[i], m + tk.pad + tk.C); drawGlyph(g, tk.fam, tk.text[i], tk.size); g.restore(); }
  speckle(g, w, h, seedOf(key), 0.8);
  const sil = mkCanvas(w, h), sg = ctx2d(sil); sg.fillStyle = SHADOW; sg.fillRect(m, m, tk.sw, tk.sh);
  a = { sharp, sil, m };
  ART.set(key, a);
  return a;
}

// =====================================================================================================================
// the block at t
// =====================================================================================================================
function drawToken(c, tk, t, base) {
  const w = tk.word;
  if (!w) return;
  const e = t - (w.t - 0.035);
  if (e < 0) return;
  const f15 = Math.floor(t * 15), settled = e > 0.16;
  const bx = settled ? (h32(tk.id, f15, 61) - 0.5) * 2.4 : 0, by = settled ? (h32(tk.id, f15, 62) - 0.5) * 2.4 : 0;   // the boil, on twos
  if (tk.voice === "label") {
    const A = labelArt(tk), u = clamp(e / 0.1), dy = -(1 - easeOut(u)) * 28;
    c.save();
    c.translate(tk.sx, tk.sy + tk.sh / 2); c.rotate(-0.016); c.translate(-tk.sx, -(tk.sy + tk.sh / 2));
    c.beginPath(); c.rect(tk.sx - 30, tk.sy - 60, (tk.sw + 60) * easeOut(u), tk.sh + 120); c.clip();     // it wipes in from its left
    c.globalAlpha = base * 0.85; c.drawImage(A.sil, tk.sx - A.m + 11 + bx, tk.sy - A.m + 11 + dy + by);
    c.globalAlpha = base; c.drawImage(A.sharp, tk.sx - A.m + bx, tk.sy - A.m + dy + by);
    c.restore();
    return;
  }
  const A = tk.art ??= art(tk.fam, tk.text, tk.size, tk.voice === "outline" ? "outline" : "fill", tk.voice === "outline" ? Math.max(3, tk.size * 0.013) : 0);
  const x = tk.x - A.ox, y = tk.y - A.oy;
  const put = (img, dx, dy, s, a) => {
    if (a <= 0.004) return;
    c.globalAlpha = base * Math.min(1, a);
    if (s === 1) { c.drawImage(img, x + dx, y + dy); return; }
    const px = tk.x + A.w / 2 + dx, py = tk.y - tk.C / 2 + dy;
    c.save(); c.translate(px, py); c.scale(s, s); c.translate(-px, -py); c.drawImage(img, x + dx, y + dy); c.restore();
  };
  // the extrude: the hit words stand off the sheet on a short stack of their own silhouette
  const depth = tk.voice === "conn" ? 1 : tk.voice === "outline" ? 0 : 3, step = Math.max(2.5, tk.C * 0.02);
  const extrude = (dx, dy, a) => { for (let j = depth; j >= 1; j--) put(A.sil, dx + j * step, dy + j * step, 1, a); };
  switch (tk.enter) {
    case "rise": {                                  // the little words: up a few pixels, out of a blur
      const u = clamp(e / 0.12), dy = (1 - easeOut(u)) * 30, a = clamp(e / 0.05);
      extrude(bx, by + dy, a * u * 0.85);
      put(A.blur, bx, by + dy, 1, a * (1 - u)); put(A.sharp, bx, by + dy, 1, a * clamp(u * 1.3));
      break;
    }
    case "smear": {                                 // the hit: slammed in along its direction, trailing copies of itself
      const D = 320, dir = tk.dir ?? [-1, 0], off = s => (1 - easeOutBack(clamp(s / 0.1))) * D, u = clamp(e / 0.1);
      for (let j = 5; j >= 1; j--) { const o = off(e - j * 0.014); put(A.blur, dir[0] * o + bx, dir[1] * o + by, 1, 0.55 * (1 - j / 6) * (1 - u * 0.85)); }
      const o = off(e);
      extrude(dir[0] * o + bx, dir[1] * o + by, 1);
      put(A.sharp, dir[0] * o + bx, dir[1] * o + by, 1, 1);
      break;
    }
    case "focus": {                                 // the repeat: a huge blur behind, snapping into focus at its size
      const u = clamp(e / 0.15), s = lerp(1.75, 1, easeOut(u));
      put(A.blur, bx, by, s, (1 - u) * 0.9);
      put(A.sharp, bx, by, s, clamp((u - 0.3) / 0.35));
      break;
    }
  }
}
// the marks, drawn on like marker: a signature under SIGNED, three tally strokes for three years
function drawMarks(c, lk, t, base) {
  c.save();
  c.lineCap = "round"; c.lineJoin = "round";
  for (const tk of lk.toks) {
    if (!tk.mark || !tk.word) continue;
    if (tk.mark === "signature") {
      const u = clamp((t - (tk.word.t + 0.1)) / 0.36);
      if (u <= 0) continue;
      const pts = tk.sig ??= signature(tk);
      const n = Math.max(2, Math.floor(pts.length * u));
      for (const [col, dx, lw] of [[SHADOW, 4, tk.C * 0.034], [INK, 0, tk.C * 0.03]]) {
        c.globalAlpha = base; c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < n; i++) i ? c.lineTo(pts[i][0] + dx, pts[i][1] + dx) : c.moveTo(pts[i][0] + dx, pts[i][1] + dx);
        c.stroke();
      }
    }
    if (tk.mark === "tally") {
      // three strokes for three years, in pen on the label's own white, one on each of "three / years / of"
      if (t < tk.word.t - 0.035) continue;                       // (the label has to be there to be written on)
      const ws = ["THREE", "YEARS", "OF"].map(w => lk.find(w)).filter(Boolean);
      const x0 = tk.x + tk.hw + tk.C * 0.24, yb = tk.sy + tk.sh - tk.pad * 0.9, yt = tk.sy + tk.pad * 0.9;
      ws.forEach((w, i) => {
        const u = clamp((t - Math.max(w.t - 0.02, tk.word.t + 0.06 * (i + 1))) / 0.07);
        if (u <= 0) return;
        const x = x0 + i * tk.C * 0.22;
        c.save(); c.translate(tk.sx, tk.sy + tk.sh / 2); c.rotate(-0.016); c.translate(-tk.sx, -(tk.sy + tk.sh / 2));
        c.globalAlpha = base; c.strokeStyle = STOCK; c.lineWidth = Math.max(6, tk.C * 0.05); c.beginPath();
        c.moveTo(x, yb); c.lineTo(lerp(x, x + tk.C * 0.1, u), lerp(yb, yt, u)); c.stroke();
        c.restore();
      });
    }
  }
  c.restore();
}
// a signature's path under the word: a big capital loop, then cursive -- a prolate cycloid, whose loops come from the
// pen running back on itself, their heights uneven the way a hand's are -- and the flourish back underneath
function signature(tk) {
  const C = tk.C, xs = tk.x + C * 0.12, xe = tk.x + measure(tk.fam, tk.text, tk.size) * 0.96, yb = tk.y + C * 0.3, pts = [];
  for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI * 2.1; pts.push([xs + C * 0.1 + Math.cos(a) * C * 0.1, yb - C * 0.16 + Math.sin(a) * C * 0.2]); }
  const x1 = xs + C * 0.24, L = xe - x1, om = Math.PI * 2 * 7;
  for (let i = 0; i <= 160; i++) {
    const s = i / 160, ph = om * (s + 0.028 * Math.sin(s * 23 + 1)), r = C * (0.06 + 0.075 * Math.sin(s * 9.1 + 0.6) ** 2);
    pts.push([x1 + L * s - r * 1.15 * Math.sin(ph), yb - r * (1 - Math.cos(ph)) + C * 0.035 * Math.sin(s * 13)]);
  }
  for (let i = 1; i <= 36; i++) { const s = i / 36; pts.push([lerp(xe, xs + L * 0.18, easeOut(s)), yb + C * 0.08 + C * 0.05 * Math.sin(s * Math.PI)]); }
  return pts;
}
function drawLock(c, lk, t) {
  const ue = clamp((t - lk.exitAt) / (lk.spec.exit === "fall" ? 0.17 : 0.13));
  if (ue >= 1 || t < lk.t0 - 0.05) return;
  const hold = clamp((t - lk.t0) / Math.max(0.5, lk.exitAt - lk.t0)), B = lk.box, cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  const side = lk.spec.side === "left" ? 1 : -1;
  const block = (alpha, dx, dy, rot) => {
    c.save();
    c.translate(cx + dx, cy + dy); c.rotate(rot);
    const s = 1 + 0.024 * hold; c.scale(s, s);                   // the hold: a slow push and a drift
    c.translate(-cx + hold * 12 * side, -cy);
    for (const tk of lk.toks) drawToken(c, tk, t, alpha);
    drawMarks(c, lk, t, alpha);
    c.restore();
  };
  if (ue <= 0) { block(1, 0, 0, 0); c.globalAlpha = 1; return; }
  // the exit: the whole block goes in a few frames, trailing copies of itself
  const e = ue * ue * ue;
  if (lk.spec.exit === "fall") {
    for (let j = 4; j >= 1; j--) block(0.3 * (1 - j / 5), 0, e * 1350 - j * 95 * ue, 0.05 * e);
    block(1, 0, e * 1350, 0.05 * e);
  } else {
    for (let j = 4; j >= 1; j--) block(0.3 * (1 - j / 5), -e * 2500 + j * 160 * ue, 0, -0.03 * e);
    block(1, -e * 2500, 0, -0.03 * e);
  }
  c.globalAlpha = 1;
}

// =====================================================================================================================
// the sheet: the blueprint's paper, the ghosts, the site, the furniture
// =====================================================================================================================
let PAPER = null;
function paper() {
  if (PAPER) return PAPER;
  const cv = mkCanvas(W, H), g = ctx2d(cv);
  const gr = g.createRadialGradient(W * 0.5, H * 0.46, H * 0.1, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
  gr.addColorStop(0, BLUE.bg0); gr.addColorStop(1, BLUE.bg1);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // the cyanotype's mottle: big soft blooms of lighter and darker blue
  for (let i = 0; i < 70; i++) {
    const x = h32(i, 5101) * W, y = h32(i, 5102) * H, r = 80 + h32(i, 5103) * 320, light = h32(i, 5104) < 0.5;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, light ? "rgba(120,170,235,0.07)" : "rgba(6,24,60,0.09)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the drafting grid
  g.strokeStyle = "rgba(244,248,255,0.045)"; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= W; x += 24) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  g.stroke();
  g.strokeStyle = "rgba(244,248,255,0.07)"; g.beginPath();
  for (let x = 0; x <= W; x += 120) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 120) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  g.stroke();
  // grain: the paper's tooth
  for (let i = 0; i < 26000; i++) {
    const x = h32(i, 5201) * W, y = h32(i, 5202) * H;
    g.fillStyle = h32(i, 5203) < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,10,40,0.08)";
    g.fillRect(x, y, 1.3, 1.3);
  }
  return (PAPER = cv);
}
// the question's key word, left behind as a huge outline once its block has gone (the creator's reference's ghost type)
function ghost(c, lk, t, sw) {
  if (t < lk.exitAt || t >= sw) return;
  const a = ease((t - lk.exitAt) / 0.4) * 0.22, drift = (t - lk.exitAt) * 14;
  if (lk.spec.ghost === "STOCK") {
    const A = art("wide", "STOCK", 720, "ghost", 4);
    c.globalAlpha = a; c.drawImage(A.sharp, W / 2 - A.w / 2 - A.ox + drift, 420 - A.oy);
  } else {
    const A = art("wide", lk.spec.ghost, 520, "ghost", 4);
    c.save(); c.translate(W - 36, H / 2 + A.w / 2 - drift); c.rotate(-Math.PI / 2);
    c.globalAlpha = a; c.drawImage(A.sharp, -A.ox, -A.oy); c.restore();
  }
  c.globalAlpha = 1;
}
const mono = (c, s, x, y, size, col, align = "left", track = 0.08) => otext(c, s, x, y, size, { fam: "mono", align, tracking: track, color: col });
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
// the sheet's furniture: the double border with its zones, the title block with the countdown to the allocation, the
// stamp, the section and the time (the creator's reference's frame furniture, in the drawing office's own terms)
function furniture(c, t, cp) {
  const m = 26, site = cp.site;
  c.save();
  c.strokeStyle = BLUE.hair; c.lineWidth = 2; c.strokeRect(m, m, W - 2 * m, H - 2 * m);
  c.strokeStyle = BLUE.dim; c.lineWidth = 1; c.strokeRect(m + 9, m + 9, W - 2 * m - 18, H - 2 * m - 18);
  const Z = "ABCDEFGH";
  for (let i = 0; i < 8; i++) { const x = m + 9 + (W - 2 * m - 18) * (i + 0.5) / 8; mono(c, Z[i], x, m + 7, 11, BLUE.dim, "center", 0); mono(c, Z[i], x, H - m + 2, 11, BLUE.dim, "center", 0); }
  for (let i = 0; i < 5; i++) { const y = m + 9 + (H - 2 * m - 18) * (i + 0.5) / 5 + 4; mono(c, String(i + 1), m + 4.5, y, 11, BLUE.dim, "center", 0); mono(c, String(i + 1), W - m - 4.5, y, 11, BLUE.dim, "center", 0); }
  // top: the drop and the time, the way the creator's reference prints "00:05:15 · 123 BPM"
  mono(c, `OUT OF STOCK  ·  DROP ${String(cp.ci + 1).padStart(2, "0")}/03`, m + 26, m + 38, 15, BLUE.hair);
  mono(c, `${mmss(t)}  ·  150 BPM`, W - m - 26, m + 38, 15, BLUE.hair, "right");
  // the title block, bottom right
  const bw = 640, bh = 126, bx = W - m - 9 - bw, by = H - m - 9 - bh;
  c.fillStyle = "rgba(14,44,95,0.9)"; c.fillRect(bx, by, bw, bh);
  c.strokeStyle = BLUE.hair; c.lineWidth = 1.4; c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  c.beginPath(); c.moveTo(bx, by + 42); c.lineTo(bx + bw, by + 42); c.moveTo(bx + 360, by + 42); c.lineTo(bx + 360, by + bh); c.moveTo(bx, by + 84); c.lineTo(bx + 360, by + 84); c.stroke();
  mono(c, `THE BUILDINGS  ·  ${site.view}`, bx + 14, by + 29, 22, BLUE.ink, "left", 0.05);
  const field = (x, y, k, v, col = BLUE.ink) => { mono(c, k, x, y - 16, 11, BLUE.dim); mono(c, v, x, y + 4, 17, col); };
  field(bx + 14, by + 70, "SITE", site.name);
  field(bx + 190, by + 70, "SCALE", site.scale);
  field(bx + 14, by + 112, "CLIENT", "NOT YOU");
  field(bx + 190, by + 112, "SHEET", `${String(cp.ci + 1).padStart(2, "0")} / 03`);
  // the countdown to the answer: the chorus counts down to the allocation the way the intro counted down to a restock
  const left = Math.max(0, cp.sw - t);
  field(bx + 376, by + 70, "ALLOCATES IN", `T-${mmss(left)}`, left < 2 ? "#ffffff" : BLUE.ink);
  field(bx + 376, by + 112, "STATUS", t >= cp.stamp ? "" : "PENDING");
  // the stamp: APPROVED, slammed on the last syllable of the unwritten line
  if (t >= cp.stamp) {
    const e = t - cp.stamp, s = lerp(1.9, 1, easeOut(e / 0.1));
    c.save(); c.translate(bx + 500, by + 96); c.rotate(-0.12); c.scale(s, s);
    c.globalAlpha = clamp(e / 0.04 + 0.3);
    const tw = measure("wide", "APPROVED", 34) + 30;
    c.strokeStyle = BLUE.ink; c.lineWidth = 3.5; c.strokeRect(-tw / 2, -24, tw, 44);
    otext(c, "APPROVED", 0, 11, 34, { fam: "wide", align: "center", color: BLUE.ink });
    c.restore();
  }
  // bottom left: the section, as the creator's reference tags it
  mono(c, `CHORUS ${cp.ci + 1}  ·  THE QUESTIONS`, m + 26, H - m - 22, 13, BLUE.dim);
  c.restore();
}

// =====================================================================================================================
// the details: on the unwritten line the sheet answers its question without writing it -- three detail plates slam on,
// a syllable each: THE CARD (one of the storm's), THE RACK it sits in, and the hall or campus or grid it fills,
// zooming out the way the three choruses do. Each points back at the building with a detail callout, and they lift
// off together before the push in to the AltMan. On the answer, the storm's cards fly into that building
// =====================================================================================================================
const PLW = 540, PLH = 330, PLX = [78, 690, 1302], PLY = 96;
const COUNTS = [["THE HALL", "1,500 RACKS  ·  96,000 CARDS"], ["THE CAMPUS", "8 HALLS  ·  768,000 CARDS"], ["THE GRID", "87 HALLS  ·  8,352,000 CARDS"]];
function plateTimes(cp) {
  const ws = cp.q3 !== undefined ? lineWords(cp.q3) : [];
  if (ws.length < 11) return null;
  return { on: [ws[4].t - 0.035, ws[7].t - 0.035, ws[9].t - 0.035], off: ws[10].t - 0.035 };
}
function plateFrame(c, x, y, title, sub, u) {
  c.save();
  c.beginPath(); c.rect(x - 4, y - 4, PLW + 8, (PLH + 8) * easeOut(u)); c.clip();          // it drops open from its title
  c.fillStyle = "rgba(12,40,88,0.94)"; c.fillRect(x, y, PLW, PLH);
  c.strokeStyle = BLUE.hair; c.lineWidth = 1.4; c.strokeRect(x + 0.5, y + 0.5, PLW - 1, PLH - 1);
  c.fillStyle = BLUE.ink; c.fillRect(x, y, PLW, 30);
  mono(c, title, x + 12, y + 21, 15, "#123a74", "left", 0.06);
  if (sub) mono(c, sub, x + PLW - 12, y + 21, 12, "#123a74", "right", 0.04);
  c.restore();
}
// DETAIL 1: the card, in elevation -- shroud, two fans, the fingers, the bracket
function plateCard(c, x, y, u) {
  const cx = x + PLW / 2, cy = y + 188, w = 400, h = 150, x0 = cx - w / 2, y0 = cy - h / 2;
  c.save(); c.strokeStyle = BLUE.ink; c.lineWidth = 2; c.lineJoin = "round"; c.lineCap = "round";
  const seg = (a, b, k) => { if (u <= k) return; const v = clamp((u - k) / 0.3); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(lerp(a[0], b[0], v), lerp(a[1], b[1], v)); c.stroke(); };
  seg([x0, y0], [x0 + w, y0], 0); seg([x0 + w, y0], [x0 + w, y0 + h], 0.1); seg([x0 + w, y0 + h], [x0, y0 + h], 0.2); seg([x0, y0 + h], [x0, y0], 0.3);
  if (u > 0.35) {
    c.lineWidth = 1.4;
    for (const fx of [cx - 95, cx + 95]) {            // the fans, their blades swept
      c.beginPath(); c.arc(fx, cy, 58, 0, Math.PI * 2 * clamp((u - 0.35) / 0.35)); c.stroke();
      if (u > 0.6) { c.beginPath(); c.arc(fx, cy, 14, 0, 7); c.stroke(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; c.beginPath(); c.moveTo(fx + Math.cos(a) * 16, cy + Math.sin(a) * 16); c.quadraticCurveTo(fx + Math.cos(a + 0.5) * 40, cy + Math.sin(a + 0.5) * 40, fx + Math.cos(a + 0.9) * 55, cy + Math.sin(a + 0.9) * 55); c.stroke(); } }
    }
  }
  if (u > 0.6) {
    c.lineWidth = 1.2; c.strokeStyle = BLUE.hair;
    c.strokeRect(x0 + 60, y0 + h, 210, 12);            // the PCIe fingers
    for (let i = 0; i < 26; i++) { c.beginPath(); c.moveTo(x0 + 66 + i * 7.8, y0 + h + 2); c.lineTo(x0 + 66 + i * 7.8, y0 + h + 10); c.stroke(); }
    c.strokeRect(x0 - 16, y0 - 8, 16, h + 26);         // the bracket
  }
  if (u > 0.8) { c.strokeStyle = BLUE.hair; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0 - 26); c.lineTo(x0 + w, y0 - 26); c.stroke(); mono(c, "267 MM", cx, y0 - 32, 12, BLUE.hair, "center"); }
  c.restore();
}
// DETAIL 2: the rack -- eight nodes, eight cards in each
function plateRack(c, x, y, u) {
  const rx = x + 70, ry = y + 56, rw = 150, rh = 250;
  c.save(); c.strokeStyle = BLUE.ink; c.lineWidth = 2;
  c.strokeRect(rx, ry, rw, rh * clamp(u / 0.35));
  c.lineWidth = 1.1; c.strokeStyle = BLUE.hair;
  const n = Math.floor(8 * clamp((u - 0.3) / 0.5));
  for (let i = 0; i < n; i++) {
    const ny = ry + 10 + i * 29;
    c.strokeRect(rx + 8, ny, rw - 16, 24);
    for (let j = 0; j < 8; j++) { c.beginPath(); c.moveTo(rx + 16 + j * 16, ny + 5); c.lineTo(rx + 16 + j * 16, ny + 19); c.stroke(); }
  }
  if (u > 0.75) {
    c.strokeStyle = BLUE.hair; c.beginPath(); c.moveTo(rx + rw + 8, ry + 10); c.lineTo(rx + rw + 46, ry + 10); c.lineTo(rx + rw + 46, ry + 34); c.stroke();
    mono(c, "8 NODES", rx + rw + 58, ry + 60, 18, BLUE.ink);
    mono(c, "× 8 CARDS", rx + rw + 58, ry + 90, 18, BLUE.ink);
    mono(c, "= 64 / RACK", rx + rw + 58, ry + 132, 22, "#ffffff");
    mono(c, "42 KW", rx + rw + 58, ry + 170, 14, BLUE.dim);
  }
  c.restore();
}
// DETAIL 3: the plan -- rows of racks, and the count for this chorus's site
function plateField(c, x, y, u, ci) {
  const cols = [14, 20, 26][ci] ?? 14, rows = [6, 8, 10][ci] ?? 6, gx = x + 30, gy = y + 60, gw = PLW - 60, gh = 190;
  c.save(); c.strokeStyle = BLUE.hair; c.lineWidth = 1;
  const n = Math.floor(rows * clamp(u / 0.6));
  for (let r = 0; r < n; r++) for (let j = 0; j < cols; j++) {
    const w = gw / cols, h = gh / rows;
    c.strokeRect(gx + j * w + w * 0.12, gy + r * h + h * 0.18, w * 0.76, h * 0.64);
  }
  if (u > 0.7) { mono(c, COUNTS[ci]?.[1] ?? "", x + PLW / 2, y + PLH - 26, 17, "#ffffff", "center", 0.05); }
  c.restore();
}
function plates(c, t, cp, V) {
  const T = cp.plates;
  if (!T || t < T.on[0] || t > T.off + 0.2) return;
  const lift = clamp((t - T.off) / 0.16), dy = -easeOut(lift) * 520;
  const ci = cp.ci;
  const titles = [["DETAIL 1  ·  THE CARD", "1 OF MANY"], ["DETAIL 2  ·  THE RACK", ""], [`DETAIL 3  ·  ${COUNTS[ci]?.[0] ?? "THE SITE"}`, ""]];
  // the callouts: a ring on the building (the front hall's facade) and a leader up to each plate
  const tgt = cp.targets[Math.floor(cp.targets.length / 2)], at = V.at(tgt?.c ?? [0, 0, -30]);
  for (let i = 0; i < 3; i++) {
    if (t < T.on[i]) continue;
    const u = clamp((t - T.on[i]) / 0.3), slam = since(t, T.on[i], 0.07), x = PLX[i], y = PLY + dy;
    c.save();
    c.globalAlpha = 1 - lift;
    c.translate(x + PLW / 2, y + PLH / 2); c.scale(1 + slam * 0.06, 1 + slam * 0.06); c.translate(-(x + PLW / 2), -(y + PLH / 2));
    if (at && u > 0.5) {
      c.strokeStyle = BLUE.hair; c.lineWidth = 1.2; c.setLineDash([7, 5]);
      c.beginPath(); c.moveTo(x + PLW / 2, y + PLH); c.lineTo(lerp(x + PLW / 2, at.x, clamp((u - 0.5) / 0.4)), lerp(y + PLH, at.y, clamp((u - 0.5) / 0.4))); c.stroke();
      c.setLineDash([]); if (u > 0.9) { c.beginPath(); c.arc(at.x, at.y, 26 + i * 14, 0, 7); c.stroke(); }
    }
    plateFrame(c, x, y, titles[i][0], titles[i][1], u);
    if (i === 0) plateCard(c, x, y, clamp((u - 0.2) / 0.8));
    if (i === 1) plateRack(c, x, y, clamp((u - 0.2) / 0.8));
    if (i === 2) plateField(c, x, y, clamp((u - 0.2) / 0.8), ci);
    c.restore();
  }
}

// =====================================================================================================================
// the plan, the lights, the targets, and the two layers' frames
// =====================================================================================================================
// one plan per chorus: its lines, its two blocks, its site with every stroke on a syllable, the switch. altman = the
// director's plan for the AltMan (the switch is the frame his smug face lands on "COMPUTE")
export function chorusPlan(altman) {
  return song.sections.filter(s => s.kind === "chorus").map(s => {
    const find = re => s.lines.find(li => re.test(lines[li].text));
    const q1 = find(/out of stock/i), q2 = find(/signed/i), q3 = find(/wafer/i), ans = find(/compute for us/i);
    const p = altman.find(a => a.its >= s.t0 - 0.5 && a.its <= s.t1 + 0.5);
    if (q1 === undefined || q2 === undefined || ans === undefined || !p) return null;
    // the syllables the site is drawn on: the two questions and the unwritten third line, thirty-four in all
    const ws = [q1, q2, q3].filter(li => li !== undefined).flatMap(li => lineWords(li));
    const G = g => g < ws.length ? ws[g].t - 0.03 : ws[ws.length - 1].t + (g - ws.length + 1) * 0.12;
    const site = buildSite(s.index, G);
    const w2 = lineWords(q2)[0].t, w3 = q3 !== undefined ? lineWords(q3)[0].t : p.enter;
    const cp = { ci: s.index, s, q1, q2, q3, ans, p, sw: p.reveal, enter: p.enter, t0: s.t0 - 0.35, ansT: song.lineStart(ans), G, site,
      locks: [lockup(LOCKS.q1, q1, w2 - 0.12), lockup(LOCKS.q2, q2, w3 - 0.12)], stamp: G(33) };
    // the storm's targets: the windows of the front row (the ones big enough to see a card go into)
    const front = Math.max(...site.cells.map(q => q.z));
    cp.targets = site.cells.filter(q => q.z === front);
    cp.plates = plateTimes(cp);
    // each card flies into a window, and the window flashes when it arrives (arrival: the director's own suck-in
    // clock, 1.4 s after its dealt start on the answer line)
    cp.arrive = new Map();
    for (const id of [...Array(18).keys(), ...Array.from({ length: 12 }, (_, i) => 100 + i)]) {
      const q = cp.targets[Math.floor(h32(id, 991) * cp.targets.length)], ta = cp.ansT + h32(id, 10) * 0.5 + 1.4;
      (cp.arrive.get(q.id) ?? cp.arrive.set(q.id, []).get(q.id)).push(ta);
    }
    return cp;
  }).filter(Boolean);
}
export const planAt = (plans, t) => plans.find(cp => t >= cp.t0 - 1e-6 && cp.s === song.sectionAt(t)) ?? null;
// where card `id` flies on the answer: a window on the front row, in world units
export const stormTarget = (cp, id) => cp.targets[Math.floor(h32(id, 991) * cp.targets.length)].c;
export const dotTarget = (cp, i) => cp.targets[i % cp.targets.length].c;
// a window's light on the red half: lit on the beat's own dealt pattern, brighter on the kick, white-hot when a card
// has just gone into it
function litAt(cp, q, t, k) {
  const tick = Math.floor(song.beatAt(t) * 2);
  let v = h32(q.id, tick, 77) < 0.28 + k * 0.4 ? 0.5 + k * 0.5 : 0.1;
  for (const ta of cp.arrive.get(q.id) ?? []) { const f = since(t, ta, 0.2); if (f > 0.03) v = Math.max(v, 1 + f); }
  return v;
}

// the blue half's camera, one continuous move (lesson L87: a channel evaluated every frame, never per-line constants),
// always LEVEL so the drawing's verticals stay vertical (a front elevation; the first cut looked down and keystoned
// the hall into a trapezoid). Keyed on the song: a slow truck across the hall while the two questions are set; on the
// unwritten line a pull back and up that reveals the whole site and the power line to the horizon (further for the
// bigger sites); a drift; and in the second and a quarter before the AltMan arrives, the push into the drop's own
// camera (R: that camera's pose this frame), so he comes in from where he always did. Each stretch eases in and out:
// the position never jumps; the camera settles at each key and goes again
export function blueCam(cp, t, k, R) {
  const ci = cp.ci, w3 = cp.q3 !== undefined ? lineWords(cp.q3)[0].t : cp.enter - 3;
  const k3 = lerp(w3, cp.enter, 0.55), k4 = cp.enter - 1.25;
  const lvl = (x, y, z, lx) => ({ eye: [x, y, z], look: [lx, y + 0.05, 0] });
  const P0 = lvl(-3.5, 2.4, 15, -2.6), P1 = lvl(4, 2.8, 13.5, 3.4);
  // the reveal: the hall is a front elevation, seen level; the campus and the grid are seen from the air, looking
  // down over them (a low hall's verticals are short, so the tilt costs nothing there), and the push back in to the
  // AltMan's framing becomes a swoop down into it
  const P2 = ci === 0 ? lvl(9, 4, 25, 12) : ci === 1 ? { eye: [8, 16, 44], look: [10, -18, -120] } : { eye: [6, 58, 44], look: [8, -24, -330] };
  const P3 = { eye: [P2.eye[0] - 1.6, P2.eye[1] - 0.3, P2.eye[2] + 1.5], look: [P2.look[0] - 2, P2.look[1], P2.look[2]] };
  // a blend of two poses moves the eye and turns the VIEW DIRECTION on the same ease (lerping the look targets instead
  // turned the camera late: at the end of the swoop the far target's last few percent swung the view in the final
  // frames, measured by tools/seams.mjs at 25 px a frame against 7.6 around it)
  const dirOf = P => { const d = [P.look[0] - P.eye[0], P.look[1] - P.eye[1], P.look[2] - P.eye[2]], l = Math.hypot(...d); return d.map(v => v / l); };
  const mixP = (A, B, u) => {
    const eye = A.eye.map((v, j) => lerp(v, B.eye[j], u)), da = dirOf(A), db = dirOf(B), d = da.map((v, j) => lerp(v, db[j], u)), l = Math.hypot(...d);
    return { eye, look: eye.map((v, j) => v + d[j] / l * 10) };
  };
  let P = t < w3 ? mixP(P0, P1, ease((t - cp.t0) / (w3 - cp.t0))) : t < k3 ? mixP(P1, P2, ease((t - w3) / (k3 - w3))) : mixP(P2, P3, ease((t - k3) / Math.max(0.1, k4 - k3)));  let fov = (t < w3 ? 48 : lerp(48, 52, ease((t - w3) / (k3 - w3)))) - k * 2;
  let roll = 0;
  if (t >= k4) {                                   // the push in, onto the drop's own moving camera
    const u = ease((t - k4) / (cp.enter - k4));
    P = mixP(P, { eye: R.pos, look: R.look }, u); fov = lerp(fov, R.fov, u); roll = lerp(0, R.roll, u);
  }
  return { eye: P.eye, look: P.look, roll, fov };
}

// a full-frame layer's canvas for this frame: captures draw every frame on a canvas of their own (lesson L80)
function frameCanvas(L) {
  if (EXACT) { const cv = mkCanvas(L.canvas.width, L.canvas.height); L.canvas = cv; L.ctx = ctx2d(cv); L.tex.image = cv; }
  return L.begin();
}
// THE SHEET (S.sheet, screen space, drawn before the scene): blue = the paper, the ghosts, the site, the furniture;
// red = the site alone, in red, over the drop's own night (the layer is clear everywhere else)
export function chorusSheet(t, S, cp, red, k) {
  const L = S.sheet, c = frameCanvas(L);
  L.mesh.visible = true;
  const V = viewOf(S.camera);
  if (!red) {
    c.drawImage(paper(), 0, 0);
    for (const lk of cp.locks) ghost(c, lk, t, cp.sw);
  }
  drawSite(c, V, cp.site, t, { red, k, lit: (q, tt) => litAt(cp, q, tt, k) });
  if (!red) { plotter(c, V, cp.site, t, cp.stamp); plates(c, t, cp, V); furniture(c, t, cp); }
  L.end();
}
// THE LOCKUP (S.lock, screen space, over the scene): the two questions (a hidden line, ?hide=, draws no block)
export function chorusType(t, S, cp, hidden = () => false) {
  const on = cp.locks.filter(lk => !hidden(lk.li) && t >= lk.t0 - 0.05 && t < lk.exitAt + 0.2);
  if (!on.length) return;
  const L = S.lock, c = frameCanvas(L);
  L.mesh.visible = true;
  c.save();
  for (const lk of on) drawLock(c, lk, t);
  c.restore();
  L.end();
}
// the looks worth rendering once at boot (first draws, lesson L80) and in the preview's warm-up
export function chorusTimes(plans) {
  const ts = [];
  for (const cp of plans) {
    for (const lk of cp.locks) { for (const tk of lk.toks) if (tk.word) ts.push(tk.word.t + 0.02); ts.push(lk.exitAt + 0.06, lk.exitAt + 0.3); }
    ts.push((cp.sw + cp.enter) / 2, cp.sw + 0.1, cp.sw + 0.6, cp.stamp + 0.05);
    if (cp.plates) ts.push(...cp.plates.on.map(x => x + 0.12), cp.plates.off + 0.08);
  }
  return ts;
}
// what the headless probes read (tools/probe-chorus.mjs, tools/seams.mjs). events: every moment the chorus DECLARES
// a change -- the shot's cut, every sung word (a word slams in, or a stroke group starts), the blocks' exits, the
// camera's keys, the AltMan's own plan -- so a big frame-to-frame change anywhere else is a seam (lesson L87)
export function chorusProbe(plans) {
  return plans.map(cp => {
    const p = cp.p;
    // [from, to]: a word's entrance (and the stroke group it starts), the signature, each block's exit, the push into
    // the AltMan's framing, and the AltMan's own moves (his flight in, the turn and the crash zoom to the pull back,
    // the creator's two inverted frames, the print pass, the dance -- the answer's half is the drop as it was)
    const words = [cp.q1, cp.q2, cp.q3, cp.ans].filter(li => li !== undefined).flatMap(li => lineWords(li).map(w => [w.t - 0.035, w.t + 0.13]));
    const sig = cp.locks[1].find("SIGNED");
    const rethrow = cp.s.lines.map(li => [song.lineStart(li) - 0.1, song.lineStart(li)]);   // each line throws the storm again (the old choreography, kept)
    const events = [[cp.t0, cp.t0], ...rethrow, ...words, ...(sig ? [[sig.t + 0.1, sig.t + 0.48]] : []), ...cp.locks.map(lk => [lk.exitAt, lk.exitAt + 0.19]),
      [cp.enter - 1.25, cp.enter], [p.enter, p.land + 0.3], [p.spin0, p.pull1 + 0.1], [p.reveal, p.reveal + 0.1], [p.print0, p.d0 + 0.2], [p.d0, p.end], [cp.stamp, cp.stamp + 0.12]];
    return {
      ci: cp.ci, t0: +cp.t0.toFixed(3), sw: +cp.sw.toFixed(3), enter: +cp.enter.toFixed(3), stamp: +cp.stamp.toFixed(3), ansT: +cp.ansT.toFixed(3),
      targets: cp.targets.length, cells: cp.site.cells.length, parts: cp.site.parts.length, events: events.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]),
      // what may move the CAMERA abruptly: the shot's cut and the AltMan's crash zoom (the kicks are added by the tool)
      camEvents: [[cp.t0, cp.t0], [p.spin0, p.pull1 + 0.1]].map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]),
      locks: cp.locks.map(lk => ({ t0: +lk.t0.toFixed(3), exitAt: +lk.exitAt.toFixed(3), words: lk.toks.map(tk => `${tk.text}@${tk.word ? tk.word.t.toFixed(2) : "MISSING"}`) })),
    };
  });
}
