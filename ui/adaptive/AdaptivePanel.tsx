import { useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, Check, ShieldCheck } from 'lucide-react';
import { DIMENSIONS, type Scenario } from '../../sim-core/types';
import { DIMENSION_LABELS } from '../copy';
import type { Dimension } from '../../sim-core/types';
import { apiRequest } from '../lib/api';

interface Skill { dimension: string; mean: number; uncertainty: number; sessions: number }
interface ProfileResp { profile: { skills: Record<string, Skill>; weakest: string; cold_start: boolean }; calibration: Record<number, { attempts: number; success_rate: number | null }> }

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
        {DIMENSIONS.map(d => { const s = data.profile.skills[d]; return <div key={d} className="skill-row"><span>{DIMENSION_LABELS[d]}</span><div><i style={{ width: `${s.mean * 100}%` }} /></div><strong>{Math.round(s.mean * 100)}%</strong><small>±{Math.round(s.uncertainty * 100)}</small></div>; })}
        <p className="fine-print">Beta(a,b) per dimension, init 2/2. Success ≥70 adds tag-weight to a, else to b. Mean = a/(a+b). Uncertainty = 1/(a+b). Synthetic and provisional sessions excluded. This is a practice heuristic, not a validated readiness rating.</p>
      </div>
    </section>
    <section className="panel"><div className="panel-header"><div className="panel-title"><Check size={15} /><h2>Next challenge</h2></div></div>
      <div className="panel-content">
        <p className="briefing-description">Weakest: <strong>{DIMENSION_LABELS[data.profile.weakest as Dimension]}</strong>. Target ~68% success at the edge of ability.</p>
        {data.profile.cold_start && onBrowse && <div className="inline-note amber"><ShieldCheck size={12} /> No completed exercises yet — estimates start at 50% for everyone. <button className="button secondary small" onClick={onBrowse}>Start your first exercise <ArrowRight size={12} /></button></div>}
        <div className="calibration-table">{[1, 2, 3, 4, 5].map(d => <span key={d}>L{d}: {data.calibration[d]?.success_rate === null ? '—' : `${Math.round(data.calibration[d].success_rate! * 100)}% (${data.calibration[d].attempts})`}</span>)}</div>
        <button className="button primary full-width" disabled={busy} onClick={recommend}>{busy ? 'Selecting…' : 'Recommend my next exercise'}</button>
        {rec && <div className="generated-result"><div><Check size={18} /><div><span className="eyebrow">RECOMMENDED</span><h3>{rec.scenario.title}</h3></div><span className="tag">L{rec.difficulty}</span></div>{rec.rationale.map((r: string) => <p key={r}>{r}</p>)}<button className="button secondary full-width" onClick={() => onLaunch(rec.scenario, 'training')}>Launch L{rec.difficulty} · {rec.focus.replaceAll('_', ' ')} <ArrowRight size={14} /></button></div>}
      </div>
    </section>
  </div>;
}
