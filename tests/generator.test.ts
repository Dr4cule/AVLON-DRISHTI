import { describe, expect, it } from 'vitest';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { generateScenario, fingerprint } from '../sim-core/generator';
import { runBaseline } from '../sim-core/baseline';
import { assertScenario } from '../sim-core/validation';

describe('scenario curriculum, fairness and variety', () => {
  it('ships ten valid, feasible scripted exercises', () => {
    expect(SCRIPTED_SCENARIOS).toHaveLength(10);
    for (const scenario of SCRIPTED_SCENARIOS) {
      assertScenario(scenario);
      const { report } = runBaseline(scenario);
      expect(report.passed, `${scenario.id}: ${JSON.stringify(report)}`).toBe(true);
    }
  });
  it('generates valid, solvable exercises across seeds and all difficulties', () => {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      for (let seed = 10; seed < 20; seed++) {
        const generated = generateScenario({ seed, difficulty });
        assertScenario(generated.scenario);
        expect(generated.baseline.passed).toBe(true);
        expect(generated.baseline.asset_health).toBeGreaterThanOrEqual(80);
      }
    }
  });
  it('is reproducible given the same full generation input', () => {
    const options = { seed: 777, difficulty: 3, focus: 'night' as const };
    expect(generateScenario(options)).toEqual(generateScenario(options));
  });
  it('avoids repeating a recent fingerprint even if the requested seed repeats', () => {
    const first = generateScenario({ seed: 731, difficulty: 3 });
    const next = generateScenario({ seed: 731, difficulty: 3, recent_fingerprints: [first.fingerprint] });
    expect(next.fingerprint).not.toBe(first.fingerprint);
    expect(fingerprint({ ...first.scenario, seed: 999, title: 'Renamed' })).toBe(first.fingerprint);
  });
  it('respects constraints and rejects invalid generator inputs', () => {
    const { scenario } = generateScenario({ seed: 321, difficulty: 2, focus: 'night', constraints: { terrain: 'urban' } });
    expect(scenario.environment.time_of_day).toBe('night');
    expect(scenario.environment.terrain).toBe('urban');
    expect(() => generateScenario({ seed: -1, difficulty: 2 })).toThrow();
    expect(() => generateScenario({ seed: 12, difficulty: 8 })).toThrow();
  });
});
