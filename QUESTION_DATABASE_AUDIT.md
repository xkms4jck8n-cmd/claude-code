# QUESTION DATABASE AUDIT — Kingdom of Knowledge

_Date: 2026-06-15 · Source: `RAW_BANK` in `src/BrainKingdom.tsx` · Tool: `scripts/audit_questions.py`_

## Scope & method
The question bank is an inline `RAW_BANK` object (no external DB/JSON/API). Each
item is `{ q, a, opts[4], d }`. The audit is **deterministic and evidence-based**
(parsed JSON, normalized-Arabic comparison, font glyph-table checks). Repairs are
limited to changes that are provably safe; see the honesty note at the end.

## Headline numbers

| Metric | Value |
|--------|------:|
| Questions before | **5,451** |
| Questions after | **5,401** |
| Duplicates removed | **50** (2 exact in-category · 27 near-duplicate · 21 cross-category exact) |
| Corrupted strings in data | **0** (no U+FFFD, no `?` runs — verified) |
| Glyph normalizations | **1** (`﷼` → `ريال`) |
| Structural defects | **0** before and after (answer always among 4 distinct options) |
| Categories | 11 (all valid) |

## Structural integrity (before any change)
Already excellent — these were **all zero**:
- answer not in options: **0**
- duplicate options within a question: **0**
- option count ≠ 4: **0**
- empty/missing fields: **0**

So the bank was well-formed; the work was **deduplication + glyph normalization +
scoring**, not repairing broken records.

## Per-category counts (after dedup)

| Category | Title | After |
|----------|-------|------:|
| general | ثقافة عامة | 501 |
| science | علوم | 481 |
| geo | جغرافيا | 534 |
| islamic | أسئلة دينية | 488 |
| history | تاريخ | 489 |
| word | كلمات (fill-in-blank) | 510 |
| proverb | أمثال | 475 |
| image | رموز وأشكال | 517 |
| logic | منطق (math) | 456 |
| riddle | ألغاز | 482 |
| literature | أدب وفنون | 468 |

## Part 4 — Category validation
Questions are **keyed by category** in `RAW_BANK[category]`, so membership is
structural (a question physically lives in its category array). All 11 category
titles are correct Arabic (verified, render correctly). No mis-keyed records were
found. Cross-category **exact** duplicates (21) were removed, keeping the first
occurrence — so the same question no longer appears under two categories.

## Part 5 — Difficulty (`d`) distribution
Each question carries a `d` (difficulty tier) used by the game's strict
tier-selection. Distribution is intact post-dedup; the `word`/`logic` formats use
their own difficulty progression. Reclassifying 5,400 items by *true* perceived
difficulty requires human/domain review and was **not** auto-changed (doing so by
script would be guesswork) — see honesty note.

## Final automated validation (cleaned bank)
```
exact duplicate questions remaining ... 0
near-duplicate pairs remaining ........ 0
structural defects .................... 0
answer-not-in-options ................. 0
U+FFFD replacement chars .............. 0
'???'+ literal runs ................... 0
claimed-but-missing font glyphs ....... 0
tsc --noEmit .......................... exit 0
vite build ............................ clean
```

## Honesty note (what was and wasn't done)
- **Done (verifiable):** removed 50 duplicates, normalized the rial glyph,
  computed an objective quality score for every question, confirmed zero
  structural defects and zero corruption.
- **Not done (and why):** semantically rewriting thousands of Arabic questions /
  re-judging "is this distractor believable" / re-rating true difficulty for
  5,400 items cannot be done reliably by a script and isn't something I can
  honestly claim to have hand-reviewed at that scale. The objective scorer (next
  report) flags the few weakest items for targeted human review instead of
  fabricating mass rewrites.

See also: `CONTENT_QUALITY_REPORT.md`, `DUPLICATE_DETECTION_REPORT.md`, `LOCALIZATION_REPAIR_REPORT.md`.
