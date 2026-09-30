// Headless renders of the rotoscope page through the installed Edge (same rig as tools/render.mjs).
//   node roto/render.mjs stills 0 40 84 [--demo|--free] [--clip altman]  -> roto/out/<clip>/fNNN-<look>.png
//   node roto/render.mjs video [--demo|--free] [--clip altman]    -> roto/out/<clip>-<look>.mp4 (every frame + ffmpeg)
// Looks: final (default: the creator's illustration -> print -> the dance, print on paper, pencil on), demo (the technique
// over the film), free (the layers as the page's free mode starts).
//   node roto/render.mjs determinism 3 50 84 120                   -> same pixels in three render orders, or FAIL
// Page errors and console output are COUNTED by kind, never dumped.
import puppeteer from "puppeteer-core";
import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import url from "url";
import { serve } from "../tools/serve.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 5632;
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i < 0 ? null : argv.splice(i, 2)[1]; };
const flag = k => { const i = argv.indexOf(k); if (i < 0) return false; argv.splice(i, 1); return true; };
const clip = opt("--clip") || "altman", look = flag("--free") ? "free" : flag("--demo") ? "demo" : "final";
const [mode, ...args] = argv;

const srv = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1080, height: 1080, deviceScaleFactor: 1 },
});
const issues = new Map();
const note = s => { const k = s.slice(0, 90); issues.set(k, (issues.get(k) || 0) + 1); };
const grab = async (page, f) => {
  const b64 = await page.evaluate((f, m) => { window.ROTO_RENDER(f, m); return document.getElementById("roto").toDataURL("image/png").slice(22); }, f, look);
  return Buffer.from(b64, "base64");
};
try {
  const page = await browser.newPage();
  page.on("pageerror", e => note("pageerror: " + e.message));
  page.on("console", m => { if (["error", "warning"].includes(m.type())) note(m.type() + ": " + m.text()); });
  page.on("requestfailed", r => note("requestfailed: " + r.url()));
  page.on("response", r => { if (r.status() >= 400) note(`http ${r.status()}: ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/roto/index.html?render&clip=${clip}`, { waitUntil: "load" });
  await page.waitForFunction("window.ROTO_READY === true", { timeout: 120000 });
  const info = await page.evaluate(() => window.ROTO_INFO);
  console.log(`ready in ${Date.now() - t0} ms: ${info.count} frames @ ${info.fps} fps`);

  if (mode === "stills") {
    const dir = path.join(HERE, "out", clip); fs.mkdirSync(dir, { recursive: true });
    for (const a of args) {
      const f = +a, t = Date.now(), buf = await grab(page, f);
      const file = path.join(dir, `f${String(f).padStart(3, "0")}-${look}.png`);
      fs.writeFileSync(file, buf);
      console.log(`${path.relative(HERE, file)}  ${Date.now() - t} ms`);
    }
  }
  if (mode === "video") {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "roto-"));
    let ms = 0;
    for (let f = 0; f < info.counts[look]; f++) {
      const t = Date.now();
      fs.writeFileSync(path.join(tmp, `f${String(f).padStart(3, "0")}.png`), await grab(page, f));
      ms += Date.now() - t;
    }
    const out = path.join(HERE, "out", `${clip}-${look}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(info.fps), "-i", path.join(tmp, "f%03d.png"),
      "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`${path.relative(HERE, out)}: ${info.counts[look]} frames, ${(ms / info.counts[look]).toFixed(0)} ms/frame to render + grab`);
  }
  if (mode === "bench") {
    // PRESENTED cost: a new frame on every animation frame, canvas on screen, every frame of the clip twice in order.
    // (Timing draw calls alone only measures command recording, and a readback knocks the canvas off the GPU:
    // both measure a different pipeline from the one the page plays through.)
    const p = await page.evaluate(m => new Promise(res => {
      const gaps = [], N = window.ROTO_INFO.counts[m]; let f = 0, last = 0, t0 = 0;
      const tick = now => {
        if (last) gaps.push(now - last); else t0 = now; last = now;
        if (f < 2 * N) { window.ROTO_RENDER(f++ % N, m); requestAnimationFrame(tick); }
        else { const s = [...gaps].sort((a, b) => a - b);
          res({ fps: gaps.length / ((now - t0) / 1000), p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], late: gaps.filter(g => g > 1000 / 24).length, n: gaps.length }); }
      };
      requestAnimationFrame(tick);
    }), look);
    console.log(`presented (${look}): ${p.fps.toFixed(0)} fps (display cap 60) · p95 gap ${p.p95.toFixed(1)} ms · max ${p.max.toFixed(1)} ms · ` +
      `${p.late} of ${p.n} gaps over the 24-fps budget (41.7 ms)`);
  }
  if (mode === "determinism") {
    const fs_ = args.map(Number);
    const pass = async order => { const o = {}; for (const f of order) o[f] = crypto.createHash("sha1").update(await grab(page, f)).digest("hex").slice(0, 10); return o; };
    const a = await pass(fs_), b = await pass([...fs_].reverse()), c = await pass([...fs_].sort((x, y) => ((x * 7919) % 97) - ((y * 7919) % 97)));
    let bad = 0;
    for (const f of fs_) { const same = a[f] === b[f] && a[f] === c[f]; if (!same) bad++; console.log(`  ${String(f).padStart(4)}  ${same ? "same   " : "DIFFERS"}  ${a[f]} ${b[f]} ${c[f]}`); }
    console.log(bad ? `FAIL: ${bad} of ${fs_.length} frames depend on render order` : `PASS: ${fs_.length} frames identical in three render orders`);
    process.exitCode = bad ? 1 : 0;
  }
} finally {
  await browser.close();
  srv.close();
  for (const [k, n] of issues) console.log(`  [${n}x] ${k}`);
}
