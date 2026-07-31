import { getDb } from './db';

export function getTemporalTrend(windowSize: number = 50): Map<string, number> {
  const db = getDb();
  const draws = db.prepare('SELECT concurso, dezenas FROM draws ORDER BY concurso ASC').all() as {
    concurso: number;
    dezenas: string;
  }[];

  const totalConcursos = draws.length;
  if (totalConcursos === 0) {
    const map = new Map<string, number>();
    for (let i = 1; i <= 60; i++) map.set(i.toString().padStart(2, '0'), 0);
    return map;
  }

  const recentWindow = Math.min(windowSize, totalConcursos);
  const recentDraws = draws.slice(-recentWindow);

  const totalFreq = new Map<string, number>();
  const recentFreq = new Map<string, number>();
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    totalFreq.set(key, 0);
    recentFreq.set(key, 0);
  }

  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) totalFreq.set(n, (totalFreq.get(n) || 0) + 1);
  }

  for (const d of recentDraws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) recentFreq.set(n, (recentFreq.get(n) || 0) + 1);
  }

  const scores = new Map<string, number>();
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    const recentRate = recentFreq.get(key)! / recentWindow;
    const totalRate = totalFreq.get(key)! / totalConcursos;
    scores.set(key, parseFloat((recentRate - totalRate).toFixed(4)));
  }

  return scores;
}
