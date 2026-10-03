import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../backend/app';
import { Store } from '../backend/store';
import { SCRIPTED_SCENARIOS } from '../sim-core/catalog';
import { Simulation, replay } from '../sim-core/engine';
import { scoreSimulation } from '../sim-core/scoring';

const stores: Store[] = [];
function setup() { const store = new Store(':memory:', false); stores.push(store); return { store, app: createApp(store) }; }
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

describe('local API and immutable SQLite records', () => {
  it('ships labeled synthetic examples whose saved inputs reproduce their scores', () => {
    const store = new Store(':memory:', true); stores.push(store);
    const operator = store.users().find(u => u.id === 'operator')!;
    const examples = store.sessions(operator);
    expect(examples).toHaveLength(24);
    for (const example of examples) {
      expect(example.synthetic).toBe(true);
      expect(scoreSimulation(replay(example.scenario, example.actions, example.end_tick))).toEqual(example.report);
    }
  });
  it('recomputes the score, saves immutable events, and is idempotent on completion', async () => {
    const { app, store } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' }).expect(200);
    const started = await agent.post('/api/sessions').send({ scenario: SCRIPTED_SCENARIOS[0], mode: 'training' }).expect(201);
    const sim = new Simulation(started.body.scenario);
    for (let i = 0; i < 40; i++) sim.step();
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'acknowledge' });
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'classify', classification: 'hostile', drone_type: 'recon' });
    await agent.put(`/api/sessions/${started.body.id}/checkpoint`).send({ tick: 40, actions: sim.actions }).expect(200);
    sim.step(); sim.finish();
    const finished = await agent.post(`/api/sessions/${started.body.id}/finish`).send({ tick: 41, actions: sim.actions, score: 100 }).expect(200);
    expect(finished.body.report).toEqual(scoreSimulation(sim));
    const events = await agent.get(`/api/sessions/${started.body.id}/events`).expect(200);
    expect(events.body).toEqual(sim.events);
    expect(() => store.db.prepare('UPDATE events SET tick=0 WHERE session_id=?').run(started.body.id)).toThrow('append-only');
    const duplicate = await agent.post(`/api/sessions/${started.body.id}/finish`).send({ tick: 41, actions: sim.actions }).expect(200);
    expect(duplicate.body).toEqual(finished.body);
  });
  it('rejects rewritten action prefixes and invalid checkpoints', async () => {
    const { app } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    const { body: run } = await agent.post('/api/sessions').send({ scenario: SCRIPTED_SCENARIOS[0], mode: 'training' });
    const sim = replay(run.scenario, [], 40, false);
    sim.dispatch({ tick: 40, actor_id: 'C1', type: 'acknowledge' });
    await agent.put(`/api/sessions/${run.id}/checkpoint`).send({ tick: 40, actions: sim.actions }).expect(200);
    await agent.put(`/api/sessions/${run.id}/checkpoint`).send({ tick: 41, actions: [] }).expect(409);
    await agent.put(`/api/sessions/${run.id}/checkpoint`).send({ tick: -1, actions: sim.actions }).expect(400);
    await agent.get(`/api/sessions/${run.id}/events`).expect(409);
  });
  it('enforces local authentication and per-trainee ownership', async () => {
    const { app } = setup(); const a = request.agent(app), b = request.agent(app);
    await request(app).get('/api/bootstrap').expect(401);
    await a.post('/api/auth/login').send({ id: 'operator', password: 'wrong' }).expect(401);
    await a.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    const { body: run } = await a.post('/api/sessions').send({ scenario: SCRIPTED_SCENARIOS[0], mode: 'training' });
    await b.post('/api/auth/login').send({ id: 'demo-01', password: 'drishti-demo' });
    await b.post(`/api/sessions/${run.id}/finish`).send({ tick: 0, actions: [] }).expect(403);
    await a.post('/api/scenarios/generate').set('Origin', 'https://example.com').send({ seed: 12, difficulty: 2 }).expect(403);
  });
  it('makes consecutive attempts distinct and retains server-side recovery', async () => {
    const { app } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    const one = await agent.post('/api/sessions').send({ scenario: SCRIPTED_SCENARIOS[0], mode: 'training' });
    const bootstrap = await agent.get('/api/bootstrap');
    expect(bootstrap.body.draft.id).toBe(one.body.id);
    await agent.post(`/api/sessions/${one.body.id}/finish`).send({ tick: 0, actions: [] });
    const two = await agent.post('/api/sessions').send({ scenario: SCRIPTED_SCENARIOS[0], mode: 'training' }).expect(201);
    expect(two.body.scenario.seed).not.toBe(one.body.scenario.seed);
  });
  it('persists skill_state on finish and serves it with a persisted flag', async () => {
    const { app, store } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' }).expect(200);
    const finishFull = async (scenario: (typeof SCRIPTED_SCENARIOS)[number]) => {
      const { body: run } = await agent.post('/api/sessions').send({ scenario, mode: 'training' }).expect(201);
      const endTick = run.scenario.duration_s * 4;
      const done = await agent.post(`/api/sessions/${run.id}/finish`).send({ tick: endTick, actions: [] }).expect(200);
      expect(done.body.report.provisional).toBe(false);
    };
    await finishFull(SCRIPTED_SCENARIOS[0]);
    const rows = store.db.prepare('SELECT COUNT(*) AS n FROM skill_state WHERE user_id=?').get('operator') as unknown as { n: number };
    expect(rows.n).toBe(7);
    const profile = await agent.get('/api/adaptive/profile').expect(200);
    expect(profile.body.persisted).toBe(true);
    expect(Object.keys(profile.body.profile.skills)).toHaveLength(7);
    expect(profile.body.profile.cold_start).toBe(true);
    expect(profile.body.recommendations.length).toBeGreaterThan(0);
    // Second full finish updates in place rather than duplicating rows.
    await finishFull(SCRIPTED_SCENARIOS[1]);
    const again = store.db.prepare('SELECT COUNT(*) AS n FROM skill_state WHERE user_id=?').get('operator') as unknown as { n: number };
    expect(again.n).toBe(7);
    const profile2 = await agent.get('/api/adaptive/profile').expect(200);
    expect(profile2.body.profile.cold_start).toBe(false);
  });
  it('restricts cross-trainee skill profiles to instructors', async () => {
    const { app } = setup();
    const trainee = request.agent(app), instructor = request.agent(app);
    await trainee.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    await instructor.post('/api/auth/login').send({ id: 'instructor', password: 'drishti-demo' });
    await trainee.get('/api/adaptive/profile?user_id=demo-01').expect(403);
    await instructor.get('/api/adaptive/profile?user_id=operator').expect(200);
    await instructor.get('/api/adaptive/profile?user_id=nobody').expect(404);
  });
  it('returns deterministic recommendations for identical state', async () => {
    const { app } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    const first = await agent.post('/api/adaptive/recommend').send({}).expect(200);
    const second = await agent.post('/api/adaptive/recommend').send({}).expect(200);
    expect(second.body.seed).toBe(first.body.seed);
    expect(second.body.scenario).toEqual(first.body.scenario);
  });
  it('validates assignment units/dates and supports update + delete', async () => {
    const { app } = setup();
    const trainee = request.agent(app), instructor = request.agent(app);
    await trainee.post('/api/auth/login').send({ id: 'operator', password: 'drishti-demo' });
    await instructor.post('/api/auth/login').send({ id: 'instructor', password: 'drishti-demo' });
    const scenario = SCRIPTED_SCENARIOS[0];
    await trainee.post('/api/assignments').send({ scenario, unit_id: 'unit-alpha' }).expect(403);
    await instructor.post('/api/assignments').send({ scenario, unit_id: 'nope' }).expect(400);
    await instructor.post('/api/assignments').send({ scenario, unit_id: 'unit-alpha', due_at: 'not-a-date' }).expect(400);
    const created = await instructor.post('/api/assignments').send({ scenario, unit_id: 'unit-alpha', due_at: '2026-12-01' }).expect(201);
    await instructor.put(`/api/assignments/${created.body.id}`).send({ due_at: '2026-12-15' }).expect(200);
    await instructor.put(`/api/assignments/${created.body.id}`).send({ unit_id: 'nope' }).expect(400);
    const listed = await instructor.get('/api/assignments').expect(200);
    expect(listed.body.some((a: { id: string }) => a.id === created.body.id)).toBe(true);
    await trainee.delete(`/api/assignments/${created.body.id}`).expect(403);
    await instructor.delete(`/api/assignments/${created.body.id}`).expect(200);
    await instructor.delete(`/api/assignments/${created.body.id}`).expect(404);
  });
  it('persists instructor scenarios to the library with a feasibility gate', async () => {
    const { app } = setup(); const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ id: 'instructor', password: 'drishti-demo' });
    const custom = { ...SCRIPTED_SCENARIOS[0], id: 'instructor-custom', title: 'Custom drill', source: 'instructor' as const };
    await agent.post('/api/instructor/scenarios').send({ scenario: custom }).expect(201);
    const library = await agent.get('/api/scenarios').expect(200);
    expect(library.body.some((s: { id: string }) => s.id === 'instructor-custom')).toBe(true);
    const unfair = { ...custom, id: 'unfair', actors: [] };
    await agent.post('/api/instructor/scenarios').send({ scenario: unfair }).expect(400);
  });
});
