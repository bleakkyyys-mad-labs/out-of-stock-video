// The director: what is on screen at song time t. Pure function of t (no state carries between frames).
// Shot choice and every sync point come from the song data (song.js), never from hand-typed seconds.
import * as THREE from "three";
import * as song from "./song.js";
import { resetStage, place } from "./stage.js";
import { C, font, decode, drawDecoded, drawGlitched, drawTyped, MONO, ctx2d } from "./type.js";
import { FILM } from "./post.js";
import { SCRIPTS, GW, GH, drawCandles, setAudio } from "./gui.js";
import { showStill } from "./dancer.js";
import { fastPlan, fastCut, fastTimes } from "./fastcut.js";
import { camera, anchor, backdrop, hud } from "./rig.js";
import { introShot, introTimes, introCardTimes } from "./intro.js";
import { ascentPlan, ascentCut, ascentTimes } from "./ascent.js";
import { meltPlan, meltdown, meltTimes, meltPanic } from "./meltdown.js";
import { chorusPlan, planAt, chorusSheet, chorusType, chorusTimes, chorusProbe, stormTarget, dotTarget, blueCam } from "./chorus.js";
import { PORTRAIT } from "./frame.js";

const { h32, kickEnv, words, lines, lineWords } = song;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const firstVerse = song.sections.find(s => s.kind === "verse");
const easeOutBack = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ---------- the AltMan's turn in every chorus (the creator's direction, 9/25 night) ----------
// right before the buildings' line he comes in from outside the frame and lands in the middle (his neutral
// portrait); on "It's" he flips to the smirk; the print pass turns him into ink and he dances until the next
// verse, then glitches out. The dance's own pulse is 10 source frames (0.417 s at 24 fps, measured): played at
// 25 drawings a second it is the song's beat, and its first pose landing (frame 23) is put on a beat of the grid.
const DANCE_RATE = 25, DANCE_LAND = 23;
// after its first pass the dance loops frames 25-104, 8 beats, each loop opening on a 2-frame tear (9/29: the clip's
// last 1.6 s, standing with his hands on his hips, is left out, so his five dances fit before the video's end)
const LOOP_IN = 25, LOOP_OUT = 104, LOOP = LOOP_OUT - LOOP_IN + 1;
// the last chorus (the creator's call, 9/29): he dances five times, the fifth is chorus 2's dance frame for frame, and when its
// turn brings him back round to face us (frame 93, on the drums' return) he teleports out like Mega Man, in one beat
const DANCES = 5, TURNED = 93, TELE = song.BEAT;
const onBeat = x => song.GRID0 + Math.ceil((x - song.GRID0) / song.BEAT - 1e-6) * song.BEAT;
const PLAN = song.sections.filter(s => s.kind === "chorus").map((s, i) => {
  const li = s.lines.find(l => /compute for us/i.test(lines[l].text));
  if (li === undefined) return null;
  const ws = lineWords(li), its = ws[0].t;
  const reveal = (ws[1] ? ws[1].t : its + 0.25) + 0.02;                     // the smug face lands on "COMPUTE"
  const next = song.sections.find(x => x.t0 > its);      // not "after the chorus ends": chorus 2's held "thee" ends 60 ms before verse 3
  const land = its - 0.3, spin0 = its - 0.12, pull0 = reveal + 0.42, pull1 = pull0 + 0.4, print0 = pull0 + 0.1;
  const d0 = onBeat(print0 + 0.9 + DANCE_LAND / DANCE_RATE) - DANCE_LAND / DANCE_RATE;
  // after a chorus with a verse to come he leaves as the verse arrives (the verse shot takes over 0.35 s early); after
  // the last one he teleports out as his fifth dance turns back round
  const tele = next ? undefined : d0 + (LOOP_OUT + 1 + (DANCES - 2) * LOOP + TURNED - LOOP_IN) / DANCE_RATE;
  const end = next ? next.t0 - 0.35 : tele + TELE;
  return { i, its, enter: land - 0.65, land, spin0, reveal, pull0, pull1, print0, d0, exit0: end - 0.45, end, tele };
}).filter(Boolean);
export const altmanPlan = PLAN;
// the chorus as the creator redesigned it (9/29, chorus.js): blue and white, the questions set as the reference video
// sets type, the buildings drawn a stroke per syllable; red from "COMPUTE" on.
// Built on first use: its type is measured in the outline fonts, which load after this module does
let CH;
const chorusPlans = () => (CH === undefined ? (CH = chorusPlan(PLAN)) : CH);
window.OOS_CHORUS = () => chorusProbe(chorusPlans() ?? []);          // for the headless probes
// every fast-cut card once (main.js draws them at boot, before any capture: first draws differ, lesson L80)
export const fastWarm = () => [...fastTimes(FAST), ...introCardTimes(), ...V2TIMES(V2), ...meltTimes(v3plan()), ...chorusTimes(chorusPlans() ?? [])];
const altmanAt = t => PLAN.find(p => t >= p.enter && t < p.end);

function altman(t, S, p, k) {
  const D = S.dancer, out = { g: 0, glitch: 0, flash: 0, ca: 0, invert: 0 };
  // the entrance (the creator's note): out of the camera itself, travelling inward to his mark in the middle of the frame,
  // a little overshoot in depth as he's put down; afterimages trail him in
  const home = [0, 0.45, 0], c = S.camera, cam = c.position;          // (the drop's own camera, already placed)
  const start = [lerp(cam.x, home[0], 0.06), lerp(cam.y, home[1], 0.06), lerp(cam.z, home[2], 0.06)];
  const dir = p.i % 2 ? -1 : 1;
  const along = tt => {
    const u = clamp((tt - p.enter) / (p.land - p.enter)), e = easeOutBack(u);
    return { u, pos: start.map((a, j) => lerp(a, home[j], e)), tilt: (1 - easeOut(u)) * 0.5 * dir };
  };
  const now = along(t);
  // THE TURN (the creator's note, 9/26: dramatic, "the face goes from friendly to smug"): a wind-up, one whip turn that hands
  // the neutral face over to the smug one on its last quarter, landing on "COMPUTE"
  const spinAt = tt => {
    if (tt < p.spin0) return 0;
    const x = clamp((tt - p.spin0) / (p.reveal - p.spin0));
    return dir * (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2) * 2 * Math.PI;   // quart in-out: wind-up, whip, stop
  };
  const smugAt = tt => tt >= p.reveal || Math.abs(spinAt(tt)) > 1.5 * Math.PI;
  const ry = spinAt(t), smug = smugAt(t);
  // the camera: a crash zoom into his face that arrives with the reveal (accelerating, a dutch tilt), a beat on the
  // smirk with the camera still shaking from the hit, then back out to the drop's own framing as he turns to ink
  const zin = t < p.spin0 ? 0 : t < p.reveal ? Math.pow((t - p.spin0) / (p.reveal - p.spin0), 3)
            : t < p.pull0 ? 1 : 1 - ease((t - p.pull0) / (p.pull1 - p.pull0));
  if (zin > 0 && D.face) {
    const fp = [home[0] + D.face.x, home[1] + D.face.y, home[2]], fov = 30;
    const d = (D.face.h / 0.24) / (2 * Math.tan(fov * Math.PI / 360));    // his face a quarter of the frame tall
    const fr = Math.floor(t * 30), sh = since(t, p.reveal, 0.2) * 0.07;
    const roll0 = Math.atan2(c.up.x, c.up.y);
    camera(S, [lerp(cam.x, fp[0], zin) + (h32(fr, 31) - 0.5) * sh, lerp(cam.y, fp[1], zin) + (h32(fr, 32) - 0.5) * sh, lerp(cam.z, fp[2] + d, zin)],
      [lerp(0, fp[0], zin), lerp(LOOK_Y, fp[1], zin), fp[2] * zin], lerp(roll0, -0.13 * dir, zin), lerp(c.fov, fov, zin));
    // the focus lines close in on his face and burst on the hit
    const su = S.speed.material.uniforms;
    su.center.value.set(0.5, 0.5); su.inner.value = lerp(su.inner.value, 0.07, zin); su.count.value = 260;
    su.gain.value += since(t, p.reveal, 0.3) * 2.5; su.alpha.value = Math.min(1, su.alpha.value + zin * 0.35);
  }
  if (t >= p.reveal) {                           // the hit: a 2-frame manga impact frame, a flash, the plates split
    out.invert = t < p.reveal + 2 / 30 ? 1 : 0;
    out.flash = since(t, p.reveal, 0.14) * 0.9; out.ca = since(t, p.reveal, 0.22) * 0.012; out.glitch = since(t, p.reveal, 0.1) * 0.35;
  }
  // the exit after choruses 1 and 2: the glitch builds, then he collapses to a line, like a screen switching off
  let sx = 1, sy = 1;
  if (p.tele === undefined && t >= p.exit0) {
    const x = clamp((t - p.exit0) / (p.end - p.exit0));
    out.g = x * x;
    if (x > 0.72) { const cc = (x - 0.72) / 0.28; sy = lerp(1, 0.02, ease(cc)); sx = lerp(1, 1.25, cc); }
  }
  const frame = Math.floor(t * 30);
  const set = (mm, o) => { const U = mm.material.uniforms; U.glitch.value = o.glitch ?? 0; U.frame.value = frame; U.gain.value = o.gain ?? 1; U.opacity.value = o.opacity ?? 1; U.tintAmt.value = o.tintAmt ?? 0; U.white.value = o.white ?? 0; };
  if (t < p.print0) {
    // the portraits at full resolution (the close-up would show the canvas's softness)
    const pm = D.portrait;
    pm.visible = true; pm.material.uniforms.map.value = smug ? D.P.smug : D.P.norm;
    pm.position.set(...now.pos); pm.rotation.set(0, ry, now.tilt); pm.scale.set(1, 1, 1);
    set(pm, {});
  } else {
    // the canvas: the print pass into ink, then the dance (looping on its beat if it runs out)
    let pump = 1, mirror = 1;
    if (t < p.d0) {
      const rho = Math.min(D.R.INTRO - 1, Math.floor(10 + (D.R.INTRO - 10) * (t - p.print0) / (p.d0 - p.print0)));
      D.draw("i" + rho, R => R.intro(rho));
    } else {
      let f = Math.floor((t - p.d0) * DANCE_RATE);
      if (f > LOOP_OUT) {                             // the loop, every other one mirrored so they don't read as a GIF
        const loc = (f - LOOP_OUT - 1) % LOOP, lap = Math.floor((f - LOOP_OUT - 1) / LOOP);
        f = LOOP_IN + loc; mirror = lap % 2 === 0 ? -1 : 1;
        if (loc < 2) out.g = Math.max(out.g, 0.55);
      }
      D.draw("d" + f, R => R.dance(f));
      pump = 1 + k * 0.03;
    }
    const m = D.mesh;
    m.visible = true; m.position.set(...now.pos); m.rotation.set(0, 0, now.tilt); m.scale.set(sx * pump * mirror, sy * pump, 1);
    set(m, { glitch: out.g });
    if (p.tele !== undefined && t >= p.tele) teleport(t, p, D, m, mirror, pump, out, set);
  }
  // afterimages: on the way in, where he was 30, 60 ... 180 ms ago; through the whip, where he was facing 22, 44 ...
  // ms ago (a fan of turns). The video's red and cyan, alternating down the trail; gone a beat after each lands.
  const trailIn = 1 - clamp((t - p.land) / 0.25), trailSpin = t < p.spin0 ? 0 : 1 - clamp((t - p.reveal) / 0.15);
  D.ghosts.forEach((gm, i) => {
    const G = gm.material.uniforms;
    if (trailSpin > 0) {
      const tt = t - (i + 1) * 0.022;
      gm.visible = true; gm.position.set(...now.pos); gm.rotation.set(0, spinAt(tt), now.tilt); gm.scale.set(1, 1, 1);
      G.map.value = smugAt(tt) ? D.P.smug : D.P.norm;
      set(gm, { opacity: 0.5 * (1 - (i + 1) / (D.ghosts.length + 1)) * trailSpin, tintAmt: 0.6, gain: 1.3 });
    } else {
      const tt = t - (i + 1) * 0.03, was = along(tt);
      if (tt < p.enter || trailIn <= 0 || was.u >= 1) return;
      gm.visible = true; gm.position.set(...was.pos); gm.rotation.set(0, 0, was.tilt); gm.scale.set(1, 1, 1);
      G.map.value = D.P.norm;
      set(gm, { opacity: 0.7 * (1 - (i + 1) / (D.ghosts.length + 1)) * trailIn, tintAmt: 0.6, gain: 1.3 });
    }
    G.tint.value.set(i % 2 ? 0x5ef2ff : 0xff2a3d);
  });
  return out;
}

// the last exit (the creator's "glitching out like Megaman", 9/29), one beat from the drums' return: the glitch hits him (a
// quarter beat), he squeezes into a white-hot sliver on his own centre line with his feet planted (a quarter), and the
// sliver goes up out of the frame as a beam (half a beat, gone before the next kick). m arrives placed for the dance
function teleport(t, p, D, m, mirror, pump, out, set) {
  const u = (t - p.tele) / TELE, b = D.R.body(TURNED), C = D.R.canvas.width / 2, k = D.px * pump;
  const ax = (b.cx - C) * k * mirror, feet = (C - b.bottom) * k, tall = (b.bottom - b.top) * k * 1.12;   // from the mesh's centre
  const hit = since(t, p.tele, 0.1);
  out.flash = Math.max(out.flash, hit * 0.6, since(t, p.tele + TELE / 2, 0.08) * 0.35);
  out.ca = Math.max(out.ca, since(t, p.tele, 0.16) * 0.012); out.glitch = Math.max(out.glitch, hit * 0.1);
  if (u < 0.5) {
    const v = clamp((u - 0.25) / 0.25), sx = lerp(1, 0.07, 1 - (1 - v) * (1 - v)), sy = lerp(1, 1.12, v);
    m.position.x += ax * (1 - sx); m.position.y += feet * (1 - sy);
    m.scale.x *= sx; m.scale.y *= sy;
    out.g = u < 0.25 ? 0.5 : lerp(0.3, 0.08, v);
    set(m, { glitch: out.g, white: u < 0.25 ? 0 : lerp(0.4, 1, v) });
    return;
  }
  out.g = 0;
  const v = (u - 0.5) / 0.5, bottom = m.position.y + feet + 16 * v * v, len = tall * (1 + 0.8 * v);
  m.visible = false;
  const bm = D.beam;
  bm.visible = true; bm.position.set(m.position.x + ax, bottom + len / 2, m.position.z + 0.05); bm.rotation.set(0, 0, 0);
  bm.scale.set(tall * 0.16, len, 1);
  bm.material.uniforms.frame.value = Math.floor(t * 30);
}

// ---------- the mascot (the creator's ask, 9/29: "the Claude crab mascot ... the cute Orange one", pop out while he's dancing,
// then wave good bye): Claude Code's crab as its startup block art draws it (▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝), one canvas
// pixel per quadrant, in the bottom-right corner. It pops up on the beat his fourth dance starts on, bobs and shuffles
// on every beat, jumps when the drums come back, watches him beam out, waves for five beats and ducks back down
const CRAB_BODY = ["...############...", "...##.######.##...", "...##############.", "...############..."];   // minus the left arm
const CRAB_ARM = [[[1, 2], [2, 2]], [[2, 2], [2, 1], [2, 0], [2, -1]], [[2, 2], [1, 1], [0, 0], [-1, -1]]];   // down, up, out
const CRAB_LEGS = [[4, 6, 11, 13], [3, 5, 12, 14]];
const beatFloor = x => song.GRID0 + Math.floor((x - song.GRID0) / song.BEAT + 1e-6) * song.BEAT;
const crabPlan = p => {
  const pop = beatFloor(p.d0 + (LOOP_OUT + 1 + (DANCES - 3) * LOOP) / DANCE_RATE), wave = p.tele + TELE;
  return { pop, wave, duck: wave + 5 * song.BEAT, gone: wave + 5 * song.BEAT + 0.2 };
};
export const crabTimes = p => { const c = crabPlan(p); return [c.pop + 0.1, c.pop + 1.0, p.tele + 0.1, p.tele + 0.3, c.wave + 0.1, c.wave + 0.3, c.duck + 0.1]; };
function crab(t, S) {
  const p = PLAN.find(q => q.tele !== undefined), c = p && crabPlan(p);
  if (!c || t < c.pop || t >= c.gone) return;
  const L = S.crab, m = L.mesh, bp = song.beatAt(t);
  const st = { up: t >= p.tele + TELE / 2 && t < c.wave,                                     // watching the beam go
    arm: t >= c.wave && t < c.duck ? 1 + Math.floor((t - c.wave) / (song.BEAT / 2)) % 2 : 0,   // the wave, twice a beat
    legs: t < c.wave ? Math.floor(bp) % 2 : 0 };
  const key = `${st.up}${st.arm}${st.legs}`;
  if (L.key !== key) {
    const g = L.begin(), dot = (x, y, col) => { g.fillStyle = col; g.fillRect(1 + x, 1 + y, 1, 1); };
    CRAB_BODY.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") dot(x, y, "#d77757"); }));
    for (const [x, y] of CRAB_ARM[st.arm]) dot(x, y, "#d77757");
    for (const x of CRAB_LEGS[st.legs]) dot(x, 4, "#d77757");
    for (const x of [5, 12]) { dot(x, st.up ? 0 : 1, "#141014"); if (st.up) dot(x, 1, "#d77757"); }
    L.end(); L.key = key;
  }
  // the canvas is 20 x 7 at 12 px a pixel: its left column at x 1716, its feet on y 1074 (screen px), standing on the
  // frame's bottom edge in the corner. Measured over its whole stay, the camera's roll never swings the lyric below
  // y 1010 there (2 px at worst in 44 frames); a spot above the HUD took up to 412. Hidden, it sits below the edge
  const REST = -504, HID = -580, sq = 0.14 * Math.exp(-(bp - Math.floor(bp)) * song.BEAT / 0.12) * (st.arm ? 0.5 : 1);
  let y = t < c.pop + 0.22 ? lerp(HID, REST, easeOutBack((t - c.pop) / 0.22)) : t >= c.duck ? lerp(REST, HID, ease((t - c.duck) / 0.2)) : REST;
  const j = t - p.tele;
  if (j >= 0 && j < 0.35) y += 70 * Math.sin(Math.PI * j / 0.35);                            // the jump on the drums' return
  const sy = 1 - sq, sx = 1 + sq * 0.6;
  m.visible = true; m.position.set(864, y - 30 * (1 - sy), 0); m.scale.set(sx, sy, 1);
}


const { tokens } = song;           // display tokens, 1:1 with the aligned words (song.js)
// a step line as sentences, each carrying its words' times
function sentences(li) {
  const ws = lineWords(li), full = lines[li].text, text = full.replace(/^Step [a-z-]+:\s*/i, "");
  let k = full === text ? 0 : tokens(full.split(":")[0]).length;
  const out = [];
  for (const m of text.matchAll(/[^.!?]+[.!?]+["”]?/g)) {
    const s = m[0].trim(), tk = tokens(s), sw = ws.slice(k, k + tk.length);
    out.push({ text: s, tk, words: sw, t0: sw[0]?.t, t1: sw[sw.length - 1]?.end });
    k += tk.length;
  }
  return out;
}
const typedParts = (s, upper) => s.tk.map((tk, j) => ({ text: (upper ? tk.text.toUpperCase() : tk.text.toLowerCase()) + (tk.space ? " " : ""), t: s.words[j]?.t ?? 1e9 }));
const stepLabel = n => `STEP ${String(n).padStart(2, "0")}`;


// ---------- 1. the countdown to nothing (intro) ----------
function intro(t, S) {
  const pre = words.filter(w => w.t < firstVerse.t0 - 0.05);
  const starts = pre.filter(w => w.w === "RESTOCK");
  let ci = -1; starts.forEach((w, i) => { if (t >= w.t - 0.3) ci = i; });
  const cd = ci < 0 ? [] : pre.filter(w => w.t >= starts[ci].t && (ci + 1 >= starts.length || w.t < starts[ci + 1].t));
  const nums = cd.filter(w => ["THREE", "TWO", "ONE"].includes(w.w));
  const said = nums.filter(w => w.t <= t), cur = said[said.length - 1];
  const DIG = { THREE: "3", TWO: "2", ONE: "1" };
  const dead = cur && cur.w === "ONE" && t > cur.end + 0.35;          // the restock came and nothing happened
  const spoke = cur ? since(t, cur.t, 0.22) : 0;

  backdrop(S, [1, 0, 0], { grid: 0.35 });
  // the card, loading in a little further each countdown, never arriving
  const loaded = [0.42, 0.62, 0.8][Math.max(ci, 0)] ?? 0.8;
  place(S.cards.rtx3090, [1.9, 0.2 + Math.sin(t * 0.7) * 0.03, -0.4], [0.05, -0.46 + t * 0.004, 0.015], 2.5, {
    invert: 1, ink: 0xece6da, inkGain: 1.6, pitch: 64, contrast: 2.3, gain: -0.1, outline: 0.9, detail: 0.35,
    spot: [0.52, 1.25, lerp(0.55, 1.35, loaded), 1], pump: spoke * 0.18, dissolve: dead ? 0.45 : 0.08 * (1 - loaded), seed: ci + 1,
  });

  // the numeral (baseline-center of the glyph anchored in the world)
  const B = S.type.big, c = anchor(B, 1024, 900, [-2.75, -1.75, 0.4], [0, 0.16, 0]);
  if (cur) {
    const f = font(580); c.font = f; c.textBaseline = "alphabetic";
    const prev = said[said.length - 2];
    if (prev && !dead) {   // the previous numeral, a ghost falling away behind the new one (alpha is linear light: keep it tiny)
      const g = since(t, cur.t, 0.2);
      c.globalAlpha = 0.012 * g; c.fillStyle = C.white; c.textAlign = "center";
      c.fillText(DIG[prev.w], 1024 + 40 + (1 - g) * 90, 900 + (1 - g) * 60); c.globalAlpha = 1;
    }
    if (dead) drawGlitched(c, "0", 1024, 900, f, C.red, 0.25 + 0.2 * h32(Math.floor(t * 15), 5), Math.floor(t * 15), { align: "center" });
    else drawDecoded(c, DIG[cur.w], decode(DIG[cur.w], t, cur.t, 0.12, 31 + ci), 1024, 900, { color: C.white, align: "center" });
  }
  B.end();
  const Lb = S.type.label, lc = anchor(Lb, 24, 150, [-4.35, 1.95, 0.45], [0, 0.16, 0]);
  lc.font = font(58, MONO, "600"); lc.fillStyle = dead ? C.red : C.amber; lc.textBaseline = "alphabetic";
  lc.fillText(dead ? "RESTOCK FAILED." : "RESTOCK IN", 24, 150);
  Lb.end();

  // what Whisper heard, corrected in the margin
  const A = S.type.aux, ac = anchor(A, 60, 300, [-4.35, -2.45, 0.6], [0, 0.1, 0], 0.9);
  if (cd.length) {
    ac.font = font(46, MONO); ac.textBaseline = "alphabetic";
    const heard = cd.map(w => ({ text: (w.w === "RESTOCK" ? "we're stuck" : w.w.toLowerCase()) + (["THREE", "TWO"].includes(w.w) ? ". " : w.w === "ONE" ? "." : " "), t: w.t }));
    drawTyped(ac, heard, t, 60, 300, { color: "rgba(233,228,216,0.8)", cursor: !dead, lineH: 60 });
    const r = cd[0];
    if (t > r.end + 0.08) {    // strike "we're stuck", write "restock" above it
      const wW = ac.measureText("we're stuck").width, k = easeOut((t - r.end - 0.08) / 0.18);
      ac.fillStyle = C.red; ac.fillRect(56, 283, (wW + 8) * k, 6);
      ac.font = font(42, MONO, "600"); ac.fillStyle = C.amber; ac.globalAlpha = k;
      ac.fillText("restock", 60, 226); ac.globalAlpha = 1;
    }
  }
  A.end();

  // the product page's fine print under the card
  const pc = anchor(S.type.chart, 40, 120, [-0.25, -1.55, 0.2], [0, -0.1, 0], 0.62);
  pc.font = font(40, MONO, "600"); pc.textBaseline = "alphabetic"; pc.fillStyle = "rgba(233,228,216,0.72)";
  pc.fillText("24 GB  ·  $1,199.99", 40, 120);
  pc.fillStyle = dead ? C.red : "rgba(233,228,216,0.45)";
  pc.fillText(dead ? "● 0 IN STOCK · NOTIFY ME" : "● RESTOCKING…", 40, 180);
  S.type.chart.end();

  hud(S, t, { left: "OUT OF STOCK · DROP 01/03", right: `QUEUE ${Math.round(48211 - t * 37).toLocaleString("en-US")} AHEAD OF YOU` });
  const push = ease(t / firstVerse.t0);
  camera(S, [lerp(0.35, 0.1, push), lerp(0.25, 0.05, push) + Math.sin(t * 0.5) * 0.02, lerp(11.2, 9.8, push)], [0.05, 0.05, 0], -0.012, 35);
  const hit = ci >= 0 ? since(t, starts[ci].t, 0.1) : 0;
  return { ...FILM, glitch: hit * 0.35 + (dead ? 0.08 : 0), ca: 0.0015 + hit * 0.004, grain: 0.085, vignette: 0.7, bloom: 0.85, halation: 0.3 };
}

// ---------- 2. a verse step, the reference's chapter grammar: label, headline, motif ----------
// a headline has to fit: a first sentence too long for the frame splits at its first comma,
// and the rest of it becomes the first typed line (step 16: '"Just buy last gen," | says a man ...')
function fitHeadline(sen, ctx, maxW) {
  const s = sen[0];
  if (!s || ctx.measureText(s.text.toUpperCase()).width <= maxW) return sen;
  const cut = s.tk.findIndex(tk => /,["”]?$/.test(tk.text));
  if (cut < 0 || cut === s.tk.length - 1) return sen;
  const mk = (tk, ws) => ({ text: tk.map(x => x.text + (x.space ? " " : "")).join("").trim(), tk, words: ws, t0: ws[0]?.t, t1: ws[ws.length - 1]?.end });
  return [mk(s.tk.slice(0, cut + 1), s.words.slice(0, cut + 1)), mk(s.tk.slice(cut + 1), s.words.slice(cut + 1)), ...sen.slice(1)];
}

// ---------- steps as spans of lines (a line with no "Step N:" carries the step before it: line 7 is step five) ----------
const stepOfLine = li => {
  for (let i = li; i >= 0 && lines[i].section === lines[li].section; i--) { const m = lines[i].text.match(/^Step ([a-z-]+):/i); if (m) return song.stepNumber(m[1]); }
  return null;
};
const STEP = {};                                   // n -> { lines, words, t0 (its shot starts), t1 (its shot ends), section }
lines.forEach((l, li) => {
  const n = stepOfLine(li);
  if (n === null || !lineWords(li).length) return;
  (STEP[n] ??= { lines: [], words: [], section: l.section }).lines.push(li);
  STEP[n].words.push(...lineWords(li));
});
for (const n in STEP) {
  const S = STEP[n], last = S.lines[S.lines.length - 1], next = lines.findIndex((l, i) => i > last && lineWords(i).length);
  S.t0 = song.lineStart(S.lines[0]) - 0.3;
  S.t1 = next >= 0 && lines[next].section === S.section ? song.lineStart(next) - 0.3 : (song.sections.find(s => s.t0 > song.lineStart(last)) ?? { t0: song.DUR + 0.35 }).t0 - 0.35;
}
// the time of a sung word in a step (occ = which occurrence of it), Infinity if the step never sings it
function wordAt(n, w, occ = 0) { let k = 0; for (const x of STEP[n]?.words ?? []) if (x.w === w && k++ === occ) return x.t; return Infinity; }
// the fast cut (the creator's bar, 9/26: a "brainrot"-paced reference intro that cuts every half second): steps 1-11
// are full-frame cards cut on the sung words (fastcut.js) instead of the chapter grammar that came before
const FAST = fastPlan(STEP, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
// verse 2 was built three times. A test viewer found the first version "too calm", which made the chart never cut
// (market.js, whose chart model is still the one used). The second was a trading terminal, which the creator read as
// someone else's video shoved into this one. The brief for what plays now: "the price chart being the focus, and as it
// climbs, panic also climbs up. Chromatic aberration. Fancy, technical diagrams, and the chaos of the brainrot style"
// -- the chart as a trail through 3D space (ascent.js).
const V2 = ascentPlan(STEP);
const V2CUT = ascentCut;
const V2TIMES = ascentTimes;
window.OOS_V2 = V2;                                  // for the headless probes
// verse 3's end (the creator's notes, 9/27): steps 26 and 27 as the sales agent's ring coming back and coming apart,
// the pile of bills, and the held AVAILABLE falling off a cliff into the last chorus (meltdown.js). Steps 20-25 kept.
// Built on first use: the word's letters are measured in the outline fonts, which load after this module does.
let V3;
export const v3plan = () => (V3 === undefined ? (V3 = meltPlan(STEP, wordAt, sentences)) : V3);
window.OOS_V3 = () => ({ plan: v3plan(), panic: t => meltPanic(v3plan(), t) });   // for the headless probes
// a drop line containing a `?hide=<word>` word draws no words on screen (the sung audio is untouched). Made for the creator's
// X clip (9/28): "Where does a wafer go when it leaves the fab, and who did it leave?" hidden with ?hide=wafer
const HIDE = new URLSearchParams(location.search).getAll("hide").map(w => w.toLowerCase()).filter(Boolean);
const hiddenLine = li => HIDE.some(w => lines[li].text.toLowerCase().includes(w));
const hasGui = n => SCRIPTS[n] !== undefined && !((n === 26 || n === 27) && v3plan());
const joined = (a, b) => hasGui(a) && hasGui(b) && STEP[a] && STEP[b] && STEP[a].section === STEP[b].section;

// ---------- the PC (the creator's note, 9/26): the browser window the shopping steps happen in (gui.js draws it) ----------
function gui(t, S, n, k) {
  const L = S.type.screen, st = STEP[n], K = { t, t0: st.t0, t1: st.t1, k, at: (w, occ = 0, m = n) => wordAt(m, w, occ),
    last: (m = n) => { const ws = STEP[m]?.words ?? []; return ws.length ? ws[ws.length - 1].end : Infinity; },   // step m's last sung word ends
    img: key => S.tex[key]?.image, env: (name, tt) => song.env(name, tt) };
  // it pops up when the step before had no window, and folds away (a CRT line) when the next one won't have one
  const pop = joined(n - 1, n) ? 1 : easeOutBack((t - st.t0) / 0.4), fold = joined(n, n + 1) ? 1 : 1 - ease((t - (st.t1 - 0.24)) / 0.22);
  // the music hits the window (the creator's note, 9/26): every kick pumps it and splits its colour along a direction dealt
  // for that kick; the big ones (a bar's downbeat, or one kick in five by the kick's own hash) also tear bands and
  // lift blocks for a couple of frames; every sung line lands with a tear; the loudness rolls scanlines through it
  const kk = song.lastKick(t), kdt = kk ? t - kk.t : 9, kv = kdt < 1.5 ? Math.exp(-kdt / 0.1) : 0;
  const big = kk && (Math.round(song.beatAt(kk.t)) % 4 === 0 || h32(kk.i, 5) < 0.2) ? 1 : 0;
  const mix = song.env("mix", t), lead = song.env("lead", t);
  const ls = st.lines.map(song.lineStart).filter(x => x <= t).pop(), lineHit = ls === undefined ? 0 : since(t, ls, 0.06);
  const jolt = big ? kv * 0.07 : 0;
  // (steps 20-24 are the sales rep's ring, not a window: a little bigger, turned less, facing the camera more)
  const ring = n >= 20 && n <= 24, home = ring ? [2.5, -0.75] : [2.4, -0.95];
  const c = anchor(L, GW / 2, GH / 2, [home[0] + (kk ? h32(kk.i, 9) - 0.5 : 0) * jolt, home[1] + Math.sin(t * 0.8) * 0.02 + (kk ? h32(kk.i, 10) - 0.5 : 0) * jolt * 0.6, -0.9],
    ring ? [0, -0.1, 0] : [0.02, -0.2, 0], lerp(0.84, 1, pop) * (1 + kv * (0.012 + big * 0.02)) * (ring ? 1.15 : 1));
  L.mesh.scale.y *= Math.max(0.015, fold);
  L.mat.uniforms.opacity.value = clamp(pop * 3) * clamp(fold * 4);
  const U = L.mat.uniforms, ang = (kk ? h32(kk.i, 7) : 0) * Math.PI * 2;
  U.ca.value = 0.0012 + kv * (0.005 + big * 0.009) + mix * 0.0015 + lead * 0.0015;
  U.caDir.value.set(Math.cos(ang), Math.sin(ang) * 0.6);
  U.tear.value = Math.min(1, (kdt < 1.5 ? Math.exp(-kdt / (big ? 0.05 : 0.035)) * (big ? 0.9 : 0.22) : 0) + lineHit * 0.55);
  U.block.value = big && kdt < 2 / 30 ? 0.85 : 0;
  U.scan.value = 0.12 + mix * 0.45;
  U.seed.value = (kk ? kk.i * 17 : 0) + Math.floor(t * 15);
  U.frame.value = Math.floor(t * 30);
  setAudio({ kick: kv, env: song.env, t });
  // save/restore around the whole frame: a canvas keeps lineCap, lineJoin and the rest between frames (begin() only
  // resets the transform, alpha and compositing), so a stroke would otherwise draw one way on the layer's first
  // frame and another way after (measured: the tab's close cross at 20.8, 36 px)
  c.save(); SCRIPTS[n](c, K); c.restore();
  L.end();
  return joined(n - 1, n) ? since(t, st.t0, 0.07) * 0.3 : 0;      // a cut between two windows: two frames of tear
}

// ---------- verse 2's stock chart (the creator's note, 9/26): steps 12 to 19, green and red, more green, vertical at 14 ----------
const CANDLES = STEP[12] && STEP[14] && STEP[15] && {
  t0: STEP[12].t0 + 0.3, beat: song.BEAT,
  phases: [{ t: -1e9, mu: 0.001, sig: 0.028 }, { t: STEP[13].t0, mu: 0.012, sig: 0.024 },
    { t: STEP[14].t0, mu: tt => lerp(0.05, 0.14, clamp((tt - STEP[14].t0) / 5)), sig: 0.03 }, { t: STEP[15].t0, mu: 0.06, sig: 0.036 }],
};
function candles(t, S, n, k) {
  if (!CANDLES || n < 12 || n > 19) return;
  const L = S.type.candles, c = anchor(L, 1024, 512, [0.2, 0.7, -7], [0, -0.05, 0]);
  L.mat.uniforms.opacity.value = ease((t - STEP[12].t0) / 0.6) * (n === 14 ? 0.85 : 0.55);
  c.save(); drawCandles(c, t, CANDLES, 2048, 1024, k); c.restore();     // (state kept between frames: see gui())
  L.end();
}

// ---------- step 14 (the creator's note, 9/26): the CEO in the suit, flipped to the jacket a few frames before "Also, thanks
// for the jacket!" ----------
function ceo(t, S, n, k) {
  const also = wordAt(14, "ALSO");
  if (n !== 14 || also === Infinity) return null;
  const C0 = S.ceo, t0 = STEP[14].t0, flipEnd = also - 3 / 30, flip0 = flipEnd - 0.26, mid = (flip0 + flipEnd) / 2;
  const flipAt = tt => tt < flip0 ? { ry: 0, j: false } : tt < mid ? { ry: Math.PI / 2 * Math.pow((tt - flip0) / (mid - flip0), 2), j: false }
    : tt < flipEnd ? { ry: -Math.PI / 2 * (1 - easeOut((tt - mid) / (flipEnd - mid))), j: true } : { ry: 0, j: true };
  const H = 5.1, home = [3.3, -0.45, -1.4], rise = easeOutBack((t - t0) / 0.5);
  const now = flipAt(t), frame = Math.floor(t * 30);
  const set = (m, o) => { const U = m.material.uniforms; U.glitch.value = o.glitch ?? 0; U.frame.value = frame; U.gain.value = o.gain ?? 1; U.opacity.value = o.opacity ?? 1; U.tintAmt.value = o.tintAmt ?? 0; };
  const m = C0.mesh;
  m.visible = true; m.position.set(home[0], lerp(home[1] - 6.5, home[1], rise), home[2]); m.rotation.set(0, now.ry, 0); m.scale.setScalar(H);
  showStill(m, now.j ? C0.tex.jacket : C0.tex.suit);                        // the still AND its censor, together
  set(m, { glitch: since(t, flipEnd, 0.1) * 0.5 });
  // afterimages through the flip: where he was facing 25, 50, 75, 100 ms ago, the chart's green and the video's red
  C0.ghosts.forEach((g, i) => {
    const tt = t - (i + 1) * 0.025, was = flipAt(tt), on = t >= flip0 && t < flipEnd + 0.18;
    if (!on) return;
    g.visible = true; g.position.copy(m.position); g.position.z -= 0.02 * (i + 1); g.rotation.set(0, was.ry, 0); g.scale.setScalar(H);
    showStill(g, was.j ? C0.tex.jacket : C0.tex.suit);
    g.material.uniforms.tint.value.set(i % 2 ? 0xff2a3d : 0x3dff9a);
    set(g, { opacity: 0.55 * (1 - i / 4) * (t < flipEnd ? 1 : 1 - (t - flipEnd) / 0.18), tintAmt: 0.65, gain: 1.3 });
  });
  return { flash: since(t, flipEnd, 0.14) * 0.9 + since(t, t0 + 0.4, 0.12) * 0.35, ca: since(t, flipEnd, 0.2) * 0.012, glitch: since(t, flipEnd, 0.08) * 0.35 };
}

// ---------- the two RAM steps (the creator's note, 9/26: the song is half about memory) ----------
// the backgrounds: step six a table of DDR5 sticks; step eleven a workstation board's empty DDR5 slots (framed on
// the top bank, the CPU socket below it fading out under the spot)
// (spot y is the plane's uv: 0 at the bottom of the photo. The table prints as a negative: the grey tabletop drops
// out and the black sticks print, so the frame reads as sticks, not as a wall of grey dots)
const RAM_BG = {
  6: { key: "bg-ddr5-table", pos: [0.3, 0.15, -9], h: 13.5, spot: [0.5, 0.5, 1.05, 0.9], invert: 0, inkGain: 0.11, contrast: 2.4, gain: 0.2 },
  11: { key: "bg-empty-slots", pos: [0.3, -9.0, -9], h: 30, spot: [0.5, 0.83, 0.3, 1], invert: 1, inkGain: 0.14, contrast: 1.9, gain: -0.16 },
};
// a stick in the chapter's print: the board prints as light dots, the chips drop out to black, and the chips' and
// the board's edges are inked (at the GPUs' settings the board filled in and read as a white label). The gain puts
// every stick's median tone at the same place, so a lime-green DDR4 board and a dark server board print alike
const stick = (S, key, pos, rot, h, o) => place(S.cards[key], pos, rot, h, {
  invert: 1, ink: 0xe9e4d8, inkGain: 1.45, pitch: 28, contrast: 1.4, gain: -0.44 - (S.cut[key].lum - 0.5) * 1.4, outline: 0.9, detail: 0.6,
  paper: 0x000000, paperAlpha: 0.85,             // a black backing: the stick is an object in front of the photo, not a tint on it
  spot: [0.5, 0.5, 1.4, 0], order: 2, ...o,
});

// step six, "check the RAM. Sixteen gigs of the old kind": the old stick (a real 16 GB DDR4) slides in on "RAM" and
// sits over the price; when the price flips to $120 it flickers red with it, and stays red
function oldStick(t, S, st, k) {
  const ram = lineWords(st.li).find(w => w.w === "RAM");
  if (!ram || t < ram.t - 0.1) return;
  const e = easeOutBack((t - ram.t + 0.1) / 0.55), up = priceBeats(st.li)[1];
  const hot = up && t >= up.t ? (t >= up.settle ? 1 : h32(Math.floor(t * 15), 61) < 0.5 ? 1 : 0) : 0;
  stick(S, "ddr4-16g", [lerp(9.5, 3.1, e), 0.4 + Math.sin(t * 0.9) * 0.03, -1.2], [0, -0.28, lerp(-0.35, -0.08, e)], 0.95, {
    ink: hot ? 0xff2a3d : 0xe9e4d8, inkGain: hot ? 1.7 : 1.45, pump: k * (0.2 + hot * 0.25), seed: 6,
  });
}

// step eleven, "Three companies make all the memory on earth. Nine-tenths to the buildings.": a stick from each of
// the three lands on "three / companies / make", named as it lands; on "nine-tenths" nine dots in ten tear off every
// stick and stream away toward the buildings, leaving the outlines and a tenth of the print
const MAKERS = [
  { key: "samsung-ddr4", name: "COMPANY 1", word: "THREE", y: 1.45, h: 0.6 },
  { key: "hynix-mrdimm", name: "COMPANY 2", word: "COMPANIES", y: 0.3, h: 1.0 },
  { key: "micron-rdimm-label", name: "COMPANY 3", word: "MAKE", y: -0.95, h: 0.62 },
];
function makers(t, S, st, k) {
  const ws = lineWords(st.li), at = w => ws.find(x => x.w === w);
  const nine = at("NINE"), bldg = at("BUILDINGS");
  const span = nine && bldg ? bldg.end + 0.25 - nine.t : 1, gone = nine ? clamp((t - nine.t) / span) : 0;
  const X = 3.0, Z = -1.2, L = S.type.chart;
  const c = anchor(L, 0, 0, [1.2, 2.4, Z]);                  // the caption layer: canvas (0, 0) here, 1 px = 5/1024
  const toPx = (x, y) => [(x - 1.2) / 5 * 1024, (2.4 - y) / 5 * 1024];
  c.font = font(30, MONO, "600"); c.textBaseline = "alphabetic";
  const rects = [];
  MAKERS.forEach((m, i) => {
    const w = at(m.word);
    if (!w || t < w.t - 0.05) return;
    const e = easeOut((t - w.t + 0.05) / 0.22), slam = since(t, w.t + 0.17, 0.12), wd = m.h * S.cut[m.key].aspect;
    stick(S, m.key, [X + (1 - e) * 1.6, m.y, Z], [0, -0.12, 0.02 * (i - 1)], m.h * (1 + slam * 0.08), { dissolve: gone * 0.9, pump: k * 0.2, seed: 11 + i });
    rects.push({ x: X, y: m.y, w: wd, h: m.h });
    const [px, py] = toPx(X - wd / 2, m.y + m.h / 2 + 0.06);
    drawDecoded(c, m.name, decode(m.name, t, w.t, 0.2, 70 + i), px, py, { color: gone >= 1 ? C.red : C.amber, scramble: C.cyan });
  });
  L.end();
  if (!nine || t < nine.t || !rects.length) return;
  // the torn-off dots: released across "nine-tenths to the buildings", accelerating off to the top right
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const al = S.dots.geometry.attributes.aAlpha;
  S.dots.visible = true;
  S.dots.material.uniforms.color.value.set(0xff4d63); S.dots.material.uniforms.gain.value = 1.6 + k;
  for (let i = 0; i < S.dots.count; i++) {
    const r = rects[i % rects.length], dt = t - (nine.t + h32(i, 71) * span);
    if (i >= 900 || dt < 0 || dt > 1.8) { al.array[i] = 0; S.dots.setMatrixAt(i, M.makeScale(0, 0, 0)); continue; }
    const pull = dt * dt, s = 0.025 + h32(i, 76) * 0.035;
    P.set(r.x + (h32(i, 72) - 0.5) * r.w + dt * 1.5 + pull * (4 + h32(i, 74) * 3),
      r.y + (h32(i, 73) - 0.5) * r.h + dt * 0.4 + pull * (2.2 + h32(i, 75) * 2), Z - pull * 3);
    M.compose(P, q, Sc.set(s, s, s)); S.dots.setMatrixAt(i, M);
    al.array[i] = clamp(dt / 0.08) * clamp((1.8 - dt) / 0.6) * (0.5 + 0.5 * h32(i, 77));
  }
  S.dots.instanceMatrix.needsUpdate = true; al.needsUpdate = true;
}

function chapter(t, S) {
  const st = song.stepAt(t), n = st.n ?? stepOfLine(st.li);
  S.type.head.ctx.font = font(176);
  const sen = fitHeadline(sentences(st.li), S.type.head.ctx, 1950), head = sen[0];
  const k = kickEnv(t, 0.14), lt = t - st.t0;
  backdrop(S, [1, 0, 0], { grid: 0.6 });
  const tear = hasGui(n) ? gui(t, S, n, k) : 0;
  candles(t, S, n, k);
  const A = ceo(t, S, n, k);

  // the ghost of a card in the deep background: huge, coarse, barely lit. The two RAM steps (the creator's note, 9/26)
  // put a whole photograph back there instead, edge to edge, its borders fading out under the dots
  const bg = RAM_BG[st.n];
  if (n >= 12 && n <= 19) {
    // verse 2: the stock chart is the background (candles above)
  } else if (bg) {
    place(S.cards[bg.key], [bg.pos[0] - lt * 0.04, bg.pos[1], bg.pos[2]], [0.03, -0.08, 0.01], bg.h, {
      invert: bg.invert, ink: 0xe9e4d8, inkGain: bg.inkGain * (1 + k * 0.5), pitch: 76 * bg.h / 13.5, contrast: bg.contrast, gain: bg.gain,
      outline: 0, detail: 0.12, spot: bg.spot, pump: k * 0.2, seed: st.n,
    });
  } else {
    const ghostKeys = ["rtx3070", "rtx3090", "gtx1080ti-hub", "radeon7790", "gtx1080ti-fan", "rog-pair"];
    const gk = ghostKeys[st.n % ghostKeys.length];
    place(S.cards[gk], [3.5 - lt * 0.05, 0.55, -8], [0.04, -0.34, 0.02], 7.5, {
      invert: 1, ink: 0xe9e4d8, inkGain: 0.32 + k * 0.18, pitch: 44, contrast: 1.8, gain: -0.1, outline: 0.25, detail: 0.1,
      spot: [0.62, 0.62, 0.95, 0.85], pump: k * 0.22, seed: st.n,
    });
  }
  if (st.n === 6) oldStick(t, S, st, k);
  if (st.n === 11) makers(t, S, st, k);

  // label + headline, top left
  const lab = stepLabel(n);
  const lc = anchor(S.type.label, 20, 180, [-4.45, 1.95, 0.8]);
  lc.font = font(92); lc.textBaseline = "alphabetic";
  drawDecoded(lc, lab, decode(lab, t, st.t0 - 0.05, 0.18, n), 20, 180, { color: C.amber, scramble: C.cyan });
  S.type.label.end();
  const htxt = head.text.toUpperCase();
  const hc = anchor(S.type.head, 26, 420, [-4.45, 0.95, 0.8]);
  hc.font = font(176); hc.textBaseline = "alphabetic";
  const hw = hc.measureText(htxt).width;           // a headline with no early comma still has to fit the frame
  if (hw > 1860) hc.font = font(Math.max(60, Math.floor(176 * 1860 / hw)));   // (the frame shows the canvas to ~1935 px)
  drawDecoded(hc, htxt, decode(htxt, t, head.t0, Math.max(0.3, (head.t1 - head.t0) * 0.9), 100 + st.n), 26, 420);
  S.type.head.end();

  // the sentences being sung now, typed in mono under the headline (older ones dim)
  const sc = anchor(S.type.small, 30, 80, [-4.4, 0.52, 0.8]);
  sc.font = font(38, MONO, "600"); sc.textBaseline = "alphabetic";
  const now = sen.slice(1).filter(s => s.t0 !== undefined && s.t0 <= t).slice(-3);
  now.forEach((s, i) => {
    const last = i === now.length - 1;
    sc.globalAlpha = last ? 1 : 0.45;
    drawTyped(sc, typedParts(s, true), t, 30, 80 + i * 56, { color: last ? C.white : C.mute, cursor: last, lineH: 56 });
  });
  sc.globalAlpha = 1;
  S.type.small.end();

  // bespoke motif for a step that names prices: the price will not hold still
  const prices = priceBeats(st.li);
  let flip = 0;
  if (prices.length) {
    const shown = prices.filter(p => p.t <= t);
    const bc = anchor(S.type.big, 1960, 860, [4.55, -2.05, 0.3], [0, -0.18, 0], 0.62);
    if (shown.length) {
      const cur = shown[shown.length - 1], prev = shown[shown.length - 2];
      const settling = t < cur.settle;
      flip = settling ? 1 : since(t, cur.settle, 0.12);
      const f = font(520);
      const label = settling ? "$" + Math.round(40 + h32(Math.floor(t * 15), 3) * 3500).toLocaleString("en-US") : cur.label;
      bc.font = f;
      const nw = bc.measureText(cur.label).width;     // the old price keeps its place while the new one flickers
      if (prev) {   // the old price, struck, sitting on the same baseline to the left
        bc.font = font(190); bc.fillStyle = "rgba(255,42,61,0.55)"; bc.textAlign = "right";
        const px = 1960 - nw - 70;
        bc.fillText(prev.label, px, 860);
        const pw = bc.measureText(prev.label).width;
        bc.fillRect(px - pw - 12, 780, pw + 24, 12);
      }
      drawGlitched(bc, label, 1960, 860, f, cur.i ? C.red : C.white, flip * 0.9, Math.floor(t * 15), { align: "right" });
    }
    S.type.big.end();
    // a year of monthly prices as a dot matrix, bottom left: flat, flat, flat, then the last month x3
    const cc = anchor(S.type.chart, 60, 960, [-4.4, -2.05, 0.8]);
    const rise = prices[1] ? easeOut((t - prices[1].t) / (prices[1].settle - prices[1].t)) : 0;   // climbs while she says it
    for (let col = 0; col < 12; col++) {
      const hgt = col < 11 ? 3 + (h32(col, 17) < 0.3 ? 1 : 0) : Math.round(lerp(3, 10, rise));
      for (let row = 0; row < hgt; row++) {
        cc.fillStyle = col === 11 && row >= 3 ? C.red : "rgba(233,228,216,0.34)";
        cc.beginPath(); cc.arc(80 + col * 56, 900 - row * 40, 10 + (col === 11 && row >= 3 ? k * 3 : 0), 0, 7); cc.fill();
      }
    }
    cc.font = font(26, MONO, "600"); cc.fillStyle = C.mute; cc.textAlign = "left";
    cc.fillText("16GB DDR4 · MONTHLY · 2025 -> 2026", 66, 960);
    S.type.chart.end();
  }

  hud(S, t, { left: `OUT OF STOCK · ${stepLabel(n)} / 27`, right: "THE MANUAL, 2026 EDITION" });
  const push = ease(lt / 6), sh = k * 0.018, fr = Math.floor(t * 30);
  camera(S, [lerp(0.3, 0.05, push) + (h32(fr, 1) - 0.5) * sh, 0.2 + (h32(fr, 2) - 0.5) * sh, lerp(10.4, 9.6, push)], [0.05, 0.05, 0], 0.035, 35);
  return { ...FILM, glitch: flip * 0.12 + tear + (A ? A.glitch : 0), ca: 0.0015 + k * 0.002 + flip * 0.003 + (A ? A.ca : 0), exposure: 1 + k * 0.05,
    flash: A ? A.flash : 0, grain: 0.08, vignette: 0.6 };
}

// dollar amounts sung in a line (step six: "Forty dollars ... A hundred and twenty"), with their flip times
function priceBeats(li) {
  const ws = lineWords(li), out = [];
  const find = seq => { for (let i = 0; i < ws.length; i++) if (seq.every((s, j) => ws[i + j] && ws[i + j].w === s)) return i; return -1; };
  const forty = find(["FORTY", "DOLLARS"]), hundred = find(["A", "HUNDRED", "AND", "TWENTY"]);
  if (forty >= 0) out.push({ label: "$40", t: ws[forty].t, settle: ws[forty].t, i: 0 });
  if (hundred >= 0) out.push({ label: "$120", t: ws[hundred].t, settle: ws[hundred + 3].end, i: 1 });
  return out;
}

// ---------- 3. the drop: the buildings answer ----------
// The portrait frame (frame.js, the creator's X clip 9/28) sees 1.62x more of the world vertically and looks a little lower, so
// he stands in the middle half of the tall frame with room above and below him for the answer; the swing of the camera's
// roll is halved there (rows that sit far above and below the middle swing sideways out of a narrow frame).
const PF = 1.62, LOOK_Y = PORTRAIT ? 0 : 0.3;
const vfov = f => PORTRAIT ? 2 * Math.atan(PF * Math.tan(f * Math.PI / 360)) * 360 / (2 * Math.PI) : f;
function drop(t, S) {
  const cp = chorusPlans() && planAt(chorusPlans(), t);
  return cp ? dropV2(t, S, cp) : dropV1(t, S);
}

// ---------- 3b. the drop as the creator redesigned it (9/29): blue until "COMPUTE", then red (chorus.js, site.js) ----------
// Unchanged from the drop before it, by the creator's ruling: the AltMan (his place, his timing, the turn, the dance), the answer's
// words and their animation, the storm's choreography (thrown out on the questions, "sucked into the structure" on the
// answer), and the red half's camera. What changed: the skyline is a drawing of the buildings, the questions are
// type set the way the creator's reference sets it (the wafer line is not written), the first half is a blueprint with no kick
// flash, and the red half's flash and glitch on the kick are halved ("red and strobing flashes was a tad harsh")
function dropV2(t, S, cp) {
  const s = cp.s, p = cp.p;
  const k = kickEnv(t, 0.12), beat = song.beatAt(t), dt = t - s.t0, fr = Math.floor(t * 30);
  const red = t >= cp.sw;
  // the camera. Red: the drop's own, exactly as it was. Blue: one continuous move (chorus.js blueCam) handed over into
  // the drop's own over the second before the AltMan arrives, so he comes in from where he always did
  const roll = Math.sin(beat * Math.PI / 4) * 0.08 + 0.06, shake = k * 0.09, rRoll = PORTRAIT ? roll * 0.5 : roll;
  const rPos = [Math.sin(dt * 0.6) * 0.8 + (h32(fr, 21) - 0.5) * shake, 0.2 + (h32(fr, 22) - 0.5) * shake, lerp(12.5, 10.5, ease(dt / 8))], rLook = [0, LOOK_Y, 0];
  if (red || t >= cp.enter) camera(S, rPos, rLook, rRoll, vfov(52 - k * 7));
  else {
    const B = blueCam(cp, t, k, { pos: rPos, look: rLook, roll: rRoll, fov: 52 - k * 7 });
    camera(S, B.eye, B.look, B.roll, vfov(B.fov));
  }
  backdrop(S, [0, 1, 0], { haze: 0.1 + k * 0.14 });   // set every frame (lesson L82): the red half's night; under the sheet in blue
  // the focus lines: the red half's as they were; in blue, none until the AltMan winds up (his turn keeps its lines)
  S.speed.visible = red || t >= p.spin0;
  const su = S.speed.material.uniforms;
  su.color.value.set(red ? 0xffd9e4 : 0xeaf2ff); su.gain.value = 1.0 + k * 1.1; su.alpha.value = 0.28 + k * 0.35;
  su.center.value.set(0.5, 0.53); su.count.value = 220; su.inner.value = 0.16 + (1 - k) * 0.06;
  su.density.value = 0.5; su.width.value = 0.3; su.seed.value = Math.floor(t * 15);

  // which shouted line we're on; each question throws the storm again on its own clock
  let cl = s.lines[0];
  for (const li of s.lines) if (t >= song.lineStart(li) - 0.1) cl = li;
  const dl = t - song.lineStart(cl);
  const answer = cl === cp.ans;
  // the storm (the creator: "I liked the shattered parts being sucked into the structure"): every card at once, thrown out on
  // the questions -- printed white on the blueprint -- and on the answer pulled into a window of the front row, red
  const ink = red ? 0xff2a3d : 0xeaf2ff;
  const throwCard = (m, i, around, hs, o = {}) => {
    const a = (around + (h32(i, 1) - 0.5) * 0.35) * Math.PI * 2, z = -10 + h32(i, 2) * 14, v = 0.9 + h32(i, 3) * 1.6, size = (1.0 + h32(i, 9) * 2) * hs;
    const thrown = tt => { const r = 1.2 + v * tt * 1.1 + h32(i, 4) * 2; return [Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.9 + 0.3, z]; };
    const tt = answer ? 1.8 : dl + 0.9, spin = (h32(i, 5) - 0.5) * 1.8 * (dl + 0.9);
    let pp = thrown(tt), sc = size;
    if (answer) {
      const tgt = stormTarget(cp, i), u = clamp((dl - h32(i, 10) * 0.5) / 1.4), e = u * u * u;
      pp = pp.map((x, j) => lerp(x, tgt[j], e)); sc = lerp(size, size * 0.12, e);
    }
    place(m, pp, [(h32(i, 6) - 0.5) * 1.2 + spin, (h32(i, 7) - 0.5) * 1.4 + spin * 0.7, (h32(i, 8) - 0.5) * 0.8 + spin], sc, {
      invert: 1, ink, inkGain: red ? 1.05 + k * 0.7 : 0.7 + k * 0.2, pitch: 46, contrast: 2.0, gain: -0.02, outline: 0.9, detail: 0.3,
      pump: k * 0.4, seed: i + 1, spot: [0.5, 0.5, 1.4, 0], order: 1, ...o,
    });
  };
  S.storm.forEach((m, i) => throwCard(m, i, i / S.storm.length, 1));
  S.ramStorm.forEach((m, i) => {
    const c = S.cut[m.userData.key];
    throwCard(m, 100 + i, (i + 0.5) / S.ramStorm.length, 1.2 / Math.sqrt(c.aspect), { gain: -0.34 - (c.lum - 0.5) * 2.0, detail: 0.55 });
  });
  // dots torn off the cards: flung out on the questions, streaming into the windows on the answer
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), TV = new THREE.Vector3();
  const al = S.dots.geometry.attributes.aAlpha;
  S.dots.visible = true;
  S.dots.material.uniforms.color.value.set(red ? 0xff4d63 : 0xdbe8ff); S.dots.material.uniforms.gain.value = red ? 1.8 + k * 2 : 1.1 + k * 0.6;
  for (let i = 0; i < S.dots.count; i++) {
    const a = h32(i, 11) * Math.PI * 2, sp = 1.5 + h32(i, 12) * 6, life = (dl * 0.9 + h32(i, 13) * 3) % 3;
    const out = P.set(Math.cos(a) * (0.3 + life * sp) * 1.6, Math.sin(a) * (0.3 + life * sp) + 0.3, -4 + h32(i, 14) * 7);
    if (answer) { const r0 = 4 + h32(i, 17) * 8; out.set(Math.cos(a) * r0 * 1.6, Math.sin(a) * r0 + 0.3, 3 - h32(i, 14) * 4).lerp(TV.set(...dotTarget(cp, i)), life / 3); }
    const size = (0.02 + h32(i, 15) * 0.06) * (1 + k * 0.6);
    M.compose(P, q, Sc.set(size, size, size)); S.dots.setMatrixAt(i, M);
    al.array[i] = (answer ? clamp(life / 0.6) * clamp((3 - life) / 0.4) : clamp(1 - life / 3)) * (0.35 + 0.65 * h32(i, 16));
  }
  S.dots.instanceMatrix.needsUpdate = true; al.needsUpdate = true;
  // the AltMan, exactly as he was (his crash zoom moves the camera, so the sheet is drawn after him)
  const am = altmanAt(t), A = am ? altman(t, S, am, k) : null;
  chorusSheet(t, S, cp, red, k);
  if (!red) chorusType(t, S, cp, hiddenLine);
  // the answer's words, exactly as they were: his top text and bottom text while he's there
  if (answer) {
    const meme = PLAN.some(pl => t >= pl.enter && pl.its >= s.t0 - 0.5 && pl.its <= s.t1);
    const ws = lineWords(cl), toks = lines[cl].text.replace(/["“”]/g, "").toUpperCase().split(/\s+/);
    const tall = PORTRAIT && meme, L = tall ? S.type.tall : S.type.big;
    const bc = tall ? anchor(L, 576, 1024, [0, -0.04, -2])
      : am || meme ? anchor(S.type.big, 1024, 512, [0, 0.35, -2], [0, 0, meme ? 0 : (h32(cl, 3) - 0.5) * 0.08], 1.2 * 12.5 / 8.1)
                   : anchor(S.type.big, 1024, 512, [0, 0.35, 2.4], [0, 0, (h32(cl, 3) - 0.5) * 0.08], 1.2);
    let f = font(meme ? 170 : 250); bc.font = f; bc.textBaseline = "alphabetic";
    let rows = [[]], wsum = 0;
    if (meme) { const cut = toks.findIndex(tk => /!$/.test(tk)); rows[0] = toks.slice(0, cut + 1); rows.push(toks.slice(cut + 1)); }
    else toks.forEach(tok => { const w = bc.measureText(tok + " ").width; if (wsum + w > 1700 && rows[rows.length - 1].length) { rows.push([]); wsum = 0; } rows[rows.length - 1].push(tok); wsum += w; });
    let rowY = meme ? [250, 945] : rows.map((_, ri) => 512 - (rows.length - 1) * 125 + 90 + ri * 250);
    if (tall) {
      bc.font = font(200);
      const wd = r => bc.measureText(r.join(" ")).width;
      rows = rows.flatMap(r => {
        let best = [r], bw = wd(r);
        for (let i = 1; i < r.length; i++) { const m = Math.max(wd(r.slice(0, i)), wd(r.slice(i))); if (m < bw) { bw = m; best = [r.slice(0, i), r.slice(i)]; } }
        return best;
      });
      const F = Math.min(200, 200 * 960 / Math.max(...rows.map(wd)));
      f = font(F); bc.font = f;
      const cap = bc.measureText("H").actualBoundingBoxAscent, pitch = 1.02 * F, b = c => c + (cap - pitch) / 2;
      rowY = [b(280), b(280) + pitch, b(1755), b(1755) + pitch];
    }
    const cx = L.canvas.width / 2;
    let wi = 0;
    if (!hiddenLine(cl)) rows.forEach((row, ri) => {
      let x = cx - bc.measureText(row.join(" ")).width / 2;
      row.forEach(tok => {
        const w = ws[wi++], tw = bc.measureText(tok).width;
        if (w && t >= w.t) {
          const slam = since(t, w.t, 0.09);
          bc.save(); bc.translate(x + tw / 2, rowY[ri]); bc.scale(1 + slam * 0.35, 1 + slam * 0.35);
          drawGlitched(bc, tok, 0, 0, f, t - w.t < 0.12 ? C.white : C.red, slam * 0.8, Math.floor(t * 30) + wi, { align: "center" });
          bc.restore();
        }
        x += bc.measureText(tok + " ").width;
      });
    });
    L.end();
  }
  if (red) hud(S, t, { left: `THE BUILDINGS · DROP ${String(s.index + 1).padStart(2, "0")}/03`, right: "COMPUTE ALLOCATED: 100% (NOT YOU)", color: "rgba(255,200,210,0.6)" });
  else S.hud.mesh.visible = false;                  // the sheet carries its own furniture
  const Ag = A ? A.g * 0.5 + A.glitch : 0;
  if (!red) return { ...FILM, bloom: 0.2, bloomThreshold: 1.15, halation: 0, ca: 0.0012 + k * 0.0015 + (A ? A.ca : 0), glitch: Ag,
    flash: A ? A.flash : 0, invert: A ? A.invert : 0, grain: 0.07, vignette: 0.3, weave: 0.4 };
  return { ...FILM, bloom: 0.85, bloomThreshold: 0.9, halation: 0.55, ca: 0.002 + k * 0.004 + (A ? A.ca : 0), glitch: k * 0.1 + Ag,
    flash: k * 0.14 + (A ? A.flash : 0), invert: A ? A.invert : 0, grain: 0.095, vignette: 0.55 };
}

// ---------- 3a. the drop as it was (?chorus=0) ----------
function dropV1(t, S) {
  const s = song.sectionAt(t);
  const k = kickEnv(t, 0.12), beat = song.beatAt(t), dt = t - s.t0;
  // the camera first: the particles below face it (placing it last made them face the previous frame's camera)
  const roll = Math.sin(beat * Math.PI / 4) * 0.08 + 0.06, shake = k * 0.09, fr = Math.floor(t * 30);
  camera(S, [Math.sin(dt * 0.6) * 0.8 + (h32(fr, 21) - 0.5) * shake, 0.2 + (h32(fr, 22) - 0.5) * shake, lerp(12.5, 10.5, ease(dt / 8))], [0, LOOK_Y, 0],
    PORTRAIT ? roll * 0.5 : roll, vfov(52 - k * 7));
  backdrop(S, [0, 1, 0], { haze: 0.1 + k * 0.14 });

  // focus lines, re-dealt every 2 frames like hand-inked cels
  S.speed.visible = true;
  const su = S.speed.material.uniforms;
  su.color.value.set(0xffd9e4); su.gain.value = 1.0 + k * 1.1; su.alpha.value = 0.28 + k * 0.35;
  su.center.value.set(0.5, 0.53); su.count.value = 220; su.inner.value = 0.16 + (1 - k) * 0.06;
  su.density.value = 0.5; su.width.value = 0.3; su.seed.value = Math.floor(t * 15);

  // which shouted line we're on; each line throws the storm again on its own clock
  let cl = s.lines[0];
  for (const li of s.lines) if (t >= song.lineStart(li) - 0.1) cl = li;
  const dl = t - song.lineStart(cl);
  const answer = /compute for us/i.test(lines[cl].text);      // the buildings' own line

  // the buildings rise only for their answer, windows strobing on the kick
  if (answer) {
    const up = easeOut((dl + 0.15) / 0.45);
    S.skyline.visible = true;
    S.skyline.position.set(0, lerp(-34, -19, up), -40);
    S.skyline.children.forEach(b => {
      const u = b.material.uniforms;
      u.kick.value = k; u.tick.value = Math.floor(beat * 2); u.lit.value = 0.3 + up * 0.15; u.gain.value = 1.0 + k * 1.4; u.fog.value = 0.25;
      u.win.value.set(0xff2a3d);
    });
  }
  const sky = new THREE.Vector3(0, -8, -40);

  // the storm: every card at once, printed in red; thrown out on the questions, swallowed on the answer.
  // i = the card's own hash id, around = where on the ring it flies, hs = its height against the GPUs'
  const throwCard = (m, i, around, hs, o = {}) => {
    const a = (around + (h32(i, 1) - 0.5) * 0.35) * Math.PI * 2, z = -10 + h32(i, 2) * 14, v = 0.9 + h32(i, 3) * 1.6, size = (1.0 + h32(i, 9) * 2) * hs;
    const thrown = tt => { const r = 1.2 + v * tt * 1.1 + h32(i, 4) * 2; return [Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.9 + 0.3, z]; };
    const tt = answer ? 1.8 : dl + 0.9, spin = (h32(i, 5) - 0.5) * 1.8 * (dl + 0.9);
    let p = thrown(tt), sc = size;
    if (answer) {   // pulled into a window somewhere in the skyline, shrinking to nothing
      const b = S.skyline.children[i % S.skyline.children.length];
      const tgt = [b.position.x + S.skyline.position.x, b.position.y + S.skyline.position.y + b.userData.h * 0.25, b.position.z + S.skyline.position.z];
      const u = clamp((dl - h32(i, 10) * 0.5) / 1.4), e = u * u * u;
      p = p.map((x, j) => lerp(x, tgt[j], e)); sc = lerp(size, size * 0.12, e);
    }
    place(m, p, [(h32(i, 6) - 0.5) * 1.2 + spin, (h32(i, 7) - 0.5) * 1.4 + spin * 0.7, (h32(i, 8) - 0.5) * 0.8 + spin], sc, {
      invert: 1, ink: 0xff2a3d, inkGain: 1.05 + k * 0.7, pitch: 46, contrast: 2.0, gain: -0.02, outline: 0.9, detail: 0.3,
      pump: k * 0.4, seed: i + 1, spot: [0.5, 0.5, 1.4, 0], order: 1, ...o,
    });
  };
  S.storm.forEach((m, i) => throwCard(m, i, i / S.storm.length, 1));
  // the memory sticks fly between the cards; every stick gets about the same area on screen whatever its shape
  // (a lone DIMM is long and thin, a kit nearly square), about two thirds of a GPU's; each printed at the same
  // median tone (a green board at the GPUs' gain fills in solid and the chips vanish)
  S.ramStorm.forEach((m, i) => {
    const c = S.cut[m.userData.key];
    throwCard(m, 100 + i, (i + 0.5) / S.ramStorm.length, 1.2 / Math.sqrt(c.aspect), { gain: -0.34 - (c.lum - 0.5) * 2.0, detail: 0.55 });
  });

  // dots torn off the cards: flung out on the questions, streaming into the buildings on the answer
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();   // dots billboard in the shader
  const al = S.dots.geometry.attributes.aAlpha;
  S.dots.visible = true;
  S.dots.material.uniforms.color.value.set(0xff4d63); S.dots.material.uniforms.gain.value = 1.8 + k * 2;
  for (let i = 0; i < S.dots.count; i++) {
    const a = h32(i, 11) * Math.PI * 2, sp = 1.5 + h32(i, 12) * 6, life = (dl * 0.9 + h32(i, 13) * 3) % 3;
    const out = P.set(Math.cos(a) * (0.3 + life * sp) * 1.6, Math.sin(a) * (0.3 + life * sp) + 0.3, -4 + h32(i, 14) * 7);
    if (answer) { const r0 = 4 + h32(i, 17) * 8; out.set(Math.cos(a) * r0 * 1.6, Math.sin(a) * r0 + 0.3, 3 - h32(i, 14) * 4).lerp(sky, life / 3); }
    const size = (0.02 + h32(i, 15) * 0.06) * (1 + k * 0.6);
    M.compose(P, q, Sc.set(size, size, size)); S.dots.setMatrixAt(i, M);
    al.array[i] = (answer ? clamp(life / 0.6) * clamp((3 - life) / 0.4) : clamp(1 - life / 3)) * (0.35 + 0.65 * h32(i, 16));
  }
  S.dots.instanceMatrix.needsUpdate = true; al.needsUpdate = true;
  // the AltMan takes the middle of the frame; while he's there the buildings' answer is his top text and bottom text
  // (the layout holds once he's been, so the words don't jump back when he leaves before the shot does: chorus 3)
  const am = altmanAt(t), meme = answer && PLAN.some(p => t >= p.enter && p.its >= s.t0 - 0.5 && p.its <= s.t1), A = am ? altman(t, S, am, k) : null;
  const ws = lineWords(cl), toks = lines[cl].text.replace(/["“”]/g, "").toUpperCase().split(/\s+/);
  // (while he's here, from his entrance on, the words stand BEHIND him, scaled up to keep their size on screen)
  // In the portrait frame the answer goes on a tall layer at the same depth (S.type.tall, about one canvas pixel per
  // screen pixel there): each half in two rows, the first half above his head, the second below his feet
  const tall = PORTRAIT && meme, L = tall ? S.type.tall : S.type.big;
  const bc = tall ? anchor(L, 576, 1024, [0, -0.04, -2])
    : am || meme ? anchor(S.type.big, 1024, 512, [0, 0.35, -2], [0, 0, meme ? 0 : (h32(cl, 3) - 0.5) * 0.08], 1.2 * 12.5 / 8.1)
                 : anchor(S.type.big, 1024, 512, [0, 0.35, 2.4], [0, 0, (h32(cl, 3) - 0.5) * 0.08], 1.2);
  let f = font(meme ? 170 : 250); bc.font = f; bc.textBaseline = "alphabetic";
  let rows = [[]], wsum = 0;
  if (meme) { const cut = toks.findIndex(tk => /!$/.test(tk)); rows[0] = toks.slice(0, cut + 1); rows.push(toks.slice(cut + 1)); }
  else toks.forEach(tok => { const w = bc.measureText(tok + " ").width; if (wsum + w > 1700 && rows[rows.length - 1].length) { rows.push([]); wsum = 0; } rows[rows.length - 1].push(tok); wsum += w; });
  let rowY = meme ? [250, 945] : rows.map((_, ri) => 512 - (rows.length - 1) * 125 + 90 + ri * 250);
  if (tall) {
    bc.font = font(200);
    const wd = r => bc.measureText(r.join(" ")).width;
    rows = rows.flatMap(r => {      // each half split where its two rows come out most even
      let best = [r], bw = wd(r);
      for (let i = 1; i < r.length; i++) { const m = Math.max(wd(r.slice(0, i)), wd(r.slice(i))); if (m < bw) { bw = m; best = [r.slice(0, i), r.slice(i)]; } }
      return best;
    });
    const F = Math.min(200, 200 * 960 / Math.max(...rows.map(wd)));    // the widest row fits 960 of the 1152 px
    f = font(F); bc.font = f;
    // two blocks of two rows, centred on the bands above his head and below his feet (canvas y 280 and 1755, which sit
    // clear of the HUD at the top and the timecode at the bottom)
    const cap = bc.measureText("H").actualBoundingBoxAscent, pitch = 1.02 * F, b = c => c + (cap - pitch) / 2;
    rowY = [b(280), b(280) + pitch, b(1755), b(1755) + pitch];
  }
  const cx = L.canvas.width / 2;
  let wi = 0;
  if (!hiddenLine(cl)) rows.forEach((row, ri) => {
    let x = cx - bc.measureText(row.join(" ")).width / 2;
    row.forEach(tok => {
      const w = ws[wi++], tw = bc.measureText(tok).width;
      if (w && t >= w.t) {
        const slam = since(t, w.t, 0.09);
        bc.save(); bc.translate(x + tw / 2, rowY[ri]); bc.scale(1 + slam * 0.35, 1 + slam * 0.35);
        const col = answer ? (t - w.t < 0.12 ? C.white : C.red) : (t - w.t < 0.5 ? C.white : "#ffd0d8");   // the buildings answer in red
        drawGlitched(bc, tok, 0, 0, f, col, slam * 0.8, Math.floor(t * 30) + wi, { align: "center" });
        bc.restore();
      }
      x += bc.measureText(tok + " ").width;
    });
  });
  L.end();

  hud(S, t, { left: `THE BUILDINGS · DROP ${String(s.index + 1).padStart(2, "0")}/03`, right: "COMPUTE ALLOCATED: 100% (NOT YOU)", color: "rgba(255,200,210,0.6)" });
  return { ...FILM, bloom: 0.85, bloomThreshold: 0.9, halation: 0.55, ca: 0.002 + k * 0.004 + (A ? A.ca : 0), glitch: k * 0.2 + (A ? A.g * 0.5 + A.glitch : 0), flash: k * 0.28 + (A ? A.flash : 0), invert: A ? A.invert : 0, grain: 0.095, vignette: 0.55 };
}

// ---------- 4. step twenty-five: the one quiet frame ----------
function quiet(t, S) {
  const st = song.stepAt(t), sen = sentences(st.li);
  camera(S, [0.25, 3.4, 7.0], [0.35, -0.95, -0.3], 0, 34);    // locked: this shot refuses to move (set first: the dust faces it)
  backdrop(S, [0, 0, 1], { shaft: [0.64, 1.2, 0.2, 1] });

  // the missing card: three years of dust on the floor, and a clean patch the exact shape of a GPU,
  // with marching ants around nothing
  const floor = [-Math.PI / 2, 0, 0.1], cut = S.cut.rtx3090;
  const gc = anchor(S.type.ghost, 1024, 1024, [0.4, -0.9, -0.2], floor);
  const W = 2048, bw = 1560, bh = bw / cut.aspect, ox = (W - bw) / 2, oy = (W - bh) / 2;
  const path = () => { gc.beginPath(); cut.outline.forEach(([x, y], i) => { const px = ox + x * bw, py = oy + y * bh; i ? gc.lineTo(px, py) : gc.moveTo(px, py); }); gc.closePath(); };
  const film = gc.createRadialGradient(W / 2, W / 2, W * 0.18, W / 2, W / 2, W * 0.5);   // a film of dust, feathered out
  film.addColorStop(0, "rgba(92,80,62,0.16)"); film.addColorStop(1, "rgba(92,80,62,0)");
  gc.fillStyle = film; gc.fillRect(0, 0, W, W);
  for (let i = 0; i < 16000; i++) {
    const x = h32(i, 41) * W, y = h32(i, 42) * W, r = 1.5 + h32(i, 43) * 3.5;
    const fall = clamp(1 - (Math.hypot(x - W / 2, y - W / 2) - W * 0.25) / (W * 0.25));
    gc.fillStyle = `rgba(52,46,38,${(0.18 + h32(i, 44) * 0.3) * fall})`; gc.fillRect(x, y, r, r);
  }
  for (let i = 0; i < 60; i++) {    // a few fibres
    const x = h32(i, 51) * W, y = h32(i, 52) * W, a = h32(i, 53) * Math.PI, l = 10 + h32(i, 54) * 30;
    gc.strokeStyle = "rgba(52,46,38,0.22)"; gc.lineWidth = 1.2; gc.beginPath(); gc.moveTo(x, y); gc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gc.stroke();
  }
  gc.save(); gc.globalCompositeOperation = "destination-out"; path(); gc.fill(); gc.restore();   // where it lay: no dust
  gc.lineWidth = 7; gc.strokeStyle = C.ink; gc.setLineDash([30, 20]); gc.lineDashOffset = -t * 36; gc.lineJoin = "round";
  path(); gc.stroke(); gc.setLineDash([]);
  // (the creator's note, 9/26: at "you still call it the build" every other word on screen clears)
  const youT = wordAt(25, "YOU"), keep = 1 - ease((t - (youT - 0.1)) / 0.12);
  gc.font = font(40, MONO, "600"); gc.fillStyle = C.ink; gc.textAlign = "left";
  gc.globalAlpha = keep; gc.fillText("GPU NOT INCLUDED", ox + 8, oy - 34); gc.globalAlpha = 1;
  S.type.ghost.end();

  // dust in the light
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const al = S.dots.geometry.attributes.aAlpha;
  S.dots.visible = true;
  S.dots.material.uniforms.color.value.set(0x3a342c); S.dots.material.uniforms.gain.value = 1;
  for (let i = 0; i < S.dots.count; i++) {
    if (i >= 90) { al.array[i] = 0; S.dots.setMatrixAt(i, M.makeScale(0, 0, 0)); continue; }
    const y = ((h32(i, 1) * 5 - t * (0.03 + h32(i, 2) * 0.05)) % 5 + 5) % 5 - 1.2;
    P.set(1.2 + (h32(i, 3) - 0.5) * 3.2 + Math.sin(t * 0.3 + i) * 0.1 - y * 0.35, y, -1 + h32(i, 4) * 4);
    const s = 0.008 + h32(i, 5) * 0.018;
    M.compose(P, q, Sc.set(s, s, s)); S.dots.setMatrixAt(i, M);
    al.array[i] = 0.25 + 0.5 * h32(i, 6);
  }
  S.dots.instanceMatrix.needsUpdate = true; al.needsUpdate = true;

  // the words, typed as she says them, flat on the frame like a terminal; from "you" on, only that sentence, alone in
  // the middle of the frame, waiting for its last word (BUILD, drawn by buildWord over whatever shot is on)
  hud(S, t, { color: "rgba(21,19,26,0.42)", tag: "", bare: 1 - keep }, c => {
    if (keep > 0) {
      c.globalAlpha = keep;
      c.font = font(26, MONO, "600"); c.fillStyle = "rgba(21,19,26,0.75)"; c.textAlign = "left";
      c.fillText(stepLabel(st.n), 64, 140);
      c.font = font(34, MONO);
      const parts = [];
      sen.forEach((s, si) => { if (si) parts.push({ br: true, t: s.t0 ?? 1e9 }); parts.push(...typedParts(s, false)); });
      drawTyped(c, parts, t, 64, 860, { color: C.ink, lineH: 52 });
      c.globalAlpha = 1;
    }
    if (t >= youT - 0.1) {
      const ws = STEP[25].words, i0 = ws.findIndex(w => w.w === "YOU" && w.t === youT), last = ws.length - 1;
      const phrase = ws.slice(i0, last).map((w, j) => ({ text: w.w.toLowerCase() + " ", t: w.t }));
      c.font = font(64, MONO, "600");
      const pw = c.measureText(phrase.map(p => p.text).join("").trim()).width;
      drawTyped(c, phrase, t, 960 - pw / 2, 420, { color: C.ink, cursor: t < ws[last].t, lineH: 80 });
    }
  });
  return { ...FILM, bloom: 0.12, bloomThreshold: 1.2, halation: 0, ca: 0, glitch: 0, flash: 0, grain: 0.055, vignette: 0.32, weave: 0.35, lift: 0 };
}

// ---------- step 25's last word (the creator's note, 9/26): BUILD, big, all caps; red when the word ends; it cracks, and on the
// next kick it shatters and the pieces fall under gravity, through the cut into step 26 ----------
const BW = (() => {
  const ws = STEP[25]?.words ?? [], w = ws[ws.length - 1];
  if (!w || w.w !== "BUILD") return null;
  const shatter = song.kicks.find(k => k >= w.end + 0.2) ?? w.end + 0.35;
  return { t: w.t, red: w.end, crack0: w.end + 0.08, shatter, t1: shatter + 1.9 };
})();
let BWART = null;                                   // the word as ink and as red, and its shards: made once
function buildArt() {
  if (BWART) return BWART;
  const f = font(400), probe = ctx2d(document.createElement("canvas"));
  probe.font = f;
  const m = probe.measureText("BUILD"), asc = Math.ceil(m.actualBoundingBoxAscent), desc = Math.ceil(m.actualBoundingBoxDescent);
  const pad = 20, w = Math.ceil(m.width) + pad * 2, h = asc + desc + pad * 2;
  const art = col => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = ctx2d(cv); g.font = f; g.fillStyle = col; g.textBaseline = "alphabetic"; g.fillText("BUILD", pad, pad + asc); return cv; };
  const ink = art(C.ink), red = art(C.red), px = ink.getContext("2d").getImageData(0, 0, w, h).data;
  // shards: a jittered grid over the word, each cell cut along a diagonal; a shard with (almost) no ink is dropped
  const COLS = 11, ROWS = 4, V = [];
  for (let r = 0; r <= ROWS; r++) for (let q = 0; q <= COLS; q++) {
    const edge = r === 0 || r === ROWS || q === 0 || q === COLS;
    V.push([q / COLS * w + (edge ? 0 : (h32(q, r, 201) - 0.5) * 0.7 * w / COLS), r / ROWS * h + (edge ? 0 : (h32(q, r, 202) - 0.5) * 0.7 * h / ROWS)]);
  }
  const vi = (q, r) => V[r * (COLS + 1) + q], shards = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const a = vi(q, r), b = vi(q + 1, r), c2 = vi(q + 1, r + 1), d = vi(q, r + 1);
    const tris = h32(q, r, 203) < 0.5 ? [[a, b, c2], [a, c2, d]] : [[a, b, d], [b, c2, d]];
    for (const tri of tris) {
      const x0 = Math.floor(Math.min(...tri.map(p => p[0]))), x1 = Math.ceil(Math.max(...tri.map(p => p[0])));
      const y0 = Math.floor(Math.min(...tri.map(p => p[1]))), y1 = Math.ceil(Math.max(...tri.map(p => p[1])));
      const inside = (x, y) => { const s = (p, q2) => (q2[0] - p[0]) * (y - p[1]) - (q2[1] - p[1]) * (x - p[0]); const d1 = s(tri[0], tri[1]), d2 = s(tri[1], tri[2]), d3 = s(tri[2], tri[0]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
      let n = 0;
      for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) if (x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 128 && inside(x, y)) n++;
      if (n < 8) continue;
      shards.push({ tri, c: [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3], box: [Math.max(0, x0), Math.max(0, y0), Math.min(w, x1) - Math.max(0, x0), Math.min(h, y1) - Math.max(0, y0)] });
    }
  }
  return (BWART = { ink, red, w, h, shards, hit: [w * 0.43, h * 0.55] });
}
function buildWord(t, S) {
  if (!BW || t < BW.t - 0.02 || t > BW.t1) return null;
  const A = buildArt(), L = S.shatter, c = L.begin();
  L.mesh.visible = true;
  const X0 = 960 - A.w / 2, Y0 = 690 - A.h / 2, out = { flash: 0, ca: 0, glitch: 0 };
  c.save();
  if (t < BW.shatter) {
    // the slam, then the tension: once it's red it trembles, and cracks run out from where it will break
    const s = lerp(1.45, 1, easeOut((t - BW.t) / 0.1)), red = t >= BW.red, fr = Math.floor(t * 30);
    const j = red ? 3 : 0, jx = (h32(fr, 211) - 0.5) * 2 * j, jy = (h32(fr, 212) - 0.5) * 2 * j;
    c.translate(960 + jx, 690 + jy); c.scale(s, s); c.translate(-A.w / 2, -A.h / 2);
    c.globalAlpha = clamp((t - BW.t + 0.02) / 0.05); c.drawImage(red ? A.red : A.ink, 0, 0); c.globalAlpha = 1;
    if (t >= BW.crack0) {
      const R = Math.hypot(A.w, A.h) * 0.75 * ease((t - BW.crack0) / (BW.shatter - BW.crack0));
      c.globalCompositeOperation = "destination-out"; c.lineWidth = 5; c.lineJoin = "round";
      for (const sh of A.shards) for (let e = 0; e < 3; e++) {
        const p = sh.tri[e], q = sh.tri[(e + 1) % 3], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        if (Math.hypot(mx - A.hit[0], my - A.hit[1]) > R) continue;
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
    }
    if (red) out.flash = since(t, BW.red, 0.1) * 0.3;
  } else {
    // the break: every shard flies out from the hit and up a little, spins, and gravity takes it down off the frame
    const dt = t - BW.shatter, G = 2900;
    A.shards.forEach((sh, i) => {
      const dx = sh.c[0] - A.hit[0], dy = sh.c[1] - A.hit[1], d = Math.hypot(dx, dy) || 1;
      const sp = 220 + h32(i, 221) * 520, vx = dx / d * sp + (h32(i, 222) - 0.5) * 160, vy = dy / d * sp * 0.6 - 380 - h32(i, 223) * 360;
      const x = sh.c[0] + vx * dt, y = sh.c[1] + vy * dt + 0.5 * G * dt * dt, rot = (h32(i, 224) - 0.5) * 14 * dt;
      if (Y0 + y - 200 > 1080) return;
      c.save(); c.translate(X0 + x, Y0 + y); c.rotate(rot); c.translate(-sh.c[0], -sh.c[1]);
      c.beginPath(); c.moveTo(...sh.tri[0]); c.lineTo(...sh.tri[1]); c.lineTo(...sh.tri[2]); c.closePath(); c.clip();
      const [bx, by, bw, bh] = sh.box; c.drawImage(A.red, bx, by, bw, bh, bx, by, bw, bh);
      c.restore();
    });
    // and the chips: small bits thrown harder, falling faster
    c.fillStyle = C.red;
    for (let i = 0; i < 80; i++) {
      const sh = A.shards[i % A.shards.length], a = h32(i, 231) * Math.PI * 2, sp = 400 + h32(i, 232) * 900;
      const x = sh.c[0] + Math.cos(a) * sp * dt, y = sh.c[1] + (Math.sin(a) * sp - 300) * dt + 0.5 * G * 1.3 * dt * dt, s = 4 + h32(i, 233) * 9;
      c.save(); c.translate(X0 + x, Y0 + y); c.rotate(dt * 20 * (h32(i, 234) - 0.5)); c.fillRect(-s / 2, -s / 2, s, s); c.restore();
    }
    out.flash = since(t, BW.shatter, 0.08) * 0.45; out.ca = since(t, BW.shatter, 0.15) * 0.012; out.glitch = since(t, BW.shatter, 0.06) * 0.3;
  }
  c.restore();
  L.end();
  return out;
}

// every distinct look the director can produce, as song times: rendering these once at load compiles every
// shader variant up front (the first visit to a new effect otherwise stalls for seconds on Windows/ANGLE)
export function warmTimes() {
  const ts = [];
  for (const s of song.sections) ts.push(s.t0 + 0.05, (s.t0 + s.t1) / 2);
  lines.forEach((l, li) => {
    priceBeats(li).forEach(b => ts.push(b.t + 0.05, b.settle + 0.05));
    if (/compute for us/i.test(l.text) && song.lineStart(li) !== undefined) ts.push(song.lineStart(li) + 0.3);
    if (/^Step (six|eleven):/i.test(l.text)) lineWords(li).forEach(w => { if (["RAM", "THREE", "COMPANIES", "MAKE", "NINE", "BUILDINGS"].includes(w.w)) ts.push(w.t + 0.1, w.end + 0.3); });
  });
  for (const n in STEP) if (hasGui(+n)) ts.push(STEP[n].t0 + 0.45, (STEP[n].t0 + STEP[n].t1) / 2);
  const also = wordAt(14, "ALSO");
  if (also < Infinity) ts.push(also - 0.2, also);
  if (BW) ts.push(wordAt(25, "YOU") + 0.2, BW.t + 0.05, BW.red + 0.02, BW.crack0 + 0.1, BW.shatter + 0.02, BW.shatter + 0.5);
  const one = words.find(w => w.w === "ONE" && w.t < firstVerse.t0);
  if (one) ts.push(one.end + 0.5);
  for (const p of PLAN) ts.push(p.enter + 0.3, p.spin0 + 0.15, p.reveal + 0.01, p.reveal + 0.3, p.pull0 + 0.2, p.print0 + 0.4, p.d0 + 0.5, p.end - 0.05,
    ...(p.tele === undefined ? [p.exit0 + 0.3] : [...teleTimes(p), ...crabTimes(p)]));
  ts.push(song.FADE0 + 0.5, song.END - 0.1, ...fastTimes(FAST), ...introTimes(), ...V2TIMES(V2), ...meltTimes(v3plan()), ...chorusTimes(chorusPlans() ?? []));
  return [...new Set(ts.filter(t => t >= 0 && t < song.END).map(t => +t.toFixed(3)))].sort((a, b) => a - b);
}
// the last exit's three looks (the glitch, the squeeze, the beam), for the warm-ups here and in main.js
export const teleTimes = p => [p.tele + TELE * 0.1, p.tele + TELE * 0.4, p.tele + TELE * 0.7];

// ---------- the cut list ----------
// the intro (the creator's note, 9/27: the first version was "too... well, dead"): intro.js
function shot(t, S) {
  const s = song.sectionAt(t);
  if (!s || s.kind === "intro" || t < firstVerse.t0 - 0.05) return introShot(t, S);
  if (s.kind === "chorus") return drop(t, S);
  if (V2 && t >= V2.t0 && t < V2.t1) {
    S.hud.mesh.visible = false;                     // the cards and the chart carry their own furniture
    return { ...FILM, bloom: 0.25, bloomThreshold: 1.05, halation: 0.04, grain: 0.06, vignette: 0.2, weave: 0.35, ...V2CUT(t, S, V2) };
  }
  if (FAST && t >= FAST.t0 && t < FAST.t1) {
    S.hud.mesh.visible = false;                     // the cards carry their own furniture
    return { ...FILM, bloom: 0.25, bloomThreshold: 1.05, halation: 0.04, grain: 0.06, vignette: 0.2, weave: 0.35, ...fastCut(t, S, FAST) };
  }
  const st = song.stepAt(t);
  if (st && st.n === 25) return quiet(t, S);
  if (s.kind === "verse") return chapter(t, S);
  return intro(t, S);
}
export function frameAt(t, S) {
  resetStage(S);
  const P = shot(t, S);
  // what lives across a cut is drawn over whatever shot is on: step 25's BUILD falls into step 26, and step 27's held
  // word falls into the last chorus
  const B = buildWord(t, S);
  if (B) { P.flash = (P.flash ?? 0) + B.flash; P.ca = (P.ca ?? 0) + B.ca; P.glitch = (P.glitch ?? 0) + B.glitch; }
  const M = meltdown(t, S, v3plan());
  if (M) for (const k in M) P[k] = k === "invert" ? Math.max(P[k] ?? 0, M[k]) : (P[k] ?? FILM[k] ?? 0) + M[k];
  crab(t, S);
  P.fade = song.fadeAt(t);          // the video's end; main.js keeps the AltMan and the crab out of it
  return P;
}
