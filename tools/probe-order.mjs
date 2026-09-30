// Order probe (a determinism FAIL's diagnosis): renders the given times in order on ONE fresh page, prints each
// frame's hash, and saves every frame as stills/renders/probe-<index>-t<t>.png so two renders of one t can be diffed.
//   node tools/probe-order.mjs 45.0 44.62 45.0
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import url from "url";
import { serve } from "./serve.mjs";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const RENDERS = path.join(ROOT, "stills", "renders"), PORT = 5631;
const srv = await serve(PORT);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 90000 });
  fs.mkdirSync(RENDERS, { recursive: true });
  const ts = process.argv.slice(2).map(Number);
  for (let i = 0; i < ts.length; i++) {
    await page.evaluate(t => window.OOS_RENDER(t), ts[i]);
    const h = await page.evaluate(() => window.OOS_HASH());
    const ch = await page.evaluate(() => { const cv = window.OOS_STAGE.fast?.canvas; if (!cv) return "-"; const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let x = 0x811c9dc5; for (let i = 0; i < px.length; i++) x = Math.imul(x ^ px[i], 16777619); return (x >>> 0).toString(16); });
    fs.writeFileSync(path.join(RENDERS, `probe-${i}-t${ts[i].toFixed(3)}.png`), await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } }));
    const url = await page.evaluate(() => window.OOS_STAGE.fast ? window.OOS_STAGE.fast.canvas.toDataURL("image/png") : "x,");
    fs.writeFileSync(path.join(RENDERS, `probe-${i}-canvas.png`), Buffer.from(url.split(",")[1], "base64"));
    console.log(i, ts[i].toFixed(3), h, "fast canvas", ch);
  }
} finally { await browser.close(); srv.close(); }
