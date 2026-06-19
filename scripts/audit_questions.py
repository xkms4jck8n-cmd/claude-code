#!/usr/bin/env python3
"""Question-bank audit & repair for RAW_BANK in src/BrainKingdom.tsx.

Safe, deterministic, evidence-based repairs only:
  1. Glyph normalization in data (rial sign ﷼ -> "ريال").
  2. Duplicate removal — exact (normalized) + near-duplicate (Jaccard>=0.85,
     same category), keeping the best-scored / most-specific version.
  3. Format-aware quality scoring (does NOT penalize the fill-in-the-blank
     `word`, symbolic `image`, or math `logic` formats that legitimately don't
     end in `؟`).

It does NOT fabricate semantic rewrites of thousands of questions — structural
integrity is already perfect (every answer is among exactly 4 distinct options).
Run: python3 scripts/audit_questions.py [--apply]
"""
import collections
import io
import json
import re
import sys

TSX = "src/BrainKingdom.tsx"
FILLIN = {"word", "image", "logic", "riddle"}  # formats without a `؟` prompt


def norm(t):
    t = re.sub(r"[ً-ْٰ]", "", t)
    t = re.sub(r"[إأآا]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    t = re.sub(r"[؟?.،,!:؛\-…()«»\"'’_]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def score(cat, q):
    Q, A, O = q["q"], q["a"], q["opts"]
    sc, flags = 100, []
    if cat not in FILLIN:
        if not Q.strip().endswith("؟") and ":" not in Q:
            sc -= 5; flags.append("no_qmark")
        if len(Q) < 8:
            sc -= 20; flags.append("too_short")
    if len(set(O)) != 4:
        sc -= 40; flags.append("opt_issue")
    if A not in O:
        sc -= 50; flags.append("ans_missing")
    others = [len(x) for x in O if x != A]
    if others and len(A) > 1.7 * (sum(others) / len(others)) and len(A) == max(len(x) for x in O):
        sc -= 12; flags.append("len_giveaway")
    if any(re.search(r"(test|xxx|lorem|\?\?|\.\.\.\.|undefined|null)", x, re.I) for x in O):
        sc -= 40; flags.append("placeholder")
    return max(0, sc), flags


def main():
    apply = "--apply" in sys.argv
    s = io.open(TSX, encoding="utf-8").read()
    m = re.search(r"export const RAW_BANK = (\{.*?\});\n", s, re.S)
    bank = json.loads(m.group(1))
    before = sum(len(v) for v in bank.values())

    glyph_fixes = 0
    exact_removed = 0
    near_removed = 0
    cross_removed = 0
    global_norms = set()  # for cross-category exact-duplicate removal
    out = {}
    for cat, qs in bank.items():
        # glyph normalization
        for q in qs:
            for field in ("q", "a"):
                if "﷼" in q[field]:
                    q[field] = q[field].replace("﷼", "ريال"); glyph_fixes += 1
            newopts = []
            for o in q["opts"]:
                if "﷼" in o:
                    o = o.replace("﷼", "ريال"); glyph_fixes += 1
                newopts.append(o)
            q["opts"] = newopts

        # rank best-first so the kept copy of any duplicate is the strongest
        ranked = sorted(qs, key=lambda q: (-score(cat, q)[0], -len(q["q"])))
        kept, kept_norms, kept_tok = [], set(), []
        for q in ranked:
            n = norm(q["q"])
            if n in kept_norms:
                exact_removed += 1
                continue
            if n in global_norms:  # identical question already kept in another category
                cross_removed += 1
                continue
            tk = set(n.split())
            dup = False
            if len(tk) >= 3:
                for kt in kept_tok:
                    if len(kt) >= 3:
                        jac = len(tk & kt) / len(tk | kt)
                        if jac >= 0.85:
                            dup = True; break
            if dup:
                near_removed += 1
                continue
            kept.append(q); kept_norms.add(n); kept_tok.append(tk)
        global_norms |= kept_norms
        # preserve original ordering for the kept items
        order = {id(q): i for i, q in enumerate(qs)}
        kept.sort(key=lambda q: order[id(q)])
        out[cat] = kept

    after = sum(len(v) for v in out.values())

    # final quality distribution (format-aware)
    dist = collections.Counter(); tot = 0; low = []
    for cat, qs in out.items():
        for q in qs:
            sc, fl = score(cat, q); tot += 1
            b = "95-100" if sc >= 95 else "85-94" if sc >= 85 else "70-84" if sc >= 70 else "<70"
            dist[b] += 1
            if sc < 85:
                low.append((cat, sc, fl, q["q"]))
    pct95 = 100 * (dist["95-100"] + dist["85-94"]) / tot

    print(f"questions: {before} -> {after}  (exact dups removed: {exact_removed}, "
          f"near dups removed: {near_removed}, cross-cat dups removed: {cross_removed}, glyph fixes: {glyph_fixes})")
    print("quality (format-aware):", dict(dist), f"| >=85: {pct95:.1f}%")

    if apply:
        new_raw = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
        s2 = s[:m.start(1)] + new_raw + s[m.end(1):]
        io.open(TSX, "w", encoding="utf-8").write(s2)
        print("APPLIED: RAW_BANK rewritten.")
        # emit stats for the reports
        json.dump({"before": before, "after": after, "exact_removed": exact_removed,
                   "near_removed": near_removed, "cross_removed": cross_removed, "glyph_fixes": glyph_fixes,
                   "dist": dict(dist), "pct_ge85": round(pct95, 1),
                   "low_count": len(low)}, open("/tmp/qstats.json", "w"))
    else:
        print("(dry run — pass --apply to write changes)")


if __name__ == "__main__":
    main()
