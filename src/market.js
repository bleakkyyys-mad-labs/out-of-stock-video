// Verse 2, steps 12-19: "what the market rewards". The creator's notes (9/27 02:33): a test viewer found it "too calm"; "I really like the
// graph and it has to keep growing ... something that will just keep their attention glued while the other elements
// are also fighting for the viewer's attention too"; "same thing you did in verse one". The creator's pick at 03:09 ("let's go
// try A"): the chart grows on screen with the price.
// THE CHART NEVER CUTS. Everything else cuts at verse 1's pace (the fast cut's cards, fastcut.js); the chart is the one
// thing that survives every cut, the gameplay footage under the brainrot.
//   steps 12-13    the cards own the frame; the chart is a small live ticker in the corner, growing with the price
//   "Enterprise"   the price hits the ticker's ceiling: the chart takes the whole frame, the cards come back as a window
//   the jacket     the kick drops out ("Also, thanks for the jacket!"): the chart holds; it gaps up when the kick returns
//   "triple"       one candle, three times the price
//   "the racket"   the kick stops for 2.4 s: TRADING HALTED, the verse's one breather; it reopens on "just buy last gen"
//   16-18          the cards jump from corner to corner; the candles go to eighths at 17; LAST GEN and RAM join the chart
//   19             the cards pile up as stickers, the candles go to sixteenths; "read it quick": the line leaves the frame
// The chart: one candle per kick (it freezes when the kick stops), and no autoscale: when a candle hits the ceiling the
// axis gives up, zooms out tenfold, and everything before flattens along the bottom. A pure function of song time.
import { C, font, MONO, DISPLAY } from "./type.js";
import * as song from "./song.js";
import { tile, makeScreenPrint, level } from "./print.js";
import { kit, fastPlan, fastLayer, cardFrame, fastTimes, LEAD, SERIF } from "./fastcut.js";
import { toast, HANDLES, botGlyph } from "./intro.js";

const { h32 } = song;
const { P, INK, BONE, W, H, BLEED, rr, disp, caption, subtitle, stamp, printAt, silhouette, burst, slam, tag, confetti, botFace, phone } = kit;
const GREEN = "#19db73", RED = C.red, AMBER = C.amber, CYAN = C.cyan, NIGHT = "#0b0a0f";
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
export const START_PRICE = 1199.99;                                 // the flagship's price everywhere else in the video

// ---------- money ----------
export const money = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(v >= 1e10 ? 1 : 2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + "M"
  : v >= 1e4 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const axisMoney = v => v >= 1e9 ? "$" + +(v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + +(v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + +(v / 1e3).toFixed(1) + "K" : "$" + Math.round(v);
export const gainText = v => { const g = (v / START_PRICE - 1) * 100; return (g >= 0 ? "+" : "") + g.toLocaleString("en-US", { maximumFractionDigits: g < 100 ? 1 : 0, minimumFractionDigits: g < 100 ? 1 : 0 }) + "%"; };

// =====================================================================================================================
// the chart's model: candle slots from the kicks, the events where the axis gives up, the prices
// =====================================================================================================================
export const LV = [{ lo: 1000, hi: 2000 }, { lo: 0, hi: 2e4 }, { lo: 0, hi: 2e5 }, { lo: 0, hi: 2e6 }, { lo: 0, hi: 2e7 }, { lo: 0, hi: 2e8 }, { lo: 0, hi: 2e9 }];
const TARGET = [1850, 7000, 66000, 2.6e5, 1.6e7, 1.6e8, 1.5e9];   // where each stretch between two events climbs to
const SIG = [0.035, 0.06, 0.05, 0.03, 0.04, 0.035, 0.03];          // and how hard it shakes on the way
const ZOOM = 0.3, HIST = 26, NMIN = 38;

export function buildModel(plan) {
  const w = (n, spec) => { const x = plan.find(n, spec); if (!x) throw new Error(`market: step ${n} never sings ${spec}`); return x; };
  const kickFrom = t => song.kicks.find(k => k >= t - 1e-6);
  const M = {
    T0: plan.t0, END: plan.t1,
    HALT0: w(15, "THAT'S").t - LEAD, REOPEN: kickFrom(w(16, "STEP").t),
    R17: w(17, "STEP").t, R19: w(19, "STEP").t, LAUNCH: w(19, "READ").t - LEAD,
    SCRAMBLE: w(19, "EVERY").t, FLOOD0: w(19, "SO").t - LEAD, STRIKE: w(19, "ALREADY").t - LEAD, WRONG: w(19, "WRONG").t,
    BREAK: song.kicks.filter(k => k < w(19, "READ").t).pop() + 0.02,
    lastGen: w(17, "LAST#1").t, ram: w(17, "RAM").t,
    FC0: w(18, "ASK").t - LEAD, FC1: w(19, "STEP").t - LEAD,
    years: [{ label: "2027", t: w(18, "ASK").t + 0.3 }, { label: "2028", t: w(18, "EIGHT").t }, { label: "2029", t: w(18, "OTHER").t },
      { label: "2030", t: w(18, "THIRTY").t }, { label: "NEVER", t: w(18, "PICK").end - 0.08, hot: true }],
  };
  // the events: where a candle hits the ceiling and the axis gives up (the jacket's and the racket's are gaps: the
  // kick comes back and the price opens far above where it stopped)
  const EV = [
    { te: w(14, "ENTERPRISE").t - LEAD },                 // the takeover
    { te: kickFrom(w(14, "JACKET").t), gap: 9000 },       // the kick returns after the jacket
    { te: w(15, "TRIPLE").t - LEAD },                     // one candle, x3
    { te: M.REOPEN, gap: 6.5e5 },                          // the market reopens
    { te: w(17, "UP").t - LEAD },                         // "last gen's price went UP too"
    { te: w(18, "PAST").t - LEAD },                       // "past twenty-thirty"
  ];
  // one candle per kick, a kick's beat split in two from step 17 and in four from step 19; after a kick with a gap
  // behind it the candle takes one beat and the chart waits. Nothing forms during the halt
  const ks = song.kicks.filter(k => k >= M.T0 && k < M.LAUNCH && !(k >= M.HALT0 - 1e-6 && k < M.REOPEN - 1e-6));
  const slots = [];
  for (const k of ks) {
    const next = song.kicks.find(x => x > k + 0.05) ?? k + song.BEAT;
    let len = Math.min(next - k, song.BEAT);
    if (k < M.HALT0 && k + len > M.HALT0) len = M.HALT0 - k;
    const div = k >= M.R19 - 0.06 ? 4 : k >= M.R17 - 0.06 ? 2 : 1;
    for (let j = 0; j < div; j++) slots.push({ a: k + len * j / div, b: k + len * (j + 1) / div, kick: j === 0 });
  }
  EV.forEach((e, k) => {
    let si = slots.findIndex(s => e.te >= s.a - 1e-6 && e.te < s.b);
    if (si < 0) si = slots.findIndex(s => s.a >= e.te - 1e-6);
    const s = slots[si];
    e.si = si;
    e.te = e.gap || e.te - s.a < 0.05 ? s.a + 0.07 : e.te;     // the event candle is complete here, and the axis gives up
    s.b = e.te; s.event = k;
  });
  // the candles: the history before the verse (the old normal, flat), then every slot's. Each stretch between two
  // events climbs exponentially to its target with noise; an event's candle closes on the ceiling with its wick
  // through it; a gap event's candle opens above the last close
  const cand = [];
  for (let j = 0; j < HIST; j++) {
    const c = j === HIST - 1 ? START_PRICE : 1070 * Math.pow(START_PRICE / 1070, j / (HIST - 1)) * Math.exp((h32(j, 3310) - 0.5) * 0.05);
    const o = j ? cand[j - 1].c : 1062;
    cand.push({ o, c, hi: Math.max(o, c) * (1 + 0.004 + h32(j, 3311) * 0.014), lo: Math.min(o, c) * (1 - 0.004 - h32(j, 3312) * 0.014), v: 0.12 + h32(j, 3313) * 0.25, a: -1, b: -1 });
  }
  const mk = (o, c, si) => { const s = slots[si]; return { o, c, hi: Math.max(o, c) * (1 + 0.006 + h32(si, 3302) * 0.022), lo: Math.min(o, c) * (1 - 0.006 - h32(si, 3303) * 0.022),
    v: clamp(song.env("mix", s.a) * (s.kick ? 1 : 0.62) + 0.06), a: s.a, b: s.b, kick: s.kick, event: s.event }; };
  let prev = START_PRICE;
  for (let k = 0; k <= EV.length; k++) {
    const from = k === 0 ? 0 : EV[k - 1].si + 1, to = k < EV.length ? EV[k].si : slots.length, n = to - from, p0 = prev;
    for (let j = 0; j < n; j++) {
      const si = from + j, base = p0 * Math.pow(TARGET[k] / p0, (j + 1) / n);
      const c = j === n - 1 ? TARGET[k] : base * Math.exp((h32(si, 3301) - 0.5) * 2 * SIG[k]);
      cand.push(mk(prev, c, si)); prev = c;
    }
    if (k < EV.length) { const c = LV[k].hi, e = mk(EV[k].gap ?? prev, c, EV[k].si); e.hi = c * 1.045; cand.push(e); prev = c; }
  }
  Object.assign(M, { EV, slots, cand, TK0: EV[0].te, TK1: EV[0].te + 0.18 });
  // LAST GEN and RAM: lines that climb beside the flagship from step 17 on, revealed on their words (with a stretch of
  // history, so they read as lines and not as dots)
  M.birth = t => HIST + slots.findIndex(s => s.a >= t - 0.3);
  M.lines = [
    { name: "LAST GEN", col: AMBER, t: M.lastGen, from: M.birth(M.lastGen) - 12, f: u => 0.3 + 0.36 * u, seed: 3321 },
    { name: "RAM", col: CYAN, t: M.ram, from: M.birth(M.ram) - 12, f: u => 0.13 + 0.3 * u, seed: 3331 },
  ];
  return M;
}

// the chart at time t: how many candles exist, the one forming, the axis
export function chartState(M, t) {
  const { cand } = M;
  let n = HIST, form = null;
  for (let i = HIST; i < cand.length; i++) {
    const q = cand[i];
    if (t >= q.b) { n = i + 1; continue; }
    if (t >= q.a) { form = { i, u: ease((t - q.a) / (q.b - q.a)) }; n = i + 1; }
    break;
  }
  // the forming candle's live values (log space: a price climbs by factors)
  const live = i => {
    const q = cand[i];
    if (!form || form.i !== i) return q;
    const u = form.u, cl = Math.exp(lerp(Math.log(q.o), Math.log(q.c), u));
    return { ...q, c: cl, hi: Math.max(q.o, cl, Math.exp(lerp(Math.log(q.o), Math.log(q.hi), u))), lo: Math.min(q.o, cl, Math.exp(lerp(Math.log(q.o), Math.log(q.lo), u))), v: q.v * u };
  };
  // the axis: the level of the last event reached, easing out of the one before it
  let k = 0; while (k < M.EV.length && t >= M.EV[k].te) k++;
  let lo = LV[k].lo, hi = LV[k].hi;
  if (k > 0 && t - M.EV[k - 1].te < ZOOM) {
    const u = easeOut((t - M.EV[k - 1].te) / ZOOM);
    hi = Math.exp(lerp(Math.log(LV[k - 1].hi), Math.log(LV[k].hi), u)); lo = lerp(LV[k - 1].lo, LV[k].lo, u);
  }
  const nEff = n - (form ? 1 - form.u : 0);
  const newest = live(n - 1);
  return { n, form, live, lo, hi, k, nEff, price: newest.c, newest };
}

// =====================================================================================================================
// drawing the chart into a rectangle R (the corner ticker, then the whole frame)
// =====================================================================================================================
function geom(M, t, R) {
  const u = clamp((R.w / W - 0.28) / 0.72), fs = lerp(0.5, 1, u);
  const top = R.y + lerp(46, 120, u), right = R.x + R.w - lerp(104, 200, u), left = R.x + lerp(12, 60, u);
  const volH = lerp(34, 90, u), bot = R.y + R.h - volH - lerp(14, 76, u);
  // step 18: the candles give up a third of the width to the forecast (the time axis running out)
  const fc = t < M.FC0 ? 0 : t < M.FC1 ? ease((t - M.FC0) / 0.3) : 1 - ease((t - M.FC1) / 0.25);
  const cRight = lerp(right, left + (right - left) * 0.62, fc);
  return { u, fs, top, bot, left, right, cRight, fc, volTop: bot + lerp(8, 12, u), volH };
}
// the chart's camera (the whole frame, from the takeover on): it pushes in on the newest candle as the price climbs
// toward the ceiling, jolts on the kick, and falls back out as the axis gives up (the price drops to a tenth of it)
function chartCam(c, t, M, st, G) {
  if (G.u < 0.5) return;
  const p = clamp((st.price - st.lo) / (st.hi - st.lo)), k = song.kickEnv(t, 0.1), kk = song.lastKick(t);
  const px = xOf(G, st, st.n - 1), py = clamp(yOf(G, st, st.price), G.top, G.bot);
  const z = 1 + 0.2 * Math.pow(p, 1.5) + k * 0.03, r = kk ? (h32(kk.i, 3351) - 0.5) * 0.02 * k : 0;
  c.translate(px, py); c.rotate(r); c.scale(z, z); c.translate(-px, -py);
}
function xOf(G, st, i) { const cw = (G.cRight - G.left) / Math.max(NMIN, st.nEff + 1.5); return G.left + (i + 0.5) * cw; }
function cwOf(G, st) { return (G.cRight - G.left) / Math.max(NMIN, st.nEff + 1.5); }
const yOf = (G, st, v) => G.bot - (v - st.lo) / (st.hi - st.lo) * (G.bot - G.top);

function drawChart(c, t, M, st, R, o = {}) {
  const G = geom(M, t, R), k = song.kickEnv(t, 0.12), fs = G.fs;
  c.save();
  c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
  c.fillStyle = NIGHT; c.fillRect(R.x, R.y, R.w, R.h);
  c.save(); chartCam(c, t, M, st, G);
  // the grid, a breath brighter on the kick
  c.fillStyle = `rgba(233,228,216,${0.05 + k * 0.05})`;
  for (let x = R.x + 40 * fs; x < R.x + R.w; x += 80 * fs) c.fillRect(x, G.top, 1.5, G.bot - G.top);
  for (let g = 0; g <= 4; g++) {
    const v = st.lo + (st.hi - st.lo) * g / 4, y = yOf(G, st, v);
    c.fillStyle = `rgba(233,228,216,${0.1 + k * 0.05})`; c.fillRect(G.left, y, G.right - G.left, 2);
    c.font = font(Math.round(24 * fs), MONO, "600"); c.fillStyle = "rgba(233,228,216,0.6)"; c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText(axisMoney(v), G.right + 12 * fs, y);
  }
  c.restore();
  // the title and the live light
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  const iv = t >= M.R19 - 0.06 ? "1/4 KICK" : t >= M.R17 - 0.06 ? "1/2 KICK" : "1 KICK";
  if (G.u < 0.5) {
    c.font = font(Math.round(22 * fs * 1.6), MONO, "600"); c.fillStyle = BONE; c.fillText("FLAGSHIP 24 GB", R.x + 16, R.y + 32);
    c.fillStyle = RED; c.textAlign = "right"; c.fillText("LIVE", R.x + R.w - 16, R.y + 32);
    if (Math.floor(t * 2) % 2 === 0) { c.beginPath(); c.arc(R.x + R.w - 16 - c.measureText("LIVE").width - 16, R.y + 24, 7, 0, 7); c.fill(); }
  } else {
    c.font = font(26, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.85)"; c.textAlign = "center";
    c.fillText(`FLAGSHIP 24 GB  ·  PRICE, USD  ·  1 CANDLE = ${iv}`, R.x + R.w * 0.5, R.y + 72);
  }
  // the area under the closes, the candles, the volume
  c.save(); chartCam(c, t, M, st, G);
  const cw = cwOf(G, st), bw = Math.max(2, cw * 0.62), n = st.n, edgeI = n - 1;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([xOf(G, st, i), yOf(G, st, st.live(i).c)]);
  const gr = c.createLinearGradient(0, G.top, 0, G.bot);
  gr.addColorStop(0, "rgba(25,219,115,0.32)"); gr.addColorStop(1, "rgba(25,219,115,0.02)");
  c.fillStyle = gr; c.beginPath(); c.moveTo(pts[0][0], G.bot); pts.forEach(p => c.lineTo(p[0], Math.max(G.top - 400, p[1]))); c.lineTo(pts[n - 1][0], G.bot); c.closePath(); c.fill();
  for (let i = 0; i < edgeI; i++) candleAt(c, G, st, i, bw, 0, fs);
  for (let i = 0; i < n; i++) {
    const q = st.live(i), x = xOf(G, st, i), hv = q.v * G.volH;
    c.fillStyle = q.c >= q.o ? "rgba(25,219,115,0.4)" : "rgba(255,42,61,0.4)"; c.fillRect(x - bw / 2, G.volTop + G.volH - hv, bw, hv);
  }
  extraLines(c, t, M, st, G);
  forecast(c, t, M, st, G);
  c.restore();
  // the events: the stamp on the ceiling it just broke
  const e = M.EV.filter(x => t >= x.te).pop();
  if (e && t - e.te < 0.95 && !(e === M.EV[0] && t < M.TK1)) stampAt(c, t, e.te, "NEW ALL-TIME HIGH", G.u > 0.5 ? 1470 : lerp(G.left, G.right, 0.66), G.top + 120 * fs, -0.07, GREEN, Math.round(64 * fs));
  if (o.edge !== false) edge(c, t, M, st, G);
  c.restore();
  return G;
}
function candleAt(c, G, st, i, bw, glow, fs) {
  const q = st.live(i), x = xOf(G, st, i), up = q.c >= q.o, col = up ? GREEN : RED;
  const yh = yOf(G, st, q.hi), yl = yOf(G, st, q.lo), yo = yOf(G, st, q.o), yc = yOf(G, st, q.c);
  c.fillStyle = col;
  c.fillRect(x - Math.max(1, 1.5 * fs), yh, Math.max(2, 3 * fs), Math.max(2, yl - yh));
  c.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(2, Math.abs(yo - yc)));
  if (glow > 0) { c.globalAlpha = glow * 0.45; c.fillRect(x - bw, Math.min(yo, yc) - 8, bw * 2, Math.abs(yo - yc) + 16); c.globalAlpha = 1; }
}
// the live edge: the newest candle, its price line and tag, the running gain. Drawn over the cards (it punches through)
function edge(c, t, M, st, G) {
  const fs = G.fs, n = st.n, i = n - 1, q = st.live(i), k = song.kickEnv(t, 0.1), cw = cwOf(G, st), bw = Math.max(2, cw * 0.62);
  c.save(); chartCam(c, t, M, st, G);
  let yTop = yOf(G, st, q.c);
  const launch = t >= M.LAUNCH ? Math.pow(clamp((t - M.LAUNCH) / (M.END - M.LAUNCH)), 2) : 0;
  if (launch > 0) {                                        // "read it quick": the line goes straight up and out
    const x = xOf(G, st, i), yb = yOf(G, st, q.o), top = yb - (yb - G.top + 1400) * launch;
    const bm = 14 + 40 * launch;
    c.fillStyle = GREEN; c.globalAlpha = 0.25; c.fillRect(x - bm * 3, top, bm * 6, yb - top);
    c.globalAlpha = 0.5; c.fillRect(x - bm * 1.6, top, bm * 3.2, yb - top); c.globalAlpha = 1;
    c.fillRect(x - bm / 2, top, bm, yb - top); c.fillStyle = BONE; c.fillRect(x - bm * 0.15, top, bm * 0.3, yb - top);
    yTop = top;
  } else candleAt(c, G, st, i, bw, k + since(t, q.a, 0.12), fs);
  const x = xOf(G, st, i), fl = q.kick && t - q.a < 0.1 ? since(t, q.a, 0.05) * 14 * fs : 0;   // the wick flicks up on the kick
  if (fl > 0) { c.fillStyle = GREEN; c.fillRect(x - 1.5 * fs, yOf(G, st, q.hi) - fl, 3 * fs, fl); }
  // the price line and tag
  const ly = Math.max(yTop, -200), label = priceLabel(M, t, st.price, launch);
  c.setLineDash([14 * fs, 10 * fs]); c.strokeStyle = GREEN; c.lineWidth = 2; c.beginPath(); c.moveTo(G.left, ly); c.lineTo(G.right, ly); c.stroke(); c.setLineDash([]);
  c.font = font(Math.round(30 * fs), MONO, "600");
  const tw = c.measureText(label).width + 28 * fs, th = 50 * fs, tx = Math.min(G.right + 6 * fs, G.right + 190 * fs - tw);
  c.fillStyle = GREEN; rr(c, tx, ly - th / 2, tw, th, 8 * fs); c.fill();
  c.fillStyle = NIGHT; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(label, tx + 14 * fs, ly + 2 * fs);
  c.restore();
  // the running gain, big, riding the price (clear of the ceiling)
  if (G.u > 0.5 && !(t >= M.HALT0 && t < M.REOPEN)) {
    const gl = launch > 0.3 ? "+NaN%" : gainText(st.price), gy = G.bot - 26;
    c.font = font(96, DISPLAY); c.textAlign = "right"; c.textBaseline = "alphabetic";
    const gw = c.measureText(gl).width, s = 1 + since(t, q.a, 0.08) * 0.06;
    c.save(); c.translate(G.right - 20, gy); c.scale(s, s);
    c.fillStyle = NIGHT; c.fillText(gl, 6, 6); c.fillStyle = GREEN; c.fillText(gl, 0, 0);
    c.beginPath(); c.moveTo(-gw - 64, -20); c.lineTo(-gw - 20, -20); c.lineTo(-gw - 42, -62); c.closePath(); c.fill();
    c.restore();
  }
}
// step 19 on "every number in it is already wrong": the tag stops making sense; "read it quick": NaN
function priceLabel(M, t, price, launch) {
  if (launch > 0.3) return "$NaN";
  if (t >= M.SCRAMBLE) { const f = Math.floor(t * 15), d = 4 + Math.floor(h32(f, 3341) * 6); let s = ""; for (let j = 0; j < d; j++) s += Math.floor(h32(f, j, 3342) * 10); return "$" + Number(s).toLocaleString("en-US"); }
  return money(price);
}
function stampAt(c, t, t0, label, x, y, rot, col, size) {
  const e = t - t0, s = lerp(2.2, 1, easeOut(e / 0.09));
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = clamp(e / 0.04 + 0.35) * clamp((0.95 - e) / 0.2);
  c.font = font(size); c.textAlign = "center"; c.textBaseline = "alphabetic";
  const tw = c.measureText(label).width, bw = tw + size * 0.55, bh = size * 1.08;
  c.strokeStyle = col; c.lineWidth = size * 0.085; rr(c, -bw / 2, -bh * 0.72, bw, bh, size * 0.12); c.stroke();
  c.fillStyle = col; c.fillText(label, 0, size * 0.17);
  c.restore();
}
function extraLines(c, t, M, st, G) {
  const fs = G.fs, n = st.n;
  for (const L of M.lines) {
    if (t < L.t - 0.04) continue;
    const reveal = easeOut((t - L.t + 0.04) / 0.28), i0 = Math.max(0, L.from), span = Math.max(1, n - 1 - i0);
    const iEnd = Math.floor(lerp(i0, n - 1, reveal)), val = i => st.live(i).c * L.f((i - i0) / Math.max(1, M.cand.length - i0)) * Math.exp((h32(i, L.seed) - 0.5) * 0.08);
    if (iEnd <= i0 && span > 0) continue;
    c.strokeStyle = L.col; c.lineWidth = Math.max(3, 6 * fs); c.lineJoin = "round"; c.beginPath();
    for (let i = i0; i <= iEnd; i++) { const x = xOf(G, st, i), y = yOf(G, st, val(i)); i === i0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    const hx = xOf(G, st, iEnd), hy = yOf(G, st, val(iEnd));
    c.fillStyle = L.col; c.beginPath(); c.arc(hx, hy, 9 * fs, 0, 7); c.fill();
    c.font = font(Math.round(30 * fs), MONO, "600"); c.textAlign = "right"; c.textBaseline = "middle";
    const lw = c.measureText(L.name).width;
    c.fillStyle = NIGHT; c.fillRect(hx - lw - 30 * fs, hy - 38 * fs, lw + 16 * fs, 32 * fs);
    c.fillStyle = L.col; c.fillText(L.name, hx - 22 * fs, hy - 22 * fs);
  }
}
// step 18: past the last candle the chart runs into the forecast: a dotted climb, and the years sung along the axis
function forecast(c, t, M, st, G) {
  if (G.fc <= 0.01) return;
  const fs = G.fs, x0 = G.cRight + 20 * fs, x1 = G.right - 10 * fs, y0 = yOf(G, st, st.price);
  c.save(); c.globalAlpha = G.fc;
  c.fillStyle = "rgba(233,228,216,0.06)"; c.fillRect(x0, G.top, x1 - x0, G.bot - G.top);
  const at = u => [lerp(G.cRight, x1, u), y0 - (y0 - G.top + 260) * Math.pow(u, 2.6)];
  c.strokeStyle = GREEN; c.lineWidth = 5 * fs; c.setLineDash([10 * fs, 12 * fs]); c.lineDashOffset = -t * 60; c.beginPath();
  for (let j = 0; j <= 30; j++) { const [x, y] = at(j / 30); j ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke(); c.setLineDash([]);
  c.font = font(Math.round(26 * fs), MONO, "600"); c.fillStyle = "rgba(244,241,234,0.8)"; c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillText("FORECAST", x0 + 12, G.top + 40 * fs);
  M.years.forEach((yv, j) => {
    if (t < yv.t - 0.03) return;
    const u = 0.22 + 0.17 * j, [x, y] = at(u), s = since(t, yv.t - 0.03, 0.07);
    c.fillStyle = yv.hot ? RED : BONE; c.beginPath(); c.arc(x, y, 12 * fs, 0, 7); c.fill();
    c.save(); c.translate(x + 26 * fs, Math.max(G.top + 70, y + 18 * fs)); c.scale(1 + s * 0.5, 1 + s * 0.5);
    c.font = font(Math.round((yv.hot ? 64 : 46) * fs)); c.textAlign = "left"; c.fillStyle = NIGHT; c.fillText(yv.label, 4, 4); c.fillStyle = yv.hot ? RED : BONE; c.fillText(yv.label, 0, 0);
    c.restore();
  });
  c.restore();
}

// =====================================================================================================================
// the layout: the corner ticker, the takeover, the windows, the halt, the stickers
// =====================================================================================================================
const FULL = { x: 0, y: 0, w: W, h: H };
function pipRect(price) {
  const f = clamp((price - START_PRICE) / (LV[0].hi - START_PRICE)), w = lerp(540, 720, f), h = w * 0.6;
  return { x: W - 44 - w, y: H - 46 - 22 - h, w, h };
}
const lerpRect = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });
// window places (the card's top left at scale s): never over the chart's right quarter, where the price is
const WIN2 = [{ x: 34, y: 100 }, { x: 34, y: 360 }];
const WIN3 = [{ x: 34, y: 100 }, { x: 34, y: 364 }, { x: 240, y: 230 }, { x: 130, y: 160 }];
const FROM = [[-1, 0], [1, 0], [0, -1], [0, 1]];
function layout(plan, M) {
  const cards = plan.cards;
  cards.forEach((cd, j) => {
    const hk = cd.i;
    if (cd.t0 < M.TK0 - 1e-6) { cd.mode = "full"; return; }
    if (cd.halt) { cd.mode = "halt"; return; }
    if (cd.t0 < M.HALT0 - 1e-6) {
      const prev = cards[j - 1], p = cd.t0 < M.TK0 + 1e-3 || !prev?.win ? WIN2[0] : WIN2[(WIN2.findIndex(q => q.y === prev.win.y) + 1) % WIN2.length];
      cd.mode = "win"; cd.win = { ...p, s: 0.62, rot: (h32(hk, 2202) - 0.5) * 0.04, slamT: Math.max(cd.t0, M.TK1), from: cd.t0 < M.TK0 + 1e-3 ? null : FROM[Math.floor(h32(hk, 2205) * 4)] };
      return;
    }
    if (cd.t0 < M.R19 - 0.2) {
      const slots = cd.t0 >= M.FC0 - 0.05 && cd.t0 < M.FC1 ? WIN3.filter(q => q.x === 34) : WIN3;   // (step 18: clear of the forecast)
      let p = slots[Math.floor(h32(hk, 2203) * slots.length)];
      const prev = cards[j - 1];
      if (prev && prev.win && prev.win.x === p.x && prev.win.y === p.y) p = slots[(slots.indexOf(p) + 1) % slots.length];   // it always jumps
      const fc = slots !== WIN3;
      cd.mode = "win"; cd.win = { x: p.x, y: fc ? Math.min(p.y, 1080 - 56 - 605) : p.y, s: fc ? 0.56 : 0.62, rot: (h32(hk, 2204) - 0.5) * 0.05, slamT: cd.t0, from: FROM[Math.floor(h32(hk, 2205) * 4)] };
      return;
    }
    cd.mode = "sticker";
    cd.win = cd.big ? { x: 250, y: 170, s: 0.6, rot: -0.03, slamT: cd.t0, border: 16, slap: true }
      : { x: 30 + h32(hk, 2211) * 420, y: 100 + h32(hk, 2212) * 330, s: 0.52, rot: (h32(hk, 2213) - 0.5) * 0.17, slamT: cd.t0, border: 16, slap: true };
  });
}
function drawWin(c, t, card, F, win, frozen) {
  const s = win.s, w = W * s, h = H * s, b = win.border ?? 10, u = frozen ? 1 : clamp((t - win.slamT) / 0.1);
  // a window flies in from its side; a sticker is slapped down from above the glass, turning as it lands
  const pop = frozen ? 1 : win.slap ? lerp(1.35, 1, easeOut(u)) : 1 + 0.1 * since(t, win.slamT, 0.07);
  const off = !frozen && win.from ? (1 - easeOut(u)) * 1150 : 0, rot = win.rot + (win.slap && !frozen ? (1 - easeOut(u)) * 0.3 : 0);
  c.save(); c.translate(win.x + w / 2 + (win.from ? win.from[0] * off : 0), win.y + h / 2 + (win.from ? win.from[1] * off : 0)); c.rotate(rot); c.scale(pop, pop);
  c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(-w / 2 + 16, -h / 2 + 22, w + b, h + b);
  c.fillStyle = BONE; c.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b);
  c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.clip();
  c.translate(-w / 2, -h / 2); c.scale(s, s);
  const fx = cardFrame(c, t, card, F, s * pop);
  c.restore();
  return fx;
}

// ---------- the furniture over every frame: the step tag, the countdown to the drop, the market's ticker ----------
export const TICK = [{ name: "FLAGSHIP 24GB", live: true, dir: 1 }, { name: "RAM", val: "+200%", dir: 1 }, { name: "DRIVE", val: "+100%", dir: 1 },
  { name: "LAST GEN", val: "+37%", dir: 1 }, { name: "CASE", val: "0.00%", dir: 0 }, { name: "MEMORY TO THE BUILDINGS", val: "90%", dir: 1 },
  { name: "SLEEP", val: "-100%", dir: -1 }, { name: "THE HOBBY", val: "-99%", dir: -1 }, { name: "YOU", val: "-100%", dir: -1 }];
function furniture2(c, t, card, st) {
  c.save(); c.textBaseline = "middle";
  c.fillStyle = NIGHT; rr(c, 48, 40, 420, 52, 8); c.fill();
  c.font = font(24, MONO, "600"); c.fillStyle = AMBER; c.textAlign = "left"; c.fillText("OUT OF STOCK", 66, 67);
  c.fillStyle = BONE; c.fillText(`STEP ${String(card.n).padStart(2, "0")} / 27`, 280, 67);
  const next = song.sections.find(s => s.kind === "chorus" && s.t0 > t)?.t0 ?? song.DUR, left = Math.max(0, next - t);
  const mm = Math.floor(left / 60), ss = (left % 60).toFixed(2).padStart(5, "0");
  c.fillStyle = NIGHT; rr(c, W - 440, 40, 392, 52, 8); c.fill();
  c.fillStyle = BONE; c.fillText("RESTOCK IN", W - 420, 67);
  c.fillStyle = RED; c.textAlign = "right"; c.fillText(`T-${String(mm).padStart(2, "0")}:${ss}`, W - 66, 67);
  // the ticker: the song's own nouns, priced
  c.fillStyle = NIGHT; c.fillRect(0, H - 46, W, 46);
  c.font = font(22, MONO, "600"); c.textAlign = "left";
  const items = TICK.map(it => ({ ...it, val: it.live ? gainText(st.price) : it.val })), gap = 70;
  const wOf = it => c.measureText(it.name + "  " + it.val).width + 30 + gap;
  const total = items.reduce((a, it) => a + wOf(it), 0), x0 = -((t * 230) % total) + 170;
  for (const base of [x0, x0 + total]) {
    let x = base;
    for (const it of items) {
      c.fillStyle = BONE; c.fillText(it.name, x, H - 22);
      const nx = x + c.measureText(it.name + "  ").width, col = it.dir > 0 ? GREEN : it.dir < 0 ? RED : "#8f8b99";
      c.fillStyle = col;
      if (it.dir) { c.beginPath(); c.moveTo(nx, H - 22 + it.dir * 7); c.lineTo(nx + 16, H - 22 + it.dir * 7); c.lineTo(nx + 8, H - 22 - it.dir * 8); c.closePath(); c.fill(); }
      else c.fillRect(nx, H - 24, 16, 4);
      c.fillText(it.val, nx + 26, H - 22);
      x += wOf(it);
    }
  }
  c.fillStyle = RED; c.fillRect(0, H - 46, 150, 46);
  c.fillStyle = BONE; c.fillText("LIVE", 58, H - 22);
  if (Math.floor(t * 2) % 2 === 0) { c.beginPath(); c.arc(34, H - 23, 9, 0, 7); c.fill(); }
  c.restore();
}

// =====================================================================================================================
// the art made once: the CEO's two stills under the mosaic, the used card's heat, the mine
// =====================================================================================================================
function mips(cv) {
  const levels = [cv];
  while (levels[levels.length - 1].width > 40) { const p = levels[levels.length - 1]; levels.push(tile(Math.round(p.width / 2), Math.round(p.height / 2), g => g.drawImage(p, 0, 0, Math.round(p.width / 2), Math.round(p.height / 2)))); }
  return levels;
}
function mosaic(img, box, Hh) {
  const w = Math.round(img.width * Hh / img.height);
  return tile(w, Hh, g => {
    g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, w, Hh);
    const bx = box[0] * w, bw = (box[2] - box[0]) * w, by = (1 - box[3]) * Hh, bh = (box[3] - box[1]) * Hh, nx = 8, ny = Math.max(1, Math.round(8 * bh / bw));
    const small = tile(nx, ny, s2 => { s2.imageSmoothingQuality = "high"; s2.drawImage(g.canvas, bx, by, bw, bh, 0, 0, nx, ny); });
    g.clearRect(bx, by, bw, bh); g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, nx, ny, bx, by, bw, bh);
  });
}
const tint = (cv, col) => tile(cv.width, cv.height, g => { g.drawImage(cv, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height); });
export function initArt(S, F) {
  const A = F.v2 = {};
  const suit = mosaic(S.ceo.tex.suit.image, [0.3887, 0.8453, 0.5703, 0.9978], 1100), jacket = mosaic(S.ceo.tex.jacket.image, [0.4058, 0.8569, 0.5995, 0.9940], 1100);
  A.ceo = { suit: mips(suit), jacket: mips(jacket) };
  A.ceoGhost = { suit: [GREEN, RED].map(col => mips(tint(suit, col))), jacket: [GREEN, RED].map(col => mips(tint(jacket, col))) };
  A.ceoShadow = { suit: mips(tint(suit, "rgba(21,19,26,0.4)")), jacket: mips(tint(jacket, "rgba(21,19,26,0.4)")) };
  // the card that ran hot: a thermal camera's false colour, one flat level per band of heat
  const HEAT = ["#14062e", "#4a0a6b", "#9c1a6e", "#e0301e", "#ff8a12", "#ffd84a", "#fffbe0"];
  F.prints["v2-heat"] = makeScreenPrint(S.tex.rtx3070.image, 1000, S.cut.rtx3070.lum, { cover: HEAT.map(() => 1), inks: HEAT, shape: "dot", pitch: 8, angle: 0, contrast: 1.9, soften: 3, key: 5, keyCol: "#fffbe0" });
  // the mine: the heap of cards, cropped clear of the photographer's corner mark
  const pile = S.tex.pile.image, cr = [0.14, 0.1, 0.9, 0.97], sw = (cr[2] - cr[0]) * pile.width, sh = (cr[3] - cr[1]) * pile.height;
  const crop = tile(1200, Math.round(1200 * sh / sw), g => { g.imageSmoothingQuality = "high"; g.drawImage(pile, cr[0] * pile.width, cr[1] * pile.height, sw, sh, 0, 0, 1200, Math.round(1200 * sh / sw)); });
  F.prints["v2-mine"] = makeScreenPrint(crop, 1200, S.cut.pile.lum, { cover: [1, 0.62, 0.3, 0], inks: [INK, INK, INK, INK], shape: "dot", pitch: 9, angle: 45, contrast: 1.6, soften: 2, key: 6 });
  // the manual's own words, for the speed reader: every step, one word per frame
  A.rsvp = song.words.filter(x => x.li !== null && /^Verse [12]$/.test(song.lines[x.li].section)).map(x => disp(x, false));
}
const drawLevel = (c, levels, x, y, w, h, ws) => c.drawImage(level(levels, w * ws), x, y, w, h);

// =====================================================================================================================
// the props
// =====================================================================================================================
function stepCard2(c, K, numWord, o = {}) {
  const st = K.w("STEP"), nw = K.w(numWord), label = String(K.n).padStart(2, "0"), ink = o.ink ?? INK, pop = o.pop ?? BONE;
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  if (st && K.t >= st.t - 0.03) {
    const s = since(K.t, st.t - 0.03, 0.07);
    c.save(); c.translate(380, 260); c.scale(1 + s * 0.35, 1 + s * 0.35); c.translate(-380, -260);
    c.font = font(300); c.fillStyle = pop; c.fillText("STEP", 132, 372); c.fillStyle = ink; c.fillText("STEP", 120, 360);
    c.restore();
    c.font = font(34, MONO, "600"); c.fillStyle = ink; c.fillText("OF 27  ·  THE MANUAL, 2026 EDITION", 700, 350);
  }
  c.font = font(700);
  if (!nw || K.t < nw.t - 0.03) {
    const slide = easeOut((K.t - K.t0) / 0.3);
    c.lineWidth = 12; c.strokeStyle = ink; c.strokeText(label, 110 - (1 - slide) * 300, 1000);
  } else {
    const s = since(K.t, nw.t - 0.03, 0.07);
    c.save(); c.translate(420, 760); c.scale(1 + s * 0.3, 1 + s * 0.3); c.translate(-420, -760);
    c.fillStyle = ink; c.fillText(label, 138, 1028); c.fillStyle = s > 0.6 ? RED : pop; c.fillText(label, 110, 1000);
    c.restore();
  }
  if (o.side) o.side(c, K);
}
function cursorAt(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = "round";
  c.beginPath(); [[0, 0], [0, 30], [8, 23], [14, 36], [20, 33], [14, 21], [24, 21]].forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function bell(c, x, y, r, swing = 0, fill = AMBER, edgeCol = INK) {
  c.save(); c.translate(x, y); c.rotate(swing);
  c.beginPath(); c.moveTo(-r * 0.72, r * 0.55); c.bezierCurveTo(-r * 0.6, r * 0.2, -r * 0.64, -r * 0.78, 0, -r * 0.8); c.bezierCurveTo(r * 0.64, -r * 0.78, r * 0.6, r * 0.2, r * 0.72, r * 0.55); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = r * 0.1; c.strokeStyle = edgeCol; c.stroke();
  c.fillStyle = edgeCol; rr(c, -r * 0.84, r * 0.48, r * 1.68, r * 0.16, r * 0.08); c.fill();
  c.beginPath(); c.arc(0, r * 0.8, r * 0.16, 0, 7); c.fill();
  c.beginPath(); c.arc(0, -r * 0.9, r * 0.11, 0, 7); c.fill();
  c.restore();
}
// NOTIFY ME (the intro's button), pressed on every kick since the cut
function notifyButton(c, K, cx, cy, s) {
  const ks = song.kicks.filter(k => k >= K.t0 - 0.02 && k <= K.t), last = ks[ks.length - 1], press = last !== undefined ? since(K.t, last, 0.08) : 0;
  const pop = easeOutBack((K.t - K.t0) / 0.2) * (1 - press * 0.07);
  c.save(); c.translate(cx, cy); c.scale(s * pop, s * pop);
  c.fillStyle = INK; rr(c, -500 + 18, -115 + 22, 1000, 230, 115); c.fill();
  c.fillStyle = press > 0.5 ? AMBER : BONE; rr(c, -500, -115, 1000, 230, 115); c.fill(); c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
  bell(c, -345, 0, 105, Math.sin(K.t * 22) * 0.35 * press);
  c.font = font(150); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("NOTIFY ME", 70, 8);
  c.restore();
  for (const k of ks.slice(-3)) {
    const u = clamp((K.t - k) / 0.3); if (u >= 1) continue;
    c.strokeStyle = `rgba(244,241,234,${1 - u})`; c.lineWidth = 9; c.beginPath(); c.ellipse(cx + 170 * s, cy + 40 * s, (60 + u * 300) * s, (30 + u * 120) * s, 0, 0, 7); c.stroke();
  }
  cursorAt(c, cx + 170 * s, cy + 40 * s + press * 10, 3.2 * s);
  if (ks.length) { c.font = font(46, MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(`NOTIFIED ×${ks.length}`, cx, cy - 170 * s); }
}
function arcadeButton(c, K, cx, cy, r) {
  const kk = K.kick, press = kk && kk.t >= K.t0 - 0.02 ? since(K.t, kk.t, 0.09) : 0, dy = press * r * 0.2;
  c.fillStyle = "rgba(21,19,26,0.35)"; c.beginPath(); c.ellipse(cx + 24, cy + r * 0.62 + 28, r * 1.34, r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = "#26222e"; c.beginPath(); c.ellipse(cx, cy + r * 0.62, r * 1.34, r * 0.5, 0, 0, 7); c.fill();
  c.fillRect(cx - r * 1.34, cy + r * 0.2, r * 2.68, r * 0.42);
  c.fillStyle = "#3a3644"; c.beginPath(); c.ellipse(cx, cy + r * 0.2, r * 1.34, r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = "#9c0f1d"; c.fillRect(cx - r, cy - r * 0.2 + dy, r * 2, r * 0.4 - dy * 0.5);
  c.beginPath(); c.ellipse(cx, cy + r * 0.2, r, r * 0.36, 0, 0, Math.PI); c.fill();
  c.fillStyle = RED; c.beginPath(); c.ellipse(cx, cy - r * 0.2 + dy, r, r * 0.38, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.3 + dy, r * 0.35, r * 0.1, -0.2, 0, 7); c.fill();
  c.font = font(Math.round(r * 0.34), MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PUSH", cx, cy + r * 0.55);
  if (kk && kk.t >= K.t0 - 0.02 && K.t - kk.t < 0.22) { const side = kk.i % 2 ? 1 : -1; burst(c, cx + side * r * 1.1, cy - r * 0.8, r * 0.5 * easeOutBack((K.t - kk.t) / 0.1), 14, BONE, INK, "CLICK!", Math.round(r * 0.24), side * 0.2); }
}
function prayingHands(c, cx, cy, s) {
  const g = c.createRadialGradient(cx, cy - 60 * s, 20, cx, cy - 60 * s, 560 * s);
  g.addColorStop(0, "rgba(255,244,190,0.9)"); g.addColorStop(1, "rgba(255,244,190,0)");
  c.fillStyle = g; c.fillRect(cx - 600 * s, cy - 700 * s, 1200 * s, 1300 * s);
  for (const sx of [-1, 1]) {
    c.save(); c.translate(cx, cy); c.scale(sx * s, s);
    const palm = () => { c.beginPath(); c.moveTo(0, -330); c.bezierCurveTo(70, -320, 120, -150, 128, 20); c.lineTo(150, 130); c.bezierCurveTo(165, 230, 120, 300, 40, 330); c.lineTo(0, 330); c.closePath(); };
    c.save(); c.translate(14, 18); palm(); c.fillStyle = "rgba(21,19,26,0.3)"; c.fill(); c.restore();
    palm(); c.fillStyle = "#f6d7b8"; c.fill(); c.lineWidth = 11; c.strokeStyle = INK; c.lineJoin = "round"; c.stroke();
    c.lineWidth = 6; for (const y of [-190, -90, 10]) { c.beginPath(); c.moveTo(18, y); c.quadraticCurveTo(70, y - 20, 104, y + 30); c.stroke(); }
    c.fillStyle = "#35d6f0"; c.fillRect(0, 330, 170, 90); c.strokeRect(0, 330, 170, 90);
    c.fillStyle = "#f6d7b8"; c.lineWidth = 10; c.beginPath(); c.ellipse(36, 120, 36, 118, -0.16, 0, 7); c.fill(); c.stroke();   // the thumb
    c.lineWidth = 5; c.beginPath(); c.moveTo(14, 60); c.quadraticCurveTo(40, 50, 56, 66); c.stroke();
    c.restore();
  }
}
function steeple(c, K, cx, cy, s) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = "round";
  c.fillStyle = BONE; c.fillRect(-230, -60, 460, 620); c.strokeRect(-230, -60, 460, 620);
  c.beginPath(); c.moveTo(-270, -60); c.lineTo(0, -470); c.lineTo(270, -60); c.closePath(); c.fillStyle = "#c9b6ff"; c.fill(); c.stroke();
  c.fillStyle = INK; c.fillRect(-10, -610, 20, 150); c.fillRect(-60, -560, 120, 20);
  c.fillStyle = "#1a2a4a"; c.beginPath(); c.moveTo(-150, 330); c.lineTo(-150, 70); c.arc(0, 70, 150, Math.PI, 0); c.lineTo(150, 330); c.closePath(); c.fill(); c.stroke();
  const kk = K.kick, hit = kk && kk.t >= K.t0 - 0.02 ? since(K.t, kk.t, 0.3) : 0, swing = Math.sin((K.t - K.t0) * 10) * (0.2 + hit * 0.45);
  bell(c, 0, 150, 120, swing);
  c.restore();
  if (kk && kk.t >= K.t0 - 0.02 && K.t - kk.t < 0.24) { const side = kk.i % 2 ? 1 : -1; burst(c, cx + side * 330 * s, cy - 40 * s, 150 * s * easeOutBack((K.t - kk.t) / 0.1), 16, P.yellow, INK, "DING!", Math.round(70 * s), side * 0.15); }
}
function pill(c, x, y, text, bg, fg, size = 40) {
  c.font = font(size, MONO, "600"); const tw = c.measureText(text).width;
  c.fillStyle = bg; rr(c, x, y - size * 0.9, tw + size * 1.2, size * 1.6, size * 0.8); c.fill();
  c.fillStyle = fg; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(text, x + size * 0.6, y - size * 0.1);
}
function mic(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.strokeStyle = INK; c.lineWidth = 16; c.beginPath(); c.moveTo(0, -620); c.lineTo(0, -210); c.stroke();
  c.lineWidth = 12; c.beginPath(); c.ellipse(0, -60, 130, 170, 0, 0, 7); c.stroke();
  c.fillStyle = "#3a3644"; rr(c, -85, -230, 170, 360, 85); c.fill(); c.lineWidth = 10; c.stroke();
  c.strokeStyle = "rgba(244,241,234,0.35)"; c.lineWidth = 5;
  for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-70, -180 + i * 34); c.lineTo(70, -180 + i * 34); c.stroke(); }
  c.fillStyle = INK; c.fillRect(-90, 60, 180, 40);
  c.restore();
}
function onAir(c, K, x, y) {
  const on = Math.floor(K.t * 4) % 2 === 0 || since(K.t, K.kick?.t ?? -9, 0.1) > 0.4;
  c.fillStyle = INK; rr(c, x - 250 + 12, y - 80 + 14, 500, 160, 22); c.fill();
  c.fillStyle = on ? RED : "#5a1018"; rr(c, x - 250, y - 80, 500, 160, 22); c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.font = font(110); c.fillStyle = on ? BONE : "rgba(244,241,234,0.4)"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ON AIR", x, y + 6);
}
// a man, anyone: a head in headphones and a pair of shoulders, flat ink
function man(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = o.col ?? INK;
  c.beginPath(); c.moveTo(-330, 520); c.bezierCurveTo(-320, 250, -200, 170, 0, 170); c.bezierCurveTo(200, 170, 320, 250, 330, 520); c.closePath(); c.fill();
  c.fillRect(-60, 90, 120, 110);
  c.beginPath(); c.ellipse(0, -20, 150, 180, 0, 0, 7); c.fill();
  if (o.phones !== false) {
    c.strokeStyle = o.phoneCol ?? AMBER; c.lineWidth = 30; c.beginPath(); c.arc(0, -20, 185, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.fillStyle = o.phoneCol ?? AMBER; for (const sx of [-1, 1]) { rr(c, sx * 190 - 45, -80, 90, 150, 30); c.fill(); }
  }
  c.restore();
}
// the clip format's captions: one or two words at a time, fat white with a black edge, the word being said in yellow
function tokCaps(c, K, o) {
  const ws = K.words.filter(w => K.t >= w.t - 0.03);
  if (!ws.length) return;
  const cur = ws.length - 1, g0 = cur - (cur % 2), group = K.words.slice(g0, g0 + 2);
  c.font = font(o.size ?? 200); c.textBaseline = "alphabetic";
  const texts = group.map(w => disp(w, false)), sp = c.measureText(" ").width, tw = texts.reduce((a, s) => a + c.measureText(s).width, 0) + sp * (texts.length - 1);
  let x = o.x - tw / 2;
  group.forEach((w, j) => {
    const txt = texts[j], ww = c.measureText(txt).width, on = K.t >= w.t - 0.03, s = on ? since(K.t, w.t - 0.03, 0.07) : 0;
    if (on) {
      c.save(); c.translate(x + ww / 2, o.y); c.rotate((h32(w.wi ?? j, 2231) - 0.5) * 0.08); c.scale(1 + s * 0.3, 1 + s * 0.3);
      c.lineJoin = "round"; c.lineWidth = (o.size ?? 200) * 0.14; c.strokeStyle = INK; c.textAlign = "center"; c.strokeText(txt, 0, 0);
      c.fillStyle = g0 + j === cur ? P.yellow : BONE; c.fillText(txt, 0, 0);
      c.restore();
    }
    x += ww + sp;
  });
}
function pumpjack(c, K, x, y, s) {
  const kk = K.kick, a = Math.sin((K.t - K.t0) * 6.5) * 0.28 + (kk && kk.t >= K.t0 ? since(K.t, kk.t, 0.12) * 0.12 : 0);
  c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 16; c.strokeStyle = INK; c.lineJoin = "round"; c.lineCap = "round";
  c.fillStyle = INK; c.fillRect(-420, 300, 840, 40);
  c.beginPath(); c.moveTo(-160, 300); c.lineTo(0, -60); c.lineTo(160, 300); c.stroke();
  c.save(); c.translate(0, -60); c.rotate(a);
  c.fillStyle = "#2a2632"; c.fillRect(-380, -26, 640, 52); c.strokeRect(-380, -26, 640, 52);
  c.fillStyle = INK; c.beginPath(); c.moveTo(260, -60); c.quadraticCurveTo(360, -40, 360, 60); c.lineTo(360, 120); c.lineTo(260, 60); c.closePath(); c.fill();
  c.fillStyle = "#4a4555"; rr(c, -420, 20, 160, 130, 20); c.fill(); c.stroke();
  c.restore();
  const hx = Math.cos(a) * 360, hy = -60 + Math.sin(a) * 360 + 120;
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(360, 300); c.stroke();
  c.restore();
}
function barrel(c, x, y, w, h, label, col = "#2a2632") {
  c.save(); c.translate(x, y);
  c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
  c.lineWidth = 8; c.strokeStyle = INK; c.strokeRect(-w / 2, -h / 2, w, h);
  c.fillStyle = "#3a3644"; c.beginPath(); c.ellipse(0, -h / 2, w / 2, w * 0.14, 0, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = "rgba(244,241,234,0.25)"; c.lineWidth = 6; for (const f of [-0.2, 0.25]) { c.beginPath(); c.moveTo(-w / 2, h * f); c.lineTo(w / 2, h * f); c.stroke(); }
  c.fillStyle = AMBER; c.fillRect(-w / 2 + 10, -h * 0.08, w - 20, h * 0.22);
  c.font = font(Math.round(w * 0.2), MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, 0, h * 0.03);
  c.restore();
}
function lowerThird(c, x, y, name, sub) {
  c.font = font(96); const nw = c.measureText(name).width;
  c.fillStyle = RED; c.fillRect(x, y - 96, nw + 70, 120);
  c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText(name, x + 35, y);
  c.font = font(40, MONO, "600"); const sw = c.measureText(sub).width;
  c.fillStyle = BONE; c.fillRect(x, y + 24, sw + 60, 64); c.fillStyle = INK; c.fillText(sub, x + 30, y + 70);
}
function wishingWell(c, K, cx, cy, s) {
  c.save(); c.translate(cx, cy); c.scale(s, s); c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = "round";
  c.fillStyle = "#8a7f6c"; c.fillRect(-300, 80, 600, 300); c.strokeRect(-300, 80, 600, 300);
  c.fillStyle = "#a89b83"; for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) { const bx = -300 + q * 120 + (r % 2) * 60; if (bx >= 300) continue; c.fillRect(bx + 6, 86 + r * 74, Math.min(108, 294 - bx), 62); }
  c.fillStyle = "#1a1620"; c.beginPath(); c.ellipse(0, 80, 300, 70, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = "#6b4526"; c.fillRect(-270, -300, 34, 390); c.fillRect(236, -300, 34, 390);
  c.beginPath(); c.moveTo(-360, -280); c.lineTo(0, -470); c.lineTo(360, -280); c.closePath(); c.fillStyle = "#a8703a"; c.fill(); c.stroke();
  c.fillStyle = "#6b4526"; c.fillRect(-236, -150, 472, 26);
  c.strokeStyle = INK; c.lineWidth = 5; const d = 40 + Math.sin(K.t * 3) * 20; c.beginPath(); c.moveTo(0, -124); c.lineTo(0, -40 + d); c.stroke();
  c.fillStyle = "#6b4526"; rr(c, -46, -40 + d, 92, 80, 10); c.fill(); c.lineWidth = 8; c.stroke();
  c.restore();
}
function bigQuestion(c, K, x, y, size) {
  const b = Math.sin(K.t * 6) * 16;
  c.font = font(size); c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.fillStyle = INK; c.fillText("?", x + 16, y + b + 18); c.fillStyle = P.yellow; c.fillText("?", x, y + b);
}
// the creator's CEO art (the mosaic on his face, the creator's ruling), standing at (cx, feet), h tall. sx: the flip's squeeze
function ceoAt(c, K, which, cx, feet, h, o = {}) {
  const A = K.F.v2, lv = A.ceo[which], img = lv[0], w = h * img.width / img.height, sx = o.sx ?? 1;
  c.save(); c.translate(cx, feet - h / 2); c.scale(sx, 1); c.rotate(o.rot ?? 0);
  if (o.ghost !== undefined) { c.globalAlpha = o.alpha ?? 0.5; drawLevel(c, A.ceoGhost[which][o.ghost], -w / 2, -h / 2, w, h, K.ws * Math.abs(sx)); }
  else {
    if (o.shadow !== false) drawLevel(c, A.ceoShadow[which], -w / 2 + h * 0.02, -h / 2 + h * 0.02, w, h, K.ws * Math.abs(sx));
    drawLevel(c, lv, -w / 2, -h / 2, w, h, K.ws * Math.abs(sx));
  }
  c.restore();
}
function thankYou(c, K, cx, cy) {
  const e = easeOutBack((K.t - K.t0) / 0.3), open = lerp(0.2, 1, easeOut((K.t - K.t0) / 0.4));
  c.save(); c.translate(cx, cy); c.rotate(-0.05); c.scale(e, e);
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(-420 + 22, -300 + 26, 840, 600);
  c.fillStyle = "#e9e4d8"; c.fillRect(-420, -300, 420 * open, 600);
  c.fillStyle = "#fbf8f0"; c.fillRect(0, -300, 420, 600); c.lineWidth = 6; c.strokeStyle = INK; c.strokeRect(-420 * open, -300, 420 * open + 420, 600);
  c.font = font(120, SERIF); c.fillStyle = RED; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("Thank", 210, -60); c.fillText("You", 210, 80);
  c.font = font(34, MONO, "600"); c.fillStyle = INK; c.fillText("TO THE GAMERS", 210, 170);
  c.font = font(46, SERIF); c.fillText("— the CEO", 230, 250);
  heart(c, -200 * open, 0, 0.35);
  c.restore();
}
function spot(c, x, y0, x1, r, alpha = 0.45) {
  const g = c.createLinearGradient(0, y0, 0, 1080);
  g.addColorStop(0, `rgba(255,248,220,${alpha})`); g.addColorStop(1, "rgba(255,248,220,0.04)");
  c.fillStyle = g; c.beginPath(); c.moveTo(x - 40, y0); c.lineTo(x + 40, y0); c.lineTo(x1 + r, 1080); c.lineTo(x1 - r, 1080); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,248,220,0.18)"; c.beginPath(); c.ellipse(x1, 1010, r, 50, 0, 0, 7); c.fill();
}
function heart(c, cx, cy, s, fill = RED) {
  c.save(); c.translate(cx, cy); c.scale(s, s);
  const hp = () => { c.beginPath(); c.moveTo(0, 150); c.bezierCurveTo(-380, -110, -220, -390, 0, -200); c.bezierCurveTo(220, -390, 380, -110, 0, 150); c.closePath(); };
  c.save(); c.translate(20, 26); hp(); c.fillStyle = "rgba(21,19,26,0.35)"; c.fill(); c.restore();
  hp(); c.fillStyle = fill; c.fill(); c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
  c.restore();
}
function padGlyph(c, cx, cy, s, col = BONE) {             // a game pad in one colour
  c.save(); c.translate(cx, cy); c.scale(s, s); c.fillStyle = col;
  c.beginPath(); c.moveTo(-160, -70); c.lineTo(160, -70); c.bezierCurveTo(250, -70, 280, 40, 260, 110); c.bezierCurveTo(240, 170, 180, 170, 140, 100); c.lineTo(-140, 100);
  c.bezierCurveTo(-180, 170, -240, 170, -260, 110); c.bezierCurveTo(-280, 40, -250, -70, -160, -70); c.closePath(); c.fill();
  c.fillStyle = RED; c.fillRect(-190, -10, 80, 26); c.fillRect(-163, -37, 26, 80);
  for (const [dx, dy] of [[150, -25], [190, 10], [150, 45], [110, 10]]) { c.beginPath(); c.arc(dx, dy, 15, 0, 7); c.fill(); }
  c.restore();
}
function bullseye(c, K, cx, cy, r) {
  const u = easeOut((K.t - K.t0) / 0.3);
  for (let i = 5; i >= 0; i--) { c.fillStyle = i % 2 ? BONE : RED; c.beginPath(); c.arc(cx, cy, r * (i + 1) / 6 * u, 0, 7); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy, r * u, 0, 7); c.stroke();
}
function reticle(c, K, cx, cy, r, lock) {
  const rr0 = lerp(r * 1.6, r, easeOut(lock));
  c.strokeStyle = INK; c.lineWidth = 12;
  c.beginPath(); c.arc(cx, cy, rr0, 0, 7); c.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(cx + dx * rr0 * 0.55, cy + dy * rr0 * 0.55); c.lineTo(cx + dx * rr0 * 1.25, cy + dy * rr0 * 1.25); c.stroke(); }
}
function sparkles(c, K, cx, cy, spread, n = 14) {
  for (let i = 0; i < n; i++) {
    const ph = (K.t * 2.2 + h32(i, 2241)) % 1, x = cx + (h32(i, 2242) - 0.5) * spread, y = cy + (h32(i, 2243) - 0.5) * spread, r = 44 * Math.sin(ph * Math.PI);
    c.fillStyle = BONE; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.22, y - r * 0.22); c.lineTo(x + r, y); c.lineTo(x + r * 0.22, y + r * 0.22); c.lineTo(x, y + r); c.lineTo(x - r * 0.22, y + r * 0.22); c.lineTo(x - r, y); c.lineTo(x - r * 0.22, y - r * 0.22); c.closePath(); c.fill();
  }
}
function stopwatch(c, K, cx, cy, r) {
  const e = K.t - K.t0, bot = Math.min(0.001, e * 0.01);
  c.fillStyle = INK; c.fillRect(cx - 40, cy - r - 90, 80, 70); rr(c, cx - 90, cy - r - 120, 180, 50, 16); c.fill();
  c.fillStyle = "rgba(21,19,26,0.35)"; c.beginPath(); c.arc(cx + 20, cy + 24, r, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.lineWidth = 22; c.strokeStyle = INK; c.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? 20 : 44; c.lineWidth = i % 5 ? 4 : 9; c.beginPath(); c.moveTo(cx + Math.sin(a) * (r - 30), cy - Math.cos(a) * (r - 30)); c.lineTo(cx + Math.sin(a) * (r - 30 - l), cy - Math.cos(a) * (r - 30 - l)); c.stroke(); }
  const a = e / 0.42 * Math.PI * 2;
  c.strokeStyle = RED; c.lineWidth = 12; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * (r - 70), cy - Math.cos(a) * (r - 70)); c.stroke();
  c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 24, 0, 7); c.fill();
  c.font = font(70, MONO, "600"); c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.fillStyle = RED; c.fillText(`BOT  ${bot.toFixed(3)}s`, cx, cy + r * 0.5);
  c.fillStyle = INK; c.fillText(`YOU  ${Math.min(1, e / 0.42).toFixed(3)}s`, cx, cy + r * 0.5 + 84);
}
function thumb(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = "round";
  c.fillStyle = "#f6d7b8";
  c.beginPath(); c.moveTo(-120, 600); c.lineTo(-120, 40); c.bezierCurveTo(-120, -110, 120, -110, 120, 40); c.lineTo(120, 600); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#ffe9d6"; rr(c, -80, -40, 160, 150, 60); c.fill(); c.lineWidth = 8; c.stroke();
  c.lineWidth = 6; c.beginPath(); c.moveTo(-80, 260); c.quadraticCurveTo(0, 230, 80, 260); c.stroke();
  c.restore();
}
function phoneBuy(c, K, cx, cy, h, sold) {
  const w = h * 0.5;
  c.save(); c.translate(cx, cy); c.rotate(-0.06);
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, -w / 2 + 22, -h / 2 + 26, w, h, w * 0.16); c.fill();
  c.fillStyle = INK; rr(c, -w / 2, -h / 2, w, h, w * 0.16); c.fill();
  c.fillStyle = BONE; rr(c, -w / 2 + 20, -h / 2 + 20, w - 40, h - 40, w * 0.12); c.fill();
  c.fillStyle = INK; rr(c, -w * 0.15, -h / 2 + 34, w * 0.3, 30, 15); c.fill();
  printAt(c, K, "rtx3090", 0, -h * 0.16, w * 0.8, 0, { off: 0 });
  c.font = font(Math.round(w * 0.085), MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("FLAGSHIP 24 GB", 0, h * 0.06);
  c.fillStyle = sold ? RED : GREEN; rr(c, -w * 0.38, h * 0.14, w * 0.76, h * 0.12, h * 0.06); c.fill();
  c.font = font(Math.round(w * 0.13)); c.fillStyle = BONE; c.textBaseline = "middle"; c.fillText(sold ? "SOLD OUT" : "BUY NOW", 0, h * 0.2 + 4);
  c.restore();
}
function listing(c, K, x, y, w, h, price, o = {}) {
  c.fillStyle = "rgba(21,19,26,0.35)"; rr(c, x + 20, y + 24, w, h, 26); c.fill();
  c.fillStyle = BONE; rr(c, x, y, w, h, 26); c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.font = font(40, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillText("FLAGSHIP 24 GB  ·  NEW, SEALED", x + 40, y + 80);
  c.fillStyle = "rgba(21,19,26,0.6)"; c.font = font(32, MONO, "600"); c.fillText(`SELLER @${HANDLES[14]}  ·  ★★★★★  ·  9 SOLD TODAY`, x + 40, y + 130);
  printAt(c, K, "rtx3090", x + w / 2, y + h * 0.43, w * 0.72, -0.04, { off: 16 });
  c.font = font(o.size ?? 110); c.fillStyle = o.col ?? INK; c.fillText(price, x + 40, y + h - 60);
  c.fillStyle = P.yellow; rr(c, x + w - 320, y + h - 150, 280, 96, 48); c.fill(); c.lineWidth = 8; c.stroke();
  c.font = font(46); c.fillStyle = INK; c.textAlign = "center"; c.fillText("BUY IT NOW", x + w - 180, y + h - 86);
}
// the stream: a player with the streamer in his ring light, a chat that won't stop
const CHAT = ["just buy last gen", "W", "true", "bro has the flagship", "L take", "ratio", "he has two of them", "copium", "LMAO", "last gen went up too",
  "real", "hes not wrong", "hes rich", "buy mine $900", "notify me", "SOLD OUT", "first", "cap", "based", "the ring light tho"];
function stream(c, K, o = {}) {
  const px = 60, py = 130, pw = 1250, ph = 760;
  c.fillStyle = "#15131a"; c.fillRect(px, py, pw, ph);
  const g = c.createRadialGradient(px + pw * 0.5, py + ph * 0.45, 40, px + pw * 0.5, py + ph * 0.5, 620);
  g.addColorStop(0, "#4a3a6b"); g.addColorStop(1, "#15131a"); c.fillStyle = g; c.fillRect(px, py, pw, ph);
  c.strokeStyle = BONE; c.lineWidth = 26; c.globalAlpha = 0.9; c.beginPath(); c.arc(px + pw * 0.5, py + ph * 0.42, 250, 0, 7); c.stroke(); c.globalAlpha = 1;
  if (o.card) printAt(c, K, "rtx3090", px + pw * 0.8, py + ph * 0.3, 380, -0.08, { off: 10 });
  man(c, px + pw * 0.5, py + ph * 0.52, 0.95, { col: "#08070b", phoneCol: "#2a2632" });
  c.fillStyle = RED; rr(c, px + 24, py + 24, 150, 56, 10); c.fill();
  c.font = font(36, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("LIVE", px + 64, py + 53);
  c.beginPath(); c.arc(px + 44, py + 52, 9, 0, 7); c.fill();
  const viewers = Math.round(12400 + (K.t - K.t0) * 9000 + (o.boost ?? 0));
  c.fillStyle = "rgba(11,10,15,0.8)"; rr(c, px + 190, py + 24, 320, 56, 10); c.fill();
  c.fillStyle = BONE; c.fillText(`${viewers.toLocaleString("en-US")} WATCHING`, px + 212, py + 53);
  // chat
  const cx = px + pw + 30, cw = 1860 - cx;
  c.fillStyle = "#1d1a24"; c.fillRect(cx, py, cw, ph);
  c.fillStyle = BONE; c.font = font(30, MONO, "600"); c.fillText("CHAT", cx + 24, py + 40);
  c.save(); c.beginPath(); c.rect(cx, py + 70, cw, ph - 70); c.clip();
  const rate = 16, n0 = Math.floor((K.t - 120) * rate);
  for (let j = 0; j < 16; j++) {
    const m = n0 - j, y = py + ph - 30 - j * 44 - ((K.t - 120) * rate % 1) * 44;
    const who = HANDLES[Math.floor(h32(m, 2251) * HANDLES.length)], msg = CHAT[Math.floor(h32(m, 2252) * CHAT.length)];
    c.font = font(24, MONO, "600"); c.fillStyle = [AMBER, CYAN, "#ff3d8b", GREEN][m & 3]; c.fillText(who + ":", cx + 20, y);
    c.fillStyle = BONE; c.fillText(msg, cx + 30 + c.measureText(who + ": ").width, y);
  }
  c.restore();
}
// the plugin's Visualizer's ring (the intro's), as a ring light: 48 bands mirrored, bars along the normal, fed by the creator's synth stem
function ringLight(c, K, cx, cy, r) {
  const B = song.synth.bandsAt(K.t), n = 96, k = K.k;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 - Math.PI / 2, b = i < 48 ? i : 95 - i, v = B[b] * 0.85 + k * 0.15, len = 20 + v * 190;
    const col = `hsl(${(190 + b * 3.2) % 360}, 95%, ${55 + v * 20}%)`;
    c.strokeStyle = col; c.lineWidth = 12; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)); c.stroke();
  }
  c.strokeStyle = BONE; c.lineWidth = 34; c.globalAlpha = 0.95; c.beginPath(); c.arc(cx, cy, r - 30, 0, 7); c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = `rgba(255,255,255,${0.2 + k * 0.4})`; c.lineWidth = 90; c.beginPath(); c.arc(cx, cy, r - 30, 0, 7); c.stroke();
}
function lens(c, K, cx, cy, r) {
  const kk = K.kick, close = kk && kk.t >= K.t0 - 0.02 ? since(K.t, kk.t, 0.1) : 0;
  c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.arc(cx + 24, cy + 28, r, 0, 7); c.fill();
  for (const [f, col] of [[1, "#2a2632"], [0.9, "#15131a"], [0.8, "#3a3644"], [0.7, "#0b0a0f"]]) { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r * f, 0, 7); c.fill(); }
  c.strokeStyle = "rgba(244,241,234,0.3)"; c.lineWidth = 4; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); c.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97); c.stroke(); }
  const ap = r * lerp(0.42, 0.26, close), rot = K.t * 0.6;
  c.fillStyle = "#1c1b25"; c.beginPath(); c.arc(cx, cy, r * 0.68, 0, 7); c.fill();
  c.fillStyle = "#050507"; c.beginPath(); for (let i = 0; i < 6; i++) { const a = rot + i / 6 * Math.PI * 2; c.lineTo(cx + Math.cos(a) * ap, cy + Math.sin(a) * ap); } c.closePath(); c.fill();
  // the chart in the glass
  c.save(); c.beginPath(); c.arc(cx, cy, ap, 0, 7); c.clip();
  c.strokeStyle = GREEN; c.lineWidth = 8; c.beginPath(); for (let j = 0; j <= 12; j++) { const x = cx - ap + j / 12 * ap * 2, y = cy + ap * 0.5 - Math.pow(j / 12, 2.4) * ap * 1.1 + (h32(j, 2261) - 0.5) * 16; j ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  c.restore();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.22, r * 0.1, -0.6, 0, 7); c.fill();
}
function odometer(c, K, cx, cy, value, label) {
  const digits = String(value).padStart(3, "0"), bw = 190, bh = 260, gap = 20, tw = 3 * bw + 2 * gap, x0 = cx - tw / 2;
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * (bw + gap);
    c.fillStyle = BONE; rr(c, x + 12, cy - bh / 2 + 14, bw, bh, 18); c.fill();
    c.fillStyle = INK; rr(c, x, cy - bh / 2, bw, bh, 18); c.fill();
    c.font = font(230); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(digits[i], x + bw / 2, cy + 84);
  }
  c.font = font(90); c.fillStyle = INK; c.textAlign = "left"; c.fillText(label, x0 + tw + 40, cy + 40);
}
function chat(c, K, words) {
  const x = 150, y = 150, w = 1620, h = 620;
  c.fillStyle = "rgba(21,19,26,0.3)"; rr(c, x + 20, y + 24, w, h, 30); c.fill();
  c.fillStyle = BONE; rr(c, x, y, w, h, 30); c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.fillStyle = INK; rr(c, x, y, w, 110, [30, 30, 0, 0]); c.fill();
  c.font = font(40, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("SUPPORT  ·  usually replies in 3-5 years", x + 40, y + 56);
  const said = words.filter(w => K.t >= w.t - 0.03).map(w => disp(w, true).toLowerCase()).join(" ");
  if (said) {
    c.font = font(72, MONO, "600"); const tw = c.measureText(said).width;
    c.fillStyle = "#2f7de0"; rr(c, x + w - tw - 120, y + 170, tw + 80, 120, 50); c.fill();
    c.fillStyle = BONE; c.textAlign = "right"; c.fillText(said, x + w - 80, y + 232);
  }
  c.fillStyle = "#d9d4c8"; rr(c, x + 40, y + 360, 300, 120, 50); c.fill();
  for (let i = 0; i < 3; i++) { const b = Math.sin(K.t * 10 - i * 0.8) * 10; c.fillStyle = "#6b6776"; c.beginPath(); c.arc(x + 130 + i * 60, y + 420 + b, 18, 0, 7); c.fill(); }
}
function storeSign(c, K, cx, cy, lines, o = {}) {
  c.fillStyle = o.glass ?? "#9fd0e8"; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, H + 2 * BLEED);
  c.fillStyle = "rgba(255,255,255,0.35)"; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(200 + i * 420, -BLEED); c.lineTo(420 + i * 420, -BLEED); c.lineTo(-100 + i * 420, H + BLEED); c.lineTo(-320 + i * 420, H + BLEED); c.closePath(); c.fill(); }
  c.fillStyle = "#2a2632"; c.fillRect(-BLEED, -BLEED, W + 2 * BLEED, 60 + BLEED); c.fillRect(-BLEED, H - 60, W + 2 * BLEED, 60 + BLEED);
  c.save(); c.translate(cx, cy); c.rotate(o.rot ?? -0.03);
  c.fillStyle = "rgba(21,19,26,0.3)"; c.fillRect(-360 + 16, -300 + 20, 720, 600);
  c.fillStyle = "#fbf8f0"; c.fillRect(-360, -300, 720, 600);
  c.fillStyle = "rgba(255,220,140,0.7)"; for (const [x, y, r] of [[-360, -300, 0.6], [360, -300, -0.6]]) { c.save(); c.translate(x, y); c.rotate(r); c.fillRect(-60, -18, 120, 36); c.restore(); }
  c.font = font(64, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.head ?? "RESTOCK:", 0, -170);
  lines.forEach((l, j) => { if (K.t < l.t - 0.03) return; const s = since(K.t, l.t - 0.03, 0.07); c.save(); c.translate(0, -20 + j * 190); c.scale(1 + s * 0.3, 1 + s * 0.3); c.font = font(l.size ?? 200); c.fillStyle = l.col ?? RED; c.fillText(l.text, 0, 60); c.restore(); });
  c.restore();
}
function yearPage(c, x, y, w, h, label, head) {
  c.fillStyle = BONE; rr(c, x, y, w, h, 14); c.fill();
  c.fillStyle = RED; rr(c, x, y, w, h * 0.16, [14, 14, 0, 0]); c.fill();
  c.font = font(34, MONO, "600"); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(head, x + w / 2, y + h * 0.085);
  c.font = font(230); c.fillStyle = INK; c.textBaseline = "alphabetic"; c.fillText(label, x + w / 2, y + h * 0.62);
  c.fillStyle = "rgba(21,19,26,0.16)"; for (let r = 0; r < 3; r++) for (let q = 0; q < 7; q++) c.fillRect(x + 48 + q * (w - 96) / 7, y + h * 0.7 + r * 58, (w - 96) / 7 - 14, 42);
}
function yearFlip(c, K, x, y, w, h, t0, t1, from, to, head) {
  const n = to - from, u = clamp((K.t - t0) / Math.max(0.1, t1 - t0)), cur = from + Math.min(n, Math.floor(u * (n + 1)));
  c.fillStyle = INK; rr(c, x + 20, y + 24, w, h, 16); c.fill();
  yearPage(c, x, y, w, h, String(cur), head);
  for (let yr = from; yr < cur; yr++) {                   // the torn pages, falling away
    const tt = K.t - (t0 + (yr - from + 1) / (n + 1) * (t1 - t0)); if (tt > 0.4 || tt < 0) continue;
    c.save(); c.globalAlpha = clamp(1 - tt * 2.5); const sd = yr % 2 ? 1 : -1;
    c.translate(x + w / 2 + sd * tt * 900, y + h / 2 + tt * 600 + tt * tt * 5000); c.rotate(sd * tt * 3); c.translate(-(x + w / 2), -(y + h / 2));
    yearPage(c, x, y, w, h, String(yr), head); c.restore();
  }
  return cur;
}
const WHEEL = ["2027", "2028", "Q3", "2029", "2030", "NEVER", "SOON", "2031"];
function spinWheel(c, K, cx, cy, r, landAt) {
  const n = WHEEL.length, seg = Math.PI * 2 / n, target = WHEEL.indexOf("NEVER");
  const end = -Math.PI / 2 - (target + 0.5) * seg + Math.PI * 2 * 7, u = clamp((K.t - K.t0) / Math.max(0.1, landAt - K.t0)), a = end - Math.PI * 2 * 7 * Math.pow(1 - u, 3);
  c.fillStyle = "rgba(21,19,26,0.35)"; c.beginPath(); c.arc(cx + 22, cy + 26, r + 20, 0, 7); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, r + 20, 0, 7); c.fill();
  const cols = [P.cyan, P.yellow, P.pink, P.green, P.violet, RED, P.orange, P.sky];
  for (let i = 0; i < n; i++) {
    const a0 = a + i * seg;
    c.fillStyle = cols[i]; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a0 + seg); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
    c.save(); c.translate(cx, cy); c.rotate(a0 + seg / 2);
    c.font = font(Math.round(r * 0.17)); c.fillStyle = WHEEL[i] === "NEVER" ? BONE : INK; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(WHEEL[i], r - 30, 4);
    c.restore();
  }
  c.fillStyle = BONE; c.beginPath(); c.arc(cx, cy, r * 0.14, 0, 7); c.fill(); c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.fillStyle = BONE; c.beginPath(); c.moveTo(cx - 50, cy - r - 60); c.lineTo(cx + 50, cy - r - 60); c.lineTo(cx, cy - r + 40); c.closePath(); c.fill(); c.stroke();
  return u >= 1;
}
function manualCover(c, K, cx, cy, s, rot) {
  c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(s, s);
  c.fillStyle = "rgba(21,19,26,0.35)"; c.fillRect(-340 + 24, -450 + 30, 680, 900);
  c.fillStyle = "#e9e4d8"; c.fillRect(-350, -440, 680, 900);
  c.fillStyle = "#fbf8f0"; c.fillRect(-340, -450, 680, 900); c.lineWidth = 8; c.strokeStyle = INK; c.strokeRect(-340, -450, 680, 900);
  c.fillStyle = INK; c.fillRect(-340, -450, 680, 210);
  c.font = font(120); c.fillStyle = BONE; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("THE MANUAL", 0, -300);
  c.font = font(34, MONO, "600"); c.fillText("HOW TO BUILD A PC  ·  27 STEPS", 0, -262);
  c.font = font(64, SERIF); c.fillStyle = INK; c.fillText("2026 Edition", 0, -120);
  tower(c, K, -140, -60, 280, 360, false, true);
  c.font = font(28, MONO, "600"); c.fillStyle = INK; c.fillText("GPU NOT INCLUDED", 0, 390);
  c.restore();
}
const tower = (c, K, x, y, w, h, lit, empty) => kit.tower(c, K, x, y, w, h, lit, empty);
export const NUMS = ["$1,200", "$800", "$40", "$120", "$45", "$90", "1 TB", "16 GB", "40,000", "48,211", "121", "99%", "90%", "3 YEARS", "$959", "$1,199.99",
  "×9", "×3", "$3,599.97", "$380", "$520", "2028", "2030", "730 DAYS", "95°C", "12.4K", "0 IN STOCK", "1/4 KICK"];
// step 19, "every number in it": the numbers leave the cards and flood the whole frame, one per sixteenth of a beat,
// over the chart and the stickers; from "already" each one is struck through, and "wrong" slams across all of them
function frameFlood(c, t, M) {
  if (t < M.FLOOD0 || t >= M.LAUNCH) return;
  const step = song.BEAT / 4, n = Math.floor((t - M.FLOOD0) / step) + 1;
  for (let i = 0; i < n; i++) {
    const t0 = M.FLOOD0 + i * step, x = 90 + h32(i, 2291) * 1740, y = 170 + h32(i, 2292) * 790, rot = (h32(i, 2293) - 0.5) * 0.5;
    const size = 110 + Math.floor(h32(i, 2294) * 170), s = since(t, t0, 0.05), label = NUMS[i % NUMS.length];
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(1 + s * 0.6, 1 + s * 0.6);
    c.font = font(size); c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillStyle = NIGHT; c.fillText(label, size * 0.05, size * 0.05); c.fillStyle = [BONE, AMBER, CYAN, "#ff3d8b", GREEN][i % 5]; c.fillText(label, 0, 0);
    if (t >= M.STRIKE + i * 0.01) { const tw = c.measureText(label).width, u = easeOut((t - M.STRIKE - i * 0.01) / 0.1); c.fillStyle = RED; c.fillRect(-tw / 2 - 12, -size * 0.4, (tw + 24) * u, size * 0.11); }
    c.restore();
  }
  if (t >= M.WRONG - 0.02) stampAt(c, t, M.WRONG - 0.02, "ALL WRONG", 960, 600, -0.12, RED, 300);
}
// the speed reader: one word of the manual per frame, the focus letter in red, over a reticle
function speedReader(c, K) {
  const A = K.F.v2, f = Math.floor((K.t - K.t0) * 30), word = A.rsvp[Math.max(0, Math.min(A.rsvp.length - 1, f))] ?? "";
  c.strokeStyle = BONE; c.lineWidth = 6;
  c.beginPath(); c.moveTo(260, 380); c.lineTo(1660, 380); c.moveTo(260, 700); c.lineTo(1660, 700); c.moveTo(900, 380); c.lineTo(900, 430); c.moveTo(900, 650); c.lineTo(900, 700); c.stroke();
  c.font = font(200); c.textBaseline = "alphabetic"; c.textAlign = "left";
  const piv = Math.min(word.length - 1, Math.max(0, Math.floor((word.length - 1) * 0.35))), pre = word.slice(0, piv), pw = c.measureText(pre).width, cw = c.measureText(word[piv] ?? "").width;
  const x0 = 900 - pw - cw / 2;
  c.fillStyle = BONE; c.fillText(pre, x0, 620); c.fillStyle = RED; c.fillText(word[piv] ?? "", x0 + pw, 620); c.fillStyle = BONE; c.fillText(word.slice(piv + 1), x0 + pw + cw, 620);
  c.font = font(38, MONO, "600"); c.fillStyle = AMBER; c.textAlign = "center"; c.fillText(`${(1800).toLocaleString("en-US")} WPM  ·  WORD ${Math.min(A.rsvp.length, f + 1)} / ${A.rsvp.length}`, 960, 330);
}

// =====================================================================================================================
// the cards, in the order they cut (fastcut.js's grammar: at = the sung word the card cuts on, WORD#k its k-th time)
// =====================================================================================================================
const HOT = { hot: true };
const V2CARDS = [
  // step twelve: "press 'notify me.' It's free. It's a button. It's a prayer with a bell."
  { n: 12, start: "step", paper: P.green, pat: "rays", rays: [420, 700], draw: (c, K) => stepCard2(c, K, "TWELVE") },
  { n: 12, at: "PRESS", paper: P.red, pat: "stripes", draw: (c, K) => { caption(c, K, { x: 100, y: 250, size: 190, rows: [1, 2], col: BONE, shadow: INK }); notifyButton(c, K, 620, 720, 0.95); } },
  { n: 12, at: "IT'S#0", paper: P.money, pat: "dots", draw: (c, K) => {
    tag(c, K, 700, 60, "$0.00", { t0: K.t0 + 0.05, s: 0.85, sub: "NOTIFY ME" });
    caption(c, K, { x: 1150, y: 300, size: 280, rows: [1, 1], col: BONE, shadow: INK });
  } },
  { n: 12, at: "IT'S#1", paper: P.yellow, pat: "grid", draw: (c, K) => { caption(c, K, { x: 100, y: 280, size: 230, rows: [2, 1], shadow: BONE }); arcadeButton(c, K, 760, 720, 250); } },
  { n: 12, at: "IT'S#2", paper: P.cream, pat: "rays", rays: [1260, 330], draw: (c, K) => {
    prayingHands(c, 1260, 300, 0.62);
    caption(c, K, { x: 100, y: 470, size: 260, rows: [2, 1], shadow: "rgba(21,19,26,0.18)" });
  } },
  { n: 12, at: "WITH", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    steeple(c, K, 560, 560, 0.72);
    caption(c, K, { x: 1060, y: 300, size: 230, rows: [2, 1], col: BONE, shadow: C.cyan });
    pill(c, 100, 1000, "0 NEW NOTIFICATIONS", BONE, INK, 34);
  } },

  // step thirteen: "a podcast. 'Compute is the new oil,' says a man who has never seen a well."
  { n: 13, at: "STEP", paper: P.violet, pat: "grid", draw: (c, K) => stepCard2(c, K, "THIRTEEN", { ink: BONE, pop: INK }) },
  { n: 13, at: "A#0", paper: P.violet, pat: "dots", draw: (c, K) => {
    onAir(c, K, 960, 190);
    mic(c, 520, 700, 0.9, 0.12); mic(c, 980, 700, 0.9, -0.12);
    caption(c, K, { x: 100, y: 980, size: 240, col: BONE, shadow: INK });
    c.font = font(40, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.fillText("THE COMPUTE SHOW  ·  EP. 412", 110, 400);
  } },
  { n: 13, at: "COMPUTE", paper: P.black, pat: "none", draw: (c, K) => {
    man(c, 620, 560, 1.05, { col: "#2a2632" }); mic(c, 900, 830, 0.7, -0.35);
    c.fillStyle = "rgba(244,241,234,0.25)"; c.fillRect(0, 118, W, 8); c.fillStyle = RED; c.fillRect(0, 118, W * clamp((K.t - K.t0) / 0.9), 8);
    tokCaps(c, K, { x: 960, y: 480, size: 220 });
    c.font = font(34, MONO, "600"); c.fillStyle = BONE; c.textAlign = "left"; c.fillText("@thecomputeshow  ·  CLIP", 110, 1000);
  } },
  { n: 13, at: "NEW", paper: P.amber, pat: "rays", rays: [560, 600], draw: (c, K) => {
    pumpjack(c, K, 560, 600, 0.95);
    barrel(c, 860, 900, 150, 200, "COMPUTE"); barrel(c, 1020, 920, 150, 200, "COMPUTE");
    caption(c, K, { x: 1150, y: 450, size: 300, rows: [2], maxW: 720, shadow: BONE });
  } },
  { n: 13, at: "SAYS", paper: P.cyan, pat: "dots", draw: (c, K) => {
    man(c, 900, 430, 0.62);
    lowerThird(c, 110, 860, "A MAN", "HAS NEVER SEEN A WELL");
    caption(c, K, { x: 100, y: 250, size: 180, rows: [3, 2], maxW: 1000, shadow: BONE });
  } },
  { n: 13, at: "NEVER", paper: P.sky, pat: "none", draw: (c, K) => {
    wishingWell(c, K, 720, 660, 0.9); bigQuestion(c, K, 1180, 520, 420);
    caption(c, K, { x: 100, y: 250, size: 180, rows: [2, 2], shadow: BONE });
  } },

  // step fourteen: "read the CEO. 'We're grateful to the gaming community. Enterprise is now our target. Also, thanks for
  // the jacket!'" (the creator's art, the mosaic on his face; the flip lands 3 frames before ALSO, the creator's ruling, 9/26)
  { n: 14, at: "STEP", paper: P.lilac, pat: "rays", rays: [420, 700], draw: (c, K) => stepCard2(c, K, "FOURTEEN") },
  { n: 14, at: "READ", paper: P.black, pat: "none", draw: (c, K) => {
    c.fillStyle = "#1d1a24"; rr(c, 180, 110, 1560, 560, 20); c.fill();
    c.font = font(160); c.fillStyle = "rgba(244,241,234,0.12)"; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("KEYNOTE 2026", 960, 450);
    spot(c, 820, 0, 820, 320);
    const e = easeOut((K.t - K.t0) / 0.35);
    ceoAt(c, K, "suit", lerp(1100, 820, e), 1040, 900);
    caption(c, K, { x: 100, y: 330, size: 200, rows: [1, 1, 1], col: BONE, shadow: RED });
  } },
  { n: 14, at: "WE'RE", paper: P.lilac, pat: "dots", draw: (c, K) => {
    thankYou(c, K, 600, 560);
    caption(c, K, { x: 1150, y: 220, size: 150, rows: [2, 2], maxW: 720, shadow: BONE });
  } },
  { n: 14, at: "GAMING", paper: P.pink, pat: "rays", rays: [640, 560], draw: (c, K) => {
    const e = easeOutBack((K.t - K.t0) / 0.25) * (1 + K.k * 0.05);
    heart(c, 640, 620, e * 1.2); padGlyph(c, 640, 600, e * 0.9);
    caption(c, K, { x: 1150, y: 250, size: 170, rows: [1, 1], maxW: 740, shadow: BONE });
  } },
  { n: 14, at: "ENTERPRISE", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    kit.hall(c, K, { key: "halls", x: 1320, y: 620, w: 980, rot: 0.03, shadow: "rgba(255,42,61,0.55)" });
    caption(c, K, { x: 100, y: 330, size: 250, rows: [1, 2], col: BONE, shadow: RED });
  } },
  { n: 14, at: "OUR", paper: P.cream, pat: "rays", rays: [1520, 470], draw: (c, K) => {
    const also = K.w("ALSO"), flipEnd = also.t - 3 / 30, flip0 = flipEnd - 0.26, mid = (flip0 + flipEnd) / 2;
    const tg = K.w("TARGET"), lock = tg ? clamp((K.t - tg.t) / 0.25) : 0;
    bullseye(c, K, 1520, 470, 360);
    const at = tt => tt < flip0 ? { sx: 1, j: false } : tt < mid ? { sx: Math.cos(Math.PI / 2 * Math.pow((tt - flip0) / (mid - flip0), 2)), j: false }
      : tt < flipEnd ? { sx: Math.sin(Math.PI / 2 * easeOut((tt - mid) / (flipEnd - mid))), j: true } : { sx: 1, j: true };
    if (K.t >= flip0 && K.t < flipEnd + 0.18) [0, 1, 2, 3].forEach(i => {   // afterimages through the flip, green and red
      const was = at(K.t - (i + 1) * 0.025);
      ceoAt(c, K, was.j ? "jacket" : "suit", 1060 + (i + 1) * 18, 1060, 960, { sx: Math.max(0.02, was.sx), ghost: i % 2, alpha: 0.5 * (1 - i / 4) * (K.t < flipEnd ? 1 : 1 - (K.t - flipEnd) / 0.18) });
    });
    const now = at(K.t);
    ceoAt(c, K, now.j ? "jacket" : "suit", 1060, 1060, 960, { sx: Math.max(0.02, now.sx) });
    reticle(c, K, 1520, 470, 110, lock);
    caption(c, K, { x: 100, y: 330, size: 200, rows: [1, 1, 1], hot: ["ALSO"], shadow: "rgba(21,19,26,0.2)" });
    return { flash: since(K.t, flipEnd, 0.14) * 0.8, invert: K.t >= flipEnd && K.t < flipEnd + 2 / 30 ? 1 : 0 };
  } },
  { n: 14, at: "THANKS", paper: P.gold, pat: "rays", rays: [1240, 520], draw: (c, K) => {
    ceoAt(c, K, "jacket", 1240, 1380, 1300);
    sparkles(c, K, 1240, 480, 900);
    caption(c, K, { x: 100, y: 300, size: 210, rows: [1, 2, 1], hot: ["JACKET"], shadow: BONE });
  } },

  // step fifteen: "a bot buys nine in the second it takes your thumb to move, then sells you one at triple. That's the racket."
  { n: 15, at: "STEP", paper: P.red, pat: "speed", draw: (c, K) => stepCard2(c, K, "FIFTEEN", { ink: INK, pop: BONE }) },
  { n: 15, at: "A#0", paper: P.violet, pat: "grid", draw: (c, K) => {
    botFace(c, 470, 720, 430, C.red);
    const buys = K.w("BUYS"), t0 = buys ? buys.t - 0.02 : K.t0 + 0.2;
    for (let j = 0; j < 9; j++) { if (K.t < t0 + j * 0.025) continue; toast(c, lerp(1960, 1040, easeOut((K.t - t0 - j * 0.025) / 0.1)), 120 + j * 92, 40 + j, 1, 1, 0, 0.82); }
    const nine = K.w("NINE"); if (nine && K.t >= nine.t - 0.03) burst(c, 860, 360, 190 * easeOutBack((K.t - nine.t) / 0.12), 18, P.yellow, INK, "×9", 150, -0.1);
    caption(c, K, { x: 100, y: 250, size: 190, rows: [3, 1], shadow: INK, col: BONE });
  } },
  { n: 15, at: "IN", paper: P.yellow, pat: "stripes", draw: (c, K) => { stopwatch(c, K, 1260, 580, 360); caption(c, K, { x: 100, y: 400, size: 250, rows: [2, 1], shadow: BONE }); } },
  { n: 15, at: "IT", paper: P.cream, pat: "dots", draw: (c, K) => {
    const mv = K.w("MOVE"), gone = mv && K.t >= mv.t;
    phoneBuy(c, K, 1420, 580, 820, gone);
    const u = clamp((K.t - K.t0) / Math.max(0.3, K.t1 - K.t0)); thumb(c, lerp(760, 1260, u * 0.45), lerp(1010, 820, u * 0.45), 0.85, 0.9);
    c.font = font(40, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.fillText("SLOW MOTION  ×0.25", 110, 560);
    caption(c, K, { x: 100, y: 250, size: 150, rows: [3, 3], shadow: BONE });
  } },
  { n: 15, at: "THEN", paper: P.money, pat: "grid", draw: (c, K) => {
    listing(c, K, 980, 110, 820, 860, "$1,199.99");
    caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 2, 1], maxW: 820, col: BONE, shadow: INK });
  } },
  { n: 15, at: "ONE", paper: P.cyan, pat: "grid", draw: (c, K) => {
    slam(c, K, K.t0 + 0.03, "1", 700, 900, 820, BONE, { shadow: INK });
    stamp(c, K, K.t0 + 0.12, "LIMIT 1 PER CUSTOMER", 1320, 420, -0.12, RED, 90, null);
    c.font = font(52, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("QTY: 1  (THE BOT GOT 9)", 1030, 700);
    caption(c, K, { x: 1030, y: 950, size: 200, shadow: BONE });
  } },
  { n: 15, at: "TRIPLE", paper: P.red, pat: "rays", draw: (c, K) => {
    c.font = font(110, MONO, "600"); c.fillStyle = "rgba(244,241,234,0.7)"; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText("$1,199.99", 960, 330);
    const s1 = K.t >= K.t0 + 0.12; if (s1) { c.fillStyle = INK; c.fillRect(700, 290, 520, 16); burst(c, 1420, 300, 160 * easeOutBack((K.t - K.t0 - 0.12) / 0.1), 16, P.yellow, INK, "×3", 130, 0.12); }
    if (K.t >= K.t0 + 0.24) slam(c, K, K.t0 + 0.24, "$3,599.97", 960, 760, 330, BONE, { shadow: INK, pop: 0.5 });
    caption(c, K, { x: 960, y: 1000, size: 170, align: "center", col: INK, shadow: BONE });
  } },
  // the racket: the kick stops for 2.4 s and the market halts. The one still card of the verse: see-through, over the
  // frozen chart; it reopens (the next card) on the kick, as the streamer says "just buy last gen"
  { n: 15, at: "THAT'S", paper: null, pat: "none", calm: true, halt: true, draw: (c, K) => {
    const u = clamp((K.t - K.t0) / 0.12);
    c.fillStyle = `rgba(11,10,15,${0.62 * u})`; c.fillRect(0, 0, W, H);
    const s = lerp(1.4, 1, easeOut((K.t - K.t0) / 0.09));
    c.save(); c.translate(960, 560); c.scale(s, s); c.translate(-960, -560);
    c.fillStyle = P.yellow; c.fillRect(-BLEED, 380, W + 2 * BLEED, 340);
    c.fillStyle = INK; for (let x = -BLEED; x < W + BLEED; x += 90) { c.beginPath(); c.moveTo(x, 380); c.lineTo(x + 45, 380); c.lineTo(x + 5, 420); c.lineTo(x - 40, 420); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x, 680); c.lineTo(x + 45, 680); c.lineTo(x + 5, 720); c.lineTo(x - 40, 720); c.closePath(); c.fill(); }
    c.fillStyle = INK; c.fillRect(-BLEED, 420, W + 2 * BLEED, 260);
    c.font = font(200); c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = RED; c.fillText("TRADING HALTED", 960, 630);
    c.restore();
    c.font = font(34, MONO, "600"); c.fillStyle = P.yellow; c.textAlign = "center"; c.fillText("LIMIT UP  ·  CIRCUIT BREAKER  ·  REASON: RACKET", 960, 340);
    caption(c, K, { x: 960, y: 850, size: 110, align: "center", serif: true, col: BONE });
    const st = K.at(16, "STEP"), re = K.card.t1 + LEAD;
    if (st && K.t >= st.t - 0.03) { c.font = font(40, MONO, "600"); c.fillStyle = BONE; c.fillText(`STEP 16 / 27  ·  TRADING RESUMES IN ${Math.max(0, re - K.t).toFixed(2)}`, 960, 960); }
  } },

  // step sixteen: "'Just buy last gen,' says a man with this gen, on a stream, in a ring light, to a cam."
  { n: 16, kickFrom: "STEP", paper: P.black, pat: "none", draw: (c, K) => {
    stream(c, K, { card: false });
    caption(c, K, { x: 110, y: 860, size: 170, col: BONE, shadow: INK });
  } },
  { n: 16, at: "SAYS", paper: P.cyan, pat: "grid", draw: (c, K) => {
    c.fillStyle = "#2a2632"; c.fillRect(900, 600, 1000, 30);
    printAt(c, K, "rtx3090", 1420, 470, 820, -0.05, { off: 22, shadow: "rgba(25,219,115,0.8)" });
    man(c, 1350, 720, 0.8);
    const tw = K.w("THIS"); if (tw && K.t >= tw.t - 0.03) { slam(c, K, tw.t - 0.03, "THIS GEN", 1500, 230, 110, RED, { rot: 0.08, shadow: INK }); c.fillStyle = RED; c.beginPath(); c.moveTo(1500, 260); c.lineTo(1460, 330); c.lineTo(1540, 330); c.closePath(); c.fill(); }
    caption(c, K, { x: 100, y: 280, size: 190, rows: [3, 3], maxW: 820, shadow: BONE });
  } },
  { n: 16, at: "ON", paper: P.pink, pat: "dots", draw: (c, K) => {
    const s = easeOutBack((K.t - K.t0) / 0.2);
    c.save(); c.translate(960, 470); c.scale(s, s);
    c.fillStyle = INK; rr(c, -520 + 20, -150 + 24, 1040, 300, 60); c.fill(); c.fillStyle = RED; rr(c, -520, -150, 1040, 300, 60); c.fill();
    c.fillStyle = BONE; c.beginPath(); c.arc(-330, 0, 60, 0, 7); c.fill(); c.font = font(230); c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("LIVE", -220, 14);
    c.restore();
    for (let i = 0; i < 18; i++) { const u = ((K.t - K.t0) * 1.6 + h32(i, 2281)) % 1, x = 300 + h32(i, 2282) * 1320 + Math.sin(K.t * 5 + i) * 30, y = 1080 - u * 900; heart(c, x, y, 0.12 + h32(i, 2283) * 0.1, ["#ff3d8b", RED, BONE][i % 3]); }
    c.font = font(60, MONO, "600"); c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText(`${Math.round(124812 + (K.t - K.t0) * 80000).toLocaleString("en-US")} WATCHING`, 960, 760);
    caption(c, K, { x: 960, y: 1000, size: 190, align: "center", col: BONE, shadow: INK });
  } },
  { n: 16, at: "IN", paper: P.black, pat: "none", draw: (c, K) => {
    ringLight(c, K, 960, 470, 300);
    man(c, 960, 520, 0.62, { col: "#08070b", phoneCol: "#2a2632" });
    caption(c, K, { x: 960, y: 1010, size: 170, align: "center", col: BONE, shadow: "#7a4dff" });
  } },
  { n: 16, at: "TO", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    lens(c, K, 1250, 540, 400);
    const on = Math.floor(K.t * 2) % 2 === 0;
    c.font = font(50, MONO, "600"); c.fillStyle = RED; c.textAlign = "left"; c.textBaseline = "alphabetic";
    if (on) { c.beginPath(); c.arc(130, 170, 18, 0, 7); c.fill(); }
    c.fillText("REC  00:00:31", 170, 188);
    caption(c, K, { x: 100, y: 560, size: 280, rows: [2, 1], col: BONE, shadow: RED });
  } },

  // step seventeen: "last gen's a used card from a mine that ran hot for two years, and last gen's price went up too. Even the RAM."
  { n: 17, at: "STEP", paper: P.orange, pat: "rays", rays: [420, 700], draw: (c, K) => stepCard2(c, K, "SEVENTEEN") },
  { n: 17, at: "LAST#0", paper: P.sepia, pat: "dots", draw: (c, K) => {
    printAt(c, K, "gtx1080ti", lerp(2300, 1240, easeOutBack((K.t - K.t0) / 0.3)), 610, 1180, -0.07, { off: 24 });
    pill(c, 1000, 250, "LAST GEN", INK, AMBER, 60);
    caption(c, K, { x: 100, y: 420, size: 230, rows: [2, 1], shadow: "#f6efdc" });
  } },
  { n: 17, at: "USED", paper: P.cream, pat: "stripes", draw: (c, K) => {
    printAt(c, K, "gtx1080ti", 1240, 610, 1180, 0.05, { off: 24 });
    stamp(c, K, K.t0 + 0.04, "USED", 1280, 620, -0.2, RED, 240, "#f1e9d8");
    c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("LIKE NEW*   *IT IS NOT", 1000, 1000);
    caption(c, K, { x: 100, y: 400, size: 260, rows: [1, 1], shadow: BONE });
  } },
  { n: 17, at: "FROM", paper: P.cyan, pat: "grid", draw: (c, K) => {
    printAt(c, K, "v2-mine", 1180, 560, 1300, 0.04, { off: 24 });
    c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillText(`HASHRATE  ${(97 + Math.sin(K.t * 20) * 2).toFixed(1)} MH/s`, 110, 900);
    c.fillText("UPTIME    730 DAYS  ·  24/7", 110, 960);
    caption(c, K, { x: 100, y: 330, size: 260, rows: [2, 1], shadow: BONE });
  } },
  { n: 17, at: "THAT", paper: P.black, pat: "none", draw: (c, K) => {
    printAt(c, K, "v2-heat", 1180, 560, 1300, -0.05, { off: 0 });
    const tC = Math.round(lerp(61, 104, easeOut((K.t - K.t0) / 0.45))), hot = tC >= 95;
    slam(c, K, K.t0 + 0.05, `${tC}°C`, 1550, 1000, 170, hot && Math.floor(K.t * 12) % 2 ? RED : BONE, { shadow: INK, pop: 0 });
    caption(c, K, { x: 100, y: 330, size: 260, rows: [2, 1], hot: ["HOT"], col: BONE, shadow: RED });
  } },
  { n: 17, at: "FOR", paper: P.yellow, pat: "stripes", draw: (c, K) => {
    const d = Math.round(lerp(0, 730, easeOut((K.t - K.t0) / 0.5)));
    odometer(c, K, 820, 700, d, "DAYS");
    caption(c, K, { x: 100, y: 330, size: 240, rows: [2, 1], shadow: BONE });
  } },
  { n: 17, at: "AND", paper: P.black, pat: "none", draw: (c, K) => {
    printAt(c, K, "gtx1080ti", 1250, 560, 1050, -0.05, { off: 20, shadow: "rgba(255,178,30,0.8)" });
    tag(c, K, 1600, 120, "$380", { t0: K.t0 + 0.05, s: 0.55, sub: "LAST GEN, USED" });
    caption(c, K, { x: 100, y: 400, size: 230, rows: [1, 2], col: BONE, shadow: AMBER });
  } },
  { n: 17, at: "PRICE", paper: P.red, pat: "rays", rays: [1380, 560], draw: (c, K) => {
    tag(c, K, 1380, 120, "$520", { old: "$380", t0: K.t0 + 0.05, s: 0.8, col: RED, sub: "LAST GEN, USED" });
    const up = K.w("UP"); if (up && K.t >= up.t - 0.03) burst(c, 1690, 240, 130 * easeOutBack((K.t - up.t) / 0.12), 16, P.yellow, INK, "+37%", 80, 0.12);
    caption(c, K, { x: 100, y: 330, size: 220, rows: [2, 2], maxW: 900, col: BONE, shadow: INK });
  } },
  { n: 17, at: "EVEN", paper: P.black, pat: "none", draw: (c, K) => {
    const r = K.w("RAM"), hot = r && K.t >= r.t - 0.03;
    printAt(c, K, "ddr4-16g", 1180, 620, 1300, -0.05, { off: 22, shadow: hot ? "rgba(255,42,61,0.9)" : "rgba(244,241,234,0.25)" });
    if (hot) { const pr = K.F.prints["ddr4-16g"].print, w = 1300, h = w * pr.height / pr.width; c.save(); c.translate(1180, 620); c.rotate(-0.05); c.globalAlpha = 0.45 + 0.2 * Math.sin(K.t * 30); c.drawImage(silhouette(K.F, "ddr4-16g", RED), -w / 2, -h / 2, w, h); c.restore(); }
    if (hot) burst(c, 1600, 320, 140 * easeOutBack((K.t - r.t) / 0.12), 16, P.yellow, INK, "$120", 80, 0.1);
    caption(c, K, { x: 100, y: 330, size: 260, rows: [2, 1], hot: ["RAM"], col: BONE, shadow: INK });
  } },

  // step eighteen: "ask when it ends. One store says 'twenty-twenty-eight.' The other says 'past twenty-thirty.' Take your pick."
  { n: 18, at: "STEP", paper: P.yellow, pat: "rays", rays: [420, 700], draw: (c, K) => stepCard2(c, K, "EIGHTEEN") },
  { n: 18, at: "ASK", paper: P.sky, pat: "none", draw: (c, K) => { chat(c, K, K.words); caption(c, K, { x: 100, y: 1000, size: 200, shadow: BONE }); } },
  { n: 18, at: "ONE", paper: null, pat: "none", draw: (c, K) => {
    const t1 = K.w("TWENTY#0"), t2 = K.w("TWENTY#1"), e8 = K.w("EIGHT");
    const said = [t1, t2, e8].filter(x => x && K.t >= x.t - 0.03).length;
    storeSign(c, K, 1250, 560, [{ text: ["", "20", "202", "2028"][said], t: t1 ? t1.t : 9e9 }]);
    c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("STORE #1", 110, 150);
    caption(c, K, { x: 100, y: 330, size: 180, rows: [3, 3], maxW: 800, shadow: BONE });
  } },
  { n: 18, at: "THE", paper: null, pat: "none", draw: (c, K) => {
    storeSign(c, K, 1250, 560, [{ text: "???", t: K.t0 + 0.15, col: INK }], { rot: 0.04, glass: "#f0b8d0" });
    c.font = font(46, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText("STORE #2", 110, 150);
    caption(c, K, { x: 100, y: 330, size: 210, rows: [2, 1], shadow: BONE });
  } },
  { n: 18, at: "PAST", paper: P.violet, pat: "grid", draw: (c, K) => {
    const past = K.w("PAST"), thirty = K.w("THIRTY");
    yearFlip(c, K, 1000, 150, 720, 780, past ? past.t : K.t0 + 0.5, thirty ? thirty.t : K.t0 + 1.2, 2026, 2031, "RESTOCK AFTER");
    caption(c, K, { x: 100, y: 400, size: 220, rows: [1, 2], maxW: 820, col: BONE, shadow: INK });
  } },
  { n: 18, at: "TAKE", paper: P.green, pat: "rays", rays: [1180, 560], draw: (c, K) => {
    const pk = K.w("PICK"), landed = spinWheel(c, K, 1180, 580, 400, pk ? pk.end - 0.08 : K.t0 + 0.6);
    if (landed) burst(c, 1180, 580, 150, 16, RED, INK, "NEVER", 60, -0.1, BONE);
    caption(c, K, { x: 100, y: 330, size: 250, rows: [2, 1], shadow: BONE });
  } },

  // step nineteen: "this manual was written in twenty-twenty-six, so every number in it is already wrong. Read it quick."
  // (the cards pile up as stickers; the kick stops at "already"; "read it quick" is a speed reader and the line leaves)
  { n: 19, at: "STEP", paper: P.pink, pat: "rays", rays: [420, 700], draw: (c, K) => stepCard2(c, K, "NINETEEN") },
  { n: 19, at: "THIS", paper: P.cyan, pat: "grid", draw: (c, K) => { manualCover(c, K, 1250, 540, 1, 0.05); caption(c, K, { x: 100, y: 440, size: 290, rows: [1, 1], shadow: BONE }); } },
  { n: 19, at: "WAS", paper: P.cream, pat: "stripes", draw: (c, K) => {
    c.fillStyle = "#fbf8f0"; c.fillRect(160, 560, 1600, 360); c.lineWidth = 6; c.strokeStyle = INK; c.strokeRect(160, 560, 1600, 360);
    const line = "Step 19: this manual was written in", n = Math.round(clamp((K.t - K.t0) / 0.55) * line.length);
    c.font = font(56, MONO, "600"); c.fillStyle = INK; c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillText(line.slice(0, n) + (Math.floor(K.t * 4) % 2 ? "_" : ""), 220, 760);
    caption(c, K, { x: 100, y: 300, size: 220, rows: [2, 1], shadow: BONE });
  } },
  { n: 19, at: "TWENTY#0", paper: P.yellow, pat: "rays", draw: (c, K) => {
    slam(c, K, K.t0 + 0.04, "2026", 960, 700, 520, INK, { shadow: BONE });
    stamp(c, K, K.t0 + 0.3, "PRINTED", 1450, 300, 0.15, RED, 130, "#ffd21e");
    subtitle(c, K, { size: 80, y: 940 });
  } },
  { n: 19, at: "SO", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    manualCover(c, K, 1380, 560, 0.9, 0.06);                   // (the numbers themselves flood the whole frame: frameFlood)
    c.fillStyle = "rgba(11,10,15,0.88)"; c.fillRect(-BLEED, 440, W + 2 * BLEED, 420);
    caption(c, K, { x: 960, y: 640, size: 200, align: "center", rows: [2, 4], col: BONE, shadow: RED });
  } },
  { n: 19, at: "ALREADY", paper: P.navy, pat: "gridlight", draw: (c, K) => {
    manualCover(c, K, 1380, 560, 0.9, 0.06);
    const wr = K.w("WRONG"), th = wr ? stamp(c, K, wr.t - 0.02, "WRONG", 960, 640, -0.14, RED, 330, null) : 0;
    c.fillStyle = "rgba(11,10,15,0.88)"; c.fillRect(-BLEED, 70, W + 2 * BLEED, 230);
    caption(c, K, { x: 960, y: 250, size: 170, align: "center", only: ["ALREADY"], col: BONE, shadow: RED });
    return { flash: th * 0.6 };
  } },
  { n: 19, after: "WRONG", paper: P.black, pat: "none", big: true, draw: (c, K) => {
    speedReader(c, K);
    caption(c, K, { x: 960, y: 980, size: 200, align: "center", col: P.yellow, shadow: RED });
  } },
];

// =====================================================================================================================
// the plan and one frame
// =====================================================================================================================
export function marketPlan(STEP) {
  const plan = fastPlan(STEP, [12, 13, 14, 15, 16, 17, 18, 19], V2CARDS);
  if (!plan) return null;
  // the verse's first frame: the chorus's shot hands over here (the AltMan leaves as the verse arrives)
  const v2 = song.sections.filter(s => s.kind === "verse")[1];
  plan.t0 = plan.cards[0].t0 = Math.min(plan.cards[0].t0, v2.t0 - 0.35);
  plan.M = buildModel(plan);
  layout(plan, plan.M);
  return plan;
}
export function marketTimes(plan) {
  if (!plan) return [];
  const M = plan.M;
  return [...fastTimes(plan), ...M.EV.flatMap(e => [e.te + 0.02, e.te + 0.2]), M.TK1 + 0.02, M.HALT0 + 0.3, M.LAUNCH + 0.2, M.FC0 + 0.4, (M.LAUNCH + M.END) / 2];
}

export function marketCut(t, S, plan) {
  const M = plan.M, F = S.fastArt;
  if (!F.v2) initArt(S, F);
  const c = fastLayer(S), L = F.layer;
  let card = plan.cards[0];
  for (const cd of plan.cards) if (t >= cd.t0) card = cd;
  const st = chartState(M, t), fx = { flash: 0, invert: 0, glitch: 0, ca: 0 };
  const add = o => { if (o) for (const k in fx) fx[k] += o[k] ?? 0; };
  if (t < M.TK1) {
    // steps 12-13: the card owns the frame, the chart is the ticker in the corner; at "Enterprise" it takes the frame
    add(cardFrame(c, t, card, F));
    const R = t < M.TK0 ? pipRect(st.price) : lerpRect(pipRect(LV[0].hi), FULL, easeIn((t - M.TK0) / (M.TK1 - M.TK0)));
    c.save();
    c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(R.x + 12, R.y + 16, R.w, R.h);
    c.fillStyle = BONE; c.fillRect(R.x - 6, R.y - 6, R.w + 12, R.h + 12);
    drawChart(c, t, M, st, R);
    c.restore();
  } else {
    drawChart(c, t, M, st, FULL, { edge: false });
    const G = geom(M, t, FULL);
    if (card.mode === "halt") { c.save(); edge(c, t, M, st, G); c.restore(); add(cardFrame(c, t, card, F)); }
    else {
      if (card.mode === "sticker") for (const p of [card.prev?.prev, card.prev]) if (p && p.mode === "sticker") drawWin(c, p.t1 - 1 / 60, p, F, p.win, true);
      add(drawWin(c, t, card, F, card.win));
      c.save(); frameFlood(c, t, M); c.restore();
      c.save(); edge(c, t, M, st, G); c.restore();          // the live edge punches through the cards
    }
  }
  c.save(); furniture2(c, t, card, st); c.restore();
  L.end();
  // the film: the cut (as the fast cut), and the chart's events (the axis giving up, the takeover, the reopening)
  const k = song.kickEnv(t, 0.12), cut = since(t, card.win?.slamT ?? card.t0, 0.045);
  for (const e of M.EV) if (t >= e.te) { const s = since(t, e.te, 0.12); fx.flash += s * 0.45; fx.ca += s * 0.01; fx.glitch += s * 0.3; }
  if ((t >= M.TK1 && t < M.TK1 + 2 / 30) || (t >= M.REOPEN && t < M.REOPEN + 2 / 30)) fx.invert = 1;
  if (t >= M.BREAK) {                                     // the pre-drop: the picture comes apart, harder every sixteenth
    const u = clamp((t - M.BREAK) / (M.END - M.BREAK)), q = Math.floor((t - M.BREAK) / (song.BEAT / 4)), tq = M.BREAK + q * song.BEAT / 4;
    fx.glitch += 0.06 + u * 0.4 + since(t, tq, 0.03) * (0.15 + u * 0.35); fx.ca += u * 0.012;
  }
  if (t >= M.WRONG - 0.02 && t < M.WRONG + 2 / 30) fx.invert = 1;
  return { flash: fx.flash + (card.calm ? 0 : cut * 0.25), invert: Math.min(1, fx.invert), glitch: fx.glitch + (card.calm ? 0 : cut * 0.35 + k * 0.05),
    ca: fx.ca + 0.0012 + k * 0.0035 + cut * 0.012 };
}
