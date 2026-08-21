import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { syncResults, getSyncStatus, getSyncSource, setSyncSource } from './sync';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'sync-test.db');
const LEGACY_DB_PATH = path.join(__dirname, '..', 'data', 'sync-legacy-test.db');

const MOCK_RESULTS = [
  {
    concurso: 1,
    data: '01/01/2000',
    dezenas: ['01', '02', '03', '04', '05', '06'],
    loteria: 'megasena'
  },
  {
    concurso: 2,
    data: '08/01/2000',
    dezenas: ['07', '08', '09', '10', '11', '12'],
    loteria: 'megasena',
    local: 'Sao Paulo, SP',
    concursoEspecial: false,
    dezenasOrdemSorteio: ['12', '07', '10', '08', '11', '09'],
    premiacoes: [
      { descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 },
      { descricao: 'Quina', faixa: 2, ganhadores: 42, valorPremio: 1234.56 }
    ],
    estadosPremiados: ['SP', 'RJ'],
    localGanhadores: [{ cidade: 'Sao Paulo', uf: 'SP' }],
    acumulou: true,
    proximoConcurso: 3,
    dataProximoConcurso: '15/01/2000',
    valorArrecadado: 123456.78,
    valorAcumuladoConcurso_0_5: 10,
    valorAcumuladoConcursoEspecial: 20,
    valorAcumuladoProximoConcurso: 30,
    valorEstimadoProximoConcurso: 40
  }
];

describe('sync', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should fetch and store draws from external API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULTS)
    });

    await syncResults();

    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM draws').get() as any;
    expect(count.count).toBe(2);

    const row = db.prepare('SELECT * FROM draws WHERE concurso = 1').get() as any;
    expect(JSON.parse(row.dezenas)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('should report sync status', () => {
    const status = getSyncStatus();
    expect(status.totalDraws).toBe(2);
    expect(status.latestConcurso).toBe(2);
    expect(status.latestDraw).toMatchObject({
      concurso: 2,
      local: 'Sao Paulo, SP',
      dezenas: ['07', '08', '09', '10', '11', '12'],
      dezenasOrdemSorteio: ['12', '07', '10', '08', '11', '09'],
      acumulou: true,
      proximoConcurso: 3,
      valorEstimadoProximoConcurso: 40
    });
  });

  it('defaults to caixa, persists a chosen source, and reports it in status', () => {
    expect(getSyncSource()).toBe('caixa');
    setSyncSource('guidi');
    expect(getSyncSource()).toBe('guidi');
    expect(getSyncStatus().syncSource).toBe('guidi');
    setSyncSource('caixa');
  });

  it('rejects an unknown sync source', () => {
    expect(() => setSyncSource('bogus' as never)).toThrow(/Unknown sync source/);
  });

  it('should preserve official prize fields and zero values', () => {
    const row = getDb().prepare('SELECT * FROM draws WHERE concurso = 2').get() as any;

    expect(row.local).toBe('Sao Paulo, SP');
    expect(row.concurso_especial).toBe(0);
    expect(JSON.parse(row.dezenas_ordem_sorteio)).toEqual(['12', '07', '10', '08', '11', '09']);
    expect(JSON.parse(row.premiacoes)).toEqual([
      { descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 },
      { descricao: 'Quina', faixa: 2, ganhadores: 42, valorPremio: 1234.56 }
    ]);
    expect(JSON.parse(row.estados_premiados)).toEqual(['SP', 'RJ']);
    expect(JSON.parse(row.local_ganhadores)).toEqual([{ cidade: 'Sao Paulo', uf: 'SP' }]);
    expect(row.acumulou).toBe(1);
    expect(row.proximo_concurso).toBe(3);
    expect(row.data_proximo_concurso).toBe('15/01/2000');
    expect(row.valor_arrecadado).toBe(123456.78);
    expect(row.valor_acumulado_concurso_0_5).toBe(10);
    expect(row.valor_acumulado_concurso_especial).toBe(20);
    expect(row.valor_acumulado_proximo_concurso).toBe(30);
    expect(row.valor_estimado_proximo_concurso).toBe(40);
  });

  it('syncResults(caixa) persists caixa as the last sync source', async () => {
    setSyncSource('guidi');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULTS)
    });
    await syncResults('caixa');
    expect(getSyncSource()).toBe('caixa');
  });
});

describe('sync latest fallback', () => {
  const LATEST_DB_PATH = path.join(__dirname, '..', 'data', 'sync-latest-test.db');

  beforeAll(() => {
    if (fs.existsSync(LATEST_DB_PATH)) fs.unlinkSync(LATEST_DB_PATH);
    initDb(LATEST_DB_PATH);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(LATEST_DB_PATH)) fs.unlinkSync(LATEST_DB_PATH);
  });

  it('stores the draw from /latest when the full list lags behind', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            concurso: 3,
            data: '15/01/2000',
            dezenas: ['13', '14', '15', '16', '17', '18'],
            loteria: 'megasena'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_RESULTS) });
    });

    const result = await syncResults();

    expect(result.inserted).toBe(3);
    expect(result.total).toBe(3);
    const row = getDb().prepare('SELECT * FROM draws WHERE concurso = 3').get() as any;
    expect(JSON.parse(row.dezenas)).toEqual(['13', '14', '15', '16', '17', '18']);
  });

  it('completes the sync when /latest fails but the full list succeeds', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/latest')) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_RESULTS) });
    });

    await expect(syncResults()).resolves.toMatchObject({ total: 2 });
  });
});

describe('database compatibility', () => {
  afterAll(() => {
    closeDb();
    if (fs.existsSync(LEGACY_DB_PATH)) fs.unlinkSync(LEGACY_DB_PATH);
  });

  it('keeps legacy draw rows readable with null optional metadata', () => {
    if (fs.existsSync(LEGACY_DB_PATH)) fs.unlinkSync(LEGACY_DB_PATH);
    const legacy = new Database(LEGACY_DB_PATH);
    legacy.exec('CREATE TABLE draws (concurso INTEGER PRIMARY KEY, data TEXT NOT NULL, dezenas TEXT NOT NULL)');
    legacy.prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)')
      .run(99, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06']));
    legacy.close();

    initDb(LEGACY_DB_PATH);

    expect(getDb().prepare('SELECT local, acumulou, premiacoes FROM draws WHERE concurso = 99').get())
      .toEqual({ local: null, acumulou: null, premiacoes: null });
  });
});

describe('guidi sync', () => {
  const GUIDI_DB_PATH = path.join(__dirname, '..', 'data', 'sync-guidi-test.db');

  const ULTIMO = {
    numero: 4,
    dataApuracao: '22/01/2000',
    dataProximoConcurso: '29/01/2000',
    listaDezenas: ['19', '20', '21', '22', '23', '24'],
    localSorteio: 'Espaço da Sorte, São Paulo, SP',
    indicadorConcursoEspecial: 1,
    dezenasSorteadasOrdemSorteio: ['24', '19', '22', '20', '23', '21'],
    listaRateioPremio: [
      { descricaoFaixa: 'Sena', faixa: 1, numeroDeGanhadores: 0, valorPremio: 0 },
      { descricaoFaixa: 'Quina', faixa: 2, numeroDeGanhadores: 12, valorPremio: 3456.78 }
    ],
    listaMunicipioUFGanhadores: [{ ganhadores: 1, municipio: 'São Paulo', uf: 'SP' }],
    acumulado: false,
    numeroConcursoProximo: 5,
    valorArrecadado: 123456.78,
    valorAcumuladoConcurso_0_5: 10,
    valorAcumuladoConcursoEspecial: 20,
    valorAcumuladoProximoConcurso: 30,
    valorEstimadoProximoConcurso: 40
  };

  const GAP = {
    numero: 3,
    dataApuracao: '15/01/2000',
    listaDezenas: ['13', '14', '15', '16', '17', '18'],
    localSorteio: 'Caixa, Rio de Janeiro, RJ',
    acumulado: true,
    numeroConcursoProximo: 4
  };

  beforeAll(() => {
    if (fs.existsSync(GUIDI_DB_PATH)) fs.unlinkSync(GUIDI_DB_PATH);
    initDb(GUIDI_DB_PATH);
    // Seed one existing draw so the gap backfill only fetches #3 and #4.
    getDb().prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)')
      .run(2, '08/01/2000', JSON.stringify(['07', '08', '09', '10', '11', '12']));
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(GUIDI_DB_PATH)) fs.unlinkSync(GUIDI_DB_PATH);
  });

  it('incrementally appends from guidi, mapping fields correctly', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/ultimo')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ULTIMO) });
      }
      if (u.endsWith('/3')) return Promise.resolve({ ok: true, json: () => Promise.resolve(GAP) });
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    });

    const result = await syncResults('guidi');

    expect(result.inserted).toBe(2);
    expect(result.total).toBe(2);
    expect(getSyncSource()).toBe('guidi');

    const row3 = getDb().prepare('SELECT * FROM draws WHERE concurso = 3').get() as any;
    expect(JSON.parse(row3.dezenas)).toEqual(['13', '14', '15', '16', '17', '18']);
    expect(row3.acumulou).toBe(1);
    expect(row3.proximo_concurso).toBe(4);

    const row4 = getDb().prepare('SELECT * FROM draws WHERE concurso = 4').get() as any;
    expect(JSON.parse(row4.dezenas)).toEqual(['19', '20', '21', '22', '23', '24']);
    expect(JSON.parse(row4.dezenas_ordem_sorteio)).toEqual(['24', '19', '22', '20', '23', '21']);
    expect(row4.concurso_especial).toBe(1);
    expect(row4.local).toBe('Espaço da Sorte, São Paulo, SP');
    expect(row4.data_proximo_concurso).toBe('29/01/2000');
    expect(JSON.parse(row4.premiacoes)).toEqual([
      { descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 },
      { descricao: 'Quina', faixa: 2, ganhadores: 12, valorPremio: 3456.78 }
    ]);
    expect(JSON.parse(row4.estados_premiados)).toEqual(['SP']);
    expect(JSON.parse(row4.local_ganhadores)).toEqual([{ ganhadores: 1, municipio: 'São Paulo', uf: 'SP' }]);
    expect(row4.valor_estimado_proximo_concurso).toBe(40);
  });

  it('does not abort when a gap fetch 404s mid-sync', async () => {
    // Reset to the seeded baseline (draw 2 only) so this test is deterministic
    // regardless of the other test in this describe.
    getDb().prepare('DELETE FROM draws WHERE concurso > 2').run();

    const ultimoNumero5 = { ...ULTIMO, numero: 5 };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/ultimo')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ultimoNumero5) });
      }
      if (u.endsWith('/3')) return Promise.resolve({ ok: true, json: () => Promise.resolve(GAP) });
      // /4 and anything else: treat as a miss (the gap backfill must skip it).
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    });

    const result = await syncResults('guidi');

    expect(result.inserted).toBe(2);
    expect(result.total).toBe(2);
    expect(getSyncSource()).toBe('guidi');

    const concursos = (getDb().prepare('SELECT concurso FROM draws ORDER BY concurso').all() as any[])
      .map((r: any) => r.concurso);
    expect(concursos).toEqual([2, 3, 5]);
  });
});

describe('startup sync preserves persisted source', () => {
  // Regression guard for Finding #1: index.ts must boot with the persisted
  // source (syncResults(getSyncSource())) instead of the 'caixa' default, so
  // a restart never clobbers the user's source choice.
  const STARTUP_DB_PATH = path.join(__dirname, '..', 'data', 'sync-startup-test.db');

  const STARTUP_ULTIMO = {
    numero: 4,
    dataApuracao: '22/01/2000',
    dataProximoConcurso: '29/01/2000',
    listaDezenas: ['19', '20', '21', '22', '23', '24'],
    localSorteio: 'Espaço da Sorte, São Paulo, SP',
    acumulado: false,
    numeroConcursoProximo: 5
  };

  const STARTUP_GAP = {
    numero: 3,
    dataApuracao: '15/01/2000',
    listaDezenas: ['13', '14', '15', '16', '17', '18'],
    localSorteio: 'Caixa, Rio de Janeiro, RJ',
    acumulado: true,
    numeroConcursoProximo: 4
  };

  beforeAll(() => {
    if (fs.existsSync(STARTUP_DB_PATH)) fs.unlinkSync(STARTUP_DB_PATH);
    initDb(STARTUP_DB_PATH);
    // A user picked the guidi source in a previous run.
    setSyncSource('guidi');
    // Seed one existing entry so the gap backfill only fetches #3 and #4.
    getDb().prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)')
      .run(2, '08/01/2000', JSON.stringify(['07', '08', '09', '10', '11', '12']));
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(STARTUP_DB_PATH)) fs.unlinkSync(STARTUP_DB_PATH);
  });

  it('keeps the persisted source after the startup sync call', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/ultimo')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(STARTUP_ULTIMO) });
      }
      if (u.endsWith('/3')) return Promise.resolve({ ok: true, json: () => Promise.resolve(STARTUP_GAP) });
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    });

    // This is exactly what the fixed backend/src/index.ts does at startup.
    await syncResults(getSyncSource());

    expect(getSyncSource()).toBe('guidi');
    const count = (getDb().prepare('SELECT COUNT(*) as count FROM draws').get() as any).count;
    expect(count).toBe(3);
  });
});
