# Histórico Detalhado de Sorteios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist official prize data and add a responsive `/sorteios` workspace to browse, filter, and analyze every historical Mega-Sena draw.

**Architecture:** Extend the existing SQLite draw record with nullable prize/result metadata, normalize external API responses in `sync.ts`, and expose a dedicated Express router for paginated summaries, full draw details, and per-draw analysis. Add typed frontend API hooks and a route-level `Sorteios` page that composes a searchable list with a selected-draw detail panel.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, Vitest, React 19, React Router 7, TanStack Query, Tailwind CSS 4, Recharts.

## Global Constraints

- Preserve the current behavior of generation, simulation, general statistics, and `/api/status`.
- Preserve official draw, prize, accumulation, winner-location, and next-draw fields when returned by the external service.
- Keep records without historical prize fields valid and show a clear unavailable-data state.
- Use paginated draw queries; do not load the entire historical dataset into the browser at once.
- Use the existing navy/blue/yellow design system and accessible loading, error, empty, and focus states.
- Do not add dependencies.

## File map

- Modify `backend/src/db.ts`: compatible schema for nullable draw metadata and existing databases.
- Modify `backend/src/sync.ts`: external response normalization, persistence, and latest status enrichment.
- Create `backend/src/draws.ts`: summary/detail queries and per-draw analysis calculations.
- Create `backend/src/routes/draws.ts`: paginated list, detail, and analysis endpoints.
- Modify `backend/src/index.ts`: mount the draws router.
- Modify `backend/src/routes/status.ts` only if status response typing/route composition needs adjustment; keep status payload backward-compatible.
- Modify/create backend tests for sync, draw queries, analysis, and routes.
- Modify `frontend/src/lib/api.ts`: draw domain types and fetch functions.
- Create `frontend/src/hooks/useDraws.ts`: TanStack Query hooks for list/detail/analysis.
- Create `frontend/src/pages/Sorteios.tsx`: filters, paginated list, selection, detail, and analysis UI.
- Modify `frontend/src/App.tsx`: add `/sorteios` route.
- Modify `frontend/src/components/Sidebar.tsx`: add Sorteios navigation entry.
- Create focused frontend draw components only if `Sorteios.tsx` would exceed the existing page complexity; keep each component responsible for one panel.

### Task 1: Extend persistence and normalize synchronization data

**Files:**
- Modify: `backend/src/db.ts`
- Modify: `backend/src/sync.ts`
- Modify: `backend/src/sync.test.ts`

**Interfaces:**
- `ApiResultado` must accept optional fields `local`, `concursoEspecial`, `dezenasOrdemSorteio`, `premiacoes`, `estadosPremiados`, `localGanhadores`, `acumulou`, `proximoConcurso`, `dataProximoConcurso`, `valorArrecadado`, `valorAcumuladoConcurso_0_5`, `valorAcumuladoConcursoEspecial`, `valorAcumuladoProximoConcurso`, and `valorEstimadoProximoConcurso`.
- Persist draw records using a stable `DrawRecord` shape with nullable optional fields and JSON strings only for arrays.

- [ ] Add nullable columns to `draws` for the official metadata, keeping `concurso`, `data`, and `dezenas` unchanged and using `ALTER TABLE` checks so existing databases upgrade without deletion.
- [ ] Add a `DrawPrize` interface with `descricao`, `faixa`, `ganhadores`, and `valorPremio`; add a `DrawRecord` interface for the complete persisted shape.
- [ ] Write a sync test with a mocked response containing `premiacoes`, `acumulou`, winner locations, and next-draw data; assert every field survives the insert and JSON arrays round-trip.
- [ ] Write a compatibility test that inserts an old three-column row, runs initialization/sync, and asserts the row remains readable with null optional fields.
- [ ] Update `syncResults()` to bind optional values as `null`, preserve zero values such as `ganhadores: 0`, and use `dezenasOrdemSorteio` when supplied.
- [ ] Update `getSyncStatus()` to include enriched `latestDraw` fields while retaining existing keys and behavior.
- [ ] Run `npm test -- --run backend/src/sync.test.ts` from `backend`; expected result is all sync tests passing.

### Task 2: Add draw query and analysis domain services

**Files:**
- Create: `backend/src/draws.ts`
- Create: `backend/src/draws.test.ts`

**Interfaces:**
- `listDraws(input: { page: number; limit: number; search?: string; from?: string; to?: string; accumulated?: boolean }): { items: DrawSummary[]; page: number; limit: number; total: number; totalPages: number }`.
- `getDraw(concurso: number): DrawRecord | null`.
- `analyzeDraw(concurso: number): DrawAnalysis | null`.
- `DrawAnalysis` contains `sum`, `evenCount`, `oddCount`, `rangeDistribution: { first: number; second: number; third: number }`, and `historicalComparison` with historical averages for sum, even count, and each range count.

- [ ] Write failing tests for list pagination, exact/partial contest search, inclusive date range filtering, accumulated filtering, and descending contest order.
- [ ] Write failing tests for a detail lookup and a missing contest returning null.
- [ ] Write failing tests for analysis using known six-number fixtures; assert sum, parity, 01–20/21–40/41–60 counts, and historical averages from all stored draws.
- [ ] Implement parameterized SQLite queries with bounded `limit` (1–100), page normalization, total count, and summary projection that excludes large JSON metadata.
- [ ] Implement detail hydration that parses JSON fields and converts nullable database values without turning `0` into null.
- [ ] Implement analysis using sorted draw numbers, plus historical averages calculated from all draws with six valid numbers.
- [ ] Run `npm test -- --run backend/src/draws.test.ts`; expected result is all domain tests passing.

### Task 3: Expose dedicated draw endpoints

**Files:**
- Create: `backend/src/routes/draws.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/src/routes/draws.test.ts`

**Interfaces:**
- `GET /api/draws?page=1&limit=20&search=&from=&to=&accumulated=` returns `{ items, page, limit, total, totalPages }`.
- `GET /api/draws/:concurso` returns a complete `DrawRecord`, or HTTP 404 with `{ error: 'Concurso não encontrado' }`.
- `GET /api/draws/:concurso/analysis` returns `DrawAnalysis`, or the same 404 shape.

- [ ] Write route tests for default list, query parameter forwarding, detail success/404, and analysis success/404 using the test database.
- [ ] Mount the router at `/api/draws` without changing existing route prefixes.
- [ ] Parse boolean `accumulated` strictly (`true`/`false` only), reject invalid contest numbers with HTTP 400, and return HTTP 500 with the existing Portuguese error style for unexpected failures.
- [ ] Run `npm test -- --run backend/src/routes/draws.test.ts`; expected result is all route tests passing.

### Task 4: Add typed frontend data access and navigation

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useDraws.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

**Interfaces:**
- Add frontend types `DrawSummary`, `DrawRecord`, `DrawPrize`, `DrawAnalysis`, and `DrawListResponse` matching the backend JSON shapes.
- Add `fetchDraws(params: DrawFilters): Promise<DrawListResponse>`, `fetchDraw(concurso: number): Promise<DrawRecord>`, and `fetchDrawAnalysis(concurso: number): Promise<DrawAnalysis>`.
- Add hooks `useDraws(filters)`, `useDraw(concurso)`, and `useDrawAnalysis(concurso)` with stable query keys.

- [ ] Add the exact TypeScript types and fetch functions using the existing `apiFetch` helper and query-string serialization that omits empty filters.
- [ ] Add hooks that disable detail/analysis queries until a contest is selected and keep previous list data while filters change.
- [ ] Add `/sorteios` to the router and add a navigation item with an existing lucide icon; preserve all current paths.
- [ ] Run `npm run lint && npm run build` from `frontend`; expected result is clean lint and successful build.

### Task 5: Build the Sorteios page

**Files:**
- Create: `frontend/src/pages/Sorteios.tsx`
- Create: `frontend/src/components/DrawFilters.tsx` if extracted
- Create: `frontend/src/components/DrawList.tsx` if extracted
- Create: `frontend/src/components/DrawDetail.tsx` if extracted

- [ ] Add the page heading without relying on a duplicated global title, plus total-count context and explanatory copy.
- [ ] Implement controlled filters for contest search, `from`, `to`, and accumulated status; reset pagination to 1 whenever a filter changes.
- [ ] Render a paginated list with contest, date, sorted number balls, accumulated/winner status, and main-prize summary; select the newest contest initially.
- [ ] Render the selected detail with draw location, order of draw, number balls, prize rows, winner locations, accumulated/next-draw metrics, and missing-prize fallback copy.
- [ ] Render analysis cards for sum, parity, three number ranges, and historical comparison values.
- [ ] Add previous/next contest navigation using the selected contest number and disable it while detail data is loading or at boundaries.
- [ ] Add explicit loading, error, empty-list, missing-detail, and no-analysis states using the existing status/surface classes.
- [ ] Ensure mobile layout stacks list before detail, controls remain usable, and dense prize/location tables scroll only within their own surfaces.
- [ ] Run `npm run lint && npm run build`; expected result is clean lint and successful production build.

### Task 6: End-to-end verification and regression coverage

**Files:**
- Verify: all backend and frontend files above
- Modify: backend tests only if a regression is found

- [ ] Run the complete backend suite with `npm test` from `backend`; expected result is all existing and new tests passing.
- [ ] Run `npm run lint && npm run build` from `frontend`; expected result is clean lint and successful build, with only the known Vite bundle-size advisory if it remains.
- [ ] Start backend and frontend together, then verify `/`, `/gerador`, `/simulador`, `/analise`, and `/sorteios` load without route errors.
- [ ] Verify list pagination, contest search, date/status filters, automatic newest selection, detail loading, analysis values, previous/next navigation, and old-record fallback.
- [ ] Verify desktop/tablet/mobile layout, keyboard focus, readable contrast, and that only intended dense tables scroll horizontally.
- [ ] Run `git diff --check`; expected result is no whitespace errors.

