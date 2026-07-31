import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { getTemporalTrend } from './temporalTrend';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'trend-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    [1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [2, '08/01/2000', JSON.stringify(['01', '02', '03', '07', '08', '09'])],
    [3, '15/01/2000', JSON.stringify(['10', '11', '12', '13', '14', '15'])],
    [4, '22/01/2000', JSON.stringify(['01', '04', '07', '10', '13', '16'])],
    [5, '29/01/2000', JSON.stringify(['01', '05', '08', '11', '14', '17'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('temporalTrend', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should return scores for all 60 numbers', () => {
    const scores = getTemporalTrend(3);
    expect(scores.size).toBe(60);
  });

  it('should return higher scores for numbers appearing in recent window', () => {
    const scores = getTemporalTrend(2);
    const score01 = scores.get('01') || 0;
    const score60 = scores.get('60') || 0;
    expect(score01).toBeGreaterThan(score60);
  });

  it('should use default window of 50 when not specified', () => {
    const scores = getTemporalTrend();
    expect(scores.size).toBe(60);
  });

  it('should return negative scores for numbers drawn only in distant past', () => {
    const scores = getTemporalTrend(3);
    const score09 = scores.get('09') || 0;
    expect(score09).toBeLessThan(0);
  });
});
