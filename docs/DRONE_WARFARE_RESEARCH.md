# Real Drone Warfare — Research Dossier for AVLON DRISHTI

Compiled 2026-10-03 from open sources (news, doctrine, papers, vendor docs, Army publications).
Purpose: ground our *fictional, gameplay-level* trainer in real tactics, sensors, and
decisions — so scenarios, briefings, and the judges' Q&A sound like they come from
people who understand the actual battlefield. Nothing here is a weapon design;
everything is public knowledge.

Key abbreviations: UAV unmanned aerial vehicle · FPV first-person-view ·
C-UAS counter-UAS · EW electronic warfare · GNSS satellite navigation (GPS/GLONASS/…)
· ISR intelligence/surveillance/reconnaissance · AD air defence · IADS integrated AD system.

---

## 1. Why drones changed warfare: the cost-exchange crisis

The single most important fact in modern drone warfare is arithmetic:

| Engagement | Attacker cost | Defender cost | Exchange |
|---|---|---|---|
| SM-6 missile vs Shahed-136 | $20–50k | $4M+ | ~40:1 against defender |
| Coyote interceptor vs FPV | $0.5–2k | $100k+ | 20–50:1 against defender |
| Ground EW vs RF drone | $0.5–2k | ~zero marginal | favorable |
| Laser/HPM vs drone | $0.5–100k | ~$0.05–1k/shot burdened | favorable |
| FPV interceptor drone vs recon UAV | ~$2–2.5k | ~$2–2.5k | ~1:1, sustainable |

Consequences that matter for a *trainer*:
- Defenders cannot afford to shoot everything; **target prioritization and response
  selection under uncertainty is the core skill** — exactly what AVLON DRISHTI trains.
- EW is cheap per-shot but emitters get hunted (~90 Russian jammers visually
  confirmed lost); "jam everything" has a cost too — relevant to ROE/side-effect modeling.
- Forcing the enemy onto expensive adaptations (e.g. $1.5–3k fiber drones vs
  $0.5–1k RF FPVs) is itself a victory — "cost imposition" is a real C-UAS concept.

---

## 2. Ukraine war — the FPV revolution (2022→)

- The dominant weapon is the **FPV kamikaze quadcopter**: $200–1,000, 5–15 km range,
  small payload. Started as 7-inch frames (2022), grew to 13-inch (2024–25) to carry
  relays, bigger batteries, cameras. The FPV is a *universal platform*: same base
  becomes bomber, ISR bird, relay node, or interceptor depending on payload.
- Ukraine built ~800k drones (2023) → ~2M (2024) → targeting ~5M (2025).
- **Baba Yaga**: heavy multi-rotor bombers converted from agricultural sprayer drones.
  Long range, return-to-base (reusable — saves resources), mostly night work, seen on
  thermal as a white/black burst. Hard to classify: big, slow, persistent.
- **FPV interceptor drones** (e.g. Wild Hornets' *Sting*, ~$2.1–2.5k, 315 km/h, ~37 km
  range): used *defensively* to ram/proximity-kill Russian recon UAVs (Zala, Supercam,
  Orlan). 2,500+ documented interceptions by spring 2025; recon kills outnumber strike-drone
  kills ~20:1 (recon birds loiter predictably; strike birds fly low/fast/silent).
  Shahed-class targets are still mostly out of reach for FPV interceptors (speed gap).
- **Knyaz Vandal / fiber-optic FPVs** (Russia first, Kursk Aug 2024, ~15–20% of Russian
  FPVs by mid-2025): controlled through a hair-thin fiber spool — **immune to jamming**,
  no radio horizon limits, perfect video into buildings/forests. Trade-offs: heavier
  (bigger frame, battery), slower (~40–50 km/h), low altitude (2–4 m), cable can snap
  or be cut; fields end up glittering with spent fiber. Countered only physically
  (shotguns, nets, interceptor drones) or at the factory (Ukraine struck Russia's
  fiber plants in Saransk, Apr–May 2025).
- **AI terminal guidance**: both sides add pixel-lock/target-recognition for the last
  seconds of flight so the drone completes the strike *after* the link is jammed.
  Still operator-approved, not autonomous — but jam-proof by design. This is the
  trajectory: autonomy as an EW countermeasure.
- **Trench-level EW**: big vehicle jammers are themselves targets (they radiate), so
  EW shrank to backpack/vehicle/shotgun-team scale — "soldier with a jammer backpack
  and a shotgun" is the iconic 2025 image. Friendly-fire jamming is rampant
  (up to ~75% of FPV losses attributed to jamming, much of it friendly).
- **Layered Russian practice**: signals intel → identify → jam → kinetic
  (shotguns/nets) + physical protection. Training and standardization lag behind
  fielding — a direct argument for trainers like ours.

## 3. One-way attack drones: Shahed-136 / Geran-2

- Iranian design (HESA), Russian-built as *Geran-2* at Alabuga (target: 6,000+ by
  summer 2025; ~26,000 family built per some counts). ~200 kg, 3.5 m long, delta wing,
  MD-550 piston engine (German Limbach clone), ~185 km/h, range 1,000–2,500 km,
  30–90 kg warhead. Unit cost estimates $10k–$193k depending on source/method.
- Flies pre-programmed GNSS/INS routes (static targets only, classically), 700–2,000 m
  en route, down to ~200 m near target; prefers **night (23:00–06:00)**, routes along
  rivers/highways at 20 m+ to mask engine noise (audible 20+ km in still air —
  excellent *acoustic* cue). Visually ~bird-flock-sized on old fighter radars.
- Launched in volleys (5+ from truck racks; also rail/ship/mobile), often in pairs
  with a scout/repeater UAV. Used to saturate AD, expose SAM positions, grind
  energy infrastructure.
- EW duel in miniature: 4-element Nasir → Kometa-M4 → 8-element circular CRPA
  (later Chinese-made); Raspberry Pi + ZTE LTE modems taped on for telemetry
  (both RU and UA SIMs); mesh-radio modems (XK-F358) turning each drone into a
  repeater node. Interception rates swung 77% → 97% → back down as antennas evolved.
- Ukrainian answer: **mobile fire groups** (pickup + searchlight + thermal + MGs —
  a 3-man team with a PKT and a thermal imager killed a Shahed at 300 m with
  120 rounds), Gepard SPAAGs, EW (nearly half of some nightly waves neutralized
  by jamming/spoofing), and now FPV/missile interceptors.
- Variants: Geran-1 (Shahed-131, smaller), Geran-3 (jet-powered Shahed-238),
  black night paint, steel-cased penetrator warheads, thermobaric options.
  Ukraine answered with analogues (Batyar, 800 km, optical terrain matching).

## 4. Nagorno-Karabakh 2020 — the TB2 lesson (with caveats)

- Turkish Bayraktar TB2 ($5M, MALE, 27 h endurance, laser-guided MAM bombs) + Israeli
  loitering munitions dismantled Armenian armor and AD piecemeal — *because* Armenia
  had ~6 relevant systems (Tor), no overlapping coverage, no EW worthy of the name,
  and parked vehicles in the open.
- Analysts (e.g. E. Hecht, IDF) warn against over-learning: TB2s became nearly
  unusable over Ukraine once dense EW + layered SAMs arrived (late 2022) and were
  relegated to standoff ISR. Lesson for training: **threat effectiveness is
  context-dependent** — same drone, different air-defence environment, different
  outcome. Our difficulty/environment system models exactly this.
- Genuine innovation validated there: cheap decoy/spotter + strike pairing,
  drone-led SEAD (hunting SAMs first, then everything else).

## 5. Naval drones — the Black Sea upset

- Ukraine (no navy) crippled Russia's Black Sea Fleet with USVs: **Magura V5**
  (~$250k, 42 kt sprint, 833 km, 320 kg) and **Sea Baby** (~$221k, 49 kt,
  1,000 km, 850 kg). ~19 ships hit; 8+ warships sunk (~$240M+) in 2024 alone;
  fleet retreated from Sevastopol to Novorossiysk.
- Evolution path worth copying as *scenario design language*: suicide ramming →
  minelaying → machine-gun boats → UAV carrier boats → R-73/AIM-9X air-to-air
  missiles (first USV air kills: Mi-8 Dec 2024, Su-30s May 2025) → strikes on
  S-400/Nebo-M radars and Pantsir systems ashore.
- Houthi precedent: explosive USVs vs Saudi frigate (2020), then Red Sea shipping
  (Waid-1/2 = Shahed-131/136) — chokepoint weaponization on the cheap.
- India relevance: obvious (long coastline, island territories, carrier groups).

## 6. India's own experience — Operation Sindoor (May 2025)

- Night of 7–8 May 2025: Pakistan sent drones + missiles at 15+ sites (Srinagar,
  Jammu, Pathankot, Bhuj…); all neutralized by the **Integrated Counter-UAS Grid +
  AD**: Akash/Akashteer + IACCS synergy, legacy L-70/Schilka guns with radar/EO
  upgrades (cheap shells vs slow drones = favorable exchange), DRDO **D4 C-UAS**
  (3 km zone), Skystriker/PALM-400 loitering munitions on offense.
- Aftermath (all public, 2025–26): **Ashni drone platoons (20–25 troops) in all
  385 infantry battalions**; BEL **Saksham** C-UAS grid (to 10,000 ft, AI decision
  support) fast-tracked; Army built 819+ drones in-house with SMEs; Core Committee
  + SPV for UAS/C-UAS; MoD annual report openly admits indigenous gaps in
  niche UAS/C-UAS products.
- CDS Gen. Chauhan: drones "shift tactical balance disproportionately"; must fight
  "today's warfare with tomorrow's technology"; indigenous systems add surprise.
- Pitch gold: *every Ashni platoon needs exactly this trainer*; DSSC connection;
  Atmanirbhar + zero-import story (our stack: Node/React/SQLite, no foreign cloud).

## 7. How real C-UAS works — the kill chain our game abstracts

Real chain: **Detect → Track → Identify → Decide → Mitigate**, fused in a C2 picture.

| Layer | Real systems | Our gameplay mirror |
|---|---|---|
| Radar (active/passive, micro-Doppler vs birds) | Giraffe, Blighter, Fortem | radar channel, bird-flock confusion |
| RF detection/DF (finds drone *and pilot*) | Dedrone, DroneShield, ARDRONIS | rf channel, bearing-only cue |
| EO/IR cameras + AI classifiers | Elysion, HENSOLDT, Dedrone (18M images) | eo/ir channels, visual evidence strings |
| Acoustic arrays | various (34+ products) | acoustic channel, loud movers easier |
| Cyber/protocol (Remote ID decode) | OpenDroneID libs | iff flag (simplified honestly) |
| Jamming (RF/GNSS) | DroneGun, DedroneDefender, Lima | electronic_jam (abstract) |
| Spoofing (redirect/land elsewhere) | Lima (20,500+ Shaheds disrupted), Shipovnik | spoof_redirect (abstract) |
| Kinetic (guns/missiles… $!) | Gepard, Stinger, SM-6 | kinetic_intercept (ROE-gated, abstract) |
| Nets/capture, hunter drones | Fortem DroneHunter, Anvil, Sting | net_capture, interceptor flavor |
| Lasers/HPM | DragonFire, Epirus | (future effector skin) |

- Real C2 (Anduril Lattice, DedroneTracker.AI, HENSOLDT Elysion, BEL Saksham):
  confidence-ranked fused tracks, prioritization (distance/time-on-target), audit
  logs, replay/debrief — i.e., the industry already converged on *our* UI vocabulary.
  Mirror their words in the pitch: "confidence-ranked tracks", "audit log",
  "prioritization", "proportional response".
- Key real-world rules that justify our ROE engine: jammers interfere with friendly
  comms/GPS (collateral), spoofing needs care near airports/civilians, kinetic is
  last resort with forensic downsides, EW emitters reveal themselves.

## 8. EW vs drones — the physics both sides exploit

- **Jamming**: overpower the link (control 2.4/5.8 GHz, video, GNSS L1 1575 MHz…).
  Metric: jammer-to-signal ratio at the victim receiver. Failsafe behavior on link
  loss: hover / return-home / land — *this is why our jammed contacts drift or RTB
  in-game*.
- **Spoofing/meaconing**: fake GNSS (civil GPS is unauthenticated — anyone with an
  SDR can fake it; research demos used BladeRF + GPS-SDR-SIM) to redirect/land/capture
  intact (intel value!). Ukraine's *Lima* spoofer: 20,500+ Shaheds disrupted, ~$68k/unit.
- **Counters**: CRPA antennas, INS backup (drifts ~2 km/100 km), terrain matching,
  mesh networking, autonomy/pixel-lock, and ultimately **fiber wire** (unjammable)
  or full autonomy. The duel never ends — which is why the brief demands
  *randomization against rote learning*.
- Implications for our sensor model (already aligned, keep): jammed EM → radar/rf
  degrade first; acoustic/EO unaffected; fiber/archetype ignores EM entirely;
  autonomous terminal phase ignores *all* degradation in final seconds.

## 9. Software you can actually get (open building blocks)

Military C2 suites (Lattice, Elysion, Saksham) are closed — but the entire drone
software world underneath is open, and judges love hearing these names:

- **ArduPilot** (GPLv3, 2009→, 1M+ vehicles): Copter/Plane/Rover/Sub firmwares,
  Mission Planner GCS, SITL simulator. The workhorse autopilot of research and
  industry; auditable C++.
- **PX4** (BSD-3, Linux Foundation/Dronecode): uORB pub-sub middleware, ROS 2/DDS
  bridge, `make px4_sitl` + Gazebo. The research-standard stack.
- **MAVLink** (LGPL): the lightweight telemetry/command protocol nearly everything
  speaks; QGroundControl (Qt, cross-platform GCS) implements it fully.
- **Betaflight/INAV** (GPL): FPV/racing and navigation firmwares — the DNA inside
  both hobby quads and weaponized FPVs (same PIDs, same OSD, same ELRS links).
- **GNU Radio + gps-sdr-sim**: the SDR toolchain behind every published
  jam/spoof experiment (research-grade understanding of *why* our EW model works).
- **OpenDroneID** (C++ lib): decodes Remote ID beacons — the real-world cousin of
  our simplified IFF flag.
- Gazebo / AirSim / ArduPilot SITL: full physics sims if we ever want a 3D view.
- Public datasets for ML-flavored work: DroneRF, UCSD RF drone set (cited in
  C-UAS fusion literature).

What this means for us: our sim-core could one day *speak MAVLink* (log tracks as
MAVLink ADSB_VEHICLE messages) or *ingest* SITL telemetry — a credible,
judge-friendly roadmap line that costs nothing today.

## 10. Autonomy trend (where this all points)

- Terminal autonomy (pixel-lock) already fielded both sides in Ukraine.
- US CCA program: 1,000 loyal-wingman drones planned; YFQ-42A/YFQ-44A flying 2025;
  autonomy vendors RTX + Shield AI; Australia's MQ-28 Ghost Bat scored an air-to-air
  kill (AIM-120, Dec 2025). US Navy + Marines + Army following.
- Ukraine's Group-13 commander: "target search is part operator, part AI; in future
  the drone launches and decides" — civilian/military discrimination by AI is the
  stated next step (and the ethical tripwire — our trainer's classification-first
  design is the *human* answer to that problem; say so on stage).
- Swarm coordination at scale (2,500-drone show heritage → Swarm Stage AI training
  product) shows where saturation tactics come from — our saturation/leader-follower
  behaviors are the honest low-fi version.

## 11. What this changes for AVLON DRISHTI (concrete, in-scope upgrades)

Already aligned — keep: confidence-ranked fusion, ROE gates, replay/AAR, bird
confusion, night+degraded emphasis, cost-free abstract effectors.
Implemented (all real-tactic-backed):
1. **Fiber-optic archetype** (`fiber_optic` kind): radar ignores EM degradation,
   RF nearly silent (weak video-link leakage only), slow, low — teaches "EW is not
   an answer to everything; keep visual scan + kinetic option."
2. **Shahed-like night wave** (scenario 09): fast strike pair + recon spotter at
   range, night; rewards pairing RF + acoustic + thermal.
3. **Spotter–striker pairing**: recon loiters at range while strike element runs
   in — directly from Karabakh + Shahed doctrine (scenario composition).
Remaining ideas (briefing footnotes partially done in 09/10 descriptions):
4. **Mobile asset defense** (convoy already exists; add "move the asset" drill?).
5. **Briefing flavor**: one-line real-world footnotes ("as in Op Sindoor, legacy
   guns proved cost-effective vs slow drones") — credibility without claiming
   real specs.
6. **Pitch vocabulary**: "decision intelligence layer", "cost-exchange",
   "audit log", "proportional response", "Ashni-ready".

## 12. Sources (open)

- CSIS analyses (Bondar/Bendett 2025; Shahed→Geran evolution 2026) · Forbes/D. Hambling
  (Magyar stats, fiber summer) · Kyiv Independent (fiber race) · RBC-Ukraine (fiber
  models) · Tochnyi.info (2,517 FPV interceptions dataset) · ISW force-gen updates
- CSIS Missile Threat (Shahed-131/136) · Wikipedia (Shahed-136, Sea Baby) ·
  CMU Policy Review (naval drones history) · AP (Magura/Sea Baby)
- PIB release PRID-2128746 + Tribune/Statesman/Week (Op Sindoor, Ashni, Saksham,
  D4, CDS speeches) · MoD Annual Report 2025-26 summaries
- Dedrone C-UAS guides · Bard CSD counter-drone report · US Army ATP 3-01.81
  (C-sUAS doctrine) · R&S ARDRONIS · ST Engineering AGIL brochure ·
  HENSOLDT Elysion brochure · Anduril CUAS page · drone-warfare.com EW cost tables
- PMC/NIH SDR anti-UAV + GPS-spoofing reviews · USENIX Security '22 (Sathaye UAV
  takeover) · ResearchGate SDR jamming/spoofing study
- ArduPilot/PX4/MAVLink/QGroundControl official docs+GitHub · GNU Radio project
- Breaking Defense + CRS IF12740 (CCA) · USNI Proceedings (loyal-wingman critique) ·
  Defense Post (Horizon Guardian Ukraine trainer, USSOCOM vision trainer)

*All figures are open-source estimates and vary by source; the trainer deliberately
uses gameplay parameters, never these numbers, as real specifications.*
