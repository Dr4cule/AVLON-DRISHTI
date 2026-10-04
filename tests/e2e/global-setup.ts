import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * E2E isolation: every run gets a unique database (see playwright.config.ts),
 * so drafts from previous runs can never leak into assertions. This setup only
 * sweeps STALE files from killed runs — anything modified in the last 2 hours
 * is left alone because a concurrent local run may own it.
 */
export default function setup(): void {
  let entries: string[] = [];
  try {
    entries = readdirSync('data');
  } catch {
    return;
  }
  const cutoff = Date.now() - 2 * 3600 * 1000;
  for (const file of entries) {
    if (!/^e2e-test.*\.sqlite(-wal|-shm)?$/.test(file)) continue;
    const path = join('data', file);
    try {
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
    } catch {
      // A concurrent run may hold the file; leave it alone.
    }
  }
}
