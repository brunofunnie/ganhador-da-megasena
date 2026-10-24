import { DrawDataset, TOTAL_NUMBERS } from './dataset';

/**
 * Structural features of a Mega-Sena ticket and their empirical distribution.
 *
 * The generator samples a *target* feature vector from a real historical draw
 * (bootstrap), then scores candidate tickets by how close they are to that
 * target and how plausible they are under the historical marginals. This
 * replaces the old "3 pares + 3 ímpares" rule: 3/3 is only ~31% of the real
 * draws, while 4/2 and 2/4 together are ~48%.
 */

const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);

export const QUADRANT_LABELS = ['1–15', '16–30', '31–45', '46–60'] as const;

export interface DrawFeatures {
  sum: number;
  evens: number;
  quadrants: [number, number, number, number];
  quadrantsUsed: number;
  consecutivePairs: number;
  maxRun: number;
  primes: number;
  /** Numbers <= 30 (half of the board). */
  low: number;
  maxSameLastDigit: number;
  /** Numbers repeated from the previous draw (0 when there is no previous draw). */
  repeatsPrev: number;
  multiplesOf5: number;
  multiplesOf10: number;
  arithmetic: boolean;
  allUnder32: boolean;
}

export interface SumSummary {
  mean: number;
  standardDeviation: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface FeatureModel {
  total: number;
  targets: DrawFeatures[];
  sum: SumSummary;
  /** Probability arrays indexed by the feature value (Laplace-smoothed). */
  evens: number[];
  quadrantsUsed: number[];
  consecutivePairs: number[];
  primes: number[];
  low: number[];
  maxSameLastDigit: number[];
  repeatsPrev: number[];
  multiplesOf5: number[];
  arithmeticRate: number;
  allUnder32Rate: number;
}

export function extractFeatures(
  numbers: readonly (string | number)[],
  previous?: ReadonlySet<number>
): DrawFeatures {
  const values = numbers
    .map((n) => (typeof n === 'number' ? n : parseInt(n, 10)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_NUMBERS)
    .sort((a, b) => a - b);

  const quadrants: [number, number, number, number] = [0, 0, 0, 0];
  const lastDigits = new Map<number, number>();

  let sum = 0;
  let evens = 0;
  let primes = 0;
  let low = 0;
  let multiplesOf5 = 0;
  let multiplesOf10 = 0;
  let repeatsPrev = 0;

  for (const n of values) {
    sum += n;
    if (n % 2 === 0) evens++;
    if (PRIMES.has(n)) primes++;
    if (n <= 30) low++;
    if (n % 5 === 0) multiplesOf5++;
    if (n % 10 === 0) multiplesOf10++;
    if (previous?.has(n)) repeatsPrev++;
    quadrants[Math.min(3, Math.floor((n - 1) / 15))]++;
    const digit = n % 10;
    lastDigits.set(digit, (lastDigits.get(digit) ?? 0) + 1);
  }

  let consecutivePairs = 0;
  let run = 1;
  let maxRun = values.length > 0 ? 1 : 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1] + 1) {
      consecutivePairs++;
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }

  const gaps = new Set<number>();
  for (let i = 1; i < values.length; i++) gaps.add(values[i] - values[i - 1]);

  return {
    sum,
    evens,
    quadrants,
    quadrantsUsed: quadrants.filter((count) => count > 0).length,
    consecutivePairs,
    maxRun,
    primes,
    low,
    maxSameLastDigit: lastDigits.size > 0 ? Math.max(...lastDigits.values()) : 0,
    repeatsPrev,
    multiplesOf5,
    multiplesOf10,
    arithmetic: values.length >= 3 && gaps.size === 1,
    allUnder32: values.length > 0 && values.every((n) => n <= 31),
  };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index];
}

function distribution(values: number[], maxValue: number): number[] {
  const counts = new Array<number>(maxValue + 1).fill(0);
  for (const value of values) {
    const idx = Math.max(0, Math.min(maxValue, value));
    counts[idx]++;
  }
  const total = values.length;
  if (total === 0) return new Array<number>(maxValue + 1).fill(1 / (maxValue + 1));
  // Laplace smoothing keeps unseen categories possible.
  return counts.map((count) => (count + 0.5) / (total + 0.5 * (maxValue + 1)));
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], average: number): number {
  if (values.length === 0) return 1;
  const variance = values.reduce((acc, value) => acc + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

export function defaultFeatureModel(): FeatureModel {
  const target = extractFeatures([4, 18, 22, 26, 31, 58]);
  return {
    total: 0,
    targets: [target],
    sum: {
      mean: 183,
      standardDeviation: 40,
      p05: 118,
      p25: 155,
      p50: 184,
      p75: 211,
      p95: 248,
    },
    evens: distribution([], 6),
    quadrantsUsed: distribution([], 4),
    consecutivePairs: distribution([], 3),
    primes: distribution([], 6),
    low: distribution([], 6),
    maxSameLastDigit: distribution([], 6),
    repeatsPrev: distribution([], 3),
    multiplesOf5: distribution([], 4),
    arithmeticRate: 0,
    allUnder32Rate: 0.013,
  };
}

export function buildFeatureModel(dataset: DrawDataset): FeatureModel {
  if (dataset.draws.length === 0) return defaultFeatureModel();

  const targets: DrawFeatures[] = [];
  for (let i = 0; i < dataset.draws.length; i++) {
    const previous =
      i > 0
        ? new Set(dataset.draws[i - 1].numbers.map((n) => parseInt(n, 10)))
        : undefined;
    targets.push(extractFeatures(dataset.draws[i].numbers, previous));
  }

  const sums = targets.map((t) => t.sum).sort((a, b) => a - b);
  const sumMean = mean(sums);
  const sumSd = stdDev(sums, sumMean);
  const arithmetic = targets.filter((t) => t.arithmetic).length;
  const allUnder32 = targets.filter((t) => t.allUnder32).length;

  return {
    total: targets.length,
    targets,
    sum: {
      mean: sumMean,
      standardDeviation: sumSd,
      p05: quantile(sums, 0.05),
      p25: quantile(sums, 0.25),
      p50: quantile(sums, 0.5),
      p75: quantile(sums, 0.75),
      p95: quantile(sums, 0.95),
    },
    evens: distribution(targets.map((t) => t.evens), 6),
    quadrantsUsed: distribution(targets.map((t) => t.quadrantsUsed), 4),
    consecutivePairs: distribution(targets.map((t) => Math.min(3, t.consecutivePairs)), 3),
    primes: distribution(targets.map((t) => t.primes), 6),
    low: distribution(targets.map((t) => t.low), 6),
    maxSameLastDigit: distribution(targets.map((t) => t.maxSameLastDigit), 6),
    repeatsPrev: distribution(
      targets.slice(1).map((t) => Math.min(3, t.repeatsPrev)),
      3
    ),
    multiplesOf5: distribution(targets.map((t) => Math.min(4, t.multiplesOf5)), 4),
    arithmeticRate: arithmetic / targets.length,
    allUnder32Rate: allUnder32 / targets.length,
  };
}

function probabilityAt(distributionValues: number[], index: number): number {
  return distributionValues[Math.max(0, Math.min(distributionValues.length - 1, index))] ?? 1e-6;
}

/**
 * How typical a ticket is under the historical marginals (higher is better).
 * Sum uses a Gaussian kernel; categorical features use the empirical
 * (Laplace-smoothed) probabilities.
 */
export function plausibility(features: DrawFeatures, model: FeatureModel): number {
  const sumZ = (features.sum - model.sum.mean) / model.sum.standardDeviation;
  let score = -0.5 * sumZ * sumZ;

  score += Math.log(probabilityAt(model.evens, features.evens));
  score += Math.log(probabilityAt(model.quadrantsUsed, features.quadrantsUsed));
  score += Math.log(probabilityAt(model.consecutivePairs, Math.min(3, features.consecutivePairs)));
  score += Math.log(probabilityAt(model.primes, features.primes));
  score += Math.log(probabilityAt(model.low, features.low));
  score += Math.log(probabilityAt(model.maxSameLastDigit, features.maxSameLastDigit));
  score += Math.log(probabilityAt(model.repeatsPrev, Math.min(3, features.repeatsPrev)));
  score += Math.log(probabilityAt(model.multiplesOf5, Math.min(4, features.multiplesOf5)));

  return score;
}

/** Negative squared distance between a candidate and a sampled target ticket. */
export function featureDistance(
  candidate: DrawFeatures,
  target: DrawFeatures,
  model: FeatureModel
): number {
  const sumZ = (candidate.sum - target.sum) / model.sum.standardDeviation;
  let distance = -sumZ * sumZ;

  distance -= 1.6 * Math.abs(candidate.evens - target.evens);
  distance -= 1.2 * Math.abs(candidate.quadrantsUsed - target.quadrantsUsed);
  distance -= 1.0 * Math.abs(candidate.consecutivePairs - target.consecutivePairs);
  distance -= 0.8 * Math.abs(candidate.primes - target.primes);
  distance -= 0.8 * Math.abs(candidate.low - target.low);
  distance -= 0.8 * Math.abs(candidate.maxSameLastDigit - target.maxSameLastDigit);
  distance -= 1.2 * Math.abs(candidate.repeatsPrev - target.repeatsPrev);
  distance -= 0.4 * Math.abs(candidate.multiplesOf5 - target.multiplesOf5);

  for (let i = 0; i < 4; i++) {
    distance -= 0.35 * Math.abs(candidate.quadrants[i] - target.quadrants[i]);
  }

  return distance;
}

/**
 * Penalties for tickets that look "chosen by a human" (birthdays, sequences,
 * repeated endings). These do not change P(6), but popular tickets share the
 * prize with more winners when they hit.
 */
export function popularityPenalty(features: DrawFeatures): number {
  let penalty = 0;

  if (features.allUnder32) penalty -= 8;
  if (features.arithmetic) penalty -= 10;
  if (features.maxRun >= 4) penalty -= 3;
  if (features.consecutivePairs >= 3) penalty -= 3;
  if (features.maxSameLastDigit >= 5) penalty -= 6;
  else if (features.maxSameLastDigit >= 4) penalty -= 4;
  if (features.multiplesOf5 >= 4) penalty -= 4;
  if (features.multiplesOf10 >= 3) penalty -= 2;
  if (features.sum < 100 || features.sum > 270) penalty -= 3;

  return penalty;
}

/** Human-readable reasons a ticket was penalized (used by docs/tests). */
export function popularityFlags(features: DrawFeatures): string[] {
  const flags: string[] = [];
  if (features.allUnder32) flags.push('todas as dezenas ≤ 31 (padrão de aniversário)');
  if (features.arithmetic) flags.push('progressão aritmética');
  if (features.maxRun >= 4) flags.push('sequência longa de dezenas consecutivas');
  else if (features.consecutivePairs >= 3) flags.push('muitos pares consecutivos');
  if (features.maxSameLastDigit >= 4) flags.push('muitas dezenas com o mesmo final');
  if (features.multiplesOf5 >= 4) flags.push('muitos múltiplos de 5');
  if (features.multiplesOf10 >= 3) flags.push('muitos múltiplos de 10');
  if (features.sum < 100 || features.sum > 270) flags.push('soma extrema');
  return flags;
}


