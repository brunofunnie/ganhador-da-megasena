import { DrawPrize, DrawRecord, getDb } from './db';

const API_BASE = 'https://loteriascaixa-api.herokuapp.com/api';
const LOTERIA = 'megasena';

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

export async function syncResults(): Promise<{ inserted: number; total: number }> {
  const response = await fetch(`${API_BASE}/${LOTERIA}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const results: ApiResultado[] = await response.json();
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
    for (const r of results) {
      const existing = db.prepare('SELECT concurso FROM draws WHERE concurso = ?').get(r.concurso);
      if (!existing) inserted++;
      const draw = normalizeDraw(r);
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
      .run('total_draws', String(results.length));
    return inserted;
  });

  const inserted = transaction();
  return { inserted, total: results.length };
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
    lastSync: lastSync?.value || null
  };
}
