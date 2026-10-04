import type { Simulation } from './engine';
import { clamp, quantize } from './prng';
import { EFFECTORS, reasonIsAppropriate } from './roe';
import type { ActorScore, Classification, Mistake, Reason, ResponseKind, ScoreReport, SimEvent } from './types';

export const SCORE_WEIGHTS = { detection: 0.2, classification: 0.25, decision: 0.3, outcome: 0.15, reasoning: 0.1 };
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const pct = (n: number) => Math.round(clamp(n, 0, 100));

/** Score only immutable facts. No client-supplied score, wall clock, or UI state is trusted. */
export function scoreSimulation(sim: Simulation): ScoreReport {
  const byActor = new Map<string, SimEvent[]>();
  for (const event of sim.events) if (event.actor_id) { const list = byActor.get(event.actor_id) ?? []; list.push(event); byActor.set(event.actor_id, list); }
  const mistakes: Mistake[] = [];
  const actors: ActorScore[] = [];
  const confusion = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  const detected: number[] = [], classificationScores: number[] = [], decisionScores: number[] = [], reasoningScores: number[] = [], outcomeScores: number[] = [], delays: number[] = [];
  const addMistake = (actor_id: string, tick: number, category: Mistake['category'], severity: Mistake['severity'], message: string, recommendation: string) => mistakes.push({ actor_id, tick, category, severity, message, recommendation });
  const classOrder: Classification[] = ['hostile', 'friendly', 'benign', 'unknown'];
  for (const [id, events] of byActor) {
    const spawned = events.find(e => e.type === 'ActorSpawned');
    const detectable = events.find(e => e.type === 'FirstDetectable');
    if (!spawned || !detectable) continue;
    const truth = spawned.payload.allegiance as 'hostile' | 'friendly' | 'benign';
    const label = String(spawned.payload.label);
    const ack = events.find(e => e.type === 'TrackAcknowledged');
    const classes = events.filter(e => e.type === 'TrackClassified');
    const responses = events.filter(e => e.type === 'ResponseOrdered' || e.type === 'ResponseRejected');
    const firstActive = responses.find(e => EFFECTORS[e.payload.response as ResponseKind]?.active);
    // Identity is what the trainee believed at decision time: only classifications recorded
    // before the first active response count. A classification made after shooting must not
    // retroactively justify the shot.
    const identity = firstActive ? classes.filter(e => e.seq < firstActive.seq).at(-1) : classes.at(-1);
    const classification = (identity?.payload.classification ?? 'unknown') as Classification;
    const correct = classification === truth;
    const delay = ack ? Number(ack.payload.delay_s) : null;
    const detection = delay === null ? 0 : pct(100 - Math.max(0, delay - 3) / Math.max(8, 26 - sim.scenario.difficulty * 3) * 100);
    if (delay !== null) delays.push(delay);
    if (!ack) addMistake(id, sim.state.tick, 'detection', 'warning', `${label} was detectable but was not acknowledged.`, 'Acknowledge a new observation before moving to classification.');
    else if (detection < 65) addMistake(id, ack.tick, 'detection', 'warning', `${label} was acknowledged after ${delay?.toFixed(1)} seconds.`, 'Keep a regular scan of unacknowledged contacts.');

    const wrongIdentifications = classes.filter(e => e.payload.classification !== truth && e.payload.classification !== 'unknown');
    let classificationScore = (correct ? 80 : 0) + (identity?.payload.drone_type === spawned.payload.kind ? 20 : 0);
    classificationScore = pct(classificationScore - wrongIdentifications.reduce((penalty, e) => penalty + (e.payload.classification === 'hostile' && truth !== 'hostile' ? 20 : 8), 0));
    for (const event of wrongIdentifications) addMistake(id, event.tick, 'classification', event.payload.classification === 'hostile' && truth !== 'hostile' ? 'critical' : 'warning', `${label} was classified ${event.payload.classification}; the exercise truth was ${truth}.`, truth === 'friendly' ? 'Reconcile IFF and independent cues before treating a contact as hostile.' : truth === 'benign' ? 'Compare movement and visual cues; uncertainty is not evidence of hostility.' : 'Cross-check the contact using another sensor before settling on an allegiance.');
    if (!identity || classification === 'unknown') addMistake(id, sim.state.tick, 'classification', 'warning', `${label} remained unclassified.`, 'Record an allegiance and type when the available evidence supports them.');
    else if (correct && identity.payload.drone_type !== spawned.payload.kind) addMistake(id, identity.tick, 'classification', 'info', `${label}: allegiance was correct, but the type was ${identity.payload.drone_type}.`, `The simulated type was ${String(spawned.payload.kind).replaceAll('_', ' ')}. Compare the recorded visual cue.`);
    confusion[classOrder.indexOf(truth)][classOrder.indexOf(classification)]++;

    const orders = responses.filter(e => e.type === 'ResponseOrdered');
    const violations = responses.filter(e => e.type === 'ResponseRejected' && e.payload.roe_violation);
    const appropriate = mean(orders.map(e => e.payload.appropriate ? 100 : 0));
    const compliant = responses.length ? violations.length ? Math.max(0, 40 - (violations.length - 1) * 15) : 100 : 0;
    const timely = mean(orders.map(e => e.payload.timely ? 100 : 0));
    const wasted = responses.filter(e => e.type === 'ResponseRejected' && !e.payload.roe_violation).length;
    let decision = pct(appropriate * 0.5 + compliant / 3 + timely / 6 - Math.min(30, wasted * 5));
    // Only ordered (executed) effects count: a response ROE correctly blocked never happened.
    const harmfulAttempt = responses.some(e => e.type === 'ResponseOrdered' && EFFECTORS[e.payload.response as ResponseKind]?.active && truth !== 'hostile');
    if (harmfulAttempt) decision = Math.min(20, decision);
    const reasoning = pct(mean(responses.map(e => reasonIsAppropriate(e.payload.reason as Reason, truth, e.payload.response as ResponseKind) ? 100 : 0)));
    const resolved = events.some(e => e.type === 'ActorResolved');
    const impacted = events.some(e => e.type === 'AssetDamaged');
    const actorOutcome = truth === 'hostile' ? resolved ? 100 : impacted ? 0 : orders.some(e => e.payload.response === 'escalate_to_command') ? 50 : 30 : resolved ? 0 : 100;
    for (const event of violations) addMistake(id, event.tick, 'roe', 'critical', `${label}: ${String(event.payload.detail)}`, 'Follow the identification, confidence, zone, and warning gates before an active response.');
    for (const event of orders.filter(e => !e.payload.appropriate)) addMistake(id, event.tick, 'decision', 'critical', `${label}: ${String(event.payload.response).replaceAll('_', ' ')} did not match the exercise context.`, truth === 'hostile' ? 'Reassess the response when classification or context changes.' : 'A non-hostile contact calls for observation or escalation, not an active effect.');
    if (!responses.length) addMistake(id, sim.state.tick, 'decision', 'warning', `${label} had no recorded response.`, 'Record observation or escalation as a deliberate decision, including the reason.');
    if (impacted) { const event = events.find(e => e.type === 'AssetDamaged')!; addMistake(id, event.tick, 'timing', 'critical', `${label} reached the protected asset in the simulation.`, 'Review when the contact became detectable and when a justified response was available.'); }
    if (responses.length && reasoning < 70) addMistake(id, responses[0].tick, 'reasoning', 'warning', `${label}: the selected reason did not match the evidence or response.`, 'Choose the reason that explains the actual decision path.');
    for (const event of responses.filter(e => e.type === 'ResponseRejected' && !e.payload.roe_violation)) addMistake(id, event.tick, 'decision', 'info', `${label}: ${String(event.payload.detail)}`, 'Check abstract resource status and range before repeating an action.');

    const nodes = [
      { name: 'Detected', passed: !!ack, detail: ack ? `${delay?.toFixed(1)}s to acknowledgement` : 'No acknowledgement', points: quantize(detection * 0.2) },
      { name: 'Classified', passed: !!identity && classification !== 'unknown', detail: identity ? `${classification} · ${String(identity.payload.drone_type).replaceAll('_', ' ')}` : 'No classification recorded', points: 0 },
      { name: 'Correct identity', passed: correct, detail: `Exercise truth: ${truth} · ${String(spawned.payload.kind).replaceAll('_', ' ')}`, points: quantize(classificationScore * 0.25) },
      { name: 'Appropriate response', passed: appropriate >= 75 && !harmfulAttempt, detail: orders.length ? `${orders.length} recorded response${orders.length === 1 ? '' : 's'}` : 'No response recorded', points: quantize(appropriate * 0.15) },
      { name: 'ROE compliant', passed: responses.length > 0 && !violations.length, detail: violations.length ? `${violations.length} rule violation${violations.length === 1 ? '' : 's'} attempted` : responses.length ? 'All recorded responses passed rule gates' : 'Not assessed', points: quantize(compliant * 0.1) },
      { name: 'Timely', passed: timely >= 75, detail: impacted ? 'Contact reached the asset' : orders.length ? 'Response timing evaluated against simulation context' : 'No response timestamp', points: quantize(timely * 0.05) },
      { name: 'Effective', passed: actorOutcome >= 75, detail: truth !== 'hostile' ? resolved ? 'Non-hostile contact affected' : 'Non-hostile contact unharmed' : resolved ? 'Simulated threat resolved' : impacted ? 'Asset damaged' : 'Contact unresolved at review', points: quantize(actorOutcome * 0.15) },
      { name: 'Reasoning', passed: reasoning >= 75, detail: `${reasoning}% alignment with the decision context`, points: quantize(reasoning * 0.1) },
    ];
    const actorScore = pct(detection * .2 + classificationScore * .25 + decision * .3 + actorOutcome * .15 + reasoning * .1);
    actors.push({ actor_id: id, label, truth, classification, score: actorScore, nodes, ideal_path: ['Acknowledge', `${truth} / ${String(spawned.payload.kind).replaceAll('_', ' ')}`, truth === 'hostile' ? sim.scenario.roe.warning_required ? 'Warn, then check permitted response' : 'Check permitted response' : 'Observe / reconcile identity', 'Record reason', 'Review outcome'] });
    detected.push(detection); classificationScores.push(classificationScore); decisionScores.push(decision); reasoningScores.push(reasoning); outcomeScores.push(actorOutcome);
  }
  // Reconstruct asset outcomes from immutable events, weighted by protected value.
  const healthByAsset = Object.fromEntries(sim.scenario.assets.map(a => [a.id, 100]));
  for (const e of sim.events) if (e.type === 'AssetDamaged') healthByAsset[String(e.payload.asset_id)] = Number(e.payload.health);
  const totalValue = sim.scenario.assets.reduce((sum, a) => sum + a.value, 0);
  const assetHealth = sim.scenario.assets.reduce((sum, a) => sum + healthByAsset[a.id] * a.value, 0) / totalValue;
  const friendlyHarm = sim.events.filter(e => e.type === 'ActorResolved' && e.payload.friendly_harm).length;
  const collateral = sim.events.filter(e => e.type === 'ActorResolved' && e.payload.collateral).length;
  const metrics = { detection: pct(mean(detected)), classification: pct(mean(classificationScores)), decision: pct(mean(decisionScores)), outcome: pct((assetHealth + mean(outcomeScores)) / 2 - friendlyHarm * 30 - collateral * 15), reasoning: pct(mean(reasoningScores)) };
  const total = sim.actions.length ? pct(Object.entries(SCORE_WEIGHTS).reduce((sum, [key, weight]) => sum + metrics[key as keyof typeof metrics] * weight, 0)) : 0;
  mistakes.sort((a, b) => a.tick - b.tick || a.actor_id.localeCompare(b.actor_id) || a.category.localeCompare(b.category));
  return { version: '1.0', total, grade: total >= 90 ? 'Distinguished' : total >= 75 ? 'Proficient' : total >= 55 ? 'Developing' : 'Needs practice', metrics, actors, mistakes, confusion_matrix: confusion, detection_mean_s: delays.length ? quantize(mean(delays)) : null, asset_health: pct(assetHealth), event_hash: sim.eventHash(), duration_s: sim.state.tick / 4, completion: quantize(sim.state.tick / (sim.scenario.duration_s * 4)), provisional: sim.state.tick < sim.scenario.duration_s * 4 };
}
