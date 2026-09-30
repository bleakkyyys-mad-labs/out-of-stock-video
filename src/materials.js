// Shaders: the screentone GPU, manga speed lines, halftone dots, data-center windows, the backdrop.
import * as THREE from "three";

const HASH = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
`;
const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- the GPU as print: object-space halftone (the dots are printed ON the card and travel with it),
// ink outlines from the silhouette and from the photo's own edges, line tone in the deepest shadows.
export function screentone(tex, o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {
      map: { value: tex }, texSize: { value: new THREE.Vector2(tex.image.width, tex.image.height) },
      pitch: { value: o.pitch ?? 90 },            // dots across the card's width
      angle: { value: o.angle ?? 0.785 },
      invert: { value: o.invert ?? 1 },           // 1 = light dots on dark (bright parts get big dots)
      contrast: { value: o.contrast ?? 1.6 }, gain: { value: o.gain ?? 0.0 },
      ink: { value: new THREE.Color(o.ink ?? 0xe9e4d8) }, inkGain: { value: o.inkGain ?? 1 },
      paper: { value: new THREE.Color(o.paper ?? 0x000000) }, paperAlpha: { value: o.paperAlpha ?? 0 },
      outline: { value: o.outline ?? 0.8 }, detail: { value: o.detail ?? 0.5 }, hatch: { value: o.hatch ?? 0 },
      pump: { value: 0 }, dissolve: { value: 0 }, seed: { value: o.seed ?? 1 },
      spot: { value: new THREE.Vector4(0.5, 0.3, 1.2, 0) },   // xy center (uv), z radius, w strength
      opacity: { value: 1 }, shadow: { value: 0 }, shadowBlur: { value: 5 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec2 texSize; uniform float pitch, angle, invert, contrast, gain, inkGain,
        paperAlpha, outline, detail, hatch, pump, dissolve, seed, opacity, shadow, shadowBlur;
      uniform vec3 ink, paper; uniform vec4 spot;
      varying vec2 vUv;
      ${HASH}
      float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec4 tx = texture2D(map, vUv);
        float a = mix(tx.a, texture2D(map, vUv, shadowBlur).a, shadow);
        if (a < 0.004) discard;
        float L = pow(clamp(lum(tx.rgb), 0.0, 1.0), 0.4545);
        L = clamp((L - 0.5) * contrast + 0.5 + gain, 0.0, 1.0);
        float sp = 1.0 - smoothstep(spot.z * 0.35, spot.z, distance(vUv * vec2(texSize.x / texSize.y, 1.0), spot.xy * vec2(texSize.x / texSize.y, 1.0)));
        float cov = mix(1.0 - L, L, invert) * mix(1.0, sp, spot.w);
        cov = mix(cov, a * 0.85, shadow);
        // dot grid in card space
        vec2 q = vUv * vec2(texSize.x / texSize.y, 1.0) * pitch;
        float cs = cos(angle), sn = sin(angle);
        q = mat2(cs, -sn, sn, cs) * q;
        vec2 cell = floor(q), f = fract(q) - 0.5;
        float r = sqrt(clamp(cov, 0.0, 1.0)) * 0.72 * (1.0 + pump);
        float gone = step(hash12(cell + seed * 17.0), dissolve);
        float aa = max(length(fwidth(q)) * 0.75, 0.02);
        float dotInk = (1.0 - smoothstep(r - aa, r + aa, length(f))) * (1.0 - gone);
        // line tone in the deepest shadows (paper mode) / brightest lights (dark mode)
        float stripe = abs(fract((q.x + q.y) * 0.5) - 0.5);
        float hatchInk = hatch * smoothstep(0.72, 0.9, cov) * (1.0 - smoothstep(0.1 - aa, 0.1 + aa, stripe));
        // ink lines: the silhouette + the photo's own edges (fan blades, fins, the shroud's facets)
        vec2 px = 1.5 / texSize;
        float an = texture2D(map, vUv + vec2(px.x, 0.0)).a + texture2D(map, vUv - vec2(px.x, 0.0)).a
                 + texture2D(map, vUv + vec2(0.0, px.y)).a + texture2D(map, vUv - vec2(0.0, px.y)).a;
        float edgeA = clamp((a * 4.0 - an) * 2.0, 0.0, 1.0) * (1.0 - shadow);
        float l1 = lum(texture2D(map, vUv + vec2(px.x, 0.0)).rgb), l2 = lum(texture2D(map, vUv - vec2(px.x, 0.0)).rgb);
        float l3 = lum(texture2D(map, vUv + vec2(0.0, px.y)).rgb), l4 = lum(texture2D(map, vUv - vec2(0.0, px.y)).rgb);
        float edgeL = smoothstep(0.05, 0.16, length(vec2(l1 - l2, l3 - l4))) * detail * (1.0 - shadow);
        float inkAmt = clamp(max(max(dotInk, hatchInk), max(edgeA * outline, edgeL)), 0.0, 1.0);
        vec3 col = mix(paper, ink * inkGain, inkAmt);
        float alpha = a * mix(inkAmt, 1.0, paperAlpha) * opacity;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

// --- manga focus lines, radiating from a point; they re-deal every frame like hand-drawn cels
export function speedLines(o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    uniforms: {
      color: { value: new THREE.Color(o.color ?? 0xffffff) }, gain: { value: 1 }, alpha: { value: 0.9 },
      center: { value: new THREE.Vector2(0.5, 0.5) }, aspect: { value: 16 / 9 }, count: { value: 180 },
      inner: { value: 0.18 }, density: { value: 0.55 }, width: { value: 0.35 }, seed: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform vec2 center; uniform float gain, alpha, aspect, count, inner, density, width, seed;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 p = (vUv - center) * vec2(aspect, 1.0);
        float r = length(p), a = atan(p.y, p.x) / 6.2831853 + 0.5;
        float id = floor(a * count), f = fract(a * count);
        float on = step(hash12(vec2(id, seed)), density);
        float start = inner + hash12(vec2(id + 3.7, seed)) * 0.35;
        float w = width * (0.25 + hash12(vec2(id + 9.1, seed))) * smoothstep(start, start + 0.9, r);
        float d = abs(f - 0.5) * 2.0, aa = fwidth(f) * 2.5;
        float ink = on * (1.0 - smoothstep(w - aa, w + aa, d)) * smoothstep(start, start + 0.04, r);
        gl_FragColor = vec4(color * gain, ink * alpha);
      }`,
  });
}

// --- round halftone dots as instanced particles (a card's dots torn off and carried away)
export function dots(o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { color: { value: new THREE.Color(o.color ?? 0xffffff) }, gain: { value: 1 }, alpha: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vA;
      attribute float aAlpha;
      void main() { vUv = uv; vA = aAlpha;
        // billboard at draw time: the dot faces the camera that is actually rendering it
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        c.xy += position.xy * length(instanceMatrix[0].xyz);
        gl_Position = projectionMatrix * c; }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float gain, alpha; varying vec2 vUv; varying float vA;
      void main() { float d = length(vUv - 0.5) * 2.0, aa = fwidth(d) * 1.5;
        float m = 1.0 - smoothstep(1.0 - aa, 1.0, d);
        if (m * vA < 0.01) discard;
        gl_FragColor = vec4(color * gain, m * vA * alpha); }`,
  });
}

// --- a data-center block: dark mass, a grid of window dots that strobe with the kick
export function building(o = {}) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      body: { value: new THREE.Color(o.body ?? 0x0b0910) }, win: { value: new THREE.Color(o.win ?? 0xff2a3d) },
      cells: { value: new THREE.Vector2(o.cols ?? 8, o.rows ?? 20) }, lit: { value: 0.45 }, gain: { value: 1.6 },
      seed: { value: o.seed ?? 0 }, tick: { value: 0 }, kick: { value: 0 }, fog: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform vec3 body, win; uniform vec2 cells; uniform float lit, gain, seed, tick, kick, fog;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 q = vUv * cells, c = floor(q), f = fract(q) - 0.5;
        float on = step(hash12(c + seed * 13.1 + floor(tick) * 0.37), lit + kick * 0.35);
        float d = length(f * vec2(1.0, 1.4)), aa = fwidth(d) * 1.5;
        float w = (1.0 - smoothstep(0.26 - aa, 0.26 + aa, d)) * on;
        vec3 col = mix(body, win * gain * (0.55 + kick * 0.9), w);
        col = mix(col, vec3(0.0), fog);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// --- the spectrum bars (the intro, 9/27; the reference visualizer): instanced boxes drawn as
// wireframes (the reference's outline mode: every face's edges, a faint fill), glowing past white so they bloom. Per bar:
// aVal = its band's value (brightness), aHue = where it sits on the cyan -> pink ramp, aHot = the spinner's lit segment
export function specBars() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      colA: { value: new THREE.Color(0x5ef2ff) }, colB: { value: new THREE.Color(0xff3d8b) }, hot: { value: new THREE.Color(0xffb21e) },
      gain: { value: 1.6 }, fill: { value: 0.1 }, alpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aVal; attribute float aHue; attribute float aHot;
      varying vec2 vUv; varying float vVal, vHue, vHot;
      void main() { vUv = uv; vVal = aVal; vHue = aHue; vHot = aHot;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 colA, colB, hot; uniform float gain, fill, alpha;
      varying vec2 vUv; varying float vVal, vHue, vHot;
      void main() {
        vec2 d = min(vUv, 1.0 - vUv), w = fwidth(vUv) * 1.4;
        float e = max(1.0 - smoothstep(w.x * 0.5, w.x * 1.5, d.x), 1.0 - smoothstep(w.y * 0.5, w.y * 1.5, d.y));
        vec3 col = mix(mix(colA, colB, vHue), hot, vHot) * gain * (0.35 + 0.9 * vVal + vHot);
        float a = alpha * (e + fill * (0.3 + vVal));
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// --- the neon floor (the intro): a grid on the ground plane in world units, minor lines cyan, every fourth pink,
// fading out with distance from the card; it scrolls toward the camera and pulses on the synth's notes
export function neonGrid() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {
      minor: { value: new THREE.Color(0x2fd8ff) }, major: { value: new THREE.Color(0xff3d8b) },
      gain: { value: 1 }, scroll: { value: 0 }, pulse: { value: 0 }, fade: { value: 9 }, alpha: { value: 1 },
      center: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 minor, major; uniform vec2 center; uniform float gain, scroll, pulse, fade, alpha;
      varying vec3 vW;
      float lines(vec2 p) { vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(1e-4)); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main() {
        vec2 p = vW.xz + vec2(0.0, scroll);
        float mi = lines(p), ma = lines(p * 0.25);
        float r = length(vW.xz - center), f = exp(-r / fade);
        vec3 col = (minor * mi * 0.55 + major * ma * 1.2) * gain * (1.0 + pulse * 1.6) * f;
        float a = alpha * max(mi, ma) * f;
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// --- the backdrop, drawn first in screen space: dark room / night haze / paper
export function backdrop() {
  return new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      mode: { value: new THREE.Vector3(1, 0, 0) },       // weights: dark, night, paper
      res: { value: new THREE.Vector2(1920, 1080) }, frame: { value: 0 },
      haze: { value: new THREE.Color(0xff1d3a) }, hazeAmt: { value: 0.35 },
      shaft: { value: new THREE.Vector4(0.62, 1.2, 0.18, 0) },  // x, top y, width, strength (paper light shaft)
      grid: { value: 0.0 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 mode; uniform vec2 res; uniform float frame, hazeAmt, grid; uniform vec3 haze; uniform vec4 shaft;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 p = vUv - 0.5; p.x *= res.x / res.y;
        // dark room: near-black, a faint lift in the middle, a hairline grid
        vec3 dark = vec3(0.0045, 0.004, 0.006) * (1.0 + 1.2 * smoothstep(0.9, 0.0, length(p)));
        vec2 g = abs(fract(vUv * vec2(48.0, 27.0)) - 0.5);
        dark += grid * vec3(0.008, 0.009, 0.013) * (1.0 - smoothstep(0.0, 0.03, min(g.x, g.y)));
        // night: black with a red haze rising from the bottom (the buildings' glow)
        vec3 night = vec3(0.004, 0.002, 0.006) + haze * hazeAmt * pow(smoothstep(0.7, 0.0, vUv.y), 2.2) * 0.35;
        // paper: warm bone, fibres, a soft light shaft
        float fib = vnoise(vUv * vec2(900.0, 160.0)) * 0.5 + vnoise(vUv * vec2(140.0, 900.0)) * 0.5;
        vec3 paper = vec3(0.80, 0.76, 0.68) * (0.94 + 0.06 * fib) * (1.0 - 0.12 * length(p));
        float sx = (vUv.x - shaft.x) + (1.0 - vUv.y) * 0.35;
        paper *= 1.0 + shaft.w * 0.18 * exp(-sx * sx / (shaft.z * shaft.z));
        vec3 col = dark * mode.x + night * mode.y + paper * mode.z;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
