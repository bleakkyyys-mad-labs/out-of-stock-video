// The draughting kit: a small 3D projector, and the technical-drawing primitives that go with it.
//
// Why this is 2D canvas and not three.js (the engine has three.js right there): the creator's brief for verse 2 asks for
// "fancy, technical diagrams" and a chart the camera explores in 3D space. That look is hairlines that stay a
// hairline at any depth, dash patterns that hold, dimension arrows, leader lines with a shelf under the label, and
// text that stays crisp when the camera is a metre from it. WebGL draws every line one pixel wide whatever width you
// ask for, and text in 3D is a texture that softens the moment you get close. So the trail is projected by hand and
// stroked on the same 1920x1080 canvas the fast cut uses -- which also keeps it on the CPU raster path that captures
// need (lesson L80). "3D" here is a camera, not a renderer.
//
// Everything is a pure function of its arguments. No state, no allocation caches keyed on time.
import { font, MONO, C } from "./type.js";

export const W = 1920, H = 1080;
const NEAR = 0.4;                                    // the near plane, in world units

// ---------- vectors (plain arrays: this runs per candle per frame, a class per point would be all garbage) ----------
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlen = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

// ---------- the camera ----------
// eye/target in world units, fov vertical in degrees, roll in radians. V.at(p) -> screen point + depth + the pixels
// per world unit at that depth (s), or null when the point is behind the near plane.
export function view({ eye, target, fov = 38, roll = 0, up = [0, 1, 0] }) {
  const f = norm(sub(target, eye));
  let r = cross(f, up);
  if (vlen(r) < 1e-5) r = cross(f, [0, 0, 1]);        // looking straight up or straight down
  r = norm(r);
  let u = cross(r, f);
  if (roll) { const cs = Math.cos(roll), sn = Math.sin(roll), r2 = add(mul(r, cs), mul(u, sn)); u = sub(mul(u, cs), mul(r, sn)); r = r2; }
  const k = (H / 2) / Math.tan(fov * Math.PI / 360);
  const V = {
    eye, f, r, u, k, fov, near: NEAR,
    cam: p => { const d = sub(p, eye); return [dot(d, r), dot(d, u), dot(d, f)]; },
    px: (q) => ({ x: W / 2 + q[0] * k / q[2], y: H / 2 - q[1] * k / q[2], z: q[2], s: k / q[2] }),
    at: p => { const q = V.cam(p); return q[2] > NEAR ? V.px(q) : null; },
    // where the point WOULD be if it were at the near plane: for labels that must not vanish as the camera passes them
    atClamped: p => { const q = V.cam(p); return V.px(q[2] > NEAR ? q : [q[0], q[1], NEAR]); },
  };
  return V;
}
const nearCut = (V, back, front) => {
  const u = (NEAR - back[2]) / (front[2] - back[2] || 1e-6);
  return V.px([back[0] + (front[0] - back[0]) * u, back[1] + (front[1] - back[1]) * u, NEAR]);
};

// a 3D polyline as screen runs, cut at the near plane (a run per stretch that is in front of the camera)
export function runs(V, pts) {
  const out = [];
  let cur = null, pq = null;
  for (const p of pts) {
    const q = V.cam(p);
    if (q[2] > NEAR) {
      if (!cur) { cur = []; if (pq) cur.push(nearCut(V, pq, q)); }
      cur.push(V.px(q));
    } else if (cur) { cur.push(nearCut(V, q, pq)); out.push(cur); cur = null; }
    pq = q;
  }
  if (cur) out.push(cur);
  return out;
}

// a 3D polyline, stroked in chunks so one line can thin out with distance (a canvas stroke has ONE width per path).
// o.world: w is in world units and follows depth; otherwise w is pixels. o.fade(z) -> alpha.
export function poly3(c, V, pts, o = {}) {
  const w = o.w ?? 2, chunks = o.world || o.fade ? (o.chunks ?? 12) : 1, base = o.alpha ?? 1;
  for (const run of runs(V, pts)) {
    if (run.length < 2) continue;
    const n = run.length, per = Math.max(2, Math.ceil((n - 1) / chunks) + 1);
    for (let i = 0; i < n - 1; i += per - 1) {
      const seg = run.slice(i, Math.min(n, i + per));
      if (seg.length < 2) break;
      const mid = seg[seg.length >> 1];
      c.lineWidth = Math.max(o.min ?? 0.6, o.world ? w * mid.s : w);
      c.globalAlpha = base * (o.fade ? o.fade(mid.z) : 1);
      c.beginPath();
      for (let j = 0; j < seg.length; j++) j ? c.lineTo(seg[j].x, seg[j].y) : c.moveTo(seg[j].x, seg[j].y);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

// a 3D polygon, clipped against the near plane (Sutherland-Hodgman on the one plane). Leaves the path current;
// returns false when nothing of it is in front of the camera.
export function path3(c, V, pts) {
  const cam = pts.map(p => V.cam(p)), out = [];
  for (let i = 0; i < cam.length; i++) {
    const a = cam[i], b = cam[(i + 1) % cam.length], ai = a[2] > NEAR, bi = b[2] > NEAR;
    if (ai) out.push(a);
    if (ai !== bi) { const u = (NEAR - a[2]) / (b[2] - a[2] || 1e-6); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, NEAR]); }
  }
  if (out.length < 3) return false;
  c.beginPath();
  for (let i = 0; i < out.length; i++) { const p = V.px(out[i]); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
  c.closePath();
  return true;
}
export function seg3(c, V, a, b, o = {}) { poly3(c, V, [a, b], o); }

// a ruled plane in 3D: lines along x at every step of z and back. The drawing-board floor under the trail.
export function grid3(c, V, o) {
  const { y = 0, x0, x1, z0, z1, step = 8, stepZ = o.stepZ ?? o.step ?? 8, col = PEN.dim, w = 1, fade } = o;
  c.strokeStyle = col;
  for (let z = Math.ceil(z0 / stepZ) * stepZ; z <= z1; z += stepZ) poly3(c, V, [[x0, y, z], [x1, y, z]], { w, fade, chunks: 10 });
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) poly3(c, V, [[x, y, z0], [x, y, z1]], { w, fade, chunks: 3 });
}

// ---------- the draughting hand (screen space; the 3D side projects first, then calls these) ----------
// The pen the kit draws with when a caller names no colour. It is mutable because the sheet changes STOCK from beat
// to beat (dark screen / bone paper / blueprint), and a hairline has to be dark on paper and light on a screen.
// ascent.js sets it once per frame, from that beat's stock; nothing here reads the clock, so it stays pure in t.
export const PEN = { hair: "rgba(233,228,216,0.5)", dim: "rgba(233,228,216,0.22)", ink: "#f4f1ea", bg: "#07060c", panel: "rgba(7,6,12,0.82)" };
// a label style in one call, so a stroke's leftover lineCap or letterSpacing can never leak into the next frame
// (measured once already: a canvas keeps lineCap/lineJoin between frames, and begin() only resets transform + alpha)
export function lab(c, px, o = {}) {
  c.font = font(px, o.face ?? MONO, o.weight ?? "600");
  c.letterSpacing = `${o.track ?? Math.max(0.5, px * 0.06)}px`;
  c.textAlign = o.align ?? "left";
  c.textBaseline = o.baseline ?? "alphabetic";
  c.fillStyle = o.col ?? PEN.hair;
}
export const untrack = c => { c.letterSpacing = "0px"; };

export function dash(c, pts, pattern, o = {}) {
  c.save();
  c.setLineDash(pattern); c.lineDashOffset = o.offset ?? 0;
  c.strokeStyle = o.col ?? PEN.hair; c.lineWidth = o.w ?? 1; c.globalAlpha = o.alpha ?? 1;
  c.beginPath();
  for (let i = 0; i < pts.length; i++) i ? c.lineTo(pts[i].x ?? pts[i][0], pts[i].y ?? pts[i][1]) : c.moveTo(pts[i].x ?? pts[i][0], pts[i].y ?? pts[i][1]);
  c.stroke();
  c.restore();
}
export function arrowHead(c, x, y, ang, s, col) {
  c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-s, s * 0.34); c.lineTo(-s, -s * 0.34); c.closePath(); c.fill();
  c.restore();
}
// a leader: a dot on the thing, a straight run out to a shelf, the label sitting on the shelf
export function leader(c, from, to, text, o = {}) {
  const col = o.col ?? PEN.hair, px = o.size ?? 22, right = (o.dir ?? (to.x >= from.x ? 1 : -1)) > 0;
  const shelf = o.shelf ?? Math.max(30, px * (text ? text.length * 0.34 : 2));
  const ex = to.x + (right ? shelf : -shelf);
  c.save();
  c.strokeStyle = col; c.lineWidth = o.w ?? 1.2; c.globalAlpha = o.alpha ?? 1;
  c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.lineTo(ex, to.y); c.stroke();
  c.fillStyle = col;
  c.beginPath(); c.arc(from.x, from.y, o.dotR ?? 3.2, 0, 7); c.fill();
  if (text) {
    lab(c, px, { col, align: right ? "left" : "right", track: o.track });
    c.fillText(text, to.x + (right ? 8 : -8), to.y - 8);
    if (o.sub) { lab(c, px * 0.68, { col: o.subCol ?? col, align: right ? "left" : "right", track: o.track }); c.globalAlpha = (o.alpha ?? 1) * 0.75; c.fillText(o.sub, to.x + (right ? 8 : -8), to.y + px * 0.82); }
  }
  untrack(c); c.restore();
}
// a dimension line between two screen points: extension ticks, arrows inward, the measure on top
export function dim(c, a, b, text, o = {}) {
  const col = o.col ?? PEN.hair, px = o.size ?? 20, off = o.off ?? 0;
  const ang = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(ang), ny = Math.cos(ang);
  const A = { x: a.x + nx * off, y: a.y + ny * off }, B = { x: b.x + nx * off, y: b.y + ny * off };
  c.save();
  c.strokeStyle = col; c.lineWidth = o.w ?? 1; c.globalAlpha = o.alpha ?? 1;
  const tick = (p, s) => { c.beginPath(); c.moveTo(p.x - nx * s, p.y - ny * s); c.lineTo(p.x + nx * (o.ext ?? 9), p.y + ny * (o.ext ?? 9)); c.stroke(); };
  tick(A, off ? off : 7); tick(B, off ? off : 7);
  c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
  const hs = o.head ?? 9;
  arrowHead(c, A.x, A.y, ang + Math.PI, hs, col); arrowHead(c, B.x, B.y, ang, hs, col);
  if (text) {
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    c.translate(mx, my); c.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
    lab(c, px, { col, align: "center" });
    const tw = c.measureText(text).width + 12;
    c.globalAlpha = o.alpha ?? 1; c.fillStyle = o.bg ?? PEN.bg; c.fillRect(-tw / 2, -px * 0.78, tw, px * 1.08);
    c.fillStyle = col; c.fillText(text, 0, -px * 0.06);
  }
  untrack(c); c.restore();
}
// a data callout: a title strip, then label/value rows on a hairline frame
export function callout(c, x, y, title, rows, o = {}) {
  const px = o.size ?? 20, wBox = o.w ?? 330, rowH = o.rowH ?? px * 1.62, col = o.col ?? PEN.hair;
  const hBox = (title ? px * 1.9 : 0) + rows.length * rowH + 12;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  c.fillStyle = o.bg ?? PEN.panel; c.fillRect(x, y, wBox, hBox);
  c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, wBox - 1, hBox - 1);
  let yy = y + 10;
  if (title) {
    c.fillStyle = o.titleBg ?? col; c.fillRect(x, y, wBox, px * 1.5);
    lab(c, px * 0.92, { col: o.titleCol ?? PEN.bg }); c.fillText(title, x + 12, y + px * 1.06);
    yy = y + px * 1.9 + 4;
  }
  for (const [k, v, vc] of rows) {
    lab(c, px * 0.9, { col }); c.globalAlpha = (o.alpha ?? 1) * 0.72; c.fillText(k, x + 12, yy + px * 0.9);
    c.globalAlpha = o.alpha ?? 1;
    lab(c, px, { col: vc ?? o.valCol ?? PEN.ink, align: "right" }); c.fillText(String(v), x + wBox - 12, yy + px * 0.9);
    c.globalAlpha = (o.alpha ?? 1) * 0.28; c.strokeStyle = col;
    c.beginPath(); c.moveTo(x + 10, yy + rowH - 5); c.lineTo(x + wBox - 10, yy + rowH - 5); c.stroke();
    c.globalAlpha = o.alpha ?? 1;
    yy += rowH;
  }
  untrack(c); c.restore();
  return { w: wBox, h: hBox };
}
// the target cross: four arms with a gap in the middle, corner brackets, optional ring
export function crosshair(c, x, y, r, o = {}) {
  const col = o.col ?? C.red, gap = o.gap ?? r * 0.32;
  c.save(); c.strokeStyle = col; c.lineWidth = o.w ?? 1.6; c.globalAlpha = o.alpha ?? 1;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    c.beginPath(); c.moveTo(x + dx * gap, y + dy * gap); c.lineTo(x + dx * r, y + dy * r); c.stroke();
  }
  if (o.ring !== false) { c.beginPath(); c.arc(x, y, r * 0.62, 0, 7); c.stroke(); }
  if (o.brackets) {
    const b = r * 1.25, e = r * 0.34;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      c.beginPath(); c.moveTo(x + sx * b, y + sy * b - sy * e); c.lineTo(x + sx * b, y + sy * b); c.lineTo(x + sx * b - sx * e, y + sy * b); c.stroke();
    }
  }
  c.restore();
}
// section hatching: 45-degree rule lines inside whatever path the caller just built
export function hatch(c, box, o = {}) {
  const pitch = o.pitch ?? 9, ang = (o.angle ?? 45) * Math.PI / 180, col = o.col ?? PEN.dim;
  c.save(); c.clip();
  c.strokeStyle = col; c.lineWidth = o.w ?? 1; c.globalAlpha = o.alpha ?? 1;
  const d = Math.hypot(box.w, box.h), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  c.beginPath();
  for (let s = -d; s <= d; s += pitch) {
    const px = cx + -uy * s, py = cy + ux * s;
    c.moveTo(px - ux * d, py - uy * d); c.lineTo(px + ux * d, py + uy * d);
  }
  c.stroke(); c.restore();
}
// a graph node: a ring with a glyph and a caption under it
export function node(c, x, y, r, o = {}) {
  const col = o.col ?? C.cyan;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  if (o.fill !== false) { c.fillStyle = o.bg ?? PEN.bg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.strokeStyle = col; c.lineWidth = o.w ?? 1.8; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  if (o.hot) { c.globalAlpha = (o.alpha ?? 1) * o.hot; c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fill(); c.globalAlpha = o.alpha ?? 1; }
  if (o.glyph) { lab(c, o.glyphSize ?? r * 0.9, { col, align: "center", baseline: "middle", track: 0 }); c.fillText(o.glyph, x, y + 1); }
  if (o.label) { lab(c, o.size ?? 18, { col: o.labelCol ?? PEN.hair, align: "center" }); c.fillText(o.label, x, y + r + (o.size ?? 18) + 6); }
  untrack(c); c.restore();
}
export function edge(c, a, b, o = {}) {
  const col = o.col ?? PEN.dim;
  c.save(); c.globalAlpha = o.alpha ?? 1; c.strokeStyle = col; c.lineWidth = o.w ?? 1.2;
  if (o.dash) { c.setLineDash(o.dash); c.lineDashOffset = o.offset ?? 0; }
  c.beginPath(); c.moveTo(a.x, a.y);
  if (o.bow) {                                       // a bowed edge, so a graph of many edges doesn't read as a star
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1;
    c.quadraticCurveTo(mx + nx / l * o.bow, my + ny / l * o.bow, b.x, b.y);
  } else c.lineTo(b.x, b.y);
  c.stroke();
  if (o.arrow) { const ang = Math.atan2(b.y - a.y, b.x - a.x); arrowHead(c, b.x, b.y, ang, o.arrow, col); }
  c.restore();
}
// a ruled scale: a rule with major ticks, minor ticks and labels (the diagram's axis furniture)
export function tickScale(c, x, y, len, o = {}) {
  const col = o.col ?? PEN.hair, n = o.majors ?? 5, minors = o.minors ?? 4, vert = o.vert, size = o.size ?? 17;
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1; c.globalAlpha = o.alpha ?? 1;
  c.beginPath(); vert ? (c.moveTo(x, y), c.lineTo(x, y + len)) : (c.moveTo(x, y), c.lineTo(x + len, y)); c.stroke();
  const total = n * minors, dir = o.flip ? -1 : 1;
  for (let i = 0; i <= total; i++) {
    const u = i / total, major = i % minors === 0, L = major ? 12 : 6;
    const px = vert ? x : x + len * u, py = vert ? y + len * u : y;
    c.beginPath();
    vert ? (c.moveTo(px, py), c.lineTo(px + dir * L, py)) : (c.moveTo(px, py), c.lineTo(px, py + dir * L));
    c.stroke();
    if (major && o.text) {
      lab(c, size, { col, align: vert ? (o.flip ? "right" : "left") : "center", baseline: vert ? "middle" : (o.flip ? "alphabetic" : "top") });
      c.fillText(o.text(i / minors, u), vert ? px + dir * (L + 6) : px, vert ? py : py + dir * (L + 6) + (o.flip ? -4 : 0));
    }
  }
  untrack(c); c.restore();
}
// an axonometric box: the technical drawing's "this is a physical object" shorthand
export function axon(c, x, y, w, h, d, o = {}) {
  const col = o.col ?? PEN.hair, dx = d * 0.55, dy = -d * 0.42;
  const f = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const b = f.map(([a, e]) => [a + dx, e + dy]);
  c.save(); c.globalAlpha = o.alpha ?? 1; c.strokeStyle = col; c.lineWidth = o.w ?? 1.4; c.lineJoin = "miter";
  if (o.bg) { c.fillStyle = o.bg; c.beginPath(); c.moveTo(...f[0]); c.lineTo(...f[1]); c.lineTo(...f[2]); c.lineTo(...f[3]); c.closePath(); c.fill(); }
  if (o.top) { c.fillStyle = o.top; c.beginPath(); c.moveTo(...f[0]); c.lineTo(...f[1]); c.lineTo(...b[1]); c.lineTo(...b[0]); c.closePath(); c.fill(); }
  c.beginPath();
  c.moveTo(...f[0]); c.lineTo(...f[1]); c.lineTo(...f[2]); c.lineTo(...f[3]); c.closePath();
  c.moveTo(...f[0]); c.lineTo(...b[0]); c.moveTo(...f[1]); c.lineTo(...b[1]); c.moveTo(...f[2]); c.lineTo(...b[2]);
  c.moveTo(...b[0]); c.lineTo(...b[1]); c.lineTo(...b[2]);
  c.stroke();
  c.restore();
  return { front: f, back: b };
}
// a needle dial
export function gauge(c, x, y, r, v, o = {}) {
  const col = o.col ?? PEN.hair, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, a = a0 + (a1 - a0) * Math.min(1, Math.max(0, v));
  c.save(); c.globalAlpha = o.alpha ?? 1;
  c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke();
  for (let i = 0; i <= 10; i++) {
    const ta = a0 + (a1 - a0) * i / 10, L = i % 5 === 0 ? r * 0.2 : r * 0.1;
    c.beginPath(); c.moveTo(x + Math.cos(ta) * (r - L), y + Math.sin(ta) * (r - L)); c.lineTo(x + Math.cos(ta) * r, y + Math.sin(ta) * r); c.stroke();
  }
  if (o.danger !== undefined) { c.strokeStyle = C.red; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r - 3, a0 + (a1 - a0) * o.danger, a1); c.stroke(); }
  c.strokeStyle = o.needle ?? C.red; c.lineWidth = o.nw ?? 3;
  c.beginPath(); c.moveTo(x - Math.cos(a) * r * 0.16, y - Math.sin(a) * r * 0.16); c.lineTo(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 0.07, 0, 7); c.fill();
  if (o.label) { lab(c, o.size ?? 17, { col, align: "center" }); c.fillText(o.label, x, y + r + 22); }
  untrack(c); c.restore();
}
// a bar of level segments (a meter that reads as an instrument, not a progress bar)
export function segMeter(c, x, y, w, h, v, o = {}) {
  const n = o.n ?? 20, gap = o.gap ?? 3, sw = (w - gap * (n - 1)) / n, on = v * n;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  for (let i = 0; i < n; i++) {
    const lit = Math.min(1, Math.max(0, on - i));
    c.fillStyle = lit > 0 ? (o.hotAt !== undefined && i / n >= o.hotAt ? (o.hot ?? C.red) : (o.col ?? PEN.ink)) : (o.off ?? PEN.dim);
    c.globalAlpha = (o.alpha ?? 1) * (lit > 0 ? 0.35 + 0.65 * lit : 1);
    c.fillRect(x + i * (sw + gap), y, sw, h);
  }
  c.restore();
}
// hazard stripes inside the current path (the halt, the alarms)
export function hazard(c, x, y, w, h, o = {}) {
  const pitch = o.pitch ?? 36, ph = o.phase ?? 0;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = o.bg ?? "#1a1206"; c.fillRect(x, y, w, h);
  c.fillStyle = o.col ?? C.amber; c.globalAlpha = o.alpha ?? 1;
  for (let s = -h - pitch + ((ph % pitch) + pitch) % pitch; s < w + h; s += pitch) {
    c.beginPath(); c.moveTo(x + s, y + h); c.lineTo(x + s + h, y); c.lineTo(x + s + h + pitch * 0.5, y); c.lineTo(x + s + pitch * 0.5, y + h); c.closePath(); c.fill();
  }
  c.restore();
}
// corner ticks round a region: the frame that says "this part of the picture is being measured"
export function frameTicks(c, x, y, w, h, o = {}) {
  const col = o.col ?? PEN.hair, L = o.len ?? 26;
  c.save(); c.strokeStyle = col; c.lineWidth = o.w ?? 1.6; c.globalAlpha = o.alpha ?? 1;
  for (const [sx, sy, cx, cy] of [[1, 1, x, y], [-1, 1, x + w, y], [1, -1, x, y + h], [-1, -1, x + w, y + h]]) {
    c.beginPath(); c.moveTo(cx + sx * L, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + sy * L); c.stroke();
  }
  if (o.label) { lab(c, o.size ?? 17, { col }); c.fillText(o.label, x + 4, y - 8); untrack(c); }
  c.restore();
}
