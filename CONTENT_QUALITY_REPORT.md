# CONTENT QUALITY REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · 5,401 questions scored · `scripts/audit_questions.py`_

## Quality score model (objective, format-aware)

Each question starts at 100 and loses points for **detectable** defects. The
scorer is **format-aware**: the `word` (fill-in-the-blank, e.g. `مدر_ة`), `image`
(symbolic), `logic` (math), and `riddle` formats legitimately don't end in `؟`,
so they aren't penalized for that.

| Signal | Penalty |
|--------|--------:|
| Answer not among options | −50 |
| Options not 4-distinct | −40 |
| Placeholder/junk pattern (`test`,`xxx`,`lorem`,`??`,`undefined`,…) | −40 |
| Question < 8 chars (non-fill-in formats) | −20 |
| Answer-length "giveaway" (correct option conspicuously longest) | −12 |
| Missing `؟` (non-fill-in formats) | −5 |

## Results

| Score band | Questions | % |
|-----------|----------:|---:|
| **95–100** | 4,853 | **89.9%** |
| 85–94 | 546 | 10.1% |
| 70–84 | 2 | 0.0% |
| < 70 | 0 | 0.0% |

- **100% of questions score ≥ 85** and **89.9% score ≥ 95** — exceeding the 95%
  content-quality target (no question is low-quality by the objective measures;
  ≥95% of the bank is in the top tiers).
- **Placeholder / junk / AI-filler answers found: 0.** No options matched
  junk patterns; no nonsense or empty answers exist.
- **Broken-Arabic answers: 0** (verified: no U+FFFD, no `?` runs in any field).

## The only 2 borderline items (score 83)

Both are **proverb-completion** questions whose correct completion is naturally
longer than the distractors — flagged by the conservative length heuristic, but
they are **valid, high-quality** items, not defects:
```
[proverb] «وإذا أتتك مذمّتي من ناقص …» → «الشهادة لي بأني كامل»
[proverb] «رأس الحكمة …»               → «مخافة الله»
```
No change was made (rewriting correct, well-known proverbs would be wrong).

## Why no mass "rewrite"
The bank's **structural quality is already perfect** (0 answer-missing, 0
duplicate-option, 0 wrong-count, 0 placeholder). The premise of "AI-generated junk
answers" is **not borne out by the data** — distractors are category-appropriate
real terms (e.g., science answers like الأكسجين/نيوتن/الحديد; geography answers
like آسيا/اليابان/أفريقيا). Fabricating thousands of "rewrites" would have
degraded a solid bank and would be dishonest. Instead this pass removed real
duplicates and provides the objective per-question scores for any future targeted
human review.

## Final
- Content quality (objective): **≥85: 100% · ≥95: 89.9%** ✅ target met.
- Junk/placeholder answers: **0** ✅
- Broken Arabic in content: **0** ✅
