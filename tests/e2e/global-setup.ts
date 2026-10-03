import { rmSync } from 'node:fs';

/**
 * Start every E2E run from an empty station database so drafts from previous
 * runs can never leak into assertions (e.g. duplicate Resume buttons).
 */
export default function setup(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(`data/e2e-test.sqlite${suffix}`, { force: true });
    } catch {
      // Missing files are the normal case.
    }
  }
}
