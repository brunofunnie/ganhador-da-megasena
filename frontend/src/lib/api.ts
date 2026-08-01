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
  iterations?: number;
  strategies?: string;
  windowSize?: number;
}): Promise<GenerateResponse> {
  const qs = new URLSearchParams();
  if (params.mode) qs.set('mode', params.mode);
  if (params.count) qs.set('count', String(params.count));
  if (params.fixed) qs.set('fixed', params.fixed);
  if (params.exclude) qs.set('exclude', params.exclude);
  if (params.seeds) qs.set('seeds', params.seeds);
  if (params.iterations) qs.set('iterations', String(params.iterations));
  if (params.strategies) qs.set('strategies', params.strategies);
  if (params.windowSize) qs.set('windowSize', String(params.windowSize));
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

export interface WalletSummary {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  createdAt: string;
  finalizedAt: string | null;
  gameCount: number;
}

export interface WalletGame {
  id: number;
  dezenas: string[];
  createdAt: string;
}

export interface WalletDetail {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  createdAt: string;
  finalizedAt: string | null;
  games: WalletGame[];
}

export function fetchWallets(): Promise<{ carteiras: WalletSummary[] }> {
  return apiFetch('/wallets');
}

export function createWallet(name: string): Promise<WalletSummary> {
  return fetch(`${BASE}/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao criar carteira');
    return res.json();
  });
}

export function fetchWallet(id: number): Promise<WalletDetail> {
  return apiFetch(`/wallets/${id}`);
}

export function updateWallet(
  id: number,
  patch: { name?: string; status?: 'open' | 'finalized' }
): Promise<WalletDetail> {
  return fetch(`${BASE}/wallets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao atualizar carteira');
    return res.json();
  });
}

export function deleteWallet(id: number): Promise<void> {
  return fetch(`${BASE}/wallets/${id}`, { method: 'DELETE' }).then(async (res) => {
    if (res.status === 204) return;
    throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao excluir carteira');
  });
}

export function addGameToWallet(id: number, dezenas: string[]): Promise<WalletGame> {
  return fetch(`${BASE}/wallets/${id}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dezenas }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao adicionar jogo');
    return res.json();
  });
}

export function deleteWalletGame(id: number, gameId: number): Promise<void> {
  return fetch(`${BASE}/wallets/${id}/games/${gameId}`, { method: 'DELETE' }).then(async (res) => {
    if (res.status === 204) return;
    throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao remover jogo');
  });
}


