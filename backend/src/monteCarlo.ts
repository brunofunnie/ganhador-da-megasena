import { getDb } from './db';

function formatNum(n: number): string {
  return n.toString().padStart(2, '0');
}

function countMatches(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(n => setB.has(n)).length;
}

function generateRandomDraw(fixed: string[], exclude: string[]): string[] {
  const excluded = new Set([...exclude, ...fixed]);
  const pool = Array.from({ length: 60 }, (_, i) => formatNum(i + 1)).filter(n => !excluded.has(n));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return [...fixed, ...shuffled.slice(0, 6 - fixed.length)].sort((a, b) => parseInt(a) - parseInt(b));
}

export function runMonteCarlo(options: {
  iterations: number;
  topK: number;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
}): { jogos: string[][]; stats: { mediaAcertos: number; maxAcertos: number } } {
  const { iterations, topK, fixedNumbers = [], excludeNumbers = [] } = options;

  const db = getDb();
  const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];

  if (draws.length === 0) {
    const pool = Array.from({ length: 60 }, (_, i) => formatNum(i + 1)).filter(
      n => !new Set([...excludeNumbers, ...fixedNumbers]).has(n)
    );
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return {
      jogos: [[...fixedNumbers, ...shuffled.slice(0, 6 - fixedNumbers.length)].sort()],
      stats: { mediaAcertos: 0, maxAcertos: 0 }
    };
  }

  const candidates: { game: string[]; avgHits: number; maxHits: number }[] = [];

  for (let i = 0; i < iterations; i++) {
    const game = generateRandomDraw(fixedNumbers, excludeNumbers);
    let totalHits = 0;
    let maxHits = 0;
    for (const d of draws) {
      const dezenas: string[] = JSON.parse(d.dezenas);
      const hits = countMatches(game, dezenas);
      totalHits += hits;
      if (hits > maxHits) maxHits = hits;
    }
    candidates.push({ game, avgHits: totalHits / draws.length, maxHits });
  }

  candidates.sort((a, b) => b.avgHits - a.avgHits);
  const top = candidates.slice(0, topK);

  return {
    jogos: top.map(c => c.game),
    stats: {
      mediaAcertos: parseFloat((top.reduce((s, c) => s + c.avgHits, 0) / top.length).toFixed(4)),
      maxAcertos: Math.max(...top.map(c => c.maxHits))
    }
  };
}
