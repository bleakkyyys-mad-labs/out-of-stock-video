# Working on this repository

This is the engine, scenes, tools and timing data of OUT OF STOCK, a 4:05 music video rendered frame by frame by a browser from JavaScript. Read `README.md` first for what it is and how it works. This file is for anyone (person or coding agent) about to change it: the rules the code is built on, how to prove a change did not break the picture, and what is not in the repository.

## Run

```
npm install
node tools/serve.mjs 5630                              # http://127.0.0.1:5630/?play  (the live preview; the song is optional)
node tools/render.mjs stills 57.3 104                  # PNGs in stills/renders/  (look at them)
node tools/render.mjs determinism 12.9 57.3 104 196.2  # the same frames in three render orders: PASS or FAIL
node tools/seams.mjs 90.9 103.5                        # frame-to-frame change vs the declared cut list, plus a camera series
node tools/motion.mjs 20.70-90.93                      # pace: cut rate, big-change rate, longest still stretch
node tools/render.mjs video 0 245 out/out-of-stock.mp4 # the whole video (needs the song: OOS_SONG=<path to the WAV>)
```

Node 20 or newer, ffmpeg on the PATH for `video`, and Microsoft Edge (the render tool drives the installed browser through puppeteer-core and downloads nothing; on another platform set `EDGE` in `tools/render.mjs` to any Chromium). The render tools start their own server on a second port; the preview on 5630 can stay up.

## Layout

- `index.html` + `src/main.js` — boot: renderer, fonts, stage; `?t=57.3` renders one frame, `?play` is the transport, `?portrait` is 9:16.
- `src/song.js` — the song as data: the beat grid, the kicks, every sung word with its time, the synth and lead-vocal spectra per frame. Every visual syncs to these. Read it before touching any scene.
- `src/director.js` — `frameAt(t)`: which shot is on screen at song time t and every sync point in it. The one place shots are chosen.
- Scenes: `intro.js`, `fastcut.js` (verse 1), `ascent.js` + `market.js` (verse 2), `chorus.js` + `site.js` + `dancer.js` (the choruses), `gui.js` (the on-screen PC), `meltdown.js` (verse 3's end).
- Kits: `stage.js` (every persistent object, built once), `rig.js` (camera, type planes, backdrop, HUD), `materials.js` (shaders), `post.js` (the film post chain), `print.js` (photos to ink, at boot), `type.js` (canvas type layers in 3D), `outline.js` (type as filled outlines), `blueprint.js` (the draughting kit), `frame.js` (aspect).
- `roto/` — the rotoscope: `trace.py` turns a green-screen clip into per-frame vector layers (`altman/trace.json`, shipped); `roto.js` inks them; its own page at `/roto/` and `roto/render.mjs`.
- `analysis/` — how the data files were made from the song's stems (not shipped): the kick map, Whisper words pinned by wav2vec2 forced alignment, the spectrum and pitch chains. Their outputs are checked in (`timing.js`, `analysis/lyrics-aligned.json`, `data/synth.js`, `data/lead.js`), so nothing here needs to run to render.
- `tools/` — the instruments (above) and the asset pipeline (`prep-assets.py`, `debrand.py`, `cut-archivo.py`, `face-box.py`).
- `data/` — cutout outlines, the spectra; `assets/tex/` — the 2048 px textures the scenes draw; `fonts/` — vendored, with their OFL files; `vendor/` — three.js r170 and opentype.js, self-contained.

## The invariants

The comments cite these by number. They are the reasons the code is shaped the way it is; a change that breaks one will show up as a determinism FAIL or a seam, usually not where the edit was.

- **Every frame is a pure function of song time.** `frameAt(t)` may not carry state between frames. Anything that must survive a cut is a keyframed curve evaluated every frame, never a value set once by an earlier shot. Randomness is `h32(...)` seeded from t or a beat index, never `Math.random()`.
- **L80. A 2D canvas is not bit-exact across its own history, on the GPU or the CPU.** The same commands can raster ±1/255 differently depending on what the canvas drew before, and the browser's glyph cache has a history too. So in capture mode (`EXACT` in `type.js`) every 2D canvas rasters on the CPU (`willReadFrequently`), every full-frame layer draws on a **fresh canvas per frame**, large type goes through **outlines** (`outline.js`, opentype paths) instead of `fillText`, and every look is drawn once at boot because a material's first draw differs from its second. The preview keeps GPU canvases for speed; captures and the preview may differ by 1/255 in a few pixels, and that is expected.
- **L82. A full-frame layer that samples outside itself is not opaque.** A glitch stage reading `uv ± offset` returns transparent past the texture edge, and whatever the previous shot left in the 3D backdrop shows through the holes. The backdrop is set explicitly at the top of every shot's frame.
- **L83. A frame-difference meter measures coverage, not violence.** A dark frame with a hairline drawing cannot read as fast however hard it is cut; change what fraction of the frame can change (the sheet's stock, a full-frame flash) before adding more motion.
- **L87. An if/else chain of shots is a seam factory.** Each shot applying its own constants on top of shared state steps every one of them on the boundary frame. `tools/seams.mjs` walks a stretch frame by frame and fails any big change that no declared event explains; run it across every boundary a change touches, and watch it go red on a planted jump before trusting its green. On a line drawing a picture difference is blind to a camera jump, so the tool also projects fixed world points through the camera and reads their screen motion.
- **L88. Type at one size on one centred baseline is a subtitle, not a composition.** Two voices in one sentence: small connectives, a hit word big enough to carry the frame, broken baselines, a margin anchor, the same near-white for both (contrast is size and case, never brightness).

## Before a change is done

1. `render.mjs determinism` on times inside the change **and** on times from every other section, in one list. Cross-mode state (a 3D shot leaking under a 2D layer) only shows when a list mixes modes.
2. `render.mjs stills` on the frames you changed, and look at them. The instruments answer *is it correct*; only eyes answer *is it good*.
3. `seams.mjs` across any boundary the change touches; `motion.mjs` if pace was the point.
4. A determinism FAIL is diagnosed with `tools/probe-order.mjs t1 t2 ...`: it renders the times in that order on one fresh page, prints each frame's hash and saves every frame, so two renders of one t can be diffed. Bisect the preceding frame, then the moment inside it.
5. Page errors and console output are counted by kind, never dumped; keep the tools that way.

## Data

- `timing.js` (`window.OOS`): 540 kicks at 149.995 BPM, the beat grid, drops, breaks, lead/backing regions, 20 fps loudness envelopes. From `analysis/kicks.mjs` + `build-timing.mjs`.
- `analysis/lyrics-aligned.json`: 688 sung words in order with `t`/`end`/`score` and the sheet line/word they belong to. From Whisper (transcripts in `analysis/whisper/`) + `align-ctc.py`.
- `data/synth.js`, `data/lead.js`: 48 log bands per video frame, loudness, and the singer's pitch every 10 ms, base64 in a `window.*` global. From `synth-spectrum.py` and `lead-voice.py` through `avs.py`.
- Regenerating any of these needs the stems, which are not in the repository. Treat the data files as fixed inputs; the scenes are written against exactly these numbers.

## Not in the repository

- **The song and its stems** (the creator's). Stills and determinism never need them; `video` and the preview's sound do (`OOS_SONG`).
- **The original photographs and their cutouts** (see `assets/photos/CREDITS.md` for every source and licence). The textures the scenes draw are in `assets/tex/`.
- **The models** the Python tools load: wav2vec2 downloads through torchaudio on first run; BiRefNet's ONNX file is pointed at with `BIREFNET_ONNX`; Whisper ran as whisper.cpp outside this tree (its outputs are checked in).
- **A browser.** The render tool uses the one installed.

## Conventions

- Comment vocabulary: "the creator" directed the video; "the agent" is the AI that wrote the code; "the director" is `director.js`; "the reference visualizer" is the audio visualizer whose analyzer chain and look the intro's bars and the ring match; "a test viewer" gave the notes quoted in the verses. Dates in comments are September 2026 and mark when a note or rebuild landed.
- Runtime dependencies: none beyond the vendored three.js and opentype.js. Dev dependency: puppeteer-core only. Keep it that way.
- The video is 1920×1080 at 30 fps; one beat is exactly 12 frames. `song.js` `END` (245 s) is where the picture ends; the sound fades from `FADE0`.
- Python tools: `requirements.txt`. They run from the repository root or their own folder as their headers say; none of them is on the render path.
