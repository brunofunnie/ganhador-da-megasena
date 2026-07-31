import { getDb } from './db';
import { getTemporalTrend } from './temporalTrend';
import { runMonteCarlo } from './monteCarlo';
import { runEnsemble } from './ensemble';
import { buildMarkovMatrix, generateMarkovChain } from './markov';

export const GENERATOR_MODES = [
  'random', 'hot', 'cold', 'balanced', 'genetic', 'sequences', 'fechamento', 'dreams',
  'trend', 'monte-carlo', 'ensemble', 'markov'
] as const;

export type GeneratorMode = typeof GENERATOR_MODES[number];

export interface GeneratorOptions {
  mode: GeneratorMode;
  count: number;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
  seedNumbers?: string[];
  iterations?: number;
  strategies?: string[];
  windowSize?: number;
}

function formatNum(n: number): string {
  return n.toString().padStart(2, '0');
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getAvailableNumbers(
  fixedNumbers: string[],
  excludeNumbers: string[]
): number[] {
  const excluded = new Set([...excludeNumbers, ...fixedNumbers].map(n => parseInt(n)));

  return Array.from({ length: 60 }, (_, i) => i + 1)
    .filter(n => !excluded.has(n));
}

function generateRandomNumbers(count: number, pool: number[]): string[] {
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, count).map(formatNum).sort();
}

function getFrequencyMap(): Map<string, number> {
  const db = getDb();
  const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
  const freq = new Map<string, number>();
  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) {
      freq.set(n, (freq.get(n) || 0) + 1);
    }
  }
  return freq;
}

function getColdRankMap(): Map<string, number> {
  const db = getDb();
  const draws = db.prepare(
    'SELECT concurso, dezenas FROM draws ORDER BY concurso ASC'
  ).all() as { concurso: number; dezenas: string }[];

  const maxConcurso = draws.length > 0 ? draws[draws.length - 1].concurso : 0;
  const lastSeen = new Map<string, number>();

  for (let i = 1; i <= 60; i++) {
    lastSeen.set(formatNum(i), 0);
  }
  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) {
      lastSeen.set(n, d.concurso);
    }
  }

  const coldRank = new Map<string, number>();
  for (const [num, last] of lastSeen) {
    coldRank.set(num, maxConcurso - last);
  }
  return coldRank;
}

function weightedPick(pool: number[], weights: Map<string, number>, count: number): string[] {
  const remaining = new Set(pool.map(formatNum));
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const available = Array.from(remaining).map(k => parseInt(k));
    const totalWeight = available.reduce((sum, n) => sum + (weights.get(formatNum(n)) || 1), 0);
    let rand = Math.random() * totalWeight;
    let selected = '';
    for (const n of available) {
      const key = formatNum(n);
      if (!remaining.has(key)) continue;
      rand -= (weights.get(key) || 1);
      if (rand <= 0) {
        selected = key;
        break;
      }
    }
    if (!selected) {
      const avail = Array.from(remaining);
      selected = avail[Math.floor(Math.random() * avail.length)];
    }
    remaining.delete(selected);
    result.push(selected);
  }

  return result.sort();
}

export function generateNumbers(options: GeneratorOptions): string[][] {
  const {
    mode,
    count = 1,
    fixedNumbers = [],
    excludeNumbers = [],
    seedNumbers = []
  } = options;

  const actualCount = Math.min(Math.max(count, 1), 10);
  const available = getAvailableNumbers(fixedNumbers, excludeNumbers);
  const games: string[][] = [];

  for (let g = 0; g < actualCount; g++) {
    let picked: string[] = [];

    switch (mode) {
      case 'random': {
        const randomNums = generateRandomNumbers(6 - fixedNumbers.length, available);
        picked = [...fixedNumbers, ...randomNums];
        break;
      }

      case 'hot': {
        const freq = getFrequencyMap();
        const pool = available.filter(n => (freq.get(formatNum(n)) || 0) > 0);
        picked = weightedPick(
          pool.length >= 6 ? pool : available,
          freq,
          6 - fixedNumbers.length
        );
        picked = [...fixedNumbers, ...picked];
        break;
      }

      case 'cold': {
        const coldRank = getColdRankMap();
        const pool = available;
        picked = weightedPick(pool, coldRank, 6 - fixedNumbers.length);
        picked = [...fixedNumbers, ...picked];
        break;
      }

      case 'balanced': {
        const evens = available.filter(n => n % 2 === 0);
        const odds = available.filter(n => n % 2 !== 0);
        const needed = 6 - fixedNumbers.length;
        const evensNeeded = Math.floor(needed / 2);
        const oddsNeeded = needed - evensNeeded;

        const shuffledEvens = shuffleArray(evens).slice(0, evensNeeded).map(formatNum);
        const shuffledOdds = shuffleArray(odds).slice(0, oddsNeeded).map(formatNum);
        picked = [...fixedNumbers, ...shuffledEvens, ...shuffledOdds];
        break;
      }

      case 'genetic': {
        const freq = getFrequencyMap();
        const coldRank = getColdRankMap();

        const freqSorted = available
          .map(n => formatNum(n))
          .filter(n => (freq.get(n) || 0) > 0)
          .sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0));
        const coldSorted = available
          .map(n => formatNum(n))
          .sort((a, b) => (coldRank.get(b) || 0) - (coldRank.get(a) || 0));

        const hotPicks = freqSorted.slice(0, 3);
        const coldPicks = coldSorted.filter(n => !hotPicks.includes(n)).slice(0, 3);
        picked = [...fixedNumbers, ...hotPicks, ...coldPicks];
        break;
      }

      case 'sequences': {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];
        const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55];
        const seqPool = Array.from(new Set([...primes, ...fib]));

        const inPool = available.filter(n => seqPool.includes(n));
        const needed = 6 - fixedNumbers.length;
        const fromSeq = inPool.slice(0, needed);
        const rest = generateRandomNumbers(Math.max(0, needed - fromSeq.length), available);
        picked = [...fixedNumbers, ...fromSeq.map(formatNum), ...rest];
        break;
      }

      case 'fechamento': {
        const baseNums = available.slice(0, 7);
        const combos = generateCombinations(baseNums.map(formatNum), 6);
        if (combos.length > 0) {
          picked = combos[g % combos.length];
        } else {
          picked = generateRandomNumbers(6 - fixedNumbers.length, available);
        }
        picked = [...fixedNumbers, ...picked].slice(0, 6);
        break;
      }

      case 'dreams': {
        const seedPool = seedNumbers.length > 0
          ? available.filter(n => seedNumbers.includes(formatNum(n)))
          : available;
        const needed = 6 - fixedNumbers.length;

        const fromSeed = shuffleArray(seedPool).slice(0, needed);
        const remaining = generateRandomNumbers(
          Math.max(0, needed - fromSeed.length),
          available.filter(number => !fromSeed.includes(number))
        );
        picked = [...fixedNumbers, ...fromSeed.map(formatNum), ...remaining];
        break;
      }

      case 'trend': {
        const windowSize = options.windowSize || 50;
        const scores = getTemporalTrend(windowSize);
        const weightMap = new Map<string, number>();
        for (const [num, score] of scores) {
          weightMap.set(num, Math.abs(score) + 0.001);
        }
        picked = weightedPick(available, weightMap, 6 - fixedNumbers.length);
        picked = [...fixedNumbers, ...picked];
        break;
      }

      case 'monte-carlo': {
        const iterations = options.iterations || 10000;
        const result = runMonteCarlo({
          iterations,
          topK: actualCount,
          fixedNumbers,
          excludeNumbers
        });
        games.push(...result.jogos);
        continue;
      }

      case 'ensemble': {
        const strategies = options.strategies || ['top6', 'cold6', 'balanced-3p3i', 'quadrants', 'primes-power', 'avg-frequency'];
        const ensembleGames = runEnsemble({ strategyIds: strategies, count: actualCount });
        games.push(...ensembleGames);
        continue;
      }

      case 'markov': {
        const matrix = buildMarkovMatrix();
        picked = generateMarkovChain(matrix);
        picked = [...fixedNumbers, ...picked].slice(0, 6);
        break;
      }
    }

    picked = [...new Set(picked)].slice(0, 6);
    picked.sort((a, b) => parseInt(a) - parseInt(b));
    games.push(picked);
  }

  return games;
}

function generateCombinations(arr: string[], k: number): string[][] {
  const result: string[][] = [];
  function combine(start: number, current: string[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}
