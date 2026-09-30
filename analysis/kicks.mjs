// Kick onsets from the drum stem + loudness envelopes for the other stems.
// Input: raw mono f32 dumps made by ffmpeg at 4 kHz (drum_low = lowpassed 180 Hz).
import fs from "fs";

const SR = 4000;
const read = f => { const b = fs.readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };

function rmsEnv(x, win, hop) {
  const n = Math.floor((x.length - win) / hop), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const o = i * hop;
    for (let j = 0; j < win; j++) { const v = x[o + j]; s += v * v; }
    out[i] = Math.sqrt(s / win);
  }
  return out;
}

// --- kicks: attack peaks of the low band ---
const HOP = 10, FPS = SR / HOP;               // 2.5 ms frames
const low = rmsEnv(read("drum_low.f32"), 40, HOP);
const nov = new Float32Array(low.length);
for (let i = 4; i < low.length; i++) nov[i] = Math.max(0, low[i] - low[i - 4]);

// local loudness reference: max of the envelope over +-3 s
const R = Math.round(3 * FPS), localMax = new Float32Array(low.length);
for (let i = 0; i < low.length; i += 20) {
  let m = 0; for (let j = Math.max(0, i - R); j < Math.min(low.length, i + R); j++) if (low[j] > m) m = low[j];
  for (let k = i; k < Math.min(low.length, i + 20); k++) localMax[k] = m;
}
const globalMax = low.reduce((a, b) => Math.max(a, b), 0);

const kicks = [];
const W = Math.round(0.04 * FPS), GAP = 0.15;
for (let i = W; i < nov.length - W; i++) {
  let isMax = true;
  for (let j = i - W; j <= i + W; j++) if (nov[j] > nov[i]) { isMax = false; break; }
  if (!isMax || nov[i] <= 0) continue;
  let peak = 0; for (let j = i; j < Math.min(low.length, i + 12); j++) peak = Math.max(peak, low[j]);
  if (peak < 0.35 * localMax[i] || peak < 0.04 * globalMax || nov[i] < 0.15 * peak) continue;
  const t = (i - 4) / FPS;                       // start of the rise
  if (kicks.length && t - kicks[kicks.length - 1].t < GAP) continue;
  kicks.push({ t: +t.toFixed(4), a: +(peak / globalMax).toFixed(3) });
}

// --- envelopes at 20 fps (50 ms) for drawing, normalized 0..255 ---
const envOf = (file) => {
  const e = rmsEnv(read(file), 200, 200);
  const m = e.reduce((a, b) => Math.max(a, b), 0) || 1;
  return Array.from(e, v => Math.round(255 * Math.min(1, v / m)));
};
const env = { mix: envOf("mix.f32"), backing: envOf("backing.f32"), lead: envOf("lead.f32"), drum: envOf("drum_low.f32") };

// --- report ---
const ioi = kicks.slice(1).map((k, i) => k.t - kicks[i].t);
const sorted = [...ioi].sort((a, b) => a - b);
const hist = {};
ioi.forEach(d => { const b = (Math.round(d * 20) / 20).toFixed(2); hist[b] = (hist[b] || 0) + 1; });
console.log("kicks:", kicks.length, "first:", kicks[0]?.t, "last:", kicks.at(-1)?.t);
console.log("median IOI:", sorted[sorted.length >> 1]?.toFixed(4), "-> BPM", (60 / sorted[sorted.length >> 1]).toFixed(2));
console.log("IOI hist:", Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 10));
// kick-free stretches longer than 2 s
let gaps = [];
for (let i = 1; i < kicks.length; i++) if (kicks[i].t - kicks[i - 1].t > 2) gaps.push([kicks[i - 1].t, kicks[i].t]);
console.log("gaps > 2s:", gaps.map(g => g.map(x => x.toFixed(1)).join("-")).join("  "));

fs.writeFileSync("kicks.json", JSON.stringify({ sr: SR, kicks, envFps: 20, env }));
