# AVLON DRISHTI — Improvement & Research Report

Status: **in progress** (baseline: commit `f764dab`, clean tree). This file tracks what was found, what the research supports, what is being changed, and how each change is verified. Numbers below are copied from `docs/AI_METRICS.json` / `docs/AI_THREAT_REPORT.md`, never from memory.

## 0. Bottom line

The foundation is strong: a deterministic shared core, honest validation reporting, server-authoritative scoring, and a 97-test suite. The highest-value work is **reliability first** (save/replay honesty), then **decision clarity** (response board, mistake-linked debrief), then **a complete instructor cycle**, then **research-backed scenario packs**. A prior round of assurances overstated completeness; the findings below were re-verified against current source.

---

## 1. Reliability defects (fix first)

### 1.1 AAR hook ordering — `ui/aar/AfterActionReview.tsx:69–70`
`useMemo` calls for `confusion` and `verified` sit after the empty-state early return (line 63). Rendering empty → populated without unmount adds hooks mid-life → React hook-order error caught only by the outer boundary. **Fix:** compute session-guarded values before any early return. **Verify:** empty → populated → empty rerenders in a mounted component test or browser journey.

### 1.2 Successful saves presented as failures — `ui/lib/useTraining.ts:52–67`
`localStorage.removeItem()` runs inside the same `try` as the server commit and before journal cleanup/callback. A storage failure after a good `/finish` reports "unsaved" and blocks new work. Checkpoints also queue unboundedly behind stale snapshots. **Fix:** separate durable-commit success from best-effort browser cleanup; add explicit save-pending/retry states. **Verify:** commit-then-cleanup-throws still notifies completion exactly once; failed finish → reload → retry works.

### 1.3 Shortcuts die on focused buttons — `ui/tactical/TacticalStation.tsx:35–42`
The Space-key guard returns early for *all* keys on button targets, so A/1–4 stop working after normal contact-button selection. **Fix:** scope native-control exclusion to Space/Enter only. **Verify:** focused contact button + A/1–4 records actions; Space never double-activates.

### 1.4 Training tests rewrite shipped artifacts — `tests/threat.test.ts:225–240`
The determinism test trains against committed `weights.json`/report/metrics and "restores" by retraining (no `finally`). A failure/interruption leaves a small test model installed; parallel workers can read mid-rewrite. **Fix:** explicit output directory for test training runs; compare isolated artifacts; never touch production files from tests. **Verify:** kill the suite mid-run; committed artifact hashes unchanged.

### 1.5 E2E coherence gaps — `playwright.config.ts`, `tests/e2e/global-setup.ts`
The browser hits port 3001 (backend + existing `dist/web`); nothing guarantees a fresh production build, and the DB reset deletes SQLite files after the server has opened them. **Fix:** build once, serve that build, allocate a unique absolute DB path before spawning the server. **Verify:** disposable-checkout run with no prebuilt frontend passes.

### 1.6 Session receipt integrity — `backend/store.ts:155–178,180–214`
Refinish compares actions but ignores the requested end tick; checkpoints can accept actions inside already-sealed time. **Fix:** fold tick monotonicity, prefix preservation, and completion identity into one lifecycle invariant with tests. **Verify:** different-tick refinish conflicts; backdated inserts rejected; exact retries idempotent.

### 1.7 Historical compatibility — scoring rules changed, versions did not
Engine stays `1.0.0`, report schema `1.0`, yet grading behavior changed; old reports/skills look equivalent to new ones, and old drafts can lock out `start()`. **Fix:** scoring-revision watermark on reports/skills; AAR distinguishes incompatible-engine vs corrupt evidence; supported draft retire path. **Verify:** pre-change DB opens with labeled history and a working restart path.

---

## 2. ML integrity issue

### 2.1 Final test data influences model selection — `sim-core/threat/train.ts:363–388`
Test macro-F1 picks the model variant and test ECE decides whether calibration is kept. The reported test set is therefore not untouched. **Fix:** select architecture on validation data, fit calibration on a separate split, evaluate once on a frozen test set, regenerate report + metrics + docs claims. **Verify:** selection code never reads the test split; reruns reproduce bytes.

---

## 3. Research assessment

### 3.1 Supplied links
- **Drone Wars** (`dronewars.github.io/data`): 2018 snapshot derived from Bureau reporting on Afghanistan/Pakistan/Somalia/Yemen. Valuable for uncertainty/casualty-classification lessons; **not** sensor data.
- **Bureau of Investigative Journalism** (full data + methodology): 2010–2020 project; country spreadsheets, timelines, source links, casualty ranges. Pakistan collection is drone-strike focused; others include other US actions. **Best use:** briefing context and evidence-interpretation lessons. Reuse: credit required; photos/video need separate permission.

### 3.2 Additional public sources (verified live)
| Source | Contains | Use in DRISHTI |
|---|---|---|
| ACLED codebook/data | Reported conflict events, actors, precision codes, `Air/drone strike` category | Context research; filter carefully (aircraft+drones combined; interceptions under `Disrupted weapons use`) |
| Airwars methodology | Allegation grading (Confirmed/Fair/Weak/Contested/Discounted), geolocation standards | Model for corroboration/confidence language |
| New America counterterrorism wars | Strike databases + counting methodology | Cross-checking; note figures update while analysis text does not |
| UCDP downloads | Versioned organized-violence datasets, codebooks, API (CC BY 4.0) | Reproducible context research |
| UN OHCHR Ukraine reports | Verified civilian-harm reporting | Civilian-protection context |
| FAA sightings reports | Quarterly UAS sighting spreadsheets | Ambiguous-report case studies (a sighting ≠ hostility) |
| DroneRF (Mendeley, CC BY 4.0) | 227 RF segments, 3 drones + background | Separate RF recognition experiment; no intent labels |
| Anti-UAV (GitHub, MIT) | RGB/thermal tracking benchmarks | Visual disappearance/reacquisition exercises |
| MMAUD (ICRA 2024) | Cameras, LiDAR, radar, audio arrays + reference trajectories | Strongest multimodal research candidate; heavy preprocessing |
| SIPRI Arms Transfers | Major conventional arms flows | Strategic context only; commercial use needs license |
| PIB Operation Sindoor release | India's official integrated-AD/counter-UAS account | Attributed Indian context, not sensor measurements |
| SeDaFuV (JRC) | EU open C-UAS sensor-fusion platform | Citation for fusion approach; no public dataset located |

### 3.3 License rule
Check dataset-specific terms before bundling anything offline. Known: DroneRF CC BY 4.0; MMAUD dataset CC BY-NC-SA 4.0 (repo MIT covers code, not data); ACLED has EULA/licensing restrictions; TBIJ requires credit, media restrictions apply.

### 3.4 What research cannot do here
Conflict records answer *what was reported*; sensor datasets answer *what sensors observe*; only learner data answers *did training work*. Keep the three evaluations separate.

---

## 4. Product improvements (sequenced after reliability)

1. **Response-readiness board** — separate policy/range/charges/cooldown per response; "Issue Intercept now"; persistent timestamped receipts. Reuses `EFFECTORS`/`checkRoe`.
2. **Decision-linked debrief + targeted retry** — analysis follows the selected mistake; practice handoff carries focus; optional clearly-labeled counterfactual branch, original record immutable.
3. **Instructor cycle** — enrollment, assignment inbox/completion linkage, authoring revisions, consistent roster filters.
4. **Research-backed scenario packs** — source card per exercise (source, date, lesson, uncertainties, fictionalized parts, skill practiced).
5. **Learning evidence** — mistake-category-driven skill updates only where exercised; pre/post evaluation on unseen matched exercises.

---

## 5. Verification log

| Date (UTC) | Change | Verification |
|---|---|---|
| 2026-10-04 | Report created; no code changes yet | Read-only review of HEAD `f764dab` |
| 2026-10-04 | Save lifecycle: server commit separated from browser cleanup; finished-journal recovery copy corrected | `npm run typecheck` clean; full suite 97/97; E2E judge path green |
| 2026-10-04 | AAR hooks unconditional + explicit engine-version vs corruption replay states | Typecheck clean; E2E debrief asserts REPLAY VERIFIED |
| 2026-10-04 | Keyboard: Space exclusion scoped to native buttons; A/1-4 work from any focus | E2E ack assertion un-swallowed and passing |
| 2026-10-04 | Training checks isolated via `--out` temp dirs; committed weights/metrics/report untouched | `git status` clean on all three artifacts after suite run |
| 2026-10-04 | E2E: unique DB per run, fresh `npm run build` before serve, no stale-draft masking | 2/2 Playwright from clean-build path |
| 2026-10-04 | Response-readiness board (ROE/range/charges split), "Issue X now" wording, timestamped receipts | Typecheck clean; E2E exercises both buttons |
