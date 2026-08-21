import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { closeDb, getDb, initDb } from '../db';
import statusRoutes from './status';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'status-routes-test.db');
let server: http.Server;
let baseUrl: string;
const app = express();

app.use(express.json());
app.use('/api', statusRoutes);

// Capture the real fetch before any test swaps global.fetch, so that the
// request() helper always talks to the in-process HTTP server instead of the
// mock that `runs the sync with the requested source` installs for the route's
// internal external-API call.
const realFetch = global.fetch;

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

async function request(pathname: string, init?: RequestInit) {
  return realFetch(`${baseUrl}${pathname}`, init);
}

describe('status routes', () => {
  beforeEach(async () => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);

    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    global.fetch = realFetch;
    closeDb();
    cleanup();
  });

  it('reports syncSource in status (defaults to caixa)', async () => {
    const response = await request('/api/status');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.syncSource).toBe('caixa');
  });

  it('persists the chosen source via PUT /sync-source without syncing', async () => {
    const response = await request('/api/sync-source', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'guidi' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.syncSource).toBe('guidi');

    const status = await (await request('/api/status')).json();
    expect(status.syncSource).toBe('guidi');
  });

  it('rejects an invalid source on PUT /sync-source', async () => {
    const response = await request('/api/sync-source', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'bogus' }),
    });
    expect(response.status).toBe(400);
  });

  it('runs the sync with the requested source', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ concurso: 1, data: '01/01/2000', dezenas: ['01', '02', '03', '04', '05', '06'], loteria: 'megasena' }]),
    });

    const response = await request('/api/sync?source=caixa', { method: 'POST' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('caixa');
    expect(body.inserted).toBe(1);
    expect((getDb().prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }).count).toBe(1);
  });

  it('rejects an invalid source on POST /sync', async () => {
    const response = await request('/api/sync?source=bogus', { method: 'POST' });
    expect(response.status).toBe(400);
  });
});