# Scenario schema v1.0

File: `schemas/scenario.schema.json`. Validated on import, generation, studio save, and server start.

Required: schema_version=1.0, id `^[A-Za-z0-9_-]{1,80}$`, title, description, source scripted/generated/instructor, seed u32, environment, assets 1..4, sensors ≥1 unique, degradations, roe, actors 1..24, ground_truth_tree=decision-v1, difficulty 1..5, 7 difficulty_tags 0..5, duration 60..900s.

Semantic rules (`validation.ts`): unique actor/asset IDs, exactly one protected asset (the engine defends `assets[0]`; schema permits up to 4 for forward compatibility), unique expanded contact IDs (group + literal collisions rejected), ≤40 expanded contacts, spawn ≥20s before end, IFF only friendly, friendly_uav must be friendly, degradation sensor must exist and fit duration.

Actor: kind incl `clutter` (benign radar-only artifact) and `fiber_optic` (wire-guided intruder: radar ignores EM degradation, RF nearly silent), allegiance, count 1..12, behavior 9 modes, spawn bearing 0..360 + range 600..4400, spawn_s, speed 2..65, altitude 10..900, iff, civilian_area.

Fingerprint (diversity): environment + difficulty + ROE + per-actor kind/allegiance/count/behavior + bearing/30 + range/500 + spawn/15 + speed/5 + altitude/100 + iff + civilian-area + sensors + degradations/20 + degradation-duration/10. Deliberately omits seed/title.

Feasibility: delayed oracle baseline must score ≥70, preserve ≥80% asset health, resolve all hostiles, zero ROE violations.
