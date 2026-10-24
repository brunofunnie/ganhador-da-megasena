import {
  DrawDataset,
  PICK_SIZE,
  allNumbers,
  formatNumber,
  getDataset,
} from './dataset';
import { createRng, Rng } from './rng';
import {
  FrequencyModel,
  buildFrequencyModel,
  buildTrendModel,
  clamp,
  weightsFromModel,
} from './statistical';
import {
  buildFeatureModel,
  extractFeatures,
  plausibility,
  popularityPenalty,
} from './features';
import {
  generatePortfolio,
  normalizeGame,
  overlapCount,
  sampleWeighted,
} from './portfolio';
import { runMonteCarlo } from './monteCarlo';
import { runEnsemble } from './ensemble';
import { buildTransitionMatrix, generateMarkovChain } from './markov';
import { buildCoveringWheel } from './wheel';

export const GENERATOR_MODES = [
  'random',
  'hot',
  'cold',
  'balanced',
  'genetic',
  'sequences',
  'fechamento',
  'dreams',
  'trend',
  'statistical',
  'monte-carlo',
  'ensemble',
  'markov',
] as const;

export type GeneratorMode = (typeof GENERATOR_MODES)[number];

export function isGeneratorMode(value: unknown): value is GeneratorMode {
  return (
    typeof value === 'string' && (GENERATOR_MODES as readonly string[]).includes(value)
  );
}

export interface GeneratorOptions {
  mode: GeneratorMode;
  count: number;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
  seedNumbers?: string[];
  iterations?: number;
  strategies?: string[];
  windowSize?: number;
  /** Fechamento: size of the covered pool (7-12). */
  poolSize?: number;
  /** Fechamento: guaranteed hits when the 6 drawn numbers are inside the pool. */
  guarantee?: number;
  /** Feature-conditioned modes: candidates evaluated per ticket. */
  candidates?: number;
  /** Maximum numbers shared between two tickets. */
  maxOverlap?: number;
  seed?: string;
  /** Walk-forward view used by the backtest. */
  dataset?: DrawDataset;
}

const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55]);

function parseNumbers(list: readonly string[], label: string): string[] {
  const unique = new Set<number>();
  for (const raw of list) {
    const value = parseInt(String(raw).trim(), 10);
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      throw new Error(`${label}: dezena inválida "${raw}" (use 1 a 60)`);
    }
    unique.add(value);
  }
  return Array.from(unique)
    .sort((a, b) => a - b)
    .map(formatNumber);
}

function previousSet(dataset: DrawDataset): ReadonlySet<number> | undefined {
  const latest = dataset.draws[dataset.draws.length - 1];
  if (!latest) return undefined;
  return new Set(latest.numbers.map((n) => parseInt(n, 10)));
}

/**
 * Real genetic algorithm (population, tournament selection, crossover, mutation).
 * Fitness = structural plausibility + hot/cold mix − popular-ticket penalty.
 */
function runGenetic(options: {
  dataset: DrawDataset;
  fixed: string[];
  available: string[];
  needed: number;
  count: number;
  rng: Rng;
  /** Evaluation budget hint (smaller values are used by the backtest). */
  candidates?: number;
}): string[][] {
  const { dataset, fixed, available, needed, count, rng } = options;
  const model = buildFeatureModel(dataset);
  const freq = buildFrequencyModel(dataset);
  const previous = previousSet(dataset);

  const mixWeight = (numero: string): number => {
    const stat = freq.numbers.get(numero);
    if (!stat) return 1;
    return Math.max(stat.hotWeight, stat.coldWeight);
  };

  const randomGame = (): string[] =>
    normalizeGame([...fixed, ...sampleWeighted(available, undefined, needed, rng)]);

  const fitness = (game: string[]): number => {
    const features = extractFeatures(game, previous);
    let score = plausibility(features, model);
    for (const numero of game) score += 0.45 * Math.log(Math.max(mixWeight(numero), 1e-6));
    score += popularityPenalty(features);

    // Keep the population from drifting into extreme sums even if their
    // hot/cold mix is attractive.
    const sumZ = Math.abs((features.sum - model.sum.mean) / model.sum.standardDeviation);
    if (sumZ > 1.5) score -= 2 * (sumZ - 1.5) ** 2;
    return score;
  };

  const crossover = (a: string[], b: string[]): string[] => {
    const fixedSet = new Set(fixed);
    const union = Array.from(new Set([...a, ...b])).filter((n) => !fixedSet.has(n));
    const sampled = sampleWeighted(union, undefined, needed, rng);
    return normalizeGame([...fixed, ...sampled]);
  };

  const mutate = (game: string[]): string[] => {
    if (needed === 0) return game;
    const fixedSet = new Set(fixed);
    const outside = available.filter((n) => !game.includes(n));
    if (outside.length === 0) return game;
    const mutable = game.filter((n) => !fixedSet.has(n));
    if (mutable.length === 0) return game;
    const victim = mutable[rng.int(mutable.length)];
    const replacement = outside[rng.int(outside.length)];
    return normalizeGame([...game.filter((n) => n !== victim), replacement, ...fixed]);
  };

  const tournament = (population: string[][], size = 3): string[] => {
    let best = population[rng.int(population.length)];
    let bestFitness = fitness(best);
    for (let i = 1; i < size; i++) {
      const candidate = population[rng.int(population.length)];
      const candidateFitness = fitness(candidate);
      if (candidateFitness > bestFitness) {
        best = candidate;
        bestFitness = candidateFitness;
      }
    }
    return best;
  };

  const POPULATION = 72;
  const ELITE = 8;
  const budget = options.candidates ?? POPULATION * 40;
  const GENERATIONS = clamp(Math.round(budget / POPULATION), 12, 40);

  let population: string[][] = Array.from({ length: POPULATION }, randomGame);

  for (let generation = 0; generation < GENERATIONS; generation++) {
    const ranked = [...population].sort((a, b) => fitness(b) - fitness(a));
    const next: string[][] = ranked.slice(0, ELITE);

    while (next.length < POPULATION) {
      const child = crossover(tournament(ranked), tournament(ranked));
      next.push(rng.next() < 0.35 ? mutate(child) : child);
    }
    population = next;
  }

  const ranked = [...population]
    .map((game) => ({ game, score: fitness(game) }))
    .sort((a, b) => b.score - a.score);

  const selected: string[][] = [];
  for (const entry of ranked) {
    if (selected.some((game) => overlapCount(game, entry.game) > 2)) continue;
    selected.push(entry.game);
    if (selected.length >= count) break;
  }

  let fillAttempts = 0;
  while (selected.length < count && fillAttempts < 400) {
    fillAttempts++;
    const extra = randomGame();
    if (!selected.some((game) => game.join(',') === extra.join(','))) selected.push(extra);
  }

  return selected;
}

function chooseWheelPool(options: {
  available: string[];
  size: number;
  freq: FrequencyModel;
  rng: Rng;
}): string[] {
  const { available, size, freq, rng } = options;

  const scored = available
    .map((numero) => {
      const stat = freq.numbers.get(numero);
      return { numero, score: (stat?.hotWeight ?? 1) * (0.9 + 0.2 * rng.next()) };
    })
    .sort((a, b) => b.score - a.score);

  const pool: string[] = [];
  for (const entry of scored) {
    if (pool.length >= size) break;
    if (!pool.includes(entry.numero)) pool.push(entry.numero);
  }

  // Guarantee at least one number per quadrant when the pool allows it.
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const hasQuadrant = pool.some((numero) => {
      const value = parseInt(numero, 10);
      return Math.min(3, Math.floor((value - 1) / 15)) === quadrant;
    });
    if (hasQuadrant) continue;
    const candidate = scored.find(
      (entry) =>
        !pool.includes(entry.numero) &&
        Math.min(3, Math.floor((parseInt(entry.numero, 10) - 1) / 15)) === quadrant
    );
    if (candidate && pool.length < size) pool.push(candidate.numero);
  }

  return normalizeGame(pool).slice(0, size);
}

export function generateNumbers(options: GeneratorOptions): string[][] {
  const {
    mode,
    count = 1,
    seedNumbers = [],
    iterations = 10000,
    strategies,
    windowSize = 50,
  } = options;

  const dataset = options.dataset ?? getDataset();
  const rng = createRng(options.seed);

  const fixed = parseNumbers(options.fixedNumbers ?? [], 'Números fixos');
  const excluded = parseNumbers(options.excludeNumbers ?? [], 'Números excluídos').filter(
    (numero) => !fixed.includes(numero)
  );

  if (fixed.length > PICK_SIZE) {
    throw new Error('No máximo 6 números fixos são permitidos');
  }

  const actualCount = clamp(count, 1, 10);
  const available = allNumbers().filter(
    (numero) => !fixed.includes(numero) && !excluded.includes(numero)
  );
  const needed = PICK_SIZE - fixed.length;

  if (needed === 0) return [normalizeGame(fixed)];

  if (available.length < needed) {
    throw new Error('Não há dezenas disponíveis suficientes após as exclusões');
  }

  let freqModel: FrequencyModel | null = null;
  const getFreq = (): FrequencyModel => (freqModel ??= buildFrequencyModel(dataset));

  /**
   * Merges fixed numbers with a sampled ticket without ever dropping a fixed
   * number (the old `.slice(0, 6)` could silently remove one).
   */
  const finish = (sampled: string[]): string[] => {
    const extra = normalizeGame(sampled)
      .filter((numero) => !fixed.includes(numero))
      .slice(0, needed);
    const result = [...fixed, ...extra];

    if (result.length < PICK_SIZE) {
      const hot = weightsFromModel(getFreq(), 'hot');
      const pool = available.filter((numero) => !result.includes(numero));
      result.push(...sampleWeighted(pool, hot, PICK_SIZE - result.length, rng));
    }

    return normalizeGame(result);
  };

  // Modes that produce the whole batch at once.
  if (mode === 'monte-carlo') {
    const result = runMonteCarlo({
      iterations,
      topK: actualCount,
      fixedNumbers: fixed,
      excludeNumbers: excluded,
      dataset,
      rng,
    });
    return result.jogos;
  }

  if (mode === 'ensemble') {
    return runEnsemble({
      strategyIds: strategies ?? [
        'top6',
        'cold6',
        'balanced-3p3i',
        'quadrants',
        'primes-power',
        'avg-frequency',
      ],
      count: actualCount,
      dataset,
      rng,
      fixedNumbers: fixed,
      excludeNumbers: excluded,
    });
  }

  if (mode === 'statistical') {
    return generatePortfolio({
      dataset,
      count: actualCount,
      rng,
      fixedNumbers: fixed,
      excludeNumbers: excluded,
      candidatesPerGame: clamp(options.candidates ?? 400, 50, 8000),
      maxOverlap: clamp(options.maxOverlap ?? 2, 0, 5),
    }).games;
  }

  if (mode === 'genetic') {
    return runGenetic({
      dataset,
      fixed,
      available,
      needed,
      count: actualCount,
      rng,
      candidates: options.candidates,
    });
  }

  if (mode === 'fechamento') {
    const totalPoolSize = clamp(options.poolSize ?? 8, PICK_SIZE + 1, 12);
    const freePoolSize = Math.max(needed + 1, totalPoolSize - fixed.length);
    const guarantee = clamp(options.guarantee ?? 4, 1, needed);
    const tickets: string[][] = [];

    for (let attempt = 0; attempt < 8 && tickets.length < actualCount; attempt++) {
      const pool = chooseWheelPool({
        available,
        size: Math.min(freePoolSize, available.length),
        freq: getFreq(),
        rng,
      });
      const wheel = buildCoveringWheel(pool, guarantee, 300, needed);
      for (const ticket of wheel.tickets) {
        const normalized = normalizeGame([...fixed, ...ticket]);
        if (!tickets.some((existing) => existing.join(',') === normalized.join(','))) {
          tickets.push(normalized);
        }
        if (tickets.length >= actualCount) break;
      }
    }

    return tickets.sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
  }

  const trendModel = mode === 'trend' ? buildTrendModel(dataset, windowSize) : null;
  const trendWeights = trendModel
    ? new Map(
        Array.from(trendModel.entries()).map(([numero, stat]) => [
          numero,
          Math.exp(clamp(stat.z, -3, 3) * 0.35),
        ])
      )
    : undefined;

  let markovMatrix: number[][] | null = null;

  const buildOne = (): string[] => {
    switch (mode) {
      case 'random': {
        return finish(sampleWeighted(available, undefined, needed, rng));
      }

      case 'hot': {
        return finish(sampleWeighted(available, weightsFromModel(getFreq(), 'hot'), needed, rng));
      }

      case 'cold': {
        return finish(sampleWeighted(available, weightsFromModel(getFreq(), 'cold'), needed, rng));
      }

      case 'balanced': {
        const evens = available.filter((numero) => parseInt(numero, 10) % 2 === 0);
        const odds = available.filter((numero) => parseInt(numero, 10) % 2 !== 0);
        const fixedEvens = fixed.filter((numero) => parseInt(numero, 10) % 2 === 0).length;
        const evensNeeded = clamp(3 - fixedEvens, 0, needed);
        const oddsNeeded = needed - evensNeeded;

        const hot = weightsFromModel(getFreq(), 'hot');
        const pickedEvens = sampleWeighted(evens, hot, Math.min(evensNeeded, evens.length), rng);
        const pickedOdds = sampleWeighted(odds, hot, Math.min(oddsNeeded, odds.length), rng);
        const picked = [...pickedEvens, ...pickedOdds];

        if (picked.length < needed) {
          const rest = available.filter((numero) => !picked.includes(numero));
          picked.push(...sampleWeighted(rest, hot, needed - picked.length, rng));
        }
        return finish(picked);
      }

      case 'sequences': {
        const sequencePool = available.filter((numero) => {
          const value = parseInt(numero, 10);
          return PRIMES.has(value) || FIBONACCI.has(value);
        });

        const hot = weightsFromModel(getFreq(), 'hot');
        const fromSequence = sampleWeighted(
          sequencePool,
          hot,
          Math.min(needed, sequencePool.length),
          rng
        );
        const rest = available.filter((numero) => !fromSequence.includes(numero));
        return finish([
          ...fromSequence,
          ...sampleWeighted(rest, hot, needed - fromSequence.length, rng),
        ]);
      }

      case 'dreams': {
        const seeds = parseNumbers(seedNumbers, 'Números semente')
          .filter((numero) => !excluded.includes(numero) && !fixed.includes(numero))
          .slice(0, Math.max(0, 5 - fixed.length));
        const seedSet = new Set(seeds);
        const hot = weightsFromModel(getFreq(), 'hot');
        const boosted = new Map<string, number>();
        for (const numero of allNumbers()) {
          boosted.set(numero, (hot.get(numero) ?? 1) * (seedSet.has(numero) ? 8 : 1));
        }

        const seedNeeded = needed - seeds.filter((n) => !fixed.includes(n)).length;
        const fillPool = available.filter((numero) => !seedSet.has(numero));
        return finish([...seeds, ...sampleWeighted(fillPool, boosted, seedNeeded, rng)]);
      }

      case 'trend': {
        const positive = new Map<string, number>();
        for (const [numero, weight] of trendWeights ?? []) {
          if (weight > 1) positive.set(numero, weight);
        }
        const trendPool =
          positive.size >= needed
            ? available.filter((numero) => positive.has(numero))
            : available;
        return finish(
          sampleWeighted(
            trendPool,
            positive.size >= needed ? positive : trendWeights,
            needed,
            rng
          )
        );
      }

      case 'markov': {
        markovMatrix ??= buildTransitionMatrix(dataset);
        const chain = generateMarkovChain(markovMatrix, dataset, rng);
        return finish(sampleWeighted(chain, undefined, needed, rng));
      }

      default: {
        return finish(sampleWeighted(available, undefined, needed, rng));
      }
    }
  };

  // Portfolio-level diversity: two tickets never share more than `maxOverlap`
  // numbers (fixed numbers count toward the floor).
  const maxOverlap = Math.max(fixed.length, clamp(options.maxOverlap ?? 2, 0, 5));
  const games: string[][] = [];

  for (let g = 0; g < actualCount; g++) {
    let game = buildOne();
    for (
      let attempt = 0;
      attempt < 40 && games.some((existing) => overlapCount(existing, game) > maxOverlap);
      attempt++
    ) {
      game = buildOne();
    }
    games.push(game);
  }

  return games;
}

/** Expected hits of one ticket against one draw: 6 · (6/60) = 0.6. */
export function expectedHitsPerTicket(): number {
  return PICK_SIZE * (PICK_SIZE / 60);
}

/** P(exactly 4 hits) = C(6,4)·C(54,2)/C(60,6) ≈ 1/2332. */
export function quadraProbability(): number {
  const combinations = (n: number, k: number): number => {
    let result = 1;
    for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
    return result;
  };
  return (combinations(6, 4) * combinations(54, 2)) / combinations(60, 6);
}
