// The fast cut (the creator's bar, 9/26 17:57: birdabo's "WTFHITLW?" intro on X, after the test viewer got bored at the old verses; the creator's
// words: "it really needs that brainrot fuel feel"). A full-frame card for every sung phrase, a new paper colour on
// every cut, each word slammed in on its own sung time, one drawn prop per phrase, hard black and serif cards as the
// breathers, a restock countdown in the corner and a ticker along the bottom. The bar, measured with one detector on
// both: the reference cuts every 0.5 s and changes big every 0.15 s; the old verses cut every 19 s.
// Everything is drawn on one 1920x1080 canvas over the scene (the 3D stage is off while it runs), and the film stock
// (post.js) still grades it. A pure function of song time and the words' own times, like the rest of the video.
// Cards are listed below by the sung word they cut on (WORD#k = the k-th time the step sings it), never by seconds.
import { C, font, MONO, DISPLAY, ctx2d, EXACT } from "./type.js";
import * as song from "./song.js";
import { tile, makePrint, makeScreenPrint, level, newsPage, eyePrints } from "./print.js";

const { h32 } = song;
export const SERIF = "DM Serif";
const W = 1920, H = 1080, BLEED = 280;
export const LEAD = 0.04;                                    // a cut lands 1 frame before its word (the intro uses it too)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

// the papers: saturated, one per cut (the video's print look, on coloured stock)
const P = { pink: "#ff3d8b", cyan: "#35d6f0", yellow: "#ffd21e", violet: "#7a4dff", green: "#19db73", red: "#ff2a3d",
  cream: "#f1e9d8", amber: "#ffb21e", black: "#0b0a0f", night: "#1a0810", vhs: "#1a2a9e", sepia: "#c9a46a", gold: "#ffcf4a",
  chalk: "#1d4a37", money: "#2fbf71", sky: "#8fd8ff", orange: "#ff7a1a", navy: "#101a3a", lilac: "#c9b6ff", news: "#e8e1cd" };
const INK = "#15131a", BONE = "#f4f1ea";
const REACT_W = 440, REACT_H = 420;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const CHORUS1 = song.sections.find(s => s.kind === "chorus")?.t0 ?? song.DUR;

// a sung word as the sheet spells it ("three:" -> "THREE", "It's" -> "IT'S"); serif cards keep the sheet's case
function disp(w, keepCase) {
  const tk = w.li === null ? null : song.tokens(song.lines[w.li].text)[w.wi];     // (Suno's extras have no sheet line)
  const s = (tk ? tk.text : w.w).replace(/:$/, "");
  return keepCase ? s : s.toUpperCase();
}

// ---------- the art made once: pattern tiles, the photos as prints (print.js), the card icon ----------
// the kick montage's prints (the creator's note, 9/26 22:45: real photos for the CPU, the SSD and the PSU, "then apply the same
// posterization/dot filters", and "vary the values of posterization and screen tone effects here, too"): each part
// gets its own recipe, so no two cards in the montage print alike
const MONTAGE = {
  "m-gpu": { tex: "rtx3070", cover: [1, 0.62, 0.28, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 13, angle: 45, contrast: 1.7, key: 5 },
  "m-ram": { tex: "ddr4-16g", cover: [1, 0.5, 0], inks: [INK, INK, INK], shape: "line", pitch: 9, angle: 0, contrast: 1.9, key: 5 },
  "m-cpu": { tex: "cpu", cover: [1, 0.72, 0.45, 0.2, 0], inks: [INK, INK, C.red, C.red, INK], shape: "diamond", pitch: 12, angle: 30, contrast: 1.6, key: 5 },
  "m-ssd": { tex: "ssd", cover: [1, 0.42, 0], inks: [INK, INK, INK], shape: "cross", pitch: 10, angle: 20, contrast: 2.1, bias: -0.16, key: 5 },
  // (not in the montage: step seven's "check the drive", the same drive in plain dots)
  "s-ssd": { tex: "ssd", cover: [1, 0.55, 0.2, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 11, angle: 45, contrast: 2.0, bias: -0.14, key: 5 },
  "m-psu": { tex: "psu", cover: [1, 0.6, 0.25, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 18, angle: 75, contrast: 1.5, key: 6 },
};
// "a building that thinks" (the creator's note, 9/26 22:45: "I want an appropriate image of a data center"): an aerial of one
// hall (502), cropped to the hall with its generator rows and a corner of its substation; step eleven's "the buildings"
// get the two-hall aerial (501). Printed as a clipping (a screen print with a keyline round the rectangle)
const HALL = { crop: [0.12, 0.19, 0.66, 0.73], cover: [1, 0.66, 0.34, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 9, angle: 45, contrast: 1.5, bias: 0.06, soften: 2, key: 6 };
const HALLS = { crop: [0.06, 0.2, 0.88, 0.64], cover: [1, 0.6, 0.25, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 8, angle: 15, contrast: 1.5, bias: 0.06, soften: 2, key: 5 };
// the hall's roof in HALL's crop (0..1): a parallelogram from its near end (BL, BR) to its far end (TL, TR)
const ROOF = { bl: [0.111, 0.783], tl: [0.704, 0.07], br: [0.333, 0.87] };
// the eye (the creator's note: the eye cards "feel a little amateurish ... I was leaning newspaper/low-frame rate"): one photo,
// 601, measured on its texture (uv, y down): the view, the lid margins corner to corner, the heights above the upper
// margin of the lashes and of the lid skin that come down with it (read from the photo's top, above the view), the iris
const EYE = {
  view: [0.08, 0.11, 0.95, 0.78], top: 0, lash: 0.085, skin: 0.21, iris: [0.511, 0.427, 0.15],
  upper: [[0.192, 0.492], [0.25, 0.347], [0.306, 0.282], [0.361, 0.246], [0.444, 0.222], [0.511, 0.214], [0.611, 0.222],
    [0.694, 0.25], [0.778, 0.315], [0.833, 0.387], [0.872, 0.48], [0.883, 0.556]],
  lower: [[0.192, 0.492], [0.25, 0.597], [0.333, 0.653], [0.444, 0.685], [0.556, 0.694], [0.667, 0.669], [0.778, 0.613], [0.883, 0.556]],
};
const NEWS_TONE = { pitch: 9, angle: 45, black: 0.1, white: 0.9, gamma: 1.15, gain: 0.14, soft: 1.25 };
const NEWS_FPS = 10;                                          // the newspaper cards animate on threes: ten drawings a second
const NEWS_INK = "#1b1918";
const NEWS_PHOTO = [960, 686, 1200];                          // the page's photo: centre x, y, width (its height is the view's)

export function initFast(S, layer) {
  const c = layer.ctx, F = { layer, sil: new Map() };
  const pat = cv => c.createPattern(cv, "repeat");
  F.pDots = pat(tile(28, 28, g => { g.fillStyle = "rgba(0,0,0,0.17)"; g.beginPath(); g.arc(14, 14, 6.5, 0, 7); g.fill(); }));
  F.pDotsLight = pat(tile(28, 28, g => { g.fillStyle = "rgba(255,42,61,0.28)"; g.beginPath(); g.arc(14, 14, 5, 0, 7); g.fill(); }));
  F.pStripes = pat(tile(56, 56, g => { g.fillStyle = "rgba(0,0,0,0.13)"; g.fillRect(0, 0, 24, 56); }));
  F.pGrid = pat(tile(80, 80, g => { g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, 0, 80, 3); g.fillRect(0, 0, 3, 80); }));
  F.pGridLight = pat(tile(80, 80, g => { g.fillStyle = "rgba(255,255,255,0.13)"; g.fillRect(0, 0, 80, 3); g.fillRect(0, 0, 3, 80); }));
  // the card icon for the wall of forty thousand: a board, two fans, the gold edge
  // (drawn natively at every power-of-two size it's shown at: see the prints' mip chain)
  F.pCards = [256, 128, 64, 32, 16, 8].map(w => pat(tile(w, w * 0.625, g => {
    const s = w / 256; g.scale(s, s);
    g.fillStyle = "#e9e4d8"; rr(g, 16, 16, 224, 118, 12); g.fill();
    g.fillStyle = INK; for (const x of [78, 178]) { g.beginPath(); g.arc(x, 74, 38, 0, 7); g.fill(); }
    g.fillStyle = "#e9e4d8"; for (const x of [78, 178]) { g.beginPath(); g.arc(x, 74, 10, 0, 7); g.fill(); }
    g.fillStyle = C.amber; g.fillRect(52, 134, 140, 10);
  })));
  F.prints = {};
  for (const key of ["rtx3090", "rtx3070", "radeon7790", "gtx1080ti", "ddr4-16g", "samsung-ddr4", "hynix-mrdimm", "micron-rdimm-label"])
    if (S.tex[key]) F.prints[key] = makePrint(S.tex[key].image, 900, S.cut[key].lum);
  for (const [id, r] of Object.entries(MONTAGE)) F.prints[id] = makeScreenPrint(S.tex[r.tex].image, 900, S.cut[r.tex].lum, r);
  const crop = (img, [x0, y0, x1, y1], w) => {
    const sw = (x1 - x0) * img.width, sh = (y1 - y0) * img.height;
    return tile(w, Math.round(w * sh / sw), g => { g.imageSmoothingQuality = "high"; g.drawImage(img, x0 * img.width, y0 * img.height, sw, sh, 0, 0, w, Math.round(w * sh / sw)); });
  };
  F.prints.hall = makeScreenPrint(crop(S.tex["bg-dc-hall"].image, HALL.crop, 1100), 1100, S.cut["bg-dc-hall"].lum, HALL);
  F.prints.halls = makeScreenPrint(crop(S.tex["bg-dc-halls"].image, HALLS.crop, 1100), 1100, S.cut["bg-dc-halls"].lum, HALLS);
  // the newspaper: a page with room to slide under the frame (each drawing of the flipbook is a new sheet), the eye's
  // drawings (open three ways, then the blink closing), the sleepless eye with its red plate
  F.page = newsPage(W + 2 * BLEED + 80, H + 2 * BLEED + 80);
  const eyeImg = S.tex["bg-eye"].image;
  F.eye = eyePrints(eyeImg, EYE, NEWS_PHOTO[2], [{ close: 0, shift: [0, 0] }, { close: 0, shift: [0.37, 0.61] }, { close: 0, shift: [0.71, 0.23] },
    { close: 0.45, shift: [0.19, 0.83] }, { close: 0.8, shift: [0.53, 0.41] }, { close: 1, shift: [0.87, 0.67] }], { tone: NEWS_TONE });
  F.eyeRed = eyePrints(eyeImg, EYE, NEWS_PHOTO[2], [{ close: 0, shift: [0.29, 0.13] }, { close: 0, shift: [0.61, 0.77] }, { close: 0, shift: [0.93, 0.47] }], { tone: NEWS_TONE, veins: true });
  // the creator's GPT-Image 2 art: the neutral portrait (the smirk stays the chorus's), cut once to what the react box shows
  // (head and shoulders: the top 30% of the still, centred on his head) at the box's own size. Drawing the whole
  // 1122x1402 still through a clip every frame changed how the canvas drew the NEXT frames (measured: 45.0 after 44.62
  // differed by 1/255 over the whole frame, and stayed different until another card redrew)
  const al = S.dancer.P.norm.image, sh = al.height * 0.3, sw = sh * REACT_W / REACT_H;
  F.altman = tile(REACT_W, REACT_H, g => { g.imageSmoothingQuality = "high"; g.drawImage(al, al.width * 0.485 - sw / 2, 0, sw, sh, 0, 0, REACT_W, REACT_H); });
  // the LeatherJacketMan in the suit, head and shoulders, with his face under the same mosaic as step 14 (the creator's ask):
  // the head box from tools/face-box.py (stage.js), eight blocks across it
  const ceo = S.ceo.tex.suit.image, box = [0.3887, 0.8453, 0.5703, 0.9978];
  const hx0 = box[0] * ceo.width, hx1 = box[2] * ceo.width, hy0 = (1 - box[3]) * ceo.height, hy1 = (1 - box[1]) * ceo.height;
  const csh = ceo.height * 0.3, csw = csh * REACT_W / REACT_H, csx = (hx0 + hx1) / 2 - csw / 2, k = REACT_W / csw;
  F.ceo = tile(REACT_W, REACT_H, g => {
    g.imageSmoothingQuality = "high"; g.drawImage(ceo, csx, 0, csw, csh, 0, 0, REACT_W, REACT_H);
    const bx = (hx0 - csx) * k, by = hy0 * k, bw = (hx1 - hx0) * k, bh = (hy1 - hy0) * k, nx = 8, ny = Math.max(1, Math.round(8 * bh / bw));
    const small = tile(nx, ny, s2 => { s2.imageSmoothingQuality = "high"; s2.drawImage(g.canvas, bx, by, bw, bh, 0, 0, nx, ny); });
    g.clearRect(bx, by, bw, bh); g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, nx, ny, bx, by, bw, bh);
  });
  S.fastArt = F;
  return F;
}
// a print's silhouette in one flat colour (the riso offset behind it), made on first use
function silhouette(F, key, col) {
  const id = key + col;
  if (!F.sil.has(id)) { const m = F.prints[key].mask; F.sil.set(id, tile(m.width, m.height, g => { g.drawImage(m, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, m.width, m.height); })); }
  return F.sil.get(id);
}

// ---------- paper: the colour, then the pattern drifting on it ----------
function paper(c, K, col, pat) {
  const X0 = -BLEED, Y0 = -BLEED, WW = W + 2 * BLEED, HH = H + 2 * BLEED, F = K.F, t = K.t;
  c.fillStyle = col; c.fillRect(X0, Y0, WW, HH);
  const fillP = (p, m) => { p.setTransform(m); c.fillStyle = p; c.fillRect(X0, Y0, WW, HH); };
  if (pat === "news") {       // newsprint: a new sheet under every drawing of the flipbook (the page slides, on threes)
    const di = Math.floor(t * NEWS_FPS);
    c.drawImage(F.page, X0 - 40 + (h32(di, 1401) - 0.5) * 60, Y0 - 40 + (h32(di, 1402) - 0.5) * 60);
  }
  if (pat === "dots") fillP(F.pDots, new DOMMatrix().rotate(45).translate(t * 36, 0));
  if (pat === "reddots") fillP(F.pDotsLight, new DOMMatrix().rotate(45).translate(0, -t * 30));
  if (pat === "stripes") fillP(F.pStripes, new DOMMatrix().rotate(-35).translate(t * 70, 0));
  if (pat === "grid") fillP(F.pGrid, new DOMMatrix().translate(t * 24, t * 12));
  if (pat === "gridlight") fillP(F.pGridLight, new DOMMatrix().translate(t * 24, t * 12));
  if (pat === "rays") {       // a sunburst turning slowly behind everything
    const cx = K.rays?.[0] ?? 960, cy = K.rays?.[1] ?? 540, n = 32, a0 = t * 0.35;
    c.fillStyle = "rgba(0,0,0,0.11)";
    for (let i = 0; i < n; i += 2) {
      const a = a0 + i * Math.PI * 2 / n, b = a + Math.PI * 2 / n;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 2600, cy + Math.sin(a) * 2600); c.lineTo(cx + Math.cos(b) * 2600, cy + Math.sin(b) * 2600); c.closePath(); c.fill();
    }
  }
  if (pat === "speed") {      // manga focus lines closing in, re-dealt every two frames like inked cels
    const seed = Math.floor(t * 15), cx = 960, cy = 540;
    c.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 150; i++) {
      const a = h32(i, seed, 401) * Math.PI * 2, wa = 0.004 + h32(i, seed, 402) * 0.01, r0 = 330 + h32(i, seed, 403) * 320;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a - wa) * 1500, cy + Math.sin(a - wa) * 1500); c.lineTo(cx + Math.cos(a + wa) * 1500, cy + Math.sin(a + wa) * 1500); c.closePath(); c.fill();
    }
  }
}

// ---------- the words ----------
// the card's sung words in big type, each appearing on its own sung time: a slam (bigger and white for a frame, then
// settling into its colour) with the riso offset behind it. rows: words per line (default: wrap to maxW); the
// size shrinks until the widest line fits. hot: words set in red. serif: no slam, a quick fade, the sheet's case.
function caption(c, K, o) {
  let ws = K.words.filter(w => !o.only || o.only.includes(w.w));
  if (o.from) { const i = ws.findIndex(w => w.w === o.from); ws = i < 0 ? [] : ws.slice(i); }
  if (!ws.length) return;
  const fam = o.serif ? SERIF : DISPLAY, keep = !!o.serif, maxW = o.maxW ?? 1680, lh = o.lh ?? 0.92;
  const texts = ws.map(w => disp(w, keep));
  let size = o.size ?? 200, rows;
  for (let pass = 0; pass < 2; pass++) {
    c.font = font(size, fam);
    const sp = c.measureText(" ").width;
    rows = []; let row = [];
    ws.forEach((w, i) => {
      const tw = c.measureText(texts[i]).width, cap = o.rows ? o.rows[rows.length] ?? 99 : 99;
      const rw = row.reduce((a, r) => a + r.tw + (r.text.endsWith("-") ? 0 : sp), 0);
      if (row.length && (row.length >= cap || (!o.rows && rw + tw > maxW))) { rows.push(row); row = []; }
      row.push({ w, tw, text: texts[i] });
    });
    rows.push(row);
    const widest = Math.max(...rows.map(r => r.reduce((a, x, j) => a + x.tw + (j < r.length - 1 && !x.text.endsWith("-") ? sp : 0), 0)));
    if (widest <= maxW) break;
    size = Math.floor(size * maxW / widest);
  }
  c.font = font(size, fam); c.textBaseline = "alphabetic"; c.textAlign = "left";
  const sp = c.measureText(" ").width, off = o.off ?? Math.max(4, size * 0.035);
  const y0 = o.anchor === "bottom" ? o.y - (rows.length - 1) * size * lh : o.y;
  rows.forEach((row, ri) => {
    const rw = row.reduce((a, x, j) => a + x.tw + (j < row.length - 1 && !x.text.endsWith("-") ? sp : 0), 0);
    let x = o.align === "center" ? o.x - rw / 2 : o.align === "right" ? o.x - rw : o.x;
    const y = y0 + ri * size * lh;
    for (const { w, tw, text } of row) {
      const on = w.t - 0.03;
      if (K.t >= on) {
        const s = since(K.t, on, 0.06), sc = keep ? 1 : 1 + s * (o.pop ?? 0.4);
        c.save();
        c.globalAlpha = keep ? clamp((K.t - on) / 0.12) : 1;
        c.translate(x + tw / 2, y - size * 0.35); c.scale(sc, sc); c.translate(-(x + tw / 2), -(y - size * 0.35));
        if (o.shadow) { c.fillStyle = o.shadow; c.fillText(text, x + off, y + off); }
        c.fillStyle = !keep && s > 0.6 ? (o.flash ?? BONE) : o.hot?.includes(w.w) ? (o.hotCol ?? C.red) : (o.col ?? INK);
        c.fillText(text, x, y);
        c.restore();
      }
      x += tw + (text.endsWith("-") ? 0 : sp);
    }
  });
}
// a black strip under the frame with the sung words as a subtitle (the reference's small caption)
function subtitle(c, K, o = {}) {
  let ws = K.words.filter(w => !o.only || o.only.includes(w.w));
  ws = ws.filter(w => K.t >= w.t - 0.03);
  if (!ws.length) return;
  const s = ws.map(w => disp(w, false)).join(" ");
  c.font = font(o.size ?? 64, DISPLAY); c.textAlign = "center"; c.textBaseline = "alphabetic";
  const tw = c.measureText(s).width;
  c.fillStyle = "rgba(11,10,15,0.88)"; c.fillRect(960 - tw / 2 - 26, (o.y ?? 968) - (o.size ?? 64) * 0.95, tw + 52, (o.size ?? 64) * 1.25);
  c.fillStyle = o.col ?? BONE; c.fillText(s, 960, o.y ?? 968);
}

// a rubber stamp, slammed down: returns the thud (for the film's flash)
function stamp(c, K, t0, label, x, y, rot, col, size, speck) {
  if (K.t < t0) return 0;
  const e = K.t - t0, s = lerp(2.3, 1, easeOut(e / 0.09));
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = clamp(e / 0.04 + 0.35);
  c.font = font(size); c.textAlign = "center"; c.textBaseline = "alphabetic";
  const tw = c.measureText(label).width, bw = tw + size * 0.55, bh = size * 1.08;
  c.strokeStyle = col; c.lineWidth = size * 0.085; rr(c, -bw / 2, -bh * 0.72, bw, bh, size * 0.12); c.stroke();
  c.fillStyle = col; c.fillText(label, 0, size * 0.17);
  if (speck) {                  // worn rubber: specks of the surface it landed on
    c.fillStyle = speck;
    for (let i = 0; i < 90; i++) { const r = 1.5 + h32(i, 311) * 5; c.beginPath(); c.arc((h32(i, 312) - 0.5) * bw, (h32(i, 313) - 0.72) * bh + bh * 0.22, r, 0, 7); c.fill(); }
  }
  c.restore();
  return since(K.t, t0, 0.1);
}
// a print with its riso offset behind it
function printAt(c, K, key, cx, cy, w, rot, o = {}) {
  const pr = K.F.prints[key];
  if (!pr) return;
  const h = w * pr.print.height / pr.print.width, off = o.off ?? w * 0.018, img = level(pr.levels, w * (K.ws ?? 1));   // (ws: verse 2's windows draw a card smaller)
  c.save(); c.translate(cx, cy); c.rotate(rot); c.globalAlpha = o.alpha ?? 1;
  if (off) c.drawImage(silhouette(K.F, key, o.shadow ?? "rgba(21,19,26,0.35)"), -w / 2 + off, -h / 2 + off, w, h);
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.restore();
}
// a spiky burst with a word in it (the onomatopoeia)
function burst(c, x, y, r, spikes, fill, edge, label, size, rot = 0, textCol = INK) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath();
  for (let i = 0; i < spikes * 2; i++) { const a = i * Math.PI / spikes, q = i % 2 ? r * 0.72 : r * (1 + (h32(i, spikes, 5) - 0.5) * 0.18); i ? c.lineTo(Math.cos(a) * q, Math.sin(a) * q) : c.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
  c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = r * 0.06; c.strokeStyle = edge; c.stroke();
  if (label) { c.font = font(size); c.fillStyle = textCol; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, 0, size * 0.04); }
  c.restore();
}
function marker(c, cx, cy, rx, ry, u, col = C.red, wdt = 16) {      // a hand-drawn loop, drawn on over u = 0..1
  if (u <= 0) return;
  c.save(); c.strokeStyle = col; c.lineWidth = wdt; c.lineCap = "round";
  c.beginPath(); c.ellipse(cx, cy, rx, ry, -0.06, -2.2, -2.2 + Math.PI * 2.15 * u); c.stroke(); c.restore();
}

// ---------- the props ----------
function stepCard(c, K, numWord) {
  const st = K.w("STEP"), nw = K.w(numWord), label = String(K.n).padStart(2, "0");
  c.textBaseline = "alphabetic";
  const said = nw && K.t >= nw.t - 0.03;
  c.font = font(900); c.textAlign = "right";
  if (!said) {                  // the number waits as an outline, sliding in
    const slide = easeOut((K.t - K.t0) / 0.3);
    c.lineWidth = 12; c.strokeStyle = INK; c.strokeText(label, 1810 + (1 - slide) * 260, 990);
  } else {
    const s = since(K.t, nw.t - 0.03, 0.07);
    c.save(); c.translate(1540, 700); c.scale(1 + s * 0.3, 1 + s * 0.3); c.translate(-1540, -700);
    c.fillStyle = INK; c.fillText(label, 1810 + 30, 990 + 30);
    c.fillStyle = s > 0.6 ? C.red : BONE; c.fillText(label, 1810, 990);
    c.restore();
  }
  const lead = K.words.find(w => w.li === null);
  if (lead && K.t >= lead.t - 0.03) {
    const s = since(K.t, lead.t - 0.03, 0.07);
    c.save(); c.translate(860, 220); c.rotate(-0.1); c.scale(1 + s * 0.4, 1 + s * 0.4);
    c.fillStyle = INK; rr(c, -150 + 10, -70 + 12, 300, 130, 16); c.fill(); c.fillStyle = C.red; rr(c, -150, -70, 300, 130, 16); c.fill();
    c.font = font(110); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("THAT'S", 0, 4); c.restore();
  }
  if (st && K.t >= st.t - 0.03) {
    const s = since(K.t, st.t - 0.03, 0.07);
    c.save(); c.translate(360, 380); c.scale(1 + s * 0.35, 1 + s * 0.35); c.translate(-360, -380);
    c.font = font(330); c.textAlign = "left";
    c.fillStyle = BONE; c.fillText("STEP", 132, 492); c.fillStyle = INK; c.fillText("STEP", 120, 480);
    c.restore();
    c.font = font(36, MONO, "600"); c.fillStyle = INK; c.textAlign = "left";
    c.fillText("OF 27  ·  THE MANUAL, 2026 EDITION", 128, 560);
  }
}

function calendarPage(c, x, y, w, h, label) {
  c.fillStyle = BONE; rr(c, x, y, w, h, 14); c.fill();
  c.fillStyle = C.red; rr(c, x, y, w, h * 0.16, [14, 14, 0, 0]); c.fill();
  c.font = font(34, MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("SAVE UNTIL", x + w / 2, y + h * 0.085);
  c.font = font(270); c.fillStyle = INK; c.textBaseline = "alphabetic"; c.fillText(label, x + w / 2, y + h * 0.54);
  c.fillStyle = "rgba(21,19,26,0.16)";
  for (let r = 0; r < 4; r++) for (let q = 0; q < 7; q++) c.fillRect(x + 48 + q * (w - 96) / 7, y + h * 0.62 + r * 58, (w - 96) / 7 - 14, 42);
}
function calendar(c, K) {
  const months = [["JAN", K.w("WAIT")], ["FEB", K.w("FOR")], ["MAR", K.w("MARCH")]];
  const x = 1060, y = 170, w = 640, h = 720;
  let cur = 0;
  months.forEach(([, wd], i) => { if (i && wd && K.t >= wd.t - 0.03) cur = i; });
  c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(0.04); c.translate(-(x + w / 2), -(y + h / 2));
  c.fillStyle = INK; rr(c, x + 22, y + 26, w, h, 16); c.fill();
  calendarPage(c, x, y, w, h, months[cur][0]);
  for (let i = 0; i < cur; i++) {          // the pages already torn off, falling away
    const tt = K.t - (months[i + 1][1].t - 0.03);
    if (tt > 0.4) continue;
    c.save(); c.globalAlpha = clamp(1 - tt * 2.5);
    c.translate(x + w / 2 + (i % 2 ? 1 : -1) * tt * 900, y + h / 2 + tt * 700 + tt * tt * 5200); c.rotate((i % 2 ? 1 : -1) * tt * 3.2); c.translate(-(x + w / 2), -(y + h / 2));
    calendarPage(c, x, y, w, h, months[i][0]); c.restore();
  }
  c.fillStyle = INK;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + 70 + i * (w - 140) / 5, y - 6, 16, 0, 7); c.fill(); }
  const m = months[2][1];
  if (m) marker(c, x + w / 2, y + h * 0.43, w * 0.42, h * 0.17, easeOut((K.t - m.t) / 0.28));
  c.restore();
}

function taxForm(c, K) {
  const tax = K.w("TAX"), ret = K.w("RETURN"), x = 980, y = 110, w = 740, h = 880;
  const inY = lerp(700, 0, easeOutBack((K.t - K.t0) / 0.3));
  c.save(); c.translate(0, inY); c.translate(x + w / 2, y + h / 2); c.rotate(-0.05); c.translate(-(x + w / 2), -(y + h / 2));
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, x + 20, y + 24, w, h, 8); c.fill();
  c.fillStyle = "#fbf8f0"; rr(c, x, y, w, h, 8); c.fill();
  c.fillStyle = INK; c.fillRect(x, y, w, 110);
  c.font = font(64); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("TAX RETURN", x + 40, y + 80);
  c.font = font(26, MONO, "600"); c.textAlign = "right"; c.fillText("FORM 26-B", x + w - 40, y + 72);
  c.textAlign = "left";
  const rows = ["NAME", "ADDRESS", "INCOME", "WITHHELD", "CREDITS", "OWED"];
  rows.forEach((r, i) => {
    const ry = y + 180 + i * 86;
    c.font = font(24, MONO, "600"); c.fillStyle = "rgba(21,19,26,0.6)"; c.fillText(r, x + 40, ry);
    c.fillStyle = "rgba(21,19,26,0.13)"; c.fillRect(x + 250, ry - 26, w - 300, 34);
    c.fillStyle = "rgba(21,19,26,0.55)"; c.fillRect(x + 262, ry - 16, (w - 340) * (0.3 + h32(i, 91) * 0.6), 12);
  });
  const ry = y + 180 + rows.length * 86 + 20;
  c.fillStyle = C.amber; c.fillRect(x + 30, ry - 62, w - 60, 96);
  c.font = font(40, MONO, "600"); c.fillStyle = INK; c.fillText("REFUND", x + 50, ry);
  const amt = "$1,200.00", k = tax ? clamp((K.t - tax.t) / Math.max(0.2, (ret ? ret.t : tax.t + 0.4) - tax.t)) : 0;
  c.font = font(72); c.textAlign = "right"; c.fillText(amt.slice(0, Math.round(amt.length * k)), x + w - 50, ry + 10);
  let thud = 0;
  if (ret) thud = stamp(c, K, ret.t - 0.02, "APPROVED", x + w * 0.52, y + h * 0.36, -0.2, C.red, 120, "#fbf8f0");
  c.restore();
  return thud;
}

function tower(c, K, x, y, w, h, lit, empty) {
  const k = K.k;
  c.fillStyle = "rgba(21,19,26,0.4)"; rr(c, x + 26, y + 30, w, h, 24); c.fill();
  c.fillStyle = INK; rr(c, x, y, w, h, 24); c.fill();
  c.fillStyle = "#26222e"; rr(c, x + 18, y + 18, w * 0.17, h - 36, 12); c.fill();
  c.fillStyle = "rgba(244,241,234,0.14)";
  for (let i = 0; i < 16; i++) c.fillRect(x + 34, y + 120 + i * ((h - 200) / 16), w * 0.17 - 32, 8);
  c.beginPath(); c.arc(x + 18 + w * 0.085, y + 70, 20, 0, 7); c.fillStyle = lit ? C.cyan : "#3a3644"; c.fill();
  if (lit) { c.beginPath(); c.arc(x + 18 + w * 0.085, y + 70, 28 + k * 10, 0, 7); c.strokeStyle = `rgba(94,242,255,${0.4 + k * 0.5})`; c.lineWidth = 5; c.stroke(); }
  const gx = x + w * 0.24, gy = y + 36, gw = w * 0.7, gh = h - 72;
  c.fillStyle = "#0f2630"; rr(c, gx, gy, gw, gh, 14); c.fill();
  c.fillStyle = "#1c1b25"; c.fillRect(gx + 26, gy + 26, gw - 52, gh * 0.58);
  c.strokeStyle = "rgba(244,241,234,0.12)"; c.lineWidth = 3;
  for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(gx + 40, gy + 60 + i * 44); c.lineTo(gx + gw - 60, gy + 60 + i * 44); c.stroke(); }
  if (lit) {                    // the RGB strip, running
    const g = c.createLinearGradient(gx, 0, gx + gw, 0), ph = K.t * 2;
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, [C.pink, C.cyan, C.amber, "#19db73", "#7a4dff", C.pink, C.cyan][(i + Math.floor(ph * 3)) % 7]);
    c.fillStyle = g; c.fillRect(gx + 20, gy + gh - 34, gw - 40, 12);
  }
  if (!empty) printAt(c, K, "rtx3090", gx + gw * 0.5, gy + gh * 0.72, gw * 0.86, 0, { off: 0 });
  c.fillStyle = "rgba(255,255,255,0.08)";           // the glass
  c.beginPath(); c.moveTo(gx + gw * 0.15, gy); c.lineTo(gx + gw * 0.45, gy); c.lineTo(gx + gw * 0.05, gy + gh); c.lineTo(gx - gw * 0.25, gy + gh); c.closePath(); c.fill();
  c.fillStyle = INK; c.fillRect(x + 30, y + h, 60, 20); c.fillRect(x + w - 90, y + h, 60, 20);
}

function controller(c, K) {
  const kk = K.kick, pressed = kk && K.t - kk.t < 0.12 ? Math.floor(h32(kk.i, 83) * 4) : -1;
  c.save(); c.translate(1250, 560); c.rotate(-0.08 + Math.sin(K.t * 3) * 0.02); c.scale(1.3, 1.3);
  const body = () => {
    c.beginPath(); c.moveTo(-250, -170); c.lineTo(250, -170);
    c.bezierCurveTo(360, -170, 400, -80, 410, 40); c.bezierCurveTo(430, 200, 400, 300, 320, 300);
    c.bezierCurveTo(250, 300, 210, 200, 170, 140); c.lineTo(-170, 140);
    c.bezierCurveTo(-210, 200, -250, 300, -320, 300); c.bezierCurveTo(-400, 300, -430, 200, -410, 40);
    c.bezierCurveTo(-400, -80, -360, -170, -250, -170); c.closePath();
  };
  c.save(); c.translate(22, 26); body(); c.fillStyle = "rgba(21,19,26,0.35)"; c.fill(); c.restore();
  body(); c.fillStyle = INK; c.fill();
  c.fillStyle = BONE; c.fillRect(-252, -62, 150, 46); c.fillRect(-200, -114, 46, 150);
  [[0, -64, C.cyan], [64, 0, C.pink], [0, 64, C.amber], [-64, 0, "#19db73"]].forEach(([dx, dy, col], i) => {
    const on = i === pressed;
    c.beginPath(); c.arc(240 + dx, -40 + dy, on ? 30 : 34, 0, 7); c.fillStyle = col; c.fill();
    if (on) { c.beginPath(); c.arc(240 + dx, -40 + dy, 50, 0, 7); c.strokeStyle = col; c.lineWidth = 6; c.stroke(); }
  });
  for (const sx of [-110, 110]) { c.beginPath(); c.arc(sx, 70, 50, 0, 7); c.fillStyle = "#34303d"; c.fill(); c.beginPath(); c.arc(sx, 70, 30, 0, 7); c.fillStyle = "#4a4555"; c.fill(); }
  c.restore();
  if (Math.floor(K.t * 3) % 2 === 0) { c.font = font(40, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.fillText("PRESS START", 1250, 1000); }
}

function keycap(c, K) {
  const kk = K.kick, press = kk && kk.t >= K.t0 ? since(K.t, kk.t, 0.09) : 0, cx = 1260, cy = 520, s = 420;
  // the refresh arrow, turning around the key
  c.save(); c.translate(cx, cy); c.rotate(K.t * 5);
  c.strokeStyle = INK; c.lineWidth = 44; c.lineCap = "butt";
  c.beginPath(); c.arc(0, 0, 360, 0.3, Math.PI * 1.75); c.stroke();
  const ea = Math.PI * 1.75; c.fillStyle = INK;
  c.beginPath(); c.moveTo(Math.cos(ea) * 300, Math.sin(ea) * 300); c.lineTo(Math.cos(ea) * 420, Math.sin(ea) * 420); c.lineTo(Math.cos(ea + 0.3) * 360, Math.sin(ea + 0.3) * 360); c.closePath(); c.fill();
  c.restore();
  const dy = press * 34;
  c.fillStyle = "#2a2632"; rr(c, cx - s / 2, cy - s / 2 + 46, s, s, 44); c.fill();
  c.fillStyle = "#d9d4c8"; rr(c, cx - s / 2, cy - s / 2 + dy, s, s, 44); c.fill();
  c.fillStyle = BONE; rr(c, cx - s / 2 + 34, cy - s / 2 + 26 + dy, s - 68, s - 90, 30); c.fill();
  c.font = font(220); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("F5", cx, cy + 80 + dy);
  if (kk && kk.t >= K.t0 && K.t - kk.t < 0.22) {
    const side = kk.i % 2 ? 1 : -1, pop = easeOutBack((K.t - kk.t) / 0.1);
    burst(c, cx + side * 330, cy - 300, 150 * pop, 14, BONE, INK, "CLICK!", 74, side * 0.2);
  }
}

function weekStrip(c, K) {
  const days = ["MON", "TUE", "WED", "THU", "FRI"], tu = K.w("TUESDAY"), x0 = 330, y0 = 140, bw = 230, gap = 30;
  days.forEach((d, i) => {
    const x = x0 + i * (bw + gap), hot = i === 1 && tu && K.t >= tu.t - 0.03;
    c.fillStyle = hot ? INK : "rgba(21,19,26,0.12)"; rr(c, x, y0, bw, 190, 16); c.fill();
    c.font = font(96); c.fillStyle = hot ? BONE : "rgba(21,19,26,0.45)"; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(d, x + bw / 2, y0 + 130);
  });
  if (tu) marker(c, x0 + (bw + gap) + bw / 2, y0 + 95, 170, 130, easeOut((K.t - tu.t) / 0.25));
}

function confetti(c, t, t0, cx, cy, n = 70) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.6) return;
  const cols = [C.pink, C.cyan, C.amber, BONE, C.red, "#7a4dff"];
  for (let i = 0; i < n; i++) {
    const a = h32(i, 501) * Math.PI * 2, sp = 500 + h32(i, 502) * 1100;
    const x = cx + Math.cos(a) * sp * dt, y = cy + Math.sin(a) * sp * dt * 0.8 - 300 * dt + 1400 * dt * dt;
    c.save(); c.translate(x, y); c.rotate(dt * 12 * (h32(i, 503) - 0.5)); c.fillStyle = cols[i % cols.length];
    c.fillRect(-10, -5, 20 + h32(i, 504) * 14, 10); c.restore();
  }
}

function inStock(c, K) {
  const inw = K.w("IN"), bounce = Math.abs(Math.sin((K.t - K.t0) * 7.8)) * 40;
  printAt(c, K, "rtx3090", 960, 330 - bounce, 980, -0.06, { shadow: "rgba(21,19,26,0.45)" });
  if (inw && K.t >= inw.t - 0.03) {
    const s = since(K.t, inw.t - 0.03, 0.07), e = easeOutBack((K.t - inw.t + 0.03) / 0.16);
    c.save(); c.translate(960, 780); c.scale(e * (1 + s * 0.2), e * (1 + s * 0.2)); c.rotate(-0.04);
    c.fillStyle = INK; rr(c, -560 + 18, -150 + 22, 1120, 300, 150); c.fill();
    c.fillStyle = BONE; rr(c, -560, -150, 1120, 300, 150); c.fill();
    c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(-400, 0, 92, 0, 7); c.fillStyle = "#19db73"; c.fill();
    c.beginPath(); c.moveTo(-446, 4); c.lineTo(-412, 40); c.lineTo(-348, -40); c.lineWidth = 24; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = BONE; c.stroke();
    c.font = font(210); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("IN STOCK", -270, 76);
    c.restore();
    confetti(c, K.t, inw.t, 960, 700);
  }
  const its = K.w("IT'S#1");
  if (its && K.t >= its.t - 0.03) { c.font = font(120); c.fillStyle = INK; c.textAlign = "left"; c.fillText("IT'S", 110, 1000); }
}

function priceTag(c, K) {
  const sale = K.w("SALE"), swing = Math.sin((K.t - K.t0) * 6.5) * 0.16 * Math.exp(-(K.t - K.t0) * 0.8);
  c.save(); c.translate(1240, -40); c.rotate(swing);
  c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 240); c.stroke();
  c.translate(0, 240); c.rotate(0.12);
  const tag = () => { c.beginPath(); c.moveTo(-90, 0); c.lineTo(90, 0); c.lineTo(300, 180); c.lineTo(300, 780); c.lineTo(-300, 780); c.lineTo(-300, 180); c.closePath(); };
  c.save(); c.translate(20, 24); tag(); c.fillStyle = "rgba(21,19,26,0.4)"; c.fill(); c.restore();
  tag(); c.fillStyle = BONE; c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(0, 70, 30, 0, 7); c.fillStyle = C.red; c.fill(); c.lineWidth = 8; c.stroke();
  c.font = font(210); c.fillStyle = C.red; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("SALE", 0, 390);
  c.font = font(58, MONO, "600"); c.fillStyle = "rgba(21,19,26,0.6)"; c.fillText("$1,199.99", 0, 500);
  c.fillStyle = C.red; c.fillRect(-150, 478, 300, 8);
  if (sale && K.t >= sale.t - 0.03) {
    const s = since(K.t, sale.t - 0.03, 0.07);
    c.save(); c.translate(0, 640); c.scale(1 + s * 0.4, 1 + s * 0.4); c.font = font(170); c.fillStyle = INK; c.fillText("$959", 0, 0); c.restore();
  }
  c.restore();
}

// ---------- the newspaper: the eyes (the creator's note, 9/26 22:45: "newspaper/low-frame rate") ----------
// the page around the photo: the paper's name, its rules and dateline, and a column of set type either side of the
// photo, too small to read
function masthead(c, K, o = {}) {
  c.fillStyle = NEWS_INK; c.textBaseline = "alphabetic";
  c.font = font(58, SERIF); c.textAlign = "center"; c.fillText("The Daily Memory", 960, 132);
  c.fillRect(220, 146, 1480, 5); c.fillRect(220, 155, 1480, 1.5);
  c.font = font(18, MONO, "600");
  c.textAlign = "left"; c.fillText("VOL. XXVI  ·  NO. 4", 220, 178);
  c.textAlign = "center"; c.fillText(o.mid ?? "RESTOCK EDITION", 960, 178);
  c.textAlign = "right"; c.fillText(o.right ?? "PRICE: $1,200", 1700, 178);
  c.fillRect(220, 189, 1480, 1.5);
  const [px, py, pw] = NEWS_PHOTO, ph = K.F.eye.h, y0 = py - ph / 2, x0 = px - pw / 2 - 18, x1 = px + pw / 2 + 18;
  c.fillRect(x0, y0, 1.5, ph); c.fillRect(x1, y0, 1.5, ph);
  c.fillStyle = "rgba(27,25,24,0.5)";
  for (const [a, b] of [[220, x0 - 10], [x1 + 12, 1700]]) for (let i = 0; y0 + 6 + i * 16 < y0 + ph; i++) {
    const end = i % 9 === 8, wdt = end ? (b - a) * (0.3 + h32(i, a, 1431) * 0.4) : (b - a) - h32(i, a, 1432) * 8;
    c.fillRect(a, y0 + 6 + i * 16, wdt, 5);
  }
}
// the eye as the paper's photo, from its flipbook (print.js): a drawing per tenth of a second, from the song's clock.
// Open, it cycles three sheets whose dots were screened apart (the boil); closing, it shows the drawing its closure
// has reached. Every sheet sits a pixel or two off the last, the way a flipbook's pages never line up; the sleepless
// eye's red plate lands off register by its own few pixels. zoom: a closer crop of the same photo, on the iris
function newsEye(c, K, x, y, close, o = {}) {
  const E = o.red ? K.F.eyeRed : K.F.eye, di = Math.floor(K.t * NEWS_FPS), w = E.w, h = E.h, z = o.zoom ?? 1;
  const ink = close >= 0.97 ? E.inks[5] : close >= 0.6 ? E.inks[4] : close >= 0.2 ? E.inks[3] : E.inks[di % 3];
  const fx = ((EYE.iris[0] - EYE.view[0]) / (EYE.view[2] - EYE.view[0]) - 0.5) * w, fy = ((EYE.iris[1] - EYE.view[1]) / (EYE.view[3] - EYE.view[1]) - 0.5) * h;
  c.save(); c.translate(x + (h32(di, 1411) - 0.5) * 5, y + (h32(di, 1412) - 0.5) * 5); c.rotate((h32(di, 1413) - 0.5) * 0.006);
  c.save(); c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.clip();
  c.fillStyle = "rgba(70,52,28,0.07)"; c.fillRect(-w / 2, -h / 2, w, h);
  c.translate(fx, fy); c.scale(z, z); c.translate(-fx, -fy);
  c.drawImage(ink, -w / 2, -h / 2);
  if (E.red) {
    c.globalCompositeOperation = "multiply";
    c.drawImage(E.red, -w / 2 + 3 + (h32(di, 1414) - 0.5) * 10, -h / 2 + 2 + (h32(di, 1415) - 0.5) * 10);
    c.globalCompositeOperation = "source-over";
  }
  c.restore();
  c.strokeStyle = NEWS_INK; c.lineWidth = 3; c.strokeRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
  c.restore();
}
// a surveillance timestamp in the photo's corner (the 3:47 AM still)
function cctv(c, K, x, y) {
  const sec = 12 + Math.floor(K.t - K.t0), on = Math.floor(K.t * NEWS_FPS / 3) % 2 === 0;
  c.font = font(34, MONO, "600"); c.textAlign = "right"; c.textBaseline = "alphabetic";
  const s = `03:47:${String(sec).padStart(2, "0")} AM`, tw = c.measureText(s).width;
  c.fillStyle = "rgba(11,10,15,0.8)"; c.fillRect(x - tw - 88, y - 36, tw + 108, 50);
  c.fillStyle = "#ff3344"; c.fillText(s, x, y);
  if (on) { c.beginPath(); c.arc(x - tw - 50, y - 11, 11, 0, 7); c.fill(); }
}

// the data center as the paper's aerial photo (a screen print with a keyline): key "hall" (one hall) or "halls";
// think: its roof wired up and firing (the building that thinks)
function hall(c, K, o = {}) {
  const key = o.key ?? "hall", w = o.w ?? 1100, pr = K.F.prints[key].print, h = w * pr.height / pr.width;
  printAt(c, K, key, o.x ?? 960, o.y ?? 600, w, o.rot ?? 0, { off: o.off ?? w * 0.018, shadow: o.shadow ?? "rgba(255,42,61,0.55)" });
  if (!o.think) return;
  c.save(); c.translate(o.x ?? 960, o.y ?? 600); c.rotate(o.rot ?? 0);
  thinkNet(c, K, w, h, o.think);
  c.restore();
}
// the roof as a net: nodes dealt over the hall's roof (ROOF, in the crop), each linked to its two nearest; the links
// carry pulses, the nodes flare on the kick, and a scan runs down the hall once a beat. amount: 0..1 how awake it is
const NET = (() => {
  const n = 34, pts = [];
  for (let i = 0; i < n; i++) pts.push([0.04 + h32(i, 731) * 0.92, 0.1 + h32(i, 732) * 0.8]);
  const links = [];
  pts.forEach((p, i) => {
    const near = pts.map((q, j) => [j, Math.hypot((p[0] - q[0]) * 4, p[1] - q[1])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2);
    for (const [j] of near) if (!links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) links.push([i, j]);
  });
  return { pts, links };
})();
function thinkNet(c, K, w, h, amount) {
  const at = (u, v) => {                                          // u along the hall (near end -> far end), v across it
    const x = ROOF.bl[0] + (ROOF.tl[0] - ROOF.bl[0]) * u + (ROOF.br[0] - ROOF.bl[0]) * v;
    const y = ROOF.bl[1] + (ROOF.tl[1] - ROOF.bl[1]) * u + (ROOF.br[1] - ROOF.bl[1]) * v;
    return [(x - 0.5) * w, (y - 0.5) * h];
  };
  const t = K.t, kick = K.k, P = NET.pts.map(([u, v]) => at(u, v));
  c.save(); c.lineCap = "round";
  // the scan: a red band across the hall, sweeping from the near end to the far end once a beat
  const su = ((t - (song.lastKick(t)?.t ?? t)) / 0.4) % 1, a0 = at(su, -0.05), a1 = at(su, 1.05);
  c.strokeStyle = `rgba(255,42,61,${0.55 * amount})`; c.lineWidth = 26; c.beginPath(); c.moveTo(...a0); c.lineTo(...a1); c.stroke();
  c.strokeStyle = `rgba(255,230,230,${0.8 * amount})`; c.lineWidth = 4; c.beginPath(); c.moveTo(...a0); c.lineTo(...a1); c.stroke();
  // the links, and a pulse riding each
  c.strokeStyle = `rgba(255,42,61,${0.75 * amount})`; c.lineWidth = 3;
  for (const [i, j] of NET.links) { c.beginPath(); c.moveTo(...P[i]); c.lineTo(...P[j]); c.stroke(); }
  c.fillStyle = `rgba(255,236,236,${amount})`;
  NET.links.forEach(([i, j], k) => {
    const f = (t * (1.2 + h32(k, 741) * 1.6) + h32(k, 742)) % 1;
    c.beginPath(); c.arc(P[i][0] + (P[j][0] - P[i][0]) * f, P[i][1] + (P[j][1] - P[i][1]) * f, 5, 0, 7); c.fill();
  });
  // the nodes: flare on the kick, a few dealt hot per beat
  const beat = song.lastKick(t)?.i ?? 0;
  P.forEach((p, i) => {
    const hot = h32(i, beat, 751) < 0.3, r = 7 + (hot ? kick * 16 : kick * 5);
    c.fillStyle = hot ? `rgba(255,42,61,${amount})` : `rgba(21,19,26,${0.85 * amount})`;
    c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
    c.strokeStyle = `rgba(255,42,61,${amount})`; c.lineWidth = 3; c.stroke();
  });
  c.restore();
}
function thinkingPill(c, K, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = BONE; rr(c, -250, -58, 500, 116, 58); c.fill(); c.lineWidth = 8; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(-180, 0, 26, K.t * 9, K.t * 9 + 4.2); c.lineWidth = 9; c.lineCap = "round"; c.strokeStyle = C.red; c.stroke();
  c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText("THINKING" + ".".repeat(Math.floor(K.t * 5) % 4), -130, 2);
  c.restore();
}
function reactBox(c, K, t0, x = 1400, y = 520, img = K.F.altman, bg = P.cyan) {
  if (K.t < t0) return;
  const e = easeOutBack((K.t - t0) / 0.25), w = REACT_W, h = REACT_H;
  c.save(); c.translate(x + w / 2, y + h / 2); c.scale(e, e); c.rotate(0.05); c.translate(-(x + w / 2), -(y + h / 2));
  c.fillStyle = INK; rr(c, x - 4, y + 10, w + 28, h + 28, 18); c.fill();
  c.fillStyle = BONE; rr(c, x - 14, y - 14, w + 28, h + 28, 18); c.fill();
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  c.drawImage(img, x, y);
  c.fillStyle = C.red; rr(c, x - 30, y - 42, 190, 62, 10); c.fill();
  c.font = font(36, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("REACT", x - 6, y - 10);
  c.restore();
}

function counter(c, K) {
  const f = K.w("FORTY#0"), th = K.w("THOUSAND#0"), digits = "40000";
  if (!f) return;
  const land = [f.t + 0.04, f.end, th ? th.t + 0.06 : f.end + 0.2, th ? th.t + 0.18 : f.end + 0.3, th ? th.end : f.end + 0.4];
  const bw = 250, bh = 340, gap = 24, comma = 70, tw = 5 * bw + 4 * gap + comma, x0 = 960 - tw / 2, y0 = 300;
  for (let i = 0; i < 5; i++) {
    const x = x0 + i * (bw + gap) + (i >= 2 ? comma : 0), done = K.t >= land[i], s = done ? since(K.t, land[i], 0.07) : 0;
    c.save(); c.translate(x + bw / 2, y0 + bh / 2); c.scale(1 + s * 0.12, 1 + s * 0.12); c.translate(-(x + bw / 2), -(y0 + bh / 2));
    c.fillStyle = BONE; rr(c, x + 16, y0 + 18, bw, bh, 20); c.fill();
    c.fillStyle = INK; rr(c, x, y0, bw, bh, 20); c.fill();
    c.save(); c.beginPath(); c.rect(x, y0 + 10, bw, bh - 20); c.clip();
    c.font = font(300); c.textAlign = "center"; c.textBaseline = "alphabetic";
    if (done) { c.fillStyle = s > 0.6 ? C.red : BONE; c.fillText(digits[i], x + bw / 2, y0 + bh * 0.83); }
    else {                      // the reel spinning: two digits scrolling past
      const v = K.t * 26 + i * 3.3, d0 = Math.floor(v) % 10, fr = v - Math.floor(v);
      c.fillStyle = "rgba(244,241,234,0.85)";
      c.fillText(String(d0), x + bw / 2, y0 + bh * 0.83 + fr * bh); c.fillText(String((d0 + 1) % 10), x + bw / 2, y0 + bh * 0.83 + (fr - 1) * bh);
    }
    c.restore(); c.restore();
  }
  const cx0 = x0 + 2 * (bw + gap) + comma / 2 - gap / 2; c.fillStyle = INK; c.beginPath(); c.arc(cx0, y0 + bh - 24, 22, 0, 7); c.fill();
  c.beginPath(); c.moveTo(cx0 + 20, y0 + bh - 20); c.quadraticCurveTo(cx0 + 16, y0 + bh + 30, cx0 - 18, y0 + bh + 52); c.lineTo(cx0 - 4, y0 + bh - 16); c.closePath(); c.fill();
}
function rain(c, K, n = 16) {
  const keys = ["rtx3070", "radeon7790", "gtx1080ti", "rtx3090"];
  for (let i = 0; i < n; i++) {
    const sp = 900 + h32(i, 801) * 700, y = ((K.t - K.t0) * sp + h32(i, 802) * 1500) % 1700 - 300, x = h32(i, 803) * 2000 - 40;
    printAt(c, K, keys[i % 4], x, y, 230 + h32(i, 804) * 180, (h32(i, 805) - 0.5) * 2 + K.t * (h32(i, 806) - 0.5) * 3, { off: 0, alpha: 0.9 });
  }
}
// cards flying into the building (it bought them), landing somewhere in box [x, y, w, h]
function intake(c, K, t0, box = [760, 450, 400, 450]) {
  const keys = ["rtx3070", "radeon7790", "gtx1080ti", "rtx3090"];
  for (let i = 0; i < 12; i++) {
    const u = clamp((K.t - t0 - i * 0.05) / 0.5);
    if (u <= 0 || u >= 1) continue;
    const e = easeIn(u), sx = h32(i, 821) < 0.5 ? -200 : 2120, sy = h32(i, 822) * 700;
    const tx = box[0] + h32(i, 823) * box[2], ty = box[1] + h32(i, 824) * box[3];
    printAt(c, K, keys[i % 4], lerp(sx, tx, e), lerp(sy, ty, e), lerp(420, 20, e), u * 6 * (h32(i, 825) - 0.5), { off: 0 });
  }
}

function wall(c, K) {
  const f = K.w("FORTY#1"), th = K.w("THOUSAND#1"), u = clamp((K.t - K.t0) / Math.max(0.3, K.t1 - K.t0 - 0.15));
  const sc = 3.2 * Math.pow(0.07 / 3.2, ease(u)) * 200 / 256;          // the icon's width, over 256 px
  c.fillStyle = INK; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, H + 2 * BLEED);
  let li = 0; while (li < 5 && sc * (2 << li) <= 1) li++;               // the level shown at a scale in (0.5, 1] (or above, at 256)
  const lp = K.F.pCards[li], ls = sc * (1 << li);
  lp.setTransform(new DOMMatrix().translate(960, 540).scale(ls).translate(-(128 >> li), -(80 >> li)));
  c.fillStyle = lp; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, H + 2 * BLEED);
  c.fillStyle = `rgba(11,10,15,${0.25 + 0.45 * u})`; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, H + 2 * BLEED);
  if (f && K.t >= f.t - 0.03) {
    const k = clamp((K.t - f.t) / Math.max(0.2, (th ? th.end : f.end + 0.5) - f.t)), n = Math.round(lerp(1, 40000, easeOut(k)));
    const s = since(K.t, f.t - 0.03, 0.07);
    c.save(); c.translate(960, 520); c.scale(1 + s * 0.3, 1 + s * 0.3);
    c.font = font(380); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = INK; c.fillText(n.toLocaleString("en-US"), 18, 22); c.fillStyle = C.red; c.fillText(n.toLocaleString("en-US"), 0, 0);
    c.restore();
  }
}

function bubble(c, K) {
  const e = easeOutBack((K.t - K.t0) / 0.25), puffs = [[0, 0, 330], [-300, 50, 230], [300, 40, 240], [-160, -170, 220], [170, -160, 230], [0, 170, 240], [-360, -80, 160], [370, -70, 170]];
  c.save(); c.translate(960, 470); c.scale(e, e);
  for (const [pass, col, grow] of [[0, INK, 14], [1, BONE, 0]]) {
    c.fillStyle = col;
    for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x, y, r + grow, 0, 7); c.fill(); }
    for (const [x, y, r] of [[-420, 330, 70], [-520, 450, 44], [-590, 540, 26]]) { c.beginPath(); c.arc(x, y, r + grow, 0, 7); c.fill(); }
  }
  c.restore();
  thinkingPill(c, K, 960, 470, 1.6 * e);
}

// ---------- verse 1's other steps (the creator's "Build please", 9/26 19:04: steps 1, 2 and 6 to 11 as the fast cut) ----------
// a label that isn't sung (a price, a year): big type with the riso offset, slammed in at t0
function slam(c, K, t0, text, x, y, size, col = INK, o = {}) {
  if (K.t < t0) return 0;
  const s = since(K.t, t0, 0.07), sc = 1 + s * (o.pop ?? 0.35);
  c.save(); c.translate(x, y); c.rotate(o.rot ?? 0); c.scale(sc, sc);
  c.font = font(size, o.fam ?? DISPLAY, o.weight ?? ""); c.textAlign = o.align ?? "center"; c.textBaseline = "alphabetic";
  const off = Math.max(4, size * 0.035);
  if (o.shadow !== null) { c.fillStyle = o.shadow ?? BONE; c.fillText(text, off, off); }
  c.fillStyle = s > 0.6 ? (o.flash ?? BONE) : col; c.fillText(text, 0, 0);
  c.restore();
  return s;
}
const printW = (K, key, h) => { const p = K.F.prints[key].print; return h * p.width / p.height; };

function notepad(c, K) {
  const x = 1040, y = 110, w = 660, h = 860, items = ["CPU", "GPU", "RAM", "SSD", "BOARD", "PSU", "COOLER", "CASE"];
  const inY = lerp(900, 0, easeOutBack((K.t - K.t0) / 0.28)), span = Math.max(0.3, K.t1 - K.t0 - 0.15);
  c.save(); c.translate(0, inY); c.translate(x + w / 2, y + h / 2); c.rotate(0.035); c.translate(-(x + w / 2), -(y + h / 2));
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(x + 22, y + 26, w, h);
  c.fillStyle = "#fff4a8"; c.fillRect(x, y, w, h);
  c.fillStyle = INK; c.fillRect(x, y, w, 70);
  c.strokeStyle = "rgba(40,90,200,0.35)"; c.lineWidth = 3;
  for (let i = 0; i < 11; i++) { c.beginPath(); c.moveTo(x, y + 150 + i * 68); c.lineTo(x + w, y + 150 + i * 68); c.stroke(); }
  c.strokeStyle = "rgba(255,42,61,0.6)"; c.beginPath(); c.moveTo(x + 110, y + 70); c.lineTo(x + 110, y + h); c.stroke();
  c.font = font(40, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("THE BUILD", x + 130, y + 128);
  items.forEach((it, i) => {
    if (K.t < K.t0 + 0.1 + i * span / items.length) return;
    const yy = y + 150 + (i + 1) * 68 - 14;
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(x + 50, yy - 40, 38, 38);
    c.font = font(52); c.fillStyle = INK; c.fillText(it, x + 130, yy);
  });
  c.restore();
}

// a browser window whose tabs pop in one by one (labels: [{label, t}]); the newest tab's name fills the page
function browserTabs(c, K, labels, o = {}) {
  const x = o.x ?? 120, y = o.y ?? 400, w = o.w ?? 1680, h = o.h ?? 560;
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, x + 20, y + 24, w, h, 20); c.fill();
  c.fillStyle = "#1d1a24"; rr(c, x, y, w, h, 20); c.fill();
  const shown = labels.filter(l => K.t >= l.t), n = Math.max(1, shown.length), tw = Math.min(360, (w - 60) / n);
  shown.forEach((l, i) => {
    const pop = easeOutBack((K.t - l.t) / 0.15), tx = x + 20 + i * tw, active = i === shown.length - 1;
    c.save(); c.translate(tx + tw / 2, y + 100); c.scale(1, Math.max(0.01, pop)); c.translate(-(tx + tw / 2), -(y + 100));
    c.fillStyle = active ? BONE : "#3a3644"; rr(c, tx + 3, y + 16, tw - 6, 84, [16, 16, 0, 0]); c.fill();
    c.font = font(Math.min(48, tw * 0.3), MONO, "600"); c.fillStyle = active ? INK : "#cfcad8"; c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText(l.label, tx + 20, y + 60, Math.max(4, tw - 36));
    c.restore();
  });
  c.fillStyle = BONE; c.fillRect(x + 16, y + 100, w - 32, h - 116);
  const last = shown[shown.length - 1];
  if (last && !o.noPage) { c.font = font(o.pageSize ?? 230); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(last.label, x + w / 2, y + h * 0.78); }
  return { x, y, w, h };
}

function vhs(c, K) {
  const t = K.t, fr = Math.floor(t * 30), tw = K.w("TWENTY"), s = tw ? since(t, tw.t - 0.03, 0.08) : 0;
  c.font = font(72, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillText("PLAY", 200, 250); c.beginPath(); c.moveTo(110, 190); c.lineTo(170, 222); c.lineTo(110, 254); c.closePath(); c.fill();
  c.textAlign = "right"; c.fillText("SP", 1800, 250);
  c.save(); c.translate(960, 600); c.scale(1 + s * 0.2, 1 + s * 0.2);
  c.font = font(440, MONO, "600"); c.textAlign = "center"; c.textBaseline = "middle";
  c.globalAlpha = 0.75; c.fillStyle = C.red; c.fillText("2019", -10, 0); c.fillStyle = C.cyan; c.fillText("2019", 10, 0); c.globalAlpha = 1;
  c.fillStyle = BONE; c.fillText("2019", 0, 0); c.restore();
  c.font = font(56, MONO, "600"); c.textAlign = "left"; c.fillStyle = BONE; c.fillText("JAN. 01 2019", 140, 960);
  c.textAlign = "right"; c.fillText("12:00 AM", 1780, 960);
  c.fillStyle = "rgba(0,0,0,0.2)"; for (let y = -BLEED; y < H + BLEED; y += 6) c.fillRect(-BLEED, y, W + 2 * BLEED, 3);
  const by = ((t * 380) % (H + 200)) - 100;           // a tracking band rolling down
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + h32(i, fr, 931) * 0.5})`; c.fillRect(h32(i, fr, 932) * W, by + h32(i, fr, 933) * 60, 20 + h32(i, fr, 934) * 160, 3); }
}

function smiley(c, cx, cy, r, t) {
  c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 6) * 0.12);
  c.fillStyle = INK; c.beginPath(); c.arc(16, 20, r, 0, 7); c.fill();
  c.fillStyle = P.yellow; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.lineWidth = r * 0.06; c.strokeStyle = INK; c.stroke();
  c.fillStyle = INK; c.beginPath(); c.ellipse(-r * 0.33, -r * 0.2, r * 0.09, r * 0.17, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(r * 0.33, -r * 0.2, r * 0.09, r * 0.17, 0, 0, 7); c.fill();
  c.lineWidth = r * 0.08; c.lineCap = "round"; c.beginPath(); c.arc(0, r * 0.05, r * 0.55, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  c.restore();
}

// a price on a swinging tag (the sale tag's shape), optionally with the old price struck through above it
function tag(c, K, cx, top, label, o = {}) {
  const swing = Math.sin((K.t - K.t0) * 6.5) * 0.14 * Math.exp(-(K.t - K.t0) * 0.8), s = o.s ?? 1;
  c.save(); c.translate(cx, top); c.rotate(swing); c.scale(s, s);
  c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(0, -300); c.lineTo(0, 0); c.stroke();
  c.rotate(o.rot ?? 0.1);
  const shape = () => { c.beginPath(); c.moveTo(-80, 0); c.lineTo(80, 0); c.lineTo(280, 170); c.lineTo(280, 640); c.lineTo(-280, 640); c.lineTo(-280, 170); c.closePath(); };
  c.save(); c.translate(20, 24); shape(); c.fillStyle = "rgba(21,19,26,0.4)"; c.fill(); c.restore();
  shape(); c.fillStyle = o.fill ?? BONE; c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(0, 66, 28, 0, 7); c.fillStyle = C.red; c.fill(); c.lineWidth = 8; c.stroke();
  if (o.old) { c.font = font(60, MONO, "600"); c.fillStyle = "rgba(21,19,26,0.55)"; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.old, 0, 280); c.fillStyle = C.red; c.fillRect(-120, 258, 240, 8); }
  const ts = o.t0 !== undefined ? since(K.t, o.t0, 0.07) : 0;
  c.save(); c.translate(0, o.old ? 470 : 430); c.scale(1 + ts * 0.35, 1 + ts * 0.35);
  c.font = font(o.size ?? 230); c.fillStyle = o.col ?? INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(label, 0, 60);
  c.restore();
  if (o.sub) { c.font = font(44, MONO, "600"); c.fillStyle = "rgba(21,19,26,0.6)"; c.textAlign = "center"; c.fillText(o.sub, 0, 590); }
  c.restore();
}
// the kick montage: every part of the build, one per kick
// (the creator's note, 9/26 22:45: real photos for the CPU, the SSD and the PSU; each part printed by its own MONTAGE recipe)
const PARTS = [
  { name: "GPU", price: "$499", paper: P.violet, pat: "rays", prop: (c, K) => printAt(c, K, "m-gpu", 1250, 520, 1150, -0.1 + (K.t - K.t0) * 0.3, { off: 24 }) },
  { name: "RAM", price: "$40", paper: P.green, pat: "stripes", prop: (c, K) => printAt(c, K, "m-ram", 1200, 540, 1300, 0.08 - (K.t - K.t0) * 0.2, { off: 22 }) },
  { name: "CPU", price: "$189", paper: P.orange, pat: "grid", prop: (c, K) => printAt(c, K, "m-cpu", 1260, 540, 610, 0.2 - (K.t - K.t0) * 0.5, { off: 22 }) },
  { name: "SSD", price: "$45", paper: P.cyan, pat: "dots", prop: (c, K) => printAt(c, K, "m-ssd", 1230, 560, 1200, -0.12 + (K.t - K.t0) * 0.2, { off: 20 }) },
  { name: "PSU", price: "$89", paper: P.pink, pat: "rays", prop: (c, K) => printAt(c, K, "m-psu", 1260, 540, 820, 0.06 - (K.t - K.t0) * 0.15, { off: 24 }) },
];
function partCard(c, K, part) {
  part.prop(c, K);
  slam(c, K, K.t0 + 0.03, part.name, 110, 760, 460, INK, { align: "left", shadow: BONE });
  burst(c, 520, 900, 150 * easeOutBack((K.t - K.t0 - 0.06) / 0.14), 16, C.amber, INK, part.price, 84, -0.12);
}

const BUILDLIST = [["CPU", 189], ["GPU", 499], ["RAM", 40], ["SSD", 45], ["BOARD", 119], ["PSU", 89], ["COOLER", 39], ["CASE", 180]];
function receipt(c, K) {
  const x = 1060, w = 620, lh = 70, full = 170 + (BUILDLIST.length + 2) * lh + 60, hh = full * easeOut((K.t - K.t0) / 0.5), y0 = -20;
  c.save(); c.translate(x + w / 2, 0); c.rotate(0.02); c.translate(-(x + w / 2), 0);
  c.fillStyle = "rgba(21,19,26,0.3)"; c.fillRect(x + 18, y0, w, hh + 22);
  c.fillStyle = "#fbf8f0"; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + w, y0);
  for (let i = 0; i <= 20; i++) c.lineTo(x + w - i * w / 20, y0 + hh + (i % 2 ? 16 : 0));
  c.closePath(); c.fill();
  c.save(); c.beginPath(); c.rect(x, y0, w, hh); c.clip();
  c.font = font(40, MONO, "600"); c.fillStyle = INK; c.textBaseline = "alphabetic"; c.textAlign = "center"; c.fillText("THE BUILD  ·  RECEIPT", x + w / 2, y0 + 100);
  let y = y0 + 170;
  BUILDLIST.forEach(([n, pr]) => { c.textAlign = "left"; c.fillText(n, x + 40, y); c.textAlign = "right"; c.fillText("$" + pr, x + w - 40, y); y += lh; });
  c.fillRect(x + 40, y - 36, w - 80, 4);
  const tw = K.w("TWELVE"), hot = tw && K.t >= tw.t - 0.03;
  c.font = font(64); c.fillStyle = hot ? C.red : INK; c.textAlign = "left"; c.fillText("TOTAL", x + 40, y + 40); c.textAlign = "right"; c.fillText("$1,200", x + w - 40, y + 40);
  c.restore(); c.restore();
}

function piggy(c, K, cx, cy, s) {
  c.save(); c.translate(cx, cy); c.scale(s * (1 + K.k * 0.03), s * (1 - K.k * 0.03));
  c.lineWidth = 12; c.strokeStyle = INK;
  c.fillStyle = "rgba(21,19,26,0.3)"; c.beginPath(); c.ellipse(22, 32, 300, 220, 0, 0, 7); c.fill();
  c.fillStyle = "#ff8fb3"; for (const lx of [-170, -80, 90, 180]) { rr(c, lx - 34, 140, 68, 110, 20); c.fill(); c.stroke(); }
  c.fillStyle = "#ff9ec0"; c.beginPath(); c.ellipse(0, 0, 300, 220, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-150, -170); c.lineTo(-90, -262); c.lineTo(-40, -192); c.closePath(); c.fillStyle = "#ff8fb3"; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(-290, 20, 70, 90, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = INK; c.beginPath(); c.ellipse(-300, -5, 12, 22, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(-300, 45, 12, 22, 0, 0, 7); c.fill();
  c.beginPath(); c.arc(-180, -60, 16, 0, 7); c.fill();
  rr(c, -40, -228, 150, 24, 12); c.fill();
  c.beginPath(); c.moveTo(296, -10); c.bezierCurveTo(360, -60, 380, 40, 330, 20); c.lineWidth = 10; c.stroke();
  c.restore();
  // a coin drops in on every kick
  song.kicks.filter(x => x >= K.t0 - 0.2 && x <= K.t).forEach(kt => {
    const u = (K.t - kt) / 0.22; if (u > 1) return;
    const x = cx + 35 * s, y = lerp(cy - 760 * s, cy - 226 * s, easeIn(u));
    c.save(); c.translate(x, y); c.scale(1, 0.92); c.fillStyle = C.amber; c.beginPath(); c.arc(0, 0, 50 * s, 0, 7); c.fill();
    c.lineWidth = 8 * s; c.strokeStyle = INK; c.stroke(); c.font = font(64 * s); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 0, 4 * s); c.restore();
  });
}

function progress(c, K, x, y, w, h, frac, o = {}) {
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, x + 16, y + 18, w, h, h / 2); c.fill();
  c.fillStyle = INK; rr(c, x, y, w, h, h / 2); c.fill();
  const fw = Math.max(h - 24, (w - 24) * clamp(frac));
  c.save(); rr(c, x + 12, y + 12, fw, h - 24, (h - 24) / 2); c.clip();
  c.fillStyle = o.col ?? "#19db73"; c.fillRect(x, y, w, h);
  c.fillStyle = "rgba(255,255,255,0.22)";            // barber stripes running through the fill
  for (let i = -2; i < w / 40 + 2; i++) { const bx = x + i * 40 + ((K.t * 160) % 40); c.beginPath(); c.moveTo(bx, y + h); c.lineTo(bx + 20, y + h); c.lineTo(bx + 20 + h, y); c.lineTo(bx + h, y); c.closePath(); c.fill(); }
  c.restore();
  if (o.label) { c.font = font(h * 0.62); c.fillStyle = BONE; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(o.label, x + w - 36, y + h * 0.54); }
}
function spinner(c, x, y, r, t, col = BONE) { c.beginPath(); c.arc(x, y, r, t * 9, t * 9 + 4.3); c.lineWidth = r * 0.26; c.lineCap = "round"; c.strokeStyle = col; c.stroke(); }

// step six: the old stick in a museum case, its placard in serif
function museum(c, K) {
  const g = c.createRadialGradient(1260, 380, 60, 1260, 520, 700);
  g.addColorStop(0, "rgba(255,244,210,0.55)"); g.addColorStop(1, "rgba(255,244,210,0)");
  c.fillStyle = g; c.fillRect(600, -BLEED, 1400, 1400);
  c.fillStyle = "#3a2a1a"; c.fillRect(890, 690, 740, 60); c.fillStyle = "#5a4128"; c.fillRect(930, 750, 660, 280);
  printAt(c, K, "ddr4-16g", 1260, 560 + Math.sin(K.t * 2) * 8, 820, -0.03, { off: 18 });
  const pl = easeOutBack((K.t - K.t0 - 0.25) / 0.3);
  if (pl > 0) {
    c.save(); c.translate(1260, 880); c.scale(pl, pl);
    c.fillStyle = "#f6efdc"; c.fillRect(-270, -90, 540, 180); c.strokeStyle = "#3a2a1a"; c.lineWidth = 4; c.strokeRect(-258, -78, 516, 156);
    c.font = font(58, SERIF); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("16 GB DDR4", 0, -8);
    c.font = font(28, MONO, "600"); c.fillText("THE OLD KIND  ·  c. 2019", 0, 44);
    c.restore();
  }
}
// step six: the price won't hold still, then it lands at $120 and the stick goes red
function priceFlip(c, K) {
  const tw = K.w("TWENTY"), land = tw ? tw.t - 0.03 : K.t0 + 0.7, landed = K.t >= land, pr = K.F.prints["ddr4-16g"].print;
  const w = 1250, h = w * pr.height / pr.width;
  printAt(c, K, "ddr4-16g", 960, 330, w, -0.05, { off: 22, shadow: landed ? "rgba(255,42,61,0.9)" : "rgba(244,241,234,0.25)" });
  if (landed) {
    c.save(); c.translate(960, 330); c.rotate(-0.05); c.globalAlpha = 0.5 + 0.2 * Math.sin(K.t * 30);
    c.drawImage(silhouette(K.F, "ddr4-16g", C.red), -w / 2, -h / 2, w, h); c.restore();
  }
  c.font = font(90, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.6)"; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("$40", 140, 720);
  c.fillStyle = C.red; c.fillRect(130, 686, 180, 10);
  const label = landed ? "$120" : "$" + Math.round(40 + h32(Math.floor(K.t * 20), 3) * 3500).toLocaleString("en-US");
  slam(c, K, landed ? land : K.t0, label, 1000, 940, 380, landed ? C.red : BONE, { shadow: INK, pop: landed ? 0.5 : 0 });
  if (landed) burst(c, 1640, 720, 150 * easeOutBack((K.t - land) / 0.14), 16, C.amber, INK, "+200%", 64, 0.14);
  return { invert: landed && K.t < land + 2 / 30 ? 1 : 0 };
}

function phone(c, K, cx, cy, h, o = {}) {
  const w = h * 0.5;
  c.save(); c.translate(cx, cy); c.rotate(-0.06); c.scale(o.squeeze ?? 1, 1);
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, -w / 2 + 22, -h / 2 + 26, w, h, w * 0.16); c.fill();
  c.fillStyle = INK; rr(c, -w / 2, -h / 2, w, h, w * 0.16); c.fill();
  c.fillStyle = o.xray ? "#0e2a33" : BONE; rr(c, -w / 2 + 20, -h / 2 + 20, w - 40, h - 40, w * 0.12); c.fill();
  c.fillStyle = INK; rr(c, -w * 0.15, -h / 2 + 34, w * 0.3, 30, 15); c.fill();
  if (o.xray) {                 // the inside: memory chips, shrinking
    const k = o.chip ?? 1;
    for (let i = 0; i < 6; i++) {
      const cw = w * 0.34 * k, chh = h * 0.13 * k, px = (i % 2 ? 0.2 : -0.2) * w, py = (-0.28 + Math.floor(i / 2) * 0.26) * h;
      c.fillStyle = "#15131a"; c.fillRect(px - cw / 2, py - chh / 2, cw, chh); c.strokeStyle = C.cyan; c.lineWidth = 3; c.strokeRect(px - cw / 2, py - chh / 2, cw, chh);
    }
  } else {
    c.font = font(w * 0.09, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("STORAGE", 0, -h * 0.12);
    c.font = font(w * 0.3); c.fillStyle = o.hot ? C.red : INK; c.fillText(o.gb ?? "", 0, h * 0.12);
    c.fillStyle = "rgba(21,19,26,0.15)"; c.fillRect(-w * 0.34, h * 0.2, w * 0.68, 30);
    c.fillStyle = C.red; c.fillRect(-w * 0.34, h * 0.2, w * 0.68 * (o.frac ?? 1), 30);
  }
  c.restore();
}

function checkMark(c, K, cx, cy, s, t0) {
  const u = clamp(easeOut((K.t - t0) / 0.2));
  if (u <= 0) return;
  const p = [[-s * 0.5, 0], [-s * 0.12, s * 0.38], [s * 0.6, -s * 0.45]];
  const path = () => {
    c.beginPath(); c.moveTo(...p[0]);
    if (u > 0.4) { c.lineTo(...p[1]); c.lineTo(lerp(p[1][0], p[2][0], (u - 0.4) / 0.6), lerp(p[1][1], p[2][1], (u - 0.4) / 0.6)); }
    else c.lineTo(lerp(p[0][0], p[1][0], u / 0.4), lerp(p[0][1], p[1][1], u / 0.4));
  };
  c.save(); c.translate(cx, cy); c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = s * 0.2;
  c.translate(18, 22); path(); c.strokeStyle = "rgba(21,19,26,0.4)"; c.stroke(); c.translate(-18, -22);
  path(); c.strokeStyle = BONE; c.stroke();
  c.restore();
}
function cardboard(c, K, cx, cy, s) {
  const f = Math.sin((K.t - K.t0) * 9) * 0.08 * Math.exp(-(K.t - K.t0) * 2);
  c.save(); c.translate(cx, cy); c.rotate(-0.05 + f); c.lineWidth = 10; c.strokeStyle = INK; c.lineJoin = "round";
  const W2 = s, H2 = s * 0.72, D = s * 0.32;
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(-W2 / 2 + 24, -H2 / 2 + 28, W2 + D * 0.6, H2);
  c.fillStyle = "#a8703a"; c.beginPath(); c.moveTo(W2 / 2, -H2 / 2); c.lineTo(W2 / 2 + D * 0.6, -H2 / 2 - D * 0.45); c.lineTo(W2 / 2 + D * 0.6, H2 / 2 - D * 0.45); c.lineTo(W2 / 2, H2 / 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#d9a468"; c.beginPath(); c.moveTo(-W2 / 2, -H2 / 2); c.lineTo(-W2 / 2 + D * 0.6, -H2 / 2 - D * 0.45); c.lineTo(W2 / 2 + D * 0.6, -H2 / 2 - D * 0.45); c.lineTo(W2 / 2, -H2 / 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#c68c4e"; c.fillRect(-W2 / 2, -H2 / 2, W2, H2); c.strokeRect(-W2 / 2, -H2 / 2, W2, H2);
  c.fillStyle = "rgba(255,244,210,0.55)"; c.beginPath(); c.moveTo(-W2 * 0.08, -H2 / 2); c.lineTo(W2 * 0.08, -H2 / 2); c.lineTo(W2 * 0.08 + D * 0.6, -H2 / 2 - D * 0.45); c.lineTo(-W2 * 0.08 + D * 0.6, -H2 / 2 - D * 0.45); c.closePath(); c.fill();
  c.fillStyle = INK;
  for (const ax of [-W2 * 0.3, -W2 * 0.12]) { c.beginPath(); c.moveTo(ax, -H2 * 0.08); c.lineTo(ax + 34, -H2 * 0.2); c.lineTo(ax + 68, -H2 * 0.08); c.closePath(); c.fill(); c.fillRect(ax + 24, -H2 * 0.09, 20, 70); }
  c.font = font(52, MONO, "600"); c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("THIS SIDE UP", -W2 * 0.33, H2 * 0.32);
  c.restore();
}
function floorScene(c, K) {
  c.fillStyle = "rgba(60,44,28,0.35)"; c.fillRect(-BLEED, 760, W + 2 * BLEED, 600);
  c.strokeStyle = "rgba(60,44,28,0.6)"; c.lineWidth = 4; c.beginPath(); c.moveTo(-BLEED, 760); c.lineTo(W + BLEED, 760); c.stroke();
  for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(960 + (i - 3.5) * 120, 760); c.lineTo(960 + (i - 3.5) * 520, H + BLEED); c.stroke(); }
  c.fillStyle = "rgba(21,19,26,0.35)"; c.beginPath(); c.ellipse(1200, 905, 330, 40, 0, 0, 7); c.fill();
  tower(c, K, 1010, 330, 380, 580, false, true);
  c.fillStyle = "rgba(60,44,28,0.5)";
  for (let i = 0; i < 60; i++) { const y = ((h32(i, 961) * 700 - K.t * (20 + h32(i, 962) * 30)) % 700 + 700) % 700 + 150; c.beginPath(); c.arc(700 + h32(i, 963) * 1100 + Math.sin(K.t + i) * 10, y, 2 + h32(i, 964) * 4, 0, 7); c.fill(); }
}
function halo(c, K, cx, cy) {
  c.save(); c.translate(cx, cy + Math.sin(K.t * 3) * 10);
  c.strokeStyle = "rgba(255,240,170,0.5)"; c.lineWidth = 60; c.beginPath(); c.ellipse(0, 0, 230, 52, 0, 0, 7); c.stroke();
  c.strokeStyle = "#fff3b0"; c.lineWidth = 22; c.beginPath(); c.ellipse(0, 0, 230, 52, 0, 0, 7); c.stroke();
  c.restore();
  for (let i = 0; i < 12; i++) {                      // sparkles
    const ph = (K.t * 2 + h32(i, 971)) % 1, x = cx + (h32(i, 972) - 0.5) * 900, y = cy + 100 + h32(i, 973) * 700, r = 30 * Math.sin(ph * Math.PI);
    c.fillStyle = BONE; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.25, y - r * 0.25); c.lineTo(x + r, y); c.lineTo(x + r * 0.25, y + r * 0.25); c.lineTo(x, y + r); c.lineTo(x - r * 0.25, y + r * 0.25); c.lineTo(x - r, y); c.lineTo(x - r * 0.25, y - r * 0.25); c.closePath(); c.fill();
  }
}

function chalkboard(c, K) {
  c.fillStyle = "#6b4526"; c.fillRect(-BLEED, 840, W + 2 * BLEED, 40);
  const lines = ["1,200 - 800 = 400", "400 + 80 = 480", "480 + 45 = 525", "525 = ???"], span = Math.max(0.3, K.t1 - K.t0 - 0.1);
  c.font = font(70, MONO, "600"); c.textAlign = "left"; c.textBaseline = "alphabetic";
  lines.forEach((l, i) => {
    const t0 = K.t0 + 0.05 + i * span / lines.length, k = clamp((K.t - t0) / (span / lines.length * 0.8));
    if (k <= 0) return;
    c.save(); c.globalAlpha = 0.9; c.fillStyle = i === 3 ? P.yellow : BONE; c.translate(Math.sin(i * 7) * 6, 0);
    c.fillText(l.slice(0, Math.round(l.length * k)), 880, 330 + i * 120); c.restore();
  });
}
function nanCard(c, K) {
  const n = K.w("NUMBER");
  slam(c, K, K.t0 + 0.02, "NaN", 1250, 720, 540, C.red, { shadow: BONE });
  if (n && K.t >= n.t) { c.font = font(40, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.7)"; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("typeof NaN === \"number\"", 1250, 860); }
}
function chartCard(c, K) {
  const x0 = 780, y0 = 920, w = 1020, hgt = 660, u = easeOut((K.t - K.t0) / Math.max(0.2, K.t1 - K.t0 - 0.05));
  c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(x0, y0 - hgt); c.lineTo(x0, y0); c.lineTo(x0 + w, y0); c.stroke();
  const n = 22, pts = [];
  for (let i = 0; i <= n; i++) { const f = i / n, v = Math.pow(f, 2.2) * 0.9 + (h32(i, 981) - 0.5) * 0.12 + 0.04; pts.push([x0 + f * w, y0 - clamp(v) * hgt]); }
  const m = Math.max(1, Math.floor(u * n));
  c.fillStyle = "rgba(255,42,61,0.25)"; c.beginPath(); c.moveTo(pts[0][0], y0); for (let i = 0; i <= m; i++) c.lineTo(...pts[i]); c.lineTo(pts[m][0], y0); c.closePath(); c.fill();
  c.strokeStyle = C.red; c.lineWidth = 14; c.lineJoin = "round"; c.beginPath(); c.moveTo(...pts[0]); for (let i = 1; i <= m; i++) c.lineTo(...pts[i]); c.stroke();
  c.fillStyle = C.red; c.beginPath(); c.arc(pts[m][0], pts[m][1], 20, 0, 7); c.fill();
}
function weather(c, K) {
  c.fillStyle = "#2fb389"; c.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 380 + (h32(i % 40, 991) - 0.5) * 140; const x = 1250 + Math.cos(a) * r * 1.3, y = 600 + Math.sin(a) * r * 0.7; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath(); c.fill(); c.lineWidth = 8; c.strokeStyle = "rgba(21,19,26,0.4)"; c.stroke();
  const cloud = (x, y, s) => {
    c.fillStyle = "#5b5866"; for (const [dx, dy, r] of [[0, 0, 90], [-90, 30, 70], [95, 25, 75], [40, -45, 70]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }
    c.fillStyle = P.yellow; c.beginPath(); c.moveTo(x + 10 * s, y + 70 * s); c.lineTo(x - 40 * s, y + 170 * s); c.lineTo(x, y + 165 * s); c.lineTo(x - 30 * s, y + 260 * s); c.lineTo(x + 50 * s, y + 140 * s); c.lineTo(x + 10 * s, y + 145 * s); c.closePath(); c.fill();
    c.font = font(60 * s); c.fillStyle = "#19db73"; c.textAlign = "center"; c.textBaseline = "alphabetic";
    for (let i = 0; i < 4; i++) { const ry = (K.t * 400 + i * 60 + x) % 200; c.fillText("$", x - 80 * s + i * 55 * s, y + 110 * s + ry * s); }
  };
  cloud(1060, 420, 1.1); cloud(1500, 560, 0.9);
  c.font = font(170); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("$120", 1480, 910);
  c.fillStyle = C.red; rr(c, 700, 950, 1100, 64, 10); c.fill();
  c.font = font(40, MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PRICE STORM WARNING  ·  90% CHANCE OF HIKES", 1250, 983);
}
function manyTabs(c, K) {
  const n = Math.floor(lerp(12, 99, easeOut((K.t - K.t0) / 0.6)));
  const labels = Array.from({ length: n }, (_, i) => ({ label: ["GPU", "RAM", "SSD", "PSU", "CASE"][i % 5], t: -1 }));
  const b = browserTabs(c, K, labels, { x: 700, y: 330, w: 1120, h: 620, noPage: true });
  c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic";
  ["GPU  -  OUT OF STOCK", "RAM  -  $120 (WAS $40)", "SSD  -  $90 (WAS $45)", "CASE  -  IN STOCK"].forEach((l, i) => c.fillText(l, b.x + 60, b.y + 200 + i * 90));
  burst(c, b.x + b.w - 40, b.y + 40, 110, 14, C.red, INK, n >= 99 ? "99+" : String(n), 64, 0.1, BONE);
}

// step ten: one big tab, closed with a click on its X (the cursor gets there as it's said), gone in a puff
function bigTab(c, K, closeAt, label = "GPU  -  OUT OF STOCK") {
  const x = 400, y = 380, w = 1220, h = 180, gone = closeAt !== undefined && K.t >= closeAt;
  if (!gone) {
    c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, x + 20, y + 24, w, h, [40, 40, 0, 0]); c.fill();
    c.fillStyle = BONE; rr(c, x, y, w, h, [40, 40, 0, 0]); c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
    c.font = font(76, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(label, x + 60, y + h / 2);
    c.beginPath(); c.arc(x + w - 100, y + h / 2, 52, 0, 7); c.fillStyle = C.red; c.fill();
    c.strokeStyle = BONE; c.lineWidth = 14; c.lineCap = "round"; c.beginPath(); c.moveTo(x + w - 124, y + h / 2 - 24); c.lineTo(x + w - 76, y + h / 2 + 24); c.moveTo(x + w - 76, y + h / 2 - 24); c.lineTo(x + w - 124, y + h / 2 + 24); c.stroke();
    if (closeAt !== undefined) {
      const u = easeOut((K.t - K.t0) / Math.max(0.15, closeAt - K.t0)), px = lerp(700, x + w - 100, u), py = lerp(900, y + h / 2, u);
      c.save(); c.translate(px, py); c.scale(3.2, 3.2); c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = "round";
      c.beginPath(); [[0, 0], [0, 30], [8, 23], [14, 36], [20, 33], [14, 21], [24, 21]].forEach(([a, b2], i) => i ? c.lineTo(a, b2) : c.moveTo(a, b2)); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
  } else {
    const u = (K.t - closeAt) / 0.3;
    if (u < 1) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 60 + u * 260; c.fillStyle = `rgba(244,241,234,${1 - u})`; c.beginPath(); c.arc(x + w - 100 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r, 50 * (1 - u) + 10, 0, 7); c.fill(); }
  }
}
function keyRow(c, K, keys) {            // keys: [{label, t, w}]
  let x = 960 - keys.reduce((a, k2) => a + k2.w + 40, -40) / 2;
  for (const k2 of keys) {
    const down = K.t >= k2.t, press = down ? since(K.t, k2.t, 0.1) : 0, dy = (down ? 16 : 0) + press * 20, y = 600;
    c.fillStyle = "#2a2632"; rr(c, x, y + 40, k2.w, 240, 30); c.fill();
    c.fillStyle = down ? P.yellow : "#d9d4c8"; rr(c, x, y + dy, k2.w, 240, 30); c.fill();
    c.font = font(110); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(k2.label, x + k2.w / 2, y + dy + 124);
    x += k2.w + 40;
  }
}
function trophy(c, K, cx, cy, s) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.rotate(Math.sin(K.t * 4) * 0.05);
  c.fillStyle = "rgba(21,19,26,0.3)"; c.beginPath(); c.ellipse(24, 340, 230, 40, 0, 0, 7); c.fill();
  c.lineWidth = 34; c.strokeStyle = "#e0a918";
  c.beginPath(); c.arc(-230, -140, 90, Math.PI * 0.5, Math.PI * 1.5, false); c.stroke();
  c.beginPath(); c.arc(230, -140, 90, -Math.PI * 0.5, Math.PI * 0.5, false); c.stroke();
  c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = "round";
  c.fillStyle = P.gold; c.beginPath(); c.moveTo(-240, -260); c.lineTo(240, -260); c.bezierCurveTo(240, 20, 110, 90, 0, 100); c.bezierCurveTo(-110, 90, -240, 20, -240, -260); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#e0a918"; c.fillRect(-40, 100, 80, 120); c.strokeRect(-40, 100, 80, 120);
  c.fillStyle = INK; c.fillRect(-200, 220, 400, 110);
  c.font = font(76); c.fillStyle = P.gold; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("HOBBY", 0, 278);
  c.fillStyle = "rgba(255,255,255,0.45)"; c.beginPath(); c.ellipse(-120, -160, 40, 90, 0.3, 0, 7); c.fill();
  c.restore();
}
function droste(c, K) {           // a tab in a tab in a tab, falling inward forever
  const z = ((K.t - K.t0) * 1.4) % 1;
  for (let i = 0; i < 9; i++) {
    const s = 1.35 * Math.pow(0.62, i - z), w = 1500 * s, h = 860 * s, x = 960 - w / 2, y = 580 - h / 2;
    if (w < 8) break;
    c.fillStyle = i % 2 ? BONE : "#1d1a24"; rr(c, x, y, w, h, 30 * s); c.fill();
    c.fillStyle = i % 2 ? "#1d1a24" : BONE; rr(c, x + 40 * s, y - 80 * s, 420 * s, 90 * s, [24 * s, 24 * s, 0, 0]); c.fill();
    c.font = font(Math.max(6, 48 * s), MONO, "600"); c.fillStyle = i % 2 ? BONE : INK; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("THE HOBBY", x + 70 * s, y - 35 * s);
  }
}
function tabRig(c, K) {
  const drop = lerp(-900, 0, easeOutBack((K.t - K.t0) / 0.3));
  c.fillStyle = BONE; rr(c, 1080, 150 + drop, 360, 110, [26, 26, 0, 0]); c.fill(); c.lineWidth = 8; c.strokeStyle = INK; c.stroke();
  c.font = font(54, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("THE RIG", 1116, 206 + drop);
  tower(c, K, 1080, 250 + drop, 580, 760, true, false);
}

// step eleven
function newspaper(c, K) {
  const u = easeOut((K.t - K.t0) / 0.42), rot = (1 - u) * Math.PI * 5 - 0.06, s = lerp(0.05, 1, u);
  c.save(); c.translate(1150, 540); c.rotate(rot); c.scale(s, s);
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(-520 + 24, -420 + 28, 1040, 840);
  c.fillStyle = "#f3eee2"; c.fillRect(-520, -420, 1040, 840);
  c.font = font(88, SERIF); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("The Daily Memory", 0, -320);
  c.fillRect(-470, -295, 940, 6); c.font = font(22, MONO, "600"); c.fillText("SEPTEMBER 2026  ·  PRICE: $120 (WAS $40)", 0, -262); c.fillRect(-470, -245, 940, 3);
  c.font = font(150); c.fillText("RAM PRICES", 0, -100); c.fillText("TRIPLE", 0, 50);
  c.fillStyle = "rgba(21,19,26,0.25)";
  for (let i = 0; i < 9; i++) { c.fillRect(-470, 110 + i * 30, 430, 12); c.fillRect(40, 110 + i * 30, 430, 12); }
  c.restore();
}
function lineup(c, K) {
  const L3 = [["samsung-ddr4", "COMPANY 1", "THREE#0"], ["hynix-mrdimm", "COMPANY 2", "COMPANIES"], ["micron-rdimm-label", "COMPANY 3", "MAKE"]];
  L3.forEach(([key, label, word], i) => {
    const w = K.w(word); if (!w || K.t < w.t - 0.03) return;
    const e = easeOutBack((K.t - w.t + 0.03) / 0.2), y = 270 + i * 270, wd = Math.min(820, printW(K, key, 210)), x = lerp(2500, 1340, e);
    printAt(c, K, key, x, y, wd, -0.04 + i * 0.03, { off: 18 });
    c.font = font(44, MONO, "600"); c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = INK; c.fillRect(x - wd / 2 - 8, y - 160, 300, 58); c.fillStyle = BONE; c.fillText(label, x - wd / 2 + 10, y - 116);
  });
}
function globe(c, K) {
  const cx = 1280, cy = 560, R = 330, rot = K.t * 0.8;
  const keys = ["samsung-ddr4", "hynix-mrdimm", "micron-rdimm-label"];
  const orb = keys.map((key, i) => { const a = K.t * 1.7 + i * 2.094; return { key, x: cx + Math.cos(a) * R * 1.55, y: cy + Math.sin(a) * R * 0.5, front: Math.sin(a) > 0, a }; });
  const drawStick = o => printAt(c, K, o.key, o.x, o.y, Math.min(420, printW(K, o.key, 110)), Math.cos(o.a) * 0.2, { off: 10 });
  orb.filter(o => !o.front).forEach(drawStick);
  c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.arc(cx + 20, cy + 24, R, 0, 7); c.fill();
  c.fillStyle = "#2f7de0"; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
  c.fillStyle = "#19db73";
  for (let i = 0; i < 9; i++) {
    const lon = h32(i, 951) * Math.PI * 2 + rot, lat = (h32(i, 952) - 0.5) * 1.6;
    if (Math.cos(lon) < -0.05) continue;
    const x = cx + Math.sin(lon) * R * Math.cos(lat), y = cy + Math.sin(lat) * R;
    c.beginPath(); c.ellipse(x, y, Math.max(1, (50 + h32(i, 953) * 100) * Math.cos(lon)), 40 + h32(i, 954) * 70, 0, 0, 7); c.fill();
  }
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 3;
  for (let j = -2; j <= 2; j++) { const yy = cy + j * R * 0.33, rx = R * Math.sqrt(1 - Math.pow(j * 0.33, 2)); c.beginPath(); c.ellipse(cx, yy, rx, R * 0.07, 0, 0, 7); c.stroke(); }
  for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI + (rot % (Math.PI / 6)); c.beginPath(); c.ellipse(cx, cy, Math.max(1, Math.abs(Math.cos(a)) * R), R, 0, 0, 7); c.stroke(); }
  c.restore();
  c.lineWidth = 12; c.strokeStyle = INK; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  orb.filter(o => o.front).forEach(drawStick);
}
function pie(c, K) {
  const cx = 1150, cy = 560, R = 350, nine = K.w("NINE"), bl = K.w("BUILDINGS");
  const grow = nine ? easeOut((K.t - nine.t + 0.03) / 0.35) : 0, away = bl ? easeIn((K.t - bl.t) / 0.45) : 0;
  const a0 = -Math.PI / 2, a9 = a0 + Math.PI * 2 * 0.9 * grow;
  hall(c, K, { key: "halls", x: 1650, y: 830, w: 470, rot: -0.06, shadow: "rgba(21,19,26,0.45)" });
  c.lineWidth = 10; c.strokeStyle = INK;
  c.fillStyle = BONE; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a9, a0 + Math.PI * 2); c.closePath(); c.fill(); c.stroke();
  const mid = (a0 + a9) / 2;
  c.save(); c.translate(Math.cos(mid) * 30 + away * 480, Math.sin(mid) * 30 + away * 250);           // into the buildings
  c.translate(cx, cy); c.scale(1 - away * 0.7, 1 - away * 0.7); c.translate(-cx, -cy);
  c.fillStyle = C.red; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a9); c.closePath(); c.fill(); c.stroke();
  if (grow > 0.5) { c.font = font(170); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("90%", cx + Math.cos(mid) * R * 0.5, cy + Math.sin(mid) * R * 0.5); }
  c.restore();
  if (grow > 0.9) { c.font = font(56, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("YOU: 10%", cx + 30, cy - R - 40); }
}
function contract(c, K) {
  const x = 1000, y = 110, w = 720, h = 880, s3 = K.w("THREE#1"), sg = K.w("SIGNED");
  c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(0.03); c.translate(-(x + w / 2), -(y + h / 2));
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(x + 20, y + 24, w, h);
  c.fillStyle = "#fbf8f0"; c.fillRect(x, y, w, h);
  c.font = font(64, SERIF); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("Supply Agreement", x + w / 2, y + 110);
  c.fillStyle = "rgba(21,19,26,0.2)"; for (let i = 0; i < 10; i++) c.fillRect(x + 60, y + 170 + i * 40, (w - 120) * (0.6 + h32(i, 1001) * 0.4), 12);
  c.font = font(64); c.fillStyle = INK; c.textAlign = "left"; c.fillText("TERM: 3 YEARS", x + 60, y + 640);
  c.fillRect(x + 60, y + 790, w - 120, 4);
  const u = s3 ? clamp((K.t - s3.t) / Math.max(0.2, (sg ? sg.end : s3.t + 0.6) - s3.t)) : 0, n = 90, m = Math.floor(u * n);
  if (m > 0) {
    c.strokeStyle = "#1c3fb8"; c.lineWidth = 7; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
    for (let i = 0; i <= m; i++) { const f = i / n, px = x + 100 + f * (w - 200), py = y + 760 - Math.sin(f * 30) * 34 * (0.4 + h32(Math.floor(f * 8), 1002)) - Math.cos(f * 13) * 14; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.stroke();
  }
  let thud = 0;
  if (sg) thud = stamp(c, K, sg.t - 0.02, "SIGNED", x + w * 0.6, y + h * 0.42, -0.18, C.red, 130, "#fbf8f0");
  c.restore();
  return thud;
}
function tunnel(c, K, cols = [C.red, INK]) {
  const z = ((K.t - K.t0) * 2.4) % 1, base = Math.floor((K.t - K.t0) * 2.4);
  for (let i = 0; i < 14; i++) {
    const s = 1.6 * Math.pow(0.74, i - z), w = W * s, h = H * s;
    if (w < 6) break;
    c.fillStyle = cols[(i + base) % cols.length]; c.fillRect(960 - w / 2, 540 - h / 2, w, h);
  }
}
function dCard(c, K, i) {
  const s = since(K.t, K.t0, 0.08), grow = 1 + (K.t - K.t0) * (0.35 + i * 0.3);
  tunnel(c, K, i % 2 ? [INK, C.red] : [C.red, INK]);
  c.save(); c.translate(960, 560); const sc = (1 + i * 0.1) * grow * (1 + s * 0.4); c.scale(sc, sc);
  c.font = font(640); c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = INK; c.fillText("D", 26, 30); c.fillStyle = s > 0.6 ? BONE : [BONE, P.yellow, C.cyan, BONE][i % 4]; c.fillText("D", 0, 0);
  c.restore();
}

// ---------- the cards, in the order they cut. at: the sung word the card cuts on; after: cut when that word ends;
// start: "step" = the step's own shot start. calm: a breather (no punch, no shake) ----------
const CARDS = [
  // step three: "wait for March. The tax return. The card. The build. The game. The one."
  { n: 3, start: "step", paper: P.amber, pat: "rays", draw: (c, K) => stepCard(c, K, "THREE") },
  { n: 3, at: "WAIT", paper: P.pink, pat: "dots", draw: (c, K) => { calendar(c, K); caption(c, K, { x: 110, y: 370, size: 240, rows: [1, 1, 1], hot: ["MARCH"], shadow: BONE }); } },
  { n: 3, at: "THE#0", paper: P.yellow, pat: "stripes", draw: (c, K) => { const th = taxForm(c, K); caption(c, K, { x: 100, y: 420, size: 250, rows: [2, 1], shadow: BONE }); return { flash: th * 0.5 }; } },
  { n: 3, at: "THE#1", paper: P.cyan, pat: "speed", draw: (c, K) => {
    const e = easeOutBack((K.t - K.t0) / 0.3);
    printAt(c, K, "rtx3090", 1180, 470, 1250 * lerp(1.3, 1, e), lerp(-0.6, -0.1, e), { shadow: "rgba(21,19,26,0.5)", off: 26 });
    caption(c, K, { x: 100, y: 960, size: 300, shadow: BONE });
  } },
  { n: 3, at: "THE#2", paper: P.violet, pat: "grid", draw: (c, K) => {
    const drop = lerp(-1100, 0, easeOutBack((K.t - K.t0) / 0.28)), b = K.w("BUILD");
    tower(c, K, 1100, 110 + drop, 560, 860, b && K.t >= b.t - 0.03);
    caption(c, K, { x: 100, y: 600, size: 280, rows: [1, 1], col: BONE, shadow: INK });
  } },
  { n: 3, at: "THE#3", paper: P.red, pat: "rays", draw: (c, K) => { controller(c, K); caption(c, K, { x: 90, y: 400, size: 280, rows: [1, 1], col: INK, shadow: BONE }); } },
  { n: 3, at: "THE#4", paper: P.black, pat: "none", calm: true, draw: (c, K) => caption(c, K, { x: 960, y: 600, size: 190, align: "center", serif: true, col: BONE }) },

  // step four: "refresh the page. It's a Tuesday. It's in stock. It's on sale. Don't blink."
  { n: 4, at: "STEP", paper: P.cyan, pat: "grid", draw: (c, K) => stepCard(c, K, "FOUR") },
  { n: 4, at: "REFRESH", paper: P.yellow, pat: "dots", draw: (c, K) => { keycap(c, K); caption(c, K, { x: 90, y: 370, size: 190, rows: [1, 2], maxW: 820, shadow: BONE }); } },
  { n: 4, at: "IT'S#0", paper: P.cream, pat: "grid", draw: (c, K) => { weekStrip(c, K); caption(c, K, { x: 960, y: 620, size: 290, rows: [2, 1], align: "center", hot: ["TUESDAY"], shadow: "rgba(21,19,26,0.18)" }); } },
  { n: 4, at: "IT'S#1", paper: P.green, pat: "rays", rays: [960, 700], draw: (c, K) => inStock(c, K) },
  { n: 4, at: "IT'S#2", paper: P.red, pat: "stripes", draw: (c, K) => { priceTag(c, K); caption(c, K, { x: 90, y: 370, size: 250, rows: [1, 1, 1], col: BONE, shadow: INK }); } },
  { n: 4, kickAfter: "SALE", paper: P.yellow, pat: "rays", draw: (c, K) => {
    const e = easeOutBack((K.t - K.t0) / 0.14);
    burst(c, 960, 500, 400 * e, 22, C.red, INK, "-20%", 330 * e, -0.08 + Math.sin(K.t * 9) * 0.03, BONE);
    c.font = font(44, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.fillText("TODAY ONLY  ·  LIMIT 1 PER CUSTOMER", 960, 1000);
  } },
  { n: 4, at: "DON'T", paper: P.news, pat: "news", fps: NEWS_FPS, draw: (c, K) => {
    const b = K.w("BLINK"), tq = Math.floor(K.t * NEWS_FPS) / NEWS_FPS;
    masthead(c, K, { mid: "RESTOCK EDITION  ·  TUESDAY", right: "PRICE: $959" });
    newsEye(c, K, NEWS_PHOTO[0], NEWS_PHOTO[1], b ? ease((tq - b.t) / Math.max(0.12, b.end - b.t)) : 0);
    caption(c, K, { x: 960, y: 334, size: 140, align: "center", rows: [2], col: NEWS_INK, hot: ["BLINK"], hotCol: "#d8262f", flash: "#d8262f" });
  } },
  { n: 4, after: "BLINK", paper: P.black, pat: "none", calm: true, draw: () => {} },       // the song drops out: black

  // step five: "blink. A building bought them. Forty thousand at a time. Think / About what a building does with
  // forty thousand cards. It thinks. It's a building that thinks."
  { n: 5, at: "STEP", paper: P.black, pat: "none", calm: true, draw: (c, K) => {
    const s = K.w("STEP"), f = K.w("FIVE"), txt = "STEP 05", k = s && f ? clamp((K.t - s.t) / Math.max(0.1, f.end - s.t)) : 1;
    c.font = font(96, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "alphabetic";
    const tw = c.measureText(txt).width, shown = txt.slice(0, Math.round(txt.length * k));
    c.fillText(shown, 960 - tw / 2, 580);
    if (Math.floor(K.t * 2.4) % 2 === 0) c.fillRect(960 - tw / 2 + c.measureText(shown).width + 10, 510, 50, 76);
  } },
  { n: 5, at: "BLINK", paper: P.news, pat: "news", fps: NEWS_FPS, draw: (c, K) => {
    const b = K.w("BLINK"), tq = Math.floor(K.t * NEWS_FPS) / NEWS_FPS;
    masthead(c, K, { mid: "LATE EDITION  ·  STEP 05", right: "PRICE: SOLD OUT" });
    newsEye(c, K, NEWS_PHOTO[0], NEWS_PHOTO[1], b ? ease((tq - b.t + 0.03) / Math.max(0.1, b.end - b.t)) : 0, { zoom: 1.3 });
    caption(c, K, { x: 960, y: 334, size: 140, align: "center", col: NEWS_INK, flash: "#d8262f" });
    return { invert: K.t >= b.end && K.t < b.end + 2 / 30 ? 1 : 0 };
  } },
  { n: 5, at: "A#0", paper: P.night, pat: "reddots", draw: (c, K) => {
    const bo = K.w("BOUGHT");
    hall(c, K, { x: 1010, y: 640, w: 1060, rot: -0.04 });
    if (bo) intake(c, K, bo.t - 0.2, [760, 380, 520, 480]);
    caption(c, K, { x: 90, y: 290, size: 170, rows: [2, 2], col: BONE, shadow: C.red });
    const th = bo ? stamp(c, K, bo.t - 0.02, "SOLD OUT", 860, 800, -0.14, BONE, 230) : 0;
    if (bo) reactBox(c, K, bo.t + 0.05);
    return { flash: th * 0.6, invert: bo && K.t >= bo.t - 0.02 && K.t < bo.t + 0.05 ? 1 : 0 };
  } },
  { n: 5, at: "FORTY#0", paper: P.yellow, pat: "rays", draw: (c, K) => {
    rain(c, K); counter(c, K);
    caption(c, K, { x: 960, y: 900, size: 190, align: "center", only: ["AT", "A", "TIME"], shadow: BONE });
  } },
  { n: 5, at: "THINK", paper: P.cream, pat: "dots", draw: (c, K) => caption(c, K, { x: 960, y: 780, size: 560, align: "center", shadow: C.pink }) },
  { n: 5, at: "ABOUT", paper: P.pink, pat: "stripes", draw: (c, K) => caption(c, K, { x: 960, y: 780, size: 560, align: "center", col: BONE, shadow: INK }) },
  { n: 5, at: "WHAT", paper: P.cyan, pat: "grid", draw: (c, K) => caption(c, K, { x: 960, y: 780, size: 560, align: "center", shadow: BONE }) },
  { n: 5, at: "A#2", paper: P.violet, pat: "rays", draw: (c, K) => { hall(c, K, { x: 1400, y: 560, w: 820, rot: 0.05, shadow: "rgba(21,19,26,0.45)" }); caption(c, K, { x: 110, y: 560, size: 330, rows: [1, 1], col: BONE, shadow: INK }); } },
  { n: 5, at: "DOES", paper: P.yellow, pat: "stripes", draw: (c, K) => caption(c, K, { x: 960, y: 780, size: 560, align: "center", shadow: BONE }) },
  { n: 5, at: "WITH", paper: P.black, pat: "none", draw: (c, K) => { wall(c, K); subtitle(c, K, { size: 76, y: 950 }); } },
  { n: 5, at: "IT", paper: P.black, pat: "none", calm: true, draw: (c, K) => caption(c, K, { x: 960, y: 600, size: 190, align: "center", serif: true, col: BONE }) },
  { n: 5, at: "IT'S", paper: P.night, pat: "reddots", draw: (c, K) => {
    const b = K.w("BUILDING#2"), up = b ? easeOutBack((K.t - b.t + 0.1) / 0.4) : 0;
    hall(c, K, { x: 960, y: lerp(1500, 690, up), w: 1180, rot: -0.02, think: 0.35 * up });
    caption(c, K, { x: 960, y: 310, size: 200, align: "center", col: BONE, shadow: C.red });
  } },
  { n: 5, at: "THAT", paper: P.violet, pat: "grid", draw: (c, K) => { bubble(c, K); subtitle(c, K, { size: 76, y: 960 }); } },
  { n: 5, at: "THINKS#1", paper: P.night, pat: "reddots", draw: (c, K) => {
    hall(c, K, { x: 960, y: 610, w: 1240, rot: 0.03, think: 1 });
    thinkingPill(c, K, 960, 170, 1.1);
    caption(c, K, { x: 960, y: 1000, size: 300, align: "center", col: C.red, shadow: BONE });
    const w = K.w("THINKS#1");
    return { invert: w && K.t >= w.t - 0.03 && K.t < w.t + 0.04 ? 1 : 0 };
  } },

  // step one: "make a list. Every part in a tab. Twenty-nineteen. It's fun." (the kick comes in on "one")
  { n: 1, at: "STEP", paper: P.cream, pat: "rays", draw: (c, K) => {
    stepCard(c, K, "ONE");
    const one = K.w("ONE");
    return { invert: one && K.t >= one.t - 0.03 && K.t < one.t + 0.04 ? 1 : 0, flash: one ? since(K.t, one.t - 0.03, 0.1) * 0.6 : 0 };
  } },
  { n: 1, at: "MAKE", paper: P.yellow, pat: "stripes", draw: (c, K) => { notepad(c, K); caption(c, K, { x: 100, y: 470, size: 290, rows: [2, 1], shadow: BONE }); } },
  { n: 1, at: "EVERY", paper: P.cyan, pat: "grid", whip: 1, draw: (c, K) => {
    browserTabs(c, K, ["CPU", "GPU", "RAM", "SSD", "BOARD", "PSU", "COOLER", "CASE"].map((l, i) => ({ label: l, t: K.t0 + 0.03 + i * 0.09 })), { y: 400 });
    caption(c, K, { x: 960, y: 320, size: 170, align: "center", shadow: BONE });
  } },
  { n: 1, at: "TWENTY", paper: P.vhs, pat: "none", draw: (c, K) => vhs(c, K) },
  { n: 1, at: "IT'S", paper: P.pink, pat: "rays", rays: [1350, 560], draw: (c, K) => {
    const f = K.w("FUN"); if (f) confetti(c, K.t, f.t, 1350, 560, 90);
    smiley(c, 1350, 560, 330, K.t);
    caption(c, K, { x: 110, y: 470, size: 330, rows: [1, 1], shadow: BONE });
  } },
  ...PARTS.map((part, i) => ({ n: 1, kickAfter: "FUN", nth: i, paper: part.paper, pat: part.pat, whip: i % 2 ? -1 : 1, draw: (c, K) => partCard(c, K, part) })),

  // step two: "add it up. Twelve hundred. Save eight. Four to go. You're nearly done." (then the bar sticks at 99%)
  { n: 2, at: "STEP", paper: P.green, pat: "dots", draw: (c, K) => stepCard(c, K, "TWO") },
  { n: 2, at: "ADD", paper: P.cyan, pat: "stripes", draw: (c, K) => { receipt(c, K); caption(c, K, { x: 100, y: 470, size: 300, rows: [2, 1], shadow: BONE }); } },
  { n: 2, at: "TWELVE", paper: P.money, pat: "rays", draw: (c, K) => { slam(c, K, K.t0 + 0.04, "$1,200", 960, 700, 520, BONE, { shadow: INK }); subtitle(c, K, { size: 80, y: 930 }); } },
  { n: 2, at: "SAVE", paper: P.pink, pat: "dots", draw: (c, K) => {
    piggy(c, K, 1260, 600, 1.05);
    caption(c, K, { x: 100, y: 420, size: 260, rows: [1, 1], shadow: BONE });
    const e = K.w("EIGHT"); if (e) slam(c, K, e.t - 0.03, "$800", 1300, 250, 200, INK, { shadow: BONE });
  } },
  { n: 2, at: "FOUR", paper: P.yellow, pat: "grid", draw: (c, K) => {
    caption(c, K, { x: 960, y: 400, size: 300, align: "center", shadow: BONE });
    progress(c, K, 260, 620, 1400, 150, lerp(0.55, 0.67, easeOut((K.t - K.t0) / 0.4)), { label: "$800 / $1,200" });
  } },
  { n: 2, at: "YOU'RE", paper: P.violet, pat: "stripes", draw: (c, K) => {
    const d = K.w("DONE"), f = d ? lerp(0.67, 0.99, easeOut((K.t - K.t0) / Math.max(0.2, d.t - K.t0))) : 0.9;
    caption(c, K, { x: 960, y: 400, size: 240, align: "center", col: BONE, shadow: INK });
    progress(c, K, 260, 620, 1400, 150, f, { label: Math.round(f * 100) + "%" });
  } },
  { n: 2, after: "DONE", paper: P.black, pat: "none", draw: (c, K) => {
    const j = K.kick && K.kick.t >= K.t0 ? since(K.t, K.kick.t, 0.08) : 0;
    progress(c, K, 260 + j * 14, 520, 1400, 150, 0.99, { label: "99%", col: C.amber });
    spinner(c, 960, 820, 44, K.t);
    c.font = font(52, MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText("ALMOST THERE" + ".".repeat(Math.floor(K.t * 4) % 4), 960, 960);
  } },
  { n: 2, kickAfter: "DONE", nth: 2, paper: P.red, pat: "speed", draw: (c, K) => {
    const kk = K.kick, jit = kk && K.t - kk.t < 0.1 && kk.t >= K.t0;
    slam(c, K, K.t0 + 0.02, jit ? "98%" : "99%", 960, 780, 620, BONE, { shadow: INK });
    c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.fillText("DO NOT CLOSE THIS WINDOW", 960, 940);
  } },

  // step six: "check the RAM. Sixteen gigs of the old kind. Forty dollars last year. A hundred and twenty. Sure."
  { n: 6, start: "step", paper: P.orange, pat: "rays", draw: (c, K) => stepCard(c, K, "SIX") },
  { n: 6, at: "CHECK", paper: P.cyan, pat: "grid", draw: (c, K) => {
    const e = easeOutBack((K.t - K.t0) / 0.3), x = lerp(2400, 1180, e);
    printAt(c, K, "ddr4-16g", x, 640, 1400, -0.06, { off: 24 });
    const sy = 480 + ((K.t - K.t0) * 900) % 360;         // the scan beam, checking it
    c.fillStyle = "rgba(255,42,61,0.35)"; c.fillRect(x - 760, sy - 30, 1520, 60); c.fillStyle = C.red; c.fillRect(x - 760, sy - 3, 1520, 6);
    caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 1], shadow: BONE });
  } },
  { n: 6, at: "SIXTEEN", paper: P.sepia, pat: "dots", draw: (c, K) => { museum(c, K); caption(c, K, { x: 90, y: 300, size: 150, rows: [2, 2, 1], maxW: 820, shadow: "#f6efdc" }); } },
  { n: 6, at: "FORTY", paper: P.sky, pat: "grid", draw: (c, K) => {
    tag(c, K, 1450, 380, "$40", { sub: "LAST YEAR", t0: K.t0 + 0.04, s: 0.9 });
    caption(c, K, { x: 100, y: 420, size: 220, rows: [2, 2], shadow: BONE });
  } },
  { n: 6, at: "A", paper: P.black, pat: "none", draw: (c, K) => priceFlip(c, K) },
  { n: 6, at: "SURE", paper: P.black, pat: "none", calm: true, draw: (c, K) => caption(c, K, { x: 960, y: 600, size: 200, align: "center", serif: true, col: BONE }) },

  // step seven: "check the drive. A terabyte. Forty-five. Ninety now. The phones are shrinking on the inside to endure."
  { n: 7, at: "x:THAT'S", paper: P.lilac, pat: "rays", draw: (c, K) => stepCard(c, K, "SEVEN") },
  { n: 7, at: "CHECK", paper: P.yellow, pat: "stripes", draw: (c, K) => {
    printAt(c, K, "s-ssd", lerp(2400, 1180, easeOutBack((K.t - K.t0) / 0.3)), 660, 1300, -0.08 + (K.t - K.t0) * 0.1, { off: 24 });
    caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 1], shadow: BONE });
  } },
  { n: 7, at: "A", paper: P.violet, pat: "grid", draw: (c, K) => { slam(c, K, K.t0 + 0.04, "1 TB", 960, 760, 620, BONE, { shadow: INK }); subtitle(c, K, { size: 80, y: 930 }); } },
  { n: 7, at: "FORTY", paper: P.cream, pat: "dots", draw: (c, K) => { tag(c, K, 1350, 300, "$45", { t0: K.t0 + 0.04 }); caption(c, K, { x: 100, y: 480, size: 300, rows: [1, 1], shadow: "rgba(21,19,26,0.18)" }); } },
  { n: 7, at: "NINETY", paper: P.red, pat: "rays", draw: (c, K) => {
    tag(c, K, 1300, 300, "$90", { old: "$45", t0: K.t0 + 0.03, col: C.red });
    burst(c, 1640, 380, 120 * easeOutBack((K.t - K.t0 - 0.08) / 0.14), 14, P.yellow, INK, "x2", 90, 0.12);
    caption(c, K, { x: 100, y: 470, size: 300, rows: [1, 1], col: BONE, shadow: INK });
  } },
  { n: 7, at: "THE#1", paper: P.green, pat: "dots", draw: (c, K) => {
    const steps = ["THE#1", "PHONES", "ARE", "SHRINKING"].map(K.w), i = steps.filter(w => w && K.t >= w.t - 0.03).length - 1, gb = [512, 256, 128, 64][Math.max(0, i)];
    phone(c, K, 1400, 560, 820, { gb: gb + " GB", frac: [1, 0.5, 0.25, 0.12][Math.max(0, i)], hot: i >= 3, squeeze: lerp(1, 0.86, clamp((K.t - K.t0) / (K.t1 - K.t0))) });
    caption(c, K, { x: 100, y: 330, size: 190, rows: [2, 2], maxW: 950, shadow: BONE });
  } },
  { n: 7, at: "ON", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    phone(c, K, 1400, 560, 820, { xray: true, chip: lerp(1, 0.3, easeOut((K.t - K.t0) / Math.max(0.3, K.t1 - K.t0))) });
    caption(c, K, { x: 100, y: 420, size: 240, rows: [1, 2], col: BONE, shadow: C.cyan });
  } },
  { n: 7, at: "TO", paper: P.black, pat: "none", calm: true, draw: (c, K) => caption(c, K, { x: 960, y: 600, size: 200, align: "center", serif: true, col: BONE }) },

  // step eight: "check the case. It's fine. It's a box. It's the one part they don't want. It's on the floor. It's yours. It's pure."
  { n: 8, at: "x:THAT'S", paper: P.pink, pat: "rays", draw: (c, K) => stepCard(c, K, "EIGHT") },
  { n: 8, at: "CHECK", paper: P.violet, pat: "grid", draw: (c, K) => {
    const g = c.createRadialGradient(1300, 500, 50, 1300, 560, 600); g.addColorStop(0, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(600, -BLEED, 1500, 1500);
    tower(c, K, 1030, lerp(-1100, 150, easeOutBack((K.t - K.t0) / 0.28)), 540, 800, false, true);
    caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 1], col: BONE, shadow: INK });
  } },
  { n: 8, at: "IT'S#0", paper: P.green, pat: "rays", draw: (c, K) => { checkMark(c, K, 1300, 560, 560, K.t0 + 0.02); caption(c, K, { x: 100, y: 470, size: 330, rows: [1, 1], shadow: BONE }); } },
  { n: 8, at: "IT'S#1", paper: P.cream, pat: "stripes", draw: (c, K) => { cardboard(c, K, 1280, 600, 760); caption(c, K, { x: 100, y: 470, size: 300, rows: [2, 1], shadow: "rgba(21,19,26,0.18)" }); } },
  { n: 8, at: "IT'S#2", paper: P.yellow, pat: "dots", draw: (c, K) => {
    caption(c, K, { x: 100, y: 260, size: 150, rows: [3, 4], maxW: 1150, shadow: BONE });
    const e = easeOutBack((K.t - K.t0 - 0.1) / 0.2), n = Math.round(lerp(0, 9999, easeOut((K.t - K.t0) / 0.8)));
    c.save(); c.translate(700, 700); c.scale(e, e);
    c.fillStyle = INK; rr(c, -560 + 18, -120 + 22, 1120, 240, 120); c.fill(); c.fillStyle = "#19db73"; rr(c, -560, -120, 1120, 240, 120); c.fill();
    c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
    c.font = font(150); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("IN STOCK: " + n.toLocaleString("en-US"), 0, 8);
    c.restore();
    const d = K.w("DON'T"); if (d) reactBox(c, K, d.t - 0.1, 1380, 480, K.F.ceo, P.pink);
  } },
  { n: 8, at: "IT'S#3", paper: P.sepia, pat: "none", draw: (c, K) => { floorScene(c, K); caption(c, K, { x: 100, y: 300, size: 200, rows: [2, 2], maxW: 880, shadow: "#f6efdc" }); } },
  { n: 8, at: "IT'S#4", paper: P.pink, pat: "dots", draw: (c, K) => {
    const e = easeOutBack((K.t - K.t0) / 0.22), b = 1 + K.k * 0.06;
    c.save(); c.translate(1300, 560); c.scale(e * b, e * b); c.rotate(-0.1);
    const heart = () => { c.beginPath(); c.moveTo(0, 150); c.bezierCurveTo(-380, -110, -220, -390, 0, -200); c.bezierCurveTo(220, -390, 380, -110, 0, 150); c.closePath(); };
    c.save(); c.translate(20, 26); heart(); c.fillStyle = "rgba(21,19,26,0.35)"; c.fill(); c.restore();
    heart(); c.fillStyle = C.red; c.fill(); c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
    c.font = font(130); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("YOURS", 0, -60);
    c.restore();
    caption(c, K, { x: 100, y: 470, size: 330, rows: [1, 1], col: BONE, shadow: INK });
  } },
  { n: 8, at: "IT'S#5", paper: P.gold, pat: "rays", rays: [1200, 400], draw: (c, K) => {
    tower(c, K, 1000, 260 + Math.sin(K.t * 3) * 12, 420, 640, true, true);
    halo(c, K, 1210, 190);
    caption(c, K, { x: 520, y: 620, size: 190, align: "center", serif: true, col: INK });
  } },

  // step nine: "do the math. It's not a number. It's a chart. It's a weather report. It's a tab you keep."
  { n: 9, at: "x:THAT'S", paper: P.cyan, pat: "rays", draw: (c, K) => stepCard(c, K, "NINE") },
  { n: 9, at: "DO", paper: P.chalk, pat: "none", draw: (c, K) => { chalkboard(c, K); caption(c, K, { x: 100, y: 330, size: 210, rows: [1, 2], col: BONE, shadow: "rgba(0,0,0,0.35)" }); } },
  { n: 9, at: "IT'S#0", paper: P.black, pat: "none", draw: (c, K) => { nanCard(c, K); caption(c, K, { x: 100, y: 280, size: 150, rows: [2, 2], maxW: 800, col: BONE, shadow: C.red }); } },
  { n: 9, at: "IT'S#1", paper: P.cream, pat: "grid", draw: (c, K) => { chartCard(c, K); caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 1], shadow: "rgba(21,19,26,0.18)" }); } },
  { n: 9, at: "IT'S#2", paper: P.sky, pat: "none", draw: (c, K) => { weather(c, K); caption(c, K, { x: 90, y: 260, size: 160, rows: [2, 1, 1], maxW: 700, shadow: BONE }); } },
  { n: 9, at: "IT'S#3", paper: P.violet, pat: "stripes", draw: (c, K) => { manyTabs(c, K); caption(c, K, { x: 90, y: 300, size: 170, rows: [2, 1, 2], maxW: 560, col: BONE, shadow: INK }); } },

  // step ten: "close the tab. Open it. Close it. It's a hobby now. The hobby's the tab. The tab's the rig. You don't sleep."
  { n: 10, at: "STEP", paper: P.yellow, pat: "rays", draw: (c, K) => stepCard(c, K, "TEN") },
  { n: 10, at: "CLOSE#0", paper: P.red, pat: "dots", draw: (c, K) => { const tb = K.w("TAB#0"); bigTab(c, K, tb ? tb.t + 0.12 : undefined); caption(c, K, { x: 960, y: 880, size: 220, align: "center", col: BONE, shadow: INK }); } },
  { n: 10, at: "OPEN", paper: P.cyan, pat: "grid", whip: 1, draw: (c, K) => {
    const o = K.w("OPEN"), it = K.w("IT#0");
    keyRow(c, K, [{ label: "CTRL", t: o.t, w: 420 }, { label: "SHIFT", t: o.t + 0.08, w: 460 }, { label: "T", t: it ? it.t : o.t + 0.2, w: 260 }]);
    caption(c, K, { x: 960, y: 400, size: 280, align: "center", shadow: BONE });
  } },
  { n: 10, at: "CLOSE#1", paper: P.red, pat: "dots", whip: -1, draw: (c, K) => { const it = K.w("IT#1"); bigTab(c, K, it ? it.t : undefined); caption(c, K, { x: 960, y: 880, size: 220, align: "center", col: BONE, shadow: INK }); } },
  { n: 10, at: "IT'S", paper: P.gold, pat: "rays", rays: [1280, 520], draw: (c, K) => { trophy(c, K, 1300, 520, 1.1); caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 2], maxW: 800, shadow: BONE }); } },
  { n: 10, at: "THE#1", paper: P.lilac, pat: "none", draw: (c, K) => { droste(c, K); caption(c, K, { x: 960, y: 240, size: 170, align: "center", shadow: INK, col: BONE }); } },
  { n: 10, at: "THE#3", paper: P.orange, pat: "stripes", draw: (c, K) => { tabRig(c, K); caption(c, K, { x: 100, y: 400, size: 220, rows: [2, 2], maxW: 880, shadow: BONE }); } },
  { n: 10, at: "YOU", paper: P.news, pat: "news", fps: NEWS_FPS, draw: (c, K) => {
    masthead(c, K, { mid: "LATE EDITION  ·  3:47 AM", right: "PRICE: $120 (WAS $40)" });
    newsEye(c, K, NEWS_PHOTO[0], NEWS_PHOTO[1], 0, { red: true });
    cctv(c, K, NEWS_PHOTO[0] + NEWS_PHOTO[2] / 2 - 22, NEWS_PHOTO[1] + K.F.eye.h / 2 - 24);
    caption(c, K, { x: 960, y: 334, size: 140, align: "center", rows: [3], col: NEWS_INK, hot: ["SLEEP"], hotCol: "#d8262f", flash: "#d8262f" });
    // 3:47 AM: the room is dark but for the monitor, and the page is read by its light
    const g = c.createRadialGradient(960, 620, 380, 960, 560, 1250);
    g.addColorStop(0, "rgba(12,16,44,0)"); g.addColorStop(1, "rgba(12,16,44,0.62)");
    c.fillStyle = g; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, H + 2 * BLEED);
  } },

  // step eleven: "read the news. Three companies make all the memory on earth. Nine-tenths to the buildings. Three years
  // signed. It's deep." and then Suno's D-D-D-D-D into the drop
  { n: 11, at: "STEP", paper: P.red, pat: "rays", draw: (c, K) => stepCard(c, K, "ELEVEN") },
  { n: 11, at: "READ", paper: P.navy, pat: "speed", draw: (c, K) => { newspaper(c, K); caption(c, K, { x: 90, y: 330, size: 200, rows: [1, 2], maxW: 620, col: BONE, shadow: C.red }); } },
  { n: 11, at: "THREE#0", paper: P.cream, pat: "grid", draw: (c, K) => { lineup(c, K); caption(c, K, { x: 90, y: 330, size: 210, rows: [1, 1, 1], maxW: 760, shadow: "rgba(21,19,26,0.18)" }); } },
  { n: 11, at: "ALL", paper: P.navy, pat: "gridlight", draw: (c, K) => { globe(c, K); caption(c, K, { x: 90, y: 300, size: 170, rows: [2, 2, 1], maxW: 640, col: BONE, shadow: "#2f7de0" }); } },
  { n: 11, at: "NINE", paper: P.yellow, pat: "rays", rays: [1150, 560], draw: (c, K) => { pie(c, K); caption(c, K, { x: 90, y: 260, size: 150, rows: [2, 3], maxW: 640, shadow: BONE }); } },
  { n: 11, at: "THREE#1", paper: P.sepia, pat: "dots", draw: (c, K) => { const th = contract(c, K); caption(c, K, { x: 100, y: 400, size: 240, rows: [1, 1, 1], shadow: "#f6efdc" }); return { flash: th * 0.5 }; } },
  { n: 11, at: "IT'S", paper: P.black, pat: "none", draw: (c, K) => { tunnel(c, K); caption(c, K, { x: 960, y: 640, size: 360, align: "center", col: BONE, shadow: INK }); } },
  ...[0, 1, 2, 3, 4].map(i => ({ n: 11, at: "x:D#" + i, paper: P.black, pat: "none", punch: 0.2, draw: (c, K) => { dCard(c, K, i); return { flash: since(K.t, K.t0, 0.06) * (0.3 + i * 0.12) }; } })),
];

// ---------- the intro's cards (the creator's note, 9/27 00:39: the intro is "dead"; "the brainrot aura needs to grow, and be
// apparent over time"). The intro is three rounds of the store's countdown, each answered by the synth (intro.js
// draws the 3D rounds); these are the cards: the breather after the second countdown, the third answer's slots
// (cut on the synth's own notes), the held RESTOCK, and the last countdown, one numeral per card into "Step one" ----------
// (the big word's cap height is ~0.87 of its size: its top sits under the small line's baseline)
function soBack(c, K, col = INK) {
  slam(c, K, K.t0, "WE'RE SO", 960, 330, 200, col, { shadow: col === INK ? BONE : INK });
  slam(c, K, K.t0 + 0.05, "BACK", 960, 950, 540, col, { shadow: col === INK ? BONE : INK, pop: 0.3 });
}
function soOver(c, K, col, big) {
  slam(c, K, K.t0, "IT'S SO", 960, 330, 200, col, { shadow: INK });
  slam(c, K, K.t0 + 0.05, "OVER", 960, 950, 540, big, { shadow: INK, pop: 0.3 });
}
// a bot: a rounded head, two lit eyes, an antenna (the scalper, drawn)
function botFace(c, x, y, s, eye = C.red, body = BONE) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
  c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -74); c.stroke();
  c.fillStyle = eye; c.beginPath(); c.arc(0, -80, 10, 0, 7); c.fill();
  c.fillStyle = body; rr(c, -50, -52, 100, 92, 22); c.fill(); c.stroke();
  c.fillStyle = INK; rr(c, -38, -36, 76, 44, 12); c.fill();
  c.fillStyle = eye; for (const ex of [-17, 17]) { c.beginPath(); c.arc(ex, -14, 9, 0, 7); c.fill(); }
  c.fillStyle = INK; c.fillRect(-22, 20, 44, 7);
  c.restore();
}
function botWall(c, K) {                       // they multiply on the note: 1, 4, 16, 64
  const e = K.t - K.t0, lv = Math.max(0, Math.min(3, Math.floor(e / 0.05))), n = 1 << lv, s = 700 / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) botFace(c, 960 + (i - (n - 1) / 2) * s * 1.25, 560 + (j - (n - 1) / 2) * s * 1.05 + s * 0.2, s * 0.9, h32(i, j, 961) < 0.2 ? C.cyan : C.red);
  slam(c, K, K.t0, "BOTS", 960, 250, 200, BONE, { shadow: INK });
}
function cartCard(c, K, units) {
  const e = easeOutBack((K.t - K.t0) / 0.12);
  burst(c, 1420, 330, 230 * e, 18, C.red, INK, `×${units}`, 170 * e, 0.12, BONE);
  slam(c, K, K.t0, "ADDED", 820, 560, 330, INK, { rot: -0.05 });
  slam(c, K, K.t0 + 0.04, "TO CART", 880, 900, 330, INK, { rot: -0.05 });
}
function queueCard(c, K, queue) {
  const n = queue(K.t);
  c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.fillText("YOUR PLACE IN LINE", 960, 300);
  slam(c, K, K.t0, n.toLocaleString("en-US"), 960, 700, 380, BONE, { shadow: INK });
  c.font = font(46, MONO, "600"); c.fillStyle = INK; c.fillText("AHEAD OF YOU", 960, 860);
}
// the third RESTOCK is held for a second and a half: the word stretches while it's sung, the paper flips every 8th
const STRETCH_PAPERS = [P.pink, P.cyan, P.yellow, P.violet, P.green, P.orange];
function restretch(c, K, w) {
  const held = clamp((K.t - w.t) / Math.max(0.2, w.end - w.t - 0.1)), n = 1 + Math.round(held * 22), done = K.t >= w.end - 0.1;
  const txt = "RESTO" + "O".repeat(n) + (done ? "CK" : ""), pulse = song.synth.env(K.t), size = 380;
  // the word keeps its height and squeezes sideways as it stretches (fit to 1600: the card's camera pushes in ~4%)
  c.font = font(size); const tw = c.measureText(txt).width, sq = Math.min(1, 1600 / tw);
  const s = done ? since(K.t, w.end - 0.1, 0.07) : 0, jit = Math.floor(K.t * 15);
  c.save(); c.translate(960 + (h32(jit, 971) - 0.5) * 16, 640 + (h32(jit, 972) - 0.5) * 16); c.scale((1 + s * 0.25) * sq, (1 + s * 0.25) * (1 + pulse * 0.06));
  c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.fillStyle = INK; c.fillText(txt, size * 0.035, size * 0.035 + size * 0.35);
  c.fillStyle = s > 0.6 ? C.red : BONE; c.fillText(txt, 0, size * 0.35);
  c.restore();
  c.font = font(44, MONO, "600"); c.fillStyle = INK; c.textAlign = "center";
  c.fillText(done ? "RESTOCK IN" : "RESTOCKING" + ".".repeat(Math.floor(K.t * 6) % 4), 960, 300);
  return { flash: done ? s * 0.6 : 0 };
}
// the last countdown: one numeral per card, slammed on its sung word
function numeral(c, K, w, digit, col, sh, label) {
  if (label) {
    const typed = label.slice(0, Math.max(0, Math.round(clamp((K.t - K.t0) / 0.1) * label.length)));
    c.font = font(64, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(typed, 960, 190);
  }
  if (!w || K.t < w.t - 0.03) return {};
  const s = slam(c, K, w.t - 0.03, digit, 960, 1000, 800, col, { shadow: sh, pop: 0.45 });
  return { flash: s * 0.5 };
}

export function introPlan(T) {
  const cards = [], add = d => cards.push({ n: 0, tilt: (h32(cards.length, 1717) - 0.5) * 0.035, words: [], prev: null, find: () => null, ...d });
  const [, c1, c2] = T.counts, a2 = T.answers[2];
  // after the second countdown: nothing happens. The only calm card in the intro
  add({ t0: c1.one.end, t1: a2.t0, paper: P.black, pat: "none", calm: true, draw: (c, K) => {      // (a2.t0 already leads its note)
    c.globalAlpha = clamp((K.t - K.t0) / 0.15);
    c.font = font(150, SERIF); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("Nothing happens.", 960, 590);
    c.font = font(30, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.45)"; c.fillText("0 IN STOCK   ·   NOTIFY ME", 960, 690);
  } });
  // the third answer: the synth's notes cut between the 3D room (intro.js) and these cards, denser as it goes
  const SLOTS = ["3d", "back", "3d", "over", "bots", "3d", "cart", "queue", "back2", "over2"];
  const ons = a2.onsets;
  ons.forEach((o, j) => {
    const kind = SLOTS[j % SLOTS.length];
    if (kind === "3d") return;
    const t1 = (ons[j + 1]?.t ?? c2.restock.t) - LEAD;
    const units = 3 + Math.floor(h32(j, 981) * 13);
    const d = {
      back: { paper: P.green, pat: "rays", draw: (c, K) => soBack(c, K) },
      over: { paper: P.red, pat: "stripes", draw: (c, K) => soOver(c, K, BONE, INK) },
      bots: { paper: P.violet, pat: "grid", draw: (c, K) => botWall(c, K) },
      cart: { paper: P.yellow, pat: "dots", draw: (c, K) => cartCard(c, K, units) },
      queue: { paper: P.pink, pat: "speed", draw: (c, K) => queueCard(c, K, T.queue) },
      back2: { paper: P.cyan, pat: "grid", draw: (c, K) => soBack(c, K) },
      over2: { paper: P.black, pat: "none", draw: (c, K) => soOver(c, K, BONE, C.red) },
    }[kind];
    add({ t0: o.t - LEAD, t1, punch: 0.16, ...d });
  });
  // the held RESTOCK, then IN / three, two, one
  add({ t0: c2.restock.t - LEAD, t1: c2.in.t - LEAD, paper: P.pink, pat: "speed", draw: (c, K) => restretch(c, K, c2.restock),
    paperAt: t => STRETCH_PAPERS[Math.floor(song.beatAt(t) * 2) % STRETCH_PAPERS.length] });
  add({ t0: c2.in.t - LEAD, t1: c2.two.t - LEAD, paper: P.pink, pat: "rays", punch: 0.2, draw: (c, K) => numeral(c, K, c2.three, "3", BONE, INK, "RESTOCK IN") });
  add({ t0: c2.two.t - LEAD, t1: c2.one.t - LEAD, paper: P.cyan, pat: "speed", whip: 1, punch: 0.2, draw: (c, K) => numeral(c, K, c2.two, "2", INK, BONE) });
  add({ t0: c2.one.t - LEAD, t1: T.end, paper: P.yellow, pat: "rays", whip: -1, punch: 0.2, draw: (c, K) => numeral(c, K, c2.one, "1", C.red, INK) });
  cards.sort((a, b) => a.t0 - b.t0);
  cards.forEach((c, j) => { const p = cards[j - 1]; c.prev = p && Math.abs(p.t1 - c.t0) < 1e-6 ? p : null; c.i = 2000 + j; });
  return { t0: cards[0].t0, t1: T.end, cards };
}
export const introCardAt = (plan, t) => plan.cards.find(c => t >= c.t0 && t < c.t1) ?? null;

// ---------- the plan: every card's cut time from the words ----------
// (list: verse 2 brings its own cards, market.js; kickFrom: the first kick at or after a word starts, for a cut that
// has to land on the music coming back)
export function fastPlan(STEP, steps, list = CARDS) {
  if (!steps.length || !steps.every(n => STEP[n])) return null;
  // a step's extras: words Suno sang that the sheet doesn't have ("THAT'S" before steps 7-9, the D-D-D-D into the drop)
  const extras = n => song.words.filter(w => w.li === null && w.t >= STEP[n].words[0].t - 0.6 && w.t < STEP[n].t1);
  const find = (n, spec) => {
    const x = spec.startsWith("x:"), [w, occ = 0] = (x ? spec.slice(2) : spec).split("#");
    let k = 0; for (const o of x ? extras(n) : STEP[n].words) if (o.w === w && k++ === +occ) return o; return null;
  };
  const cards = [];
  list.forEach((d, i) => {
    if (!steps.includes(d.n)) return;
    let t0;
    if (d.start === "step") t0 = STEP[d.n].t0;
    else if (d.after) t0 = find(d.n, d.after)?.end;
    else if (d.kickAfter) { const w = find(d.n, d.kickAfter); t0 = w && song.kicks.filter(k => k >= w.end + 0.05)[d.nth ?? 0]; if (t0 !== undefined) t0 -= LEAD; }
    else if (d.kickFrom) { const w = find(d.n, d.kickFrom); t0 = w && song.kicks.find(k => k >= w.t); if (t0 !== undefined) t0 -= LEAD; }
    else t0 = find(d.n, d.at)?.t - LEAD;
    if (t0 === undefined || Number.isNaN(t0)) throw new Error(`fast cut: no word for card ${i} (${d.at ?? d.after ?? d.kickAfter ?? d.kickFrom})`);
    cards.push({ ...d, i: list === CARDS ? i : 3000 + i, t0, find: spec => find(d.n, spec), findAny: find });
  });
  cards.sort((a, b) => a.t0 - b.t0);
  const end = STEP[Math.max(...steps)].t1;                 // where the last step's shot ends (the drop takes over there)
  cards.forEach((c, j) => {
    c.t1 = j + 1 < cards.length ? cards[j + 1].t0 : end;
    c.words = [...STEP[c.n].words, ...extras(c.n)].filter(w => w.t >= c.t0 && w.t < c.t1).sort((a, b) => a.t - b.t);
    c.prev = cards[j - 1] ?? null;
    c.tilt = (h32(c.i, 17) - 0.5) * 0.035;
  });
  return { t0: Math.min(cards[0].t0, STEP[Math.min(...steps)].t0), t1: end, cards, steps, find };
}
export const fastTimes = plan => plan ? plan.cards.flatMap(c => [c.t0 + 0.02, (c.t0 + c.t1) / 2]) : [];

// ---------- the furniture over every card: the step tag, the restock countdown to the drop, the ticker ----------
const TICKER = "0 IN STOCK   ·   NOTIFY ME   ·   QUEUE: 48,211 AHEAD OF YOU   ·   SEE SIMILAR   ·   RESTOCK IN 3 · 2 · 1   ·   SOLD OUT   ·   LIMIT 1 PER CUSTOMER   ·   ";
function furniture(c, t, card) {
  c.textBaseline = "middle";
  c.fillStyle = "#0b0a0f"; rr(c, 48, 40, 420, 52, 8); c.fill();
  c.font = font(24, MONO, "600"); c.fillStyle = C.amber; c.textAlign = "left"; c.fillText("OUT OF STOCK", 66, 67);
  c.fillStyle = BONE; c.fillText(`STEP ${String(card.n).padStart(2, "0")} / 27`, 280, 67);
  const left = Math.max(0, CHORUS1 - t), mm = Math.floor(left / 60), ss = (left % 60).toFixed(2).padStart(5, "0");
  c.fillStyle = "#0b0a0f"; rr(c, W - 440, 40, 392, 52, 8); c.fill();
  c.fillStyle = BONE; c.fillText("RESTOCK IN", W - 420, 67);
  c.fillStyle = C.red; c.textAlign = "right"; c.fillText(`T-${String(mm).padStart(2, "0")}:${ss}`, W - 66, 67);
  c.fillStyle = "#0b0a0f"; c.fillRect(0, H - 46, W, 46);
  c.font = font(22, MONO, "600"); c.textAlign = "left"; c.fillStyle = BONE;
  const tw = c.measureText(TICKER).width, x = -((t * 230) % tw) + 170;
  c.fillText(TICKER, x, H - 22); c.fillText(TICKER, x + tw, H - 22);
  c.fillStyle = C.red; c.fillRect(0, H - 46, 150, 46);
  c.fillStyle = BONE; c.fillText("LIVE", 58, H - 22);
  if (Math.floor(t * 2) % 2 === 0) { c.beginPath(); c.arc(34, H - 23, 9, 0, 7); c.fill(); }
}

// ---------- one frame ----------
// the layer's canvas for this frame. Captures draw every frame on a canvas of its own: the same card drawn on one
// long-lived canvas came out 1/255 different over the whole frame depending on which cards that canvas had drawn
// before (measured: 45.0 after 44.5, after 44.62, and alone gave three different frames). The preview keeps one
// canvas (GPU, and not bit-exact anyway)
export function fastLayer(S) {
  const L = S.fastArt.layer;
  if (EXACT) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; L.canvas = cv; L.ctx = ctx2d(cv); L.tex.image = cv; }
  const c = L.begin();
  L.mesh.visible = true;
  // an opaque base: the whip's seam is anti-aliased, and through a part-covered pixel the 3D backdrop showed, in
  // whatever state the last 3D shot left it (the same t came out different after the drop than after the intro)
  c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
  return c;
}
export function fastCut(t, S, plan) {
  let card = plan.cards[0];
  for (const cd of plan.cards) if (t >= cd.t0) card = cd;
  const L = S.fastArt.layer, c = fastLayer(S), k = song.kickEnv(t, 0.12);
  const fx = cardFrame(c, t, card, S.fastArt);
  c.save(); furniture(c, t, card); c.restore();
  L.end();
  const cut = since(t, card.t0, 0.045);
  return { flash: (fx.flash ?? 0) + (card.calm ? 0 : cut * 0.25), invert: fx.invert ?? 0, glitch: card.calm ? 0 : cut * 0.35 + k * 0.05,
    ca: 0.0012 + k * 0.0035 + cut * 0.012 };
}
// one card, drawn at the frame's size on c as the caller has placed it (the whole frame, or verse 2's windows), with
// the whip from the card before it when the card asks for one. Returns the card's film effects
export function cardFrame(c, t, card, F, ws = 1) {
  const kk = song.lastKick(t), k = song.kickEnv(t, 0.12);
  const body = cd => {
    const K = { t, t0: cd.t0, t1: cd.t1, n: cd.n, k, kick: kk, words: cd.words, w: cd.find, at: cd.findAny, F, rays: cd.rays, card: cd, ws };
    c.save();
    // the camera on the card: a punch in on the cut, a push while it holds, a kick in every beat, a dealt tilt. A card
    // with its own fps (the newspaper) moves on that clock: the camera holds between drawings, like the pages do
    if (!cd.calm) {
      const tc = cd.fps ? cd.t0 + Math.floor((t - cd.t0) * cd.fps) / cd.fps : t, kc = cd.fps ? song.kickEnv(tc, 0.12) : k, kkc = cd.fps ? song.lastKick(tc) : kk;
      const e = tc - cd.t0, punch = 1 + (cd.punch ?? 0.1) * since(tc, cd.t0, 0.06), sc = punch * (1 + e * 0.022) * (1 + kc * 0.022);
      const sx = kkc ? (h32(kkc.i, 1) - 0.5) * kc * 26 : 0, sy = kkc ? (h32(kkc.i, 2) - 0.5) * kc * 26 : 0;
      c.translate(960 + sx, 540 + sy); c.rotate(cd.tilt); c.scale(sc, sc); c.translate(-960, -540);
    }
    if (cd.paper !== null) paper(c, K, cd.paperAt ? cd.paperAt(t) : cd.paper, cd.pat);   // (paperAt: the intro's held RESTOCK flips its paper; null: see-through, verse 2's halt)
    c.save(); const fx = cd.draw(c, K) ?? {}; c.restore();
    c.restore();
    return fx;
  };
  let fx;
  const WHIP = 0.13, wu = (t - card.t0) / WHIP;
  if (card.whip && card.prev && wu < 1) {
    // the whip: the last card is shoved off one side as the next slams in from the other, a seam of speed lines between
    const u = easeOut(wu), dir = card.whip, seam = dir > 0 ? W * (1 - u) : W * u;
    c.save(); c.beginPath(); dir > 0 ? c.rect(-10, -10, seam + 10, H + 20) : c.rect(seam, -10, W - seam + 10, H + 20); c.clip();
    c.translate(-dir * W * u, 0); body(card.prev); c.restore();
    c.save(); c.beginPath(); dir > 0 ? c.rect(seam, -10, W - seam + 10, H + 20) : c.rect(-10, -10, seam + 10, H + 20); c.clip();
    c.translate(dir * W * (1 - u), 0); fx = body(card); c.restore();
    c.fillStyle = BONE;
    for (let i = 0; i < 26; i++) { const y = h32(i, 901) * H, len = 120 + h32(i, 902) * 380; c.fillRect(seam - (dir > 0 ? 0 : len), y, len, 2 + h32(i, 903) * 6); }
  } else fx = body(card);
  return fx;
}

// ---------- the kit: the fast cut's papers and props, for verse 2's cards (market.js) ----------
export const kit = { P, INK, BONE, W, H, BLEED, REACT_W, REACT_H, rr, disp, caption, subtitle, stamp, printAt, printW, silhouette, burst,
  marker, slam, tag, confetti, halo, botFace, spinner, progress, phone, checkMark, calendarPage, hall, reactBox, tower, smiley, keyRow, droste };
