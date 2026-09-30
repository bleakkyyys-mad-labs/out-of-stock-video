# CTC forced alignment: the lyric sheet pinned to the lead stem, word by word.
# Whisper found the words (whisper/words.json); wav2vec2 (torchaudio WAV2VEC2_ASR_BASE_960H) finds when.
# Run from this folder with torch + torchaudio + soundfile installed (a CUDA GPU makes it ~10 s):  python align-ctc.py
# Output: lyrics-aligned.json — the SUNG words in order; each carries its sheet line/word when it has one.
import json, os, re
import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as F

A = os.path.dirname(os.path.abspath(__file__))
W = json.load(open(A + r"\whisper\words.json", encoding="utf-8"))
lines = W["lines"]

dev = "cuda" if torch.cuda.is_available() else "cpu"
bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
model = bundle.get_model().to(dev).eval()
LAB = bundle.get_labels()                      # ('-', '|', 'E', 'T', ...): blank 0, word separator 1
IDX = {c: i for i, c in enumerate(LAB)}
SEP = IDX["|"]

x, sr = sf.read(A + r"\whisper\lead16k.wav", dtype="float32")
bk, _ = sf.read(A + r"\whisper\backing16k.wav", dtype="float32")
assert sr == bundle.sample_rate
HOP = 320                                      # one emission frame = 20 ms
FT = HOP / sr

# --- emissions: 20 s windows with 2 s context each side (attention over 4.5 min won't fit) ---
def emissions(sig):
    win, ctx, em = 20 * sr, 2 * sr, []
    with torch.inference_mode():
        for s in range(0, len(sig), win):
            a, b = max(0, s - ctx), min(len(sig), s + win + ctx)
            e, _ = model(torch.from_numpy(sig[a:b])[None].to(dev))
            e = torch.log_softmax(e, -1)[0].float().cpu()
            f0, n = (s - a) // HOP, (min(len(sig), s + win) - s) // HOP
            em.append(e[f0:f0 + n])
    return torch.cat(em)
em = emissions(x)
# the shouted chorus is weak on the lead stem and doubled on backing: choruses read from lead + backing
em_mix = emissions((0.7 * (x + bk)).astype(np.float32))
ch = [w for w in W["words"] if w["section"] == "Chorus" and w["matched"]]
blocks, cur = [], [ch[0]]
for w in ch[1:]:
    if w["li"] - cur[-1]["li"] > 1:
        blocks.append(cur); cur = []
    cur.append(w)
blocks.append(cur)
for bl in blocks:
    f0 = int((min(min(w["t0"], w["dtw"]) for w in bl) - 0.5) / FT)
    f1 = int((max(max(w["t0"], w["dtw"]) for w in bl) + 1.0) / FT)
    em[f0:f1] = em_mix[f0:f1]

# --- the sung transcript: the sheet, plus what Suno sang that the sheet doesn't have ---
def spell(text):
    return [w for w in re.sub(r"[^A-Z' ]", " ", text.upper().replace("-", " ")).split() if w.strip("'")]

sung = []                                      # {w, li, wi} ; li/wi = None for extras
def add(ws, li=None):
    for k, w in enumerate(ws):
        sung.append({"w": w, "li": li, "wi": k if li is not None else None})

intro = [li for li, l in enumerate(lines) if l["section"] == "Intro"]
add(spell(lines[intro[0]]["text"]), intro[0])
add(spell(lines[intro[1]]["text"]), intro[1])
add(spell(lines[intro[1]]["text"]))           # Suno sang the countdown three times (stem + Whisper)
for li, l in enumerate(lines):
    if l["section"] in ("Intro", "Outro"):
        continue                               # outro = chipmunk, timed from loudness instead
    ws = spell(l["text"])
    if re.match(r"Step (seven|eight|nine):", l["text"]):
        add(["THAT'S"])                        # Suno: "That's step seven/eight/nine"
    add(ws, li)
    if l["text"].endswith("It's deep."):
        add(["D"] * 5)                         # the "D-D-D-D-D" stutter into the first drop
end_t = max(w["dtw"] for w in W["words"] if w["section"] == "Chorus") + 1.5
T = min(len(em), int(end_t / FT))

targets = []
for k, s in enumerate(sung):
    if k:
        targets.append(SEP)
    targets += [IDX[c] for c in s["w"]]
tg = torch.tensor([targets], dtype=torch.int32)
ali, sc = F.forced_align(em[None, :T], tg, blank=0)
spans = F.merge_tokens(ali[0], sc[0].exp())
letters = [sp for sp in spans if sp.token != SEP]
assert len(letters) == sum(len(s["w"]) for s in sung), (len(letters), sum(len(s["w"]) for s in sung))

k = 0
for s in sung:
    ls = letters[k:k + len(s["w"])]
    k += len(s["w"])
    s["t"] = round(ls[0].start * FT, 3)
    s["end"] = round(ls[-1].end * FT, 3)
    s["score"] = round(float(np.mean([sp.score for sp in ls])), 3)

# held notes: CTC emits a long-held word's letters at the END of the note. When a word starts
# more than 0.8 s after the previous word ended and both Whisper clocks put it 0.6 s+ earlier,
# it starts right after the previous word instead (the note is held; "end" keeps the CTC end).
wh = {(w["li"], w["i"] - min(v["i"] for v in W["words"] if v["li"] == w["li"])): w for w in W["words"]}
for p, s in zip(sung, sung[1:]):
    ref = wh.get((s["li"], s["wi"])) if s["li"] is not None else None
    if ref and s["t"] - p["end"] > 0.8 and max(ref["t0"], ref["dtw"]) < s["t"] - 0.6:
        s["held_from"], s["t"] = s["t"], round(p["end"] + 0.06, 3)

# after real silence the voice's first frame is unambiguous, and CTC emits a soft first letter late
# (the "R" of "restock"): a word that follows 150 ms+ of silence starts at the rise out of it.
H5 = sr // 200
n5 = len(x) // H5
lvl = 20 * np.log10(np.sqrt(np.mean(x[: n5 * H5].reshape(n5, H5) ** 2, axis=1)) + 1e-7)
lvl -= lvl.max()
prev_end = 0.0
for s in sung:
    i = int(s["t"] * 200)
    j = i
    while j > 0 and lvl[j - 1] >= -40 and i - j < 120:
        j -= 1                                  # walk back through voice to the edge of silence
    q = j
    while q > 0 and lvl[q - 1] < -40:
        q -= 1                                  # measure the silence before that edge
    if j < i and j - q >= 30 and j / 200 >= prev_end:
        s["onset_from"], s["t"] = s["t"], round(j / 200, 3)
    prev_end = s["end"]
print("onset snaps:", " ".join(f"{s['w']} {s['onset_from']:.2f}->{s['t']:.2f}" for s in sung if "onset_from" in s))

json.dump({"source": "torchaudio WAV2VEC2_ASR_BASE_960H CTC forced alignment · lead stem · sheet + sung extras",
           "frame": FT, "lines": lines, "sung": sung}, open(A + r"\lyrics-aligned.json", "w", encoding="utf-8"))
print(f"frames {len(em)} ({len(em)*FT:.1f}s) aligned to {T*FT:.1f}s · sung words {len(sung)} · extras {sum(s['li'] is None for s in sung)}")
low = [s for s in sung if s["score"] < 0.3]
print(f"low-confidence words (<0.3): {len(low)} ->", " ".join(f"{s['w']}@{s['t']:.1f}" for s in low[:40]))
for sec in ("Intro", "Verse 1", "Chorus", "Verse 2", "Verse 3"):
    sc = [s["score"] for s in sung if s["li"] is not None and lines[s["li"]]["section"] == sec]
    print(f"  {sec:8} mean score {np.mean(sc):.2f}  low {sum(v < 0.3 for v in sc)}/{len(sc)}")
print("held-note fixes:", " ".join(f"{s['w']} {s['held_from']:.2f}->{s['t']:.2f}" for s in sung if "held_from" in s))
