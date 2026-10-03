import { replay } from '../sim-core/engine';
import { runBaseline } from '../sim-core/baseline';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import type { Action, User } from '../sim-core/types';

export const DEMO_USERS: User[] = [
  { id: 'demo-01', name: 'A. Singh', role: 'trainee', unit_id: 'demo-unit', synthetic: true },
  { id: 'demo-02', name: 'M. Iyer', role: 'trainee', unit_id: 'demo-unit', synthetic: true },
  { id: 'demo-03', name: 'R. Khan', role: 'trainee', unit_id: 'demo-unit', synthetic: true },
  { id: 'demo-04', name: 'S. Nair', role: 'trainee', unit_id: 'demo-unit', synthetic: true },
];

/** Synthetic fixtures are generated through the real engine; scores are never hand-authored. */
export function demoRuns() {
  return DEMO_USERS.flatMap((user, person) => [0, 2, 4, 6, 8, 9].map((index, attempt) => {
    const scenario = SCRIPTED_SCENARIOS[index];
    const baseline = runBaseline(scenario, 8 + person * 6 + (2 - attempt) * 4).simulation;
    const firstHostile = baseline.state.entities.find(e => e.allegiance === 'hostile')!;
    const benign = baseline.state.entities.find(e => e.allegiance === 'benign');
    const actions = baseline.actions.flatMap<Action>(action => {
      if (person === 3 && attempt === 0 && action.actor_id === firstHostile.id) return [];
      if (action.type === 'classify' && action.actor_id === benign?.id && (person + attempt) % 3 === 0) return [{ ...action, classification: 'hostile', drone_type: 'quadcopter' }, action];
      if (action.type === 'classify' && action.actor_id === firstHostile.id && (person === 2 || attempt === 0)) return [action, { tick: action.tick, actor_id: action.actor_id, type: 'respond', response: 'kinetic_intercept', reason: 'protect_asset' }];
      if (action.type === 'classify' && person === 1 && attempt !== 2) return [{ ...action, drone_type: 'unknown' }];
      return [action];
    });
    const simulation = replay(scenario, actions, scenario.duration_s * 4);
    return { id: `${user.id}-session-${attempt + 1}`, user_id: user.id, started_at: `2026-09-${20 + attempt * 2}T10:${String(person * 10).padStart(2, '0')}:00.000Z`, simulation };
  }));
}
