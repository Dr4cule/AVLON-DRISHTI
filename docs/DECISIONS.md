# AVLON DRISHTI — engineering decisions

`PROJECT_SPEC.md` is the source brief. All project work lives in this directory.

## 001 · A complete decision-training loop

Build a desktop-first 2D application: briefing → imperfect sensor picture → acknowledgement → classification → reasoned response → explainable score → synchronized replay → adaptive next exercise. The product name **DRISHTI** means sight/perspective. The visual identity uses graphite, warm amber, and cyan with shape-coded contacts.

## 002 · One portable runtime instead of two

Use React + TypeScript + Canvas for the UI and **Node.js 24 LTS + TypeScript + SQLite** for the local backend. This is a deliberate deviation from the recommended Python/FastAPI backend. Running the exact same pure simulation, generator, scoring, and adaptive modules in the browser, server, and tests prevents cross-language numerical/PRNG drift and makes a genuinely self-contained offline folder possible with one bundled runtime. SQLite is accessed through Node's built-in `node:sqlite`; no native npm addon or separate database service is required. Pin the runtime major to 24; the SQLite API is experimental in that release.

## 003 · Deterministic, versioned replay

The core uses integer ticks of 250 ms, a seeded 32-bit PRNG, stable actor ordering, and quantized positions. Inputs are `(scenario JSON, seed, ordered action log, end tick, engine version)`. Rendering time, IDs, wall-clock dates, I/O, and UI state never enter the core. Each recorded event has a monotonic sequence and simulation timestamp. Server scoring replays actions rather than trusting client scores. Snapshots are projections; the event log and inputs are the evidence.

## 004 · Simulation fidelity

All geography is fictional and procedurally drawn. Distances, signatures, movement, sensor reliability, and response ranges are **gameplay parameters**, not measurements of real systems. Counter-measures remain abstract probabilistic game actions. No real drone connection, weapon interface, hardware specification, or operational data is needed. A two-dimensional laptop simulator is the first-class target, as allowed by the brief.

## 005 · Honest, inspectable adaptation

Use a small Bayesian evidence model per learning dimension, historical difficulty calibration, and deterministic scenario selection targeting 60–75% estimated success. Publish the update rule and uncertainty. Procedural generation and sensor fusion are separately labeled algorithms, not represented as trained neural models. Cold-start predictions and synthetic demonstration sessions are explicitly marked. The initial release does not claim validated real-world learning transfer.

## 006 · Local data and roles

The packaged local server binds to loopback by default. SQLite is the durable store; a browser journal autosaves actions between server checkpoints and supports recovery. Instructor actions require a local instructor login; trainees can access only their own sessions. Demonstration accounts and their synthetic data are clearly labeled. No analytics, CDN fonts, remote tiles, telemetry, or cloud AI calls at runtime.

## 007 · Delivery and checks

Deliver a single-folder portable bundle containing the current platform's Node runtime, bundled server, bundled UI, and launch scripts, plus Docker Compose. Build a Windows bundle here; build the same script on Linux for a Linux-native runtime. Use Vitest for pure-core and backend integration checks and Playwright for the presentation path. Schema validation runs at import/save boundaries on both browser and server.

## 008 · Scope priorities

Complete M1–M7 before optional VR, networked team roles, reinforcement-learning adversaries, or Hindi translation. Use externalized domain/UI copy and semantic controls so localization and accessibility have a clear path. Hardware FPS claims must be measured, not inferred from the chosen stack.

## 009 - Pure-TS threat model instead of ONNX

The AI brief allowed ONNX export where practical. It is not practical here: a multinomial softmax in pure TypeScript wins on every stated priority (KB-sized JSON weights, sub-millisecond CPU inference, zero new dependencies) and gives exact linear evidence attribution, which an ONNX black box cannot. Training runs offline via tsx on sim-generated labels; retraining is byte-deterministic. Revisit only if a future model class demonstrates measured benefit on the validation report.

## 010 - Integer difficulty plus expected success instead of fractional levels

The AI brief sketches target difficulty as 3.2/5. The scenario schema defines integer levels 1-5, and inventing fractional levels for presentation would be theater. The system keeps integer difficulty and expresses targeting precision honestly as expected-success percentage plus named scenario modifiers (night, IR loss, conflict, load, ambiguity).

## 011 - No MLP: interactions benchmark rejected, neural net never built

Softmax plus five documented interaction features was benchmarked on the identical scenario-level split and failed the pre-registered bar (macro-F1 gain below 0.02), so the plain 15-feature model shipped. An MLP was not built or benchmarked. The project deliberately retained the simpler softmax model because it already satisfied the required determinism, CPU-only/offline deployment, tiny footprint, and exact feature-attribution constraints, while the interaction benchmark did not meet the predefined improvement threshold. The comparison table in the training report shows majority, heuristic, and both softmax variants so a judge can see the whole ladder.

## 012 - Scenario-level validation split with a dedicated calibration split

The first training run split individual snapshots 80/20, which let one trajectory's snapshots straddle train and validation. Splits are now grouped by scenario ID (70/10/20 train/calibration/test) via deterministic round-robin, and the trainer aborts if any scenario appears in two splits. Temperature is fitted on calibration only and evaluated on test only; the UI reports MODEL CONFIDENCE with its ECE documented, never raw softmax probabilities dressed as calibrated truth.

## 013 - Assessment integrity without server-side simulation

Scenario truth (actor allegiance/kind) necessarily reaches the trainee machine: the browser runs the same deterministic simulation locally for the live view and recovery, the UI bundles the scripted library as a fallback, and drafts carry full scenarios for resume. Stripping truth from API payloads alone would be theater — DevTools and the JS bundle would still contain it — while breaking the offline local sim. The integrity model is therefore: (1) the rendered trainee view never shows allegiance/kind (verified by test — tracks carry operator classifications only); (2) scores are recomputed server-side from the append-only event log and client scores are never trusted; (3) assessment runs are supervised use on a local station. Server-hidden simulation would require stepping every tick through the API and is explicitly out of scope for the offline design.
