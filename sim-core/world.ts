import { quantize, sample } from './prng';
import { TICK_MS, type Entity, type Scenario } from './types';

export function createEntities(scenario: Scenario): Entity[] {
  const entities: Entity[] = [];
  for (const actor of scenario.actors) {
    for (let i = 0; i < actor.count; i++) {
      const angle = (actor.spawn.bearing_deg + (i - (actor.count - 1) / 2) * 4) * Math.PI / 180;
      const range = actor.spawn.range_m + (i % 3) * 35;
      entities.push({
        id: actor.count === 1 ? actor.id : `${actor.id}-${i + 1}`,
        label: `TRK-${String(entities.length + 1).padStart(2, '0')}`, group: actor.id,
        kind: actor.kind, allegiance: actor.allegiance, behavior: actor.behavior,
        x: quantize(Math.sin(angle) * range), y: quantize(-Math.cos(angle) * range),
        vx: 0, vy: 0, speed: actor.speed_mps, altitude: actor.altitude_m,
        iff: actor.iff, civilian_area: actor.civilian_area, spawn_tick: actor.spawn_s * 1000 / TICK_MS,
        first_detectable_tick: null, status: 'pending', phase: sample(scenario.seed, actor.id, i) * Math.PI * 2,
      });
    }
  }
  return entities;
}

export function moveEntity(entity: Entity, scenario: Scenario, tick: number, previous: readonly Entity[] = []): void {
  const target = scenario.assets[0].pos;
  const dx = target[0] - entity.x, dy = target[1] - entity.y;
  const range = Math.max(1, Math.hypot(dx, dy));
  const age = (tick - entity.spawn_tick) * TICK_MS / 1000;
  let vx = dx / range, vy = dy / range;
  if (['loiter', 'patrol_loop', 'random_walk', 'probe_withdraw'].includes(entity.behavior) || entity.allegiance !== 'hostile') {
    const tangent = Math.atan2(dy, dx) + Math.PI / 2;
    vx = Math.cos(tangent); vy = Math.sin(tangent);
    if (entity.behavior === 'random_walk') { vx = Math.cos(entity.phase + age / 18); vy = Math.sin(entity.phase + age / 23); }
    if (entity.behavior === 'probe_withdraw' && age > 40) { vx = -dx / range; vy = -dy / range; }
    if (entity.behavior === 'loiter' && entity.kind === 'fixed_wing' && age > 45) { vx = dx / range; vy = dy / range; }
  }
  if (entity.behavior === 'decoy_and_strike' && age < 20) { vx = -dy / range; vy = dx / range; }
  if (['flocking', 'leader_follower', 'saturation'].includes(entity.behavior)) {
    const group = previous.filter(e => e.group === entity.group && e.id !== entity.id && e.status === 'active');
    for (const neighbor of group) {
      const nx = entity.x - neighbor.x, ny = entity.y - neighbor.y;
      const d = Math.max(1, Math.hypot(nx, ny));
      if (d < 160) { vx += nx / d * 0.35; vy += ny / d * 0.35; }
      if (d < 650 && entity.behavior === 'flocking') {
        vx += neighbor.vx / Math.max(1, neighbor.speed) * 0.08 - nx / 3000;
        vy += neighbor.vy / Math.max(1, neighbor.speed) * 0.08 - ny / 3000;
      }
    }
    const leader = previous.find(e => e.group === entity.group);
    if (entity.behavior === 'leader_follower' && leader && leader.status === 'resolved') { vx = -dy / range * 0.55; vy = dx / range * 0.55; }
  }
  const magnitude = Math.max(1, Math.hypot(vx, vy)); vx /= magnitude; vy /= magnitude;
  entity.vx = quantize(vx * entity.speed); entity.vy = quantize(vy * entity.speed);
  entity.x = quantize(entity.x + entity.vx * TICK_MS / 1000);
  entity.y = quantize(entity.y + entity.vy * TICK_MS / 1000);
}
