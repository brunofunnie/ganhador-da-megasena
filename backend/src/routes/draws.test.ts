import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { closeDb, getDb, initDb } from '../db';
import drawsRoutes from './draws';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'draws-routes-test.db');
let server: http.Server;
let baseUrl: string;
const app = express();

app.use('/api', drawsRoutes);

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function insertDraw(input: { concurso: number; data: string; dezenas: string[]; acumulou?: boolean | null }) {
  getDb().prepare(
    'INSERT INTO draws (concurso, data, dezenas, acumulou) VALUES (?, ?, ?, ?)'
  ).run(input.concurso, input.data, JSON.stringify(input.dezenas), input.acumulou === undefined || input.acumulou === null ? null : Number(input.acumulou));
}

async function request(pathname: string) {
  return fetch(`${baseUrl}${pathname}`);
}

describe('draw routes', () => {
  beforeEach(async () => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);
    insertDraw({ concurso: 100, data: '01/01/2024', dezenas: ['01', '02', '03', '04', '05', '06'], acumulou: false });
    insertDraw({ concurso: 101, data: '10/01/2024', dezenas: ['10', '20', '30', '40', '50', '60'], acumulou: true });

    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    closeDb();
    cleanup();
  });

  it('returns the default paginated draw list', async () => {
    const response = await request('/api/draws');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      items: [{ concurso: 101 }, { concurso: 100 }]
    });
  });

  it('forwards list filters to the draw domain service', async () => {
    const response = await request('/api/draws?page=1&limit=1&search=100&from=2024-01-01&to=2024-01-01&accumulated=false');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      items: [{ concurso: 100, acumulou: false }]
    });
  });

  it('returns a draw detail or the specified 404 response', async () => {
    const found = await request('/api/draws/100');
    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({ concurso: 100, dezenas: ['01', '02', '03', '04', '05', '06'] });

    const missing = await request('/api/draws/999');
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'Concurso não encontrado' });
  });

  it('returns draw analysis or the specified 404 response', async () => {
    const found = await request('/api/draws/100/analysis');
    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({ sum: 21, evenCount: 3, oddCount: 3 });

    const missing = await request('/api/draws/999/analysis');
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'Concurso não encontrado' });
  });

  it('rejects invalid contest identifiers and accumulated values', async () => {
    const invalidContest = await request('/api/draws/10x');
    expect(invalidContest.status).toBe(400);

    const invalidAccumulated = await request('/api/draws?accumulated=yes');
    expect(invalidAccumulated.status).toBe(400);
  });
});
