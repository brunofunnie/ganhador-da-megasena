import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { closeDb, getDb, initDb } from '../db';
import statisticsRoutes from './statistics';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'statistics-routes-test.db');
let server: http.Server;
let baseUrl: string;
const app = express();

app.use('/api', statisticsRoutes);

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function insertDraw(concurso: number, dezenas: string[]) {
  getDb().prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)').run(concurso, '01/01/2000', JSON.stringify(dezenas));
}

async function request(pathname: string) {
  return fetch(`${baseUrl}${pathname}`);
}

describe('statistics routes', () => {
  beforeEach(async () => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);
    insertDraw(1, ['01', '02', '03', '04', '05', '06']);
    insertDraw(2, ['01', '02', '03', '07', '08', '09']);
    insertDraw(3, ['10', '11', '12', '13', '14', '15']);

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

  it('returns gap intervals with a default window of 50', async () => {
    const response = await request('/api/statistics/intervals');
    expect(response.status).toBe(200);
    const body = await response.json() as { totalConcursos: number; numeros: Array<{ numero: string; intervalos: number[]; gapAtual: number }> };
    expect(body.totalConcursos).toBe(3);
    expect(body.numeros).toHaveLength(60);
    const num01 = body.numeros.find(n => n.numero === '01');
    expect(num01?.intervalos).toEqual([1]);
    expect(num01?.gapAtual).toBe(1);
  });

  it('respects the window query parameter', async () => {
    const response = await request('/api/statistics/intervals?window=1');
    expect(response.status).toBe(200);
    const body = await response.json() as { totalConcursos: number };
    expect(body.totalConcursos).toBe(1);
  });

  it('falls back to the default window for invalid values', async () => {
    const negative = await request('/api/statistics/intervals?window=-5');
    expect(negative.status).toBe(200);
    const negativeBody = await negative.json() as { totalConcursos: number };
    expect(negativeBody.totalConcursos).toBe(3);

    const nonNumeric = await request('/api/statistics/intervals?window=abc');
    expect(nonNumeric.status).toBe(200);
    const nonNumericBody = await nonNumeric.json() as { totalConcursos: number };
    expect(nonNumericBody.totalConcursos).toBe(3);
  });
});
