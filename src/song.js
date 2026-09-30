// The song as data. Every visual syncs to these: the kick map (analysis/kicks.mjs), the beat grid,
// the aligned words (analysis/align-ctc.py). Nothing here knows about pictures.
const T = window.OOS, L = window.OOS_LYRICS;

export const DUR = T.duration;
// the video's own end (the creator's ruling, 9/29: the song "overstays its welcome"): picture and sound fade from 4:00 and are
// black and silent at 4:05; nothing after that is part of the video
export const FADE0 = 240, END = 245;
export const fadeAt = t => 1 - Math.min(1, Math.max(0, (t - FADE0) / (END - FADE0)));
export const BEAT = T.grid.beat;
export const GRID0 = T.grid.a;
export const FPS = 30;                                   // 150 BPM: one beat = exactly 12 frames
export const kicks = T.kicks.map(k => k.t);
export const drops = T.drops;
// the first lead-vocal region starting after t (the outro's countdown has no aligned words; its voice does)
export const leadAfter = t => (T.lead.find(r => r[0] > t) || [T.duration])[0];
export const words = L.sung;                             // {w, li, wi, t, end, score}
export const lines = L.lines;                            // {section, text}

// display tokens that line up 1:1 with the aligned words ("Twenty-nineteen." -> "Twenty-", "nineteen."): a sung
// word's sheet text is tokens(lines[w.li].text)[w.wi]
export function tokens(s) {
  const out = [];
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    const parts = tok.split("-");
    parts.forEach((p, i) => { if (/[A-Za-z]/.test(p)) out.push({ text: p + (i < parts.length - 1 ? "-" : ""), space: i === parts.length - 1 }); else if (out.length) out[out.length - 1].text += p; });
  }
  return out;
}

// deterministic hash of integers -> [0,1)
export function h32(...xs) {
  let h = 0x811c9dc5;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x297a2d39); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const beatAt = t => (t - GRID0) / BEAT;
const bsearch = (arr, t) => { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
export function lastKick(t) { const i = bsearch(kicks, t); return i < 0 ? null : { i, t: kicks[i] }; }
// 1 on the kick, decaying; the "hit" every visual pumps with
export function kickEnv(t, decay = 0.16) { const k = lastKick(t); return k && t - k.t < 1.5 ? Math.exp(-(t - k.t) / decay) : 0; }
// the 20 fps loudness envelopes, 0..1
export function env(name, t) {
  const a = T.env[name], f = t * T.envFps, i = Math.floor(f);
  if (i < 0) return a[0] / 255; if (i >= a.length - 1) return a[a.length - 1] / 255;
  return (a[i] + (a[i + 1] - a[i]) * (f - i)) / 255;
}

// --- the synth stem (analysis/synth-spectrum.py: the plugin's analyzer chain, precomputed per video frame) ---
const SY = window.OOS_SYNTH;
const unb64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
const SY_SHAPED = unb64(SY.shaped), SY_ENV = unb64(SY.env);
export const synth = {
  bands: SY.bands,
  onsets: SY.onsets.map(([t, s]) => ({ t, s })),          // its notes (8ths with rests in the intro), strength 0..1
  spans: SY.spans.map(([t0, t1]) => ({ t0, t1 })),         // where it plays
  // the shaped band values (0..1) at t, linear between analysis frames (the render lands on them exactly)
  bandsAt(t, out = new Float32Array(SY.bands)) {
    const f = Math.max(0, Math.min(SY.frames - 1, t * SY.fps)), i = Math.min(SY.frames - 2, Math.floor(f)), u = f - i, B = SY.bands;
    for (let b = 0; b < B; b++) out[b] = (SY_SHAPED[i * B + b] * (1 - u) + SY_SHAPED[(i + 1) * B + b] * u) / 255;
    return out;
  },
  env(t) {
    const f = Math.max(0, Math.min(SY.frames - 1, t * SY.fps)), i = Math.min(SY.frames - 2, Math.floor(f)), u = f - i;
    return (SY_ENV[i] * (1 - u) + SY_ENV[i + 1] * u) / 255;
  },
};
{ const ts = synth.onsets.map(o => o.t); synth.lastOnset = t => { const i = bsearch(ts, t); return i < 0 ? null : { i, ...synth.onsets[i] }; }; }

// --- the lead vocal (analysis/lead-voice.py: the same analyzer chain as the synth, plus her pitch every 10 ms) ---
const LD = window.OOS_LEAD;
const LD_SHAPED = unb64(LD.shaped), LD_ENV = unb64(LD.env);
const LD_PITCH = (() => { const b = unb64(LD.pitch); return new Uint16Array(b.buffer, b.byteOffset, b.length >> 1); })();
export const lead = {
  bands: LD.bands,
  bandsAt(t, out = new Float32Array(LD.bands)) {
    const f = Math.max(0, Math.min(LD.frames - 1, t * LD.fps)), i = Math.min(LD.frames - 2, Math.floor(f)), u = f - i, B = LD.bands;
    for (let b = 0; b < B; b++) out[b] = (LD_SHAPED[i * B + b] * (1 - u) + LD_SHAPED[(i + 1) * B + b] * u) / 255;
    return out;
  },
  env(t) {
    const f = Math.max(0, Math.min(LD.frames - 1, t * LD.fps)), i = Math.min(LD.frames - 2, Math.floor(f)), u = f - i;
    return (LD_ENV[i] * (1 - u) + LD_ENV[i + 1] * u) / 255;
  },
  // her pitch as a MIDI note (float) at t; 0 where she isn't singing (linear between two sung frames only)
  midiAt(t) {
    const f = t * LD.pitchFps, i = Math.floor(f), u = f - i;
    if (i < 0 || i >= LD.pitchFrames - 1) return 0;
    const a = LD_PITCH[i], b = LD_PITCH[i + 1];
    if (!a) return 0;
    return (b ? a + (b - a) * u : a) / 100;
  },
};

// --- words and lines ---
const byLine = new Map();
words.forEach(w => { if (w.li !== null) { if (!byLine.has(w.li)) byLine.set(w.li, []); byLine.get(w.li).push(w); } });
export const lineWords = li => byLine.get(li) || [];
export const lineStart = li => (lineWords(li)[0] || {}).t;
export const lineEnd = li => { const ws = lineWords(li); return ws.length ? ws[ws.length - 1].end : undefined; };
export const findLine = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l.text));
export function sungIndex(t) { return bsearch(words.map(w => w.t), t); }   // last word started by t
export function wordsIn(t0, t1) { return words.filter(w => w.t >= t0 && w.t < t1); }

// --- sections: each verse/chorus instance as a time span (the chorus repeats, so spans come from words) ---
export const sections = [];
{
  let cur = null;
  lines.forEach((l, li) => {
    const ws = lineWords(li);
    if (!ws.length) return;
    const kind = l.section.startsWith("Verse") ? "verse" : l.section === "Chorus" ? "chorus" : l.section.toLowerCase();
    if (!cur || cur.name !== l.section || li !== cur.lines[cur.lines.length - 1] + 1) {
      cur = { name: l.section, kind, lines: [], t0: ws[0].t, t1: ws[ws.length - 1].end };
      sections.push(cur);
    }
    cur.lines.push(li);
    cur.t1 = ws[ws.length - 1].end;
  });
  const extras = words.filter(w => w.li === null && w.t < sections[0].t0 + 30 && w.t < (sections.find(s => s.kind === "verse") || {}).t0);
  if (extras.length) sections[0].t1 = Math.max(sections[0].t1, extras[extras.length - 1].end);
  sections.forEach((s, k) => { s.index = sections.filter((o, j) => j < k && o.kind === s.kind).length; });
}
export function sectionAt(t) {
  let best = null;
  for (const s of sections) if (t >= s.t0 - 0.35) best = s;
  return best;
}

// the verse step a time belongs to: from its first word until the next line starts
export function stepAt(t) {
  const s = sectionAt(t);
  if (!s || s.kind !== "verse") return null;
  let li = null;
  for (const l of s.lines) if (t >= lineStart(l) - 0.3) li = l;
  if (li === null) li = s.lines[0];
  const m = lines[li].text.match(/^Step ([a-z-]+):\s*(.*)$/i);
  return { li, n: m ? stepNumber(m[1]) : null, text: lines[li].text, rest: m ? m[2] : lines[li].text, t0: lineStart(li), t1: lineEnd(li) };
}
const NUM = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
export function stepNumber(s) {
  const p = s.toLowerCase().split("-");
  return p.reduce((acc, w) => acc + (NUM.indexOf(w) >= 0 ? NUM.indexOf(w) : 0), 0);
}
