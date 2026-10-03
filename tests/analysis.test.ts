import { describe, expect, it } from 'vitest';
import { replay } from '../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { runBaseline } from '../sim-core/baseline';
import { scoreSimulation } from '../sim-core/scoring';
import { ENGINE_VERSION, type SessionRecord } from '../sim-core/types';
import { analyzeSession } from '../sim-core/threat/analysis';

const base = SCRIPTED_SCENARIOS[0];

function recordFor(actions: SessionRecord['actions'], endTick: number, id = 'test-session'): SessionRecord {
  const sim = replay(base, actions, endTick);
  return {
    id,
    user_id: 'operator',
    scenario: base,
    mode: 'training',
    started_at: '2026-09-20T10:00:00.000Z',
    ended_at: '2026-09-20T10:05:00.000Z',
    end_tick: endTick,
    actions: [...actions],
    report: scoreSimulation(sim),
    engine_version: ENGINE_VERSION,
    synthetic: false,
  };
}

describe('AAR AI analysis', () => {
  it('explains a benign-as-hostile mistake from recorded evidence', () => {
    const actions: SessionRecord['actions'] = [
      { tick: 80, actor_id: 'C2', type: 'acknowledge' },
      { tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' },
      { tick: 80, actor_id: 'C2', type: 'respond', response: 'electronic_jam', reason: 'protect_asset' },
    ];
    const record = recordFor(actions, base.duration_s * 4);
    const analysis = analyzeSession(record, []);
    // Ground truth stays authoritative: the mistake really was on a benign contact.
    expect(analysis.mistakeTruth).toBe('benign');
    expect(analysis.mistakeTick).toBe(80);
    expect(analysis.opportunity).toContain('classification');
    // Scorer's own words are reused, not invented.
    expect(analysis.whatHappened).toBe(record.report.mistakes.find(m => m.severity === 'critical')?.message ?? analysis.whatHappened);
    expect(analysis.lesson).toContain('contradictory');
    // The model view reconstructs what the advisory model estimated at that tick.
    expect(analysis.modelView).not.toBe(null);
    expect(analysis.modelView!.topEvidence.length).toBeGreaterThan(0);
    expect(analysis.evidence.length).toBeGreaterThan(0);
    // Suggested focus is a real skill dimension derived from the skill profile.
    expect(analysis.suggestedFocus).toBeTruthy();
  });
  it('says nothing to analyze when the scorer recorded no mistakes', () => {
    const { simulation } = runBaseline(base);
    const record = recordFor([...simulation.actions], simulation.state.tick, 'clean-session');
    // Baseline is imperfect; force the empty case through a perfect report instead.
    const clean = { ...record, report: { ...record.report, mistakes: [] } };
    const analysis = analyzeSession(clean, []);
    expect(analysis.overall).toBe(record.report.total);
    expect(analysis.opportunity).toBe(null);
    expect(analysis.whatHappened).toBe(null);
    expect(analysis.modelView).toBe(null);
    expect(analysis.lesson).toBe(null);
  });
  it('never fabricates a model view when the track cannot be reconstructed', () => {
    const actions: SessionRecord['actions'] = [
      { tick: 80, actor_id: 'C2', type: 'acknowledge' },
      { tick: 80, actor_id: 'C2', type: 'classify', classification: 'hostile', drone_type: 'quadcopter' },
    ];
    const record = recordFor(actions, base.duration_s * 4);
    // Corrupt the actor id so no track exists at the mistake tick.
    const broken = {
      ...record,
      report: {
        ...record.report,
        mistakes: record.report.mistakes.map(m => ({ ...m, actor_id: 'NOPE' })),
      },
    };
    const analysis = analyzeSession(broken, []);
    expect(analysis.modelView).toBe(null);
    expect(analysis.evidence).toEqual([]);
    // Scorer-derived fields still work.
    expect(analysis.whatHappened).toBeTruthy();
  });
});
