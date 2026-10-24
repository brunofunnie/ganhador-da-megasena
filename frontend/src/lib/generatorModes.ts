export interface GeneratorModeOption {
  value: string;
  label: string;
  short: string;
}

/** Single source of truth for mode ids/labels used by the generator and wallets. */
export const GENERATOR_MODES: GeneratorModeOption[] = [
  { value: 'statistical', label: 'Estatístico (features reais)', short: 'Estatístico' },
  { value: 'random', label: 'Aleatório Puro', short: 'Aleatório' },
  { value: 'hot', label: 'Quentes (z-score de frequência)', short: 'Quentes' },
  { value: 'cold', label: 'Frios (atraso geométrico)', short: 'Frios' },
  { value: 'balanced', label: 'Balanceado (3P-3I)', short: '3P-3I' },
  { value: 'genetic', label: 'Genético (algoritmo evolutivo)', short: 'Genético' },
  { value: 'sequences', label: 'Sequências (Primos/Fibonacci)', short: 'Sequências' },
  { value: 'fechamento', label: 'Fechamento (cobertura com garantia)', short: 'Fechamento' },
  { value: 'dreams', label: 'Sonhos (com seed)', short: 'Sonhos' },
  { value: 'trend', label: 'Tendência Temporal (z assinado)', short: 'Tendência' },
  { value: 'monte-carlo', label: 'Monte Carlo (busca de portfólio)', short: 'Monte Carlo' },
  { value: 'ensemble', label: 'Ensemble (voto ponderado)', short: 'Ensemble' },
  { value: 'markov', label: 'Markov (transição temporal)', short: 'Markov' },
];

const MODE_MAP = new Map(GENERATOR_MODES.map((mode) => [mode.value, mode]));

/** Full label; `null`/unknown modes fall back to a readable value. */
export function modeLabel(value?: string | null): string {
  if (!value) return 'Manual';
  return MODE_MAP.get(value)?.label ?? value;
}

/** Compact label for badges inside tables/cards. */
export function modeShortLabel(value?: string | null): string {
  if (!value) return 'Manual';
  return MODE_MAP.get(value)?.short ?? value;
}

export function isGeneratedMode(value?: string | null): boolean {
  return Boolean(value && MODE_MAP.has(value));
}
