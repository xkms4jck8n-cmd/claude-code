#!/usr/bin/env python3
"""Embed the bundled Arabic woff2 fonts as base64 data-URIs inside the @font-face
block in src/BrainKingdom.tsx.

Why: relying on url(fonts/...) means the font must be fetched from the app
origin at runtime. Inside the iOS capacitor:// WebView that fetch can silently
fail, and the fallback font renders every missing Arabic glyph as "?" — which is
the "??? ????" corruption users reported. Data-URIs carry the font bytes inside
the CSS itself, so Arabic ALWAYS has a real font with zero path/origin/network
dependency.

Idempotent: re-running re-embeds from public/fonts/. Standard Google Fonts
arabic/latin unicode-ranges are used so the arabic and latin subset files can
coexist under the same family.
"""
import base64
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TSX = os.path.join(ROOT, "src/BrainKingdom.tsx")
FONT_DIR = os.path.join(ROOT, "public/fonts")

AR_RANGE = ("U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, "
            "U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, "
            "U+FE70-FE74, U+FE76-FEFC")
LAT_RANGE = ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, "
             "U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, "
             "U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD")

# (file, family, weight, subset)
FONTS = [
    ("Cairo-400-arabic.woff2", "Cairo", "100 900", "arabic"),
    ("Cairo-400-latin.woff2", "Cairo", "100 900", "latin"),
]
for w in (400, 500, 700, 800, 900):
    FONTS.append((f"Tajawal-{w}-arabic.woff2", "Tajawal", str(w), "arabic"))
    FONTS.append((f"Tajawal-{w}-latin.woff2", "Tajawal", str(w), "latin"))


def face(file, family, weight, subset):
    data = open(os.path.join(FONT_DIR, file), "rb").read()
    uri = "data:font/woff2;base64," + base64.b64encode(data).decode("ascii")
    rng = AR_RANGE if subset == "arabic" else LAT_RANGE
    return (f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n"
            f"  font-weight: {weight};\n  font-display: swap;\n"
            f"  src: url({uri}) format('woff2');\n  unicode-range: {rng};\n}}")


def main():
    s = io.open(TSX, encoding="utf-8").read()
    banner = ("/* Self-hosted Arabic UI fonts — EMBEDDED as base64 data-URIs so "
              "Arabic\n   renders with ZERO dependency on file paths, origins, or "
              "the network (works\n   identically in the iOS capacitor:// WebView). "
              "Regenerate with scripts/embed_fonts.py */")
    block = banner + "\n" + "\n".join(face(*f) for f in FONTS) + "\n"

    start = s.index("/* Self-hosted Arabic UI fonts")
    end = s.index("*{box-sizing", start)
    s = s[:start] + block + s[end:]
    io.open(TSX, "w", encoding="utf-8").write(s)
    print(f"Embedded {len(FONTS)} fonts as base64 data-URIs into {TSX}")


if __name__ == "__main__":
    main()
