# Secondary Sync Source (guidi loteria_api) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the guidi loteria_api as a second Mega-Sena data source and let the user pick which source the sync button uses, with the choice persisted in the backend.

**Architecture:** The backend already fetches the whole history in one request from the Caixa heroku API. The guidi API (`api.guidi.dev.br/loteria`) serves only one draw per request, so the guidi path does an *incremental append*: fetch `ultimo`, then backfill the gap above our newest draw best-effort. Both sources normalize into the existing `StoredDraw` shape and share one `persistDraws` transaction. The active source is stored in `sync_meta` (`last_sync_source`) and returned by `GET /status`. The frontend exposes a source dropdown in the sync status bar.

**Tech Stack:** Node + Express 5 + TypeScript backend (`backend/`), React 19 + TanStack Query + Tailwind frontend (`frontend/`), Vitest tests, better-sqlite3.

## Global Constraints

- `type SyncSource = 'caixa' | 'guidi'`; `SYNC_SOURCES: SyncSource[] = ['caixa', 'guidi']`; default `'caixa'`.
- guidi base URL from `process.env.LOTERIA_GUIDI_BASE_URL || 'https://api.guidi.dev.br/loteria'`.
- guidi sync is incremental append only — never a full rebuild unless the DB is empty.
- Persist the chosen source in `sync_meta` key `last_sync_source` (via `setSyncSource`).
- Both sources normalize to `StoredDraw` (defined in `backend/src/sync.ts`) and write via the shared `persistDraws`.
- Date format is `dd/MM/yyyy` for both sources — no conversion needed.
- Run backend tests from `backend/` with `npm test` (vitest). Verify frontend types with `cd frontend && npm run build`.
- Frontend copy uses Portuguese labels: "Caixa API" and "Guidi API".

---

### Task 1: SyncSource type + getSyncSource/setSyncSource + status.syncSource

**Files:**
- Modify: `backend/src/sync.ts`
- Test: `backend/src/sync.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `./db` (already imported).
- Produces:
  - `type SyncSource = 'caixa' | 'guidi'`
  - `const SYNC_SOURCES: SyncSource[]`
  - `function getSyncSource(): SyncSource`
  - `function setSyncSource(source: SyncSource): void` (throws on unknown source)
  - `getSyncStatus()` returns an extra `syncSource: SyncSource` field.

- [ ] **Step 1: Write the failing test**

Append this describe block to `backend/src/sync.test.ts` (inside the existing `'sync'` describe, after the "should report sync status" test, so it reuses the `TEST_DB_PATH` DB):

```ts
  it('defaults to caixa, persists a chosen source, and reports it in status', () => {
    expect(getSyncSource()).toBe('caixa');
    setSyncSource('guidi');
    expect(getSyncSource()).toBe('guidi');
    expect(getSyncStatus().syncSource).toBe('guidi');
    setSyncSource('caixa');
  });

  it('rejects an unknown sync source', () => {
    expect(() => setSyncSource('bogus' as never)).toThrow(/Unknown sync source/);
  });
```

Update the import line at the top of `backend/src/sync.test.ts` from:

```ts
import { syncResults, getSyncStatus } from './sync';
```

to:

```ts
import { syncResults, getSyncStatus, getSyncSource, setSyncSource } from './sync';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/sync.test.ts -t "defaults to caixa" --passWithNoTests`
Expected: FAIL — `getSyncSource` is not exported / `setSyncSource` is not defined.

- [ ] **Step 3: Implement in `backend/src/sync.ts`**

Add the type/constant and helpers after the existing `const LOTERIA = 'megasena';` line (near line 4):

```ts
export type SyncSource = 'caixa' | 'guidi';
export const SYNC_SOURCES: SyncSource[] = ['caixa', 'guidi'];
```

Add these functions near the bottom of the file, after `getSyncStatus`:

```ts
export function getSyncSource(): SyncSource {
  const db = getDb();
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync_source'").get() as { value: string } | undefined;
  return row && SYNC_SOURCES.includes(row.value as SyncSource) ? (row.value as SyncSource) : 'caixa';
}

export function setSyncSource(source: SyncSource): void {
  if (!SYNC_SOURCES.includes(source)) {
    throw new Error(`Unknown sync source: ${source}`);
  }
  getDb().prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run('last_sync_source', source);
}
```

Add `syncSource` to the object returned by `getSyncStatus()` (currently at the bottom, lines ~153–178). Add this as the last property:

```ts
    syncSource: getSyncSource()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/sync.test.ts -t "defaults to caixa"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sync.ts backend/src/sync.test.ts
git commit -m "feat(backend): add sync source selection (caixa/guidi)"
```

---

### Task 2: Refactor into persistDraws + caixaSync + syncResults(source)

**Files:**
- Modify: `backend/src/sync.ts`
- Test: `backend/src/sync.test.ts`

**Interfaces:**
- Consumes: `normalizeDraw(result: ApiResultado): StoredDraw` (already present).
- Produces:
  - `function persistDraws(draws: StoredDraw[]): { inserted: number; total: number }`
  - `async function caixaSync(): Promise<{ inserted: number; total: number }>` (the existing full-list + `/latest` logic)
  - `async function syncResults(source: SyncSource = 'caixa'): Promise<{ inserted: number; total: number }>`
  - `syncResults` persists `last_sync_source` via `setSyncSource(source)` after a successful sync.

- [ ] **Step 1: Write the failing test**

Append to the `'sync'` describe in `backend/src/sync.test.ts`:

```ts
  it('syncResults(caixa) persists caixa as the last sync source', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULTS)
    });
    await syncResults('caixa');
    expect(getSyncSource()).toBe('caixa');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/sync.test.ts -t "persists caixa"`
Expected: FAIL — `syncResults` does not yet accept a `source` argument (TypeScript error or test throws).

- [ ] **Step 3: Implement in `backend/src/sync.ts`**

Replace the current `syncResults` function body (lines 86–145) with these three functions:

```ts
function persistDraws(draws: StoredDraw[]): { inserted: number; total: number } {
  const db = getDb();

  const insert = db.prepare(
    `INSERT OR REPLACE INTO draws (
      concurso, data, dezenas, local, concurso_especial, dezenas_ordem_sorteio,
      premiacoes, estados_premiados, local_ganhadores, acumulou, proximo_concurso,
      data_proximo_concurso, valor_arrecadado, valor_acumulado_concurso_0_5,
      valor_acumulado_concurso_especial, valor_acumulado_proximo_concurso,
      valor_estimado_proximo_concurso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    let inserted = 0;
    for (const draw of draws) {
      const existing = db.prepare('SELECT concurso FROM draws WHERE concurso = ?').get(draw.concurso);
      if (!existing) inserted++;
      insert.run(
        draw.concurso, draw.data, draw.dezenas, draw.local, draw.concursoEspecial,
        draw.dezenasOrdemSorteio, draw.premiacoes, draw.estadosPremiados,
        draw.localGanhadores, draw.acumulou, draw.proximoConcurso,
        draw.dataProximoConcurso, draw.valorArrecadado,
        draw.valorAcumuladoConcurso_0_5, draw.valorAcumuladoConcursoEspecial,
        draw.valorAcumuladoProximoConcurso, draw.valorEstimadoProximoConcurso
      );
    }
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('last_sync', new Date().toISOString());
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('total_draws', String(draws.length));
    return inserted;
  });

  const inserted = transaction();
  return { inserted, total: draws.length };
}

async function caixaSync(): Promise<{ inserted: number; total: number }> {
  const response = await fetch(`${API_BASE}/${LOTERIA}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const results: ApiResultado[] = [...await response.json()];

  // The aggregate endpoint can lag one draw behind /latest right after a
  // draw, so merge /latest in; it is best-effort and must not fail the sync.
  try {
    const latestResponse = await fetch(`${API_BASE}/${LOTERIA}/latest`);
    if (latestResponse.ok) {
      const latest: ApiResultado = await latestResponse.json();
      if (typeof latest?.concurso === 'number' && !results.some((r) => r.concurso === latest.concurso)) {
        results.push(latest);
      }
    }
  } catch {
    // ignore: the full list already fetched successfully
  }

  return persistDraws(results.map(normalizeDraw));
}

export async function syncResults(source: SyncSource = 'caixa'): Promise<{ inserted: number; total: number }> {
  if (!SYNC_SOURCES.includes(source)) {
    throw new Error(`Unknown sync source: ${source}`);
  }
  const result = source === 'guidi' ? await guidISync() : await caixaSync();
  setSyncSource(source);
  return result;
}
```

> **Note:** `syncResults` now references `guidISync`, which is not defined until Task 3. To keep this task green, add the following **temporary stub** for `guidISync` above `syncResults` and remove it in Task 3:

```ts
// TEMPORARY stub — replaced with the real implementation in the next task.
async function guidISync(): Promise<{ inserted: number; total: number }> {
  throw new Error('guidI sync not implemented yet');
}
```

- [ ] **Step 4: Run the full sync suite to verify existing behavior is preserved**

Run: `cd backend && npm test`
Expected: ALL PASS (including the existing sync tests that call `syncResults()` with no arg).

- [ ] **Step 5: Commit**

```bash
git add backend/src/sync.ts backend/src/sync.test.ts
git commit -m "refactor(backend): extract persistDraws and dispatch sync by source"
```

---

### Task 3: normalizeGuidiDraw + guidISync

**Files:**
- Modify: `backend/src/sync.ts`
- Test: `backend/src/sync.test.ts`

**Interfaces:**
- Consumes: `persistDraws(draws: StoredDraw[])`, `StoredDraw`, `asJson`, `SyncSource`, `SYNC_SOURCES`.
- Produces:
  - `interface GuidiResult { … }` (see code below)
  - `function normalizeGuidiDraw(dto: GuidiResult): StoredDraw`
  - `async function guidISync(): Promise<{ inserted: number; total: number }>` — replaces the temporary stub.

- [ ] **Step 1: Write the failing test**

Append a new top-level describe to `backend/src/sync.test.ts` with its own DB file:

```ts
describe('guidi sync', () => {
  const GUIDI_DB_PATH = path.join(__dirname, '..', 'data', 'sync-guidi-test.db');

  const ULTIMO = {
    numero: 4,
    dataApuracao: '22/01/2000',
    dataProximoConcurso: '29/01/2000',
    listaDezenas: ['19', '20', '21', '22', '23', '24'],
    localSorteio: 'Espaço da Sorte, São Paulo, SP',
    indicadorConcursoEspecial: 1,
    dezenasSorteadasOrdemSorteio: ['24', '19', '22', '20', '23', '21'],
    listaRateioPremio: [
      { descricaoFaixa: 'Sena', faixa: 1, numeroDeGanhadores: 0, valorPremio: 0 },
      { descricaoFaixa: 'Quina', faixa: 2, numeroDeGanhadores: 12, valorPremio: 3456.78 }
    ],
    listaMunicipioUFGanhadores: [{ ganhadores: 1, municipio: 'São Paulo', uf: 'SP' }],
    acumulado: false,
    numeroConcursoProximo: 5,
    valorArrecadado: 123456.78,
    valorAcumuladoConcurso_0_5: 10,
    valorAcumuladoConcursoEspecial: 20,
    valorAcumuladoProximoConcurso: 30,
    valorEstimadoProximoConcurso: 40
  };

  const GAP = {
    numero: 3,
    dataApuracao: '15/01/2000',
    listaDezenas: ['13', '14', '15', '16', '17', '18'],
    localSorteio: 'Caixa, Rio de Janeiro, RJ',
    acumulado: true,
    numeroConcursoProximo: 4
  };

  beforeAll(() => {
    if (fs.existsSync(GUIDI_DB_PATH)) fs.unlinkSync(GUIDI_DB_PATH);
    initDb(GUIDI_DB_PATH);
    // Seed one existing draw so the gap backfill only fetches #3 and #4.
    getDb().prepare('INSERT INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)')
      .run(2, '08/01/2000', JSON.stringify(['07', '08', '09', '10', '11', '12']));
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(GUIDI_DB_PATH)) fs.unlinkSync(GUIDI_DB_PATH);
  });

  it('incrementally appends from guidi, mapping fields correctly', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/ultimo')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ULTIMO) });
      }
      if (u.endsWith('/3')) return Promise.resolve({ ok: true, json: () => Promise.resolve(GAP) });
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
    });

    const result = await syncResults('guidi');

    expect(result.inserted).toBe(2);
    expect(result.total).toBe(2);
    expect(getSyncSource()).toBe('guidi');

    const row3 = getDb().prepare('SELECT * FROM draws WHERE concurso = 3').get() as any;
    expect(JSON.parse(row3.dezenas)).toEqual(['13', '14', '15', '16', '17', '18']);
    expect(row3.acumulou).toBe(1);
    expect(row3.proximo_concurso).toBe(4);

    const row4 = getDb().prepare('SELECT * FROM draws WHERE concurso = 4').get() as any;
    expect(JSON.parse(row4.dezenas)).toEqual(['19', '20', '21', '22', '23', '24']);
    expect(JSON.parse(row4.dezenas_ordem_sorteio)).toEqual(['24', '19', '22', '20', '23', '21']);
    expect(row4.concurso_especial).toBe(1);
    expect(row4.local).toBe('Espaço da Sorte, São Paulo, SP');
    expect(row4.data_proximo_concurso).toBe('29/01/2000');
    expect(JSON.parse(row4.premiacoes)).toEqual([
      { descricao: 'Sena', faixa: 1, ganhadores: 0, valorPremio: 0 },
      { descricao: 'Quina', faixa: 2, ganhadores: 12, valorPremio: 3456.78 }
    ]);
    expect(JSON.parse(row4.estados_premiados)).toEqual(['SP']);
    expect(JSON.parse(row4.local_ganhadores)).toEqual([{ ganhadores: 1, municipio: 'São Paulo', uf: 'SP' }]);
    expect(row4.valor_estimado_proximo_concurso).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/sync.test.ts -t "incrementally appends from guidi"`
Expected: FAIL — the `guidISync` temporary stub throws "guidI sync not implemented yet".

- [ ] **Step 3: Implement in `backend/src/sync.ts`**

Add the guidi DTO interface just above `function normalizeDraw` (after the `asJson` helper):

```ts
interface GuidiResult {
  numero: number;
  dataApuracao: string;
  dataProximoConcurso?: string | null;
  listaDezenas?: string[];
  localSorteio?: string | null;
  nomeMunicipioUFSorteio?: string | null;
  indicadorConcursoEspecial?: number;
  dezenasSorteadasOrdemSorteio?: string[];
  listaRateioPremio?: Array<{
    descricaoFaixa?: string | null;
    faixa?: number;
    numeroDeGanhadores?: number;
    valorPremio?: number;
  }>;
  listaMunicipioUFGanhadores?: Array<{ uf?: string }>;
  acumulado?: boolean;
  numeroConcursoProximo?: number | null;
  valorArrecadado?: number;
  valorAcumuladoConcurso_0_5?: number;
  valorAcumuladoConcursoEspecial?: number;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}
```

Add `normalizeGuidiDraw` after `normalizeDraw`:

```ts
function normalizeGuidiDraw(result: GuidiResult): StoredDraw {
  const premios = result.listaRateioPremio?.map((p) => ({
    descricao: p.descricaoFaixa ?? '',
    faixa: p.faixa ?? 0,
    ganhadores: p.numeroDeGanhadores ?? 0,
    valorPremio: p.valorPremio ?? 0,
  }));
  const ganhadores = result.listaMunicipioUFGanhadores ?? [];
  const estados = ganhadores.length
    ? [...new Set(ganhadores.map((g) => g.uf).filter((uf): uf is string => Boolean(uf)))]
    : null;

  return {
    concurso: result.numero,
    data: result.dataApuracao,
    dezenas: JSON.stringify(result.listaDezenas ?? []),
    local: result.localSorteio ?? result.nomeMunicipioUFSorteio ?? null,
    concursoEspecial: result.indicadorConcursoEspecial === undefined ? null : Number(result.indicadorConcursoEspecial),
    dezenasOrdemSorteio: asJson(result.dezenasSorteadasOrdemSorteio),
    premiacoes: premios && premios.length ? JSON.stringify(premios) : null,
    estadosPremiados: asJson(estados),
    localGanhadores: asJson(ganhadores),
    acumulou: result.acumulado === undefined ? null : Number(result.acumulado),
    proximoConcurso: result.numeroConcursoProximo ?? null,
    dataProximoConcurso: result.dataProximoConcurso ?? null,
    valorArrecadado: result.valorArrecadado ?? null,
    valorAcumuladoConcurso_0_5: result.valorAcumuladoConcurso_0_5 ?? null,
    valorAcumuladoConcursoEspecial: result.valorAcumuladoConcursoEspecial ?? null,
    valorAcumuladoProximoConcurso: result.valorAcumuladoProximoConcurso ?? null,
    valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso ?? null
  };
}
```

Replace the temporary stub `guidISync` (added in Task 2) with the real implementation:

```ts
async function guidISync(): Promise<{ inserted: number; total: number }> {
  const base = process.env.LOTERIA_GUIDI_BASE_URL || 'https://api.guidi.dev.br/loteria';

  const ultimoResponse = await fetch(`${base}/megasena/ultimo`);
  if (!ultimoResponse.ok) {
    throw new Error(`Guidi API returned ${ultimoResponse.status}: ${ultimoResponse.statusText}`);
  }
  const ultimo: GuidiResult = await ultimoResponse.json();

  const db = getDb();
  const currentMaxRow = db.prepare('SELECT MAX(concurso) as max FROM draws').get() as { max: number | null };
  const currentMax = currentMaxRow?.max ?? 0;

  const draws: StoredDraw[] = [];
  const ultimoNumero = ultimo.numero;

  // Best-effort backfill of the gap above the newest draw (ultimo appended below).
  for (let n = currentMax + 1; n < ultimoNumero; n++) {
    try {
      const res = await fetch(`${base}/megasena/${n}`);
      if (res.ok) {
        const dto: GuidiResult = await res.json();
        if (typeof dto?.numero === 'number') draws.push(normalizeGuidiDraw(dto));
      }
    } catch {
      // skip: a single missed draw must not abort the sync
    }
  }

  if (typeof ultimoNumero === 'number' && ultimoNumero > 0) {
    draws.push(normalizeGuidiDraw(ultimo));
  }

  return persistDraws(draws);
}
```

- [ ] **Step 4: Run the guidi test and the full suite**

Run: `cd backend && npm test`
Expected: ALL PASS (guidi incremental test + all existing sync tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/sync.ts backend/src/sync.test.ts
git commit -m "feat(backend): incremental guidi sync source with field mapping"
```

---

### Task 4: Routes — source-aware sync + set source + status

**Files:**
- Modify: `backend/src/routes/status.ts`
- Create: `backend/src/routes/status.test.ts`
- Test: `backend/src/routes/status.test.ts`

**Interfaces:**
- Consumes: `getSyncStatus`, `syncResults`, `getSyncSource`, `setSyncSource`, `SYNC_SOURCES`, `SyncSource` from `../sync`.
- Produces:
  - `POST /api/sync?source=caixa|guidi` → `{ mensagem, source, inserted, total }`; 400 on invalid source; 500 on sync failure.
  - `PUT /api/sync-source` body `{ source }` → `{ syncSource }`; 400 on invalid source.
  - `GET /api/status` includes `syncSource`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/routes/status.test.ts`:

```ts
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

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

async function request(pathname: string, init?: RequestInit) {
  return fetch(`${baseUrl}${pathname}`, init);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/status.test.ts`
Expected: FAIL — status endpoint does not yet return `syncSource`, no PUT route, no source query handling.

- [ ] **Step 3: Implement in `backend/src/routes/status.ts`**

Replace the file contents with:

```ts
import { Router, Request, Response } from 'express';
import { getSyncStatus, getSyncSource, setSyncSource, syncResults, SYNC_SOURCES, SyncSource } from '../sync';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter status do banco de dados' });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.source === 'string' ? req.query.source : getSyncSource();
    if (!SYNC_SOURCES.includes(raw as SyncSource)) {
      return res.status(400).json({ error: `Fonte de sincronização inválida: ${raw}` });
    }
    const source = raw as SyncSource;
    const result = await syncResults(source);
    res.json({
      mensagem: 'Sincronização concluída',
      source,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao sincronizar com a API externa' });
  }
});

router.put('/sync-source', (req: Request, res: Response) => {
  try {
    const source = (req.body as { source?: unknown })?.source;
    if (typeof source !== 'string' || !SYNC_SOURCES.includes(source as SyncSource)) {
      return res.status(400).json({ error: `Fonte de sincronização inválida: ${String(source)}` });
    }
    setSyncSource(source as SyncSource);
    res.json({ syncSource: getSyncSource() });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao salvar a fonte de sincronização' });
  }
});

export default router;
```

- [ ] **Step 4: Run the status route tests and the full backend suite**

Run: `cd backend && npm test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/status.ts backend/src/routes/status.test.ts
git commit -m "feat(backend): source-aware sync endpoint and persist sync-source route"
```

---

### Task 5: Frontend API client — SyncSource + triggerSync(source) + setSyncSource

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `BASE` (already defined in the file).
- Produces:
  - `export type SyncSource = 'caixa' | 'guidi'`
  - `StatusResponse` gains `syncSource: SyncSource`
  - `SyncResponse` gains `source: SyncSource`
  - `export function triggerSync(source: SyncSource): Promise<SyncResponse>`
  - `export function setSyncSource(source: SyncSource): Promise<{ syncSource: SyncSource }>`

- [ ] **Step 1: Implement in `frontend/src/lib/api.ts`**

Add the type and update `StatusResponse` near the existing type definitions:

```ts
export type SyncSource = 'caixa' | 'guidi';
```

In `StatusResponse`, add the field:

```ts
export interface StatusResponse {
  totalDraws: number;
  latestConcurso: number;
  latestDraw: LatestDraw | null;
  lastSync: string | null;
  syncSource: SyncSource;
}
```

Replace the existing `SyncResponse` and `triggerSync` (lines 146–157) with:

```ts
export interface SyncResponse {
  mensagem: string;
  source: SyncSource;
  inserted: number;
  total: number;
}

export function triggerSync(source: SyncSource): Promise<SyncResponse> {
  return fetch(`${BASE}/sync?source=${encodeURIComponent(source)}`, { method: 'POST' }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao sincronizar');
    return res.json();
  });
}

export function setSyncSource(source: SyncSource): Promise<{ syncSource: SyncSource }> {
  return fetch(`${BASE}/sync-source`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao salvar a fonte');
    return res.json();
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc -b --noEmit` (or `cd frontend && npm run build`)
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): sync source types and API client functions"
```

---

### Task 6: Frontend hooks + source dropdown in the sync status bar

**Files:**
- Modify: `frontend/src/hooks/useSync.ts`
- Create: `frontend/src/hooks/useSetSyncSource.ts`
- Modify: `frontend/src/components/SyncStatus.tsx`

**Interfaces:**
- Consumes: `triggerSync`, `setSyncSource`, `SyncSource` from `../lib/api`; `useStatus` from `../hooks/useStatus`.
- Produces:
  - `useSync()` now accepts a source argument in its `mutate(source)`.
  - `useSetSyncSource()` — a mutation that calls `setSyncSource` and invalidates the `['status']` query.
  - `SyncStatus` renders a source `<select>` (Caixa API / Guidi API) beside the sync button.

- [ ] **Step 1: Update `frontend/src/hooks/useSync.ts`**

Replace file contents with:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerSync, type SyncSource } from '../lib/api';

export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SyncSource) => triggerSync(source),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useSetSyncSource.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setSyncSource, type SyncSource } from '../lib/api';

export function useSetSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SyncSource) => setSyncSource(source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
```

- [ ] **Step 3: Update `frontend/src/components/SyncStatus.tsx`**

Replace file contents with:

```tsx
import { useEffect, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useSync } from '../hooks/useSync';
import { useSetSyncSource } from '../hooks/useSetSyncSource';
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import type { SyncSource } from '../lib/api';

interface SyncStatusProps {
  compact?: boolean;
}

export function SyncStatus({ compact = false }: SyncStatusProps) {
  const { data, isLoading, isError } = useStatus();
  const sync = useSync();
  const setSource = useSetSyncSource();
  const [source, setSourceState] = useState<SyncSource>('caixa');

  useEffect(() => {
    if (data?.syncSource) setSourceState(data.syncSource);
  }, [data?.syncSource]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status" aria-live="polite">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        <p>Atualizando dados...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <p>Não foi possível atualizar o status.</p>
      </div>
    );
  }

  function handleSourceChange(next: SyncSource) {
    setSourceState(next);
    setSource.mutate(next);
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-950 ${compact ? 'justify-between' : ''}`} role="status">
      {sync.isError ? (
        <AlertCircle className="size-4 shrink-0 text-red-700" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span><span className="text-blue-700">Concursos:</span> <strong>{data?.totalDraws ?? 0}</strong></span>
        <span><span className="text-blue-700">Último:</span> <strong>#{data?.latestConcurso ?? 0}</strong></span>
        {!compact && data?.lastSync && <span className="text-blue-700">Sincronizado: {new Date(data.lastSync).toLocaleString('pt-BR')}</span>}
        {sync.isError && <span className="text-red-700">Falha ao sincronizar.</span>}
      </div>
      <select
        value={source}
        onChange={(e) => handleSourceChange(e.target.value as SyncSource)}
        disabled={setSource.isPending}
        aria-label="Fonte de sincronização"
        title="Fonte de sincronização"
        className="shrink-0 rounded border border-blue-200 bg-white px-1 py-0.5 text-xs text-blue-800 disabled:opacity-50"
      >
        <option value="caixa">Caixa API</option>
        <option value="guidi">Guidi API</option>
      </select>
      <button
        type="button"
        onClick={() => sync.mutate(source)}
        disabled={sync.isPending}
        title="Sincronizar agora"
        aria-label="Sincronizar agora"
        className="ml-auto shrink-0 rounded p-1 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` succeed with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSync.ts frontend/src/hooks/useSetSyncSource.ts frontend/src/components/SyncStatus.tsx
git commit -m "feat(frontend): source dropdown in sync status bar"
```

---

## Post-implementation verification

Run the full test suite and build to confirm everything is green:

```bash
cd backend && npm test
cd ../frontend && npm run build
```

Both should pass with no errors. Also update the README's "Dados" bullet (line ~70) to mention the two selectable sources and the `LOTERIA_GUIDI_BASE_URL` env override, and commit:
```bash
git add README.md
git commit -m "docs: document selectable sync sources"
```
