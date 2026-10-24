import { DrawDataset, PICK_SIZE, allNumbers, formatNumber, maskOf, intersectCount } from './dataset';
import { Rng } from './rng';
import {
  DrawFeatures,
  buildFeatureModel,
  extractFeatures,
  featureDistance,
  plausibility,
  popularityFlags,
  popularityPenalty,
} from './features';

/**
 * Feature-conditioned ticket generation + portfolio selection.
 *
 * 1. Pick a target feature vector by bootstrapping a real historical draw.
 * 2. Sample many candidate tickets, optionally tilted by per-number weights
 *    (hot / cold / trend / ensemble votes).
 * 3. Score each candidate by feature distance, plausibility, the number prior
 *    and a "popular ticket" penalty.
 * 4. Pick the best candidate that also keeps the maximum overlap with already
 *    selected tickets under control, so a 10-game wallet actually covers more
 *    of the board instead of repeating the same 6 numbers.
 */

export interface PortfolioOptions {
  dataset: DrawDataset;
  count: number;
  rng: Rng;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
  /** Multiplicative per-number weights (default 1 for every number). */
  priorWeights?: Map<string, number>;
  /** Candidates evaluated per selected ticket (default 400). */
  candidatesPerGame?: number;
  /** Maximum numbers shared between two tickets (default 2). */
  maxOverlap?: number;
  avoidPopular?: boolean;
}

export interface PortfolioDiagnostics {
  candidatesEvaluated: number;
  maxOverlap: number;
  averageScore: number;
  popularityFlags: string[][];
}

export interface PortfolioResult {
  games: string[][];
  diagnostics: PortfolioDiagnostics;
}

export function normalizeGame(numbers: readonly (string | number)[]): string[] {
  const unique = Array.from(
    new Set(
      numbers
        .map((n) => (typeof n === 'number' ? n : parseInt(n, 10)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60)
    )
  ).sort((a, b) => a - b);
  return unique.map(formatNumber);
}

export function overlapCount(a: string[], b: string[]): number {
  return intersectCount(maskOf(a), maskOf(b));
}

/** Weighted sample without replacement (Efraimidis–Spirakis). */
export function sampleWeighted(
  pool: readonly string[],
  weights: ReadonlyMap<string, number> | undefined,
  k: number,
  rng: Rng
): string[] {
  if (k <= 0) return [];
  if (k >= pool.length) return [...pool];

  if (!weights) return rng.shuffle(pool).slice(0, k);

  const keyed = pool.map((numero) => {
    const weight = weights.get(numero) ?? 1;
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 1e-9;
    const u = Math.max(rng.next(), 1e-12);
    return { numero, key: -Math.log(u) / safeWeight };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, k).map((entry) => entry.numero);
}

function previousSet(dataset: DrawDataset): ReadonlySet<number> | undefined {
  const latest = dataset.draws[dataset.draws.length - 1];
  if (!latest) return undefined;
  return new Set(latest.numbers.map((n) => parseInt(n, 10)));
}

function buildPool(
  fixed: readonly string[],
  excluded: readonly string[]
): string[] {
  const blocked = new Set([...fixed, ...excluded]);
  return allNumbers().filter((numero) => !blocked.has(numero));
}

interface ScoredCandidate {
  numbers: string[];
  features: DrawFeatures;
  score: number;
  overlap: number;
  flags: string[];
}

export function generatePortfolio(options: PortfolioOptions): PortfolioResult {
  const {
    dataset,
    count,
    rng,
    fixedNumbers = [],
    excludeNumbers = [],
    priorWeights,
    candidatesPerGame = 400,
    maxOverlap = 2,
    avoidPopular = true,
  } = options;

  const fixed = normalizeGame(fixedNumbers);
  const excluded = normalizeGame(excludeNumbers).filter((n) => !fixed.includes(n));
  const pool = buildPool(fixed, excluded);
  const needed = PICK_SIZE - fixed.length;

  if (fixed.length > PICK_SIZE) {
    throw new Error('No máximo 6 números fixos são permitidos');
  }
  if (pool.length < needed) {
    throw new Error('Não há dezenas disponíveis suficientes após as exclusões');
  }

  const model = buildFeatureModel(dataset);
  const previous = previousSet(dataset);
  const selected: string[][] = [];
  let overlapLimit = maxOverlap;
  let candidatesEvaluated = 0;
  let scoreSum = 0;
  const allFlags: string[][] = [];

  for (let g = 0; g < count; g++) {
    const target =
      model.targets.length > 0 ? model.targets[rng.int(model.targets.length)] : undefined;

    let best: ScoredCandidate | null = null;
    let fallback: ScoredCandidate | null = null;

    for (let c = 0; c < candidatesPerGame; c++) {
      const sampled = sampleWeighted(pool, priorWeights, needed, rng);
      const numbers = normalizeGame([...fixed, ...sampled]);
      if (numbers.length !== PICK_SIZE) continue;

      candidatesEvaluated++;
      const features = extractFeatures(numbers, previous);

      let score = 0;
      if (target) score += 0.75 * featureDistance(features, target, model);
      score += 0.25 * plausibility(features, model);

      if (priorWeights) {
        for (const numero of sampled) {
          score += 0.5 * Math.log(Math.max(priorWeights.get(numero) ?? 1, 1e-6));
        }
      }

      if (avoidPopular) score += popularityPenalty(features);

      let overlap = 0;
      for (const game of selected) overlap = Math.max(overlap, overlapCount(numbers, game));

      const candidate: ScoredCandidate = {
        numbers,
        features,
        score,
        overlap,
        flags: popularityFlags(features),
      };

      if (overlap <= overlapLimit) {
        if (!best || candidate.score > best.score) best = candidate;
      } else if (!fallback || candidate.score > fallback.score) {
        fallback = candidate;
      }
    }

    let chosen = best;
    if (!chosen) {
      chosen = fallback;
      overlapLimit = Math.min(PICK_SIZE, overlapLimit + 1);
    }
    if (!chosen) {
      // Extremely small candidate budget: fall back to a plain weighted sample.
      chosen = {
        numbers: normalizeGame([...fixed, ...sampleWeighted(pool, priorWeights, needed, rng)]),
        features: extractFeatures([...fixed], previous),
        score: 0,
        overlap: 0,
        flags: [],
      };
    }

    selected.push(chosen.numbers);
    scoreSum += chosen.score;
    allFlags.push(chosen.flags);
  }

  return {
    games: selected,
    diagnostics: {
      candidatesEvaluated,
      maxOverlap: overlapLimit,
      averageScore: Number((scoreSum / Math.max(1, selected.length)).toFixed(3)),
      popularityFlags: allFlags,
    },
  };
}

/**
 * Single conditional ticket (used by the ensemble vote and by the
 * "feature-conditioned" strategy).
 */
export function generateConditionalGame(
  dataset: DrawDataset,
  rng: Rng,
  priorWeights?: Map<string, number>,
  fixedNumbers: string[] = [],
  excludeNumbers: string[] = [],
  candidates = 300
): string[] {
  return generatePortfolio({
    dataset,
    count: 1,
    rng,
    priorWeights,
    fixedNumbers,
    excludeNumbers,
    candidatesPerGame: candidates,
  }).games[0];
}

/** Normalizes a vote map into mild multiplicative weights around 1. */
export function normalizeVotes(
  votes: ReadonlyMap<string, number>,
  strength = 1.2
): Map<string, number> {
  const weights = new Map<string, number>();
  if (votes.size === 0) return weights;

  const values = Array.from(votes.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    for (const numero of votes.keys()) weights.set(numero, 1);
    return weights;
  }

  for (const [numero, value] of votes) {
    const normalized = (value - min) / (max - min);
    weights.set(numero, 1 + strength * normalized);
  }
  return weights;
}


