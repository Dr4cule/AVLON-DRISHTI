import { test, expect } from '@playwright/test';
test('judge path: health, login, bootstrap, generate, recommend', async ({ request }) => {
  await expect(request.get('/api/health')).resolves.toBeTruthy();
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  const h = await health.json();
  expect(h.external_services).toBe(0);
  const login = await request.post('/api/auth/login', { data: { id: 'operator', password: 'drishti-demo' } });
  expect(login.ok()).toBe(true);
  const bootstrap = await request.get('/api/bootstrap');
  expect(bootstrap.ok()).toBe(true);
  const gen = await request.post('/api/scenarios/generate', { data: { seed: 4242, difficulty: 2 } });
  expect(gen.ok()).toBe(true);
  const rec = await request.post('/api/adaptive/recommend', { data: { seed: 4242 } });
  expect(rec.ok()).toBe(true);
});
