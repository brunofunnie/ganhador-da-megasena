import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { generateNumbers, GENERATOR_MODES } from './generators';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'generator-test.db');

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
    [5, '29/01/2000', JSON.stringify(['02', '05', '08', '11', '14', '17'])],
    [6, '05/02/2000', JSON.stringify(['03', '06', '09', '12', '15', '18'])],
    [7, '12/02/2000', JSON.stringify(['19', '20', '21', '22', '23', '24'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('generators', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should generate 6 random unique numbers between 01-60 (random mode)', () => {
    const result = generateNumbers({ mode: 'random', count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(6);
    for (const n of result[0]) {
      const num = parseInt(n);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(60);
    }
    const unique = new Set(result[0]);
    expect(unique.size).toBe(6);
  });

  it('should generate multiple games', () => {
    const result = generateNumbers({ mode: 'random', count: 5 });
    expect(result).toHaveLength(5);
  });

  it('should include fixed numbers and exclude specified numbers', () => {
    const result = generateNumbers({
      mode: 'random',
      count: 1,
      fixedNumbers: ['01', '02', '03'],
      excludeNumbers: ['58', '59', '60']
    });
    const game = result[0];
    expect(game).toContain('01');
    expect(game).toContain('02');
    expect(game).toContain('03');
    for (const n of game) {
      expect(['58', '59', '60']).not.toContain(n);
    }
  });

  it('should generate numbers in sorted order', () => {
    const result = generateNumbers({ mode: 'random', count: 1 });
    expect(result[0]).toEqual([...result[0]].sort((a, b) => parseInt(a) - parseInt(b)));
  });

  it('should generate hot numbers based on frequency', () => {
    const results = generateNumbers({ mode: 'hot', count: 3 });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should generate cold numbers based on last appearance', () => {
    const results = generateNumbers({ mode: 'cold', count: 3 });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should generate balanced numbers with even/odd mix', () => {
    const result = generateNumbers({ mode: 'balanced', count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(6);
    const evens = result[0].filter(n => parseInt(n) % 2 === 0);
    const odds = result[0].filter(n => parseInt(n) % 2 !== 0);
    expect(evens.length).toBe(3);
    expect(odds.length).toBe(3);
  });

  it('should generate genetic numbers mixing hot and cold', () => {
    const results = generateNumbers({ mode: 'genetic', count: 3 });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should generate sequence-based numbers (primes + fibonacci)', () => {
    const results = generateNumbers({ mode: 'sequences', count: 3 });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should generate fechamento (closing) combinations', () => {
    const results = generateNumbers({ mode: 'fechamento', count: 3 });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should generate dream numbers using seed numbers', () => {
    const results = generateNumbers({
      mode: 'dreams',
      count: 3,
      seedNumbers: ['07', '13', '21', '37']
    });
    expect(results).toHaveLength(3);
    for (const game of results) {
      expect(game).toHaveLength(6);
      for (const n of game) {
        const num = parseInt(n);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(60);
      }
    }
  });

  it('should limit count to maximum 10', () => {
    const result = generateNumbers({ mode: 'random', count: 50 });
    expect(result.length).toBe(10);
  });

  it('all modes should be defined', () => {
    expect(GENERATOR_MODES).toContain('random');
    expect(GENERATOR_MODES).toContain('hot');
    expect(GENERATOR_MODES).toContain('cold');
    expect(GENERATOR_MODES).toContain('balanced');
    expect(GENERATOR_MODES).toContain('genetic');
    expect(GENERATOR_MODES).toContain('sequences');
    expect(GENERATOR_MODES).toContain('fechamento');
    expect(GENERATOR_MODES).toContain('dreams');
    expect(GENERATOR_MODES).toContain('trend');
    expect(GENERATOR_MODES).toContain('statistical');
    expect(GENERATOR_MODES).toContain('monte-carlo');
    expect(GENERATOR_MODES).toContain('ensemble');
    expect(GENERATOR_MODES).toContain('markov');
  });

  it('every mode honors fixed/excluded numbers and produces valid tickets', () => {
    for (const mode of GENERATOR_MODES) {
      const games = generateNumbers({
        mode,
        count: 2,
        fixedNumbers: ['01'],
        excludeNumbers: ['60'],
        seedNumbers: ['07', '13'],
        seed: `invariant-${mode}`,
        iterations: 200,
        candidates: 80,
        poolSize: 8,
        guarantee: 4,
      });

      expect(games.length).toBeGreaterThan(0);
      for (const game of games) {
        expect(game).toHaveLength(6);
        expect(new Set(game).size).toBe(6);
        expect(game).toContain('01');
        expect(game).not.toContain('60');
        for (const numero of game) {
          const value = parseInt(numero, 10);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it('is reproducible when a seed is provided', () => {
    const first = generateNumbers({ mode: 'statistical', count: 5, seed: 'repro', candidates: 80 });
    const second = generateNumbers({ mode: 'statistical', count: 5, seed: 'repro', candidates: 80 });
    expect(first).toEqual(second);
  });

  it('rejects invalid numbers', () => {
    expect(() => generateNumbers({ mode: 'random', count: 1, fixedNumbers: ['61'] })).toThrow();
    expect(() =>
      generateNumbers({ mode: 'random', count: 1, fixedNumbers: ['01', '02', '03', '04', '05', '06', '07'] })
    ).toThrow();
  });

  it('keeps overlap between tickets under control', () => {
    const games = generateNumbers({ mode: 'hot', count: 10, seed: 'diversity', maxOverlap: 2 });
    expect(games).toHaveLength(10);
    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const overlap = games[i].filter((numero) => games[j].includes(numero)).length;
        expect(overlap).toBeLessThanOrEqual(2);
      }
    }
  });
});
