import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { runMonteCarlo } from './monteCarlo';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'mc-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    [1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [2, '08/01/2000', JSON.stringify(['01', '02', '03', '07', '08', '09'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('monteCarlo', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should return top K games', () => {
    const result = runMonteCarlo({ iterations: 100, topK: 3 });
    expect(result.jogos).toHaveLength(3);
    for (const jogo of result.jogos) {
      expect(jogo).toHaveLength(6);
    }
  });

  it('should include stats', () => {
    const result = runMonteCarlo({ iterations: 100, topK: 1 });
    expect(result.stats).toHaveProperty('mediaAcertos');
    expect(result.stats).toHaveProperty('maxAcertos');
    expect(result.stats.mediaAcertos).toBeGreaterThanOrEqual(0);
  });

  it('should respect fixed and exclude numbers', () => {
    const result = runMonteCarlo({
      iterations: 50,
      topK: 1,
      fixedNumbers: ['01', '02'],
      excludeNumbers: ['58', '59', '60']
    });
    expect(result.jogos[0]).toContain('01');
    expect(result.jogos[0]).toContain('02');
    for (const n of result.jogos[0]) {
      expect(['58', '59', '60']).not.toContain(n);
    }
  });

});

describe('monteCarlo empty draws', () => {
  beforeAll(() => {
    closeDb();
    initDb(':memory:');
  });

  afterAll(() => {
    closeDb();
  });

  it('should handle empty draws gracefully', () => {
    const result = runMonteCarlo({ iterations: 10, topK: 1 });
    expect(result.jogos).toHaveLength(1);
    expect(result.jogos[0]).toHaveLength(6);
  });
});
