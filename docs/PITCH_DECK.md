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
- **What we wrote:** deterministic seeded simulation core (shared browser/server/tests), ROE decision-tree scorer, Beta-skill adaptive selector, procedural generator with baseline fairness gate.
- **What we did NOT build:** no neural nets, no LLMs, no real weapon data — everything is fictional gameplay parameters. Say this out loud; judges punish caught AI theater, never honesty.
- Stack (checkable names): React + TypeScript + Canvas, Node 24, SQLite (built-in), Vitest + Playwright. 38 unit tests + browser E2E green.
- *If asked "where is the AI?": point at the Beta update rule in `sim-core/adaptive.ts` and the generator's fairness loop — small, inspectable, CPU-only.*

## Slide 5 — Feasibility, viability, impact
- Feasibility: runs today on an ordinary laptop; vendored offline bundle; Docker option. Risks named: `node:sqlite` experimental → pinned + vendored runtime; no real sensor data → synthetic-but-schema-faithful fixtures, replay-verified.
- Impact math (show working): one station × 30 trainees × 20 reps/month = 600 decision-reps monthly at ~₹0 marginal cost vs one live-fire drill day. Ashni-scale need: 385 platoons × 20–25 troops.
- Deployment: unit signals/AD cell owns it day one; SQLite file backup; zero licenses; see `docs/DEPLOYMENT.md`.

## Slide 6 — Research & references
- SIH26247 official text (sih.gov.in, captured 2026-10-02) · EU JRC SeDaFuV open C-UAS fusion sim · US Army ATP 3-01.81 (detect→decide doctrine) · Continuum ATLAS ("decision intelligence, not hardware") · Op Sindoor reporting (PIB, Tribune) + CDS Chauhan on indigenous C-UAS · Reynolds boids · Fiedler fixed-timestep.
- Close: *"Same seed + same decisions = byte-identical replay. Ask us to prove it live."*
