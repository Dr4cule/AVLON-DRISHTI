import { sensorStatus } from '../sensors';
import type { Entity, Scenario, SensorKind, Track } from '../types';

/**
 * Feature extraction for the advisory threat-assessment model.
 *
 * Every feature is computable from the TRAINEE-VISIBLE track plus scenario
 * context — never from ground truth. All features are roughly in [0,1].
 * Extraction is pure and deterministic: same track + tick = same vector.
 *
 * One deliberate substitution vs the original brief: `altitude_change` is
 * replaced by `range_rate_closing`, because tracks do not store altitude
 * history while trail positions give an exact closing rate — and closing
 * behavior is more discriminative for hostile intent anyway.
 */

export const FEATURE_NAMES = [
  'radar_confidence',
  'radar_range',
  'radar_velocity',
  'radar_altitude',
  'heading_change',
  'range_rate_closing',
  'track_stability',
  'ir_confidence',
  'acoustic_confidence',
  'rf_confidence',
  'sensor_agreement',
  'sensor_degradation',
  'time_observed',
  'environmental_noise',
  'iff_present',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Classes are simulation-oriented. `unknown_uav` means "insufficient evidence". */
export const THREAT_CLASSES = [
  'bird',
  'balloon',
  'friendly_uav',
  'unknown_uav',
  'hostile_like_uav',
  'clutter',
] as const;

export type ThreatClass = (typeof THREAT_CLASSES)[number];

/** Readings older than the fusion window count as absent (matches engine semantics). */
const FRESH_TICKS = 12;

function fresh(track: Track, sensor: SensorKind, tick: number): number {
  const reading = track.sensors[sensor];
  if (!reading || tick - reading.tick > FRESH_TICKS) return 0;
  return reading.confidence;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function extractFeatures(track: Track, scenario: Scenario, tick: number): number[] {
  const trail = track.trail;
  const ageTicks = Math.max(1, tick - track.first_seen);
  const ageSec = ageTicks / 4;

  const available = scenario.sensors.length;
  const freshCount = scenario.sensors.filter(s => {
    const r = track.sensors[s];
    return r !== undefined && tick - r.tick <= FRESH_TICKS;
  }).length;

  // Heading change: direction of first-half displacement vs second-half, / π.
  let headingChange = 0;
  if (trail.length >= 4) {
    const mid = Math.floor(trail.length / 2);
    const a1 = Math.atan2(trail[mid].x - trail[0].x, trail[mid].y - trail[0].y);
    const a2 = Math.atan2(
      trail[trail.length - 1].x - trail[mid].x,
      trail[trail.length - 1].y - trail[mid].y,
    );
    let delta = Math.abs(a1 - a2);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    headingChange = delta / Math.PI;
  }

  // Closing rate toward the protected asset, signed [-1,1] shifted to [0,1].
  let closing = 0.5;
  if (trail.length >= 2) {
    const first = trail[0];
    const last = trail[trail.length - 1];
    const dtSec = Math.max(0.25, (last.tick - first.tick) / 4);
    const r0 = Math.hypot(first.x, first.y);
    const r1 = Math.hypot(last.x, last.y);
    closing = clamp01(((r0 - r1) / (dtSec * 65) + 1) / 2);
  }

  // Cooperative IFF from trainee-visible readings only — never from ground truth.
  // This is the single most authoritative cooperative signal, and the model must
  // learn to weight it the way trainees are taught to (reconcile IFF first).
  const iffPresent = scenario.sensors.some(s => {
    const r = track.sensors[s];
    return r !== undefined && r.iff === true && tick - r.tick <= FRESH_TICKS;
  })
    ? 1
    : 0;

  const degraded = scenario.sensors.filter(
    s => sensorStatus(scenario, s, tick) !== 'online',
  ).length;

  const env = scenario.environment;
  const noise =
    (env.time_of_day === 'night' ? 0.25 : env.time_of_day === 'dusk' ? 0.1 : 0) +
    (env.weather === 'fog' ? 0.2 : env.weather === 'rain' ? 0.15 : env.weather === 'wind' ? 0.1 : 0) +
    (env.em_conditions === 'jammed' ? 0.3 : env.em_conditions === 'high_clutter' ? 0.15 : 0) +
    (env.terrain === 'urban' ? 0.05 : 0);

  return [
    fresh(track, 'radar', tick),
    clamp01(Math.hypot(track.x, track.y) / 4400),
    clamp01(track.estimated_speed / 65),
    clamp01(track.estimated_altitude / 900),
    headingChange,
    closing,
    clamp01(trail.length / 18),
    fresh(track, 'ir', tick),
    fresh(track, 'acoustic', tick),
    fresh(track, 'rf', tick),
    available === 0 ? 0 : freshCount / available,
    available === 0 ? 0 : degraded / available,
    clamp01(ageSec / 120),
    clamp01(noise),
    iffPresent,
  ];
}

/**
 * Ground-truth label for training. Short-lived or evidence-poor tracks are
 * labeled `unknown_uav` regardless of truth — the model must learn that
 * insufficient evidence means "unknown", which is exactly the trainee lesson.
 */
export function labelFor(entity: Entity, ageSec: number, freshCount: number): ThreatClass {
  // A radar-only signature IS the clutter fingerprint — single-sensor tracks of
  // this kind are labeled by kind, not swallowed by the unknown rule. This also
  // teaches the model (and the trainee) that "only ever seen by radar" is evidence.
  if (entity.kind === 'clutter') return ageSec < 6 ? 'unknown_uav' : 'clutter';
  if (ageSec < 6 || freshCount < 2) return 'unknown_uav';
  if (entity.allegiance === 'hostile') return 'hostile_like_uav';
  if (entity.allegiance === 'friendly') return 'friendly_uav';
  if (entity.kind === 'bird_flock') return 'bird';
  if (entity.kind === 'balloon' || entity.kind === 'kite') return 'balloon';
  if (entity.kind === 'helicopter') return 'friendly_uav';
  return 'bird';
}
