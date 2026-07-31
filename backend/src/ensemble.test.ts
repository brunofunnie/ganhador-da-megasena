import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { runEnsemble } from './ensemble';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'ensemble-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  for (let i = 1; i <= 10; i++) {
    const nums = Array.from({ length: 6 }, (_, j) =>
      ((i * 6 + j) % 60 + 1).toString().padStart(2, '0')
    );
    insert.run(i, `0${i}/01/2000`, JSON.stringify(nums));
  }
}

describe('ensemble', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should return games based on voted strategies', () => {
    const result = runEnsemble({ strategyIds: ['top6', 'cold6'], count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(6);
  });

  it('should return multiple games when count > 1', () => {
    const result = runEnsemble({ strategyIds: ['top6', 'cold6', 'balanced-3p3i'], count: 3 });
    expect(result).toHaveLength(3);
    for (const jogo of result) {
      expect(jogo).toHaveLength(6);
    }
  });

  it('should throw for empty strategy list', () => {
    expect(() => runEnsemble({ strategyIds: [], count: 1 })).toThrow();
  });

  it('should throw for unknown strategy', () => {
    expect(() => runEnsemble({ strategyIds: ['nonexistent'], count: 1 })).toThrow();
  });
});
