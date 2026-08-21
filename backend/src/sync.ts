import { DrawPrize, DrawRecord, getDb } from './db';

const API_BASE = 'https://loteriascaixa-api.herokuapp.com/api';
const LOTERIA = 'megasena';

export type SyncSource = 'caixa' | 'guidi';
export const SYNC_SOURCES: SyncSource[] = ['caixa', 'guidi'];

interface ApiResultado {
  loteria: string;
  concurso: number;
  data: string;
  dezenas: string[];
  local?: string;
  concursoEspecial?: boolean;
  dezenasOrdemSorteio?: string[];
  premiacoes?: DrawPrize[];
  estadosPremiados?: unknown[];
  localGanhadores?: unknown[];
  acumulou?: boolean;
  proximoConcurso?: number;
  dataProximoConcurso?: string;
  valorArrecadado?: number;
  valorAcumuladoConcurso_0_5?: number;
  valorAcumuladoConcursoEspecial?: number;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}

type StoredDraw = Omit<
  DrawRecord,
  'dezenas' | 'concursoEspecial' | 'dezenasOrdemSorteio' | 'premiacoes' | 'estadosPremiados' | 'localGanhadores' | 'acumulou'
> & {
  dezenas: string;
  concursoEspecial: number | null;
  dezenasOrdemSorteio: string | null;
  premiacoes: string | null;
  estadosPremiados: string | null;
  localGanhadores: string | null;
  acumulou: number | null;
};

type LatestDrawRow = {
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

function asJson(value: unknown[] | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

interface GuidiResult {
  numero: number;
  dataApuracao: string;
  dataProximoConcurso?: string | null;
  listaDezenas?: string[];
  localSorteio?: string | null;
  nomeMunicipioUFSorteio?: string | null;
  indicadorConcursoEspecial?: number;
  dezenasSorteadasOrdemSorteio?: string[];
  listaRateioPremio?: Array<{
    descricaoFaixa?: string | null;
    faixa?: number;
    numeroDeGanhadores?: number;
    valorPremio?: number;
  }>;
  listaMunicipioUFGanhadores?: Array<{ uf?: string }>;
  acumulado?: boolean;
  numeroConcursoProximo?: number | null;
  valorArrecadado?: number;
  valorAcumuladoConcurso_0_5?: number;
  valorAcumuladoConcursoEspecial?: number;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}

function normalizeDraw(result: ApiResultado): StoredDraw {
  return {
    concurso: result.concurso,
    data: result.data,
    dezenas: JSON.stringify(result.dezenas),
    local: result.local ?? null,
    concursoEspecial: result.concursoEspecial === undefined ? null : Number(result.concursoEspecial),
    dezenasOrdemSorteio: asJson(result.dezenasOrdemSorteio),
    premiacoes: asJson(result.premiacoes),
    estadosPremiados: asJson(result.estadosPremiados),
    localGanhadores: asJson(result.localGanhadores),
    acumulou: result.acumulou === undefined ? null : Number(result.acumulou),
    proximoConcurso: result.proximoConcurso ?? null,
    dataProximoConcurso: result.dataProximoConcurso ?? null,
    valorArrecadado: result.valorArrecadado ?? null,
    valorAcumuladoConcurso_0_5: result.valorAcumuladoConcurso_0_5 ?? null,
    valorAcumuladoConcursoEspecial: result.valorAcumuladoConcursoEspecial ?? null,
    valorAcumuladoProximoConcurso: result.valorAcumuladoProximoConcurso ?? null,
    valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso ?? null
  };
}

function normalizeGuidiDraw(result: GuidiResult): StoredDraw {
  const premios = result.listaRateioPremio?.map((p) => ({
    descricao: p.descricaoFaixa ?? '',
    faixa: p.faixa ?? 0,
    ganhadores: p.numeroDeGanhadores ?? 0,
    valorPremio: p.valorPremio ?? 0,
  }));
  const ganhadores = result.listaMunicipioUFGanhadores ?? [];
  const estados = ganhadores.length
    ? [...new Set(ganhadores.map((g) => g.uf).filter((uf): uf is string => Boolean(uf)))]
    : null;

  return {
    concurso: result.numero,
    data: result.dataApuracao,
    dezenas: JSON.stringify(result.listaDezenas ?? []),
    local: result.localSorteio ?? result.nomeMunicipioUFSorteio ?? null,
    concursoEspecial: result.indicadorConcursoEspecial === undefined ? null : Number(result.indicadorConcursoEspecial),
    dezenasOrdemSorteio: asJson(result.dezenasSorteadasOrdemSorteio),
    premiacoes: premios && premios.length ? JSON.stringify(premios) : null,
    estadosPremiados: asJson(estados),
    localGanhadores: asJson(ganhadores),
    acumulou: result.acumulado === undefined ? null : Number(result.acumulado),
    proximoConcurso: result.numeroConcursoProximo ?? null,
    dataProximoConcurso: result.dataProximoConcurso ?? null,
    valorArrecadado: result.valorArrecadado ?? null,
    valorAcumuladoConcurso_0_5: result.valorAcumuladoConcurso_0_5 ?? null,
    valorAcumuladoConcursoEspecial: result.valorAcumuladoConcursoEspecial ?? null,
    valorAcumuladoProximoConcurso: result.valorAcumuladoProximoConcurso ?? null,
    valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso ?? null
  };
}

function persistDraws(draws: StoredDraw[]): { inserted: number; total: number } {
  const db = getDb();

  const insert = db.prepare(
    `INSERT OR REPLACE INTO draws (
      concurso, data, dezenas, local, concurso_especial, dezenas_ordem_sorteio,
      premiacoes, estados_premiados, local_ganhadores, acumulou, proximo_concurso,
      data_proximo_concurso, valor_arrecadado, valor_acumulado_concurso_0_5,
      valor_acumulado_concurso_especial, valor_acumulado_proximo_concurso,
      valor_estimado_proximo_concurso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    let inserted = 0;
    for (const draw of draws) {
      const existing = db.prepare('SELECT concurso FROM draws WHERE concurso = ?').get(draw.concurso);
      if (!existing) inserted++;
      insert.run(
        draw.concurso, draw.data, draw.dezenas, draw.local, draw.concursoEspecial,
        draw.dezenasOrdemSorteio, draw.premiacoes, draw.estadosPremiados,
        draw.localGanhadores, draw.acumulou, draw.proximoConcurso,
        draw.dataProximoConcurso, draw.valorArrecadado,
        draw.valorAcumuladoConcurso_0_5, draw.valorAcumuladoConcursoEspecial,
        draw.valorAcumuladoProximoConcurso, draw.valorEstimadoProximoConcurso
      );
    }
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('last_sync', new Date().toISOString());
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('total_draws', String(draws.length));
    return inserted;
  });

  const inserted = transaction();
  return { inserted, total: draws.length };
}

async function caixaSync(): Promise<{ inserted: number; total: number }> {
  const response = await fetch(`${API_BASE}/${LOTERIA}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const results: ApiResultado[] = [...await response.json()];

  // The aggregate endpoint can lag one draw behind /latest right after a
  // draw, so merge /latest in; it is best-effort and must not fail the sync.
  try {
    const latestResponse = await fetch(`${API_BASE}/${LOTERIA}/latest`);
    if (latestResponse.ok) {
      const latest: ApiResultado = await latestResponse.json();
      if (typeof latest?.concurso === 'number' && !results.some((r) => r.concurso === latest.concurso)) {
        results.push(latest);
      }
    }
  } catch {
    // ignore: the full list already fetched successfully
  }

  return persistDraws(results.map(normalizeDraw));
}

async function guidISync(): Promise<{ inserted: number; total: number }> {
  const base = process.env.LOTERIA_GUIDI_BASE_URL || 'https://api.guidi.dev.br/loteria';

  const ultimoResponse = await fetch(`${base}/megasena/ultimo`);
  if (!ultimoResponse.ok) {
    throw new Error(`Guidi API returned ${ultimoResponse.status}: ${ultimoResponse.statusText}`);
  }
  const ultimo: GuidiResult = await ultimoResponse.json();

  const db = getDb();
  const currentMaxRow = db.prepare('SELECT MAX(concurso) as max FROM draws').get() as { max: number | null };
  const currentMax = currentMaxRow?.max ?? 0;

  const draws: StoredDraw[] = [];
  const ultimoNumero = ultimo.numero;

  // Best-effort backfill of the gap above the newest draw (ultimo appended below).
  for (let n = currentMax + 1; n < ultimoNumero; n++) {
    try {
      const res = await fetch(`${base}/megasena/${n}`);
      if (res.ok) {
        const dto: GuidiResult = await res.json();
        if (typeof dto?.numero === 'number') draws.push(normalizeGuidiDraw(dto));
      }
    } catch {
      // skip: a single missed draw must not abort the sync
    }
  }

  if (typeof ultimoNumero === 'number' && ultimoNumero > 0) {
    draws.push(normalizeGuidiDraw(ultimo));
  }

  return persistDraws(draws);
}

export async function syncResults(source: SyncSource = 'caixa'): Promise<{ inserted: number; total: number }> {
  if (!SYNC_SOURCES.includes(source)) {
    throw new Error(`Unknown sync source: ${source}`);
  }
  const result = source === 'guidi' ? await guidISync() : await caixaSync();
  setSyncSource(source);
  return result;
}

export function getSyncStatus() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number };
  const latest = db.prepare('SELECT * FROM draws ORDER BY concurso DESC LIMIT 1').get() as LatestDrawRow | undefined;
  const lastSync = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get() as { value: string } | undefined;

  return {
    totalDraws: count.count,
    latestConcurso: latest?.concurso || 0,
    latestDraw: latest
      ? {
          concurso: latest.concurso,
          data: latest.data,
          dezenas: JSON.parse(latest.dezenas) as string[],
          local: latest.local,
          concursoEspecial: latest.concurso_especial === null ? null : Boolean(latest.concurso_especial),
          dezenasOrdemSorteio: latest.dezenas_ordem_sorteio === null ? null : JSON.parse(latest.dezenas_ordem_sorteio) as string[],
          premiacoes: latest.premiacoes === null ? null : JSON.parse(latest.premiacoes) as DrawPrize[],
          estadosPremiados: latest.estados_premiados === null ? null : JSON.parse(latest.estados_premiados) as unknown[],
          localGanhadores: latest.local_ganhadores === null ? null : JSON.parse(latest.local_ganhadores) as unknown[],
          acumulou: latest.acumulou === null ? null : Boolean(latest.acumulou),
          proximoConcurso: latest.proximo_concurso,
          dataProximoConcurso: latest.data_proximo_concurso,
          valorArrecadado: latest.valor_arrecadado,
          valorAcumuladoConcurso_0_5: latest.valor_acumulado_concurso_0_5,
          valorAcumuladoConcursoEspecial: latest.valor_acumulado_concurso_especial,
          valorAcumuladoProximoConcurso: latest.valor_acumulado_proximo_concurso,
          valorEstimadoProximoConcurso: latest.valor_estimado_proximo_concurso
        }
      : null,
    lastSync: lastSync?.value || null,
    syncSource: getSyncSource()
  };
}

export function getSyncSource(): SyncSource {
  const db = getDb();
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync_source'").get() as { value: string } | undefined;
  return row && SYNC_SOURCES.includes(row.value as SyncSource) ? (row.value as SyncSource) : 'caixa';
}

export function setSyncSource(source: SyncSource): void {
  if (!SYNC_SOURCES.includes(source)) {
    throw new Error(`Unknown sync source: ${source}`);
  }
  getDb().prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run('last_sync_source', source);
}
