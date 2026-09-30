// Verse 3's end: steps 26 and 27 (the creator's notes, 9/27). Steps 20-25 stay as they are, the creator's word. From step 26 the
// brainrot starts: the sales agent's voice ring "has to ... come back here. It's step 26 and step 27 as well", with
// "the gradual ... panic ... same kind of panic and chaos we're seeing"; "In Step 26, I want the Audio Ring to go from
// smooth curves to spiky, signaling she was getting unhinged as the Cloud is peddled to the customer"; the customer's
// three yeses said by the agent itself ("we might as well let the agent synthesize by that point"); and step 27's held
// word, "Nothing is availabaaaaaaaaaaaaaaaaaaaaaawwwwwww-le" (the creator's spelling, 3:28.4 to 3:30.8), as text "going long,
// and then falling off a cliff".
//
// All of it is one screen-space layer (S.melt) over the chapter shot, which keeps the verse's own look (the creator's word: the
// background and the atmosphere stay):
//  - THE RING, back: steps 20-24's six lines, speaking for you now. Its teeth are HER VOICE (the lead stem's spectrum,
//    analysis/lead-voice.py): smooth before the first "yes", a few points catching at it, every crest a tooth by the
//    third, a sawblade spinning by "billing is available", the colours bled to red with one white line left.
//  - THE PILE: every "yes" opens another checkout behind it; "you're billed" brings the invoices and stamps BILLED on
//    everything; "billing is available" opens an upsell on every kick.
//  - PANIC: one number, monotone by construction as in verse 2 (ascent.js), driving the grade, the tear, the shake.
//  - STEP 27: every window reloads into step 27, 404s on "no" and dies on the kicks until the ring is alone; the roll
//    under "Nothing is" takes panic to the ceiling; then AVAILABLE comes out of the ring on HER PITCH: AVAILAB on the
//    syllables, an A every sixteenth while she holds the vowel, a W every frame through the crack into head voice,
//    "-LE" on her breath past the end of the ground, a hang, and when the chorus voice comes in, it all falls, through
//    the cut into the last chorus (the way step 25's BUILD falls into step 26).
// Every frame is a pure function of t; captures draw on a fresh canvas each frame, and every word on this layer is an
// outline (outline.js), never canvas text, so nothing depends on what the browser drew before (lesson L80).
import * as song from "./song.js";
import { C, EXACT, ctx2d, decode, DISPLAY } from "./type.js";
import { RING, GW, GH, chrome, rr, txt, fill, stroke, check, spinner, setAudio, GREEN, INK } from "./gui.js";
import { glyph, kern, drawGlyph, strokeGlyph, layout, capHeight, OUTLINE_UNIT as UNIT } from "./outline.js";

const { h32 } = song;
const W = 1920, H = 1080, S16 = song.BEAT / 4;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const fi = t => Math.floor(t * song.FPS + 1e-6);
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const mixc = (a, b, u) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(u)))).join(",")})`; };
const money = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------------------------------------------------
// the constants of the picture
// ---------------------------------------------------------------------------------------------------------------------
const RS = 0.889;                   // steps 20-24's ring was drawn in the window's canvas px; this many screen px each
const C26 = [1350, 560], C27 = [600, 690];   // where the ring stands in step 26, and where it walks to in step 27
const Y0 = 776, PXS = 16, S0 = 236, TRACK = -0.03, HX = 1380;   // the word: first baseline, px per semitone of her
                                    // pitch, letter size, tracking (em), where the camera starts following its head
const G = 4200;                     // gravity, px/s^2, for the fall
const TEETH = 48;                   // at full spike: 24 band pairs of her spectrum, mirrored around the ring

// ---------------------------------------------------------------------------------------------------------------------
// the plan: every beat of the two steps, from the song's own words, kicks and stems
// ---------------------------------------------------------------------------------------------------------------------
// at(n, word, occ): the sung time of a word in step n. sentences(li): a line's sentences with their sung times
export function meltPlan(STEP, at, sentences) {
  const s26 = STEP[26], s27 = STEP[27];
  if (!s26 || !s27) return null;
  const P = { t0: s26.t0, t27: s27.t0, t1: s27.t1 };
  P.step26 = at(26, "STEP"); P.yes = [0, 1, 2].map(k => at(26, "YES", k));
  P.youre = at(26, "YOU'RE"); P.billed = at(26, "BILLED", 1); P.billing = at(26, "BILLING");
  P.step27 = at(27, "STEP"); P.no = at(27, "NO"); P.nothing = at(27, "NOTHING"); P.avail = at(27, "AVAILABLE");
  if (![P.step26, ...P.yes, P.youre, P.billed, P.billing, P.step27, P.no, P.nothing, P.avail].every(Number.isFinite)) return null;
  const K = song.kicks;
  P.upsells = K.filter(k => k > P.billing + 0.02 && k < P.t27 - 0.05).slice(0, 4);
  P.roll = K.filter(k => k >= P.nothing - 0.05 && k < P.avail + 1.2);        // the eighths under "Nothing is avail-"
  // what the agent says, each with its time: the step's own name, then its sentences
  const said = (n, name) => [{ text: name, t0: at(n, "STEP") },
    ...sentences(STEP[n].lines[0]).map(s => ({ text: s.text[0].toUpperCase() + s.text.slice(1), t0: s.t0 }))];
  P.say = [...said(26, "Step twenty-six."), ...said(27, "Step twenty-seven.")].filter(s => Number.isFinite(s.t0));
  P.word = heldWord(P);
  P.objs = pile(P);
  // panic: each of these moments takes it to a new level (eased in over 0.22 s), and it only goes up
  P.ev = [{ t: P.step26 - 0.2, p: 0.1 }, { t: P.yes[0], p: 0.26 }, { t: P.yes[1], p: 0.38 }, { t: P.yes[2], p: 0.5 },
    { t: P.youre, p: 0.6 }, { t: P.billed, p: 0.66 }, { t: P.billing, p: 0.74 },
    ...P.upsells.map((k, j) => ({ t: k, p: 0.76 + j * 0.015 })), { t: P.step27, p: 0.84 }, { t: P.no, p: 0.88 },
    ...P.roll.map((k, j) => ({ t: k, p: 0.9 + 0.1 * (j + 1) / P.roll.length }))];
  // how unhinged the ring is (0 smooth .. 1 the sawblade), on the three yeses, the bill, and "billing"
  P.uv = [{ t: P.yes[0], p: 0.3 }, { t: P.yes[1], p: 0.55 }, { t: P.yes[2], p: 0.75 }, { t: P.youre, p: 0.88 }, { t: P.billing, p: 1 }];
  // a ring goes out from the ring on each of these (its colour index)
  P.rings = [...P.yes.map((t, j) => ({ t, j })), ...P.objs.filter(o => o.kind === "inv").map((o, j) => ({ t: o.tIn, j: 3 + j })),
    ...P.upsells.map((t, j) => ({ t, j })), { t: P.billed, j: 1 }, { t: P.no, j: 1 }, ...P.roll.map((t, j) => ({ t, j }))];
  P.tEnd = P.word ? P.word.shout + 1.05 : P.t1;       // the last letter is off the bottom of the frame by then
  return P;
}
// a level that moves to each event's value (eased over tau) and never goes down
function levelAt(evs, t, tau = 0.22) {
  let v = 0, prev = 0, spike = 0;
  for (const e of evs) {
    if (t < e.t) break;
    v = lerp(prev, e.p, ease((t - e.t) / tau)); prev = e.p;
    spike = Math.max(spike, since(t, e.t, 0.3));
  }
  return { v, spike };
}
export const meltPanic = (P, t) => levelAt(P.ev, t);

// the held word: letters with their times, sizes and places, from her pitch (song.lead) and the backing voice
function heldWord(P) {
  const M = song.lead.midiAt, t0 = P.avail, N = 500, v = Array.from({ length: N }, (_, i) => M(t0 + i / 100));
  // her voiced stretches (a single missing frame forgiven)
  const runs = [];
  let s = -1;
  for (let i = 0; i < N; i++) {
    const on = v[i] > 0 || (i > 0 && i < N - 1 && v[i - 1] > 0 && v[i + 1] > 0);
    if (on && s < 0) s = i;
    if (!on && s >= 0) { runs.push([s, i]); s = -1; }
  }
  if (s >= 0) runs.push([s, N]);
  const run = runs.find(([a, b]) => b - a >= 60);           // the vowel's hold: the first stretch of 0.6 s or more
  if (!run) return null;
  const hold = t0 + run[0] / 100;
  // the crack into head voice: the first rise of more than 4 semitones inside 60 ms
  let crack = null;
  for (let i = run[0]; i < N - 6; i++) if (v[i] > 0 && v[i + 6] > 0 && v[i + 6] - v[i] > 4) { crack = t0 + (i + 3) / 100; break; }
  // where her voice gives out: the end of the voiced stretch the crack is in (the end of the ground)
  const cr = crack === null ? run : runs.find(([a, b]) => t0 + a / 100 <= crack && t0 + b / 100 > crack) ?? run;
  const edge = t0 + cr[1] / 100;
  if (crack === null) crack = edge;
  // the chorus voice coming in (the backing stem): that is what knocks the word off
  let shout = edge + 0.3;
  for (let t = edge; t < edge + 1.5; t += 0.01) if (song.env("backing", t) > 0.3) { shout = t; break; }
  // her pitch for the ground: flat before the hold, carried across a missing frame, frozen at the edge
  let mRef = Infinity, mTop = -Infinity;
  for (let t = hold; t < edge; t += 0.01) { const m = M(t); if (m) { mRef = Math.min(mRef, m); mTop = Math.max(mTop, m); } }
  const mOf = t => {
    if (t <= hold) return mRef;
    for (let u = Math.min(t, edge - 0.01); u > hold - 0.005; u -= 0.01) { const m = M(u); if (m) return m; }
    return mRef;
  };
  const strain = t => clamp((mOf(t) - mRef) / Math.max(1, mTop - mRef));
  const yAt = t => Y0 - PXS * (mOf(t) - mRef);
  // the letters: AVAILAB across the syllables; an A on every sixteenth of the grid while she holds the vowel; a W on
  // every frame through the crack; "-LE" on her breath, after the ground has ended
  const L = [];
  const pre = "AVAILAB";
  for (let i = 0; i < pre.length; i++) L.push({ ch: pre[i], t: lerp(t0, hold - 0.04, i / pre.length), kind: "pre" });
  for (let g = song.GRID0 + Math.ceil((hold - song.GRID0) / S16 - 1e-6) * S16; g < crack - 0.03; g += S16) L.push({ ch: "A", t: g, kind: "hold" });
  for (let t = crack; t < edge - 0.015; t += 1 / 30) L.push({ ch: "W", t, kind: "crack" });
  ["-", "L", "E"].forEach((ch, i) => L.push({ ch, t: edge + 0.02 + i * 0.035, kind: "tail" }));
  // their sizes and places (in the verse's own space, before the camera follows)
  let x = C27[0] + 213 * 1.15 + 50;
  L.forEach((l, i) => {
    l.i = i;
    l.strain = l.kind === "tail" ? strain(edge - 0.01) : strain(l.t);
    l.size = S0 * (1 + 0.5 * l.strain);
    if (l.kind === "tail" && l.ch === "-") x += l.size * 0.16;             // the break before her last syllable
    l.x = x; l.y = l.kind === "tail" ? yAt(edge - 0.01) : yAt(l.t);
    l.adv = glyph("anton", l.ch).adv * l.size / UNIT;
    // the held vowel's A's overlap into a smear (at their full width the word ran 4,800 px and the camera had to fly
    // to keep up), the crack's W's harder still: a scream is one shape, not a row of letters
    const tight = l.kind === "hold" ? 0.62 : l.kind === "crack" ? 0.42 : 1;
    x += (l.adv + (L[i + 1] ? kern("anton", l.ch, L[i + 1].ch) * l.size / UNIT : 0)) * tight + TRACK * l.size;
    l.rot = (h32(i, 501) - 0.5) * 0.1;
    // the fall: the letters past the edge go first, then the ground gives way back from the edge
    l.delay = l.kind === "tail" ? 0 : 0.05 + (L.length - 1 - i) * 0.006;
    l.vx = 40 + h32(i, 502) * 140; l.spin = (h32(i, 503) - 0.5) * 6;
  });
  // the head: the right edge of the newest letter, moving continuously between stamps (the camera follows it)
  const knots = L.map(l => [l.t, l.x + l.adv]);
  const headX = t => {
    if (t <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) if (t < knots[i][0]) return lerp(knots[i - 1][1], knots[i][1], (t - knots[i - 1][0]) / (knots[i][0] - knots[i - 1][0]));
    return knots[knots.length - 1][1];
  };
  // the ground's x at a time: under the letter being sung, reaching the last W's right edge at the edge
  const lastOn = [...L].reverse().find(l => l.kind !== "tail");
  const gk = [...L.filter(l => l.kind !== "tail").map(l => [l.t, l.x]), [edge, lastOn.x + lastOn.adv]];
  const groundX = t => {
    if (t <= gk[0][0]) return gk[0][1];
    for (let i = 1; i < gk.length; i++) if (t < gk[i][0]) return lerp(gk[i - 1][1], gk[i][1], (t - gk[i - 1][0]) / (gk[i][0] - gk[i - 1][0]));
    return gk[gk.length - 1][1];
  };
  return { t0, hold, crack, edge, shout, mRef, mTop, letters: L, yAt, strain, headX, groundX };
}

// the pile: every window and invoice, its arrival, its place, what it charges, and when it dies
const UPSELL = [["egress", 1180, 470, -0.08, 90], ["storage", 1760, 940, 0.07, 49], ["queue", 330, 900, 0.04, 288], ["support", 1180, 940, -0.06, 299]];
function pile(P) {
  const O = [];
  const add = o => O.push({ i: O.length, ...o });
  add({ kind: "win", key: "cloud", tIn: P.yes[0], x: 990, y: 610, s: 0.46, rot: -0.05, charge: 2.49, yes: true });
  add({ kind: "win", key: "annual", tIn: P.yes[1], x: 1650, y: 770, s: 0.44, rot: 0.06, charge: 22164, yes: true });
  add({ kind: "win", key: "billed", tIn: P.yes[2], x: 800, y: 830, s: 0.46, rot: -0.03, charge: 1847, yes: true });
  add({ kind: "inv", key: 0, tIn: P.youre, x: 1770, y: 470, s: 0.56, rot: 0.08, charge: 1847 });
  add({ kind: "inv", key: 1, tIn: P.billed, x: 470, y: 700, s: 0.56, rot: -0.1, charge: 22164 });
  add({ kind: "inv", key: 2, tIn: P.billing, x: 1560, y: 470, s: 0.5, rot: 0.05, charge: 44328 });
  P.upsells.forEach((k, j) => { const [key, x, y, rot, charge] = UPSELL[j]; add({ kind: "win", key, tIn: k, x, y, s: 0.36, rot, charge, yes: true }); });
  // "you're billed": BILLED lands on everything there, one after another
  let b = 0;
  for (const o of O) if (o.tIn <= P.billed + 0.01) o.billed = P.billed + 0.03 + (b++) * 0.035;
  // step 27: they die on the kicks between "no" and "nothing", the oldest first, doubling up while there are more
  // of them than kicks
  const ks = song.kicks.filter(k => k > P.no + 0.05 && k <= P.nothing + 0.05);
  O.forEach((o, j) => {
    const q = Math.floor(j * ks.length / O.length), first = O.findIndex((_, jj) => Math.floor(jj * ks.length / O.length) === q);
    o.tDie = (ks[q] ?? P.nothing) + (j - first) * S16;
  });
  return O;
}

// ---------------------------------------------------------------------------------------------------------------------
// the art made once at boot: the windows and the invoices, each at the size it is shown (a sprite drawn once and never
// re-rastered under a moving transform: the text in it is the browser's, so it is made here, once, in a fixed order)
// ---------------------------------------------------------------------------------------------------------------------
const WINS = {
  cloud: { tab: "CHECKOUT - COMPUTE CLOUD", url: "cloud.local/checkout", title: "COMPUTE CLOUD", sub: "ON-DEMAND GPU, 1x FLAGSHIP", row: "YES TO THE CLOUD", price: "$2.49 / HR" },
  annual: { tab: "PLANS - COMPUTE CLOUD", url: "cloud.local/plans/annual", title: "ANNUAL PLAN", sub: "BILLED YEARLY. AUTO-RENEW: ON", row: "YES TO THE ANNUAL PLAN", price: "$1,847 / MO" },
  billed: { tab: "BILLING - COMPUTE CLOUD", url: "cloud.local/billing", title: "PAYMENT", sub: "CARD ON FILE ENDING 4471", row: "YES TO BEING BILLED", price: "CHARGE NOW" },
  egress: { tab: "ADD-ONS", url: "cloud.local/add-ons/egress", title: "EGRESS FEES", sub: "EVERY BYTE THAT LEAVES", row: "YES TO EGRESS", price: "$0.09 / GB" },
  storage: { tab: "ADD-ONS", url: "cloud.local/add-ons/storage", title: "STORAGE ADD-ON", sub: "YOUR FILES, OUR DISKS", row: "YES TO STORAGE", price: "$49 / MO" },
  queue: { tab: "ADD-ONS", url: "cloud.local/add-ons/queue", title: "PRIORITY QUEUE", sub: "SKIP THE LINE YOU ARE IN", row: "YES TO PRIORITY", price: "$0.40 / HR" },
  support: { tab: "ADD-ONS", url: "cloud.local/add-ons/support", title: "SUPPORT: GOLD", sub: "A HUMAN, EVENTUALLY", row: "YES TO SUPPORT", price: "$299 / MO" },
};
const INVS = [
  { no: "#000001", what: "COMPUTE CLOUD, ANNUAL", amount: "$1,847.00", note: "/ MONTH, BILLED YEARLY" },
  { no: "#000002", what: "ANNUAL PLAN, UP FRONT", amount: "$22,164.00", note: "12 x $1,847.00" },
  { no: "#000003", what: "USAGE, THIS HOUR", amount: "$44,328.00", note: "BILLING IS AVAILABLE" },
];
const INV_W = 520, INV_H = 640;
export function initMelt(S, P) {
  if (!P) return;
  const make = (w, h, s, draw) => { const cv = document.createElement("canvas"); cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s); const c = ctx2d(cv); c.scale(s, s); draw(c); return cv; };
  setAudio({ kick: 0, env: () => 0, t: 0 });          // the window chrome reads the music; these are stills
  S.meltArt = { spr: P.objs.map(o => o.kind === "win" ? make(GW, GH, o.s, c => winArt(c, WINS[o.key])) : make(INV_W, INV_H, o.s, c => invArt(c, INVS[o.key]))) };
}
function winArt(c, d) {
  const cb = chrome(c, 0, { tabs: [{ label: d.tab, t0: -1, active: true }], url: d.url });
  txt(c, d.title, cb.x, cb.y + 92, 96, C.white, { fam: DISPLAY });
  txt(c, d.sub, cb.x, cb.y + 146, 30, C.mute);
  const ry = cb.y + 190;                               // the one row that matters, already ticked
  rr(c, cb.x, ry, cb.w * 0.74, 128, 16); fill(c, "#1a2a22");
  rr(c, cb.x + 34, ry + 32, 64, 64, 12); stroke(c, GREEN, 5); check(c, cb.x + 44, ry + 42, 44, GREEN);
  txt(c, d.row, cb.x + 132, ry + 82, 44, C.white);
  txt(c, d.price, cb.x, cb.y + 486, 120, C.amber, { fam: DISPLAY });
  txt(c, "CANCEL ANYTIME*", cb.x, cb.y + 546, 26, C.mute);
  txt(c, "*CANCELLING IS NOT AVAILABLE", cb.x, cb.y + 586, 20, "#5e5a68");
  rr(c, cb.x + cb.w - 340, cb.y + 400, 320, 120, 16); fill(c, C.amber);
  txt(c, "PAY NOW", cb.x + cb.w - 180, cb.y + 478, 46, INK, { align: "center" });
}
function invArt(c, d) {
  rr(c, 0, 0, INV_W, INV_H, 14); fill(c, C.bone);
  txt(c, "INVOICE " + d.no, 36, 74, 32, INK); txt(c, d.what, 36, 122, 22, "#4a4654");
  c.fillStyle = "#b9b2a4"; c.fillRect(36, 150, INV_W - 72, 3);
  for (let i = 0; i < 4; i++) { c.fillStyle = "#cfc8ba"; c.fillRect(36, 190 + i * 30, 180 + h32(i, 71) * 200, 12); c.fillRect(INV_W - 136, 190 + i * 30, 100, 12); }
  txt(c, d.amount, 36, 420, d.amount.length > 9 ? 84 : 100, INK, { fam: DISPLAY });
  txt(c, d.note, 36, 466, 22, "#4a4654");
  c.fillStyle = "#b9b2a4"; c.fillRect(36, 520, INV_W - 72, 3);
  txt(c, "DUE: NOW", 36, 580, 28, C.red);
}

// ---------------------------------------------------------------------------------------------------------------------
// type as outlines
// ---------------------------------------------------------------------------------------------------------------------
function word(c, s, x, y, size, color, o = {}) {
  const fam = o.fam ?? "anton", L = layout(fam, s, size, o.tracking ?? 0), al = o.align ?? "left";
  const x0 = al === "center" ? x - L.w / 2 : al === "right" ? x - L.w : x;
  c.fillStyle = color;
  for (let i = 0; i < s.length; i++) { c.save(); c.translate(x0 + L.xs[i], y); drawGlyph(c, fam, s[i], size); c.restore(); }
  return L.w;
}
// a decoded line in mono (type.js decode(): chars that have resolved, that are still scrambling, not yet typed)
function monoLine(c, chars, x, y, size, color, scramble) {
  const adv = glyph("mono", "M").adv * size / UNIT, x0 = x - adv * chars.length / 2;
  chars.forEach((ch, i) => {
    if (ch.state < 0 || ch.c === " ") return;
    c.fillStyle = ch.state ? color : scramble;
    c.save(); c.translate(x0 + i * adv, y); drawGlyph(c, "mono", ch.c, size); c.restore();
  });
}
// a stamp slammed onto the page: huge, then settling; an outlined box, tilted
function stampO(c, t, t0, label, x, y, col, size, rot, alpha = 1) {
  if (t < t0) return;
  const s = lerp(1.9, 1, easeOut((t - t0) / 0.14)), a = clamp((t - t0) / 0.06) * alpha;
  const L = layout("anton", label, size), cap = capHeight("anton", size), w = L.w + size * 0.6, h = cap + size * 0.55;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha *= a;
  rr(c, -w / 2, -h / 2, w, h, 10); c.strokeStyle = col; c.lineWidth = size * 0.07; c.stroke();
  c.fillStyle = col;
  for (let i = 0; i < label.length; i++) { c.save(); c.translate(-L.w / 2 + L.xs[i], cap / 2); drawGlyph(c, "anton", label[i], size); c.restore(); }
  c.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// the ring
// ---------------------------------------------------------------------------------------------------------------------
const BANDS = new Float32Array(48);
// the colour of line j at unhinge u: bled toward red, except the white one, which stays (a hot core)
const lineCol = (j, u) => j === 5 ? RING[5] : mixc(RING[j], C.red, Math.pow(clamp((u - 0.2) / 0.8), 1.2));
// the teeth's angle: a slow creep, spinning up from "you're billed", faster again on the roll
function spin(P, t) {
  const ramp = (d, T) => d <= 0 ? 0 : d < T ? d * d / (2 * T) : T / 2 + (d - T);
  return 0.25 * Math.max(0, t - P.t0) + 1.05 * ramp(t - P.youre, 2) + 0.45 * Math.max(0, t - P.nothing);
}
// where the ring is and what state it is in
function ringAt(P, t) {
  const U = levelAt(P.uv, t, 0.3).v;
  const born = easeOutBack((t - (P.step26 - 0.25)) / 0.5);
  const mv = ease((t - P.no) / Math.max(0.3, P.nothing - P.no));     // after the 404s it walks to where the word comes out
  const w = P.word, unravel = w ? easeIn((t - w.t0) / Math.max(0.3, w.crack - w.t0)) : 0;
  const R = 213 * (1 + 0.15 * U) * (1 - unravel) * Math.max(0, born);
  return { U, born: clamp(born, 0, 1.2), cx: lerp(C26[0], C27[0], mv), cy: lerp(C26[1], C27[1], mv), R, unravel };
}
// off its centre: every kick shoves it, and it wobbles on its own as she comes apart
function ringCentre(t, st) {
  const kk = song.lastKick(t), k = song.kickEnv(t, 0.1), U = st.U;
  return [st.cx + ((kk ? h32(kk.i, 91) - 0.5 : 0) * 2 * k * 30 + Math.sin(t * 7.3) * 6) * U,
          st.cy + ((kk ? h32(kk.i, 92) - 0.5 : 0) * 2 * k * 30 + Math.cos(t * 5.9) * 6) * U];
}
// its dark inside (steps 20-24's disc, only as wide as the ring) and the glow at its heart, over the pile
function drawRingDisc(c, t, st) {
  const { U, born, R } = st;
  if (born <= 0.001 || R < 0.5) return;
  const [cx, cy] = ringCentre(t, st);
  const dr = R * 1.12;
  const bg = c.createRadialGradient(cx, cy, 0, cx, cy, dr);
  bg.addColorStop(0, `rgba(8,7,11,${0.96 * Math.min(1, born)})`); bg.addColorStop(0.78, `rgba(8,7,11,${0.9 * Math.min(1, born)})`); bg.addColorStop(1, "rgba(8,7,11,0)");
  c.fillStyle = bg; c.fillRect(cx - dr, cy - dr, dr * 2, dr * 2);
  const v = song.env("lead", t);
  const gl = c.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25 + 1);
  gl.addColorStop(0, `rgba(${Math.round(lerp(94, 255, U))},${Math.round(lerp(242, 42, U))},${Math.round(lerp(255, 61, U))},${0.16 * (0.4 + v)})`);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = gl; c.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
}
function drawRing(c, t, P, st, p) {
  const { U, born, R, unravel } = st;
  if (born <= 0.001 || R < 0.5) return;
  const kk = song.lastKick(t), k = song.kickEnv(t, 0.1), [cx, cy] = ringCentre(t, st), fade = 1 - unravel;
  c.save();
  c.globalCompositeOperation = "lighter";
  // rings out, on every yes, every bill, every roll of the kick
  for (const e of P.rings) {
    const dt = t - e.t; if (dt < 0 || dt > 1.2) continue;
    c.globalAlpha = 0.7 * (1 - dt / 1.2) * fade; c.beginPath(); c.arc(cx, cy, R + (20 + dt * 260) * RS, 0, 7);
    c.strokeStyle = lineCol(e.j % 6, U); c.lineWidth = (3 + 5 * (1 - dt)) * RS; c.stroke();
  }
  // the six lines. U = 0 is steps 20-24's speaking ring exactly (its three sines, its swell with her voice); as U
  // climbs that swell gives way to TEETH, one per pair of her spectrum's bands: at first only her loudest bands catch
  // (a gate that opens as U climbs), then every crest; the teeth lean into saw teeth and sharpen, the lines drift apart
  // and cross, the whole blade spins, and every kick flicks it
  const roll = t >= P.nothing - 0.05 && (!P.word || t < P.word.hold) ? 1 + 0.8 * song.kickEnv(t, 0.07) : 1;
  const tA = 2 * Math.PI / TEETH, phi0 = spin(P, t) + (kk ? k * 0.06 * U : 0);
  const tau = lerp(0.8, 0.02, clamp(U * 1.1)), peak = lerp(0.5, 0.9, U * U), sharp = lerp(1, 2.4, U);
  for (let j = 0; j < 6; j++) {
    const dly = lerp(0.035, 0.07, U), tj = t - j * dly;
    const vj = Math.pow(song.env("lead", tj), 1.2);
    const smooth = ((6 + 72) * vj + 3) * RS * Math.min(1, born) * (1 - 0.8 * U);
    const rj = R + (j - 2.5) * 10 * RS * (1 + 0.6 * U);
    const sp = 0.6 + j * 0.23, p1 = t * sp * 2.1 + j * 1.7, p2 = t * sp * 1.3 + j * 2.9, p3 = t * sp * 3.7 + j * 0.8;
    song.lead.bandsAt(tj, BANDS);
    const A = (60 + 110 * U) * RS * Math.min(1, U * 3.5) * (1 + 0.8 * k * U) * (1 - 0.07 * j) * roll * fade;
    const phi = phi0 + j * 0.022 * U;
    c.beginPath();
    for (let i = 0; i < TEETH; i++) {
      const h = i < TEETH / 2 ? i : TEETH - 1 - i, bv = Math.max(BANDS[2 * h], BANDS[2 * h + 1]);
      const tall = A * Math.pow(clamp((bv - tau) / (1 - tau)), lerp(1.4, 0.8, U));
      for (const f of [0, peak * 0.5, peak, peak + (1 - peak) * 0.5]) {
        const prof = f <= peak ? f / peak : (1 - f) / (1 - peak), th = phi + (i + f) * tA;
        const r = Math.max(2, rj + smooth * (0.55 * Math.sin(3 * th + p1) + 0.3 * Math.sin(5 * th - p2) + 0.15 * Math.sin(9 * th + p3))
          + tall * Math.pow(prof, sharp) - 6 * RS * U);
        const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        i || f ? c.lineTo(x, y) : c.moveTo(x, y);
      }
    }
    c.closePath();
    const col = lineCol(j, U);
    c.strokeStyle = col;
    c.lineJoin = "round"; c.globalAlpha = 0.16 * Math.min(1, born); c.lineWidth = 12 * RS * (1 + 0.5 * U); c.stroke();
    c.lineJoin = "miter"; c.miterLimit = 4; c.globalAlpha = 0.95 * Math.min(1, born); c.lineWidth = 3 * RS * (1 + 0.3 * U); c.stroke();
  }
  c.restore();
  // who is who, and what it just said: the agent says YOUR lines now
  const la = ease((born - 0.5) * 2) * (1 - ease(unravel * 3));
  if (la <= 0.01) return;
  const inside = ease((t - P.no) / Math.max(0.3, P.nothing - P.no)), ly = st.cy + 300;
  c.save(); c.globalAlpha *= la * (1 - inside);
  word(c, "SALES AGENT - COMPUTE CLOUD", st.cx, ly, 21, C.mute, { fam: "mono", align: "center" });
  // it can't decide whether it is listening or talking for you; by the bill it only talks
  const q = Math.floor((t - P.t0) / S16), fr = fi(t);
  const listen = t >= P.yes[0] && U < 0.95 && h32(q, 811) < 0.5 * Math.sin(Math.PI * U);
  let status = (listen ? "LISTENING" : t >= P.yes[0] ? "SPEAKING FOR YOU" : "SPEAKING") + ".".repeat(1 + Math.floor(t * 3) % 3);
  status = [...status].map((ch, i) => ch !== " " && h32(fr >> 1, i, 812) < 0.12 * U ? "#$%&*@!?<>/=+"[Math.floor(h32(fr >> 1, i, 813) * 13)] : ch).join("");
  word(c, status, st.cx, ly + 36, 25, listen ? C.bone : U > 0.9 ? C.red : C.cyan, { fam: "mono", align: "center" });
  c.restore();
  c.save(); c.globalAlpha *= la;
  const s = P.say.filter(x => t >= x.t0 - 0.02).pop();
  if (s) {
    // unhinged, it stutters: now and then a scrap of what it is saying, said again
    let text = s.text;
    if (P.word && t >= P.word.t0 && /available\.$/.test(text)) text = text.replace(/ available\.$/, "");   // the word has left it
    const q2 = Math.floor((t - s.t0) / S16);
    if (U > 0.6 && h32(q2, P.say.indexOf(s), 821) < (U - 0.6) * 1.6) {
      const pos = 4 + Math.floor(h32(q2, 822) * Math.max(1, text.length - 8));
      if (text[pos - 1] !== " ") text = text.slice(0, pos) + "-" + text.slice(pos - 4, pos) + text.slice(pos);
    }
    monoLine(c, decode(text, t, s.t0, 0.2 + text.length * 0.012, 90 + P.say.indexOf(s)), st.cx, lerp(ly + 92, st.cy + 10, inside), lerp(32, 28, inside), C.white, lineCol(P.say.indexOf(s) % 5, U));
  }
  c.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// the pile, drawn
// ---------------------------------------------------------------------------------------------------------------------
function drawPile(c, t, P, S, p) {
  const spr = S.meltArt.spr, k = song.kickEnv(t, 0.1), fr = fi(t);
  for (const o of P.objs) {
    if (t < o.tIn) continue;
    const die = clamp((t - o.tDie) / 0.16);
    if (die >= 1) continue;
    const sp = spr[o.i], u = (t - o.tIn) / 0.24, pop = easeOutBack(u), a = clamp((t - o.tIn) / 0.05);
    const dir = h32(o.i, 611) < 0.5 ? -1 : 1, dx = (1 - easeOut(u)) * dir * 260;
    const jit = p * 6, jx = (h32(fr, o.i, 612) - 0.5) * 2 * jit, jy = (h32(fr, o.i, 613) - 0.5) * 2 * jit;
    const sc = lerp(0.62, 1, pop) * (1 + k * 0.025);
    // dying: it collapses to a bright line, like a screen switched off
    const sy = die > 0 ? lerp(1, 0.02, easeIn(Math.min(1, die / 0.7))) : 1, sx = die > 0 ? lerp(1, 1.14, die) : 1;
    const x = o.x + dx + jx, y = o.y + jy, rot = o.rot * (1 + (1 - clamp(pop)) * 2);
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc * sx, sc * sy); c.globalAlpha *= a;
    c.drawImage(sp, -sp.width / 2, -sp.height / 2);
    const bw = sp.width, bh = sp.height;
    if (o.kind === "win") {
      // step 27: every page reloads into step 27, and 404s on "no"
      const cx0 = -bw / 2 + 34 * o.s, cy0 = -bh / 2 + 130 * o.s, cw = 1212 * o.s, ch = 646 * o.s;
      if (t >= P.t27) {
        c.fillStyle = "rgba(12,11,16,0.95)"; c.fillRect(cx0, cy0, cw, ch);
        if (t < P.no) {
          spinner(c, 0, cy0 + ch * 0.42, 70 * o.s, t + o.i * 0.13, C.cyan);
          word(c, "LOADING STEP 27", 0, cy0 + ch * 0.42 + 150 * o.s, 40 * o.s, C.bone, { fam: "mono", align: "center" });
        } else {
          const f = since(t, P.no + o.i * 0.02, 0.12);
          if (f > 0.02) { c.fillStyle = `rgba(255,42,61,${0.5 * f})`; c.fillRect(cx0, cy0, cw, ch); }
          if (t >= P.no + o.i * 0.02) {
            word(c, "404", 0, cy0 + ch * 0.55, 300 * o.s, C.white, { align: "center" });
            word(c, "THERE IS NO STEP 27.", 0, cy0 + ch * 0.55 + 90 * o.s, 44 * o.s, C.bone, { fam: "mono", align: "center" });
          }
        }
      }
      // the kick splits its frame red / cyan (the windows of steps 1-24 do the same)
      if (k > 0.05) {
        c.globalAlpha *= k * 0.8; c.lineWidth = 2 / sc;
        rr(c, -bw / 2 - k * 6, -bh / 2, bw, bh, 16 * o.s); c.strokeStyle = C.red; c.stroke();
        rr(c, -bw / 2 + k * 6, -bh / 2, bw, bh, 16 * o.s); c.strokeStyle = C.cyan; c.stroke();
      }
    }
    c.restore();
    if (die > 0.55) {                                  // the line it leaves, flaring out
      const f = (die - 0.55) / 0.45;
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha *= 1 - f;
      c.fillStyle = C.white; const lw = bw * sc * lerp(1.1, 0.1, f);
      c.fillRect(x - lw / 2, y - 2, lw, 4); c.restore();
    }
    if (die > 0 || t >= P.t27) { if (o.kind === "inv" && t >= P.no && die <= 0) stampO(c, t, P.no + o.i * 0.02, "404", x, y + bh * 0.1, C.red, 110, 0.12); continue; }
    // the stamps, at the screen's size, not the window's
    if (o.yes) stampO(c, t, o.tIn + 0.06, "YES", x + bw * 0.12, y + bh * 0.02, GREEN, o.s > 0.4 ? 96 : 70, -0.16 + (h32(o.i, 621) - 0.5) * 0.2);
    if (o.billed !== undefined) stampO(c, t, o.billed, "BILLED", x - bw * 0.06, y - bh * 0.12, C.red, o.kind === "inv" ? 80 : 88, -0.22 + (h32(o.i, 622) - 0.5) * 0.3);
  }
}
// what it has cost so far, top right: it rolls up to every new charge
function drawTotal(c, t, P, p) {
  if (t < P.yes[0]) return;
  const die = clamp((t - P.nothing) / 0.16);
  if (die >= 1) return;
  let total = 0, from = 0, last = null;
  for (const o of P.objs) if (t >= o.tIn) { from = total; total += o.charge; last = o; }
  const r = ease((t - last.tIn) / 0.28), shown = lerp(from, total, r);
  c.save();
  c.translate(1856, 196); c.scale(1 + 0.12 * since(t, last.tIn, 0.08), die > 0 ? lerp(1, 0.02, die) : 1);
  word(c, t >= P.t27 ? "BALANCE DUE" : "TOTAL BILLED", 0, -86, 22, C.mute, { fam: "mono", align: "right" });
  word(c, money(Math.round(shown * 100) / 100), 0, 0, 80, r < 1 ? C.white : C.red, { align: "right" });
  c.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// the held word, and the ground it runs out of
// ---------------------------------------------------------------------------------------------------------------------
function drawWord(c, t, P, st) {
  const w = P.word;
  if (!w || t < w.t0) return;
  const fr = fi(t), falling = t >= w.shout, trem = falling ? 0 : 1 + 3 * levelAt(P.ev, t).v;
  const fallOf = l => { const tau = t - w.shout - l.delay; return tau > 0 ? tau : 0; };
  // the ground: her pitch, laid down as she sings it, in the ring's six colours (it is the ring, unrolled). From the
  // edge it drops straight down: the cliff. When the word falls, the ground under each letter falls with it
  const GD = 34, tg = Math.min(t, w.edge), gy = w.yAt(w.t0) + GD, sn = clamp((gy - st.cy) / Math.max(1, st.R), -1, 1);
  const gx0 = st.cx + st.R * Math.sqrt(1 - sn * sn), gy0 = st.cy + st.R * sn;   // it leaves the ring's circle, level with the ground
  const gpts = [];
  for (let u = w.t0; u <= tg + 1e-6; u += 0.02) gpts.push([w.groundX(u), w.yAt(u) + GD]);
  gpts.push([w.groundX(tg), w.yAt(tg) + GD]);
  const sag = l => { const tau = fallOf(l); return tau > 0 ? [l.vx * tau, 0.5 * G * tau * tau - 60 * tau] : [0, 0]; };
  const owner = x => { let o = w.letters[0]; for (const l of w.letters) if (l.kind !== "tail" && l.x <= x) o = l; return o; };
  c.save(); c.globalCompositeOperation = "lighter"; c.lineJoin = "round"; c.lineCap = "round";
  for (let j = 0; j < 6; j++) {
    const col = RING[j], dy = (j - 2.5) * 7;
    for (const [lw, al] of [[18, 0.26], [4.4, 1]]) {
      c.strokeStyle = col; c.lineWidth = lw; c.globalAlpha = al;
      c.beginPath();
      if (!falling) {
        c.moveTo(gx0, gy0 + dy * 0.4);
        gpts.forEach(([x, y], i) => c.lineTo(x, y + dy + Math.sin(x * 0.02 + t * 8 + j * 1.3) * (1.5 + 3 * song.lead.env(t))));
        if (t >= w.edge) {                                                  // the cliff face
          const [ex, ey] = gpts[gpts.length - 1];
          c.lineTo(ex + dy * 0.3, ey + dy + (H + 600) * easeOut((t - w.edge) / 0.1));
        }
      } else {
        // broken into the pieces under each letter, each falling with its letter
        let cur = null;
        gpts.forEach(([x, y]) => {
          const o = owner(x), [ox, oy] = sag(o), px = x + ox, py = y + dy + oy;
          if (o !== cur) { c.moveTo(px, py); cur = o; } else c.lineTo(px, py);
        });
      }
      c.stroke();
    }
  }
  c.restore();
  // the letters: stamped on their times, slammed in, trembling harder as she strains; each one whiter to redder as
  // her pitch climbs, split red / cyan, on an ink outline so it reads over anything
  const cap = capHeight("anton", 1);
  for (const l of w.letters) {
    if (t < l.t) break;
    const slam = since(t, l.t, 0.05), sz = l.size * (1 + 0.5 * slam);
    let x = l.x + (h32(fr, l.i, 701) - 0.5) * 2 * trem * (0.6 + 1.6 * l.strain), y = l.y + (h32(fr, l.i, 702) - 0.5) * 2 * trem * (0.6 + 1.6 * l.strain);
    let rot = l.rot * (1 + 3 * slam), sy = 1, sx = 1;
    const tau = fallOf(l);
    if (tau > 0) {
      x += l.vx * tau; y += 0.5 * G * tau * tau - 60 * tau; rot += l.spin * tau;
      sy = 1 + Math.min(0.45, tau * 1.4); sx = 1 / Math.sqrt(sy);           // stretched by the speed, as a drawing falls
    }
    const ch = cap * sz, c0 = cap * l.size, cxl = x + l.adv / 2, cyl = y - c0 / 2;
    if (y - ch * sy * 1.2 > H + 40 - st.oy) continue;                        // gone off the bottom (in screen terms)
    c.save(); c.translate(cxl, cyl); c.rotate(rot); c.scale(sx * sz / l.size, sy * sz / l.size); c.translate(-l.adv / 2, c0 / 2);
    // the speed lines of the fall
    if (tau > 0.03) {
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha *= 0.5; c.fillStyle = C.white;
      const len = Math.min(320, G * tau * 0.09);
      for (let q = 0; q < 3; q++) c.fillRect(l.adv * (0.2 + 0.3 * q), -c0 - 20 - len, 3, len);
      c.restore();
    }
    const split = 3 + 9 * l.strain + 14 * slam + (tau > 0 ? 6 : 0), ang = h32(l.i, 704) * Math.PI * 2;
    c.strokeStyle = "#0c0b10"; strokeGlyph(c, "anton", l.ch, l.size, 12);
    c.save(); c.globalCompositeOperation = "lighter";
    c.fillStyle = "rgba(255,42,61,0.85)"; c.save(); c.translate(Math.cos(ang) * split, Math.sin(ang) * split * 0.5); drawGlyph(c, "anton", l.ch, l.size); c.restore();
    c.fillStyle = "rgba(0,229,255,0.7)"; c.save(); c.translate(-Math.cos(ang) * split, -Math.sin(ang) * split * 0.5); drawGlyph(c, "anton", l.ch, l.size); c.restore();
    c.restore();
    c.fillStyle = mixc("#f4f1ea", C.red, Math.pow(l.strain, 1.2) + (l.kind === "tail" ? 0.2 : 0));
    drawGlyph(c, "anton", l.ch, l.size);
    c.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// the camera: the travel that follows the word's head, and the panic shake (px); the 3D chapter behind is moved by the
// same amount so the whole picture moves as one
// ---------------------------------------------------------------------------------------------------------------------
const soft = d => 0.5 * (d + Math.sqrt(d * d + 90 * 90));
function viewAt(P, t) {
  let px = 0, py = 0;
  const w = P.word;
  if (w && t >= w.t0) {
    const tt = Math.min(t, w.shout);
    px = Math.max(0, soft(w.headX(tt) - HX) - soft(w.headX(w.t0) - HX));
    py = 0.55 * (w.yAt(tt) - Y0);
  }
  const { v: p } = levelAt(P.ev, t), k = song.kickEnv(t, 0.1), fr = fi(t);
  const amp = w && t >= w.shout ? 0 : p * (2 + 12 * k) + (p > 0.95 ? 3 : 0);
  return { px, py, sx: (h32(fr, 601) - 0.5) * 2 * amp, sy: (h32(fr, 602) - 0.5) * 2 * amp };
}

// the layer's canvas for this frame (captures draw every frame on a canvas of their own: lesson L80)
function meltLayer(S) {
  const L = S.melt;
  if (EXACT) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; L.canvas = cv; L.ctx = ctx2d(cv); L.tex.image = cv; }
  L.mesh.visible = true;
  return L.begin();
}

// one frame. Called after the shot, for every t in [P.t0, P.tEnd]: the chapter is under it until P.t1, the last
// chorus after. Returns the film's additions for this frame, or null
export function meltdown(t, S, P) {
  const wordOut = P && P.word && t >= P.word.t0;
  if (!P || t < P.t0 - 1e-6 || t > P.tEnd) return null;
  const chapter = t < P.t1, V = viewAt(P, t), pan = { x: V.px + V.sx, y: V.py + V.sy };
  if (chapter) {
    // the 3D behind moves with the picture: pixels on the headline's plane (z 0.8) at the chapter camera's distance
    const cam = S.camera, ppu = H / (2 * (cam.position.z - 0.8) * Math.tan(cam.fov * Math.PI / 360));
    cam.position.x += pan.x / ppu; cam.position.y -= pan.y / ppu;
  }
  const { v: p, spike } = levelAt(P.ev, t), st = ringAt(P, t);
  const c = meltLayer(S);
  c.save(); c.lineCap = "butt"; c.lineJoin = "miter"; c.letterSpacing = "0px";
  if (chapter && p > 0.3) { c.fillStyle = `rgba(110,8,20,${(p - 0.3) * 0.26})`; c.fillRect(0, 0, W, H); }   // panic reddens the air
  c.translate(-pan.x, -pan.y);
  st.oy = -pan.y;
  if (chapter) {
    drawPile(c, t, P, S, p);
    drawRingDisc(c, t, st);
    drawRing(c, t, P, st, p);
  }
  drawWord(c, t, P, st);
  c.restore();
  if (chapter) { c.save(); c.translate(-V.sx, -V.sy); drawTotal(c, t, P, p); c.restore(); }
  S.melt.end();
  layerFx(S.melt, t, P, p, spike, chapter, wordOut);

  if (!chapter) return { ca: 0, glitch: 0, flash: 0 };
  // the film: panic IS the grade, as in verse 2
  const w = P.word, kk = song.lastKick(t), kv = song.kickEnv(t, 0.1);
  const big = kk && t - kk.t < 1.5 && (Math.round(song.beatAt(kk.t)) % 4 === 0 || h32(kk.i, 5) < 0.2) ? 1 : 0;
  let stamp = 0;
  if (w) for (const l of w.letters) if (t >= l.t) stamp = Math.max(stamp, since(t, l.t, 0.04));
  const fx = {
    ca: p * 0.011 + spike * 0.007 + kv * 0.003 * p + stamp * 0.004,
    glitch: Math.min(0.42, p * 0.09 + spike * 0.16 + big * kv * 0.12 * p) * (wordOut ? 0.35 : 1),
    flash: spike * 0.2 + stamp * 0.05,
    grain: p * 0.05, vignette: p * 0.18, weave: p * 0.6, halation: p * 0.45, bloom: p * 0.12,
    invert: t >= P.no && t < P.no + 2 / 30 ? 1 : 0,
  };
  if (w && t >= w.shout) { fx.flash += since(t, w.shout, 0.08) * 0.35; fx.ca += since(t, w.shout, 0.15) * 0.01; }
  return fx;
}
// the glitch stage on the layer itself: a directional split over the post chain's radial one, tears on the big kicks
function layerFx(L, t, P, p, spike, chapter, wordOut) {
  const U = L.mat.uniforms;
  if (!chapter) { U.ca.value = 0.002; U.caDir.value.set(1, 0); U.tear.value = 0; U.block.value = 0; U.scan.value = 0; U.seed.value = 0; U.frame.value = fi(t); return; }
  const kk = song.lastKick(t), kdt = kk ? t - kk.t : 9, kv = kdt < 1.5 ? Math.exp(-kdt / 0.09) : 0;
  const big = kk && (Math.round(song.beatAt(kk.t)) % 4 === 0 || h32(kk.i, 5) < 0.2) ? 1 : 0;
  const ang = (kk ? h32(kk.i, 7713) : 0) * Math.PI * 2;
  U.ca.value = 0.0008 + p * 0.004 + kv * (0.002 + big * 0.004) * (0.3 + p) + spike * 0.004;
  U.caDir.value.set(Math.cos(ang), Math.sin(ang) * 0.6);
  U.tear.value = Math.min(1, p * 0.18 + (kdt < 1.5 ? Math.exp(-kdt / (big ? 0.05 : 0.035)) * (big ? 0.6 : 0.15) * p : 0) + spike * 0.35) * (wordOut ? 0.15 : 1);
  U.block.value = big && kdt < 2 / 30 ? 0.5 * p : 0;
  U.scan.value = 0.04 + p * 0.1;
  U.seed.value = (kk ? kk.i * 17 : 0) + fi(t);
  U.frame.value = fi(t);
}

// every distinct moment, for the warm-up (a canvas's first draw of a gradient or a scaled sprite can differ)
export function meltTimes(P) {
  if (!P) return [];
  const ts = [P.step26, ...P.yes.map(x => x + 0.1), P.youre + 0.1, P.billed + 0.1, P.billing + 0.1, ...P.upsells.map(x => x + 0.1),
    P.t27 + 0.2, P.no + 0.02, P.no + 0.3, ...P.objs.map(o => o.tDie + 0.1), P.nothing + 0.1];
  const w = P.word;
  if (w) ts.push(...w.letters.filter((_, i) => i % 6 === 0).map(l => l.t + 0.02), w.edge + 0.05, w.shout + 0.05, w.shout + 0.3, P.t1 + 0.1, P.t1 + 0.4);
  return ts.filter(Number.isFinite);
}
