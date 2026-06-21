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

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TSX = os.path.join(ROOT, "src/BrainKingdom.tsx")
FONT_DIR = os.path.join(ROOT, "public/fonts")

# (file, family, weight)
FONTS = [
    ("Cairo-400-arabic.woff2", "Cairo", "100 900"),
    ("Cairo-400-latin.woff2", "Cairo", "100 900"),
]
for w in (400, 500, 700, 800, 900):
    FONTS.append((f"Tajawal-{w}-arabic.woff2", "Tajawal", str(w)))
    FONTS.append((f"Tajawal-{w}-latin.woff2", "Tajawal", str(w)))


def cmap_codepoints(path):
    f = TTFont(path)
    cps = set()
    for t in f["cmap"].tables:
        cps |= set(t.cmap.keys())
    # control/formatting chars must never be "claimed" — they have no visible
    # glyph and would otherwise force .notdef. Let the browser handle them.
    cps -= {0x200C, 0x200D, 0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x061C, 0xFEFF}
    return cps


def unicode_range(cps):
    """Compact `unicode-range` covering EXACTLY the font's codepoints, so the
    @font-face never claims a character it cannot render (which would force a
    `?`/.notdef). Anything outside this set falls back to the system font."""
    out = []
    for cp in sorted(cps):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    parts = [f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out]
    return ", ".join(parts)


def face(file, family, weight):
    path = os.path.join(FONT_DIR, file)
    data = open(path, "rb").read()
    uri = "data:font/woff2;base64," + base64.b64encode(data).decode("ascii")
    rng = unicode_range(cmap_codepoints(path))
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
