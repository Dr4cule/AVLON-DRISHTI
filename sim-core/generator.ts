import { Random, hashText, clamp } from './prng';
import { assertScenario, scenarioErrors } from './validation';
import { runBaseline, type BaselineReport } from './baseline';
import { DIMENSIONS, type ActorSpec, type Behavior, type Dimension, type Scenario } from './types';

export const KNOWN_BEHAVIORS: Behavior[] = ['approach', 'loiter', 'patrol_loop', 'random_walk', 'flocking', 'saturation', 'decoy_and_strike', 'leader_follower', 'probe_withdraw'];

export interface GenerationOptions {
  seed: number; difficulty: number; difficulty_profile?: Partial<Record<Dimension, number>>;
  focus?: Dimension; constraints?: Partial<Scenario['environment']>; recent_fingerprints?: string[];
  /** Optional adversary emphasis: hostile group behaviors are drawn from this
   * list when possible (falls back to the full list otherwise). The fairness
   * gate still applies to whatever is built. */
  behaviorBias?: Behavior[];
}
export interface GeneratedScenario { scenario: Scenario; fingerprint: string; baseline: BaselineReport; attempts: number }

/**
 * Bias-selectable behaviors per roster slot. Without a bias the draw uses
 * pool only, so default (including training) draws never change; a bias may
 * additionally select from extra. Every tactic in challenge.ts resolves here.
 */
export const BIAS_POOLS = {
  swarm: ['flocking', 'saturation', 'leader_follower'],
  recon: ['approach', 'decoy_and_strike'],
  reconExtra: ['probe_withdraw', 'loiter', 'random_walk'],
} as const satisfies Record<string, readonly Behavior[]>;

/** Deliberately omits seed/title; nearby geometry and timing share a fingerprint. */
export function fingerprint(scenario: Scenario): string {
  return hashText(JSON.stringify({ environment: scenario.environment, difficulty: scenario.difficulty, roe: scenario.roe,
    actors: scenario.actors.map(a => [a.kind, a.allegiance, a.count, a.behavior, Math.floor(a.spawn.bearing_deg / 30), Math.floor(a.spawn.range_m / 500), Math.floor(a.spawn_s / 15), Math.floor(a.speed_mps / 5), Math.floor(a.altitude_m / 100), a.iff ? 1 : 0, a.civilian_area ? 1 : 0]),
    sensors: [...scenario.sensors].sort(), degradations: scenario.sensor_degradations.map(d => [d.sensor, d.kind, Math.floor(d.start_s / 20), Math.floor(d.dur_s / 10)]) }));
}

function candidate(options: GenerationOptions, seed: number): Scenario {
  const random = new Random(seed);
  const difficulty = options.difficulty;
  const profile = Object.fromEntries(DIMENSIONS.map(d => [d, options.difficulty_profile?.[d] ?? (options.focus === d ? difficulty : 0)])) as Record<Dimension, number>;
  const isNight = profile.night > 0 || random.next() < (difficulty > 2 ? 0.65 : 0.2);
  const terrain = profile.urban > 0 ? 'urban' : random.pick(['rural', 'rural', 'urban', 'mountain'] as const);
  const degraded = profile.degraded_sensors > 0 || difficulty >= 4;
  const swarm = profile.swarm > 0 || (difficulty > 2 && random.next() > 0.25);
  const environment: Scenario['environment'] = {
    terrain, time_of_day: isNight ? 'night' : random.pick(['day', 'dusk'] as const),
    weather: difficulty < 3 ? 'clear' : random.pick(['clear', 'fog', 'rain', 'wind'] as const),
    em_conditions: degraded ? 'high_clutter' : 'clean', ...options.constraints,
  };
  // Explicit constraints win: a forced dirty EM spectrum is a degraded exercise even when
  // the profile dice said otherwise, so the dropout schedule, tags, and roster follow it.
  const degradedFinal = degraded || environment.em_conditions !== 'clean';
  const actors: ActorSpec[] = [];
  const add = (partial: Partial<ActorSpec>) => actors.push({
    id: `C${actors.length + 1}`, kind: 'quadcopter', allegiance: 'hostile', count: 1, behavior: 'approach',
    spawn: { bearing_deg: random.int(0, 359), range_m: random.int(2900, 3600) },
    spawn_s: actors.length * random.int(5, 12), speed_mps: 12 + difficulty * 3 + random.int(0, 3),
    altitude_m: random.int(60, 180), iff: false, civilian_area: false, ...partial,
  });
  const bias = (pool: readonly Behavior[], extra: readonly Behavior[] = []): readonly Behavior[] => {
    if (!options.behaviorBias?.length) return pool;
    const hit = [...pool, ...extra].filter(b => options.behaviorBias!.includes(b));
    return hit.length > 0 ? hit : pool;
  };
  add(swarm ? { kind: 'swarm', count: Math.min(7, difficulty + 1), behavior: random.pick(bias([...BIAS_POOLS.swarm])) } : { kind: difficulty >= 4 ? 'fast_mover' : random.pick(['quadcopter', 'fixed_wing'] as const) });
  if (difficulty >= 3) add({ kind: 'recon', behavior: random.pick(bias([...BIAS_POOLS.recon], [...BIAS_POOLS.reconExtra])), spawn_s: random.int(30, 55), civilian_area: environment.terrain === 'urban' });
  // Wire-guided intruders appear in degraded-spectrum exercises: RF-quiet, slow,
  // and low — the trainee must fall back to visual/thermal/acoustic evidence.
  if (degradedFinal && difficulty >= 3 && random.next() < 0.5) add({ kind: 'fiber_optic', behavior: 'approach', speed_mps: 12 + random.int(0, 4), altitude_m: random.int(40, 90), spawn_s: random.int(10, 40) });
  const distractors = 1 + (profile.distractors > 1 ? 2 : difficulty > 2 ? 1 : 0);
  for (let i = 0; i < distractors; i++) add({ kind: random.pick(['bird_flock', 'kite', 'balloon', 'helicopter'] as const), allegiance: 'benign', behavior: 'random_walk', spawn_s: i * 4, speed_mps: random.int(4, 12), spawn: { bearing_deg: random.int(0, 359), range_m: random.int(1500, 2400) } });
  add({ kind: 'friendly_uav', allegiance: 'friendly', behavior: 'patrol_loop', iff: true, spawn_s: 0, speed_mps: 15, spawn: { bearing_deg: random.int(0, 359), range_m: random.int(1700, 2400) } });
  if (degradedFinal && difficulty >= 4) add({ kind: 'clutter', allegiance: 'benign', behavior: 'random_walk', speed_mps: 3, spawn_s: 10 });
  const tags: Record<Dimension, number> = { night: environment.time_of_day === 'night' ? difficulty : environment.time_of_day === 'dusk' ? 1 : 0, swarm: swarm ? difficulty : 0, degraded_sensors: degradedFinal ? difficulty : 0, distractors: Math.min(5, distractors + 1), urban: environment.terrain === 'urban' ? difficulty : 0, speed_pressure: Math.max(1, difficulty - 1), roe_complexity: difficulty > 2 ? difficulty : 1 };
  const scenario: Scenario = {
    schema_version: '1.0', id: `generated-${seed}`, title: `${random.pick(['Silent', 'Amber', 'Distant', 'Silver', 'Shifting', 'Hidden', 'Northern'])} ${random.pick(['horizon', 'watch', 'signal', 'passage', 'echo', 'sky'])}`,
    description: `A seeded ${environment.time_of_day} exercise across fictional ${environment.terrain} terrain. ${options.focus ? `Practice ${options.focus.replaceAll('_', ' ')} while maintaining` : 'Maintain'} a complete sensor picture. A headless baseline checks that this exercise has a successful path.`,
    source: 'generated', seed, environment, assets: [{ id: 'A1', type: random.pick(['command_post', 'checkpoint', 'convoy'] as const), pos: [0, 0], value: 100 }],
    sensors: environment.time_of_day === 'night' ? ['radar', 'ir', 'acoustic', 'rf'] : ['radar', 'eo', 'ir', 'acoustic', 'rf'],
    sensor_degradations: degradedFinal ? [{ sensor: 'radar', kind: 'dropout', start_s: random.int(25, 55), dur_s: 12 + difficulty * 2 }] : [],
    roe: { kinetic_allowed: false, jam_allowed_over_civilian_area: false, weapons_free_after_s: null, warning_required: difficulty > 2 || profile.roe_complexity > 1, min_confidence: 0.5 + Math.min(3, difficulty) * 0.02 },
    actors, ground_truth_tree: 'decision-v1', difficulty, difficulty_tags: tags, duration_s: 180 + (difficulty >= 4 ? 60 : 0),
  };
  return scenario;
}

export function generateScenario(options: GenerationOptions): GeneratedScenario {
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 4294967295) throw new Error('Seed must be an unsigned 32-bit integer.');
  if (!Number.isInteger(options.difficulty) || options.difficulty < 1 || options.difficulty > 5) throw new Error('Difficulty must be an integer from 1 to 5.');
  if (options.focus && !DIMENSIONS.includes(options.focus)) throw new Error('Unknown training dimension.');
  for (const [dimension, level] of Object.entries(options.difficulty_profile ?? {})) {
    if (!DIMENSIONS.includes(dimension as Dimension) || !Number.isInteger(level) || level < 0 || level > 5) throw new Error('Invalid difficulty profile.');
  }
  if (options.behaviorBias !== undefined) {
    if (!Array.isArray(options.behaviorBias) || options.behaviorBias.length === 0 || !options.behaviorBias.every(b => KNOWN_BEHAVIORS.includes(b))) throw new Error('Invalid behavior bias: must be a non-empty list of known behaviors.');
  }
  const recent = new Set(options.recent_fingerprints?.slice(-12) ?? []);
  for (let attempt = 0; attempt < 40; attempt++) {
    const seed = (options.seed + Math.imul(attempt, 2654435761)) >>> 0;
    const scenario = candidate(options, seed);
    if (scenarioErrors(scenario).length) continue;
    const key = fingerprint(scenario);
    if (recent.has(key)) continue;
    const { report } = runBaseline(scenario);
    if (!report.passed) continue;
    assertScenario(scenario);
    return { scenario, fingerprint: key, baseline: report, attempts: attempt + 1 };
  }
  throw new Error('No fair, distinct scenario found for these constraints. Adjust the seed or difficulty.');
}
