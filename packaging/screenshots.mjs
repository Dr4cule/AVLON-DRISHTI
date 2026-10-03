// Captures README screenshots against a running station (default :3001).
// Usage: node packaging/screenshots.mjs [baseUrl]
// Writes docs/images/*.png. Uses present-mode for legible projector-style shots.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3001';
mkdirSync('docs/images', { recursive: true });

async function api(path, method = 'GET', body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `drishti_token=${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`${method} ${path} -> non-JSON: ${text.slice(0, 80)}`); }
}

// Login returns the user; capture the auth cookie via a raw call:
async function login(id) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password: 'drishti-demo' }) });
  if (!res.ok) throw new Error(`login ${id} -> ${res.status}`);
  const m = /drishti_token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '');
  if (!m) throw new Error('no auth cookie');
  return m[1];
}

const browser = await chromium.launch();
async function contextFor(token) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, baseURL: BASE });
  await ctx.addCookies([{ name: 'drishti_token', value: token, domain: '127.0.0.1', path: '/' }]);
  await ctx.addInitScript(() => { try { localStorage.setItem('drishti.present-mode', 'true'); } catch {} });
  return ctx;
}

// Pick a synthetic session with recorded mistakes for the richest debrief shot.
const opToken = await login('operator');
const boot = await api('/bootstrap', 'GET', undefined, opToken);
const rich = boot.sessions.find(s => s.synthetic && s.report.mistakes.length > 0) ?? boot.sessions[0];
console.log('debrief session:', rich.id, '| score', rich.report.total, '| mistakes', rich.report.mistakes.length);

const ctx = await contextFor(opToken);
const page = await ctx.newPage();

// 1 — Mission control: live exercise with a classified contact.
await page.goto('/', { waitUntil: 'networkidle' });
await page.getByText('OFFLINE READY').waitFor({ timeout: 30000 });
// A stale draft may exist (e.g. an unfinished run) — finish it first so we start clean.
const endBtn = page.getByRole('button', { name: 'End & debrief' });
if (await endBtn.isEnabled()) {
  await endBtn.click();
  await page.getByText('Every decision tells a story').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Mission control' }).click();
}
await page.locator('button.button.primary', { hasText: 'Start exercise' }).click();
await page.getByLabel('Simulation speed').selectOption('8');
const firstTrack = page.locator('table.track-table tbody tr').first();
await firstTrack.waitFor({ timeout: 90000 });
await firstTrack.click();
await page.keyboard.press('a');
await page.keyboard.press('1');
await page.getByRole('button', { name: 'Record response' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/images/01-mission.png', fullPage: true });

// 2 — Scenario library.
await page.getByRole('button', { name: 'Scenario library' }).click();
await page.getByText('Nightfall').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/images/02-scenarios.png', fullPage: true });

// 3 — After-action review on the synthetic session (rich mistake list + verified replay).
await page.getByRole('button', { name: 'After-action review' }).click();
await page.getByLabel('Review session').selectOption(rich.id);
await page.getByText('REPLAY VERIFIED').waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/images/03-aar.png', fullPage: true });

// 4 — Adaptive intelligence with a recommendation.
await page.getByRole('button', { name: 'Adaptive intelligence' }).click();
await page.getByRole('button', { name: 'Recommend my next exercise' }).click();
await page.getByText('AI RECOMMENDATION').waitFor({ timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/images/04-adaptive.png', fullPage: true });
await ctx.close();

// 5+6 — Instructor views.
const insToken = await login('instructor');
const ictx = await contextFor(insToken);
const ip = await ictx.newPage();
await ip.goto('/', { waitUntil: 'networkidle' });
await ip.getByText('OFFLINE READY').waitFor({ timeout: 30000 });
await ip.getByRole('button', { name: 'Scenario studio' }).click();
await ip.getByText('Ground-truth preview').waitFor({ timeout: 15000 });
await ip.waitForTimeout(800);
await ip.screenshot({ path: 'docs/images/05-studio.png', fullPage: true });
await ip.getByRole('button', { name: 'Unit readiness' }).click();
await ip.getByText('Unit readiness').first().waitFor({ timeout: 15000 });
await ip.waitForTimeout(800);
await ip.screenshot({ path: 'docs/images/06-readiness.png', fullPage: true });
await ictx.close();
await browser.close();
console.log('screenshots saved to docs/images/');
