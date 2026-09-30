// Motion meter: how busy a stretch of the video is, the numbers a test viewer's attention answers to.
//   node tools/motion.mjs 20.70-90.93 108.72-148.66 ...   [OOS_QUERY="fast=0" for the old verses]
// For each window: renders it at 10 fps (capture mode, headless), shrinks every frame to 192x108 grey in the page,
// and reports the mean frame-to-frame change (0-255), how often the picture CUTS (change > CUT) and how often it
// changes BIG (change > BIG), and the longest stretch with no big change. Nothing is saved; only numbers come back
// (MOTION_DUMP=file appends each window's per-frame changes as a JSON line).
// The thresholds reproduce the measurement of verse 1's fast cut (a cut every 0.39 s, a big change every
// 0.16 s): on this pipeline verse 1 reads 0.38 s and 0.16 s at CUT 25 / BIG 10 (calibrated 9/27).
import puppeteer from "puppeteer-core";
import fs from "fs";
import { serve } from "./serve.mjs";

const FPS = 10, CUT = 25, BIG = 10, PORT = 5631;
const wins = process.argv.slice(2).map(a => a.split("-").map(Number));
const srv = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  let errors = 0;
  page.on("pageerror", () => errors++);
  await page.goto(`http://127.0.0.1:${PORT}/index.html${process.env.OOS_QUERY ? "?" + process.env.OOS_QUERY : ""}`, { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  for (const [t0, t1] of wins) {
    const d = await page.evaluate(async ({ t0, t1, FPS }) => {
      const src = document.getElementById("stage"), W = 192, H = 108;
      const mid = Object.assign(document.createElement("canvas"), { width: 480, height: 270 }).getContext("2d", { willReadFrequently: true });
      const sm = Object.assign(document.createElement("canvas"), { width: W, height: H }).getContext("2d", { willReadFrequently: true });
      mid.imageSmoothingQuality = sm.imageSmoothingQuality = "high";
      let prev = null; const diffs = [];
      for (let f = Math.round(t0 * FPS); f <= Math.round(t1 * FPS); f++) {
        window.OOS_RENDER(f / FPS);
        mid.drawImage(src, 0, 0, 480, 270); sm.drawImage(mid.canvas, 0, 0, W, H);
        const px = sm.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
        for (let i = 0; i < g.length; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
        if (prev) { let s = 0; for (let i = 0; i < g.length; i++) s += Math.abs(g[i] - prev[i]); diffs.push(s / g.length); }
        prev = g;
        if (f % 20 === 0) await new Promise(r => setTimeout(r, 0));
      }
      return diffs;
    }, { t0, t1, FPS });
    if (process.env.MOTION_DUMP) fs.appendFileSync(process.env.MOTION_DUMP, JSON.stringify({ t0, t1, d }) + "\n");   // the per-frame changes
    const secs = d.length / FPS, mean = d.reduce((a, b) => a + b, 0) / d.length;
    const cuts = d.filter(x => x > CUT).length, bigs = d.filter(x => x > BIG).length;
    let run = 0, still = 0; for (const x of d) { run = x > BIG ? 0 : run + 1; still = Math.max(still, run); }
    const every = n => (n ? (secs / n).toFixed(2) + " s" : "never");
    console.log(`${t0.toFixed(2)}-${t1.toFixed(2)} (${secs.toFixed(1)} s): mean change ${mean.toFixed(1)} · a cut every ${every(cuts)} · a big change every ${every(bigs)} · longest still stretch ${(still / FPS).toFixed(1)} s`);
  }
  if (errors) console.log(`  [${errors}x] page errors`);
} finally {
  await browser.close();
  srv.close();
}
