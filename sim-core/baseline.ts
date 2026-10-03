import { Simulation } from './engine';
import { checkRoe, EFFECTORS } from './roe';
import { scoreSimulation } from './scoring';
import type { Action, ResponseKind, Scenario } from './types';

export interface BaselineReport { passed: boolean; score: number; asset_health: number; required_threats: number; resolved_threats: number; violations: number; actions: number }

/** An oracle classifier with observation/reaction delays, used only for feasibility and labeled demo fixtures. */
export function runBaseline(scenario: Scenario, delayTicks = 8): { simulation: Simulation; report: BaselineReport } {
  const sim = new Simulation(scenario);
  const lastAction = new Map<string, number>();
  const act = (action: Omit<Action, 'tick'>) => sim.dispatch({ ...action, tick: sim.state.tick });
  while (!sim.state.ended) {
    for (const track of Object.values(sim.state.tracks)) {
      const entity = sim.state.entities.find(e => e.id === track.id)!;
      if (entity.status !== 'active' || sim.state.tick - track.first_seen < delayTicks) continue;
      if (track.acknowledged_at === null) { act({ type: 'acknowledge', actor_id: track.id }); continue; }
      if (track.classification === 'unknown' && sim.state.tick - track.acknowledged_at >= 4) {
        act({ type: 'classify', actor_id: track.id, classification: entity.allegiance, drone_type: entity.kind }); continue;
      }
      if (track.classification === 'unknown' || sim.state.tick - (lastAction.get(track.id) ?? -100) < 8) continue;
      if (entity.allegiance !== 'hostile') {
        if (!lastAction.has(track.id)) {
          act({ type: 'respond', actor_id: track.id, response: 'observe', reason: entity.allegiance === 'friendly' ? 'friendly_iff' : 'benign_pattern' });
          lastAction.set(track.id, sim.state.tick);
        }
        continue;
      }
      if (scenario.roe.warning_required && track.warned_at === null) {
        if (sim.state.effectors.warn.ready_at <= sim.state.tick && Math.hypot(track.x, track.y) < EFFECTORS.warn.range) {
          act({ type: 'respond', actor_id: track.id, response: 'warn', reason: 'protect_asset' }); lastAction.set(track.id, sim.state.tick);
        }
        continue;
      }
      const response = (['electronic_jam', 'spoof_redirect', 'net_capture', 'kinetic_intercept'] as ResponseKind[]).find(r =>
        sim.state.effectors[r].ready_at <= sim.state.tick && sim.state.effectors[r].charges > 0 &&
        Math.hypot(track.x, track.y) < EFFECTORS[r].range - 30 &&
        checkRoe(scenario, track, r, sim.state.tick, entity.civilian_area).allowed,
      );
      if (response) { act({ type: 'respond', actor_id: track.id, response, reason: 'protect_asset' }); lastAction.set(track.id, sim.state.tick); }
    }
    sim.step();
  }
  const score = scoreSimulation(sim);
  const threats = sim.state.entities.filter(e => e.allegiance === 'hostile');
  const resolved = threats.filter(e => e.status === 'resolved').length;
  const violations = sim.events.filter(e => e.type === 'ResponseRejected' && e.payload.roe_violation).length;
  return { simulation: sim, report: { passed: score.asset_health >= 80 && resolved === threats.length && violations === 0 && score.total >= 70, score: score.total, asset_health: score.asset_health, required_threats: threats.length, resolved_threats: resolved, violations, actions: sim.actions.length } };
}
