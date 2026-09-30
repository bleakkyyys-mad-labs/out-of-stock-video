// CPU profile of real frames: where does a slow moment spend its time?
//   node tools/profile.mjs 57.3 [frames=30]   -> top self-time functions + total ms/frame
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";

const [t0 = 57.3, n = 30] = process.argv.slice(2).map(Number);
const srv = await serve(5631);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"], defaultViewport: { width: 1920, height: 1080 },
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5631/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 90000 });
  await page.evaluate(t => window.OOS_BENCH(t, 0.5), t0);                    // warm this section
  const cdp = await page.createCDPSession();
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  const b = await page.evaluate((t, s) => window.OOS_BENCH(t, s), t0, n / 30);
  const { profile } = await cdp.send("Profiler.stop");
  const ms = 1000 / b.fps;
  const self = new Map(), byId = new Map(profile.nodes.map(x => [x.id, x]));
  profile.samples.forEach((id, i) => {
    const node = byId.get(id), cf = node.callFrame;
    const key = `${cf.functionName || "(anon)"}  ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0), frames = Math.max(1, Math.round(b.fps * n / 30));
  console.log(`t=${t0}: ${ms.toFixed(1)} ms/frame presented (${b.fps.toFixed(0)} fps) over ${frames} frames · main-thread profile ${total.toFixed(0)} ms`);
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
    .forEach(([k, v]) => console.log(`  ${(v / frames).toFixed(2).padStart(7)} ms/frame  ${(100 * v / total).toFixed(0).padStart(3)}%  ${k.slice(0, 110)}`));
} finally { await browser.close(); srv.close(); }
