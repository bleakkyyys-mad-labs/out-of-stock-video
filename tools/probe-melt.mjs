// Verse 3's end (meltdown.js), read off the live page: every beat of steps 26 and 27, the pile, the held word.
//   node tools/probe-melt.mjs           -> the beats, the pile (arrive / die), the held word's letters
//   node tools/probe-melt.mjs --panic   -> panic every 0.05 s through the two steps, and whether it ever falls
//   node tools/probe-melt.mjs --times   -> the moments worth a still (for `render.mjs stills` / `determinism`)
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const srv = await serve(5631);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"], defaultViewport: { width: 1920, height: 1080 } });
try {
  const page = await browser.newPage();
  let errs = 0;
  page.on("pageerror", e => { errs++; if (errs < 5) console.log("pageerror:", e.message.slice(0, 300)); });
  await page.goto("http://127.0.0.1:5631/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  const P = await page.evaluate(() => {
    const P = window.OOS_V3().plan;
    if (!P) return null;
    const w = P.word;
    return { t0: P.t0, t27: P.t27, t1: P.t1, tEnd: P.tEnd, step26: P.step26, yes: P.yes, youre: P.youre, billed: P.billed, billing: P.billing,
      step27: P.step27, no: P.no, nothing: P.nothing, avail: P.avail, upsells: P.upsells, roll: P.roll,
      say: P.say.map(s => `${s.t0.toFixed(2)} ${s.text}`),
      objs: P.objs.map(o => ({ i: o.i, kind: o.kind, key: o.key, tIn: o.tIn, tDie: o.tDie, billed: o.billed })),
      word: w && { t0: w.t0, hold: w.hold, crack: w.crack, edge: w.edge, shout: w.shout, mRef: w.mRef, mTop: w.mTop,
        letters: w.letters.map(l => ({ ch: l.ch, t: l.t, kind: l.kind, x: l.x, y: l.y, size: l.size, strain: l.strain })) } };
  });
  if (!P) { console.log("no plan (?v3=0, or a word missing)"); process.exitCode = 1; }
  else if (process.argv.includes("--times")) {
    const w = P.word, ls = w.letters;
    const ts = [P.step26 + 0.3, P.yes[0] + 0.12, P.yes[1] + 0.12, P.yes[2] + 0.12, P.youre + 0.1, P.billed + 0.2, P.billing + 0.1,
      ...P.upsells.map(k => k + 0.15), P.t27 + 0.3, (P.step27 + P.no) / 2, P.no + 0.03, P.no + 0.3, ...P.objs.map(o => o.tDie + 0.08),
      P.nothing + 0.1, (P.nothing + P.avail) / 2, ls[3].t + 0.02, ls[8].t + 0.05, ls[Math.floor(ls.length * 0.5)].t + 0.02,
      w.crack + 0.05, w.edge + 0.05, (w.edge + w.shout) / 2, w.shout + 0.05, P.t1 + 0.02, P.t1 + 0.25, P.t1 + 0.5, P.tEnd - 0.05];
    console.log([...new Set(ts.map(t => t.toFixed(2)))].join(" "));
  } else if (process.argv.includes("--panic")) {
    const rows = await page.evaluate(([a, b]) => { const V = window.OOS_V3(), out = []; for (let t = a; t < b; t += 0.05) out.push([t, V.panic(t).v, V.panic(t).spike]); return out; }, [P.t0, P.t1]);
    let falls = 0, worst = 0;
    for (let i = 1; i < rows.length; i++) { const d = rows[i - 1][1] - rows[i][1]; if (d > 1e-9) { falls++; worst = Math.max(worst, d); } }
    for (let i = 0; i < rows.length; i += 10) console.log(`${rows[i][0].toFixed(2).padStart(7)}  ${(rows[i][1] * 100).toFixed(0).padStart(3)}%  spike ${rows[i][2].toFixed(2)}`);
    console.log(`panic ${(rows[0][1] * 100).toFixed(0)}% -> ${(rows[rows.length - 1][1] * 100).toFixed(0)}% over ${rows.length} samples · ${falls} falls${falls ? ` (worst ${(worst * 100).toFixed(2)} pts)` : ""}`);
    if (falls) process.exitCode = 1;
  } else {
    const f = x => x.toFixed(2);
    console.log(`steps 26-27: ${f(P.t0)} - ${f(P.t1)} (step 27 from ${f(P.t27)}) · the layer lives to ${f(P.tEnd)}`);
    console.log(`26: STEP ${f(P.step26)} · YES ${P.yes.map(f).join(" / ")} · YOU'RE ${f(P.youre)} · BILLED ${f(P.billed)} · BILLING ${f(P.billing)} · upsells on ${P.upsells.map(f).join(" ")}`);
    console.log(`27: STEP ${f(P.step27)} · NO ${f(P.no)} · NOTHING ${f(P.nothing)} · AVAILABLE ${f(P.avail)} · the roll ${P.roll.map(f).join(" ")}`);
    console.log("the agent says:\n  " + P.say.join("\n  "));
    console.log("the pile:");
    for (const o of P.objs) console.log(`  ${o.i} ${o.kind} ${String(o.key).padEnd(8)} in ${f(o.tIn)}${o.billed ? ` · BILLED ${f(o.billed)}` : ""} · dies ${f(o.tDie)}`);
    const w = P.word;
    console.log(`the word: starts ${f(w.t0)} · hold ${f(w.hold)} · crack ${f(w.crack)} · edge ${f(w.edge)} · shout ${f(w.shout)} · pitch ${w.mRef.toFixed(1)} -> ${w.mTop.toFixed(1)}`);
    console.log("  " + w.letters.map(l => l.ch).join("") + `  (${w.letters.length} letters)`);
    for (const l of w.letters) console.log(`  ${l.ch} ${f(l.t)} ${l.kind.padEnd(5)} x ${l.x.toFixed(0).padStart(5)} y ${l.y.toFixed(0).padStart(4)} size ${l.size.toFixed(0)} strain ${l.strain.toFixed(2)}`);
  }
  if (errs) { console.log(`[${errs}x] page errors`); process.exitCode = 1; }
} finally { await browser.close(); srv.close(); }
