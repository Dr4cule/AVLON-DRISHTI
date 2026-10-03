import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Simulation, replay } from '../sim-core/engine';
import { assertAction, assertReport, assertScenario } from '../sim-core/validation';
import { scoreSimulation } from '../sim-core/scoring';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { fingerprint } from '../sim-core/generator';
import { runBaseline } from '../sim-core/baseline';
import { DIMENSIONS, ENGINE_VERSION, type Action, type Dimension, type RunJournal, type Scenario, type SessionRecord, type SimEvent, type User } from '../sim-core/types';
import { DEMO_USERS, demoRuns } from './demo';
import { calibrateDifficulty, emptySkills, profileFromSessions, recommendNext, weaknessRecommendations, type SkillState } from '../sim-core/adaptive';
import { adversaryTactics, challengeFromWeakness, challengeToOptions, detectPatterns } from '../sim-core/threat/challenge';
import { generateScenario } from '../sim-core/generator';
import { hashText, quantize } from '../sim-core/prng';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const serialize = (value: unknown) => JSON.stringify(value);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
interface SessionRow { id: string; user_id: string; scenario_json: string; mode: 'training' | 'assessment'; started_at: string; ended_at: string | null; end_tick: number; actions_json: string; engine_version: string; synthetic: number; report_json: string | null }

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string, includeDemo = true) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('trainee','instructor')), unit_id TEXT NOT NULL REFERENCES units(id), synthetic INTEGER NOT NULL DEFAULT 0, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY, title TEXT NOT NULL, json TEXT NOT NULL, source TEXT NOT NULL, seed INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), scenario_json TEXT NOT NULL, mode TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, end_tick INTEGER NOT NULL DEFAULT 0, actions_json TEXT NOT NULL DEFAULT '[]', engine_version TEXT NOT NULL, synthetic INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS events(session_id TEXT NOT NULL REFERENCES sessions(id), seq INTEGER NOT NULL, tick INTEGER NOT NULL, type TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(session_id,seq));
      CREATE TABLE IF NOT EXISTS score_reports(session_id TEXT PRIMARY KEY REFERENCES sessions(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS skill_state(user_id TEXT NOT NULL REFERENCES users(id), dimension TEXT NOT NULL, a REAL NOT NULL, b REAL NOT NULL, sessions INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,dimension));
      CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY, instructor_id TEXT NOT NULL REFERENCES users(id), unit_id TEXT NOT NULL REFERENCES units(id), scenario_json TEXT NOT NULL, due_at TEXT, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user_date ON sessions(user_id, started_at);
      CREATE TRIGGER IF NOT EXISTS immutable_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Event log is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Event log is append-only'); END;
    `);
    this.seedUsers();
    const insertScenario = this.db.prepare('INSERT OR IGNORE INTO scenarios(id,title,json,source,seed) VALUES(?,?,?,?,?)');
    for (const s of SCRIPTED_SCENARIOS) insertScenario.run(s.id, s.title, serialize(s), s.source, s.seed);
    if (includeDemo && !this.db.prepare("SELECT id FROM sessions WHERE synthetic=1 LIMIT 1").get()) this.seedDemo();
  }
  close() { this.db.close(); }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private seedUsers() {
    this.db.prepare('INSERT OR IGNORE INTO units VALUES(?,?)').run('unit-alpha', 'Alpha training unit');
    this.db.prepare('INSERT OR IGNORE INTO units VALUES(?,?)').run('demo-unit', 'Example unit · synthetic');
    const users: User[] = [{ id: 'operator', name: 'Aarav Rao', role: 'trainee', unit_id: 'unit-alpha', synthetic: false }, { id: 'instructor', name: 'Station instructor', role: 'instructor', unit_id: 'unit-alpha', synthetic: false }, ...DEMO_USERS];
    for (const user of users) {
      if (this.db.prepare('SELECT id FROM users WHERE id=?').get(user.id)) continue;
      const salt = randomBytes(16).toString('hex');
      const password = user.id === 'instructor' ? process.env.DRISHTI_INSTRUCTOR_PASSWORD ?? 'drishti-demo' : 'drishti-demo';
      const hash = `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
      this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(user.id, user.name, user.role, user.unit_id, Number(user.synthetic), hash);
    }
  }
  users(): User[] {
    return this.db.prepare('SELECT id,name,role,unit_id,synthetic FROM users ORDER BY synthetic,id').all().map(r => ({ ...r, synthetic: !!r.synthetic })) as unknown as User[];
  }
  login(id: string, password: string): { token: string; user: User } {
    const row = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!row || typeof password !== 'string' || password.length > 256) throw new HttpError(401, 'Incorrect account or password.');
    const [salt, hash] = String(row.password_hash).split(':');
    if (!timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(hash, 'hex'))) throw new HttpError(401, 'Incorrect account or password.');
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(new Date().toISOString());
    this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(digest(token), id, expires);
    return { token, user: this.users().find(u => u.id === id)! };
  }
  authenticate(token?: string): User | null {
    if (!token) return null;
    const row = this.db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').get(digest(token), new Date().toISOString());
    return row ? this.users().find(u => u.id === row.user_id) ?? null : null;
  }
  logout(token: string) { this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token)); }
  scenarios(): Scenario[] { return this.db.prepare('SELECT json FROM scenarios ORDER BY rowid').all().map(r => JSON.parse(String(r.json))); }
  private sessionRow(id: string): SessionRow {
    const row = this.db.prepare('SELECT s.*,r.json AS report_json FROM sessions s LEFT JOIN score_reports r ON r.session_id=s.id WHERE s.id=?').get(id);
    if (!row) throw new HttpError(404, 'Session not found.');
    return row as unknown as SessionRow;
  }
  private authorize(row: SessionRow, user: User, write = false) {
    if (write && row.user_id !== user.id) throw new HttpError(403, 'This session belongs to another trainee.');
    if (!write && row.user_id !== user.id && user.role !== 'instructor' && !row.synthetic) throw new HttpError(403, 'This session belongs to another trainee.');
  }
  private toRecord(row: SessionRow): SessionRecord {
    if (!row.ended_at || !row.report_json) throw new HttpError(409, 'The exercise is still in progress.');
    return { id: row.id, user_id: row.user_id, scenario: JSON.parse(row.scenario_json), mode: row.mode, started_at: row.started_at, ended_at: row.ended_at, end_tick: row.end_tick, actions: JSON.parse(row.actions_json), report: JSON.parse(row.report_json), engine_version: row.engine_version, synthetic: !!row.synthetic };
  }
  sessions(user: User): SessionRecord[] {
    const query = 'SELECT s.*,r.json AS report_json FROM sessions s JOIN score_reports r ON r.session_id=s.id WHERE s.ended_at IS NOT NULL';
    const rows = user.role === 'instructor' ? this.db.prepare(`${query} ORDER BY started_at DESC`).all() : this.db.prepare(`${query} AND (s.user_id=? OR s.synthetic=1) ORDER BY started_at DESC`).all(user.id);
    return rows.map(r => this.toRecord(r as unknown as SessionRow));
  }
  session(id: string, user: User): SessionRecord { const row = this.sessionRow(id); this.authorize(row, user); return this.toRecord(row); }
  events(id: string, user: User): SimEvent[] {
    const row = this.sessionRow(id); this.authorize(row, user);
    if (!row.ended_at) throw new HttpError(409, 'Ground-truth event review is available after the exercise.');
    return this.db.prepare('SELECT json FROM events WHERE session_id=? ORDER BY seq').all(id).map(r => JSON.parse(String(r.json)));
  }
  draft(user: User): RunJournal | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE user_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1').get(user.id) as unknown as SessionRow | undefined;
    return row ? { id: row.id, user_id: row.user_id, scenario: JSON.parse(row.scenario_json), mode: row.mode, started_at: row.started_at, tick: row.end_tick, actions: JSON.parse(row.actions_json), engine_version: row.engine_version } : null;
  }
  start(user: User, input: unknown, mode: string): RunJournal {
    assertScenario(input);
    if (!['training', 'assessment'].includes(mode)) throw new HttpError(400, 'Choose training or assessment mode.');
    if (this.draft(user)) throw new HttpError(409, 'Finish or review your active exercise before starting another.');
    let scenario = structuredClone(input);
    const last = this.db.prepare('SELECT scenario_json FROM sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 1').get(user.id);
    if (last && fingerprint(JSON.parse(String(last.scenario_json))) === fingerprint(scenario)) {
      scenario = { ...scenario, seed: (scenario.seed + 104729) >>> 0, actors: scenario.actors.map((a, i) => ({ ...a, spawn: { ...a.spawn, bearing_deg: (a.spawn.bearing_deg + 61 + i * 7) % 360 } })) };
    }
    if (!runBaseline(scenario).report.passed) throw new HttpError(400, 'This exercise did not pass the delayed-baseline feasibility check.');
    const journal: RunJournal = { id: randomUUID(), user_id: user.id, scenario, mode: mode as RunJournal['mode'], started_at: new Date().toISOString(), tick: 0, actions: [], engine_version: ENGINE_VERSION };
    this.transaction(() => {
      this.db.prepare('INSERT INTO sessions(id,user_id,scenario_json,mode,started_at,engine_version) VALUES(?,?,?,?,?,?)').run(journal.id, user.id, serialize(scenario), mode, journal.started_at, ENGINE_VERSION);
      this.appendEvents(journal.id, new Simulation(scenario).events);
    });
    return journal;
  }
  private validatedReplay(row: SessionRow, actions: unknown, tick: unknown, final: boolean): Simulation {
    if (row.engine_version !== ENGINE_VERSION) throw new HttpError(409, 'This session requires a different engine version.');
    const scenario: Scenario = JSON.parse(row.scenario_json);
    if (!Array.isArray(actions) || actions.length > 10000 || !Number.isInteger(tick) || Number(tick) < row.end_tick || Number(tick) > scenario.duration_s * 4) throw new HttpError(400, 'Invalid or stale checkpoint.');
    actions.forEach(assertAction);
    const previous: Action[] = JSON.parse(row.actions_json);
    if (serialize(actions.slice(0, previous.length)) !== serialize(previous)) throw new HttpError(409, 'Recorded decisions cannot be changed.');
    if (actions.some((a, i) => a.tick > Number(tick) || i > 0 && a.tick < actions[i - 1].tick)) throw new HttpError(400, 'Decisions must be ordered and within the session.');
    const sim = replay(scenario, actions, Number(tick), final);
    if (serialize(sim.actions) !== serialize(actions)) throw new HttpError(400, 'An action references an unavailable contact or an inactive simulation tick.');
    return sim;
  }
  private appendEvents(id: string, events: readonly SimEvent[]) {
    const stored = this.db.prepare('SELECT seq,json FROM events WHERE session_id=? ORDER BY seq').all(id);
    for (const row of stored) if (serialize(events[Number(row.seq)]) !== row.json) throw new HttpError(409, 'Checkpoint does not reproduce the immutable event prefix.');
    const insert = this.db.prepare('INSERT INTO events VALUES(?,?,?,?,?)');
    for (const e of events.slice(stored.length)) insert.run(id, e.seq, e.tick, e.type, serialize(e));
  }
  checkpoint(id: string, user: User, actions: unknown, tick: unknown) {
    const row = this.sessionRow(id); this.authorize(row, user, true);
    if (row.ended_at) throw new HttpError(409, 'This exercise has already ended.');
    const sim = this.validatedReplay(row, actions, tick, false);
    this.transaction(() => { this.appendEvents(id, sim.events); this.db.prepare('UPDATE sessions SET end_tick=?,actions_json=? WHERE id=?').run(sim.state.tick, serialize(sim.actions), id); });
    return { tick: sim.state.tick, events: sim.events.length, event_hash: sim.eventHash() };
  }
  finish(id: string, user: User, actions: unknown, tick: unknown): SessionRecord {
    const row = this.sessionRow(id); this.authorize(row, user, true);
    if (row.ended_at) return this.toRecord(row);
    const sim = this.validatedReplay(row, actions, tick, true);
    const report = scoreSimulation(sim); assertReport(report);
    this.transaction(() => {
      this.appendEvents(id, sim.events);
      this.db.prepare('UPDATE sessions SET ended_at=?,end_tick=?,actions_json=? WHERE id=?').run(new Date().toISOString(), sim.state.tick, serialize(sim.actions), id);
      this.db.prepare('INSERT INTO score_reports VALUES(?,?)').run(id, serialize(report));
      if (!row.synthetic) {
        // Recompute the full skill profile from all real sessions (cheap: small n)
        // and persist it, so skill_state is the source of truth, not a dead table.
        const profile = profileFromSessions(user.id, this.sessions(user));
        this.writeSkills(user.id, profile.skills);
      }
    });
    return this.session(id, user);
  }
  private readSkills(userId: string): Record<Dimension, SkillState> | null {
    const rows = this.db.prepare('SELECT dimension,a,b,sessions FROM skill_state WHERE user_id=?').all(userId);
    if (!rows.length) return null;
    const skills = emptySkills();
    for (const r of rows) {
      const d = String(r.dimension) as Dimension;
      if (!(d in skills)) continue;
      const a = Number(r.a), b = Number(r.b);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) continue;
      skills[d] = { dimension: d, a, b, mean: quantize(a / (a + b)), uncertainty: quantize(1 / (a + b)), sessions: Number(r.sessions) };
    }
    return skills;
  }
  private writeSkills(userId: string, skills: Record<Dimension, SkillState>) {
    const upsert = this.db.prepare('INSERT INTO skill_state VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,dimension) DO UPDATE SET a=excluded.a,b=excluded.b,sessions=excluded.sessions,updated_at=excluded.updated_at');
    const now = new Date().toISOString();
    for (const d of DIMENSIONS) upsert.run(userId, d, skills[d].a, skills[d].b, skills[d].sessions, now);
  }
  adaptiveProfile(userId: string, requester: User) {
    if (requester.id !== userId && requester.role !== 'instructor') throw new HttpError(403, 'Trainees can only view their own skill profile.');
    const target = this.users().find(u => u.id === userId);
    if (!target) throw new HttpError(404, 'Unknown trainee profile.');
    const sessions = this.sessions(target);
    const { profile, persisted } = this.skillProfile(userId, sessions);
    const calibration = calibrateDifficulty(sessions);
    return { profile, calibration, persisted, recommendations: weaknessRecommendations(profile), patterns: detectPatterns(userId, sessions) };
  }
  /** Single source of truth for a trainee's skill profile: persisted rows win, fresh compute is the backfill. */
  private skillProfile(userId: string, sessions: SessionRecord[]) {
    const persisted = this.readSkills(userId);
    if (persisted) return { profile: { user_id: userId, skills: persisted, weakest: DIMENSIONS.reduce((w, d) => persisted[d].mean < persisted[w].mean ? d : w, DIMENSIONS[0]), cold_start: Object.values(persisted)[0].sessions < 2 }, persisted: true };
    return { profile: profileFromSessions(userId, sessions), persisted: false };
  }
  recommend(user: User, seed?: number) {
    const sessions = this.sessions(user);
    const { profile } = this.skillProfile(user.id, sessions);
    const calibration = calibrateDifficulty(sessions);
    const recent = sessions.slice(0, 12).map(s => { try { return fingerprint(s.scenario); } catch { return ''; } });
    const rec = recommendNext(profile, calibration, recent);
    // Deterministic fallback seed derived from user history — same state always
    // yields the same recommendation; no wall-clock leaks into the engine.
    const effective = seed ?? parseInt(hashText([user.id, sessions.length, recent.join(',')].join(':')), 16);
    // AI scenario intelligence: weakness → challenge profile → generator knobs
    // → adversary emphasis. The fairness gate inside generateScenario stays mandatory.
    const patterns = detectPatterns(user.id, sessions);
    const challenge = challengeFromWeakness(profile.weakest);
    const tactics = adversaryTactics(profile.weakest);
    const generated = generateScenario({
      ...challengeToOptions(challenge, {
        seed: effective,
        difficulty: rec.difficulty,
        focus: rec.focus,
        recent_fingerprints: rec.recent_fingerprints,
      }),
      behaviorBias: tactics.map(t => t.behavior),
    });
    // Skill movement since the previous session, for the "learning update" moment.
    // Computed by the same update rule with and without the latest session.
    const ordered = [...sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
    const skillDeltas =
      ordered.length === 0
        ? []
        : DIMENSIONS.map(dimension => {
            const before = profileFromSessions(
              user.id,
              ordered.slice(0, -1).filter(s => !s.synthetic && !s.report.provisional),
            ).skills[dimension].mean;
            const after = profile.skills[dimension].mean;
            return { dimension, before, after };
          })
            .filter(d => d.before !== d.after)
            .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
            .slice(0, 3);
    return {
      ...rec,
      seed: effective,
      challenge,
      tactics,
      patterns,
      skillDeltas,
      scenario: generated.scenario,
      fingerprint: generated.fingerprint,
      baseline: generated.baseline,
    };
  }
  private assertUnit(unit_id: string) {
    if (!this.db.prepare('SELECT id FROM units WHERE id=?').get(unit_id)) throw new HttpError(400, `Unknown unit '${unit_id}'.`);
  }
  private assertDueAt(due_at: unknown): string | null {
    if (due_at === undefined || due_at === null || due_at === '') return null;
    if (typeof due_at !== 'string' || Number.isNaN(Date.parse(due_at))) throw new HttpError(400, 'due_at must be an ISO date string.');
    return due_at;
  }
  saveInstructorScenario(instructor: User, scenario: unknown) {
    if (instructor.role !== 'instructor') throw new HttpError(403, 'Instructor sign-in required.');
    assertScenario(scenario);
    const s = scenario as Scenario;
    if (!runBaseline(s).report.passed) throw new HttpError(400, 'This exercise did not pass the delayed-baseline feasibility check.');
    this.db.prepare('INSERT INTO scenarios(id,title,json,source,seed) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,json=excluded.json,source=excluded.source,seed=excluded.seed').run(s.id, s.title, serialize(s), 'instructor', s.seed);
    return { id: s.id };
  }
  createAssignment(instructor: User, unit_id: string, scenario: unknown, due_at?: string) {
    if (instructor.role !== 'instructor') throw new HttpError(403, 'Instructor sign-in required.');
    this.assertUnit(unit_id);
    assertScenario(scenario);
    const s = scenario as Scenario;
    if (!runBaseline(s).report.passed) throw new HttpError(400, 'This exercise did not pass the delayed-baseline feasibility check.');
    const id = randomUUID();
    this.db.prepare('INSERT INTO assignments VALUES(?,?,?,?,?,?)').run(id, instructor.id, unit_id, serialize(scenario), this.assertDueAt(due_at), new Date().toISOString());
    this.db.prepare('INSERT OR IGNORE INTO scenarios(id,title,json,source,seed) VALUES(?,?,?,?,?)').run(s.id, s.title, serialize(s), 'instructor', s.seed);
    return { id };
  }
  updateAssignment(instructor: User, id: string, patch: { unit_id?: string; due_at?: string | null; scenario?: unknown }) {
    if (instructor.role !== 'instructor') throw new HttpError(403, 'Instructor sign-in required.');
    const row = this.db.prepare('SELECT * FROM assignments WHERE id=?').get(id);
    if (!row) throw new HttpError(404, 'Assignment not found.');
    const unit_id = patch.unit_id ?? String(row.unit_id);
    this.assertUnit(unit_id);
    const due_at = patch.due_at === undefined ? (row.due_at as string | null) : this.assertDueAt(patch.due_at);
    let scenario_json = String(row.scenario_json);
    if (patch.scenario !== undefined) {
      assertScenario(patch.scenario);
      if (!runBaseline(patch.scenario as Scenario).report.passed) throw new HttpError(400, 'This exercise did not pass the delayed-baseline feasibility check.');
      scenario_json = serialize(patch.scenario);
    }
    this.db.prepare('UPDATE assignments SET unit_id=?,scenario_json=?,due_at=? WHERE id=?').run(unit_id, scenario_json, due_at, id);
    return { id };
  }
  deleteAssignment(instructor: User, id: string) {
    if (instructor.role !== 'instructor') throw new HttpError(403, 'Instructor sign-in required.');
    const result = this.db.prepare('DELETE FROM assignments WHERE id=?').run(id);
    if (result.changes === 0) throw new HttpError(404, 'Assignment not found.');
    return { id };
  }
  assignments(user: User) {
    const rows = user.role === 'instructor'
      ? this.db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all()
      : this.db.prepare('SELECT * FROM assignments WHERE unit_id=? ORDER BY created_at DESC').all(user.unit_id);
    return rows.map(r => ({ id: r.id, instructor_id: r.instructor_id, unit_id: r.unit_id, scenario: JSON.parse(String(r.scenario_json)), due_at: r.due_at, created_at: r.created_at }));
  }
  unitOverview(user: User) {
    if (user.role !== 'instructor') throw new HttpError(403, 'Instructor sign-in required.');
    const sessions = this.sessions(user);
    const byUser: Record<string, { sessions: number; avg: number; last: string }> = {};
    for (const s of sessions.filter(x => !x.synthetic)) {
      const e = byUser[s.user_id] ?? { sessions: 0, avg: 0, last: '' };
      e.avg = (e.avg * e.sessions + s.report.total) / (e.sessions + 1);
      e.sessions += 1; e.last = s.started_at > e.last ? s.started_at : e.last;
      byUser[s.user_id] = e;
    }
    return { users: this.users(), byUser, total: sessions.length };
  }
  private seedDemo() {
    this.transaction(() => {
      for (const run of demoRuns()) {
        const sim = run.simulation;
        this.db.prepare('INSERT INTO sessions(id,user_id,scenario_json,mode,started_at,ended_at,end_tick,actions_json,engine_version,synthetic) VALUES(?,?,?,?,?,?,?,?,?,1)').run(run.id, run.user_id, serialize(sim.scenario), 'training', run.started_at, new Date(new Date(run.started_at).getTime() + sim.state.tick * 250).toISOString(), sim.state.tick, serialize(sim.actions), ENGINE_VERSION);
        this.appendEvents(run.id, sim.events);
        this.db.prepare('INSERT INTO score_reports VALUES(?,?)').run(run.id, serialize(scoreSimulation(sim)));
      }
    });
  }
}
