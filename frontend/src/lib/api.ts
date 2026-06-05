const BASE = '/api';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface StatusResponse {
  totalDraws: number;
  latestConcurso: number;
  lastSync: string | null;
}

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

export interface StatisticsResponse {
  totalConcursos: number;
  frequency: FrequencyItem[];
  coldNumbers: ColdNumberItem[];
  parity: {
    evenOddDistribution: Record<string, number>;
  };
}

export interface GenerateResponse {
  modo: string;
  jogos: string[][];
}

export interface SimulationResponse {
  jogos: Array<{
    numeros: string[];
    acertos: Record<string, number>;
    porcentagens: Record<string, number>;
  }>;
  modo: string;
  totalConcursos: number;
}

export function fetchStatus(): Promise<StatusResponse> {
  return apiFetch('/status');
}

export function fetchStatistics(): Promise<StatisticsResponse> {
  return apiFetch('/statistics');
}

export function fetchGenerate(params: {
  mode?: string;
  count?: number;
  fixed?: string;
  exclude?: string;
  seeds?: string;
}): Promise<GenerateResponse> {
  const qs = new URLSearchParams();
  if (params.mode) qs.set('mode', params.mode);
  if (params.count) qs.set('count', String(params.count));
  if (params.fixed) qs.set('fixed', params.fixed);
  if (params.exclude) qs.set('exclude', params.exclude);
  if (params.seeds) qs.set('seeds', params.seeds);
  return apiFetch(`/generate?${qs.toString()}`);
}

export function fetchSimulate(params: {
  numbers: string;
  mode: string;
  count?: number;
}): Promise<SimulationResponse> {
  const qs = new URLSearchParams();
  qs.set('numbers', params.numbers);
  qs.set('mode', params.mode);
  if (params.count) qs.set('count', String(params.count));
  return apiFetch(`/simulate?${qs.toString()}`);
}
