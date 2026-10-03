import type { ResponseKind, Scenario, Track, Reason } from './types';
import { trackConfidence } from './sensors';

export const EFFECTORS: Record<ResponseKind, { label: string; range: number; probability: number; cooldown: number; charges: number; active: boolean }> = {
  observe: { label: 'Observe', range: 5000, probability: 1, cooldown: 0, charges: 999, active: false },
  warn: { label: 'Warn', range: 4000, probability: 1, cooldown: 2, charges: 999, active: false },
  electronic_jam: { label: 'Electronic effect', range: 2900, probability: 0.88, cooldown: 4, charges: 24, active: true },
  spoof_redirect: { label: 'Redirect', range: 2600, probability: 0.82, cooldown: 5, charges: 20, active: true },
  net_capture: { label: 'Capture', range: 1500, probability: 0.94, cooldown: 6, charges: 12, active: true },
  kinetic_intercept: { label: 'Intercept', range: 2400, probability: 0.96, cooldown: 4, charges: 12, active: true },
  escalate_to_command: { label: 'Escalate', range: 5000, probability: 1, cooldown: 2, charges: 999, active: false },
};

export function checkRoe(scenario: Scenario, track: Track, response: ResponseKind, tick: number, civilianArea: boolean): { allowed: boolean; detail: string } {
  if (!EFFECTORS[response].active) return { allowed: true, detail: 'Non-engagement response permitted.' };
  if (track.classification !== 'hostile') return { allowed: false, detail: 'An active response requires a hostile classification.' };
  if (trackConfidence(track, tick) < scenario.roe.min_confidence) return { allowed: false, detail: 'Evidence confidence is below the exercise threshold.' };
  if (Object.values(track.sensors).some(s => s?.iff)) return { allowed: false, detail: 'Friendly IFF is present. Reconcile the identification before acting.' };
  if (response === 'kinetic_intercept' && !scenario.roe.kinetic_allowed && !(scenario.roe.weapons_free_after_s !== null && tick / 4 >= scenario.roe.weapons_free_after_s)) return { allowed: false, detail: 'Intercept is prohibited by this exercise’s rules.' };
  if (response === 'electronic_jam' && civilianArea && !scenario.roe.jam_allowed_over_civilian_area) return { allowed: false, detail: 'Electronic effects are restricted in the civilian zone.' };
  if (scenario.roe.warning_required && track.warned_at === null) return { allowed: false, detail: 'A warning is required before an active response.' };
  return { allowed: true, detail: 'Classification, evidence, and exercise rules checked.' };
}

export function reasonIsAppropriate(reason: Reason, truth: string, response: ResponseKind): boolean {
  if (response === 'escalate_to_command') return reason === 'roe_restriction' || reason === 'insufficient_evidence';
  if (truth === 'friendly') return reason === 'friendly_iff' || reason === 'insufficient_evidence';
  if (truth === 'benign') return reason === 'benign_pattern' || reason === 'insufficient_evidence';
  if (response === 'observe') return reason === 'insufficient_evidence';
  return reason === 'protect_asset' || reason === 'positive_identification';
}
