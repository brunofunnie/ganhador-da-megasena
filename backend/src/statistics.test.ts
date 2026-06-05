import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { computeStatistics } from './statistics';
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
});
