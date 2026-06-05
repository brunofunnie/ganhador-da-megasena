# Ganhador da Mega Sena — Design Doc

**Date:** 2026-06-04
**Status:** Approved

---

## 1. Overview

Full-stack application for Mega Sena lottery statistics, analysis, number generation, strategy exploration, and draw simulation. Built with Express.js backend and React SPA frontend. All text in Portuguese (BR).

## 2. Architecture

```
[External API: loteriascaixa-api.herokuapp.com]
                |
                v
[Express Backend :3001]  <-->  [SQLite Cache]
                |
                v
[React SPA (Vite) :5173]
```

- **Backend** (Express + TypeScript) fetches all Mega Sena results from external API on startup, stores in SQLite, computes statistics on-demand.
- **Frontend** (Vite + React + Tailwind + shadcn/ui) calls backend REST endpoints.
- **No external database server** — SQLite is self-contained.

## 3. Backend

### 3.1 SQLite Schema

```sql
CREATE TABLE draws (
  concurso INTEGER PRIMARY KEY,
  data TEXT,
  dezenas TEXT  -- JSON array: ["04","06","13","21","26","28"]
);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### 3.2 Startup Flow

1. On startup, backend checks `sync_meta` for last sync status
2. If no data or stale, fetches `GET /api/megasena` from external API
3. Stores all draws in SQLite (upsert by concurso)
4. Updates `sync_meta` with timestamp and latest concurso
5. `POST /api/sync` available for manual re-sync

### 3.3 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Sync status, total draws, last update |
| GET | `/api/statistics` | All statistics (frequency, cold, percentages, parity) |
| GET | `/api/generate?mode=X&count=N&fixed=1,2&exclude=3,4` | Generate numbers |
| GET | `/api/strategies` | List strategy templates |
| GET | `/api/strategies/:id` | Execute a specific strategy |
| GET | `/api/simulate?numbers=1,2,3,4,5,6&mode=historical|random&count=100` | Run simulation |
| POST | `/api/sync` | Force re-sync from external API |

### 3.4 Statistics Computation (server-side, on each request)

- **Frequency**: Count occurrences of each number (01-60) across all draws
- **Cold numbers**: For each number, find draws since last appearance
- **Percentages**: count / total_draws * 100 per number
- **Parity distribution**: Distribution of even/odd ratios (0-6, 1-5, ..., 6-0)

### 3.5 Generator Modes

1. `random` — Pure random 6 numbers
2. `hot` — Weighted by historical frequency
3. `cold` — Weighted by longest absence
4. `balanced` — 3 even + 3 odd, sum in 170-190, spread across quadrants
5. `genetic` — 3 hot + 3 cold
6. `sequences` — Fibonacci, primes, multiples, dates
7. `fechamento` — Mathematical coverage guarantee (e.g., 7 numbers → 7 games)
8. `dreams` — User provides seed numbers, generator completes with stats

Generator params: mode, count (1-10), fixed numbers, excluded numbers, seed.

### 3.6 Strategies

Deterministic functions that return pre-built games based on stats:

1. `top6` — 6 most frequent numbers
2. `cold6` — 6 most delayed numbers
3. `balanced-3p3i` — 3 even + 3 odd, most frequent in each category
4. `quadrants` — At least 1 from each quadrant (1-15, 16-30, 31-45, 46-60)
5. `full-cycle` — 10 games covering all 60 numbers
6. `sum-target` — Combos with sum in 170-190 range
7. `primes-power` — Prioritize prime numbers (15 primes in 1-60)
8. `avg-frequency` — Numbers closest to mean frequency

### 3.7 Simulator

Modes:
- `historical` — Test against all real draws, count 4/5/6 matches
- `random` — Generate N random draws, test game
- `period` — Filter by date range or last N draws

Results: breakdown by 6/5/4/0-3 matches with percentages.
Extra: Game comparator (compare up to 5 games side-by-side).

## 4. Frontend

### 4.1 Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS v3
- shadcn/ui components (Card, Button, Select, Tabs, Table, Slider)
- React Router for SPA navigation
- Recharts for charts (bar, pie)
- TanStack Query for data fetching/caching
- Dark theme by default

### 4.2 Pages

| Route | Page | Content |
|-------|------|---------|
| `/` | Painel | Overview cards, top numbers chart, cold numbers chart, sync status |
| `/gerador` | Gerador | Mode selector, params, generated number grids, save to history |
| `/simulador` | Simulador | Input numbers, simulation mode, results table, game comparator |
| `/estrategias` | Estratégias | Strategy cards, view/execute, generated games |
| `/analise` | Análise | Full frequency grid (01-60), parity charts, quadrant distribution |

### 4.3 Layout

- Top navbar with app name + page links
- Left sidebar with nav items (icon + label)
- Main content area (responsive)
- All text in Portuguese (BR)

### 4.4 Reusable Components

- `NumberBall` — Circular ball with number (green/yellow/blue variants)
- `StatsCard` — Summary stat card with title, value, trend
- `FrequencyGrid` — 60-cell grid colored by frequency heatmap
- `GameCard` — Display a 6-number game with copy/share
- `SyncStatus` — Shows last sync date, manual sync button

## 5. Project Structure

```
ganhadordamegasena/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server entry
│   │   ├── db.ts             # SQLite setup + queries
│   │   ├── sync.ts           # External API fetch + sync logic
│   │   ├── statistics.ts     # Stats computation
│   │   ├── generators.ts     # Generator modes
│   │   ├── strategies.ts     # Strategy functions
│   │   ├── simulator.ts      # Simulation engine
│   │   └── routes/
│   │       ├── status.ts
│   │       ├── statistics.ts
│   │       ├── generate.ts
│   │       ├── strategies.ts
│   │       └── simulate.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx           # Router setup
│   │   ├── components/
│   │   │   ├── NumberBall.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   ├── FrequencyGrid.tsx
│   │   │   ├── GameCard.tsx
│   │   │   └── SyncStatus.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Generator.tsx
│   │   │   ├── Simulator.tsx
│   │   │   ├── Strategies.tsx
│   │   │   └── Analysis.tsx
│   │   └── lib/
│   │       └── api.ts        # Backend API client
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── README.md
```

## 6. Testing Strategy

- Backend: Vitest unit tests for statistics, generators, strategies, simulator logic
- Frontend: Vitest + React Testing Library for components
- Backend integration: Test API routes with in-memory SQLite

## 7. Notes

- External API base URL: `https://loteriascaixa-api.herokuapp.com/api`
- Mega Sena: numbers 01-60, 6 numbers per draw, ~2620 draws
- SQLite file: `backend/data/megasena.db`
- First sync on startup may take a few seconds (~2600 draws to fetch)
- Frontend proxies to backend via Vite dev server proxy or explicit CORS
