import { getDb } from './db';

export interface FrequencyItem {
  numero: string;
  frequencia: number;
  porcentagem: number;
}

export interface ColdNumberItem {
  numero: string;
  ultimoConcurso: number | null;
  concursosAtrasado: number;
}

export interface Statistics {
  totalConcursos: number;
  frequency: FrequencyItem[];
  coldNumbers: ColdNumberItem[];
  parity: {
    evenOddDistribution: Record<string, number>;
  };
}

export function computeStatistics(): Statistics {
  const db = getDb();
  const draws = db.prepare('SELECT concurso, dezenas FROM draws ORDER BY concurso ASC').all() as {
    concurso: number;
    dezenas: string;
  }[];

  const totalConcursos = draws.length;
  const maxConcurso = draws.length > 0 ? draws[draws.length - 1].concurso : 0;

  const frequencyMap = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    frequencyMap.set(key, 0);
    lastSeen.set(key, -1);
  }

  const parityCounts: Record<string, number> = {};

  for (const draw of draws) {
    const dezenas: string[] = JSON.parse(draw.dezenas);

    let evens = 0;
    for (const d of dezenas) {
      frequencyMap.set(d, (frequencyMap.get(d) || 0) + 1);
      lastSeen.set(d, draw.concurso);
      if (parseInt(d) % 2 === 0) evens++;
    }
    const odds = 6 - evens;
    const key = `${evens}p-${odds}i`;
    parityCounts[key] = (parityCounts[key] || 0) + 1;
  }

  const frequency: FrequencyItem[] = [];
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    const freq = frequencyMap.get(key) || 0;
    frequency.push({
      numero: key,
      frequencia: freq,
      porcentagem: totalConcursos > 0 ? parseFloat(((freq / totalConcursos) * 100).toFixed(2)) : 0
    });
  }

  const coldNumbers: ColdNumberItem[] = [];
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    const last = lastSeen.get(key) ?? -1;
    coldNumbers.push({
      numero: key,
      ultimoConcurso: last === -1 ? null : last,
      concursosAtrasado: last === -1 ? totalConcursos : maxConcurso - last
    });
  }

  return {
    totalConcursos,
    frequency: frequency.sort((a, b) => b.frequencia - a.frequencia),
    coldNumbers: coldNumbers.sort((a, b) => b.concursosAtrasado - a.concursosAtrasado),
    parity: { evenOddDistribution: parityCounts }
  };
}
