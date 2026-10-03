import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Check, ChevronDown, CircleHelp, Crosshair, Eye, Flag, Layers3, Radio, Radar, ShieldCheck, Signal, Sparkles, Timer, Wind } from 'lucide-react';
import type { Simulation } from '../../sim-core/engine';
import type { Action, ActorKind, Classification, Reason, ResponseKind, SensorKind } from '../../sim-core/types';
import { trackConfidence } from '../../sim-core/sensors';
import { EFFECTORS } from '../../sim-core/roe';
import { TYPE_LABELS, REASON_LABELS, RESPONSE_LABELS, SENSOR_LABELS, formatTime, humanize } from '../copy';
import { RadarMap } from './RadarMap';
import { SensorFeed } from './SensorFeed';
import { ThreatAssessment } from '../threat/ThreatAssessment';

interface Props {
  sim: Simulation; active: boolean; running: boolean; mode: 'training' | 'assessment'; lowResource: boolean;
  onAction: (input: Omit<Action, 'tick'>) => void; onToggle: () => void;
  message: string; onBriefing?: () => void;
}
export function TacticalStation({ sim, active, running, mode, lowResource, onAction, onToggle, message, onBriefing }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification>('unknown');
  const [droneType, setDroneType] = useState<ActorKind | 'unknown'>('unknown');
  const [response, setResponse] = useState<ResponseKind>('observe');
  const [reason, setReason] = useState<Reason>('insufficient_evidence');
  const [channel, setChannel] = useState<SensorKind>(sim.scenario.environment.time_of_day === 'night' ? 'ir' : 'eo');
  const [hint, setHint] = useState(false);
  const tracks = Object.values(sim.state.tracks);
  const track = selected ? sim.state.tracks[selected] : undefined;
  useEffect(() => {
    setSelected(null); setHint(false); setChannel(sim.scenario.environment.time_of_day === 'night' ? 'ir' : 'eo');
  }, [sim.scenario.id, sim.scenario.seed]);
  const select = (id: string) => {
    const t = sim.state.tracks[id]; if (!t) return;
    setSelected(id); setClassification(t.classification); setDroneType(t.drone_type); setHint(false);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, select, textarea, [role="dialog"]') || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code === 'Space') { event.preventDefault(); onToggle(); }
      if (!active || !selected || track?.resolved) return;
      if (event.key.toLowerCase() === 'a') onAction({ type: 'acknowledge', actor_id: selected });
      const choice = ({ '1': 'hostile', '2': 'friendly', '3': 'benign', '4': 'unknown' } as const)[event.key as '1'];
      if (choice) { setClassification(choice); onAction({ type: 'classify', actor_id: selected, classification: choice, drone_type: droneType }); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [active, selected, track?.resolved, droneType, onAction, onToggle]);
  const sensorCount = Object.values(sim.state.sensor_status).filter(s => s !== 'offline').length;
  const health = Math.round(Object.values(sim.state.asset_health).reduce((a, b) => a + b, 0) / sim.scenario.assets.length);
  const recent = [...sim.events].reverse().find(e => ['TrackAcknowledged', 'TrackClassified', 'ResponseOrdered', 'ResponseRejected', 'SensorStatusChanged'].includes(e.type));
  const allowedToAct = active && !sim.state.ended && !!track && !track.resolved;
  return <>
    <div className="metrics-grid">
      <div className="metric-card"><Timer className="metric-icon" size={17} /><span>EXERCISE TIME</span><strong>{formatTime(sim.state.tick / 4)}</strong><small>of {formatTime(sim.scenario.duration_s)} <span className="metric-trend">{running ? 'IN PROGRESS' : active ? 'PAUSED' : 'READY'}</span></small></div>
      <div className="metric-card"><Crosshair className="metric-icon" size={17} /><span>TRACKED CONTACTS</span><strong>{tracks.filter(t => !t.resolved).length.toString().padStart(2, '0')}</strong><small>{tracks.filter(t => t.classification === 'unknown' && !t.resolved).length} awaiting classification <span className="mini-bars">▁▃▂▅▃▆▅</span></small></div>
      <div className="metric-card"><ShieldCheck className="metric-icon" size={18} /><span>ASSET INTEGRITY</span><strong>{health}<em>%</em></strong><small className="text-green">{health === 100 ? 'Protected · no damage recorded' : 'Damage recorded in event log'}</small><div className="tiny-progress"><span style={{ width: `${health}%` }} /></div></div>
      <div className="metric-card"><Signal className="metric-icon" size={17} /><span>SENSOR NETWORK</span><strong>{String(sensorCount).padStart(2, '0')}<em>/ {String(sim.scenario.sensors.length).padStart(2, '0')}</em></strong><small>{Object.values(sim.state.sensor_status).filter(s => s === 'degraded').length} degraded channels <span className="metric-trend sensor-dots">{sim.scenario.sensors.map(s => <i key={s} className={sim.state.sensor_status[s]} title={`${SENSOR_LABELS[s]}: ${sim.state.sensor_status[s]}`} />)}</span></small></div>
    </div>
    <div className="cockpit-grid">
      <div className="main-stack">
        <section className="panel tactical-panel">
          <div className="panel-header"><div className="panel-title"><Radar size={17} /><h2>Tactical picture</h2><span className={`tag ${running ? '' : 'gray'}`}>{running ? 'LIVE' : active ? 'PAUSED' : 'STANDBY'}</span></div><div className="panel-actions"><span className="mono muted">SEED {sim.scenario.seed}</span><button className="icon-button" aria-label="Open scenario briefing" title="Scenario briefing" onClick={onBriefing}><CircleHelp size={15} /></button></div></div>
          <RadarMap scenario={sim.scenario} contacts={sim.contacts()} selected={selected} onSelect={select} lowResource={lowResource} sweep={running || !active} />
          <div className="map-status-bar"><div><Wind size={12} />{humanize(sim.scenario.environment.weather)}<span className="status-separator" />{humanize(sim.scenario.environment.time_of_day)}<span className="status-separator" />{humanize(sim.scenario.environment.terrain)}</div><span><span className="dot" /> {active ? 'EVENT LOG RECORDING' : 'EXERCISE LOADED'}</span></div>
          <div className="roe-banner"><ShieldCheck size={15} /><strong>EXERCISE ROE</strong><span>{sim.scenario.roe.kinetic_allowed ? 'Intercept permitted after identification' : 'Intercept restricted'} · {sim.scenario.roe.warning_required ? 'Warning required' : 'Positive identification required'} · {Math.round(sim.scenario.roe.min_confidence * 100)}% evidence threshold</span></div>
        </section>
        <section className="panel contact-panel"><div className="panel-header"><div className="panel-title"><Layers3 size={16} /><h2>Track register</h2><span className="count-pill">{tracks.length}</span></div><span className="mono muted">SELECT TO INSPECT</span></div>
          <div className="table-scroll track-table-scroll"><table className="data-table track-table"><thead><tr><th>CONTACT</th><th>CLASSIFICATION</th><th>BEARING</th><th>CONFIDENCE</th><th>STATUS</th></tr></thead><tbody>{tracks.map(t => <tr key={t.id} className={selected === t.id ? 'selected' : ''} onClick={() => select(t.id)} tabIndex={0} role="button" aria-label={`Inspect contact ${t.label}, ${t.classification}`} aria-pressed={selected === t.id} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.id); } }}><td><button className="table-contact-button" onClick={() => select(t.id)}><i className={`legend-shape ${t.classification === 'hostile' ? 'triangle' : t.classification === 'friendly' ? 'square' : t.classification === 'benign' ? 'circle' : 'diamond'}`} />{t.label}</button></td><td><span className={`classification-label ${t.classification}`}>{humanize(t.classification)}</span></td><td className="mono">{String(t.bearing).padStart(3, '0')}°</td><td><div className="confidence-cell"><div><span style={{ width: `${trackConfidence(t, sim.state.tick) * 100}%` }} /></div><span>{Math.round(trackConfidence(t, sim.state.tick) * 100)}%</span></div></td><td><span className={`track-state ${t.resolved ? '' : t.acknowledged_at !== null ? 'text-green' : 'text-amber'}`}>{t.resolved ? 'Closed' : t.acknowledged_at !== null ? 'Acknowledged' : 'New contact'}</span></td></tr>)}</tbody></table>{!tracks.length && <div className="empty-inline"><Radar size={22} /><p>Scanning for evidence…</p><span>Contacts appear only when a sensor reports them.</span></div>}</div>
        </section>
        <div className="live-log"><Activity size={13} /><span className="mono">{formatTime((recent?.tick ?? 0) / 4)}</span><span>{recent?.type === 'ResponseRejected' ? String(recent.payload.detail) : recent?.type === 'TrackClassified' ? `Operator classification recorded for ${sim.state.tracks[recent.actor_id ?? '']?.label ?? 'track'}` : recent?.type === 'ResponseOrdered' ? 'Operator response added to the decision log' : 'Sensor network initialized. Awaiting operator decisions.'}</span><span className="log-pulse" /></div>
      </div>
      <div className="side-stack">
        <section className="panel fusion-panel"><div className="panel-header"><div className="panel-title"><Radio size={16} /><h2>Sensor fusion</h2></div><span className="tag cyan">{track ? track.label : 'NO SELECTION'}</span></div>
          <div className="sensor-tabs" role="tablist" aria-label="Sensor channel">{(['ir', 'eo', 'rf', 'acoustic'] as SensorKind[]).map(s => { const unavailable = !sim.scenario.sensors.includes(s) || sim.state.sensor_status[s] === 'offline'; return <button role="tab" aria-selected={channel === s} aria-label={`${SENSOR_LABELS[s]} channel${unavailable ? ', unavailable' : ''}`} className={channel === s ? 'active' : ''} key={s} disabled={unavailable} onClick={() => setChannel(s)}>{s === 'acoustic' ? 'AUDIO' : s.toUpperCase()}</button>; })}</div>
          <SensorFeed track={track} sensor={channel} tick={sim.state.tick} available={sim.scenario.sensors.includes(channel) && sim.state.sensor_status[channel] !== 'offline'} />
          <div className="fusion-readings">{sim.scenario.sensors.map(s => { const reading = track?.sensors[s]; const fresh = reading && sim.state.tick - reading.tick < 20; return <div className="fusion-reading" key={s} title={reading?.evidence ?? 'No observation'}><span className={`sensor-led ${sim.state.sensor_status[s]}`} /><span>{SENSOR_LABELS[s]}</span><div className="reading-bar"><i style={{ width: `${fresh ? reading.confidence * 100 : 0}%` }} /></div><strong>{sim.state.sensor_status[s] === 'offline' ? 'OFF' : fresh ? `${Math.round(reading.confidence * 100)}%` : '—'}</strong></div>; })}</div>
          <p className="fusion-evidence">{track?.sensors[channel]?.evidence ?? 'Inspect independent sensor cues before deciding.'}</p>
          <ThreatAssessment track={track} scenario={sim.scenario} tick={sim.state.tick} />
        </section>
        <section className="panel decision-panel"><div className="panel-header"><div className="panel-title"><Crosshair size={16} /><h2>Decision workspace</h2></div>{mode === 'training' && <button className="icon-button" aria-label="Show training hint" title="Training hint" onClick={() => setHint(v => !v)}><Sparkles size={15} /></button>}</div>
          <div className="decision-content">
            {!track ? <div className="empty-inline"><Crosshair size={26} /><p>Every contact is a question.</p><span>Select a track on the map or in the register to examine its evidence.</span></div> : <>
              <div className="selected-track-header"><strong>{track.label}<span>{track.bearing_only ? 'Bearing only · range unconfirmed' : `~${track.estimated_speed} u/s · ~${track.estimated_altitude} u altitude`}</span></strong><button aria-keyshortcuts="a" className={`button small ${track.acknowledged_at === null ? 'secondary' : 'ghost text-green'}`} disabled={!allowedToAct || track.acknowledged_at !== null} onClick={() => onAction({ type: 'acknowledge', actor_id: track.id })}>{track.acknowledged_at === null ? <>Acknowledge <kbd>A</kbd></> : <><Check size={12} /> Seen</>}</button></div>
              {track.civilian_area && <div className="inline-note amber"><Flag size={12} /> Contact reported in a civilian zone</div>}
              {Object.values(track.sensors).some(s => s.iff) && <div className="inline-note cyan"><ShieldCheck size={12} /> Friendly exercise IFF received</div>}
              {hint && mode === 'training' && <div className="training-hint"><Sparkles size={13} /><span>Confidence measures observation quality, not allegiance. Compare visual cues with IFF, acknowledge the track, and check the rules before responding.</span></div>}
              <div className="step-label"><span>01</span> CLASSIFY THE CONTACT</div>
              <div className="classification-buttons" role="group" aria-label="Contact classification">{(['hostile', 'friendly', 'benign', 'unknown'] as Classification[]).map((c, i) => <button aria-pressed={classification === c} aria-keyshortcuts={String(i + 1)} className={`${classification === c ? 'selected' : ''} ${c}`} key={c} onClick={() => setClassification(c)} disabled={!allowedToAct}>{humanize(c)}<kbd>{i + 1}</kbd></button>)}</div>
              <div className="classification-submit"><label className="select-wrap"><span className="sr-only">Contact type</span><select aria-label="Contact type" value={droneType} onChange={e => setDroneType(e.target.value as ActorKind)} disabled={!allowedToAct}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><ChevronDown size={12} /></label><button className="button secondary small" disabled={!allowedToAct} onClick={() => onAction({ type: 'classify', actor_id: track.id, classification, drone_type: droneType })}>Record <Check size={12} /></button></div>
              <div className="step-label"><span>02</span> CHOOSE A RESPONSE</div>
              <div className="response-grid" role="group" aria-label="Response choice">{(Object.keys(EFFECTORS) as ResponseKind[]).map(r => <button key={r} aria-pressed={response === r} title={`${EFFECTORS[r].label} · ${EFFECTORS[r].active ? `${sim.state.effectors[r].charges} charges · abstract effect` : 'Non-engagement action'}`} className={response === r ? 'selected' : ''} onClick={() => setResponse(r)} disabled={!allowedToAct}>{r === 'observe' && <Eye size={11} />}{RESPONSE_LABELS[r]}{sim.state.effectors[r].ready_at > sim.state.tick && <Timer size={10} />}</button>)}</div>
              <label className="field-label" htmlFor="action-reason">REASONING</label><label className="select-wrap"><select id="action-reason" value={reason} onChange={e => setReason(e.target.value as Reason)} disabled={!allowedToAct}>{Object.entries(REASON_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><ChevronDown size={12} /></label>
              <button className="button primary full-width record-response" disabled={!allowedToAct} onClick={() => onAction({ type: 'respond', actor_id: track.id, response, reason })}>Record response <ArrowUpRight size={15} /></button>
              <div className="resource-line"><span>{EFFECTORS[response].active ? `${sim.state.effectors[response].charges} CHARGES` : 'NON-ENGAGEMENT'}</span><span>{sim.state.effectors[response].ready_at > sim.state.tick ? `READY IN ${Math.ceil((sim.state.effectors[response].ready_at - sim.state.tick) / 4)}s` : 'READY'}</span></div>
            </>}
            <div className="action-feedback" role="status">{message || (active ? 'Your decisions are being recorded.' : 'Start the exercise to record your decisions.')}</div>
          </div>
        </section>
      </div>
    </div>
  </>;
}
