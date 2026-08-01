import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { computeGapIntervals, computeStatistics } from './statistics';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'stats-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    [1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [2, '08/01/2000', JSON.stringify(['01', '02', '03', '07', '08', '09'])],
    [3, '15/01/2000', JSON.stringify(['10', '11', '12', '13', '14', '15'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('statistics', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should compute frequency for all numbers', () => {
    const stats = computeStatistics();
    expect(stats.frequency).toHaveLength(60);

    const freq01 = stats.frequency.find(f => f.numero === '01');
    expect(freq01?.frequencia).toBe(2);
    expect(freq01?.porcentagem).toBeCloseTo(66.67, 1);

    const freq10 = stats.frequency.find(f => f.numero === '10');
    expect(freq10?.frequencia).toBe(1);
  });

  it('should compute cold numbers (draws since last appearance)', () => {
    const stats = computeStatistics();
    expect(stats.coldNumbers).toHaveLength(60);

    const num10 = stats.coldNumbers.find(c => c.numero === '10');
    expect(num10?.concursosAtrasado).toBe(0);

    const num01 = stats.coldNumbers.find(c => c.numero === '01');
    expect(num01?.concursosAtrasado).toBe(1);
  });

  it('should compute parity distribution', () => {
    const stats = computeStatistics();
    expect(stats.parity).toBeDefined();
    const { evenOddDistribution } = stats.parity;
    const total = Object.values(evenOddDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
  });

  it('should compute gap intervals per number within the last N draws', () => {
    const intervals = computeGapIntervals(3);

    expect(intervals.totalConcursos).toBe(3);
    expect(intervals.numeros).toHaveLength(60);

    // 01 appears in draws 1 and 2 → historical gap of 1; last seen in draw 2, latest is 3 → current gap 1
    const num01 = intervals.numeros.find(n => n.numero === '01');
    expect(num01?.intervalos).toEqual([1]);
    expect(num01?.gapAtual).toBe(1);

    // 10 appears only in draw 3 → no historical gap, current gap 0
    const num10 = intervals.numeros.find(n => n.numero === '10');
    expect(num10?.intervalos).toEqual([]);
    expect(num10?.gapAtual).toBe(0);
  });

  it('should limit the interval sequence to the last N draws but keep the current gap from all history', () => {
    // Window of 1: only draw 3 counts for the sequence. 01 is absent from draw 3,
    // so its sequence is empty, but it last appeared in draw 2 → current gap 1.
    const intervals = computeGapIntervals(1);
    expect(intervals.totalConcursos).toBe(1);
    const num01 = intervals.numeros.find(n => n.numero === '01');
    expect(num01?.intervalos).toEqual([]);
    expect(num01?.gapAtual).toBe(1);

    // 10 appears in draw 3 → current gap 0
    const num10 = intervals.numeros.find(n => n.numero === '10');
    expect(num10?.intervalos).toEqual([]);
    expect(num10?.gapAtual).toBe(0);
  });
});
