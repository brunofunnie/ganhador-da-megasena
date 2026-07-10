import { DrawPrize, DrawRecord, getDb } from './db';

export interface DrawSummary {
  concurso: number;
  data: string;
  dezenas: string[];
  acumulou: boolean | null;
}

export interface DrawListInput {
  page: number;
  limit: number;
  search?: string;
  from?: string;
  to?: string;
  accumulated?: boolean;
}

export interface DrawListResult {
  items: DrawSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

type DrawRow = {
  concurso: number;
  data: string;
  dezenas: string;
  local: string | null;
  concurso_especial: number | null;
  dezenas_ordem_sorteio: string | null;
  premiacoes: string | null;
  estados_premiados: string | null;
  local_ganhadores: string | null;
  acumulou: number | null;
  proximo_concurso: number | null;
  data_proximo_concurso: string | null;
  valor_arrecadado: number | null;
  valor_acumulado_concurso_0_5: number | null;
  valor_acumulado_concurso_especial: number | null;
  valor_acumulado_proximo_concurso: number | null;
  valor_estimado_proximo_concurso: number | null;
};

const DATE_AS_ISO = "substr(data, 7, 4) || '-' || substr(data, 4, 2) || '-' || substr(data, 1, 2)";

function parseJsonArray<T>(value: string | null): T[] | null {
  return value === null ? null : JSON.parse(value) as T[];
}

function hydrateDraw(row: DrawRow): DrawRecord {
  return {
    concurso: row.concurso,
    data: row.data,
    dezenas: JSON.parse(row.dezenas) as string[],
    local: row.local,
    concursoEspecial: row.concurso_especial === null ? null : Boolean(row.concurso_especial),
    dezenasOrdemSorteio: parseJsonArray<string>(row.dezenas_ordem_sorteio),
    premiacoes: parseJsonArray<DrawPrize>(row.premiacoes),
    estadosPremiados: parseJsonArray<unknown>(row.estados_premiados),
    localGanhadores: parseJsonArray<unknown>(row.local_ganhadores),
    acumulou: row.acumulou === null ? null : Boolean(row.acumulou),
    proximoConcurso: row.proximo_concurso,
    dataProximoConcurso: row.data_proximo_concurso,
    valorArrecadado: row.valor_arrecadado,
    valorAcumuladoConcurso_0_5: row.valor_acumulado_concurso_0_5,
    valorAcumuladoConcursoEspecial: row.valor_acumulado_concurso_especial,
    valorAcumuladoProximoConcurso: row.valor_acumulado_proximo_concurso,
    valorEstimadoProximoConcurso: row.valor_estimado_proximo_concurso
  };
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function normalizeDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function buildFilters(input: DrawListInput): { clauses: string[]; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (input.search?.trim()) {
    clauses.push('CAST(concurso AS TEXT) LIKE ?');
    params.push(`%${input.search.trim()}%`);
  }
  if (input.from) {
    clauses.push(`${DATE_AS_ISO} >= ?`);
    params.push(normalizeDate(input.from));
  }
  if (input.to) {
    clauses.push(`${DATE_AS_ISO} <= ?`);
    params.push(normalizeDate(input.to));
  }
  if (input.accumulated !== undefined) {
    clauses.push('acumulou = ?');
    params.push(Number(input.accumulated));
  }

  return { clauses, params };
}

export function listDraws(input: DrawListInput): DrawListResult {
  const page = normalizePositiveInteger(input.page, 1);
  const limit = Math.min(normalizePositiveInteger(input.limit, 20), 100);
  const { clauses, params } = buildFilters(input);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as count FROM draws ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(
    `SELECT concurso, data, dezenas, acumulou
     FROM draws ${where}
     ORDER BY concurso DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, (page - 1) * limit) as Array<Pick<DrawRow, 'concurso' | 'data' | 'dezenas' | 'acumulou'>>;

  return {
    items: rows.map(row => ({
      concurso: row.concurso,
      data: row.data,
      dezenas: JSON.parse(row.dezenas) as string[],
      acumulou: row.acumulou === null ? null : Boolean(row.acumulou)
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}

export function getDraw(concurso: number): DrawRecord | null {
  const row = getDb().prepare('SELECT * FROM draws WHERE concurso = ?').get(concurso) as DrawRow | undefined;
  return row ? hydrateDraw(row) : null;
}

type Metrics = Pick<DrawAnalysis, 'sum' | 'evenCount' | 'oddCount' | 'rangeDistribution'>;

function validNumbers(dezenas: string): number[] | null {
  const values: unknown = JSON.parse(dezenas);
  if (!Array.isArray(values) || values.length !== 6) return null;

  const numbers = values.map(value => Number(value)).sort((a, b) => a - b);
  return numbers.every(number => Number.isInteger(number) && number >= 1 && number <= 60) && new Set(numbers).size === 6
    ? numbers
    : null;
}

function calculateMetrics(numbers: number[]): Metrics {
  const rangeDistribution = { first: 0, second: 0, third: 0 };
  let sum = 0;
  let evenCount = 0;

  for (const number of numbers) {
    sum += number;
    if (number % 2 === 0) evenCount++;
    if (number <= 20) rangeDistribution.first++;
    else if (number <= 40) rangeDistribution.second++;
    else rangeDistribution.third++;
  }

  return { sum, evenCount, oddCount: numbers.length - evenCount, rangeDistribution };
}

export function analyzeDraw(concurso: number): DrawAnalysis | null {
  const draw = getDraw(concurso);
  if (!draw) return null;

  const drawNumbers = validNumbers(JSON.stringify(draw.dezenas));
  if (!drawNumbers) return null;

  const historicalMetrics = (getDb().prepare('SELECT dezenas FROM draws').all() as Array<{ dezenas: string }>)
    .map(row => validNumbers(row.dezenas))
    .filter((numbers): numbers is number[] => numbers !== null)
    .map(calculateMetrics);
  const metrics = calculateMetrics(drawNumbers);
  const total = historicalMetrics.length;
  const totals = historicalMetrics.reduce((accumulator, item) => ({
    sum: accumulator.sum + item.sum,
    evenCount: accumulator.evenCount + item.evenCount,
    first: accumulator.first + item.rangeDistribution.first,
    second: accumulator.second + item.rangeDistribution.second,
    third: accumulator.third + item.rangeDistribution.third
  }), { sum: 0, evenCount: 0, first: 0, second: 0, third: 0 });

  return {
    ...metrics,
    historicalComparison: {
      averageSum: totals.sum / total,
      averageEvenCount: totals.evenCount / total,
      averageRangeDistribution: {
        first: totals.first / total,
        second: totals.second / total,
        third: totals.third / total
      }
    }
  };
}
