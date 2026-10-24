import { DrawDataset, getDataset } from './dataset';
import { createRng, Rng } from './rng';
import { executeStrategy } from './strategies';
import { generatePortfolio, normalizeVotes } from './portfolio';

/**
 * Soft-voting ensemble.
 *
 * Every selected strategy contributes all of its tickets (normalized by the
 * number of tickets, so `full-cycle` does not dominate), producing a number
 * prior. The final tickets are sampled by the feature-conditioned engine with
 * that prior and the usual diversity/popularity constraints — instead of just
 * copying the first ticket of each strategy, which used to collapse into the
 * same hot-number game every time.
 */
export function runEnsemble(options: {
  strategyIds: string[];
  count: number;
  dataset?: DrawDataset;
  rng?: Rng;
  seed?: string;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
}): string[][] {
  const { strategyIds, count } = options;
  if (strategyIds.length === 0) {
    throw new Error('Ensemble requires at least one strategy');
  }

  const dataset = options.dataset ?? getDataset();
  const rng = options.rng ?? createRng(options.seed);

  const votes = new Map<string, number>();
  for (const id of strategyIds) {
    const result = executeStrategy(id, { dataset, rng });
    const contribution = 1 / Math.max(1, result.jogos.length);
    for (const game of result.jogos) {
      for (const numero of game) {
        votes.set(numero, (votes.get(numero) ?? 0) + contribution);
      }
    }
  }

  const priorWeights = normalizeVotes(votes, 1.0);

  return generatePortfolio({
    dataset,
    count,
    rng,
    priorWeights,
    fixedNumbers: options.fixedNumbers,
    excludeNumbers: options.excludeNumbers,
    candidatesPerGame: 400,
  }).games;
}
