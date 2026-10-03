# Understanding the idea and research notes

Research date: 2026-10-03. The supplied specification is authoritative for this project's requirements. Verified 2026-10-03: SIH26247 exists on the official SIH 2026 list (Software, Ministry of Defence, Defence Services Staff College, Robotics and Drones) with matching title, background, and all four expected outcomes — see verification below.

## Official SIH26247 text (via sih.gov.in-sourced viewer, data captured 2026-10-02)

> Background: Recent conflicts have shown that low-cost commercial and military-grade drones, employed individually and in swarms, have become a decisive battlefield factor. Existing training replies on classroom instruction and limited live-fire drills, which are costly, weather-dependent and do not scale to give troops adequate repetitions.
>
> Detailed Description: A software-based simulation platform is required to train personnel in recognizing, classifying and responding to drone/swarm threats across varied and realistic scenarios (day/night, degraded sensors, urban/rural terrain, single-drone and swarm attacks). The tool should be usable at unit level with minimal speacialized hardware.
>
> Expected Solution/Outcomes: (1) Desktop or VR-capable simulator with scripted and procedurally generated threat scenarios. (2) Decision-tree based scoring on detection time, threat classification accuracy and engagement decisions. (3) After-action review (AAR) dashboard tracking individual/unit performance over repeated sessions. (4) Adjustments difficulty and scenario randomization to prevent rote learning.

Match assessment: ID, title, organization, department, category, theme, background, and all four outcomes match `PROJECT_SPEC.md` §1 nearly verbatim. "Desktop or VR-capable" means desktop alone satisfies outcome 1; VR remains an allowed stretch goal.

## What the project actually teaches

A visible object is not necessarily hostile. A high-confidence track is confidence in a sensor observation, not permission to respond. A response can succeed in the game and still be the wrong decision under the exercise's rules. These distinctions must be visible in the UI, log, scoring, and replay.

The learning loop is **observe → form a hypothesis → choose and justify an action → compare evidence with truth → practice a targeted weakness**. Repetition is useful only if scenarios vary and the learner can explain mistakes. The four mandatory outcomes therefore belong to one workflow, rather than four disconnected demo screens.

## Sources and their design implications

1. [Smart India Hackathon, official site](https://www.sih.gov.in/) — emphasizes practical, innovative, cost-effective solutions. The presentation should show working evidence: offline launch, a recorded mistake, exact replay, and an adaptive next scenario. Avoid unsupported prize or effectiveness claims.
2. [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) — fixed simulation steps decouple behavior from rendering and permit reproducibility. Use an accumulator for the live view, bounded catch-up, and identical headless stepping in replay and tests.
3. [Craig Reynolds, Boids](https://www.red3d.com/cwr/boids/) — separation, alignment, and cohesion can produce legible emergent group movement using simple local rules. Use lightweight game-level group behaviors; a neural simulation engine is unnecessary.
4. [Badrinath, Wang & Pardos, pyBKT (EDM 2021)](https://arxiv.org/abs/2105.00385) — knowledge tracing makes skill estimates an explicit component of adaptive learning. AVLON DRISHTI uses a simpler documented Beta evidence model, not pyBKT's hidden-state/EM model; this paper supplies context, not validation of our model.
5. [MDN, Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) — precache bundled assets and version the cache; localhost is a secure origin. Offline installation and local data storage are separate concerns. A portable local server handles first launch without internet; an app-shell cache handles later disconnected reloads.
6. [FastAPI, SQL databases](https://fastapi.tiangolo.com/tutorial/sql-databases/) — SQLite is appropriate for a zero-setup file-backed application. The backend runtime was simplified to Node to share the exact core; see decision 002.
7. [Node.js SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) — a built-in file database removes an external service/native addon. Use transactions, foreign keys, prepared statements, and append-only event storage.

## Product translation

| Brief requirement | Demonstrable behavior |
| --- | --- |
| Imperfect multi-sensor perception | Measured track positions, confidence, age, channel-specific evidence, planned dropouts, and clutter; no allegiance leaks in the trainee map |
| Scripted and generated exercises | Ten named curricula plus seeded generation, baseline feasibility, reproducible IDs and diversity checks |
| Decision-tree scoring | Per-contact path with detection, classification/type, response, compliance, timeliness, outcome, and timestamped explanations |
| After-action review | Scrub a saved run; switch between sensor observations and truth at the same tick; select an event to jump to it |
| Adaptive difficulty | Inspect posterior skill/uncertainty and calibration evidence, then launch the recommended generated exercise |
| Instructor/unit use | Save and assign exercises, compare real or clearly labeled synthetic sessions, export results |
| Minimal hardware | Canvas rendering, small CPU models, bundled assets, local file database, one portable runtime |

## The strongest presentation moment

In the night/degraded-sensor exercise, make a classification mistake. End the exercise. In AAR, select that decision and toggle from the ambiguous sensor view to ground truth. Show exactly why the decision lost points. Open the adaptive panel and explain which learning dimension changed and why the next exercise targets it. Finish with the same evidence aggregated at unit level.
