// The PC on screen (the creator's note, 9/26): every step where the subject works the PC to hunt parts renders the GUI for it,
// as motion graphics. One browser window drawn in canvas px (GW x GH) on a type layer; every element is a pure
// function of song time and the step's own word times (K.at), so the capture stays deterministic.
// Also here: the verse-2 stock chart (drawCandles), a candle per beat, rising and then going vertical at step 14.
import { C, font, MONO, DISPLAY, decode, drawDecoded } from "./type.js";
import { h32 } from "./song.js";

export const GW = 1280, GH = 800;
export const GREEN = "#3dff9a", INK = "#0c0b10", PANEL = "#15131b", PANEL2 = "#1d1a24";
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const money = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });

// ---------- primitives (canvas px; ASCII text only, every icon is a path: the fonts carry no symbol glyphs) ----------
export const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
export function txt(c, s, x, y, size, color, o = {}) {
  const fam = o.fam ?? MONO;
  c.font = font(size, fam, o.weight ?? (fam === MONO ? "600" : ""));
  c.fillStyle = color; c.textAlign = o.align ?? "left"; c.textBaseline = "alphabetic";
  c.globalAlpha = o.alpha ?? 1; c.fillText(s, x, y); c.globalAlpha = 1;
  return c.measureText(s).width;
}
const typed = (s, t, t0, dur) => s.slice(0, Math.round(s.length * clamp((t - t0) / dur)));
export const fill = (c, col) => { c.fillStyle = col; c.fill(); };
export const stroke = (c, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
export function check(c, x, y, s, col) { c.beginPath(); c.moveTo(x, y + s * 0.5); c.lineTo(x + s * 0.38, y + s * 0.85); c.lineTo(x + s, y + s * 0.1); c.lineCap = "round"; c.lineJoin = "round"; stroke(c, col, s * 0.16); }
function star(c, x, y, r, col, on) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; i ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  c.closePath(); if (on) fill(c, col); else stroke(c, col, 2);
}
function tri(c, x, y, s, col, down) { c.beginPath(); c.moveTo(x, y + (down ? s : 0)); c.lineTo(x + s, y + (down ? s : 0)); c.lineTo(x + s / 2, y + (down ? 0 : s)); c.closePath(); fill(c, col); }
function upArrow(c, x, y, s, col) { c.beginPath(); c.moveTo(x, y + s * 0.45); c.lineTo(x + s / 2, y); c.lineTo(x + s, y + s * 0.45); c.moveTo(x + s / 2, y); c.lineTo(x + s / 2, y + s); c.lineCap = "round"; stroke(c, col, s * 0.16); }
function cross(c, x, y, s, col, w = 3) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s); c.moveTo(x + s, y); c.lineTo(x, y + s); stroke(c, col, w); }
function bell(c, x, y, s, swing, col) {
  c.save(); c.translate(x, y); c.rotate(swing);
  c.beginPath(); c.moveTo(-s * 0.5, s * 0.55); c.quadraticCurveTo(-s * 0.45, -s * 0.5, 0, -s * 0.55); c.quadraticCurveTo(s * 0.45, -s * 0.5, s * 0.5, s * 0.55); c.closePath();
  fill(c, col); c.beginPath(); c.arc(0, s * 0.68, s * 0.12, 0, 7); fill(c, col); c.beginPath(); c.arc(0, -s * 0.62, s * 0.08, 0, 7); fill(c, col);
  c.restore();
}
export function spinner(c, x, y, r, t, col) { c.beginPath(); c.arc(x, y, r, t * 9, t * 9 + 4.2); c.lineCap = "round"; stroke(c, col, r * 0.28); }
function pill(c, x, y, label, col, o = {}) {
  const size = o.size ?? 20; c.font = font(size, MONO, "600");
  const w = c.measureText(label).width + size * 1.4, h = size * 1.7;
  rr(c, x, y, w, h, h / 2); if (o.solid) fill(c, col); else { c.globalAlpha = 0.14; fill(c, col); c.globalAlpha = 1; stroke(c, col, 2); }
  txt(c, label, x + size * 0.7, y + h * 0.68, size, o.solid ? INK : col);
  return w;
}
function btn(c, x, y, w, h, label, o = {}) {
  const press = o.press ?? 0, s = 1 - press * 0.06;           // pressed = a dip, then back
  c.save(); c.translate(x + w / 2, y + h / 2); c.scale(s, s);
  rr(c, -w / 2, -h / 2, w, h, 12);
  if (o.ghost) stroke(c, o.color ?? C.amber, 3); else fill(c, o.color ?? C.amber);
  if (o.glow) { c.globalAlpha = o.glow * 0.5; rr(c, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 16); stroke(c, o.color ?? C.amber, 3); c.globalAlpha = 1; }
  txt(c, label, 0, h * 0.14, o.size ?? 26, o.ghost ? (o.color ?? C.amber) : INK, { align: "center" });
  c.restore();
}
function strike(c, x, y, w, col, k = 1) { c.fillStyle = col; c.fillRect(x - 4, y, (w + 8) * clamp(k), 4); }
// a stamp slammed onto the page: huge then settling, outlined, tilted
function stamp(c, t, t0, label, x, y, col, size = 84, rot = -0.12) {
  if (t < t0) return;
  const s = lerp(1.9, 1, easeOut((t - t0) / 0.14)), a = clamp((t - t0) / 0.06);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a;
  c.font = font(size, DISPLAY); const w = c.measureText(label).width + size * 0.6, h = size * 1.25;
  rr(c, -w / 2, -h / 2, w, h, 10); stroke(c, col, 6);
  c.textAlign = "center"; c.fillStyle = col; c.fillText(label, 0, size * 0.36);
  c.restore(); c.globalAlpha = 1;
}
function toast(c, t, t0, label, col = C.cyan, y = GH - 120) {
  if (t < t0) return;
  const k = easeOutBack((t - t0) / 0.3); c.font = font(22, MONO, "600");
  const w = c.measureText(label).width + 90, x = GW - 30 - w * k;
  rr(c, x, y, w, 64, 12); fill(c, "#221f2b"); stroke(c, col, 2);
  check(c, x + 22, y + 21, 22, col); txt(c, label, x + 60, y + 40, 22, C.bone);
}
function confetti(c, dt, x, y) {
  for (let i = 0; i < 40; i++) {
    const a = h32(i, 81) * Math.PI * 2, v = 160 + h32(i, 82) * 380, g = 700;
    const px = x + Math.cos(a) * v * dt, py = y + Math.sin(a) * v * dt + g * dt * dt;
    c.globalAlpha = clamp(1 - dt / 1.1); c.fillStyle = [C.amber, C.cyan, C.bone, GREEN][i % 4];
    c.save(); c.translate(px, py); c.rotate(dt * 9 * (h32(i, 83) - 0.5)); c.fillRect(-5, -3, 10, 6); c.restore();
  }
  c.globalAlpha = 1;
}
// a photo (one of the engine's cutouts), contain-fit
function photo(c, img, x, y, w, h, o = {}) {
  if (!img) return;
  const s = Math.min(w / img.width, h / img.height) * (o.scale ?? 1), dw = img.width * s, dh = img.height * s;
  c.globalAlpha = o.alpha ?? 1; c.drawImage(img, x + (w - dw) / 2 + (o.dx ?? 0), y + (h - dh) / 2 + (o.dy ?? 0), dw, dh); c.globalAlpha = 1;
}

// ---------- the pointer: it waits on each mark and arrives on the next one's time (a click leaves a ring) ----------
const ARROW = [[0, 0], [0, 30], [8, 23], [14, 36], [20, 33], [14, 21], [24, 21]];
function cursor(c, t, keys) {
  if (!keys.length || t < keys[0][0]) return null;
  let x = keys[0][1], y = keys[0][2], ring = 0;
  keys.forEach(([tk, kx, ky, click], i) => {
    if (i > 0) {
      const p = keys[i - 1], dur = Math.min(0.3, (tk - p[0]) * 0.85);
      if (t >= tk - dur) { const u = ease((t - tk + dur) / dur); x = lerp(p[1], kx, u); y = lerp(p[2], ky, u); }
    }
    if (click && t >= tk) ring = Math.max(ring, since(t, tk, 0.16));
  });
  if (ring > 0.01) { c.globalAlpha = ring; c.beginPath(); c.arc(x, y, 10 + (1 - ring) * 36, 0, 7); stroke(c, C.cyan, 3); c.globalAlpha = 1; }
  c.beginPath(); ARROW.forEach(([a, b], i) => (i ? c.lineTo(x + a, y + b) : c.moveTo(x + a, y + b))); c.closePath();
  fill(c, C.white); c.lineJoin = "round"; stroke(c, INK, 2);
  return { x, y, ring };
}

// ---------- the music, as the window hears it (the creator's note, 9/26: the windows react to the audio) ----------
// set by the director every frame before a script draws: kick = the kick envelope, env(name, t) = the stems' loudness
let AUD = { kick: 0, env: () => 0, t: 0 };
export const setAudio = a => { AUD = a; };

// ---------- the window ----------
// o: tabs [{label, t0, t1?, active}], url, spin (refresh-icon angle), clock (top right)
export function chrome(c, t, o) {
  const X = 6, Y = 6, W = GW - 12, H = GH - 12, k = AUD.kick;
  rr(c, X, Y, W, H, 16); fill(c, INK);                    // opaque: the ghost card behind must not show through
  c.save(); rr(c, X, Y, W, H, 16); c.clip();
  c.fillStyle = "#17151e"; c.fillRect(X, Y, W, 58); c.fillStyle = "#121017"; c.fillRect(X, Y + 58, W, 50);
  // the level strip along the bottom edge: the mix's loudness over the last 2.4 s, newest on the right
  const N = 64, bw = W / N;
  for (let i = 0; i < N; i++) {
    const v = AUD.env("mix", t - (N - 1 - i) * 0.0375), h = 2 + v * v * 13;
    c.fillStyle = i === N - 1 ? C.amber : `rgba(255,178,30,${0.18 + 0.4 * i / N})`; c.fillRect(X + i * bw + 1, Y + H - 2 - h, bw - 2, h);
  }
  c.restore();
  // the frame: on the kick it splits red / cyan, a hairline each way (the glitch stage splits the rest)
  if (k > 0.05) { c.globalAlpha = k * 0.8; rr(c, X - k * 3, Y, W, H, 16); stroke(c, C.red, 2); rr(c, X + k * 3, Y, W, H, 16); stroke(c, C.cyan, 2); c.globalAlpha = 1; }
  rr(c, X, Y, W, H, 16); stroke(c, `rgba(233,228,216,${0.3 + AUD.env("mix", t) * 0.35})`, 2);
  // the three lights are the three parts of the song: the kick, the lead voice, the shouted backing voice
  [[C.red, k], [C.amber, AUD.env("lead", t)], [GREEN, AUD.env("backing", t)]].forEach(([col, v], i) => {
    const x = X + 26 + i * 22, y = Y + 29, r = 7 * (1 + v * 0.45);
    c.globalAlpha = 0.25 + 0.75 * v; c.beginPath(); c.arc(x, y, r + 7 * v, 0, 7); stroke(c, col, 2);
    c.globalAlpha = 0.55 + 0.45 * v; c.beginPath(); c.arc(x, y, r, 0, 7); fill(c, col); c.globalAlpha = 1;
  });
  // tabs: each grows in from nothing and shrinks away when closed; many tabs share the strip (they get thin)
  const tabs = (o.tabs || []).map(tb => ({ ...tb, k: ease((t - tb.t0) / 0.14) * (tb.t1 !== undefined ? 1 - ease((t - tb.t1) / 0.12) : 1) })).filter(tb => tb.k > 0.001);
  const sum = tabs.reduce((a, b) => a + b.k, 0), tw = Math.min(220, (W - 116) / Math.max(sum, 1));
  let tx = X + 96;
  for (const tb of tabs) {
    const w = tw * tb.k;
    if (w > 5) {
      rr(c, tx + 1, Y + 12, w - 2, 46, [10, 10, 0, 0]); fill(c, tb.active ? "#2b2734" : "#1f1c27");
      if (tb.active) { c.fillStyle = C.amber; c.fillRect(tx + 1, Y + 12, w - 2, 3 + k * 4); }      // pumps on the kick
      if (w > 34) { c.save(); c.beginPath(); c.rect(tx + 8, Y + 12, w - (w > 70 ? 36 : 12), 46); c.clip(); txt(c, tb.label, tx + 14, Y + 42, 16, tb.active ? C.bone : C.mute); c.restore(); }
      if (w > 70) cross(c, tx + w - 24, Y + 30, 9, C.mute, 2);
    }
    tx += w;
  }
  // toolbar: back / forward / refresh, the address
  c.beginPath(); c.moveTo(X + 34, Y + 74); c.lineTo(X + 26, Y + 83); c.lineTo(X + 34, Y + 92); c.moveTo(X + 58, Y + 74); c.lineTo(X + 66, Y + 83); c.lineTo(X + 58, Y + 92);
  c.lineCap = "round"; c.lineJoin = "round"; stroke(c, C.mute, 3);
  c.save(); c.translate(X + 104, Y + 83); c.rotate(o.spin ?? 0);
  c.beginPath(); c.arc(0, 0, 10, 0.5, 5.6); stroke(c, o.spin ? C.cyan : C.mute, 3); tri(c, 6, -13, 9, o.spin ? C.cyan : C.mute, false);
  c.restore();
  rr(c, X + 136, Y + 66, W - 156, 34, 17); fill(c, PANEL2);
  c.beginPath(); c.rect(X + 156, Y + 83, 14, 10); fill(c, C.mute); c.beginPath(); c.arc(X + 163, Y + 83, 5, Math.PI, 0); stroke(c, C.mute, 2);
  txt(c, o.url ?? "", X + 184, Y + 90, 17, C.bone, { alpha: 0.85 });
  if (o.clock) txt(c, o.clock, X + W - 40, Y + 90, 17, C.amber, { align: "right" });
  return { x: X + 28, y: Y + 124, w: W - 56, h: H - 142 };
}

// ---------- the steps ----------
// K: { t, at(word, occ, step?), t0 (step start), t1 (step end), k (kick), frame, img(key), env(name, t) }
const BUILD = [["CPU", "8-CORE CPU", 189], ["GPU", "8 GB CARD", 499], ["RAM", "16 GB DDR4", 40], ["SSD", "1 TB NVME", 45],
  ["BOARD", "ATX BOARD", 119], ["PSU", "650 W GOLD", 89], ["COOLER", "TOWER 120 MM", 39], ["CASE", "MID TOWER", 180]];   // sums to $1,200
const buildTab = { label: "MY BUILD - LIST", t0: -1, active: true };

// the product page every shopping step shares: photo left, name / price / stock / the button right
function productPage(c, t, cb, o) {
  const pw = cb.w * 0.42;
  rr(c, cb.x, cb.y, pw, cb.h - 8, 14); fill(c, PANEL);
  if (o.art) o.art(c, cb.x, cb.y, pw, cb.h - 8); else photo(c, o.img, cb.x + 24, cb.y + 24, pw - 48, cb.h - 56, o.photo);
  const ix = cb.x + pw + 40, iw = cb.w - pw - 40;
  txt(c, o.name, ix, cb.y + 48, 30, C.bone);
  if (o.sub) txt(c, o.sub, ix, cb.y + 84, 19, C.mute);
  for (let i = 0; i < 5; i++) star(c, ix + 12 + i * 30, cb.y + 112, 11, C.amber, i < (o.stars ?? 4));
  if (o.starsNote) txt(c, o.starsNote, ix + 160, cb.y + 119, 18, C.amber);
  return { ix, iw, y: cb.y };
}

export const SCRIPTS = {
  // step 1: make a list. Every part in a tab. Twenty-nineteen. It's fun.
  1(c, K) {
    const t = K.t, tMake = K.at("MAKE"), tEvery = K.at("EVERY"), tTab = K.at("TAB"), tYear = K.at("TWENTY"), tFun = K.at("FUN");
    const tabT = i => lerp(tEvery, tTab + 0.15, i / 7);
    const cb = chrome(c, t, { tabs: [buildTab, ...BUILD.map((p, i) => ({ label: p[1], t0: tabT(i) }))], url: "buildlist.local/my-first-build" });
    txt(c, "MY BUILD", cb.x, cb.y + 56, 60, C.white, { fam: DISPLAY });
    if (t >= tYear) {
      const s = lerp(1.6, 1, easeOut((t - tYear) / 0.15));
      c.save(); c.translate(cb.x + 330, cb.y + 36); c.scale(s, s); pill(c, 0, -18, "SINCE 2019", C.amber, { size: 22 }); c.restore();
    }
    const y0 = cb.y + 96, rh = 60;
    BUILD.forEach(([kind, name], i) => {
      const tr = tMake + i * 0.06;
      if (t < tr) return;
      const a = easeOut((t - tr) / 0.2), y = y0 + i * rh, ot = tabT(i);
      c.globalAlpha = a; rr(c, cb.x + (1 - a) * 40, y, cb.w, rh - 8, 8); fill(c, i % 2 ? "#141219" : "#18161f"); c.globalAlpha = 1;
      txt(c, kind, cb.x + 20, y + 35, 20, C.mute, { alpha: a });
      txt(c, typed(name, t, tr + 0.04, 0.22), cb.x + 190, y + 35, 22, C.bone);
      if (t >= ot) {
        const k = since(t, ot, 0.2);
        txt(c, "OPEN IN TAB", cb.x + cb.w - 60, y + 35, 19, k > 0.3 ? C.white : C.cyan, { align: "right" });
        c.beginPath(); c.moveTo(cb.x + cb.w - 44, y + 30); c.lineTo(cb.x + cb.w - 30, y + 16); c.moveTo(cb.x + cb.w - 40, y + 16); c.lineTo(cb.x + cb.w - 30, y + 16); c.lineTo(cb.x + cb.w - 30, y + 26); stroke(c, C.cyan, 3);
      } else txt(c, "-", cb.x + cb.w - 60, y + 35, 19, C.mute, { align: "right" });
    });
    cursor(c, t, [[tEvery - 0.35, 820, 760], ...BUILD.map((_, i) => [tabT(i), cb.x + cb.w - 110, y0 + i * rh + 24, true]), [tFun, cb.x + 110, cb.y + 40, true]]);
    if (t >= tFun) { confetti(c, t - tFun, cb.x + 120, cb.y + 30); toast(c, t, tFun, "LIST SAVED - IT'S FUN", GREEN); }
  },

  // step 2: add it up. Twelve hundred. Save eight. Four to go. You're nearly done.
  2(c, K) {
    const t = K.t, tAdd = K.at("ADD"), tTwelve = K.at("TWELVE"), tSave = K.at("SAVE"), tFour = K.at("FOUR"), tNear = K.at("NEARLY");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "SAVINGS", t0: tSave - 0.1 }], url: "buildlist.local/my-first-build/total" });
    txt(c, "MY BUILD", cb.x, cb.y + 56, 60, C.white, { fam: DISPLAY });
    const lw = cb.w * 0.56, y0 = cb.y + 90, rh = 50;
    BUILD.forEach(([kind, name, p], i) => {
      const y = y0 + i * rh, tp = tAdd + i * 0.045;
      rr(c, cb.x, y, lw, rh - 6, 6); fill(c, i % 2 ? "#141219" : "#18161f");
      txt(c, kind, cb.x + 16, y + 30, 18, C.mute); txt(c, name, cb.x + 130, y + 30, 19, C.bone);
      if (t >= tp) txt(c, money(Math.round(p * easeOut((t - tp) / 0.2))), cb.x + lw - 16, y + 30, 20, C.amber, { align: "right" });
    });
    // the total counts up and lands on "twelve hundred"
    const ty = y0 + BUILD.length * rh + 44, tot = t < tAdd ? 0 : Math.round(1200 * easeOut((t - tAdd) / (tTwelve + 0.2 - tAdd)));
    txt(c, "TOTAL", cb.x + 16, ty, 24, C.mute);
    const land = since(t, tTwelve + 0.2, 0.2);
    txt(c, money(tot), cb.x + lw - 10, ty + 8, 64 + land * 16, land > 0.4 ? C.white : C.amber, { fam: DISPLAY, align: "right" });
    // savings: $800 saved, $400 to go, nearly done
    const sx = cb.x + lw + 50, sw = cb.w - lw - 50;
    if (t >= tSave - 0.1) {
      const a = easeOut((t - tSave + 0.1) / 0.25);
      c.globalAlpha = a; rr(c, sx, cb.y + 90, sw, 420, 14); fill(c, PANEL); c.globalAlpha = 1;
      txt(c, "SAVED", sx + 30, cb.y + 150, 24, C.mute);
      const saved = Math.round(800 * easeOut((t - tSave) / 0.35));
      txt(c, money(Math.max(saved, 0)), sx + 30, cb.y + 250, 92, GREEN, { fam: DISPLAY });
      const pulse = t >= tNear ? 0.5 + 0.5 * Math.sin((t - tNear) * 14) : 0;
      rr(c, sx + 30, cb.y + 290, sw - 60, 30, 15); fill(c, "#26222e");
      rr(c, sx + 30, cb.y + 290, (sw - 60) * (saved / 1200), 30, 15); fill(c, GREEN);
      if (pulse) { c.globalAlpha = pulse * 0.6; rr(c, sx + 24, cb.y + 284, sw - 48, 42, 20); stroke(c, GREEN, 3); c.globalAlpha = 1; }
      if (t >= tFour) txt(c, "$400 TO GO", sx + 30, cb.y + 380, 44, C.amber, { fam: DISPLAY, alpha: easeOut((t - tFour) / 0.15) });
      if (t >= tNear) txt(c, "NEARLY DONE", sx + 30, cb.y + 450, 30, C.white, { alpha: 0.6 + pulse * 0.4 });
    }
    cursor(c, t, [[tAdd - 0.2, 700, 700], [tSave - 0.05, sx + 120, cb.y + 300, true], [tNear, sx + 200, cb.y + 420]]);
  },

  // step 3: wait for March. The tax return. The card. The build. The game. The one.
  3(c, K) {
    const t = K.t, tWait = K.at("WAIT"), tMarch = K.at("MARCH");
    const ev = [["TAX RETURN", K.at("TAX"), 4], ["THE CARD", K.at("CARD"), 11], ["THE BUILD", K.at("BUILD"), 15], ["THE GAME", K.at("GAME"), 22], ["THE ONE", K.at("ONE"), 29]];
    const cb = chrome(c, t, { tabs: [buildTab, { label: "CALENDAR 2019", t0: K.t0 - 0.3, active: true }], url: "calendar.local/2019" });
    // the months flip past until March
    const months = ["JANUARY", "FEBRUARY", "MARCH"], mi = t < tWait ? 0 : t < tMarch ? 1 : 2, flip = mi ? since(t, mi === 1 ? tWait : tMarch, 0.12) : 0;
    txt(c, months[mi] + " 2019", cb.x, cb.y + 60 - flip * 30, 60, mi === 2 ? C.white : C.mute, { fam: DISPLAY, alpha: 1 - flip });
    const gx = cb.x, gy = cb.y + 100, cw = cb.w / 7, ch = 100;
    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].forEach((d, i) => txt(c, d, gx + i * cw + 12, gy - 10, 16, C.mute));
    for (let d = 0; d < 35; d++) {
      const col = d % 7, row = Math.floor(d / 7), day = d - 3;          // March 1st, 2019 is a Friday
      rr(c, gx + col * cw + 3, gy + row * ch + 3, cw - 6, ch - 6, 8); fill(c, "#141219");
      if (day >= 1 && day <= 31) txt(c, String(day), gx + col * cw + 14, gy + row * ch + 30, 18, mi === 2 ? C.bone : "#4a4654");
    }
    ev.forEach(([label, te, day], i) => {
      if (t < te) return;
      const d = day + 3, col = d % 7, row = Math.floor(d / 7), k = easeOutBack((t - te) / 0.2), last = i === ev.length - 1;
      c.save(); c.translate(gx + col * cw + cw / 2, gy + row * ch + 62); c.scale(k, k);
      rr(c, -cw / 2 + 8, -16, cw - 16, 34, 8); fill(c, last ? C.amber : "#2e2a38"); if (!last) stroke(c, C.cyan, 2);
      txt(c, label, 0, 7, 15, last ? INK : C.bone, { align: "center" });
      c.restore();
    });
    cursor(c, t, [[tMarch, 900, 650], ...ev.map(([, te, day]) => { const d = day + 3; return [te, gx + (d % 7) * cw + cw / 2, gy + Math.floor(d / 7) * ch + 62, true]; })]);
  },

  // step 4: refresh the page. It's a Tuesday. It's in stock. It's on sale. Don't blink.   (step 5 carries on from here)
  4(c, K) { shopPage(c, K, 4); },
  // step 5: blink. A building bought them. Forty thousand at a time. Think / about what a building does ... It thinks.
  5(c, K) { shopPage(c, K, 5); },

  // step 7: check the drive. A terabyte. Forty-five. Ninety now. The phones are shrinking on the inside to endure.
  7(c, K) {
    const t = K.t, t45 = K.at("FORTY"), t90 = K.at("NINETY"), tPh = K.at("PHONES"), tShr = K.at("SHRINKING"), tEnd = K.at("ENDURE");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "1 TB NVME SSD", t0: K.t0 - 0.3, active: true }], url: "shop.local/storage/1tb-nvme" });
    const ssd = (c2, x, y, w, h) => {
      const bw = w * 0.8, bh = bw * 0.26, bx = x + (w - bw) / 2, by = y + h * 0.4;
      rr(c2, bx, by, bw, bh, 8); fill(c2, "#1f3a2c"); stroke(c2, C.bone, 2);
      [0.08, 0.36, 0.62].forEach((f, i) => { rr(c2, bx + bw * f, by + bh * 0.2, bw * (i ? 0.22 : 0.2), bh * 0.6, 4); fill(c2, "#0f0e14"); });
      for (let i = 0; i < 22; i++) { c2.fillStyle = "#c9a24b"; c2.fillRect(bx + bw - 26 + (i % 2) * 8, by + 8 + i * (bh - 16) / 22, 6, (bh - 16) / 26); }
      txt(c2, "1 TB", bx + bw * 0.1, by + bh + 50, 40, C.bone, { fam: DISPLAY });
    };
    const P = productPage(c, t, cb, { art: ssd, name: "1 TB NVME SSD", sub: "M.2 2280 - PCIE 4.0", stars: 5 });
    const py = P.y + 230;
    if (t >= t45) txt(c, "$45", P.ix, py, 120, t >= t90 ? C.mute : C.white, { fam: DISPLAY, alpha: t >= t90 ? 0.6 : 1 });
    if (t >= t90) {
      strike(c, P.ix, py - 50, 150, C.red, easeOut((t - t90) / 0.15));
      const k = easeOutBack((t - t90) / 0.2);
      c.save(); c.translate(P.ix + 190, py); c.scale(k, k); txt(c, "$90", 0, 0, 120, C.red, { fam: DISPLAY }); c.restore();
      upArrow(c, P.ix + 380, py - 90, 44, C.red); txt(c, "NOW. +100%", P.ix + 440, py - 50, 26, C.red);
    }
    // the phone: its storage shrinking on the inside
    if (t >= tPh) {
      const a = easeOut((t - tPh) / 0.25), px = P.ix + 30, pyy = P.y + 300;
      c.globalAlpha = a; rr(c, px, pyy, 150, 290, 26); stroke(c, C.bone, 4); rr(c, px + 12, pyy + 16, 126, 258, 16); fill(c, "#141219"); c.globalAlpha = 1;
      const sizes = [512, 256, 128, 64], si = t < tShr ? 0 : Math.min(3, 1 + Math.floor((t - tShr) / 0.55));
      const inner = [1, 0.62, 0.38, 0.2][si] * (1 + since(t, tShr + (si - 1) * 0.55, 0.12) * 0.1);
      rr(c, px + 75 - 55 * inner, pyy + 145 - 110 * inner, 110 * inner, 220 * inner, 10); fill(c, C.cyan);
      txt(c, `STORAGE ${sizes[si]} GB`, px + 190, pyy + 120, 30, si ? C.red : C.bone);
      if (t >= tEnd) txt(c, "TO ENDURE.", px + 190, pyy + 170, 30, C.mute, { alpha: easeOut((t - tEnd) / 0.3) });
    }
    cursor(c, t, [[K.at("CHECK") - 0.1, 700, 720], [t45, P.ix + 80, P.y + 200], [t90, P.ix + 260, P.y + 200, true]]);
  },

  // step 8: check the case. It's fine. It's a box. It's the one part they don't want. It's on the floor. It's yours. It's pure.
  8(c, K) {
    const t = K.t, tFine = K.at("FINE"), tBox = K.at("BOX"), tWant = K.at("WANT"), tFloor = K.at("FLOOR"), tYours = K.at("YOURS"), tPure = K.at("PURE");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "MID TOWER CASE", t0: K.t0 - 0.3, active: true }, { label: "CART (1)", t0: tYours }], url: "shop.local/cases/mid-tower" });
    // the case drops to the floor of its photo panel, with a thud
    const box = (c2, x, y, w, h) => {
      const fall = t < tFloor ? 0 : easeOut((t - tFloor) / 0.18), bounce = since(t, tFloor + 0.18, 0.08) * 12;
      const bw = w * 0.42, bh = bw * 1.6, bx = x + (w - bw) / 2, by = lerp(y + h * 0.12, y + h - bh - 40, fall) - bounce;
      c2.fillStyle = C.mute; c2.fillRect(x + 30, y + h - 40, w - 60, 3);
      rr(c2, bx, by, bw, bh, 10); fill(c2, "#1b1922"); stroke(c2, C.bone, 3);
      rr(c2, bx + bw * 0.12, by + bh * 0.1, bw * 0.55, bh * 0.75, 6); stroke(c2, C.cyan, 2);
      c2.beginPath(); c2.arc(bx + bw * 0.83, by + bh * 0.12, 6, 0, 7); fill(c2, C.bone);
      if (t >= tFloor) txt(c2, "ON THE FLOOR", x + w / 2, y + h - 12, 18, C.mute, { align: "center" });
    };
    const P = productPage(c, t, cb, { art: box, name: "MID TOWER CASE", sub: t >= tBox ? "TYPE: A BOX" : "ATX - TEMPERED GLASS", stars: 3, starsNote: t >= tFine ? "IT'S FINE." : "" });
    txt(c, "$89.99", P.ix, P.y + 230, 100, C.white, { fam: DISPLAY });
    if (t >= tWant) pill(c, P.ix, P.y + 262, "IN STOCK - 9,999+ LEFT", GREEN, { size: 22 });
    const bx = P.ix, by = P.y + 340, press = since(t, tYours, 0.12);
    btn(c, bx, by, 420, 80, t >= tYours ? "IN YOUR CART" : "ADD TO CART", { press, color: t >= tYours ? GREEN : C.amber });
    if (t >= tPure) {
      const a = easeOut((t - tPure) / 0.3); c.globalAlpha = a;
      rr(c, P.ix, P.y + 460, 520, 110, 14); fill(c, PANEL); stroke(c, GREEN, 2);
      txt(c, "CART: CASE", P.ix + 24, P.y + 505, 24, C.bone); txt(c, "NOTHING ELSE IN IT.", P.ix + 24, P.y + 545, 20, C.mute);
      check(c, P.ix + 450, P.y + 490, 44, GREEN); c.globalAlpha = 1;
      // a gleam across it
      const g = (t - tPure) / 0.6; if (g < 1) { c.save(); rr(c, P.ix, P.y + 460, 520, 110, 14); c.clip(); c.globalAlpha = 0.25; c.fillStyle = C.white; c.fillRect(P.ix + g * 620 - 80, P.y + 450, 40, 140); c.restore(); c.globalAlpha = 1; }
    }
    cursor(c, t, [[K.at("CASE") - 0.1, 700, 720], [tFine, P.ix + 100, P.y + 112], [tWant, P.ix + 150, P.y + 280], [tYours, bx + 210, by + 42, true], [tPure + 0.4, P.ix + 300, P.y + 600]]);
  },

  // step 9: do the math. It's not a number. It's a chart. It's a weather report. It's a tab you keep.
  9(c, K) {
    const t = K.t, tMath = K.at("MATH"), tNum = K.at("NUMBER"), tChart = K.at("CHART"), tW = K.at("WEATHER"), tTab = K.at("TAB"), tKeep = K.at("KEEP");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "MATH.XLS", t0: K.t0 - 0.3, active: t < tTab }, { label: "MATH (KEEP)", t0: tTab + 0.25, active: t >= tTab }], url: "sheets.local/math" });
    const shrink = t < tTab ? 0 : ease((t - tTab) / 0.35);      // the whole sheet flies up into its own tab
    c.save(); c.translate(lerp(0, 360, shrink), lerp(0, -cb.y - 60, shrink)); c.scale(1 - shrink * 0.9, 1 - shrink * 0.9); c.globalAlpha = 1 - shrink * 0.7;
    rr(c, cb.x, cb.y, cb.w, 44, 8); fill(c, PANEL2);
    txt(c, "fx", cb.x + 14, cb.y + 30, 20, C.cyan);
    txt(c, typed("=SUM(PARTS) / (WAGE - RENT) * PRICE_OF_EVERYTHING", t, K.at("DO") - 0.1, 0.6), cb.x + 60, cb.y + 30, 19, C.bone);
    const gx = cb.x, gy = cb.y + 62, cw = cb.w / 6, ch = 44;
    if (t < tChart + 0.1) {
      for (let r = 0; r < 11; r++) for (let q = 0; q < 6; q++) {
        c.strokeStyle = "rgba(233,228,216,0.12)"; c.lineWidth = 1; c.strokeRect(gx + q * cw, gy + r * ch, cw, ch);
        if (r && q < 5 && t >= tMath) { const v = Math.round(20 + h32(r, q, 5) * 980); txt(c, String(v), gx + q * cw + cw - 12, gy + r * ch + 30, 18, "#b9b4c4", { align: "right" }); }
      }
      if (t >= tMath) { rr(c, gx + 5 * cw + 2, gy + 10 * ch + 2, cw - 4, ch - 4, 4); stroke(c, C.cyan, 3); }
      if (t >= tNum) { txt(c, "#NUM!", gx + 6 * cw - 14, gy + 10 * ch + 31, 22, C.red, { align: "right" }); stamp(c, t, tNum, "NOT A NUMBER", gx + cb.w * 0.5, gy + 220, C.red, 70); }
    }
    if (t >= tChart) {                                  // the numbers become a line, going up
      const k = easeOut((t - tChart) / 0.35), n = 40;
      c.beginPath();
      for (let i = 0; i <= n * k; i++) { const x = gx + 30 + i * (cb.w - 60) / n, v = 0.1 + i / n * 0.75 + (h32(i, 71) - 0.5) * 0.12; i ? c.lineTo(x, gy + 470 - v * 420) : c.moveTo(x, gy + 470 - v * 420); }
      stroke(c, C.red, 5);
    }
    if (t >= tW) {                                      // and the chart is a weather report
      const k = easeOutBack((t - tW) / 0.25), wx = gx + cb.w - 400, wy = gy + 20;
      c.save(); c.translate(wx + 180, wy + 110); c.scale(k, k); c.translate(-180, -110);
      rr(c, 0, 0, 360, 230, 18); fill(c, "#1f2230"); stroke(c, C.cyan, 2);
      c.beginPath(); c.arc(90, 90, 36, Math.PI, 0); c.arc(140, 80, 44, Math.PI, 0); c.arc(185, 100, 30, Math.PI * 1.2, 0.2); c.closePath(); fill(c, C.bone);
      c.beginPath(); c.moveTo(130, 120); c.lineTo(110, 160); c.lineTo(132, 160); c.lineTo(116, 200); stroke(c, C.amber, 5);
      txt(c, "PRICES", 230, 80, 22, C.mute); txt(c, "90%", 230, 130, 50, C.white, { fam: DISPLAY }); txt(c, "CHANCE OF HIKE", 200, 180, 18, C.amber);
      c.restore();
    }
    c.restore(); c.globalAlpha = 1;
    if (t >= tKeep) toast(c, t, tKeep, "PINNED. YOU KEEP IT.", C.amber, 300);
  },

  // step 10: close the tab. Open it. Close it. It's a hobby now. The hobby's the tab. The tab's the rig. You don't sleep.
  10(c, K) {
    const t = K.t, tClose = K.at("CLOSE"), tOpen = K.at("OPEN"), tClose2 = K.at("CLOSE", 1), tHobby = K.at("HOBBY"), tHT = K.at("HOBBY'S"), tRig = K.at("RIG"), tSleep = K.at("SLEEP");
    const many = t < tHobby ? 0 : Math.min(47, Math.floor((t - tHobby) / 0.025));
    const tabs = [{ label: "MY BUILD - LIST", t0: -1, t1: tClose + 0.05, active: true }, { label: "MY BUILD - LIST", t0: tOpen, t1: tClose2 + 0.05, active: true },
      ...Array.from({ length: 48 }, (_, i) => ({ label: "MY BUILD", t0: tHobby + i * 0.025, active: i === 0 }))];
    const cb = chrome(c, t, { tabs, url: t >= tHobby ? "buildlist.local/my-first-build" : "", clock: t >= tSleep ? "3:47 AM" : "" });
    const open = (t < tClose + 0.05) || (t >= tOpen && t < tClose2 + 0.05) || t >= tHobby;
    if (!open) txt(c, "NO TABS OPEN", cb.x + cb.w / 2, cb.y + cb.h / 2, 30, C.mute, { align: "center" });
    else {
      txt(c, "MY BUILD", cb.x, cb.y + 56, 60, C.white, { fam: DISPLAY });
      if (t >= tOpen && t < tClose2) stamp(c, t, tOpen, "REOPENED", cb.x + 600, cb.y + 50, C.cyan, 44, 0);
      if (t >= tHobby) txt(c, `${1 + many} TABS`, cb.x + cb.w, cb.y + 50, 40, C.amber, { fam: DISPLAY, align: "right" });
      if (t >= tRig) {                                   // the tab is the rig
        const k = easeOutBack((t - tRig) / 0.3);
        c.save(); c.translate(cb.x + cb.w / 2, cb.y + 330); c.scale(k, k);
        photo(c, K.img("rtx3070"), -420, -220, 840, 420);
        c.restore();
        txt(c, "THE RIG", cb.x + cb.w / 2, cb.y + cb.h - 20, 30, C.bone, { align: "center" });
      } else if (t >= tHT) txt(c, "HOBBY: THIS TAB", cb.x, cb.y + 140, 44, C.cyan, { fam: DISPLAY });
    }
    if (t >= tSleep) { const f = 0.5 + 0.5 * Math.sin(t * 22); c.fillStyle = `rgba(94,242,255,${0.05 + 0.05 * f})`; c.fillRect(6, 6, GW - 12, GH - 12); }
    cursor(c, t, [[tClose - 0.3, 700, 600], [tClose, 96 + 220 - 24, 36, true], [tOpen, 700, 400, true], [tClose2, 96 + 220 - 24, 36, true], [tHobby, 640, 420], [tSleep, 900, 700]]);
  },

  // step 12: press "notify me." It's free. It's a button. It's a prayer with a bell.
  12(c, K) {
    const t = K.t, tPress = K.at("NOTIFY"), tFree = K.at("FREE"), tBtn = K.at("BUTTON"), tPray = K.at("PRAYER"), tBell = K.at("BELL");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "FLAGSHIP 24 GB", t0: K.t0 - 0.3, active: true }], url: "shop.local/gpu/flagship-24gb" });
    const P = productPage(c, t, cb, { img: K.img("rtx3090"), name: "FLAGSHIP 24 GB", sub: "GRAPHICS CARD", stars: 5 });
    txt(c, "$1,499.99", P.ix, P.y + 220, 90, C.mute, { fam: DISPLAY });
    pill(c, P.ix, P.y + 250, "OUT OF STOCK", C.red, { size: 22 });
    const on = t >= tPress, pulse = t >= tBtn ? since(t, tBtn, 0.25) : 0;
    btn(c, P.ix, P.y + 330, 460, 84, on ? "YOU'LL BE NOTIFIED" : "NOTIFY ME", { press: since(t, tPress, 0.12), ghost: !on, color: on ? GREEN : C.amber, glow: pulse, size: 28 });
    if (on) check(c, P.ix + 20, P.y + 356, 30, INK);
    if (t >= tFree) pill(c, P.ix + 480, P.y + 352, "FREE", C.cyan, { size: 24 });
    if (t >= tPray) {                                    // the bell swings, rings, and nothing comes
      const sw = Math.sin((t - tPray) * 16) * 0.35 * Math.exp(-(t - tPray) * 0.8), bx = P.ix + 120, by = P.y + 530;
      bell(c, bx, by, 70, sw, C.amber);
      for (let i = 0; i < 3; i++) { const r = 70 + ((t - tBell) * 160 + i * 40) % 120; if (t >= tBell) { c.globalAlpha = clamp(1 - (r - 70) / 120); c.beginPath(); c.arc(bx, by, r, -0.6, 0.6); stroke(c, C.amber, 3); c.beginPath(); c.arc(bx, by, r, Math.PI - 0.6, Math.PI + 0.6); stroke(c, C.amber, 3); c.globalAlpha = 1; } }
      txt(c, "0 NOTIFICATIONS", bx + 120, by + 12, 26, C.mute);
    }
    cursor(c, t, [[K.t0, 700, 720], [tPress, P.ix + 230, P.y + 372, true], [tPray, P.ix + 520, P.y + 600]]);
  },

  // step 13: a podcast. "Compute is the new oil," says a man who has never seen a well.
  13(c, K) {
    const t = K.t, tPod = K.at("PODCAST"), tComp = K.at("COMPUTE"), tOil = K.at("OIL"), tSays = K.at("SAYS"), tWell = K.at("WELL");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "THE COMPUTE SHOW - EP. 412", t0: tPod - 0.2, active: true }], url: "pods.local/the-compute-show/412" });
    const ax = cb.x, ay = cb.y, as = 300;
    rr(c, ax, ay, as, as, 18); fill(c, "#2a1a14");
    // cover art: an oil derrick, drawn
    c.beginPath(); c.moveTo(ax + 150, ay + 50); c.lineTo(ax + 90, ay + 250); c.moveTo(ax + 150, ay + 50); c.lineTo(ax + 210, ay + 250);
    for (let i = 1; i < 5; i++) { const y = ay + 50 + i * 40, w = 60 * i / 5 * 2; c.moveTo(ax + 150 - w / 2, y); c.lineTo(ax + 150 + w / 2, y); }
    stroke(c, C.amber, 5); c.fillStyle = C.amber; c.fillRect(ax + 70, ay + 250, 160, 8);
    txt(c, "THE COMPUTE SHOW", ax + as + 36, ay + 50, 24, C.mute);
    txt(c, typed("COMPUTE IS THE NEW OIL", t, tComp, tOil + 0.2 - tComp), ax + as + 36, ay + 120, 54, C.white, { fam: DISPLAY });
    txt(c, "EP. 412  -  2 H 47 MIN", ax + as + 36, ay + 170, 20, C.mute);
    // the waveform is his voice (the lead stem's loudness), scrolling
    const wx = ax + as + 36, ww = cb.w - as - 36, wy = ay + 250;
    for (let i = 0; i < 70; i++) {
      const v = K.env("lead", t - (70 - i) * 0.03), h = 6 + v * 110;
      c.fillStyle = i > 64 ? C.amber : "rgba(233,228,216,0.55)"; c.fillRect(wx + i * ww / 70, wy - h / 2, ww / 70 - 4, h);
    }
    rr(c, ax, ay + 360, cb.w, 8, 4); fill(c, "#26222e"); rr(c, ax, ay + 360, cb.w * (0.31 + (t - K.t0) * 0.004), 8, 4); fill(c, C.amber);
    c.beginPath(); c.moveTo(ax + cb.w / 2 - 14, ay + 400); c.lineTo(ax + cb.w / 2 - 14, ay + 444); c.moveTo(ax + cb.w / 2 + 14, ay + 400); c.lineTo(ax + cb.w / 2 + 14, ay + 444); stroke(c, C.bone, 10);
    if (t >= tSays) {
      const a = easeOut((t - tSays) / 0.3);
      txt(c, "HOST:", ax, ay + 540, 22, C.mute, { alpha: a });
      txt(c, typed("HAS NEVER SEEN A WELL.", t, tSays + 0.3, tWell + 0.2 - tSays - 0.3), ax + 90, ay + 540, 30, C.red);
    }
  },

  // step 15: a bot buys nine in the second it takes your thumb to move, then sells you one at triple. That's the racket.
  15(c, K) {
    const t = K.t, tBot = K.at("BOT"), tNine = K.at("NINE"), tMove = K.at("MOVE"), tSells = K.at("SELLS"), tTriple = K.at("TRIPLE"), tRacket = K.at("RACKET");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "FLAGSHIP 24 GB", t0: K.t0 - 0.3, active: t < tSells }, { label: "RESALE - BOT_4471", t0: tSells, active: t >= tSells }], url: t < tSells ? "shop.local/gpu/flagship-24gb" : "resale.local/listing/4471" });
    if (t < tSells) {
      const P = productPage(c, t, cb, { img: K.img("rtx3090"), name: "FLAGSHIP 24 GB", sub: "GRAPHICS CARD", stars: 5 });
      const buys = Array.from({ length: 9 }, (_, i) => tNine + i * 0.1), left = 9 - buys.filter(b => t >= b).length;
      txt(c, "$1,199.99", P.ix, P.y + 220, 90, C.white, { fam: DISPLAY });
      pill(c, P.ix, P.y + 250, left ? `IN STOCK: ${left}` : "SOLD OUT", left ? GREEN : C.red, { size: 22 });
      if (t >= tBot) {                                 // the bot's feed, nine lines in under a second
        const el = clamp(t - tNine, 0, 0.94);
        rr(c, P.ix + 330, P.y + 150, P.iw - 330, 400, 12); fill(c, "#141219"); stroke(c, C.red, 2);
        txt(c, `${el.toFixed(2)} S`, P.ix + 350, P.y + 195, 34, C.red, { fam: DISPLAY });
        buys.forEach((b, i) => { if (t >= b) txt(c, `BOT_4471 BOUGHT 1`, P.ix + 350, P.y + 240 + i * 34, 17, "#ff8a96"); });
      }
      const press = since(t, tMove, 0.12);
      btn(c, P.ix, P.y + 340, 300, 76, t >= tMove ? "SOLD OUT" : "ADD TO CART", { press, color: t >= tMove ? "#4a4654" : C.amber });
      if (t >= tMove) stamp(c, t, tMove, "TOO SLOW", P.ix + 150, P.y + 480, C.red, 60);
      // your cursor: slow, a thumb's time
      cursor(c, t, [[tBot, 1180, 740], [tMove, P.ix + 150, P.y + 378, true]]);
    } else {
      const P = productPage(c, t, cb, { img: K.img("rtx3090"), name: "FLAGSHIP 24 GB (NEW, SEALED)", sub: "SELLER: BOT_4471  (9 FOR SALE)", stars: 5 });
      const k = easeOut((t - tTriple) / 0.3);
      txt(c, "$1,199.99", P.ix, P.y + 200, 40, C.mute); strike(c, P.ix, P.y + 188, 200, C.red, k);
      if (t >= tTriple) { txt(c, "x3", P.ix + 230, P.y + 200, 40, C.red, { fam: DISPLAY }); txt(c, "$3,599.97", P.ix, P.y + 300, 110 * (0.8 + 0.2 * k), C.red, { fam: DISPLAY }); }
      btn(c, P.ix, P.y + 340, 360, 76, "BUY IT NOW", {});
      stamp(c, t, tRacket, "THE RACKET", P.ix + 220, P.y + 470, C.red, 70);
    }
  },

  // step 16: "Just buy last gen," says a man with this gen, on a stream, in a ring light, to a cam.
  16(c, K) {
    const t = K.t, tJust = K.at("JUST"), tThis = K.at("THIS"), tStream = K.at("STREAM"), tRing = K.at("RING"), tCam = K.at("CAM");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "LIVE: JUST BUY LAST GEN", t0: K.t0 - 0.3, active: true }], url: "stream.local/techguy" });
    const vw = cb.w * 0.7, vh = cb.h - 90;
    rr(c, cb.x, cb.y, vw, vh, 12); fill(c, "#08070b");
    // his room: a ring light around a silhouette
    const cx = cb.x + vw / 2, cy = cb.y + vh * 0.45, lit = t >= tRing ? 0.6 + 0.4 * Math.sin((t - tRing) * 30) * Math.exp(-(t - tRing) * 3) + 0.4 : 0.5;
    c.save(); c.globalAlpha = lit; c.beginPath(); c.arc(cx, cy - 20, 200, 0, 7); stroke(c, C.white, 22); c.globalAlpha = lit * 0.3; stroke(c, C.white, 50); c.restore();
    c.beginPath(); c.arc(cx, cy - 30, 70, 0, 7); fill(c, "#1a1820"); c.beginPath(); c.ellipse(cx, cy + 170, 180, 120, 0, Math.PI, 0); fill(c, "#1a1820");
    if (t >= tThis) {                                 // the creator's own card, this gen, on the desk
      const k = easeOutBack((t - tThis) / 0.25);
      c.save(); c.translate(cb.x + vw - 190, cb.y + vh - 90); c.scale(k, k); photo(c, K.img("rtx3090"), -150, -70, 300, 140); c.restore();
      txt(c, "THIS GEN", cb.x + vw - 190, cb.y + vh - 170, 22, C.amber, { align: "center" });
    }
    pill(c, cb.x + 20, cb.y + 20, "LIVE", C.red, { solid: true, size: 20 }); txt(c, "12.4K WATCHING", cb.x + 110, cb.y + 47, 18, C.bone);
    if (t >= tCam) { c.beginPath(); c.arc(cb.x + vw - 40, cb.y + 40, 10, 0, 7); fill(c, Math.floor(t * 4) % 2 ? C.red : "#551018"); txt(c, "REC", cb.x + vw - 60, cb.y + 47, 18, C.red, { align: "right" }); }
    txt(c, typed("\"JUST BUY LAST GEN.\"", t, tJust, K.at("GEN") + 0.2 - tJust), cb.x, cb.y + vh + 56, 44, C.white, { fam: DISPLAY });
    // chat
    const chat = ["W TAKE", "TRUE", "BRO HAS THE FLAGSHIP", "LAST GEN IS ALSO SOLD OUT", "COPE", "RING LIGHT GOING HARD", "SOURCE?", "BUY LAST GEN (I CANT)"];
    const x0 = cb.x + vw + 20, n = Math.floor((t - K.t0) / 0.42) + 3;
    rr(c, x0, cb.y, cb.w - vw - 20, cb.h, 12); fill(c, "#121017"); txt(c, "CHAT", x0 + 18, cb.y + 36, 18, C.mute);
    for (let i = 0; i < Math.min(n, 12); i++) { const j = n - 1 - i, y = cb.y + cb.h - 30 - i * 44; if (y < cb.y + 60) break;
      txt(c, `U${(h32(j, 91) * 900 + 100) | 0}:`, x0 + 18, y, 15, [C.cyan, C.amber, GREEN][j % 3]); txt(c, chat[j % chat.length], x0 + 100, y, 15, C.bone); }
  },

  // step 17: last gen's a used card from a mine that ran hot for two years, and last gen's price went up too. Even the RAM.
  17(c, K) {
    const t = K.t, tUsed = K.at("USED"), tMine = K.at("MINE"), tHot = K.at("HOT"), tYears = K.at("YEARS"), tUp = K.at("UP"), tRam = K.at("RAM");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "USED - LAST GEN", t0: K.t0 - 0.3, active: true }], url: "resale.local/used/last-gen-8gb" });
    const P = productPage(c, t, cb, { img: K.img("gtx1080ti"), name: "LAST GEN 8 GB (USED)", sub: "CONDITION: USED", stars: 2 });
    let px = P.ix, py = P.y + 150;
    [["FROM A MINE", tMine, C.amber], ["RAN HOT: 91 C", tHot, C.red], ["2 YEARS, 24/7", tYears, C.amber]].forEach(([l, tt, col]) => { if (t >= tt) { const w = pill(c, px, py, l, col, { size: 19 }); px += w + 12; } });
    if (t >= tHot) {                                   // the card, still warm: heat shimmer over the photo
      const f = Math.floor(t * 20);
      for (let i = 0; i < 6; i++) { c.globalAlpha = 0.15; c.fillStyle = C.red; c.fillRect(cb.x + 40 + h32(f, i, 1) * 360, cb.y + 60 + h32(f, i, 2) * 480, 80, 3); }
      c.globalAlpha = 1;
    }
    const k = easeOut((t - tUp) / 0.25);
    txt(c, "$380", P.ix, P.y + 290, 100, t >= tUp ? C.mute : C.white, { fam: DISPLAY });
    if (t >= tUp) { strike(c, P.ix, P.y + 250, 190, C.red, k); txt(c, "$520", P.ix + 230, P.y + 290, 100 * (0.7 + 0.3 * k), C.red, { fam: DISPLAY }); upArrow(c, P.ix + 450, P.y + 215, 50, C.red); }
    if (t >= tRam) {                                   // even the RAM
      const a = easeOutBack((t - tRam) / 0.3), rx = P.ix, ry = P.y + 340;
      c.save(); c.translate(rx + 260, ry + 90); c.scale(a, a); c.translate(-260, -90);
      rr(c, 0, 0, 520, 180, 14); fill(c, PANEL); stroke(c, C.red, 2);
      photo(c, K.img("ddr4-16g"), 20, 20, 240, 80); txt(c, "16 GB DDR4 (USED)", 20, 140, 20, C.bone);
      txt(c, "$95", 330, 90, 70, C.red, { fam: DISPLAY }); upArrow(c, 450, 40, 40, C.red); txt(c, "EVEN THE RAM.", 300, 150, 20, C.mute);
      c.restore();
    }
    cursor(c, t, [[tUsed, 900, 720], [tMine, P.ix + 80, P.y + 170], [tUp, P.ix + 300, P.y + 250, true], [tRam, P.ix + 300, P.y + 480]]);
  },

  // step 18: ask when it ends. One store says "twenty-twenty-eight." The other says "past twenty-thirty." Take your pick.
  18(c, K) {
    const t = K.t, tAsk = K.at("ASK"), t28 = K.at("TWENTY"), t30 = K.at("PAST"), tPick = K.at("PICK");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "STORE A - CHAT", t0: K.t0 - 0.3, active: true }, { label: "STORE B - CHAT", t0: K.t0 - 0.2 }], url: "support.local/chat" });
    const msgs = [{ who: "STORE A", text: "Hi! How can we help?", t: K.t0 + 0.5, col: C.cyan }, { who: "STORE B", text: "Hi! How can we help?", t: K.t0 + 0.7, col: C.amber },
      { who: "you", text: "WHEN DOES THE SHORTAGE END?", t: tAsk }, { who: "STORE A", text: "2028.", t: t28, col: C.cyan },
      { who: "STORE B", text: "PAST 2030.", t: t30, col: C.amber }];
    chatLog(c, t, cb, msgs, 0.3);
    if (t >= tPick) {
      const a = easeOutBack((t - tPick) / 0.25), y = cb.y + cb.h - 150;
      [["2028", C.cyan], ["2030+", C.amber]].forEach(([l, col], i) => {
        const x = cb.x + 200 + i * 460; c.save(); c.translate(x + 180, y + 60); c.scale(a, a);
        rr(c, -180, -60, 360, 120, 16); fill(c, PANEL); stroke(c, col, 3); txt(c, l, 0, 22, 70, col, { fam: DISPLAY, align: "center" }); c.restore();
      });
      const hover = Math.sin((t - tPick) * 9) > 0 ? 0 : 1;           // it can't decide
      cursor(c, t, [[tPick, cb.x + 380 + hover * 460, y + 60]]);
    }
  },

  // step 19: this manual was written in twenty-twenty-six, so every number in it is already wrong. Read it quick.
  19(c, K) {
    const t = K.t, tWritten = K.at("WRITTEN"), tSix = K.at("SIX"), tEvery = K.at("EVERY"), tWrong = K.at("WRONG"), tQuick = K.at("READ");
    const cb = chrome(c, t, { tabs: [buildTab, { label: "THE MANUAL (2026).PDF", t0: K.t0 - 0.3, active: true }], url: "file:///downloads/the-manual-2026.pdf" });
    const scroll = t < tQuick ? 0 : Math.pow(t - tQuick, 2) * 2600;         // read it quick: the pages fly
    c.save(); rr(c, cb.x, cb.y, cb.w, cb.h, 8); c.clip();
    const lines2 = ["STEP 01  MAKE A LIST. BUDGET: $1,200", "STEP 02  SAVE $800. $400 TO GO.", "STEP 06  16 GB DDR4: $40 -> $120", "STEP 07  1 TB SSD: $45 -> $90",
      "STEP 12  RESTOCK IN 3, 2, 1", "STEP 15  9 SOLD IN 0.94 S. RESALE x3", "STEP 17  USED CARD: $380 -> $520", "STEP 18  SHORTAGE ENDS 2028 / 2030+"];
    for (let pg = 0; pg < 4; pg++) {
      const py = cb.y + 20 + pg * 700 - scroll;
      if (py > cb.y + cb.h || py < cb.y - 700) continue;
      rr(c, cb.x + 180, py, cb.w - 360, 660, 6); fill(c, "#e9e4d8");
      txt(c, "THE MANUAL", cb.x + 220, py + 70, 50, INK, { fam: DISPLAY });
      if (t >= tWritten) txt(c, "2026 EDITION", cb.x + 520, py + 70, 30, t >= tSix ? C.red : "#4a4654", { fam: DISPLAY });
      lines2.forEach((l, i) => {
        const y = py + 140 + i * 60, wrong = t >= tEvery + i * 0.12;
        const s = wrong ? l.replace(/[0-9]/g, d => "0123456789"[Math.floor(h32(i, d.charCodeAt(0), Math.floor(t * 15)) * 10)]) : l;
        txt(c, s, cb.x + 220, y, 22, wrong ? C.red : INK);
        if (wrong && t >= tWrong) strike(c, cb.x + 216, y - 10, c.measureText(s).width, C.red, easeOut((t - tWrong - i * 0.03) / 0.15));
      });
    }
    c.restore();
    if (t >= tWrong) stamp(c, t, tWrong, "ALREADY WRONG", GW / 2, GH / 2 + 40, C.red, 80);
  },

  // steps 20-24: the sales rep as a voice, an audio-reactive ring (salesRing below)
  20(c, K) { salesRing(c, K); }, 21(c, K) { salesRing(c, K); }, 22(c, K) { salesRing(c, K); }, 23(c, K) { salesRing(c, K); }, 24(c, K) { salesRing(c, K); },

  // step 26: say yes to the cloud. Say yes to the annual plan. Say yes to being billed. You're billed. Billing is available.
  26(c, K) {
    const t = K.t, y1 = K.at("YES"), y2 = K.at("YES", 1), y3 = K.at("YES", 2), tBilled = K.at("BILLED", 1), tAvail = K.at("BILLING");
    const cb = chrome(c, t, { tabs: [{ label: "CHECKOUT - COMPUTE CLOUD", t0: -1, active: true }], url: "cloud.local/checkout" });
    txt(c, "CHECKOUT", cb.x, cb.y + 56, 60, C.white, { fam: DISPLAY });
    const rows = [["YES TO THE CLOUD", y1], ["YES TO THE ANNUAL PLAN", y2], ["YES TO BEING BILLED", y3]];
    rows.forEach(([l, ty], i) => {
      const y = cb.y + 110 + i * 100, on = t >= ty;
      rr(c, cb.x, y, cb.w * 0.55, 80, 12); fill(c, on ? "#1a2a22" : PANEL);
      rr(c, cb.x + 24, y + 20, 40, 40, 8); stroke(c, on ? GREEN : C.mute, 3); if (on) check(c, cb.x + 30, y + 26, 28, GREEN);
      txt(c, l, cb.x + 90, y + 52, 26, on ? C.white : C.bone);
    });
    if (t >= tBilled) {                                // the invoice, already paid
      const k = easeOutBack((t - tBilled) / 0.3), ix = cb.x + cb.w * 0.6, iy = cb.y + 90;
      c.save(); c.translate(ix + 230, iy + 230); c.scale(k, k); c.translate(-230, -230);
      rr(c, 0, 0, 460, 460, 12); fill(c, "#e9e4d8");
      txt(c, "INVOICE #000001", 30, 60, 26, INK); txt(c, "COMPUTE CLOUD, ANNUAL", 30, 110, 20, "#4a4654");
      txt(c, "$1,847.00", 30, 230, 90, INK, { fam: DISPLAY }); txt(c, "/ MONTH, BILLED YEARLY", 30, 270, 20, "#4a4654");
      c.restore();
      stamp(c, t, tBilled + 0.12, "BILLED", ix + 230, iy + 380, C.red, 90, -0.18);
    }
    if (t >= tAvail) { const a = easeOut((t - tAvail) / 0.3); c.globalAlpha = a; rr(c, cb.x, cb.y + cb.h - 90, cb.w * 0.55, 70, 12); fill(c, "#10262a"); stroke(c, C.cyan, 2);
      txt(c, "BILLING IS AVAILABLE.", cb.x + 30, cb.y + cb.h - 44, 28, C.cyan); c.globalAlpha = 1; }
    cursor(c, t, [[K.t0, 700, 720], ...rows.map(([, ty], i) => [ty, cb.x + 44, cb.y + 150 + i * 100, true]), [tBilled, cb.x + 500, cb.y + 520]]);
  },

  // step 27: there is no step twenty-seven. Nothing is available.
  27(c, K) {
    const t = K.t, tNo = K.at("NO"), tNothing = K.at("NOTHING"), tAvail = K.at("AVAILABLE");
    const gone = t < tNothing ? 0 : clamp((t - tNothing) / (tAvail + 0.4 - tNothing));   // the window empties itself
    const cb = chrome(c, t, { tabs: gone < 0.3 ? [{ label: "STEP 27", t0: -1, active: true }] : [], url: gone < 0.6 ? "manual.local/step-27" : "", spin: t < tNo ? t * 8 : 0 });
    if (t < tNo) spinner(c, GW / 2, GH / 2, 40, t, C.cyan);
    else {
      txt(c, "404", GW / 2, cb.y + 260, 200, C.white, { fam: DISPLAY, align: "center", alpha: 1 - gone });
      txt(c, typed("THERE IS NO STEP 27.", t, tNo, 0.8), GW / 2, cb.y + 340, 34, C.bone, { align: "center", alpha: 1 - gone });
      if (t >= tNothing) txt(c, "NOTHING IS AVAILABLE.", GW / 2, cb.y + 460, 48, C.red, { fam: DISPLAY, align: "center" });
    }
  },
};

// steps 4 and 5 share one product page: refresh, it's in stock, on sale ... blink, and a building bought them
function shopPage(c, K, n) {
  const t = K.t, at = (w, o = 0) => K.at(w, o, 4), at5 = (w, o = 0) => K.at(w, o, 5);
  const tRef = at("REFRESH"), tTue = at("TUESDAY"), tStock = at("STOCK"), tSale = at("SALE"), tDont = at("DON'T"), tBlink = at("BLINK");
  const tBlink5 = at5("BLINK"), tBought = at5("BOUGHT"), tForty = at5("FORTY"), tThink = at5("THINK"), tThinks = at5("THINKS"), tThat = at5("THAT");
  const refreshes = [tRef - 0.4, tRef, at("PAGE"), tTue - 0.05, tStock - 0.15];
  const lastRef = refreshes.filter(r => t >= r).pop(), loading = lastRef !== undefined && t - lastRef < 0.14;
  const cb = chrome(c, t, { tabs: [buildTab, { label: "FLAGSHIP 24 GB", t0: -1, active: true }], url: "shop.local/gpu/flagship-24gb",
    spin: loading ? (t - lastRef) * 40 : 0, clock: t >= tTue ? "TUE 10:02 AM" : "" });
  const inStock = t >= tStock && t < tBlink5, sold = t >= tBlink5;
  if (loading) { spinner(c, cb.x + cb.w / 2, cb.y + cb.h / 2, 36, t, C.cyan); return cursor(c, t, [[refreshes[0] - 0.2, 180, 170], [refreshes[0], 110, 89, true], ...refreshes.slice(1).map(r => [r, 110, 89, true])]); }
  const P = productPage(c, t, cb, { img: K.img("rtx3090"), name: "FLAGSHIP 24 GB", sub: "GRAPHICS CARD", stars: 5 });
  // the price: on sale
  const onSale = t >= tSale;
  txt(c, "$1,499.99", P.ix, P.y + (onSale ? 180 : 220), onSale ? 40 : 90, onSale ? C.mute : C.white, { fam: DISPLAY });
  if (onSale) {
    strike(c, P.ix, P.y + 168, 170, C.red, easeOut((t - tSale) / 0.12));
    const k = easeOutBack((t - tSale) / 0.2);
    c.save(); c.translate(P.ix, P.y + 262); c.scale(k, k); txt(c, "$1,199.99", 0, 0, 90, C.red, { fam: DISPLAY }); c.restore();
    pill(c, P.ix + 200, P.y + 145, "-20%", C.red, { solid: true, size: 22 });
  }
  pill(c, P.ix, P.y + 290, sold ? "SOLD OUT" : inStock ? "IN STOCK - 3 LEFT" : "OUT OF STOCK", sold ? C.red : inStock ? GREEN : C.red, { size: 22 });
  const hot = t >= tDont && !sold ? 0.5 + 0.5 * Math.sin(t * 20) : 0;
  btn(c, P.ix, P.y + 360, 420, 84, sold ? "SOLD OUT" : inStock ? "ADD TO CART" : "NOTIFY ME", { ghost: !inStock && !sold, color: sold ? "#4a4654" : C.amber, glow: hot, size: 28 });
  if (t >= tDont && !sold) txt(c, `SALE ENDS IN 00:00:0${Math.max(0, 3 - Math.floor((t - tDont) * 2))}`, P.ix, P.y + 490, 24, C.amber);
  // blink: a black frame, and it's gone
  if (sold) {
    stamp(c, t, tBlink5 + 0.07, "SOLD OUT", P.ix + 210, P.y + 400, C.red, 90);
    if (t >= tBought) {                                  // who bought them: the order log
      const a = easeOut((t - tBought) / 0.25), lx = cb.x + 20, ly = cb.y + 20, lw = cb.w * 0.42 - 40;
      c.globalAlpha = a; rr(c, lx, ly, lw, cb.h - 48, 12); fill(c, "rgba(20,18,25,0.97)"); stroke(c, C.red, 2); c.globalAlpha = 1;
      txt(c, "ORDERS", lx + 20, ly + 40, 22, C.mute);
      const n2 = t < tForty ? 1 : 1 + Math.floor((t - tForty) / 0.09), stock = t < tForty ? 40000 : Math.max(0, 40000 - Math.round(40000 * easeOut((t - tForty) / 0.9)));
      for (let i = 0; i < Math.min(n2, 12); i++) txt(c, `#${88213 + n2 - i}  QTY 40,000  BUYER: A BUILDING`, lx + 20, ly + 90 + i * 34, 16, i ? "#b9b4c4" : C.white);
      txt(c, `WAREHOUSE: ${stock.toLocaleString("en-US")}`, lx + 20, ly + cb.h - 80, 26, stock ? C.amber : C.red);
    }
    if (t >= tThink) {                                   // what a building does with forty thousand cards: it thinks
      const a = easeOut((t - tThink) / 0.35), wx = cb.x + cb.w * 0.2, wy = cb.y + 40;
      c.globalAlpha = a * 0.96; rr(c, wx, wy, cb.w * 0.6, cb.h - 80, 18); fill(c, "#0f0e14"); stroke(c, C.cyan, 2); c.globalAlpha = 1;
      const bw = 170, bh = 380, bx = wx + 60, by = wy + cb.h - 80 - bh - 40;
      rr(c, bx, by, bw, bh, 6); fill(c, "#1a1820");
      const lit = t >= tThinks ? 0.9 : 0.35;
      for (let r = 0; r < 16; r++) for (let q = 0; q < 5; q++) if (h32(r, q, Math.floor(t * 8)) < lit) { c.fillStyle = C.red; c.fillRect(bx + 16 + q * 30, by + 16 + r * 22, 16, 10); }
      const tx = bx + bw + 50, dots = ".".repeat(1 + Math.floor(t * 4) % 3);
      txt(c, (t >= tThinks ? "IT THINKS" : "THINKING") + dots, tx, wy + 120, 48, C.white, { fam: DISPLAY });
      const sh = ((t * 0.7) % 1) * 400;                // the shimmer on a model that's "thinking"
      c.save(); c.beginPath(); c.rect(tx, wy + 140, 380, 16); c.clip(); c.fillStyle = "#26222e"; c.fillRect(tx, wy + 140, 380, 16); c.fillStyle = C.cyan; c.globalAlpha = 0.7; c.fillRect(tx + sh - 80, wy + 140, 80, 16); c.restore(); c.globalAlpha = 1;
      txt(c, "40,000 CARDS", tx, wy + 230, 30, C.amber);
      if (t >= tThat) txt(c, typed("A BUILDING THAT THINKS.", t, tThat - 0.9, 1.0), tx, wy + 300, 28, C.cyan);
    }
    if (t < tBlink5 + 0.07) { c.fillStyle = "#000"; c.fillRect(0, 0, GW, GH); }
  }
  cursor(c, t, [[refreshes[0] - 0.2, 180, 170], ...refreshes.map(r => [r, 110, 89, true]), [tDont, P.ix + 180, P.y + 470], [tBlink, P.ix + 200, P.y + 402]]);
}

// a chat log: bubbles in order, each vendor line preceded by typing dots; the log scrolls to keep the newest in view
function chatLog(c, t, cb, msgs, typingLead) {
  const shown = msgs.filter(m => t >= m.t - (m.who === "you" ? 0 : typingLead));
  const bh = [];
  let y = 0;
  c.font = font(24, MONO, "600");
  shown.forEach(() => { bh.push(64); y += 64 + 18; });                   // one line per bubble: the longest line fits at 24 px
  const off = Math.max(0, y - (cb.h - 40)), last = shown.length - 1;
  c.save(); rr(c, cb.x, cb.y, cb.w, cb.h, 8); c.clip();
  let yy = cb.y + 20 - off;
  shown.forEach((m, i) => {
    const you = m.who === "you", h = bh[i], typing = !you && t < m.t, k = easeOutBack((t - (m.t - (you ? 0 : typingLead))) / 0.2);
    c.font = font(24, MONO, "600");
    const w = typing ? 110 : Math.min(cb.w - 110, c.measureText(m.text).width + 56), x = you ? cb.x + cb.w - w - 10 : cb.x + 90;
    c.save(); c.translate(x + (you ? w : 0), yy + h / 2); c.scale(k, k); c.translate(-(x + (you ? w : 0)), -(yy + h / 2));
    rr(c, x, yy, w, h, 18); fill(c, you ? "#2b2734" : "#121a1f"); if (!you) stroke(c, m.col ?? C.cyan, 2);
    if (typing) for (let d = 0; d < 3; d++) { c.beginPath(); c.arc(x + 32 + d * 24, yy + h / 2 + Math.sin(t * 14 + d) * 4, 6, 0, 7); fill(c, m.col ?? C.cyan); }
    else if (you) txt(c, m.text, x + 28, yy + 42, 24, C.bone);
    else drawDecoded(c, m.text, decode(m.text, t, m.t, 0.25 + m.text.length * 0.012, 60 + i), x + 28, yy + 42, { color: C.white, scramble: m.col ?? C.cyan });
    c.restore();
    if (!you) { c.beginPath(); c.arc(cb.x + 40, yy + 30, 24, 0, 7); fill(c, m.col ?? C.cyan); txt(c, (m.who[0] === "S" && m.who.length > 1 ? m.who.slice(-1) : "AI"), cb.x + 40, yy + 38, 18, INK, { align: "center" }); }
    yy += h + 18;
  });
  c.restore();
  return last;
}

// steps 20-24 (the creator's note, 9/26): no window. The sales rep is a voice: an audio-reactive ring of colour lines that
// listens (a thin pale line, barely moving) while you talk and blooms, every line its own colour, while the rep
// talks. Its lines swell with the lead vocal (each one a few ms behind the last, so they ripple rather than move
// together); every rep sentence sends a ring out in its own colour; the kick pumps it.
export const RING = ["#5ef2ff", "#ff3d8b", "#ffb21e", "#3dff9a", "#9d7bff", "#f4f1ea"];
function salesRing(c, K) {
  const t = K.t, msgs = salesLines(K), rep = msgs.filter(m => m.who !== "you");
  // the rep's turns: from its first sentence to the end of that step's line (a turn per step)
  const turns = [20, 21, 22, 23, 24].map(n => ({ t0: rep.find(m => m.n === n).t, t1: K.last(n) }));
  const turn = turns.filter(u => t >= u.t0 - 0.1).pop();
  const s = turn ? Math.min(ease((t - turn.t0 + 0.1) / 0.18), 1 - ease((t - turn.t1) / 0.4)) : 0;   // 0 listening .. 1 speaking
  const born = ease((t - K.at("STEP", 0, 20) + 0.3) / 0.6);            // the ring opens from a point when the verse starts
  const cx = GW / 2, cy = 330, R = (170 + 70 * s) * born * (1 + AUD.kick * 0.05);
  // a dark disc behind it: the ring is an object in front of the chapter's ghost card, not a tint on it
  const bg = c.createRadialGradient(cx, cy, 0, cx, cy, 330);
  bg.addColorStop(0, `rgba(8,7,11,${0.97 * born})`); bg.addColorStop(0.7, `rgba(8,7,11,${0.9 * born})`); bg.addColorStop(1, "rgba(8,7,11,0)");
  c.fillStyle = bg; c.fillRect(cx - 330, cy - 330, 660, 660);
  // the glow at its heart, only while the rep talks
  const v = K.env("lead", t);
  if (s > 0.01) {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
    g.addColorStop(0, `rgba(94,242,255,${0.16 * s * (0.4 + v)})`); g.addColorStop(0.6, `rgba(157,123,255,${0.08 * s * (0.4 + v)})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  }
  c.globalCompositeOperation = "lighter";
  // the sentence rings: out from the ring on each rep sentence, in that sentence's colour
  rep.forEach((m, i) => {
    const dt = t - m.t; if (dt < 0 || dt > 1.2) return;
    c.globalAlpha = 0.7 * (1 - dt / 1.2); c.beginPath(); c.arc(cx, cy, R + 20 + dt * 260, 0, 7); stroke(c, RING[i % RING.length], 3 + 5 * (1 - dt));
  });
  c.globalAlpha = 1;
  const N = 200;
  RING.forEach((col, j) => {
    const vj = Math.pow(K.env("lead", t - j * 0.035), 1.2), amp = (6 + 72 * s) * vj * born + 3 * born;
    const rj = R + (j - 2.5) * lerp(1.2, 10, s), sp = 0.6 + j * 0.23;
    const p1 = t * sp * 2.1 + j * 1.7, p2 = t * sp * 1.3 + j * 2.9, p3 = t * sp * 3.7 + j * 0.8;
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const th = i / N * Math.PI * 2;
      const r = rj + amp * (0.55 * Math.sin(3 * th + p1) + 0.3 * Math.sin(5 * th - p2) + 0.15 * Math.sin(9 * th + p3));
      const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    const hue = lerp(0.25, 1, s);                         // listening: the lines go pale and thin
    c.globalAlpha = 0.16 * hue * born; stroke(c, s > 0.5 ? col : C.bone, 12);
    c.globalAlpha = (0.35 + 0.6 * hue) * born; stroke(c, s > 0.15 ? col : C.bone, lerp(1.5, 3, s));
  });
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  // who is who, and what the rep just said (its sentence decodes in under the ring)
  if (born > 0.5) {
    const a = ease((born - 0.5) * 2);
    txt(c, "SALES AGENT - COMPUTE CLOUD", cx, 660, 24, C.mute, { align: "center", alpha: a });
    const dots = ".".repeat(1 + Math.floor(t * 3) % 3);
    txt(c, (s > 0.5 ? "SPEAKING" : "LISTENING") + dots, cx, 700, 28, s > 0.5 ? C.cyan : C.bone, { align: "center", alpha: a });
    const said = rep.filter(m => t >= m.t).pop();
    if (said && turn && t < turn.t1 + 0.8) {
      c.font = font(36, MONO, "600");
      drawDecoded(c, said.text, decode(said.text, t, said.t, 0.2 + said.text.length * 0.012, 90 + rep.indexOf(said)), cx, 762,
        { color: C.white, scramble: RING[rep.indexOf(said) % RING.length], align: "center" });
    }
  }
}

// the sales chat's lines (the rep's are the song's quotes), with the times they're sung
function salesLines(K) {
  const at = (n, w, o = 0) => K.at(w, o, n);
  return [
    { n: 20, who: "you", text: "ONE CARD, PLEASE.", t: at(20, "ASK") },
    { n: 20, who: "S", text: "Ask for a quote.", t: at(20, "ASK", 1) }, { n: 20, who: "S", text: "Quotes are available.", t: at(20, "QUOTES") },
    { n: 21, who: "you", text: "ONE CARD. ONE PERSON.", t: at(21, "SAY") },
    { n: 21, who: "S", text: "Minimum order: 500.", t: at(21, "MINIMUM") }, { n: 21, who: "S", text: "Business accounts are available.", t: at(21, "BUSINESS") },
    { n: 22, who: "you", text: "$800?", t: at(22, "OFFER") },
    { n: 22, who: "S", text: "That's a month of the cloud.", t: at(22, "THAT'S") }, { n: 22, who: "S", text: "Hourly is available.", t: at(22, "HOURLY") },
    { n: 23, who: "you", text: "I WANTED TO BUILD IT.", t: at(23, "SAY") },
    { n: 23, who: "S", text: "Profiles are available.", t: at(23, "PROFILES") }, { n: 23, who: "S", text: "Workflows are available.", t: at(23, "WORKFLOWS") },
    { n: 23, who: "S", text: "The browser is available.", t: at(23, "BROWSER") - 0.1 },
    { n: 24, who: "you", text: "WHERE IS THE CARD?", t: at(24, "ASK") },
    { n: 24, who: "S", text: "In a building, in a state with cheap water, at scale.", t: at(24, "IN") }, { n: 24, who: "S", text: "Scale is available.", t: at(24, "SCALE", 1) },
  ];
}

// ---------- the stock chart behind verse 2 (the creator's note, 9/26) ----------
// a candle per beat; mixed at first, then more green, then vertical from step 14 on and still climbing.
// P: { t0 (the chart's first live candle), beat, phases: [{ t, mu, sig }] } (a phase holds from its t on)
let SERIES = null;
function series(P) {
  if (SERIES && SERIES.key === P.t0) return SERIES;
  const N = Math.ceil(60 / P.beat) + 1, H = 40, out = [];
  let p = 100;
  for (let i = -H; i < N; i++) {
    const tt = P.t0 + i * P.beat, ph = P.phases.filter(q => tt >= q.t).pop() ?? P.phases[0];
    const mu = typeof ph.mu === "function" ? ph.mu(tt) : ph.mu;
    const z = (h32(i + 999, 1) + h32(i + 999, 2) + h32(i + 999, 3) - 1.5) * 1.4;
    const o = p, cl = o * Math.exp(mu + ph.sig * z);
    const hi = Math.max(o, cl) * Math.exp(Math.abs(ph.sig) * h32(i + 999, 4) * 0.8), lo = Math.min(o, cl) * Math.exp(-Math.abs(ph.sig) * h32(i + 999, 5) * 0.8);
    out.push({ o, c: cl, h: hi, l: lo, v: Math.abs(Math.log(cl / o)) + h32(i + 999, 6) * 0.01 });
    p = cl;
  }
  SERIES = { key: P.t0, H, out };
  return SERIES;
}
export function drawCandles(c, t, P, W, Hc, k) {
  const S = series(P), f = (t - P.t0) / P.beat, cur = Math.floor(f), fr = f - cur, VIS = 38;
  const get = i => S.out[i + S.H];
  const cw = W / (VIS + 2), x0 = W - cw * 1.5 - fr * cw;         // the chart scrolls left a candle per beat
  const live = i => {                                              // the newest candle forms while its beat runs
    const q = get(i); if (i < cur) return q;
    const u = ease(fr), cl = lerp(q.o, q.c, u) * (1 + (h32(i, Math.floor(t * 12)) - 0.5) * 0.004);
    return { o: q.o, c: cl, h: Math.max(q.o, cl, lerp(q.o, q.h, u)), l: Math.min(q.o, cl, lerp(q.o, q.l, u)), v: q.v * u };
  };
  const vis = []; for (let j = VIS; j >= 0; j--) { const i = cur - j; if (i >= -S.H + 1 && get(i)) vis.push([i, live(i)]); }
  let lo = Infinity, hi = -Infinity; vis.forEach(([, q]) => { lo = Math.min(lo, q.l); hi = Math.max(hi, q.h); });
  const pad = (hi - lo) * 0.08, top = 150, bot = Hc - 150, Y = v => bot - (v - lo + pad) / (hi - lo + 2 * pad) * (bot - top);
  // grid + price scale
  for (let g = 0; g <= 4; g++) {
    const v = lo - pad + (hi - lo + 2 * pad) * g / 4, y = Y(v);
    c.fillStyle = "rgba(233,228,216,0.08)"; c.fillRect(0, y, W - 150, 2);
    txt(c, v.toFixed(v < 1000 ? 2 : 0), W - 20, y + 8, 26, "rgba(233,228,216,0.45)", { align: "right" });
  }
  vis.forEach(([i, q]) => {
    const x = x0 - (cur - i) * cw, up = q.c >= q.o, col = up ? GREEN : C.red, newest = i === cur;
    c.fillStyle = col; c.globalAlpha = newest ? 1 : 0.85;
    c.fillRect(x - 2, Y(q.h), 4, Math.max(2, Y(q.l) - Y(q.h)));
    const yb = Y(Math.max(q.o, q.c)), hb = Math.max(3, Math.abs(Y(q.o) - Y(q.c)));
    c.fillRect(x - cw * 0.34, yb, cw * 0.68, hb);
    if (newest && k > 0) { c.globalAlpha = k * 0.5; c.fillRect(x - cw * 0.5, yb - 6, cw, hb + 12); }
    c.globalAlpha = 0.35; c.fillRect(x - cw * 0.34, Hc - 20 - Math.min(110, q.v * 1400), cw * 0.68, Math.min(110, q.v * 1400));   // volume
    c.globalAlpha = 1;
  });
  const last = vis[vis.length - 1][1], first = get(0), pct = (last.c / first.o - 1) * 100, ly = Y(last.c);
  c.setLineDash([14, 10]); c.beginPath(); c.moveTo(0, ly); c.lineTo(W - 150, ly); stroke(c, pct >= 0 ? GREEN : C.red, 2); c.setLineDash([]);
  rr(c, W - 148, ly - 22, 140, 44, 6); fill(c, pct >= 0 ? GREEN : C.red); txt(c, last.c.toFixed(last.c < 1000 ? 2 : 0), W - 78, ly + 10, 24, INK, { align: "center" });
  // the running gain, riding under the price tag (the eye is on the newest candle anyway)
  const gy = clamp(ly + 90, top + 60, bot), label = `${pct >= 0 ? "+" : ""}${pct.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
  c.font = font(64, DISPLAY); const gw = c.measureText(label).width;
  tri(c, W - 170 - gw - 50, gy - 46, 34, pct >= 0 ? GREEN : C.red, pct >= 0);
  txt(c, label, W - 170, gy, 64, pct >= 0 ? GREEN : C.red, { fam: DISPLAY, align: "right" });
}
