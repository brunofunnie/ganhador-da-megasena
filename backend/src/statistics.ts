import { DrawDataset, TOTAL_NUMBERS, formatNumber, getDataset } from './dataset';
import {
  SignificanceSummary,
  buildFrequencyModel,
  summarizeSignificance,
} from './statistical';

export interface FrequencyItem {
  numero: string;
  frequencia: number;
  porcentagem: number;
  /** (frequência − esperado) / desvio-padrão. |z| < 2 é ruído amostral. */
  zScore: number;
  /** Taxa suavizada (empirical Bayes) em torno de 10%. */
  taxaSuavizada: number;
}

export interface ColdNumberItem {
  numero: string;
  ultimoConcurso: number | null;
  concursosAtrasado: number;
  /** (atraso − 10) / 9,49 — o atraso é geométrico, não linear. */
  atrasoZ: number;
  /** P(atraso ≥ observado) sob o modelo geométrico. */
  probabilidadeAtraso: number;
}

export interface Statistics {
  totalConcursos: number;
  frequency: FrequencyItem[];
  coldNumbers: ColdNumberItem[];
  parity: {
    evenOddDistribution: Record<string, number>;
  };
  significance: SignificanceSummary;
}

export interface NumberGapIntervals {
  numero: string;
  intervalos: number[];
  gapAtual: number;
}

export interface GapIntervals {
  totalConcursos: number;
  numeros: NumberGapIntervals[];
}

export function computeGapIntervals(
  windowSize: number,
  dataset: DrawDataset = getDataset()
): GapIntervals {
  const all = dataset.draws;
  const windowed = all.slice(Math.max(0, all.length - Math.max(1, windowSize)));
  const latestConcurso = all.length > 0 ? all[all.length - 1].concurso : 0;

  const numeros: NumberGapIntervals[] = [];
  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    const numero = formatNumber(i);
    const intervalos: number[] = [];
    let lastSeen: number | null = null;

    // Oldest → newest, then reversed: the UI shows the most recent gap first.
    for (const draw of windowed) {
      if (draw.numbers.includes(numero)) {
        if (lastSeen !== null) intervalos.push(draw.concurso - lastSeen);
        lastSeen = draw.concurso;
      }
    }
    intervalos.reverse();

    let lastAppearance: number | null = null;
    for (let d = all.length - 1; d >= 0; d--) {
      if (all[d].numbers.includes(numero)) {
        lastAppearance = all[d].concurso;
        break;
      }
    }

    const gapAtual =
      lastAppearance === null
        ? all.length
        : latestConcurso - lastAppearance;

    numeros.push({ numero, intervalos, gapAtual });
  }

  return { totalConcursos: windowed.length, numeros };
}

export function computeStatistics(dataset: DrawDataset = getDataset()): Statistics {
  const model = buildFrequencyModel(dataset);
  const total = model.total;

  const parityCounts: Record<string, number> = {};
  for (const draw of dataset.draws) {
    let evens = 0;
    for (const numero of draw.numbers) {
      if (parseInt(numero, 10) % 2 === 0) evens++;
    }
    const odds = 6 - evens;
    const key = `${evens}p-${odds}i`;
    parityCounts[key] = (parityCounts[key] || 0) + 1;
  }

  // byFrequency is already sorted desc; ensure porcentagem uses the draw total.
  const frequency: FrequencyItem[] = model.byFrequency.map((stat) => ({
    numero: stat.numero,
    frequencia: stat.count,
    porcentagem: total > 0 ? parseFloat(((stat.count / total) * 100).toFixed(2)) : 0,
    zScore: parseFloat(stat.z.toFixed(2)),
    taxaSuavizada: parseFloat((stat.shrunkRate * 100).toFixed(2)),
  }));

  const coldNumbers: ColdNumberItem[] = model.byGap.map((stat) => ({
    numero: stat.numero,
    ultimoConcurso: stat.lastConcurso,
    concursosAtrasado: stat.gap,
    atrasoZ: parseFloat(stat.gapZ.toFixed(2)),
    probabilidadeAtraso: parseFloat(stat.survival.toFixed(4)),
  }));

  return {
    totalConcursos: total,
    frequency,
    coldNumbers,
    parity: { evenOddDistribution: parityCounts },
    significance: summarizeSignificance(model),
  };
}
