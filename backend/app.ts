import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { HttpError, Store } from './store';
import { generateScenario } from '../sim-core/generator';
import { ENGINE_VERSION, type User } from '../sim-core/types';

const cookieToken = (req: Request) => req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('drishti_token='))?.slice(14);
const user = (res: Response) => res.locals.user as User;

export function createApp(store: Store, webRoot?: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin) {
      try { if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname)) throw new Error(); }
      catch { next(new HttpError(403, 'Only the local training interface may use this API.')); return; }
    }
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', engine_version: ENGINE_VERSION, storage: 'sqlite', external_services: 0 }));
  app.get('/api/auth/profiles', (_req, res) => res.json(store.users()));
  app.post('/api/auth/login', (req, res) => {
    const login = store.login(String(req.body?.id ?? ''), req.body?.password);
    res.cookie('drishti_token', login.token, { httpOnly: true, sameSite: 'strict', maxAge: 24 * 3600 * 1000, path: '/' });
    res.json(login.user);
  });
  app.post('/api/auth/logout', (req, res) => { store.logout(cookieToken(req) ?? ''); res.clearCookie('drishti_token'); res.json({ ok: true }); });
  app.use('/api', (req, res, next) => {
    const authenticated = store.authenticate(cookieToken(req));
    if (!authenticated) { next(new HttpError(401, 'Sign in to your local training station.')); return; }
    res.locals.user = authenticated; next();
  });
  app.get('/api/auth/me', (_req, res) => res.json(user(res)));
  app.get('/api/bootstrap', (_req, res) => res.json({ user: user(res), users: store.users(), scenarios: store.scenarios(), sessions: store.sessions(user(res)), draft: store.draft(user(res)), engine_version: ENGINE_VERSION }));
  app.get('/api/scenarios', (_req, res) => res.json(store.scenarios()));
  app.post('/api/scenarios/generate', (req, res) => res.json(generateScenario(req.body)));
  app.get('/api/sessions', (_req, res) => res.json(store.sessions(user(res))));
  app.post('/api/sessions', (req, res) => res.status(201).json(store.start(user(res), req.body?.scenario, req.body?.mode)));
  app.get('/api/sessions/:id', (req, res) => res.json(store.session(String(req.params.id), user(res))));
  app.get('/api/sessions/:id/events', (req, res) => res.json(store.events(String(req.params.id), user(res))));
  app.put('/api/sessions/:id/checkpoint', (req, res) => res.json(store.checkpoint(String(req.params.id), user(res), req.body?.actions, req.body?.tick)));
  app.post('/api/sessions/:id/finish', (req, res) => res.json(store.finish(String(req.params.id), user(res), req.body?.actions, req.body?.tick)));
  app.get('/api/adaptive/profile', (req, res) => res.json(store.adaptiveProfile(String(req.query.user_id ?? user(res).id), user(res))));
  app.post('/api/adaptive/recommend', (req, res) => res.json(store.recommend(user(res), typeof req.body?.seed === 'number' ? req.body.seed : undefined)));
  app.post('/api/instructor/scenarios', (req, res) => res.status(201).json(store.saveInstructorScenario(user(res), req.body?.scenario)));
  app.get('/api/assignments', (_req, res) => res.json(store.assignments(user(res))));
  app.post('/api/assignments', (req, res) => res.status(201).json(store.createAssignment(user(res), String(req.body?.unit_id ?? user(res).unit_id), req.body?.scenario, req.body?.due_at)));
  app.put('/api/assignments/:id', (req, res) => res.json(store.updateAssignment(user(res), String(req.params.id), { unit_id: req.body?.unit_id, due_at: req.body?.due_at, scenario: req.body?.scenario })));
  app.delete('/api/assignments/:id', (req, res) => res.json(store.deleteAssignment(user(res), String(req.params.id))));
  app.get('/api/unit/overview', (_req, res) => res.json(store.unitOverview(user(res))));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Unknown API endpoint.')));
  if (webRoot && existsSync(resolve(webRoot, 'index.html'))) {
    app.use(express.static(webRoot, { index: 'index.html', setHeaders: (res, path) => { if (path.endsWith('sw.js') || path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(webRoot, 'index.html')));
  }
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'Invalid JSON request.' }); return; }
    res.status(400).json({ error: error instanceof Error ? error.message : 'The request could not be completed.' });
  };
  app.use(errors);
  return app;
}
