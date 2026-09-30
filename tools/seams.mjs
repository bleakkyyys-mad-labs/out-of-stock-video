// Seams (lesson L87, RESOLUTION's instrument ported): every frame of a stretch at 30 fps, its change from the frame
// before, and every BIG change that nothing declared explains. Declared: the chorus's own events (chorus.js
// chorusProbe: the cut, every sung word's entrance, the storm re-thrown on each line, the signature, the blocks' exits,
// the push into the AltMan's framing, the creator's own moves) and the kicks (the drop shakes and pumps on every one).
//   node tools/seams.mjs 90.9 103.5
// Four series, because a picture difference is blind to exactly the seam L87 was about (re-learned 9/29: a camera
// jump of four units, planted in the blue half, moved the whole frame by 11 on a 0-255 scale -- inside the storm's own
// churn -- and moved the drawing's canvas no more than the steady pull-back did, because a thin line that moves one
// pixel and one that jumps two hundred change the same pixels; lesson L83's saturation):
//   frame   the finished picture (192x108 grey)                   -- flagged above FRAME
//   cam     the camera itself: how far 27 points of the site move on screen, px -- flagged at CAM x its local median
//   sheet   the drawing's own canvas                              -- flagged at SHEET x its local median
//   type    the questions' own canvas                             -- flagged at TYPE x its local median
// A change is a seam when it is flagged and more than two frames from every declared event.
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";

const [t0, t1] = process.argv.slice(2, 4).map(Number), FPS = 30, FRAME = 14, CAM = 3, SHEET = 4, TYPE = 4, FLOOR = 1.5, CAM_FLOOR = 8;
const srv = await serve(5631);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });
try {
  const page = await browser.newPage();
  let errors = 0; page.on("pageerror", () => errors++);
  await page.goto(`http://127.0.0.1:5631/index.html${process.env.OOS_QUERY ? "?" + process.env.OOS_QUERY : ""}`, { waitUntil: "load" });
  await page.waitForFunction("window.OOS_READY === true", { timeout: 120000 });
  const { rows, events, camEvents } = await page.evaluate(async ({ t0, t1, FPS }) => {
    const W = 192, H = 108, S = window.OOS_STAGE;
    const grey = src => {
      const mid = Object.assign(document.createElement("canvas"), { width: 480, height: 270 }).getContext("2d", { willReadFrequently: true });
      const sm = Object.assign(document.createElement("canvas"), { width: W, height: H }).getContext("2d", { willReadFrequently: true });
      mid.drawImage(src, 0, 0, 480, 270); sm.drawImage(mid.canvas, 0, 0, W, H);
      const px = sm.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
      for (let i = 0; i < g.length; i++) g[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) * px[i * 4 + 3] / 255;
      return g;
    };
    const diff = (a, b) => { if (!a || !b) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    // the camera: 27 world points spread over where the sites stand, projected the way three.js projects them
    const REF = [];
    for (const x of [-30, 0, 30]) for (const y of [-14, -2, 8]) for (const z of [-30, -60, -120]) REF.push([x, y, z]);
    const proj = () => {
      const c = S.camera; c.updateMatrixWorld();
      const e = c.matrixWorld.elements, k = (1080 / 2) / Math.tan(c.fov * Math.PI / 360);
      return REF.map(p => { const d = [p[0] - e[12], p[1] - e[13], p[2] - e[14]], z = -(d[0] * e[8] + d[1] * e[9] + d[2] * e[10]);
        return z > 0.5 ? [(d[0] * e[0] + d[1] * e[1] + d[2] * e[2]) * k / z, (d[0] * e[4] + d[1] * e[5] + d[2] * e[6]) * k / z] : null; });
    };
    const moved = (a, b) => { let s = 0, n = 0; for (let i = 0; i < a.length; i++) if (a[i] && b[i]) { s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); n++; } return n ? s / n : 0; };
    const rows = [];
    let pf = null, ps = null, pt = null, pc = null;
    for (let f = Math.round(t0 * FPS); f <= Math.round(t1 * FPS); f++) {
      window.OOS_RENDER(f / FPS);
      const gf = grey(document.getElementById("stage")), pr = proj();
      const gs = S.sheet.mesh.visible ? grey(S.sheet.canvas) : null, gt = S.lock.mesh.visible ? grey(S.lock.canvas) : null;
      if (pf) rows.push([f / FPS, diff(gf, pf), gs && ps ? diff(gs, ps) : 0, gt && pt ? diff(gt, pt) : 0, moved(pr, pc)]);
      pf = gf; ps = gs; pt = gt; pc = pr;
      if (f % 30 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const kicks = window.OOS.kicks.map(k => [k.t, k.t + 0.07]), P = window.OOS_CHORUS ? window.OOS_CHORUS() : [];
    return { rows, events: [...P.flatMap(p => p.events), ...kicks], camEvents: [...P.flatMap(p => p.camEvents), ...kicks] };
  }, { t0, t1, FPS });
  // how far t is from the nearest declared event: 0 inside one. The camera answers only to what moves the camera
  const dist = (t, ev) => Math.min(...ev.map(([a, b]) => (t < a ? a - t : t > b ? t - b : 0)));
  const near = t => dist(t, events), nearCam = t => dist(t, camEvents);
  const free = rows.filter(r => near(r[0]) > 2.2 / FPS), camFree = rows.filter(r => nearCam(r[0]) > 2.2 / FPS);
  // a series' local baseline: the median of its changes within half a second (a second when that is too few). The
  // neighbours may sit on events: a baseline of only the quiet frames would call every beat's own motion a seam
  // (the type's is its upper quartile: the words boil on twos by design -- up to 1.2 px every other frame, which on
  // letters 200 px tall moves tens of thousands of edge pixels -- so half its frames are steps and half are still, and
  // a median would call every step of the boil a seam; a block that jumps moves many times more than a boil step)
  // (the camera's is its three frames either side: a smooth move, however fast, looks like its neighbours; a jump
  // does not. Half a second of neighbours called the tail of a fast designed move a seam because calm frames followed)
  const base = (i, col) => {
    for (const w of col === 4 ? [0.101, 0.2] : [0.5, 1.0]) {
      const v = rows.filter(r => Math.abs(r[0] - rows[i][0]) <= w && r !== rows[i]).map(r => r[col]).sort((a, b) => a - b);
      if (v.length >= (col === 4 ? 4 : 6)) return v[Math.floor((v.length - 1) * (col === 3 ? 0.75 : 0.5))];
    }
    return null;
  };
  const pct = (col, p) => { const v = rows.map(r => r[col]).sort((a, b) => a - b); return v[Math.floor(p * (v.length - 1))]; };
  console.log(`${t0}-${t1}: ${rows.length} frame pairs · frame change median ${pct(1, 0.5).toFixed(1)} max ${pct(1, 1).toFixed(1)} · camera median ${pct(4, 0.5).toFixed(1)} px max ${pct(4, 1).toFixed(1)} px · sheet median ${pct(2, 0.5).toFixed(2)} · type max ${pct(3, 1).toFixed(2)}`);
  const bad = [];
  rows.forEach((r, i) => {
    const why = [], rel = (col, k, floor, name, dp) => { const b = base(i, col); if (b !== null && r[col] > floor && r[col] > k * Math.max(b, 0.25)) why.push(`${name} ${r[col].toFixed(dp)} (local ${b.toFixed(dp)})`); };
    if (nearCam(r[0]) > 2.2 / FPS) rel(4, CAM, CAM_FLOOR, "camera", 1);
    if (near(r[0]) > 2.2 / FPS) { if (r[1] > FRAME) why.push(`frame ${r[1].toFixed(1)}`); rel(2, SHEET, FLOOR, "sheet", 2); rel(3, TYPE, FLOOR, "type", 2); }
    if (why.length) bad.push(`  SEAM? ${r[0].toFixed(3)}  ${why.join(" · ")}  (nearest event ${(near(r[0]) * 1000).toFixed(0)} ms)`);
  });
  bad.forEach(s => console.log(s));
  console.log(bad.length ? `FAIL: ${bad.length} changes off every declared event`
    : `PASS: every big change sits on a declared event (camera checked on ${camFree.length} frames, the picture and layers on ${free.length})`);
  process.exitCode = bad.length ? 1 : 0;
  if (errors) console.log(`[${errors}x] page errors`);
} finally { await browser.close(); srv.close(); }
