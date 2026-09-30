// The determinism instrument's own loop (no screenshots between frames), with the fast cut's canvas hashed beside
// the frame: tells a difference in the cards' 2D canvas from one below it (WebGL).
//   node tools/probe-det.mjs 116.7 118.6 ...      (renders the list three times: given, reversed, given again)
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
import fs from "fs";
const SAVE = process.env.PROBE_SAVE ? +process.env.PROBE_SAVE : null;      // save the layer canvas of this t, every pass
const LAYER = process.env.PROBE_LAYER || "fast";                           // which full-frame 2D layer to hash: fast | asc
const srv = await serve(5631);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5631/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  await page.evaluate(L => { window.__L = L; }, LAYER);
  const ts = process.argv.slice(2).map(Number);
  let pn = 0;
  const pass = async order => { const out = {}; pn++; for (const t of order) { await page.evaluate(t => window.OOS_RENDER(t), t);
    if (SAVE !== null && Math.abs(t - SAVE) < 1e-6) { const url = await page.evaluate(() => window.OOS_STAGE[window.__L].canvas.toDataURL("image/png")); fs.writeFileSync(`stills/renders/det-${pn}-t${t.toFixed(3)}.png`, Buffer.from(url.split(",")[1], "base64")); }
    out[t] = await page.evaluate(() => {
    const cv = window.OOS_STAGE[window.__L].canvas, px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let x = 0x811c9dc5; for (let i = 0; i < px.length; i++) x = Math.imul(x ^ px[i], 16777619);
    return window.OOS_HASH() + "/" + (x >>> 0).toString(16).padStart(8, "0"); }); } return out; };
  const a = await pass(ts), b = await pass([...ts].reverse()), c = await pass(ts);
  for (const t of ts) console.log(`${t.toFixed(3).padStart(8)}  ${a[t] === b[t] && b[t] === c[t] ? "same   " : "DIFFERS"}  ${a[t]}  ${b[t]}  ${c[t]}`);
} finally { await browser.close(); srv.close(); }
