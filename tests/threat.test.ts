import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heuristicPredict, splitRows, stressCategory, type Row } from '../sim-core/threat/train';
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
  it('produces 14 finite features in [0,1]-ish range from trainee-visible data only', () => {
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
  it('places every sample in exactly one stress category', () => {
    const { sim } = liveTrack(160);
    void sim;
    const base: Row = {
      x: new Array(FEATURE_NAMES.length).fill(0.5), y: 0, s: 'x', ageSec: 30,
      fresh: 3, terrain: 'rural', tod: 'day', weather: 'clear', em: 'clean',
      difficulty: 2, distractorsTag: 0,
    };
    expect(stressCategory(base)).toBe('NORMAL');
    expect(stressCategory({ ...base, tod: 'night' })).toBe('NIGHT');
    expect(stressCategory({ ...base, em: 'jammed' })).toBe('DEGRADED SENSORS');
    expect(stressCategory({ ...base, x: base.x.map((v, i) => (i === 10 ? 0.1 : v)) })).toBe('HIGH SENSOR CONFLICT');
    expect(stressCategory({ ...base, distractorsTag: 4 })).toBe('HIGH AMBIGUITY');
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
  it('retrains deterministically from seed (weights identical across runs)', () => {
    // NOTE: file bytes are compared, not getWeights() — the bundled weights are
    // statically imported, so in-process reads cannot observe file rewrites.
    const committed = readFileSync('sim-core/threat/weights.json', 'utf8');
    execSync('npx tsx sim-core/threat/train.ts --scenarios 40 --epochs 20', { stdio: 'pipe' });
    const small = readFileSync('sim-core/threat/weights.json', 'utf8');
    expect(small).not.toBe(committed);
    // Same small config twice → identical bytes on disk.
    execSync('npx tsx sim-core/threat/train.ts --scenarios 40 --epochs 20', { stdio: 'pipe' });
    expect(readFileSync('sim-core/threat/weights.json', 'utf8')).toBe(small);
    // Restore the committed weights with the committed config → identical bytes.
    execSync('npx tsx sim-core/threat/train.ts', { stdio: 'pipe' });
    expect(readFileSync('sim-core/threat/weights.json', 'utf8')).toBe(committed);
    setWeightsForTests(null);
  }, 240000);
});
