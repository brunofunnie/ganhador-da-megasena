import { DrawDataset, TOTAL_NUMBERS, formatNumber, getDataset } from './dataset';
import { createRng, Rng } from './rng';

/**
 * Temporal transition matrix.
 *
 * P(j appears in draw t+1 | i appeared in draw t), estimated from consecutive
 * draws. This is a real (asymmetric, time-ordered) transition matrix — the
 * previous implementation counted co-occurrence inside the *same* draw, which
 * is symmetric and has no predictive direction at all.
 */
export function buildTransitionMatrix(dataset: DrawDataset = getDataset()): number[][] {
  const matrix: number[][] = Array.from({ length: TOTAL_NUMBERS }, () =>
    new Array<number>(TOTAL_NUMBERS).fill(0)
  );

  for (let t = 0; t + 1 < dataset.draws.length; t++) {
    const current = dataset.draws[t].numbers;
    const next = dataset.draws[t + 1].numbers;
    for (const from of current) {
      const i = parseInt(from, 10) - 1;
      if (i < 0 || i >= TOTAL_NUMBERS) continue;
      for (const to of next) {
        const j = parseInt(to, 10) - 1;
        if (j < 0 || j >= TOTAL_NUMBERS || i === j) continue;
        matrix[i][j]++;
      }
    }
  }

  for (let i = 0; i < TOTAL_NUMBERS; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < TOTAL_NUMBERS; j++) matrix[i][j] /= rowSum;
    }
  }

  return matrix;
}

/** Backwards-compatible name used by the route/tests. */
export function buildMarkovMatrix(dataset: DrawDataset = getDataset()): number[][] {
  return buildTransitionMatrix(dataset);
}

function frequencyWeights(dataset: DrawDataset): number[] {
  const weights = new Array<number>(TOTAL_NUMBERS).fill(1);
  for (const draw of dataset.draws) {
    for (const numero of draw.numbers) {
      const idx = parseInt(numero, 10) - 1;
      if (idx >= 0 && idx < TOTAL_NUMBERS) weights[idx]++;
    }
  }
  return weights;
}

export function generateMarkovChain(
  matrix: number[][],
  dataset: DrawDataset = getDataset(),
  rng: Rng = createRng()
): string[] {
  const weights = frequencyWeights(dataset);
  const latest = dataset.draws[dataset.draws.length - 1];

  // Seed with a number from the latest draw (draws repeat ~0.6 numbers from the
  // previous one), falling back to the global frequency distribution.
  let startPool: number[];
  let startWeights: number[];
  if (latest) {
    startPool = latest.numbers.map((n) => parseInt(n, 10) - 1);
    startWeights = startPool.map((idx) => weights[idx]);
  } else {
    startPool = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i);
    startWeights = weights;
  }

  let current = startPool[rng.weightedIndex(startWeights)];
  const used = new Set<number>([current]);

  while (used.size < 6) {
    const row = matrix[current] ?? [];
    const candidates: number[] = [];
    const candidateWeights: number[] = [];
    for (let j = 0; j < TOTAL_NUMBERS; j++) {
      if (used.has(j)) continue;
      const probability = row[j] ?? 0;
      if (probability > 0) {
        candidates.push(j);
        candidateWeights.push(probability);
      }
    }

    if (candidates.length === 0) {
      // Row not observed (e.g. number from the newest draw): frequency fallback.
      for (let j = 0; j < TOTAL_NUMBERS; j++) {
        if (!used.has(j)) {
          candidates.push(j);
          candidateWeights.push(weights[j]);
        }
      }
    }

    current = candidates[rng.weightedIndex(candidateWeights)];
    used.add(current);
  }

  return Array.from(used)
    .sort((a, b) => a - b)
    .map((idx) => formatNumber(idx + 1));
}
