# Photo cutouts: BiRefNet-general (ONNX, MIT) mask -> guided-filter edge refine at full res
# -> RGBA PNG cropped to the subject. Originals in photos/<set> are never touched.
# A source that already carries real transparency keeps its own alpha (no model pass).
# pixl env. Runs on CPU: the env's CPU onnxruntime shadows onnxruntime-gpu (providers = Azure, CPU).
#   python make-cutouts.py [gpu|ram|parts] [prefix ...]   (default gpu; prefixes = only those files)
import os, sys, time
import numpy as np
import cv2
import onnxruntime as ort

MODEL = r"X:\AI_LLM\MODELS\SEGMENTATION\BiRefNet-general-epoch_244.onnx"
HERE = os.path.dirname(os.path.abspath(__file__))
SET = sys.argv[1] if len(sys.argv) > 1 else "gpu"
SRC, DST = os.path.join(HERE, "photos", SET), os.path.join(HERE, SET + "-cutouts")
SKIP = {                           # full-frame photos: no clean cutout, they stay whole
    "gpu": ("035-", "038-"),       # the 5090 installed in a case
    "ram": ("305-", "314-", "317-", "318-", "319-"),   # a PC interior, a table of sticks, two SK hynix booth boards, an empty-slot board
    "parts": ("401-",),            # the two-CPU video frame (401a, derive-parts.py, is the one CPU cut from it)
}[SET]
ONLY = tuple(sys.argv[2:])
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)

so = ort.SessionOptions()
so.intra_op_num_threads = 16
sess = ort.InferenceSession(MODEL, so, providers=["CPUExecutionProvider"])
INP = sess.get_inputs()[0].name

def guided(I, p, r, eps):
    # He et al. guided filter (grey guide): pulls the upsampled mask's edge onto the photo's real edge
    box = lambda a: cv2.boxFilter(a, -1, (r, r))
    mI, mp = box(I), box(p)
    a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
    return box(a) * I + box(mp - a * mI)

os.makedirs(DST, exist_ok=True)
for f in sorted(os.listdir(SRC)):
    if f.startswith(SKIP) or (ONLY and not f.startswith(ONLY)):
        continue
    im = cv2.imread(os.path.join(SRC, f), cv2.IMREAD_UNCHANGED)
    t = time.time()
    if im.ndim == 3 and im.shape[2] == 4 and im[:, :, 3].min() < 250:
        # already cut out by its photographer: keep that alpha
        bgr, a = im[:, :, :3], im[:, :, 3].astype(np.float32) / 255
        H, W = bgr.shape[:2]
        r = max(2, round(min(W, H) / 800))
    else:
        bgr = cv2.imread(os.path.join(SRC, f), cv2.IMREAD_COLOR)
        H, W = bgr.shape[:2]
        x = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32)
        x = ((x / max(float(x.max()), 1e-6) - MEAN) / STD).transpose(2, 0, 1)[None]
        m = 1 / (1 + np.exp(-sess.run(None, {INP: x})[0][0, 0]))
        m = (m - m.min()) / (m.max() - m.min() + 1e-6)
        m = cv2.resize(m.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC).clip(0, 1)
        g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        r = max(2, round(min(W, H) / 800))
        a = guided(g, m, 2 * r + 1, 1e-4).clip(0, 1)
        a = ((a - 0.25) / 0.5).clip(0, 1)
        a = a * a * (3 - 2 * a)                # tighten the edge to a couple of pixels; drops faint table haze
    # edge colours come from the card side (alpha-weighted blur of solid pixels), not the old background
    solid = (a > 0.9).astype(np.float32)
    k = (4 * r + 1, 4 * r + 1)
    fg = cv2.blur(bgr.astype(np.float32) * solid[..., None], k) / np.maximum(cv2.blur(solid, k), 1e-4)[..., None]
    col = np.where((a < 0.9)[..., None] & (cv2.blur(solid, k) > 1e-3)[..., None], fg, bgr).clip(0, 255).astype(np.uint8)
    ys, xs = np.nonzero(a > 0.5)
    pad = round(0.015 * max(W, H))
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1), max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    out = np.dstack([col, (a * 255 + 0.5).astype(np.uint8)])[y0:y1, x0:x1]
    name = os.path.splitext(f)[0] + ".png"
    cv2.imwrite(os.path.join(DST, name), out)
    print(f"{name[:48]:48} {x1 - x0}x{y1 - y0}  kept {100 * (a > 0.5).mean():4.1f}% of the frame  {time.time() - t:5.1f}s", flush=True)
