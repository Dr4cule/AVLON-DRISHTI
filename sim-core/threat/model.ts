import { FEATURE_NAMES, THREAT_CLASSES, type ThreatClass } from './features';
import weightsJson from './weights.json';

export interface ThreatAssessment {
  predictedClass: ThreatClass;
  confidence: number;
  probabilities: Record<ThreatClass, number>;
  /** 1 - max probability. Higher = less certain. Deterministic given features. */
  uncertainty: number;
  /**
   * Exact linear attribution: W[predicted][i] * x[i] per feature.
   * Positive pushes toward the predicted class, negative away from it.
   * This is exact for a linear model — not an approximation.
   */
  evidence: Record<string, number>;
}

interface WeightTable {
  version: number;
  classes: ThreatClass[];
  features: string[];
  weights: number[][];
  bias: number[];
}

function assertValid(table: WeightTable): asserts table is WeightTable {
  if (
    !table ||
    table.version !== 1 ||
    table.classes.length !== THREAT_CLASSES.length ||
    table.features.length !== FEATURE_NAMES.length ||
    table.weights.length !== THREAT_CLASSES.length ||
    !table.weights.every(row => row.length === FEATURE_NAMES.length) ||
    table.bias.length !== THREAT_CLASSES.length ||
    !table.classes.every((c, i) => c === THREAT_CLASSES[i]) ||
    !table.features.every((f, i) => f === FEATURE_NAMES[i])
  ) {
    throw new Error('Threat weights table is missing or incompatible (expected v1, 6 classes, 14 features).');
  }
}

function loadTable(): WeightTable {
  const table = weightsJson as WeightTable;
  assertValid(table);
  return table;
}

let cached: WeightTable | null = null;
export function getWeights(): WeightTable {
  if (!cached) cached = loadTable();
  return cached;
}

/** For tests: inject an alternative table without touching the bundled file. */
export function setWeightsForTests(table: WeightTable | null): void {
  if (table !== null) assertValid(table);
  cached = table;
}

export function predict(features: number[], table: WeightTable = getWeights()): ThreatAssessment {
  if (features.length !== FEATURE_NAMES.length || features.some(v => !Number.isFinite(v))) {
    throw new Error(`Threat model expects ${FEATURE_NAMES.length} finite features.`);
  }
  const logits = table.classes.map(
    (_, c) => table.bias[c] + table.weights[c].reduce((sum, w, i) => sum + w * features[i], 0),
  );
  const max = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const probabilities = {} as Record<ThreatClass, number>;
  table.classes.forEach((c, i) => {
    probabilities[c] = Math.round((exps[i] / total) * 10000) / 10000;
  });
  let best = 0;
  for (let i = 1; i < table.classes.length; i++) {
    if (exps[i] > exps[best]) best = i;
  }
  const predictedClass = table.classes[best];
  const confidence = probabilities[predictedClass];
  const evidence: Record<string, number> = {};
  FEATURE_NAMES.forEach((name, i) => {
    evidence[name] = Math.round(table.weights[best][i] * features[i] * 10000) / 10000;
  });
  return {
    predictedClass,
    confidence,
    probabilities,
    uncertainty: Math.round((1 - confidence) * 10000) / 10000,
    evidence,
  };
}

/** Display band for UI. Thresholds are documented, not learned. */
export function uncertaintyBand(uncertainty: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (uncertainty < 0.25) return 'LOW';
  if (uncertainty < 0.55) return 'MEDIUM';
  return 'HIGH';
}
