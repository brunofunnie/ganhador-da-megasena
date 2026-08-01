import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { closeDb, initDb } from '../db';
import { addGame, createWallet } from '../wallets';
import walletsRoutes from './wallets';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'wallets-routes-test.db');
let server: http.Server;
let baseUrl: string;
let seedWallet: { id: number; name: string };
const app = express();

app.use(express.json());
app.use('/api', walletsRoutes);

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

async function request(pathname: string, init?: RequestInit) {
  return fetch(`${baseUrl}${pathname}`, init);
}

describe('wallet routes', () => {
  beforeEach(async () => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);
    seedWallet = createWallet('Minha Carteira');

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

  it('returns the seeded wallets', async () => {
    const response = await request('/api/wallets');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      carteiras: [{ id: seedWallet.id, name: seedWallet.name, gameCount: 0 }]
    });
  });

  it('creates a wallet or rejects an empty name', async () => {
    const created = await request('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nova' })
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.id).toBeGreaterThan(0);
    expect(createdBody.name).toBe('Nova');

    const missing = await request('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: 'Nome é obrigatório' });
  });

  it('returns a wallet detail or the specified 400/404 responses', async () => {
    const found = await request(`/api/wallets/${seedWallet.id}`);
    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({ id: seedWallet.id, name: seedWallet.name, games: [] });

    const invalid = await request('/api/wallets/abc');
    expect(invalid.status).toBe(400);

    const missing = await request('/api/wallets/999');
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'Carteira não encontrada' });
  });

  it('adds a game to a wallet or rejects invalid games and missing wallets', async () => {
    const created = await request(`/api/wallets/${seedWallet.id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dezenas: ['01', '02', '03', '04', '05', '06'] })
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.dezenas).toEqual(['01', '02', '03', '04', '05', '06']);

    const invalid = await request(`/api/wallets/${seedWallet.id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dezenas: ['01', '02'] })
    });
    expect(invalid.status).toBe(400);

    const missing = await request('/api/wallets/999/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dezenas: ['01', '02', '03', '04', '05', '06'] })
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'Carteira não encontrada' });
  });

  it('rejects a duplicate game within the same wallet', async () => {
    await request(`/api/wallets/${seedWallet.id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dezenas: ['01', '02', '03', '04', '05', '06'] })
    });

    const duplicate = await request(`/api/wallets/${seedWallet.id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dezenas: ['01', '02', '03', '04', '05', '06'] })
    });
    expect(duplicate.status).toBe(400);
    await expect(duplicate.json()).resolves.toEqual({ error: 'Este jogo já existe na carteira' });
  });

  it('updates a wallet or rejects missing wallets and invalid statuses', async () => {
    const updated = await request(`/api/wallets/${seedWallet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'finalized' })
    });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({ status: 'finalized' });

    const missing = await request('/api/wallets/999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'finalized' })
    });
    expect(missing.status).toBe(404);

    const invalid = await request(`/api/wallets/${seedWallet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'foo' })
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: 'Status inválido' });
  });

  it('removes a game from a wallet or returns 404 for a missing wallet', async () => {
    const game = addGame(seedWallet.id, ['01', '02', '03', '04', '05', '06']);

    const removed = await request(`/api/wallets/${seedWallet.id}/games/${game.id}`, { method: 'DELETE' });
    expect(removed.status).toBe(204);

    const missing = await request('/api/wallets/999/games/1', { method: 'DELETE' });
    expect(missing.status).toBe(404);
  });

  it('deletes a wallet and cascades its games', async () => {
    addGame(seedWallet.id, ['01', '02', '03', '04', '05', '06']);

    const deleted = await request(`/api/wallets/${seedWallet.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);

    const missing = await request(`/api/wallets/${seedWallet.id}`);
    expect(missing.status).toBe(404);
  });
});
