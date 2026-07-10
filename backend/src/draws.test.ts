import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { closeDb, getDb, initDb } from './db';
import { analyzeDraw, getDraw, listDraws } from './draws';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'draws-test.db');

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function insertDraw(input: {
  concurso: number;
  data: string;
  dezenas: string[];
  acumulou?: boolean | null;
  premiacoes?: unknown[] | null;
  valorArrecadado?: number | null;
}) {
  getDb().prepare(
    `INSERT INTO draws (concurso, data, dezenas, acumulou, premiacoes, valor_arrecadado)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.concurso,
    input.data,
    JSON.stringify(input.dezenas),
    input.acumulou === undefined || input.acumulou === null ? null : Number(input.acumulou),
    input.premiacoes === undefined || input.premiacoes === null ? null : JSON.stringify(input.premiacoes),
    input.valorArrecadado ?? null
  );
}

describe('draw domain services', () => {
  beforeEach(() => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);

    insertDraw({
      concurso: 100,
      data: '01/01/2024',
      dezenas: ['01', '02', '03', '04', '05', '06'],
      acumulou: false,
      premiacoes: [{ descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 }],
      valorArrecadado: 0
    });
    insertDraw({
      concurso: 101,
      data: '10/01/2024',
      dezenas: ['10', '20', '30', '40', '50', '60'],
      acumulou: true
    });
    insertDraw({
      concurso: 102,
      data: '20/01/2024',
      dezenas: ['21', '22', '23', '24', '25', '26'],
      acumulou: true
    });
    insertDraw({
      concurso: 103,
      data: '30/01/2024',
      dezenas: ['01', '02'],
      acumulou: false
    });
  });

  afterEach(() => {
    closeDb();
    cleanup();
  });

  it('paginates summaries in descending contest order with bounded page input', () => {
    const result = listDraws({ page: 0, limit: 2 });

    expect(result).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(result.items.map(draw => draw.concurso)).toEqual([103, 102]);
    expect(result.items[0]).not.toHaveProperty('premiacoes');
    expect(listDraws({ page: -3, limit: 500 })).toMatchObject({ page: 1, limit: 100 });
  });

  it('filters summaries by exact or partial contest search, inclusive date range, and accumulated status', () => {
    expect(listDraws({ page: 1, limit: 20, search: '101' }).items.map(draw => draw.concurso)).toEqual([101]);
    expect(listDraws({ page: 1, limit: 20, search: '10' }).items.map(draw => draw.concurso)).toEqual([103, 102, 101, 100]);
    expect(listDraws({ page: 1, limit: 20, from: '10/01/2024', to: '20/01/2024' }).items.map(draw => draw.concurso)).toEqual([102, 101]);
    expect(listDraws({ page: 1, limit: 20, accumulated: true }).items.map(draw => draw.concurso)).toEqual([102, 101]);
  });

  it('hydrates a complete draw and preserves zero values', () => {
    expect(getDraw(100)).toMatchObject({
      concurso: 100,
      dezenas: ['01', '02', '03', '04', '05', '06'],
      acumulou: false,
      premiacoes: [{ descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 }],
      valorArrecadado: 0
    });
  });

  it('returns null for a contest that does not exist', () => {
    expect(getDraw(999)).toBeNull();
    expect(analyzeDraw(999)).toBeNull();
  });

  it('calculates draw metrics and historical averages from all valid six-number draws', () => {
    expect(analyzeDraw(100)).toEqual({
      sum: 21,
      evenCount: 3,
      oddCount: 3,
      rangeDistribution: { first: 6, second: 0, third: 0 },
      historicalComparison: {
        averageSum: 124,
        averageEvenCount: 4,
        averageRangeDistribution: { first: 8 / 3, second: 8 / 3, third: 2 / 3 }
      }
    });
  });
});
