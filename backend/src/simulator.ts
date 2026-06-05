import { getDb } from './db';

export interface SimulationOptions {
  numbers: string[];
  mode: 'historical' | 'random';
  randomCount?: number;
}

export interface SimulationResult {
  numeros: string[];
  modo: string;
  totalConcursos: number;
  acertos: Record<string, number>;
  porcentagens: Record<string, number>;
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

export function runSimulation(options: SimulationOptions): SimulationResult {
  const { numbers, mode, randomCount = 1000 } = options;

  const acertos: Record<string, number> = { '6': 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0, '0': 0 };
  let totalConcursos = 0;

  if (mode === 'historical') {
    const db = getDb();
    const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
    totalConcursos = draws.length;

    for (const draw of draws) {
      const dezenas: string[] = JSON.parse(draw.dezenas);
      const matches = countMatches(numbers, dezenas);
      acertos[String(matches)] = (acertos[String(matches)] || 0) + 1;
    }
  } else {
    totalConcursos = randomCount;
    for (let i = 0; i < randomCount; i++) {
      const draw = generateRandomDraw();
      const matches = countMatches(numbers, draw);
      acertos[String(matches)] = (acertos[String(matches)] || 0) + 1;
    }
  }

  const porcentagens: Record<string, number> = {};
  for (const key of Object.keys(acertos)) {
    porcentagens[key] = totalConcursos > 0
      ? parseFloat(((acertos[key] / totalConcursos) * 100).toFixed(2))
      : 0;
  }

  return {
    numeros: numbers,
    modo: mode === 'historical' ? 'histórico' : 'aleatório',
    totalConcursos,
    acertos,
    porcentagens
  };
}
