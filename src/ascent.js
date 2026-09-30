// Verse 2, steps 12-19: THE ASCENT.
//
// The creator's brief, 9/27 15:20, after the terminal version came out as a cover of its reference ("it just felt really out of
// place, as if that guy's Evangelion-themed project was just shoved in for ours"): "What I envision is the price chart
// being the focus, and as it climbs, panic also climbs up. Chromatic aberration. Fancy, technical diagrams, and the
// chaos of the brainrot style with motion graphics text and diagrams." Earlier, 14:46: "one of them diagram-y scenes
// exploring 3D space, with like a trail, but the trail is the climbing GPU/RAM prices + plus the brain rot chaos."
//
// So: the chart is not a panel any more, it is the SET. The price is a trail through 3D space and the camera flies it.
// The model is the same one as last night (market.js buildModel -- a candle per kick, the axis giving up six times,
// nothing invented in seconds), but the y of every point is the axis's own mapping, which means the moment the axis
// gives up, everything already climbed FLATTENS to a tenth of its height and drops away under the camera as a floor.
// Six times. By step 19 there are six broken ceilings in the dark below, each one labelled with the price it was.
//
// PANIC is one number, measured, and it drives the whole film: chromatic aberration, shake, grain, tear, how many
// instruments are lit, how red the space is. It climbs with the axis, spikes on every event, and HOLDS (does not fall)
// through the trading halt, which is the verse's one still moment.
//
// The diagrams are draughting, not clip art (the creator's "MS-paint" note on the last two versions): the whole verse sits on a
// drawing sheet with a title block, and every step's apparatus is a real drawing idiom -- an exploded axonometric, a
// section with hatching, a signal-flow graph, a timing diagram, a ray diagram, isotherms, a revision block.
// The brainrot stays: every sung phrase cuts the camera to a new station and slams its words in (blueprint.js draws
// the lines, this file directs). A pure function of song time, like the rest of the video.
//
//   12 THE ALERT KEY    the drawing sheet opens; the NOTIFY key exploded, sectioned, dimensioned; the bell's radiation
//   13 THE CLAIM        four sources on a bus all say it; COMPUTE = OIL fails a unit check; the creator's pumpjack and well in section
//   14 THE ALLOCATION   supply as a flow diagram; on "Enterprise" it whips to 97% and THE AXIS GIVES UP the first time
//   15 TIMING           BOT 0.001 s against YOU 2.400 s; the thumb as a linkage; then TRADING HALTED, the one still beat
//   16 THE STREAM       a ray diagram through the lens, the chart in its image plane; the ring light as the synth's spectrum
//   17 DIAGNOSTIC       the used card exploded, its isotherms at 103 C, 17,520 hours; LAST GEN and RAM join as rails
//   18 THE PROJECTION   the data ends and a dotted extrapolation goes on into the dark; two sources disagree; NEVER
//   19 ALL WRONG        the sheet stamps itself SUPERSEDED, every number floods and is struck, the trail leaves the top
import { C, font, MONO, DISPLAY, ctx2d, EXACT } from "./type.js";
import * as song from "./song.js";
import { kit, fastPlan, fastTimes } from "./fastcut.js";
import { makeScreenPrint, level } from "./print.js";
import { buildModel, chartState, initArt as marketArt, money, axisMoney, gainText, START_PRICE, LV, NUMS } from "./market.js";
import { HANDLES } from "./intro.js";
import * as bp from "./blueprint.js";
import { backdrop } from "./rig.js";

const { h32 } = song;
const { W, H, disp, printAt, stamp, slam, rr } = kit;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const k = 1.9; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const fi = t => Math.floor(t * song.FPS + 1e-6);
const mono = (px, w = "600") => font(px, MONO, w);

// the palette: the film's own, never the reference's. One colour per job.
const GREEN = "#19db73", RED = C.red, AMBER = C.amber, CYAN = C.cyan, BONE = "#f4f1ea", INK = "#15131a";
const VOID = "#07060c";                       // the space the trail hangs in

// THE STOCK. Verse 1 changed paper on every cut and that is most of why it reads as fast; the terminal version kept
// one dark screen for forty seconds and measured at half verse 1's rate however hard the cuts were edited. A frame
// that is 85% black cannot change many pixels however far the camera moves -- so the SHEET changes stock instead, in
// the drawing room's own vocabulary rather than candy paper: a dark screen, bone drawing paper, and a blueprint.
// The accents (the green price, the red alarms, the cyan bots, the amber axis) keep their jobs on all three.
const STOCKS = {
  screen: { up: "#19db73", bg: "#07060c", ink: "#f4f1ea", shadow: "#15131a", hair: "rgba(233,228,216,0.5)", dim: "rgba(233,228,216,0.2)",
    faint: "rgba(233,228,216,0.1)", panel: "rgba(7,6,12,0.82)", plate: "rgba(7,6,12,0.5)", grid: "rgba(233,228,216,0.1)" },
  paper:  { up: "#0e8c47", bg: "#e9e4d8", ink: "#15131a", shadow: "rgba(21,19,26,0.22)", hair: "rgba(21,19,26,0.62)", dim: "rgba(21,19,26,0.3)",
    faint: "rgba(21,19,26,0.14)", panel: "rgba(233,228,216,0.9)", plate: "rgba(233,228,216,0.55)", grid: "rgba(21,19,26,0.14)" },
  blue:   { up: "#2bf58a", bg: "#0a2547", ink: "#eaf2ff", shadow: "#061631", hair: "rgba(234,242,255,0.6)", dim: "rgba(234,242,255,0.28)",
    faint: "rgba(234,242,255,0.14)", panel: "rgba(6,22,49,0.86)", plate: "rgba(6,22,49,0.5)", grid: "rgba(234,242,255,0.14)" },
};
let SK = STOCKS.screen;                       // set once per frame from the beat's own stock; pure in t
const DEAL = ["screen", "paper", "screen", "blue"];   // the rotation; a card can name its own
const HAIR = "rgba(233,228,216,0.5)", DIM = "rgba(233,228,216,0.2)", FAINT = "rgba(233,228,216,0.1)";

// =====================================================================================================================
// the space: how a price becomes a point
// =====================================================================================================================
const SP = 0.62;                              // world units along x per candle
const YH = 26;                                // the axis's height, floor to ceiling, in world units
const ZA = 9;                                 // how far the trail snakes through depth
const FOG = 190;                              // where the hairlines fade out
const RAIL_Z = 4.5;                           // LAST GEN in front, RAM behind

const xOf = i => i * SP;
// the snake: two harmonics, so the trail curves through the space instead of lying in one plane, and the camera
// always has something coming toward it
const zOf = i => ZA * (Math.sin(i * 0.062) * 0.78 + Math.sin(i * 0.151 + 1.7) * 0.3);
// the axis's own mapping. This is the whole trick: st.lo/st.hi come from chartState, so when the axis gives up the
// entire trail's y divides by ten in 0.3 s and what was a climb becomes a floor.
const yOf = (st, v) => (v - st.lo) / (st.hi - st.lo) * YH;
const fade = z => Math.max(0.05, Math.exp(-Math.max(0, z) / FOG));
const ptAt = (st, cand, i) => [xOf(i), yOf(st, cand[i].c), zOf(i)];

// =====================================================================================================================
// PANIC: one measured number, 0 at step 12 to 1 at the launch, and everything reads off it
// =====================================================================================================================
// The creator's sentence is the spec: "as it climbs, panic also climbs up." So the baseline is MONOTONE BY CONSTRUCTION, not
// by luck. The first cut read the axis level and the distance to the ceiling as two separate terms, which meant every
// time the axis gave up, the distance-to-ceiling term collapsed and panic FELL at exactly the moment it should have
// jumped (measured: 18 of 160 samples fell). Counting (ceilings broken + how far up this one we are) on one scale
// cannot fall: the fraction only ever goes forward.
export function panicAt(M, t, st) {
  // measured against the SETTLED axis, not the one easing open: for the 0.3 s of the zoom-out the drawn hi is still
  // the old ceiling, so reading st.hi here made panic spike to 2/7 and slide back down as the axis caught up
  const L = LV[Math.min(st.k, LV.length - 1)];
  const ceil = clamp((st.price - L.lo) / (L.hi - L.lo));            // how far up the current ceiling this climb is
  let p = 0.06 + 0.82 * ((st.k + ceil) / (M.EV.length + 1));
  let spike = 0;
  for (const e of M.EV) if (t >= e.te) spike = Math.max(spike, since(t, e.te, 0.42));
  // the halt: the chart is frozen, so p is already constant through it. The alarm still throbs, and panic is HELD
  // rather than spent -- the verse's one still moment is a held breath, not a rest
  if (t >= M.HALT0 && t < M.REOPEN) spike = 0.2 + 0.12 * Math.sin((t - M.HALT0) * 9);
  if (t >= M.BREAK) p = Math.max(p, lerp(0.9, 1, clamp((t - M.BREAK) / Math.max(0.2, M.END - M.BREAK))));
  return { p: clamp(p + spike * 0.16), spike, raw: p };
}

// =====================================================================================================================
// the camera: a station per phrase (a hard cut, the brainrot pace), drifting while it is held
// =====================================================================================================================
// off / look are world offsets from the anchor point (the head of the trail). The trail runs along +x and climbs +y.
// The distances matter more than they look: the eye has to sit BEHIND the stretch of trail it is meant to show, or
// the tail falls behind the near plane and the chart shrinks to a wedge in a corner. The first cut put the eye 19
// units behind a head whose last sixty candles span ninety, and cut off three quarters of its own subject.
const ST = {
  sheet:  { off: [-86, 32, 40],  look: [10, -6, 0],  fov: 40 },     // the establishing plan view
  chase:  { off: [-64, 22, 20],  look: [8, -4, 0],   fov: 38 },
  nose:   { off: [-26, 6, 8],    look: [6, 0, 0],    fov: 34 },
  low:    { off: [-44, -7, 9],   look: [10, 13, 0],  fov: 46 },     // under the climb, looking up it
  side:   { off: [-26, 12, 70],  look: [-12, -4, 0], fov: 34 },     // the flat chart read, from beside
  high:   { off: [-40, 66, 22],  look: [6, -20, 0],  fov: 42 },     // above the snake, looking down
  back:   { off: [40, 15, 14],   look: [-36, -7, 0], fov: 44 },     // past the head, looking back down everything
  rail:   { off: [-50, 7, -30],  look: [10, 4, 9],   fov: 38 },     // low beside the rails
  bench:  { off: [-32, 4, 26],   look: [6, 3, 0],    fov: 32 },
  halt:   { off: [-34, 14, 40],  look: [0, -4, 0],   fov: 34, still: true },
  launch: { off: [-54, 5, 62],   look: [8, 36, 0],   fov: 52 },
};
// the orbit station is computed: it circles the head while the phrase holds
function orbitOff(u) { const a = u * 1.5 + 0.6, r = 50; return { off: [-Math.cos(a) * r, 18 + Math.sin(u * 3) * 5, Math.sin(a) * r], look: [3, -4, 0], fov: 38 }; }

function viewAt(M, t, st, card, PA) {
  const cand = M.cand, i = st.n - 1, anchor = ptAt(st, cand, i);
  const u = clamp((t - card.t0) / Math.max(0.12, card.t1 - card.t0));
  const S = card.cam === "orbit" ? orbitOff(u) : (ST[card.cam] ?? ST.chase);
  let off = [...S.off], look = [...S.look], fov = S.fov;
  // the drift: every station moves while it is held, so no phrase is ever a still picture
  if (!S.still) {
    const d = card.drift ?? 1;
    off[0] += d * (12 + 8 * Math.sin(card.i * 1.3)) * u;
    off[1] += d * (7 * Math.sin(card.i * 0.7 + 1.1)) * u;
    off[2] += d * (14 * Math.cos(card.i * 0.9)) * u;
    fov += d * 3.2 * u;
  }
  // an event: the camera is thrown back so the flattening is SEEN, then comes back in
  let pull = 0;
  for (const e of M.EV) if (t >= e.te - 0.02) pull = Math.max(pull, since(t, e.te - 0.02, 0.5));
  if (pull > 0.002) { const g = 1 + pull * 0.9; off = off.map(v => v * g); off[1] += pull * 22; look[1] -= pull * 9; fov += pull * 9; }
  // the launch: the head leaves through the top and the camera lets it
  const lu = t >= M.LAUNCH ? clamp((t - M.LAUNCH) / Math.max(0.2, M.END - M.LAUNCH)) : 0;
  if (lu > 0) { off[2] += lu * 44; off[1] -= lu * 10; look[1] += lu * 70; fov += lu * 12; }
  // the shake: the kick, scaled by panic. The eye moves, so the whole space shudders and the parallax is real
  const kk = song.lastKick(t), kv = song.kickEnv(t, 0.085), sh = (0.3 + PA.p * 2.6) * kv;
  const jx = kk ? (h32(kk.i, 7701) - 0.5) : 0, jy = kk ? (h32(kk.i, 7702) - 0.5) : 0, jz = kk ? (h32(kk.i, 7703) - 0.5) : 0;
  const eye = [anchor[0] + off[0] + jx * sh * 0.9, anchor[1] + off[1] + jy * sh * 0.9, anchor[2] + off[2] + jz * sh * 0.5];
  const roll = (kk ? (h32(kk.i, 7704) - 0.5) : 0) * sh * 0.02 + (card.roll ?? 0);
  return bp.view({ eye, target: [anchor[0] + look[0], anchor[1] + look[1], anchor[2] + look[2]], fov, roll });
}

// =====================================================================================================================
// the set: the drawing sheet's space -- the floor, the live axis, and the ceilings already broken
// =====================================================================================================================
function drawSpace(c, V, M, t, st, PA) {
  const cand = M.cand, n = st.n, x0 = -8, x1 = xOf(n - 1) + 22;
  const xa = Math.max(x0, xOf(n - 1) - 110), Z = 30;
  // the volume: a ruled floor, a ruled ceiling at the current ceiling price, and a picket of verticals between them.
  // This is the drawing board the trail hangs inside, and it is also what makes a camera cut LOOK like a cut: a move
  // across an empty black frame changes almost no pixels, and the pace instrument reads that as no cut at all.
  c.strokeStyle = PA.p > 0.5 ? `rgba(255,42,61,${0.06 + PA.p * 0.07})` : SK.faint;
  bp.grid3(c, V, { y: 0, x0: xa, x1, z0: -Z, z1: Z, step: SP * 4, stepZ: 5, w: 1, fade, col: c.strokeStyle });
  c.strokeStyle = `rgba(233,228,216,${0.05 + PA.p * 0.03})`;
  bp.grid3(c, V, { y: YH, x0: xa, x1, z0: -Z, z1: Z, step: SP * 16, stepZ: 12, w: 1, fade, col: c.strokeStyle });
  c.strokeStyle = `rgba(233,228,216,${0.07 + PA.p * 0.05})`;
  for (let x = Math.ceil(xa / (SP * 16)) * SP * 16; x <= x1; x += SP * 16)
    for (const z of [-Z, -Z / 2, Z / 2, Z]) bp.poly3(c, V, [[x, 0, z], [x, YH, z]], { w: 1, fade, chunks: 2 });
  // the live axis: five levels as dashed rails running the length of the trail, priced at the near end
  for (let g = 0; g <= 4; g++) {
    const v = st.lo + (st.hi - st.lo) * g / 4, y = yOf(st, v);
    c.strokeStyle = g === 4 ? `rgba(255,178,30,${0.3 + PA.p * 0.3})` : SK.dim;         // the ceiling is the amber one
    bp.poly3(c, V, [[xa, y, 0], [x1, y, 0]], { w: g === 4 ? 1.6 : 1, fade, chunks: 10 });
    const at = V.at([xOf(n - 1) + 9, y, 0]);
    if (at && at.z < 120) {
      bp.lab(c, Math.max(11, Math.min(19, 13 * at.s)), { col: g === 4 ? AMBER : SK.hair });
      c.globalAlpha = fade(at.z) * 0.6; c.fillText(axisMoney(v), at.x + 8, at.y - 4); c.globalAlpha = 1; bp.untrack(c);
    }
  }
  // the ceilings already broken: each one sank to a tenth of its height every time the axis gave up again
  let lastLabelY = -1e9;
  M.EV.forEach((e, k) => {
    if (t < e.te) return;
    const y = yOf(st, LV[k].hi), xa2 = Math.max(x0, xOf(n - 1) - 130), fresh = since(t, e.te, 0.5);
    c.strokeStyle = fresh > 0.02 ? `rgba(25,219,115,${0.35 + fresh * 0.6})` : "rgba(233,228,216,0.3)";
    for (const z of [-ZA * 1.6, ZA * 1.6])
      bp.dash(c, bp.runs(V, [[xa2, y, z], [x1, y, z]])[0] ?? [], [16, 12], { col: c.strokeStyle, w: 1.4 + fresh * 2 });
    // the older ceilings pile into the floor as the axis gives up again, so their labels would print on top of each
    // other: one label per 34 px of sheet, newest first
    const at = V.at([xOf(n - 1) - 15, y, ZA * 1.6]);
    if (at && at.z < 150 && Math.abs(at.y - lastLabelY) > 34) {
      lastLabelY = at.y;
      bp.lab(c, Math.max(10, Math.min(26, 15 * at.s)), { col: c.strokeStyle });
      c.globalAlpha = fade(at.z);
      c.fillText(`CEILING ${String(k + 1).padStart(2, "0")}   ${axisMoney(LV[k].hi)}   BROKEN`, at.x, at.y - 6);
      c.globalAlpha = 1; bp.untrack(c);
    }
  });
}

// =====================================================================================================================
// the trail: the ribbon, the line, the candle posts, and the two rails that join it
// =====================================================================================================================
function drawTrail(c, V, M, t, st, PA) {
  const n = st.n, first = Math.max(0, n - 210);
  const pts = [];
  for (let i = first; i < n; i++) pts.push([xOf(i), yOf(st, st.live(i).c), zOf(i)]);
  if (pts.length < 2) return;
  // the ribbon: the area between the trail and the floor, as a solid so the trail reads as a surface in space
  const floor = [];
  for (let i = n - 1; i >= first; i--) floor.push([xOf(i), 0, zOf(i)]);
  c.save();
  if (bp.path3(c, V, [...pts, ...floor])) {
    const top = V.at(pts[pts.length - 1]), bot = V.at([xOf(n - 1), 0, zOf(n - 1)]);
    const gy0 = top ? top.y : 0, gy1 = bot ? bot.y : H;
    const gr = c.createLinearGradient(0, Math.min(gy0, gy1), 0, Math.max(gy0, gy1) + 400);
    const rib = SK === STOCKS.paper ? "14,140,71" : "25,219,115";
    gr.addColorStop(0, `rgba(${rib},${0.26 + PA.p * 0.14})`); gr.addColorStop(1, `rgba(${rib},0.015)`);
    c.fillStyle = gr; c.fill();
  }
  c.restore();
  // the candle posts: a hairline from the floor to each close, the last stretch only (nearer than that they'd crowd).
  // Batched into one path per direction: 56 separate strokes a frame is the kind of thing that costs a frame
  const postFrom = Math.max(first, n - 85);
  for (const up of [true, false]) {
    c.strokeStyle = up ? (SK === STOCKS.paper ? "rgba(14,140,71,0.7)" : "rgba(25,219,115,0.58)") : "rgba(255,42,61,0.6)";
    c.lineWidth = 1.3; c.beginPath();
    let any = false;
    for (let i = postFrom; i < n; i++) {
      const q = st.live(i);
      if ((q.c >= q.o) !== up) continue;
      const a = V.at([xOf(i), 0, zOf(i)]), b = V.at([xOf(i), yOf(st, q.c), zOf(i)]);
      if (!a || !b) continue;
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); any = true;
    }
    if (any) c.stroke();
  }
  // the wicks on the newest few: the hi/lo as a vertical tick, so the last candles still read as candles
  c.strokeStyle = `rgba(244,241,234,${0.3 + PA.p * 0.3})`; c.lineWidth = 1.4; c.beginPath();
  for (let i = Math.max(first, n - 14); i < n; i++) {
    const q = st.live(i), a = V.at([xOf(i), yOf(st, q.lo), zOf(i)]), b = V.at([xOf(i), yOf(st, q.hi), zOf(i)]);
    if (a && b) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  }
  c.stroke();
  // the line itself: three passes, wide and faint to narrow and hot. It gets a bone core as panic climbs
  c.lineJoin = "round"; c.lineCap = "round";
  c.strokeStyle = SK.up;
  bp.poly3(c, V, pts, { w: 13, alpha: 0.13, fade, world: false, chunks: 14 });
  bp.poly3(c, V, pts, { w: 6, alpha: 0.4, fade, chunks: 14 });
  bp.poly3(c, V, pts, { w: 3.2, alpha: 1, fade, chunks: 14 });
  if (PA.p > 0.3) { c.strokeStyle = SK.ink; bp.poly3(c, V, pts, { w: 1.1, alpha: (PA.p - 0.3) * 1.2, fade, chunks: 14 }); }
  // LAST GEN and RAM: the other two prices, as rails either side, revealed on their words with a run of history
  for (const L of M.lines) {
    if (t < L.t - 0.04) continue;
    const rev = easeOut((t - L.t + 0.04) / 0.32), i0 = Math.max(first, L.from), iEnd = Math.floor(lerp(i0, n - 1, rev));
    if (iEnd <= i0 + 1) continue;
    const zoff = L.name === "RAM" ? RAIL_Z : -RAIL_Z, rp = [];
    for (let i = i0; i <= iEnd; i++) {
      const v = st.live(i).c * L.f((i - i0) / Math.max(1, M.cand.length - i0)) * Math.exp((h32(i, L.seed) - 0.5) * 0.08);
      rp.push([xOf(i), yOf(st, v), zOf(i) + zoff]);
    }
    c.strokeStyle = L.col;
    bp.poly3(c, V, rp, { w: 10, alpha: 0.12, fade, chunks: 12 });
    c.save(); c.setLineDash(L.name === "RAM" ? [18, 9] : [26, 7, 6, 7]);   // each series its own rule, as a key would print
    bp.poly3(c, V, rp, { w: 3.4, alpha: 1, fade, chunks: 12 });
    c.restore();
    const head = V.at(rp[rp.length - 1]);
    if (head) {
      c.fillStyle = L.col; c.beginPath(); c.arc(head.x, head.y, Math.max(3, 5 * Math.min(2, head.s)), 0, 7); c.fill();
      bp.leader(c, head, { x: head.x + 46, y: head.y - 40 }, L.name, { col: L.col, size: 22, sub: L.name === "RAM" ? "+200%" : "+37%" });
    }
  }
}
// the head: where the price is now. A marker, a crosshair, a leader out to the number, and the number is the biggest
// thing on the sheet
function drawHead(c, V, M, t, st, PA, card) {
  const n = st.n, i = n - 1, q = st.live(i), p = [xOf(i), yOf(st, q.c), zOf(i)];
  const at = V.atClamped(p), k = song.kickEnv(t, 0.09);
  const launch = t >= M.LAUNCH ? clamp((t - M.LAUNCH) / Math.max(0.2, M.END - M.LAUNCH)) : 0;
  if (launch > 0) {                                  // "read it quick": the line goes straight up and out of the space
    const top = [xOf(i), yOf(st, q.c) + 40 + 260 * Math.pow(launch, 1.6), zOf(i)];
    c.strokeStyle = GREEN; bp.poly3(c, V, [p, top], { w: 26 * (1 + launch), alpha: 0.22, chunks: 1 });
    bp.poly3(c, V, [p, top], { w: 10 * (1 + launch), alpha: 0.6, chunks: 1 });
    c.strokeStyle = SK.ink; bp.poly3(c, V, [p, top], { w: 3, alpha: 1, chunks: 1 });
  }
  // the marker: a hot ring on the newest candle, brightest right after its kick
  const r = Math.max(6, Math.min(34, 9 * at.s)) * (1 + k * 0.5);
  c.save();
  c.globalAlpha = 0.5 + 0.5 * k; c.fillStyle = SK.up;
  c.beginPath(); c.arc(at.x, at.y, r * 0.42, 0, 7); c.fill();
  c.globalAlpha = 1; c.strokeStyle = SK.ink; c.lineWidth = 2;
  c.beginPath(); c.arc(at.x, at.y, r, 0, 7); c.stroke();
  if (PA.p > 0.45) bp.crosshair(c, at.x, at.y, r * 2.4, { col: RED, alpha: (PA.p - 0.45) * 1.6, brackets: true, ring: false });
  c.restore();
  // the price: leader out of the marker to the number, and the number sits on the sheet in display type
  // The label lives in the words' COLUMN, in the other ROW. The words take one corner, the plate takes the corner
  // diagonally opposite it (zoneFor), and this takes the third: three readable things, never stacked.
  const sy = card?.say?.y ?? 300;
  const sCx = card?.say ? (card.say.align === "center" ? W / 2 : card.say.align === "right" ? card.say.x - 320 : card.say.x + 320) : W / 2;
  const side = card?.priceAt?.side ?? (sCx < W / 2 ? 1 : -1);   // the label reads outward from the words' own side
  const lx = card?.priceAt?.x ?? (side > 0 ? 250 : W - 250), ly = card?.priceAt?.y ?? (sy < H * 0.5 ? H - 240 : 250);
  c.save();
  c.letterSpacing = "0px";                           // the display type is never tracked (a stale lab() must not leak in)
  c.strokeStyle = SK.hair; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(lx, ly - 40); c.lineTo(lx + side * 70, ly - 40); c.stroke();
  const label = priceLabel(M, t, st.price, launch), grow = 1 + since(t, q.a, 0.08) * 0.07;
  c.translate(lx + side * 80, ly); c.scale(grow, grow);
  c.font = font(Math.round(74 + PA.p * 26), DISPLAY); c.textAlign = side > 0 ? "left" : "right"; c.textBaseline = "alphabetic";
  c.fillStyle = SK.shadow; c.fillText(label, 5, 5);
  c.fillStyle = launch > 0.3 || t >= M.SCRAMBLE ? RED : SK.ink; c.fillText(label, 0, 0);
  c.font = mono(24); c.fillStyle = SK.up;
  c.fillText(launch > 0.3 ? "+NaN%" : gainText(st.price), 0, 34);
  c.restore();
  // the event stamp, on the ceiling it just broke
  const e = M.EV.filter(x => t >= x.te).pop();
  if (e && t - e.te < 0.9) {
    const sc = lerp(1.9, 1, easeOut((t - e.te) / 0.1));
    c.save(); c.letterSpacing = "0px"; c.globalAlpha = clamp((t - e.te) / 0.04) * clamp((0.9 - (t - e.te)) / 0.22);
    // it belongs to the ceiling that just broke, so it rides the head -- clamped into the sheet, and never onto
    // the phrase or the price, which own their own thirds of the frame
    const lowWords = (card?.say?.y ?? 300) >= H * 0.5;
    c.translate(Math.min(W - 420, Math.max(420, at.x)),
      lowWords ? clamp(at.y - 190, 210, H * 0.36) : clamp(at.y - 190, H * 0.6, H - 330));
    c.rotate(-0.045); c.scale(sc, sc);
    c.font = font(76, DISPLAY); c.textAlign = "center";
    c.fillStyle = SK.shadow; c.fillText("NEW ALL-TIME HIGH", 5, 5); c.fillStyle = GREEN; c.fillText("NEW ALL-TIME HIGH", 0, 0);
    c.font = mono(26); c.fillStyle = SK.ink; c.fillText(`AXIS × 10   ·   CEILING ${axisMoney(LV[st.k] ? LV[st.k].hi : 0)}`, 0, 40);
    c.restore();
  }
}
function priceLabel(M, t, price, launch) {
  if (launch > 0.3) return "$NaN";
  if (t >= M.SCRAMBLE) { const f = fi(t), d = 4 + Math.floor(h32(f, 3341) * 6); let s = ""; for (let j = 0; j < d; j++) s += Math.floor(h32(f, j, 3342) * 10); return "$" + Number(s).toLocaleString("en-US"); }
  return money(price);
}

// =====================================================================================================================
// the sheet: the drawing furniture that makes all eight steps one document (and never a terminal)
// =====================================================================================================================
const ZONES = "ABCDEFGH";
function sheet(c, t, card, st, M, PA) {
  const m = 30, alarm = PA.p;
  c.save();
  c.lineCap = "butt"; c.lineJoin = "miter"; c.letterSpacing = "0px"; c.setLineDash([]);
  // the border: a double rule with zone letters, the draughtsman's frame
  c.strokeStyle = `rgba(233,228,216,${0.28 + alarm * 0.25})`; c.lineWidth = 2;
  c.strokeRect(m, m, W - 2 * m, H - 2 * m);
  c.lineWidth = 1; c.globalAlpha = 0.55; c.strokeRect(m + 9, m + 9, W - 2 * m - 18, H - 2 * m - 18); c.globalAlpha = 1;
  bp.lab(c, 15, { col: SK.dim, align: "center", baseline: "middle" });
  for (let i = 0; i < 8; i++) { const x = m + 9 + (W - 2 * m - 18) * (i + 0.5) / 8; c.fillText(ZONES[i], x, m + 4.5); c.fillText(ZONES[i], x, H - m - 4.5); }
  for (let i = 0; i < 5; i++) { const y = m + 9 + (H - 2 * m - 18) * (i + 0.5) / 5; c.fillText(String(i + 1), m + 4.5, y); c.fillText(String(i + 1), W - m - 4.5, y); }
  bp.untrack(c);
  // the title block, bottom right: the one piece of furniture that carries the step, the sheet and the alarm
  const bw = 560, bh = 118, bx = W - m - 9 - bw, by = H - m - 9 - bh;
  c.fillStyle = SK.panel; c.fillRect(bx, by, bw, bh);
  c.strokeStyle = `rgba(233,228,216,${0.4 + alarm * 0.3})`; c.lineWidth = 1.4; c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  c.beginPath(); c.moveTo(bx, by + 40); c.lineTo(bx + bw, by + 40); c.moveTo(bx + 330, by + 40); c.lineTo(bx + 330, by + bh);
  c.moveTo(bx, by + 79); c.lineTo(bx + 330, by + 79); c.stroke();
  bp.lab(c, 26, { col: SK.ink }); c.fillText("OUT OF STOCK  ·  THE MANUAL", bx + 12, by + 28);
  const field = (x, y, k, v, vc, px = 21) => { bp.lab(c, 13, { col: SK.dim }); c.fillText(k, x, y); bp.lab(c, px, { col: vc ?? SK.ink }); c.fillText(v, x, y + 22); };
  field(bx + 12, by + 56, "SUBJECT", card.subject ?? "THE FLAGSHIP, 24 GB");
  field(bx + 12, by + 95, "SCALE", `AXIS × 10^${st.k}  ·  ${t >= M.R19 - 0.06 ? "1/4" : t >= M.R17 - 0.06 ? "1/2" : "1"} KICK / CANDLE`, SK.ink, 18);
  field(bx + 344, by + 56, "SHEET", `${String(card.n).padStart(2, "0")} / 27`);
  field(bx + 344, by + 95, "ALARM", `${Math.round(PA.p * 100)}%`, PA.p > 0.6 ? RED : PA.p > 0.3 ? AMBER : SK.ink);
  bp.segMeter(c, bx + 452, by + 88, 96, 10, PA.p, { n: 12, hotAt: 0.6, col: AMBER, hot: RED });
  // step 19 stamps the sheet's own revision out (its scene sets card.superseded)
  if (card.superseded && t >= card.superseded) {
    c.save(); c.letterSpacing = "0px"; c.translate(bx + bw * 0.5, by + bh * 0.5); c.rotate(-0.2);
    c.globalAlpha = 0.9; c.strokeStyle = RED; c.lineWidth = 4; c.font = font(52, DISPLAY); c.textAlign = "center";
    const tw = c.measureText("SUPERSEDED").width;
    c.strokeRect(-tw / 2 - 16, -34, tw + 32, 66); c.fillStyle = RED; c.fillText("SUPERSEDED", 0, 16);
    c.restore();
  }
  // the alarm column up the left border: the creator's brief in one instrument. It only ever fills, it reddens past 60%, and
  // its needle is the same number that drives the aberration, the shake and the grain -- one meter, one cause.
  {
    const cx = m + 20, y1 = H - 180, y0 = 190, n = 28, gap = 4, sh = (y1 - y0 - gap * (n - 1)) / n, on = alarm * n;
    for (let j = 0; j < n; j++) {
      const lit = clamp(on - j), hot = j / n >= 0.6;
      c.fillStyle = lit > 0 ? (hot ? RED : AMBER) : "rgba(233,228,216,0.1)";
      c.globalAlpha = lit > 0 ? 0.32 + 0.68 * lit : 1;
      c.fillRect(cx - 7, y1 - (j + 1) * (sh + gap) + gap, 14, sh);
    }
    c.globalAlpha = 1;
    c.save(); c.translate(cx + 2, (y0 + y1) / 2); c.rotate(-Math.PI / 2);
    bp.lab(c, 17, { col: alarm > 0.6 ? RED : AMBER, align: "center", track: 5 });
    c.fillText(`PANIC  ${Math.round(alarm * 100)}%`, 0, -18); bp.untrack(c);
    c.restore();
  }
  // top left: what the sheet is measuring right now, and the countdown to the drop
  c.fillStyle = SK.panel; c.fillRect(m + 9, m + 9, 430, 46);
  bp.lab(c, 22, { col: AMBER }); c.fillText(card.title ?? "THE ASCENT", m + 22, m + 40);
  const next = song.sections.find(s => s.kind === "chorus" && s.t0 > t)?.t0 ?? song.DUR, left = Math.max(0, next - t);
  bp.lab(c, 22, { col: SK.ink, align: "right" }); c.fillText(`T-${String(Math.floor(left / 60)).padStart(2, "0")}:${(left % 60).toFixed(2).padStart(5, "0")}`, m + 425, m + 40);
  bp.untrack(c);
  c.restore();
}

// =====================================================================================================================
// the words: motion-graphics type over the space. Every word gets an entrance dealt by its own hash, so forty
// phrases never repeat a move; the hot words come in red with a slam
// =====================================================================================================================
const HOTWORDS = new Set(["ENTERPRISE", "TRIPLE", "RACKET", "USED", "HOT", "RAM", "NEVER", "WRONG", "QUICK", "NINE", "PRAYER", "OIL"]);
function shout(c, K, o) {
  const words = K.words, rows = o.rows ?? [words.length], size = o.size ?? 150, lh = o.lh ?? size * 0.94;
  const lines = [];
  let idx = 0;
  for (const rn of rows) { lines.push(words.slice(idx, idx + rn)); idx += rn; }
  if (idx < words.length) lines.push(words.slice(idx));
  c.save();
  c.textBaseline = "alphabetic";
  c.letterSpacing = "0px";                           // never tracked, whatever a lab() left behind
  lines.forEach((ws, r) => {
    if (!ws.length) return;
    // fit the row: the sheet is 1920 wide and a word like "COMMUNITY" at 150 px is not
    c.font = font(size, DISPLAY);
    // the sheet's own quote marks around "notify me" and "just buy last gen" are punctuation at 24 px and a stray
    // stroke at 165 px; the words carry the quotation on their own
    const texts = ws.map(w => disp(w, false).replace(/^["“'']+|["”'']+$/g, "")), gap = size * 0.2;
    let tw = texts.reduce((a, s) => a + c.measureText(s).width, 0) + gap * (texts.length - 1);
    const maxW = o.maxW ?? (o.align === "center" ? 1560 : 1280), sc = Math.min(1, maxW / tw);
    const px = size * sc, g = Math.max(gap * sc, size * sc * 0.14, 24);   // words never touch, however hard a long row is squeezed
    c.font = font(px, DISPLAY);
    tw = texts.reduce((a, s) => a + c.measureText(s).width, 0) + g * (texts.length - 1);
    let x = o.align === "center" ? o.x - tw / 2 : o.align === "right" ? o.x - tw : o.x;
    const y = o.y + r * lh * sc;
    ws.forEach((w, j) => {
      const s = texts[j], ww = c.measureText(s).width;
      if (K.t >= w.t - 0.03) {
        const e = K.t - (w.t - 0.03), a = since(K.t, w.t - 0.03, 0.075), hot = HOTWORDS.has(s) || o.hot;
        const kind = Math.floor(h32(w.t * 1000 | 0, 8801) * 4);
        c.save();
        c.globalAlpha = clamp(e / 0.045);                  // a word arriving is never a second solid copy of itself
        c.translate(x + ww / 2, y);
        if (kind === 0) c.translate(0, -(1 - easeOutBack(e / 0.16)) * px * 0.9);                      // dropped in
        else if (kind === 1) c.translate((h32(w.wi, 8802) < 0.5 ? -1 : 1) * (1 - easeOut(e / 0.11)) * 240, 0);  // shoved in from its side
        // both of these grow INTO their own box. An entrance that starts wider than the word ends up overlapping the
        // word beside it, which read as a duplicate rather than as motion (measured on "IN THE SECOND")
        else if (kind === 2) { const z = lerp(0.6, 1, easeOutBack(e / 0.13)); c.scale(z, z); }        // punched up
        else c.scale(lerp(0.55, 1, easeOut(e / 0.12)), lerp(1.45, 1, easeOut(e / 0.12)));             // squeezed open
        c.scale(1 + a * 0.06, 1 + a * 0.06);
        c.font = font(px, DISPLAY); c.textAlign = "center";
        const off = Math.max(4, px * 0.04);
        c.fillStyle = o.shadow ?? SK.shadow; c.fillText(s, off, off);
        if (hot) { c.fillStyle = a > 0.55 ? SK.ink : RED; c.fillText(s, 0, 0); }
        else { c.fillStyle = a > 0.6 ? SK.ink : (o.col ?? SK.ink); c.fillText(s, 0, 0); }
        if (hot && a > 0.05) { c.strokeStyle = RED; c.lineWidth = 3; c.globalAlpha = a; c.strokeText(s, 0, 0); }
        c.restore();
      }
      x += ww + g;
    });
  });
  c.restore();
}

// =====================================================================================================================
// the apparatus: one drawing per step, in 3D where it belongs in the space and on the sheet where it must be read
// =====================================================================================================================
// A drawing sits ON THE SHEET, in a plate, with a leader back to its subject out in the space.
// The first cut hung each drawing at a world point beside the trail, which is what a 3D engine makes easy and which
// threw half of them off the frame the moment a camera station changed. Technical illustration does the opposite:
// the detail is drawn in a clear part of the sheet, at a size you can actually read, and a leader line points at the
// thing it is a detail OF. So the trail owns the depth and the plates own the legibility.
const PW = 880, PH = 460;
const PLATE = { TL: [76, 72], TR: [W - 76 - PW, 72], BL: [76, H - 155 - PH], BR: [W - 76 - PW, H - 155 - PH] };
// The ROW goes opposite the words, always -- that is what keeps a phrase and its drawing off each other. The COLUMN
// alternates beat to beat, so two phrases running never put their drawing in the same corner (four beats of "proj"
// in a row was four almost identical frames, and the pace instrument read them as one long held shot).
function zoneFor(card) {
  if (card.zone) return card.zone;
  const s = card.say;
  if (!s) return "BR";
  const row = s.y < H * 0.5 ? "B" : "T";
  return row + (card.i % 2 ? "R" : "L");
}
function plate(c, card, from, draw, o = {}) {
  const [x0, y] = PLATE[zoneFor(card)];
  const s = o.scale ?? 0.8;
  const e = (o.t ?? 1e9) - card.t0, In = easeOut(clamp(e / 0.12));
  const x = x0 + (1 - In) * (card.i % 2 ? 640 : -640);   // it is slammed onto the sheet, from its own side
  c.save();
  c.letterSpacing = "0px";
  c.globalAlpha = clamp(e / 0.05);
  c.fillStyle = SK.plate; c.fillRect(x, y, PW, PH);
  bp.frameTicks(c, x, y, PW, PH, { col: SK.hair, len: 26, label: o.label ?? `DETAIL  ·  ${card.title ?? ""}`, size: 18 });
  if (from) {                                        // the leader: the subject out in the space, to this plate's corner
    const cx = x + PW / 2, cy = y + PH / 2;
    bp.dash(c, [[from.x, from.y], [from.x < cx ? x : x + PW, from.y < cy ? y : y + PH]], [10, 9],
      { col: "rgba(233,228,216,0.28)", w: 1.2 });
  }
  c.translate(x + PW / 2 + (o.dx ?? 0), y + PH / 2 + (o.dy ?? 0));
  c.scale(s, s);
  draw(c, s);
  c.restore();
}
// The creator's generated art, PRINTED. A photograph pasted onto a drawing sheet reads as a photograph pasted onto a drawing
// sheet; put through a screen it becomes a plate and belongs to the document. Bone ink on the sheet's own dark, made
// once on first use (the creator's four podcasters, the bell, the pumpjack, the well).
const HIS_TONE = { cover: [1, 0.68, 0.36, 0], inks: [SK.ink, SK.ink, SK.ink, SK.ink], paper: VOID, shape: "dot", pitch: 7,
  angle: 45, contrast: 1.45, soften: 1.5, key: 0 };
function printHis(c, K, S, key, cx, cy, w, o = {}) {
  const F = K.F, img0 = S.his?.[key];
  if (!img0) return;
  F.his ??= {};
  if (!F.his[key]) F.his[key] = makeScreenPrint(img0, 420, o.lum ?? 0.45, HIS_TONE);   // they are drawn at 250-330 px
  const pr = F.his[key], img = level(pr.levels, w), h = w * pr.print.height / pr.print.width;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  if (o.clip) { c.beginPath(); c.arc(cx, cy, o.clip, 0, 7); c.clip(); }
  c.drawImage(img, cx - w / 2, cy - h / 2 + (o.oy ?? 0), w, h);
  c.restore();
}

// the exploded axonometric of the alert key (step 12): five parts along one axis with part numbers
function keyExploded(c, K, spread, press) {
  const parts = [["01", "KEYCAP", 0], ["02", "STEM", 1], ["03", "SPRING", 2], ["04", "SWITCH", 3], ["05", "PCB", 4]];
  c.save();
  for (const [num, name, i] of parts) {
    const dy = -i * 74 * spread - (i === 0 ? press * 10 : 0), x = i * 30, y = 250 + dy;
    if (name === "SPRING") {
      c.strokeStyle = SK.hair; c.lineWidth = 2.4; c.beginPath();
      for (let s = 0; s <= 28; s++) { const u = s / 28, xx = x + 30 + Math.sin(u * Math.PI * 5) * 26, yy = y + u * 44; s ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    } else bp.axon(c, x, y, i === 4 ? 220 : 130, i === 2 ? 18 : i === 4 ? 12 : 34, 54, { col: i === 0 ? SK.ink : SK.hair, bg: SK.panel, top: i === 0 ? "rgba(244,241,234,0.1)" : null, w: i === 0 ? 2 : 1.3 });
    bp.leader(c, { x: x + 150, y: y + 16 }, { x: 330, y: y - 4 }, `${num}  ${name}`, { size: 20, col: i === 0 ? SK.ink : SK.hair });
  }
  // the axis of the explosion, and the travel dimension on the cap
  bp.dash(c, [[15, 300], [15, 250 - 4 * 74 * spread - 40]], [9, 7], { col: SK.dim, w: 1 });
  if (spread > 0.9) bp.dim(c, { x: -46, y: 250 }, { x: -46, y: 250 - 26 }, "3.6", { size: 18, col: AMBER, ext: 8 });
  c.restore();
}
// the creator's bell as a section with radiation arcs (step 12's last phrase)
function bellSection(c, K, S, ring) {
  c.save();
  printHis(c, K, S, "bell", 0, 0, 300);
  for (let i = 0; i < 5; i++) {
    const u = (K.t * 1.9 + i * 0.2) % 1, r = 160 + u * 420;
    c.strokeStyle = `rgba(94,242,255,${(1 - u) * 0.75 * ring})`; c.lineWidth = 2.6;
    c.beginPath(); c.arc(0, 0, r, -0.85, 0.85); c.stroke();
    c.beginPath(); c.arc(0, 0, r, Math.PI - 0.85, Math.PI + 0.85); c.stroke();
  }
  bp.leader(c, { x: 60, y: -30 }, { x: 280, y: -150 }, "OUTPUT: 1 CHIME", { size: 21, col: CYAN, sub: "RESPONSE: NONE", subCol: RED });
  c.restore();
}
// a signal-flow graph of the creator's podcasters, all on one bus saying one thing (step 13)
function feedGraph(c, K, S, lit) {
  const keys = ["pod1", "pod2cut", "pod3", "pod4"];
  c.save();
  c.strokeStyle = SK.dim; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-460, 250); c.lineTo(460, 250); c.stroke();        // the bus
  keys.forEach((k, i) => {
    const x = -390 + i * 260, on = lit > i / 4 ? 1 : 0.25;
    c.save(); c.globalAlpha = on;
    printHis(c, K, S, k, x, 70, 250, { clip: 92, oy: 40 });
    c.strokeStyle = on > 0.5 ? CYAN : SK.dim; c.lineWidth = 2; c.beginPath(); c.arc(x, 70, 92, 0, 7); c.stroke();
    bp.frameTicks(c, x - 104, 70 - 104, 208, 208, { col: on > 0.5 ? CYAN : SK.dim, len: 20, w: 1.2 });
    bp.lab(c, 19, { col: SK.hair, align: "center" }); c.fillText(`SOURCE ${String(i + 1).padStart(2, "0")}`, x, 196); bp.untrack(c);
    bp.edge(c, { x, y: 168 }, { x, y: 248 }, { col: on > 0.5 ? CYAN : SK.dim, arrow: 8, w: 1.6 });
    c.restore();
  });
  bp.lab(c, 22, { col: CYAN, align: "center" }); c.fillText("ALL SOURCES AGREE   ·   SAMPLE 4   ·   INDEPENDENT: NO", 0, 296); bp.untrack(c);
  c.restore();
}
// COMPUTE = OIL, put through a unit check it fails (step 13)
function unitCheck(c, K, bad) {
  c.save();
  bp.axon(c, -420, -60, 190, 250, 80, { col: SK.hair, bg: SK.panel });
  bp.lab(c, 22, { col: SK.hair, align: "center" }); c.fillText("1 RACK", -325, 240);
  c.strokeStyle = SK.hair; c.lineWidth = 2;                                    // a barrel
  c.beginPath(); c.ellipse(210, -50, 78, 26, 0, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(132, -50); c.lineTo(132, 170); c.moveTo(288, -50); c.lineTo(288, 170); c.stroke();
  c.beginPath(); c.ellipse(210, 170, 78, 26, 0, 0, 7); c.stroke();
  bp.lab(c, 22, { col: SK.hair, align: "center" }); c.fillText("1 BARREL", 210, 240); bp.untrack(c);
  bp.dim(c, { x: -130, y: 60 }, { x: 120, y: 60 }, bad > 0.5 ? "UNITS DO NOT MATCH" : "= ?", { size: 24, col: bad > 0.5 ? RED : AMBER, off: 0 });
  if (bad > 0.5) {
    c.save(); c.globalAlpha = Math.min(1, bad * 1.4); c.strokeStyle = RED; c.lineWidth = 9; c.lineCap = "round";
    c.beginPath(); c.moveTo(-60, -10); c.lineTo(60, 120); c.moveTo(60, -10); c.lineTo(-60, 120); c.stroke();
    c.restore();
  }
  c.restore();
}
// the creator's pumpjack as a mechanism drawing (step 13)
function pumpjack(c, K, S, phase) {
  c.save();
  printHis(c, K, S, "derrick", 0, 0, 620, { alpha: 0.9 });
  const a = Math.sin(phase) * 0.3;
  c.strokeStyle = AMBER; c.lineWidth = 3; c.lineCap = "round";
  c.save(); c.translate(-30, -120); c.rotate(a);
  c.beginPath(); c.moveTo(-190, 0); c.lineTo(210, 0); c.stroke();
  c.beginPath(); c.arc(0, 0, 13, 0, 7); c.stroke();
  c.restore();
  bp.dash(c, [[180, -120], [180, 250]], [10, 8], { col: AMBER, w: 2, offset: -K.t * 40 });
  bp.leader(c, { x: 180, y: 120 }, { x: 420, y: -40 }, "LIFT: COMPUTE", { size: 21, col: AMBER, sub: "RESERVOIR: FINITE", subCol: RED });
  bp.dim(c, { x: 180, y: 260 }, { x: 180, y: 430 }, "2,140 m", { size: 19, col: SK.hair, off: 0 });
  c.restore();
}
// the creator's well as a survey section, with the count of wells this man has seen (step 13)
function wellSection(c, K, S) {
  c.save();
  printHis(c, K, S, "well", 0, -60, 520);
  c.strokeStyle = SK.hair; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(-460, 120); c.lineTo(460, 120); c.stroke();
  const box = { x: -170, y: 120, w: 340, h: 300 };
  c.beginPath(); c.rect(box.x, box.y, box.w, box.h);
  bp.hatch(c, box, { pitch: 12, angle: 45, col: SK.faint });
  c.strokeStyle = SK.hair; c.strokeRect(box.x, box.y, box.w, box.h);
  c.strokeStyle = CYAN; c.lineWidth = 2.4; c.beginPath(); c.moveTo(box.x + 10, 330); c.lineTo(box.x + box.w - 10, 330); c.stroke();
  bp.lab(c, 19, { col: CYAN }); c.fillText("WATER TABLE", box.x + 16, 322); bp.untrack(c);
  bp.dim(c, { x: box.x - 40, y: 120 }, { x: box.x - 40, y: 420 }, "DEPTH 9.4 m", { size: 19, col: SK.hair, off: 0 });
  bp.callout(c, 240, 130, "OBSERVER", [["WELLS SEEN", "00", RED], ["CREDENTIALS", "—"], ["CONFIDENCE", "100%", AMBER]], { w: 320, size: 20 });
  c.restore();
}
// the allocation: supply as a flow that whips from the gamers to the enterprise (step 14)
function allocation(c, K, u, flip) {
  const total = 520, toEnt = lerp(0.03, 0.97, flip), x0 = -520;
  c.save();
  c.strokeStyle = SK.hair; c.lineWidth = 1.4;
  bp.axon(c, x0, -70, 150, 150, 60, { col: SK.ink, bg: SK.panel });
  bp.lab(c, 21, { col: SK.ink, align: "center" }); c.fillText("TOTAL SUPPLY", x0 + 75, 130); bp.untrack(c);
  const ribbon = (frac, y, col, name, share) => {
    const h = Math.max(3, total * frac * 0.5);
    c.fillStyle = col; c.globalAlpha = 0.24;
    c.beginPath(); c.moveTo(x0 + 170, -10); c.lineTo(x0 + 170, 30);
    c.bezierCurveTo(60, 30, 90, y + h, 300, y + h); c.lineTo(300, y); c.bezierCurveTo(90, y, 60, -10, x0 + 170, -10);
    c.closePath(); c.fill();
    c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(300, y); c.lineTo(300, y + h); c.stroke();
    bp.lab(c, 24, { col }); c.fillText(name, 320, y + h / 2 + 8);
    bp.lab(c, 20, { col: SK.hair }); c.fillText(share, 320, y + h / 2 + 34); bp.untrack(c);
  };
  ribbon(1 - toEnt, 160, CYAN, "GAMING COMMUNITY", `${((1 - toEnt) * 100).toFixed(0)}%`);
  ribbon(toEnt, -260, RED, "ENTERPRISE", `${(toEnt * 100).toFixed(0)}%`);
  if (u > 0.4) { bp.lab(c, 20, { col: AMBER }); c.fillText("PRIORITY 1", 320, 120); bp.untrack(c); }
  c.restore();
}
// the timing diagram: two channels, one time axis, two dimension lines (step 15)
function timingDiagram(c, K, botT, youT, u) {
  const x0 = -560, x1 = 520, y0 = -120, gap = 150;
  c.save();
  bp.tickScale(c, x0, y0 + gap * 2 + 40, x1 - x0, { majors: 6, minors: 4, size: 18, text: (i) => `${(i * 0.4).toFixed(1)}s`, col: SK.hair });
  const chan = (y, name, dur, col, live) => {
    c.strokeStyle = SK.dim; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    const w = (x1 - x0) * Math.min(1, dur / 2.4) * live;
    c.fillStyle = col; c.globalAlpha = 0.28; c.fillRect(x0, y - 26, Math.max(2, w), 52); c.globalAlpha = 1;
    c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x0, y - 26, Math.max(2, w), 52);
    bp.lab(c, 23, { col }); c.fillText(name, x0 - 14 - c.measureText(name).width, y + 8);
    bp.dim(c, { x: x0, y: y + 40 }, { x: x0 + Math.max(2, w), y: y + 40 }, `${dur.toFixed(3)} s`, { size: 19, col, off: 0 });
    bp.untrack(c);
  };
  chan(y0, "BOT", botT, RED, 1);
  chan(y0 + gap, "YOU", youT, CYAN, u);
  bp.lab(c, 20, { col: AMBER }); c.fillText(`RATIO 1 : ${Math.round(youT / botT).toLocaleString("en-US")}`, x0, y0 - 60); bp.untrack(c);
  c.restore();
}
// the thumb as a linkage, travelling toward a phone that already says SOLD OUT (step 15)
function thumbLinkage(c, K, u) {
  const a = lerp(-0.7, 0.1, easeOut(u)), b = lerp(0.9, 0.15, easeOut(u));
  c.save();
  c.strokeStyle = SK.ink; c.lineWidth = 7; c.lineCap = "round";
  const p0 = [-320, 210], p1 = [p0[0] + Math.cos(a) * 190, p0[1] + Math.sin(a) * 190];
  const p2 = [p1[0] + Math.cos(a + b) * 150, p1[1] + Math.sin(a + b) * 150];
  c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.lineTo(...p2); c.stroke();
  for (const p of [p0, p1, p2]) { c.fillStyle = SK.bg; c.strokeStyle = SK.ink; c.lineWidth = 2.4; c.beginPath(); c.arc(p[0], p[1], 11, 0, 7); c.fill(); c.stroke(); }
  bp.lab(c, 19, { col: SK.hair }); c.fillText("θ1", p0[0] + 24, p0[1] - 16); c.fillText("θ2", p1[0] + 22, p1[1] - 16); bp.untrack(c);
  bp.dash(c, [[p2[0], p2[1]], [210, 120]], [9, 8], { col: AMBER, w: 1.4 });
  // the phone: it says SOLD OUT before the thumb arrives
  c.strokeStyle = SK.ink; c.lineWidth = 3; rr(c, 210, -60, 210, 380, 26); c.stroke();
  c.fillStyle = "rgba(255,42,61,0.16)"; rr(c, 222, -46, 186, 352, 18); c.fill();
  bp.lab(c, 30, { col: RED, align: "center" }); c.fillText("SOLD", 315, 110); c.fillText("OUT", 315, 146); bp.untrack(c);
  bp.leader(c, { x: p2[0], y: p2[1] }, { x: -180, y: 380 }, "ANGULAR TRAVEL 74°", { size: 20, col: SK.hair, sub: "ARRIVES 2.400 s LATE", subCol: RED });
  c.restore();
}
// the ray diagram: lens elements in section, the chart in the image plane (step 16)
function rayDiagram(c, K, st, M, u) {
  const x0 = -600, xi = 430;
  c.save();
  bp.dash(c, [[x0 - 60, 0], [xi + 120, 0]], [14, 10], { col: SK.dim, w: 1 });
  const els = [[-300, 150, 1], [-190, 120, -1], [-60, 170, 1], [80, 110, -1]];
  els.forEach(([x, r, dir], i) => {
    c.strokeStyle = SK.ink; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(x, -r); c.quadraticCurveTo(x + dir * 30, 0, x, r); c.quadraticCurveTo(x - dir * 30, 0, x, -r); c.stroke();
    c.fillStyle = "rgba(94,242,255,0.07)"; c.fill();
    bp.lab(c, 16, { col: SK.dim, align: "center" }); c.fillText(`E${i + 1}`, x, r + 24); bp.untrack(c);
  });
  for (let i = -3; i <= 3; i++) {
    if (!i) continue;
    const y = i * 52;
    c.strokeStyle = `rgba(94,242,255,${0.5 * u})`; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(-300, y * 0.96); c.lineTo(80, y * 0.3); c.lineTo(xi, 0); c.stroke();
  }
  // the image plane: the chart itself, upside down as a lens leaves it
  c.strokeStyle = AMBER; c.lineWidth = 2; c.beginPath(); c.moveTo(xi, -210); c.lineTo(xi, 210); c.stroke();
  c.save(); c.translate(xi + 8, 0); c.scale(1, -1);
  c.strokeStyle = GREEN; c.lineWidth = 2.6; c.beginPath();
  for (let j = 0; j <= 30; j++) { const x = 8 + j * 5.6, y = -Math.pow(j / 30, 2.2) * 150; j ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke(); c.restore();
  bp.leader(c, { x: xi, y: 120 }, { x: xi - 30, y: 250 }, "IMAGE PLANE", { size: 20, col: AMBER, dir: 1 });
  bp.callout(c, x0 - 40, -330, "OPTICS", [["FOCAL", "35 mm"], ["APERTURE", "f/1.4"], ["SUBJECT", "A MAN WITH THIS GEN", AMBER]], { w: 380, size: 20 });
  bp.dim(c, { x: 80, y: 250 }, { x: xi, y: 250 }, "f", { size: 20, col: SK.hair, off: 0 });
  c.restore();
}
// the ring light, drawn as a polar plot of the creator's synth's own spectrum (step 16)
function ringPolar(c, K, gain) {
  const bands = song.synth.bandsAt(K.t), n = bands.length, r0 = 150, r1 = 300;
  c.save();
  c.strokeStyle = SK.dim; c.lineWidth = 1;
  for (const r of [r0, (r0 + r1) / 2, r1]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
  for (let i = 0; i < n * 2; i++) {
    const b = i < n ? i : n * 2 - 1 - i, v = bands[b] * gain, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr2 = r0 + v * (r1 - r0);
    c.strokeStyle = v > 0.72 ? SK.ink : v > 0.4 ? CYAN : "rgba(94,242,255,0.55)";
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); c.stroke();
  }
  bp.lab(c, 19, { col: SK.hair, align: "center" }); c.fillText("RING LIGHT  ·  48 BANDS  ·  90 Hz – 16 kHz", 0, r1 + 44); bp.untrack(c);
  bp.tickScale(c, -r1, -r1 - 30, r1 * 2, { majors: 4, minors: 3, size: 15, col: SK.dim, text: (i) => `${-48 + i * 12}dB`, flip: true });
  c.restore();
}
// the used card: an exploded assembly over its own photograph (step 17)
function cardExploded(c, K, u) {
  const parts = [["01", "SHROUD", -150], ["02", "FANS ×2", -80], ["03", "HEATSINK", 0], ["04", "PCB", 80], ["05", "BACKPLATE", 150]];
  c.save();
  printAt(c, K, "rtx3070", 0, 0, 640, -0.04, { alpha: 0.5 });
  parts.forEach(([num, name, dy], i) => {
    const y = dy * u * 1.7;
    c.strokeStyle = i === 3 ? AMBER : SK.hair; c.lineWidth = 1.5; c.globalAlpha = 0.9;
    c.beginPath(); c.rect(-280, y - 16, 560, 32); c.stroke();
    if (i === 1) { for (const x of [-120, 120]) { c.beginPath(); c.arc(x, y, 60 * u, 0, 7); c.stroke(); } }
    bp.leader(c, { x: 280, y }, { x: 420, y: y - 6 }, `${num} ${name}`, { size: 19, col: i === 3 ? AMBER : SK.hair });
    c.globalAlpha = 1;
  });
  bp.dash(c, [[0, -320], [0, 320]], [8, 7], { col: SK.dim, w: 1 });
  c.restore();
}
// the isotherms: contour rings over the card with a scale bar and the hot spot called out (step 17)
function thermal(c, K, heat) {
  const HEATC = ["#4a0a6b", "#9c1a6e", "#e0301e", "#ff8a12", "#ffd84a"];
  c.save();
  printAt(c, K, "v2-heat", 0, 0, 640, -0.04, { alpha: 0.85 });
  for (let i = 0; i < 5; i++) {
    const r = 60 + i * 52, on = heat > i / 6 ? 1 : 0.2;
    c.strokeStyle = HEATC[4 - i]; c.globalAlpha = on * 0.95; c.lineWidth = 3.4;
    c.beginPath();
    for (let j = 0; j <= 40; j++) {
      const a = j / 40 * Math.PI * 2, rr2 = r * (1 + 0.16 * Math.sin(a * 3 + i) + 0.09 * Math.cos(a * 5 - i));
      const x = -40 + Math.cos(a) * rr2 * 1.35, y = 10 + Math.sin(a) * rr2 * 0.8;
      j ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.stroke();
    if (i === 4) { bp.lab(c, 17, { col: HEATC[0] }); c.fillText("40°", -40 + r * 1.4, 10); bp.untrack(c); }
  }
  c.globalAlpha = 1;
  bp.leader(c, { x: -40, y: 10 }, { x: 260, y: -190 }, "103 °C", { size: 34, col: "#ffd84a", sub: "PEAK, SUSTAINED", subCol: SK.ink });
  const bx = -380, by = 230;
  HEATC.forEach((col, i) => { c.fillStyle = col; c.fillRect(bx + i * 52, by, 52, 18); });
  bp.lab(c, 16, { col: SK.hair }); c.fillText("30°", bx, by + 36); c.fillText("110°", bx + 232, by + 36); bp.untrack(c);
  c.restore();
}
// the hour meter: a cyclometer of drum digits, and a duty bar that never left 100% (step 17)
function hourMeter(c, K, u) {
  const digits = "17520", n = digits.length, dw = 66, dh = 96;
  c.save();
  c.strokeStyle = SK.ink; c.lineWidth = 2.4; c.strokeRect(-n * dw / 2 - 8, -dh / 2 - 8, n * dw + 16, dh + 16);
  for (let i = 0; i < n; i++) {
    const x = -n * dw / 2 + i * dw, settle = clamp((u - i * 0.12) / 0.3);
    c.save(); c.beginPath(); c.rect(x, -dh / 2, dw - 4, dh); c.clip();
    c.fillStyle = SK.panel; c.fill();
    const roll = (1 - settle) * 9, base = +digits[i];
    for (let d = -1; d <= 1; d++) {
      const val = (base + d + 10) % 10, off = (d + (roll % 1)) * dh;
      c.font = font(74, DISPLAY); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = d === 0 && settle > 0.95 ? SK.ink : "rgba(244,241,234,0.45)";
      c.fillText(String(val), x + (dw - 4) / 2, off + 4);
    }
    c.restore();
    c.strokeStyle = SK.dim; c.lineWidth = 1; c.strokeRect(x, -dh / 2, dw - 4, dh);
  }
  bp.lab(c, 21, { col: SK.hair, align: "center" }); c.fillText("HOURS UNDER LOAD   ·   730 DAYS   ·   DUTY 100%", 0, dh / 2 + 44); bp.untrack(c);
  bp.segMeter(c, -160, dh / 2 + 62, 320, 12, 1, { n: 24, hotAt: 0.9, col: AMBER, hot: RED });
  c.restore();
}
// =====================================================================================================================
// THE FLIP (the creator's note, 9/27 16:45: "his transition from Suit to Jacket needs to return in there somewhere. Somewhere.
// Prominent even. Dramatic flip."). The creator was right that it had gone: this verse only ever drew the CEO as a small plate
// on "read the CEO", four seconds before the flip's own time, so the flip fired at nothing.
// It is not a detail on a plate now. He rises out of the floor of the space at full height, winds up, and whips
// through a half turn that hands the suit to the jacket THREE FRAMES BEFORE "Also" -- the creator's ruling from 9/26, kept
// through all four versions. The turn throws afterimages, the landing takes an inverted impact frame, and he holds in
// the jacket for the rest of the line, which is where the bill of materials says the jacket is the only thing in
// stock. Drawn over the space and under the words, and it survives the cut between the two beats.
// =====================================================================================================================
const CEO_H = 880, CEO_X = 1285, CEO_FEET = 1150;
function ceoArt(c, K, which, cx, feet, h, o = {}) {
  const A = K.F.v2, lv = o.ghost !== undefined ? A.ceoGhost[which][o.ghost] : A.ceo[which];
  const img = A.ceo[which][0], w = h * img.width / img.height, sx = o.sx ?? 1;
  c.save();
  c.translate(cx, feet - h / 2);
  c.rotate(o.rot ?? 0);
  c.scale(sx, o.sy ?? 1);
  c.globalAlpha = o.alpha ?? 1;
  if (o.ghost === undefined && o.shadow !== false) c.drawImage(level(A.ceoShadow[which], w * Math.abs(sx)), -w / 2 + h * 0.018, -h / 2 + h * 0.018, w, h);
  c.drawImage(level(lv, Math.max(40, w * Math.abs(sx))), -w / 2, -h / 2, w, h);
  c.restore();
}
function ceoFlip(c, t, K, S, C, PA) {
  if (!S.fastArt.v2 || t < C.rise || t >= C.end) return null;
  const rise = easeOutBack(clamp((t - C.rise) / 0.5));
  const gone = clamp((t - C.out) / 0.2);                    // he collapses out as the verse moves on
  if (gone >= 1) return null;
  const feet = CEO_FEET + (1 - rise) * 640;
  const su = clamp((t - C.spin0) / (C.land - C.spin0));     // 0 -> 1 across the turn
  const th = Math.PI * ease(su);                            // a half turn, eased in and out
  const spinning = t >= C.spin0 && t < C.land;
  const which = t >= C.land || th > Math.PI / 2 ? "jacket" : "suit";
  const wind = t < C.spin0 ? since(t, C.spin0 - 0.16, 0.09) : 0;   // the wind-up, just before it goes
  const land = since(t, C.land, 0.13);
  const bob = t >= C.land ? Math.sin((t - C.land) * 7) * 0.006 : 0;
  const h = CEO_H * (1 + wind * 0.04 + land * 0.1 + bob) * (1 - gone * 0.1);
  const sx = spinning ? Math.cos(th) : (t >= C.land ? 1 : 1);
  const rot = (spinning ? Math.sin(th) * 0.08 : 0) - wind * 0.05 + land * 0.04;
  const sy = 1 - gone * 0.94;
  c.save();
  c.globalAlpha = clamp(rise * 1.4) * (1 - gone);
  // the afterimages: the same turn a few frames back, alternating the two plates' inks
  if (spinning || land > 0.05) {
    for (let j = 5; j >= 1; j--) {
      const tg = t - j * 0.024;
      if (tg < C.spin0) continue;
      const g = Math.PI * ease(clamp((tg - C.spin0) / (C.land - C.spin0)));
      ceoArt(c, K, g > Math.PI / 2 || tg >= C.land ? "jacket" : "suit", CEO_X + (j % 2 ? -1 : 1) * j * 9, feet, h,
        { sx: Math.cos(g), rot: Math.sin(g) * 0.08, sy, ghost: j % 2, alpha: (0.5 - j * 0.07) * (1 - gone) });
    }
  }
  ceoArt(c, K, which, CEO_X, feet, h, { sx, rot, sy });
  c.restore();
  // the impact: focus lines closing on him, then bursting off
  if (land > 0.03) {
    c.save();
    c.globalAlpha = land * 0.9; c.strokeStyle = land > 0.5 ? SK.ink : RED; c.lineCap = "butt";
    for (let j = 0; j < 34; j++) {
      const a = j / 34 * Math.PI * 2 + 0.11, r0 = 250 + (1 - land) * 700, r1 = r0 + 160 + (1 - land) * 420;
      c.lineWidth = 2 + h32(j, 9901) * 7;
      c.beginPath();
      c.moveTo(CEO_X + Math.cos(a) * r0, CEO_FEET - h * 0.45 + Math.sin(a) * r0);
      c.lineTo(CEO_X + Math.cos(a) * r1, CEO_FEET - h * 0.45 + Math.sin(a) * r1);
      c.stroke();
    }
    c.restore();
  }
  // the label: what changed, in the sheet's own hand
  if (t >= C.land - 0.02) {
    const a = clamp((t - C.land) / 0.12) * (1 - gone);
    c.save(); c.globalAlpha = a;
    bp.leader(c, { x: CEO_X - 110, y: CEO_FEET - h * 0.58 }, { x: CEO_X - 430, y: CEO_FEET - h * 0.86 },
      "THE JACKET", { size: 26, col: GREEN, sub: "THE ONLY THING IN STOCK", subCol: SK.ink, dir: -1 });
    c.restore();
  }
  if (spinning || (t >= C.rise && t < C.spin0)) {
    c.save(); c.globalAlpha = clamp(rise * 1.4) * 0.8;
    bp.lab(c, 22, { col: spinning ? RED : SK.hair });
    c.fillText(spinning ? "REVISION IN PROGRESS" : "ON RECORD  ·  THE SUIT", CEO_X - 300, CEO_FEET - h - 26);
    bp.untrack(c); c.restore();
  }
  return {
    flash: land * 0.85 + (spinning ? 0.06 : 0),
    invert: t >= C.land - 1e-6 && t < C.land + 2 / 30 ? 1 : 0,
    ca: land * 0.016 + (spinning ? 0.006 : 0),
    glitch: land * 0.42 + (spinning ? 0.12 : 0) + gone * 0.5,
  };
}

// the projection: the data ends, a dotted extrapolation goes on with an uncertainty cone (step 18)
function projection(c, V, M, t, st, reveal) {
  const n = st.n, i = n - 1, head = [xOf(i), yOf(st, st.price), zOf(i)];
  const at = M.years.filter(y => t >= y.t - 0.03);
  const far = [], upper = [], lower = [];
  for (let j = 0; j <= 24; j++) {
    const u = j / 24, x = head[0] + u * 150 * reveal, y = head[1] + Math.pow(u, 2.2) * YH * 1.1 * reveal, z = zOf(i + u * 80);
    far.push([x, y, z]); upper.push([x, y + u * u * 16, z]); lower.push([x, Math.max(0, y - u * u * 13), z]);
  }
  c.strokeStyle = GREEN;
  for (const run of bp.runs(V, far)) bp.dash(c, run, [12, 14], { col: GREEN, w: 3, offset: -t * 70 });
  for (const env of [upper, lower]) for (const run of bp.runs(V, env)) bp.dash(c, run, [6, 12], { col: "rgba(25,219,115,0.4)", w: 1.4 });
  // the sung years, planted on the line as milestones the camera passes
  at.forEach((yv, j) => {
    const u = 0.3 + 0.16 * j, k = Math.min(23, Math.round(u * 24)), p = far[k], sc = V.atClamped(p);
    const s = since(t, yv.t - 0.03, 0.09);
    c.save(); c.letterSpacing = "0px";
    c.fillStyle = yv.hot ? RED : SK.ink; c.beginPath(); c.arc(sc.x, sc.y, 7 + s * 8, 0, 7); c.fill();
    c.font = font(Math.round((yv.hot ? 74 : 50) * (1 + s * 0.4)), DISPLAY); c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = SK.shadow; c.fillText(yv.label, sc.x + 22, sc.y - 14);
    c.fillStyle = yv.hot ? RED : SK.ink; c.fillText(yv.label, sc.x + 18, sc.y - 18);
    c.restore();
  });
  const sc = V.atClamped(far[12]);
  bp.callout(c, Math.min(W - 400, sc.x + 60), Math.max(90, sc.y - 200), "EXTRAPOLATION", [["MODEL", "LOG-LINEAR"], ["CONFIDENCE", "12%", RED], ["DATA ENDS", "TODAY", AMBER]], { w: 360, size: 20, alpha: reveal });
}
// the rotary selector that lands on NEVER (step 18's last phrase)
function selector(c, K, u) {
  const POS = ["2028", "2030+", "NEVER"], a0 = -Math.PI * 0.75, a1 = -Math.PI * 0.25;
  const land = easeOutBack(u), a = a0 + (a1 - a0) * Math.min(1, land);
  c.save();
  c.strokeStyle = SK.ink; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 150, 0, 7); c.stroke();
  POS.forEach((p, i) => {
    const pa = a0 + (a1 - a0) * i / 2, on = Math.abs(pa - a) < 0.2;
    c.strokeStyle = on ? (i === 2 ? RED : AMBER) : SK.dim; c.lineWidth = on ? 3 : 1.4;
    c.beginPath(); c.moveTo(Math.cos(pa) * 150, Math.sin(pa) * 150); c.lineTo(Math.cos(pa) * 184, Math.sin(pa) * 184); c.stroke();
    bp.lab(c, on ? 30 : 22, { col: on ? (i === 2 ? RED : AMBER) : SK.hair, align: "center" });
    c.fillText(p, Math.cos(pa) * 240, Math.sin(pa) * 240 + 8); bp.untrack(c);
  });
  c.strokeStyle = u > 0.85 ? RED : SK.ink; c.lineWidth = 9; c.lineCap = "round";
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 130, Math.sin(a) * 130); c.stroke();
  c.fillStyle = SK.ink; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill();
  bp.lab(c, 21, { col: SK.hair, align: "center" }); c.fillText("RESOLUTION", 0, 230); bp.untrack(c);
  c.restore();
}
// the revision block: a real drawing's revision table, every row wrong (step 19)
function revisionBlock(c, K, u) {
  const rows = [["A", "2026-01", "FIRST ISSUE", "WRONG"], ["B", "2026-04", "PRICES UPDATED", "WRONG"],
    ["C", "2026-07", "PRICES UPDATED", "WRONG"], ["D", "2026-09", "THIS SHEET", "WRONG"]];
  const w = 760, rh = 52;
  c.save();
  c.fillStyle = SK.panel; c.fillRect(-w / 2, -140, w, rh * (rows.length + 1));
  c.strokeStyle = SK.hair; c.lineWidth = 1.4; c.strokeRect(-w / 2, -140, w, rh * (rows.length + 1));
  const cols = [0, 80, 280, 590];
  bp.lab(c, 18, { col: SK.dim });
  ["REV", "DATE", "DESCRIPTION", "STATUS"].forEach((h, i) => c.fillText(h, -w / 2 + cols[i] + 14, -140 + 32));
  rows.forEach((r, i) => {
    const y = -140 + rh * (i + 1), on = clamp((u - i * 0.16) / 0.2);
    c.globalAlpha = on;
    c.strokeStyle = SK.faint; c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke();
    r.forEach((cell, j) => { bp.lab(c, j === 3 ? 26 : 22, { col: j === 3 ? RED : SK.ink }); c.fillText(cell, -w / 2 + cols[j] + 14, y + 36); });
    if (on > 0.7) { c.strokeStyle = RED; c.lineWidth = 3; c.beginPath(); c.moveTo(-w / 2 + cols[2] + 8, y + 27); c.lineTo(-w / 2 + cols[3] - 12, y + 27); c.stroke(); }
    c.globalAlpha = 1;
  });
  bp.untrack(c);
  c.restore();
}
// step 19's flood: every number the video ever showed, one per sixteenth, each in a field box, then struck out
function numberFlood(c, t, M) {
  const n = NUMS.length, per = song.BEAT / 4, shown = Math.floor((t - M.FLOOD0) / per) + 1;
  if (shown <= 0) return;
  c.save();
  for (let i = 0; i < Math.min(n * 3, shown); i++) {
    const k = i % n, s = h32(i, 4401), x = 90 + h32(i, 4402) * (W - 420), y = 130 + h32(i, 4403) * (H - 320);
    const born = M.FLOOD0 + i * per, age = t - born, px = 30 + s * 58;
    c.save(); c.translate(x, y); c.rotate((h32(i, 4404) - 0.5) * 0.14);
    c.globalAlpha = clamp(age / 0.05) * (1 - clamp((age - 2.4) / 0.4));
    bp.lab(c, px * 0.5, { col: SK.dim }); c.fillText(`FIELD ${String(k + 1).padStart(2, "0")}`, 0, -px * 0.62);
    c.letterSpacing = "0px"; c.font = font(px, DISPLAY); c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = SK.shadow; c.fillText(NUMS[k], 3, 3);
    c.fillStyle = t >= M.STRIKE ? "rgba(244,241,234,0.62)" : SK.ink; c.fillText(NUMS[k], 0, 0);
    const tw = c.measureText(NUMS[k]).width;
    c.strokeStyle = SK.dim; c.lineWidth = 1; c.strokeRect(-8, -px * 0.86, tw + 16, px * 1.12);
    if (t >= M.STRIKE) { c.strokeStyle = RED; c.lineWidth = Math.max(3, px * 0.09); c.beginPath(); c.moveTo(-6, -px * 0.3); c.lineTo(tw + 6, -px * 0.3); c.stroke(); }
    c.restore();
  }
  bp.untrack(c);
  c.restore();
}

// =====================================================================================================================
// the beats: one per sung phrase, on the SAME anchors the last two versions used (verified against the aligned words).
// Each one says where the camera goes, how the words land, and which drawing is on the sheet.
// =====================================================================================================================
const AC = [
  // ---- step 12: the alert key ----
  { n: 12, start: "step", cam: "sheet", title: "GENERAL ARRANGEMENT", say: { x: 300, y: 300, size: 200, rows: [1, 1] }, art: "open" },
  { n: 12, at: "PRESS", cam: "nose", title: "THE ALERT KEY", say: { x: 250, y: 880, size: 165, rows: [3] }, art: "key" },
  { n: 12, at: "IT'S#0", cam: "side", title: "COST OF ENTRY", say: { x: W - 260, y: 320, size: 215, rows: [2], align: "right" }, art: "free" },
  { n: 12, at: "IT'S#1", cam: "low", title: "SECTION A-A", say: { x: 260, y: 330, size: 195, rows: [3] }, art: "section" },
  { n: 12, at: "IT'S#2", cam: "high", title: "SIGNAL FLOW", say: { x: 960, y: 950, size: 185, rows: [3], align: "center" }, art: "prayer" },
  { n: 12, at: "WITH", cam: "orbit", title: "OUTPUT STAGE", say: { x: 250, y: 300, size: 175, rows: [2, 2] }, art: "bell" },
  // ---- step 13: the claim ----
  { n: 13, at: "STEP", cam: "back", title: "THE CLAIM", subject: "SOURCES, FOUR", say: { x: 250, y: 300, size: 200, rows: [1, 1] }, art: "none" },
  { n: 13, at: "A#0", cam: "chase", title: "SOURCE BUS", say: { x: 960, y: 980, size: 170, rows: [2], align: "center" }, art: "feeds" },
  { n: 13, at: "COMPUTE", cam: "side", title: "UNIT CHECK", say: { x: 250, y: 300, size: 175, rows: [3, 2] }, art: "units" },
  { n: 13, at: "NEW", cam: "rail", title: "LIFT MECHANISM", say: { x: W - 250, y: 950, size: 160, rows: [3], align: "right" }, art: "pump" },
  { n: 13, at: "SAYS", cam: "nose", title: "THE OBSERVER", say: { x: 250, y: 330, size: 170, rows: [3] }, art: "observer" },
  { n: 13, at: "NEVER", cam: "orbit", title: "SURVEY SECTION", say: { x: 960, y: 1000, size: 165, rows: [4], align: "center" }, art: "well" },
  // ---- step 14: the allocation, and the first ceiling ----
  { n: 14, at: "STEP", cam: "rail", title: "THE ALLOCATION", subject: "SUPPLY, ANNUAL", say: { x: 250, y: 300, size: 200, rows: [1, 1] }, art: "none" },
  { n: 14, at: "READ", cam: "bench", title: "STATEMENT", say: { x: 250, y: 950, size: 150, rows: [3] }, art: "ceo" },
  { n: 14, at: "WE'RE", cam: "side", title: "FLOW, AS STATED", say: { x: 960, y: 250, size: 130, rows: [4], align: "center" }, art: "flow" },
  { n: 14, at: "GAMING", cam: "chase", title: "FLOW, AS STATED", say: { x: 250, y: 320, size: 150, rows: [2] }, art: "flow" },
  { n: 14, at: "ENTERPRISE", cam: "side", stock: "screen", title: "FLOW, AS BUILT", say: { x: 960, y: 300, size: 190, rows: [1, 3], align: "center" }, art: "flow", hot: 1, drift: 0.5 },
  // the flip owns the right of the frame through these two beats, so the words and the drawing keep to the left
  { n: 14, at: "OUR", cam: "nose", title: "TARGET", say: { x: 140, y: 300, size: 155, rows: [2, 1], maxW: 1000 }, art: "scope", zone: "BL", stock: "screen" },
  { n: 14, at: "THANKS", cam: "bench", title: "BILL OF MATERIALS", say: { x: 140, y: 930, size: 140, rows: [4], maxW: 1000 }, art: "jacket", zone: "TL" },
  // ---- step 15: timing, and the halt ----
  { n: 15, at: "STEP", cam: "nose", title: "TIMING", subject: "THE RACKET", say: { x: 250, y: 300, size: 200, rows: [1, 1] }, art: "none" },
  { n: 15, at: "A#0", cam: "high", stock: "screen", title: "PARTICIPANTS", say: { x: 960, y: 980, size: 165, rows: [4], align: "center" }, art: "bots" },
  { n: 15, at: "IN", cam: "side", title: "CHANNEL TIMING", say: { x: 250, y: 300, size: 150, rows: [4] }, art: "timing" },
  { n: 15, at: "IT", cam: "bench", title: "KINEMATICS", say: { x: W - 250, y: 300, size: 145, rows: [4], align: "right" }, art: "thumb" },
  { n: 15, at: "THEN", cam: "chase", title: "ORDER LOG", say: { x: 250, y: 960, size: 160, rows: [3] }, art: "log" },
  { n: 15, at: "ONE", cam: "nose", title: "ONE UNIT", say: { x: 250, y: 320, size: 175, rows: [3] }, art: "unit" },
  { n: 15, at: "TRIPLE", cam: "side", stock: "screen", title: "MULTIPLIER", say: { x: 960, y: 320, size: 200, rows: [2], align: "center" }, art: "triple", drift: 0.5 },
  { n: 15, at: "THAT'S", cam: "halt", stock: "screen", title: "TRADING HALTED", say: { x: 960, y: 640, size: 165, rows: [3], align: "center" }, art: "halt", halt: true,
    priceAt: { x: 300, y: 880, side: 1 } },                                        // the price is frozen mid-candle; it sits clear of the notice
  // ---- step 16: the stream ----
  { n: 16, kickFrom: "STEP", cam: "chase", title: "THE STREAM", subject: "A MAN WITH THIS GEN", say: { x: 250, y: 300, size: 195, rows: [1, 1] }, art: "none" },
  { n: 16, at: "SAYS", cam: "side", title: "OPTICAL PATH", say: { x: 250, y: 960, size: 145, rows: [5] }, art: "rays" },
  { n: 16, at: "ON", cam: "high", title: "DISTRIBUTION", say: { x: 960, y: 300, size: 165, rows: [3], align: "center" }, art: "stream" },
  { n: 16, at: "IN", cam: "orbit", title: "KEY LIGHT", say: { x: 250, y: 300, size: 160, rows: [4] }, art: "ring" },
  { n: 16, at: "TO", cam: "nose", title: "CAPTURE", say: { x: W - 250, y: 950, size: 165, rows: [3], align: "right" }, art: "cam" },
  // ---- step 17: diagnostic, the rails, the UP event ----
  { n: 17, at: "STEP", cam: "rail", title: "DIAGNOSTIC", subject: "ONE USED CARD", say: { x: 250, y: 300, size: 195, rows: [1, 1] }, art: "none" },
  { n: 17, at: "LAST#0", cam: "rail", title: "SECOND SERIES", say: { x: 960, y: 980, size: 160, rows: [3], align: "center" }, art: "lastgen" },
  { n: 17, at: "USED", cam: "bench", title: "EXPLODED ASSEMBLY", say: { x: 250, y: 300, size: 175, rows: [3] }, art: "exploded" },
  { n: 17, at: "FROM", cam: "high", title: "PROVENANCE", say: { x: 250, y: 960, size: 155, rows: [4] }, art: "mine" },
  { n: 17, at: "THAT", cam: "bench", stock: "screen", title: "THERMAL SURVEY", say: { x: W - 250, y: 300, size: 165, rows: [3], align: "right" }, art: "thermal" },
  { n: 17, at: "FOR", cam: "nose", title: "HOURS UNDER LOAD", say: { x: 250, y: 300, size: 175, rows: [3] }, art: "hours" },
  { n: 17, at: "AND", cam: "rail", title: "SECOND SERIES", say: { x: 250, y: 960, size: 150, rows: [4] }, art: "lastgen" },
  { n: 17, at: "PRICE", cam: "side", title: "SECOND SERIES", say: { x: 960, y: 300, size: 175, rows: [3], align: "center" }, art: "lastgen", drift: 0.5 },
  { n: 17, at: "EVEN", cam: "rail", title: "THIRD SERIES", say: { x: 250, y: 320, size: 190, rows: [3] }, art: "ram", hot: 1 },
  // ---- step 18: the projection ----
  { n: 18, at: "STEP", cam: "back", title: "THE PROJECTION", subject: "WHEN DOES IT END", say: { x: 250, y: 300, size: 195, rows: [1, 1] }, art: "none" },
  { n: 18, at: "ASK", cam: "chase", title: "EXTRAPOLATION", say: { x: 250, y: 960, size: 160, rows: [4] }, art: "proj" },
  { n: 18, at: "ONE", cam: "side", title: "SOURCE 01", say: { x: 250, y: 290, size: 140, rows: [3, 3] }, art: "proj" },
  { n: 18, at: "THE", cam: "high", title: "SOURCE 02", say: { x: 960, y: 980, size: 150, rows: [5], align: "center" }, art: "proj" },
  { n: 18, at: "PAST", cam: "low", title: "OUT OF RANGE", say: { x: 250, y: 320, size: 180, rows: [3], align: "left" }, art: "proj", drift: 0.5 },
  { n: 18, at: "TAKE", cam: "nose", title: "RESOLUTION", say: { x: W - 250, y: 300, size: 175, rows: [3], align: "right" }, art: "select", hot: 1 },
  // ---- step 19: all wrong ----
  { n: 19, at: "STEP", cam: "nose", title: "REVISION", subject: "THIS SHEET", say: { x: 250, y: 300, size: 195, rows: [1, 1] }, art: "none" },
  { n: 19, at: "THIS", cam: "side", title: "REVISION BLOCK", say: { x: 250, y: 960, size: 150, rows: [3] }, art: "rev" },
  { n: 19, at: "WAS", cam: "chase", title: "REVISION BLOCK", say: { x: 250, y: 300, size: 150, rows: [4] }, art: "rev" },
  { n: 19, at: "TWENTY#0", cam: "back", title: "DATE OF ISSUE", say: { x: 960, y: 300, size: 175, rows: [3], align: "center" }, art: "date" },
  { n: 19, at: "SO", cam: "high", stock: "screen", title: "ALL FIELDS", say: { x: 960, y: 620, size: 150, rows: [4], align: "center" }, art: "flood" },
  { n: 19, at: "ALREADY", cam: "side", stock: "screen", title: "ALL FIELDS", say: { x: 960, y: 620, size: 175, rows: [3], align: "center" }, art: "flood", hot: 1 },
  { n: 19, after: "WRONG", cam: "launch", stock: "screen", title: "END OF SHEET", say: { x: 960, y: 900, size: 200, rows: [3], align: "center" }, art: "launch", hot: 1 },
];

// =====================================================================================================================
// the apparatus router: art id -> the drawing, placed in the space
// =====================================================================================================================
function apparatus(c, V, M, t, st, card, K, S, PA) {
  const u = clamp((t - card.t0) / Math.max(0.16, Math.min(0.75, card.t1 - card.t0))), n = st.n, i = n - 1;
  const head = [xOf(i), yOf(st, st.price), zOf(i)];
  const at = V.atClamped(head);
  const K2 = { ...K, F: S.fastArt, ws: 1 };
  switch (card.art) {
    case "open":                                      // the sheet opens: what this document is
      plate(c, card, at, (cc) => {
        bp.callout(cc, -390, -170, "DOCUMENT", [["SUBJECT", "THE FLAGSHIP, 24 GB"], ["SERIES", "CONSUMER"], ["ISSUE", "2026", AMBER],
          ["SHEETS", "27"], ["STATUS", "IN FORCE", GREEN]], { w: 500, size: 24, alpha: ease(u * 2) });
        bp.tickScale(cc, -390, 180, 780, { majors: 6, minors: 5, size: 18, col: SK.hair, text: (j) => `${j * 5}` });
        bp.lab(cc, 20, { col: SK.dim }); cc.fillText("PRICE, USD  ·  ONE CANDLE PER KICK  ·  NO AUTOSCALE", -390, 240); bp.untrack(cc);
      }, { t, scale: 0.86, label: "VIEW 1 : GENERAL ARRANGEMENT" });
      break;
    case "key": plate(c, card, at, (cc) => keyExploded(cc, K2, ease(u * 1.6), song.kickEnv(t, 0.09)), { t, scale: 1.3, dx: -170, dy: 190 }); break;
    case "free":
      plate(c, card, at, (cc) => {
        bp.axon(cc, -300, -160, 190, 56, 62, { col: SK.ink, bg: SK.panel });
        bp.dim(cc, { x: -300, y: -50 }, { x: -20, y: -50 }, "$0.00", { size: 30, col: GREEN, off: 0 });
        bp.callout(cc, -300, 20, "COST OF ENTRY", [["PURCHASE", "$0.00", GREEN], ["DELIVERS", "NOTHING", RED], ["RETURNS", "NONE"]], { w: 500, size: 24 });
      }, { t, scale: 0.9 });
      break;
    case "section":
      plate(c, card, at, (cc) => {
        const box = { x: -230, y: -150, w: 420, h: 280 };
        cc.beginPath(); cc.rect(box.x, box.y, box.w, box.h);
        bp.hatch(cc, box, { pitch: 11, angle: 45, col: SK.dim });
        cc.strokeStyle = SK.ink; cc.lineWidth = 2; cc.strokeRect(box.x, box.y, box.w, box.h);
        cc.fillStyle = SK.bg; cc.fillRect(-90, -120, 150, 130);
        cc.strokeStyle = SK.ink; cc.lineWidth = 2; cc.strokeRect(-90, -120, 150, 130);
        bp.dim(cc, { x: -90, y: -140 }, { x: -90, y: 10 }, "TRAVEL 3.6", { size: 20, col: AMBER, off: -42 });
        bp.leader(cc, { x: 20, y: 60 }, { x: 250, y: 150 }, "45 cN", { size: 22, col: SK.hair, sub: "ACTUATION FORCE" });
        bp.lab(cc, 22, { col: SK.hair, align: "center" }); cc.fillText("SECTION A — A", -20, 190); bp.untrack(cc);
      }, { t, scale: 0.92 });
      break;
    case "prayer":
      plate(c, card, at, (cc) => {
        const nodes = [["PRESS", -330, 0], ["QUEUE", -110, 0], ["STOCK", 110, 0]];
        nodes.forEach(([lb, x, y], j) => { bp.node(cc, x, y, 48, { t, label: lb, col: j < 2 ? CYAN : SK.dim, glyph: String(j + 1), size: 20 }); if (j) bp.edge(cc, { x: nodes[j - 1][1] + 50, y }, { x: x - 50, y }, { arrow: 10, col: CYAN, w: 1.6 }); });
        bp.edge(cc, { x: 162, y: 0 }, { x: 300, y: 0 }, { arrow: 11, col: RED, dash: [8, 8] });
        bp.node(cc, 350, 0, 48, { t, label: "RESPONSE", glyph: "?", col: RED, size: 20 });
        bp.lab(cc, 24, { col: RED, align: "center" }); cc.fillText("OPEN LOOP  ·  NO FEEDBACK PATH", 10, 150); bp.untrack(cc);
      }, { t, scale: 0.92 });
      break;
    case "bell": plate(c, card, at, (cc) => bellSection(cc, K2, S, ease(u * 2)), { t, scale: 0.72 }); break;
    case "feeds": plate(c, card, at, (cc) => feedGraph(cc, K2, S, u * 1.4), { t, scale: 0.85, dy: -130 }); break;
    case "units": plate(c, card, at, (cc) => unitCheck(cc, K2, clamp((u - 0.3) * 2)), { t, scale: 0.95, dx: -10, dy: -40 }); break;
    case "pump": plate(c, card, at, (cc) => pumpjack(cc, K2, S, t * 7.2), { t, scale: 0.82, dy: -60 }); break;
    case "observer":
      plate(c, card, at, (cc) => {
        printHis(cc, K2, S, "pod2cut", -220, 0, 330, { clip: 165, oy: 70 });
        cc.strokeStyle = SK.ink; cc.lineWidth = 2.4; cc.beginPath(); cc.arc(-220, 0, 165, 0, 7); cc.stroke();
        bp.frameTicks(cc, -395, -175, 350, 350, { col: AMBER, len: 30, label: "SUBJECT" });
        bp.callout(cc, 10, -140, "OBSERVER", [["SAMPLE SIZE", "1"], ["WELLS SEEN", "00", RED], ["VOLUME", "LOUD", AMBER]], { w: 420, size: 23 });
      }, { t, scale: 0.88 });
      break;
    case "well": plate(c, card, at, (cc) => wellSection(cc, K2, S), { t, scale: 0.8, dy: -60 }); break;
    case "ceo":
      plate(c, card, at, (cc) => {
        // the flip lands three frames before "Also", the creator's ruling from 9/26, kept through all three versions
        const A = S.fastArt.v2, also = K.at ? K.at(14, "ALSO") : null, flipped = also ? t >= also.t - 3 / 30 : false;
        const art = A ? (flipped ? A.ceo.jacket : A.ceo.suit) : null;
        if (art) { const img = art[0], w = 300, h = w * img.height / img.width; cc.drawImage(img, -290 - w / 2, -h / 2, w, h); }
        bp.frameTicks(cc, -470, -250, 370, 500, { col: SK.hair, len: 28, label: "SPEAKER" });
        bp.callout(cc, -40, -150, "STATEMENT", [["ON RECORD", "VERBATIM"], ["PRIORITY 1", "GAMING", CYAN], ["PRIORITY 1", "ENTERPRISE", RED]], { w: 470, size: 23 });
      }, { t, scale: 0.86 });
      break;
    case "flow": {
      const flip = card.at === "ENTERPRISE" ? ease(clamp((t - card.t0) / 0.26)) : t > (M.TK0 ?? Infinity) ? 1 : 0;
      plate(c, card, at, (cc) => allocation(cc, K2, u, flip), { t, scale: 0.75, dx: 40, dy: 30 });
      break;
    }
    case "scope": {
      const lock = ease(clamp(u * 1.8));
      const from = { x: W * 0.18, y: H * 0.74 }, p = { x: lerp(from.x, at.x, lock), y: lerp(from.y, at.y, lock) };
      bp.dash(c, [[from.x, from.y], [p.x, p.y]], [10, 9], { col: "rgba(255,42,61,0.5)", w: 1.4 });
      bp.crosshair(c, p.x, p.y, 130 - lock * 54, { col: RED, brackets: true, w: 2.2 });
      bp.lab(c, 26, { col: RED }); c.fillText(lock > 0.95 ? "TARGET ACQUIRED" : "SLEWING FROM: GAMERS", p.x + 96, p.y - 96); bp.untrack(c);
      break;
    }
    case "jacket":
      plate(c, card, at, (cc) => {
        bp.axon(cc, -400, -120, 300, 220, 80, { col: SK.ink, bg: SK.panel, top: "rgba(244,241,234,0.08)" });
        bp.lab(cc, 22, { col: SK.hair, align: "center" }); cc.fillText("ITEM 01", -250, 160); bp.untrack(cc);
        bp.callout(cc, -20, -170, "BILL OF MATERIALS", [["JACKET", "IN STOCK", GREEN], ["LEAD TIME", "0 DAYS", GREEN],
          ["THE CARD", "NO", RED], ["THE RAM", "NO", RED], ["THE DRIVE", "NO", RED]], { w: 450, size: 23 });
      }, { t, scale: 0.86 });
      break;
    case "bots": {
      for (let j = 0; j < 9; j++) {
        const a = j / 9 * Math.PI * 2 + t * 0.5, r = lerp(470, 110, ease(u));
        const p = { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r * 0.62 };
        bp.edge(c, p, { x: at.x, y: at.y }, { col: "rgba(94,242,255,0.32)", w: 1.2, dash: [6, 8], offset: -t * 40 });
        bp.node(c, p.x, p.y, 28, { col: CYAN, glyph: "B", label: HANDLES ? HANDLES[j % HANDLES.length] : null, size: 16, hot: song.kickEnv(t, 0.1) });
      }
      bp.crosshair(c, at.x, at.y, 76, { col: RED, brackets: true, ring: false, w: 2 });
      break;
    }
    case "timing": plate(c, card, at, (cc) => timingDiagram(cc, K2, 0.001, 2.4, ease(u * 1.5)), { t, scale: 0.74, dy: 40 }); break;
    case "thumb": plate(c, card, at, (cc) => thumbLinkage(cc, K2, u), { t, scale: 1.0, dy: -60 }); break;
    case "log": {
      const rows = Math.min(9, Math.floor(u * 12) + 1);
      plate(c, card, at, (cc) => {
        const list = Array.from({ length: rows }, (_, j) => [`FILL ${String(j + 1).padStart(2, "0")}  ·  BOT`, money(START_PRICE), j === rows - 1 ? GREEN : SK.ink]);
        bp.callout(cc, -300, -250, "ORDER LOG", list, { w: 600, size: 23, rowH: 42 });
      }, { t, scale: 1.05 });
      break;
    }
    case "unit":
      plate(c, card, at, (cc) => {
        bp.axon(cc, -300, -110, 300, 190, 76, { col: SK.ink, bg: SK.panel });
        bp.dim(cc, { x: -300, y: 130 }, { x: 0, y: 130 }, "QTY 1", { size: 26, col: AMBER, off: 0 });
        bp.callout(cc, 60, -140, "RESALE", [["BOUGHT", "9"], ["OFFERED", "1", AMBER], ["TO", "YOU", RED]], { w: 380, size: 23 });
      }, { t, scale: 1.15 });
      break;
    case "triple":
      plate(c, card, at, (cc) => {
        bp.lab(cc, 28, { col: SK.hair, align: "center" }); cc.fillText(money(START_PRICE), -290, -20);
        cc.letterSpacing = "0px"; cc.font = font(130, DISPLAY); cc.textAlign = "center"; cc.fillStyle = RED; cc.fillText("× 3", 0, 10);
        bp.lab(cc, 36, { col: RED, align: "center" }); cc.fillText(money(START_PRICE * 3), 300, -20); bp.untrack(cc);
        bp.dim(cc, { x: -290, y: 80 }, { x: 300, y: 80 }, "+ $2,399.98", { size: 24, col: RED, off: 0 });
      }, { t, scale: 0.92 });
      break;
    case "halt": {
      const left = Math.max(0, M.REOPEN - t);
      bp.hazard(c, 60, 60, W - 120, 92, { phase: 0, alpha: 0.9 });
      bp.hazard(c, 60, H - 152, W - 120, 92, { phase: 18, alpha: 0.9 });
      c.save(); c.letterSpacing = "0px";
      c.font = font(126, DISPLAY); c.textAlign = "center"; c.textBaseline = "alphabetic";
      c.fillStyle = SK.shadow; c.fillText("TRADING HALTED", W / 2 + 6, 340 + 6);
      c.fillStyle = RED; c.fillText("TRADING HALTED", W / 2, 340);
      bp.lab(c, 34, { col: SK.ink, align: "center" }); c.fillText(`RESUMES IN ${left.toFixed(2)} s`, W / 2, 400);
      bp.lab(c, 22, { col: AMBER, align: "center" }); c.fillText("CAUSE: THE RACKET   ·   VOLATILITY LIMIT   ·   NO CANDLE FORMS", W / 2, 440);
      bp.untrack(c);
      c.restore();
      bp.segMeter(c, W / 2 - 300, 470, 600, 14, clamp(1 - left / Math.max(0.3, M.REOPEN - M.HALT0)), { n: 30, hotAt: 0.8, col: AMBER, hot: RED });
      break;
    }
    case "rays": plate(c, card, at, (cc) => rayDiagram(cc, K2, st, M, ease(u * 1.6)), { t, scale: 0.66, dy: 40 }); break;
    case "stream":
      plate(c, card, at, (cc) => {
        const chain = ["CAM", "ENCODER", "CDN", "VIEWERS"];
        chain.forEach((lb, j) => {
          const x = -400 + j * 250, on = u * 4 > j ? 1 : 0.25;
          cc.globalAlpha = on;
          bp.axon(cc, x - 68, -160, 136, 100, 44, { col: j === 3 ? AMBER : SK.hair, bg: SK.panel });
          bp.lab(cc, 20, { col: j === 3 ? AMBER : SK.hair, align: "center" }); cc.fillText(lb, x, -18); bp.untrack(cc);
          if (j) bp.edge(cc, { x: x - 182, y: -110 }, { x: x - 74, y: -110 }, { arrow: 9, col: CYAN, w: 1.6 });
          cc.globalAlpha = 1;
        });
        bp.callout(cc, -180, 30, "CHANNEL", [["BITRATE", "6,000 kbps"], ["VIEWERS", "12,400", AMBER], ["HUMANS", "?", RED]], { w: 420, size: 23 });
      }, { t, scale: 0.88 });
      break;
    case "ring": plate(c, card, at, (cc) => ringPolar(cc, K2, 1), { t, scale: 1.0, dy: -10 }); break;
    case "cam":
      plate(c, card, at, (cc) => {
        bp.axon(cc, -340, -120, 340, 220, 84, { col: SK.ink, bg: SK.panel, top: "rgba(244,241,234,0.08)" });
        cc.strokeStyle = SK.ink; cc.lineWidth = 3; cc.beginPath(); cc.arc(-200, -10, 66, 0, 7); cc.stroke();
        cc.strokeStyle = SK.dim; cc.beginPath(); cc.arc(-200, -10, 42, 0, 7); cc.stroke();
        cc.fillStyle = RED; cc.beginPath(); cc.arc(-50, -84, 11, 0, 7); cc.fill();
        bp.lab(cc, 21, { col: RED }); cc.fillText("REC", -32, -76); bp.untrack(cc);
        bp.dim(cc, { x: -340, y: 140 }, { x: 0, y: 140 }, "SENSOR 36 × 24", { size: 21, col: SK.hair, off: 0 });
        bp.callout(cc, 60, -140, "CAPTURE", [["FRAME", "1920 × 1080"], ["SUBJECT", "HIM"], ["IN STOCK", "HIS", GREEN]], { w: 380, size: 23 });
      }, { t, scale: 0.88 });
      break;
    case "lastgen":
      plate(c, card, at, (cc) => {
        bp.lab(cc, 26, { col: AMBER }); cc.fillText("SERIES 02  ·  LAST GEN", -390, -190); bp.untrack(cc);
        cc.strokeStyle = AMBER; cc.lineWidth = 3; cc.setLineDash([16, 10]); cc.beginPath();
        for (let j = 0; j <= 40; j++) { const x = -390 + j * 19.5, y = 120 - Math.pow(j / 40, 1.9) * 260 * ease(u * 1.5); j ? cc.lineTo(x, y) : cc.moveTo(x, y); }
        cc.stroke(); cc.setLineDash([]);
        bp.callout(cc, -390, -160, null, [["LAST GEN", gainText(st.price * 0.42), AMBER], ["CONDITION", "USED", RED], ["SOURCE", "A MINE"]], { w: 430, size: 23 });
      }, { t, scale: 0.82 });
      break;
    case "exploded": plate(c, card, at, (cc) => cardExploded(cc, K2, ease(u * 1.5)), { t, scale: 0.85, dx: -80 }); break;
    case "mine":
      plate(c, card, at, (cc) => {
        printAt(cc, K2, "v2-mine", -90, 0, 620, 0.02, { alpha: 0.8 });
        cc.strokeStyle = AMBER; cc.lineWidth = 2; cc.setLineDash([12, 9]);
        cc.strokeRect(-380, -170, 580, 340); cc.setLineDash([]);
        bp.lab(cc, 20, { col: AMBER }); cc.fillText("SITE BOUNDARY", -380, -186); bp.untrack(cc);
        bp.callout(cc, 230, -130, "PROVENANCE", [["UNITS", "~4,100"], ["RAN", "24 / 7"], ["DISCLOSED", "NO", RED]], { w: 380, size: 23 });
      }, { t, scale: 0.82 });
      break;
    case "thermal": plate(c, card, at, (cc) => thermal(cc, K2, ease(u * 1.7)), { t, scale: 0.95, dx: 20 }); break;
    case "hours": plate(c, card, at, (cc) => hourMeter(cc, K2, u * 1.6), { t, scale: 1.55 }); break;
    case "ram":
      plate(c, card, at, (cc) => {
        bp.axon(cc, -300, -130, 600, 70, 40, { col: CYAN, bg: SK.panel });
        for (let j = 0; j < 8; j++) { cc.fillStyle = "rgba(94,242,255,0.25)"; cc.fillRect(-260 + j * 66, -114, 48, 46); }
        bp.dim(cc, { x: -300, y: -20 }, { x: 300, y: -20 }, "SERIES 03  ·  16 GB", { size: 23, col: CYAN, off: 0 });
        bp.callout(cc, -300, 40, null, [["RAM", "+200%", CYAN], ["MAKERS", "THREE"], ["TO THE BUILDINGS", "90%", RED]], { w: 600, size: 24 });
      }, { t, scale: 0.84 });
      break;
    case "proj": projection(c, V, M, t, st, ease(clamp((t - M.FC0) / 0.5))); break;
    case "select": plate(c, card, at, (cc) => selector(cc, K2, clamp((t - card.t0) / Math.max(0.3, (card.t1 - card.t0) * 0.8))), { t, scale: 1.35 }); break;
    case "rev": plate(c, card, at, (cc) => revisionBlock(cc, K2, u * 1.5), { t, scale: 1.0, dy: 40 }); break;
    case "date":
      plate(c, card, at, (cc) => {
        cc.letterSpacing = "0px"; cc.font = font(170, DISPLAY); cc.textAlign = "center"; cc.textBaseline = "middle";
        cc.fillStyle = SK.shadow; cc.fillText("2026", 6, 6); cc.fillStyle = SK.ink; cc.fillText("2026", 0, 0);
        bp.lab(cc, 26, { col: RED, align: "center" }); cc.fillText("DATE OF ISSUE  ·  ALREADY PAST", 0, 130); bp.untrack(cc);
        bp.frameTicks(cc, -260, -120, 520, 210, { col: RED, len: 30 });
      }, { t, scale: 1.3 });
      break;
    case "flood": numberFlood(c, t, M); break;
    case "launch":
      numberFlood(c, t, M);
      bp.lab(c, 28, { col: RED, align: "center" });
      c.fillText("SHEET ENDS  ·  NO FURTHER REVISIONS", W / 2, H - 170); bp.untrack(c);
      break;
    default: break;
  }
}

// =====================================================================================================================
// the plan, the warm times, and one frame
// =====================================================================================================================
export function ascentPlan(STEP) {
  const plan = fastPlan(STEP, [12, 13, 14, 15, 16, 17, 18, 19], AC);
  if (!plan) return null;
  // the verse's first frame: the chorus's shot hands over here (the AltMan leaves as the verse arrives)
  const v2 = song.sections.filter(s => s.kind === "verse")[1];
  plan.t0 = plan.cards[0].t0 = Math.min(plan.cards[0].t0, v2.t0 - 0.35);
  plan.M = buildModel(plan);
  // step 19's sheet stamps its own title block out, from the beat that says so
  const supersede = plan.cards.find(c => c.art === "rev");
  plan.cards.forEach(c => { if (c.n === 19) c.superseded = (supersede?.t0 ?? Infinity) + 0.25; });
  // THE FLIP's clock (the creator's 9/26 ruling, kept): the suit hands over to the jacket three frames before "Also". He rises
  // most of a second earlier and holds in the jacket to the end of the line, so it survives the cut between the two
  // beats the way step 25's BUILD survives its own.
  const also = plan.find(14, "ALSO"), thanks = plan.cards.find(c => c.n === 14 && c.at === "THANKS");
  if (also) {
    const land = also.t - 3 / 30;
    // he arrives as his own beat does, not over the one before it, and he holds to the end of the sung line
    plan.CEO = { land, spin0: land - 0.28, rise: land - 0.62, out: (thanks?.t1 ?? land + 1.6) - 0.1, end: (thanks?.t1 ?? land + 1.6) + 0.12 };
  }
  // what the headless probe reads: the numbers this verse is steered by, at any t (tools/probe-ascent.mjs)
  plan.probe = t => {
    const st = chartState(plan.M, t), PA = panicAt(plan.M, t, st);
    let card = plan.cards[0];
    for (const cd of plan.cards) if (t >= cd.t0) card = cd;
    return { t, panic: PA.p, raw: PA.raw, spike: PA.spike, axis: st.k, price: st.price, candles: st.n, cam: card.cam, art: card.art, n: card.n, title: card.title };
  };
  return plan;
}
export function ascentTimes(plan) {
  if (!plan) return [];
  const M = plan.M;
  return [...fastTimes(plan), ...M.EV.flatMap(e => [e.te + 0.02, e.te + 0.2, e.te + 0.5]), M.HALT0 + 0.3, M.REOPEN + 0.02,
    M.LAUNCH + 0.2, M.FC0 + 0.4, M.lastGen + 0.2, M.ram + 0.2, M.FLOOD0 + 0.3, M.STRIKE + 0.1, (M.LAUNCH + M.END) / 2];
}

// This verse draws on its OWN full-frame layer, not the fast cut's. Two reasons: it needs the glitch stage for the
// chromatic aberration the creator's brief asks for, and giving S.fast that shader would change every verse-1 and intro frame
// by a hair, which would cost the "everything outside verse 2 is hash-identical" check. Captures get a fresh canvas
// per frame for the same reason the fast cut does (lesson L80: a long-lived 2D canvas is not bit-exact across its
// own history).
function ascLayer(S) {
  const L = S.asc;
  if (EXACT) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; L.canvas = cv; L.ctx = ctx2d(cv); L.tex.image = cv; }
  const c = L.begin();
  L.mesh.visible = true;
  c.fillStyle = SK.bg; c.fillRect(0, 0, W, H);      // the stock, opaque: nothing of the 3D stage leaks through a seam
  return c;
}

export function ascentCut(t, S, plan) {
  const M = plan.M, F = S.fastArt;
  if (!F.v2) marketArt(S, F);                        // the CEO's mosaic tiles, the heat print, the mine (shared with market.js)
  // The backdrop is drawn under every frame of the whole video and keeps whatever the last shot set on it. This
  // layer's canvas is opaque, but its glitch stage SAMPLES OUTSIDE ITSELF -- a shoved band or a colour-split fringe
  // reads past the texture's edge and comes back with alpha 0, so the layer has holes, and through the holes the
  // backdrop showed in the state some earlier shot had left it. The determinism instrument caught it the moment a
  // list mixed verse-2 frames with frames from the rest of the song: 29 of 42 flipped, and the layer's own canvas
  // hashed identical every time, which is the tell that the difference is BELOW the layer (lesson L80's family).
  backdrop(S, [1, 0, 0], { haze: 0, grid: 0, shaft: [0, 0, 0, 0] });
  let card = plan.cards[0];
  for (const cd of plan.cards) if (t >= cd.t0) card = cd;
  // the beat's stock, dealt so two beats running never print alike, and handed to the kit before anything is drawn
  SK = STOCKS[card.stock ?? DEAL[card.i % DEAL.length]] ?? STOCKS.screen;
  Object.assign(bp.PEN, { hair: SK.hair, dim: SK.dim, ink: SK.ink, bg: SK.bg, panel: SK.panel });
  const st = chartState(M, t), PA = panicAt(M, t, st);
  const c = ascLayer(S), L = S.asc;
  const kk = song.lastKick(t), k = song.kickEnv(t, 0.12);
  const V = viewAt(M, t, st, card, PA);
  const K = { t, t0: card.t0, t1: card.t1, n: card.n, k, kick: kk, words: card.words, w: card.find, at: card.findAny, card, F, ws: 1 };

  // the space, the trail, the apparatus, the words, the sheet. The base is already opaque (fastLayer).
  c.save(); c.lineCap = "butt"; c.lineJoin = "miter"; c.letterSpacing = "0px";
  // panic reddens the air itself
  if (PA.p > 0.25) { c.fillStyle = SK === STOCKS.paper ? `rgba(255,42,61,${(PA.p - 0.25) * 0.14})` : `rgba(90,8,16,${(PA.p - 0.25) * 0.34})`; c.fillRect(0, 0, W, H); }
  drawSpace(c, V, M, t, st, PA);
  drawTrail(c, V, M, t, st, PA);
  c.save(); apparatus(c, V, M, t, st, card, K, S, PA); c.restore();
  drawHead(c, V, M, t, st, PA, card);
  const ceo = plan.CEO ? ceoFlip(c, t, K, S, plan.CEO, PA) : null;   // lives across the cut, like step 25's BUILD
  if (card.say) { c.save(); shout(c, K, { ...card.say, hot: card.hot }); c.restore(); }
  c.save(); sheet(c, t, card, st, M, PA); c.restore();
  c.restore();
  L.end();
  layerFx(L, t, PA);

  // ---- the film: panic IS the grade (the creator's ask: chromatic aberration as the panic climbs) ----
  const cut = since(t, card.t0, 0.045);
  const fx = {
    ca: 0.0014 + PA.p * 0.013 + PA.spike * 0.008 + k * 0.004 * (0.4 + PA.p) + cut * 0.009,
    glitch: PA.p * 0.18 + PA.spike * 0.3 + (card.halt ? 0 : cut * 0.26 + k * 0.05 * PA.p),
    flash: PA.spike * 0.34 + (card.halt ? 0 : cut * 0.2),
    grain: 0.05 + PA.p * 0.06,
    vignette: 0.2 + PA.p * 0.3,
    weave: 0.35 + PA.p * 0.7,
    bloom: 0.3 + PA.p * 0.25,
    invert: 0,
  };
  if (ceo) { fx.flash += ceo.flash; fx.ca += ceo.ca; fx.glitch += ceo.glitch; fx.invert = Math.max(fx.invert, ceo.invert); }
  // the axis giving up, the reopening, and the strike each get their two inverted frames
  for (const e of M.EV) if (t >= e.te - 1e-6 && t < e.te + 2 / 30) fx.invert = 1;
  if (t >= M.REOPEN - 1e-6 && t < M.REOPEN + 2 / 30) fx.invert = 1;
  if (t >= M.WRONG - 0.02 && t < M.WRONG + 2 / 30) fx.invert = 1;
  // the pre-drop break: the picture comes apart harder every sixteenth
  if (t >= M.BREAK) {
    const u = clamp((t - M.BREAK) / Math.max(0.2, M.END - M.BREAK)), q = Math.floor((t - M.BREAK) / (song.BEAT / 4));
    const tq = M.BREAK + q * song.BEAT / 4;
    fx.glitch += 0.06 + u * 0.36 + since(t, tq, 0.03) * (0.12 + u * 0.32);
    fx.ca += u * 0.013;
  }
  // a ceiling on the tear: past about this the post pass shoves bands far enough that the frame stops reading as a
  // picture coming apart and starts reading as a broken render (measured on the launch, where three sources stacked)
  fx.glitch = Math.min(fx.glitch, 0.46);
  return fx;
}

// the FX stage on the layer itself: a second, DIRECTIONAL split on top of the post chain's radial one, so the trail
// and the drawing tear as their own object rather than the whole frame smearing uniformly
function layerFx(L, t, PA) {
  const U = L.mat.uniforms;
  if (!U.ca) return;
  const kk = song.lastKick(t), kdt = kk ? t - kk.t : 9, kv = kdt < 1.5 ? Math.exp(-kdt / 0.09) : 0;
  const big = kk && (Math.round(song.beatAt(kk.t)) % 4 === 0 || h32(kk.i, 5) < 0.2) ? 1 : 0;
  const ang = (kk ? h32(kk.i, 7711) : 0) * Math.PI * 2;
  U.ca.value = 0.0008 + PA.p * 0.004 + kv * (0.002 + big * 0.004) * (0.3 + PA.p) + PA.spike * 0.004;
  U.caDir.value.set(Math.cos(ang), Math.sin(ang) * 0.6);
  U.tear.value = Math.min(1, PA.p * 0.25 + (kdt < 1.5 ? Math.exp(-kdt / (big ? 0.05 : 0.035)) * (big ? 0.6 : 0.15) * PA.p : 0) + PA.spike * 0.5);
  U.block.value = big && kdt < 2 / 30 ? 0.6 * PA.p : 0;
  U.scan.value = 0.04 + PA.p * 0.1;
  U.seed.value = (kk ? kk.i * 17 : 0) + fi(t);
  U.frame.value = fi(t);
}
