import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { executeStrategy, getStrategies } from './strategies';
import { createRng } from './rng';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'strategies-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  for (let i = 1; i <= 5; i++) {
    const nums = Array.from({ length: 6 }, (_, j) =>
      ((i * 6 + j) % 60 + 1).toString().padStart(2, '0')
    );
    insert.run(i, `0${i}/01/2000`, JSON.stringify(nums));
  }
}

describe('strategies', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should list all strategies', () => {
    const strategies = getStrategies();
    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies[0]).toHaveProperty('id');
    expect(strategies[0]).toHaveProperty('nome');
    expect(strategies[0]).toHaveProperty('descricao');
  });

  it('should execute top6 strategy', () => {
    const result = executeStrategy('top6');
    expect(result.jogos).toHaveLength(1);
    expect(result.jogos[0]).toHaveLength(6);
    expect(result.jogos[0]).toEqual(result.jogos[0].slice().sort());
  });

  it('should execute full-cycle strategy', () => {
    const result = executeStrategy('full-cycle');
    expect(result.jogos.length).toBeGreaterThan(1);
    for (const jogo of result.jogos) {
      expect(jogo).toHaveLength(6);
    }
  });

  it('should throw for unknown strategy', () => {
    expect(() => executeStrategy('nonexistent')).toThrow();
  });

  it('every strategy returns six unique numbers in range', () => {
    for (const { id } of getStrategies()) {
      const result = executeStrategy(id, { rng: createRng(`strategy-${id}`) });
      expect(result.jogos.length).toBeGreaterThan(0);
      for (const jogo of result.jogos) {
        expect(jogo).toHaveLength(6);
        expect(new Set(jogo).size).toBe(6);
        for (const numero of jogo) {
          const value = parseInt(numero, 10);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it('sum-target stays inside the historical interquartile range', () => {
    const result = executeStrategy('sum-target');
    const sum = result.jogos[0].reduce((acc, numero) => acc + parseInt(numero, 10), 0);
    expect(sum).toBeGreaterThanOrEqual(100);
    expect(sum).toBeLessThanOrEqual(250);
  });
});
