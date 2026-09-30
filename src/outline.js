// Type drawn as its OUTLINES (filled Path2D), letter by letter: Anton for the display voice, Plex Mono SemiBold for
// the small print. The browser's own text rendering keeps a cache of letter shapes whose pixels depend on which frames
// drew them first (lesson L80: +-2/255 at letter edges by render order, on a fresh canvas), and verse 3's words move,
// scale and turn every frame; a filled path has no such history. Letter by letter so a word can be stamped, stretched,
// stuttered or dropped one glyph at a time (steps 26-27, meltdown.js).
import { parse as parseFont } from "../vendor/opentype.min.mjs";      // opentype.js 2.0.0, MIT (vendor/LICENSE-opentype.txt)

const F = {}, UNIT = 1000, G = new Map();
export async function loadOutlineFonts() {
  for (const [k, url] of [["anton", "fonts/Anton-Regular.ttf"], ["mono", "fonts/IBMPlexMono-SemiBold.ttf"],
    // the chorus's three voices (chorus.js, 9/29): Archivo cut at four widths and weights (tools/cut-archivo.py)
    ["wide", "fonts/Archivo-WideBlack.ttf"], ["cond", "fonts/Archivo-CondExtraBold.ttf"],
    ["condit", "fonts/Archivo-CondExtraBoldItalic.ttf"], ["conn", "fonts/Archivo-SemiCondItalic.ttf"]])
    F[k] = parseFont(await (await fetch(url)).arrayBuffer());
}
// one glyph at UNIT size: its outline (baseline at y 0, x from 0), advance, and ink box (y up is negative)
export function glyph(fam, ch) {
  const key = fam + "\u0000" + ch;
  let g = G.get(key);
  if (!g) {
    const f = F[fam], gl = f.charToGlyph(ch), m = gl.getMetrics(), k = UNIT / f.unitsPerEm;
    g = { path: new Path2D(f.getPath(ch, 0, 0, UNIT).toPathData(2)), adv: f.getAdvanceWidth(ch, UNIT), gl,
          x0: m.xMin * k, x1: m.xMax * k, top: -m.yMax * k, bottom: -m.yMin * k };
    G.set(key, g);
  }
  return g;
}
// the kerning between two letters at UNIT size
export const kern = (fam, a, b) => { const f = F[fam]; return f.getKerningValue(glyph(fam, a).gl, glyph(fam, b).gl) * UNIT / f.unitsPerEm; };
export const OUTLINE_UNIT = UNIT;
// cap height of a family at a size (the H's ink top)
export const capHeight = (fam, size) => -glyph(fam, "H").top * size / UNIT;

// each letter's x offset from the start and the whole width, at a size; tracking in em
export function layout(fam, s, size, tracking = 0) {
  const k = size / UNIT, xs = [];
  let x = 0;
  for (let i = 0; i < s.length; i++) {
    if (i) x += (kern(fam, s[i - 1], s[i]) + tracking * UNIT) * k;
    xs.push(x);
    x += glyph(fam, s[i]).adv * k;
  }
  return { xs, w: x };
}
export const measure = (fam, s, size, tracking = 0) => layout(fam, s, size, tracking).w;

// draw one glyph with its baseline-left at (0, 0) of the current transform, size px
export function drawGlyph(c, fam, ch, size) {
  if (ch === " ") return;
  const k = size / UNIT;
  c.save(); c.scale(k, k); c.fill(glyph(fam, ch).path); c.restore();
}
export function strokeGlyph(c, fam, ch, size, lw) {
  if (ch === " ") return;
  const k = size / UNIT;
  c.save(); c.scale(k, k); c.lineWidth = lw / k; c.lineJoin = "round"; c.stroke(glyph(fam, ch).path); c.restore();
}

// a line of text as outlines; o: { fam, align, tracking, color, alpha, outline: [color, width] (drawn under) }.
// Returns the drawn width
export function outline(c, s, x, y, size, o = {}) {
  const fam = o.fam ?? "anton", L = layout(fam, s, size, o.tracking ?? 0), al = o.align ?? "left";
  const x0 = al === "center" ? x - L.w / 2 : al === "right" ? x - L.w : x;
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  if (o.outline) {
    c.strokeStyle = o.outline[0];
    for (let i = 0; i < s.length; i++) { c.save(); c.translate(x0 + L.xs[i], y); strokeGlyph(c, fam, s[i], size, o.outline[1]); c.restore(); }
  }
  c.fillStyle = o.color ?? "#fff";
  for (let i = 0; i < s.length; i++) { c.save(); c.translate(x0 + L.xs[i], y); drawGlyph(c, fam, s[i], size); c.restore(); }
  c.restore();
  return L.w;
}
