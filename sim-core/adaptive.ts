import { DIMENSIONS, type Dimension, type Scenario, type SessionRecord } from './types';
import { clamp, quantize } from './prng';

export interface SkillState { dimension: Dimension; a: number; b: number; mean: number; uncertainty: number; sessions: number }
export interface AdaptiveProfile { user_id: string; skills: Record<Dimension, SkillState>; weakest: Dimension; cold_start: boolean }
export interface Recommendation { focus: Dimension; difficulty: number; expected_success: number; rationale: string[]; cold_start: boolean }

/**
 * Honest Bayesian evidence model.
 * Per-dimension Beta(a,b), init a=2,b=2 (mean 0.5, high uncertainty).
 * Update: success adds tag-weight to a, failure adds to b.
 * No neural net, no hidden EM. Update rule is public and inspectable.
 */
export function emptySkills(): Record<Dimension, SkillState> {
  const out = {} as Record<Dimension, SkillState>;
  for (const d of DIMENSIONS) out[d] = { dimension: d, a: 2, b: 2, mean: 0.5, uncertainty: 0.5, sessions: 0 };
  return out;
}

function sessionSuccess(session: SessionRecord): boolean { return session.report.total >= 70 && !session.report.provisional; }

export function updateSkills(prev: Record<Dimension, SkillState>, session: SessionRecord): Record<Dimension, SkillState> {
  const next = structuredClone(prev) as Record<Dimension, SkillState>;
  const success = sessionSuccess(session);
  // Weight by scenario tags 0..5 normalized; at least 0.2 so every session moves the model slightly.
  for (const dim of DIMENSIONS) {
    const w = 0.2 + (session.scenario.difficulty_tags[dim] ?? 0) / 5;
    if (success) next[dim].a = quantize(next[dim].a + w);
    else next[dim].b = quantize(next[dim].b + w);
    next[dim].sessions += 1;
    next[dim].mean = quantize(next[dim].a / (next[dim].a + next[dim].b));
    next[dim].uncertainty = quantize(1 / (next[dim].a + next[dim].b));
  }
  return next;
}

export function profileFromSessions(user_id: string, sessions: SessionRecord[]): AdaptiveProfile {
  let skills = emptySkills();
  const real = sessions.filter(s => s.user_id === user_id && !s.synthetic && !s.report.provisional);
  for (const s of real.sort((a, b) => a.started_at.localeCompare(b.started_at))) skills = updateSkills(skills, s);
  let weakest: Dimension = DIMENSIONS[0];
  for (const d of DIMENSIONS) if (skills[d].mean < skills[weakest].mean) weakest = d;
  return { user_id, skills, weakest, cold_start: real.length < 2 };
}

/** Difficulty calibration from history: observed success rate per difficulty 1..5. */
export function calibrateDifficulty(sessions: SessionRecord[]): Record<number, { attempts: number; success_rate: number | null }> {
  const out: Record<number, { attempts: number; success_rate: number | null }> = {};
  for (let d = 1; d <= 5; d++) {
    const bucket = sessions.filter(s => !s.synthetic && !s.report.provisional && s.scenario.difficulty === d);
    out[d] = { attempts: bucket.length, success_rate: bucket.length ? quantize(bucket.filter(s => sessionSuccess(s)).length / bucket.length) : null };
  }
  return out;
}

/** Pick difficulty targeting 60-75% success for the weakest skill. Simple, deterministic. */
export function recommendNext(profile: AdaptiveProfile, calibration: Record<number, { success_rate: number | null }>, recentFingerprints: string[] = []): Recommendation & { recent_fingerprints: string[] } {
  const skill = profile.skills[profile.weakest].mean;
  // Map skill 0..1 to difficulty 1..5: low skill -> easier, high skill -> harder. Clamp 1..5.
  let difficulty = Math.round(1 + skill * 4);
  // Prefer calibration bucket closest to 0.675 success if we have data.
  let best = difficulty; let bestDist = Infinity;
  for (let d = 1; d <= 5; d++) {
    const r = calibration[d]?.success_rate;
    if (r === null || r === undefined) continue;
    const dist = Math.abs(r - 0.675) + Math.abs(d - difficulty) * 0.05;
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  if (bestDist !== Infinity) difficulty = best;
  difficulty = Math.max(1, Math.min(5, difficulty));
  const expected_success = quantize(clamp(0.85 - difficulty * 0.07 - (0.5 - skill) * 0.3, 0.15, 0.92));
  const rationale = [
    `Weakest dimension is ${profile.weakest.replaceAll('_', ' ')} at ${Math.round(skill * 100)}% estimated mastery.`,
    `Targeting ~68% success; difficulty ${difficulty}/5 has expected success ${Math.round(expected_success * 100)}%.`,
    profile.cold_start ? 'Cold start: only limited real sessions, so this is a starting suggestion, not a validated rating.' : 'Based on your completed non-synthetic sessions.',
  ];
  return { focus: profile.weakest, difficulty, expected_success, rationale, cold_start: profile.cold_start, recent_fingerprints: recentFingerprints };
}

export function weaknessRecommendations(profile: AdaptiveProfile): string[] {
  const out: string[] = [];
  for (const d of DIMENSIONS) {
    const s = profile.skills[d];
    if (s.mean < 0.55 && s.sessions > 0) out.push(`${d.replaceAll('_', ' ')}: ${Math.round(s.mean * 100)}% — practice focused exercises at difficulty 2-3.`);
  }
  if (!out.length) out.push(profile.cold_start ? 'Complete 2 exercises to establish your skill profile.' : 'Balanced profile — increase difficulty to find your next edge.');
  return out;
}
