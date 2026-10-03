import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Documentation consistency guard. The pitch deck, README, and progress docs
 * copy numbers from the generated metrics artifact — never from memory. If
 * this test fails after a retrain or after adding tests, update the docs
 * (and this file's stale-string list), don't weaken the test.
 *
 * NOTE: this file counts itself. Adding tests here changes the suite total,
 * so update the expected total below and every claim it checks.
 */
const EXPECTED_TOTAL = 82;
const EXPECTED_FILES = 11;

function countTests(): { total: number; files: number } {
  const dir = 'tests';
  const files = readdirSync(dir).filter(f => f.endsWith('.test.ts'));
  let total = 0;
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    total += (src.match(/^\s*it\(/gm) ?? []).length;
  }
  return { total, files: files.length };
}

function readDoc(p: string): string {
  return readFileSync(p, 'utf8');
}

const metrics = JSON.parse(readFileSync('docs/AI_METRICS.json', 'utf8'));
const README = () => readDoc('README.md');
const REPORT = () => readDoc('docs/AI_THREAT_REPORT.md');
const COMPONENTS = () => readDoc('docs/AI_COMPONENTS.md');
const DECISIONS = () => readDoc('docs/DECISIONS.md');
const PITCH = () => readDoc('docs/PITCH_DECK.md');
const DEMO = () => readDoc('docs/DEMO_SCRIPT.md');
const PROGRESS = () => readDoc('docs/PROGRESS.md');

describe('documentation consistency', () => {
  it('suite total matches every count claim in presentation docs', () => {
    const { total, files } = countTests();
    expect(total).toBe(EXPECTED_TOTAL);
    expect(files).toBe(EXPECTED_FILES);
    expect(README()).toContain(`${total}/${total} Vitest`);
    expect(README()).toContain(`tests-${total}%2F${total}%20vitest`);
    expect(README()).toContain(`${total} Vitest (${files} files)`);
    expect(PITCH()).toContain(`${total} unit tests`);
    expect(PROGRESS()).toContain(`${total}/${total} Vitest`);
  });
  it('pitch deck and README copy measured metrics from the artifact, not memory', () => {
    const accuracyPct = `${(metrics.testAccuracy * 100).toFixed(1)}%`;
    const macroF1 = metrics.macroF1.toFixed(2);
    const balanced = metrics.balancedAccuracy.toFixed(2);
    // Headline metrics appear in all three presentation docs (thousands
    // separators stripped — "14,874" and "14874" are the same claim).
    for (const doc of [PITCH(), README(), REPORT()]) {
      const flat = doc.replaceAll(',', '');
      expect(flat).toContain(accuracyPct);
      expect(flat).toContain(String(macroF1));
      expect(flat).toContain(String(balanced));
      expect(flat).toContain(String(metrics.samples));
      expect(flat).toContain(String(metrics.scenarios));
    }
    // Full split counts live in the scientific report only — the deck keeps the slide readable.
    expect(REPORT()).toContain(String(metrics.testSamples));
    expect(REPORT()).toContain(String(metrics.trainSamples));
    expect(REPORT()).toContain(String(metrics.eceBefore));
    expect(REPORT()).toContain(String(metrics.eceAfter));
    expect(REPORT()).toContain('Expected Calibration Error');
    expect(PITCH()).toContain(`ECE ${metrics.eceBefore}→${metrics.eceAfter}`);
  });
  it('rejects known-stale metric strings everywhere they could mislead', () => {
    const stale = ['38/38', '69.3%', 'macro F1 0.60', 'balanced accuracy 0.68'];
    for (const doc of [README(), REPORT(), COMPONENTS(), DECISIONS(), PITCH(), DEMO(), PROGRESS()]) {
      for (const s of stale) expect(doc).not.toContain(s);
    }
  });
  it('keeps the honest-AI contract visible in presentation docs', () => {
    expect(PITCH()).toContain('AI DOES');
    expect(PITCH()).toContain('AI DOES NOT');
    expect(PITCH()).toContain('Human decides');
    expect(README()).toContain('AI AT A GLANCE');
    expect(README()).toContain('No LLM');
    expect(DEMO()).toContain('baseline-feasibility gate');
    for (const doc of [README(), PITCH(), COMPONENTS(), DEMO()]) {
      expect(doc).not.toMatch(/advanced AI|smart AI|AI-powered everything|intelligent combat AI/i);
    }
  });
  it('metrics artifact is internally consistent', () => {
    expect(metrics.trainSamples + metrics.calibrationSamples + metrics.testSamples).toBe(metrics.samples);
    expect(metrics.trainScenarios + metrics.calibrationScenarios + metrics.testScenarios).toBe(metrics.scenarios);
    expect(metrics.eceAfter).toBeLessThanOrEqual(metrics.eceBefore + 1e-9);
    expect(metrics.temperature).toBeGreaterThanOrEqual(0.1);
    expect(metrics.temperature).toBeLessThanOrEqual(10);
    expect(metrics.featureCount).toBe(15);
    expect(metrics.classCount).toBe(6);
  });
});
