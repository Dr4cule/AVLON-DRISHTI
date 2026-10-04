import { useCallback, useEffect, useRef, useState } from 'react';
import { Simulation, replay } from '../../sim-core/engine';
import { SCRIPTED_SCENARIOS } from '../../sim-core/catalog';
import { scoreSimulation } from '../../sim-core/scoring';
import { ENGINE_VERSION, type Action, type RunJournal, type Scenario, type SessionRecord, type User } from '../../sim-core/types';
import { api, type Bootstrap } from './api';
import { formatTime } from '../copy';
import { suspendAudio, unlockAudio } from './sound';

const journalKey = (userId: string) => `drishti.journal.v1.${userId}`;
export function useTraining(onCompleted: (record: SessionRecord) => void) {
  const [initial] = useState(() => new Simulation(SCRIPTED_SCENARIOS[6]));
  const simRef = useRef(initial);
  const journal = useRef<RunJournal | null>(null);
  const callback = useRef(onCompleted); callback.current = onCompleted;
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Start the exercise, select a contact, and examine its evidence.');
  const [speed, setSpeed] = useState(1);
  const [recovered, setRecovered] = useState(false);
  const [syncState, setSyncState] = useState<'saved' | 'saving' | 'pending'>('saved');
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  const completing = useRef(false);
  const refresh = () => setRevision(v => v + 1);
  const snapshot = useCallback(() => {
    if (!journal.current) return null;
    return { ...journal.current, tick: simRef.current.state.tick, actions: [...simRef.current.actions] };
  }, []);
  const lastPersist = useRef(0);
  const persist = useCallback((force = false) => {
    // The game loop calls this every tick (~4 Hz, faster at high pace): throttle
    // routine writes to ~1 Hz. Explicit saves (finish, checkpoint, actions,
    // tab-hide) pass force=true and always write through.
    if (!force) {
      const now = Date.now();
      if (now - lastPersist.current < 1000) return;
      lastPersist.current = now;
    }
    const current = snapshot(); if (!current) return;
    try { localStorage.setItem(journalKey(current.user_id), JSON.stringify(current)); }
    catch { setMessage('Browser storage is full. Keep the local service running so checkpoints can be saved.'); }
  }, [snapshot]);
  const checkpoint = useCallback(() => {
    const current = snapshot(); if (!current || current.finished) return;
    persist(true);
    syncChain.current = syncChain.current.then(async () => {
      setSyncState('saving');
      try { await api.checkpoint(current); setSyncState('saved'); }
      catch { setSyncState('pending'); }
    });
  }, [persist, snapshot]);
  const finish = useCallback(async (): Promise<SessionRecord | null> => {
    if (!journal.current || completing.current) return null;
    completing.current = true; setBusy(true); setRunning(false);
    simRef.current.finish(); journal.current.finished = true; persist(true); refresh();
    const current = snapshot()!;
    await syncChain.current;
    try {
      const record = await api.finish(current);
      // The server commit is the durable save. Browser-journal cleanup is
      // best-effort: it must never convert a completed save into a failure.
      journal.current = null;
      setRecovered(false); setSyncState('saved'); setMessage('Exercise saved. Your decision evidence is ready for review.');
      try { localStorage.removeItem(journalKey(current.user_id)); }
      catch { /* journal already saved server-side; leave the retry path clean */ }
      callback.current(record); return record;
    } catch (error) {
      setSyncState('pending'); setMessage(`${error instanceof Error ? error.message : 'Unable to save.'} Use “Save & debrief” to retry.`);
      return null;
    } finally { completing.current = false; setBusy(false); refresh(); }
  }, [persist, snapshot]);
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    if (!running) return;
    let previous = performance.now(), accumulator = 0;
    const timer = window.setInterval(() => {
      const now = performance.now(); accumulator += Math.min(now - previous, 1000) * speed; previous = now;
      const before = simRef.current.state.tick;
      while (accumulator >= 250 && !simRef.current.state.ended) { simRef.current.step(); accumulator -= 250; }
      if (before !== simRef.current.state.tick) {
        refresh(); persist();
        if (Math.floor(before / 16) !== Math.floor(simRef.current.state.tick / 16)) checkpoint();
      }
      if (simRef.current.state.ended) { setRunning(false); void finishRef.current(); }
    }, 50);
    return () => clearInterval(timer);
  }, [running, speed, checkpoint, persist]);
  useEffect(() => {
    const save = () => { persist(true); if (document.hidden) { setRunning(false); suspendAudio(); } };
    const hide = () => persist(true);
    document.addEventListener('visibilitychange', save); window.addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', save); window.removeEventListener('pagehide', hide); };
  }, [persist]);
  const restore = useCallback((bootstrap: Bootstrap) => {
    setRunning(false); setSpeed(1);
    let candidate = bootstrap.draft;
    try {
      const raw = localStorage.getItem(journalKey(bootstrap.user.id));
      if (raw) {
        const local: RunJournal = JSON.parse(raw);
        if (bootstrap.sessions.some(s => s.id === local.id)) localStorage.removeItem(journalKey(bootstrap.user.id));
        else if (candidate?.id === local.id && local.tick >= candidate.tick && local.engine_version === ENGINE_VERSION) candidate = local;
      }
      if (candidate && candidate.engine_version === ENGINE_VERSION) {
        simRef.current = replay(candidate.scenario, candidate.actions, candidate.tick, !!candidate.finished);
        journal.current = candidate; setRecovered(true);
        setMessage(candidate.finished
          ? `Recovered a completed exercise (${candidate.actions.length} decisions). Use “Save & debrief” to retry the save — your decisions are intact.`
          : `Recovered ${candidate.actions.length} decisions. Resume when you are ready.`);
      } else { journal.current = null; simRef.current = new Simulation(SCRIPTED_SCENARIOS[6]); setRecovered(false); }
    } catch {
      // Even the fallback can throw on a corrupt draft — never let recovery crash the app.
      try {
        journal.current = bootstrap.draft;
        simRef.current = bootstrap.draft ? replay(bootstrap.draft.scenario, bootstrap.draft.actions, bootstrap.draft.tick, false) : new Simulation(SCRIPTED_SCENARIOS[6]);
        setRecovered(!!bootstrap.draft);
        setMessage('Recovered the last valid server checkpoint. The browser journal could not be read.');
      } catch {
        journal.current = null; simRef.current = new Simulation(SCRIPTED_SCENARIOS[6]);
        setRecovered(false); setMessage('Saved data could not be restored, so a fresh exercise was loaded. Your completed sessions are untouched in After-action review.');
      }
    }
    refresh();
  }, []);
  const start = useCallback(async (scenario: Scenario, mode: 'training' | 'assessment'): Promise<boolean> => {
    unlockAudio();
    if (journal.current) { const saved = await finish(); if (!saved) return false; }
    setBusy(true);
    try {
      const current = await api.start(scenario, mode); journal.current = current;
      simRef.current = new Simulation(current.scenario); setSpeed(1); setRecovered(false); setSyncState('saved');
      setMessage('Exercise started. Acknowledge each contact, then compare independent cues.'); persist(true); setRunning(true); refresh(); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start the exercise.'); return false; }
    finally { setBusy(false); }
  }, [finish, persist]);
  const toggle = useCallback(() => {
    unlockAudio();
    if (!journal.current) { void start(simRef.current.scenario, 'training'); return; }
    if (simRef.current.state.ended) { void finish(); return; }
    setRecovered(false); setRunning(v => !v);
  }, [start, finish]);
  const act = useCallback((input: Omit<Action, 'tick'>) => {
    if (!journal.current || simRef.current.state.ended) return;
    unlockAudio();
    const result = simRef.current.dispatch({ ...input, tick: simRef.current.state.tick });
    setMessage(`T+${formatTime(simRef.current.state.tick / 4)} — ${result.message}`); persist(true); refresh();
  }, [persist]);
  return { sim: simRef.current, revision, active: !!journal.current, mode: journal.current?.mode ?? 'training' as const, running, busy, message, speed, recovered, syncState, setSpeed, setRunning, start, toggle, act, finish, restore, checkpoint };
}
