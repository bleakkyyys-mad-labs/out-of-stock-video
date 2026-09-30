// The chorus's drawing: the buildings (the creator's brainstorm, 9/29; chorus.js directs it, this draws it).
//
// The creator's words: the "weird city skyline" goes, "maybe diagrams of buildings, front facing view or whatever"; the chorus
// "start as blue and white, utopian, the buildings or whatever being drawn, then it goes the red when it switches to
// Compute for us"; and the drawing grows across the three choruses ("I want to see it actually"). So each chorus
// draws a data-center site the way a draughtsman would -- the ground line, the hall, its panels and louvers and doors,
// the cooling on the roof, the generators, the substation, the water tower, the power line marching off to the
// horizon -- one stroke group on each sung syllable of the questions. After "COMPUTE" it is the same site in red on
// the night, the windows lit on the kick, the storm flying into them. Chorus 1 is one hall, chorus 2 a campus,
// chorus 3 the grid to the horizon.
//
// Drawn on a 2D canvas through the drop's OWN camera (the three.js camera the storm and the AltMan are rendered with,
// read back after every move the shot makes, the crash zoom included): a hairline stays a hairline at any depth, the
// canvas stays on the CPU raster path captures need (lesson L80), and the cards fly into windows that are exactly
// where the canvas drew them. A pure function of t, like every shot in this film.
import * as song from "./song.js";
import { outline as otext, measure } from "./outline.js";
import { W, H } from "./frame.js";

const { h32 } = song;
const NEAR = 0.4;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const win = (t, t0, dur) => clamp((t - t0) / dur);
const mix3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const since = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

// ---------- the two inks ----------
export const BLUE = {
  bg0: "#2459a3", bg1: "#10346b",                    // the cyanotype: lighter in the middle, darker at the edges
  ink: "#f4f8ff", hair: "rgba(244,248,255,0.74)", dim: "rgba(244,248,255,0.4)", faint: "rgba(244,248,255,0.15)",
  face: "#1e4f95", top: "#2b64b0", side: "#173f7c", hatch: "rgba(244,248,255,0.34)", red: false,
};
export const RED = {
  ink: "#ff2a3d", hair: "rgba(255,42,61,0.62)", dim: "rgba(255,42,61,0.3)", faint: "rgba(255,42,61,0.11)",
  face: "#0d0407", top: "#170609", side: "#080305", hatch: "rgba(255,42,61,0.22)", lit: "#ff2a3d", hot: "#ffd6db", red: true,
};

// ---------- the camera, read back from three.js ----------
// V.cam(p) -> camera space [right, up, depth]; V.px(q) -> the pixel. The same construction as three's lookAt and
// perspective projection (square pixels, vertical fov), so a point drawn here and a mesh placed there coincide.
export function viewOf(cam) {
  cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements;
  const r = [e[0], e[1], e[2]], u = [e[4], e[5], e[6]], f = [-e[8], -e[9], -e[10]], eye = [e[12], e[13], e[14]];
  const k = (H / 2) / Math.tan(cam.fov * Math.PI / 360);
  const V = {
    eye, f, r, u, k,
    cam: p => { const a = p[0] - eye[0], b = p[1] - eye[1], d = p[2] - eye[2]; return [a * r[0] + b * r[1] + d * r[2], a * u[0] + b * u[1] + d * u[2], a * f[0] + b * f[1] + d * f[2]]; },
    px: q => ({ x: W / 2 + q[0] * k / q[2], y: H / 2 - q[1] * k / q[2], z: q[2], s: k / q[2] }),
    at: p => { const q = V.cam(p); return q[2] > NEAR ? V.px(q) : null; },
  };
  return V;
}
const cut = (a, b) => { const s = (a[2] - NEAR) / (a[2] - b[2]); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, NEAR]; };
// a straight 3D segment added to the current path, clipped at the near plane
function seg(c, V, a, b) {
  let qa = V.cam(a), qb = V.cam(b);
  const ia = qa[2] > NEAR, ib = qb[2] > NEAR;
  if (!ia && !ib) return;
  if (!ia) qa = cut(qb, qa); else if (!ib) qb = cut(qa, qb);
  const pa = V.px(qa), pb = V.px(qb);
  c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y);
}
const segU = (c, V, a, b, u) => { if (u > 0) seg(c, V, a, u >= 1 ? b : mix3(a, b, u)); };
// the first u of a polyline, by length
function polyU(c, V, pts, u) {
  if (u <= 0 || pts.length < 2) return;
  let total = 0; const L = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); L.push(d); total += d; }
  let left = total * clamp(u);
  for (let i = 1; i < pts.length && left > 1e-9; i++) {
    const d = L[i - 1];
    if (left >= d) { seg(c, V, pts[i - 1], pts[i]); left -= d; } else { seg(c, V, pts[i - 1], mix3(pts[i - 1], pts[i], left / d)); left = 0; }
  }
}
// a polygon's path (clipped at the near plane); false when nothing of it is in front of the camera
function face(c, V, pts) {
  const q = pts.map(p => V.cam(p)), out = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length], ai = a[2] > NEAR, bi = b[2] > NEAR;
    if (ai) out.push(a);
    if (ai !== bi) out.push(ai ? cut(a, b) : cut(b, a));
  }
  if (out.length < 3) return false;
  c.beginPath();
  out.forEach((qq, i) => { const p = V.px(qq); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
  c.closePath();
  return true;
}
// a line weight that follows depth: the near hall is drawn with a heavier pen than the grid on the horizon. LWK is the
// kick's pump on the whole drawing (set once per frame by drawSite, from that frame's kick; pure in t)
let LWK = 1;
const lwAt = (V, p, base = 2.2) => { const q = V.cam(p); return clamp(base * 44 / Math.max(q[2], 2), 0.55, 2.9) * LWK; };
const pxWidth = (V, a, b) => { const pa = V.at(a), pb = V.at(b); return pa && pb ? Math.abs(pb.x - pa.x) : 0; };

// the mono small print, as outlines (lesson L80: canvas text is not bit-exact across a canvas's history)
function mono(c, s, x, y, size, col, align = "left", track = 0.06) {
  otext(c, s, x, y, size, { fam: "mono", align, tracking: track, color: col });
}

// =====================================================================================================================
// the pieces
// =====================================================================================================================
// A box, drawn in the order a draughtsman draws one. b = {x0, x1, y0, y1, z0 (front), z1 (back)}. uO: the front
// outline (base, then the verticals, then the roof edge); uD: the edges running back; uF: the faces filled, which is
// what hides whatever stands behind it. o.roof runs after the roof is filled and before the walls, so the cooling
// units stand ON the roof: seen from above they sit on it, seen from below the parapet hides their feet.
function box(c, V, P, b, uO, uD, uF, lw, o = {}) {
  const e = V.eye;
  const A = [b.x0, b.y0, b.z0], B = [b.x1, b.y0, b.z0], Cc = [b.x1, b.y1, b.z0], D = [b.x0, b.y1, b.z0];
  const A2 = [b.x0, b.y0, b.z1], B2 = [b.x1, b.y0, b.z1], C2 = [b.x1, b.y1, b.z1], D2 = [b.x0, b.y1, b.z1];
  const top = e[1] > b.y1, left = e[0] < b.x0, right = e[0] > b.x1, ink = o.ink ?? P.ink;
  if (top && uF > 0) { c.globalAlpha = uF; c.fillStyle = P.top; if (face(c, V, [D, Cc, C2, D2])) c.fill(); c.globalAlpha = 1; }
  if (top && uD > 0) { c.strokeStyle = ink; c.lineWidth = lw * 0.8; c.beginPath(); segU(c, V, D2, C2, clamp((uD - 0.5) / 0.5)); c.stroke(); }
  o.roof?.();
  if (uF > 0) {
    c.globalAlpha = uF;
    if (left) { c.fillStyle = P.side; if (face(c, V, [A, D, D2, A2])) c.fill(); }
    if (right) { c.fillStyle = P.side; if (face(c, V, [B, Cc, C2, B2])) c.fill(); }
    c.fillStyle = o.front ?? P.face; if (face(c, V, [A, B, Cc, D])) c.fill();
    c.globalAlpha = 1;
  }
  if (uO > 0) {
    c.strokeStyle = ink; c.lineWidth = lw; c.beginPath();
    segU(c, V, A, B, clamp(uO / 0.35));
    const uv = clamp((uO - 0.25) / 0.35);
    segU(c, V, A, D, uv); segU(c, V, B, Cc, uv);
    segU(c, V, D, Cc, clamp((uO - 0.55) / 0.45));
    if (uD > 0) {
      const back = clamp((uD - 0.5) / 0.5);
      if (top) { segU(c, V, D, D2, uD); segU(c, V, Cc, C2, uD); }
      if (left) { segU(c, V, A, A2, uD); if (!top) segU(c, V, D, D2, uD); segU(c, V, A2, D2, back); }
      if (right) { segU(c, V, B, B2, uD); if (!top) segU(c, V, Cc, C2, uD); segU(c, V, B2, C2, back); }
    }
    c.stroke();
  }
  return { A, B, Cc, D, top, left, right };
}

// a hall: the box, its roof units, and the front's details (panels, the louver band, the doors, the windows)
function hall(c, V, P, h, t, mode) {
  const b = h.b, on = h.on, red = mode.red;
  const uO = red ? 1 : win(t, on.outline, on.outlineDur ?? 0.36);
  if (uO <= 0) return;
  const uD = red ? 1 : win(t, on.depth, 0.26), uF = red ? 1 : win(t, on.depth + 0.14, 0.22);
  const mid = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z0], lw = lwAt(V, mid, h.hero ? 2.6 : 2.1);
  const pw = pxWidth(V, [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0]);
  // the draughtsman's construction lines: faint rules run past the corners while the hall is being drawn
  if (h.hero && !red) {
    const cl = win(t, on.outline, 0.2) * (1 - win(t, on.depth + 0.35, 0.5));
    if (cl > 0.01) {
      const ext = (b.x1 - b.x0) * 0.22;
      c.save(); c.globalAlpha = cl; c.strokeStyle = P.faint; c.lineWidth = 1; c.setLineDash([10, 7]); c.beginPath();
      for (const y of [b.y0, b.y1]) seg(c, V, [b.x0 - ext, y, b.z0], [b.x1 + ext, y, b.z0]);
      for (const x of [b.x0, b.x1]) seg(c, V, [x, b.y0 - 3, b.z0], [x, b.y1 + 6, b.z0]);
      c.stroke(); c.restore();
    }
  }
  const roof = () => { for (const u of h.units ?? []) unit(c, V, P, u, t, mode, pw); };
  box(c, V, P, b, uO, uD, uF, lw, { roof });
  if (pw < 36) return;
  const hg = b.y1 - b.y0, z = b.z0, yBand = b.y1 - hg * 0.17;
  // panels: the cladding's joints, a sweep from left to right
  if (h.panels && pw > 170) {
    const u = red ? 1 : win(t, on.panels, 0.36);
    if (u > 0) {
      const n = h.panels;
      c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.45); c.beginPath();
      for (let i = 1; i < n; i++) { const ui = clamp(u * n - (i - 1)); if (ui <= 0) break; const x = lerp(b.x0, b.x1, i / n); segU(c, V, [x, b.y0, z], [x, yBand, z], ui); }
      c.stroke();
    }
  }
  // the louver band under the roof edge
  if (pw > 90) {
    const u = red ? 1 : win(t, on.louvers, 0.3);
    if (u > 0) {
      c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.45); c.beginPath();
      const n = pw > 400 ? 6 : 3;
      for (let j = 0; j <= n; j++) { const y = lerp(yBand, b.y1 - hg * 0.035, j / n); segU(c, V, [b.x0, y, z], [lerp(b.x0, b.x1, u), y, z], 1); }
      c.stroke();
    }
  }
  // doors: [centre x, width, height], each drawn up one side, across and down
  if (h.doors && pw > 200) {
    const u = red ? 1 : win(t, on.doors, 0.34);
    if (u > 0) {
      c.strokeStyle = P.ink; c.lineWidth = Math.max(0.7, lw * 0.7); c.beginPath();
      h.doors.forEach(([x, w, dh], i) => {
        const ui = clamp(u * h.doors.length - i);
        const p0 = [x - w / 2, b.y0, z], p1 = [x - w / 2, b.y0 + dh, z], p2 = [x + w / 2, b.y0 + dh, z], p3 = [x + w / 2, b.y0, z];
        polyU(c, V, [p0, p1, p2, p3], ui);
        if (ui >= 1) for (let s = 1; s < 5; s++) seg(c, V, [x - w / 2, b.y0 + dh * s / 5, z], [x + w / 2, b.y0 + dh * s / 5, z]);   // roller shutter
      });
      c.stroke();
    }
  }
  // the windows: the server rooms' lights. Blue: outlined, column by column. Red: lit, on the kick
  if (h.cells && pw > 60) {
    const u = red ? 1 : win(t, on.cells, 0.4);
    if (u > 0) {
      const cs = h.cells, n = cs.length, cols = h.cellCols;
      if (red) {
        for (const q of cs) {
          const v = mode.lit(q, t);
          if (v <= 0.01) continue;
          c.globalAlpha = Math.min(1, v); c.fillStyle = v > 1 ? P.hot : P.lit;
          if (face(c, V, [[q.x0, q.y0, z], [q.x1, q.y0, z], [q.x1, q.y1, z], [q.x0, q.y1, z]])) c.fill();
        }
        c.globalAlpha = 1;
      }
      c.strokeStyle = red ? P.dim : P.dim; c.lineWidth = 0.9; c.beginPath();
      for (let i = 0; i < n; i++) {
        const q = cs[i];
        if (!red && (q.col + 1) / cols > u) continue;
        seg(c, V, [q.x0, q.y0, z], [q.x1, q.y0, z]); seg(c, V, [q.x1, q.y0, z], [q.x1, q.y1, z]);
        seg(c, V, [q.x1, q.y1, z], [q.x0, q.y1, z]); seg(c, V, [q.x0, q.y1, z], [q.x0, q.y0, z]);
      }
      c.stroke();
    }
  }
  // the parapet: a second line just under the roof edge
  if (pw > 120) {
    const u = red ? 1 : win(t, on.parapet, 0.26);
    if (u > 0) { c.strokeStyle = P.ink; c.lineWidth = Math.max(0.6, lw * 0.6); c.beginPath(); segU(c, V, [b.x0, b.y1 - hg * 0.035, z], [b.x1, b.y1 - hg * 0.035, z], u); c.stroke(); }
  }
}
// a cooling unit on the roof: a small box, its fans on top (seen only from above the roof)
function unit(c, V, P, u, t, mode, parentPw) {
  const uu = mode.red ? 1 : win(t, u.on, 0.2);
  if (uu <= 0 || parentPw < 110) return;
  const b = u.b, lw = lwAt(V, [b.x0, b.y1, b.z0], 1.5);
  const r = box(c, V, P, b, uu, uu, mode.red ? 1 : win(t, u.on + 0.12, 0.15), lw);
  const uf = mode.red ? 1 : win(t, u.fans ?? u.on + 0.2, 0.2);
  if (r.top && uf > 0 && parentPw > 260) {
    c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.6); c.beginPath();
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, rr = Math.min(b.x1 - b.x0, b.z0 - b.z1) * 0.34;
    for (const dx of [-0.23, 0.23]) {
      const pts = [];
      for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([cx + dx * (b.x1 - b.x0) + Math.cos(a) * rr, b.y1, cz + Math.sin(a) * rr]); }
      polyU(c, V, pts, uf);
    }
    c.stroke();
  }
}
// a plain box with an optional detail: fins (a transformer), a stack (a generator)
function block(c, V, P, o, t, mode) {
  const u = mode.red ? 1 : win(t, o.on, o.dur ?? 0.22);
  if (u <= 0) return;
  const b = o.b, lw = lwAt(V, [(b.x0 + b.x1) / 2, b.y1, b.z0], 1.7);
  box(c, V, P, b, u, u, mode.red ? 1 : win(t, o.on + 0.14, 0.14), lw);
  const ud = mode.red ? 1 : win(t, o.on + 0.16, 0.2);
  if (ud <= 0) return;
  c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.55); c.beginPath();
  if (o.fins) for (let i = 1; i < o.fins; i++) { const x = lerp(b.x0, b.x1, i / o.fins); segU(c, V, [x, b.y0 + 0.4, b.z0], [x, b.y1 - 0.4, b.z0], ud); }
  if (o.insulators) for (let i = 0; i < 3; i++) {       // three bushings on the lid
    const x = lerp(b.x0, b.x1, (i + 1) / 4), z = (b.z0 + b.z1) / 2;
    segU(c, V, [x, b.y1, z], [x, b.y1 + o.insulators, z], ud);
    for (let s = 1; s <= 3; s++) { const y = b.y1 + o.insulators * s / 4; if (ud * 4 > s) seg(c, V, [x - 0.35, y, z], [x + 0.35, y, z]); }
  }
  if (o.stack) {                                      // a generator's exhaust (on a syllable of its own when it has one)
    const us = mode.red ? 1 : o.onStack !== undefined ? win(t, o.onStack, 0.22) : ud;
    const x = lerp(b.x0, b.x1, 0.7), z = (b.z0 + b.z1) / 2;
    segU(c, V, [x - 0.25, b.y1, z], [x - 0.25, b.y1 + o.stack, z], us); segU(c, V, [x + 0.25, b.y1, z], [x + 0.25, b.y1 + o.stack, z], us);
    if (us >= 1) seg(c, V, [x - 0.45, b.y1 + o.stack, z], [x + 0.45, b.y1 + o.stack, z]);
  }
  c.stroke();
}
// the water tower: a tank on four legs with cross-bracing and a conical roof
function tower(c, V, P, w, t, mode) {
  const u = mode.red ? 1 : win(t, w.on, 0.55);
  if (u <= 0) return;
  const N = 28, ring = (y, R) => { const a = []; for (let i = 0; i <= N; i++) { const th = i / N * Math.PI * 2; a.push([w.cx + Math.cos(th) * R, y, w.cz + Math.sin(th) * R]); } return a; };
  const lw = lwAt(V, [w.cx, w.yb, w.cz], 2);
  // the legs and their bracing, behind the tank
  const uL = clamp(u / 0.4);
  const legs = [0, 1, 2, 3].map(i => { const th = (i + 0.5) * Math.PI / 2; return { t: [w.cx + Math.cos(th) * w.R * 0.72, w.yb, w.cz + Math.sin(th) * w.R * 0.72], g: [w.cx + Math.cos(th) * w.R * 1.12, w.yg, w.cz + Math.sin(th) * w.R * 1.12] }; });
  c.strokeStyle = P.ink; c.lineWidth = lw * 0.8; c.beginPath();
  for (const L of legs) segU(c, V, L.g, L.t, uL);
  c.stroke();
  const uB = clamp((u - 0.25) / 0.35);
  if (uB > 0) {
    c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.5); c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = legs[i], b = legs[(i + 1) % 4];
      for (let s = 0; s < 3; s++) {
        const y0 = s / 3, y1 = (s + 1) / 3;
        segU(c, V, mix3(a.g, a.t, y0), mix3(b.g, b.t, y1), uB); segU(c, V, mix3(b.g, b.t, y0), mix3(a.g, a.t, y1), uB);
      }
    }
    c.stroke();
  }
  // the tank: filled as the hull of its two rims (so it hides the bracing behind it), then its lines
  const bot = ring(w.yb, w.R), top = ring(w.yt, w.R);
  const uT = clamp((u - 0.3) / 0.5), uF = mode.red ? 1 : clamp((u - 0.55) / 0.3);
  if (uF > 0) {
    const pts = [...bot, ...top].map(p => V.at(p)).filter(Boolean);
    const hl = hull(pts);
    if (hl.length > 2) { c.globalAlpha = uF; c.fillStyle = P.face; c.beginPath(); hl.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill(); c.globalAlpha = 1; }
  }
  if (uT > 0) {
    const pts = [...bot, ...top].map(p => V.at(p)).filter(Boolean), hl = hull(pts);
    c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath();
    if (hl.length > 2 && uT >= 1) { hl.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); }
    polyU(c, V, top, uT);
    const front = arr => arr.filter(p => { const q = V.cam(p), qc = V.cam([w.cx, p[1], w.cz]); return q[2] < qc[2]; });
    if (uT >= 1) for (const y of [lerp(w.yb, w.yt, 0.34), lerp(w.yb, w.yt, 0.67)]) { const r = front(ring(y, w.R)); for (let i = 1; i < r.length; i++) if (Math.abs(r[i][0] - r[i - 1][0]) + Math.abs(r[i][2] - r[i - 1][2]) < w.R) seg(c, V, r[i - 1], r[i]); }
    // the roof: a cone
    const apex = [w.cx, w.yt + w.R * 0.55, w.cz];
    if (uT >= 1) for (let i = 0; i < N; i += 4) seg(c, V, top[i], apex);
    c.stroke();
  }
}
// the convex hull of screen points (monotone chain)
function hull(ps) {
  const p = [...ps].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
// a lattice pylon in the plane facing the camera; its geometry (and where the cables hang) is made once, in pylonAt
export function pylonAt(x, z, yg, h) {
  const bw = 0.15 * h, tw = 0.04 * h, waist = yg + 0.7 * h, top = yg + h;
  const L = [[x - bw, yg, z], [x - tw, waist, z], [x - tw * 0.7, top, z]], R = L.map(p => [2 * x - p[0], p[1], p[2]]);
  const arms = [[yg + 0.76 * h, 0.24 * h], [yg + 0.9 * h, 0.17 * h]];
  const hang = [];
  for (const [y, a] of arms) for (const s of [-1, 1]) hang.push([x + s * a, y - 0.06 * h, z]);
  return { x, z, yg, h, L, R, arms, hang, waist };
}
function pylon(c, V, P, p, t, mode) {
  const u = mode.red ? 1 : win(t, p.on, 0.45);
  if (u <= 0) return;
  const g = p.g, lw = lwAt(V, [g.x, g.yg + g.h / 2, g.z], 1.8);
  c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath();
  polyU(c, V, g.L, clamp(u / 0.5)); polyU(c, V, g.R, clamp(u / 0.5));
  c.stroke();
  const ub = clamp((u - 0.3) / 0.45);
  if (ub > 0) {
    c.strokeStyle = P.hair; c.lineWidth = Math.max(0.55, lw * 0.5); c.beginPath();
    const n = 5;
    for (let i = 0; i < n; i++) {                       // the bracing: an X per panel, up to the waist
      if (ub * n < i) break;
      const a0 = mix3(g.L[0], g.L[1], i / n), a1 = mix3(g.L[0], g.L[1], (i + 1) / n), b0 = mix3(g.R[0], g.R[1], i / n), b1 = mix3(g.R[0], g.R[1], (i + 1) / n);
      seg(c, V, a0, b1); seg(c, V, b0, a1); seg(c, V, a1, b1);
    }
    seg(c, V, g.L[1], g.R[2]); seg(c, V, g.R[1], g.L[2]);
    c.stroke();
  }
  const ua = clamp((u - 0.6) / 0.4);
  if (ua > 0) {
    c.strokeStyle = P.ink; c.lineWidth = lw * 0.8; c.beginPath();
    for (const [y, a] of g.arms) {
      segU(c, V, [g.x - a * ua, y, g.z], [g.x + a * ua, y, g.z], 1);
      if (ua >= 1) for (const s of [-1, 1]) { seg(c, V, [g.x + s * a, y, g.z], [g.x + s * g.h * 0.04, y + g.h * 0.05, g.z]); seg(c, V, [g.x + s * a, y, g.z], [g.x + s * a, y - g.h * 0.06, g.z]); }
    }
    c.stroke();
  }
}
// a catenary between two points, drawn from a to b
function cable(c, V, P, cb, t, mode) {
  const u = mode.red ? 1 : win(t, cb.on, cb.dur ?? 0.5);
  if (u <= 0) return;
  const a = cb.a, b = cb.b, span = Math.hypot(b[0] - a[0], b[2] - a[2]), sag = span * 0.03, pts = [];
  for (let i = 0; i <= 24; i++) { const s = i / 24; const p = mix3(a, b, s); p[1] -= sag * 4 * s * (1 - s); pts.push(p); }
  c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lwAt(V, mix3(a, b, 0.5), 1.1)); c.beginPath(); polyU(c, V, pts, u); c.stroke();
}
// a gantry: two poles and a beam, with the droppers down to the transformers
function gantry(c, V, P, g, t, mode) {
  const u = mode.red ? 1 : win(t, g.on, 0.35);
  if (u <= 0) return;
  const lw = lwAt(V, [(g.x0 + g.x1) / 2, g.y1, g.z], 1.9);
  c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath();
  segU(c, V, [g.x0, g.yg, g.z], [g.x0, g.y1, g.z], clamp(u / 0.5)); segU(c, V, [g.x1, g.yg, g.z], [g.x1, g.y1, g.z], clamp(u / 0.5));
  segU(c, V, [g.x0 - 0.6, g.y1 - 0.4, g.z], [g.x1 + 0.6, g.y1 - 0.4, g.z], clamp((u - 0.4) / 0.4));
  c.stroke();
  const ud = clamp((u - 0.7) / 0.3);
  if (ud > 0) { c.strokeStyle = P.hair; c.lineWidth = Math.max(0.6, lw * 0.5); c.beginPath(); for (const d of g.drops) segU(c, V, [d[0], g.y1 - 0.4, g.z], d, ud); c.stroke(); }
}
// a fence: posts and two wires, drawn left to right
function fence(c, V, P, f, t, mode) {
  const u = mode.red ? 1 : win(t, f.on, 0.45);
  if (u <= 0) return;
  const xe = lerp(f.x0, f.x1, u), lw = lwAt(V, [(f.x0 + f.x1) / 2, f.yg, f.z], 1.3);
  c.strokeStyle = P.hair; c.lineWidth = lw; c.beginPath();
  for (let x = f.x0; x <= xe + 1e-6; x += f.step) seg(c, V, [x, f.yg, f.z], [x, f.yg + f.h, f.z]);
  for (const y of [f.h * 0.5, f.h * 0.95]) seg(c, V, [f.x0, f.yg + y, f.z], [xe, f.yg + y, f.z]);
  c.stroke();
}

// ---------- what lies under and behind everything ----------
function ground(c, V, P, g, t, mode) {
  const u = mode.red ? 1 : win(t, g.on, 0.4);
  if (u <= 0) return;
  // the grid on the ground plane, fading in behind the line
  c.save();
  c.globalAlpha = mode.red ? 0.7 : ease(u);
  c.strokeStyle = P.faint; c.lineWidth = 1; c.beginPath();
  for (const z of g.zs) seg(c, V, [-g.span, g.yg, z], [g.span, g.yg, z]);
  for (let x = -g.gx * g.nx; x <= g.gx * g.nx + 1e-6; x += g.gx) seg(c, V, [x, g.yg, g.zs[0]], [x, g.yg, g.zs[g.zs.length - 1]]);
  c.stroke();
  // the horizon
  c.strokeStyle = P.dim; c.beginPath(); seg(c, V, [-40000, g.yg, -12000], [40000, g.yg, -12000]); c.stroke();
  c.restore();
  // the ground line: out from the middle to both sides
  const s = easeOut(u) * g.span;
  c.strokeStyle = P.ink; c.lineWidth = lwAt(V, [0, g.yg, g.zLine], 2.8); c.beginPath();
  seg(c, V, [-s, g.yg, g.zLine], [s, g.yg, g.zLine]); c.stroke();
}
// the section under the ground line: the earth, hatched, the way an elevation shows it cut
function earth(c, V, P, e, t, mode) {
  const u = mode.red ? 1 : win(t, e.on, 0.35);
  if (u <= 0) return;
  const x1 = lerp(e.x0, e.x1, easeOut(u));
  if (!face(c, V, [[e.x0, e.yg, e.z], [x1, e.yg, e.z], [x1, e.yg - e.d, e.z], [e.x0, e.yg - e.d, e.z]])) return;
  c.save(); c.clip();
  c.strokeStyle = P.hatch; c.lineWidth = 1; c.beginPath();
  for (let s = -H; s < W + H; s += 11) { c.moveTo(s, H); c.lineTo(s + H, 0); }
  c.stroke(); c.restore();
}
// the sun on the horizon (the grid, blue only: the utopia's own sunrise)
function sun(c, V, P, s, t, mode) {
  if (mode.red) return;
  const u = win(t, s.on, 0.6);
  if (u <= 0) return;
  const arc = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40; arc.push([s.x + Math.cos(a) * s.r, s.yg + Math.sin(a) * s.r, s.z]); }
  c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); polyU(c, V, arc, u); c.stroke();
  const ur = clamp((u - 0.4) / 0.6);
  if (ur > 0) {
    c.save(); c.setLineDash([8, 7]); c.strokeStyle = P.dim; c.lineWidth = 1.1; c.beginPath();
    for (let i = 1; i < 16; i++) { const a = Math.PI * i / 16; segU(c, V, [s.x + Math.cos(a) * s.r * 1.12, s.yg + Math.sin(a) * s.r * 1.12, s.z], [s.x + Math.cos(a) * s.r * 1.7, s.yg + Math.sin(a) * s.r * 1.7, s.z], ur); }
    c.stroke(); c.restore();
  }
}
// the river ("in a state with cheap water"): two banks from the horizon to the near ground, the water hatched
function river(c, V, P, r, t, mode) {
  const u = mode.red ? 1 : win(t, r.on, 0.7);
  if (u <= 0) return;
  const n = 60, L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const z = lerp(r.z0, r.z1, i / n), x = r.x(z), w = r.w(z);
    L.push([x - w, r.yg, z]); R.push([x + w, r.yg, z]);
  }
  const k = Math.max(2, Math.round(n * u));
  if (face(c, V, [...L.slice(0, k + 1), ...R.slice(0, k + 1).reverse()])) { c.fillStyle = P.red ? "#0a0205" : "#1a4789"; c.fill(); }
  c.strokeStyle = P.ink; c.lineWidth = 1.3; c.beginPath(); polyU(c, V, L, u); polyU(c, V, R, u); c.stroke();
  if (!P.red) {
    c.strokeStyle = P.dim; c.lineWidth = 1; c.beginPath();
    for (let i = 2; i < k; i += 2) { const z = lerp(r.z0, r.z1, i / n), x = r.x(z), w = r.w(z); seg(c, V, [x - w * 0.4, r.yg, z], [x + w * 0.2, r.yg, z]); }
    c.stroke();
  }
}

// ---------- the annotations (blue only) ----------
// a leader: a dot on the thing, a run out to a shelf, the label on the shelf, typed out
function label(c, V, P, L, t) {
  const u = win(t, L.on, 0.4);
  if (u <= 0) return;
  const a = V.at(L.p);
  if (!a || a.x < -200 || a.x > W + 200 || a.y < -200 || a.y > H + 200) return;
  const bx = a.x + L.dx, by = a.y + L.dy, right = L.dx >= 0, tw = measure("mono", L.text, 19, 0.06) + 10;
  const ex = bx + (right ? tw : -tw);
  c.strokeStyle = P.hair; c.lineWidth = 1.2; c.beginPath();
  const ul = clamp(u / 0.45);
  c.moveTo(a.x, a.y); c.lineTo(lerp(a.x, bx, ul), lerp(a.y, by, ul));
  if (ul >= 1) { c.moveTo(bx, by); c.lineTo(lerp(bx, ex, clamp((u - 0.45) / 0.2)), by); }
  c.stroke();
  c.fillStyle = P.ink; c.beginPath(); c.arc(a.x, a.y, 3.2, 0, 7); c.fill();
  const ut = clamp((u - 0.5) / 0.5), n = Math.floor(L.text.length * ut);
  if (n > 0) mono(c, L.text.slice(0, n), bx + (right ? 6 : -6), by - 8, 19, P.ink, right ? "left" : "right");
  if (L.sub && ut >= 1) mono(c, L.sub, bx + (right ? 6 : -6), by + 20, 14, P.dim, right ? "left" : "right");
}
// a dimension: extension ticks, the line growing from its middle out, arrowheads, the measure on a knock-out
function dimension(c, V, P, d, t) {
  const u = win(t, d.on, 0.45);
  if (u <= 0) return;
  const a = V.at(d.a), b = V.at(d.b);
  if (!a || !b) return;
  const ang = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(ang) * d.off, ny = Math.cos(ang) * d.off;
  const A = { x: a.x + nx, y: a.y + ny }, B = { x: b.x + nx, y: b.y + ny }, M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  c.strokeStyle = P.hair; c.lineWidth = 1; c.beginPath();
  const ue = clamp(u / 0.3);
  c.moveTo(a.x, a.y); c.lineTo(lerp(a.x, A.x + nx * 0.2, ue), lerp(a.y, A.y + ny * 0.2, ue));
  c.moveTo(b.x, b.y); c.lineTo(lerp(b.x, B.x + nx * 0.2, ue), lerp(b.y, B.y + ny * 0.2, ue));
  const ul = clamp((u - 0.25) / 0.45);
  c.moveTo(lerp(M.x, A.x, ul), lerp(M.y, A.y, ul)); c.lineTo(lerp(M.x, B.x, ul), lerp(M.y, B.y, ul));
  c.stroke();
  if (ul >= 1) {
    c.fillStyle = P.hair;
    for (const [p, an] of [[A, ang + Math.PI], [B, ang]]) { c.save(); c.translate(p.x, p.y); c.rotate(an); c.beginPath(); c.moveTo(0, 0); c.lineTo(-11, 3.8); c.lineTo(-11, -3.8); c.closePath(); c.fill(); c.restore(); }
  }
  const ut = clamp((u - 0.6) / 0.4);
  if (ut > 0) {
    const tw = measure("mono", d.text, 18, 0.06) + 16;
    c.save(); c.translate(M.x, M.y); c.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
    c.globalAlpha = ut; c.fillStyle = P.bgMid ?? "#1e4f95"; c.fillRect(-tw / 2, -13, tw, 24);
    mono(c, d.text, 0, 6, 18, P.ink, "center");
    c.restore();
  }
}

// =====================================================================================================================
// the sites: one hall, a campus, the grid. Every piece is given a GROUP; chorus.js puts the groups on the sung words of
// the two questions and the unwritten third line, in order (thirty-four syllables per chorus, one group each)
// =====================================================================================================================
function mkHall(x0, x1, z0, depth, yg, h, o = {}) {
  const b = { x0, x1, y0: yg, y1: yg + h, z0, z1: z0 - depth };
  const hall = { kind: "hall", b, key: [(x0 + x1) / 2, yg, z0], panels: o.panels ?? Math.round((x1 - x0) / 2.6), hero: o.hero, doors: o.doors, g: o.g, d: o.d, gs: o.gs };
  // the windows: rows in the middle band of the facade, a column every so often
  const rows = o.rows ?? 3, cols = o.cols ?? Math.max(4, Math.round((x1 - x0) / 3)), cells = [];
  for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++) {
    const y0 = yg + h * lerp(0.3, 0.62, r / Math.max(1, rows)), y1 = y0 + h * 0.32 / rows * 0.62;
    const cx0 = lerp(x0, x1, (j + 0.18) / cols), cx1 = lerp(x0, x1, (j + 0.82) / cols);
    cells.push({ x0: cx0, x1: cx1, y0, y1, z: z0, col: j, row: r, c: [(cx0 + cx1) / 2, (y0 + y1) / 2, z0 + 0.05] });
  }
  hall.cells = cells; hall.cellCols = cols;
  // the cooling on the roof: rows of units set back from the parapet
  if (o.units) {
    hall.units = [];
    const [nr, nu] = o.units, uw = (x1 - x0) / nu * 0.62, ud = Math.min(4.4, depth / (nr * 2.2));
    for (let r = 0; r < nr; r++) for (let i = 0; i < nu; i++) {
      const cx = lerp(x0, x1, (i + 0.5) / nu), uz0 = z0 - depth * 0.16 - r * depth * 0.38;
      hall.units.push({ b: { x0: cx - uw / 2, x1: cx + uw / 2, y0: yg + h, y1: yg + h + Math.min(2.8, h * 0.13), z0: uz0, z1: uz0 - ud }, r, i, g: o.unitG?.[r] ?? o.g, n: nu });
    }
  }
  return hall;
}

// chorus 1: HALL A. The hall is the hero: its outline, depth, panels, louvers, doors, windows and parapet each take
// their own syllable of the first question; the second question puts the roof, the generators, the fence, the
// substation and the water tower on it; the third (unwritten) line runs the power line to the horizon and annotates.
function siteHall() {
  const yg = -14, P = [], L = [], Dm = [];
  const A = mkHall(-27, 27, -30, 26, yg, 20, { hero: true, rows: 3, cols: 18, units: [2, 7], unitG: [9, 10],
    doors: [[-20.5, 4.2, 6], [-12.8, 4.2, 6], [16.5, 5.2, 6.6]],
    gs: { outline: [1, 2], depth: 3, panels: 4, louvers: 5, doors: 6, cells: 7, parapet: 8, fans: 11 } });
  P.push({ kind: "ground", g: 0, yg, zs: [-23, -30, -40, -56, -80, -120, -190, -320, -640], gx: 14, nx: 12, span: 170, zLine: -30 });
  P.push({ kind: "earth", g: 30, yg, z: -30, x0: -46, x1: 46, d: 2.2 });
  P.push(A);
  for (let i = 0; i < 5; i++) {                          // generators along the right side
    const z0 = -32 - i * 4.7;
    P.push({ kind: "block", g: 12, d: i * 0.04, b: { x0: 29, x1: 33.4, y0: yg, y1: yg + 3.3, z0, z1: z0 - 3.9 }, stack: 5.2, stackG: 13 });
  }
  P.push({ kind: "fence", g: 14, x0: -36, x1: 36, z: -23, yg, h: 2, step: 2.4 });
  // the substation, front right: two transformers under a gantry
  P.push({ kind: "block", g: 16, b: { x0: 13.6, x1: 18.4, y0: yg, y1: yg + 4.4, z0: -19, z1: -22.6 }, fins: 7, insulators: 1.8 });
  P.push({ kind: "block", g: 17, b: { x0: 20.4, x1: 25.2, y0: yg, y1: yg + 4.4, z0: -19, z1: -22.6 }, fins: 7, insulators: 1.8 });
  P.push({ kind: "gantry", g: 17, d: 0.12, x0: 12.2, x1: 26.8, z: -24, yg, y1: yg + 12, drops: [[16, yg + 6.2, -20.8], [22.8, yg + 6.2, -20.8]] });
  P.push({ kind: "tower", g: 18, cx: -30.5, cz: -24, R: 3.3, yb: yg + 15.5, yt: yg + 22.5, yg });
  // the power line, out of the gantry and off to the horizon, a pylon on each of the third line's first syllables
  const py = [[41, -48, 26], [63, -92, 26], [96, -165, 26], [141, -280, 26], [205, -470, 26]].map(([x, z, h]) => pylonAt(x, z, yg, h));
  py.forEach((g, i) => P.push({ kind: "pylon", g: [19, 21, 23, 24, 24][i], d: i >= 4 ? 0.14 : 0, geo: g }));
  const start = [[26.8, yg + 11.6, -24], [12.2, yg + 11.6, -24]];
  const cab = (a, b, g, d = 0) => P.push({ kind: "cable", g, d, a, b });
  cab(start[0], py[0].hang[1], 20); cab(start[1], py[0].hang[0], 20, 0.05);
  for (let i = 0; i < py.length - 1; i++) for (let j = 0; j < 4; j++) cab(py[i].hang[j], py[i + 1].hang[j], [22, 24, 25, 25][i], j * 0.04 + (i >= 2 ? (i - 2) * 0.18 : 0));
  L.push({ g: 26, p: [-9, yg + 9, -30], dx: -120, dy: -330, text: "HALL A  ·  300 MW", sub: "COMPUTE, ALLOCATED" });
  L.push({ g: 27, p: [-18, yg + 22.8, -36], dx: -90, dy: -120, text: "COOLING ×14" });
  L.push({ g: 28, p: [19.8, yg + 5.4, -19], dx: 110, dy: 120, text: "SUBSTATION  ·  230 KV" });
  L.push({ g: 29, p: [-30.5, yg + 19, -24], dx: -40, dy: -170, text: "WATER  ·  2.1 ML/DAY" });
  L.push({ g: 25, p: [31.2, yg + 3.3, -41], dx: 110, dy: -110, text: "BACKUP GEN ×5" });
  Dm.push({ g: 15, a: [-27, yg + 20, -30], b: [27, yg + 20, -30], off: -46, text: "216 M" });
  Dm.push({ g: 33, a: [-27, yg, -30], b: [-27, yg + 20, -30], off: 46, text: "80 M" });
  return { name: "HALL A", view: "ELEVATION A", scale: "1:500", yg, parts: P, labels: L, dims: Dm };
}
// chorus 2: THE CAMPUS. The same hall, lower and further back, and seven more around it
function siteCampus() {
  const yg = -18, P = [], L = [], Dm = [];
  P.push({ kind: "ground", g: 0, yg, zs: [-38, -48, -60, -80, -110, -160, -240, -380, -700], gx: 24, nx: 14, span: 420, zLine: -44 });
  P.push({ kind: "earth", g: 30, yg, z: -44, x0: -110, x1: 110, d: 3 });
  const H = 14;
  P.push(mkHall(-27, 27, -60, 30, yg, H, { hero: true, rows: 2, cols: 16, units: [2, 6], unitG: [4, 4], doors: [[-18, 4, 4.8], [14, 4.6, 5]],
    gs: { outline: [1, 2], depth: 3, panels: 3, louvers: 4, doors: 4, cells: 5, parapet: 5, fans: 5 } }));
  const more = [[-95, -41, -66, 6], [41, 95, -66, 7], [-62, -8, -112, 8], [8, 62, -112, 9], [-95, -41, -160, 12], [-27, 27, -165, 13], [41, 95, -160, 14]];
  more.forEach(([x0, x1, z0, g]) => P.push(mkHall(x0, x1, z0, 30, yg, H, { rows: 2, cols: 12, units: [2, 5], unitG: [g, g], g })));
  // units on the back rows come a syllable after their hall (groups 10, 11 carry the first row's roofs)
  P.push({ kind: "fence", g: 15, x0: -110, x1: 110, z: -40, yg, h: 2.2, step: 4 });
  P.push({ kind: "block", g: 16, b: { x0: 30, x1: 36, y0: yg, y1: yg + 5, z0: -36, z1: -40 }, fins: 8, insulators: 2 });
  P.push({ kind: "block", g: 16, d: 0.08, b: { x0: 38, x1: 44, y0: yg, y1: yg + 5, z0: -36, z1: -40 }, fins: 8, insulators: 2 });
  P.push({ kind: "block", g: 17, b: { x0: 46, x1: 52, y0: yg, y1: yg + 5, z0: -36, z1: -40 }, fins: 8, insulators: 2 });
  P.push({ kind: "gantry", g: 17, d: 0.1, x0: 28.5, x1: 53.5, z: -42, yg, y1: yg + 13, drops: [[33, yg + 7, -38], [41, yg + 7, -38], [49, yg + 7, -38]] });
  P.push({ kind: "tower", g: 18, cx: -40, cz: -46, R: 3.6, yb: yg + 15, yt: yg + 22.5, yg });
  P.push({ kind: "tower", g: 18, d: 0.12, cx: -52, cz: -54, R: 3.6, yb: yg + 15, yt: yg + 22.5, yg });
  const py = [[70, -70, 30], [104, -128, 30], [150, -215, 30], [215, -350, 30], [300, -560, 30], [420, -860, 30]].map(([x, z, h]) => pylonAt(x, z, yg, h));
  py.forEach((g, i) => P.push({ kind: "pylon", g: [19, 20, 21, 22, 22, 22][i], d: i >= 4 ? (i - 3) * 0.12 : 0, geo: g }));
  const start = [[53.5, yg + 12.6, -42], [28.5, yg + 12.6, -42]];
  P.push({ kind: "cable", g: 19, d: 0.2, a: start[0], b: py[0].hang[1] }, { kind: "cable", g: 19, d: 0.25, a: start[1], b: py[0].hang[0] });
  for (let i = 0; i < py.length - 1; i++) for (let j = 0; j < 4; j++) P.push({ kind: "cable", g: [20, 21, 22, 23, 23][i], d: j * 0.04 + 0.15, a: py[i].hang[j], b: py[i + 1].hang[j] });
  L.push({ g: 24, p: [0, yg + 7, -60], dx: -160, dy: -300, text: "CAMPUS  ·  8 HALLS  ·  2.4 GW", sub: "COMPUTE, ALLOCATED" });
  L.push({ g: 25, p: [41, yg + 5, -36], dx: 120, dy: 90, text: "SUBSTATION  ·  500 KV" });
  L.push({ g: 26, p: [-46, yg + 19, -50], dx: -60, dy: -160, text: "WATER  ·  18 ML/DAY" });
  L.push({ g: 27, p: [-68, yg + H, -66], dx: -40, dy: -210, text: "COOLING ×96" });
  L.push({ g: 28, p: [104, yg + 27, -128], dx: 90, dy: -120, text: "POWER IN" });
  Dm.push({ g: 29, a: [-95, yg + H, -66], b: [95, yg + H, -66], off: -70, text: "760 M" });
  return { name: "THE CAMPUS", view: "SITE PLAN", scale: "1:2000", yg, parts: P, labels: L, dims: Dm };
}
// chorus 3: THE GRID. Row after row of halls to the horizon, the power marching in, the river, the sunrise
function siteGrid() {
  const yg = -24, P = [], L = [], Dm = [];
  P.push({ kind: "ground", g: 0, yg, zs: [-80, -100, -140, -200, -300, -450, -700, -1100, -1800], gx: 60, nx: 30, span: 2400, zLine: -86 });
  P.push({ kind: "sun", g: 27, x: 1400, z: -9000, yg, r: 1500 });
  const H = 9, rows = [[-100, 1, 2], [-150, 3, 4], [-215, 5, 6], [-300, 9, 10], [-420, 11, 12], [-590, 13, 14], [-820, 15, 16], [-1150, 17, 18]];
  let n = 0;
  rows.forEach(([z, g0, g1], ri) => {
    const sp = 58 * (1 + Math.abs(z) / 650), ext = 150 + Math.abs(z) * 0.95, cnt = Math.floor(ext / sp);
    for (let i = -cnt; i <= cnt; i++) {
      const x = i * sp + (ri % 2 ? sp / 2 : 0);
      if (Math.abs(x) > ext) continue;
      const w = 40, hero = ri === 0 && i === 0;
      const g = hero ? 1 : (Math.abs(i) <= cnt / 2 ? g0 : g1);
      P.push(mkHall(x - w / 2, x + w / 2, z, 22, yg, H, { hero, rows: hero ? 2 : 1, cols: hero ? 12 : 8, units: ri < 2 ? [1, 5] : null, unitG: hero ? [3] : [g1], g, d: Math.abs(x) / ext * 0.35,
        gs: hero ? { outline: [1, 1], depth: 2, panels: 3, louvers: 3, doors: 3, cells: 4, parapet: 4, fans: 4 } : null }));
      n++;
    }
  });
  // the river, from the horizon on the right to the near ground
  P.push({ kind: "river", g: 7, yg, z0: -1700, z1: -70, x: z => 180 + (z + 70) * -0.55 + Math.sin(z * 0.006) * 60, w: z => 14 + Math.abs(z) * 0.018 });
  // the power, marching in from the left horizon
  const py = [[-1500, -1700, 60], [-1000, -1100, 55], [-640, -700, 50], [-400, -430, 44], [-250, -260, 38], [-150, -150, 34], [-92, -70, 30]].map(([x, z, h]) => pylonAt(x, z, yg, h));
  py.forEach((g, i) => P.push({ kind: "pylon", g: [19, 19, 20, 21, 22, 23, 24][i], d: i < 2 ? i * 0.15 : 0, geo: g }));
  for (let i = 0; i < py.length - 1; i++) for (let j = 0; j < 4; j++) P.push({ kind: "cable", g: [20, 20, 21, 22, 23, 24][i], d: j * 0.04 + 0.2, a: py[i].hang[j], b: py[i + 1].hang[j] });
  P.push({ kind: "block", g: 25, b: { x0: -80, x1: -66, y0: yg, y1: yg + 5, z0: -84, z1: -90 }, fins: 10, insulators: 2.4 });
  P.push({ kind: "block", g: 25, d: 0.1, b: { x0: -62, x1: -48, y0: yg, y1: yg + 5, z0: -84, z1: -90 }, fins: 10, insulators: 2.4 });
  L.push({ g: 26, p: [0, yg + 6, -100], dx: -200, dy: -330, text: `THE GRID  ·  ${n} HALLS  ·  38 GW`, sub: "COMPUTE, ALLOCATED" });
  L.push({ g: 28, p: [180 - 0.55 * -130, yg, -200], dx: 120, dy: 120, text: "WATER  ·  CHEAP" });
  L.push({ g: 29, p: py[4].hang[1], dx: -150, dy: -120, text: "POWER IN  ·  765 KV" });
  return { name: "THE GRID", view: "REGIONAL PLAN", scale: "1:50 000", yg, parts: P, labels: L, dims: Dm };
}
const BUILD = [siteHall, siteCampus, siteGrid];

// Put a site's groups on the syllables: G(g) is the time group g starts (chorus.js hands it over). Every piece gets
// its absolute times here, once; the cells are gathered for the lights and for the storm's targets
export function buildSite(ci, G) {
  const s = BUILD[Math.min(ci, BUILD.length - 1)](), cells = [];
  const at = (g, d = 0) => G(g) + d;
  for (const p of s.parts) {
    if (p.kind === "hall") {
      const gs = p.gs, g = p.g ?? 0, d = p.d ?? 0;
      p.on = gs ? {
        outline: at(gs.outline[0]), outlineDur: Math.max(0.3, at(gs.outline[1]) + 0.26 - at(gs.outline[0])), depth: at(gs.depth), panels: at(gs.panels),
        louvers: at(gs.louvers), doors: at(gs.doors), cells: at(gs.cells), parapet: at(gs.parapet),
      } : { outline: at(g, d), outlineDur: 0.3, depth: at(g, d + 0.18), panels: at(g, d + 0.3), louvers: at(g, d + 0.36), doors: at(g, d + 0.4), cells: at(g, d + 0.42), parapet: at(g, d + 0.45) };
      for (const u of p.units ?? []) { u.on = at(u.g, (gs ? 0 : d + 0.45) + u.i * 0.035 + u.r * 0.06); u.fans = gs ? at(gs.fans, u.i * 0.03) : u.on + 0.2; }
      p.cells.forEach(q => { q.id = cells.length; cells.push(q); });
    } else if (p.kind === "block") { p.on = at(p.g, p.d ?? 0); if (p.stackG !== undefined) p.onStack = at(p.stackG, p.d ?? 0); }
    else p.on = at(p.g, p.d ?? 0);
  }
  for (const L of s.labels) L.on = at(L.g, L.d ?? 0);
  for (const D of s.dims) D.on = at(D.g, D.d ?? 0);
  // the plotter's stops: where the pen goes to start each stroke group, on that group's syllable (a group's first
  // piece only, so the pen moves only on the words it is drawn on)
  const stops = [];
  for (const p of s.parts) {
    if ((p.d ?? 0) !== 0) continue;
    if (p.kind === "hall") {
      const b = p.b, hg = b.y1 - b.y0;
      stops.push([p.on.outline, [b.x0, b.y0, b.z0]]);
      if (p.gs) stops.push([p.on.depth, [b.x0, b.y1, b.z0]], [p.on.panels, [b.x0, b.y0, b.z0]], [p.on.louvers, [b.x0, b.y1 - hg * 0.17, b.z0]],
        [p.on.doors, p.doors ? [p.doors[0][0], b.y0, b.z0] : [b.x0, b.y0, b.z0]], [p.on.cells, p.cells[0].c], [p.on.parapet, [b.x1, b.y1, b.z0]]);
    } else if (p.kind === "block") stops.push([p.on, [p.b.x0, p.b.y0, p.b.z0]]);
    else if (p.kind === "tower") stops.push([p.on, [p.cx, p.yg, p.cz]]);
    else if (p.kind === "pylon") stops.push([p.on, [p.geo.x, p.geo.yg, p.geo.z]]);
    else if (p.kind === "cable") stops.push([p.on, p.a]);
    else if (p.kind === "gantry" || p.kind === "fence") stops.push([p.on, [p.x0, p.yg, p.z]]);
    else if (p.kind === "ground") stops.push([p.on, [0, p.yg, p.zLine]]);
    else if (p.kind === "earth") stops.push([p.on, [p.x0, p.yg, p.z]]);
    else if (p.kind === "river") stops.push([p.on, [p.x(p.z1), p.yg, p.z1]]);
  }
  for (const L of s.labels) if ((L.d ?? 0) === 0) stops.push([L.on, L.p]);
  for (const D of s.dims) if ((D.d ?? 0) === 0) stops.push([D.on, D.a]);
  stops.sort((a, b) => a[0] - b[0]);
  s.stops = stops.filter((st, i) => i === 0 || st[0] - stops[i - 1][0] > 1e-6);
  // the depth key the painter sorts by: where the piece stands
  for (const p of s.parts) p.key = p.kind === "hall" ? [(p.b.x0 + p.b.x1) / 2, p.b.y0, p.b.z0]
    : p.kind === "block" ? [(p.b.x0 + p.b.x1) / 2, p.b.y0, p.b.z0] : p.kind === "tower" ? [p.cx, p.yg, p.cz]
    : p.kind === "pylon" ? [p.geo.x, p.geo.yg, p.geo.z] : p.kind === "cable" ? mix3(p.a, p.b, 0.5)
    : p.kind === "gantry" ? [(p.x0 + p.x1) / 2, p.yg, p.z] : p.kind === "fence" ? [(p.x0 + p.x1) / 2, p.yg, p.z] : null;
  s.cells = cells;
  s.back = s.parts.filter(p => !p.key);
  s.objs = s.parts.filter(p => p.key);
  return s;
}

// the kick on the blue drawing: its lines pump (brighter, heavier) instead of the frame flashing
function pulsed(k) {
  if (k < 0.02) return BLUE;
  const a = (base, gain) => `rgba(244,248,255,${Math.min(1, base + gain * k).toFixed(3)})`;
  return { ...BLUE, hair: a(0.74, 0.26), dim: a(0.4, 0.3), faint: a(0.15, 0.12), hatch: a(0.34, 0.2) };
}
// the plotter: the pen that draws the buildings, riding two gantry rails across the sheet, going to each stroke group's
// start on its syllable and scribbling along while the group draws (blue only, while there is drawing to do)
export function plotter(c, V, s, t, until) {
  const st = s.stops;
  if (!st.length || t < st[0][0] || t > until + 0.4) return;
  let i = 0;
  while (i + 1 < st.length && st[i + 1][0] <= t) i++;
  const cur = st[i], prev = st[Math.max(0, i - 1)];
  const clampPt = p => { const q = V.at(p); return q ? { x: clamp(q.x, 60, W - 60), y: clamp(q.y, 60, H - 60) } : { x: W / 2, y: H / 2 }; };
  const a = clampPt(prev[1]), b = clampPt(cur[1]), u = easeOut((t - cur[0]) / 0.1);
  const scrib = Math.min(0.3, Math.max(0, t - cur[0] - 0.1));
  const x = lerp(a.x, b.x, u) + scrib * 140, y = lerp(a.y, b.y, u) + Math.sin(scrib * 40) * 6 * (scrib > 0 ? 1 : 0);
  const fade = clamp((until + 0.4 - t) / 0.4), m = 35;
  c.save();
  c.globalAlpha = fade;
  c.strokeStyle = "rgba(244,248,255,0.3)"; c.lineWidth = 1; c.setLineDash([]);
  c.beginPath(); c.moveTo(m, y); c.lineTo(W - m, y); c.moveTo(x, m); c.lineTo(x, H - m); c.stroke();
  c.fillStyle = "rgba(244,248,255,0.55)";                      // the carriages on the rails
  c.fillRect(x - 16, m - 5, 32, 10); c.fillRect(m - 5, y - 16, 10, 32);
  c.strokeStyle = BLUE.ink; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y, 12, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(x - 22, y); c.lineTo(x - 5, y); c.moveTo(x + 5, y); c.lineTo(x + 22, y); c.moveTo(x, y - 22); c.lineTo(x, y - 5); c.moveTo(x, y + 5); c.lineTo(x, y + 22); c.stroke();
  mono(c, `X ${String(Math.round(x)).padStart(4, "0")}  Y ${String(Math.round(y)).padStart(4, "0")}`, x + 20, y - 18, 12, BLUE.hair);
  c.restore();
}

// draw the whole site at t. mode: { red, lit(cell, t), k (the kick) }
export function drawSite(c, V, s, t, mode) {
  const P = mode.red ? RED : pulsed(mode.k ?? 0);
  LWK = mode.red ? 1 : 1 + (mode.k ?? 0) * 0.45;
  c.save();
  c.lineCap = "round"; c.lineJoin = "round"; c.setLineDash([]);
  for (const p of s.back) {
    if (p.kind === "ground") ground(c, V, P, p, t, mode);
    else if (p.kind === "earth") earth(c, V, P, p, t, mode);
    else if (p.kind === "sun") sun(c, V, P, p, t, mode);
    else if (p.kind === "river") river(c, V, P, p, t, mode);
  }
  // the painter: far pieces first, so a filled wall hides what stands behind it
  const order = s.objs.map(p => ({ p, d: V.cam(p.key)[2] })).sort((a, b) => b.d - a.d);
  for (const { p, d } of order) {
    if (d < NEAR && p.kind !== "cable") continue;
    if (p.kind === "hall") hall(c, V, P, p, t, mode);
    else if (p.kind === "block") block(c, V, P, { ...p, stack: p.stack }, t, mode);
    else if (p.kind === "tower") tower(c, V, P, p, t, mode);
    else if (p.kind === "pylon") pylon(c, V, P, { on: p.on, g: p.geo }, t, mode);
    else if (p.kind === "cable") cable(c, V, P, p, t, mode);
    else if (p.kind === "gantry") gantry(c, V, P, p, t, mode);
    else if (p.kind === "fence") fence(c, V, P, p, t, mode);
  }
  if (!mode.red) {
    for (const D of s.dims) dimension(c, V, { ...P, bgMid: BLUE.face }, D, t);
    for (const L of s.labels) label(c, V, P, L, t);
  }
  c.restore();
  LWK = 1;
}
// the last time anything in the site starts drawing (for the plan's probe)
export const siteEnd = s => Math.max(...s.parts.map(p => p.kind === "hall" ? p.on.parapet : p.on ?? 0), ...s.labels.map(l => l.on), ...s.dims.map(d => d.on));
