import { describe, expect, it } from 'vitest';
import { replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { runBaseline } from '../sim-core/baseline';
import { scoreSimulation } from '../sim-core/scoring';
import { assertReport } from '../sim-core/validation';
import type { Scenario } from '../sim-core/types';

const base = SCRIPTED_SCENARIOS[0];
describe('decision-tree scoring', () => {
  it('gives no-action sessions zero and marks early endings provisional', () => {
    const report = scoreSimulation(replay(base, [], 20));
    expect(report.total).toBe(0);
    expect(report.provisional).toBe(true);
    expect(report.mistakes.length).toBeGreaterThan(0);
    assertReport(report);
  });
  it('scores a delayed, compliant baseline highly with a visible per-actor path', () => {
    const { simulation } = runBaseline(base);
    const report = scoreSimulation(simulation);
    expect(report.total).toBeGreaterThanOrEqual(90);
    expect(report.actors).toHaveLength(2);
    expect(report.actors[0].nodes.map(n => n.name)).toContain('ROE compliant');
    expect(report.confusion_matrix[0][0]).toBe(1);
    expect(report.provisional).toBe(false);
    assertReport(report);
  });
  it('penalizes benign-as-hostile decisions and explains the exact timestamp', () => {
    const sim = replay(base, [], 80, false);
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'acknowledge' });
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' });
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'respond', response: 'electronic_jam', reason: 'protect_asset' });
    sim.finish();
    const report = scoreSimulation(sim);
    expect(report.confusion_matrix[2][0]).toBe(1);
    expect(report.mistakes.some(m => m.tick === 80 && m.severity === 'critical' && m.category === 'classification')).toBe(true);
    expect(report.actors.find(a => a.actor_id === 'C2')!.score).toBeLessThan(40);
  });
  it('retains a rule violation after a subsequent correct response', () => {
    const sim = replay(base, [], 40, false);
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'acknowledge' });
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'classify', classification: 'hostile', drone_type: 'recon' });
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'respond', response: 'kinetic_intercept', reason: 'protect_asset' });
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'respond', response: 'electronic_jam', reason: 'protect_asset' });
    sim.finish();
    const report = scoreSimulation(sim);
    expect(report.mistakes.some(m => m.category === 'roe')).toBe(true);
    expect(report.actors[0].nodes.find(n => n.name === 'ROE compliant')!.passed).toBe(false);
  });
  it('awards partial identity credit for correct allegiance and wrong type', () => {
    const one: Scenario = { ...base, actors: [base.actors[0]] };
    const sim = replay(one, [], 20, false);
    sim.dispatch({ tick: 20, actor_id: 'C1', type: 'classify', classification: 'hostile', drone_type: 'unknown' });
    sim.finish();
    expect(scoreSimulation(sim).metrics.classification).toBe(80);
  });
  it('does not punish a correctly blocked out-of-range attempt as a harmful shot', () => {
    const one: Scenario = { ...base, actors: [base.actors[1]] };
    const sim = replay(one, [], 80, false);
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'acknowledge' });
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' });
    // C2 sits near 1883 m: beyond net-capture reach (1500 m), so ROE passes and range blocks it.
    const res = sim.dispatch({ tick: 80, actor_id: 'C2', type: 'respond', response: 'net_capture', reason: 'protect_asset' });
    expect(res.accepted).toBe(false);
    sim.finish();
    const report = scoreSimulation(sim);
    // A shot that never happened must not trigger the harmful-attempt cap (20).
    expect(report.metrics.decision).toBeGreaterThan(20);
  });
  it('ignores classifications recorded after the first active response attempt', () => {
    const one: Scenario = { ...base, actors: [base.actors[1]] };
    const sim = replay(one, [], 80, false);
    // Jam attempt with no classification: ROE blocks it before any identity exists.
    const res = sim.dispatch({ tick: 80, actor_id: 'C2', type: 'respond', response: 'electronic_jam', reason: 'protect_asset' });
    expect(res.accepted).toBe(false);
    sim.dispatch({ tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' });
    sim.finish();
    const report = scoreSimulation(sim);
    // Post-attempt classification must not retroactively justify the attempt: still unknown.
    expect(report.confusion_matrix[2][3]).toBe(1);
  });
  it('is unaffected by mutations to the final world projection', () => {
    const sim = replay(base, [], 80);
    const before = scoreSimulation(sim);
    sim.state.asset_health.A1 = 0;
    sim.state.entities[0].allegiance = 'friendly';
    expect(scoreSimulation(sim)).toEqual(before);
  });
});
