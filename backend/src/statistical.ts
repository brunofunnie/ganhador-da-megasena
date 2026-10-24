import { DrawDataset, PICK_SIZE, TOTAL_NUMBERS, formatNumber } from './dataset';

/**
 * Statistical models shared by every generator.
 *
 * Key ideas:
 * - Each number is included in a draw with probability p = 6/60 = 0.1, so the
 *   expected count after N draws is 0.1·N with sd = sqrt(N·p·(1-p)). Raw
 *   frequency rankings are dominated by that noise; we expose a z-score and a
 *   shrunk rate (empirical Bayes with a Beta prior centered on 0.1) instead.
 * - Gaps between appearances are geometric with p = 0.1: mean 10, sd ~9.49.
 *   "Overdue" is expressed as a z-score of the gap, not as a linear promise.
 * - Trend is the *signed* z-score of (recent rate − historical rate). The old
 *   implementation used Math.abs(), mixing heating and cooling numbers.
 */

export const BASE_RATE = PICK_SIZE / TOTAL_NUMBERS;
export const SHRINK_PSEUDO_DRAWS = 120;
export const GAP_MEAN = 1 / BASE_RATE;
export const GAP_SD = Math.sqrt(1 - BASE_RATE) / BASE_RATE;

export const HOT_STRENGTH = 0.5;
export const COLD_STRENGTH = 0.6;

export interface NumberStat {
  numero: string;
  count: number;
  rate: number;
  expected: number;
  /** (count − expected) / sd. */
  z: number;
  /** Beta-shrunk inclusion rate, pulled toward 0.1. */
  shrunkRate: number;
  /** Multiplicative sampling weight for "hot" modes. */
  hotWeight: number;
  lastConcurso: number | null;
  /** Draws since the last appearance (total history length when never seen). */
  gap: number;
  /** (gap − 10) / 9.49. */
  gapZ: number;
  /** P(gap ≥ observed) under the geometric model. */
  survival: number;
  /** Multiplicative sampling weight for "cold" modes (never below 1). */
  coldWeight: number;
}

export interface FrequencyModel {
  total: number;
  expected: number;
  standardDeviation: number;
  /** Pearson statistic with the Bernoulli variance correction. */
  chiSquare: number;
  degreesOfFreedom: number;
  numbers: Map<string, NumberStat>;
  /** Sorted by raw frequency, descending. */
  byFrequency: NumberStat[];
  /** Sorted by current gap, descending. */
  byGap: NumberStat[];
}

export interface TrendStat {
  numero: string;
  recentCount: number;
  recentRate: number;
  historicalRate: number;
  /** Signed z-score of the recent-vs-historical difference. */
  z: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function weightFromZ(z: number, strength: number): number {
  return Math.exp(clamp(z, -3, 3) * strength);
}

export function buildFrequencyModel(dataset: DrawDataset): FrequencyModel {
  const total = dataset.draws.length;
  const expected = total * BASE_RATE;
  const standardDeviation = Math.sqrt(total * BASE_RATE * (1 - BASE_RATE));

  const counts = new Array<number>(TOTAL_NUMBERS).fill(0);
  const lastSeen = new Array<number | null>(TOTAL_NUMBERS).fill(null);
  const latestConcurso = total > 0 ? dataset.draws[total - 1].concurso : 0;

  for (let i = 0; i < total; i++) {
    const draw = dataset.draws[i];
    for (const raw of draw.numbers) {
      const idx = parseInt(raw, 10) - 1;
      if (idx < 0 || idx >= TOTAL_NUMBERS) continue;
      counts[idx]++;
      lastSeen[idx] = draw.concurso;
    }
  }

  const numbers = new Map<string, NumberStat>();
  let chiSquare = 0;

  for (let i = 0; i < TOTAL_NUMBERS; i++) {
    const numero = formatNumber(i + 1);
    const count = counts[i];
    const z = standardDeviation > 0 ? (count - expected) / standardDeviation : 0;
    const shrunkRate =
      (count + SHRINK_PSEUDO_DRAWS * BASE_RATE) / (total + SHRINK_PSEUDO_DRAWS);

    const last = lastSeen[i];
    const gap = last === null ? total : latestConcurso - last;
    const gapZ = (gap - GAP_MEAN) / GAP_SD;
    const survival = Math.pow(1 - BASE_RATE, gap);

    numbers.set(numero, {
      numero,
      count,
      rate: total > 0 ? count / total : 0,
      expected,
      z,
      shrunkRate,
      hotWeight: weightFromZ(z, HOT_STRENGTH),
      lastConcurso: last,
      gap,
      gapZ,
      survival,
      coldWeight: weightFromZ(Math.max(0, gapZ), COLD_STRENGTH),
    });

    if (total > 0) {
      // Bernoulli variance is p(1-p); dividing by it makes the term ~χ²(1).
      chiSquare += ((count - expected) ** 2) / (expected * (1 - BASE_RATE));
    }
  }

  const all = Array.from(numbers.values());

  return {
    total,
    expected,
    standardDeviation,
    chiSquare,
    degreesOfFreedom: TOTAL_NUMBERS - 1,
    numbers,
    byFrequency: [...all].sort(
      (a, b) => b.count - a.count || parseInt(a.numero, 10) - parseInt(b.numero, 10)
    ),
    byGap: [...all].sort(
      (a, b) => b.gap - a.gap || parseInt(a.numero, 10) - parseInt(b.numero, 10)
    ),
  };
}

export function buildTrendModel(dataset: DrawDataset, windowSize = 50): Map<string, TrendStat> {
  const total = dataset.draws.length;
  const window = Math.max(1, Math.min(windowSize, total));

  const counts = new Array<number>(TOTAL_NUMBERS).fill(0);
  const recentCounts = new Array<number>(TOTAL_NUMBERS).fill(0);

  for (const draw of dataset.draws) {
    for (const raw of draw.numbers) {
      const idx = parseInt(raw, 10) - 1;
      if (idx >= 0 && idx < TOTAL_NUMBERS) counts[idx]++;
    }
  }

  const recent = total > 0 ? dataset.draws.slice(total - window) : [];
  for (const draw of recent) {
    for (const raw of draw.numbers) {
      const idx = parseInt(raw, 10) - 1;
      if (idx >= 0 && idx < TOTAL_NUMBERS) recentCounts[idx]++;
    }
  }

  const model = new Map<string, TrendStat>();
  for (let i = 0; i < TOTAL_NUMBERS; i++) {
    const historicalRate = total > 0 ? counts[i] / total : 0;
    const recentRate = window > 0 ? recentCounts[i] / window : 0;
    const variance =
      historicalRate > 0 && total > 0
        ? historicalRate * (1 - historicalRate) * (1 / window + 1 / total)
        : 0;
    const z = variance > 0 ? (recentRate - historicalRate) / Math.sqrt(variance) : 0;

    model.set(formatNumber(i + 1), {
      numero: formatNumber(i + 1),
      recentCount: recentCounts[i],
      recentRate,
      historicalRate,
      z,
    });
  }
  return model;
}

/** Weight map for per-number importance (hot / cold / trend / ensemble). */
export function weightsFromModel(
  model: FrequencyModel,
  kind: 'hot' | 'cold'
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [numero, stat] of model.numbers) {
    weights.set(numero, kind === 'hot' ? stat.hotWeight : stat.coldWeight);
  }
  return weights;
}

export interface SignificanceSummary {
  totalDraws: number;
  expectedPerNumber: number;
  standardDeviation: number;
  chiSquare: number;
  degreesOfFreedom: number;
  /** Numbers with |z| >= 2 (roughly 5% of them are expected by chance). */
  outliers: Array<{ numero: string; count: number; z: number }>;
  interpretation: string;
}

export function summarizeSignificance(model: FrequencyModel): SignificanceSummary {
  const outliers = Array.from(model.numbers.values())
    .filter((stat) => Math.abs(stat.z) >= 2)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .map((stat) => ({ numero: stat.numero, count: stat.count, z: Number(stat.z.toFixed(2)) }));

  return {
    totalDraws: model.total,
    expectedPerNumber: Number(model.expected.toFixed(2)),
    standardDeviation: Number(model.standardDeviation.toFixed(2)),
    chiSquare: Number(model.chiSquare.toFixed(2)),
    degreesOfFreedom: model.degreesOfFreedom,
    outliers,
    interpretation:
      'Cada dezena sai com probabilidade de 10% por sorteio. Diferenças de frequência ' +
      'dentro de ±2 desvios-padrão são esperadas por azar amostral; nenhuma delas ' +
      'aumenta a chance de um jogo de 6 acertos.',
  };
}
