import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Clock3, Crosshair, Dices, Layers3, Moon, Play, Search, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { DIMENSIONS, type Dimension, type Scenario } from '../../sim-core/types';
import { generateScenario, type GeneratedScenario } from '../../sim-core/generator';
import { DIMENSION_LABELS, formatTime, humanize } from '../copy';
import { Modal } from '../components/Modal';
import { ScenarioArt } from '../components/ScenarioArt';

export function ScenarioLibrary({ scenarios, onLaunch }: { scenarios: Scenario[]; onLaunch: (scenario: Scenario, mode: 'training' | 'assessment') => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [generator, setGenerator] = useState(false);
  const [briefing, setBriefing] = useState<Scenario | null>(null);
  const filtered = scenarios.filter(s => `${s.title} ${s.description} ${s.environment.terrain}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || filter === 'foundation' && s.difficulty <= 2 || filter === 'advanced' && s.difficulty > 2 || filter === 'night' && s.environment.time_of_day === 'night'));
  return <>
    <div className="page-heading"><div><div className="eyebrow">EVERY EXERCISE. A NEW PERSPECTIVE.</div><h1>Scenario library<span className="accent">.</span></h1><p>A progressive curriculum. An unlimited field of possibilities.</p></div><button className="button primary" onClick={() => setGenerator(true)}><Dices size={16} />Generate exercise</button></div>
    <section className="generation-banner"><div className="generation-icon"><Sparkles size={24} /></div><div><span className="eyebrow">PROCEDURAL TRAINING ENGINE</span><h3>Practice the unexpected.</h3><p>Seeded generation. Feasibility checked. Exactly replayable.</p></div><div className="generation-tags"><span><Check size={12} /> Headless baseline</span><span><Check size={12} /> Diversity guard</span></div><button className="button secondary" onClick={() => setGenerator(true)}>Build your next challenge <ArrowRight size={14} /></button></section>
    <div className="library-toolbar"><div className="segmented">{[['all', 'All exercises'], ['foundation', 'Foundation'], ['advanced', 'Advanced'], ['night', 'Night operations']].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div><label className="search-box"><Search size={14} /><input aria-label="Search scenarios" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an exercise…" /></label></div>
    <div className="section-label"><span>{filtered.length} EXERCISES AVAILABLE</span><span>CURATED + INSTRUCTOR CREATED</span></div>
    <div className="scenario-grid">{filtered.map(s => <article className="scenario-card" key={s.id}>
      <div className="scenario-card-art"><ScenarioArt scenario={s} /><span className={`tag ${s.difficulty > 3 ? 'amber' : 'gray'}`}>{s.difficulty <= 2 ? 'FOUNDATION' : s.difficulty === 3 ? 'INTERMEDIATE' : 'ADVANCED'}</span>{s.id === 'nightfall' && <span className="featured-tag">FEATURED</span>}</div>
      <div className="scenario-card-body"><div className="scenario-card-index"><span>{s.source === 'instructor' ? 'INSTRUCTOR EXERCISE' : `EXERCISE ${String(scenarios.indexOf(s) + 1).padStart(2, '0')}`}</span><div className="difficulty-bars">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= s.difficulty ? 'filled' : ''} />)}</div></div><h3>{s.title}</h3><p>{s.description}</p><div className="scenario-meta"><span>{s.environment.time_of_day === 'night' ? <Moon size={12} /> : <Sun size={12} />}{humanize(s.environment.time_of_day)}</span><span><Clock3 size={12} />{formatTime(s.duration_s)}</span><span><Layers3 size={12} />Contacts hidden until launch</span></div><div className="scenario-card-footer"><span>{humanize(s.environment.terrain)} · {humanize(s.environment.weather)}</span><button className="button ghost small" onClick={() => setBriefing(s)}>Open briefing <ArrowRight size={13} /></button></div></div>
    </article>)}</div>
    {!filtered.length && <div className="panel empty-inline"><Search size={25} /><p>No exercises match this search.</p><span>Try a different title or filter.</span></div>}
    {generator && <GeneratorDialog onClose={() => setGenerator(false)} onLaunch={(s, mode) => { setGenerator(false); onLaunch(s, mode); }} />}
    {briefing && <BriefingDialog scenario={briefing} onClose={() => setBriefing(null)} onLaunch={mode => { setBriefing(null); onLaunch(briefing, mode); }} />}
  </>;
}

export function BriefingDialog({ scenario, onClose, onLaunch, current = false }: { scenario: Scenario; onClose: () => void; onLaunch: (mode: 'training' | 'assessment') => void; current?: boolean }) {
  const [mode, setMode] = useState<'training' | 'assessment'>('training');
  return <Modal title={scenario.title} eyebrow="EXERCISE BRIEFING" onClose={onClose}>
    <ScenarioArt scenario={scenario} large /><div className="modal-body"><p className="briefing-description">{scenario.description}</p><div className="briefing-meta"><span><Clock3 size={14} />{formatTime(scenario.duration_s)}</span><span><Layers3 size={14} />Level {scenario.difficulty} / 5</span><span><Moon size={14} />{humanize(scenario.environment.time_of_day)}</span></div>
      <div className="briefing-objectives"><h4>Your objectives</h4><div><span>01</span>Acknowledge and classify each contact using independent sensor cues.</div><div><span>02</span>Choose a proportionate response and record your reasoning.</div><div><span>03</span>Preserve the asset, account for friendly traffic, and review your decisions.</div></div>
      <div className="briefing-roe"><ShieldCheck size={19} /><div><strong>Exercise rules</strong><p>{scenario.roe.kinetic_allowed ? 'Intercept permitted after checks.' : 'Intercept restricted.'} {scenario.roe.warning_required ? 'Warn before an active response.' : 'Positive identification required.'} Evidence threshold: {Math.round(scenario.roe.min_confidence * 100)}%. {scenario.roe.jam_allowed_over_civilian_area ? '' : 'Electronic effects restricted in civilian zones.'}</p></div></div>
      {!current && <div className="mode-picker"><button className={mode === 'training' ? 'selected' : ''} onClick={() => setMode('training')}><Sparkles size={16} /><strong>Training<span>Hints available. Build understanding.</span></strong><i /></button><button className={mode === 'assessment' ? 'selected' : ''} onClick={() => setMode('assessment')}><Crosshair size={16} /><strong>Assessment<span>No hints. Measure your decisions.</span></strong><i /></button></div>}
      <div className="modal-footer"><span className="mono muted">REPLAY SEED {scenario.seed}<small>Fictional terrain · abstract effects</small></span><button className="button primary" onClick={() => current ? onClose() : onLaunch(mode)}>{current ? 'Back to exercise' : <><Play size={14} />Start {mode}</>}</button></div>
    </div>
  </Modal>;
}

function GeneratorDialog({ onClose, onLaunch }: { onClose: () => void; onLaunch: (scenario: Scenario, mode: 'training' | 'assessment') => void }) {
  const [seed, setSeed] = useState('726031');
  const [difficulty, setDifficulty] = useState(3);
  const [focus, setFocus] = useState<Dimension>('night');
  const [result, setResult] = useState<GeneratedScenario | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generate = () => {
    setBusy(true); setError('');
    window.setTimeout(() => {
      try { const generated = generateScenario({ seed: Number(seed), difficulty, focus, recent_fingerprints: recent }); setResult(generated); setRecent(v => [...v, generated.fingerprint]); }
      catch (e) { setError(e instanceof Error ? e.message : 'Unable to generate exercise.'); }
      finally { setBusy(false); }
    }, 30);
  };
  return <Modal title="A different challenge. Every time." eyebrow="PROCEDURAL SCENARIO GENERATOR" onClose={onClose}>
    <div className="modal-body"><p className="briefing-description">Choose a training focus. The generator checks the schema, runs a delayed baseline operator, and rejects repeated or infeasible exercises.</p><div className="form-grid"><label className="form-field"><span>REPLAY SEED</span><input type="number" min="0" max="4294967295" value={seed} onChange={e => { setSeed(e.target.value); setResult(null); }} /></label><label className="form-field"><span>TRAINING FOCUS</span><select value={focus} onChange={e => { setFocus(e.target.value as Dimension); setResult(null); }}>{DIMENSIONS.map(d => <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>)}</select></label></div><label className="range-field"><span>DIFFICULTY <strong>Level {difficulty} / 5</strong></span><input type="range" min="1" max="5" value={difficulty} onChange={e => { setDifficulty(Number(e.target.value)); setResult(null); }} /><div><span>Build confidence</span><span>Stretch your ability</span></div></label>
      <button className="button secondary full-width" onClick={generate} disabled={busy}><Dices size={15} />{busy ? 'Running feasibility check…' : result ? 'Generate a different variation' : 'Generate & validate'}</button>
      {error && <p className="error-message" role="alert">{error}</p>}
      {result && <div className="generated-result"><div><ShieldCheck size={22} /><div><span className="eyebrow">BASELINE VERIFIED</span><h3>{result.scenario.title}</h3></div><span className="tag">VALID</span></div><p>{humanize(result.scenario.environment.time_of_day)} · {humanize(result.scenario.environment.terrain)} · contact picture hidden until launch</p><div className="generation-proof"><span>Baseline score<strong>{result.baseline.score}/100</strong></span><span>Asset preserved<strong>{result.baseline.asset_health}%</strong></span><span>Fingerprint<strong>{result.fingerprint}</strong></span></div><button className="button primary full-width" onClick={() => onLaunch(result.scenario, 'training')}>Launch generated exercise <ArrowRight size={15} /></button></div>}
      <p className="fine-print">Seeded procedural algorithm. Identical inputs produce identical scenarios; the recent-fingerprint window deliberately selects a different variation. Gameplay-level feasibility only.</p>
    </div>
  </Modal>;
}
