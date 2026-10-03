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
