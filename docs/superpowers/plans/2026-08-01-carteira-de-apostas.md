# Carteira de Apostas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, named "aposta wallets" that hold 6-number games, viewable on a dedicated page and targetable from the Gerador's save flow.

**Architecture:** Backend gains two SQLite tables (`wallets`, `wallet_games`) with a domain module `backend/src/wallets.ts` and HTTP routes `backend/src/routes/wallets.ts`. Frontend gains a `/carteiras` page plus a wallet selector shown when saving a game from the `SimulationDrawer`. The obsolete `saveNumbers`/`fetchSavedNumbers` API calls are removed.

**Tech Stack:** Node + Express 5, better-sqlite3, vitest (backend); React 19 + Vite + TanStack Query + base-ui + lucide-react (frontend).

---

### Task 1: Add wallet tables to the DB schema

**Files:**
- Modify: `backend/src/db.ts:37-48` (the `SCHEMA` const)

- [ ] **Step 1: Extend the SCHEMA**

Add the two wallet tables to the `SCHEMA` constant in `backend/src/db.ts`:

```ts
const SCHEMA = `
CREATE TABLE IF NOT EXISTS draws (
  concurso INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  dezenas TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS wallet_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  dezenas TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
```

- [ ] **Step 2: Verify schema applies cleanly**

Run the existing DB test to confirm `initDb` still works:

Run: `cd backend && npm test`
Expected: all existing tests pass (schema creates without error).

- [ ] **Step 3: Commit**

```bash
git add backend/src/db.ts
git commit -m "feat: add wallets and wallet_games tables to schema"
```

---

### Task 2: Wallet domain module (backend)

**Files:**
- Create: `backend/src/wallets.ts`
- Test: `backend/src/wallets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/wallets.test.ts` (follow the `draws.test.ts` pattern: temp DB via `initDb(TEST_DB_PATH)`, cleanup before/after):

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { closeDb, getDb, initDb } from './db';
import {
  addGame,
  createWallet,
  deleteWallet,
  getWallet,
  listWallets,
  removeGame,
  updateWallet
} from './wallets';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'wallets-test.db');

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

describe('wallet domain services', () => {
  beforeEach(() => {
    closeDb();
    cleanup();
    initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    cleanup();
  });

  it('creates and lists wallets with game counts', () => {
    const created = createWallet('Mega da Virada');
    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe('open');
    expect(created.finalizedAt).toBeNull();

    const wallets = listWallets();
    expect(wallets).toHaveLength(1);
    expect(wallets[0]).toMatchObject({ name: 'Mega da Virada', status: 'open', gameCount: 0 });
  });

  it('gets a wallet with its games', () => {
    const wallet = createWallet('Aposta do mês');
    addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    addGame(wallet.id, ['10', '20', '30', '40', '50', '60']);

    const loaded = getWallet(wallet.id);
    expect(loaded?.name).toBe('Aposta do mês');
    expect(loaded?.games).toHaveLength(2);
    expect(loaded?.games[0].dezenas).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('returns null for a wallet that does not exist', () => {
    expect(getWallet(999)).toBeNull();
  });

  it('renames and finalizes/reopens a wallet without blocking new games', () => {
    const wallet = createWallet('Em montagem');
    updateWallet(wallet.id, { name: 'Renomeada' });
    updateWallet(wallet.id, { status: 'finalized' });
    expect(getWallet(wallet.id)).toMatchObject({ name: 'Renomeada', status: 'finalized' });
    expect(getWallet(wallet.id)?.finalizedAt).not.toBeNull();

    const game = addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    expect(getWallet(wallet.id)?.games).toHaveLength(1);

    updateWallet(wallet.id, { status: 'open' });
    expect(getWallet(wallet.id)?.status).toBe('open');
    expect(game.id).toBeGreaterThan(0);
  });

  it('removes a game from a wallet', () => {
    const wallet = createWallet('Carteira');
    const game = addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    expect(getWallet(wallet.id)?.games).toHaveLength(1);

    removeGame(wallet.id, game.id);
    expect(getWallet(wallet.id)?.games).toHaveLength(0);
  });

  it('deletes a wallet and its games in cascade', () => {
    const wallet = createWallet('Temporária');
    addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    deleteWallet(wallet.id);

    expect(getWallet(wallet.id)).toBeNull();
    expect(listWallets()).toHaveLength(0);
    const count = getDb().prepare('SELECT COUNT(*) as count FROM wallet_games').get() as { count: number };
    expect(count.count).toBe(0);
  });

  it('rejects invalid games', () => {
    const wallet = createWallet('Carteira');
    expect(() => addGame(wallet.id, ['01', '02', '03'])).toThrow(/6 números/);
    expect(() => addGame(wallet.id, ['00', '01', '02', '03', '04', '05'])).toThrow(/entre 01 e 60/);
    expect(() => addGame(wallet.id, ['01', '01', '02', '03', '04', '05'])).toThrow(/duplicados/);
    expect(getWallet(wallet.id)?.games).toHaveLength(0);
  });

  it('throws when adding to or removing from a nonexistent wallet', () => {
    expect(() => addGame(999, ['01', '02', '03', '04', '05', '06'])).toThrow(/não encontrada/);
    expect(() => removeGame(999, 1)).toThrow(/não encontrada/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/wallets.test.ts`
Expected: FAIL with `Failed to resolve import "./wallets"` (module does not exist yet).

- [ ] **Step 3: Implement the domain module**

Create `backend/src/wallets.ts`:

```ts
import { getDb } from './db';

export interface WalletSummary {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  createdAt: string;
  finalizedAt: string | null;
  gameCount: number;
}

export interface WalletGame {
  id: number;
  dezenas: string[];
  createdAt: string;
}

export interface WalletDetail extends Omit<WalletSummary, 'gameCount'> {
  games: WalletGame[];
}

type WalletRow = {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  created_at: string;
  finalized_at: string | null;
};

type GameRow = {
  id: number;
  dezenas: string;
  created_at: string;
};

function hydrateWallet(row: WalletRow): Omit<WalletSummary, 'gameCount'> {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at
  };
}

export function normalizeDezenas(input: string[]): string[] {
  const numbers = input.map(value => Number(value.trim()));
  if (numbers.length !== 6) {
    throw new Error('Cada jogo deve ter exatamente 6 números');
  }
  const padded = numbers.map(value => value.toString().padStart(2, '0'));
  for (const number of numbers) {
    if (!Number.isInteger(number) || number < 1 || number > 60) {
      throw new Error('Cada número deve estar entre 01 e 60');
    }
  }
  if (new Set(padded).size !== 6) {
    throw new Error('Números duplicados não são permitidos');
  }
  return padded.sort((a, b) => Number(a) - Number(b));
}

export function listWallets(): WalletSummary[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT w.id, w.name, w.status, w.created_at, w.finalized_at,
            COUNT(wg.id) as gameCount
     FROM wallets w
     LEFT JOIN wallet_games wg ON wg.wallet_id = w.id
     GROUP BY w.id
     ORDER BY w.created_at DESC`
  ).all() as Array<WalletRow & { gameCount: number }>;
  return rows.map(row => ({ ...hydrateWallet(row), gameCount: row.gameCount }));
}

export function getWallet(id: number): WalletDetail | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, name, status, created_at, finalized_at FROM wallets WHERE id = ?'
  ).get(id) as WalletRow | undefined;
  if (!row) return null;

  const gameRows = db.prepare(
    'SELECT id, dezenas, created_at FROM wallet_games WHERE wallet_id = ? ORDER BY created_at ASC'
  ).all(id) as GameRow[];

  return {
    ...hydrateWallet(row),
    games: gameRows.map(game => ({
      id: game.id,
      dezenas: JSON.parse(game.dezenas) as string[],
      createdAt: game.created_at
    }))
  };
}

export function createWallet(name: string): WalletSummary {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nome é obrigatório');
  const result = db.prepare('INSERT INTO wallets (name) VALUES (?)').run(trimmed);
  return {
    id: Number(result.lastInsertRowid),
    name: trimmed,
    status: 'open',
    createdAt: new Date().toISOString(),
    finalizedAt: null,
    gameCount: 0
  };
}

export function updateWallet(
  id: number,
  patch: { name?: string; status?: 'open' | 'finalized' }
): WalletDetail | null {
  const db = getDb();
  const existing = getWallet(id);
  if (!existing) throw new Error('Carteira não encontrada');

  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const status = patch.status ?? existing.status;
  if (!name) throw new Error('Nome é obrigatório');
  if (status !== 'open' && status !== 'finalized') throw new Error('Status inválido');

  const finalizedAt = status === 'finalized' ? new Date().toISOString() : null;
  db.prepare(
    'UPDATE wallets SET name = ?, status = ?, finalized_at = ? WHERE id = ?'
  ).run(name, status, finalizedAt, id);

  const reloaded = getWallet(id);
  if (!reloaded) throw new Error('Carteira não encontrada');
  return reloaded;
}

export function deleteWallet(id: number): void {
  const db = getDb();
  const result = db.prepare('DELETE FROM wallets WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('Carteira não encontrada');
}

export function addGame(walletId: number, dezenas: string[]): WalletGame {
  const db = getDb();
  const wallet = getWallet(walletId);
  if (!wallet) throw new Error('Carteira não encontrada');

  const normalized = normalizeDezenas(dezenas);
  const result = db.prepare(
    'INSERT INTO wallet_games (wallet_id, dezenas) VALUES (?, ?)'
  ).run(walletId, JSON.stringify(normalized));

  return {
    id: Number(result.lastInsertRowid),
    dezenas: normalized,
    createdAt: new Date().toISOString()
  };
}

export function removeGame(walletId: number, gameId: number): void {
  const db = getDb();
  const wallet = getWallet(walletId);
  if (!wallet) throw new Error('Carteira não encontrada');
  db.prepare('DELETE FROM wallet_games WHERE id = ? AND wallet_id = ?').run(gameId, walletId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/wallets.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/wallets.ts backend/src/wallets.test.ts
git commit -m "feat: add wallet domain services"
```

---

### Task 3: Wallet HTTP routes (backend)

**Files:**
- Create: `backend/src/routes/wallets.ts`
- Modify: `backend/src/index.ts:9,21` (import + mount)

- [ ] **Step 1: Create the routes module**

Create `backend/src/routes/wallets.ts` (follow `routes/draws.ts` error style):

```ts
import { Router, Request, Response } from 'express';
import {
  addGame,
  createWallet,
  deleteWallet,
  getWallet,
  listWallets,
  normalizeDezenas,
  removeGame,
  updateWallet
} from '../wallets';

const router = Router();

function parseId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

router.get('/wallets', (_req: Request, res: Response) => {
  try {
    res.json({ carteiras: listWallets() });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar carteiras' });
  }
});

router.post('/wallets', (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    if (!name.trim()) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }
    res.status(201).json(createWallet(name));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar carteira' });
  }
});

router.get('/wallets/:id', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'ID de carteira inválido' });
    return;
  }
  try {
    const wallet = getWallet(id);
    if (!wallet) {
      res.status(404).json({ error: 'Carteira não encontrada' });
      return;
    }
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter carteira' });
  }
});

router.patch('/wallets/:id', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'ID de carteira inválido' });
    return;
  }
  try {
    const name = req.body?.name === undefined ? undefined : String(req.body.name);
    const status = req.body?.status === undefined ? undefined : String(req.body.status);
    const wallet = updateWallet(id, { name, status });
    res.json(wallet);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const status = message === 'Carteira não encontrada' ? 404 : 400;
    res.status(status).json({ error: message || 'Falha ao atualizar carteira' });
  }
});

router.delete('/wallets/:id', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'ID de carteira inválido' });
    return;
  }
  try {
    deleteWallet(id);
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Carteira não encontrada') {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Falha ao excluir carteira' });
  }
});

router.post('/wallets/:id/games', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'ID de carteira inválido' });
    return;
  }
  try {
    const dezenas = Array.isArray(req.body?.dezenas) ? (req.body.dezenas as string[]) : [];
    let normalized: string[];
    try {
      normalized = normalizeDezenas(dezenas);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Jogo inválido';
      res.status(400).json({ error: message });
      return;
    }
    const game = addGame(id, normalized);
    res.status(201).json(game);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Carteira não encontrada') {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Falha ao adicionar jogo' });
  }
});

router.delete('/wallets/:id/games/:gameId', (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const gameId = parseId(req.params.gameId);
  if (id === null || gameId === null) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  try {
    removeGame(id, gameId);
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Carteira não encontrada') {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Falha ao remover jogo' });
  }
});

export default router;
```

- [ ] **Step 2: Register the router in the app**

In `backend/src/index.ts`, add the import after line 9 and mount after line 21:

```ts
import walletsRoutes from './routes/wallets';
// ...
app.use('/api', walletsRoutes);
```

- [ ] **Step 3: Typecheck and run tests**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/wallets.ts backend/src/index.ts
git commit -m "feat: add wallet HTTP routes"
```

---

### Task 4: Frontend API layer for wallets

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Replace saved-numbers functions with wallet functions**

In `frontend/src/lib/api.ts`, remove these exports and their interfaces (`SavedNumbersComparison`, `SavedNumbersItem`, `SavedNumbersListResponse`, `fetchSavedNumbers`, `saveNumbers`, `deleteSavedNumbers`). Add the wallet types and functions:

```ts
export interface WalletSummary {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  createdAt: string;
  finalizedAt: string | null;
  gameCount: number;
}

export interface WalletGame {
  id: number;
  dezenas: string[];
  createdAt: string;
}

export interface WalletDetail {
  id: number;
  name: string;
  status: 'open' | 'finalized';
  createdAt: string;
  finalizedAt: string | null;
  games: WalletGame[];
}

export function fetchWallets(): Promise<{ carteiras: WalletSummary[] }> {
  return apiFetch('/wallets');
}

export function createWallet(name: string): Promise<WalletSummary> {
  return fetch(`${BASE}/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao criar carteira');
    return res.json();
  });
}

export function fetchWallet(id: number): Promise<WalletDetail> {
  return apiFetch(`/wallets/${id}`);
}

export function updateWallet(
  id: number,
  patch: { name?: string; status?: 'open' | 'finalized' }
): Promise<WalletDetail> {
  return fetch(`${BASE}/wallets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao atualizar carteira');
    return res.json();
  });
}

export function deleteWallet(id: number): Promise<void> {
  return fetch(`${BASE}/wallets/${id}`, { method: 'DELETE' }).then(async (res) => {
    if (res.status === 204) return;
    throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao excluir carteira');
  });
}

export function addGameToWallet(id: number, dezenas: string[]): Promise<WalletGame> {
  return fetch(`${BASE}/wallets/${id}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dezenas }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao adicionar jogo');
    return res.json();
  });
}

export function deleteWalletGame(id: number, gameId: number): Promise<void> {
  return fetch(`${BASE}/wallets/${id}/games/${gameId}`, { method: 'DELETE' }).then(async (res) => {
    if (res.status === 204) return;
    throw new Error((await res.json().catch(() => ({}))).error || 'Erro ao remover jogo');
  });
}
```

- [ ] **Step 2: Fix references to removed functions**

Search the frontend for remaining references to the removed exports:

Run: `grep -rn "saveNumbers\|fetchSavedNumbers\|deleteSavedNumbers\|SavedNumbers" frontend/src`
Expected: only `frontend/src/pages/Gerador.tsx` still references `saveNumbers` — this will be handled in Task 6.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: error about `saveNumbers` import in `Gerador.tsx` (expected until Task 6).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add wallet API client functions"
```

---

### Task 5: Carteiras page and sidebar link (frontend)

**Files:**
- Create: `frontend/src/pages/Carteiras.tsx`
- Create: `frontend/src/hooks/useWallets.ts`
- Modify: `frontend/src/App.tsx:6,28`
- Modify: `frontend/src/components/Sidebar.tsx:2,4,8`

- [ ] **Step 1: Create the wallets query hook**

Create `frontend/src/hooks/useWallets.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchWallet, fetchWallets } from '../lib/api';

export function useWallets() {
  return useQuery({ queryKey: ['wallets'], queryFn: fetchWallets });
}

export function useWallet(id: number | null) {
  return useQuery({
    queryKey: ['wallets', id],
    queryFn: () => fetchWallet(id as number),
    enabled: id !== null,
  });
}
```

- [ ] **Step 2: Create the Carteiras page**

Create `frontend/src/pages/Carteiras.tsx` (follow the `Analise.tsx` style — header + cards, loading/error states):

```tsx
import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Wallet, Plus, Check, Lock, Unlock } from 'lucide-react';
import {
  createWallet,
  deleteWallet,
  deleteWalletGame,
  updateWallet,
  type WalletSummary,
} from '../lib/api';
import { useWallet, useWallets } from '../hooks/useWallets';
import { GameCard } from '../components/GameCard';

export function Carteiras() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useWallets();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (name: string) => createWallet(name),
    onSuccess: (wallet) => {
      setCreateOpen(false);
      setCreateName('');
      setSelectedId(wallet.id);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWallet(id),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (wallet: WalletSummary) =>
      updateWallet(wallet.id, { status: wallet.status === 'open' ? 'finalized' : 'open' }),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500" role="status">Carregando carteiras...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800" role="alert">Não foi possível carregar as carteiras. Tente atualizar a página.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Apostas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Minhas carteiras</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Guarde grupos de jogos para apostar depois. Finalizar é só um rótulo — dá para continuar adicionando.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          <Plus size={16} aria-hidden="true" />
          Nova carteira
        </button>
      </header>

      {createOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createName.trim()) createMutation.mutate(createName);
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="block text-sm font-semibold text-slate-700">
            Nome da carteira
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800">
              Criar
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {selectedId !== null ? (
        <WalletDetailView
          id={selectedId}
          onBack={() => setSelectedId(null)}
          onRemoved={invalidate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.carteiras.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Nenhuma carteira ainda. Crie uma para começar a guardar jogos.
            </div>
          )}
          {data.carteiras.map((wallet) => (
            <div key={wallet.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedId(wallet.id)}
                className="flex items-start justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <Wallet size={16} className={wallet.status === 'finalized' ? 'text-slate-400' : 'text-blue-700'} aria-hidden="true" />
                  {wallet.name}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${wallet.status === 'finalized' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                  {wallet.status === 'finalized' ? 'Finalizada' : 'Aberta'}
                </span>
              </button>
              <p className="mt-2 text-sm text-slate-500">
                {wallet.gameCount} jogo{wallet.gameCount === 1 ? '' : 's'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate(wallet)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {wallet.status === 'open' ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                  {wallet.status === 'open' ? 'Finalizar' : 'Reabrir'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(wallet.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletDetailView({ id, onBack, onRemoved }: { id: number; onBack: () => void; onRemoved: () => void }) {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading } = useWallet(id);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateWallet(id, { name }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['wallets', id] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });

  const removeGameMutation = useMutation({
    mutationFn: (gameId: number) => deleteWalletGame(id, gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', id] });
      onRemoved();
    },
  });

  if (isLoading || !wallet) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500" role="status">Carregando carteira...</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
            ← Voltar
          </button>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (nameDraft.trim()) renameMutation.mutate(nameDraft);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-600"
              />
              <button type="submit" className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white">Salvar</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600">Cancelar</button>
            </form>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900">{wallet.name}</h2>
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${wallet.status === 'finalized' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {wallet.status === 'finalized' ? 'Finalizada' : 'Aberta'}
              </span>
              <button type="button" onClick={() => { setNameDraft(wallet.name); setEditing(true); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                <Pencil size={12} aria-hidden="true" /> Renomear
              </button>
            </>
          )}
        </div>
      </div>

      {wallet.games.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Esta carteira ainda não tem jogos.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {wallet.games.map((game, index) => (
            <div key={game.id} className="relative">
              <GameCard numbers={game.dezenas} index={index} ballSize="sm" />
              <button
                type="button"
                onClick={() => removeGameMutation.mutate(game.id)}
                className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remover jogo"
                title="Remover jogo"
              >
                <Check size={14} className="hidden" />
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

Note: the GameCard already renders "Simular" only when `onSimulate` is provided; passing no `onSimulate` gives just the "Copiar" action, which is correct for this page. The stray `<Check size={14} className="hidden" />` is a visual placeholder to keep the button the same width as other icon buttons — it is intentionally hidden.

- [ ] **Step 3: Register the route in the app**

In `frontend/src/App.tsx`, add the import near line 7 and the route after line 26:

```tsx
import { Carteiras } from './pages/Carteiras';
// ...
<Route path="/carteiras" element={<Carteiras />} />
```

- [ ] **Step 4: Add the sidebar link**

In `frontend/src/components/Sidebar.tsx`, add `Wallet` to the lucide import and add the link:

```tsx
import { BarChart3, Dices, History, LayoutDashboard, Trophy, Wallet } from 'lucide-react';

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/gerador', label: 'Gerador & Simulador', icon: Dices },
  { to: '/carteiras', label: 'Carteiras', icon: Wallet },
  { to: '/analise', label: 'Análise', icon: BarChart3 },
  { to: '/sorteios', label: 'Sorteios', icon: History },
];
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: error about `saveNumbers` in `Gerador.tsx` (still unresolved until Task 6). No errors from the new files.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Carteiras.tsx frontend/src/hooks/useWallets.ts frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: add carteiras page and sidebar link"
```

---

### Task 6: Wallet selector in the save flow (frontend)

**Files:**
- Modify: `frontend/src/components/SimulationDrawer.tsx`
- Modify: `frontend/src/pages/Gerador.tsx`

- [ ] **Step 1: Replace the save action in SimulationDrawer**

In `frontend/src/components/SimulationDrawer.tsx`, replace the `onSaveGame`/`savingKey`/`savedKeys` props with a single `onSaveGame: (numbers: string[]) => void` prop. Update the props interface, the destructure, and the save button:

```tsx
interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
  games: string[][];
  result: SimulationResponse | null;
  loading: boolean;
  error: string | null;
  simMode: string;
  onSimModeChange: (mode: string) => void;
  randomCount: number;
  onRandomCountChange: (count: number) => void;
  onRunSimulation: () => void;
  onSaveGame: (numbers: string[]) => void;
}
```

In the save button (currently uses `savingKey`/`savedKeys`), replace with:

```tsx
<button
  type="button"
  onClick={() => onSaveGame(jogo.numeros)}
  className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-700 px-2 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
>
  <Save size={13} aria-hidden="true" />
  Salvar
</button>
```

Also remove the `savingKey` and `savedKeys` entries from the destructured props.

- [ ] **Step 2: Add wallet-selector state and UI to Gerador**

In `frontend/src/pages/Gerador.tsx`:

1. Update imports: remove `saveNumbers`; add `createWallet`, `addGameToWallet`, `useWallets`, and `Wallet`/`Check` icons from lucide.

```tsx
import { fetchGenerate, fetchSimulate, createWallet, addGameToWallet, type GenerateResponse, type SimulationResponse } from '../lib/api';
import { useWallets } from '../hooks/useWallets';
import { Check, Dice5, Wallet, WandSparkles } from 'lucide-react';
```

2. Remove `savedKeys` state and `handleSaveGame` (lines 52-53, 113-128). Replace with a wallet selector:

```tsx
const { data: walletsData } = useWallets();
const [saveTarget, setSaveTarget] = useState<string[] | null>(null);
const [saveError, setSaveError] = useState<string | null>(null);
const [newWalletName, setNewWalletName] = useState('');
const [saving, setSaving] = useState(false);

const handleSaveGame = useCallback((numbers: string[]) => {
  setSaveTarget(numbers);
  setSaveError(null);
}, []);

const confirmSave = useCallback(
  async (walletId: number) => {
    if (!saveTarget) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addGameToWallet(walletId, saveTarget);
      setSaveTarget(null);
    } catch (err) {
      console.error(err);
      setSaveError('Não foi possível salvar o jogo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  },
  [saveTarget],
);

const createAndSave = useCallback(async () => {
  if (!saveTarget || !newWalletName.trim()) return;
  setSaving(true);
  setSaveError(null);
  try {
    const wallet = await createWallet(newWalletName.trim());
    await addGameToWallet(wallet.id, saveTarget);
    setSaveTarget(null);
    setNewWalletName('');
  } catch (err) {
    console.error(err);
    setSaveError('Não foi possível criar a carteira e salvar o jogo. Tente novamente.');
  } finally {
    setSaving(false);
  }
}, [saveTarget, newWalletName]);
```

3. Update the `<SimulationDrawer>` usage to pass only `onSaveGame={handleSaveGame}` (remove `savingKey` and `savedKeys`).

4. Render the wallet selector modal when `saveTarget` is set (at the end of the returned JSX, before `</div>`):

```tsx
{saveTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h3 className="text-lg font-bold text-slate-900">Salvar jogo na carteira</h3>
      <p className="mt-1 text-sm text-slate-500">
        <span className="font-mono font-semibold text-slate-700">{saveTarget.join(',')}</span>
      </p>

      {saveError && (
        <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</p>
      )}

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {walletsData?.carteiras.map((wallet) => (
          <button
            key={wallet.id}
            type="button"
            onClick={() => confirmSave(wallet.id)}
            disabled={saving}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Wallet size={15} className={wallet.status === 'finalized' ? 'text-slate-400' : 'text-blue-700'} aria-hidden="true" />
              {wallet.name}
            </span>
            <span className="text-xs font-normal text-slate-400">{wallet.gameCount} jogos</span>
          </button>
        ))}
        {walletsData?.carteiras.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            Nenhuma carteira ainda. Crie a primeira abaixo.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createAndSave();
        }}
        className="mt-4 flex gap-2 border-t border-slate-100 pt-4"
      >
        <input
          value={newWalletName}
          onChange={(e) => setNewWalletName(e.target.value)}
          placeholder="Ou crie uma nova carteira..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
        <button
          type="submit"
          disabled={saving || !newWalletName.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-400"
        >
          <Check size={14} aria-hidden="true" />
          Salvar
        </button>
      </form>

      <button
        type="button"
        onClick={() => setSaveTarget(null)}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
      >
        Cancelar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Remove remaining saved-numbers references**

Run: `grep -rn "saveNumbers\|fetchSavedNumbers\|deleteSavedNumbers\|SavedNumbers\|savedKeys\|savingKey" frontend/src`
Expected: no matches.

- [ ] **Step 4: Typecheck and lint**

Run: `cd frontend && npx tsc -b --noEmit && npm run lint`
Expected: no type errors; no lint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SimulationDrawer.tsx frontend/src/pages/Gerador.tsx
git commit -m "feat: save games into wallets from simulation drawer"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all tests pass (including `wallets.test.ts`).

- [ ] **Step 2: Run the frontend build**

Run: `cd frontend && npm run build`
Expected: build succeeds (tsc + vite).

- [ ] **Step 3: Manual smoke test**

Start the dev servers:

Run: `npm run dev` (from repo root)

Verify in the browser:
1. `/carteiras` shows the empty-state message and the "Nova carteira" button.
2. Create a wallet "Teste"; it appears in the list with `0 jogos`.
3. In `/gerador`, generate a game, click "Simular", then "Salvar". The wallet selector appears; choose "Teste".
4. Back in `/carteiras`, open "Teste" — the game is listed.
5. Finalize "Teste"; add another game from the Gerador; it still saves (finalized does not block).
6. Delete the test wallet and confirm the page returns to empty state.

- [ ] **Step 4: Commit any leftover changes**

Run: `git status --short`
If there are unrelated modified files (e.g. `backend/data/megasena.db-*` from running the app), leave them unstaged. If there are staged leftovers, commit them.

---

## Self-Review Notes

- **Spec coverage:** all acceptance criteria map to tasks — DB tables (T1), domain CRUD + finalized-doesn't-block + validation (T2), HTTP routes + status codes (T3), API client + removal of saved-numbers (T4), page + sidebar (T5), save flow selector + saved-numbers removal (T6), verification (T7).
- **Type consistency:** `WalletSummary`, `WalletDetail`, `WalletGame` types defined once in `api.ts` (T4) and reused in `Carteiras.tsx`/`Gerador.tsx`; backend domain types mirror them. Route param names (`/wallets/:id/games/:gameId`) match across T3/T4/T6. Function names (`createWallet`, `addGameToWallet`, `updateWallet`, `deleteWallet`, `fetchWallet`, `fetchWallets`) are consistent everywhere.
- **Placeholders:** no TBD/TODO; every code step has full code.
