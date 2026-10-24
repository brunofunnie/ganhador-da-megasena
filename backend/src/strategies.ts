import { DrawDataset, TOTAL_NUMBERS, formatNumber, getDataset } from './dataset';
import { BASE_RATE, buildFrequencyModel, NumberStat } from './statistical';
import { buildFeatureModel } from './features';
import { createRng, Rng } from './rng';
import { generatePortfolio } from './portfolio';

interface Strategy {
  id: string;
  nome: string;
  descricao: string;
}

interface StrategyResult {
  estrategia: Strategy;
  jogos: string[][];
}

export interface StrategyOptions {
  dataset?: DrawDataset;
  rng?: Rng;
}

const STRATEGIES: Strategy[] = [
  {
    id: 'top6',
    nome: 'Top 6 Históricos',
    descricao: 'As 6 dezenas com maior taxa suavizada de aparição (não a frequência bruta)',
  },
  {
    id: 'cold6',
    nome: 'Atrasados 6',
    descricao: 'As 6 dezenas com maior atraso em relação ao gap geométrico esperado (média 10)',
  },
  {
    id: 'balanced-3p3i',
    nome: '3P-3I Equilibrado',
    descricao: '3 pares + 3 ímpares, escolhidos entre os mais frequentes de cada categoria',
  },
  {
    id: 'quadrants',
    nome: 'Quadrantes',
    descricao: 'Pelo menos 1 dezena de cada quadrante (1-15, 16-30, 31-45, 46-60)',
  },
  {
    id: 'full-cycle',
    nome: 'Ciclo Completo',
    descricao: '10 jogos cobrindo todos os 60 números, um por dezena em cada jogo',
  },
  {
    id: 'sum-target',
    nome: 'Soma Alvo',
    descricao: 'Soma dentro do intervalo interquartil histórico (P25-P75)',
  },
  {
    id: 'primes-power',
    nome: 'Primos Power',
    descricao: '3 primos + 3 não primos com boa frequência histórica',
  },
  {
    id: 'avg-frequency',
    nome: 'Frequência Média',
    descricao: 'Dezenas com taxa suavizada mais próxima dos 10% esperados',
  },
  {
    id: 'feature-conditioned',
    nome: 'Condicionado a Features',
    descricao: 'Amostra a distribuição conjunta real (soma, paridade, quadrantes, repetição)',
  },
];

export function getStrategies(): Strategy[] {
  return STRATEGIES;
}

function sortGame(numbers: string[]): string[] {
  return [...new Set(numbers)].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).slice(0, 6);
}

function sortStats(stats: NumberStat[]): string[] {
  return sortGame(stats.map((stat) => stat.numero));
}

function topBy<T>(items: T[], score: (item: T) => number, count: number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, count);
}

function pickWeighted(stats: NumberStat[], count: number, rng: Rng, weight: (s: NumberStat) => number): string[] {
  const pool = [...stats];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = rng.weightedIndex(pool.map((stat) => Math.max(1e-6, weight(stat))));
    picked.push(pool[index].numero);
    pool.splice(index, 1);
  }
  return picked;
}

export function executeStrategy(
  strategyId: string,
  options: StrategyOptions = {}
): StrategyResult {
  const strategy = STRATEGIES.find((s) => s.id === strategyId);
  if (!strategy) throw new Error(`Estratégia não encontrada: ${strategyId}`);

  const dataset = options.dataset ?? getDataset();
  const rng = options.rng ?? createRng();
  const model = buildFrequencyModel(dataset);

  let jogos: string[][] = [];

  switch (strategyId) {
    case 'top6': {
      jogos = [sortStats(model.byFrequency.slice(0, 6))];
      break;
    }

    case 'cold6': {
      jogos = [sortStats(model.byGap.slice(0, 6))];
      break;
    }

    case 'balanced-3p3i': {
      const all = Array.from(model.numbers.values());
      const evens = all.filter((stat) => parseInt(stat.numero, 10) % 2 === 0);
      const odds = all.filter((stat) => parseInt(stat.numero, 10) % 2 !== 0);
      const pickedEvens = pickWeighted(
        topBy(evens, (s) => s.count, 10),
        3,
        rng,
        (s) => s.hotWeight
      );
      const pickedOdds = pickWeighted(
        topBy(odds, (s) => s.count, 10),
        3,
        rng,
        (s) => s.hotWeight
      );
      jogos = [sortGame([...pickedEvens, ...pickedOdds])];
      break;
    }

    case 'quadrants': {
      const all = Array.from(model.numbers.values());
      const quadrantOf = (numero: string): number =>
        Math.min(3, Math.floor((parseInt(numero, 10) - 1) / 15));

      const picked: string[] = [];
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const candidates = all
          .filter((stat) => quadrantOf(stat.numero) === quadrant && !picked.includes(stat.numero))
          .sort((a, b) => b.count - a.count);
        if (candidates.length > 0) picked.push(candidates[0].numero);
      }

      const rest = model.byFrequency
        .filter((stat) => !picked.includes(stat.numero))
        .slice(0, 6 - picked.length)
        .map((stat) => stat.numero);

      jogos = [sortGame([...picked, ...rest])];
      break;
    }

    case 'full-cycle': {
      // 10 tickets, each with one number per decade, covering all 60 exactly once.
      for (let g = 0; g < 10; g++) {
        jogos.push(
          Array.from({ length: 6 }, (_, decade) => formatNumber(g + 1 + decade * 10))
        );
      }
      break;
    }

    case 'sum-target': {
      const featureModel = buildFeatureModel(dataset);
      const min = Math.floor(featureModel.sum.p25);
      const max = Math.ceil(featureModel.sum.p75);
      const pool = model.byFrequency.slice(0, 30);
      let found: string[] | null = null;

      for (let attempt = 0; attempt < 2000 && !found; attempt++) {
        const candidate = pickWeighted(pool, 6, rng, (stat) => stat.shrunkRate);
        const sum = candidate.reduce((acc, numero) => acc + parseInt(numero, 10), 0);
        if (sum >= min && sum <= max) found = candidate;
      }

      jogos = [found ?? sortStats(model.byFrequency.slice(0, 6))];
      break;
    }

    case 'primes-power': {
      const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
      const all = Array.from(model.numbers.values());
      const primeStats = all.filter((stat) => primes.has(parseInt(stat.numero, 10)));
      const otherStats = all.filter((stat) => !primes.has(parseInt(stat.numero, 10)));

      jogos = [
        sortGame([
          ...topBy(primeStats, (s) => s.shrunkRate, 3).map((s) => s.numero),
          ...topBy(otherStats, (s) => s.shrunkRate, 3).map((s) => s.numero),
        ]),
      ];
      break;
    }

    case 'avg-frequency': {
      const closest = [...model.numbers.values()].sort(
        (a, b) => Math.abs(a.shrunkRate - BASE_RATE) - Math.abs(b.shrunkRate - BASE_RATE)
      );
      jogos = [sortStats(closest.slice(0, 6))];
      break;
    }

    case 'feature-conditioned': {
      jogos = generatePortfolio({
        dataset,
        count: 1,
        rng,
        candidatesPerGame: 400,
      }).games;
      break;
    }
  }

  for (const jogo of jogos) {
    jogo.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  return { estrategia: strategy, jogos };
}

export const STRATEGY_IDS = STRATEGIES.map((strategy) => strategy.id);

/** Sanity check used by tests: every strategy returns unique numbers in range. */
export function isValidGame(game: string[], expectedSize = 6): boolean {
  if (game.length !== expectedSize) return false;
  const unique = new Set(game);
  if (unique.size !== game.length) return false;
  return game.every((numero) => {
    const value = parseInt(numero, 10);
    return Number.isInteger(value) && value >= 1 && value <= TOTAL_NUMBERS;
  });
}
