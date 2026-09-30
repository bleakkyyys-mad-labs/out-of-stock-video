// The chorus's plan, printed from the live page (chorus.js): per chorus, the switch, the stamp, the two blocks and
// every word bound to its sung time (MISSING = a word the take didn't sing), the site's size and its targets.
//   node tools/probe-chorus.mjs
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const srv = await serve(5631);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"], defaultViewport: { width: 1920, height: 1080 } });
try {
  const page = await browser.newPage();
  let errs = 0; page.on("pageerror", e => { errs++; if (errs < 4) console.log("pageerror:", e.message.slice(0, 200)); });
  await page.goto("http://127.0.0.1:5631/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  const plans = await page.evaluate(() => window.OOS_CHORUS());
  let missing = 0;
  for (const p of plans) {
    console.log(`chorus ${p.ci + 1}: shot ${p.t0} · answer ${p.ansT} · AltMan in ${p.enter} · SWITCH ${p.sw} · stamp ${p.stamp} · site ${p.parts} pieces, ${p.cells} windows, ${p.targets} targets`);
    p.locks.forEach((l, i) => { missing += l.words.filter(w => w.includes("MISSING")).length; console.log(`  q${i + 1} ${l.t0} -> exit ${l.exitAt}: ${l.words.join("  ")}`); });
  }
  console.log(missing ? `MISSING words: ${missing}` : "every word bound to its syllable");
  if (errs) console.log(`[${errs}x] page errors`);
} finally { await browser.close(); srv.close(); }
