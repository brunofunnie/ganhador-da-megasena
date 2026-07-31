import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { buildMarkovMatrix, generateMarkovChain } from './markov';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'markov-test.db');

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

describe('markov', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should build a 60x60 matrix', () => {
    const matrix = buildMarkovMatrix();
    expect(matrix).toHaveLength(60);
    for (const row of matrix) {
      expect(row).toHaveLength(60);
    }
  });

  it('should have rows that sum to 1 (or 0 for empty rows)', () => {
    const matrix = buildMarkovMatrix();
    for (let i = 0; i < 60; i++) {
      const sum = matrix[i].reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThanOrEqual(0);
      expect(sum).toBeLessThanOrEqual(1.001);
    }
  });

  it('should generate a chain of 6 unique numbers', () => {
    const matrix = buildMarkovMatrix();
    const chain = generateMarkovChain(matrix);
    expect(chain).toHaveLength(6);
    const unique = new Set(chain);
    expect(unique.size).toBe(6);
    for (const n of chain) {
      const num = parseInt(n);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(60);
    }
  });

  it('should generate different chains on subsequent calls', () => {
    const matrix = buildMarkovMatrix();
    const chain1 = generateMarkovChain(matrix);
    const chain2 = generateMarkovChain(matrix);
    expect(chain1.join(',')).not.toBe(chain2.join(','));
  });
});
