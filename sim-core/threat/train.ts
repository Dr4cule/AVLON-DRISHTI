/**
 * Dev-only training script for the advisory threat-assessment model.
 *
 * Pipeline (all deterministic, all offline):
 *   scenarios (scripted + generated) → headless sims → track snapshots
 *   → features + ground-truth labels → seeded softmax training
 *   → weights.json + metrics report.
 *
 * The raw dataset is NEVER written to disk — it exists only in memory during
 * this run and can be regenerated bit-identically with the same seed.
 * Committed artifacts: this script, its config, weights.json, and the report.
 *
 * Usage: npx tsx sim-core/threat/train.ts [--scenarios 220] [--seed 482913] [--epochs 300]
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Random } from '../prng.js';
import { Simulation } from '../engine.js';
import { generateScenario } from '../generator.js';
import { SCRIPTED_SCENARIOS } from '../catalog.js';
import { DIMENSIONS, type Dimension } from '../types.js';
import { extractFeatures, labelFor, FEATURE_NAMES, THREAT_CLASSES } from './features.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED = Number(process.argv.find((a, i) => process.argv[i - 1] === '--seed') ?? 482913);
const N_GEN = Number(process.argv.find((a, i) => process.argv[i - 1] === '--scenarios') ?? 220);
const EPOCHS = Number(process.argv.find((a, i) => process.argv[i - 1] === '--epochs') ?? 400);
// Snapshot ages in seconds — captures each track from "ambiguous" to "established".
const SNAPSHOT_AGES = [1, 3, 4, 6, 10, 20, 35, 60, 90, 150];
const MAX_TICKS = 720;

interface Row {
  x: number[];
  y: number;
}

function buildPool() {
  const pool = [...SCRIPTED_SCENARIOS];
  let skipped = 0;
  for (let i = 0; i < N_GEN; i++) {
    const difficulty = 1 + (i % 5);
    const focus: Dimension | undefined = i % 8 === 7 ? undefined : DIMENSIONS[i % DIMENSIONS.length];
    try {
      const { scenario } = generateScenario({ seed: (SEED + i * 7919) >>> 0, difficulty, focus });
      pool.push(scenario);
    } catch {
      skipped++;
    }
  }
  return { pool, skipped };
}

function collectRows(): { rows: Row[]; scenarios: number } {
  const { pool, skipped } = buildPool();
  const rows: Row[] = [];
  const thresholds = SNAPSHOT_AGES.map(s => s * 4);
  for (const scenario of pool) {
    const sim = new Simulation(structuredClone(scenario));
    const recorded = new Map<string, number>();
    const maxTick = Math.min(scenario.duration_s * 4, MAX_TICKS);
    for (let tick = 0; tick <= maxTick; tick++) {
      if (tick > 0) sim.step();
      for (const track of Object.values(sim.state.tracks)) {
        if (track.resolved) continue;
        const done = recorded.get(track.id) ?? 0;
        if (done >= thresholds.length) continue;
        const ageTicks = tick - track.first_seen;
        if (ageTicks < thresholds[done]) continue;
        const entity = sim.state.entities.find(e => e.id === track.id);
        if (!entity || entity.status === 'pending') continue;
        const freshCount = scenario.sensors.filter(s => {
          const r = track.sensors[s];
          return r !== undefined && tick - r.tick <= 12;
        }).length;
        const x = extractFeatures(track, scenario, tick);
        const label = labelFor(entity, ageTicks / 4, freshCount);
        rows.push({ x, y: THREAT_CLASSES.indexOf(label) });
        recorded.set(track.id, done + 1);
      }
      if (sim.state.ended) break;
    }
  }
  if (skipped > 0) console.log(`skipped ${skipped} infeasible generator draws`);
  return { rows, scenarios: pool.length };
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / total);
}

function train(rows: Row[]) {
  const C = THREAT_CLASSES.length;
  const D = FEATURE_NAMES.length;
  const rng = new Random(SEED ^ 0x9e3779b9);
  const W: number[][] = Array.from({ length: C }, () =>
    Array.from({ length: D }, () => (rng.next() - 0.5) * 0.02),
  );
  const b = new Array<number>(C).fill(0);
  // Inverse-frequency class weights so rare classes (e.g. clutter) still matter,
  // capped so a tiny class cannot drag the whole boundary toward itself.
  const counts = new Array<number>(C).fill(0);
  for (const r of rows) counts[r.y]++;
  const classW = counts.map(c => Math.min(6, rows.length / C / Math.max(1, c)));
  const lr = 1.0;
  const l2 = 1e-4;
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const gW = W.map(row => row.map(() => 0));
    const gb = new Array<number>(C).fill(0);
    for (const r of rows) {
      const logits = W.map((row, c) => b[c] + row.reduce((s, w, i) => s + w * r.x[i], 0));
      const probs = softmax(logits);
      const w = classW[r.y];
      for (let c = 0; c < C; c++) {
        const err = (probs[c] - (c === r.y ? 1 : 0)) * w;
        gb[c] += err;
        for (let i = 0; i < D; i++) gW[c][i] += err * r.x[i];
      }
    }
    const step = lr / (1 + epoch / 100);
    for (let c = 0; c < C; c++) {
      b[c] -= (step * gb[c]) / rows.length;
      for (let i = 0; i < D; i++) {
        W[c][i] -= (step * gW[c][i]) / rows.length + step * l2 * W[c][i];
      }
    }
  }
  return { W, b };
}

function evaluate(rows: Row[], W: number[][], b: number[]) {
  const C = THREAT_CLASSES.length;
  const confusion = Array.from({ length: C }, () => new Array<number>(C).fill(0));
  let correct = 0;
  for (const r of rows) {
    const logits = W.map((row, c) => b[c] + row.reduce((s, w, i) => s + w * r.x[i], 0));
    let best = 0;
    for (let c = 1; c < C; c++) if (logits[c] > logits[best]) best = c;
    confusion[r.y][best]++;
    if (best === r.y) correct++;
  }
  const perClass = THREAT_CLASSES.map((name, c) => {
    const tp = confusion[c][c];
    const predicted = confusion.reduce((s, row) => s + row[c], 0);
    const actual = confusion[c].reduce((s, v) => s + v, 0);
    return {
      name,
      samples: actual,
      precision: predicted === 0 ? 0 : Math.round((tp / predicted) * 1000) / 1000,
      recall: actual === 0 ? 0 : Math.round((tp / actual) * 1000) / 1000,
    };
  });
  return { accuracy: Math.round((correct / Math.max(1, rows.length)) * 10000) / 10000, perClass, confusion, n: rows.length };
}

function main() {
  const t0 = Date.now();
  const { rows, scenarios } = collectRows();
  // Deterministic 80/20 split: every 5th row validates.
  const trainRows = rows.filter((_, i) => i % 5 !== 4);
  const valRows = rows.filter((_, i) => i % 5 === 4);
  const genMs = Date.now() - t0;
  const { W, b } = train(trainRows);
  const trainMetrics = evaluate(trainRows, W, b);
  const valMetrics = evaluate(valRows, W, b);

  const outDir = join(ROOT, 'sim-core', 'threat');
  const weights = {
    version: 1,
    classes: [...THREAT_CLASSES],
    features: [...FEATURE_NAMES],
    weights: W.map(row => row.map(v => Math.round(v * 1e6) / 1e6)),
    bias: b.map(v => Math.round(v * 1e6) / 1e6),
    meta: { seed: SEED, scenarios, samples: rows.length, trainAccuracy: trainMetrics.accuracy, valAccuracy: valMetrics.accuracy, epochs: EPOCHS },
  };
  writeFileSync(join(outDir, 'weights.json'), JSON.stringify(weights, null, 2) + '\n');

  const confusionMd = ['| truth \\ predicted | ' + THREAT_CLASSES.join(' | ') + ' |']
    .concat(['| --- | ' + THREAT_CLASSES.map(() => '---:').join(' | ') + ' |'])
    .concat(valMetrics.confusion.map((row, i) => `| ${THREAT_CLASSES[i]} | ` + row.join(' | ') + ' |'))
    .join('\n');
  const perClassMd = valMetrics.perClass.map(p => `- **${p.name}**: n=${p.samples}, precision=${p.precision}, recall=${p.recall}`).join('\n');
  const report = `# AI Threat-Assessment Model — Training Report

_Regenerated deterministically: \`npx tsx sim-core/threat/train.ts --seed ${SEED} --scenarios ${N_GEN} --epochs ${EPOCHS}\`.
The raw dataset is never written to disk; rerunning the command reproduces these exact numbers._

- Model: multinomial logistic regression (softmax), ${FEATURE_NAMES.length} features → ${THREAT_CLASSES.length} classes, pure TypeScript, no dependencies.
- Data: ${rows.length} labeled track snapshots from ${scenarios} headless simulations (10 scripted + ${N_GEN} generated draws), snapshot ages ${SNAPSHOT_AGES.join('/') + 's'}, deterministic 80/20 split.
- Labels: ground-truth allegiance/kind, except tracks younger than 6 s or with fewer than 2 fresh sensor readings are labeled \`unknown_uav\` (insufficient evidence must mean "unknown").
- Training: seeded full-batch gradient descent, lr 1.0 with 1/(1+epoch/100) decay, L2 1e-4, inverse-frequency class weights, ${EPOCHS} epochs.
- Dataset generation took ${(genMs / 1000).toFixed(1)} s on a laptop CPU.

## Metrics (held-out validation, n=${valMetrics.n})

- Overall accuracy: **${valMetrics.accuracy}** (train: ${trainMetrics.accuracy})
${perClassMd}

## Confusion matrix (validation)

${confusionMd}

## Interpretation for judges

- Accuracy is measured on *our own synthetic sensor model* — it proves the model learned the simulator's evidence patterns, not real-world sensing.
- The \`unknown_uav\` class is the point: the model is trained to say "unknown" when evidence is thin, which is exactly the trainee behavior we want to teach.
- Known-hard cases mirror real radar problems: \`bird\` vs \`balloon\` (both slow non-emitters) and \`clutter\` precision (small, slow, radar-only returns are the same returns that challenge real bird/clutter filters). These are documented, not hidden.
- Inference is a few dot products (<1 ms); weights file is a few KB; results are bit-identical for identical inputs.

## Limitations (must be stated on stage)

- Sensor models are fictional gameplay abstractions; the model cannot transfer to real sensors.
- Predictions are advisory only and never enter scoring, ROE, or replay.
- Performance degrades outside the training distribution by construction — same as any ML model.
`;
  writeFileSync(join(ROOT, 'docs', 'AI_THREAT_REPORT.md'), report);
  console.log(`scenarios=${scenarios} samples=${rows.length} train=${trainMetrics.accuracy} val=${valMetrics.accuracy} (${(genMs / 1000).toFixed(1)}s gen)`);
  console.log('wrote sim-core/threat/weights.json + docs/AI_THREAT_REPORT.md');
}

main();
