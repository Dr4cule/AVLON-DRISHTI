import { replay } from '../engine';
import { profileFromSessions } from '../adaptive';
import type { Dimension, Mistake, SessionRecord } from '../types';
import { extractFeatures } from './features';
import { predict, uncertaintyBand } from './model';

export interface AiModelView {
  predictedClass: string;
  confidence: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Top-3 signed feature contributions, human-readable names. */
  topEvidence: { name: string; value: number }[];
  sensorLines: string[];
}

export interface AiSessionAnalysis {
  overall: number;
  /** Null when the session gives the AI nothing to work with. */
  opportunity: string | null;
  whatHappened: string | null;
  evidence: string[];
  modelView: AiModelView | null;
  lesson: string | null;
  suggestedFocus: Dimension | null;
  mistakeTruth: 'hostile' | 'friendly' | 'benign' | null;
  mistakeTick: number | null;
}

const LESSONS: Record<Mistake['category'], string> = {
  classification: 'Delay classification when evidence is contradictory — record "unknown" until independent cues agree.',
  detection: 'Acknowledge new observations promptly; keep a regular scan of unacknowledged contacts.',
  decision: 'Match the response to the context, and reassess the response when classification or context changes.',
  roe: 'Check identification, evidence confidence, civilian zones, and the warning ladder before any active response.',
  reasoning: 'Choose the recorded reason that matches the actual evidence path you followed.',
  timing: 'Review when the contact first became detectable versus when action was available — decide earlier, not faster.',
};

const SENSOR_LABELS: Record<string, string> = {
  radar: 'Radar',
  eo: 'EO camera',
  ir: 'Infrared',
  acoustic: 'Acoustic',
  rf: 'RF bearing',
};

function prettyFeature(name: string): string {
  return name.replace(/_/g, ' ');
}

/**
 * Evidence-based session analysis. Every string is derived from the recorded
 * event log, the score report, or the threat model's view of a replayed tick.
 * Nothing is invented: if the evidence is unavailable, fields are null and the
 * UI says so instead of guessing.
 */
export function analyzeSession(record: SessionRecord, history: SessionRecord[]): AiSessionAnalysis {
  const empty: AiSessionAnalysis = {
    overall: record.report.total,
    opportunity: null,
    whatHappened: null,
    evidence: [],
    modelView: null,
    lesson: null,
    suggestedFocus: null,
    mistakeTruth: null,
    mistakeTick: null,
  };
  const mistake =
    record.report.mistakes.find(m => m.severity === 'critical') ?? record.report.mistakes[0] ?? null;
  if (!mistake) return empty;

  const profile = profileFromSessions(record.user_id, [...history, record]);
  const actorTruth = record.report.actors.find(a => a.actor_id === mistake.actor_id)?.truth ?? null;

  const analysis: AiSessionAnalysis = {
    ...empty,
    opportunity: `${mistake.category} under ${describeContext(record)}`,
    whatHappened: mistake.message,
    suggestedFocus: profile.weakest,
    mistakeTruth: actorTruth,
    mistakeTick: mistake.tick,
    lesson: LESSONS[mistake.category],
  };

  try {
    const tick = Math.min(mistake.tick, record.end_tick);
    const sim = replay(
      record.scenario,
      record.actions.filter(a => a.tick <= tick),
      tick,
      false,
    );
    const track = sim.state.tracks[mistake.actor_id];
    if (!track) return analysis;
    const features = extractFeatures(track, record.scenario, tick);
    const assessment = predict(features);
    const topEvidence = (Object.entries(assessment.evidence) as [string, number][])
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([name, value]) => ({ name: prettyFeature(name), value }));
    const sensorLines = record.scenario.sensors.map(sensor => {
      const reading = track.sensors[sensor];
      const fresh = reading !== undefined && tick - reading.tick <= 12;
      return `${SENSOR_LABELS[sensor]} confidence was ${fresh ? `${Math.round(reading.confidence * 100)}%` : 'unavailable'}${reading?.identified_type && fresh ? ` (${String(reading.identified_type).replace(/_/g, ' ')})` : ''}`;
    });
    analysis.modelView = {
      predictedClass: assessment.predictedClass,
      confidence: assessment.confidence,
      band: uncertaintyBand(assessment.uncertainty),
      topEvidence,
      sensorLines,
    };
    analysis.evidence = sensorLines;
  } catch {
    // Replay or prediction failed: keep the scorer-derived fields, leave the
    // model view empty rather than fabricating it.
  }
  return analysis;
}

function describeContext(record: SessionRecord): string {
  const tags = record.scenario.difficulty_tags;
  const parts: string[] = [];
  if ((tags.degraded_sensors ?? 0) >= 3) parts.push('degraded sensors');
  else if ((tags.night ?? 0) >= 3) parts.push('night operations');
  else if ((tags.swarm ?? 0) >= 3) parts.push('swarm pressure');
  else if ((tags.distractors ?? 0) >= 3) parts.push('heavy contact ambiguity');
  else parts.push('operational conditions');
  return parts.join(' + ');
}
