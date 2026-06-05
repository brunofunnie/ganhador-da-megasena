# Ganhador da Mega Sena — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Mega Sena statistics app with Express.js backend (SQLite cache, stats engine, generators, strategies, simulator) and React SPA frontend (Tailwind, shadcn/ui), all in Portuguese (BR).

**Architecture:** Express backend fetches historical draws from loteriascaixa-api, caches in SQLite, computes statistics on-demand, and serves a REST API. React SPA consumes the API via TanStack Query, renders with shadcn/ui components and Recharts. Vite dev server proxies `/api` to Express.

**Tech Stack:** Node.js 20+, Express, TypeScript, better-sqlite3, Vite, React 18, Tailwind CSS v3, shadcn/ui, React Router, Recharts, TanStack Query, Vitest

---

## Part 1: Backend Setup

### Task 1: Scaffold Backend Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`

- [ ] **Step 1: Initialize backend package.json**

```bash
mkdir -p backend/src && cd backend && npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && npm install express better-sqlite3 cors
npm install -D typescript @types/node @types/express @types/better-sqlite3 @types/cors tsx vitest
```

- [ ] **Step 3: Create tsconfig.json**

Write `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create minimal Express server**

Write `backend/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

export default app;
```

- [ ] **Step 5: Add type module and scripts to package.json**

In `backend/package.json`, add `"type": "module"` and scripts:
```json
"type": "module",
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Test server starts**

```bash
cd backend && npx tsx src/index.ts
# Expected: "Backend running on port 3001"
# Kill with Ctrl+C
```

- [ ] **Step 7: Commit**

```bash
git add backend/ && git commit -m "feat: scaffold backend with Express + TypeScript"
```

---

### Task 2: SQLite Database Module

**Files:**
- Create: `backend/src/db.ts`
- Create: `backend/src/db.test.ts`

- [ ] **Step 1: Write failing test for database setup**

Write `backend/src/db.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/db.test.ts
# Expected: FAIL - module not found
```

- [ ] **Step 3: Implement db.ts**

Write `backend/src/db.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

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
`;

export function initDb(dbPath?: string): void {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'data', 'megasena.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/db.test.ts
# Expected: 2 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/db.ts backend/src/db.test.ts && git commit -m "feat: add SQLite database module"
```

---

### Task 3: External API Sync Module

**Files:**
- Create: `backend/src/sync.ts`
- Create: `backend/src/sync.test.ts`

- [ ] **Step 1: Write failing test for sync**

Write `backend/src/sync.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/sync.test.ts
# Expected: FAIL - module not found
```

- [ ] **Step 3: Implement sync.ts**

Write `backend/src/sync.ts`:
```typescript
import { getDb } from './db';

const API_BASE = 'https://loteriascaixa-api.herokuapp.com/api';
const LOTERIA = 'megasena';

interface ApiResultado {
  loteria: string;
  concurso: number;
  data: string;
  dezenas: string[];
}

export async function syncResults(): Promise<{ inserted: number; total: number }> {
  const response = await fetch(`${API_BASE}/${LOTERIA}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const results: ApiResultado[] = await response.json();
  const db = getDb();

  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    let inserted = 0;
    for (const r of results) {
      const existing = db.prepare('SELECT concurso FROM draws WHERE concurso = ?').get(r.concurso);
      if (!existing) inserted++;
      insert.run(r.concurso, r.data, JSON.stringify(r.dezenas));
    }
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('last_sync', new Date().toISOString());
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('total_draws', String(results.length));
    return inserted;
  });

  const inserted = transaction();
  return { inserted, total: results.length };
}

export function getSyncStatus() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number };
  const latest = db.prepare('SELECT MAX(concurso) as max FROM draws').get() as { max: number };
  const lastSync = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get() as { value: string } | undefined;

  return {
    totalDraws: count.count,
    latestConcurso: latest.max || 0,
    lastSync: lastSync?.value || null
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/sync.test.ts
# Expected: 2 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/sync.ts backend/src/sync.test.ts && git commit -m "feat: add external API sync module"
```

---

### Task 4: Statistics Computation Module

**Files:**
- Create: `backend/src/statistics.ts`
- Create: `backend/src/statistics.test.ts`

- [ ] **Step 1: Write failing test for statistics**

Write `backend/src/statistics.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { computeStatistics } from './statistics';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'stats-test.db');

function seedDb() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );
  const draws = [
    [1, '01/01/2000', JSON.stringify(['01', '02', '03', '04', '05', '06'])],
    [2, '08/01/2000', JSON.stringify(['01', '02', '03', '07', '08', '09'])],
    [3, '15/01/2000', JSON.stringify(['10', '11', '12', '13', '14', '15'])],
  ];
  for (const d of draws) insert.run(d[0], d[1], d[2]);
}

describe('statistics', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb(TEST_DB_PATH);
    seedDb();
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should compute frequency for all numbers', () => {
    const stats = computeStatistics();
    expect(stats.frequency).toHaveLength(60);

    const freq01 = stats.frequency.find(f => f.numero === '01');
    expect(freq01?.frequencia).toBe(2);
    expect(freq01?.porcentagem).toBeCloseTo(66.67, 1);

    const freq10 = stats.frequency.find(f => f.numero === '10');
    expect(freq10?.frequencia).toBe(1);
  });

  it('should compute cold numbers (draws since last appearance)', () => {
    const stats = computeStatistics();
    expect(stats.coldNumbers).toHaveLength(60);

    const num10 = stats.coldNumbers.find(c => c.numero === '10');
    expect(num10?.concursosAtrasado).toBe(0);

    const num01 = stats.coldNumbers.find(c => c.numero === '01');
    expect(num01?.concursosAtrasado).toBe(1);
  });

  it('should compute parity distribution', () => {
    const stats = computeStatistics();
    expect(stats.parity).toBeDefined();
    const { evenOddDistribution } = stats.parity;
    const total = Object.values(evenOddDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/statistics.test.ts
# Expected: FAIL
```

- [ ] **Step 3: Implement statistics.ts**

Write `backend/src/statistics.ts`:
```typescript
import { getDb } from './db';

export interface FrequencyItem {
  numero: string;
  frequencia: number;
  porcentagem: number;
}

export interface ColdNumberItem {
  numero: string;
  ultimoConcurso: number | null;
  concursosAtrasado: number;
}

export interface Statistics {
  totalConcursos: number;
  frequency: FrequencyItem[];
  coldNumbers: ColdNumberItem[];
  parity: {
    evenOddDistribution: Record<string, number>;
  };
}

export function computeStatistics(): Statistics {
  const db = getDb();
  const draws = db.prepare('SELECT concurso, dezenas FROM draws ORDER BY concurso ASC').all() as {
    concurso: number;
    dezenas: string;
  }[];

  const totalConcursos = draws.length;
  const maxConcurso = draws.length > 0 ? draws[draws.length - 1].concurso : 0;

  const frequencyMap = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    frequencyMap.set(key, 0);
    lastSeen.set(key, -1);
  }

  const parityCounts: Record<string, number> = {};

  for (const draw of draws) {
    const dezenas: string[] = JSON.parse(draw.dezenas);

    let evens = 0;
    for (const d of dezenas) {
      frequencyMap.set(d, (frequencyMap.get(d) || 0) + 1);
      lastSeen.set(d, draw.concurso);
      if (parseInt(d) % 2 === 0) evens++;
    }
    const odds = 6 - evens;
    const key = `${evens}p-${odds}i`;
    parityCounts[key] = (parityCounts[key] || 0) + 1;
  }

  const frequency: FrequencyItem[] = [];
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    const freq = frequencyMap.get(key) || 0;
    frequency.push({
      numero: key,
      frequencia: freq,
      porcentagem: totalConcursos > 0 ? parseFloat(((freq / totalConcursos) * 100).toFixed(2)) : 0
    });
  }

  const coldNumbers: ColdNumberItem[] = [];
  for (let i = 1; i <= 60; i++) {
    const key = i.toString().padStart(2, '0');
    const last = lastSeen.get(key) ?? -1;
    coldNumbers.push({
      numero: key,
      ultimoConcurso: last === -1 ? null : last,
      concursosAtrasado: last === -1 ? totalConcursos : maxConcurso - last
    });
  }

  return {
    totalConcursos,
    frequency: frequency.sort((a, b) => b.frequencia - a.frequencia),
    coldNumbers: coldNumbers.sort((a, b) => b.concursosAtrasado - a.concursosAtrasado),
    parity: { evenOddDistribution: parityCounts }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/statistics.test.ts
# Expected: 3 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/statistics.ts backend/src/statistics.test.ts && git commit -m "feat: add statistics computation module"
```

---

### Task 5: Status and Sync Routes

**Files:**
- Create: `backend/src/routes/status.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create status routes**

Write `backend/src/routes/status.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { getSyncStatus, syncResults } from '../sync';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter status do banco de dados' });
  }
});

router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const result = await syncResults();
    res.json({
      mensagem: 'Sincronização concluída',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao sincronizar com a API externa' });
  }
});

export default router;
```

- [ ] **Step 2: Update index.ts to use routes and auto-sync on startup**

Write `backend/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import { syncResults } from './sync';
import statusRoutes from './routes/status';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', statusRoutes);

async function start() {
  initDb();
  console.log('Database initialized');

  try {
    const status = await syncResults();
    console.log(`Sync complete: ${status.inserted} new, ${status.total} total draws`);
  } catch (err) {
    console.warn('Initial sync failed, using existing data:', err);
  }

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start();

export default app;
```

- [ ] **Step 3: Test server with curl**

```bash
cd backend && npx tsx src/index.ts &
sleep 3
curl http://localhost:3001/api/status
# Expected: JSON with totalDraws, latestConcurso, lastSync
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/status.ts backend/src/index.ts && git commit -m "feat: add status and sync API routes"
```

---

### Task 6: Statistics Route

**Files:**
- Create: `backend/src/routes/statistics.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create statistics route**

Write `backend/src/routes/statistics.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { computeStatistics } from '../statistics';

const router = Router();

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = computeStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao calcular estatísticas' });
  }
});

export default router;
```

- [ ] **Step 2: Update index.ts to register statistics routes**

In `backend/src/index.ts`, add after `initDb()`:
```typescript
import statisticsRoutes from './routes/statistics';

// ... existing code ...

app.use('/api', statisticsRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/statistics.ts backend/src/index.ts && git commit -m "feat: add statistics API route"
```

---

## Part 2: Backend Features

### Task 7: Generator Engine

**Files:**
- Create: `backend/src/generators.ts`
- Create: `backend/src/generators.test.ts`

- [ ] **Step 1: Write failing test for generators**

Write `backend/src/generators.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateNumbers, GENERATOR_MODES } from './generators';

describe('generators', () => {
  it('should generate 6 random unique numbers between 01-60 (random mode)', () => {
    const result = generateNumbers({ mode: 'random', count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(6);
    for (const n of result[0]) {
      const num = parseInt(n);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(60);
    }
    const unique = new Set(result[0]);
    expect(unique.size).toBe(6);
    expect(result[0]).toEqual(result[0].slice().sort((a, b) => parseInt(a) - parseInt(b)));
  });

  it('should generate multiple games', () => {
    const result = generateNumbers({ mode: 'random', count: 5 });
    expect(result).toHaveLength(5);
  });

  it('should include fixed numbers and exclude specified numbers', () => {
    const result = generateNumbers({
      mode: 'random',
      count: 1,
      fixedNumbers: ['01', '02', '03'],
      excludeNumbers: ['58', '59', '60']
    });
    const game = result[0];
    expect(game).toContain('01');
    expect(game).toContain('02');
    expect(game).toContain('03');
    for (const n of game) {
      expect(['58', '59', '60']).not.toContain(n);
    }
  });

  it('all modes should be defined', () => {
    expect(GENERATOR_MODES).toContain('random');
    expect(GENERATOR_MODES).toContain('hot');
    expect(GENERATOR_MODES).toContain('cold');
    expect(GENERATOR_MODES).toContain('balanced');
    expect(GENERATOR_MODES).toContain('genetic');
    expect(GENERATOR_MODES).toContain('sequences');
    expect(GENERATOR_MODES).toContain('fechamento');
    expect(GENERATOR_MODES).toContain('dreams');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/generators.test.ts
# Expected: FAIL
```

- [ ] **Step 3: Implement generators.ts**

Write `backend/src/generators.ts`:
```typescript
import { getDb } from './db';

export const GENERATOR_MODES = [
  'random', 'hot', 'cold', 'balanced', 'genetic', 'sequences', 'fechamento', 'dreams'
] as const;

export type GeneratorMode = typeof GENERATOR_MODES[number];

export interface GeneratorOptions {
  mode: GeneratorMode;
  count: number;
  fixedNumbers?: string[];
  excludeNumbers?: string[];
  seedNumbers?: string[];
}

function formatNum(n: number): string {
  return n.toString().padStart(2, '0');
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getAvailableNumbers(
  fixedNumbers: string[],
  excludeNumbers: string[]
): number[] {
  const excluded = new Set([...excludeNumbers, ...fixedNumbers].map(n => parseInt(n)));

  return Array.from({ length: 60 }, (_, i) => i + 1)
    .filter(n => {
      const key = formatNum(n);
      return !excluded.has(n);
    });
}

function generateRandomNumbers(count: number, pool: number[]): string[] {
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, count).map(formatNum).sort();
}

function getFrequencyMap(): Map<string, number> {
  const db = getDb();
  const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
  const freq = new Map<string, number>();
  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) {
      freq.set(n, (freq.get(n) || 0) + 1);
    }
  }
  return freq;
}

function getColdRankMap(): Map<string, number> {
  const db = getDb();
  const draws = db.prepare(
    'SELECT concurso, dezenas FROM draws ORDER BY concurso ASC'
  ).all() as { concurso: number; dezenas: string }[];

  const maxConcurso = draws.length > 0 ? draws[draws.length - 1].concurso : 0;
  const lastSeen = new Map<string, number>();

  for (let i = 1; i <= 60; i++) {
    lastSeen.set(formatNum(i), 0);
  }
  for (const d of draws) {
    const dezenas: string[] = JSON.parse(d.dezenas);
    for (const n of dezenas) {
      lastSeen.set(n, d.concurso);
    }
  }

  const coldRank = new Map<string, number>();
  for (const [num, last] of lastSeen) {
    coldRank.set(num, maxConcurso - last);
  }
  return coldRank;
}

function weightedPick(pool: number[], weights: Map<string, number>, count: number): string[] {
  const remaining = new Set(pool.map(formatNum));
  const result: string[] = [];
  const totalWeight = pool.reduce((sum, n) => sum + (weights.get(formatNum(n)) || 1), 0);

  for (let i = 0; i < count; i++) {
    let rand = Math.random() * totalWeight;
    let selected = '';
    for (const n of pool) {
      const key = formatNum(n);
      if (!remaining.has(key)) continue;
      rand -= (weights.get(key) || 1);
      if (rand <= 0) {
        selected = key;
        break;
      }
    }
    if (!selected) {
      const available = Array.from(remaining);
      selected = available[Math.floor(Math.random() * available.length)];
    }
    remaining.delete(selected);
    result.push(selected);
  }

  return result.sort();
}

export function generateNumbers(options: GeneratorOptions): string[][] {
  const {
    mode,
    count = 1,
    fixedNumbers = [],
    excludeNumbers = [],
    seedNumbers = []
  } = options;

  const actualCount = Math.min(Math.max(count, 1), 10);
  const available = getAvailableNumbers(fixedNumbers, excludeNumbers);
  const games: string[][] = [];

  for (let g = 0; g < actualCount; g++) {
    let picked: string[] = [];

    switch (mode) {
      case 'random': {
        const randomNums = generateRandomNumbers(
          6 - fixedNumbers.length, available
        );
        picked = [...fixedNumbers, ...randomNums];
        break;
      }

      case 'hot': {
        const freq = getFrequencyMap();
        const pool = available.filter(n => (freq.get(formatNum(n)) || 0) > 0);
        picked = weightedPick(
          pool.length >= 6 ? pool : available,
          freq,
          6 - fixedNumbers.length
        );
        picked = [...fixedNumbers, ...picked];
        break;
      }

      case 'cold': {
        const coldRank = getColdRankMap();
        const pool = available;
        picked = weightedPick(pool, coldRank, 6 - fixedNumbers.length);
        picked = [...fixedNumbers, ...picked];
        break;
      }

      case 'balanced': {
        const evens = available.filter(n => n % 2 === 0);
        const odds = available.filter(n => n % 2 !== 0);
        const needed = 6 - fixedNumbers.length;
        const evensNeeded = Math.floor(needed / 2);
        const oddsNeeded = needed - evensNeeded;

        const shuffledEvens = shuffleArray(evens).slice(0, evensNeeded).map(formatNum);
        const shuffledOdds = shuffleArray(odds).slice(0, oddsNeeded).map(formatNum);
        picked = [...fixedNumbers, ...shuffledEvens, ...shuffledOdds];
        break;
      }

      case 'genetic': {
        const freq = getFrequencyMap();
        const coldRank = getColdRankMap();

        const freqSorted = available
          .map(n => formatNum(n))
          .filter(n => (freq.get(n) || 0) > 0)
          .sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0));
        const coldSorted = available
          .map(n => formatNum(n))
          .sort((a, b) => (coldRank.get(b) || 0) - (coldRank.get(a) || 0));

        const hotPicks = freqSorted.slice(0, 3);
        const coldPicks = coldSorted.filter(n => !hotPicks.includes(n)).slice(0, 3);
        picked = [...fixedNumbers, ...hotPicks, ...coldPicks];
        break;
      }

      case 'sequences': {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];
        const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55];
        const seqPool = Array.from(new Set([...primes, ...fib]));

        const inPool = available.filter(n => seqPool.includes(n));
        const needed = 6 - fixedNumbers.length;
        const fromSeq = inPool.slice(0, needed);
        const rest = generateRandomNumbers(Math.max(0, needed - fromSeq.length), available);
        picked = [...fixedNumbers, ...fromSeq.map(formatNum), ...rest];
        break;
      }

      case 'fechamento': {
        const baseNums = available.slice(0, 7);
        const combos = generateCombinations(baseNums.map(formatNum), 6);
        if (combos.length > 0) {
          picked = combos[g % combos.length];
        } else {
          picked = generateRandomNumbers(6 - fixedNumbers.length, available);
        }
        picked = [...fixedNumbers, ...picked].slice(0, 6);
        break;
      }

      case 'dreams': {
        const seedPool = seedNumbers.length > 0
          ? available.filter(n => seedNumbers.includes(formatNum(n)))
          : available;
        const needed = 6 - fixedNumbers.length;

        const fromSeed = shuffleArray(seedPool).slice(0, needed);
        const remaining = generateRandomNumbers(
          Math.max(0, needed - fromSeed.length), available
        );
        picked = [...fixedNumbers, ...fromSeed.map(formatNum), ...remaining];
        break;
      }
    }

    picked = [...new Set(picked)].slice(0, 6);
    picked.sort((a, b) => parseInt(a) - parseInt(b));
    games.push(picked);
  }

  return games;
}

function generateCombinations(arr: string[], k: number): string[][] {
  const result: string[][] = [];
  function combine(start: number, current: string[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/generators.test.ts
# Expected: 4 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/generators.ts backend/src/generators.test.ts && git commit -m "feat: add number generator engine with 8 modes"
```

---

### Task 8: Generator Route

**Files:**
- Create: `backend/src/routes/generate.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create generator route**

Write `backend/src/routes/generate.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { generateNumbers, GENERATOR_MODES, GeneratorMode } from '../generators';

const router = Router();

router.get('/generate', (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'random';
    const count = parseInt(req.query.count as string) || 1;
    const fixedNumbers = req.query.fixed
      ? (req.query.fixed as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];
    const excludeNumbers = req.query.exclude
      ? (req.query.exclude as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];
    const seedNumbers = req.query.seeds
      ? (req.query.seeds as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];

    if (!GENERATOR_MODES.includes(mode as GeneratorMode)) {
      res.status(400).json({
        error: `Modo inválido. Opções: ${GENERATOR_MODES.join(', ')}`
      });
      return;
    }

    const games = generateNumbers({
      mode: mode as GeneratorMode,
      count,
      fixedNumbers,
      excludeNumbers,
      seedNumbers
    });

    res.json({ modo: mode, jogos: games });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar números' });
  }
});

router.get('/generator/modes', (_req: Request, res: Response) => {
  res.json({ modes: GENERATOR_MODES });
});

export default router;
```

- [ ] **Step 2: Update index.ts to register generator routes**

In `backend/src/index.ts`, add import and route:
```typescript
import generateRoutes from './routes/generate';
app.use('/api', generateRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/generate.ts backend/src/index.ts && git commit -m "feat: add generator API route"
```

---

### Task 9: Strategy Engine

**Files:**
- Create: `backend/src/strategies.ts`
- Create: `backend/src/strategies.test.ts`

- [ ] **Step 1: Write failing test for strategies**

Write `backend/src/strategies.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from './db';
import { executeStrategy, getStrategies } from './strategies';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/strategies.test.ts
# Expected: FAIL
```

- [ ] **Step 3: Implement strategies.ts**

Write `backend/src/strategies.ts`:
```typescript
import { getDb } from './db';
import { computeStatistics } from './statistics';

interface Strategy {
  id: string;
  nome: string;
  descricao: string;
}

interface StrategyResult {
  estrategia: Strategy;
  jogos: string[][];
}

const STRATEGIES: Strategy[] = [
  { id: 'top6', nome: 'Top 6 Históricos', descricao: 'Os 6 números mais sorteados de todos os tempos' },
  { id: 'cold6', nome: 'Atrasados 6', descricao: 'Os 6 números que não saem há mais tempo' },
  { id: 'balanced-3p3i', nome: '3P-3I Equilibrado', descricao: '3 pares + 3 ímpares mais frequentes de cada categoria' },
  { id: 'quadrants', nome: 'Quadrantes', descricao: 'Pelo menos 1 número de cada quadrante (1-15, 16-30, 31-45, 46-60)' },
  { id: 'full-cycle', nome: 'Ciclo Completo', descricao: '10 jogos cobrindo todos os 60 números' },
  { id: 'sum-target', nome: 'Soma Alvo', descricao: 'Combinações com soma no intervalo 170-190' },
  { id: 'primes-power', nome: 'Primos Power', descricao: 'Prioriza números primos com boa frequência' },
  { id: 'avg-frequency', nome: 'Frequência Média', descricao: 'Números com frequência próxima da média' },
];

export function getStrategies(): Strategy[] {
  return STRATEGIES;
}

export function executeStrategy(strategyId: string): StrategyResult {
  const strategy = STRATEGIES.find(s => s.id === strategyId);
  if (!strategy) throw new Error(`Estratégia não encontrada: ${strategyId}`);

  const stats = computeStatistics();

  let jogos: string[][] = [];

  switch (strategyId) {
    case 'top6': {
      jogos = [stats.frequency.slice(0, 6).map(f => f.numero)];
      break;
    }

    case 'cold6': {
      jogos = [stats.coldNumbers.slice(0, 6).map(c => c.numero)];
      break;
    }

    case 'balanced-3p3i': {
      const evens = stats.frequency.filter(f => parseInt(f.numero) % 2 === 0);
      const odds = stats.frequency.filter(f => parseInt(f.numero) % 2 !== 0);
      jogos = [[...evens.slice(0, 3).map(f => f.numero), ...odds.slice(0, 3).map(f => f.numero)]];
      break;
    }

    case 'quadrants': {
      const nums = stats.frequency.slice(0, 12).map(f => parseInt(f.numero));
      const q = [
        nums.filter(n => n >= 1 && n <= 15),
        nums.filter(n => n >= 16 && n <= 30),
        nums.filter(n => n >= 31 && n <= 45),
        nums.filter(n => n >= 46 && n <= 60),
      ];
      const pick = [
        (q[0][0] || q[1][0] || q[2][0] || q[3][0]).toString().padStart(2, '0'),
        (q[1][0] || q[2][0] || q[3][0] || q[0][0]).toString().padStart(2, '0'),
        (q[2][0] || q[3][0] || q[0][0] || q[1][0]).toString().padStart(2, '0'),
        (q[3][0] || q[0][0] || q[1][0] || q[2][0]).toString().padStart(2, '0'),
      ];
      const rest = stats.frequency
        .filter(f => !pick.includes(f.numero))
        .slice(0, 2)
        .map(f => f.numero);
      jogos = [[...pick, ...rest].slice(0, 6)];
      break;
    }

    case 'full-cycle': {
      const all = Array.from({ length: 60 }, (_, i) =>
        (i + 1).toString().padStart(2, '0')
      );
      for (let g = 0; g < 10; g++) {
        jogos.push(all.slice(g * 6, g * 6 + 6));
      }
      break;
    }

    case 'sum-target': {
      const pool = stats.frequency.slice(0, 30).map(f => parseInt(f.numero));
      let found = false;
      for (let attempt = 0; attempt < 1000 && !found; attempt++) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const candidate = shuffled.slice(0, 6);
        const sum = candidate.reduce((a, b) => a + b, 0);
        if (sum >= 170 && sum <= 190) {
          jogos = [candidate.map(n => n.toString().padStart(2, '0')).sort()];
          found = true;
        }
      }
      if (!found) {
        jogos = [stats.frequency.slice(0, 6).map(f => f.numero)];
      }
      break;
    }

    case 'primes-power': {
      const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
      const primeNums = stats.frequency.filter(f => primes.has(parseInt(f.numero)));
      const nonPrime = stats.frequency.filter(f => !primes.has(parseInt(f.numero)));
      jogos = [[
        ...primeNums.slice(0, 4).map(f => f.numero),
        ...nonPrime.slice(0, 2).map(f => f.numero)
      ]];
      break;
    }

    case 'avg-frequency': {
      const avg = stats.frequency.reduce((sum, f) => sum + f.frequencia, 0) / stats.frequency.length;
      const closest = [...stats.frequency]
        .sort((a, b) =>
          Math.abs(a.frequencia - avg) - Math.abs(b.frequencia - avg)
        );
      jogos = [closest.slice(0, 6).map(f => f.numero)];
      break;
    }
  }

  for (const jogo of jogos) {
    jogo.sort((a, b) => parseInt(a) - parseInt(b));
  }

  return { estrategia: strategy, jogos };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/strategies.test.ts
# Expected: 4 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/strategies.ts backend/src/strategies.test.ts && git commit -m "feat: add strategy engine with 8 strategies"
```

---

### Task 10: Strategy Route

**Files:**
- Create: `backend/src/routes/strategies.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create strategies route**

Write `backend/src/routes/strategies.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { getStrategies, executeStrategy } from '../strategies';

const router = Router();

router.get('/strategies', (_req: Request, res: Response) => {
  try {
    const strategies = getStrategies();
    res.json(strategies);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar estratégias' });
  }
});

router.get('/strategies/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = executeStrategy(id);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('não encontrada')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Falha ao executar estratégia' });
    }
  }
});

export default router;
```

- [ ] **Step 2: Update index.ts to register strategy routes**

In `backend/src/index.ts`:
```typescript
import strategiesRoutes from './routes/strategies';
app.use('/api', strategiesRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/strategies.ts backend/src/index.ts && git commit -m "feat: add strategies API routes"
```

---

### Task 11: Simulator Engine

**Files:**
- Create: `backend/src/simulator.ts`
- Create: `backend/src/simulator.test.ts`

- [ ] **Step 1: Write failing test for simulator**

Write `backend/src/simulator.test.ts`:
```typescript
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
      numbers: ['01', '02', '03', '04', '05', '06'],
      mode: 'historical'
    });

    expect(result.totalConcursos).toBe(5);
    expect(result.acertos).toHaveProperty('6');
    expect(result.acertos).toHaveProperty('5');
    expect(result.acertos).toHaveProperty('4');
    expect(result.acertos['6']).toBe(2);
  });

  it('should simulate against random draws', () => {
    const result = runSimulation({
      numbers: ['01', '02', '03', '04', '05', '06'],
      mode: 'random',
      randomCount: 100
    });

    expect(result.totalConcursos).toBe(100);
    const totalMatches = Object.values(result.acertos).reduce((a, b) => a + b, 0);
    expect(totalMatches).toBe(100);
  });

  it('should calculate percentages', () => {
    const result = runSimulation({
      numbers: ['01', '02', '03', '04', '05', '06'],
      mode: 'historical'
    });

    expect(result.porcentagens['6']).toBeCloseTo(40, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/simulator.test.ts
# Expected: FAIL
```

- [ ] **Step 3: Implement simulator.ts**

Write `backend/src/simulator.ts`:
```typescript
import { getDb } from './db';

export interface SimulationOptions {
  numbers: string[];
  mode: 'historical' | 'random';
  randomCount?: number;
}

export interface SimulationResult {
  numeros: string[];
  modo: string;
  totalConcursos: number;
  acertos: Record<string, number>;
  porcentagens: Record<string, number>;
}

function countMatches(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(n => setB.has(n)).length;
}

function generateRandomDraw(): string[] {
  const nums = new Set<number>();
  while (nums.size < 6) {
    nums.add(Math.floor(Math.random() * 60) + 1);
  }
  return Array.from(nums)
    .sort((a, b) => a - b)
    .map(n => n.toString().padStart(2, '0'));
}

export function runSimulation(options: SimulationOptions): SimulationResult {
  const { numbers, mode, randomCount = 1000 } = options;

  const acertos: Record<string, number> = { '6': 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0, '0': 0 };
  let totalConcursos = 0;

  if (mode === 'historical') {
    const db = getDb();
    const draws = db.prepare('SELECT dezenas FROM draws').all() as { dezenas: string }[];
    totalConcursos = draws.length;

    for (const draw of draws) {
      const dezenas: string[] = JSON.parse(draw.dezenas);
      const matches = countMatches(numbers, dezenas);
      acertos[String(matches)] = (acertos[String(matches)] || 0) + 1;
    }
  } else {
    totalConcursos = randomCount;
    for (let i = 0; i < randomCount; i++) {
      const draw = generateRandomDraw();
      const matches = countMatches(numbers, draw);
      acertos[String(matches)] = (acertos[String(matches)] || 0) + 1;
    }
  }

  const porcentagens: Record<string, number> = {};
  for (const key of Object.keys(acertos)) {
    porcentagens[key] = totalConcursos > 0
      ? parseFloat(((acertos[key] / totalConcursos) * 100).toFixed(2))
      : 0;
  }

  return {
    numeros: numbers,
    modo: mode === 'historical' ? 'histórico' : 'aleatório',
    totalConcursos,
    acertos,
    porcentagens
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/simulator.test.ts
# Expected: 3 tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/simulator.ts backend/src/simulator.test.ts && git commit -m "feat: add draw simulator engine"
```

---

### Task 12: Simulator Route

**Files:**
- Create: `backend/src/routes/simulate.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create simulator route**

Write `backend/src/routes/simulate.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { runSimulation } from '../simulator';

const router = Router();

router.get('/simulate', (req: Request, res: Response) => {
  try {
    const numbersStr = req.query.numbers as string;
    const mode = (req.query.mode as string) || 'historical';
    const randomCount = parseInt(req.query.count as string) || 1000;

    if (!numbersStr) {
      res.status(400).json({ error: 'Parâmetro "numbers" obrigatório (ex: ?numbers=01,02,03,04,05,06)' });
      return;
    }

    const numbers = numbersStr.split(',').map(n => n.trim().padStart(2, '0'));

    if (numbers.length !== 6) {
      res.status(400).json({ error: 'Forneça exatamente 6 números' });
      return;
    }

    const result = runSimulation({
      numbers,
      mode: mode === 'random' ? 'random' : 'historical',
      randomCount
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao executar simulação' });
  }
});

export default router;
```

- [ ] **Step 2: Update index.ts to register simulator routes**

In `backend/src/index.ts`:
```typescript
import simulateRoutes from './routes/simulate';
app.use('/api', simulateRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/simulate.ts backend/src/index.ts && git commit -m "feat: add simulator API route"
```

---

## Part 3: Frontend Setup

### Task 13: Scaffold Vite + React + Tailwind

**Files:**
- Create: `frontend/` (via Vite)

- [ ] **Step 1: Create Vite React TypeScript project**

```bash
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install Tailwind CSS and dependencies**

```bash
cd frontend && npm install
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Install additional dependencies**

```bash
cd frontend && npm install react-router-dom recharts @tanstack/react-query
```

- [ ] **Step 4: Configure Tailwind**

Write `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

Write `frontend/src/index.css`:
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
  body {
    @apply bg-gray-950 text-gray-100 antialiased;
  }
}
```

- [ ] **Step 5: Verify dev server works**

```bash
cd frontend && npm run dev
# Open http://localhost:5173 - should see Vite default page
```

- [ ] **Step 6: Commit**

```bash
git add frontend/ && git commit -m "feat: scaffold frontend with Vite + React + Tailwind CSS"
```

---

### Task 14: Setup shadcn/ui

**Files:**
- Modify: `frontend/components.json`
- Modify: `frontend/tsconfig.json`
- Create: `frontend/src/lib/utils.ts`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd frontend && npx shadcn@latest init -d
```

- [ ] **Step 2: Add shadcn components**

```bash
cd frontend && npx shadcn@latest add button card tabs table slider select badge
```

- [ ] **Step 3: Commit**

```bash
git add frontend/ && git commit -m "feat: add shadcn/ui components"
```

---

### Task 15: Layout + Router + Dark Theme

**Files:**
- Create: `frontend/src/App.tsx` (overwrite)
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/pages/Dashboard.tsx` (placeholder)
- Create: `frontend/src/pages/Gerador.tsx` (placeholder)
- Create: `frontend/src/pages/Simulador.tsx` (placeholder)
- Create: `frontend/src/pages/Estrategias.tsx` (placeholder)
- Create: `frontend/src/pages/Analise.tsx` (placeholder)

- [ ] **Step 1: Create Layout component**

Write `frontend/src/components/Layout.tsx`:
```tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar component**

Write `frontend/src/components/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Painel', icon: '📊' },
  { to: '/gerador', label: 'Gerador', icon: '🎲' },
  { to: '/simulador', label: 'Simulador', icon: '🔄' },
  { to: '/estrategias', label: 'Estratégias', icon: '🎯' },
  { to: '/analise', label: 'Análise', icon: '📈' },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 hidden md:flex flex-col gap-1">
      <div className="text-lg font-bold text-white mb-6 px-3 pt-2">
        🎰 Mega Sena
      </div>
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-green-900/50 text-green-400 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`
          }
        >
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Create placeholder pages**

Write `frontend/src/pages/Dashboard.tsx`:
```tsx
export function Dashboard() {
  return <div><h1 className="text-2xl font-bold mb-4">Painel</h1></div>;
}
```

Write `frontend/src/pages/Gerador.tsx`:
```tsx
export function Gerador() {
  return <div><h1 className="text-2xl font-bold mb-4">Gerador de Números</h1></div>;
}
```

Write `frontend/src/pages/Simulador.tsx`:
```tsx
export function Simulador() {
  return <div><h1 className="text-2xl font-bold mb-4">Simulador de Sorteios</h1></div>;
}
```

Write `frontend/src/pages/Estrategias.tsx`:
```tsx
export function Estrategias() {
  return <div><h1 className="text-2xl font-bold mb-4">Estratégias</h1></div>;
}
```

Write `frontend/src/pages/Analise.tsx`:
```tsx
export function Analise() {
  return <div><h1 className="text-2xl font-bold mb-4">Análise Completa</h1></div>;
}
```

- [ ] **Step 4: Update App.tsx with router**

Write `frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Gerador } from './pages/Gerador';
import { Simulador } from './pages/Simulador';
import { Estrategias } from './pages/Estrategias';
import { Analise } from './pages/Analise';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gerador" element={<Gerador />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/estrategias" element={<Estrategias />} />
            <Route path="/analise" element={<Analise />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 5: Test in browser**

Navigate to http://localhost:5173 and verify sidebar navigation works with placeholder pages.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ && git commit -m "feat: add layout, sidebar, router, and placeholder pages"
```

---

### Task 16: API Client + TanStack Query Hooks

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useStatistics.ts`
- Create: `frontend/src/hooks/useStatus.ts`
- Create: `frontend/src/hooks/useGenerate.ts`
- Create: `frontend/src/hooks/useStrategies.ts`
- Create: `frontend/src/hooks/useSimulate.ts`

- [ ] **Step 1: Create API client**

Write `frontend/src/lib/api.ts`:
```typescript
const BASE = '/api';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface StatusResponse {
  totalDraws: number;
  latestConcurso: number;
  lastSync: string | null;
}

export interface FrequencyItem {
  numero: string;
  frequencia: number;
  porcentagem: number;
}

export interface ColdNumberItem {
  numero: string;
  ultimoConcurso: number | null;
  concursosAtrasado: number;
}

export interface StatisticsResponse {
  totalConcursos: number;
  frequency: FrequencyItem[];
  coldNumbers: ColdNumberItem[];
  parity: {
    evenOddDistribution: Record<string, number>;
  };
}

export interface GenerateResponse {
  modo: string;
  jogos: string[][];
}

export interface Strategy {
  id: string;
  nome: string;
  descricao: string;
}

export interface StrategyResponse {
  estrategia: Strategy;
  jogos: string[][];
}

export interface SimulationResponse {
  numeros: string[];
  modo: string;
  totalConcursos: number;
  acertos: Record<string, number>;
  porcentagens: Record<string, number>;
}

export function fetchStatus(): Promise<StatusResponse> {
  return apiFetch('/status');
}

export function fetchStatistics(): Promise<StatisticsResponse> {
  return apiFetch('/statistics');
}

export function fetchGenerate(params: {
  mode?: string;
  count?: number;
  fixed?: string;
  exclude?: string;
  seeds?: string;
}): Promise<GenerateResponse> {
  const qs = new URLSearchParams();
  if (params.mode) qs.set('mode', params.mode);
  if (params.count) qs.set('count', String(params.count));
  if (params.fixed) qs.set('fixed', params.fixed);
  if (params.exclude) qs.set('exclude', params.exclude);
  if (params.seeds) qs.set('seeds', params.seeds);
  return apiFetch(`/generate?${qs.toString()}`);
}

export function fetchStrategies(): Promise<Strategy[]> {
  return apiFetch('/strategies');
}

export function fetchStrategy(id: string): Promise<StrategyResponse> {
  return apiFetch(`/strategies/${id}`);
}

export function fetchSimulate(params: {
  numbers: string;
  mode: string;
  count?: number;
}): Promise<SimulationResponse> {
  const qs = new URLSearchParams();
  qs.set('numbers', params.numbers);
  qs.set('mode', params.mode);
  if (params.count) qs.set('count', String(params.count));
  return apiFetch(`/simulate?${qs.toString()}`);
}
```

- [ ] **Step 2: Create hooks**

Write `frontend/src/hooks/useStatistics.ts`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchStatistics } from '../lib/api';

export function useStatistics() {
  return useQuery({
    queryKey: ['statistics'],
    queryFn: fetchStatistics,
  });
}
```

Write `frontend/src/hooks/useStatus.ts`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchStatus } from '../lib/api';

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 60000,
  });
}
```

Write `frontend/src/hooks/useGenerate.ts`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchGenerate } from '../lib/api';

export function useGenerate(params: {
  mode?: string;
  count?: number;
  fixed?: string;
  exclude?: string;
  seeds?: string;
}) {
  return useQuery({
    queryKey: ['generate', params],
    queryFn: () => fetchGenerate(params),
    enabled: false,
  });
}
```

Write `frontend/src/hooks/useStrategies.ts`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchStrategies, fetchStrategy } from '../lib/api';

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
  });
}

export function useStrategy(id: string | null) {
  return useQuery({
    queryKey: ['strategy', id],
    queryFn: () => fetchStrategy(id!),
    enabled: !!id,
  });
}
```

Write `frontend/src/hooks/useSimulate.ts`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchSimulate } from '../lib/api';

export function useSimulate(params: {
  numbers: string;
  mode: string;
  count?: number;
}) {
  return useQuery({
    queryKey: ['simulate', params],
    queryFn: () => fetchSimulate(params),
    enabled: false,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/ && git commit -m "feat: add API client and TanStack Query hooks"
```

---

## Part 4: Frontend Components

### Task 17: NumberBall + StatsCard Components

**Files:**
- Create: `frontend/src/components/NumberBall.tsx`
- Create: `frontend/src/components/StatsCard.tsx`

- [ ] **Step 1: Create NumberBall**

Write `frontend/src/components/NumberBall.tsx`:
```tsx
interface NumberBallProps {
  number: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'dim';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg font-bold',
};

const variantClasses = {
  default: 'bg-green-700 text-white shadow-md shadow-green-900/50',
  accent: 'bg-yellow-600 text-white shadow-md shadow-yellow-900/50',
  dim: 'bg-gray-700 text-gray-300',
};

export function NumberBall({ number, size = 'md', variant = 'default' }: NumberBallProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full flex items-center justify-center`}
    >
      {number}
    </div>
  );
}
```

- [ ] **Step 2: Create StatsCard**

Write `frontend/src/components/StatsCard.tsx`:
```tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatsCard({ title, value, subtitle }: StatsCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NumberBall.tsx frontend/src/components/StatsCard.tsx && git commit -m "feat: add NumberBall and StatsCard components"
```

---

### Task 18: FrequencyGrid + GameCard Components

**Files:**
- Create: `frontend/src/components/FrequencyGrid.tsx`
- Create: `frontend/src/components/GameCard.tsx`

- [ ] **Step 1: Create FrequencyGrid**

Write `frontend/src/components/FrequencyGrid.tsx`:
```tsx
import { NumberBall } from './NumberBall';

interface FrequencyGridProps {
  data: Array<{ numero: string; frequencia: number }>;
  title: string;
  maxValue?: number;
}

export function FrequencyGrid({ data, title, maxValue }: FrequencyGridProps) {
  const max = maxValue || Math.max(...data.map(d => d.frequencia), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      <div className="grid grid-cols-10 gap-1">
        {data.map(({ numero, frequencia }) => {
          const intensity = frequencia / max;
          const bgColor =
            intensity > 0.8
              ? 'bg-green-900/60'
              : intensity > 0.5
              ? 'bg-green-900/30'
              : intensity > 0.2
              ? 'bg-gray-800'
              : 'bg-gray-900';

          return (
            <div
              key={numero}
              className={`${bgColor} rounded p-1 text-center`}
              title={`${numero}: ${frequencia}x`}
            >
              <NumberBall number={numero} size="sm" variant={intensity > 0.5 ? 'default' : 'dim'} />
              <span className="text-[10px] text-gray-500 block mt-0.5">{frequencia}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create GameCard**

Write `frontend/src/components/GameCard.tsx`:
```tsx
import { NumberBall } from './NumberBall';

interface GameCardProps {
  numbers: string[];
  index?: number;
}

export function GameCard({ numbers, index }: GameCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-2">
      {index !== undefined && (
        <span className="text-xs text-gray-500 mr-1">#{index + 1}</span>
      )}
      {numbers.map((n) => (
        <NumberBall key={n} number={n} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FrequencyGrid.tsx frontend/src/components/GameCard.tsx && git commit -m "feat: add FrequencyGrid and GameCard components"
```

---

### Task 19: SyncStatus Component

**Files:**
- Create: `frontend/src/components/SyncStatus.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create SyncStatus component**

Write `frontend/src/components/SyncStatus.tsx`:
```tsx
import { useStatus } from '../hooks/useStatus';

export function SyncStatus() {
  const { data, isLoading, isError } = useStatus();

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <p className="text-sm text-gray-400">Carregando status...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
        <p className="text-sm text-red-400">Erro ao carregar status</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Concursos: <span className="text-white font-medium">{data?.totalDraws ?? 0}</span>
          </span>
          <span className="text-gray-400">
            Último: <span className="text-white font-medium">#{data?.latestConcurso ?? 0}</span>
          </span>
        </div>
        {data?.lastSync && (
          <span className="text-xs text-gray-500">
            Sincronizado: {new Date(data.lastSync).toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update Layout to include SyncStatus**

In `frontend/src/components/Layout.tsx`, change `main` content:
```tsx
import { SyncStatus } from './SyncStatus';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <SyncStatus />
        <div className="mt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SyncStatus.tsx frontend/src/components/Layout.tsx && git commit -m "feat: add SyncStatus component to layout"
```

---

## Part 5: Frontend Pages

### Task 20: Dashboard Page

**Files:**
- Overwrite: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Implement Dashboard**

Write `frontend/src/pages/Dashboard.tsx`:
```tsx
import { useStatistics } from '../hooks/useStatistics';
import { useStatus } from '../hooks/useStatus';
import { StatsCard } from '../components/StatsCard';
import { NumberBall } from '../components/NumberBall';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatistics();
  const { data: status } = useStatus();

  const top10 = stats?.frequency.slice(0, 10).map(f => ({
    numero: f.numero,
    frequencia: f.frequencia,
  })) ?? [];

  const cold10 = stats?.coldNumbers.slice(0, 10).map(c => ({
    numero: c.numero,
    atraso: c.concursosAtrasado,
  })) ?? [];

  if (statsLoading) {
    return <div className="text-gray-400">Carregando estatísticas...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Painel</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total de Concursos"
          value={status?.totalDraws ?? stats?.totalConcursos ?? 0}
        />
        <StatsCard
          title="Número Mais Frequente"
          value={stats?.frequency[0]?.numero ?? '-'}
          subtitle={
            stats?.frequency[0]
              ? `${stats.frequency[0].frequencia}x (${stats.frequency[0].porcentagem}%)`
              : undefined
          }
        />
        <StatsCard
          title="Maior Atraso"
          value={stats?.coldNumbers[0]?.numero ?? '-'}
          subtitle={
            stats?.coldNumbers[0]
              ? `${stats.coldNumbers[0].concursosAtrasado} concursos sem sair`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 10 Números Mais Sorteados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10}>
              <XAxis dataKey="numero" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="frequencia" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 10 Números Mais Atrasados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cold10}>
              <XAxis dataKey="numero" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="atraso" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Distribuição Pares/Ímpares</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(stats.parity.evenOddDistribution).map(([key, count]) => (
              <div key={key} className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                <span className="text-white font-medium">{key}</span>
                <p className="text-xs text-gray-400">
                  {count} concursos ({(count / stats.totalConcursos * 100).toFixed(1)}%)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard renders**

Start both backend and frontend, navigate to `/` and verify stats cards, charts, and parity distribution display.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx && git commit -m "feat: implement Dashboard page with charts"
```

---

### Task 21: Generator Page

**Files:**
- Overwrite: `frontend/src/pages/Gerador.tsx`

- [ ] **Step 1: Implement Generator**

Write `frontend/src/pages/Gerador.tsx`:
```tsx
import { useState, useCallback } from 'react';
import { fetchGenerate, GenerateResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';

const MODES = [
  { value: 'random', label: 'Aleatório Puro' },
  { value: 'hot', label: 'Quentes (mais sorteados)' },
  { value: 'cold', label: 'Frios (mais atrasados)' },
  { value: 'balanced', label: 'Balanceado (3P-3I)' },
  { value: 'genetic', label: 'Genético (Quentes + Frios)' },
  { value: 'sequences', label: 'Sequências (Primos/Fibonacci)' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'dreams', label: 'Sonhos (com seed)' },
];

export function Gerador() {
  const [mode, setMode] = useState('random');
  const [count, setCount] = useState(1);
  const [fixed, setFixed] = useState('');
  const [exclude, setExclude] = useState('');
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchGenerate({
        mode,
        count,
        fixed: fixed || undefined,
        exclude: exclude || undefined,
        seeds: seed || undefined,
      });
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mode, count, fixed, exclude, seed]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Gerador de Números</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Modo</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            >
              {MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Quantidade de Jogos (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Números Fixos (ex: 01,15,30)</label>
            <input
              type="text"
              value={fixed}
              onChange={e => setFixed(e.target.value)}
              placeholder="01,15,30"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Números Excluídos (ex: 58,59,60)</label>
            <input
              type="text"
              value={exclude}
              onChange={e => setExclude(e.target.value)}
              placeholder="58,59,60"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>

          {mode === 'dreams' && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Números Semente (ex: 07,13,21)</label>
              <input
                type="text"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="07,13,21"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
          >
            {loading ? 'Gerando...' : '🎲 Gerar Números'}
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Modo: <span className="text-white capitalize">{results.modo}</span>
          </p>
          {results.jogos.map((jogo, i) => (
            <GameCard key={i} numbers={jogo} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Gerador.tsx && git commit -m "feat: implement Generator page"
```

---

### Task 22: Simulator Page

**Files:**
- Overwrite: `frontend/src/pages/Simulador.tsx`

- [ ] **Step 1: Implement Simulator**

Write `frontend/src/pages/Simulador.tsx`:
```tsx
import { useState, useCallback } from 'react';
import { fetchSimulate, SimulationResponse } from '../lib/api';
import { NumberBall } from '../components/NumberBall';

export function Simulador() {
  const [numbers, setNumbers] = useState('');
  const [mode, setMode] = useState('historical');
  const [randomCount, setRandomCount] = useState(1000);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = useCallback(async () => {
    const parsed = numbers.split(',').map(n => n.trim());
    if (parsed.length !== 6) return;

    setLoading(true);
    try {
      const res = await fetchSimulate({
        numbers: numbers.replace(/\s/g, ''),
        mode,
        count: mode === 'random' ? randomCount : undefined,
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [numbers, mode, randomCount]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Simulador de Sorteios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Seus 6 Números (separados por vírgula)
            </label>
            <input
              type="text"
              value={numbers}
              onChange={e => setNumbers(e.target.value)}
              placeholder="01,02,03,04,05,06"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Modo</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            >
              <option value="historical">Contra Histórico Real</option>
              <option value="random">Sorteios Aleatórios</option>
            </select>
          </div>

          {mode === 'random' && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Quantidade de Sorteios</label>
              <input
                type="number"
                min={100}
                max={100000}
                step={100}
                value={randomCount}
                onChange={e => setRandomCount(parseInt(e.target.value) || 1000)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSimulate}
            disabled={loading || numbers.split(',').filter(n => n.trim()).length !== 6}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
          >
            {loading ? 'Simulando...' : '🔄 Executar Simulação'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Resultados — {result.totalConcursos.toLocaleString('pt-BR')} concursos ({result.modo})
          </h3>

          <div className="flex gap-3 mb-4">
            {result.numeros.map(n => (
              <NumberBall key={n} number={n} size="lg" />
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 text-gray-400"></th>
                  <th className="text-center py-3 text-yellow-400">6 acertos</th>
                  <th className="text-center py-3 text-purple-400">5 acertos</th>
                  <th className="text-center py-3 text-blue-400">4 acertos</th>
                  <th className="text-center py-3 text-gray-400">3 acertos</th>
                  <th className="text-center py-3 text-gray-400">0-2 acertos</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 font-medium">Ocorrências</td>
                  {['6', '5', '4', '3'].map(k => (
                    <td key={k} className="text-center py-3 font-mono">
                      {result.acertos[k]?.toLocaleString('pt-BR') ?? 0}
                    </td>
                  ))}
                  <td className="text-center py-3 font-mono text-gray-500">
                    {((result.acertos['2'] ?? 0) + (result.acertos['1'] ?? 0) + (result.acertos['0'] ?? 0)).toLocaleString('pt-BR')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-gray-400 text-xs">Porcentagem</td>
                  {['6', '5', '4', '3'].map(k => (
                    <td key={k} className="text-center py-3 text-xs text-gray-400">
                      {result.porcentagens[k]?.toFixed(4)}%
                    </td>
                  ))}
                  <td className="text-center py-3 text-xs text-gray-500">
                    {(
                      (result.porcentagens['2'] ?? 0) +
                      (result.porcentagens['1'] ?? 0) +
                      (result.porcentagens['0'] ?? 0)
                    ).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Simulador.tsx && git commit -m "feat: implement Simulator page"
```

---

### Task 23: Strategies Page

**Files:**
- Overwrite: `frontend/src/pages/Estrategias.tsx`

- [ ] **Step 1: Implement Strategies**

Write `frontend/src/pages/Estrategias.tsx`:
```tsx
import { useState, useCallback } from 'react';
import { useStrategies } from '../hooks/useStrategies';
import { fetchStrategy, StrategyResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';

export function Estrategias() {
  const { data: strategies, isLoading } = useStrategies();
  const [selectedResult, setSelectedResult] = useState<StrategyResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleExecute = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetchStrategy(id);
      setSelectedResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }, []);

  if (isLoading) {
    return <div className="text-gray-400">Carregando estratégias...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Estratégias</h1>
      <p className="text-sm text-gray-400">
        Combinações pré-definidas baseadas em padrões estatísticos.
        Clique em "Executar" para gerar os números.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies?.map(s => (
          <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-white font-medium">{s.nome}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-3">{s.descricao}</p>
            <button
              onClick={() => handleExecute(s.id)}
              disabled={loadingId === s.id}
              className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white px-4 py-1.5 rounded-md text-sm transition-colors"
            >
              {loadingId === s.id ? 'Executando...' : '🎯 Executar'}
            </button>
          </div>
        ))}
      </div>

      {selectedResult && (
        <div className="space-y-3 mt-6">
          <h3 className="text-lg font-medium">
            {selectedResult.estrategia.nome}
          </h3>
          {selectedResult.jogos.map((jogo, i) => (
            <GameCard key={i} numbers={jogo} index={selectedResult.jogos.length > 1 ? i : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Estrategias.tsx && git commit -m "feat: implement Strategies page"
```

---

### Task 24: Analysis Page

**Files:**
- Overwrite: `frontend/src/pages/Analise.tsx`

- [ ] **Step 1: Implement Analysis**

Write `frontend/src/pages/Analise.tsx`:
```tsx
import { useStatistics } from '../hooks/useStatistics';
import { FrequencyGrid } from '../components/FrequencyGrid';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Analise() {
  const { data: stats, isLoading } = useStatistics();

  if (isLoading) {
    return <div className="text-gray-400">Carregando análise...</div>;
  }

  if (!stats) {
    return <div className="text-red-400">Erro ao carregar dados.</div>;
  }

  const parityData = Object.entries(stats.parity.evenOddDistribution).map(([key, value]) => ({
    distribuicao: key,
    concursos: value,
    porcentagem: (value / stats.totalConcursos * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Análise Completa</h1>

      <FrequencyGrid
        title="Frequência de Todos os Números (01-60)"
        data={stats.frequency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Distribuição Pares/Ímpares</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={parityData}>
              <XAxis dataKey="distribuicao" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="concursos" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 15 Números Mais Frequentes</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {stats.frequency.slice(0, 15).map((f, i) => (
              <div key={f.numero} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <span className="text-white font-medium">{f.numero}</span>
                </div>
                <div className="text-gray-400">
                  {f.frequencia}x <span className="text-gray-600">({f.porcentagem}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 15 Números Mais Atrasados</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {stats.coldNumbers.slice(0, 15).map((c, i) => (
              <div key={c.numero} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <span className="text-white font-medium">{c.numero}</span>
                </div>
                <div className="text-gray-400">
                  {c.concursosAtrasado} concursos
                  {c.ultimoConcurso !== null && (
                    <span className="text-gray-600 ml-2">(último: {c.ultimoConcurso})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Analise.tsx && git commit -m "feat: implement Analysis page"
```

---

## Part 6: Integration

### Task 25: Final Wiring + Verification

**Files:**
- Create: `.gitignore`
- Modify: `frontend/src/main.tsx` (verify)
- Create: `backend/src/routes/sync.ts` (POST /api/sync trigger)

- [ ] **Step 1: Create .gitignore**

Write `.gitignore`:
```
node_modules/
dist/
.env
.superpowers/
backend/data/*.db
*.log
```

- [ ] **Step 2: Clean up main.tsx**

Ensure `frontend/src/main.tsx` contains only:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Full integration test**

```bash
# Terminal 1: Start backend
cd backend && npm run dev
# Expected: "Database initialized" + "Sync complete" + "Backend running on port 3001"

# Terminal 2: Start frontend
cd frontend && npm run dev
# Navigate to http://localhost:5173

# Verify:
# - Dashboard loads with real stats
# - Generator produces numbers
# - Simulator runs against historical data
# - Strategies execute and show results
# - Analysis page renders frequency grid and charts
```

- [ ] **Step 4: Final commit**

```bash
git add .gitignore backend/package.json frontend/src/main.tsx && git commit -m "feat: final integration and cleanup"
```

---
