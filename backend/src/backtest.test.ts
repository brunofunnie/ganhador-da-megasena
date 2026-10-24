import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { runBacktest } from './backtest';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'backtest-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  for (let i = 1; i <= 40; i++) {
    const dezenas = Array.from({ length: 6 }, (_, j) =>
      (((i * 13 + j * 7) % 60) + 1).toString().padStart(2, '0')
    );
    insert.run(i, '01/01/2000', JSON.stringify(Array.from(new Set(dezenas))));
  }
}

describe('backtest', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('runs a walk-forward backtest against a random baseline', () => {
    const result = runBacktest({
      mode: 'random',
      window: 15,
      gamesPerDraw: 3,
      seed: 'bt',
    });

    expect(result.targets).toBe(15);
    expect(result.gamesPerDraw).toBe(3);
    expect(result.strategy.tickets).toBe(45);
    expect(result.baseline.tickets).toBe(45);
    expect(result.strategy.meanHits).toBeGreaterThanOrEqual(0);
    expect(result.strategy.meanHits).toBeLessThanOrEqual(6);
    expect(result.delta.meanHitsCI95).toHaveLength(2);
    expect(result.delta.meanHitsCI95[0]).toBeLessThanOrEqual(result.delta.meanHitsCI95[1]);
    expect(typeof result.significant).toBe('boolean');
    expect(result.note.length).toBeGreaterThan(0);
  });

  it('runs for the statistical mode', () => {
    const result = runBacktest({
      mode: 'statistical',
      window: 10,
      gamesPerDraw: 2,
      candidates: 60,
      seed: 'bt-stat',
    });
    expect(result.strategy.tickets).toBe(20);
    expect(result.baseline.tickets).toBe(20);
  });

  it('throws when there is not enough history', () => {
    closeDb();
    initDb(':memory:');
    const db = getDb();
    db.prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)').run(
      1,
      '01/01/2000',
      JSON.stringify(['01', '02', '03', '04', '05', '06'])
    );
    expect(() => runBacktest({ mode: 'random', window: 10 })).toThrow(/Histórico insuficiente/);
  });
});
