# Rotoscope tracer: a green-screen dance clip -> per-frame vector layers for roto.js to ink.
#   python roto/trace.py <clip.mp4> <out_dir> [--still <illustration.png>]
# Writes <out_dir>/film/fNNN.jpg (the footage, for the page) and <out_dir>/trace.json. With --still, the source
# illustration (transparent PNG) is traced too, at its own resolution, and registered onto the clip's first frame
# (feet on the same floor, same centre line, same height) so the renderer can hand off from it to the dance.
# Every frame is traced on its own (at 2x, sub-pixel iso-contours), the way a rotoscope artist
# traces each cel; the frame-to-frame wobble that leaves is the line boil, and it is kept.
import json, os, shutil, subprocess, sys, tempfile
import cv2
import numpy as np
from scipy import ndimage
from skimage import measure, morphology

UP = 2                      # trace at 2x the clip's pixels
Q = 4                       # stored coordinates: clip pixels * Q, as integers

def key(up):
    """alpha (1 = figure), despilled rgb, hsv of the despilled colour"""
    im = up[:, :, ::-1].astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    gd = g - np.maximum(r, b)                                  # how much greener than it is anything else
    alpha = np.clip((70.0 - gd) / 50.0, 0.0, 1.0)
    rgb = np.stack([r, np.minimum(g, np.maximum(r, b)), b], -1)
    hsv = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8)[:, :, ::-1], cv2.COLOR_BGR2HSV).astype(np.float32)
    return alpha, rgb, hsv, g

def contours(mask_f, level=0.5, min_area=3.0, tol=0.45):
    """closed iso-contours of a float mask, region always on the LEFT of travel (x, y image coords)"""
    out = []
    padded = np.pad(mask_f, 1)                                 # close contours that touch the border
    for c in measure.find_contours(padded, level):
        c = c - 1.0
        if len(c) < 4: continue
        c = measure.approximate_polygon(c, tol)
        xy = c[:, ::-1]                                        # (row, col) -> (x, y)
        x, y = xy[:, 0], xy[:, 1]
        area = 0.5 * np.sum(x[:-1] * y[1:] - x[1:] * y[:-1])
        if abs(area) < min_area: continue
        # which side is the region on? probe beside the longest edge
        d = np.diff(xy, axis=0); k = int(np.argmax((d ** 2).sum(1)))
        m = (xy[k] + xy[k + 1]) / 2; t = d[k] / (np.linalg.norm(d[k]) + 1e-9)
        left = m + np.array([-t[1], t[0]]) * 0.8               # left of travel = (-dy, dx)
        yi, xi = int(round(left[1])), int(round(left[0]))
        inside = 0 <= yi < mask_f.shape[0] and 0 <= xi < mask_f.shape[1] and mask_f[yi, xi] >= level
        if not inside: xy = xy[::-1]
        out.append(xy[:-1] if np.allclose(xy[0], xy[-1]) else xy)
    return out

def chains(edge):
    """1-px edge map -> open polylines (walks between endpoints/junctions, then leftover loops)"""
    sk = morphology.skeletonize(edge)
    ys, xs = np.nonzero(sk)
    on = set(zip(ys.tolist(), xs.tolist()))
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    def ns(p): return [(p[0] + a, p[1] + b) for a, b in nb if (p[0] + a, p[1] + b) in on]
    deg = {p: len(ns(p)) for p in on}
    used = set(); lines = []
    def walk(a, b):
        path = [a, b]; used.add((a, b)); used.add((b, a))
        while deg[path[-1]] == 2:
            nxt = [q for q in ns(path[-1]) if (path[-1], q) not in used]
            if not nxt: break
            used.add((path[-1], nxt[0])); used.add((nxt[0], path[-1])); path.append(nxt[0])
        return path
    for p in on:
        if deg[p] != 2:
            for q in ns(p):
                if (p, q) not in used: lines.append(walk(p, q))
    for p in on:                                               # pure loops
        for q in ns(p):
            if (p, q) not in used: lines.append(walk(p, q))
    out = []
    for ln in lines:
        a = np.array(ln, dtype=np.float64)[:, ::-1]            # -> (x, y)
        if len(a) < 5: continue
        out.append(measure.approximate_polygon(a, 0.6))
    return out

def enc(poly, up=UP):
    """source-pixel coordinates * Q as a flat int list"""
    return np.round(np.asarray(poly) / up * Q).astype(int).ravel().tolist()

def face_of(fg, skin, u=1.0):
    """The face: the biggest skin blob in the top of the figure. Its enclosed dark holes are the eyes and brows
    (the footage's 10x4-px eyes trace as black hollows, so the renderer draws the features itself).
    -> (skin mask with the eye/brow holes filled, eyes [(x, y, w, open)] in traced px, face box) or None
    u = the figure's height over the clip's (898 traced px): the thresholds are measured on the clip."""
    ys, _ = np.nonzero(fg)
    if not len(ys): return skin, None
    top, hgt = ys.min(), ys.max() - ys.min()
    lab, n = ndimage.label(skin)
    best, ba = 0, 0
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        a = int((lab[sl] == k).sum()); cy = (sl[0].start + sl[0].stop) / 2
        if cy < top + 0.28 * hgt and a > ba: best, ba = k, a
    if not best or ba < 2500 * u * u: return skin, None
    face = lab == best
    fy, fx = np.nonzero(face); fy0, fy1, fx0, fx1 = fy.min(), fy.max(), fx.min(), fx.max()
    holes = ndimage.binary_fill_holes(face) & ~face
    hl, hn = ndimage.label(holes)
    cands, fill = [], np.zeros_like(skin)
    for k, sl in enumerate(ndimage.find_objects(hl), 1):
        m = hl[sl] == k; a = int(m.sum())
        y0, y1, x0, x1 = sl[0].start, sl[0].stop - 1, sl[1].start, sl[1].stop - 1
        if (y0 + y1) / 2 > fy0 + 0.75 * (fy1 - fy0): continue          # the chin/neck shadow stays
        fill[sl] |= m
        if a >= 24 * u * u: cands.append(dict(a=a, x0=x0, x1=x1, y0=y0, y1=y1))
    # stack an eye with the brow above it (same columns, close rows)
    cands.sort(key=lambda c: c["y0"])
    groups = []
    for c in cands:
        for g in groups:
            ov = min(g["x1"], c["x1"]) - max(g["x0"], c["x0"])
            if ov >= 0.5 * min(g["x1"] - g["x0"], c["x1"] - c["x0"]) and c["y0"] - g["y1"] < 10 * u:
                g["parts"].append(c); g["a"] += c["a"]
                for k in ("x0", "y0"): g[k] = min(g[k], c[k])
                for k in ("x1", "y1"): g[k] = max(g[k], c[k])
                break
        else:
            groups.append(dict(c, parts=[c]))
    eyes = []
    for g in groups:
        low = max(g["parts"], key=lambda c: c["y1"])                   # the eye is the lowest part
        h = (low["y1"] - low["y0"] + 1) if len(g["parts"]) > 1 else (g["y1"] - g["y0"] + 1) - (6 * u if g["y1"] - g["y0"] >= 13 * u else 0)
        eyes.append(dict(a=g["a"], x=(low["x0"] + low["x1"]) / 2, y=low["y1"] - 4 * u, w=low["x1"] - low["x0"] + 1, open=h >= 7 * u))
    eyes.sort(key=lambda e: -e["a"])
    pick = eyes[:1]
    for e in eyes[1:]:
        if abs(e["y"] - pick[0]["y"]) < 16 * u and 16 * u <= abs(e["x"] - pick[0]["x"]) <= 68 * u and e["a"] >= 0.3 * pick[0]["a"]:
            pick.append(e); break
    pick.sort(key=lambda e: e["x"])
    return skin | fill, (pick, (fx0, fy0, fx1, fy1))

def trace_frame(bgr, alpha_in=None, up=UP):
    """one cel. alpha_in = the picture's own transparency (an illustration) instead of the green key"""
    img = bgr if up == 1 else cv2.resize(bgr, None, fx=up, fy=up, interpolation=cv2.INTER_AREA if up < 1 else cv2.INTER_LANCZOS4)
    if alpha_in is None:
        alpha, rgb, hsv, g = key(img)
    else:
        alpha, g = alpha_in.astype(np.float32), None
        if up != 1: alpha = cv2.resize(alpha, None, fx=up, fy=up, interpolation=cv2.INTER_AREA if up < 1 else cv2.INTER_LINEAR)
        rgb = img[:, :, ::-1].astype(np.float32)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    H, Sa, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    fg = alpha > 0.5
    ys, xs = np.nonzero(fg)
    top, bot = ys.min(), ys.max(); hgt = bot - top
    skin0 = fg & ((H <= 22) | (H >= 170)) & (Sa > 45) & (Sa < 170) & (V > 140)
    light = fg & ~skin0 & (V > 150) & (Sa < 70)
    dark = fg & ~skin0 & ~light
    skin, face = face_of(fg, skin0, hgt / 898.0)
    sm = lambda m, s=1.0: ndimage.gaussian_filter(m.astype(np.float32), s)
    L = {}
    L["body"] = contours(ndimage.gaussian_filter(alpha, 0.8), min_area=8)
    L["light"] = contours(sm(light), min_area=4)
    L["skin"] = contours(sm(skin), min_area=4)
    L["lightShade"] = contours(sm(light & (V < 200), 1.2), min_area=10)
    L["skinShade"] = contours(sm(skin0 & (V < 212), 1.2), min_area=6)
    L["sheen"] = contours(sm(dark & (V > 66), 1.0), min_area=5)
    # floor shadow: screen pixels darker than the screen
    if g is not None:
        shadow = (alpha < 0.2) & (g < 168)
        shadow = morphology.remove_small_objects(shadow, 40)
        L["floor"] = contours(sm(shadow, 2.0), min_area=60, tol=0.8)
    else:
        L["floor"] = []                                        # an illustration has no floor: the renderer lends one
    # inner ink: the footage's own line art + the creases inside the suit and hair, kept off the silhouette
    # edge and off the shirt/skin borders (those are inked from their own closed contours)
    gray = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8)[:, :, ::-1], cv2.COLOR_BGR2GRAY)
    ed = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0.8), 50, 120) > 0
    inner = ndimage.binary_erosion(fg, iterations=4) & ~ndimage.binary_dilation(light | skin, iterations=3)
    L["lines"] = chains(ed & inner)
    out = {k: [enc(p, up) for p in v] for k, v in L.items()}
    # the animator's construction: a head oval and the line of action: head -> spine (the thickest point of
    # the torso, row by row, smoothed hard) -> hip -> down the weight-bearing leg (the foot nearest under the hip)
    if face:
        x0, y0, x1, y1 = face[1]; hc = ((x0 + x1) / 2, (y0 + y1) / 2 - 0.02 * hgt)
    else:
        row = fg[top + int(0.06 * hgt)]; hc = (np.nonzero(row)[0].mean() if row.any() else xs.mean(), top + 0.06 * hgt)
    out["head"] = enc(np.array([hc[0], hc[1], 0.058 * hgt, 0.072 * hgt]), up)
    dt = ndimage.distance_transform_edt(fg)
    hip_y = int(top + 0.52 * hgt)
    rows = np.arange(int(hc[1]), hip_y, 4)
    mx = np.array([np.argmax(dt[r]) if fg[r].any() else np.nan for r in rows], dtype=np.float64)
    ok = ~np.isnan(mx)
    if ok.sum() > 8:
        mx = np.interp(np.arange(len(mx)), np.nonzero(ok)[0], mx[ok])
        mx = ndimage.gaussian_filter1d(mx, 6, mode="nearest")
        spine = np.stack([mx, rows], -1)[::3]
        fy_, fx_ = np.nonzero(fg[bot - int(0.05 * hgt):bot + 1])
        hip = spine[-1]
        if len(fx_):
            l, r = fx_[fx_ < hip[0]], fx_[fx_ >= hip[0]]
            feet = [np.array([c.mean(), bot]) for c in (l, r) if len(c) > 20]
            if feet:
                foot = min(feet, key=lambda p: abs(p[0] - hip[0]))
                knee = hip + (foot - hip) * 0.5 + np.array([0.04 * hgt * np.sign(hip[0] - foot[0] + 1e-6), 0])
                spine = np.vstack([spine, knee, foot])
        out["gesture"] = [enc(spine, up)]
    if face:
        eyes, box = face
        out["face"] = {"box": enc(np.array(box, dtype=np.float64), up),
                       "eyes": [[e["x"] / up, e["y"] / up, e["w"] / up, int(e["open"])] for e in eyes]}
    return out

def settle_faces(frames):
    """The eyes are measured on 10x4-px blobs: hold them still. Smooth positions over 3 frames where the eye
    count agrees, and take the majority open/closed, so the drawn eyes don't swim or blink at random."""
    raw = [fr.get("face") for fr in frames]
    for i, f in enumerate(raw):
        if not f: continue
        nb = [raw[j] for j in (i - 1, i + 1) if 0 <= j < len(raw) and raw[j] and len(raw[j]["eyes"]) == len(f["eyes"])]
        eyes = []
        for k, e in enumerate(f["eyes"]):
            near = [n["eyes"][k] for n in nb if abs(n["eyes"][k][0] - e[0]) < 5 and abs(n["eyes"][k][1] - e[1]) < 5]
            x = (2 * e[0] + sum(n[0] for n in near)) / (2 + len(near))
            y = (2 * e[1] + sum(n[1] for n in near)) / (2 + len(near))
            w = (2 * e[2] + sum(n[2] for n in near)) / (2 + len(near))
            op = e[3] if len(near) < 2 else int(e[3] + near[0][3] + near[1][3] >= 2)
            eyes.append([round(x * Q), round(y * Q), round(w * Q), op])
        frames[i]["face"] = {"box": f["box"], "eyes": eyes}

def main():
    args = sys.argv[1:]
    still = None
    if "--still" in args: i = args.index("--still"); still = args[i + 1]; del args[i:i + 2]
    clip, out = args
    os.makedirs(os.path.join(out, "film"), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-map", "0:v:0", os.path.join(tmp, "f%03d.png")], check=True)
        names = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                              "-of", "default=nk=1:nw=1", clip], capture_output=True, text=True, check=True).stdout.strip()
        num, den = (int(x) for x in fps.split("/"))
        frames = []
        for i, n in enumerate(names):
            bgr = cv2.imread(os.path.join(tmp, n))
            cv2.imwrite(os.path.join(out, "film", f"f{i:03d}.jpg"), bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
            frames.append(trace_frame(bgr))
            if i % 24 == 0: print(f"  frame {i}/{len(names)}", flush=True)
        h, w = bgr.shape[:2]
        first = cv2.imread(os.path.join(tmp, names[0]))
    settle_faces(frames)
    doc = {"w": w, "h": h, "fps": num / den, "q": Q, "count": len(frames), "frames": frames}
    if still:
        rgba = cv2.imread(still, cv2.IMREAD_UNCHANGED)
        a = rgba[..., 3].astype(np.float32) / 255.0
        # traced at the dance's own detail (the same figure height in traced pixels), so the line density matches
        # across the hand-off and the still costs what a dance frame costs to draw
        sy_, _ = np.nonzero(a > 0.5); first_h = np.ptp(np.nonzero(key(first)[0] > 0.5)[0]) * UP
        sf = trace_frame(rgba[..., :3].copy(), a, up=first_h / np.ptp(sy_))
        settle_faces([sf])
        # register: the clip's first frame and the illustration, feet on the same floor, same height, same centre
        fy, fx = np.nonzero(key(first)[0] > 0.5); sy, sx = np.nonzero(a > 0.5)
        s = (fy.max() - fy.min()) / (sy.max() - sy.min())
        xform = [round(float(s), 5), round(float(fx.mean() - s * sx.mean()), 2), round(float(fy.max() - s * sy.max()), 2)]
        shutil.copyfile(still, os.path.join(out, "still.png"))
        doc["still"] = {"img": "still.png", "w": int(rgba.shape[1]), "h": int(rgba.shape[0]), "xform": xform, "frame": sf}
        eyes = len(sf.get("face", {}).get("eyes", []))
        print(f"still: {rgba.shape[1]}x{rgba.shape[0]} -> clip scale {xform[0]}, offset ({xform[1]}, {xform[2]}); eyes {eyes}")
    with open(os.path.join(out, "trace.json"), "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    pts = sum(len(p) // 2 for fr in frames for k, v in fr.items() if k not in ("face", "head") for p in v)
    print(f"faces: {sum(1 for fr in frames if 'face' in fr)} frames, eyes 2/1/0: "
          f"{[sum(1 for fr in frames if len(fr.get('face', {}).get('eyes', [])) == n) for n in (2, 1, 0)]}")
    print(f"{len(frames)} frames, {w}x{h} @ {num / den:g} fps, {pts} points, "
          f"{os.path.getsize(os.path.join(out, 'trace.json')) / 1e6:.1f} MB")

if __name__ == "__main__":
    main()
