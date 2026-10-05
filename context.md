# AVLON DRISHTI — PPT Context (raw facts, no screenshots)

- Purpose: single briefing source for converting into the 6-slide SIH idea PPT.
- Presenting team: **Sentinels-6** (product/brand name: AVLON DRISHTI).
- Base template: `SIH2026-IDEA-Presentation-Format (1).pptx` (7th slide is instruction-only; final deck = 6 slides including title).
- Freshness rule: generated numbers below are copied from `docs/AI_METRICS.json` and `docs/AI_THREAT_REPORT.md`; never retype metrics from memory.
- Demo credentials are local-only and safe to show on stage.

## 0. Six-slide allocation

| # | Template slide | Use this context section |
|---|---|---|
| 1 | Title page | §1 |
| 2 | Idea title / proposed solution + uniqueness | §2 problem + §3 solution + §4 uniqueness |
| 3 | Technical approach | §5 |
| 4 | Feasibility and viability | §6 |
| 5 | Impact and benefits | §7 |
| 6 | Research and references | §8 |

## 1. Title-slide facts

- Problem Statement ID: **SIH26247**.
- Problem Statement Title: **AI-Enabled Drone & Counter-Drone Threat Simulation Trainer**.
- Organization: **Ministry of Defence (MoD), Defence Services Staff College**.
- PS Category: **Software**.
- Theme: **Robotics and Drones**.
- Team Name: **Sentinels-6** (Team ID: fill from portal).
- Product name: **AVLON DRISHTI** ("Drishti" = sight/perspective).
- One-line pitch: a laptop-runnable, offline-capable trainer that puts a trainee in the seat of an air-defence operator, feeds an imperfect multi-sensor picture of drone threats, scores decisions against a rules-of-engagement decision tree, and adapts the next scenario to their weaknesses.
- Hook line: "We train judgment under doubt, not reflexes — confidence is evidence quality, not permission to act."
- Key line: "AI recommends. Deterministic simulation verifies. Human decides."

## 2. Problem facts

- Low-cost commercial and military-grade drones, used individually and in swarms, are a decisive battlefield factor (Ukraine FPV war; Operation Sindoor, May 2025, drone waves met by India's integrated grid).
- Current training = classroom slides + rare, costly, weather-dependent live drills; troops get too few decision repetitions under pressure.
- Required (SIH 26247): software simulation platform to train recognizing, classifying, and responding to drone/swarm threats across varied scenarios (day/night, degraded sensors, urban/rural, single + swarm), usable at unit level with minimal specialized hardware.
- Four mandatory outcomes: (1) desktop or VR-capable simulator with scripted + procedurally generated scenarios; (2) decision-tree scoring on detection time, classification accuracy, engagement decisions; (3) AAR dashboard tracking individual + unit performance over sessions; (4) adjustable difficulty + scenario randomization to prevent rote learning.
- Scale signal: Ashni drone platoons in all 385 infantry battalions need exactly this kind of trainer.
- Cost-exchange context: defenders cannot afford to shoot everything (e.g. multi-million interceptors vs thousand-dollar drones); target prioritization and response selection under uncertainty is the core skill. EW is cheap per shot but radiating emitters get hunted; "jam everything" has costs too.

## 3. Solution facts (what AVLON DRISHTI is)

- Offline adaptive drone-threat decision trainer running on an ordinary laptop: no internet, no GPU, no special hardware.
- The trainee never sees ground truth; they see a simulated imperfect sensor picture (noise, delay, clutter, failures) and must detect, classify (hostile / friendly / benign / unknown + drone type), and decide a response under per-scenario rules of engagement (ROE).
- One training round: Observe (noisy tracks; could be hostile, friendly, birds, balloons, clutter, wire-guided intruders) → Decide (acknowledge → classify → abstract response + recorded reason) → Fair judgment (detection speed, classification accuracy, ROE compliance, timeliness, outcome, reasoning; violations stay on record) → Replay the truth (scrub timeline, flip trainee view vs ground truth, jump to each mistake) → Adapt (weakest skill targeted at ~68% success difficulty; seeded generation + fingerprints make rote learning impossible).
- Users: trainee (operator) plays; instructor builds/assigns scenarios and reviews AAR + unit readiness; unit commander views readiness (observed evidence only).
- Modes: training mode (hints) and assessment mode (scored, stored); team mode and VR are explicit stretch non-goals.
- Content: 10 scripted exercises (L1–L5 curriculum, Appendix B) + unlimited seeded procedural generation with validity checks, baseline-feasibility gate, and fingerprint diversity.
- Scoring: 8-node per-contact decision-tree trace, server-recomputed from an immutable event log; every mistake timestamped with a plain-English explanation.
- Replay: same scenario + seed + action log = byte-identical event log (tested; event hash shown in AAR; E2E asserts REPLAY VERIFIED).
- Adaptive: Bayesian Beta skill model per dimension with uncertainty, difficulty calibration from real history, recommended next exercise with rationale; cold starts and synthetic data labeled, never hidden.
- Instructor: visual scenario studio (schema + baseline-gated save, JSON import/export, unit assignment with validation/lifecycle) + unit readiness dashboard (averages, trends, failure clusters, roster, CSV/print export; synthetic excluded/labeled; no readiness-certification claims).

## 4. Uniqueness facts

- Trains judgment, not reflexes: the core skill is telling hostile drones from birds, friendly UAVs, balloons, clutter, or wire-guided intruders under degraded sensors, then justifying the response under ROE. Pilot trainers teach flying; intercept/RL projects teach algorithms; commercial C-UAS trainers are proprietary, hardware-tied, shooter-focused.
- Decision-tree scoring with receipts: 8 nodes per contact (detected → classified → correct identity → appropriate response → ROE-compliant → timely → effective → reasoned), server-side recompute, client scores never trusted.
- Sensor-view vs ground-truth replay at the same tick: the product's "aha" moment, packaged as synchronized scrub + decision markers + clickable mistakes.
- Deterministic and replayable: 250 ms fixed ticks, seeded Mulberry32 PRNG, quantized positions, stable actor ordering; rendering/time/IO never enter the core.
- Adaptive without black boxes: published Beta update rule, uncertainty shown, deterministic history-derived recommendation seeds.
- Runs anywhere, owns nothing: one portable runtime, SQLite file DB, vendored offline bundle, zero licenses, zero cloud, zero telemetry (health reports `external_services: 0`).
- Honest-AI posture stated on stage: fictional gameplay models, synthetic-only training data, advisory AI, no real-sensor transfer, no readiness certification, no MLP/ONNX/LLM.

## 5. Technical approach facts

### 5.1 Stack (checkable names)

- UI: React 19 + TypeScript + HTML5 Canvas (2D tactical map), Vite 7 build.
- Backend: Node.js 24 LTS (engines `>=24.0.0 <25`; bundle vendors v24.13.0) + Express 5 + built-in `node:sqlite` (WAL, FK, append-only event trigger, scrypt logins).
- Shared core: `sim-core/` pure TypeScript, zero UI/IO deps; runs identically in browser, server, and tests.
- Validation: JSON Schema (`schemas/`) validated on import, generation, studio save, server start (Ajv + semantic checks).
- Tests: Vitest 3 (99/99 across 12 files) + Playwright (2/2: API smoke + real-Chromium judge path on isolated DB); `tsc --noEmit` clean.
- Delivery: single-folder offline bundle (`packaging/bundle.mjs` stages `release/AVLON-DRISHTI` with vendored Node, bundled server `dist/server.cjs`, `dist/web`, scenarios, schemas, docs, launch scripts) + Docker Compose.
- Dependency note: deliberate deviation from spec's Python/FastAPI default (recorded as decision 002) to run the exact same core in browser/server/tests with one runtime.

### 5.2 Core loop (draw on slide)

- SIMULATED SENSOR DATA → 15-feature trained model → threat hypothesis + model confidence + evidence → HUMAN DECIDES → deterministic scoring → AAR/replay → Bayesian skill model → adaptive challenge → procedural generation → loop.
- Four kinds of "AI" (name which is which): TRAINED ML = threat classifier only; STATISTICAL ADAPTATION = Bayesian skill model; RULE-BASED INTELLIGENCE = pattern detection, challenge mapping, adversary emphasis; DETERMINISTIC SYSTEMS = simulation, scoring, replay, fairness gate.

### 5.3 Simulation core facts

- Tick: 250 ms fixed step; engine version 1.0.0; seeded PRNG everywhere (no `Math.random`, no wall clock in core).
- Event log: immutable events (spawn, first-detectable, sensor detection, status changes, ack/classify/respond, neutralized, asset damaged, ...); AAR and scoring computed from this log; server replays actions instead of trusting client scores.
- Sensors (5 channels): `radar`, `eo` (day visual), `ir` (night thermal), `acoustic` (bearing-only), `rf` (bearing-only); per-sensor intervals/ranges, signature table, detection probability from range/signature/weather/terrain-masking/degradation; degradations: dropout/noise with start/duration; fog, night, wind, EM clutter, terrain occlusion; IFF delayed 16 ticks; track confidence decays; EO/IR visual evidence strings.
- Drone archetypes (gameplay-level): small quadcopter, fixed-wing loiterer (loiter-then-dive), fast one-way attacker, recon drone, swarm elements, benign distractors (bird flocks, kite, balloon, helicopter, friendly UAV), plus `clutter` (benign radar-only artifact) and `fiber_optic` wire-guided intruder (radar ignores EM degradation, RF nearly silent).
- Swarm behaviors: flocking (boids: separation/alignment/cohesion), saturation attack, decoy-and-strike, leader-follower (leader loss degrades swarm), probe-and-withdraw; parameterized (size, spacing, aggression, coordination).
- Environment: terrain rural/urban/border-mountain; day/dusk/night; clear/fog/rain/wind/glare; EM clean/jammed/high-clutter.
- Responses (7 abstract game actions): `observe`, `warn`, `electronic_jam`, `spoof_redirect`, `net_capture`, `kinetic_intercept`, `escalate_to_command`; each has abstract range/success-probability/cooldown/charges/side-effect profile; ROE gates: hostile + confidence threshold + no IFF + kinetic gate + civilian-area jam gate + warning ladder; rejected actions burn no charges; violations retained even after later correct action.
- Generator: seeded `generateScenario` from difficulty profile/focus/constraints; 40-attempt validity + baseline + diversity loop; semantic rules (unique IDs, ≤40 contacts, spawn ≥20 s before end, IFF only friendly, degradation fits duration/sensor); fingerprint = environment + difficulty + ROE + per-actor kind/allegiance/count/behavior + quantized bearing/range/spawn + sensors + degradations (omits seed/title); fairness = delayed-oracle baseline must score ≥70, preserve ≥80% asset health, resolve all hostiles, zero ROE violations.

### 5.4 AI components (visible, tested)

1. Trained threat model (`sim-core/threat/`): multinomial softmax, 15 features → 6 classes (`bird`, `balloon`, `friendly_uav`, `unknown_uav`, `hostile_like_uav`, `clutter`), pure TypeScript, zero dependencies, ~1.9 KB weights JSON, <1 ms CPU inference, deterministic (fixed weights + fixed features = bit-identical output; retraining byte-identical, tested). Inputs are trainee-visible track data only (4 sensor confidences, range, speed, altitude estimate, heading change, closing rate, track stability, sensor agreement, degradation share, observation time, environmental noise, IFF presence). Tracks younger than 6 s or with <2 fresh readings label `unknown_uav`. Leakage guard test fails the build if ground-truth fields appear above the labeling function.
2. Bayesian skill model (`sim-core/adaptive.ts`): Beta(a,b) per dimension (7 dimensions: night, swarm, degraded_sensors, distractors, urban, speed_pressure, roe_complexity), init 2/2; success (≥70, non-provisional) adds tag-weight `0.2 + tag/5` to a else b; mean a/(a+b), uncertainty 1/(a+b); persisted to `skill_state` on every real finish (7 rows/trainee) with `persisted` flag; calibration from real history; weakest-dimension targeting at ~68% success with deterministic history-derived seeds.
3. Scenario intelligence (`sim-core/threat/challenge.ts` + generator): weakest skill → challenge profile (night, terrain, IR degradation, sensor conflict, contact load, ambiguity) → compiled onto generator knobs; deterministic weakness→behavior adversary emphasis (e.g. saturation for swarm weakness, decoy-and-strike for distractors; unknown entries rejected); baseline-feasibility gate mandatory — AI only chooses among fair exercises (UI: AI SCENARIO GENERATION · BASELINE-CHECKED).
4. AAR AI analysis (`sim-core/threat/analysis.ts` + UI): first critical (else first) recorded mistake → replay to its tick → reconstruct what the advisory model estimated → render opportunity → scorer's words → sensor evidence → model view → lesson template → practice link; nulls render "no training opportunity"; nothing invented.
- AI DOES: interpret imperfect sensor evidence; estimate a threat hypothesis; expose uncertainty; identify training weaknesses; recommend the next exercise. AI DOES NOT: control scoring; override ROE; see hidden ground truth during inference; require cloud or GPU; make the final decision.

### 5.5 Measured model results (from `docs/AI_METRICS.json`)

- Model softmax; 15 features; 6 classes; 14,874 samples from 230 scenarios (train 161 scenarios / 10,032 samples; calibration 23 / 1,869; test 46 / 2,973).
- Scenario-level 70/10/20 split via deterministic round-robin over sorted scenario IDs; trainer aborts on any cross-split scenario overlap.
- Test: accuracy 0.703 (train 0.706); macro precision 0.601; macro recall 0.692; macro F1 0.622; balanced accuracy 0.692.
- Baselines (identical splits/test set): majority accuracy 0.400 / macro F1 0.095; heuristic accuracy 0.779 / macro F1 0.535; softmax 0.703 / 0.622; softmax+interactions 0.710 / 0.629 — interactions rejected (gain < 0.02 bar); MLP never built/benchmarked (approved wording in Appendix F).
- Heuristic caveat: it re-implements parts of the labeling rule (insufficient-evidence → unknown), so raw accuracy is inflated by construction; macro F1 is the honest comparator and the trained model wins it, plus gives calibrated probabilities and exact per-feature evidence.
- Calibration: ECE 0.109 → 0.046 (temperature 0.742, fitted on calibration split only, evaluated on test); UI label is MODEL CONFIDENCE (model's own probability estimate, not a physical probability).
- Stress subsets (test): NIGHT 70.2% (n=1770); DEGRADED SENSORS 70.1% (n=2069); HIGH SENSOR CONFLICT 65.9% (n=908); HIGH AMBIGUITY 70.3% (n=2257); NORMAL 68.1% (n=326); stress subsets are independent (NORMAL = complement).
- Scenario-level (46 test scenarios): mean 0.702, median 0.689, worst 0.551, best 0.875.
- Established tracks (age ≥6 s, ≥2 fresh readings, n=1660): 0.692.
- Hostile-like vs non-hostile: precision 0.792, recall 0.742, F1 0.766, FPR 0.086, FNR 0.258 (n=914 hostile).
- Training config: seed 482913; 230 simulations (10 scripted + 220 generated); 400 epochs full-batch gradient descent; lr 1.0 with 1/(1+epoch/100) decay; L2 1e-4; inverse-frequency class weights capped at 6; dataset generation 2.8 s on laptop CPU; feature version 2, model version 2.

### 5.6 Verification facts

- `npm run typecheck`: clean.
- `npm test`: 99/99 Vitest (12 files: core, sensors-roe, generator, scoring, adaptive, threat, analysis, challenge, backend, metrics, docs-consistency, ui-guards).
- `npm run test:e2e`: 2/2 Playwright (API smoke; real-Chromium judge path: start → ack/classify/respond → debrief → REPLAY VERIFIED → adaptive recommendation, isolated DB).
- `npm run train:threat`: deterministic regeneration of weights + report + metrics (seconds).
- Bundle: staged + booted with API + web healthy on a test port; health reports engine 1.0.0, sqlite storage, `external_services: 0`.
- Docs-consistency test: suite total vs doc claims, artifact-copied metrics, stale-string rejection, honest-AI contract, artifact self-consistency.

## 6. Feasibility and viability facts

- Runs today on an ordinary laptop via vendored offline bundle (Node v24.13.0 included, no prerequisites) or Docker; dev path is `npm install` + `npm run dev` (UI 127.0.0.1:5173, API 127.0.0.1:3001); single-port path is `npm run build` + `npm start` (127.0.0.1:3001).
- Build status: M1–M7 implemented and checklist-gated (vertical slice; realism; scenarios; scoring/AAR; adaptive; instructor; delivery).
- Risks and mitigations: `node:sqlite` experimental → pinned + vendored runtime, 10+ backend persistence tests; no real sensor data → synthetic-but-schema-faithful fixtures, replay-verified, transfer explicitly disclaimed; deterministic engine lets any disputed score be replayed byte-identically; Error Boundaries isolate UI while scores live server-side; port/DB conflicts documented (set PORT; stop duplicate server; build before preview).
- Scope discipline: VR/WebXR, networked team roles, RL adversary, Hindi UI, photorealism, real weapon/hardware specs all explicitly out of scope to protect the offline, explainable, CPU-only core.
- Demo readiness: 4-minute judge script exists (nightfall → deliberate mistake → debrief → replay toggle → adaptive → readiness) with fallback chain (live → bundle → backup video → deck); speaker split for 3 people.

## 7. Impact and benefits facts

- Target audience: trainees (decision repetitions), instructors (scenario authoring + AAR + unit trends), unit commanders (observed unit evidence), DSSC/MoD evaluators (all four SIH outcomes in one workflow).
- Impact math (show working): 1 station × 30 trainees × 20 reps/month = 600 decision-reps/month at ~₹0 marginal cost vs one live-fire drill day; Ashni-scale need: 385 platoons × 20–25 troops.
- Deployment: owning unit = battalion/unit signals or air-defence cell; instructor = training JCO/NCO or directing staff; no central admin; SQLite file backup (~5 min, copy dated file); stations independent/air-gap friendly; unit rollup via CSV merge.
- Cost: ₹0 new hardware (existing office laptop, integrated graphics OK, low-resource mode); ₹0 licenses (React/Node/SQLite open; no cloud/API/telemetry bills).
- Benefits: unlimited fair repetitions; judgment-under-uncertainty training; explainable feedback with replayable receipts; weakness-targeted practice (no rote learning); instructor leverage (author once, assign to unit, track trends); honest capability boundaries (no false readiness claims).
- Social/operational framing: better operator decisions under doubt; cheaper training at unit level; indigenous, inspectable, offline stack.

## 8. Research and references facts

- SIH26247 official text (sih.gov.in-sourced viewer, captured 2026-10-02): background, description, and all four outcomes verified as matching the spec nearly verbatim; "Desktop or VR-capable" means desktop alone satisfies outcome 1.
- Glenn Fiedler, "Fix Your Timestep": fixed-step accumulator decouples sim from rendering; identical headless stepping in replay/tests.
- Craig Reynolds, Boids: separation/alignment/cohesion for legible swarm motion with simple local rules; no neural engine needed.
- Badrinath, Wang & Pardos, pyBKT (EDM 2021): knowledge-tracing context; project uses a simpler documented Beta evidence model, not pyBKT's hidden-state/EM model.
- MDN Service Workers: offline asset/cache reasoning; localhost secure origin; portable local server for first launch.
- FastAPI SQL docs: SQLite appropriate for zero-setup file-backed app (backend simplified to Node to share the exact core — decision 002).
- Node.js `node:sqlite` docs: built-in file DB; transactions, FK, prepared statements, append-only event storage.
- Warfare grounding (open sources, public knowledge only): Ukraine FPV revolution (FPV kamikaze economics, Baba Yaga night bombers, FPV interceptors, fiber-optic jam-immune FPVs, trench EW, layered detect→jam→kinetic practice); Shahed/Geran one-way attackers (night preference, acoustic cue, volley saturation, EW duel, mobile fire groups); TB2 lesson (threat effectiveness is context-dependent — same drone, different AD environment, different outcome); Black Sea USVs (escalation path as scenario-design language); cost-exchange crisis table; Op Sindoor (May 2025) reporting + indigenous C-UAS statements; EU JRC SeDaFuV open C-UAS fusion sim; US Army ATP 3-01.81 detect→decide doctrine; Continuum ATLAS "decision intelligence, not hardware".
- Close line: "Same seed + same decisions = byte-identical replay. Ask us to prove it live."

## Appendix A. Scenario catalog (raw facts)

1. `01-first-light` — First light — day/rural, recon vs birds, radar/EO/acoustic/RF, L1.
2. `02-urban-echo` — Urban echo — day/urban glare, warning ladder, balloon + friendly, L2.
3. `03-after-dark` — After dark — night/mountain, thermal loiterer, L2.
4. `04-false-positives` — False positives — wind/high-clutter, birds/kite/balloon/clutter vs recon, L3.
5. `05-familiar-stranger` — Familiar stranger — dusk/urban, delayed-RF-IFF friendly trap + hostile, L3.
6. `06-many-as-one` — Many as one — dusk/rural flocking 4-ship + heli + friendly, L3.
7. `07-nightfall` — Operation Nightfall — night/urban fog/high-clutter, radar outage, saturation + leader + fast mover, L4 featured demo.
8. `08-broken-signal` — Broken signal — night/mountain rain/jammed, probe + decoy + clutter, L5 capstone.
9. `09-night-courier` — Night courier wave — night/rural spotter-striker pairing (recon loiter + fast strike pair), L4.
10. `10-wire-in-the-fog` — Wire in the fog — wire-guided EM-immune intruders + RF degradation + civilian restraint, L4.
- Generator: seeded, difficulty profile/focus/constraints, 40-attempt validity + baseline + diversity loop, reproducible IDs, fingerprint window avoids near-repeats.

## Appendix B. Scoring reference (raw facts)

- Weights: detection 20, classification 25, decision 30, outcome 15, reasoning 10.
- Grades: ≥90 Distinguished; ≥75 Proficient; ≥55 Developing; else Needs practice.
- Per-actor 8 nodes: detected (ack delay vs par `max(8, 26-difficulty*3)`s, 3 s grace); classified (any non-unknown); correct identity (80 allegiance + 20 type; hostile-false −20, other wrong −8 each); appropriate response (hostile needs active effect; non-hostile needs observe/escalate); ROE compliant (100 if no violation attempted); timely (before asset range/impact); effective (hostile resolved 100 / impacted 0 / escalated 50; non-hostile harmed 0 else 100); reasoning (reason matches truth + response).
- Global: confusion 3×4 (truth hostile/friendly/benign × classified + unknown); detection_mean_s; value-weighted asset health; 8-hex event hash; completion 0..1; provisional if ended early; no actions → total 0; friendly harm −30 each, collateral −15 each (gameplay, not real effects).
- Report schema: version/total/grade/5 metrics/per-actor nodes/mistakes/confusion/detection/assets/hash/duration/completion/provisional; stored in SQLite; feeds AAR + adaptive engine.

## Appendix C. Schemas and data model (raw facts)

- `schemas/scenario.schema.json` (v1.0): id/title/seed/environment/assets/sensors/degradations/ROE/actors/tree/difficulty/tags/duration; assets 1..4; sensors ≥1 unique; actors 1..24; difficulty 1..5; 7 difficulty tags 0..5; duration 60..900 s; `ground_truth_tree = decision-v1`.
- `schemas/event.schema.json`: seq/tick/t_ms/type/actor_id/payload (immutable).
- `schemas/action.schema.json`: acknowledge/classify/respond + classification/type/response/reason gates.
- `schemas/score_report.schema.json`: full report contract.
- SQLite tables: units, users, auth_sessions, scenarios, sessions, events (append-only), score_reports, skill_state, assignments.
- Data file: `data/drishti.sqlite` (tests use `:memory:`).

## Appendix D. Run, demo, verify (raw facts + credentials)

- Offline bundle (judge path): `node packaging/bundle.mjs`, then `release/AVLON-DRISHTI/start-windows.bat` (or `start-linux.sh` after a Linux run); open `http://127.0.0.1:3001`.
- From source: `npm install`; `npm run dev` (UI :5173 + API :3001); or `npm run build` + `npm start` (single-port :3001).
- Docker: `docker compose up --build` → `http://127.0.0.1:3001`.
- Health: `/api/health` returns engine version 1.0.0, sqlite storage, `external_services: 0`.
- Logins (local only; password `drishti-demo` for all): `operator` (trainee, Alpha unit); `instructor` (studio + readiness; override via `DRISHTI_INSTRUCTOR_PASSWORD` on shared stations); `demo-01` … `demo-04` (labeled synthetic example profiles).
- Env knobs: `PORT`, `HOST`, `DRISHTI_ROOT`, `DRISHTI_DB`, `DRISHTI_DEMO=1/0`, `DRISHTI_INSTRUCTOR_PASSWORD`.
- Verify: `npm run typecheck` (clean); `npm test` (99/99 Vitest); `npm run test:e2e` (2/2 Playwright); `npm run train:threat` (deterministic regeneration).
- Troubleshoot: port in use → set PORT; DB locked → stop duplicate server; blank UI → run `npm run build` first.

## Appendix E. Limitations and exact honesty lines (state on stage)

- All terrain, sensors, and counter-measures are fictional gameplay models, not real specifications.
- The model learned the simulator's evidence patterns; it is not validated for real sensor transfer.
- Predictions are advisory only and never enter scoring, ROE, or replay.
- Scores are practice heuristics, not readiness certification; the system is not an operational threat-assessment platform.
- Performance degrades outside the training distribution by construction — same as any ML model.
- An MLP was not built or benchmarked. The project deliberately retained the simpler softmax model because it already satisfied the required determinism, CPU-only/offline deployment, tiny footprint, and exact feature-attribution constraints, while the interaction benchmark did not meet the predefined improvement threshold.
- Canonical terms only: synthetic observations; held-out simulated scenarios; model confidence (calibrated model probability); advisory; human decision; training heuristic; practice exercise; deterministic replay; baseline-feasibility gate.
- No FPS claim (measure on the judge laptop); adversarial swarm is heuristic behaviors, not RL.

## Appendix F. Repo map (raw facts)

- `PROJECT_SPEC.md` (authoritative brief), `README.md`, `explain.md` (plain-English), `LICENSE` (MIT).
- `sim-core/`: types, prng, validation, world, sensors, roe, engine, scoring, baseline, generator, catalog, adaptive; `sim-core/threat/`: features, model, train, metrics, challenge, analysis, weights.
- `backend/`: store (SQLite), app (Express API), server, demo (24 synthetic sessions: 4 users × 6 runs via real engine, never hand-authored scores).
- `ui/`: App routes (mission/scenarios/aar/adaptive/studio/readiness; last two instructor-gated); tactical (RadarMap, render, SensorFeed, TacticalStation); scenarios library; AAR; adaptive panel; instructor studio + unit dashboard; components (Modal, ScenarioArt, Charts); lib (api, useTraining, exports); copy (central vocabulary); styles.
- `scenarios/scripted/` (10 JSON), `schemas/` (4 JSON), `tests/` (11 Vitest files) + `tests/e2e/` (2 Playwright specs), `packaging/` (dev runner, offline bundler, screenshot capture), `Dockerfile`, `docker-compose.yml`, `public/mark.svg`.
