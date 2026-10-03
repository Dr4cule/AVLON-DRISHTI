# AVLON DRISHTI — What Are We Solving? (Plain-English Explanation)

> Written for someone who knows nothing about this project.

## The short version

Think of it like a **flight simulator, but for the person who defends against drones instead of flying one**.

## The real-world problem

Cheap drones — the kind anyone can buy, plus military-grade ones — have become a major battlefield threat. They can spy, attack alone, or swarm in groups. Soldiers need to learn how to deal with them.

But today's training is:

- **Classroom slides** — you memorize, you don't practice decisions.
- **Rare live drills** — expensive, need good weather, and you only get a few tries.

So troops don't get enough repetitions making hard calls under pressure.

## What we're building

**AVLON DRISHTI** ("Drishti" means "sight / perspective"; AVLON is our team name) — a laptop program that puts you in the seat of an air-defence operator and lets you practice unlimited times, offline, with zero special hardware.

### One training round, step by step

1. **You see a confusing radar picture.** Blips appear — but the sensors are imperfect, like real life. Fog, night, jamming, and buildings make readings noisy. A blip could be an enemy drone, a friendly drone, a flock of birds, a balloon, or just sensor garbage. The game never tells you which.
2. **You decide.** First you acknowledge the blip ("I see it"), then you classify it ("I think it's hostile / friendly / benign — or unknown if the evidence isn't there") plus the contact type, then you choose a response (observe, warn, electronic effect, redirect, capture, intercept, or escalate) and say *why*.
3. **You get judged fairly.** The simulator secretly knows the truth. It scores you on: how fast you noticed, whether you identified correctly, whether your response fit the rules, and whether the thing you protect survived. Every mistake comes with a timestamp and explanation ("at 01:12 you called a bird flock hostile").
4. **You replay the truth.** A review screen lets you scrub a timeline and flip between *what you saw* and *what was really there* at the same second. That's the "aha" moment.
5. **It adapts to you.** Across 10 scripted exercises (plus unlimited generated ones), if you keep messing up night scenarios, it notices and generates your next exercise focused on night. Same if swarms or rule-following are your weakness.
6. **Instructors get tools.** They can build custom scenarios with a visual editor, assign them to a unit, and see unit-level trends — who's improving, what mistakes are common.

## Who it's for

- **Trainee** — plays exercises, reviews mistakes.
- **Instructor** — creates / assigns exercises, reviews the unit.
- It was specified for the Ministry of Defence / Defence Services Staff College as a Smart India Hackathon problem (PS 26247).

## The key ideas that make it special

- **Uncertainty is the lesson.** High sensor confidence does not equal permission to act. The training is about judgment under doubt, not reflexes.
- **Every run is different but replayable.** Scenarios generate from a seed number — same seed + same decisions = identical replay for debrief. No memorizing answers.
- **Rules matter.** Each exercise has rules of engagement (e.g. "warn before acting", "no intercept here"). Breaking them costs you even if the action "worked".
- **Honest and offline.** Everything runs on your laptop — no internet, no cloud. All maps and effects are fictional gameplay models, not real weapon specs.

## In one sentence

**We're giving soldiers unlimited, realistic-enough practice at the hardest part — deciding what something is and what to do about it — with instant, explainable feedback.**

## What makes our project unique

Lots of drone simulators already exist — but almost all of them train the **wrong skill for this problem statement**. Pilot trainers (SRIZFLY, DronoSim, TARKUS) teach *flying the drone*. Intercept simulators (open-source Kalman-filter / proportional-navigation projects, RL swarm research) teach *an algorithm how to hit a drone*. Commercial counter-UAS trainers (Agincourt YEOMAN, ST Engineering AGIL, the US Army's VDCT) come closest, but they are proprietary, hardware-tied, shooter-focused systems you can't download or inspect.

Nothing public combines the **exact four things SIH 26247 demands** in one student-built, offline, laptop-runnable package. Our differentiators:

1. **We train judgment, not reflexes.** The core skill is telling a hostile drone from a bird flock, a friendly UAV, or sensor garbage — under noisy, degraded sensors — and then justifying the response under rules of engagement. No open-source project does this; commercial ones focus on aiming and shooting.
2. **Decision-tree scoring with receipts.** Every contact gets an 8-node trace (detected → classified → correct → appropriate → ROE-compliant → timely → effective → reasoned), every mistake gets a timestamp plus a plain-English explanation, and every score is recomputed server-side from an immutable event log — never trusted from the client.
3. **Sensor-view vs ground-truth replay.** Scrub to any tick and flip between *what the trainee saw* and *what was really there*. That "aha" moment is the product's heart, and nobody else packages it this way.
4. **Deterministic and replayable.** Same seed + same decisions = byte-identical event log (tested). Instructors can re-litigate any decision exactly. Most sims can't promise that.
5. **Adaptive without black boxes.** A published Bayesian skill model targets your weakest dimension at ~68% success. No neural nets, no cloud, no unexplainable AI — a judge can read the formula.
6. **Runs anywhere, owns nothing.** One laptop, no internet, no GPU, no special hardware, SQLite file DB, portable bundle. Built exactly to the statement's "unit level with minimal specialized hardware" line.

## How to try it yourself

1. In `C:\Bedrock\Work\Drone`, run `npm run build` once, then `npm start` (or just open the offline bundle at `release/AVLON-DRISHTI`).
2. Open `http://127.0.0.1:3001` in your browser.
3. Log in as `operator` / `drishti-demo`.
4. Press **Start exercise**, click a radar blip, acknowledge it (A), classify it (1–4), pick a response + reason, and hit **Record response**.
5. Press **End & debrief** to see your score, replay the truth, and get a recommended next exercise.
