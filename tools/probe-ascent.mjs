// Verse 2's ascent (ascent.js), read off the live page: every beat, and the panic curve that steers the film.
//   node tools/probe-ascent.mjs           -> per beat: its window, its camera station, its drawing, its words
//   node tools/probe-ascent.mjs --times   -> the middle of each beat (for `render.mjs stills` / `determinism`)
//   node tools/probe-ascent.mjs --panic   -> panic, the axis level and the price every 0.25 s through the verse
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const srv = await serve(5631);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"], defaultViewport: { width: 1920, height: 1080 } });
try {
  const page = await browser.newPage();
  let errs = 0;
  page.on("pageerror", e => { errs++; if (errs < 5) console.log("pageerror:", e.message.slice(0, 200)); });
  await page.goto("http://127.0.0.1:5631/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  const P = await page.evaluate(() => ({
    t0: window.OOS_V2.t0, t1: window.OOS_V2.t1,
    ceo: window.OOS_V2.CEO, ev: window.OOS_V2.M.EV.map(e => e.te), halt: window.OOS_V2.M.HALT0, reopen: window.OOS_V2.M.REOPEN, launch: window.OOS_V2.M.LAUNCH,
    cards: window.OOS_V2.cards.map(c => ({ n: c.n, t0: c.t0, t1: c.t1, cam: c.cam, art: c.art, title: c.title, words: c.words.map(w => w.w).join(" ") })),
  }));
  if (process.argv.includes("--times")) {
    console.log(P.cards.map(c => (c.t0 + (c.t1 - c.t0) * 0.55).toFixed(2)).join(" "));
  } else if (process.argv.includes("--panic")) {
    const rows = await page.evaluate(([a, b]) => { const out = []; for (let t = a; t < b; t += 0.25) out.push(window.OOS_V2.probe(t)); return out; }, [P.t0, P.t1]);
    console.log("     t   panic  axis   candles  price");
    for (const r of rows) console.log(`${r.t.toFixed(2).padStart(7)}  ${(r.panic * 100).toFixed(0).padStart(4)}%  ×10^${r.axis}  ${String(r.candles).padStart(6)}  ${r.price.toExponential(2).padStart(10)}  ${r.art}`);
    const count = (key) => { const a = rows.map(r => r[key]); let n = 0, worst = 0; for (let i = 1; i < a.length; i++) { const d = a[i - 1] - a[i]; if (d > 0.002) { n++; worst = Math.max(worst, d); } } return { n, worst, a }; };
    const raw = count("raw"), tot = count("panic");
    console.log(`baseline: ${(raw.a[0] * 100).toFixed(0)}% -> ${(raw.a[raw.a.length - 1] * 100).toFixed(0)}% · ${raw.n} falls of ${raw.a.length - 1} (worst ${(raw.worst * 100).toFixed(1)} pts)`);
    console.log(`with the event spikes: ${tot.n} falls (worst ${(tot.worst * 100).toFixed(1)} pts) -- a spike is meant to settle back to a HIGHER plateau, so only the baseline must never fall`);
  } else {
    console.log(`verse 2: ${P.t0.toFixed(2)} - ${P.t1.toFixed(2)} s · ${P.cards.length} beats`);
    console.log(`events (the axis gives up): ${P.ev.map(t => t.toFixed(2)).join("  ")}`);
    if (P.ceo) console.log(`the flip: rises ${P.ceo.rise.toFixed(2)} · winds ${P.ceo.spin0.toFixed(2)} · LANDS ${P.ceo.land.toFixed(2)} · out ${P.ceo.out.toFixed(2)} - ${P.ceo.end.toFixed(2)}`);
    console.log(`halt ${P.halt.toFixed(2)} -> ${P.reopen.toFixed(2)} (${(P.reopen - P.halt).toFixed(2)} s) · launch ${P.launch.toFixed(2)}`);
    let prev = null;
    for (const c of P.cards) {
      console.log(`${String(c.n).padStart(2)} ${c.t0.toFixed(2)}-${c.t1.toFixed(2)} ${(c.t1 - c.t0).toFixed(2)}s  ${String(c.cam).padEnd(7)} ${String(c.art).padEnd(9)} ${String(c.title ?? "").padEnd(20)} ${c.words}`);
      prev = c;
    }
    void prev;
    const gaps = P.cards.map(c => c.t1 - c.t0);
    console.log(`beat length: mean ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)} s · longest ${Math.max(...gaps).toFixed(2)} s`);
  }
  if (errs) console.log(`[${errs}x] page errors`);
  process.exitCode = errs ? 1 : 0;
} finally { await browser.close(); srv.close(); }
