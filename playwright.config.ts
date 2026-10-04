import { defineConfig } from '@playwright/test';

// Unique database per run (override with E2E_RUN_ID in CI for traceability).
// Combined with the stale-file sweep in global-setup, parallel or repeated
// runs can never share station state.
const runId = process.env.E2E_RUN_ID ?? Date.now().toString(36);
export default defineConfig({
  testDir: 'tests/e2e', timeout: 180000, globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:3001', headless: true },
  webServer: {
    // Rebuild first so the browser always exercises the current frontend
    // together with the current backend — never a stale dist/ directory.
    command: 'npm run build && node packaging/dev.mjs', url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: false, timeout: 240000,
    env: { DRISHTI_DB: `data/e2e-test-${runId}.sqlite`, DRISHTI_DEMO: '0', PORT: '3001' },
  },
});
