import { DrawDataset, getDataset, intersectCount, maskOf } from './dataset';
import { createRng, Rng } from './rng';
import { generatePortfolio } from './portfolio';

/**
 * Monte Carlo mode, reinterpreted as a *portfolio search*.
 *
 * The old implementation generated random tickets, ranked them by average hits
 * against history and returned the top K. Since every ticket has the same
 * expected 0.6 hits, that ranking was pure selection noise (and a hidden "hot
 * numbers" picker). Here `iterations` is the number of candidates inspected by
 * the feature-conditioned sampler, which selects for structural plausibility,
 * diversity and lower prize-sharing — while the hit statistics are reported for
 * information only, never used as the selection criterion.
 */
export interface MonteCarloOptions {
  iterations: number;
  topK: number;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
  dataset?: DrawDataset;
  rng?: Rng;
  seed?: string;
}

export interface MonteCarloResult {
  jogos: string[][];
  stats: {
    mediaAcertos: number;
    maxAcertos: number;
    candidatos: number;
    criterio: string;
  };
}

export function runMonteCarlo(options: MonteCarloOptions): MonteCarloResult {
  const {
    iterations,
    topK,
    fixedNumbers = [],
    excludeNumbers = [],
    dataset = getDataset(),
    rng = createRng(options.seed),
  } = options;

  const count = Math.max(1, Math.min(10, topK));
  const candidates = Math.max(120, Math.min(20000, iterations));
  const candidatesPerGame = Math.max(120, Math.ceil(candidates / count));

  const { games } = generatePortfolio({
    dataset,
    count,
    rng,
    fixedNumbers,
    excludeNumbers,
    candidatesPerGame,
  });

  if (dataset.draws.length === 0) {
    return {
      jogos: games,
      stats: {
        mediaAcertos: 0,
        maxAcertos: 0,
        candidatos: candidatesPerGame * count,
        criterio: 'verossimilhança estrutural + diversificação',
      },
    };
  }

  let totalHits = 0;
  let maxHits = 0;
  for (const game of games) {
    const gameMask = maskOf(game);
    for (const draw of dataset.draws) {
      const hits = intersectCount(gameMask, draw);
      totalHits += hits;
      if (hits > maxHits) maxHits = hits;
    }
  }

  return {
    jogos: games,
    stats: {
      mediaAcertos: parseFloat((totalHits / (games.length * dataset.draws.length)).toFixed(4)),
      maxAcertos: maxHits,
      candidatos: candidatesPerGame * count,
      criterio: 'verossimilhança estrutural + diversificação (média de acertos é informativa, não critério)',
    },
  };
}
