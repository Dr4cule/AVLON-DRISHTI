import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Save, Trash2, Upload } from 'lucide-react';
import type { ActorSpec, Scenario } from '../../sim-core/types';
import { assertScenario, scenarioErrors } from '../../sim-core/validation';
import { generateScenario } from '../../sim-core/generator';
import { apiRequest } from '../lib/api';
import { RadarMap } from '../tactical/RadarMap';
import { Simulation } from '../../sim-core/engine';

const blank: Scenario = {
  schema_version: '1.0', id: 'instructor-01', title: 'Instructor exercise', description: 'Built in Scenario Studio.',
  source: 'instructor', seed: 100001, environment: { terrain: 'rural', time_of_day: 'day', weather: 'clear', em_conditions: 'clean' },
  assets: [{ id: 'A1', type: 'command_post', pos: [0, 0], value: 100 }], sensors: ['radar', 'eo', 'ir'],
  sensor_degradations: [], roe: { kinetic_allowed: false, jam_allowed_over_civilian_area: false, weapons_free_after_s: null, warning_required: true, min_confidence: 0.55 },
  actors: [{ id: 'C1', kind: 'quadcopter', allegiance: 'hostile', count: 1, behavior: 'approach', spawn: { bearing_deg: 40, range_m: 3000 }, spawn_s: 0, speed_mps: 18, altitude_m: 100, iff: false, civilian_area: false }],
  ground_truth_tree: 'decision-v1', difficulty: 2,
  difficulty_tags: { night: 0, swarm: 0, degraded_sensors: 0, distractors: 1, urban: 0, speed_pressure: 1, roe_complexity: 2 }, duration_s: 180,
};

/** Next contact ID from the highest existing C-number: deleting C2 from [C1,C2,C3] yields C4, never a duplicate C3. */
export function nextContactId(ids: string[]): string {
  const next = ids.reduce((m, id) => { const k = Number(/^C(\d+)$/.exec(id)?.[1]); return Number.isFinite(k) ? Math.max(m, k) : m; }, 0) + 1;
  return `C${next}`;
}

export function InstructorStudio({ onLaunch }: { onLaunch: (s: Scenario, mode: 'training' | 'assessment') => void }) {
  const [scenario, setScenario] = useState<Scenario>(blank);
  const [msg, setMsg] = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const errors = scenarioErrors(scenario);
  const preview = useMemo(() => { try { return new Simulation(scenario); } catch { return null; } }, [scenario]);
  const set = (patch: Partial<Scenario>) => setScenario(s => ({ ...s, ...patch }));
  // Next ID from the highest existing C-number, so deleting an actor never reuses an ID.
  const addActor = () => setScenario(s => ({ ...s, actors: [...s.actors, { id: nextContactId(s.actors.map(a => a.id)), kind: 'quadcopter', allegiance: 'hostile', count: 1, behavior: 'approach', spawn: { bearing_deg: 90, range_m: 3000 }, spawn_s: 0, speed_mps: 18, altitude_m: 100, iff: false, civilian_area: false } as ActorSpec] }));
  const save = async (assign = false) => {
    setMsg('');
    if (errors.length) { setMsg(errors.join(' ')); return; }
    try {
      // Persist to the station library first (validates schema + baseline feasibility server-side),
      // then optionally assign to the unit, then offer a JSON download for portability.
      await apiRequest('/instructor/scenarios', 'POST', { scenario });
      if (assign) { await apiRequest('/assignments', 'POST', { scenario, unit_id: 'unit-alpha' }); setAssignMsg('Saved to library and assigned to Alpha unit.'); }
      const file = new File([JSON.stringify(scenario, null, 2)], `${scenario.id}.json`, { type: 'application/json' });
      const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = `${scenario.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(assign ? 'Saved to library, assigned, and JSON downloaded.' : 'Saved to the station library; JSON downloaded.');
    } catch (e: any) { setMsg(e.message); }
  };
  return <div className="studio-grid">
    <section className="panel"><div className="panel-header"><h2>Scenario studio</h2><span className="tag gray">INSTRUCTOR</span></div>
      <div className="panel-content studio-form">
        <label className="form-field"><span>TITLE</span><input value={scenario.title} onChange={e => set({ title: e.target.value })} /></label>
        <div className="form-grid">
          <label className="form-field"><span>TERRAIN</span><select value={scenario.environment.terrain} onChange={e => set({ environment: { ...scenario.environment, terrain: e.target.value as any } })}><option value="rural">Rural</option><option value="urban">Urban</option><option value="mountain">Mountain</option></select></label>
          <label className="form-field"><span>TIME</span><select value={scenario.environment.time_of_day} onChange={e => set({ environment: { ...scenario.environment, time_of_day: e.target.value as any } })}><option value="day">Day</option><option value="dusk">Dusk</option><option value="night">Night</option></select></label>
          <label className="form-field"><span>DIFFICULTY</span><input type="number" min={1} max={5} value={scenario.difficulty} onChange={e => set({ difficulty: Number(e.target.value) })} /></label>
          <label className="form-field"><span>SEED</span><input type="number" value={scenario.seed} onChange={e => set({ seed: Number(e.target.value) })} /></label>
        </div>
        <label className="form-field"><span>ROE — warning required</span><select value={String(scenario.roe.warning_required)} onChange={e => set({ roe: { ...scenario.roe, warning_required: e.target.value === 'true' } })}><option value="true">Warn before active response</option><option value="false">Positive ID only</option></select></label>
        <div className="actor-list">{scenario.actors.map((a, i) => <div key={a.id} className="actor-row"><strong>{a.id}</strong><select aria-label="allegiance" value={a.allegiance} onChange={e => setScenario(s => ({ ...s, actors: s.actors.map((x, j) => j === i ? { ...x, allegiance: e.target.value as any } : x) }))}><option value="hostile">hostile</option><option value="friendly">friendly</option><option value="benign">benign</option></select><select aria-label="kind" value={a.kind} onChange={e => setScenario(s => ({ ...s, actors: s.actors.map((x, j) => j === i ? { ...x, kind: e.target.value as any } : x) }))}><option value="quadcopter">quadcopter</option><option value="fixed_wing">fixed_wing</option><option value="fast_mover">fast_mover</option><option value="recon">recon</option><option value="swarm">swarm</option><option value="bird_flock">bird_flock</option><option value="kite">kite</option><option value="balloon">balloon</option><option value="helicopter">helicopter</option><option value="friendly_uav">friendly_uav</option><option value="clutter">clutter</option><option value="fiber_optic">fiber_optic</option></select><button className="icon-button" aria-label="Remove actor" onClick={() => setScenario(s => ({ ...s, actors: s.actors.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button></div>)}</div>
        <div className="studio-actions"><button className="button secondary small" onClick={addActor}><Plus size={13} /> Add contact</button>
          <label className="button ghost small">Import JSON <Upload size={13} /><input type="file" accept="application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const parsed: unknown = JSON.parse(await f.text()); assertScenario(parsed); setScenario(parsed); setMsg('Imported and schema-valid. Review, then save.'); } catch (err) { setMsg(`Import rejected: ${err instanceof Error ? err.message : 'invalid file'}. Current exercise unchanged.`); } finally { e.target.value = ''; } }} /></label></div>
        {errors.length > 0 && <p className="error-message">{errors.join(' ')}</p>}
        {msg && <p className="helper-text">{msg}</p>}
        <div className="studio-actions"><button className="button secondary" onClick={() => save(false)}><Save size={14} /> Save + export JSON</button><button className="button primary" onClick={() => save(true)}>Assign to unit <ArrowRight size={14} /></button></div>
        {assignMsg && <p className="helper-text text-green">{assignMsg}</p>}
        <button className="button ghost full-width" onClick={() => { try { const g = generateScenario({ seed: scenario.seed, difficulty: scenario.difficulty }); setScenario({ ...g.scenario, source: 'instructor', id: scenario.id }); setMsg(`Generated variant ${g.fingerprint}, baseline ${g.baseline.score}.`); } catch (e: any) { setMsg(e.message); } }}>Autofill fair variant from seed</button>
      </div>
    </section>
    <section className="panel"><div className="panel-header"><h2>Ground-truth preview</h2><span className="mono muted">CLICK MAP TO PLACE C1</span></div>
      {preview ? <RadarMap scenario={scenario} contacts={preview.contacts(true)} truth compact onPlace={(x, y) => { const r = Math.round(Math.hypot(x, y)); const b = Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360); setScenario(s => ({ ...s, actors: s.actors.map((a, j) => j === 0 ? { ...a, spawn: { bearing_deg: b, range_m: Math.max(600, Math.min(4400, r)) } } : a) })); }} /> : <div className="panel-content"><p className="error-message">Scenario invalid — fix errors to preview.</p></div>}
      <div className="panel-content"><button className="button secondary full-width" disabled={errors.length > 0} title={errors.length ? 'Fix validation errors first' : 'Test-play this exercise'} onClick={() => onLaunch(scenario, 'training')}>Test-play this exercise <ArrowRight size={14} /></button></div>
    </section>
  </div>;
}
