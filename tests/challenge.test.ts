import { describe, expect, it } from 'vitest';
import { replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { scoreSimulation } from '../sim-core/scoring';
import { generateScenario } from '../sim-core/generator';
import { DIMENSIONS, ENGINE_VERSION, type SessionRecord } from '../sim-core/types';
import {
  adversaryTactics,
  challengeFromWeakness,
  challengeToOptions,
  detectPatterns,
} from '../sim-core/threat/challenge';

const nightfall = SCRIPTED_SCENARIOS[6];

function mistakeSession(id: string, started: string): SessionRecord {
  const actions: SessionRecord['actions'] = [
    { tick: 80, actor_id: 'C2', type: 'acknowledge' },
    { tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' },
  ];
  const sim = replay(nightfall, actions, nightfall.duration_s * 4);
  return {
    id, user_id: 'operator', scenario: nightfall, mode: 'training',
    started_at: started, ended_at: started, end_tick: sim.state.tick,
    actions: [...actions], report: scoreSimulation(sim),
    engine_version: ENGINE_VERSION, synthetic: false,
  };
}

describe('adaptive pattern detection', () => {
  it('returns nothing with no history', () => {
    expect(detectPatterns('operator', [])).toEqual([]);
  });
  it('names degraded-sensor and night error patterns from recorded history', () => {
    const history = [mistakeSession('s1', '2026-09-20T10:00:00.000Z'), mistakeSession('s2', '2026-09-21T10:00:00.000Z')];
    const patterns = detectPatterns('operator', history);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.toLowerCase().includes('degraded'))).toBe(true);
    // Only the operator's own real sessions count.
    expect(detectPatterns('someone-else', history)).toEqual([]);
  });
});

describe('challenge profiles', () => {
  it('maps every weakness dimension to a sane, documented profile', () => {
    for (const dim of DIMENSIONS) {
      const challenge = challengeFromWeakness(dim);
      expect(challenge).toBeTruthy();
    }
    expect(challengeFromWeakness('night').night).toBe(true);
    expect(challengeFromWeakness('degraded_sensors').irDegradation).toBe('high');
    expect(challengeFromWeakness('degraded_sensors').sensorConflict).toBe('high');
    expect(challengeFromWeakness('distractors').ambiguity).toBe('high');
    expect(challengeFromWeakness('swarm').contactLoad).toBe('high');
    expect(challengeFromWeakness('urban').terrain).toBe('urban');
  });
  it('compiles every profile to a valid, fair, generatable scenario', () => {
    for (const dim of DIMENSIONS) {
      const challenge = challengeFromWeakness(dim);
      const options = challengeToOptions(challenge, { seed: 4242, difficulty: 3, focus: dim, recent_fingerprints: [] });
      const generated = generateScenario({ ...options, behaviorBias: adversaryTactics(dim).map(t => t.behavior) });
      expect(generated.baseline.passed).toBe(true);
      expect(generated.fingerprint).toBeTruthy();
    }
  });
  it('is deterministic for identical inputs', () => {
    const a = challengeToOptions(challengeFromWeakness('swarm'), { seed: 7, difficulty: 4, focus: 'swarm' });
    const b = challengeToOptions(challengeFromWeakness('swarm'), { seed: 7, difficulty: 4, focus: 'swarm' });
    expect(a).toEqual(b);
  });
});

describe('adversarial behavior selection', () => {
  it('covers every weakness with documented abstract tactics', () => {
    for (const dim of DIMENSIONS) {
      const tactics = adversaryTactics(dim);
      expect(tactics.length).toBeGreaterThan(0);
      for (const t of tactics) expect(t.rationale.length).toBeGreaterThan(10);
    }
  });
  it('biases generated swarm behavior toward the selected tactic', () => {
    const generated = generateScenario({
      seed: 4242, difficulty: 4, focus: 'swarm',
      difficulty_profile: { swarm: 5 },
      behaviorBias: ['saturation'],
    });
    const swarm = generated.scenario.actors.find(a => a.kind === 'swarm');
    expect(swarm?.behavior).toBe('saturation');
    expect(generated.baseline.passed).toBe(true);
  });
  it('rejects unknown behaviors instead of silently ignoring them', () => {
    expect(() => generateScenario({ seed: 1, difficulty: 2, behaviorBias: [] })).toThrow();
    expect(() => generateScenario({ seed: 1, difficulty: 2, behaviorBias: ['dogfight' as never] })).toThrow();
  });
});
