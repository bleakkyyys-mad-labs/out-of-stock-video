// Headless renders through the installed Edge (puppeteer-core; no browser download).
//   node tools/render.mjs stills 12.9 57.3 92.6       -> stills/renders/t0012.900.png ... (untracked, wipe at will)
//   node tools/render.mjs determinism 12.9 57.3 ...    -> same pixels in three render orders, or FAIL (exit 1)
//   node tools/render.mjs bench 12.9 91.7 ...          -> presented fps for 2 s from each t, CAPTURE mode (CPU canvases);
//                                                         the preview's own rate (GPU canvases) is preview-check
//   node tools/render.mjs preview-shot 58.6            -> stills/renders/preview-page.png: the ?play page at 1600x900, paused at t
//   node tools/render.mjs preview-check 57 103.8 ...   -> fresh ?play page: warm-up, audio load, then real playback from each t
//   OOS_QUERY="intro=0" node tools/render.mjs stills ... -> the same with page switches (stills / bench / determinism / video)
//   node tools/render.mjs video 159.3 166.4 out/clip.mp4 -> an MP4 of that stretch with the song under it: every frame read
//                                                         straight off the canvas at 30 fps, H.264 + AAC (out/ is untracked).
//                                                         The video ends at 4:05 (song.js END), the sound fading from 4:00:
//                                                         the whole thing is `video 0 245 out/<name>.mp4`.
//                                                         With OOS_QUERY="portrait" it is 9:16 (see src/frame.js).
//                                                         OOS_FRAMEHASH=1 writes an md5 per raw frame: the frames repeat
//                                                         exactly run to run; x264's threaded encode does not (9/28)
// Page errors and console output are COUNTED by kind, never dumped.
import puppeteer from "puppeteer-core";
import crypto from "crypto";
import fs from "fs";
import http from "http";
import path from "path";
import url from "url";
import { spawn, spawnSync } from "child_process";
import { serve } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SONG = process.env.OOS_SONG ? path.resolve(process.env.OOS_SONG) : path.resolve(ROOT, "..", "suno-songs", "out-of-stock", "OOM.wav");   // the song is not in the repo: OOS_SONG=<path to the WAV>
const FPS = 30;                    // src/song.js FPS: one beat is 12 frames
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 5631;                 // not 5630: that is the preview the creator's browser plays from
const RENDERS = path.join(ROOT, "stills", "renders");   // test renders: untracked; stills/ itself holds only review sheets
const [mode, ...args] = process.argv.slice(2);

const srv = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1",
    "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const issues = new Map();
const note = s => { const k = s.slice(0, 90); issues.set(k, (issues.get(k) || 0) + 1); };
try {
  const page = await browser.newPage();
  page.on("pageerror", e => note("pageerror: " + e.message));
  page.on("console", m => { if (["error", "warning"].includes(m.type())) note(m.type() + ": " + m.text()); });
  page.on("requestfailed", r => note("requestfailed: " + r.url()));
  page.on("response", r => { if (r.status() >= 400) note(`http ${r.status()}: ${r.url()}`); });
  // OOS_QUERY: page switches for A/B renders, e.g. OOS_QUERY="intro=0" (the old intro) or "fast=0" (the old verses)
  await page.goto(`http://127.0.0.1:${PORT}/index.html${process.env.OOS_QUERY ? "?" + process.env.OOS_QUERY : ""}`, { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 90000 });
  console.log("webgl:", (await page.evaluate(() => window.OOS_INFO)).renderer);
  if (mode === "stills") {
    fs.mkdirSync(RENDERS, { recursive: true });
    const { W, H } = await page.evaluate(() => window.OOS_FRAME);
    if (W !== 1920 || H !== 1080) {        // ?portrait (src/frame.js): the page shows the canvas at the frame's own size
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      await page.addStyleTag({ content: `#stage { width: ${W}px; height: ${H}px; }` });
    }
    const tag = W < H ? "p" : "";
    for (const a of args) {
      const t = +a, t0 = Date.now();
      await page.evaluate(t => window.OOS_RENDER(t), t);
      const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
      const f = path.join(RENDERS, `t${t.toFixed(3).padStart(8, "0")}${tag}.png`);
      fs.writeFileSync(f, buf);
      console.log(`${path.relative(ROOT, f)}  ${Date.now() - t0} ms`);
    }
  }
  if (mode === "bench") {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    for (const a of args) {
      const r = await page.evaluate(t => window.OOS_BENCH(t, 2), +a);
      console.log(`  ${(+a).toFixed(1).padStart(6)} s: ${r.fps.toFixed(0)} fps presented · median gap ${r.median.toFixed(1)} ms · max ${r.max.toFixed(1)} ms`);
    }
  }
  if (mode === "preview-shot") {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?play`, { waitUntil: "load" });
    await page.waitForFunction("window.OOS_TRANSPORT", { timeout: 180000 });
    await page.evaluate(t => window.OOS_TRANSPORT.seek(t), +(args[0] ?? 0));
    await new Promise(r => setTimeout(r, 1000));
    fs.mkdirSync(RENDERS, { recursive: true });
    const f = path.join(RENDERS, "preview-page.png");
    fs.writeFileSync(f, await page.screenshot({ type: "png" }));
    console.log(path.relative(ROOT, f), "at", await page.evaluate(() => window.OOS_TRANSPORT.now()));
  }
  if (mode === "preview-check") {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    const s0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?play`, { waitUntil: "load" });
    await page.waitForFunction("window.OOS_TRANSPORT", { timeout: 180000 });
    const w = await page.evaluate(() => window.OOS_WARMED);
    console.log(`warm-up: ${w.frames} looks in ${w.ms} ms · song decoded · page ready ${Date.now() - s0} ms after load started`);
    const a = await page.evaluate(() => ({ dur: window.OOS_TRANSPORT.buf.duration, sr: window.OOS_TRANSPORT.buf.sampleRate, ch: window.OOS_TRANSPORT.buf.numberOfChannels }));
    console.log(`audio: decoded ${a.dur.toFixed(2)} s · ${a.sr} Hz · ${a.ch} ch`);
    for (const t of args.map(Number)) {
      const r = await page.evaluate(async t => {
        const T = window.OOS_TRANSPORT, st = window.OOS_STATS;
        T.seek(t);
        Object.assign(st, { frames: 0, maxGap: 0, distinct: 0 });
        const w0 = performance.now();
        await T.play();
        await new Promise(res => setTimeout(res, 3000));
        const a1 = T.now(), gain = T.gain.gain.value, E = window.OOS_END; T.pause();
        const wall = (performance.now() - w0) / 1000;
        return { advanced: a1 - t, wall, frames: st.frames, maxGap: st.maxGap, distinct: st.distinct, gain, fade: 1 - Math.min(1, Math.max(0, (a1 - E.fade0) / (E.end - E.fade0))) };
      }, t);
      console.log(`  from ${t.toFixed(1).padStart(6)} s: audio +${r.advanced.toFixed(2)} s in ${r.wall.toFixed(2)} s wall · ${(r.frames / r.wall).toFixed(0)} fps · longest gap ${r.maxGap.toFixed(0)} ms · ${(r.distinct / r.wall).toFixed(0)} clock updates/s · gain ${r.gain.toFixed(3)} (the fade says ${r.fade.toFixed(3)})`);
    }
  }
  if (mode === "determinism") {
    const ts = args.map(Number);
    const pass = async order => { const out = {}; for (const t of order) { await page.evaluate(t => window.OOS_RENDER(t), t); out[t] = await page.evaluate(() => window.OOS_HASH()); } return out; };
    const shuffled = [...ts].map((t, i) => [Math.sin(i * 12.9898 + 4.1) * 43758.5453 % 1, t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const a = await pass(ts), b = await pass([...ts].reverse()), c = await pass(shuffled);
    let bad = 0;
    for (const t of ts) {
      const same = a[t] === b[t] && a[t] === c[t];
      if (!same) bad++;
      console.log(`  ${t.toFixed(3).padStart(8)}  ${same ? "same   " : "DIFFERS"}  ${a[t]} ${b[t]} ${c[t]}`);
    }
    console.log(bad ? `FAIL: ${bad} of ${ts.length} frames depend on render order` : `PASS: ${ts.length} frames identical in three render orders`);
    process.exitCode = bad ? 1 : 0;
  }
  if (mode === "video") {
    // Each frame is read off the canvas (readPixels: the same pixels OOS_HASH checks) and POSTed raw to a receiver
    // here that feeds ffmpeg in order. Measured 9/28: a PNG screenshot per frame is 0.8 s; this is 0.11 s a frame on
    // the heaviest stretch of the song, of which the drawing itself is 0.07 s.
    // the video ends where the page says (song.js END, 4:05): a stretch past it is rendered to there
    const E = await page.evaluate(() => window.OOS_END);
    const t0 = +args[0], t1 = Math.min(+args[1], E.end), out = path.resolve(ROOT, args[2] ?? "out/clip.mp4");
    if (+args[1] > E.end) console.log(`  the video ends at ${E.end} s: rendering to there`);
    const F0 = Math.round(t0 * FPS), N = Math.round(t1 * FPS) - F0;
    if (!(N > 0)) throw new Error(`video: no frames between ${args[0]} and ${args[1]}`);
    const { W, H } = await page.evaluate(() => window.OOS_FRAME);
    const a0 = F0 / FPS, dur = N / FPS;     // the sound is cut on the same frame grid: picture and sound are the same length
    // the sound's fade out, sample by sample on the picture's clock (song.js fadeAt): full until fade0, silent at end
    const g = `clip((${E.end}-t-${a0})/${E.end - E.fade0},0,1)`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn("ffmpeg", ["-v", "error", "-y",
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-framerate", String(FPS), "-i", "-",
      "-i", SONG,
      "-filter_complex", `[0:v]vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v];` +
        `[1:a]atrim=start=${a0}:end=${a0 + dur},asetpts=PTS-STARTPTS,aeval=exprs='val(0)*${g}|val(1)*${g}':c=same,` +
        `afade=t=in:d=0.01,afade=t=out:st=${(dur - 0.01).toFixed(4)}:d=0.01[a]`,
      "-map", "[v]", "-map", "[a]",
      // a bitrate cap, not a quality target: at CRF 17 the grain costs 13 MB a second (X takes 512 MB at most)
      "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-b:v", "25M", "-maxrate", "30M", "-bufsize", "60M",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", out], { stdio: ["pipe", "ignore", "pipe"] });
    let ffErr = "";
    ff.stderr.on("data", d => { ffErr += d; });
    const ffDone = new Promise(r => ff.on("close", r));
    // OOS_FRAMEHASH=1: an md5 per raw frame into <out>.frames.txt, to compare two renders before the encoder
    const hashes = process.env.OOS_FRAMEHASH ? [] : null;
    let got = 0, wrong = 0;
    const rcv = http.createServer((req, res) => {    // loopback, a free port, one raw RGBA frame per POST
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", async () => {
        const buf = Buffer.concat(chunks);
        if (buf.length === W * H * 4) {
          got++;
          if (hashes) hashes.push(crypto.createHash("md5").update(buf).digest("hex"));
          if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
        } else wrong++;
        res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); res.end();
      });
    });
    await new Promise(r => rcv.listen(0, "127.0.0.1", r));
    // puppeteer's Network domain copies every request body into the protocol: 1 s a frame for the 8 MB POST, 0.11 s without
    await page._client().send("Network.disable");
    await page.evaluate((W, H, port) => {
      const gl = document.getElementById("stage").getContext("webgl2"), px = new Uint8Array(W * H * 4);
      window.OOS_FRAME_OUT = async t => {
        window.OOS_RENDER(t);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        await fetch(`http://127.0.0.1:${port}/f`, { method: "POST", body: px, mode: "no-cors", headers: { "Content-Type": "text/plain" } });
      };
    }, W, H, rcv.address().port);
    const s0 = Date.now();
    try {
      for (let i = 0; i < N; i++) await page.evaluate(t => window.OOS_FRAME_OUT(t), (F0 + i) / FPS);
    } finally { ff.stdin.end(); rcv.close(); }
    const code = await ffDone, ms = Date.now() - s0;
    if (hashes) fs.writeFileSync(out + ".frames.txt", hashes.map((h, i) => `${F0 + i} ${h}`).join("\n") + "\n");
    if (code !== 0) { console.log(`ffmpeg exit ${code}: ${ffErr.slice(0, 300)}`); process.exitCode = 1; }
    const probe = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries",
      "stream=codec_type,codec_name,width,height,nb_read_frames,start_time,duration", "-of", "json", out], { encoding: "utf8" }).stdout || "{}");
    const v = (probe.streams || []).find(x => x.codec_type === "video") || {}, a = (probe.streams || []).find(x => x.codec_type === "audio") || {};
    console.log(`${path.relative(ROOT, out)}  ${W}x${H} · frames ${F0}-${F0 + N - 1} (${a0.toFixed(3)} to ${(a0 + dur).toFixed(3)} s of the song)`);
    console.log(`  sent ${got}/${N} frames${wrong ? `, ${wrong} WRONG SIZE` : ""} in ${(ms / 1000).toFixed(1)} s (${(ms / N).toFixed(0)} ms a frame) · ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
    console.log(`  file: ${v.codec_name} ${v.width}x${v.height} ${v.nb_read_frames} frames from ${v.start_time} s, ${v.duration} s · ${a.codec_name} from ${a.start_time} s, ${a.duration} s`);
    if (got !== N || wrong || +v.nb_read_frames !== N) process.exitCode = 1;
  }
} finally {
  await browser.close();
  srv.close();
  for (const [k, n] of issues) console.log(`  [${n}x] ${k}`);
}
