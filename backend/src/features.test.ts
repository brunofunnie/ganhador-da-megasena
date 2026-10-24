import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { buildFeatureModel, extractFeatures, plausibility, popularityPenalty } from './features';
import { getDataset } from './dataset';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'features-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    ['01', '02', '03', '04', '05', '06'],
    ['01', '02', '03', '07', '08', '09'],
    ['10', '11', '12', '13', '14', '15'],
    ['01', '04', '07', '10', '13', '16'],
    ['02', '05', '08', '11', '14', '17'],
    ['03', '06', '09', '12', '15', '18'],
    ['19', '20', '21', '22', '23', '24'],
  ];
  draws.forEach((dezenas, index) => {
    insert.run(index + 1, '01/01/2000', JSON.stringify(dezenas));
  });
}

describe('features', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('extracts the structural features of a ticket', () => {
    const features = extractFeatures(['01', '02', '03', '04', '05', '06']);
    expect(features.sum).toBe(21);
    expect(features.evens).toBe(3);
    expect(features.quadrants).toEqual([6, 0, 0, 0]);
    expect(features.quadrantsUsed).toBe(1);
    expect(features.consecutivePairs).toBe(5);
    expect(features.maxRun).toBe(6);
    expect(features.primes).toBe(3); // 2, 3, 5
    expect(features.low).toBe(6);
    expect(features.maxSameLastDigit).toBe(1);
    expect(features.arithmetic).toBe(true);
    expect(features.allUnder32).toBe(true);
  });

  it('counts repeats against the previous draw', () => {
    const features = extractFeatures(['01', '02', '30', '40', '50', '60'], new Set([1, 2, 3]));
    expect(features.repeatsPrev).toBe(2);
  });

  it('builds empirical distributions that sum to 1', () => {
    const model = buildFeatureModel(getDataset());
    expect(model.targets).toHaveLength(7);
    expect(model.sum.mean).toBeGreaterThan(0);
    for (const distribution of [model.evens, model.quadrantsUsed, model.primes, model.low]) {
      const sum = distribution.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
    expect(model.repeatsPrev.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('penalizes popular/pathological tickets', () => {
    const model = buildFeatureModel(getDataset());
    const normal = extractFeatures(['04', '11', '19', '27', '38', '52']);
    const pathological = extractFeatures(['01', '02', '03', '04', '05', '06']);

    expect(Number.isFinite(plausibility(normal, model))).toBe(true);
    expect(popularityPenalty(pathological)).toBeLessThan(popularityPenalty(normal));
    expect(popularityPenalty(normal)).toBe(0);
  });
});
