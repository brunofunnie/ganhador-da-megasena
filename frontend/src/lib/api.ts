const BASE = '/api';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface LatestDraw {
  concurso: number;
  data: string;
  dezenas: string[];
}

export interface StatusResponse {
  totalDraws: number;
  latestConcurso: number;
  latestDraw: LatestDraw | null;
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

export interface DrawPrize {
  descricao: string;
  faixa: number;
  ganhadores: number;
  valorPremio: number;
}

export interface DrawSummary {
  concurso: number;
  data: string;
  dezenas: string[];
  acumulou: boolean | null;
}

export interface DrawRecord {
  concurso: number;
  data: string;
  dezenas: string[];
  local: string | null;
  concursoEspecial: boolean | null;
  dezenasOrdemSorteio: string[] | null;
  premiacoes: DrawPrize[] | null;
  estadosPremiados: unknown[] | null;
  localGanhadores: unknown[] | null;
  acumulou: boolean | null;
  proximoConcurso: number | null;
  dataProximoConcurso: string | null;
  valorArrecadado: number | null;
  valorAcumuladoConcurso_0_5: number | null;
  valorAcumuladoConcursoEspecial: number | null;
  valorAcumuladoProximoConcurso: number | null;
  valorEstimadoProximoConcurso: number | null;
}

export interface DrawAnalysis {
  sum: number;
  evenCount: number;
  oddCount: number;
  rangeDistribution: {
    first: number;
    second: number;
    third: number;
  };
  historicalComparison: {
    averageSum: number;
    averageEvenCount: number;
    averageRangeDistribution: {
      first: number;
      second: number;
      third: number;
    };
  };
}

export interface DrawFilters {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
  accumulated?: boolean;
}

export interface DrawListResponse {
  items: DrawSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

export function fetchDraws(filters: DrawFilters = {}): Promise<DrawListResponse> {
  const qs = new URLSearchParams();
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.search) qs.set('search', filters.search);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.accumulated !== undefined) qs.set('accumulated', String(filters.accumulated));
  const query = qs.toString();
  return apiFetch(`/draws${query ? `?${query}` : ''}`);
}

export function fetchDraw(concurso: number): Promise<DrawRecord> {
  return apiFetch(`/draws/${concurso}`);
}

export function fetchDrawAnalysis(concurso: number): Promise<DrawAnalysis> {
  return apiFetch(`/draws/${concurso}/analysis`);
}
