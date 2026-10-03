import { createEntities, moveEntity } from './world';
import { detect, detectionProbability, sensorStatus, trackConfidence } from './sensors';
import { EFFECTORS, checkRoe, reasonIsAppropriate } from './roe';
import { clamp, quantize, sample, hashText } from './prng';
import { assertAction, assertScenario } from './validation';
import { TICK_MS, ENGINE_VERSION, type Action, type Entity, type EventType, type EventValue, type MapContact, type ResponseKind, type Scenario, type SimEvent, type Track, type WorldState } from './types';

/** Pure, headless simulation. Mutation is confined to this instance; events are immutable. */
export class Simulation {
  readonly scenario: Scenario;
  readonly state: WorldState;
  readonly events: SimEvent[] = [];
  readonly actions: Action[] = [];

  constructor(scenario: Scenario) {
    assertScenario(scenario);
    this.scenario = structuredClone(scenario);
    this.state = {
      tick: 0, ended: false, entities: createEntities(scenario), tracks: {},
      asset_health: Object.fromEntries(scenario.assets.map(a => [a.id, 100])),
      effectors: Object.fromEntries(Object.entries(EFFECTORS).map(([key, e]) => [key, { charges: e.charges, ready_at: 0 }])) as WorldState['effectors'],
      sensor_status: {},
    };
    this.emit('ScenarioStarted', null, { seed: scenario.seed, engine_version: ENGINE_VERSION });
    this.updateSensorsAndSpawns();
  }

  private emit(type: EventType, actor_id: string | null, payload: Record<string, EventValue>): void {
    for (const value of Object.values(payload)) if (Array.isArray(value)) Object.freeze(value);
    this.events.push(Object.freeze({ seq: this.events.length, tick: this.state.tick, t_ms: this.state.tick * TICK_MS, type, actor_id, payload: Object.freeze(payload) }));
  }

  private updateSensorsAndSpawns(): void {
    const { tick } = this.state;
    for (const sensor of this.scenario.sensors) {
      const status = sensorStatus(this.scenario, sensor, tick);
      if (status !== this.state.sensor_status[sensor]) {
        this.state.sensor_status[sensor] = status;
        this.emit('SensorStatusChanged', null, { sensor, status });
      }
    }
    for (const entity of this.state.entities) {
      if (entity.status === 'pending' && tick >= entity.spawn_tick) {
        entity.status = 'active';
        this.emit('ActorSpawned', entity.id, { x: entity.x, y: entity.y, kind: entity.kind, allegiance: entity.allegiance, label: entity.label });
      }
      if (entity.status !== 'active') continue;
      if (entity.first_detectable_tick === null && this.scenario.sensors.some(s => detectionProbability(this.scenario, entity, s, tick) >= 0.05)) {
        entity.first_detectable_tick = tick;
        this.emit('FirstDetectable', entity.id, {});
      }
      if (tick % 4 !== 0) continue;
      for (const sensor of this.scenario.sensors) {
        const reading = detect(this.scenario, entity, sensor, tick);
        if (!reading) continue;
        let track = this.state.tracks[entity.id];
        if (!track) {
          track = { id: entity.id, label: entity.label, x: reading.x, y: reading.y, bearing: 0, estimated_speed: 0, estimated_altitude: 0, confidence: 0, first_seen: tick, last_seen: tick, sensors: {}, classification: 'unknown', drone_type: 'unknown', acknowledged_at: null, warned_at: null, resolved: false, bearing_only: !!reading.bearing_only, civilian_area: entity.civilian_area, trail: [] };
          this.state.tracks[entity.id] = track;
        }
        const { x, y, ...evidence } = reading;
        track.sensors[sensor] = evidence;
        if (!reading.bearing_only || track.bearing_only) { track.x = x; track.y = y; }
        if (!reading.bearing_only) track.bearing_only = false;
        track.last_seen = tick;
        track.bearing = Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360);
        if (!reading.bearing_only) {
          track.estimated_speed = Math.round(entity.speed * (0.88 + sample(this.scenario.seed, entity.id, tick, 'speed') * 0.24));
          track.estimated_altitude = Math.round(entity.altitude * (0.82 + sample(this.scenario.seed, entity.id, tick, 'altitude') * 0.36));
        }
        const confidences = Object.values(track.sensors).filter(r => tick - r.tick <= 12).map(r => r.confidence);
        track.confidence = quantize(clamp(1 - confidences.reduce((p, c) => p * (1 - c * 0.86), 1), 0.05, 0.98));
        if (track.trail.at(-1)?.tick !== tick) track.trail.push({ x: track.x, y: track.y, tick });
        if (track.trail.length > 18) track.trail.shift();
        this.emit('SensorDetection', entity.id, { sensor, x: track.x, y: track.y, confidence: reading.confidence, evidence: reading.evidence, iff: reading.iff ?? false, identified_type: reading.identified_type ?? 'unknown', bearing_only: !!reading.bearing_only });
      }
    }
  }

  step(): void {
    if (this.state.ended) return;
    this.state.tick++;
    const previous = this.state.entities.map(e => ({ ...e }));
    for (const entity of this.state.entities) {
      if (entity.status !== 'active') continue;
      moveEntity(entity, this.scenario, this.state.tick, previous);
      const asset = this.scenario.assets[0];
      if (entity.allegiance === 'hostile' && Math.hypot(entity.x - asset.pos[0], entity.y - asset.pos[1]) < 260) {
        entity.status = 'impacted';
        if (this.state.tracks[entity.id]) this.state.tracks[entity.id].resolved = true;
        this.state.asset_health[asset.id] = Math.max(0, this.state.asset_health[asset.id] - 20);
        this.emit('AssetDamaged', entity.id, { asset_id: asset.id, health: this.state.asset_health[asset.id], damage: 20 });
      } else if (Math.hypot(entity.x, entity.y) > 5000) {
        entity.status = 'exited';
        if (this.state.tracks[entity.id]) this.state.tracks[entity.id].resolved = true;
        this.emit('ActorExited', entity.id, {});
      }
    }
    this.updateSensorsAndSpawns();
    if (this.state.tick >= this.scenario.duration_s * 4) this.finish();
  }

  dispatch(input: Action): { accepted: boolean; message: string } {
    assertAction(input);
    if (this.state.ended || input.tick !== this.state.tick) return { accepted: false, message: 'This action is outside the active simulation tick.' };
    const track = this.state.tracks[input.actor_id];
    const entity = this.state.entities.find(e => e.id === input.actor_id);
    if (!track || !entity || entity.status !== 'active' || track.resolved) return { accepted: false, message: 'Select an active sensor track.' };
    this.actions.push(Object.freeze({ ...input }));
    if (input.type === 'acknowledge') {
      if (track.acknowledged_at === null) {
        track.acknowledged_at = this.state.tick;
        this.emit('TrackAcknowledged', entity.id, { delay_s: (this.state.tick - (entity.first_detectable_tick ?? track.first_seen)) / 4 });
      }
      return { accepted: true, message: `${track.label} acknowledged.` };
    }
    if (input.type === 'classify') {
      track.classification = input.classification!; track.drone_type = input.drone_type!;
      this.emit('TrackClassified', entity.id, { classification: track.classification, drone_type: track.drone_type, correct: track.classification === entity.allegiance, type_correct: track.drone_type === entity.kind });
      return { accepted: true, message: `${track.label} classified ${track.classification}.` };
    }
    return this.respond(track, entity, input.response!, input.reason!);
  }

  private respond(track: Track, entity: Entity, response: ResponseKind, reason: NonNullable<Action['reason']>): { accepted: boolean; message: string } {
    const effector = EFFECTORS[response];
    const resource = this.state.effectors[response];
    const rule = checkRoe(this.scenario, track, response, this.state.tick, entity.civilian_area);
    let rejection = !rule.allowed ? rule.detail : '';
    if (!rejection && Math.hypot(track.x, track.y) > effector.range) rejection = 'Outside this abstract response’s simulation range.';
    if (!rejection && (resource.ready_at > this.state.tick || resource.charges <= 0)) rejection = 'Response resource is cooling down or depleted.';
    if (rejection) {
      this.emit('ResponseRejected', entity.id, { response, reason, detail: rejection, roe_violation: !rule.allowed });
      return { accepted: false, message: rejection };
    }
    resource.charges--; resource.ready_at = this.state.tick + effector.cooldown * 4;
    if (response === 'warn') track.warned_at = this.state.tick;
    const appropriate = entity.allegiance === 'hostile' ? response !== 'observe' || track.classification === 'unknown' : !effector.active;
    this.emit('ResponseOrdered', entity.id, { response, reason, appropriate, roe_compliant: true, reasoning_correct: reasonIsAppropriate(reason, entity.allegiance, response), timely: Math.hypot(entity.x, entity.y) > 400, active_response: effector.active, classification: track.classification, confidence: trackConfidence(track, this.state.tick) });
    if (effector.active) {
      const success = sample(this.scenario.seed, entity.id, this.state.tick, response, this.actions.length) < effector.probability;
      if (success) {
        entity.status = 'resolved'; track.resolved = true;
        this.emit('ActorResolved', entity.id, { response, friendly_harm: entity.allegiance === 'friendly', collateral: entity.allegiance === 'benign' });
      }
      return { accepted: true, message: success ? `${track.label}: response completed.` : `${track.label}: response had no effect. Reassess.` };
    }
    return { accepted: true, message: `${effector.label} recorded for ${track.label}.` };
  }

  finish(): void {
    if (this.state.ended) return;
    this.state.ended = true;
    this.emit('ScenarioEnded', null, { duration_s: this.state.tick / 4 });
  }

  contacts(truth = false): MapContact[] {
    if (truth) return this.state.entities.filter(e => e.status !== 'pending').map(e => ({ id: e.id, label: e.label, x: e.x, y: e.y, classification: e.allegiance, confidence: 1, stale: false, resolved: e.status !== 'active', trail: [] }));
    return Object.values(this.state.tracks).map(t => ({ id: t.id, label: t.label, x: t.x, y: t.y, classification: t.classification, confidence: trackConfidence(t, this.state.tick), stale: this.state.tick - t.last_seen > 16, resolved: t.resolved, trail: t.trail }));
  }

  eventHash(): string { return hashText(JSON.stringify(this.events)); }
}

export function replay(scenario: Scenario, actions: readonly Action[], endTick: number, finalize = true): Simulation {
  if (!Number.isInteger(endTick) || endTick < 0 || endTick > scenario.duration_s * 4) throw new Error('Invalid replay end tick.');
  const sim = new Simulation(scenario);
  let cursor = 0;
  for (let tick = 0; tick <= endTick; tick++) {
    if (tick > 0) sim.step();
    while (cursor < actions.length && actions[cursor].tick === tick) {
      sim.dispatch(actions[cursor]); cursor++;
    }
  }
  if (cursor !== actions.length) throw new Error('Actions must be ordered and within the replay interval.');
  if (finalize) sim.finish();
  return sim;
}
