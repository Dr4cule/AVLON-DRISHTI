import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { SessionRecord } from '../../sim-core/types';
import { TrendChart } from '../components/Charts';
import { exportSessions } from '../lib/exports';
import { apiRequest } from '../lib/api';

export function UnitDashboard({ sessions }: { sessions: SessionRecord[] }) {
  const [overview, setOverview] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [loadError, setLoadError] = useState('');
  useEffect(() => { apiRequest('/unit/overview').then(setOverview).catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Roster unavailable.')); }, [sessions.length]);
  const real = sessions.filter(s => !s.synthetic && (!filter || s.scenario.id.includes(filter)));
  const avg = real.length ? Math.round(real.reduce((n, s) => n + s.report.total, 0) / real.length) : null;
  const fails: Record<string, number> = {};
  for (const s of real) for (const m of s.report.mistakes) if (m.severity === 'critical') fails[`${m.category}`] = (fails[m.category] ?? 0) + 1;
  return <>
    <div className="trend-heading"><h3>Unit readiness — observed training evidence</h3><span className="tag gray">{real.length} REAL SESSIONS</span></div>
    <div className="metrics-grid">
      <div className="metric-card"><span>UNIT AVERAGE</span><strong>{avg ?? '—'}</strong><small>mean score, real sessions only</small></div>
      <div className="metric-card"><span>SESSIONS</span><strong>{real.length}</strong><small>real sessions · partials included, synthetics excluded</small></div>
      <div className="metric-card"><span>TOP FAILURE</span><strong className="metric-word">{Object.entries(fails).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}</strong><small>critical mistake cluster</small></div>
      <div className="metric-card"><span>ROSTER</span><strong>{Object.keys(overview?.byUser ?? {}).length || new Set(real.map(s => s.user_id)).size}</strong><small>trainees with evidence</small></div>
    </div>
    <div className="trend-grid"><section className="panel"><div className="panel-header"><h2>Unit score trend</h2><div><select aria-label="Filter scenario" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All scenarios</option><option value="nightfall">Nightfall</option><option value="first-light">First light</option></select></div></div><div className="panel-content"><TrendChart values={real.slice().sort((a, b) => a.started_at.localeCompare(b.started_at)).map(s => s.report.total)} /></div></section>
      <section className="panel"><div className="panel-header"><h2>Common failures</h2><div><button className="button ghost small" disabled={!real.length} title={real.length ? 'Export unit data' : 'No sessions to export'} onClick={() => exportSessions(real, 'avlon-drishti-unit.csv')}><Download size={12} /> CSV</button><button className="button ghost small" disabled={!real.length} title={real.length ? 'Print report' : 'No sessions to print'} onClick={() => window.print()}><Printer size={12} /> Print</button></div></div><div className="panel-content">{Object.entries(fails).map(([k, v]) => <div key={k} className="skill-row"><span>{k}</span><div><i style={{ width: `${Math.min(100, v * 12)}%` }} /></div><strong>{v}</strong></div>)} {!Object.keys(fails).length && <p className="muted">No critical mistakes in this filter.</p>}<p className="fine-print">Counts of critical mistakes across real sessions. Synthetic examples excluded. Not a validated combat-readiness rating.</p></div></section></div>
    <section className="panel session-register"><div className="panel-header"><h2>Roster</h2>{loadError && <span className="tag red">ROSTER SYNC FAILED</span>}</div>{loadError && <div className="panel-content"><p className="error-message" role="alert">{loadError} Showing sessions already loaded in this view.</p></div>}{Object.keys(overview?.byUser ?? {}).length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>TRAINEE</th><th>SESSIONS</th><th>AVG</th><th>LAST ACTIVE</th></tr></thead><tbody>{Object.entries<any>(overview?.byUser ?? {}).map(([id, v]) => <tr key={id}><td>{id}</td><td>{v.sessions}</td><td>{Math.round(v.avg)}</td><td>{new Date(v.last).toLocaleDateString('en-GB')}</td></tr>)}</tbody></table></div> : <div className="panel-content"><p className="muted">No trainee sessions recorded yet. Assign an exercise from Scenario studio — completed runs will appear here with averages and activity.</p></div>}</section>
  </>;
}
