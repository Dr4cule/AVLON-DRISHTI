# AI Threat-Assessment Model — Training Report

_Regenerated deterministically: `npx tsx sim-core/threat/train.ts --seed 482913 --scenarios 220 --epochs 400`.
The raw dataset is never written to disk; rerunning the command reproduces these exact numbers._

- Model: multinomial logistic regression (softmax), 15 features → 6 classes, pure TypeScript, no dependencies.
- Data: 14874 labeled track snapshots from 230 headless simulations (10 scripted + 220 generated draws).
- Split: **scenario-level** 70/10/20 using deterministic round-robin assignment over sorted scenario IDs — validation consists entirely of track snapshots from simulated scenarios that are absent from the training set. This measures **generalization to unseen simulated scenarios**, not real-world generalization.
- Labels: ground-truth allegiance/kind, except tracks younger than 6 s or with fewer than 2 fresh sensor readings are labeled `unknown_uav` (insufficient evidence must mean "unknown").
- Training: seeded full-batch gradient descent, lr 1.0 with 1/(1+epoch/100) decay, L2 1e-4, inverse-frequency class weights (capped at 6), 400 epochs.
- Dataset generation took 2.8 s on a laptop CPU.

## Model comparison (identical splits, identical test set)

| Model | Accuracy | Macro F1 | Size |
| --- | ---: | ---: | --- |
| Majority | 40.0% | 0.095 | tiny |
| Heuristic | 77.9% | 0.535 | tiny |
| Softmax | 70.3% | 0.622 | ~1.9 KB |
| Softmax + interactions | 71.0% | 0.629 | ~2.5 KB |

An MLP was not built or benchmarked. The project deliberately retained the simpler softmax model because it already satisfied the required determinism, CPU-only/offline deployment, tiny footprint, and exact feature-attribution constraints, while the interaction benchmark did not meet the predefined improvement threshold.
Note on the heuristic: it re-implements parts of the labeling rule itself (notably the insufficient-evidence → unknown mapping), so its raw accuracy is inflated by construction. Macro F1 — which punishes its minority-class failures — is the honest comparator, and the trained model wins it while additionally providing calibrated probabilities and exact per-feature evidence the rule list cannot.

## Metrics (held-out TEST scenarios, n=2973)

- Overall accuracy: **0.703** (train: 0.706)
- Macro precision: **0.601** · Macro recall: **0.692** · Macro F1: **0.622** · Balanced accuracy: **0.692**
- **bird**: n=138, precision=0.317, recall=0.471, F1=0.379
- **balloon**: n=206, precision=0.333, recall=0.5, F1=0.4
- **friendly_uav**: n=402, precision=0.878, recall=0.754, F1=0.811
- **unknown_uav**: n=1190, precision=0.827, recall=0.687, F1=0.75
- **hostile_like_uav**: n=914, precision=0.792, recall=0.742, F1=0.766
- **clutter**: n=123, precision=0.456, recall=1, F1=0.626

## Confusion matrix (test)

| truth \ predicted | bird | balloon | friendly_uav | unknown_uav | hostile_like_uav | clutter |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bird | 65 | 63 | 0 | 3 | 7 | 0 |
| balloon | 79 | 103 | 0 | 16 | 4 | 4 |
| friendly_uav | 4 | 31 | 303 | 6 | 58 | 0 |
| unknown_uav | 37 | 47 | 41 | 817 | 109 | 139 |
| hostile_like_uav | 20 | 65 | 1 | 146 | 678 | 4 |
| clutter | 0 | 0 | 0 | 0 | 0 | 123 |

## Most confused pairs (computed, not hand-typed)

- hostile_like_uav → unknown_uav (146 cases)
- unknown_uav → clutter (139 cases)
- unknown_uav → hostile_like_uav (109 cases)

## Stress-test subsets (test split, from scenario/environment metadata)

- **NIGHT**: 70.2% (n=1770)
- **DEGRADED SENSORS**: 70.1% (n=2069)
- **HIGH SENSOR CONFLICT**: 65.9% (n=908)
- **HIGH AMBIGUITY**: 70.3% (n=2257)
- **NORMAL**: 68.1% (n=326)

## Scenario-level evaluation (test split, 46 scenarios)

- Mean scenario accuracy: **0.702** · median 0.689 · worst 0.551 · best 0.875

## Established-track accuracy (age ≥ 6 s with ≥ 2 fresh readings, n=1660)

- **0.692** — answers "how well does the model classify objects once enough evidence exists?", separate from the unknown-heavy headline number.

## Hostile-like vs non-hostile (derived binary view)

- Precision 0.792 · recall 0.742 · F1 0.766 · false-positive rate 0.086 · false-negative rate 0.258 (n=914 hostile)

## Confidence calibration

- Expected Calibration Error on held-out test scenarios: **0.109 before** → **0.046 after** (temperature 0.742, fitted on the calibration split only).
- The UI reports this number as MODEL CONFIDENCE: the model's own probability estimate, validated to track observed accuracy within the ECE above — not a physical probability.

## Interpretation for judges

- Accuracy is measured on *our own synthetic sensor model* — it proves the model learned the simulator's evidence patterns, not real-world sensing.
- The `unknown_uav` class is the point: the model is trained to say "unknown" when evidence is thin, which is exactly the trainee behavior we want to teach.
- Known-hard cases mirror real radar problems: `bird` vs `balloon` (both slow non-emitters) and `clutter` precision (small, slow, radar-only returns are the same returns that challenge real bird/clutter filters). These are documented, not hidden.
- Inference is a few dot products (<1 ms); weights file is a few KB; results are bit-identical for identical inputs.

## Limitations (must be stated on stage)

- Sensor models are fictional gameplay abstractions; the model cannot transfer to real sensors.
- Predictions are advisory only and never enter scoring, ROE, or replay.
- Performance degrades outside the training distribution by construction — same as any ML model.

## Reproducibility manifest

- Seed 482913 · scenarios 230 (train 161 / calib 23 / test 46) · snapshots train 10032 / calib 1869 / test 2973
- Config: epochs 400, lr 1.0 with 1/(1+epoch/100) decay, L2 1e-4, class-weight cap 6, snapshot ages 1/3/4/6/10/20/35/60/90/150s
- Feature version 2 · model version 2 · git commit b76e80bddd9af54126b85eacf9cb6de3608c2d8b
