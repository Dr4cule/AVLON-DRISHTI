import { replay } from '../engine';
import type { GenerationOptions } from '../generator';
import { DIMENSIONS, type Behavior, type Dimension, type SessionRecord } from '../types';
import { extractFeatures } from './features';

export type Level = 'low' | 'medium' | 'high';

/**
 * A challenge profile describes WHAT makes the next exercise hard, in
 * trainee-meaningful terms — not raw difficulty numbers. It is derived from
 * the weakest skill plus recent mistake patterns, then compiled down to the
 * generator's existing knobs (difficulty_profile / focus / constraints).
 */
export interface ChallengeProfile {
  night: boolean;
  terrain: 'any' | 'urban';
  irDegradation: Level;
  sensorConflict: Level;
  contactLoad: Level;
  ambiguity: Level;
}

export interface AdversaryTactic {
  behavior: Behavior;
  rationale: string;
}

const levelNum = (level: Level): number => (level === 'high' ? 5 : level === 'medium' ? 3 : 0);

/**
 * Rule-based pattern detection over recent history. Every pattern is computed
 * from recorded scores, mistake categories, scenario tags, or replayed sensor
 * agreement — never invented.
 */
export function detectPatterns(userId: string, sessions: SessionRecord[]): string[] {
  const real = sessions
    .filter(s => s.user_id === userId && !s.synthetic && !s.report.provisional)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const recent = real.slice(-5);
  if (recent.length === 0) return [];
  const patterns: string[] = [];

  const classScores = recent.map(s => s.report.metrics.classification);
  if (classScores.length >= 2) {
    const mean = classScores.reduce((a, b) => a + b, 0) / classScores.length;
    if (mean < 60) patterns.push(`Classification accuracy declined recently (${Math.round(mean)}% over the last ${classScores.length} exercises)`);
  }

  const degradedErrors = recent.filter(
    s =>
      (s.scenario.difficulty_tags.degraded_sensors ?? 0) >= 3 &&
      s.report.mistakes.some(m => m.category === 'classification' || m.category === 'decision'),
  ).length;
  if (degradedErrors >= 2) patterns.push(`${degradedErrors} recent errors occurred under degraded sensors`);

  // Sensor-conflict errors: classification mistakes where replayed evidence disagrees.
  let conflict = 0;
  let examined = 0;
  outer: for (const session of recent) {
    for (const mistake of session.report.mistakes) {
      if (mistake.category !== 'classification') continue;
      if (examined >= 10) break outer;
      examined++;
      try {
        const tick = Math.min(mistake.tick, session.end_tick);
        const sim = replay(
          session.scenario,
          session.actions.filter(a => a.tick <= tick),
          tick,
          false,
          session.engine_version,
        );
        const track = sim.state.tracks[mistake.actor_id];
        if (!track) continue;
        if (extractFeatures(track, session.scenario, tick)[10] < 0.5) conflict++;
      } catch {
        continue;
      }
    }
  }
  if (conflict >= 2) patterns.push('Low performance under conflicting sensor evidence');

  const clean = recent.filter(
    s => (s.scenario.difficulty_tags.degraded_sensors ?? 0) === 0 && (s.scenario.difficulty_tags.night ?? 0) === 0,
  );
  if (clean.length > 0) {
    const mean = clean.reduce((s, x) => s + x.report.metrics.classification, 0) / clean.length;
    if (mean >= 80) patterns.push('High performance under normal conditions');
  }

  const nightErrors = recent.filter(
    s =>
      (s.scenario.difficulty_tags.night ?? 0) >= 3 &&
      s.report.mistakes.some(m => m.severity !== 'info'),
  ).length;
  if (nightErrors >= 2) patterns.push(`${nightErrors} recent exercises with mistakes at night`);

  return patterns.slice(0, 4);
}

export function challengeFromWeakness(weakest: Dimension): ChallengeProfile {
  const base: ChallengeProfile = {
    night: false,
    terrain: 'any',
    irDegradation: 'low',
    sensorConflict: 'low',
    contactLoad: 'medium',
    ambiguity: 'medium',
  };
  switch (weakest) {
    case 'night':
      return { ...base, night: true, irDegradation: 'high' };
    case 'degraded_sensors':
      return { ...base, irDegradation: 'high', sensorConflict: 'high' };
    case 'distractors':
      return { ...base, ambiguity: 'high', contactLoad: 'high' };
    case 'swarm':
      return { ...base, contactLoad: 'high', ambiguity: 'medium' };
    case 'urban':
      return { ...base, terrain: 'urban', ambiguity: 'medium' };
    case 'speed_pressure':
      return { ...base, contactLoad: 'high', sensorConflict: 'medium' };
    case 'roe_complexity':
      return { ...base, ambiguity: 'high', contactLoad: 'medium' };
  }
}

/**
 * Compile a challenge profile onto the generator's existing, validated knobs.
 * Nothing here bypasses validation, diversity, or the baseline fairness gate.
 */
export function challengeToOptions(
  challenge: ChallengeProfile,
  args: { seed: number; difficulty: number; focus: Dimension; recent_fingerprints?: string[] },
): GenerationOptions {
  return {
    seed: args.seed,
    difficulty: args.difficulty,
    focus: args.focus,
    difficulty_profile: {
      night: challenge.night ? args.difficulty : 0,
      swarm: challenge.contactLoad === 'high' ? Math.max(3, args.difficulty) : 0,
      degraded_sensors: levelNum(challenge.irDegradation),
      distractors: challenge.ambiguity === 'high' ? 5 : challenge.ambiguity === 'medium' ? 3 : 0,
      urban: challenge.terrain === 'urban' ? args.difficulty : 0,
      speed_pressure: challenge.contactLoad === 'high' ? 4 : 0,
      roe_complexity: challenge.ambiguity === 'high' ? 4 : 0,
    },
    constraints: {
      ...(challenge.night ? { time_of_day: 'night' as const } : {}),
      ...(challenge.terrain === 'urban' ? { terrain: 'urban' as const } : {}),
    },
    recent_fingerprints: args.recent_fingerprints,
  };
}

const TACTICS: Record<Dimension, { behavior: Behavior; rationale: string }[]> = {
  night: [
    { behavior: 'probe_withdraw', rationale: 'probing contacts punish inattentive night scans' },
    { behavior: 'approach', rationale: 'direct approaches test thermal-first detection' },
  ],
  swarm: [
    { behavior: 'saturation', rationale: 'multi-axis saturation overwhelms single-track focus' },
    { behavior: 'flocking', rationale: 'cohesive groups mimic bird flocks on every sensor' },
    { behavior: 'leader_follower', rationale: 'leader dependence rewards finding the keystone contact' },
  ],
  degraded_sensors: [
    { behavior: 'probe_withdraw', rationale: 'brief appearances exploit sensor dropouts' },
    { behavior: 'decoy_and_strike', rationale: 'decoys exploit low-confidence pictures' },
  ],
  distractors: [
    { behavior: 'decoy_and_strike', rationale: 'decoys punish premature hostile calls' },
    { behavior: 'random_walk', rationale: 'wandering benign traffic blends with threats' },
  ],
  urban: [
    { behavior: 'approach', rationale: 'masked approaches exploit terrain occlusion' },
    { behavior: 'loiter', rationale: 'persistent orbits hide in urban clutter' },
  ],
  speed_pressure: [
    { behavior: 'saturation', rationale: 'simultaneous axes compress decision time' },
    { behavior: 'approach', rationale: 'fast direct runs shrink the reaction window' },
  ],
  roe_complexity: [
    { behavior: 'probe_withdraw', rationale: 'ambiguous probes test restraint under rules' },
    { behavior: 'decoy_and_strike', rationale: 'mixed traffic tests warning-ladder discipline' },
  ],
};

/**
 * Abstract adversary emphasis for the next exercise. These are gameplay
 * doctrine labels (documented, deterministic), not real-world tactics — and
 * the generator's fairness gate still applies to whatever is built.
 */
export function adversaryTactics(weakest: Dimension): AdversaryTactic[] {
  return TACTICS[weakest] ?? TACTICS[DIMENSIONS[0]];
}
