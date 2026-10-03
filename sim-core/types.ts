export const TICK_MS = 250;
export const ENGINE_VERSION = '1.0.0';
export const DIMENSIONS = ['night', 'swarm', 'degraded_sensors', 'distractors', 'urban', 'speed_pressure', 'roe_complexity'] as const;
export type Dimension = typeof DIMENSIONS[number];
export type Allegiance = 'hostile' | 'friendly' | 'benign';
export type Classification = Allegiance | 'unknown';
export type SensorKind = 'radar' | 'eo' | 'ir' | 'acoustic' | 'rf';
export type ActorKind = 'quadcopter' | 'fixed_wing' | 'fast_mover' | 'recon' | 'swarm' | 'bird_flock' | 'kite' | 'balloon' | 'helicopter' | 'friendly_uav' | 'clutter' | 'fiber_optic';
export type Behavior = 'approach' | 'loiter' | 'patrol_loop' | 'random_walk' | 'flocking' | 'saturation' | 'decoy_and_strike' | 'leader_follower' | 'probe_withdraw';
export type ResponseKind = 'observe' | 'warn' | 'electronic_jam' | 'spoof_redirect' | 'net_capture' | 'kinetic_intercept' | 'escalate_to_command';
export type Reason = 'insufficient_evidence' | 'protect_asset' | 'positive_identification' | 'friendly_iff' | 'benign_pattern' | 'roe_restriction';
export type Position = [number, number];

export interface ActorSpec {
  id: string; kind: ActorKind; allegiance: Allegiance; count: number; behavior: Behavior;
  spawn: { bearing_deg: number; range_m: number }; spawn_s: number; speed_mps: number;
  altitude_m: number; iff: boolean; civilian_area: boolean;
}
export interface Scenario {
  schema_version: '1.0'; id: string; title: string; description: string;
  source: 'scripted' | 'generated' | 'instructor'; seed: number;
  environment: { terrain: 'rural' | 'urban' | 'mountain'; time_of_day: 'day' | 'dusk' | 'night'; weather: 'clear' | 'fog' | 'rain' | 'wind' | 'glare'; em_conditions: 'clean' | 'jammed' | 'high_clutter' };
  assets: { id: string; type: 'command_post' | 'convoy' | 'checkpoint' | 'building'; pos: Position; value: number }[];
  sensors: SensorKind[];
  sensor_degradations: { sensor: SensorKind; kind: 'dropout' | 'noise'; start_s: number; dur_s: number }[];
  roe: { kinetic_allowed: boolean; jam_allowed_over_civilian_area: boolean; weapons_free_after_s: number | null; warning_required: boolean; min_confidence: number };
  actors: ActorSpec[]; ground_truth_tree: 'decision-v1'; difficulty: number;
  difficulty_tags: Record<Dimension, number>; duration_s: number;
}
export interface Action {
  tick: number; actor_id: string; type: 'acknowledge' | 'classify' | 'respond';
  classification?: Classification; drone_type?: ActorKind | 'unknown'; response?: ResponseKind; reason?: Reason;
}
export type EventType = 'ScenarioStarted' | 'ActorSpawned' | 'FirstDetectable' | 'SensorDetection' | 'SensorStatusChanged' | 'TrackAcknowledged' | 'TrackClassified' | 'ResponseOrdered' | 'ResponseRejected' | 'ActorResolved' | 'AssetDamaged' | 'ActorExited' | 'ScenarioEnded';
export type EventValue = string | number | boolean | null | readonly (string | number)[];
export interface SimEvent {
  readonly seq: number; readonly tick: number; readonly t_ms: number; readonly type: EventType;
  readonly actor_id: string | null; readonly payload: Readonly<Record<string, EventValue>>;
}
export interface Entity {
  id: string; label: string; group: string; kind: ActorKind; allegiance: Allegiance; behavior: Behavior;
  x: number; y: number; vx: number; vy: number; speed: number; altitude: number;
  iff: boolean; civilian_area: boolean; spawn_tick: number; first_detectable_tick: number | null;
  status: 'pending' | 'active' | 'resolved' | 'exited' | 'impacted'; phase: number;
}
export interface SensorReading {
  tick: number; confidence: number; evidence: string; identified_type?: ActorKind; iff?: boolean; bearing_only?: boolean;
}
export interface Track {
  id: string; label: string; x: number; y: number; bearing: number; estimated_speed: number; estimated_altitude: number;
  confidence: number; first_seen: number; last_seen: number; sensors: Partial<Record<SensorKind, SensorReading>>;
  classification: Classification; drone_type: ActorKind | 'unknown'; acknowledged_at: number | null;
  warned_at: number | null; resolved: boolean; bearing_only: boolean; civilian_area: boolean; trail: { x: number; y: number; tick: number }[];
}
export interface EffectorState { charges: number; ready_at: number }
export interface WorldState {
  tick: number; ended: boolean; entities: Entity[]; tracks: Record<string, Track>;
  asset_health: Record<string, number>; effectors: Record<ResponseKind, EffectorState>;
  sensor_status: Partial<Record<SensorKind, 'online' | 'degraded' | 'offline'>>;
}
export interface MapContact {
  id: string; label: string; x: number; y: number; classification: Classification;
  confidence: number; stale: boolean; resolved: boolean; trail: { x: number; y: number; tick: number }[];
}
export interface DecisionNode { name: string; passed: boolean; detail: string; points: number }
export interface ActorScore {
  actor_id: string; label: string; truth: Allegiance; classification: Classification;
  score: number; nodes: DecisionNode[]; ideal_path: string[];
}
export interface Mistake {
  tick: number; actor_id: string; category: 'detection' | 'classification' | 'decision' | 'roe' | 'reasoning' | 'timing';
  severity: 'info' | 'warning' | 'critical'; message: string; recommendation: string;
}
export interface ScoreReport {
  version: '1.0'; total: number; grade: 'Distinguished' | 'Proficient' | 'Developing' | 'Needs practice';
  metrics: { detection: number; classification: number; decision: number; outcome: number; reasoning: number };
  actors: ActorScore[]; mistakes: Mistake[]; confusion_matrix: number[][]; detection_mean_s: number | null;
  asset_health: number; event_hash: string; duration_s: number;
  completion: number; provisional: boolean;
}
export interface SessionRecord {
  id: string; user_id: string; scenario: Scenario; mode: 'training' | 'assessment';
  started_at: string; ended_at: string; end_tick: number; actions: Action[]; report: ScoreReport;
  engine_version: string; synthetic: boolean;
}
export interface User { id: string; name: string; role: 'trainee' | 'instructor'; unit_id: string; synthetic: boolean }
export interface RunJournal {
  id: string; user_id: string; scenario: Scenario; mode: 'training' | 'assessment';
  started_at: string; tick: number; actions: Action[]; engine_version: string; finished?: boolean;
}
