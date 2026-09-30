# Third-party notices

## Shipped in this repository

| What | Where | License |
|---|---|---|
| three.js r170 | `vendor/three.module.min.js` | MIT — Copyright © 2010-2024 three.js authors |
| opentype.js 2.0.0 | `vendor/opentype.min.mjs`, `vendor/LICENSE-opentype.txt` | MIT |
| Anton | `fonts/Anton-Regular.ttf`, `fonts/OFL-Anton.txt` | SIL Open Font License 1.1 |
| IBM Plex Mono | `fonts/IBMPlexMono-*.ttf`, `fonts/OFL-IBMPlexMono.txt` | SIL Open Font License 1.1 |
| DM Serif Display | `fonts/DMSerifDisplay-Regular.ttf`, `fonts/OFL-DMSerifDisplay.txt` | SIL Open Font License 1.1 |
| Archivo (static instances cut from the variable font with fontTools; `tools/cut-archivo.py`) | `fonts/Archivo-*.ttf`, `fonts/OFL-Archivo.txt` | SIL Open Font License 1.1 |
| Photographs from Wikimedia Commons (modified: cut out, debranded, halftoned) | `assets/tex/` | CC BY 1.0 / 2.0 / 3.0 / 4.0, CC0, public domain — every file, author and link in `assets/photos/CREDITS.md` |
| The Claude Code crab | drawn in `src/director.js` from the CLI's startup art | Anthropic's mascot, used as a cameo |

## Used to build it, not shipped

| What | For | License |
|---|---|---|
| puppeteer-core | driving the installed Edge headless (`tools/render.mjs`); a devDependency, installed by `npm install` | Apache-2.0 |
| ffmpeg | the stem dumps, the encode | LGPL / GPL, depending on the build |
| whisper.cpp + the ggml large-v3 model | the first pass at the sung words (`analysis/whisper/*_pass1.json`) | MIT (whisper.cpp); the model under OpenAI's Whisper license (MIT) |
| torchaudio WAV2VEC2_ASR_BASE_960H | forced alignment (`analysis/align-ctc.py`) | BSD-2 (torchaudio); the weights from the torchaudio hub |
| BiRefNet-general (ONNX, from rembg's release) | background removal (`assets/make-cutouts.py`) | MIT |
| fontTools | cutting the Archivo statics | MIT |
| Suno | the song was generated there; the song is not in this repository | Suno's terms; the song belongs to the creator |
| Grok Imagine | the dance clip the rotoscope traced; the clip is not in this repository, the trace is | xAI's terms; the traced cels are the creator's |
| GPT-Image 2 | the character art and props | OpenAI's terms; the images are the creator's |

## Borrowed ideas, with thanks

- The Pastiche-style card storm and the chapter grammar of the first cut were measured against the Opus 5.5 code-video demos on X (Charles Curran's, JohnHeibel/PDoomVideo, HeyGen's HyperFrames) and a "brainrot"-paced intro by birdabo; only their grammar and their pace were borrowed.
- The verse-2 trading-terminal version that did not ship ported the drawing kit of bizarro/evangelion (MIT); it is not in this repository.
