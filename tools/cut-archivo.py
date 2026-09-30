"""The chorus's type (9/29): four static cuts of Archivo, one family across its widths, for the three voices of
the creator's kinetic-type reference (yk3Av-CCYFUNeaKv.mp4) plus the outlined repeat. Drawn as outlines through opentype.js
(src/outline.js), which reads static fonts only, so the variable files are instanced here once.

Source: Google Fonts, ofl/archivo (SIL Open Font License 1.1, (c) 2020 The Archivo Project Authors, Omnibus-Type):
  https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf
  https://github.com/google/fonts/raw/main/ofl/archivo/Archivo-Italic%5Bwdth%2Cwght%5D.ttf
The licence travels with the cuts as fonts/OFL-Archivo.txt.

usage (the pixl env):  python tools/cut-archivo.py DIR_WITH_THE_TWO_VARIABLE_FILES
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
CUTS = [
    # file, source, axes: the voice it is
    ("Archivo-WideBlack.ttf", "Archivo[wdth,wght].ttf", {"wdth": 125, "wght": 900}),           # the hit word: wide, heavy caps
    ("Archivo-CondExtraBold.ttf", "Archivo[wdth,wght].ttf", {"wdth": 62, "wght": 800}),        # the repeat, drawn as an outline
    ("Archivo-CondExtraBoldItalic.ttf", "Archivo-Italic[wdth,wght].ttf", {"wdth": 62, "wght": 800}),   # the second hit voice
    ("Archivo-SemiCondItalic.ttf", "Archivo-Italic[wdth,wght].ttf", {"wdth": 72, "wght": 430}),        # the little words
]
for name, src, axes in CUTS:
    f = TTFont(os.path.join(SRC, src))
    st = instantiateVariableFont(f, axes, updateFontNames=False)
    p = os.path.join(OUT, name)
    st.save(p)
    print(f"{name}: {axes}  {os.path.getsize(p):,} bytes")
