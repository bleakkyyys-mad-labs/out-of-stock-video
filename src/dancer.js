// The dancer: the creator's GPT-Image 2 portraits and the rotoscoped dance (roto/roto.js, the approved final look: print ink,
// blue pencil on), cut out (no paper: the creator's call, 9/25 night) and standing in the 3D scene.
//   mesh      the roto canvas (the print pass and the dance); the canvas uploads only when the cel changes
//   portrait  the creator's portraits at full resolution for the entrance, the turn and the close-up (the 1080 canvas goes
//             soft when the camera goes to his face); its geometry is offset so it lines up exactly with where the
//             canvas draws the still, so the hand-over from one to the other doesn't move him
//   ghosts    afterimages: portrait copies the director places along his path and through the spin
import * as THREE from "three";
import { loadRoto } from "../roto/roto.js";
import { EXACT } from "./type.js";

const HASH = `float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;
const GHOSTS = 6;

// a canvas-backed texture on the type layers' upload path (plain RGBA8, premultiplied, sRGB decoded in the shader),
// WITH mipmaps: he shows at under his pixels most of the time and unfiltered halftone would shimmer into moire
export function texOf(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}
// one of the creator's illustrations as a texture, drawn once, uploaded once
export const stillTex = img => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); return texOf(c); };

// the censor (the creator's ask, 9/26, OOS-0001 row 11): a mosaic over a still's head, in the texture's own space, so it rides
// every move, flip and afterimage the plane makes. The box = [u0, v0, u1, v1] in the plane's uv (v = 0 at the image's
// bottom), measured off the art's alpha by tools/face-box.py; blocks are square in the art's pixels, `across` of them
// over the box's width. A still without one draws as it always did.
export const censorOf = (tex, box, across = 8) => {
  const { width: W, height: H } = tex.image, px = (box[2] - box[0]) * W / across;
  tex.userData.censor = { box: new THREE.Vector4(...box), cell: new THREE.Vector2(px / W, px / H) };
  return tex;
};
const NO_CENSOR = { box: new THREE.Vector4(), cell: new THREE.Vector2() };
// hand a portrait plane (or a ghost) its still, and that still's censor with it
export const showStill = (m, tex) => {
  const U = m.material.uniforms, c = tex.userData.censor ?? NO_CENSOR;
  U.map.value = tex; U.censor.value.copy(c.box); U.cell.value.copy(c.cell);
};

// a character's portrait (or its afterimage): glitch bands, the RGB split, a tint for the afterimages
export const portraitMaterial = (ghost, map) => new THREE.ShaderMaterial({
  transparent: true, toneMapped: false, side: THREE.DoubleSide,
  // him: writes depth, so the words behind him stay behind and cards in front stay in front; the afterimages don't
  depthWrite: !ghost,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  uniforms: { map: { value: map }, gain: { value: 1 }, opacity: { value: 1 }, glitch: { value: 0 }, frame: { value: 0 },
              tint: { value: new THREE.Color(0xff2a3d) }, tintAmt: { value: 0 }, white: { value: 0 },
              censor: { value: new THREE.Vector4() }, cell: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D map; uniform float gain, opacity, glitch, frame, tintAmt, white; uniform vec3 tint; uniform vec4 censor; uniform vec2 cell;
    varying vec2 vUv;
    ${HASH}
    vec3 decode(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
    // inside the censor box every sample is its block's average (16 taps, full resolution, premultiplied); a block is
    // in or out by its coverage, so the head reads as squares, edge included, never as a blur of the face
    vec4 tap(vec2 uv) {
      vec4 p = texture2D(map, uv);    // outside the branch: an implicit-LOD sample needs uniform control flow
      if (cell.x > 0.0 && uv.x > censor.x && uv.x < censor.z && uv.y > censor.y && uv.y < censor.w) {
        vec2 c0 = censor.xy + floor((uv - censor.xy) / cell) * cell;
        vec4 s = vec4(0.0);
        for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) s += textureLod(map, c0 + (vec2(i, j) + 0.5) * 0.25 * cell, 0.0);
        s *= 1.0 / 16.0;
        float k = smoothstep(0.15, 0.45, s.a);
        return s.a > 0.002 ? vec4(s.rgb / s.a * k, k) : vec4(0.0);
      }
      return p;
    }
    vec4 px(vec2 uv) { vec4 p = tap(uv); return vec4(p.a > 0.002 ? decode(clamp(p.rgb / p.a, 0.0, 1.0)) : vec3(0.0), p.a); }
    void main() {
      vec2 uv = vUv;
      if (glitch > 0.002) {         // bands shoved sideways, blocks dropped out, the plates split (> 0.002: see post.js)
        float rows = 12.0 + floor(hash12(vec2(frame, 3.0)) * 28.0), band = floor(uv.y * rows);
        if (hash12(vec2(band, frame)) < glitch * 0.8) uv.x += (hash12(vec2(band + 7.0, frame)) - 0.5) * 0.4 * glitch;
        vec2 blk = floor(vUv * vec2(9.0, 11.0));
        if (hash12(blk + frame * 1.7) < glitch * glitch * 0.3) discard;
        if (uv.x < 0.0 || uv.x > 1.0) discard;
      }
      float sp = glitch * 0.025;
      vec4 r = px(uv + vec2(sp, 0.0)), g = px(uv), b = px(uv - vec2(sp, 0.0));
      float a = max(g.a, max(r.a, b.a) * step(0.001, glitch)) * opacity;
      if (a < 0.02) discard;
      vec3 c = mix(vec3(r.r, g.g, b.b), tint * dot(vec3(r.r, g.g, b.b), vec3(0.3, 0.55, 0.15)) * 1.6, tintAmt);
      if (white > 0.0) c = mix(c, vec3(1.0), white);          // burning white: the last exit's squeeze into a beam
      gl_FragColor = vec4(c * gain * a, a);
    }`,
});

// the beam he teleports out on (the creator's "glitching out like Megaman", 9/29): a white-hot column, the video's red and cyan split
// off its edges, the trailing end fading, its bands flickering. Added on top (it glows through the bloom); its alpha
// marks it for the mask pass, so the video's fade leaves it alone like him. A unit plane, placed and stretched per frame
const beamMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  uniforms: { frame: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float frame; varying vec2 vUv;
    ${HASH}
    void main() {
      float x = (vUv.x - 0.5) * 2.0;
      float core = 1.0 - smoothstep(0.08, 0.18, abs(x));
      float red = 1.0 - smoothstep(0.08, 0.3, abs(x + 0.26)), cyan = 1.0 - smoothstep(0.08, 0.3, abs(x - 0.26));
      float glow = exp(-abs(x) * 4.5);
      float along = smoothstep(0.0, 0.4, vUv.y) * (0.8 + 0.2 * step(0.45, hash12(vec2(floor(vUv.y * 40.0), frame))));
      vec3 c = vec3(2.6) * core + vec3(1.0, 0.16, 0.24) * red * 2.0 + vec3(0.37, 0.95, 1.0) * cyan * 2.0 + vec3(0.5) * glow;
      float a = clamp(core + max(red, cyan) * 0.7 + glow * 0.4, 0.0, 1.0) * along;
      gl_FragColor = vec4(c * along, a);
    }`,
});
export const MASK_LAYER = 1;       // the AltMan and his beam are on this layer too: main.js draws it alone for the fade's mask

export async function buildDancer(base, portraits, worldH) {
  const cv = document.createElement("canvas");
  // captures raster him on the CPU, like every canvas in a capture (type.js, EXACT)
  const R = await loadRoto(base, cv, { film: false, grain: false, ground: "none", floor: "#ff2a3d", portraits, exact: EXACT });
  const tex = texOf(cv);
  const P = { norm: stillTex(R.images.norm), smug: stillTex(R.images.still) };     // drawn once, uploaded once
  const material = portraitMaterial;
  const k = worldH / R.canvas.width, s = R.stillRect;
  const geo = new THREE.PlaneGeometry(worldH, worldH);
  const pgeo = new THREE.PlaneGeometry(s.w * k, s.h * k).translate((s.x + s.w / 2 - R.canvas.width / 2) * k, (R.canvas.height / 2 - s.y - s.h / 2) * k, 0);
  const mesh = new THREE.Mesh(geo, material(false, tex)), portrait = new THREE.Mesh(pgeo, material(false, P.norm));
  mesh.renderOrder = portrait.renderOrder = -1;
  const ghosts = Array.from({ length: GHOSTS }, (_, i) => { const g = new THREE.Mesh(pgeo, material(true, P.norm)); g.renderOrder = 2 + i; return g; });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), beamMaterial());
  beam.renderOrder = 2 + GHOSTS;
  const f = R.stillFace;                                   // the face, in the rig's own world units (from its centre)
  const face = f && { x: ((f[0] + f[2]) / 2 - R.canvas.width / 2) * k, y: (R.canvas.height / 2 - (f[1] + f[3]) / 2) * k, h: (f[3] - f[1]) * k };
  const meshes = [mesh, portrait, ...ghosts, beam];
  meshes.forEach(m => { m.visible = false; m.layers.enable(MASK_LAYER); });
  let key = null;
  return {
    R, mesh, mat: mesh.material, portrait, P, ghosts, beam, meshes, face,
    px: k,                                                 // world units per canvas pixel (the canvas is centred on the mesh)
    // draw(key, fn): fn(R) renders the cel; a cel already on the canvas is not drawn or uploaded again
    draw(k2, fn) { if (k2 !== key) { fn(R); key = k2; tex.needsUpdate = true; } },
  };
}
