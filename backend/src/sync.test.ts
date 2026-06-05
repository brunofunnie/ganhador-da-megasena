import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { syncResults, getSyncStatus } from './sync';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'sync-test.db');

const MOCK_RESULTS = [
  {
    concurso: 1,
    data: '01/01/2000',
    dezenas: ['01', '02', '03', '04', '05', '06'],
    loteria: 'megasena'
  },
  {
    concurso: 2,
    data: '08/01/2000',
    dezenas: ['07', '08', '09', '10', '11', '12'],
    loteria: 'megasena'
  }
];

describe('sync', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should fetch and store draws from external API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULTS)
    });

    await syncResults();

    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM draws').get() as any;
    expect(count.count).toBe(2);

    const row = db.prepare('SELECT * FROM draws WHERE concurso = 1').get() as any;
    expect(JSON.parse(row.dezenas)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('should report sync status', () => {
    const status = getSyncStatus();
    expect(status.totalDraws).toBe(2);
    expect(status.latestConcurso).toBe(2);
  });
});
