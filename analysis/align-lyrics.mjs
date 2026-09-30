// Whisper transcripts (lead + backing stems) -> the v3-alt lyric sheet, word by word.
// Whisper is the clock, the sheet is the truth: every sheet word gets a time from its
// matched Whisper word, or is interpolated between matched neighbours. Output: whisper/words.json.
import fs from "fs";

const SHEET = "../../suno-songs/out-of-stock/lyrics-v3-alt.md";

// --- the sheet: sung lines only, tagged by section ---
const block = fs.readFileSync(SHEET, "utf8").split("## LYRICS")[1].split("```")[1];
const lines = [];
let section = "";
for (const raw of block.split(/\r?\n/)) {
  const l = raw.trim();
  if (!l) continue;
  if (l.startsWith("[")) { if (/^\[(Intro|Verse \d|Chorus|Outro)\]$/.test(l)) section = l.slice(1, -1); continue; }
  lines.push({ section, text: l });
}

// --- normalisation: lower case, no punctuation, digits spelled out the way the sheet spells them ---
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = ["", "", ...("twenty thirty forty fifty sixty seventy eighty ninety".split(" "))];
function spell(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n >= 1900 && n < 2100 && n % 100) return spell(Math.floor(n / 100)) + " " + spell(n % 100);   // years
  if (n >= 1100 && n < 2000 && n % 100 === 0) return spell(n / 100) + " hundred";                   // twelve hundred
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spell(n % 100) : "");
  return spell(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + spell(n % 1000) : "");
}
function norm(s) {
  return s.toLowerCase()
    .replace(/\$(\d[\d,]*)/g, (_, d) => d + " dollars")
    .replace(/\d[\d,]*/g, d => " " + spell(+d.replace(/,/g, "")) + " ")
    .replace(/[-–—]/g, " ").replace(/[^a-z' ]/g, " ").replace(/'/g, "")
    .split(/\s+/).filter(Boolean);
}

const sheet = [];
lines.forEach((ln, li) => norm(ln.text).forEach(w => sheet.push({ w, li })));

// --- Whisper words: tokens grouped into words; t0 = token heuristic, dtw = DTW clock (s) ---
function whisperWords(file, stem) {
  const out = [];
  for (const seg of JSON.parse(fs.readFileSync(file, "utf8")).transcription) {
    let cur = null;
    for (const tk of seg.tokens) {
      if (tk.text.startsWith("[_") || !tk.text.trim()) continue;
      if (!cur || tk.text.startsWith(" ")) {
        cur = { raw: tk.text.trim(), t0: tk.offsets.from / 1000, t1: tk.offsets.to / 1000, dtw: tk.t_dtw / 100, p: tk.p, stem };
        out.push(cur);
      } else { cur.raw += tk.text; cur.t1 = tk.offsets.to / 1000; cur.p = Math.min(cur.p, tk.p); }
    }
  }
  // one Whisper word can spell out to several ("2019" -> twenty nineteen): split its span evenly
  return out.flatMap(o => {
    const ws = norm(o.raw), n = ws.length, d = (o.t1 - o.t0) / Math.max(n, 1);
    return ws.map((w, k) => ({ ...o, w, t0: o.t0 + k * d, dtw: o.dtw + k * d }));
  });
}

// --- global alignment (Needleman-Wunsch), fuzzy word equality ---
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
  return d[a.length][b.length];
}
const score = (a, b) => a === b ? 3 : (Math.max(a.length, b.length) > 3 && lev(a, b) / Math.max(a.length, b.length) <= 0.34 ? 1 : -2);
function align(S, W) {
  const n = S.length, m = W.length, G = -1;
  const H = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  const B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));   // 1 diag, 2 up (skip sheet), 3 left (skip whisper)
  for (let i = 1; i <= n; i++) { H[i][0] = i * G; B[i][0] = 2; }
  for (let j = 1; j <= m; j++) { H[0][j] = 0; B[0][j] = 3; }                 // free leading whisper junk
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = H[i - 1][j - 1] + score(S[i - 1].w, W[j - 1].w), u = H[i - 1][j] + G, l = H[i][j - 1] + (i === n ? 0 : G);
    if (d >= u && d >= l) { H[i][j] = d; B[i][j] = 1; } else if (u >= l) { H[i][j] = u; B[i][j] = 2; } else { H[i][j] = l; B[i][j] = 3; }
  }
  const pair = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const b = B[i][j];
    if (b === 1) { if (score(S[i - 1].w, W[j - 1].w) > 0) pair[i - 1] = j - 1; i--; j--; }
    else if (b === 2) i--; else j--;
  }
  return pair;
}

const lead = whisperWords("whisper/lead_pass1.json", "lead");
const backing = whisperWords("whisper/backing_pass1.json", "backing");
const pair = align(sheet, lead);
const src = sheet.map((_, i) => pair[i] >= 0 ? lead[pair[i]] : null);

// second pass: runs of 3+ unmatched sheet words try the backing stem inside the gap between anchors
for (let i = 0; i < sheet.length;) {
  if (src[i]) { i++; continue; }
  let j = i; while (j < sheet.length && !src[j]) j++;
  if (j - i >= 3) {
    const lo = i > 0 ? src[i - 1].dtw : 0, hi = j < sheet.length ? src[j].dtw : Infinity;
    const pool = backing.filter(b => b.dtw > lo && b.dtw < hi);
    const p2 = align(sheet.slice(i, j), pool);
    p2.forEach((k, r) => { if (k >= 0) src[i + r] = pool[k]; });
  }
  i = j;
}

// times: matched words take Whisper's clocks; runs of unmatched words are spread between anchors
const words = sheet.map((s, i) => {
  const m = src[i];
  return { i, li: s.li, section: lines[s.li].section, w: s.w, matched: !!m, stem: m?.stem ?? null, heard: m?.w ?? null, t0: m?.t0 ?? null, dtw: m?.dtw ?? null, p: m?.p ?? null };
});
for (const key of ["t0", "dtw"]) {
  let prev = -1;
  for (let i = 0; i <= words.length; i++) {
    if (i < words.length && words[i][key] === null) continue;
    const a = prev >= 0 ? words[prev][key] : (words[i]?.[key] ?? 0), b = i < words.length ? words[i][key] : a + 0.3 * (i - prev);
    for (let k = prev + 1; k < i; k++) words[k][key] = +(a + (b - a) * (k - prev) / (i - prev)).toFixed(3);
    prev = i;
  }
}

// --- report ---
const pct = (a, b) => (100 * a / b).toFixed(1) + "%";
const matched = words.filter(w => w.matched).length;
console.log(`sheet words ${words.length} · lead whisper words ${lead.length} · matched ${matched} (${pct(matched, words.length)})`);
for (const sec of [...new Set(lines.map(l => l.section))]) {
  const ws = words.filter(w => w.section === sec);
  console.log(`  ${sec.padEnd(8)} ${String(ws.filter(w => w.matched).length).padStart(4)}/${String(ws.length).padEnd(4)} ${pct(ws.filter(w => w.matched).length, ws.length)}`);
}
console.log("lines under 80% matched:");
lines.forEach((ln, li) => {
  const ws = words.filter(w => w.li === li), k = ws.filter(w => w.matched).length;
  if (k / ws.length < 0.8) console.log(`  [${ln.section}] ${pct(k, ws.length).padStart(6)}  ${ws[0].dtw?.toFixed(2)}s  ${ln.text.slice(0, 70)}`);
});
const used = new Set(src.filter(Boolean));
const extra = lead.filter(e => !used.has(e));
console.log(`backing-stem matches: ${words.filter(w => w.stem === "backing").length}`);
console.log(`lead words not in the sheet: ${extra.length} ->`, extra.map(e => `${e.w}@${e.dtw.toFixed(1)}`).join(" "));

fs.writeFileSync("whisper/words.json", JSON.stringify({ source: "whisper.cpp large-v3 · lead stem · pass1", lines, words, backing }, null, 0));
