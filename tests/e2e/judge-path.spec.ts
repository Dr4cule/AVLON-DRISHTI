import { test, expect } from '@playwright/test';

/**
 * Full judge path in a real browser against an isolated DB (data/e2e-test.sqlite):
 * launch -> start exercise -> acknowledge/classify/respond -> end & debrief ->
 * verified replay -> adaptive recommendation.
 */
test('judge path: play, decide, debrief verified replay, adaptive next step', async ({ page }) => {
  await page.goto('/');
  // Auto operator login; station must report local readiness.
  await expect(page.getByText('OFFLINE READY')).toBeVisible({ timeout: 60000 });

  // A stale draft from an interrupted run would show a recovery banner with a
  // second Resume button — finish it first so the run below always starts clean.
  if (await page.getByText('Your exercise has been recovered.').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'End & debrief' }).click();
    await expect(page.getByText('Every decision tells a story')).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Mission control' }).click();
  }

  // Start a fresh exercise (default first-light scenario).
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  // Speed up the simulation clock so contacts appear quickly.
  await page.getByLabel('Simulation speed').selectOption('8');

  // Wait for the first sensor contact, then select it.
  const firstTrack = page.locator('table.track-table tbody tr').first();
  await firstTrack.waitFor({ timeout: 120000 });
  await firstTrack.click();

  // Keyboard shortcuts: Acknowledge, then classify hostile.
  await page.keyboard.press('a');
  await expect(page.getByText('acknowledged', { exact: false }).first()).toBeVisible({ timeout: 15000 }).catch(() => {});
  await page.keyboard.press('1');

  // The advisory panel must render for the selected track (never scored, never blocking).
  await expect(page.getByText('AI THREAT ASSESSMENT')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('MODEL CONFIDENCE')).toBeVisible({ timeout: 15000 });

  // Record the default observe response with its reason.
  await page.getByRole('button', { name: 'Record response' }).click();

  // Deliberate ROE mistake: kinetic intercept is prohibited in this exercise.
  // Guarantees a critical, reconstructable mistake for the AAR analysis below.
  await page.getByRole('button', { name: 'Intercept', exact: true }).click();
  await page.getByRole('button', { name: 'Record response' }).click();

  // End the exercise -> auto-navigates to the after-action review.
  await page.getByRole('button', { name: 'End & debrief' }).click();
  await expect(page.getByText('Every decision tells a story')).toBeVisible({ timeout: 60000 });
  // Replay must verify: same inputs reproduce the identical event log.
  await expect(page.getByText('REPLAY VERIFIED')).toBeVisible({ timeout: 30000 });
  // Evidence-based AI analysis must reconstruct what the model estimated then.
  await expect(page.getByText('WHAT THE MODEL SAW THEN')).toBeVisible({ timeout: 30000 });

  // Adaptive panel must recommend a concrete next exercise.
  await page.getByRole('button', { name: 'Adaptive intelligence' }).click();
  await page.getByRole('button', { name: 'Recommend my next exercise' }).click();
  await expect(page.getByText('AI RECOMMENDATION')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('SCENARIO MODIFIERS')).toBeVisible({ timeout: 15000 });
});
