# Implementation checklist

Each milestone is gated by a runnable application and its relevant checks.

- [x] **M1 — Vertical slice:** versioned schemas; seeded pure core; tactical map; acknowledge, classify, respond; basic score; determinism tests.
- [x] **M2 — Realism and variety:** environmental effects; five sensor channels; uncertainty and stale tracks; all archetypes; abstract responses; ROE and reasoning gates.
- [x] **M3 — Scenarios:** ten scripted JSON exercises; editable difficulty; deterministic generation; validation; baseline fairness; diversity fingerprints.
- [x] **M4 — AAR:** decision-tree report; immutable event log; local SQLite; autosave/recovery; exact replay; sensor/truth toggle; timeline; individual trends.
- [x] **M5 — Adaptation:** per-dimension evidence; uncertainty; learned calibration; weakest-skill targeting; recommendations; model tests and visible evidence.
- [x] **M6 — Instructor:** graphical scenario editor; JSON import/export; validation; assignments; unit comparison; filters; CSV and print/PDF export.
- [x] **M7 — Delivery:** portable offline folder; Docker Compose; install instructions; demo guide; browser smoke tests; offline verification; final review.

## Gate results

### M1

Passed `npm run typecheck`, `npm test -- tests/core.test.ts` (5 checks), and `npm run build`. The runnable vertical slice has a local terrain/radar canvas, measured tracks, selection, acknowledgement, classification, an abstract response, and a basic score. Full scoring, additional sensors, persistence, and other workspaces are subsequent milestones.

Optional features are not counted as completed deliverables.

### M2

Passed production build/typecheck and seven sensor/ROE checks, including dropouts, degraded detection, bearing-only evidence, IFF, warning requirements, resource preservation on rejected actions, wire-guided EM immunity, and deterministic group motion. The UI now has synthetic EO/IR/RF/acoustic cues, fusion evidence, a track register, all seven abstract responses, recorded reasoning, keyboard shortcuts, and a training-only hint. Additional exercise presets and the generator are M3.

### M3

Passed production build/typecheck and five generator checks. All ten scripted exercises pass schema and delayed-baseline feasibility checks. Fifty generated exercises spanning five difficulty levels pass validation and fairness; repeated inputs are deterministic and recent fingerprints are avoided. The library, search/filters, briefings, training/assessment selection, generator controls, and baseline proof are runnable.

### M4

Passed typecheck, `tests/scoring.test.ts` (6), and `tests/backend.test.ts` (11, incl. synthetic reproducibility, score recompute, append-only enforcement, auth/ownership, draft recovery). Decision-tree scoring recomputed server-side from the immutable event log; SQLite with append-only triggers; checkpoint autosave + browser-journal recovery; exact replay with hash verification badge; sensor/truth/split replay, timeline markers, per-contact decision trace, trends/confusion/heatmap, CSV/JSON/print export.

### M5

Passed `tests/adaptive.test.ts` (5) plus backend skill-persistence/auth/determinism tests. Per-dimension Beta(a,b) skill model with documented update rule; skills recomputed and **persisted to `skill_state` on every session finish** (7 rows per trainee, verified); difficulty calibration from real history; weakest-dimension targeting at ~68% success with deterministic history-derived seeds; cold-start labeled; weakness recommendations surfaced in the Adaptive intelligence panel. Instructor trainee-profile review gated to the instructor role.

### M6

Verified via backend tests (assignment validation/lifecycle, instructor-scenario library persistence with baseline gate) and manual UI pass. Scenario studio persists to the station library (`POST /api/instructor/scenarios`, schema + feasibility gated), exports/imports JSON, assigns to units with due-date validation; assignments support update/delete with instructor-only guards; unit dashboard shows roster averages, failure clusters, trends, CSV/print export. Synthetic data always labeled; no validated-readiness claims.

### M7

`node packaging/bundle.mjs` stages `release/AVLON-DRISHTI` with a **vendored Node v24.13.0 runtime** (verified boot: API + web healthy on a test port), `Dockerfile` + `docker-compose.yml` (+ `.dockerignore`), `docs/INSTALL.md` + `DEMO_SCRIPT.md`, and Playwright E2E: API smoke plus a real-browser judge path (start → ack/classify/respond → debrief → REPLAY VERIFIED → adaptive recommendation) against an isolated DB — 2/2 passing.

### Hardening + warfare-research pass

Crash-proofing (ErrorBoundary at shell + tactical station, validated studio imports, guarded restore recovery), `fiber_optic` EM-immune archetype, scenarios 09 (spotter–striker night wave) and 10 (wire-guided + civilian restraint) with real-tactic footnotes, present-mode projector toggle, empty-state CTAs, deterministic recommend-by-default, 24 synthetic demo sessions, `docs/PITCH_DECK.md` + `docs/DEPLOYMENT.md` + backup-video shot list. Suite: 97/97 Vitest, 2/2 Playwright, typecheck clean, bundle re-verified.
