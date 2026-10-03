# AI Threat-Assessment Model — Training Report

_Regenerated deterministically: `npx tsx sim-core/threat/train.ts --seed 482913 --scenarios 220 --epochs 400`.
The raw dataset is never written to disk; rerunning the command reproduces these exact numbers._

- Model: multinomial logistic regression (softmax), 15 features → 6 classes, pure TypeScript, no dependencies.
- Data: 14874 labeled track snapshots from 230 headless simulations (10 scripted + 220 generated draws), snapshot ages 1/3/4/6/10/20/35/60/90/150s, deterministic 80/20 split.
- Labels: ground-truth allegiance/kind, except tracks younger than 6 s or with fewer than 2 fresh sensor readings are labeled `unknown_uav` (insufficient evidence must mean "unknown").
- Training: seeded full-batch gradient descent, lr 1.0 with 1/(1+epoch/100) decay, L2 1e-4, inverse-frequency class weights, 400 epochs.
- Dataset generation took 3.3 s on a laptop CPU.

## Metrics (held-out validation, n=2974)

- Overall accuracy: **0.7054** (train: 0.7059)
- **bird**: n=125, precision=0.268, recall=0.488
- **balloon**: n=218, precision=0.401, recall=0.523
- **friendly_uav**: n=416, precision=0.882, recall=0.752
- **unknown_uav**: n=1216, precision=0.839, recall=0.679
- **hostile_like_uav**: n=867, precision=0.791, recall=0.753
- **clutter**: n=132, precision=0.441, recall=0.992

## Confusion matrix (validation)

| truth \ predicted | bird | balloon | friendly_uav | unknown_uav | hostile_like_uav | clutter |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bird | 61 | 49 | 0 | 10 | 4 | 1 |
| balloon | 87 | 114 | 0 | 12 | 5 | 0 |
| friendly_uav | 7 | 34 | 313 | 3 | 59 | 0 |
| unknown_uav | 30 | 54 | 39 | 826 | 105 | 162 |
| hostile_like_uav | 43 | 33 | 3 | 132 | 653 | 3 |
| clutter | 0 | 0 | 0 | 1 | 0 | 131 |

## Interpretation for judges

- Accuracy is measured on *our own synthetic sensor model* — it proves the model learned the simulator's evidence patterns, not real-world sensing.
- The `unknown_uav` class is the point: the model is trained to say "unknown" when evidence is thin, which is exactly the trainee behavior we want to teach.
- Known-hard cases mirror real radar problems: `bird` vs `balloon` (both slow non-emitters) and `clutter` precision (small, slow, radar-only returns are the same returns that challenge real bird/clutter filters). These are documented, not hidden.
- Inference is a few dot products (<1 ms); weights file is a few KB; results are bit-identical for identical inputs.

## Limitations (must be stated on stage)

- Sensor models are fictional gameplay abstractions; the model cannot transfer to real sensors.
- Predictions are advisory only and never enter scoring, ROE, or replay.
- Performance degrades outside the training distribution by construction — same as any ML model.
