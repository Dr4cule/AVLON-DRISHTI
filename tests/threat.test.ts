import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitTemperature, heuristicPredict, majorityBaseline, selectCandidateModel, selectWinner, splitRows, stressSubsets, type LinearModel, type Row } from '../sim-core/threat/train';
import { Simulation, replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { extractFeatures, FEATURE_NAMES, labelFor, THREAT_CLASSES } from '../sim-core/threat/features';
import { getWeights, predict, setWeightsForTests, uncertaintyBand } from '../sim-core/threat/model';
import type { Track } from '../sim-core/types';

const scenario = SCRIPTED_SCENARIOS[6]; // nightfall: hostiles + benign + friendly

function liveTrack(ticks: number): { sim: Simulation; track: Track; entityId: string } {
  const sim = replay(scenario, [], ticks, false);
  const track = Object.values(sim.state.tracks).find(t => !t.resolved) ?? Object.values(sim.state.tracks)[0];
  return { sim, track, entityId: track.id };
}

describe('threat feature extraction', () => {
  it('produces 15 finite features in [0,1]-ish range from trainee-visible data only', () => {
    const { sim, track } = liveTrack(120);
    const x = extractFeatures(track, scenario, sim.state.tick);
    expect(x).toHaveLength(FEATURE_NAMES.length);
    expect(x.every(v => Number.isFinite(v))).toBe(true);
    expect(x.every(v => v >= 0 && v <= 1)).toBe(true);
  });
  it('is deterministic for the same track and tick', () => {
    const a = liveTrack(120);
    const b = liveTrack(120);
    expect(extractFeatures(a.track, scenario, a.sim.state.tick)).toEqual(
      extractFeatures(b.track, scenario, b.sim.state.tick),
    );
  });
  it('labels young or evidence-poor tracks unknown regardless of truth', () => {
    const entity = { allegiance: 'hostile', kind: 'quadcopter' } as never;
    expect(labelFor(entity, 2, 4)).toBe('unknown_uav');
    expect(labelFor(entity, 30, 1)).toBe('unknown_uav');
    expect(labelFor(entity, 30, 3)).toBe('hostile_like_uav');
  });
  it('labels radar-only clutter by kind once established', () => {
    const clutter = { allegiance: 'benign', kind: 'clutter' } as never;
    expect(labelFor(clutter, 2, 1)).toBe('unknown_uav');
    expect(labelFor(clutter, 30, 1)).toBe('clutter');
  });
});

describe('threat softmax model', () => {
  it('loads the bundled weights table and validates its contract', () => {
    const table = getWeights();
    expect(table.version).toBe(1);
    expect(table.classes).toEqual([...THREAT_CLASSES]);
    expect(table.features).toEqual([...FEATURE_NAMES]);
  });
  it('returns normalized probabilities, a valid class, and exact evidence', () => {
    const { sim, track } = liveTrack(160);
    const x = extractFeatures(track, scenario, sim.state.tick);
    const assessment = predict(x);
    expect(THREAT_CLASSES).toContain(assessment.predictedClass);
    const total = (Object.values(assessment.probabilities) as number[]).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0.99);
    expect(total).toBeLessThanOrEqual(1.0001);
    expect(assessment.confidence).toBeGreaterThan(0);
    expect(assessment.confidence).toBeLessThanOrEqual(1);
    expect(assessment.uncertainty).toBeCloseTo(1 - assessment.confidence, 4);
    expect(Object.keys(assessment.evidence)).toHaveLength(FEATURE_NAMES.length);
    // Evidence is exact linear attribution: sum of contributions + bias = logit of winner.
    const table = getWeights();
    const winner = THREAT_CLASSES.indexOf(assessment.predictedClass);
    const fromEvidence =
      (Object.values(assessment.evidence) as number[]).reduce((a, b) => a + b, 0) + table.bias[winner];
    const direct = table.bias[winner] + table.weights[winner].reduce((s, w, i) => s + w * x[i], 0);
    expect(fromEvidence).toBeCloseTo(direct, 3);
  });
  it('is deterministic: identical features give identical assessments', () => {
    const { sim, track } = liveTrack(160);
    const x = extractFeatures(track, scenario, sim.state.tick);
    expect(predict(x)).toEqual(predict(x));
  });
  it('rejects malformed inputs instead of guessing', () => {
    expect(() => predict([0.5, 0.5])).toThrow();
    expect(() => predict(new Array(FEATURE_NAMES.length).fill(NaN))).toThrow();
  });
  it('rejects an incompatible weights table', () => {
    expect(() =>
      setWeightsForTests({ version: 999, classes: [], features: [], weights: [], bias: [] } as never),
    ).toThrow();
    setWeightsForTests(null); // restore bundled table
    expect(() => predict(new Array(FEATURE_NAMES.length).fill(0.5))).not.toThrow();
  });
  it('bands uncertainty into documented LOW/MEDIUM/HIGH ranges', () => {
    expect(uncertaintyBand(0.1)).toBe('LOW');
    expect(uncertaintyBand(0.4)).toBe('MEDIUM');
    expect(uncertaintyBand(0.9)).toBe('HIGH');
  });
  it('sharpens confidence with temperature < 1 and rejects bad temperatures', () => {
    const { sim, track } = liveTrack(160);
    const x = extractFeatures(track, scenario, sim.state.tick);
    const table = getWeights();
    const plain = predict(x, { ...table, temperature: 1 });
    const sharp = predict(x, { ...table, temperature: 0.5 });
    expect(sharp.confidence).toBeGreaterThanOrEqual(plain.confidence);
    expect(sharp.predictedClass).toBe(plain.predictedClass);
    for (const bad of [0, -1, 99, NaN]) {
      expect(() => setWeightsForTests({ ...table, temperature: bad })).toThrow();
    }
    setWeightsForTests(null);
  });
  it('splits scenarios with zero train/test overlap, deterministically', () => {
    const rows: Row[] = [];
    for (let s = 0; s < 30; s++) {
      for (let i = 0; i < 5; i++) {
        rows.push({
          x: new Array(FEATURE_NAMES.length).fill(0.1 * i), y: i % 6, s: `scn-${s}`,
          ageSec: 10, fresh: 3, terrain: 'rural', tod: 'day', weather: 'clear',
          em: 'clean', difficulty: 2, distractorsTag: 1,
        });
      }
    }
    const first = splitRows(rows);
    const second = splitRows(rows);
    expect(first).toEqual(second);
    const trainIds = new Set(first.train.map(r => r.s));
    const testIds = new Set(first.test.map(r => r.s));
    for (const id of testIds) expect(trainIds.has(id)).toBe(false);
    const calibIds = new Set(first.calib.map(r => r.s));
    for (const id of calibIds) {
      expect(trainIds.has(id)).toBe(false);
      expect(testIds.has(id)).toBe(false);
    }
    expect(first.train.length).toBeGreaterThan(first.calib.length);
    expect(first.test.length).toBeGreaterThan(0);
  });
  it('evaluates stress conditions independently with NORMAL as the complement', () => {
    const base: Row = {
      x: new Array(FEATURE_NAMES.length).fill(0.5), y: 0, s: 'x', ageSec: 30,
      fresh: 3, terrain: 'rural', tod: 'day', weather: 'clear', em: 'clean',
      difficulty: 2, distractorsTag: 0,
    };
    // A night + degraded + conflicting + ambiguous sample belongs to every
    // stress subset at once — it must not silently disappear from any of them.
    const brutal: Row = {
      ...base, tod: 'night', em: 'jammed', distractorsTag: 4,
      x: base.x.map((v, i) => (i === 10 ? 0.1 : v)),
    };
    const subs = new Map(stressSubsets([base, brutal]).map(s => [s.name, s.subset]));
    expect(subs.get('NORMAL')!.length).toBe(1);
    expect(subs.get('NIGHT')!.length).toBe(1);
    expect(subs.get('DEGRADED SENSORS')!.length).toBe(1);
    expect(subs.get('HIGH SENSOR CONFLICT')!.length).toBe(1);
    expect(subs.get('HIGH AMBIGUITY')!.length).toBe(1);
    expect(subs.get('NIGHT')![0]).toBe(brutal);
    // A clean sample is NORMAL and nothing else.
    for (const [name, subset] of subs) {
      if (name === 'NORMAL') continue;
      expect(subset.includes(base)).toBe(false);
    }
  });
  it('fits temperature deterministically, cooling overconfidence and leaving calm data near 1', () => {
    const model: LinearModel = { W: [[2, 0], [0, 2]], b: [0, 0] };
    const mkRow = (x: number[], y: number): Row => ({
      x, y, s: 'toy', ageSec: 30, fresh: 3, terrain: 'rural', tod: 'day',
      weather: 'clear', em: 'clean', difficulty: 2, distractorsTag: 0,
    });
    // Confidently wrong predictions should be cooled (T > 1 flattens them).
    const wrong = [mkRow([1, 0], 1), mkRow([0, 1], 0), mkRow([1, 0], 1), mkRow([0, 1], 0)];
    const cooled = fitTemperature(model, wrong);
    expect(cooled).toBeGreaterThan(1);
    expect(fitTemperature(model, wrong)).toBe(cooled);
    // Empty calibration data cannot move the temperature off the default.
    expect(fitTemperature(model, [])).toBe(1);
  });
  it('computes the majority baseline from training frequencies', () => {
    const mkRow = (y: number): Row => ({
      x: new Array(FEATURE_NAMES.length).fill(0.1), y, s: 'toy', ageSec: 30,
      fresh: 3, terrain: 'rural', tod: 'day', weather: 'clear', em: 'clean',
      difficulty: 2, distractorsTag: 0,
    });
    // Train is 3x class 0, 1x class 1 → majority predicts 0; test is half class 0.
    const train = [mkRow(0), mkRow(0), mkRow(0), mkRow(1)];
    const test = [mkRow(0), mkRow(1)];
    expect(majorityBaseline(train, test)).toEqual({ accuracy: 0.5, macroF1: expect.any(Number) });
  });
  it('heuristic baseline emits valid classes deterministically', () => {
    const zeros = new Array(FEATURE_NAMES.length).fill(0);
    expect(THREAT_CLASSES[heuristicPredict(zeros)]).toBeTruthy();
    const { sim, track } = liveTrack(160);
    const x = extractFeatures(track, scenario, sim.state.tick);
    expect(heuristicPredict(x)).toBe(heuristicPredict(x));
    expect(THREAT_CLASSES[heuristicPredict(x)]).toBeTruthy();
  });
  it('never reads ground truth inside feature extraction', () => {
    const source = readFileSync('sim-core/threat/features.ts', 'utf8');
    const extractor = source.slice(0, source.indexOf('export function labelFor'));
    expect(extractor).not.toMatch(/allegiance/);
    expect(extractor).not.toMatch(/entity\./);
    expect(extractor).not.toMatch(/\.kind/);
  });
  it('classifies most established hostile tracks as hostile-like', () => {
    // Distribution-level check matching the reported hostile recall (~0.69):
    // established = old enough to have left the unknown zone, with fresh evidence.
    let hostile = 0;
    let correct = 0;
    for (const index of [0, 6, 8]) {
      const scn = SCRIPTED_SCENARIOS[index];
      const sim = replay(scn, [], Math.min(400, scn.duration_s * 4), false);
      for (const track of Object.values(sim.state.tracks)) {
        const entity = sim.state.entities.find(e => e.id === track.id);
        if (entity?.allegiance !== 'hostile' || track.resolved) continue;
        const age = sim.state.tick - track.first_seen;
        const fresh = scn.sensors.filter(s => {
          const r = track.sensors[s];
          return r !== undefined && sim.state.tick - r.tick <= 12;
        }).length;
        if (age < 80 || fresh < 2) continue;
        hostile++;
        const assessment = predict(extractFeatures(track, scn, sim.state.tick));
        if (assessment.predictedClass === 'hostile_like_uav') correct++;
      }
    }
    expect(hostile).toBeGreaterThan(5);
    expect(correct / hostile).toBeGreaterThanOrEqual(0.6);
  });
});

describe('threat training pipeline', () => {
  it('selects the winner on calibration scores with a +0.02 bar', () => {
    expect(selectWinner(0.6, 0.619)).toBe(false);
    expect(selectWinner(0.6, 0.62)).toBe(true);
    expect(selectWinner(0.7, 0.5)).toBe(false);
  });
  it('seals selection from test data: same train+calib always selects the same model', () => {
    // selectCandidateModel takes (train, calib) only — arity guards against a
    // test input being snuck back into selection later.
    expect(selectCandidateModel.length).toBe(2);
    const mk = (y: number, s: string, shift: number): Row => ({
      x: Array.from({ length: 15 }, (_, i) => ((y * 7 + i * 13 + shift) % 100) / 100),
      y, s, ageSec: 10, fresh: 3, terrain: 'rural', tod: 'day',
      weather: 'clear', em: 'clean', difficulty: 2, distractorsTag: 1,
    });
    const train: Row[] = [], calib: Row[] = [];
    for (let c = 0; c < 6; c++) {
      for (let i = 0; i < 3; i++) train.push(mk(c, `t${c}`, i));
      for (let i = 0; i < 2; i++) calib.push(mk(c, `c${c}`, i + 40));
    }
    const first = selectCandidateModel(train, calib);
    expect(Number.isFinite(first.baseF1)).toBe(true);
    expect(Number.isFinite(first.richF1)).toBe(true);
    // Mutating hypothetical test labels changes nothing: selection never sees them.
    const testA = calib.map(r => ({ ...r, y: (r.y + 1) % 6 }));
    const testB = calib.map(r => ({ ...r, y: (r.y + 3) % 6 }));
    expect(testA).not.toEqual(testB);
    expect(selectCandidateModel(train, calib)).toEqual(first);
  });
  it('retrains deterministically from seed without touching committed artifacts', () => {
    // Training checks run into isolated output dirs: committed weights, metrics,
    // and report must be byte-identical before and after, even on failure.
    const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
    const before = ['sim-core/threat/weights.json', 'docs/AI_METRICS.json', 'docs/AI_THREAT_REPORT.md'].map(sha);
    const out = mkdtempSync(join(tmpdir(), 'drishti-train-'));
    try {
      for (const sub of ['sim-core/threat', 'docs']) mkdirSync(join(out, sub), { recursive: true });
      const run = () => execSync(`npx tsx sim-core/threat/train.ts --scenarios 40 --epochs 20 --out "${out}"`, { stdio: 'pipe' });
      run();
      const small = readFileSync(join(out, 'sim-core/threat/weights.json'), 'utf8');
      run();
      expect(readFileSync(join(out, 'sim-core/threat/weights.json'), 'utf8')).toBe(small);
      // The isolated small config must differ from production (proves it actually trained).
      expect(small).not.toBe(readFileSync('sim-core/threat/weights.json', 'utf8'));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(['sim-core/threat/weights.json', 'docs/AI_METRICS.json', 'docs/AI_THREAT_REPORT.md'].map(sha)).toEqual(before);
    setWeightsForTests(null);
  }, 240000);
});
