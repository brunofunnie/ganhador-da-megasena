import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import {
  getDataset,
  invalidateDataset,
  intersectCount,
  maskOf,
  popcount32,
  sliceDataset,
} from './dataset';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'dataset-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  insert.run(1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06']));
  insert.run(2, '08/01/2000', JSON.stringify(['01', '31', '32', '33', '59', '60']));
}

describe('dataset', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('counts bits in signed 32-bit integers', () => {
    expect(popcount32(0)).toBe(0);
    expect(popcount32(1)).toBe(1);
    expect(popcount32(0b1011)).toBe(3);
    expect(popcount32(-1)).toBe(32);
  });

  it('maps 01-32 to lo and 33-60 to hi', () => {
    const low = maskOf(['01', '32']);
    expect(low.lo).toBe((1 << 0) | (1 << 31));
    expect(low.hi).toBe(0);

    const high = maskOf(['33', '60']);
    expect(high.lo).toBe(0);
    expect(high.hi).toBe(1 | (1 << 27));
  });

  it('counts intersections with masks', () => {
    const a = maskOf(['01', '02', '33', '60']);
    const b = maskOf(['02', '33', '59']);
    expect(intersectCount(a, b)).toBe(2);
  });

  it('loads draws in ascending order', () => {
    const dataset = getDataset();
    expect(dataset.draws.map((draw) => draw.concurso)).toEqual([1, 2]);
    expect(dataset.draws[0].numbers).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('slices without touching the original dataset', () => {
    const dataset = getDataset();
    const windowed = sliceDataset(dataset, 1);
    expect(windowed.draws).toHaveLength(1);
    expect(dataset.draws).toHaveLength(2);
  });

  it('picks up new draws through the fingerprint', () => {
    const db = getDb();
    db.prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)').run(
      3,
      '15/01/2000',
      JSON.stringify(['10', '11', '12', '13', '14', '15'])
    );
    expect(getDataset().draws).toHaveLength(3);
  });

  it('invalidateDataset clears the cache', () => {
    invalidateDataset();
    expect(getDataset().draws).toHaveLength(3);
  });
});
