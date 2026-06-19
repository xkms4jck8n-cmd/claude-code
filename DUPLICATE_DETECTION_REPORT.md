# DUPLICATE DETECTION REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · `scripts/audit_questions.py`_

## Method
Questions are compared after **Arabic normalization** (strip diacritics, unify
alef/ya/ta-marbuta forms, drop punctuation/underscores, collapse spaces) — the
same normalization the game uses at runtime. Three duplicate classes are detected:

1. **Exact (in-category):** identical normalized question text within a category.
2. **Cross-category exact:** identical normalized question in two+ categories.
3. **Near-duplicate (in-category):** token-set **Jaccard ≥ 0.85** — same meaning,
   slightly different wording.

For every duplicate group, the **best version is kept** (highest objective quality
score, tie-broken by the more specific/longer question); the rest are removed.

## Results

| Class | Removed |
|-------|--------:|
| Exact duplicates (in-category) | **2** |
| Cross-category exact duplicates | **21** |
| Near-duplicates (Jaccard ≥ 0.85) | **27** |
| **Total removed** | **50** |
| Questions: 5,451 → | **5,401** |

### Example near-duplicates collapsed (kept the more specific wording)
```
science:  «ما أكبر عضو في جسم الإنسان؟»            ≈ «ما أكبر عضو داخلي في جسم الإنسان؟»
science:  «ما اسم أصغر عظمة في جسم الإنسان؟»        ≈ «ما أصغر عظمة في جسم الإنسان؟»
general:  «ما اسم الجهاز الذي يقيس ضغط الدم؟»       ≈ «ما الجهاز الذي يقيس ضغط الدم؟»
science:  «ما اسم العملية التي تتكاثر بها البكتيريا؟» ≈ «ما العملية التي تتكاثر بها البكتيريا؟»
```

## "Same answer repeated excessively" — analysis (no false removals)
A naive "remove repeated answers" rule would corrupt the bank, because some
categories repeat answers **by design**:
- `word` (fill-in-the-blank): answers are single letters (ا, ر, م …) — repetition
  is inherent to the format.
- `logic` (math): numeric answers (10, 30, 8 …) naturally recur.

In the **prose** categories (general/science/geo/history/islamic/proverb/riddle/
literature) no answer is over-represented (top answers appear ≤ 8 times across
~500 questions — normal). So **no answers were removed** on repetition grounds;
doing otherwise would have deleted valid questions.

## Final validation (cleaned bank)
```
exact duplicate questions remaining ... 0
near-duplicate pairs remaining ........ 0
```
Zero duplicates of any class remain.
