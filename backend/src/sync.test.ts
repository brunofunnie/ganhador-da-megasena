import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { syncResults, getSyncStatus } from './sync';
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
