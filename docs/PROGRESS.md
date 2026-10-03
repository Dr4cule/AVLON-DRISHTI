
# AVLON DRISHTI — Work Done vs Work Remaining

Date: 2026-10-03, updated after M4–M7 build pass
Folder: `C:\Bedrock\Work\Drone` only
Spec: `PROJECT_SPEC.md` is authoritative
Product: **AVLON DRISHTI — Airspace training system** — offline, adaptive drone-threat decision trainer
Status: M1–M7 implemented. Typecheck clean. **75/75 Vitest passing (10 files).** Production build OK (`dist/web` + `dist/server.cjs`).

> A visible object is not necessarily hostile. A high-confidence track is confidence in a sensor observation, not permission to respond.

## 1. One-paragraph status

M1–M7 are implemented, gated in `docs/CHECKLIST.md`, and hardened (see §5 fix log). The app runs end-to-end: briefing → live imperfect sensor picture → acknowledge/classify/respond with reasons → server-validated scoring → SQLite persistence with persisted skill profiles → synchronized sensor/truth replay → trends/confusion/heatmap → scenario library + seeded generator with baseline feasibility → adaptive next exercise → instructor studio + unit dashboard. Delivered as a vendored offline bundle plus Docker.

Tests now: **75/75 Vitest passing** across 10 files, plus **2/2 Playwright E2E** (API smoke + real-browser judge path). Typecheck clean.

## 2. How to run now

```powershell
npm install
npm run dev        # local API :3001 + Vite UI :5173, loopback only
npm run typecheck
npm test -- --run
npm run build
npm start          # serves dist/web + API from dist/server.cjs
```

Demo logins (local only):
- `operator / drishti-demo` — trainee, Alpha unit
- `instructor / drishti-demo` — instructor (override with `DRISHTI_INSTRUCTOR_PASSWORD`)
- `demo-01..demo-04` — clearly labeled synthetic example profiles

Data: `data/drishti.sqlite` file DB, `:memory:` in tests. No network calls at runtime. Fonts, map, models bundled.

## 3. What is built — file inventory

### Schemas — `schemas/`
- `scenario.schema.json` — v1.0 scenario contract: id/title/seed/environment/assets/sensors/degradations/ROE/actors/tree/difficulty/tags/duration
- `event.schema.json` — immutable event: seq/tick/t_ms/type/actor_id/payload
- `action.schema.json` — trainee input: acknowledge/classify/respond + classification/type/response/reason gates
- `score_report.schema.json` — report: version/total/grade/5 metrics/per-actor nodes/mistakes/confusion/detection/assets/hash/duration/completion/provisional

### Deterministic core — `sim-core/`
- `types.ts` — TICK_MS 250, ENGINE_VERSION, Dimension, Allegiance, SensorKind, ActorKind incl `clutter`, Behavior, ResponseKind, Reason, Scenario, Action, SimEvent, Entity, SensorReading, Track with `bearing_only/civilian_area`, EffectorState, WorldState, MapContact, DecisionNode, ActorScore, Mistake, ScoreReport with `completion/provisional`, SessionRecord, User, RunJournal
- `prng.ts` — Mulberry32, `hashText`, keyed `sample(seed,...)`, clamp/quantize; no Math.random/clock/IO
- `validation.ts` — Ajv validators + semantic checks: unique IDs, ≤40 contacts, spawn lead time, IFF only friendly, friendly_uav allegiance, degradation refers to available sensor and fits duration
- `world.ts` — entity expansion from actor groups, quantized movement, loiter/patrol/random/probe, loiter-dive for fixed-wing, decoy turn, flocking separation/alignment/cohesion, leader degradation, normalized vectors
- `sensors.ts` — SENSORS intervals/ranges, SIGNATURE table, `sensorStatus` incl dropout/noise + EM/night/fog/wind masking, `detectionProbability` per range/signature/environment/terrain-mask/degradation, `detect` with noise×3 when degraded, bearing-only acoustic/RF, EO/IR visual evidence strings, IFF delayed 16 ticks, `trackConfidence` decay
- `roe.ts` — EFFECTORS abstract table (label/range/prob/cooldown/charges/active), `checkRoe`: hostile + confidence threshold + no IFF + kinetic gate + civilian jam gate + warning ladder, `reasonIsAppropriate`
- `engine.ts` — pure `Simulation`: frozen events, spawn/FirstDetectable/SensorDetection/SensorStatusChanged, fixed-step `step()`, `dispatch` tick-exact validation, acknowledge/classify/respond, ROE rejection without charge burn, warn timestamp, probabilistic abstract effect via seeded sample, resolved/exited/impacted, `contacts(truth=false)` leaks no allegiance/kind, `eventHash`, `replay(scenario,actions,endTick)` with ordering/range checks
- `scoring.ts` — immutable-only scoring: detection delay vs difficulty par, classification 80+20 minus hostile-false penalties, decision appropriate/compliant/timely/wasted, reasoning alignment, outcome asset+actor, friendly/collateral penalties, per-actor 8 nodes + ideal_path, timestamped mistakes, confusion 3×4, asset_health weighted, SCORE_WEIGHTS 20/25/30/15/10, zero for no-action, provisional flag
- `baseline.ts` — delayed oracle classifier for feasibility; warns when required, picks in-range ROE-legal effector, reports passed/score/health/threats/violations/actions
- `generator.ts` — seeded `generateScenario`: difficulty/profile/focus/constraints/fingerprint window, terrain/time/weather/EM sampling, hostile + recon + distractors + friendly + clutter, tags, ROE tightening, 40-attempt validity+baseline+diversity loop, reproducible IDs
- `catalog.ts` — loads and validates 10 scripted JSONs
- `backend/demo.ts` — 4 synthetic users × 6 runs (24 sessions) via real engine with injected mistakes; never hand-authored scores

### Scenarios — `scenarios/scripted/`
1. `01-first-light` — day/rural, recon vs birds, radar/EO/acoustic/RF, L1
2. `02-urban-echo` — day/urban glare, warning ladder, balloon+friendly, L2
3. `03-after-dark` — night/mountain, thermal loiterer, L2
4. `04-false-positives` — wind/high-clutter, birds/kite/balloon/clutter vs recon, L3
5. `05-familiar-stranger` — dusk/urban, delayed RF IFF friendly trap + hostile, L3
6. `06-many-as-one` — dusk/rural flocking 4-ship + heli + friendly, L3
7. `07-nightfall` — night/urban fog/high-clutter, radar outage, saturation+leader + fast mover, L4 featured
8. `08-broken-signal` — night/mountain rain/jammed, probe+decoy+clutter, L5 capstone
9. `09-night-courier` — night/rural spotter-striker pairing (recon loiter + fast strike pair), L4
10. `10-wire-in-the-fog` — wire-guided (EM-immune) intruders + RF degradation + civilian restraint, L4

### Backend — `backend/`
- `store.ts` — node:sqlite, WAL, FK, append-only events trigger, units/users/auth_sessions/scenarios/sessions/events/score_reports/**skill_state**/**assignments**, scrypt login, HttpError, bootstrap/scenarios/sessions/events/draft/start/checkpoint/finish, server-side replay validation, prefix-immutability check, repeat-attempt seed/bearing nudge, baseline gate, idempotent finish, **skill persistence on finish**, deterministic recommend seeds, assignment validation/lifecycle, instructor scenario library saves, synthetic seeding
- `app.ts` — Express, loopback origin guard, no-store API, health, profiles/login/logout/me/bootstrap, scenario generate, session CRUD/checkpoint/finish, **adaptive profile (?user_id=, role-gated) + recommend**, **instructor scenarios + assignment CRUD**, unit overview, static dist/web, typed errors
- `server.ts` — DRISHTI_ROOT/DB/DEMO env, 127.0.0.1:3001, graceful close

### UI — `ui/`
- `App.tsx` — mission/scenarios/aar/**adaptive**/studio/readiness routes (last two instructor-gated), auto operator login, bootstrap/restore, briefing/settings/guide/profile modals, recovery banner, pace control, toasts, skip link
- `copy.ts` — central vocabulary: TYPE/DIMENSION/SENSOR/RESPONSE/REASON labels, formatTime/humanize
- `tactical/RadarMap.tsx` + `render.ts` — Canvas terrain contours/river/road/urban blocks/grid/rings/bearings, sweep, asset ring, shape-coded contacts, trails, selection pulse, zoom/contours/fullscreen, legend/scale, low-resource static
- `tactical/SensorFeed.tsx` — synthetic EO/IR/RF/acoustic SVG cues, tracking vs stale, identified silhouettes
- `tactical/TacticalStation.tsx` — metrics, map + status + ROE banner, track register, fusion tabs/readings/evidence, decision workspace with ack/classify/type/response/reason/resources, hints, keyboard Space/A/1-4
- `scenarios/ScenarioLibrary.tsx` — banner, filters/search, cards with ScenarioArt, BriefingDialog objectives/ROE/mode picker, GeneratorDialog seed/focus/difficulty + baseline proof + fingerprint
- `components/Modal.tsx`, `ScenarioArt.tsx`, `Charts.tsx` — dialog, seeded card art, ScoreRing/TrendChart/ConfusionMatrix
- `aar/AfterActionReview.tsx` — session picker, debrief/trends tabs, score summary, sensor/truth/split replay, timeline with markers/play/speed, decision-tree trace, clickable mistakes, trends/confusion/heatmap/register, CSV/JSON/print export
- `lib/api.ts`, `useTraining.ts`, `exports.ts` — typed API, fixed-step accumulator loop, 4s checkpoint, browser journal recovery, pace, finish→AAR, CSV escaping
- `styles.css`, `main.tsx` — graphite/amber/cyan theme, responsive 1600/1150/950/740/520, reduced-motion, print CSS

### Tests — `tests/` — 75 Vitest + 2 Playwright, all passing
- `core.test.ts` ×5 — exact replay, seed sensitivity, no truth leak, schema/action validation, PRNG repeat + report schema
- `sensors-roe.test.ts` ×7 — dropout restore, jam reduces detections, bearing-only range, warning/kinetic/civilian gates, IFF block no charge, wire-guided EM immunity, group determinism
- `generator.test.ts` ×5 — 10 scripted valid+feasible, 50 generated L1-5 valid+feasible, reproducibility, fingerprint diversity, constraints/errors
- `scoring.test.ts` ×6 — zero provisional, baseline ≥90 with nodes, benign-as-hostile critical at tick, violation retained, partial type credit 80, snapshot-mutation immunity
- `adaptive.test.ts` ×5 — skill init/uncertainty shrink, weakest-dimension targeting, deterministic difficulty, cold-start flag, calibration buckets
- `threat.test.ts` ×12 — feature extraction determinism, model contract, exact evidence attribution, invalid-input rejection, hostile distribution, training determinism
- `analysis.test.ts` ×3 — explanation from recorded evidence, empty-report fallback, no fabrication on corrupt data
- `challenge.test.ts` ×8 — mistake patterns, challenge-profile mapping for all dimensions, fairness preserved, adversary tactics, bias validation
- `backend.test.ts` ×11 — synthetic reproducibility, recompute+immutable+idempotent, prefix/tick guards + 409 events, auth/ownership/origin, distinct retry + draft recovery, **skill persistence + persisted flag, cross-profile role gates, deterministic recommend (+challenge/tactics/deltas), skill-movement reporting, assignment lifecycle + validation, instructor library saves**
- `metrics.test.ts` ×8 — toy-matrix precision/recall/F1, macro over supported classes, confusion-pair ranking, group summaries, hostile binary rates, ECE calibrated vs confident-wrong vs empty
- `tests/e2e/demo.spec.ts` — API smoke (health/login/bootstrap/generate/recommend)
- `tests/e2e/judge-path.spec.ts` — real Chromium: start → ack/classify/respond → debrief → REPLAY VERIFIED → adaptive recommendation (isolated DB)

### Docs/packaging now
- `docs/` — DECISIONS, RESEARCH (with official SIH26247 verification), CHECKLIST (all gates evidenced), PROGRESS, SCORING, SCENARIO_SCHEMA, AI_COMPONENTS, AI_THREAT_REPORT, INSTALL, DEMO_SCRIPT, DEPLOYMENT, PITCH_DECK, DRONE_WARFARE_RESEARCH
- `packaging/bundle.mjs` — stages `release/AVLON-DRISHTI` with vendored Node v24.13.0 (boot-verified); `Dockerfile` + `docker-compose.yml` + `.dockerignore`

## 4. Done by milestone

- [x] M1 vertical slice — schemas, seeded core, tactical map, ack/classify/respond, basic→full score path, determinism tests
- [x] M2 realism — 5 channels, env effects, stale/bearing cues, all archetypes incl clutter, 7 abstract responses, ROE+reason gates, fusion UI
- [x] M3 scenarios — 10 JSONs + generator + validity/baseline/diversity + library/briefing UI
- [x] M4 AAR/persistence — scoring engine, SQLite append-only, auth, checkpoint/recovery, replay verify, AAR UI, trends, exports — gated in CHECKLIST, `docs/SCORING.md` written
- [x] M5 adaptive — Beta skill model **persisted to `skill_state`**, calibration, weakest-targeting with deterministic seeds, panel UI, instructor profile review, model + backend tests
- [x] M6 instructor — studio persists to library (schema + baseline gated), JSON import/export, assignments with validation + update/delete, unit dashboard, backend tests
- [x] M7 delivery — `bundle.mjs` stages `release/AVLON-DRISHTI` with **vendored Node v24.13.0** (boot-verified), Docker + `.dockerignore`, install/demo docs, API + real-browser Playwright E2E (2/2 passing)

## 5. Fix log (post-gate hardening)
1. `skill_state` was DDL-only — now written on every real session finish (7 rows/trainee, tested) and read back with a `persisted` flag; instructor cross-profile review added with role gate.
2. `recommend` fell back to `Date.now()` — now derives the seed deterministically from user history; identical state yields identical recommendations (tested).
3. Assignments had no validation/lifecycle — unit + ISO-date validation, baseline gate, update/delete endpoints with instructor guards (tested).
4. Studio save was download-only — now persists to the station library via `POST /api/instructor/scenarios` before download/assign.
5. Bundle only printed a "copy Node yourself" note — now downloads + vendors Node v24.13.0 and was boot-verified (API + web healthy).
6. E2E was API-only — added `judge-path.spec.ts`: real Chromium start → ack/classify/respond → debrief → REPLAY VERIFIED → adaptive recommendation, isolated DB.

### Explicit non-goals (do not build)
VR/WebXR, networked team mode, RL adversary, Hindi UI, real weapons/hardware specs, cloud AI, photorealism — keep abstract + fictional.

## 6. Acceptance criteria trace (§14)
- [x] Offline laptop launch/pick/play/score — vendored bundle boot-verified, no prerequisites
- [x] 10 scripted + unlimited generated, schema-valid
- [x] Validity + fairness via baseline
- [x] Replay identical event log — tested + hash verified in AAR + E2E asserts REPLAY VERIFIED
- [x] Scoring detection/classification/decision + tree + mistakes — engine + `docs/SCORING.md`
- [x] AAR replay toggle + trends + unit compare — personal trends + unit dashboard
- [x] Adaptive changes difficulty by weakness + weakest-dimension targeting tested
- [x] Two consecutive sessions never identical — generator fingerprint + server nudge + deterministic recommend (tested)
- [x] Instructor create + assign — studio + assignment lifecycle tested
- [x] Docs README/install/schema/scoring/AI/demo script — full set present

## 7. Risks / honesty notes for judges
- Node `node:sqlite` is experimental in v24 — runtime pinned (v24.13.0) and vendored in the bundle
- Synthetic demo data always labeled; adaptive cold-start labeled; no learning-transfer claim
- All geography/sensors/effects are gameplay parameters, not real specs
- No FPS claim: rendering is Canvas 2D with a low-resource mode; measure on the judge laptop
- Adversarial swarm is heuristic behaviors, not RL — the brief's stretch goal, stated as such

## 8. Next actions (ordered)
1. Dry-run `docs/DEMO_SCRIPT.md` twice on the vendored bundle, record replay hashes
2. Optional stretch only if time allows: VR view, team mode, Hindi strings (externalized copy already supports it)
