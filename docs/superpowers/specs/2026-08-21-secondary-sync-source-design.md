# Secondary Sync Source — guidi loteria_api

**Date:** 2026-08-21
**Status:** Approved design
**Feature:** Add the [guidi/loteria_api](https://github.com/guidi/loteria_api) service as a second data source for Mega-Sena results, and let the user pick which source the sync button uses.

## Context

Today the backend (`backend/src/sync.ts`) fetches the entire Mega-Sena history in a single request from `https://loteriascaixa-api.herokuapp.com/api/megasena`, then `INSERT OR REPLACE`s every draw into SQLite. The frontend sync button (`frontend/src/components/SyncStatus.tsx`) simply `POST /api/sync`.

We want a second source: the public `guidi` lotteries API at `https://api.guidi.dev.br/loteria`, which only serves **one draw per request** — `…/megasena/ultimo` or `…/megasena/{concurso}`. It has no "list all draws" endpoint, and its response fields differ from ours.

Decisions (confirmed with the user):
1. **Guidi sync is incremental append** — fetch `ultimo` and only the draws missing after the current newest, because history already lives in our DB and guidi rate-limits.
2. **The chosen source is persisted in the backend DB** (`sync_meta`), so both startup sync and future manual syncs use it.
3. **The selector is a dropdown in the sync status bar**, next to the sync button.

## Design

### Data source identifiers

- `type SyncSource = 'caixa' | 'guidi'`.
- `const SYNC_SOURCES: SyncSource[] = ['caixa', 'guidi']`.
- Default remains `caixa`.

### Backend — `backend/src/sync.ts`

Refactor so both sources normalize to the shared `StoredDraw` shape and share one persistence path:

- Extract the existing DB insert + transaction into `persistDraws(draws: StoredDraw[]): { inserted: number; total: number }`. It runs the `INSERT OR REPLACE INTO draws …` loop and writes `last_sync` and `total_draws` into `sync_meta`.
- Keep `normalizeDraw(result: ApiResultado): StoredDraw` for the Caixa shape.
- Add `normalizeGuidiDraw(dto: GuidiResult): StoredDraw` mapping guidi fields to ours:

  | guidi field | our field |
  |---|---|
  | `numero` | `concurso` |
  | `dataApuracao` | `data` (dd/MM/yyyy — same format) |
  | `listaDezenas` | `dezenas` |
  | `localSorteio` (fallback `nomeMunicipioUFSorteio`) | `local` |
  | `indicadorConcursoEspecial` | `concursoEspecial` (`Number`) |
  | `dezenasSorteadasOrdemSorteio` | `dezenasOrdemSorteio` |
  | `listaRateioPremio` → `{ descricaoFaixa→descricao, faixa, numeroDeGanhadores→ganhadores, valorPremio }` | `premiacoes` |
  | `listaMunicipioUFGanhadores` | `localGanhadores`; `estadosPremiados` = unique `uf` values |
  | `acumulado` | `acumulou` (`Number`) |
  | `numeroConcursoProximo` | `proximoConcurso` |
  | `dataProximoConcurso` | `dataProximoConcurso` |
  | `valorArrecadado`, `valorAcumuladoConcurso_0_5`, `valorAcumuladoConcursoEspecial`, `valorAcumuladoProximoConcurso`, `valorEstimadoProximoConcurso` | same names |

- Add `caixaSync(): Promise<{inserted,total}>` = the current full-list + `/latest` merge logic, then `persistDraws`.
- Add `guidISync(): Promise<{inserted,total}>`:
  1. GET `{LOTERIA_GUIDI_BASE_URL}/megasena/ultimo` — required anchor; throws on failure.
  2. Compute current `max(concurso)` from DB.
  3. Best-effort GET each missing concurso `max+1 … ultimo.numero - 1`; skip failures (a skipped draw must not abort the sync).
  4. Append `ultimo`.
  5. `normalizeGuidiDraw` each and `persistDraws`.
- Change `syncResults(source: SyncSource)` to dispatch to `caixaSync` / `guidISync`, then persist `last_sync_source` into `sync_meta`.
- Add `getSyncSource()`, `setSyncSource(source)` (validates against `SYNC_SOURCES`), and return `syncSource` from `getSyncStatus()`.
- Make the guidi base URL configurable: `const GUIDI_BASE = process.env.LOTERIA_GUIDI_BASE_URL || 'https://api.guidi.dev.br/loteria'`. This lets the user self-host the guidi Docker image and point at their own instance (the hosted API blocks non-Brazil IPs and rate-limits).

### Backend — `backend/src/routes/status.ts`

- `POST /api/sync?source=caixa|guidi`: read `req.query.source`; default to persisted source; validate; `syncResults(source)`; persist source; respond `{ mensagem, inserted, total, source }`. Invalid source → 400.
- `PUT /api/sync-source` with body `{ source }`: validate and persist the choice **without syncing** (so the dropdown "remembers" even if the user never clicks sync). Returns the current status.
- `GET /status` now includes `syncSource` in the response.

### Frontend

- **`frontend/src/lib/api.ts`**
  - `export type SyncSource = 'caixa' | 'guidi'`.
  - `triggerSync(source: SyncSource)` → `POST /api/sync?source=<source>`.
  - `setSyncSource(source)` → `PUT /api/sync-source`.
  - `StatusResponse` gains `syncSource: SyncSource`.
- **`frontend/src/hooks/useSync.ts`** — accept and forward the selected source to `triggerSync`.
- **`frontend/src/hooks/useStatus.ts`** — expose `syncSource` from status (already returns `data`).
- **`frontend/src/components/SyncStatus.tsx`**
  - Add a small `<select>` ("Caixa API" / "Guidi API") beside the sync button.
  - Initialize from `status.syncSource` (persisted value).
  - On change: optimistic local update + `setSyncSource` mutation (persist).
  - Clicking sync runs the mutation with the currently selected source.

### Error handling

- `ultimo` fetch failure or an invalid `source` → 500/400 with a clear message.
- Missing gap draws are best-effort: a skipped concurso does not abort the sync; `ultimo` is always merged.
- guidi hosted API may return 429 (rate limit) or 403 (non-Brazil IP) — surfaced as the sync error message shown in the status bar. Self-hosting via `LOTERIA_GUIDI_BASE_URL` avoids this.

### Testing — `backend/src/sync.test.ts`

- Mock guidi `/ultimo` and individual concurso endpoints.
- Assert incremental behavior: pre-seeded newest draw, then a sync from `guidi` only inserts the newer draws.
- Assert field mapping (`numero→concurso`, `dataApuracao→data`, `listaRateioPremio→premiacoes`, `acumulado→acumulou`, etc.).
- Assert `last_sync_source` is persisted and `getSyncStatus().syncSource` reflects it.

## Out of scope

- No full-history rebuild from guidi (no bulk endpoint; history already present).
- No change to how the Caixa source syncs.
- No new UI beyond the dropdown in the status bar.
