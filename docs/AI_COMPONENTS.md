# AI components — inspectable, no black boxes

1. **Skill model (`sim-core/adaptive.ts`)** — per-dimension Beta(a,b), init 2/2. Success (≥70, non-provisional) adds tag-weight `0.2+tag/5` to a, else to b. Mean a/(a+b), uncertainty 1/(a+b). Synthetic/provisional excluded. Visible in Adaptive intelligence as % ± uncertainty.
2. **Difficulty calibration** — historical success rate per difficulty 1..5 from real sessions. Cold start (fewer than 2 real sessions) labeled; no rating claimed.
3. **Selector** — weakest mean dimension; difficulty maps skill→1..5 then snaps to calibration bucket nearest 67.5% success; deterministic; recent fingerprints avoided; rationale strings shown.
4. **Generator** — seeded templates + validity + baseline + diversity; labeled algorithm, not ML.
5. **Weakness analytics** — critical-mistake clusters by category + unit heatmap (time×hostile-load); counts only, no validated readiness claim.
6. **Sensor fusion** — rule-based confidence merge with decay; observation quality, not allegiance.

What we do NOT claim: neural models, learning transfer, combat readiness. Tests: `tests/adaptive.test.ts` (update, uncertainty, weakest targeting, determinism, cold start).
