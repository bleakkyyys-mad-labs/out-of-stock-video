# The censor boxes for the creator's character art (OOS-0001 row 11): the head (hair, face, ears, down to the chin),
# measured off the PNG's own alpha, not eyeballed.
#   python tools/face-box.py characters/leatherjacketman/LeatherJacketMan-Suit-BG-Masked.png ... [--overlay DIR]
# Prints one line per image: the box in pixels and in the plane's uv (u right, v UP: v = 0 at the image's bottom),
# the numbers src/stage.js carries. --overlay writes the head crop with the box drawn, for an eye check.
#
# The head is the top blob of the silhouette. Walking down from the first opaque row, the silhouette widens over the
# hair, narrows at the neck, then jumps at the shoulders; the neck is the narrowest row between the widest head row
# and the first shoulder-wide row. The skin in the head rows (face, ears) is then checked to sit inside the box.
import sys, os
import numpy as np
from PIL import Image, ImageDraw

PAD = 0.06          # of the head's width, each side: the mosaic's blocks run a little past the silhouette


def measure(path):
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.int32)
    H, W = im.shape[:2]
    a = im[..., 3] > 128
    rows = np.flatnonzero(a.any(1))
    top = rows[0]
    count = a.sum(1)
    shoulder = next(y for y in range(top, H) if count[y] > 0.33 * W)
    widest = top + int(np.argmax(count[top:(top + shoulder) // 2]))     # the head's widest row: in the upper half, above the shoulders' ramp
    neck = widest + int(np.argmin(count[widest:shoulder]))
    head = a[top:neck + 1]
    xs = np.flatnonzero(head.any(0))
    x0, x1 = xs[0], xs[-1]
    pad = PAD * (x1 - x0)
    box = (max(0, x0 - pad), max(0, top - pad), min(W, x1 + pad), min(H, neck + pad))
    # the check: the skin in the head rows (the face, the ears) sits inside the box, printed, not trusted
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    skin = a & (r > 110) & (r > g + 10) & (g > b) & (r - b > 30)
    sy, sx = np.nonzero(skin[top:neck + 1])
    sk = (sx.min(), sy.min() + top, sx.max(), sy.max() + top) if len(sx) else None
    return W, H, box, sk


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = sys.argv[sys.argv.index("--overlay") + 1] if "--overlay" in sys.argv else None
    if out:
        args.remove(out)
    for p in args:
        W, H, (x0, y0, x1, y1), sk = measure(p)
        u0, u1, v0, v1 = x0 / W, x1 / W, 1 - y1 / H, 1 - y0 / H
        inside = sk is not None and sk[0] >= x0 and sk[1] >= y0 and sk[2] <= x1 and sk[3] <= y1
        print(f"{os.path.basename(p)}  {W}x{H}  px [{x0:.0f}, {y0:.0f}, {x1:.0f}, {y1:.0f}]  uv [{u0:.4f}, {v0:.4f}, {u1:.4f}, {v1:.4f}]"
              f"  skin {list(sk) if sk else None} {'inside' if inside else 'OUTSIDE'}")
        if out:
            im = Image.open(p).convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im)
            d = ImageDraw.Draw(bg); d.rectangle([x0, y0, x1, y1], outline=(0, 255, 255, 255), width=3)
            cy1 = min(H, int(y1 + (y1 - y0)))
            bg.crop((max(0, int(x0 - (x1 - x0))), 0, min(W, int(x1 + (x1 - x0))), cy1)).convert("RGB").save(
                os.path.join(out, "facebox-" + os.path.splitext(os.path.basename(p))[0] + ".png"))


main()
