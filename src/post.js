// The film stock: bloom with red halation, chromatic aberration, slice glitches, the kick flash,
// gate weave, vignette, and grain added in display space (where film grain actually lives).
import * as THREE from "three";

const FS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const HASH = `float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

export const FILM = {   // defaults; shots override per frame
  bloom: 0.9, bloomThreshold: 0.85, halation: 0.35, ca: 0.0015, glitch: 0, flash: 0, exposure: 1,
  vignette: 0.55, grain: 0.075, weave: 0.6, lift: 0.0, invert: 0,     // invert: the manga impact frame (0..1)
  crt: 0,        // verse 2's terminal (terminal.js): scanlines every 3 px, a faint RGB phosphor mask, a slow rolling bar;
                 // multiplied over the picture before the bloom is added, so the glow stays smooth (the look from the creator's
                 // reference, bizarro/evangelion's makeScanPass)
  fade: 1,       // the video's end (song.js fadeAt): the finished picture times this, grain and all, except where the
                 // mask pass drew the AltMan (the creator's call, 9/29: he stays at 100% while the world fades around him)
};

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer;
    const rt = (x, y) => new THREE.WebGLRenderTarget(x, y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.maskRT = new THREE.WebGLRenderTarget(w, h, { samples: 4 });       // alpha = where the fade leaves the picture alone
    this.levels = [2, 4, 8, 16].map(d => [rt(w / d, h / d), rt(w / d, h / d)]);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = (uniforms, frag) => new THREE.ShaderMaterial({ uniforms, vertexShader: FS, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.bright = mat({ src: { value: null }, threshold: { value: 1 }, knee: { value: 0.35 } }, `
      uniform sampler2D src; uniform float threshold, knee; varying vec2 vUv;
      void main() { vec3 c = texture2D(src, vUv).rgb; float b = max(max(c.r, c.g), c.b);
        float s = clamp(b - threshold + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-4);
        gl_FragColor = vec4(c * max(s, b - threshold) / max(b, 1e-4), 1.0); }`);
    this.down = mat({ src: { value: null }, texel: { value: new THREE.Vector2() } }, `
      uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
      void main() { vec3 s = texture2D(src, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(src, vUv + texel * vec2(0.5, -0.5)).rgb
        + texture2D(src, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(src, vUv + texel * vec2(0.5, 0.5)).rgb;
        gl_FragColor = vec4(s * 0.25, 1.0); }`);
    this.blur = mat({ src: { value: null }, dir: { value: new THREE.Vector2() } }, `
      uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
      void main() { vec3 s = texture2D(src, vUv).rgb * 0.2270270;
        s += (texture2D(src, vUv + dir * 1.3846154).rgb + texture2D(src, vUv - dir * 1.3846154).rgb) * 0.3162162;
        s += (texture2D(src, vUv + dir * 3.2307692).rgb + texture2D(src, vUv - dir * 3.2307692).rgb) * 0.0702703;
        gl_FragColor = vec4(s, 1.0); }`);
    const u = { scene: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null },
      res: { value: new THREE.Vector2(w, h) }, frame: { value: 0 }, mask: { value: this.maskRT.texture }, masked: { value: 0 } };
    for (const k in FILM) u[k] = { value: FILM[k] };
    this.final = mat(u, `
      uniform sampler2D scene, b0, b1, b2, b3, mask; uniform vec2 res;
      uniform float frame, bloom, halation, ca, glitch, flash, exposure, vignette, grain, weave, lift, invert, crt, fade, masked;
      varying vec2 vUv;
      ${HASH}
      vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec2 uv = vUv + (vec2(hash12(vec2(frame, 1.0)), hash12(vec2(frame, 2.0))) - 0.5) * weave / res;
        float tear = 0.0;
        if (glitch > 0.002) {         // (not > 0: a decaying glitch never reaches 0, and a hash can land on exactly 0.0)
          float rows = 14.0 + floor(hash12(vec2(frame, 9.0)) * 34.0);
          float band = floor(uv.y * rows);
          if (hash12(vec2(band, frame)) < glitch * 0.55) {
            float off = (hash12(vec2(band + 5.0, frame)) - 0.5) * 0.16 * glitch;
            uv.x += off; tear = min(abs(off) * 30.0, 1.0);
          }
          vec2 blk = floor(uv * vec2(24.0, 13.5));
          if (hash12(blk + frame * 1.37) < glitch * 0.05) {
            uv = (blk + vec2(hash12(blk + 2.0), hash12(blk + 4.0))) / vec2(24.0, 13.5) + fract(uv * vec2(24.0, 13.5)) / vec2(24.0, 13.5);
            tear = 1.0;
          }
        }
        vec2 d = uv - 0.5;
        float k = ca * (0.25 + dot(d, d) * 1.5) + tear * 0.004;
        vec3 col = vec3(texture2D(scene, uv + d * k + vec2(tear * 0.004, 0.0)).r, texture2D(scene, uv).g,
                        texture2D(scene, uv - d * k - vec2(tear * 0.004, 0.0)).b);
        if (crt > 0.002) {             // the terminal's screen: scanlines, phosphor columns, a bar rolling down
          float line = 0.5 + 0.5 * cos(gl_FragCoord.y * 2.0943951);
          vec3 m = vec3(1.0 - crt * (1.0 - line) * 0.9);
          float px = mod(floor(gl_FragCoord.x), 3.0);
          m *= 1.0 - crt * 0.12 * vec3(px == 0.0 ? 0.0 : 1.0, px == 1.0 ? 0.0 : 1.0, px == 2.0 ? 0.0 : 1.0);
          float roll = crt * 0.18 * smoothstep(0.0, 1.0, 1.0 - abs(fract(vUv.y * 0.6 - frame / 30.0 * 0.12) - 0.5) * 8.0);
          col *= m + roll;
        }
        vec3 bl = texture2D(b0, uv).rgb * 0.55 + texture2D(b1, uv).rgb * 0.45 + texture2D(b2, uv).rgb * 0.35 + texture2D(b3, uv).rgb * 0.3;
        col += bl * bloom + bl * vec3(1.0, 0.25, 0.1) * halation;
        col *= exposure * (1.0 + flash * 1.4);
        col += flash * vec3(0.05, 0.035, 0.04);
        col *= mix(1.0, smoothstep(1.2, 0.2, length(d * vec2(1.3, 1.0)) * 1.3), vignette);
        col = col / (1.0 + max(col - 0.85, 0.0) * 0.7);
        vec3 s = toSRGB(col);
        s = lift + s * (1.0 - lift);
        s = mix(s, 1.0 - s, invert);
        vec2 gp = floor(gl_FragCoord.xy / 1.35);
        float n = hash12(gp + fract(frame * 0.618034) * 997.0) + hash12(gp * 1.37 + fract(frame * 0.414214) * 571.0) - 1.0;
        float Y = dot(s, vec3(0.2126, 0.7152, 0.0722));
        s += n * grain * (0.45 + 0.55 * smoothstep(0.02, 0.3, Y) * (1.0 - smoothstep(0.75, 1.1, Y)));
        float keep = masked > 0.5 ? texture2D(mask, uv).a : 0.0;
        s *= mix(fade, 1.0, keep);
        gl_FragColor = vec4(s, 1.0);
      }`);
  }
  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }

  // draw(renderer) renders the frame's layers into the scene target; P = film parameters for this frame; drawMask
  // (optional) renders what the fade must leave alone into the mask target
  render(draw, P, frame, drawMask) {
    const r = this.r;
    if (drawMask) {
      r.setRenderTarget(this.maskRT); r.setClearColor(0x000000, 0); r.clear(true, true, true);
      r.autoClear = false; drawMask(r); r.autoClear = true;
    }
    this.final.uniforms.masked.value = drawMask ? 1 : 0;
    r.setRenderTarget(this.sceneRT); r.setClearColor(0x000000, 1); r.clear(true, true, true);
    r.autoClear = false; draw(r); r.autoClear = true;
    this.bright.uniforms.src.value = this.sceneRT.texture;
    this.bright.uniforms.threshold.value = P.bloomThreshold;
    this.pass(this.bright, this.levels[0][0]);
    this.levels.forEach(([a, b], i) => {
      if (i > 0) {
        const p = this.levels[i - 1][0];
        this.down.uniforms.src.value = p.texture; this.down.uniforms.texel.value.set(1 / p.width, 1 / p.height);
        this.pass(this.down, a);
      }
      this.blur.uniforms.src.value = a.texture; this.blur.uniforms.dir.value.set(1 / a.width, 0); this.pass(this.blur, b);
      this.blur.uniforms.src.value = b.texture; this.blur.uniforms.dir.value.set(0, 1 / a.height); this.pass(this.blur, a);
    });
    const u = this.final.uniforms;
    u.scene.value = this.sceneRT.texture;
    ["b0", "b1", "b2", "b3"].forEach((k, i) => { u[k].value = this.levels[i][0].texture; });
    u.frame.value = frame;
    for (const k in FILM) u[k].value = P[k] ?? FILM[k];
    this.pass(this.final, null);
  }
}
