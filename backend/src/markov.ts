import { getDb } from './db';

function formatNum(n: number): string {
  return n.toString().padStart(2, '0');
}

export function buildMarkovMatrix(): number[][] {
  const db = getDb();
  const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];

  const matrix: number[][] = Array.from({ length: 60 }, () => new Array(60).fill(0));

  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    const nums = dezenas.map(n => parseInt(n) - 1);
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i !== j) matrix[nums[i]][nums[j]]++;
      }
    }
  }

  for (let i = 0; i < 60; i++) {
    const sum = matrix[i].reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let j = 0; j < 60; j++) {
        matrix[i][j] = matrix[i][j] / sum;
      }
    }
  }

  return matrix;
}

export function generateMarkovChain(matrix: number[][]): string[] {
  const db = getDb();
  const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
  const totalFreq = new Array(60).fill(0);
  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) totalFreq[parseInt(n) - 1]++;
  }

  const totalSum = totalFreq.reduce((a, b) => a + b, 0);
  const chain: string[] = [];
  const used = new Set<number>();

  let current: number;
  if (totalSum > 0) {
    let r = Math.random() * totalSum;
    current = 0;
    for (let i = 0; i < 60; i++) {
      r -= totalFreq[i];
      if (r <= 0) { current = i; break; }
    }
  } else {
    current = Math.floor(Math.random() * 60);
  }

  chain.push(formatNum(current + 1));
  used.add(current);

  while (chain.length < 6) {
    const row = matrix[current];
    const available = row.map((p, i) => ({ p, i })).filter(x => !used.has(x.i) && x.p > 0);
    if (available.length === 0) {
      const remaining = Array.from({ length: 60 }, (_, i) => i).filter(i => !used.has(i));
      current = remaining[Math.floor(Math.random() * remaining.length)];
    } else {
      const totalP = available.reduce((s, x) => s + x.p, 0);
      let r = Math.random() * totalP;
      let next = available[0].i;
      for (const x of available) {
        r -= x.p;
        if (r <= 0) { next = x.i; break; }
      }
      current = next;
    }
    chain.push(formatNum(current + 1));
    used.add(current);
  }

  return chain.sort((a, b) => parseInt(a) - parseInt(b));
}
