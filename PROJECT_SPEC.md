# SIH 2026 – PS 26247: AI-Enabled Drone & Counter-Drone Threat Simulation Trainer

> This file is the single source of truth for the project idea. Read it fully before writing any code. When a decision is not covered here, choose the simplest option that satisfies the goals in Section 2 and record the decision in `docs/DECISIONS.md`.

---

## 1. Problem Statement (official)

- **ID:** 26247
- **Title:** AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
- **Organization:** Ministry of Defence (MoD), Defence Services Staff College
- **Category:** Software
- **Theme:** Robotics and Drones

**Background:** Low-cost commercial and military-grade drones, used individually and in swarms, have become a decisive battlefield factor. Current training relies on classroom instruction and limited live-fire drills, which are costly, weather-dependent and do not give troops enough repetitions.

**Required:** A software-based simulation platform to train personnel to recognize, classify and respond to drone/swarm threats across varied, realistic scenarios (day/night, degraded sensors, urban/rural terrain, single-drone and swarm attacks). It must be usable at unit level with minimal specialized hardware.

**Expected outcomes (all four are mandatory deliverables):**
1. Desktop or VR-capable simulator with scripted **and** procedurally generated threat scenarios.
2. Decision-tree based scoring on detection time, threat-classification accuracy and engagement decisions.
3. After-action review (AAR) dashboard tracking individual and unit performance over repeated sessions.
4. Adjustable difficulty and scenario randomization to prevent rote learning.

---

## 2. Product Vision and Goals

**One-line pitch:** A laptop-runnable, offline-capable trainer that puts a trainee in the seat of an air-defence operator, feeds them an imperfect multi-sensor picture of drone threats, scores their decisions against a rules-of-engagement decision tree, and adapts the next scenario to their weaknesses.

**Goals**
- G1. Train *recognition, classification and decision-making*, not just reaction speed.
- G2. Make every session different (seeded procedural generation) but exactly replayable for debrief.
- G3. Give instructors clear analytics (individual and unit level) and an easy scenario editor.
- G4. Run on an ordinary laptop with no internet, no GPU requirement, no special hardware. VR is optional.
- G5. Show clearly where AI is used (see Section 9) so evaluators can see the "AI-enabled" claim is real.

**Non-goals**
- Photorealistic graphics.
- Real weapon, exploit or hardware engineering detail. Counter-measures are modelled at a gameplay level (abstract effectiveness, range and side effects), never as real technical specifications.
- Controlling real drones or real hardware.

**Primary users**
- *Trainee* (operator/soldier): plays scenarios.
- *Instructor*: builds/assigns scenarios, reviews AAR, compares units.
- *Unit commander*: views unit-level readiness.

---

## 3. Core Concept

The trainee never sees "ground truth". They see what a **simulated sensor suite** reports, with noise, delay, clutter and failures. They must:

1. **Detect** that something is there.
2. **Classify** each track (hostile / friendly / benign / unknown, plus drone type).
3. **Decide** a response under rules of engagement (ROE) that change per scenario.
4. Be **scored** by comparing their actions with a ground-truth decision tree.

Ground truth, sensor view and trainee actions are all logged so the AAR can replay "what was really happening vs. what the trainee saw and did".

---

## 4. Recommended Architecture and Tech Stack

Default choices (the agent may deviate only with a recorded reason, and must keep the offline/low-hardware constraint):

| Layer | Default | Notes |
|---|---|---|
| Simulation runtime + tactical UI | TypeScript, React, HTML5 Canvas/PixiJS (2D/2.5D) | Runs in browser or packaged with Electron/Tauri; no GPU needed |
| Optional 3D / VR view | Three.js + WebXR | Stretch goal; shares the same sim core |
| Backend API | Python 3.11+, FastAPI | Scenario generation, scoring, adaptive engine, analytics |
| Storage | SQLite (file-based) | Zero-setup, offline |
| AI/ML | NumPy, scikit-learn; optional Stable-Baselines3 for the adversarial swarm agent | Keep models small and CPU-only |
| Packaging | Docker Compose **and** a single-folder offline bundle (Electron/Tauri or PyInstaller) | Air-gapped deployment |
| Tests | pytest (backend), vitest (frontend), Playwright (smoke e2e) | |

**Key architectural rules**
- **Determinism:** the simulation must be fully deterministic given `(scenario_json, seed, trainee_action_log)`. Use a seeded PRNG everywhere (no `Math.random()` / unseeded `random`). This enables exact replay.
- **Separation:** `sim-core` (pure logic, no UI) is separate from `ui`. The same core runs in the live view, the replay view and headless batch tests.
- **Event log:** every tick-relevant fact is an immutable event (`DroneSpawned`, `SensorDetection`, `Trainee Classified`, `EngagementOrdered`, `DroneNeutralized`, `AssetDamaged`, ...). AAR and scoring are computed from this log.
- **Schema-first:** scenario, event-log and score-report formats are defined as JSON Schema in `/schemas` and validated on both sides.

### Suggested repository layout

```
/
├── PROJECT_SPEC.md              # this file
├── docs/
│   ├── DECISIONS.md
│   ├── SCENARIO_SCHEMA.md
│   └── SCORING.md
├── schemas/
│   ├── scenario.schema.json
│   ├── event.schema.json
│   └── score_report.schema.json
├── sim-core/                    # TypeScript, no UI deps
│   ├── prng.ts
│   ├── world.ts                 # terrain, weather, time of day
│   ├── entities/                # drone, asset, friendly, distractor
│   ├── behaviors/               # flight paths, swarm behaviors
│   ├── sensors/                 # radar, EO/IR, acoustic/RF, degradation
│   ├── effectors/               # abstract counter-measure models
│   ├── roe.ts
│   └── eventlog.ts
├── ui/                          # React app
│   ├── tactical/                # map, radar scope, camera feed panels
│   ├── trainee/                 # classification + engagement controls
│   ├── instructor/              # scenario editor, assignment
│   ├── aar/                     # replay + dashboards
│   └── vr/                      # optional
├── backend/
│   ├── app/main.py
│   ├── generator/               # procedural scenario generator
│   ├── scoring/                 # decision-tree scoring
│   ├── adaptive/                # skill model + scenario selector
│   ├── adversary/               # optional RL / heuristic swarm agent
│   ├── analytics/               # AAR aggregation
│   └── db/                      # SQLite models/migrations
├── scenarios/
│   ├── scripted/                # hand-authored JSON scenarios
│   └── templates/               # generator templates
├── tests/
└── packaging/                   # docker + offline bundle scripts
```

---

## 5. Domain Model

### 5.1 Entities
- **Protected asset:** what the trainee defends (base, convoy, checkpoint, building). Has health and value.
- **Drone (threat or otherwise):** type, speed, altitude band, size/signature, behavior, allegiance (hostile / friendly / benign), payload class (surveillance / strike, abstract).
- **Distractors (benign, essential for classification training):** birds, kites, balloons, helicopters, friendly drones, civilian drones.
- **Swarm:** group of drones with a shared behavior model and optional leader.
- **Operator station / sensor suite:** where the trainee sits; defines which sensors are available.
- **Effectors (counter-measures, abstract):** `observe`, `warn`, `electronic_jam`, `spoof_redirect`, `net_capture`, `kinetic_intercept`, `escalate_to_command`. Each has an abstract range, success probability, cooldown, ammo/charge, and side-effect profile (collateral risk, interference with friendlies, ROE class).

### 5.2 Drone archetypes (gameplay-level, generic)
- Small quadcopter (commercial-style): slow, low, small signature, hard on radar, loud acoustically.
- Fixed-wing loitering type: faster, larger signature, loiters then dives.
- Fast fixed-wing / one-way attacker: short reaction window.
- Recon drone: persistent, non-lethal but intel-relevant.
- Swarm element: cheap, many, coordinated.
- Benign distractors: bird flocks, kite, balloon, helicopter, friendly UAV.

### 5.3 Swarm behaviors
- **Flocking** (boids: separation, alignment, cohesion).
- **Saturation attack:** multiple simultaneous bearings and altitudes.
- **Decoy-and-strike:** decoys draw attention, real attackers approach from another axis.
- **Leader-follower:** neutralizing the leader degrades the swarm.
- **Probe-and-withdraw:** tests defences, then retreats.
- Behaviors are parameterized (swarm size, spacing, aggression, coordination level).

### 5.4 Environment
- **Terrain:** rural (open field, hills, forest), urban (buildings causing occlusion and radar multipath), border/mountain.
- **Time of day:** day, dusk, night.
- **Weather:** clear, fog, rain, wind, glare.
- **Electromagnetic conditions:** clean, jammed, high-clutter.

### 5.5 Sensors (modelled at gameplay fidelity)
| Sensor | What the trainee sees | Degradations |
|---|---|---|
| Radar | Tracks on a scope with noise, update rate, clutter, false tracks; small drones have low detection probability | Clutter, jamming, terrain masking, track drops |
| EO camera (day) | Visual feed/icons, needs line of sight | Fog, glare, distance, occlusion |
| IR/thermal (night) | Heat-style feed, lower resolution | Weather, thermal crossover |
| Acoustic / RF detector | Bearing-only cue, delayed, ambiguous type | Wind, ambient noise, RF clutter |

Detection model: probability of detection per sensor per tick as a function of range, signature, weather, terrain occlusion and degradation flags. A **sensor fusion panel** shows per-track confidence so trainees learn why a track is uncertain.

---

## 6. Scenario System

### 6.1 Scenario schema (summary; full schema in `schemas/scenario.schema.json`)

```json
{
  "id": "scn_2026_0001",
  "title": "Night saturation, degraded radar",
  "seed": 482913,
  "environment": {
    "terrain": "urban",
    "time_of_day": "night",
    "weather": "fog",
    "em_conditions": "high_clutter"
  },
  "assets": [{"id": "A1", "type": "command_post", "pos": [0,0], "value": 100}],
  "sensors": ["radar", "ir", "acoustic"],
  "sensor_degradations": [{"sensor": "radar", "kind": "dropout", "start_s": 90, "dur_s": 30}],
  "roe": {
    "kinetic_allowed": false,
    "jam_allowed_over_civilian_area": false,
    "weapons_free_after_s": null
  },
  "actors": [
    {"id": "S1", "kind": "swarm", "allegiance": "hostile", "count": 8,
     "behavior": "saturation", "spawn": {"bearing_deg": 40, "range_m": 4000},
     "params": {"spacing_m": 30, "aggression": 0.8}},
    {"id": "B1", "kind": "bird_flock", "allegiance": "benign", "count": 12,
     "path": "random_walk", "spawn": {"bearing_deg": 200, "range_m": 2500}},
    {"id": "F1", "kind": "friendly_uav", "allegiance": "friendly",
     "path": "patrol_loop", "iff": true}
  ],
  "ground_truth_tree": "tree_night_saturation_v1",
  "difficulty_tags": {"night": 1, "swarm": 1, "degraded_sensors": 1, "distractors": 1},
  "duration_s": 600
}
```

### 6.2 Scripted scenarios
Hand-authored JSON (and the instructor editor output). Ship at least **8 scripted scenarios** covering: single recon drone (day/rural), single attacker (day/urban), night single, bird-vs-drone discrimination, friendly-fire trap (friendly drone behaving suspiciously), small swarm, large saturation swarm, decoy-and-strike under degraded sensors.

### 6.3 Procedural generator
Input: `seed`, `difficulty_profile` (per-dimension levels), optional `constraints`. Output: valid scenario JSON.

Requirements:
- Sample environment, actors, spawn geometry, timing and degradations from templates with weighted distributions.
- **Validity checks** (reject and resample if violated): physically plausible speeds/altitudes, spawn outside minimum detection range, at least one *solvable* path to a good outcome, ROE consistent, no impossible simultaneous spawns.
- **Fairness check:** run a headless "baseline agent" (a simple heuristic that follows the ground-truth tree with realistic delay) and confirm it can succeed; reject unwinnable scenarios.
- **Diversity:** track a scenario "fingerprint" and avoid repeating near-identical scenarios for the same trainee in a window.

### 6.4 Instructor scenario editor
UI to build/modify scenarios without code: pick environment, drag actors on a map, set behaviors and degradations, define ROE, preview with ground truth visible, save/export JSON, validate against the schema.

---

## 7. Trainee Experience (Simulator UI)

**Tactical screen layout**
- Main map/radar scope with tracks, bearings and asset markers.
- Sensor feed panel(s): EO / IR / acoustic cue list, switchable.
- Track list with per-track confidence, speed, altitude estimate, and trainee's current classification.
- Action bar: classify (hostile / friendly / benign / unknown + type), then engagement options (observe, warn, jam, spoof, net, kinetic, escalate).
- ROE banner (always visible) and a "reason for action" quick-select (for scoring the reasoning path).
- Timer, asset health, effector status (ammo, cooldown).

**Modes**
- **Training mode:** hints available, ground truth can be revealed afterwards.
- **Assessment mode:** no hints, scored, stored.
- **Team mode (stretch):** roles split across trainees (radar operator, visual lookout, engagement authority) with a shared net.
- **VR mode (stretch):** same sim core, immersive view via WebXR.

**Accessibility/usability:** keyboard shortcuts for fast classification, colour-blind-safe palette, low-resource mode (reduces rendering load).

---

## 8. Scoring (Decision-Tree Based)

Each scenario references a **ground-truth decision tree** that defines, for each actor and moment, what the correct classification and acceptable responses are under that scenario's ROE.

### 8.1 Metrics
1. **Detection time:** time from true first detectability to trainee acknowledging the track. Normalised against a scenario-specific par time.
2. **Classification accuracy:** correct allegiance and type; separate penalties for false positives (calling a bird hostile / friendly drone hostile) and false negatives (missing a hostile). Confusion matrix is stored.
3. **Engagement decision quality:** was the response appropriate for the threat, ROE and context?
   - Correct escalation ladder (warn before kinetic where required).
   - ROE compliance (no kinetic over civilian area when prohibited).
   - Efficiency (not wasting effectors on decoys).
   - Timeliness (before the drone reaches its critical range).
4. **Outcome:** asset health preserved, friendlies unharmed, collateral avoided.
5. **Reasoning path:** the decision tree nodes the trainee traversed vs. the ideal path.

### 8.2 Scoring tree
- Tree nodes: `Detected? → Classified? → Classification correct? → Response chosen → ROE-compliant? → Timely? → Effective?`
- Each node awards or deducts weighted points; partial credit for near-correct actions (e.g. classified "hostile" but wrong type).
- Output: overall score (0–100), per-metric sub-scores, per-actor breakdown, and a **list of specific mistakes** with timestamps and explanations ("At 02:14 you engaged track F1 which was a friendly UAV broadcasting IFF").

### 8.3 Score report
Defined in `schemas/score_report.schema.json`. Stored in SQLite and used by the AAR and the adaptive engine.

---

## 9. AI Components (be explicit about these in docs and the pitch)

1. **Procedural scenario generation with learned difficulty calibration.** Generator parameters are calibrated using historical session data so "difficulty level N" maps to measured trainee success rates.
2. **Trainee skill model (adaptive engine).** Maintain a per-trainee skill estimate per dimension (night, swarm, degraded sensors, distractors, urban, speed pressure, ROE complexity) using an Elo-style or Bayesian update (start simple; document the update rule). The scenario selector picks the next scenario to target weak dimensions at the edge of ability (target success rate ≈ 60–75%) and enforces variety.
3. **Adversarial swarm agent (stretch but high-value).** A heuristic or reinforcement-learning agent that adapts swarm tactics (approach axes, timing, decoy usage) to the trainee's observed habits, preventing rote learning. Start with a rule-based adaptive adversary; upgrade to RL only if time allows.
4. **Weakness analytics.** Cluster mistakes (e.g. "misses low-altitude threats at night", "over-engages benign tracks") and generate instructor-facing recommendations.
5. **(Optional) Sensor-confidence estimator.** A small model producing the per-track confidence value shown on the fusion panel.

Every AI component must have: a short design note in `docs/`, unit tests, and a visible place in the UI or AAR where its effect can be seen.

---

## 10. After-Action Review (AAR) Dashboard

**Per-session view**
- Synchronized replay with a timeline scrubber.
- Toggle between **trainee view** (what sensors showed) and **ground truth view** (what really happened).
- Decision markers on the timeline (detections, classifications, engagements) with correct/incorrect highlighting.
- Mistake list with explanations and the ideal decision path.

**Individual trend view**
- Score over sessions, per-metric sub-score trends, detection-time trend.
- Skill radar chart across the dimensions in Section 9.
- Heatmap of weak spots (e.g. time-of-day × swarm size).
- Confusion matrix for classification over time.

**Unit/instructor view**
- Leaderboard and comparison across trainees in a unit (with privacy-conscious options).
- Unit-level readiness summary and common-failure patterns.
- Filters by date range, scenario type, difficulty.
- Export to PDF/CSV.

---

## 11. Data Model (SQLite, outline)

- `users(id, name, role, unit_id)`
- `units(id, name)`
- `scenarios(id, title, json, source[scripted|generated|instructor], seed, difficulty_tags)`
- `sessions(id, user_id, scenario_id, mode, started_at, ended_at, score_total)`
- `events(id, session_id, t_ms, type, payload_json)`   ← the immutable event log
- `score_reports(session_id, json)`
- `skill_state(user_id, dimension, rating, uncertainty, updated_at)`
- `assignments(id, instructor_id, unit_id, scenario_id, due_at)`

---

## 12. Non-Functional Requirements

- **Offline-first:** zero network calls at runtime; all assets bundled.
- **Performance:** 60 FPS target on a mid-range laptop with integrated graphics for the 2D mode; sim tick independent of render rate.
- **Determinism:** same `(scenario, seed, action log)` ⇒ identical event log (tested).
- **Reliability:** autosave of session state; crash recovery.
- **Security/privacy:** local-only data; basic role-based access (trainee/instructor); no external telemetry.
- **Portability:** Windows and Linux at minimum.
- **Accessibility and localization-readiness:** externalize UI strings (English first, Hindi stretch).

---

## 13. Milestones (build order)

1. **M1 – Vertical slice (minimum viable demo):** scenario schema, seeded sim-core, 2D tactical view, one drone type + one distractor, radar only, classify + one engagement action, basic score.
2. **M2 – Realism and variety:** day/night, weather, terrain occlusion, EO/IR/acoustic sensors, degradations, all drone archetypes, swarm behaviors, ROE engine.
3. **M3 – Procedural generation:** generator with validity + fairness checks, 8+ scripted scenarios.
4. **M4 – Scoring and AAR:** full decision-tree scoring, event log persistence, replay, per-session and trend dashboards.
5. **M5 – Adaptive engine:** skill model, scenario selector, difficulty calibration, variety enforcement.
6. **M6 – Instructor tools:** scenario editor, assignments, unit dashboard, exports.
7. **M7 – Packaging:** offline bundle, Docker, install guide, sample data, demo script.
8. **Stretch:** adversarial swarm agent, team mode, VR/WebXR, Hindi UI.

Each milestone must end with a runnable demo and passing tests. Do not start a later milestone if the earlier one's acceptance criteria fail.

---

## 14. Acceptance Criteria (Definition of Done)

- [ ] A trainee can launch the app offline on a laptop, pick or be assigned a scenario, play it, and receive a score report.
- [ ] At least 8 scripted scenarios and an unlimited stream of generated scenarios, all passing schema validation.
- [ ] Generated scenarios pass validity and fairness checks (baseline agent can succeed).
- [ ] Replaying a session from `(scenario, seed, actions)` reproduces the identical event log.
- [ ] Scoring covers detection time, classification accuracy and engagement decisions, with a visible decision-tree breakdown and a mistakes list.
- [ ] AAR shows synchronized replay, trainee-vs-truth toggle, trends over ≥3 sessions, and a unit comparison view.
- [ ] Adaptive engine demonstrably changes scenario difficulty/type based on performance, and a test shows it targets the weakest dimension.
- [ ] Randomization: two consecutive sessions for the same trainee are never identical (fingerprint check).
- [ ] Instructor can create a scenario in the editor and assign it.
- [ ] Documentation: README, install guide, scenario schema doc, scoring doc, AI-components doc, 3–5 minute demo script.

---

## 15. Demo and Presentation Notes (for SIH evaluation)

- Lead with the problem (costly, weather-dependent, unscalable drills) and show the solution running on an ordinary laptop.
- Demo flow: (1) play a night swarm scenario with degraded radar, (2) show a mistake being scored against the ROE tree, (3) open the AAR replay with the ground-truth toggle, (4) show the adaptive engine choosing the next scenario based on the weakness, (5) show the unit dashboard.
- Call out innovation clearly: seeded replayable procedural scenarios, sensor-uncertainty-aware training, ROE-based decision-tree scoring, adaptive/adversarial difficulty, fully offline.
- Be upfront about scope: gameplay-level modelling, not an engineering-grade weapon simulator.

---

## 16. Instructions to the Coding Agent

1. Read this whole file, then create `docs/DECISIONS.md` and a task checklist derived from Section 13.
2. Work milestone by milestone. At the end of each milestone: run tests, update docs, and summarise what works and what is stubbed.
3. Write schemas first (`/schemas`), then code against them.
4. Keep `sim-core` free of UI and I/O so it can run headless and in tests.
5. Never use unseeded randomness inside the simulation or generator.
6. Keep all counter-measure modelling abstract (effectiveness, range, cooldown, side effects). Do not add real technical specifications of weapons, jamming frequencies or exploit methods.
7. Prefer small, well-tested modules. Add tests for determinism, scoring edge cases, generator validity/fairness, and the adaptive selector.
8. Ask the user only when blocked by a decision that materially changes scope (team size, 3D vs 2D, VR). Otherwise use the defaults in Section 4 and log the decision.
9. Keep the demo path (Section 15) working at all times; do not leave the main branch broken.

## 17. Open Questions (answer when known, update this file)

- Team size and skill mix (game dev / ML / web / hardware).
- 2D/2.5D only, or 3D/VR as a first-class target?
- Is a Hindi UI required for the demo?
- Any specific scenario types the Defence Services Staff College would like to see?
