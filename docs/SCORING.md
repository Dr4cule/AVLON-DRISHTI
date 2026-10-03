# Scoring — decision-tree reference

Engine: `sim-core/scoring.ts`. Inputs: immutable `sim.events` only. Never trusts client scores, wall clock, or UI state.

## Weights
detection 20 · classification 25 · decision 30 · outcome 15 · reasoning 10.

Grades: ≥90 Distinguished · ≥75 Proficient · ≥55 Developing · else Needs practice.

## Per-actor nodes (8)
1. Detected — ack delay vs par `max(8, 26-difficulty*3)`s, grace 3s
2. Classified — any non-unknown record
3. Correct identity — 80 allegiance + 20 type; hostile-false −20, other wrong −8 each
4. Appropriate response — hostile needs active effect; non-hostile needs observe/escalate
5. ROE compliant — 100 if no violation attempted; violations retained even after later correct action
6. Timely — response before asset range / impact
7. Effective — hostile resolved 100 / impacted 0 / escalated 50; non-hostile harmed 0 else 100
8. Reasoning — reason matches truth+response via `reasonIsAppropriate`

## Global
- Confusion 3×4 (truth hostile/friendly/benign × classified +unknown)
- detection_mean_s, asset_health value-weighted, event_hash 8-hex, completion 0..1, provisional if ended early
- No actions → total 0
- Outcome penalized: friendly harm −30 each, collateral −15 each (gameplay, not real effects)

## Examples
- Delayed baseline on first-light: ≥90, confusion[0][0]=1
- Benign C2 as hostile + jam: C2 <40, critical classification at exact tick, confusion[2][0]=1
- Kinetic when prohibited then legal jam: ROE node failed, violation retained
