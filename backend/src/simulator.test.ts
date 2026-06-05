import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { runSimulation } from './simulator';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'simulator-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    [1, '01/01/2020', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [2, '08/01/2020', JSON.stringify(['01', '02', '03', '07', '08', '09'])],
    [3, '15/01/2020', JSON.stringify(['10', '11', '12', '13', '14', '15'])],
    [4, '22/01/2020', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [5, '29/01/2020', JSON.stringify(['01', '02', '03', '04', '05', '07'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('simulator', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should simulate against historical draws', () => {
    const result = runSimulation({
      games: [['01', '02', '03', '04', '05', '06']],
      mode: 'historical'
    });

    expect(result.totalConcursos).toBe(5);
    expect(result.jogos).toHaveLength(1);
    expect(result.jogos[0].acertos).toHaveProperty('6');
    expect(result.jogos[0].acertos).toHaveProperty('5');
    expect(result.jogos[0].acertos).toHaveProperty('4');
    expect(result.jogos[0].acertos['6']).toBe(2);
  });

  it('should simulate multiple games', () => {
    const result = runSimulation({
      games: [
        ['01', '02', '03', '04', '05', '06'],
        ['10', '11', '12', '13', '14', '15'],
      ],
      mode: 'historical'
    });

    expect(result.jogos).toHaveLength(2);
    expect(result.jogos[0].acertos['6']).toBe(2);
    expect(result.jogos[1].acertos['6']).toBe(1);
  });

  it('should simulate against random draws', () => {
    const result = runSimulation({
      games: [['01', '02', '03', '04', '05', '06']],
      mode: 'random',
      randomCount: 100
    });

    expect(result.totalConcursos).toBe(100);
    const totalMatches = Object.values(result.jogos[0].acertos).reduce((a, b) => a + b, 0);
    expect(totalMatches).toBe(100);
  });

  it('should calculate percentages', () => {
    const result = runSimulation({
      games: [['01', '02', '03', '04', '05', '06']],
      mode: 'historical'
    });

    expect(result.jogos[0].porcentagens['6']).toBeCloseTo(40, 1);
  });
});
