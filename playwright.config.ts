import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 180000,
  use: { baseURL: 'http://127.0.0.1:3001', headless: true },
  webServer: {
    command: 'node packaging/dev.mjs', url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: false, timeout: 120000,
    env: { DRISHTI_DB: 'data/e2e-test.sqlite', DRISHTI_DEMO: '0', PORT: '3001' },
  },
});
