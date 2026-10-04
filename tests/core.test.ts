import { describe, expect, it } from 'vitest';
import { Simulation, replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { assertEvent, assertReport, scenarioErrors } from '../sim-core/validation';
import { scoreSimulation } from '../sim-core/scoring';
import { Random } from '../sim-core/prng';

const scenario = SCRIPTED_SCENARIOS[0];
describe('deterministic simulation seam', () => {
  it('reproduces the complete immutable event log from scenario, seed and actions', () => {
    const live = new Simulation(scenario);
    for (let i = 0; i < 160; i++) {
      live.step();
      for (const track of Object.values(live.state.tracks)) {
        if (track.acknowledged_at === null && live.state.tick > 8) {
          live.dispatch({ tick: live.state.tick, actor_id: track.id, type: 'acknowledge' });
          live.dispatch({ tick: live.state.tick, actor_id: track.id, type: 'classify', classification: 'unknown', drone_type: 'unknown' });
          live.dispatch({ tick: live.state.tick, actor_id: track.id, type: 'respond', response: 'observe', reason: 'insufficient_evidence' });
        }
      }
    }
    live.finish();
    const playback = replay(scenario, live.actions, live.state.tick);
    expect(playback.events).toEqual(live.events);
    expect(playback.eventHash()).toBe(live.eventHash());
    expect(Object.isFrozen(live.events[0].payload)).toBe(true);
    live.events.forEach(assertEvent);
  });
  it('changes observations with a different seed', () => {
    expect(replay(scenario, [], 80).events).not.toEqual(replay({ ...scenario, seed: scenario.seed + 1 }, [], 80).events);
  });
  it('never exposes allegiance or actor kind in the trainee map projection', () => {
    const sim = replay(scenario, [], 40, false);
    expect(sim.contacts().length).toBeGreaterThan(0);
    for (const contact of sim.contacts()) {
      expect(contact.classification).toBe('unknown');
      expect(contact).not.toHaveProperty('allegiance');
      expect(contact).not.toHaveProperty('kind');
    }
  });
  it('validates scenario imports and required action fields', () => {
    expect(scenarioErrors(scenario)).toEqual([]);
    expect(scenarioErrors({ ...scenario, seed: -1 })).not.toEqual([]);
    const sim = new Simulation(scenario);
    expect(() => sim.dispatch({ type: 'classify', actor_id: 'C1', tick: 0 })).toThrow();
  });
  it('uses an explicit repeatable PRNG and emits a schema-valid score', () => {
    const a = new Random(123), b = new Random(123);
    expect(Array.from({ length: 100 }, () => a.next())).toEqual(Array.from({ length: 100 }, () => b.next()));
    expect(() => assertReport(scoreSimulation(replay(scenario, [], 80)))).not.toThrow();
  });
  it('rejects expanded contact-ID collisions between group and literal actors', () => {
    const colliding = {
      ...scenario,
      actors: [
        { ...scenario.actors[0], id: 'A', count: 2 },
        { ...scenario.actors[0], id: 'A-1', count: 1 },
      ],
    };
    expect(scenarioErrors(colliding).some(e => e.includes('collide'))).toBe(true);
  });
  it('requires exactly one protected asset and checks replay engine versions', () => {
    const two = { ...scenario, assets: [scenario.assets[0], { ...scenario.assets[0], id: 'A2' }] };
    expect(scenarioErrors(two).some(e => e.includes('exactly one protected asset'))).toBe(true);
    expect(() => replay(scenario, [], 10, true, '9.9.9')).toThrow(/engine/);
    expect(() => replay(scenario, [], 10, true, '1.0.0')).not.toThrow();
  });
});
