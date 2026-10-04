import { describe, expect, it } from 'vitest';
import { DIMENSIONS } from '../sim-core/types';
import { calibrateDifficulty, emptySkills, profileFromSessions, recommendNext, updateSkills, weaknessRecommendations } from '../sim-core/adaptive';
import type { AdaptiveProfile } from '../sim-core/adaptive';
import { runBaseline } from '../sim-core/baseline';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { scoreSimulation } from '../sim-core/scoring';
import { replay } from '../sim-core/engine';

function fakeSession(id: string, scenarioIdx: number, total: number, provisional = false, synthetic = false) {
  const scenario = SCRIPTED_SCENARIOS[scenarioIdx];
  const { simulation } = runBaseline(scenario);
  const report = { ...scoreSimulation(simulation), total, provisional };
  return { id, user_id: 'operator', scenario, mode: 'training' as const, started_at: `2026-09-${10 + Number(id.slice(-1))}T10:00:00.000Z`, ended_at: '2026-09-11T10:00:00.000Z', end_tick: 100, actions: [], report, engine_version: '1.0.0', synthetic };
}

describe('adaptive skill model', () => {
  it('starts uncertain at 50% and reduces uncertainty with sessions', () => {
    const s = emptySkills();
    expect(s.night.mean).toBe(0.5);
    const u0 = s.night.uncertainty;
    const updated = updateSkills(s, fakeSession('s1', 0, 90) as any);
    expect(updated.night.uncertainty).toBeLessThan(u0);
    expect(updated.night.mean).toBeGreaterThan(0.5);
  });
  it('lowers weakest dimension after failures on tagged scenarios', () => {
    let skills = emptySkills();
    // nightfall (idx 6) is heavily night/swarm tagged; fail it twice
    skills = updateSkills(skills, fakeSession('s1', 6, 30) as any);
    skills = updateSkills(skills, fakeSession('s2', 6, 30) as any);
    const profile = profileFromSessions('operator', [fakeSession('s1', 6, 30) as any, fakeSession('s2', 6, 30) as any]);
    expect(['night', 'swarm', 'degraded_sensors'].includes(profile.weakest)).toBe(true);
    expect(profile.cold_start).toBe(false);
  });
  it('targets weakest skill with deterministic difficulty', () => {
    const profile = profileFromSessions('operator', [fakeSession('s1', 6, 30) as any, fakeSession('s2', 6, 30) as any]);
    const cal = calibrateDifficulty([fakeSession('s1', 0, 90) as any]);
    const r1 = recommendNext(profile, cal, []);
    const r2 = recommendNext(profile, cal, []);
    expect(r1).toEqual(r2);
    expect(r1.difficulty).toBeGreaterThanOrEqual(1);
    expect(r1.difficulty).toBeLessThanOrEqual(5);
    expect(r1.focus).toBe(profile.weakest);
  });
  it('flags cold start and gives recommendations', () => {
    const cold = profileFromSessions('operator', []);
    expect(cold.cold_start).toBe(true);
    expect(weaknessRecommendations(cold).length).toBeGreaterThan(0);
    for (const d of DIMENSIONS) expect(cold.skills[d]).toBeDefined();
  });
  it('calibration buckets real sessions only', () => {
    const cal = calibrateDifficulty([fakeSession('s1', 0, 90) as any, fakeSession('s2', 0, 20, false, true) as any]);
    expect(cal[1].attempts).toBe(1);
    expect(replay).toBeDefined();
  });
  it('maps skill across the full difficulty range', () => {
    const cal: Record<number, { success_rate: number | null }> = { 1: { success_rate: null }, 2: { success_rate: null }, 3: { success_rate: null }, 4: { success_rate: null }, 5: { success_rate: null } };
    const at = (mean: number): AdaptiveProfile => {
      const skills = emptySkills();
      for (const d of DIMENSIONS) skills[d] = { ...skills[d], mean };
      return { user_id: 'operator', skills, weakest: 'night', cold_start: false };
    };
    expect(recommendNext(at(0.05), cal, []).difficulty).toBe(1);
    expect(recommendNext(at(0.5), cal, []).difficulty).toBe(3);
    expect(recommendNext(at(0.95), cal, []).difficulty).toBe(5);
  });
});
