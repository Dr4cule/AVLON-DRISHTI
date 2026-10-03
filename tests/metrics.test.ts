import { describe, expect, it } from 'vitest';
import {
  balancedAccuracy,
  confusionTotals,
  confusedPairs,
  expectedCalibrationError,
  groupSummary,
  hostileBinaryMetrics,
  macroAverage,
} from '../sim-core/threat/metrics';

// Toy 3-class matrix (classes beyond index 2 are empty):
// truth 0: [5, 2, 1]   truth 1: [1, 6, 0]   truth 2: [0, 0, 0]
const TOY = [
  [5, 2, 1, 0, 0, 0],
  [1, 6, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

describe('evaluation metrics on known toy matrices', () => {
  it('computes accuracy and per-class precision/recall/F1', () => {
    const { perClass, accuracy, n } = confusionTotals(TOY);
    expect(n).toBe(15);
    expect(accuracy).toBeCloseTo(11 / 15, 3);
    // Class 0: tp=5, predicted=5+1=6, actual=8 → p=5/6, r=5/8.
    expect(perClass[0].precision).toBeCloseTo(5 / 6, 3);
    expect(perClass[0].recall).toBeCloseTo(5 / 8, 3);
    expect(perClass[0].f1).toBeCloseTo((2 * (5 / 6) * (5 / 8)) / (5 / 6 + 5 / 8), 3);
    // Empty classes contribute zeros, never NaN.
    expect(perClass[2].precision).toBe(0);
    expect(perClass[2].recall).toBe(0);
    expect(perClass[2].f1).toBe(0);
  });
  it('averages macros over supported classes only', () => {
    const { perClass } = confusionTotals(TOY);
    expect(macroAverage(perClass, 'recall')).toBeCloseTo((5 / 8 + 6 / 7) / 2, 3);
    expect(balancedAccuracy(perClass)).toBeCloseTo((5 / 8 + 6 / 7) / 2, 3);
    expect(macroAverage([], 'f1')).toBe(0);
  });
  it('ranks confused pairs programmatically', () => {
    const pairs = confusedPairs(TOY, 2);
    expect(pairs[0]).toEqual({ truth: 'bird', predicted: 'balloon', count: 2 });
    expect(pairs[1]).toEqual({ truth: 'bird', predicted: 'friendly_uav', count: 1 });
  });
  it('summarizes groups with mean/median/min/max', () => {
    expect(groupSummary([0.5, 0.7, 0.9])).toEqual({ mean: 0.7, median: 0.7, min: 0.5, max: 0.9, count: 3 });
    expect(groupSummary([0.4, 0.8]).median).toBeCloseTo(0.6, 3);
    expect(groupSummary([]).count).toBe(0);
  });
  it('derives hostile-vs-non-hostile rates correctly', () => {
    // hostile_like_uav is index 4. Truth: [4,4,0], predicted: [4,0,4].
    const m = hostileBinaryMetrics([4, 4, 0], [4, 0, 4]);
    expect(m.positives).toBe(2);
    expect(m.precision).toBe(0.5);
    expect(m.recall).toBe(0.5);
    expect(m.f1).toBe(0.5);
    expect(m.falsePositiveRate).toBe(1);
    expect(m.falseNegativeRate).toBe(0.5);
  });
});

describe('calibration (ECE) on synthetic examples', () => {
  it('scores ~0 for perfectly calibrated predictions', () => {
    // 10 predictions at 70%: exactly 7 correct → ECE ≈ 0.
    const conf = new Array(10).fill(0.7);
    const correct = [true, true, true, true, true, true, true, false, false, false];
    expect(expectedCalibrationError(conf, correct).ece).toBeLessThan(0.01);
  });
  it('penalizes confident wrongness', () => {
    const conf = new Array(10).fill(0.95);
    const correct = new Array(10).fill(false);
    const { ece, bins } = expectedCalibrationError(conf, correct);
    expect(ece).toBeCloseTo(0.95, 2);
    expect(bins[9].n).toBe(10);
  });
  it('handles empty input without NaN', () => {
    expect(expectedCalibrationError([], []).ece).toBe(0);
  });
});
