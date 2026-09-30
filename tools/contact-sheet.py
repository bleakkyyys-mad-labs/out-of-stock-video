# Contact sheet of rendered stills (pixl env):  python tools/contact-sheet.py stills/<name>.png "label=stills/renders/t0012.950.png" ...
import sys
from PIL import Image, ImageDraw, ImageFont

out, items = sys.argv[1], [a.split("=", 1) for a in sys.argv[2:]]
TW, TH, cols = 960, 540, 2
rows = (len(items) + cols - 1) // cols
sheet = Image.new("RGB", (TW * cols + 12 * (cols - 1), (TH + 34) * rows), (8, 8, 10))
font = ImageFont.truetype("fonts/IBMPlexMono-SemiBold.ttf", 18)
for k, (label, path) in enumerate(items):
    im = Image.open(path).convert("RGB").resize((TW, TH), Image.LANCZOS)
    x, y = (k % cols) * (TW + 12), (k // cols) * (TH + 34)
    sheet.paste(im, (x, y + 34))
    ImageDraw.Draw(sheet).text((x + 4, y + 7), label, fill=(255, 178, 30), font=font)
sheet.save(out)
print(out, sheet.size)
