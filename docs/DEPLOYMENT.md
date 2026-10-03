# Deployment — who runs it, what it costs, how it survives

Written to answer the finale jury's favorite questions before they ask them.

## Ownership (day one)
- Owning unit: battalion/unit signals or air-defence cell; instructor role = unit training JCO/NCO or DSSC directing staff.
- Trainees use personal trainee profiles; instructors sign in locally for studio + readiness. No central admin needed.

## Cost (per training station, per year)
- Hardware: one existing office laptop (integrated graphics OK; low-resource mode included). ₹0 new hardware.
- Licenses: ₹0 — React/Node/SQLite, all open; no cloud, no API bills, no telemetry.
- Maintenance: copy the SQLite file for backup (`data/drishti.sqlite` → dated copy); restore by copying back. ~5 minutes, no expertise.
- Scaling: stations are independent by design (air-gap friendly). Unit rollup = CSV export per station, merged in any spreadsheet.

## Data & privacy
- Everything stays on the machine: sessions, event logs, skill profiles. Health endpoint reports `external_services: 0`.
- Synthetic demo profiles are labeled and separable from real records (exports carry a `synthetic` column).

## Reliability notes (honest)
- `node:sqlite` is experimental in Node 24: mitigated by pinning + vendoring v24.13.0 in the offline bundle and covering persistence with 10 backend integration tests.
- Deterministic engine: any disputed score can be replayed byte-identically from scenario + seed + action log (event hash shown in AAR).
- Display errors cannot lose training data: Error Boundaries isolate the UI; scores/events live server-side in SQLite.

## What it is not
- Not connected to real sensors, drones, or weapons. Not a readiness certification — scores are practice heuristics, labeled as such wherever shown.
