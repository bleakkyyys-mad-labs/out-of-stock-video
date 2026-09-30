// Boot: renderer, fonts, stage. Exposes OOS_RENDER(t) for headless capture; ?t=12.9 renders one frame.
import * as THREE from "three";
import { buildStage } from "./stage.js";
import { frameAt, warmTimes, altmanPlan, fastWarm, v3plan, teleTimes, crabTimes } from "./director.js";
import { Post } from "./post.js";
import { FPS, FADE0, END } from "./song.js";
import { loadOutlineFonts } from "./outline.js";
import { initMelt } from "./meltdown.js";
import { MASK_LAYER } from "./dancer.js";
import { W, H } from "./frame.js";

window.OOS_FRAME = { W, H };            // for tools/render.mjs video
window.OOS_END = { fade0: FADE0, end: END };   // ... which fades the sound on the picture's clock and stops at the end
const canvas = document.createElement("canvas");
canvas.id = "stage";
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
const post = new Post(renderer, W, H);

const faces = [
  new FontFace("Anton", "url(fonts/Anton-Regular.ttf)"),
  new FontFace("Plex Mono", "url(fonts/IBMPlexMono-Regular.ttf)", { weight: "400" }),
  new FontFace("Plex Mono", "url(fonts/IBMPlexMono-SemiBold.ttf)", { weight: "600" }),
  new FontFace("DM Serif", "url(fonts/DMSerifDisplay-Regular.ttf)"),       // the fast cut's quiet cards (fastcut.js)
];
for (const f of faces) { await f.load(); document.fonts.add(f); }
await loadOutlineFonts();                // verse 3's end: Anton and Plex Mono as outlines (outline.js, meltdown.js)
const S = await buildStage(renderer);
initMelt(S, v3plan());                   // its windows and invoices, drawn once
window.OOS_STAGE = S;      // for the headless probes
// every card drawn once before the first capture, all of them in one frame in front of the camera: a card's first
// draw can differ from all its later draws of the same t by 1/255 in an edge pixel (ANGLE/D3D11; measured on the
// SK hynix stick at 83.6, and not cured by uploading its texture early), so that first draw happens here
{
  const all = [...Object.values(S.cards), ...S.storm, ...S.ramStorm, ...S.ceo.meshes, S.type.screen.mesh, S.type.candles.mesh];
  S.camera.position.set(0, 0, 10); S.camera.lookAt(0, 0, 0); S.camera.updateProjectionMatrix();
  all.forEach((m, i) => { m.visible = true; m.position.set((i % 8 - 3.5) * 0.9, (Math.floor(i / 8) - 3) * 0.9, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(0.8); });
  renderer.render(S.scene, S.camera);
  all.forEach(m => { m.visible = false; });
}

// while the video fades out, the AltMan (and his beam) and the crab drawn alone: the fade leaves these pixels at full
// strength
const drawMask = r => {
  S.camera.layers.set(MASK_LAYER); r.render(S.scene, S.camera); S.camera.layers.set(0);
  r.clearDepth(); S.ocam.layers.set(MASK_LAYER); r.render(S.overlay, S.ocam); S.ocam.layers.set(0);
};
function render(t) {
  const P = frameAt(t, S);
  post.render(r => {
    r.render(S.bgScene, S.bgCam);
    r.render(S.scene, S.camera);
    r.clearDepth();
    r.render(S.overlay, S.ocam);
  }, P, Math.round(t * FPS), P.fade < 1 && (S.dancer.meshes.some(m => m.visible) || S.crab.mesh.visible) ? drawMask : null);
}

window.OOS_RENDER = t => { render(t); return true; };
// FNV-1a over the frame's pixels: the determinism instrument (same t must mean same picture, in any order)
window.OOS_HASH = () => {
  const gl = renderer.getContext(), px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
};
const gl = renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
window.OOS_INFO = { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
// a 1-pixel readback is a true sync: the frame (and any shader compile it triggered) is done when this returns
const px1 = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
// presented frame rate from t0: one render per animation frame with the canvas on screen, for `secs` seconds.
// (Back-to-back renders in one task hid a 36 ms/frame upload cost that only shows when frames are presented.)
window.OOS_BENCH = (t0, secs = 2) => new Promise(res => {
  let n = 0, prev = 0; const gaps = [], end = performance.now() + secs * 1000;
  const tick = now => {
    if (prev) gaps.push(now - prev); prev = now;
    render(t0 + n / 60); n++;
    if (performance.now() < end) requestAnimationFrame(tick);
    else { gaps.sort((a, b) => a - b); res({ fps: n / secs, median: gaps[gaps.length >> 1], max: gaps[gaps.length - 1] }); }
  };
  requestAnimationFrame(tick);
});
// render every distinct look once; onStep(done, total) lets a page show progress
window.OOS_WARM = async onStep => {
  const ts = warmTimes(), s = performance.now();
  for (let i = 0; i < ts.length; i++) { render(ts[i]); sync(); onStep?.(i + 1, ts.length); await new Promise(r => setTimeout(r, 0)); }
  return { frames: ts.length, ms: Math.round(performance.now() - s) };
};
const q = new URLSearchParams(location.search);
// the dancer: every kind of cel drawn and uploaded once before the first capture or play (first uses stall, and on
// the preview's GPU canvases they also raster differently; captures raster on the CPU, see type.js EXACT)
for (const p of altmanPlan) for (const t of [p.enter + 0.3, p.spin0 + 0.15, p.reveal + 0.01, p.reveal + 0.3, p.print0 + 0.3, p.print0 + 0.9, p.d0 + 0.2, p.d0 + 1.5,
  ...(p.tele === undefined ? [] : [...teleTimes(p), ...crabTimes(p)])]) { render(t); sync(); }
// the fast cut's cards: each drawn once (a canvas's first draw of a gradient or a scaled print can differ from later ones)
for (const t of fastWarm()) { render(t); sync(); }
render(q.has("t") ? +q.get("t") : 0);      // also warms every shader before the first capture
window.OOS_READY = true;
if (q.has("play")) (await import("./preview.js")).preview(render, window.OOS_WARM);
