# SIH Idea Deck — slide-by-slide content (official 6-slide template)

Copy these into the official SIH PPT template character-for-character where marked with ✓.
One message per slide. Speaker notes in italics.

## Slide 1 — Title (copy exactly ✓)
- PS ID: **SIH26247** ✓ · Title: **AI-Enabled Drone & Counter-Drone Threat Simulation Trainer** ✓
- Organization: **Ministry of Defence (MoD), Defence Services Staff College** ✓
- Category: **Software** ✓ · Theme: **Robotics and Drones** ✓
- Team name + 6 members + college (fill in).

## Slide 2 — Problem
- Cheap drones + swarms are decisive (Ukraine: millions of FPVs; Op Sindoor, May 2025: drone waves met by India's integrated grid).
- Training today = classroom slides + rare, costly, weather-dependent live drills → troops get too few decision repetitions.
- Army answer so far: Ashni drone platoons in all 385 infantry battalions — *every one of them needs exactly this trainer.*
- *Say: "Replace 'battlefield' with any border post and the slide still holds — this is specifically about the operator's decision loop."*

## Slide 3 — Solution (AVLON DRISHTI)
- Laptop-runnable, offline, no GPU: imperfect multi-sensor picture → acknowledge → classify → reasoned response → explainable score → sensor-vs-truth replay → adaptive next exercise.
- Live demo first (60 seconds), slides only if asked.
- The one-line hook: *"We train judgment under doubt, not reflexes — confidence is evidence quality, not permission to act."*

## Slide 4 — Technical approach (be brutally honest)
- **The loop (draw this):** SIMULATED SENSOR DATA → 15-feature trained model → threat hypothesis + model confidence + evidence → HUMAN DECIDES → deterministic scoring → AAR/replay → Bayesian skill model → adaptive challenge → procedural generation → ↺ (loop).
- **Four kinds of "AI" — name which is which:** TRAINED ML = threat classifier only · STATISTICAL ADAPTATION = Bayesian skill model · RULE-BASED INTELLIGENCE = pattern detection, challenge mapping, adversary emphasis · DETERMINISTIC SYSTEMS = simulation, scoring, replay, fairness gate. Never describe the rule-based or deterministic parts as trained models.
- **Where is the AI? (three answers, in this order):** (1) a tiny *trained* softmax threat model — 15 features → 6 classes, learned from 14,874 sim-generated snapshots, scenario-level held-out validation, macro F1 0.62 vs 0.54 heuristic vs 0.10 majority; (2) a Bayesian skill model with persisted skill state and pattern detection; (3) challenge-profile scenario intelligence with a mandatory fairness gate.
- **What we did NOT build:** no LLMs, no giant models, no ONNX runtime (a WASM black box would cost us exact evidence attribution), no real weapon data — everything is fictional gameplay parameters. Say this out loud; judges punish caught AI theater, never honesty.
- **AI metrics block (copy from `docs/AI_METRICS.json`, never from memory):** 15 features → 6 classes · 14,874 synthetic observations · 230 scenarios · scenario-level held-out validation · accuracy 70.3% · macro F1 0.62 · balanced accuracy 0.69 · ECE 0.109→0.046 · model ~2.3 KB · inference <1 ms CPU · offline.
- **AI DOES:** interpret imperfect sensor evidence · estimate a threat hypothesis · expose uncertainty · identify training weaknesses · recommend the next exercise. **AI DOES NOT:** control scoring · override ROE · see hidden ground truth during inference · require cloud inference · require a GPU · make the final operational decision.
- Stack (checkable names): React + TypeScript + Canvas, Node 24, SQLite (built-in), Vitest + Playwright. 82 unit tests + browser E2E green.
- *Key line: **AI recommends. Deterministic simulation verifies. Human decides.***

## Slide 5 — Feasibility, viability, impact
- Feasibility: runs today on an ordinary laptop; vendored offline bundle; Docker option. Risks named: `node:sqlite` experimental → pinned + vendored runtime; no real sensor data → synthetic-but-schema-faithful fixtures, replay-verified.
- Impact math (show working): one station × 30 trainees × 20 reps/month = 600 decision-reps monthly at ~₹0 marginal cost vs one live-fire drill day. Ashni-scale need: 385 platoons × 20–25 troops.
- Deployment: unit signals/AD cell owns it day one; SQLite file backup; zero licenses; see `docs/DEPLOYMENT.md`.

## Slide 6 — Research & references
- SIH26247 official text (sih.gov.in, captured 2026-10-02) · EU JRC SeDaFuV open C-UAS fusion sim · US Army ATP 3-01.81 (detect→decide doctrine) · Continuum ATLAS ("decision intelligence, not hardware") · Op Sindoor reporting (PIB, Tribune) + CDS Chauhan on indigenous C-UAS · Reynolds boids · Fiedler fixed-timestep.
- Close: *"Same seed + same decisions = byte-identical replay. Ask us to prove it live."*
