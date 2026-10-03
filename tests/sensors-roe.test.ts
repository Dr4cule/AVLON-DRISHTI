import { describe, expect, it } from 'vitest';
import { Simulation, replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { checkRoe } from '../sim-core/roe';
import { detectionProbability, sensorStatus, trackConfidence } from '../sim-core/sensors';
import type { Scenario } from '../sim-core/types';

const base = SCRIPTED_SCENARIOS[0];
describe('sensor uncertainty and response rules', () => {
  it('observes a scheduled dropout, then restores radar', () => {
    const scenario: Scenario = { ...base, sensors: ['radar'], sensor_degradations: [{ sensor: 'radar', kind: 'dropout', start_s: 5, dur_s: 10 }] };
    const sim = replay(scenario, [], 80);
    expect(sim.events.filter(e => e.type === 'SensorDetection' && e.tick >= 20 && e.tick < 60)).toHaveLength(0);
    expect(sensorStatus(scenario, 'radar', 59)).toBe('offline');
    expect(sensorStatus(scenario, 'radar', 60)).toBe('online');
  });
  it('reduces radar observations under degraded conditions with the same seed', () => {
    const clean: Scenario = { ...base, sensors: ['radar'] };
    const degraded: Scenario = { ...clean, environment: { ...clean.environment, em_conditions: 'jammed' } };
    const count = (s: Scenario) => replay(s, [], 400).events.filter(e => e.type === 'SensorDetection').length;
    expect(count(degraded)).toBeLessThan(count(clean));
  });
  it('shows bearing-only evidence without revealing true distance', () => {
    const sim = replay({ ...base, sensors: ['acoustic'] }, [], 80, false);
    const track = Object.values(sim.state.tracks)[0];
    expect(track.bearing_only).toBe(true);
    expect(Math.hypot(track.x, track.y)).toBeCloseTo(2700, 0);
    expect(trackConfidence(track, sim.state.tick + 100)).toBeLessThan(track.confidence);
  });
  it('checks identification, warning ladder and intercept restrictions', () => {
    const sim = replay({ ...base, roe: { ...base.roe, warning_required: true } }, [], 24, false);
    const track = sim.state.tracks.C1;
    expect(checkRoe(sim.scenario, track, 'electronic_jam', 24, false).allowed).toBe(false);
    sim.dispatch({ tick: 24, actor_id: 'C1', type: 'classify', classification: 'hostile', drone_type: 'recon' });
    expect(checkRoe(sim.scenario, track, 'electronic_jam', 24, false).detail).toContain('warning');
    sim.dispatch({ tick: 24, actor_id: 'C1', type: 'respond', response: 'warn', reason: 'protect_asset' });
    expect(checkRoe(sim.scenario, track, 'electronic_jam', 24, false).allowed).toBe(true);
    expect(checkRoe(sim.scenario, track, 'kinetic_intercept', 24, false).allowed).toBe(false);
    expect(checkRoe(sim.scenario, track, 'electronic_jam', 24, true).allowed).toBe(false);
  });
  it('blocks friendly IFF and records attempted violations without consuming a charge', () => {
    const scenario: Scenario = { ...base, actors: [{ ...base.actors[0], iff: true, allegiance: 'friendly', kind: 'friendly_uav' }] };
    const sim = replay(scenario, [], 120, false);
    const track = sim.state.tracks.C1;
    expect(Object.values(track.sensors).some(s => s.iff)).toBe(true);
    sim.dispatch({ tick: 120, actor_id: 'C1', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' });
    const charges = sim.state.effectors.electronic_jam.charges;
    const result = sim.dispatch({ tick: 120, actor_id: 'C1', type: 'respond', response: 'electronic_jam', reason: 'protect_asset' });
    expect(result.accepted).toBe(false);
    expect(sim.state.effectors.electronic_jam.charges).toBe(charges);
    expect(sim.events.at(-1)?.payload.roe_violation).toBe(true);
  });
  it('keeps wire-guided intruders visible to radar under jamming while RF stays quiet', () => {
    const jammed: Scenario = { ...base, sensors: ['radar', 'rf'], environment: { ...base.environment, em_conditions: 'jammed' } };
    const sim = replay(jammed, [], 60, false);
    const entity = sim.state.entities.find(e => e.id === 'C1')!;
    const fiber = { ...entity, kind: 'fiber_optic' as const };
    // Same geometry, same tick: radar ignores EM degradation for wire-guided kinds.
    const clean: Scenario = { ...jammed, environment: { ...jammed.environment, em_conditions: 'clean' } };
    expect(detectionProbability(jammed, fiber, 'radar', 40)).toBe(detectionProbability(clean, fiber, 'radar', 40));
    expect(detectionProbability(jammed, entity, 'radar', 40)).toBeLessThan(detectionProbability(clean, entity, 'radar', 40));
    // …but its RF channel is nearly silent in every condition.
    expect(detectionProbability(clean, fiber, 'rf', 40)).toBeLessThan(0.2);
    expect(detectionProbability(clean, entity, 'rf', 40)).toBeGreaterThan(0.5);
  });
  it('moves all group behaviors reproducibly', () => {
    for (const behavior of ['flocking', 'leader_follower', 'saturation', 'decoy_and_strike', 'probe_withdraw'] as const) {
      const scenario: Scenario = { ...base, actors: [{ ...base.actors[0], kind: 'swarm', count: 6, behavior }] };
      const first = replay(scenario, [], 120);
      expect(first.state.entities).toEqual(replay(scenario, [], 120).state.entities);
      expect(first.state.entities.every(e => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
    }
  });
});
