import type { ActorKind, Dimension, Reason, ResponseKind, SensorKind } from '../sim-core/types';

/** Central domain vocabulary and reusable interface copy; English-first. */
export const COPY = {
  product: 'AVLON DRISHTI', tagline: 'AIRSPACE TRAINING SYSTEM',
  nav: { mission: 'Mission control', scenarios: 'Scenario library', aar: 'After-action review', adaptive: 'Adaptive intelligence', readiness: 'Unit readiness', studio: 'Scenario studio' },
  local: 'All systems local', synthetic: 'Synthetic demonstration data',
};
export const TYPE_LABELS: Record<ActorKind | 'unknown', string> = {
  unknown: 'Unconfirmed type', quadcopter: 'Small quadcopter', fixed_wing: 'Fixed-wing loiterer', fast_mover: 'Fast fixed-wing', recon: 'Recon platform', swarm: 'Swarm element', bird_flock: 'Bird flock', kite: 'Kite', balloon: 'Balloon', helicopter: 'Helicopter', friendly_uav: 'Friendly UAV', clutter: 'Sensor artifact', fiber_optic: 'Wire-guided intruder',
};
export const DIMENSION_LABELS: Record<Dimension, string> = { night: 'Night recognition', swarm: 'Swarm awareness', degraded_sensors: 'Degraded sensors', distractors: 'Contact discrimination', urban: 'Urban terrain', speed_pressure: 'Time pressure', roe_complexity: 'Rules & restraint' };
export const SENSOR_LABELS: Record<SensorKind, string> = { radar: 'Radar', eo: 'EO camera', ir: 'Infrared', acoustic: 'Acoustic', rf: 'RF bearing' };
export const RESPONSE_LABELS: Record<ResponseKind, string> = { observe: 'Observe', warn: 'Warn', electronic_jam: 'Electronic', spoof_redirect: 'Redirect', net_capture: 'Capture', kinetic_intercept: 'Intercept', escalate_to_command: 'Escalate' };
export const REASON_LABELS: Record<Reason, string> = { insufficient_evidence: 'Gather more evidence', protect_asset: 'Protect the asset', positive_identification: 'Positive identification', friendly_iff: 'Friendly IFF confirmed', benign_pattern: 'Benign movement pattern', roe_restriction: 'Rules require escalation' };
export const formatTime = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export const humanize = (value: string): string => value.replaceAll('_', ' ').replace(/\b\w/g, s => s.toUpperCase());
