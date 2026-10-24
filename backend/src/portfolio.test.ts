import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { getDataset } from './dataset';
import { createRng } from './rng';
import { generatePortfolio, normalizeVotes, sampleWeighted } from './portfolio';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'portfolio-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  for (let i = 1; i <= 60; i++) {
    const dezenas = Array.from({ length: 6 }, (_, j) =>
      (((i * 7 + j * 11) % 60) + 1).toString().padStart(2, '0')
    );
    insert.run(i, '01/01/2000', JSON.stringify(Array.from(new Set(dezenas))));
  }
}

describe('portfolio', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('samples without replacement', () => {
    const numbers = sampleWeighted(
      Array.from({ length: 60 }, (_, i) => String(i + 1).padStart(2, '0')),
      undefined,
      6,
      createRng('sample')
    );
    expect(new Set(numbers).size).toBe(6);
  });

  it('generates diverse tickets that respect fixed and excluded numbers', () => {
    const result = generatePortfolio({
      dataset: getDataset(),
      count: 8,
      rng: createRng('portfolio'),
      fixedNumbers: ['01'],
      excludeNumbers: ['60'],
      candidatesPerGame: 200,
      maxOverlap: 2,
    });

    expect(result.games).toHaveLength(8);
    for (const game of result.games) {
      expect(game).toHaveLength(6);
      expect(new Set(game).size).toBe(6);
      expect(game).toContain('01');
      expect(game).not.toContain('60');
    }

    for (let i = 0; i < result.games.length; i++) {
      for (let j = i + 1; j < result.games.length; j++) {
        const overlap = result.games[i].filter((numero) =>
          result.games[j].includes(numero)
        ).length;
        expect(overlap).toBeLessThanOrEqual(2);
      }
    }
  });

  it('is reproducible with the same seed', () => {
    const options = {
      dataset: getDataset(),
      count: 4,
      candidatesPerGame: 150,
    };
    const first = generatePortfolio({ ...options, rng: createRng('same') }).games;
    const second = generatePortfolio({ ...options, rng: createRng('same') }).games;
    expect(first).toEqual(second);
  });

  it('normalizes votes into positive multiplicative weights', () => {
    const weights = normalizeVotes(
      new Map([
        ['01', 1],
        ['02', 5],
      ]),
      2
    );
    expect(weights.get('01')).toBe(1);
    expect(weights.get('02')).toBe(3);
  });
});
