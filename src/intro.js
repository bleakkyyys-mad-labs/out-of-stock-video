// The intro (the creator's note, 9/27 00:39: "The intro is a little too... well, dead. The brainrot aura needs to grow, and be
// apparent over time in this sequence." The look stays, "kinda cyberpunky"; it needs "more dynamic. More movement.").
// The creator's new stem, the synth, answers the store's countdown three times, louder, brighter and longer each time. That is
// the spine: THE STORE TALKS, THE INTERNET ANSWERS.
//   cold open    black, a watcher typing, the card a shape in the dark, until the synth's first note
//   answer 1     the card lights up inside the reference visualizer's ring, the neon floor, the camera flies; you mash NOTIFY ME
//   countdown 1  the store's voice: the numerals slam, the ring shrinks to a loading spinner; on "one" the restock goes live
//   answer 2     the bots: every note buys some, the stock drains to SOLD OUT, the queue climbs
//   countdown 2  the same, glitched; after "one", nothing happens (a black card, fastcut.js)
//   answer 3     it tips over: the synth's notes cut between this room at full tilt and the fast cut's cards
//   countdown 3  the held RESTOCK and one card per numeral (fastcut.js), straight into "Step one"
// The card itself is the reference's card effect: it scales, turns, flickers colour and splits RGB in depth with the synth. The ring
// is the reference visualizer: 48 bands mirrored around an ellipse, bars as wireframe boxes (data/synth.js = the reference's analyzer).
// Every time comes from the song's data (the words, the synth's spans and notes). A pure function of t.
import * as THREE from "three";
import * as song from "./song.js";
import { place } from "./stage.js";
import { C, font, decode, drawDecoded, drawGlitched, drawTyped, MONO, EXACT, ctx2d } from "./type.js";
import { FILM } from "./post.js";
import { camera, anchor, backdrop, hud } from "./rig.js";
import { introPlan, introCardAt, fastCut, fastTimes, LEAD } from "./fastcut.js";

const { h32, synth } = song;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const INK = "#0b0a0f", BONE = "#f4f1ea", GREEN = "#19db73";

// ---------- the timeline, from the data ----------
const firstVerse = song.sections.find(s => s.kind === "verse");
const END = firstVerse.t0 - 0.05;                              // director.shot hands over to the verse's fast cut here
const COUNTS = [];                                             // the store's three countdowns: {restock, in, three, two, one}
for (const w of song.words) {
  if (w.t >= END) break;
  if (w.w === "RESTOCK") COUNTS.push({ restock: w });
  else if (COUNTS.length) { const k = { IN: "in", THREE: "three", TWO: "two", ONE: "one" }[w.w], c = COUNTS[COUNTS.length - 1]; if (k && !c[k]) c[k] = w; }
}
// the synth's answers: where it plays before each countdown (a cut lands a frame before what it cuts on: LEAD)
const SPANS = synth.spans.filter(s => s.t0 < END);
if (COUNTS.length !== 3 || SPANS.length < 3 || COUNTS.some(c => !c.one)) throw new Error("intro: expected three countdowns, each after a synth answer");
const ANSWERS = COUNTS.map((cd, k) => {
  const t0 = SPANS[k].t0 - LEAD, t1 = cd.restock.t;
  return { k, t0, t1, onsets: synth.onsets.map((o, i) => ({ ...o, i })).filter(o => o.t >= SPANS[k].t0 - 0.05 && o.t < t1 - 0.1) };
});
// the bots' purchases in the second answer: each note buys a few (step fifteen's bot buys nine); the stock starts at
// exactly what they'll take, so it hits zero on the last note before the second countdown
const BUYS = ANSWERS[1].onsets.map((o, j) => ({ t: o.t, j, units: 3 + Math.floor(h32(j, 993) * 13) }));
const STOCK0 = BUYS.reduce((s, b) => s + b.units, 0), SOLD_OUT = BUYS[BUYS.length - 1].t;
const stockAt = t => STOCK0 - BUYS.reduce((s, b) => s + (b.t <= t ? b.units : 0), 0);
// the queue ahead of you: creeps, then jumps with every note (more bots each round), and lands on exactly the verses'
// ticker ("QUEUE: 48,211 AHEAD OF YOU", fastcut.js) as the intro ends
const Q0 = 412, Q1 = 48211;
const JOINS = ANSWERS.flatMap((a, k) => a.onsets.map((o, j) => ({ t: o.t, w: (1 + k * 2.5) * (0.4 + h32(k, j, 991)) })));
const rawQ = t => t * 0.35 + JOINS.reduce((s, j) => s + (t >= j.t ? j.w * easeOut((t - j.t) / 0.1) : 0), 0);
const RAW_END = rawQ(END);
const queueAt = t => Math.round(Q0 + (Q1 - Q0) * clamp(rawQ(t) / RAW_END));
const PLAN = introPlan({ counts: COUNTS, answers: ANSWERS, queue: queueAt, end: END });
window.OOS_INTRO = { PLAN, ANSWERS, COUNTS, STOCK0, SOLD_OUT, queueAt };       // for the headless probes

function phaseAt(t) {
  if (t < ANSWERS[0].t0) return { kind: "cold", k: -1 };
  for (let k = 2; k >= 0; k--) {
    if (t >= COUNTS[k].restock.t) return { kind: "count", k };
    if (t >= ANSWERS[k].t0) return { kind: "answer", k };
  }
  return { kind: "cold", k: -1 };
}

// ---------- the world ----------
const CARD = [0, 0.15, 0], CARD_H = 2.3, RING_Z = -1.3, FLOOR_Y = -2.5;
const RING_BIG = [3.5, 2.05], RING_SMALL = [2.85, 1.5];        // answers: the visualizer's ellipse; countdowns: the spinner
const NUM_AT = [-4.7, -1.8, 0.8];                              // the countdown numerals, left of the card
const BUF = new Float32Array(48);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

// the synth's note: 1 on it, decaying fast, stronger notes bigger
function notePulse(t) {
  const on = synth.lastOnset(t);
  return on && t - on.t < 1 ? { on, p: Math.exp(-(t - on.t) / 0.09) * (0.55 + 0.45 * on.s) } : { on: null, p: 0 };
}

// the reference visualizer's ring: 96 bars on an ellipse around the card, each band mirrored left/right (bass at the top),
// each bar a wireframe box standing on the ellipse along its normal (as the reference aligns them)
function ring(S, t, o) {
  const R = S.ring, N = R.count, half = N / 2, [rx, ry] = o.radii, B = o.bands;
  const aV = R.geometry.attributes.aVal, aH = R.geometry.attributes.aHue, aX = R.geometry.attributes.aHot;
  R.visible = true; R.position.set(CARD[0], CARD[1], RING_Z); R.rotation.set(0, 0, 0); R.scale.setScalar(1);
  const U = R.material.uniforms;
  U.gain.value = o.gain; U.alpha.value = o.alpha; U.fill.value = o.fill ?? 0.1;
  U.colB.value.set(o.colB ?? 0xff3d8b);
  for (let i = 0; i < N; i++) {
    const b = i < half ? i : N - 1 - i;                          // mirrored
    const th = Math.PI / 2 - (i + 0.5) * 2 * Math.PI / N;       // from the top, clockwise
    const cx = Math.cos(th) * rx, cy = Math.sin(th) * ry;
    let nx = Math.cos(th) / rx, ny = Math.sin(th) / ry; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    let v = B ? B[b] : 0, hot = 0;
    if (o.spin !== undefined) {                                  // the loading spinner: a lit arc chasing round
      let d = ((th - o.spin) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      hot = Math.pow(clamp(1 - Math.abs(d) / 0.9), 2) * (d < 0 ? 1 : 0.35);
      v = Math.max(v, hot * 0.5 + (o.burst ?? 0) * (0.35 + 0.65 * h32(i, o.burstSeed ?? 0, 1107)));
    }
    const L = o.minL + v * o.maxL;
    _p.set(cx + nx * L / 2, cy + ny * L / 2, 0);
    _q.setFromAxisAngle(_z, Math.atan2(ny, nx) - Math.PI / 2);
    _s.set(o.w ?? 0.085, Math.max(0.01, L), 0.12);
    R.setMatrixAt(i, _m.compose(_p, _q, _s));
    aV.array[i] = v; aH.array[i] = b / (half - 1); aX.array[i] = hot * (o.hotGain ?? 1);
  }
  R.instanceMatrix.needsUpdate = true; aV.needsUpdate = true; aH.needsUpdate = true; aX.needsUpdate = true;
}

// the neon floor's scroll: slow always, faster through each answer (integrated, so it's a pure function of t)
const SCROLL = [1.0, 2.4, 5.5];
const scrollAt = t => 0.4 * t + ANSWERS.reduce((s, a, k) => s + SCROLL[k] * clamp(t - a.t0, 0, a.t1 - a.t0), 0);
function floor(S, t, gain, pulse) {
  const F = S.floor, U = F.material.uniforms;
  F.visible = true; F.position.set(CARD[0], FLOOR_Y, CARD[2]);
  U.gain.value = gain; U.pulse.value = pulse; U.scroll.value = scrollAt(t); U.center.value.set(CARD[0], CARD[2]); U.fade.value = 10;
}

// the card as the reference's card effect: base print settings (the old intro's), plus what the synth does to it
const CARD_INK = { invert: 1, ink: 0xece6da, inkGain: 1.6, pitch: 64, contrast: 2.3, gain: -0.1, outline: 0.9, detail: 0.35 };
const FLICKER = [0x5ef2ff, 0xff3d8b, 0xffb21e];
function effectorCard(S, t, fx) {
  const pos = [CARD[0], CARD[1] + Math.sin(t * 0.7) * 0.03, CARD[2]], h = CARD_H * fx.scale;
  const main = place(S.cards.rtx3090, pos, [0, fx.ry ?? 0, fx.rz], h, {
    ...CARD_INK, ink: fx.ink ?? CARD_INK.ink, inkGain: fx.inkGain ?? 1.6, spot: fx.spot ?? [0.52, 1.25, 1.35, 1], pump: fx.pump ?? 0, dissolve: fx.dissolve ?? 0, seed: 1, order: 2,
  });
  if (fx.shift > 0.002) {                                        // the RGB shift, in depth (the reference's depth shift)
    const dx = Math.cos(fx.dir) * fx.shift, dy = Math.sin(fx.dir) * fx.shift * 0.6;
    [[S.storm[0], 0xff2a3d, 1], [S.storm[6], 0x35d6f0, -1]].forEach(([m, ink, sg]) => place(m, [pos[0] + dx * sg, pos[1] + dy * sg, pos[2] - 0.12 - (sg > 0 ? 0 : 0.1)], [0, fx.ry ?? 0, fx.rz], h, {
      ...CARD_INK, ink, inkGain: 1.9, spot: fx.spot ?? [0.52, 1.25, 1.35, 1], pump: fx.pump ?? 0, opacity: clamp(fx.shift * 5) * 0.7, order: 1,
    }));
  }
  return main;
}

// sparks thrown off the ring on the notes (the visualizer's particles): S.dots, billboards
function sparks(S, t, k, col) {
  const D = S.dots, al = D.geometry.attributes.aAlpha, [rx, ry] = RING_BIG, per = 10 + k * 10;
  D.visible = true; D.material.uniforms.color.value.set(col); D.material.uniforms.gain.value = 2.2;
  let n = 0;
  const live = synth.onsets.filter(o => o.t <= t && t - o.t < 0.7 && o.t >= ANSWERS[k].t0 - 0.05);
  for (const o of live) {
    const dt = t - o.t, j = synth.onsets.indexOf(o);
    for (let m = 0; m < per && n < D.count; m++, n++) {
      const a = h32(j, m, 1201) * Math.PI * 2, sp = 1.6 + h32(j, m, 1202) * 3.2 * (0.6 + o.s);
      const ex = Math.cos(a), ey = Math.sin(a);
      _p.set(CARD[0] + ex * rx * (1.02 + sp * dt / rx), CARD[1] + ey * ry * (1.02 + sp * dt / ry) - 0.6 * dt * dt, RING_Z + (h32(j, m, 1203) - 0.5) * 2 * dt);
      const s = (0.03 + h32(j, m, 1204) * 0.05) * (1 - dt / 0.7);
      D.setMatrixAt(n, _m.compose(_p, _q.identity(), _s.set(s, s, s)));
      al.array[n] = (1 - dt / 0.7) * (0.5 + 0.5 * o.s);
    }
  }
  for (; n < D.count; n++) { al.array[n] = 0; D.setMatrixAt(n, _m.makeScale(0, 0, 0)); }
  D.instanceMatrix.needsUpdate = true; al.needsUpdate = true;
}

// ---------- the screen furniture (S.introFx): the watcher's terminal, NOTIFY ME, the bots, the stock ----------
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
// captures draw it on a fresh canvas every frame (a long-lived CPU canvas is not bit-exact across its own history:
// lesson L80, measured on the fast cut); the preview keeps one canvas
function fxLayer(S) {
  const L = S.introFx;
  if (EXACT) { const cv = document.createElement("canvas"); cv.width = 1920; cv.height = 1080; L.canvas = cv; L.ctx = ctx2d(cv); L.tex.image = cv; }
  L.mesh.visible = true;
  return L.begin();
}
export function botGlyph(c, x, y, s, eye) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
  c.fillStyle = BONE; rr(c, -46, -40, 92, 82, 18); c.fill();
  c.fillStyle = INK; rr(c, -34, -26, 68, 40, 10); c.fill();
  c.fillStyle = eye; for (const ex of [-15, 15]) { c.beginPath(); c.arc(ex, -6, 8, 0, 7); c.fill(); }
  c.fillStyle = BONE; c.fillRect(-3, -58, 6, 18); c.fillStyle = eye; c.beginPath(); c.arc(0, -60, 8, 0, 7); c.fill();
  c.restore();
}
export const HANDLES = ["cartbot_4471", "sn1pe_exe", "restock_rat", "g0blin_buyer", "bot_9000", "flip4profit", "queue_skipper", "xX_cart_Xx",
  "gpu_goblin", "autocheckout", "b0t_b0t_b0t", "fastfingers", "tabfarm_22", "nvm_bought_it", "resell_king", "cart_ghost"];
export function toast(c, x, y, j, units, a = 1, rot = 0, s = 1) {
  const W = 540, H = 104, eye = h32(j, 1301) < 0.3 ? C.cyan : C.red;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a;
  c.fillStyle = "rgba(11,10,15,0.94)"; rr(c, 0, 0, W, H, 14); c.fill();
  c.strokeStyle = "rgba(244,241,234,0.22)"; c.lineWidth = 2; c.stroke();
  c.fillStyle = eye; c.fillRect(0, 12, 6, H - 24);
  botGlyph(c, 58, 58, 64, eye);
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.font = font(26, MONO, "600"); c.fillStyle = BONE; c.fillText("@" + HANDLES[Math.floor(h32(j, 1302) * HANDLES.length)], 112, 44);
  c.fillStyle = C.amber; c.fillText(`ADDED TO CART  ×${units}`, 112, 80);
  c.font = font(20, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.45)"; c.textAlign = "right";
  c.fillText(`${(0.001 + h32(j, 1303) * 0.009).toFixed(3)}s`, W - 18, 44);
  c.restore();
}
// a rubber stamp slammed on (the fast cut's stamp, in screen space)
function stamp(c, t, t0, label, x, y, rot, col, size) {
  if (t < t0) return 0;
  const e = t - t0, s = lerp(2.3, 1, easeOut(e / 0.09));
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = clamp(e / 0.04 + 0.35);
  c.font = font(size); c.textAlign = "center"; c.textBaseline = "alphabetic";
  const tw = c.measureText(label).width, bw = tw + size * 0.55, bh = size * 1.08;
  c.strokeStyle = col; c.lineWidth = size * 0.085; rr(c, -bw / 2, -bh * 0.72, bw, bh, size * 0.12); c.stroke();
  c.fillStyle = col; c.fillText(label, 0, size * 0.17);
  c.restore();
  return since(t, t0, 0.1);
}

function coldFx(c, t) {
  const lines = [{ text: "> watch GPU-24GB --every 0.4s", t0: 0.15, t1: 0.95 }, { text: "> waiting for restock", t0: 1.1, t1: 1.55 }];
  c.font = font(34, MONO, "600"); c.textBaseline = "alphabetic"; c.textAlign = "left";
  let last = null;
  lines.forEach((l, i) => {
    const n = Math.round(clamp((t - l.t0) / (l.t1 - l.t0)) * l.text.length);
    if (t < l.t0) return;
    c.fillStyle = i ? C.amber : "rgba(244,241,234,0.85)"; c.fillText(l.text.slice(0, n), 130, 190 + i * 56);
    last = { x: 130 + c.measureText(l.text.slice(0, n)).width, y: 190 + i * 56 };
  });
  if (last && Math.floor(t * 2.4) % 2 === 0) c.fillRect(last.x + 8, last.y - 28, 18, 34);
}
function notifyFx(c, t, a) {                                   // answer 1: you, mashing NOTIFY ME on every note
  const ons = a.onsets.filter(o => o.t <= t), on = ons[ons.length - 1], press = on ? since(t, on.t, 0.07) : 0;
  const bx = 1500, by = 940, pop = easeOutBack((t - a.t0) / 0.25);       // bottom right, clear of the fine print
  c.save(); c.translate(bx, by); c.scale(pop * (1 - press * 0.06), pop * (1 - press * 0.06));
  c.fillStyle = press > 0.5 ? C.amber : BONE; rr(c, -210, -44, 420, 88, 44); c.fill();
  c.font = font(46); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("NOTIFY ME", 0, 3);
  c.restore();
  for (const o of ons.slice(-4)) {                             // a click ring per press
    const u = clamp((t - o.t) / 0.3);
    if (u >= 1) continue;
    c.strokeStyle = `rgba(255,178,30,${1 - u})`; c.lineWidth = 6; c.beginPath(); c.ellipse(bx + 70, by + 12, 40 + u * 160, 20 + u * 70, 0, 0, 7); c.stroke();
  }
  // the cursor, pressing
  c.save(); c.translate(bx + 70, by + 12 + press * 6); c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 4;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 54); c.lineTo(14, 42); c.lineTo(26, 66); c.lineTo(36, 61); c.lineTo(24, 38); c.lineTo(42, 38); c.closePath(); c.fill(); c.stroke();
  c.restore();
  if (ons.length) { c.font = font(24, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.7)"; c.textAlign = "center"; c.fillText(`NOTIFIED ×${ons.length}`, bx, by - 70); }
}
function stockPanel(c, t) {                                    // answer 2: the stock, drained by the bots
  const n = stockAt(t), x = 70, y = 110, frac = n / STOCK0, hot = frac < 0.3;
  c.fillStyle = "rgba(11,10,15,0.9)"; rr(c, x, y, 430, 210, 16); c.fill();
  c.font = font(26, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.7)"; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("IN STOCK", x + 28, y + 50);
  const b = BUYS.filter(q => q.t <= t).pop(), k = b ? since(t, b.t, 0.08) : 0;
  c.save(); c.translate(x + 28, y + 170); c.scale(1 + k * 0.12, 1 + k * 0.12);
  c.font = font(130); c.fillStyle = hot ? C.red : BONE; c.fillText(String(n), 0, 0); c.restore();
  c.fillStyle = "rgba(244,241,234,0.15)"; c.fillRect(x + 28, y + 186, 374, 8);
  c.fillStyle = hot ? C.red : C.amber; c.fillRect(x + 28, y + 186, 374 * frac, 8);
  if (t >= SOLD_OUT) stamp(c, t, SOLD_OUT, "SOLD OUT", x + 215, y + 150, -0.12, C.red, 82);
}
function stack(c, t) {                                          // answer 2: the purchases, newest on top
  const done = BUYS.filter(b => b.t <= t), newest = done[done.length - 1];
  done.forEach((b, i) => {
    // the newest slides in at the top; the rest step down one slot as it lands
    const age = done.length - 1 - i, slot = age === 0 ? 0 : age - 1 + easeOut((t - newest.t) / 0.1);
    const y = 120 + slot * 116, x = age === 0 ? lerp(1960, 1310, easeOutBack((t - b.t) / 0.14)) : 1310;
    if (y > 1000) return;
    toast(c, x, y, b.j, b.units, clamp(7 - slot));
  });
}
function flood(c, t, a) {                                       // answer 3: the bots everywhere at once
  const ons = a.onsets.filter(o => o.t <= t && t - o.t < 1.6);
  ons.forEach(o => {
    for (let m = 0; m < 5; m++) {
      const j = o.i * 7 + m, t0 = o.t + m * 0.025;
      if (t < t0) continue;
      const pop = easeOutBack((t - t0) / 0.12), fade = clamp(1.6 - (t - t0)) ;
      toast(c, 60 + h32(j, 1311) * 1320, 90 + h32(j, 1312) * 820, j, 3 + Math.floor(h32(j, 1313) * 60), fade, (h32(j, 1314) - 0.5) * 0.35, 0.8 + pop * 0.35);
    }
  });
}

// ---------- the countdowns in the room (the first two; the third is cards) ----------
const DIG = { THREE: "3", TWO: "2", ONE: "1" };
function countdown(t, S, k) {
  const cd = COUNTS[k], nums = [cd.three, cd.two, cd.one].filter(Boolean);
  const said = nums.filter(w => t >= w.t - 0.03), cur = said[said.length - 1];
  const live = k === 0 && t >= cd.one.t - 0.03;                // the first "one": the restock goes live (and the bots come)
  const B = S.type.big, c = anchor(B, 1024, 900, NUM_AT, [0, 0.16, 0]);
  let hit = 0;
  if (cur) {
    hit = since(t, cur.t - 0.03, 0.12);
    const f = font(580), sc = 1 + hit * (0.3 + k * 0.2);
    c.font = f; c.textBaseline = "alphabetic";
    const prev = said[said.length - 2];
    if (prev) {                                                   // the numeral before, a ghost falling away behind
      const g = since(t, cur.t, 0.2);
      c.globalAlpha = 0.012 * g; c.fillStyle = C.white; c.textAlign = "center";
      c.fillText(DIG[prev.w], 1024 + 40 + (1 - g) * 90, 900 + (1 - g) * 60); c.globalAlpha = 1;
    }
    c.save(); c.translate(1024, 700); c.scale(sc, sc); c.translate(-1024, -700);
    if (k === 0) drawDecoded(c, DIG[cur.w], decode(DIG[cur.w], t, cur.t, 0.12, 31 + k), 1024, 900, { color: live ? GREEN : C.white, align: "center" });
    else drawGlitched(c, DIG[cur.w], 1024, 900, f, C.white, 0.12 + hit * 0.8, Math.floor(t * 15) + nums.indexOf(cur) * 7, { align: "center" });
    c.restore();
  }
  B.end();
  const Lb = S.type.label, lc = anchor(Lb, 24, 150, [NUM_AT[0] + 0.3, 1.9, 0.45], [0, 0.16, 0]);
  lc.font = font(58, MONO, "600"); lc.fillStyle = live ? GREEN : k ? C.red : C.amber; lc.textBaseline = "alphabetic";
  lc.fillText(live ? "RESTOCK LIVE." : "RESTOCK IN", 24, 150);
  Lb.end();
  // what Whisper heard, corrected in the margin (the store's voice sings "restock"; Whisper wrote "we're stuck")
  const cw = song.words.filter(w => w.t >= cd.restock.t && w.t <= cd.one.end + 0.01);
  const A = S.type.aux, ac = anchor(A, 60, 300, [NUM_AT[0] + 0.3, -2.5, 0.6], [0, 0.1, 0], 0.9);
  ac.font = font(46, MONO); ac.textBaseline = "alphabetic";
  const heard = cw.map(w => ({ text: (w.w === "RESTOCK" ? "we're stuck" : w.w.toLowerCase()) + (["THREE", "TWO"].includes(w.w) ? ". " : w.w === "ONE" ? "." : " "), t: w.t }));
  drawTyped(ac, heard, t, 60, 300, { color: "rgba(233,228,216,0.8)", cursor: true, lineH: 60 });
  const r = cw[0];
  if (r && t > r.end + 0.08) {
    const wW = ac.measureText("we're stuck").width, e = easeOut((t - r.end - 0.08) / 0.18);
    ac.fillStyle = C.red; ac.fillRect(56, 283, (wW + 8) * e, 6);
    ac.font = font(42, MONO, "600"); ac.fillStyle = C.amber; ac.globalAlpha = e; ac.fillText("restock", 60, 226); ac.globalAlpha = 1;
  }
  A.end();
  return { hit, cur, live };
}

// the product page's fine print under the card: the stock's story in one line
function finePrint(S, t) {
  const pc = anchor(S.type.chart, 40, 120, [CARD[0] - 2.4, CARD[1] - 2.05, 0.2], [0, -0.1, 0], 0.62);
  pc.font = font(40, MONO, "600"); pc.textBaseline = "alphabetic"; pc.fillStyle = "rgba(233,228,216,0.72)";
  pc.fillText("24 GB  ·  $1,199.99", 40, 120);
  const live = t >= COUNTS[0].one.t - 0.03, n = stockAt(t);
  let line = "● OUT OF STOCK · NOTIFY ME", col = "rgba(255,42,61,0.85)";
  if (live && t < BUYS[0].t) { line = "● RESTOCK LIVE · IN STOCK"; col = GREEN; }
  else if (live && t < SOLD_OUT) { line = `● IN STOCK: ${n} LEFT`; col = n / STOCK0 < 0.3 ? C.red : C.amber; }
  else if (live) { line = "● SOLD OUT · NOTIFY ME"; col = C.red; }
  pc.fillStyle = col; pc.fillText(line, 40, 180);
  S.type.chart.end();
}

// ---------- one frame of the room ----------
const ORBIT = [{ th0: -0.55, w: 0.2, d: 11.8, el: 0.17 }, { th0: 0.62, w: -0.34, d: 10.6, el: 0.12 }, { th0: -0.8, w: 0.62, d: 9.4, el: 0.2 }];
function room(t, S) {
  const ph = phaseAt(t), { on, p } = notePulse(t), e = synth.env(t), k = ph.k;
  const look = [CARD[0], CARD[1] - 0.05, CARD[2] - 0.2];
  let out = { ...FILM, grain: 0.085, vignette: 0.7, bloom: 0.9, halation: 0.3, ca: 0.0015 };
  backdrop(S, [1, 0, 0], { grid: 0.35 });
  const hudCol = ph.kind === "answer" && k === 2 ? "rgba(255,61,139,0.75)" : undefined;
  hud(S, t, { left: "OUT OF STOCK · DROP 01/03", right: `QUEUE ${queueAt(t).toLocaleString("en-US")} AHEAD OF YOU`, color: hudCol });
  finePrint(S, t);
  const c = fxLayer(S);

  if (ph.kind === "cold") {
    // the card a shape in the dark, lit a little by the swell; the spinner and the floor barely there; a slow push
    const m = song.env("mix", t), u = t / ANSWERS[0].t0;
    effectorCard(S, t, { scale: 1, rz: -0.05, spot: [0.52, 0.55, lerp(0.25, 0.75, m), 1], inkGain: 0.9 + m * 0.6, pump: 0 });
    ring(S, t, { radii: RING_SMALL, minL: 0.06, maxL: 0.5, gain: 1.2, alpha: clamp((t - 0.3) / 1.5) * 0.5, spin: -t * 2 * Math.PI * 0.9 });
    floor(S, t, 0.2 * clamp(t / 1.8), 0);
    camera(S, [lerp(0.9, 0.35, ease(u)), lerp(1.3, 0.8, ease(u)), lerp(17, 13.4, ease(u))], look, 0, 35);
    coldFx(c, t);
    out = { ...out, bloom: 0.8, vignette: 0.8 };
  } else if (ph.kind === "answer") {
    const a = ANSWERS[k], u = t - a.t0, O = ORBIT[k], slamIn = easeOut(u / 0.35), aura = [0.35, 0.65, 1][k];
    // the camera flies: a crash in on the first note, then an orbit round the card, jolted on every note
    const th = O.th0 + O.w * u, el = O.el + 0.05 * Math.sin(u * 1.3), d = O.d + 5 * (1 - slamIn);
    const jolt = on ? p * 0.1 * aura : 0, jx = on ? (h32(on.i, 1401) - 0.5) * jolt : 0, jy = on ? (h32(on.i, 1402) - 0.5) * jolt : 0;
    camera(S, [look[0] + Math.sin(th) * Math.cos(el) * d + jx, look[1] + Math.sin(el) * d + 0.3 + jy, look[2] + Math.cos(th) * Math.cos(el) * d], look,
      k === 2 ? 0.09 * Math.sin(u * 2.3) : 0.02 * Math.sin(u), 35 + (1 - slamIn) * 9 - p * 3 * aura);
    // the card, the reference's card effect: scale, turn, colour flicker, RGB split in depth
    const flick = on && p > 0.55 && h32(on.i, 1102) < 0.25 + 0.35 * aura;
    effectorCard(S, t, {
      scale: 1 + 0.05 * e + 0.08 * p * aura, rz: -0.05 + 0.04 * Math.sin(t * 1.7) * e + (on ? (h32(on.i, 1101) - 0.5) * 0.09 * p : 0),
      ry: 0.08 * Math.sin(t * 0.9) * aura, ink: flick ? FLICKER[Math.floor(h32(on.i, 1103) * 3)] : undefined,
      pump: 0.25 * p + 0.12 * e, shift: (0.03 + 0.14 * p + 0.05 * e) * (0.5 + aura), dir: on ? h32(on.i, 1104) * Math.PI * 2 : 0,
    });
    // the ring: the synth's spectrum, opening out from the spinner on the first note
    const open = easeOutBack(u / 0.3), radii = [lerp(RING_SMALL[0], RING_BIG[0], open), lerp(RING_SMALL[1], RING_BIG[1], open)];
    ring(S, t, { radii, bands: synth.bandsAt(t, BUF), minL: 0.05, maxL: [0.9, 1.3, 1.75][k], gain: [1.3, 1.8, 2.2][k], alpha: 1, fill: 0.08 + 0.08 * k,
      colB: k === 2 ? 0xff2a3d : 0xff3d8b });
    floor(S, t, [0.55, 0.9, 1.4][k], p * aura);
    sparks(S, t, k, k === 2 ? 0xff3d8b : 0x5ef2ff);
    if (k === 0) notifyFx(c, t, a);
    if (k === 1) { stockPanel(c, t); stack(c, t); }
    if (k === 2) {
      stockPanel(c, t); flood(c, t, a);
      backdrop(S, [0.55, 0.45, 0], { grid: 0.35, haze: 0.55 });
      const su = S.speed.material.uniforms;                      // manga focus lines, re-dealt per note
      S.speed.visible = true; su.center.value.set(0.5, 0.5); su.inner.value = 0.22; su.count.value = 200; su.alpha.value = 0.22 + p * 0.3;
      su.gain.value = 1.2; su.seed.value = on ? on.i : 0; su.color.value.set(0xff3d8b);
    }
    const slam = since(t, a.t0, 0.12);
    out = { ...out, bloom: 0.9 + 0.15 * k, halation: 0.3 + 0.12 * k, ca: 0.0015 + p * 0.004 * (1 + k) + slam * 0.012,
      glitch: p * 0.07 * k + slam * 0.35, flash: slam * (0.45 + 0.1 * k), invert: k === 2 && u < 2 / 30 ? 1 : 0, grain: 0.085 + 0.02 * k };
  } else {
    // a countdown: the store's voice. A hard cut to the front: the card on the right, the numeral left; the ring
    // shrinks to a loading spinner that bursts on each numeral; the camera punches in on each one
    const cd = COUNTS[k], R = countdown(t, S, k), hit = R.hit, prog = clamp((t - cd.restock.t) / (cd.one.end - cd.restock.t));
    const rs = since(t, cd.restock.t, 0.1);
    effectorCard(S, t, { scale: 1 + hit * 0.04, rz: -0.05 + (R.cur ? (h32(R.cur.t * 100, 1501) - 0.5) * 0.05 * hit : 0), pump: hit * 0.25,
      ink: R.live && t < ANSWERS[1].t0 ? 0x19db73 : undefined, shift: hit * 0.12 * (1 + k), dir: R.cur ? h32(R.cur.t * 100, 1502) * 6.28 : 0 });
    ring(S, t, { radii: RING_SMALL, minL: 0.06, maxL: 0.9, gain: 1.4 + hit, alpha: 0.85, spin: -t * 2 * Math.PI * (1.1 + 0.4 * k), burst: hit, burstSeed: R.cur ? Math.round(R.cur.t * 100) : 0 });
    floor(S, t, 0.35, hit * 0.8);
    const sh = hit * 0.07 * (1 + k), fr = Math.floor(t * 30), roll = k === 1 && R.cur ? (R.cur.w === "TWO" ? -0.05 : 0.05) * (0.4 + hit) : 0;
    camera(S, [-1.8 + Math.sin(t * 0.5) * 0.05 + (h32(fr, 31) - 0.5) * sh, 0.2 + (h32(fr, 32) - 0.5) * sh, lerp(10.8, 9.7, ease(prog))],
      [-1.85, 0, 0.4], roll, 35 - hit * (4 + 3 * k));
    out = { ...out, flash: hit * 0.3 * (1 + 0.4 * k) + rs * 0.25, ca: 0.0015 + hit * 0.006 * (1 + k), glitch: hit * 0.2 * (1 + k) + rs * 0.35 };
  }
  S.introFx.end();
  return out;
}

// ---------- the shot ----------
export function introShot(t, S) {
  if (introCardAt(PLAN, t)) {
    S.hud.mesh.visible = false;                                   // the cards carry their own furniture
    return { ...FILM, bloom: 0.25, bloomThreshold: 1.05, halation: 0.04, grain: 0.06, vignette: 0.2, weave: 0.35, ...fastCut(t, S, PLAN) };
  }
  return room(t, S);
}
// every distinct look, for the warm-up (director.warmTimes) and the cards' first draws (main.js via fastWarm)
export function introTimes() {
  const ts = [0.5, 1.6];
  ANSWERS.forEach(a => ts.push(a.t0 + 0.02, a.t0 + 0.4, (a.t0 + a.t1) / 2, ...a.onsets.slice(0, 3).map(o => o.t + 0.02)));
  COUNTS.forEach(cd => ts.push(cd.restock.t + 0.05, cd.three.t + 0.02, cd.two.t + 0.02, cd.one.t + 0.02, cd.one.end + 0.1));
  return ts.filter(t => t < END);
}
export const introCardTimes = () => fastTimes(PLAN);
