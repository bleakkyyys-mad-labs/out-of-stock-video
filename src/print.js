// The print shop: photos turned into ink on paper, made once at boot (nothing here runs per frame).
//   makePrint        the video's print: the cutout's silhouette in ink, light dots where the photo is bright
//   makeScreenPrint  a posterized screen print: the photo's tone cut into flat levels, each laid as its own screen
//   newsPage, halftoneInk, eyePrints   newsprint: the page, one plate of round dots, the eye's flipbook
import { ctx2d } from "./type.js";
import { h32 } from "./song.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const INK = "#15131a", BONE = "#f4f1ea";
export function tile(w, h, draw) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(ctx2d(cv)); return cv; }
// a canvas for pixel work: always the CPU raster (getImageData on it is cheap)
function work(w, h) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return { cv, g: cv.getContext("2d", { willReadFrequently: true }) }; }
const rgb = s => { const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const GAMMA = new Float32Array(256).map((_, i) => Math.pow(i / 255, 2.2));
// display-referred luma, the measure prep-assets.py's `lum` uses
const luma = (p, j) => Math.pow(0.2126 * GAMMA[p[j]] + 0.7152 * GAMMA[p[j + 1]] + 0.0722 * GAMMA[p[j + 2]], 0.4545);

// our own mip chain: each level half the last, so a print is never drawn below half a level's size. (Drawn far
// below its size, the browser decoded a scaled copy of it and kept it: a later frame drawing the same print came out
// different by 1/255 over the whole frame, depending on which frame had drawn it small before. Measured at 45.0.)
function mips(out) {
  const levels = [out];
  while (levels[levels.length - 1].width > 40) { const p = levels[levels.length - 1]; levels.push(tile(Math.round(p.width / 2), Math.round(p.height / 2), g => g.drawImage(p, 0, 0, Math.round(p.width / 2), Math.round(p.height / 2)))); }
  return levels;
}
export const level = (levels, w) => { let L = levels[0]; for (const x of levels) if (x.width >= w) L = x; return L; };

// a photo cutout as print: the silhouette in ink, light dots where the photo is bright (a 45-degree screen); gain
// puts every photo's median tone at the same place, like the screentone shader's sticks
export function makePrint(img, width, lum, pitch = 11) {
  const h = Math.round(width * img.height / img.width);
  const src = document.createElement("canvas"); src.width = width; src.height = h;
  const g = src.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, width, h);
  const px = g.getImageData(0, 0, width, h).data;
  const out = tile(width, h, o => {
    o.drawImage(src, 0, 0);
    o.globalCompositeOperation = "source-in"; o.fillStyle = INK; o.fillRect(0, 0, width, h);
    o.globalCompositeOperation = "source-over"; o.fillStyle = BONE;
    const cs = Math.cos(0.785), sn = Math.sin(0.785), R = Math.hypot(width, h), gain = -(lum - 0.5) * 1.3 - 0.14;
    for (let v = -R; v < R; v += pitch) for (let u = -R; u < R; u += pitch) {
      const x = width / 2 + u * cs - v * sn, y = h / 2 + u * sn + v * cs;
      if (x < 0 || y < 0 || x >= width || y >= h) continue;
      const i = ((y | 0) * width + (x | 0)) * 4;
      if (px[i + 3] < 160) continue;
      const L = Math.pow((px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255, 0.4545);
      const r = Math.sqrt(clamp((L - 0.5) * 1.7 + 0.5 + gain)) * pitch * 0.6;
      if (r < 0.7) continue;
      o.beginPath(); o.arc(x, y, r, 0, 7); o.fill();
    }
  });
  return { print: out, mask: src, levels: mips(out) };
}

// a box blur of v weighted by a (the cutout's alpha), so tone from outside the silhouette never bleeds in
function normBlur(v, a, W, H, rad) {
  if (rad < 1) return v;
  const pass = (src, horiz) => {
    const out = new Float32Array(W * H), n = horiz ? W : H, m = horiz ? H : W, st = horiz ? 1 : W, row = horiz ? W : 1;
    for (let j = 0; j < m; j++) {
      const base = j * row;
      let acc = 0;
      for (let k = -rad; k <= rad; k++) acc += src[base + clamp(k, 0, n - 1) * st];
      for (let i = 0; i < n; i++) {
        out[base + i * st] = acc / (2 * rad + 1);
        acc += src[base + Math.min(n - 1, i + rad + 1) * st] - src[base + Math.max(0, i - rad) * st];
      }
    }
    return out;
  };
  const va = v.map((x, i) => x * a[i]);
  let num = pass(pass(va, true), false), den = pass(pass(a, true), false);
  num = pass(pass(num, true), false); den = pass(pass(den, true), false);
  return num.map((x, i) => den[i] > 1e-4 ? x / den[i] : v[i]);
}

// the ink fraction of a screen at a point (u, w in cells), anti-aliased over a pixel. Round dots and diamonds grow
// from the cell centres up to half cover, then turn into paper dots shrinking at the cell corners (the way a real
// screen closes up); lines thicken; a crosshatch is two line screens at right angles.
function screen(shape, cov, u, w, pitch) {
  if (cov <= 0) return 0;
  if (cov >= 1) return 1;
  const fu = u - Math.floor(u) - 0.5, fw = w - Math.floor(w) - 0.5, gu = u - Math.round(u), gw = w - Math.round(w);
  let d;                                                  // distance to the ink's edge in cells, negative inside the ink
  if (shape === "line") d = Math.abs(fw) - cov / 2;
  else if (shape === "cross") d = Math.min(Math.abs(fu), Math.abs(fw)) - (1 - Math.sqrt(1 - cov)) / 2;
  else if (shape === "diamond") d = cov <= 0.5 ? (Math.abs(fu) + Math.abs(fw) - Math.sqrt(cov / 2)) / Math.SQRT2 : (Math.sqrt((1 - cov) / 2) - Math.abs(gu) - Math.abs(gw)) / Math.SQRT2;
  else d = cov <= 0.5 ? Math.sqrt(fu * fu + fw * fw) - Math.sqrt(cov / Math.PI) : Math.sqrt((1 - cov) / Math.PI) - Math.sqrt(gu * gu + gw * gw);
  return clamp(0.5 - d * pitch);
}

// ---------- the screen print (the creator's note, 9/26 22:45: "vary the values of posterization and screen tone effects") ----------
// The photo's tone, normalised so its median sits at mid-grey (every photo prints alike, like makePrint's gain) and
// softened a little so the tone edges come out as shapes instead of speckle, is cut into flat levels. Each level is
// laid as a uniform screen of its own coverage (solid ink at the bottom, bare paper at the top) in the recipe's shape,
// pitch and angle, the way screentone sheets are cut and laid by hand. One ink per level, so a spot colour on a middle
// level makes it a duotone. The cutout's own alpha is the print's edge; a keyline of ink goes round it.
//   r.cover  ink fraction per level, darkest first ([1, 0.5, 0] = solid, a half screen, paper)
//   r.inks   a colour per level (the paper levels' entry is ignored)
//   r.shape  "dot" | "line" | "diamond" | "cross";  r.pitch  px per cell at `width`;  r.angle  degrees
//   r.contrast, r.bias  the tone curve around the median;  r.soften  blur radius in px;  r.paper  the body colour
//   r.key    keyline width in px (0 = none);  r.keyCol
export function makeScreenPrint(img, width, lum, r) {
  const n = r.cover.length, pitch = r.pitch, key = r.key ?? 0, pad = Math.ceil(key) + 2;
  const h = Math.round(width * img.height / img.width), W = width + 2 * pad, H = h + 2 * pad, N = W * H;
  const { g } = work(W, H);
  g.imageSmoothingQuality = "high"; g.drawImage(img, pad, pad, width, h);
  const px = g.getImageData(0, 0, W, H).data;
  let v = new Float32Array(N);
  const A = new Float32Array(N);
  for (let i = 0; i < N; i++) { A[i] = px[i * 4 + 3] / 255; v[i] = A[i] > 0 ? luma(px, i * 4) : 0; }
  v = normBlur(v, A, W, H, r.soften ?? 1);
  const con = r.contrast ?? 1.6, bias = r.bias ?? 0;
  for (let i = 0; i < N; i++) v[i] = clamp((v[i] - lum) * con + 0.5 + bias, 0, 0.99999);
  const paper = rgb(r.paper ?? BONE), inks = r.inks.map(c => rgb(c ?? INK));
  const rad = (r.angle ?? 45) * Math.PI / 180, ca = Math.cos(rad) / pitch, sa = Math.sin(rad) / pitch;
  const img2 = new ImageData(W, H), o = img2.data, mix = [0, 0, 0];
  const add = (q, u, w, k) => {                            // level q's colour at this pixel, weight k, into mix
    const s = screen(r.shape ?? "dot", r.cover[q], u, w, pitch), ink = inks[q];
    for (let c = 0; c < 3; c++) mix[c] += k * (paper[c] + (ink[c] - paper[c]) * s);
  };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, a = A[i];
    if (a <= 0) continue;
    const f = v[i] * n, q = Math.min(n - 1, Math.floor(f));             // q: 0 = the darkest level (cover[0])
    const u = (x + 0.5) * ca + (y + 0.5) * sa, w = -(x + 0.5) * sa + (y + 0.5) * ca;
    // anti-alias the level edges: within half a pixel of a threshold, blend with the level across it
    const gx = v[i + 1] - v[i - 1], gy = v[i + W] - v[i - W], gm = Math.sqrt(gx * gx + gy * gy) * 0.5 * n + 1e-6;
    let wUp = q < n - 1 ? clamp(0.5 - (q + 1 - f) / gm) : 0, wDn = q > 0 ? clamp(0.5 - (f - q) / gm) : 0;
    if (wUp + wDn > 1) { const s = wUp + wDn; wUp /= s; wDn /= s; }
    mix[0] = mix[1] = mix[2] = 0;
    add(q, u, w, 1 - wUp - wDn);
    if (wUp > 0) add(q + 1, u, w, wUp);
    if (wDn > 0) add(q - 1, u, w, wDn);
    const j = i * 4;
    o[j] = mix[0]; o[j + 1] = mix[1]; o[j + 2] = mix[2]; o[j + 3] = a * 255;
  }
  const body = tile(W, H, x => x.putImageData(img2, 0, 0));
  const sil = tile(W, H, x => { x.drawImage(body, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = r.keyCol ?? INK; x.fillRect(0, 0, W, H); });
  const ring = x => { if (key) for (const rr of [key, key * 0.5]) for (let k = 0; k < 16; k++) { const t = k * Math.PI / 8; x.drawImage(sil, Math.cos(t) * rr, Math.sin(t) * rr); } };
  const print = tile(W, H, x => { ring(x); x.drawImage(body, 0, 0); });
  const mask = tile(W, H, x => { ring(x); x.drawImage(sil, 0, 0); });
  return { print, mask, levels: mips(print) };
}

// ---------- newsprint (the creator's note, 9/26 22:45: the eyes "feel a little amateurish. Needs more details or style. I was
// leaning newspaper/low-frame rate") ----------

// the page: newsprint's warm grey, cloudy where the pulp lay thicker, with fibres and specks; made once
export function newsPage(w, h, base = "#e8e1cd") {
  return tile(w, h, g => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (const [cell, amp, seed] of [[120, 0.55, 1], [26, 0.35, 2]]) {         // clouds: hashed greys drawn up smooth
      const nw = Math.ceil(w / cell) + 2, nh = Math.ceil(h / cell) + 2;
      const n = tile(nw, nh, s => { const im = s.createImageData(nw, nh); for (let i = 0; i < nw * nh; i++) { const v = 96 + h32(i, seed, 1201) * 64; im.data.set([v, v, v, 255], i * 4); } s.putImageData(im, 0, 0); });
      g.save(); g.globalAlpha = amp; g.globalCompositeOperation = "soft-light"; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(n, -cell, -cell, nw * cell, nh * cell); g.restore();
    }
    g.lineCap = "round";
    for (let i = 0; i < 700; i++) {                                                // fibres, dark and light
      const x = h32(i, 1211) * w, y = h32(i, 1212) * h, a = h32(i, 1213) * Math.PI * 2, L = 5 + h32(i, 1214) * 24, bend = (h32(i, 1215) - 0.5) * 9;
      g.strokeStyle = h32(i, 1216) < 0.7 ? `rgba(92,78,58,${0.06 + h32(i, 1217) * 0.1})` : `rgba(255,252,240,${0.18 + h32(i, 1217) * 0.22})`;
      g.lineWidth = 0.6 + h32(i, 1218) * 0.9;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * L / 2 - Math.sin(a) * bend, y + Math.sin(a) * L / 2 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(40,32,24,${0.1 + h32(i, 1221) * 0.3})`; g.beginPath(); g.arc(h32(i, 1222) * w, h32(i, 1223) * h, 0.4 + h32(i, 1224) * 0.9, 0, 7); g.fill(); }
  });
}

// a picture (a canvas at the print's own size) the way a newspaper prints it: one plate of round dots on a screen at
// `angle`, the dot's size is the tone (black..white spans the picture's range, gamma bends the middle), the dots spread
// into the paper (dot gain, most in the middle tones, as on the press) and their edges go soft the way ink sits in
// newsprint. `shift` moves the screen by a fraction of a cell: each drawing of a flipbook gets its own, so the dots
// re-deal between drawings (the boil). Returns the ink alone on transparent, so the page shows between the dots.
export function halftoneInk(src, o = {}) {
  const W = src.width, H = src.height, pitch = o.pitch ?? 9, aa = pitch / (o.soft ?? 1.2);
  const px = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const b = o.black ?? 0.08, wt = o.white ?? 0.92, gm = o.gamma ?? 1, gain = o.gain ?? 0.12, ink = rgb(o.ink ?? "#1b1918");
  const rad = (o.angle ?? 45) * Math.PI / 180, ca = Math.cos(rad) / pitch, sa = Math.sin(rad) / pitch, [su, sv] = o.shift ?? [0, 0];
  const out = new ImageData(W, H), d = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = (y * W + x) * 4;
    if (px[j + 3] === 0) continue;
    let t = clamp((luma(px, j) - b) / (wt - b));
    if (gm !== 1) t = Math.pow(t, gm);
    let cov = 1 - t;
    cov = clamp(cov + gain * 4 * cov * (1 - cov));
    const u = (x + 0.5) * ca + (y + 0.5) * sa + su, w = -(x + 0.5) * sa + (y + 0.5) * ca + sv;
    const a = screen("dot", cov, u, w, aa) * px[j + 3] / 255;
    if (a <= 0) continue;
    d[j] = ink[0]; d[j + 1] = ink[1]; d[j + 2] = ink[2]; d[j + 3] = a * 255;
  }
  return tile(W, H, g => g.putImageData(out, 0, 0));
}

// the eye's flipbook. The photo cropped to the eye (the view); for the blink's drawings the upper lid comes down over
// the eye, column by column: the lashes ride down with the lid's margin unstretched, the lid skin above them stretches
// to follow (it comes from above the view, where the photo has it), the eyeball below stays where it is (the lower
// lid hardly moves in a blink); shut, the lashes hang down over the lower lid. Every drawing printed as newsprint with
// its own screen offset.
//   spec (texture uv, y down): view [x0, y0, x1, y1]; top: where the photo is read from above the view; upper, lower:
//   the lid margins as polylines corner to corner, x ascending; lash, skin: the heights above the upper margin of the
//   lashes and of the lid skin above them; iris [u, v, r] (r in u units)
//   drawings: [{ close: 0..1, shift: [u, v] }];  o.tone: halftoneInk's options;  o.veins: add the red plate
export function eyePrints(img, spec, PW, drawings, o = {}) {
  const [x0, y0, x1, y1] = spec.view, top = spec.top ?? y0, sw = (x1 - x0) * img.width, s = PW / sw;
  const PH = Math.round((y1 - y0) * img.height * s), WH = Math.round((y1 - top) * img.height * s), off = Math.round((y0 - top) * img.height * s);
  const base = work(PW, WH);
  base.g.imageSmoothingQuality = "high"; base.g.drawImage(img, x0 * img.width, top * img.height, sw, (y1 - top) * img.height, 0, 0, PW, WH);
  const X = u => (u - x0) / (x1 - x0) * PW, Y = v => (v - top) * img.height * s;
  const view = cv => { const v = work(PW, PH); v.g.drawImage(cv, 0, off, PW, PH, 0, 0, PW, PH); return v.cv; };
  // a lid margin as one y per column: linear between the points, then a moving average so it has no corners
  const column = pts => {
    const P = pts.map(([u, v]) => [X(u), Y(v)]), raw = new Float32Array(PW), out = new Float32Array(PW), R = 18;
    for (let x = 0; x < PW; x++) {
      let i = 1; while (i < P.length - 1 && x > P[i][0]) i++;
      const f = clamp((x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
      raw[x] = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f;
    }
    for (let x = 0; x < PW; x++) { let s = 0, n = 0; for (let k = -R; k <= R; k++) { const q = x + k; if (q >= 0 && q < PW) { s += raw[q]; n++; } } out[x] = s / n; }
    return out;
  };
  const yU = column(spec.upper), yL = column(spec.lower), lash = spec.lash * img.height * s, skin = spec.skin * img.height * s;
  const xl = X(spec.upper[0][0]), xr = X(spec.upper[spec.upper.length - 1][0]);
  const lidDown = c => {
    if (c <= 0) return view(base.cv);
    const w = work(PW, WH), g = w.g, shut = c >= 0.97;
    g.imageSmoothingQuality = "high"; g.drawImage(base.cv, 0, 0);
    for (let x = Math.max(0, Math.floor(xl)); x < Math.min(PW, Math.ceil(xr)); x++) {
      const m = yU[x], to = m + Math.max(0, yL[x] - m) * c, sTop = Math.max(0, m - skin), sBot = m - lash, dBot = shut ? to : to - lash;
      if (to - m < 0.25) continue;
      g.drawImage(base.cv, x, sTop, 1, sBot - sTop, x, sTop, 1, dBot - sTop);                  // the lid skin, stretched
      if (!shut) g.drawImage(base.cv, x, m - lash, 1, lash, x, to - lash, 1, lash);            // the lashes, riding down
      else { g.save(); g.translate(x, to); g.scale(1, -1); g.drawImage(base.cv, x, m - lash, 1, lash, 0, -lash, 1, lash); g.restore(); }
    }
    return view(w.cv);
  };
  const inks = drawings.map(d => halftoneInk(lidDown(d.close), { ...o.tone, shift: d.shift }));
  let red = null;
  if (o.veins) {
    // the red plate: the photo's own veins (redness inside the white of the eye, off the iris) and more of them drawn
    // in from both corners, as a mask printed in red on its own screen
    const mask = work(PW, WH), g = mask.g, [iu, iv, ir] = spec.iris, IX = X(iu), IY = Y(iv), IR = ir * img.width * s;
    const src = base.g.getImageData(0, 0, PW, WH).data, m = g.createImageData(PW, WH);
    for (let y = 0; y < WH; y++) for (let x = 0; x < PW; x++) {
      const j = (y * PW + x) * 4, inside = x > xl && x < xr && y > yU[x] + 3 && y < yL[x] - 3 && Math.hypot(x - IX, y - IY) > IR * 1.04;
      const r = inside ? clamp(((src[j] - 0.5 * (src[j + 1] + src[j + 2])) - 24) / 55) : 0, v = 255 * (1 - r);
      m.data[j] = m.data[j + 1] = m.data[j + 2] = v; m.data[j + 3] = 255;
    }
    g.putImageData(m, 0, 0);
    g.save(); g.beginPath();
    for (let x = Math.ceil(xl); x < xr; x++) g.lineTo(x, yU[x]);
    for (let x = Math.floor(xr); x > xl; x--) g.lineTo(x, yL[x]);
    g.closePath(); g.clip();
    g.beginPath(); g.rect(0, 0, PW, WH); g.arc(IX, IY, IR * 1.02, 0, 7, true); g.clip();          // not over the iris
    g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
    const vein = (x, y, dir, wdt, depth, seed) => {
      let a = dir;
      g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y);
      const n = 5 + Math.floor(h32(seed, 1301) * 5);
      for (let k = 0; k < n; k++) {
        a += (h32(seed, k, 1302) - 0.5) * 0.9; const L = 14 + h32(seed, k, 1303) * 26;
        x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineTo(x, y);
        if (depth < 2 && h32(seed, k, 1304) < 0.3) { g.stroke(); vein(x, y, a + (h32(seed, k, 1305) - 0.5) * 1.6, wdt * 0.6, depth + 1, seed * 7 + k + 1); g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let i = 0; i < 18; i++) {
      const left = i % 2 === 0, cx = left ? xl + 10 : xr - 10, cy = yU[Math.round(left ? xl + 60 : xr - 60)];
      const y = cy + 16 + h32(i, 1311) * 110, dir = (left ? 0 : Math.PI) + (h32(i, 1312) - 0.5) * 1.1;
      vein(cx + (left ? 1 : -1) * h32(i, 1313) * 80, y, dir, 1.4 + h32(i, 1314) * 2.4, 0, i + 1);
    }
    g.restore();
    red = halftoneInk(view(mask.cv), { pitch: 6, angle: 15, black: 0, white: 1, gain: 0.25, soft: 1.4, ink: "#e0283a" });
  }
  return { inks, red, w: PW, h: PH };
}
