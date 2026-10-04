# Scoring — decision-tree reference

Engine: `sim-core/scoring.ts`. Inputs: immutable `sim.events` only. Never trusts client scores, wall clock, or UI state.

## Weights
detection 20 · classification 25 · decision 30 · outcome 15 · reasoning 10.

Grades: ≥90 Distinguished · ≥75 Proficient · ≥55 Developing · else Needs practice.

## Per-actor nodes (8)
1. Detected — ack delay vs par `max(8, 26-difficulty*3)`s, grace 3s
2. Classified — any non-unknown record
3. Correct identity — 80 allegiance + 20 type, judged on the classification recorded before the first active response (post-shot classifications do not count); hostile-false −20, other wrong −8 each
4. Appropriate response — hostile needs active effect; non-hostile needs a non-active response (observe/warn/escalate). Only ordered (executed) active effects against non-hostiles cap the decision score; responses ROE correctly blocked never happened.
5. ROE compliant — 100 if ≥1 response recorded and zero violations attempted (0 when nothing was recorded — compliance cannot be assessed without an action); violations retained even after later correct action
6. Timely — response before asset range / impact (ordered responses score timely only while the contact is outside 400 m; impacts register inside 260 m; both measured from the defended point)
7. Effective — hostile resolved 100 / impacted 0 / escalated 50; non-hostile harmed 0 else 100
8. Reasoning — reason matches truth+response via `reasonIsAppropriate`

## Decision arithmetic (exact)

- `appropriate` = mean over ordered responses (100 each if context-fitting, else 0); no orders → 0.
- `compliant`: 100 with ≥1 response and zero violations; one violation → 40, each further violation −15 (floor 0); no responses → 0.
- `timely` = mean over ordered responses (100 each if timely); no orders → 0.
- `decision` = appropriate×0.5 + compliant/3 + timely/6 − min(30, 5 per non-violation rejection).
- Only ordered active effects against non-hostiles cap decision at 20; blocked attempts never happened.

## Global
- Confusion 3×4 (truth hostile/friendly/benign × classified +unknown)
- detection_mean_s, asset_health value-weighted, event_hash 8-hex, completion 0..1, provisional if ended early
- No actions → total 0
- Outcome penalized: friendly harm −30 each, collateral −15 each (gameplay, not real effects)

## Examples
- Delayed baseline on first-light: ≥90, confusion[0][0]=1
- Benign C2 as hostile + jam: C2 <40, critical classification at exact tick, confusion[2][0]=1
- Kinetic when prohibited then legal jam: ROE node failed, violation retained
