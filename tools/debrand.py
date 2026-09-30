# No real branding in the video (the creator's ruling, 9/26): logos, brand words, product names and chip markings are painted out
# of the ENGINE's textures. The photos and cutouts stay as they were downloaded and cut; prep-assets.py calls apply()
# on each texture before it writes it, so assets/tex/ is the only place the hardware is anonymous.
#
# assets/debrand.json: { key: [ { "r": [x0, y0, x1, y1], "m": mode, "k": px, "t": thr, "e": ellipse? }, ... ] }
#   r   the region in the texture's own 0..1 coordinates (x right, y DOWN); or "p": [[x, y], ...] a polygon (slanted
#       lettering), whose bounding box is the region
#   m   "light"  light marks on a darker ground (white text on a black heatsink, chip markings): a white top-hat
#       "dark"   dark marks on a lighter ground (print on a silver hub): a black top-hat
#       "both"   either
#       "white"  near-white, unsaturated pixels ("t" = min grey, default 150; "s" = max saturation, default 70)
#       "col"    pixels near one colour ("c": [r, g, b], "tol": distance, default 80)
#       "fill"   the whole region, filled in from what surrounds it (embossed logos, busy marks)
#       "label"  a sticker: the whole region becomes blank paper in the sticker's median colour
#       "chip"   a memory chip: its dark body (closed over its markings with a k-px square) goes one flat dark tone
#       "clone"  a clean patch of the same surface copied over the whole region from "from": [dx, dy] away (0..1
#                units), feathered over "f" px at its edge (default 8): keeps the surface's grain, where an inpaint
#                of etched text on brushed metal leaves pale ghosts of the letters
#   e   true = only inside the ellipse inscribed in the region (a fan hub), any mode
#   k   the top-hat's size in texture px (bigger than the strokes it should catch, smaller than the ground); default 11
#   t   the top-hat threshold (0-255); default 24
#   g   how far the found marks grow before the inpaint, in px (anti-aliased edges); default 5
# Regions apply in order (a label after the chip marks it covers). The marks found are inpainted (Telea) from their
# surroundings; labels and chips are painted flat; transparent pixels are never painted.
#
#   python tools/debrand.py grid KEY... OUT      the texture with a 0.05 grid, for placing regions by eye
#   python tools/debrand.py check KEY... OUT     before | after, regions outlined, for the eye check
import json, os, sys
import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGIONS = os.path.join(ROOT, "assets", "debrand.json")


def load():
    return json.load(open(REGIONS, encoding="utf-8")) if os.path.exists(REGIONS) else {}


def _mask(gray, alpha, reg, bgr=None):
    m, k, t = reg.get("m", "light"), int(reg.get("k", 11)), int(reg.get("t", 24))
    grow = int(reg.get("g", 5))
    h, w = gray.shape
    if m == "white":                                 # near-white, unsaturated marks (a painted logo on a dark hub)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        mk = np.where((gray > int(reg.get("t", 150))) & (hsv[:, :, 1] < int(reg.get("s", 70))), 255, 0).astype(np.uint8)
    elif m == "col":                                 # marks of one colour (lettering lit green, a red Z)
        r, g, b = reg["c"]
        d = np.linalg.norm(bgr.astype(np.float32) - np.array([b, g, r], np.float32), axis=2)
        mk = np.where(d < float(reg.get("tol", 80)), 255, 0).astype(np.uint8)
    elif m == "chip":                                # a memory chip: its dark body, markings included, goes flat
        _, dark = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)       # the body: the dark side of the region
        mk = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
        grow = 0
    elif m in ("fill", "label"):
        mk = np.full(gray.shape, 255, np.uint8)
        grow = 0
    else:
        se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        hat = np.zeros(gray.shape, np.uint8)
        if m in ("light", "both"):
            hat = np.maximum(hat, cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, se))
        if m in ("dark", "both"):
            hat = np.maximum(hat, cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, se))
        mk = np.where(hat > t, 255, 0).astype(np.uint8)
    if grow:
        mk = cv2.dilate(mk, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))
    if reg.get("e"):                                 # an ellipse inscribed in the region (a fan hub)
        el = np.zeros(gray.shape, np.uint8)
        cv2.ellipse(el, (w // 2, h // 2), (w // 2, h // 2), 0, 0, 360, 255, -1)
        mk &= el
    if alpha is not None:
        mk[alpha < 200] = 0
    return mk


def _plane(px, xx, yy, ok):
    """Per channel, the least-squares plane a + b x + c y through px[ok] (twice: the second fit drops the pixels the
    first one missed by more than 2.5 MADs: letters caught in a ring). Returns it evaluated at xx, yy."""
    A = np.stack([np.ones(ok.sum()), xx[ok], yy[ok]], 1)
    out = np.zeros(xx.shape + (3,), np.float32)
    for c in range(3):
        v, keep = px[..., c][ok], np.ones(ok.sum(), bool)
        for _ in range(2):
            coef = np.linalg.lstsq(A[keep], v[keep], rcond=None)[0]
            r = v - A @ coef
            keep = np.abs(r) < 2.5 * (np.median(np.abs(r)) + 1e-3) / 0.6745
        out[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return out


def _ring_plane(im, X0, Y0, X1, Y1, xx, yy, pad=24):
    """The light around a box: the plane through a pad-px ring outside it, in the box's own coordinates."""
    H, W = im.shape[:2]
    a0, b0, a1, b1 = max(0, X0 - pad), max(0, Y0 - pad), min(W, X1 + pad), min(H, Y1 + pad)
    ring = im[b0:b1, a0:a1].astype(np.float32)
    ry, rx = np.mgrid[b0:b1, a0:a1].astype(np.float32)
    ok = ~((rx >= X0) & (rx < X1) & (ry >= Y0) & (ry < Y1))
    if im.shape[2] == 4:
        ok &= ring[..., 3] >= 200
    A = np.stack([np.ones(ok.sum()), rx[ok] - X0, ry[ok] - Y0], 1)
    out = np.zeros(xx.shape + (3,), np.float32)
    for c in range(3):
        v, keep = ring[..., c][ok], np.ones(ok.sum(), bool)
        for _ in range(2):
            coef = np.linalg.lstsq(A[keep], v[keep], rcond=None)[0]
            r = v - A @ coef
            keep = np.abs(r) < 2.5 * (np.median(np.abs(r)) + 1e-3) / 0.6745
        out[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return out


def _box(reg):
    if "p" in reg:
        xs, ys = [p[0] for p in reg["p"]], [p[1] for p in reg["p"]]
        return min(xs), min(ys), max(xs), max(ys)
    return reg["r"]


def apply(key, im, regions=None):
    """im: BGR or BGRA uint8 at the texture's size. Returns the debranded copy (or im itself if the key has none)."""
    regs = (regions if regions is not None else load()).get(key)
    if not regs:
        return im
    out = im.copy()
    H, W = out.shape[:2]
    for reg in regs:
        x0, y0, x1, y1 = _box(reg)
        X0, Y0, X1, Y1 = max(0, int(x0 * W)), max(0, int(y0 * H)), min(W, int(round(x1 * W))), min(H, int(round(y1 * H)))
        if X1 - X0 < 2 or Y1 - Y0 < 2:
            continue
        if reg.get("m") == "clone":
            dx, dy, f = round(reg["from"][0] * W), round(reg["from"][1] * H), float(reg.get("f", 8))
            h, w = Y1 - Y0, X1 - X0
            # the patch keeps its own grain but takes the light of where it lands: a plane fitted to a ring around the
            # region (the surface's light there), minus a plane fitted to the patch itself (its light where it came
            # from). Without it a patch from the brighter half of a lid shows as a lighter box
            src = out[Y0 + dy:Y1 + dy, X0 + dx:X1 + dx, :3].astype(np.float32)
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            src = src - _plane(src, xx, yy, np.ones((h, w), bool)) + _ring_plane(out, X0, Y0, X1, Y1, xx, yy)
            rx = np.clip(np.minimum(np.arange(w) + 0.5, w - np.arange(w) - 0.5) / f, 0, 1)
            ry = np.clip(np.minimum(np.arange(h) + 0.5, h - np.arange(h) - 0.5) / f, 0, 1)
            m = (ry[:, None] * rx[None, :])[..., None]
            if out.shape[2] == 4:
                m = m * (out[Y0:Y1, X0:X1, 3:4] >= 200)
            out[Y0:Y1, X0:X1, :3] = (src * m + out[Y0:Y1, X0:X1, :3] * (1 - m)).round().clip(0, 255).astype(np.uint8)
            continue
        pad = 16                                     # context for the inpaint, outside the region
        cx0, cy0, cx1, cy1 = max(0, X0 - pad), max(0, Y0 - pad), min(W, X1 + pad), min(H, Y1 + pad)
        crop = out[cy0:cy1, cx0:cx1]
        bgr = np.ascontiguousarray(crop[:, :, :3])
        alpha = crop[:, :, 3] if crop.shape[2] == 4 else None
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        inner = (slice(Y0 - cy0, Y1 - cy0), slice(X0 - cx0, X1 - cx0))
        mk = np.zeros(gray.shape, np.uint8)
        mk[inner] = _mask(gray[inner], None if alpha is None else alpha[inner], reg, bgr[inner])
        if "p" in reg:                               # a polygon region: only inside it
            poly = np.zeros(gray.shape, np.uint8)
            pts = np.array([[x * W - cx0, y * H - cy0] for x, y in reg["p"]], np.int32)
            cv2.fillPoly(poly, [pts], 255)
            mk &= poly
        if not mk.any():
            continue
        if reg.get("m") in ("label", "chip"):
            px = bgr[mk > 0].reshape(-1, 3)
            flat = np.median(px, axis=0) if reg.get("m") == "label" else np.percentile(px, 35, axis=0)
            soft = cv2.GaussianBlur(mk.astype(np.float32) / 255, (0, 0), 0.8)[..., None]
            bgr = (flat * soft + bgr * (1 - soft)).astype(np.uint8)
        else:
            bgr = cv2.inpaint(bgr, mk, 5, cv2.INPAINT_TELEA)
        crop[:, :, :3] = bgr
    return out


def _tex(key):
    import glob
    for ext in (".png", ".jpg"):
        p = os.path.join(ROOT, "assets", "tex", key + ext)
        if os.path.exists(p):
            return p
    raise SystemExit("no texture for " + key)


def _source(key):
    """The texture exactly as prep-assets.py makes it BEFORE apply(): its source file, resized to <= 2048 wide."""
    cut = json.loads(open(os.path.join(ROOT, "data", "cutouts.js"), encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
    c = next(c for c in cut if c["key"] == key)
    full = c["tex"].endswith(".jpg")
    for folder in ("gpu-cutouts", "ram-cutouts", "parts-cutouts", os.path.join("photos", "ram"), os.path.join("photos", "dc"), os.path.join("photos", "eye")):
        p = os.path.join(ROOT, "assets", folder, c["src"])
        if os.path.exists(p) and (full == (folder.startswith("photos"))):
            im = cv2.imread(p, cv2.IMREAD_COLOR if full else cv2.IMREAD_UNCHANGED)
            s = min(1.0, 2048 / im.shape[1])
            return cv2.resize(im, (round(im.shape[1] * s), round(im.shape[0] * s)), interpolation=cv2.INTER_AREA)
    raise SystemExit("no source for " + key)


def _flat(im):
    if im.shape[2] == 4:
        a = im[:, :, 3:4].astype(np.float32) / 255
        return (im[:, :, :3] * a + np.array([255, 0, 255]) * (1 - a)).astype(np.uint8)
    return im


def _grid(im, step=0.05, width=1800):
    im = _flat(im)
    s = width / im.shape[1]
    im = cv2.resize(im, (width, round(im.shape[0] * s)), interpolation=cv2.INTER_AREA)
    H, W = im.shape[:2]
    for i in range(1, int(1 / step)):
        v = i * step
        col = (0, 255, 255) if i % 2 == 0 else (0, 160, 160)
        cv2.line(im, (int(v * W), 0), (int(v * W), H), col, 1)
        cv2.line(im, (0, int(v * H)), (W, int(v * H)), col, 1)
        if i % 2 == 0:
            cv2.putText(im, f"{v:.1f}", (int(v * W) + 2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
            cv2.putText(im, f"{v:.1f}", (2, int(v * H) - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
    return im


if __name__ == "__main__":
    mode, *keys, out = sys.argv[1:]
    os.makedirs(out, exist_ok=True)
    regs = load()
    for key in keys:
        src = _source(key)
        if mode == "grid":
            cv2.imwrite(os.path.join(out, f"grid-{key}.png"), _grid(src))
        else:
            after = apply(key, src, regs)
            a, b = _flat(src), _flat(after)
            H, W = a.shape[:2]
            for reg in regs.get(key, []):
                if "p" in reg:
                    cv2.polylines(a, [np.array([[x * W, y * H] for x, y in reg["p"]], np.int32)], True, (0, 255, 255), 2)
                else:
                    x0, y0, x1, y1 = reg["r"]
                    cv2.rectangle(a, (int(x0 * W), int(y0 * H)), (int(x1 * W), int(y1 * H)), (0, 255, 255), 2)
            sheet = np.concatenate([a, b], axis=0 if W > H else 1)
            s = min(1.0, 1800 / sheet.shape[1])
            sheet = cv2.resize(sheet, (round(sheet.shape[1] * s), round(sheet.shape[0] * s)), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(out, f"check-{key}.png"), sheet)
        print(key, "done")
