import { useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, Check, ShieldCheck } from 'lucide-react';
import { DIMENSIONS, type Scenario } from '../../sim-core/types';
import { DIMENSION_LABELS } from '../copy';
import type { Dimension } from '../../sim-core/types';
import { apiRequest } from '../lib/api';

interface Skill { dimension: string; mean: number; uncertainty: number; sessions: number }
interface ProfileResp {
  profile: { skills: Record<string, Skill>; weakest: string; cold_start: boolean };
  calibration: Record<number, { attempts: number; success_rate: number | null }>;
  patterns?: string[];
}
interface Challenge { night: boolean; terrain: string; irDegradation: string; sensorConflict: string; contactLoad: string; ambiguity: string }
interface Tactic { behavior: string; rationale: string }
interface Delta { dimension: string; before: number; after: number }

function ChallengeModifiers({ challenge, tactics }: { challenge: Challenge; tactics: Tactic[] }) {
  const rows: [string, string][] = [
    ['Night operations', challenge.night ? 'yes' : 'no'],
    ['Degraded IR', challenge.irDegradation],
    ['Sensor conflict', challenge.sensorConflict],
    ['Contact load', challenge.contactLoad],
    ['Ambiguity', challenge.ambiguity],
  ];
  return (
    <div className="ai-row">
      <span>SCENARIO MODIFIERS · WHY THIS EXERCISE</span>
      <ul>
        {rows.map(([k, v]) => (
          <li key={k}>
            {k}: <strong>{v}</strong>
          </li>
        ))}
        {tactics.map(t => (
          <li key={t.behavior}>
            Adversary emphasis: {t.behavior.replace(/_/g, ' ')} — {t.rationale}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdaptivePanel({ onLaunch, onBrowse }: { onLaunch: (s: Scenario, mode: 'training' | 'assessment') => void; onBrowse?: () => void }) {
  const [data, setData] = useState<ProfileResp | null>(null);
  const [rec, setRec] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { apiRequest<ProfileResp>('/adaptive/profile').then(setData).catch(e => setError(e.message)); }, []);
  const recommend = async () => {
    setBusy(true); setError('');
    try {
      // No explicit seed: the server derives one deterministically from your history,
      // so identical training state always yields the identical recommendation.
      const r = await apiRequest<any>('/adaptive/recommend', 'POST', {});
      setRec(r);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  if (error) return <div className="panel"><div className="panel-content"><p className="error-message" role="alert">{error}</p><button className="button secondary small" onClick={() => window.location.reload()}>Retry</button></div></div>;
  if (!data) return <div className="panel" aria-busy="true"><div className="panel-content skeleton-block"><span /><span /><span /><span /><span className="muted">Loading skill evidence…</span></div></div>;
  return <div className="adaptive-grid">
    <section className="panel"><div className="panel-header"><div className="panel-title"><BrainCircuit size={16} /><h2>Skill evidence</h2></div><span className={`tag ${data.profile.cold_start ? 'amber' : 'gray'}`}>{data.profile.cold_start ? 'COLD START' : 'ESTABLISHED'}</span></div>
      <div className="panel-content">
        {DIMENSIONS.map(d => { const s = data.profile.skills[d]; if (!s || !Number.isFinite(s.mean) || !Number.isFinite(s.uncertainty)) return null; return <div key={d} className="skill-row"><span>{DIMENSION_LABELS[d]}</span><div><i style={{ width: `${s.mean * 100}%` }} /></div><strong>{Math.round(s.mean * 100)}%</strong><small>±{Math.round(s.uncertainty * 100)}</small></div>; })}
        <p className="fine-print">Beta(a,b) per dimension, init 2/2. Success ≥70 adds tag-weight to a, else to b. Mean = a/(a+b). Uncertainty = 1/(a+b). Synthetic and provisional sessions excluded. This is a practice heuristic, not a validated readiness rating.</p>
      </div>
    </section>
    <section className="panel"><div className="panel-header"><div className="panel-title"><Check size={15} /><h2>Next challenge</h2></div><span className="tag cyan">AI TRAINING ANALYSIS</span></div>
      <div className="panel-content">
        <p className="briefing-description">Weakest: <strong>{DIMENSION_LABELS[data.profile.weakest as Dimension] ?? 'Unknown dimension'}</strong>. Target ~68% success at the edge of ability.</p>
        {data.profile.cold_start && onBrowse && <div className="inline-note amber"><ShieldCheck size={12} /> No completed exercises yet — estimates start at 50% for everyone. <button className="button secondary small" onClick={onBrowse}>Start your first exercise <ArrowRight size={12} /></button></div>}
        {data.patterns !== undefined && data.patterns.length > 0 && <div className="ai-row"><span>DETECTED PATTERNS</span><ul>{data.patterns.map((p, i) => <li key={`${p}-${i}`}>{p}</li>)}</ul></div>}
        <div className="calibration-table">{[1, 2, 3, 4, 5].map(d => { const c = data.calibration[d]; return <span key={d}>L{d}: {c?.success_rate == null ? '—' : `${Math.round(c.success_rate * 100)}% (${c.attempts ?? '—'})`}</span>; })}</div>
        <button className="button primary full-width" disabled={busy} onClick={recommend}>{busy ? 'Selecting…' : 'Recommend my next exercise'}</button>
        {rec && rec.scenario && <div className="generated-result"><div><Check size={18} /><div><span className="eyebrow">AI RECOMMENDATION</span><h3>{rec.scenario.title ?? 'Recommended exercise'}</h3></div><span className="tag">L{rec.difficulty}</span></div>{Array.isArray(rec.rationale) && rec.rationale.map((r: string, i: number) => <p key={`${r}-${i}`}>{r}</p>)}
          {rec.challenge && <ChallengeModifiers challenge={rec.challenge as Challenge} tactics={(rec.tactics ?? []) as Tactic[]} />}
          {Array.isArray(rec.skillDeltas) && (rec.skillDeltas as Delta[]).filter(d => Number.isFinite(d.before) && Number.isFinite(d.after)).length > 0 && <div className="ai-row"><span>AI LEARNING UPDATE · SINCE YOUR LAST SESSION</span><ul>{(rec.skillDeltas as Delta[]).filter(d => Number.isFinite(d.before) && Number.isFinite(d.after)).map(d => <li key={d.dimension}>{DIMENSION_LABELS[d.dimension as Dimension] ?? d.dimension}: {Math.round(d.before * 100)}% → {Math.round(d.after * 100)}%</li>)}</ul></div>}
          <span className="eyebrow">AI SCENARIO GENERATION · BASELINE-CHECKED</span>
          <button className="button secondary full-width" onClick={() => onLaunch(rec.scenario, 'training')}>Launch L{rec.difficulty} · {typeof rec.focus === 'string' ? rec.focus.replaceAll('_', ' ') : 'recommended focus'} <ArrowRight size={14} /></button>
          <p className="fine-print">AI recommends — you decide whether to launch. The exercise passed the same fairness gate as every other scenario.</p>
        </div>}
      </div>
    </section>
  </div>;
}
