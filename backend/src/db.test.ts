import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, initDb, closeDb } from './db';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test.db');

function cleanup() {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
}

describe('db', () => {
  beforeAll(() => cleanup());
  afterAll(() => {
    closeDb();
    cleanup();
  });

  it('should create tables on initDb', () => {
    initDb(TEST_DB_PATH);
    const db = getDb();

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('draws');
    expect(tableNames).toContain('sync_meta');
  });

  it('should insert and query a draw', () => {
    const db = getDb();
    db.prepare(
      'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
    ).run(1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06']));

    const row = db.prepare('SELECT * FROM draws WHERE concurso = ?').get(1) as any;
    expect(row.concurso).toBe(1);
    expect(JSON.parse(row.dezenas)).toEqual(['01', '02', '03', '04', '05', '06']);
  });
});
