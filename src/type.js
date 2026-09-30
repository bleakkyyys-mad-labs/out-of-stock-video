// Type: canvas layers that live as planes in 3D (so the camera moves through the words), the cyan
// decode scramble, the RGB-split price glitch, typed terminal lines. All deterministic in t.
import * as THREE from "three";
import { h32 } from "./song.js";

export const DISPLAY = "Anton", MONO = "Plex Mono";
export const C = {
  white: "#f4f1ea", amber: "#ffb21e", cyan: "#5ef2ff", red: "#ff2a3d", pink: "#ff3d8b",
  mute: "#8f8b99", ink: "#15131a", bone: "#e9e4d8",
};
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*@!?<>/=+";
// captures raster on the CPU: a GPU 2D canvas is not bit-exact across its own history (+-1 in some pixels,
// depending on what it drew before), and that is enough to flip a frame's hash. The ?play preview keeps the GPU
// canvas (the fast upload path) and differs from a capture by at most 1/255 in a few pixels.
export const EXACT = !new URLSearchParams(location.search).has("play");
export const ctx2d = c => c.getContext("2d", EXACT ? { willReadFrequently: true } : undefined);

// the glitch stage for an fx layer. Each channel comes from its own sample (premultiplied, so a channel that falls
// off the ink carries its own alpha); alpha is the widest of the three, so the split fringes show past the edges
const FX_FRAG = `
  uniform sampler2D map; uniform float gain, opacity, ca, tear, block, scan, seed, frame; uniform vec2 caDir; varying vec2 vUv;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 decode(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec4 lin(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    vec4 p = texture2D(map, uv);
    return p.a < 0.002 ? vec4(0.0) : vec4(decode(clamp(p.rgb / p.a, 0.0, 1.0)) * p.a, p.a);
  }
  void main() {
    vec2 uv = vUv;
    if (tear > 0.002) {                // bands shoved sideways (which bands: dealt per hit)
      float rows = 14.0 + floor(hash12(vec2(seed, 3.0)) * 34.0), band = floor(uv.y * rows);
      if (hash12(vec2(band, seed)) < tear * 0.45) uv.x += (hash12(vec2(band + 7.0, seed)) - 0.5) * 0.22 * tear;
    }
    if (block > 0.002) {               // a few blocks lifted and dropped somewhere else
      vec2 b = floor(vUv * vec2(18.0, 11.0));
      if (hash12(b + seed * 1.37) < block * 0.14) uv += (vec2(hash12(b + 2.0 + seed), hash12(b + 4.0 + seed)) - 0.5) * 0.12;
    }
    vec2 o = caDir * ca;
    vec4 r = lin(uv + o), g = lin(uv), b = lin(uv - o);
    float a = max(g.a, max(r.a, b.a));
    if (a * opacity < 0.002) discard;
    vec3 c = vec3(r.r, g.g, b.b);
    c *= 1.0 - scan * 0.4 * step(0.5, fract(vUv.y * 300.0 - frame * 0.25));   // scanlines, rolling
    gl_FragColor = vec4(c * gain * opacity, a * opacity);
  }`;

export class TypeLayer {
  // px: canvas size; worldW: plane width in scene units; gain > 1 pushes the ink past white so it blooms.
  // The canvas re-uploads every frame, so it must take the browser's GPU-to-GPU copy: plain RGBA8 (an sRGB
  // texture format measured 13-26 fps visible vs 61 without), already premultiplied, no mipmaps. The shader
  // does the sRGB decode and premultiplied blending instead.
  // o.fx: the layer gets the glitch stage (the PC window, the creator's note 9/26): RGB split along a direction, bands torn
  // sideways, blocks displaced, scanlines. All uniforms, all zero = the plain layer.
  constructor(pxW, pxH, worldW, gain = 1, o = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = pxW; this.canvas.height = pxH;
    this.ctx = ctx2d(this.canvas);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.premultiplyAlpha = true;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    const uniforms = { map: { value: this.tex }, gain: { value: gain }, opacity: { value: 1 } };
    if (o.fx) Object.assign(uniforms, { ca: { value: 0 }, caDir: { value: new THREE.Vector2(1, 0) }, tear: { value: 0 }, block: { value: 0 },
      scan: { value: 0 }, seed: { value: 0 }, frame: { value: 0 } });
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: o.fx ? FX_FRAG : `
        uniform sampler2D map; uniform float gain, opacity; varying vec2 vUv;
        vec3 decode(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
        void main() {
          vec4 p = texture2D(map, vUv);                       // premultiplied, sRGB-encoded
          if (p.a < 0.002) discard;
          float a = p.a * opacity;
          gl_FragColor = vec4(decode(clamp(p.rgb / p.a, 0.0, 1.0)) * gain * a, a);   // premultiplied, linear
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * pxH / pxW), this.mat);
    this.mesh.renderOrder = 10;
  }
  begin() { const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; return c; }
  end() { this.tex.needsUpdate = true; }
}

export const font = (size, fam = DISPLAY, weight = "") => `${weight} ${size}px "${fam}"`.trim();

// per-character decode: each char resolves in order across [t0, t0 + dur]; before it resolves it flickers
// through random glyphs (re-dealt every 2 frames); before it is "typed" at all it is hidden
export function decode(text, t, t0, dur, seed = 1) {
  const n = Math.max(text.length, 1), out = [], step = Math.floor(t * 15);
  for (let i = 0; i < text.length; i++) {
    const c = text[i], tr = t0 + dur * (i + 1) / n, ts = t0 + dur * i / n - 0.12;
    if (c === " " || t >= tr) out.push({ c, state: 1 });
    else if (t < ts) out.push({ c, state: -1 });
    else out.push({ c: GLYPHS[Math.floor(h32(seed, i, step) * GLYPHS.length)], state: 0 });
  }
  return out;
}

// draw a decode result: glyphs sit at the FINAL text's advances, so the scramble never jitters the layout
export function drawDecoded(ctx, text, chars, x, y, { color = C.white, scramble = C.cyan, align = "left", tracking = 0 } = {}) {
  const w = ctx.measureText(text).width + tracking * (text.length - 1);
  let x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    const adv = ctx.measureText(text.slice(0, i)).width + tracking * i;
    if (chars[i].state < 0) continue;
    ctx.fillStyle = chars[i].state ? color : scramble;
    ctx.fillText(chars[i].c, x0 + adv, y);
  }
  return w;
}

// RGB-split + slice-torn text (the price flip, the shouted slams)
const scratch = document.createElement("canvas"), sctx = ctx2d(scratch);
export function drawGlitched(ctx, text, x, y, f, color, amount, seed, { align = "left", split = 1 } = {}) {
  ctx.font = f;
  const m = ctx.measureText(text), w = Math.ceil(m.width) + 80, asc = Math.ceil(m.actualBoundingBoxAscent) + 30, desc = Math.ceil(m.actualBoundingBoxDescent) + 30;
  scratch.width = w; scratch.height = asc + desc;
  const ox = align === "center" ? x - m.width / 2 : align === "right" ? x - m.width : x;
  const layer = (col, dx) => {
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, w, asc + desc);
    sctx.font = f; sctx.fillStyle = col; sctx.textBaseline = "alphabetic"; sctx.fillText(text, 40 + dx, asc);
    // slices: horizontal bands shoved sideways
    const bands = 3 + Math.floor(h32(seed, 7) * 5);
    ctx.save();
    ctx.globalCompositeOperation = col === color ? "source-over" : "lighter";
    for (let b = 0, yy = 0; b < bands; b++) {
      const bh = Math.ceil((asc + desc) / bands);
      const shove = (h32(seed, b, 11) - 0.5) * 2 * amount * 90 * (h32(seed, b, 3) < 0.5 ? 1 : 0.2);
      ctx.drawImage(scratch, 0, yy, w, bh, ox - 40 + shove, y - asc + yy, w, bh);
      yy += bh;
    }
    ctx.restore();
  };
  if (amount > 0.001 && split) { layer("#ff0033", -amount * 26); layer("#00e5ff", amount * 26); }
  layer(color, 0);
}

// typed terminal line: characters appear at their words' sung times; a block cursor blinks after the last
export function drawTyped(ctx, parts, t, x, y, { color = C.ink, cursor = true, lineH = 40 } = {}) {
  // parts: [{text, t}] (each word/piece with the time it appears)
  let cx = x, cy = y;
  ctx.fillStyle = color; ctx.textAlign = "left";
  for (const p of parts) {
    if (p.t > t) break;
    if (p.br) { cx = x; cy += lineH; continue; }
    ctx.fillText(p.text, cx, cy);
    cx += ctx.measureText(p.text).width;
  }
  if (cursor && Math.floor(t * 2.4) % 2 === 0) {
    const m = ctx.measureText("M");
    ctx.fillRect(cx + 4, cy - m.actualBoundingBoxAscent, m.width * 0.62, m.actualBoundingBoxAscent + 4);
  }
}
