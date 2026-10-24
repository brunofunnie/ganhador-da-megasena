import { DrawDataset, getDataset, intersectCount, maskOf, sliceDataset } from './dataset';
import { createRng, Rng } from './rng';
import { GeneratorMode, generateNumbers } from './generators';

/**
 * Walk-forward backtest.
 *
 * For each target draw i, the mode only sees draws [0, i) — never the draw it
 * is scored against. The same number of uniform random tickets is produced as a
 * baseline. Results are reported as paired differences with a bootstrap 95% CI.
 *
 * This is the honesty check: it measures whether a mode actually deviates from
 * chance. The expected answer for every mode is "no" for the 6-hit probability.
 */

export interface HitDistribution {
  zero: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
  six: number;
  atLeast4: number;
  atLeast5: number;
}

export interface BacktestSide {
  tickets: number;
  meanHits: number;
  meanBestHits: number;
  distribution: HitDistribution;
}

export interface BacktestOptions {
  mode: GeneratorMode;
  /** Number of target draws to evaluate (default 120, max 500). */
  window?: number;
  /** Tickets generated per target draw (default 5). */
  gamesPerDraw?: number;
  seed?: string;
  dataset?: DrawDataset;
  strategies?: string[];
  /** Window for the trend mode. */
  windowSize?: number;
  iterations?: number;
  poolSize?: number;
  guarantee?: number;
  candidates?: number;
}

export interface BacktestResult {
  mode: GeneratorMode;
  targets: number;
  gamesPerDraw: number;
  seed: string;
  strategy: BacktestSide;
  baseline: BacktestSide;
  delta: {
    meanHits: number;
    meanHitsCI95: [number, number];
    atLeast4Rate: number;
    atLeast4CI95: [number, number];
  };
  significant: boolean;
  note: string;
}

function emptyDistribution(): HitDistribution {
  return { zero: 0, one: 0, two: 0, three: 0, four: 0, five: 0, six: 0, atLeast4: 0, atLeast5: 0 };
}

function addHits(distribution: HitDistribution, hits: number): void {
  const key = (['zero', 'one', 'two', 'three', 'four', 'five', 'six'] as const)[hits];
  if (key) distribution[key]++;
  if (hits >= 4) distribution.atLeast4++;
  if (hits >= 5) distribution.atLeast5++;
}

function sideFrom(hits: number[][], bestHits: number[]): BacktestSide {
  const distribution = emptyDistribution();
  let totalHits = 0;
  let tickets = 0;
  for (const drawHits of hits) {
    for (const hitsInDraw of drawHits) {
      totalHits += hitsInDraw;
      tickets++;
      addHits(distribution, hitsInDraw);
    }
  }
  return {
    tickets,
    meanHits: tickets > 0 ? Number((totalHits / tickets).toFixed(4)) : 0,
    meanBestHits:
      bestHits.length > 0
        ? Number((bestHits.reduce((a, b) => a + b, 0) / bestHits.length).toFixed(4))
        : 0,
    distribution,
  };
}

function bootstrapCI(values: number[], rng: Rng, iterations = 1200): [number, number] {
  if (values.length === 0) return [0, 0];
  const means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) sum += values[rng.int(values.length)];
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  const lower = means[Math.floor(0.025 * (means.length - 1))];
  const upper = means[Math.floor(0.975 * (means.length - 1))];
  return [Number(lower.toFixed(4)), Number(upper.toFixed(4))];
}

export function runBacktest(options: BacktestOptions): BacktestResult {
  const dataset = options.dataset ?? getDataset();
  const total = dataset.draws.length;

  if (total < 15) {
    throw new Error('Histórico insuficiente para backtest (mínimo de 15 concursos)');
  }

  const window = Math.max(10, Math.min(options.window ?? 120, 500, total - 5));
  const gamesPerDraw = Math.max(1, Math.min(options.gamesPerDraw ?? 5, 10));
  const seed = options.seed ?? `backtest-${options.mode}`;
  const start = Math.max(1, total - window);

  const strategyHits: number[][] = [];
  const strategyBest: number[] = [];
  const baselineHits: number[][] = [];
  const baselineBest: number[] = [];
  const meanDeltas: number[] = [];
  const atLeast4Deltas: number[] = [];

  for (let i = start; i < total; i++) {
    const history = sliceDataset(dataset, i);
    const actual = dataset.draws[i];
    const actualMask = maskOf(actual.numbers);

    const games = generateNumbers({
      mode: options.mode,
      count: gamesPerDraw,
      dataset: history,
      seed: `${seed}:${i}`,
      strategies: options.strategies,
      windowSize: options.windowSize,
      iterations: Math.min(options.iterations ?? 400, 1500),
      poolSize: options.poolSize,
      guarantee: options.guarantee,
      candidates: options.candidates,
    });

    const baselineGames = generateNumbers({
      mode: 'random',
      count: games.length,
      dataset: history,
      seed: `${seed}:${i}:baseline`,
    });

    const strategyDrawHits = games.map((game) => intersectCount(maskOf(game), actualMask));
    const baselineDrawHits = baselineGames.map((game) =>
      intersectCount(maskOf(game), actualMask)
    );

    strategyHits.push(strategyDrawHits);
    baselineHits.push(baselineDrawHits);
    strategyBest.push(strategyDrawHits.length ? Math.max(...strategyDrawHits) : 0);
    baselineBest.push(baselineDrawHits.length ? Math.max(...baselineDrawHits) : 0);

    const meanStrategy =
      strategyDrawHits.reduce((a, b) => a + b, 0) / Math.max(1, strategyDrawHits.length);
    const meanBaseline =
      baselineDrawHits.reduce((a, b) => a + b, 0) / Math.max(1, baselineDrawHits.length);
    meanDeltas.push(meanStrategy - meanBaseline);

    const has4Strategy = strategyDrawHits.some((hits) => hits >= 4) ? 1 : 0;
    const has4Baseline = baselineDrawHits.some((hits) => hits >= 4) ? 1 : 0;
    atLeast4Deltas.push(has4Strategy - has4Baseline);
  }

  const strategy = sideFrom(strategyHits, strategyBest);
  const baseline = sideFrom(baselineHits, baselineBest);

  const meanHits = Number(
    (meanDeltas.reduce((a, b) => a + b, 0) / Math.max(1, meanDeltas.length)).toFixed(4)
  );
  const atLeast4Rate = Number(
    (atLeast4Deltas.reduce((a, b) => a + b, 0) / Math.max(1, atLeast4Deltas.length)).toFixed(4)
  );

  const ciRng = createRng(`${seed}:ci`);
  const meanHitsCI95 = bootstrapCI(meanDeltas, ciRng);
  const atLeast4CI95 = bootstrapCI(atLeast4Deltas, ciRng);
  const significant =
    (meanHitsCI95[0] > 0 || meanHitsCI95[1] < 0) ||
    (atLeast4CI95[0] > 0 || atLeast4CI95[1] < 0);

  return {
    mode: options.mode,
    targets: total - start,
    gamesPerDraw,
    seed,
    strategy,
    baseline,
    delta: { meanHits, meanHitsCI95, atLeast4Rate, atLeast4CI95 },
    significant,
    note: significant
      ? 'O desvio em relação ao acaso é significativo nesta janela — confirme em outra janela antes de concluir qualquer coisa.'
      : 'Nenhum desvio confiável em relação ao acaso. É o resultado esperado: sorteios são independentes.',
  };
}
