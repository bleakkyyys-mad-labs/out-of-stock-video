// The stage: every persistent object, built once. Shots only move, show, hide and re-ink them.
import * as THREE from "three";
import { screentone, speedLines, dots, building, backdrop, specBars, neonGrid } from "./materials.js";
import { TypeLayer } from "./type.js";
import { h32 } from "./song.js";
import { buildDancer, portraitMaterial, stillTex, censorOf, showStill, MASK_LAYER } from "./dancer.js";
import { GW, GH } from "./gui.js";
import { initFast } from "./fastcut.js";
import { W, H, PORTRAIT } from "./frame.js";

const CLIP = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export async function buildStage(renderer) {
  const S = { cut: {} };
  S.scene = new THREE.Scene();
  S.camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);

  // screen-space layers drawn before the 3D scene: backdrop, then speed lines
  S.bgScene = new THREE.Scene();
  S.bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdrop());
  S.speed = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), speedLines());
  S.speed.material.vertexShader = CLIP;
  S.speed.material.uniforms.aspect.value = W / H;
  for (const m of [S.bg, S.speed]) { m.frustumCulled = false; S.bgScene.add(m); }
  S.bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // the chorus's sheet (chorus.js, 9/29): the blueprint and its buildings, full frame, after the backdrop and before the
  // focus lines, so everything in the scene -- the storm, the AltMan, the answer -- stands in front of the drawing
  S.sheet = new TypeLayer(W, H, 2, 1);
  S.sheet.mesh.geometry.dispose(); S.sheet.mesh.geometry = new THREE.PlaneGeometry(2, 2);
  S.sheet.mat.vertexShader = CLIP;
  S.sheet.mesh.frustumCulled = false; S.sheet.mesh.visible = false;
  S.sheet.mesh.renderOrder = 1; S.speed.renderOrder = 2;
  S.bgScene.add(S.sheet.mesh);

  // overlay (HUD) in pixel units. The HUD follows the frame (frame.js); the full-frame layers below stay 1920x1080,
  // because their shots were only ever designed for 16:9
  S.overlay = new THREE.Scene();
  S.ocam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
  S.hud = new TypeLayer(W, H, W, 1);
  S.overlay.add(S.hud.mesh);
  S.shatter = new TypeLayer(1920, 1080, 1920, 1);     // step 25's BUILD, which breaks across the cut into step 26
  S.shatter.mesh.renderOrder = 11; S.shatter.mesh.visible = false;
  S.overlay.add(S.shatter.mesh);
  S.fast = new TypeLayer(1920, 1080, 1920, 1);        // the fast cut's full-frame cards (fastcut.js), under the HUD
  S.fast.mesh.renderOrder = 9; S.fast.mesh.visible = false;
  S.overlay.add(S.fast.mesh);
  S.introFx = new TypeLayer(1920, 1080, 1920, 1);     // the intro's screen furniture (intro.js): the cursor, the bots, the stock
  S.introFx.mesh.renderOrder = 8; S.introFx.mesh.visible = false;
  S.overlay.add(S.introFx.mesh);
  // verse 2's ascent (ascent.js): the price trail in 3D, the drawing sheet, the diagrams. Its own layer, with the
  // glitch stage on, so the chromatic aberration climbs with the panic without touching the fast cut's shader
  S.asc = new TypeLayer(1920, 1080, 1920, 1, { fx: true });
  S.asc.mesh.renderOrder = 9; S.asc.mesh.visible = false;
  S.overlay.add(S.asc.mesh);
  // verse 3's end (meltdown.js): the sales agent's ring back and coming apart, the pile of bills, the held word that
  // falls into the last chorus. Its own layer with the glitch stage on, over the chapter shot and under the HUD
  S.melt = new TypeLayer(1920, 1080, 1920, 1.1, { fx: true });
  S.melt.mesh.renderOrder = 9; S.melt.mesh.visible = false;
  S.overlay.add(S.melt.mesh);
  // the chorus's two questions (chorus.js): over the scene, under the HUD. Laid out at 16:9; the portrait frame (the creator's X
  // clip, drop-only) shows it at the frame's width
  S.lock = new TypeLayer(1920, 1080, 1920, 1);
  S.lock.mesh.renderOrder = 9; S.lock.mesh.visible = false;
  if (PORTRAIT) S.lock.mesh.scale.setScalar(W / 1920);
  S.overlay.add(S.lock.mesh);
  // the mascot (the creator's ask, 9/29; director.js crab): Claude Code's orange crab, a tiny canvas shown in whole pixels, over
  // the HUD, and on the mask layer so the video's fade leaves it alone like the AltMan
  S.crab = new TypeLayer(20, 7, 240, 1.6);
  S.crab.tex.magFilter = S.crab.tex.minFilter = THREE.NearestFilter;
  S.crab.mesh.renderOrder = 12; S.crab.mesh.visible = false; S.crab.mesh.layers.enable(MASK_LAYER);
  S.overlay.add(S.crab.mesh);

  // the photographs, as print
  const loader = new THREE.TextureLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
  S.tex = {};
  await Promise.all(window.OOS_CUTOUTS.map(async c => {
    const t = await loader.loadAsync(c.tex);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    S.tex[c.key] = t; S.cut[c.key] = c;
  }));
  const card = (key, o) => {
    const c = S.cut[key], m = new THREE.Mesh(new THREE.PlaneGeometry(c.aspect, 1), screentone(S.tex[key], o));
    const U = m.material.uniforms, d = {};
    for (const k in U) d[k] = U[k].value && U[k].value.clone && !U[k].value.isTexture ? U[k].value.clone() : U[k].value;
    m.userData.defaults = d;                    // place() resets to these: no frame inherits another's ink
    m.visible = false; m.userData.key = key; S.scene.add(m); return m;
  };
  S.cards = {};
  for (const c of window.OOS_CUTOUTS) S.cards[c.key] = card(c.key);
  // the storm: copies of the whole cards (not the close-ups) thrown around on the drops
  const whole = ["rtx3090", "rtx3070", "radeon7790", "gtx1080ti", "rog-pair", "pile"];
  S.storm = Array.from({ length: 18 }, (_, i) => card(whole[i % whole.length], { seed: i + 3 }));
  // ... and the memory sticks thrown in with them (the creator's note, 9/26: the song is half about RAM)
  const sticks = ["fury-ddr4", "z5-black", "samsung-ddr4", "fury-ddr5", "dominator", "micron-rdimm", "z5-white",
    "ddr4-16g", "hynix-mrdimm", "fury-white", "z5-stack", "fury-ddr4-back"];
  S.ramStorm = sticks.map((k, i) => card(k, { seed: i + 41 }));

  // the buildings: a skyline of data-center blocks, window dots on every face
  S.skyline = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const mid = 1 - Math.abs(i - 10.5) / 11;                // the towers loom tallest in the middle
    const w = 1.1 + h32(i, 1) * 1.6, h = 5 + h32(i, 2) * 8 + mid * 9, d = 1.5 + h32(i, 3) * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), building({ cols: Math.round(w * 3), rows: Math.round(h * 3), seed: i }));
    b.position.set((i - 10.5) * 2.5 + (h32(i, 4) - 0.5) * 1.0, h / 2, -h32(i, 5) * 6);
    b.userData.h = h;
    S.skyline.add(b);
  }
  S.skyline.visible = false;
  S.scene.add(S.skyline);

  // loose halftone dots
  const N = 1400, geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1));
  S.dots = new THREE.InstancedMesh(geo, dots(), N);
  S.dots.frustumCulled = false; S.dots.visible = false; S.dots.renderOrder = 5;
  S.scene.add(S.dots);

  // the intro (9/27): the plugin's Visualizer's ring of spectrum bars (96 = 48 bands mirrored) and the neon floor
  const RING = 96, bgeo = new THREE.BoxGeometry(1, 1, 1);
  for (const a of ["aVal", "aHue", "aHot"]) bgeo.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(RING), 1));
  S.ring = new THREE.InstancedMesh(bgeo, specBars(), RING);
  S.ring.frustumCulled = false; S.ring.visible = false; S.ring.renderOrder = 3;
  S.scene.add(S.ring);
  S.floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), neonGrid());
  S.floor.rotation.x = -Math.PI / 2; S.floor.frustumCulled = false; S.floor.visible = false; S.floor.renderOrder = -2;
  S.scene.add(S.floor);

  // type planes (canvas px, world width, bloom gain)
  S.type = {
    label: new TypeLayer(1024, 256, 5, 1.2),
    head: new TypeLayer(2048, 640, 10, 1.35),
    big: new TypeLayer(2048, 1024, 12, 1.5),
    small: new TypeLayer(2048, 512, 10, 1.0),
    chart: new TypeLayer(1024, 1024, 5, 1.35),
    ghost: new TypeLayer(2048, 2048, 8, 1.0),
    aux: new TypeLayer(2048, 512, 10, 1.0),
    screen: new TypeLayer(GW, GH, 6.3, 1.12, { fx: true }),   // the PC: the verses' browser window (gui.js), glitch stage on
    candles: new TypeLayer(2048, 1024, 17, 0.9),     // verse 2's stock chart, far back
  };
  if (PORTRAIT) S.type.tall = new TypeLayer(1152, 2048, 10.25, 1.5);   // the drop's answer in the portrait frame (frame.js)
  for (const k in S.type) { S.type[k].mesh.visible = false; S.scene.add(S.type[k].mesh); }

  // the AltMan: his neutral portrait, his smirk (the still the dance was traced from), and the dance, cut out
  S.dancer = await buildDancer("roto/altman", { norm: "characters/altman/The-AltMan-Norm-BG-Masked.png" }, 9.5);
  S.dancer.meshes.forEach(m => S.scene.add(m));

  // the CEO for step 14 (the creator's GPT-Image 2 art, 9/26): the suit, then the jacket; same size, so one plane flips between them
  const img = async url => createImageBitmap(await (await fetch(url)).blob());
  const [suit, jacket] = await Promise.all(["characters/leatherjacketman/LeatherJacketMan-Suit-BG-Masked.png",
    "characters/leatherjacketman/LeatherJacketMan-BG-Masked.png"].map(img));
  const cgeo = new THREE.PlaneGeometry(suit.width / suit.height, 1);
  // his face under a mosaic in both (the creator's ask, 9/26): the head boxes from tools/face-box.py, [u0, v0, u1, v1]
  S.ceo = { tex: { suit: censorOf(stillTex(suit), [0.3887, 0.8453, 0.5703, 0.9978]),
                   jacket: censorOf(stillTex(jacket), [0.4058, 0.8569, 0.5995, 0.9940]) } };
  S.ceo.mesh = new THREE.Mesh(cgeo, portraitMaterial(false, S.ceo.tex.suit));
  S.ceo.mesh.renderOrder = -1;
  S.ceo.ghosts = Array.from({ length: 4 }, (_, i) => { const g = new THREE.Mesh(cgeo, portraitMaterial(true, S.ceo.tex.suit)); g.renderOrder = 2 + i; return g; });
  S.ceo.meshes = [S.ceo.mesh, ...S.ceo.ghosts];
  S.ceo.meshes.forEach(m => { showStill(m, S.ceo.tex.suit); m.visible = false; S.scene.add(m); });   // censored from birth
  // verse 2 (ascent.js): the creator's generated podcasters and props, screen-printed onto the drawing sheet
  const HIS = { pod1: "characters/podcasters/rando-podcaster.png",
    pod2cut: "characters/podcasters/rando-podcaster-002-bg-extracted.png", pod3: "characters/podcasters/rando-podcaster-003.png",
    pod4: "characters/podcasters/rando-podcaster-004.png", bell: "characters/props/bell.png", derrick: "characters/props/compute-oil-derrick.png",
    well: "characters/props/trad-water-well.png" };
  S.his = {};
  await Promise.all(Object.entries(HIS).map(async ([k, u]) => { S.his[k] = await img(u); }));
  initFast(S, S.fast);                                  // its patterns and prints, made once (needs the textures above)
  return S;
}

// hide everything; a shot turns on what it uses
export function resetStage(S) {
  for (const k in S.cards) S.cards[k].visible = false;
  S.storm.forEach(m => { m.visible = false; }); S.ramStorm.forEach(m => { m.visible = false; });
  S.skyline.visible = false; S.dots.visible = false; S.speed.visible = false; S.dancer.meshes.forEach(m => { m.visible = false; });
  S.ceo.meshes.forEach(m => { m.visible = false; }); S.shatter.mesh.visible = false; S.fast.mesh.visible = false;
  S.ring.visible = false; S.floor.visible = false; S.introFx.mesh.visible = false; S.asc.mesh.visible = false; S.melt.mesh.visible = false;
  S.sheet.mesh.visible = false; S.lock.mesh.visible = false; S.crab.mesh.visible = false;
  for (const k in S.type) { const L = S.type[k]; L.mesh.visible = false; L.mesh.rotation.set(0, 0, 0); L.mesh.scale.setScalar(1); L.mat.uniforms.opacity.value = 1; }
}

// put a card at a place, height h (world units), with screentone settings
export function place(m, pos, rot, h, u = {}) {
  m.visible = true;
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.scale.setScalar(h);
  m.renderOrder = u.order ?? 0;
  const U = m.material.uniforms, D = m.userData.defaults;
  for (const k in D) { if (D[k] && D[k].copy && !D[k].isTexture) U[k].value.copy(D[k]); else U[k].value = D[k]; }
  for (const k in u) {
    if (k === "order") continue;
    if (U[k].value && U[k].value.isColor) U[k].value.set(u[k]);
    else if (U[k].value && U[k].value.isVector4) U[k].value.set(...u[k]);
    else U[k].value = u[k];
  }
  return m;
}
