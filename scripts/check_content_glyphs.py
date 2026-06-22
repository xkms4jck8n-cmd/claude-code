#!/usr/bin/env python3
"""
check_content_glyphs.py — data-integrity guard for the question bank.

ROOT-CAUSE GUARD for the "??? boxes" bug. The boxes are NOT corrupted Arabic
(Arabic is clean UTF-8 and shapes correctly with the bundled fonts). They are
the iOS "unknown glyph" placeholder, emitted when question CONTENT uses a
codepoint the device cannot render — e.g. non-emoji symbols from the
Alchemical / Geometric / Astrological blocks used as if they were emoji.

This script parses RAW_BANK out of src/BrainKingdom.tsx and fails (exit 1) if any
question text/answer/option contains such an unrenderable codepoint, so the
class of bug can never silently return. Run it in CI / pre-build.

Usage:  python3 scripts/check_content_glyphs.py
"""
import re, sys, json, unicodedata
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "BrainKingdom.tsx"

# Unicode blocks whose codepoints have NO color-emoji presentation and are NOT
# reliably present in iOS text fonts -> render as .notdef / blue-"?" boxes.
UNRENDERABLE_RANGES = [
    (0x1F700, 0x1F77F),  # Alchemical Symbols
    (0x1F780, 0x1F7DF),  # Geometric Shapes Extended (non-emoji)
    (0x2BF0,  0x2BFF),   # misc symbols/arrows tail
]
# Specific non-emoji symbols seen used as "emoji" prompts (geometric/astro/etc.)
UNRENDERABLE_CHARS = set("⬢⬡⬟⬤✶☉☼☤✦❖☥")

def is_unrenderable(ch: str) -> bool:
    cp = ord(ch)
    if ch in UNRENDERABLE_CHARS:
        return True
    return any(a <= cp <= b for a, b in UNRENDERABLE_RANGES)

def main() -> int:
    src = SRC.read_text(encoding="utf-8")
    m = re.search(r"export const RAW_BANK = (\{.*?\});\n", src, re.S)
    if not m:
        print("FAIL: could not locate RAW_BANK in", SRC)
        return 1
    bank = json.loads(m.group(1))

    problems = []
    for cat, qs in bank.items():
        for q in qs:
            blob = q.get("q", "") + " " + q.get("a", "") + " " + " ".join(q.get("opts", []))
            bad = {ch for ch in blob if is_unrenderable(ch)}
            if bad:
                names = ", ".join(f"U+{ord(c):04X} {unicodedata.name(c, '?')}" for c in bad)
                problems.append(f"[{cat}] {q.get('q','')[:40]!r} -> {names}")

    if problems:
        print(f"FAIL: {len(problems)} question(s) use unrenderable glyphs:")
        for p in problems:
            print("  " + p)
        return 1
    print("OK: question bank uses only renderable content glyphs.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
