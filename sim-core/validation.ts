import Ajv from 'ajv';
import scenarioSchema from '../schemas/scenario.schema.json';
import actionSchema from '../schemas/action.schema.json';
import eventSchema from '../schemas/event.schema.json';
import reportSchema from '../schemas/score_report.schema.json';
import type { Scenario, Action, SimEvent, ScoreReport } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
const scenarioValidator = ajv.compile<Scenario>(scenarioSchema);
const actionValidator = ajv.compile<Action>(actionSchema);
const eventValidator = ajv.compile<SimEvent>(eventSchema);
const reportValidator = ajv.compile<ScoreReport>(reportSchema);

export function scenarioErrors(value: unknown): string[] {
  if (!scenarioValidator(value)) return (scenarioValidator.errors ?? []).map(e => `${e.instancePath || 'scenario'} ${e.message}`);
  const s = value;
  const errors: string[] = [];
  if (new Set(s.actors.map(a => a.id)).size !== s.actors.length) errors.push('Actor IDs must be unique.');
  if (new Set(s.assets.map(a => a.id)).size !== s.assets.length) errors.push('Asset IDs must be unique.');
  // The engine defends exactly one protected asset (movement, impact, and health all
  // resolve against assets[0]); multi-asset scenarios would silently mis-score.
  if (s.assets.length !== 1) errors.push('A scenario defends exactly one protected asset.');
  // Expanded contact IDs must also be unique: a group actor `A` with count 2 expands to
  // `A-1`, `A-2`, which would silently collide with a literal actor `A-1` (mirror of world.ts).
  const expanded = s.actors.flatMap(a => a.count === 1 ? [a.id] : Array.from({ length: a.count }, (_, i) => `${a.id}-${i + 1}`));
  if (new Set(expanded).size !== expanded.length) errors.push('Expanded contact IDs collide: a group actor and a literal actor resolve to the same contact ID.');
  if (s.actors.reduce((n, a) => n + a.count, 0) > 40) errors.push('A scenario supports at most 40 expanded contacts.');
  for (const a of s.actors) {
    if (a.spawn_s > s.duration_s - 20) errors.push(`${a.id}: allow at least 20 seconds after spawn.`);
    if (a.iff && a.allegiance !== 'friendly') errors.push(`${a.id}: exercise IFF is reserved for friendly actors.`);
    if (a.kind === 'friendly_uav' && a.allegiance !== 'friendly') errors.push(`${a.id}: friendly UAV must have friendly allegiance.`);
  }
  for (const d of s.sensor_degradations) {
    if (!s.sensors.includes(d.sensor)) errors.push(`${d.sensor}: degradation refers to an unavailable sensor.`);
    if (d.start_s + d.dur_s > s.duration_s) errors.push(`${d.sensor}: degradation extends past the exercise.`);
  }
  return errors;
}
export function assertScenario(value: unknown): asserts value is Scenario {
  const errors = scenarioErrors(value);
  if (errors.length) throw new Error(errors.join(' '));
}
export function assertAction(value: unknown): asserts value is Action {
  if (!actionValidator(value)) throw new Error(ajv.errorsText(actionValidator.errors));
}
export function assertEvent(value: unknown): asserts value is SimEvent {
  if (!eventValidator(value)) throw new Error(ajv.errorsText(eventValidator.errors));
}
export function assertReport(value: unknown): asserts value is ScoreReport {
  if (!reportValidator(value)) throw new Error(ajv.errorsText(reportValidator.errors));
}
