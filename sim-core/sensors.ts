import { clamp, quantize, sample } from './prng';
import type { ActorKind, Entity, Scenario, SensorKind, SensorReading, Track } from './types';

export const SENSORS: Record<SensorKind, { name: string; interval: number; range: number }> = {
  radar: { name: 'Radar', interval: 4, range: 4400 },
  eo: { name: 'Electro-optical', interval: 8, range: 3400 },
  ir: { name: 'Infrared', interval: 8, range: 3600 },
  acoustic: { name: 'Acoustic', interval: 12, range: 2900 },
  rf: { name: 'RF bearing', interval: 8, range: 4100 },
};

const SIGNATURE: Record<ActorKind, number> = { quadcopter: 0.64, fixed_wing: 0.9, fast_mover: 0.88, recon: 0.72, swarm: 0.68, bird_flock: 0.63, kite: 0.5, balloon: 0.7, helicopter: 1, friendly_uav: 0.7, clutter: 0.4, fiber_optic: 0.55 };

export function sensorStatus(scenario: Scenario, sensor: SensorKind, tick: number): 'online' | 'degraded' | 'offline' {
  const seconds = tick / 4;
  const active = scenario.sensor_degradations.filter(d => d.sensor === sensor && seconds >= d.start_s && seconds < d.start_s + d.dur_s);
  if (active.some(d => d.kind === 'dropout')) return 'offline';
  if (active.length || (['radar', 'rf'].includes(sensor) && scenario.environment.em_conditions !== 'clean') || (sensor === 'eo' && (scenario.environment.time_of_day === 'night' || scenario.environment.weather === 'fog')) || (sensor === 'acoustic' && scenario.environment.weather === 'wind')) return 'degraded';
  return 'online';
}

export function detectionProbability(scenario: Scenario, entity: Entity, sensor: SensorKind, tick: number): number {
  if (sensorStatus(scenario, sensor, tick) === 'offline') return 0;
  const range = Math.hypot(entity.x, entity.y);
  if (range > SENSORS[sensor].range || (entity.kind === 'clutter' && sensor !== 'radar')) return 0;
  const env = scenario.environment;
  let p = 0.98 - range / (SENSORS[sensor].range * 2.3);
  // Wire-guided intruders carry no jamable control link: electromagnetic conditions
  // do not degrade their radar detectability (gameplay mirror of fiber-optic FPVs).
  if (sensor === 'radar') p *= SIGNATURE[entity.kind] * (entity.kind === 'fiber_optic' ? 1 : env.em_conditions === 'jammed' ? 0.4 : env.em_conditions === 'high_clutter' ? 0.72 : 1);
  if (sensor === 'eo') p *= (env.time_of_day === 'night' ? 0.12 : env.time_of_day === 'dusk' ? 0.72 : 1) * (env.weather === 'fog' ? 0.3 : env.weather === 'glare' ? 0.6 : 1);
  if (sensor === 'ir') p *= (env.time_of_day === 'night' ? 1 : 0.8) * (['rain', 'fog'].includes(env.weather) ? 0.74 : 1);
  if (sensor === 'acoustic') p *= (env.weather === 'wind' ? 0.25 : 0.85) * (['quadcopter', 'swarm', 'friendly_uav', 'fiber_optic'].includes(entity.kind) ? 1.12 : 0.6);
  // Wire-guided intruders emit no control link — only weak video-link leakage,
  // so RF stays quiet for them in every EM condition.
  if (sensor === 'rf') p *= entity.kind === 'fiber_optic' ? 0.12 : ['bird_flock', 'kite', 'balloon'].includes(entity.kind) ? 0.04 : env.em_conditions === 'clean' ? 0.9 : 0.45;
  if (env.weather === 'rain') p *= 0.82;
  const masked = (env.terrain === 'urban' || env.terrain === 'mountain') && Math.sin(entity.phase + tick / 120) > 0.45;
  if (masked && ['radar', 'eo', 'ir'].includes(sensor)) p *= 0.48;
  if (scenario.sensor_degradations.some(d => d.sensor === sensor && d.kind === 'noise' && tick / 4 >= d.start_s && tick / 4 < d.start_s + d.dur_s)) p *= 0.55;
  return quantize(clamp(p, 0, 0.97));
}

export function detect(scenario: Scenario, entity: Entity, sensor: SensorKind, tick: number): (SensorReading & { x: number; y: number }) | null {
  if (tick % SENSORS[sensor].interval !== 0) return null;
  const probability = detectionProbability(scenario, entity, sensor, tick);
  if (!probability) return null;
  if (sample(scenario.seed, entity.id, sensor, tick, 'detect') > probability) return null;
  const range = Math.hypot(entity.x, entity.y);
  const bearingOnly = sensor === 'acoustic' || sensor === 'rf';
  const noise = (25 + range * 0.035) * (sensorStatus(scenario, sensor, tick) === 'degraded' ? 3 : 1);
  const confidence = quantize(clamp(0.55 + probability * 0.4 - (bearingOnly ? 0.1 : 0), 0.2, 0.95));
  let evidence = 'Moving return · identity unconfirmed';
  let identified_type: ActorKind | undefined;
  let iff = false;
  if (sensor === 'radar') evidence = `${SIGNATURE[entity.kind] < 0.75 ? 'Compact' : 'Broad'} return · ${entity.speed > 30 ? 'fast' : 'low-speed'} movement`;
  if (sensor === 'eo' || sensor === 'ir') {
    const visual: Record<ActorKind, string> = { quadcopter: 'Multi-rotor silhouette', fixed_wing: 'Elongated fixed-wing profile', fast_mover: 'Fast, steady fixed-wing profile', recon: 'Compact platform · persistent orbit', swarm: 'Multiple compact, correlated returns', bird_flock: 'Irregular wingbeats · changing formation', kite: 'Tether-like motion · fabric silhouette', balloon: 'Rounded profile · passive drift', helicopter: 'Broad rotor profile · sustained movement', friendly_uav: 'Multi-rotor silhouette', clutter: 'No corresponding visual return', fiber_optic: 'Compact multi-rotor · thin tether-like line' };
    evidence = `${sensor === 'ir' ? 'Thermal' : 'Visual'}: ${visual[entity.kind]}`;
    if (confidence > 0.65) identified_type = entity.kind === 'friendly_uav' ? 'quadcopter' : entity.kind;
  }
  if (sensor === 'acoustic') evidence = ['bird_flock', 'kite', 'balloon'].includes(entity.kind) ? 'Ambiguous ambient cue · no steady motor pattern' : 'Periodic motor-like cue · bearing only';
  if (sensor === 'rf') evidence = entity.kind === 'fiber_optic' ? 'No control-link emission · faint video-link leakage only' : 'Intermittent emitter cue · bearing only';
  if (entity.iff && (sensor === 'rf' || sensor === 'radar') && tick - entity.spawn_tick >= 16) { iff = true; evidence = 'Authenticated exercise IFF · friendly identity'; identified_type = entity.kind; }
  const angle = Math.atan2(entity.x, -entity.y) + (sample(scenario.seed, entity.id, sensor, tick, 'bearing') - 0.5) * 0.14;
  return {
    tick, confidence, evidence, ...(identified_type ? { identified_type } : {}), iff, bearing_only: bearingOnly,
    x: quantize(bearingOnly ? Math.sin(angle) * 2700 : entity.x + (sample(scenario.seed, entity.id, sensor, tick, 'x') - 0.5) * noise),
    y: quantize(bearingOnly ? -Math.cos(angle) * 2700 : entity.y + (sample(scenario.seed, entity.id, sensor, tick, 'y') - 0.5) * noise),
  };
}

export function trackConfidence(track: Track, tick: number): number {
  return quantize(track.confidence * clamp(1 - (tick - track.last_seen) / 100, 0.05, 1));
}
