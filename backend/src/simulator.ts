import { getDb } from './db';

export interface SimulationOptions {
  games: string[][];
  mode: 'historical' | 'random';
  randomCount?: number;
}

export interface GameResult {
  numeros: string[];
  acertos: Record<string, number>;
  porcentagens: Record<string, number>;
}

export interface SimulationResult {
  jogos: GameResult[];
  modo: string;
  totalConcursos: number;
}

function countMatches(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(n => setB.has(n)).length;
}

function generateRandomDraw(): string[] {
  const nums = new Set<number>();
  while (nums.size < 6) {
    nums.add(Math.floor(Math.random() * 60) + 1);
  }
  return Array.from(nums)
    .sort((a, b) => a - b)
    .map(n => n.toString().padStart(2, '0'));
}

function newAcertos(): Record<string, number> {
  return { '6': 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0, '0': 0 };
}

export function runSimulation(options: SimulationOptions): SimulationResult {
  const { games, mode, randomCount = 1000 } = options;

  const jogos: GameResult[] = games.map(numbers => ({
    numeros: numbers,
    acertos: newAcertos(),
    porcentagens: {},
  }));

  let totalConcursos = 0;

  if (mode === 'historical') {
    const db = getDb();
    const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
    totalConcursos = draws.length;

    for (const draw of draws) {
      const dezenas: string[] = JSON.parse(draw.dezenas);
      for (const jogo of jogos) {
        const matches = countMatches(jogo.numeros, dezenas);
        jogo.acertos[String(matches)] = (jogo.acertos[String(matches)] || 0) + 1;
      }
    }
  } else {
    totalConcursos = randomCount;
    for (let i = 0; i < randomCount; i++) {
      const draw = generateRandomDraw();
      for (const jogo of jogos) {
        const matches = countMatches(jogo.numeros, draw);
        jogo.acertos[String(matches)] = (jogo.acertos[String(matches)] || 0) + 1;
      }
    }
  }

  for (const jogo of jogos) {
    for (const key of Object.keys(jogo.acertos)) {
      jogo.porcentagens[key] = totalConcursos > 0
        ? parseFloat(((jogo.acertos[key] / totalConcursos) * 100).toFixed(2))
        : 0;
    }
  }

  return {
    jogos,
    modo: mode === 'historical' ? 'histórico' : 'aleatório',
    totalConcursos,
  };
}
