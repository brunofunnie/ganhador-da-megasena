# Wallet Check-Draw Concurso Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose which Mega-Sena concurso to check wallet games against, instead of always checking against the latest draw.

**Architecture:** All changes are in the frontend. `WalletDetailView` (in `frontend/src/pages/Carteiras.tsx`) gains a `checkConcurso` state and a stepper UI (`◀ [input] ▶`) shown while check mode is on. The drawn numbers come from the existing `useDraw(concurso)` React Query hook (backend route `GET /api/draws/:concurso` already exists) instead of `status.latestDraw`. The hook gets `placeholderData: keepPreviousData` so navigating between concursos doesn't flicker.

**Tech Stack:** React 19 + TypeScript, TanStack React Query, Tailwind CSS, lucide-react icons, Vite.

**Spec:** `docs/superpowers/specs/2026-08-06-check-draw-picker-design.md`

## Global Constraints

- No backend changes.
- Only `WalletDetailView` in `frontend/src/pages/Carteiras.tsx` and `frontend/src/hooks/useDraws.ts` change.
- Button label copy: `Checar sorteio` (was `Checar com o sorteio atual`).
- Error copy: `Concurso não encontrado`.
- Hits column header copy: `Acertos ({checkConcurso})` e.g. `Acertos (2870)`.
- Concurso bounds: min `1`, max `status.latestDraw.concurso`.
- The frontend has NO test runner (no vitest/jest). Verification is `npm run build` (runs `tsc -b`), `npm run lint`, and a manual dev-server check. Do not add test infrastructure.
- All commands run from `frontend/`: `/Users/bruno/projects/funnietech/apps/ganhadordamegasena/frontend`.

---

### Task 1: `useDraw` keeps previous data while navigating

**Files:**
- Modify: `frontend/src/hooks/useDraws.ts:12-18`

**Interfaces:**
- Consumes: existing `fetchDraw(concurso: number): Promise<DrawRecord>` from `../lib/api`.
- Produces: `useDraw(concurso: number | null | undefined)` — unchanged signature, now returns previous draw's data as placeholder while a new concurso is being fetched. Task 2 relies on this exact hook.

- [ ] **Step 1: Add `placeholderData: keepPreviousData` to `useDraw`**

In `frontend/src/hooks/useDraws.ts`, change the `useDraw` function (the file already imports `keepPreviousData` on line 1):

```typescript
export function useDraw(concurso: number | null | undefined) {
  return useQuery({
    queryKey: ['draw', concurso],
    queryFn: () => fetchDraw(concurso as number),
    enabled: typeof concurso === 'number' && concurso > 0,
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/bruno/projects/funnietech/apps/ganhadordamegasena/frontend && npm run build`
Expected: exits 0 (`tsc -b` + `vite build` succeed).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useDraws.ts
git commit -m "feat: keep previous draw data while fetching another concurso"
```

---

### Task 2: Concurso picker in WalletDetailView

**Files:**
- Modify: `frontend/src/pages/Carteiras.tsx` (imports at lines 1-3; `WalletDetailView` starting at line 399: state block ~408-418, toggle button ~499-513, hits header ~567)

**Interfaces:**
- Consumes: `useDraw(concurso: number | null)` from Task 1 (returns `{ data?: DrawRecord, isError: boolean }` where `DrawRecord.dezenas: string[]`); existing `useStatus()` (returns `{ latestDraw: { concurso: number, dezenas: string[] } | null }`).
- Produces: UI only — nothing downstream consumes this.

- [ ] **Step 1: Add imports**

In `frontend/src/pages/Carteiras.tsx` line 3, add `ChevronLeft, ChevronRight` to the lucide-react import (keep existing names):

```typescript
import { ArrowDownWideNarrow, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, LayoutGrid, List, Pencil, Trash2, Wallet, Plus, Lock, Unlock, Upload } from 'lucide-react';
```

After line 15 (`import { useStatus } ...`), add:

```typescript
import { useDraw } from '../hooks/useDraws';
```

- [ ] **Step 2: Replace the check-draw state/data block**

In `WalletDetailView`, replace lines 408-418:

```typescript
  const [checkDraw, setCheckDraw] = useState(false);
  const [sortByHits, setSortByHits] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const drawnNumbers = status?.latestDraw?.dezenas ?? [];

  const games = checkDraw && sortByHits
    ? [...wallet?.games ?? []].sort((a, b) =>
        b.dezenas.filter((n) => drawnNumbers.includes(n)).length - a.dezenas.filter((n) => drawnNumbers.includes(n)).length
      )
    : (wallet?.games ?? []);
```

with:

```typescript
  const [checkDraw, setCheckDraw] = useState(false);
  const [checkConcurso, setCheckConcurso] = useState<number | null>(null);
  const [concursoInput, setConcursoInput] = useState('');
  const [sortByHits, setSortByHits] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const latestConcurso = status?.latestDraw?.concurso ?? null;
  const { data: checkedDraw, isError: checkedDrawMissing } = useDraw(checkDraw ? checkConcurso : null);
  const drawnNumbers = checkDraw && !checkedDrawMissing ? checkedDraw?.dezenas ?? [] : [];

  const applyConcurso = (value: number) => {
    const clamped = Math.min(Math.max(1, value), latestConcurso ?? value);
    setCheckConcurso(clamped);
    setConcursoInput(String(clamped));
  };

  const games = checkDraw && sortByHits
    ? [...wallet?.games ?? []].sort((a, b) =>
        b.dezenas.filter((n) => drawnNumbers.includes(n)).length - a.dezenas.filter((n) => drawnNumbers.includes(n)).length
      )
    : (wallet?.games ?? []);
```

- [ ] **Step 3: Replace the toggle button and add the stepper**

Replace lines 499-513 (the `Checar com o sorteio atual` button):

```tsx
          <button
            type="button"
            onClick={() => setCheckDraw((value) => !value)}
            disabled={drawnNumbers.length === 0}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              checkDraw
                ? 'border-yellow-300 bg-yellow-400 text-blue-950'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            aria-pressed={checkDraw}
            title={drawnNumbers.length ? `Checar com o concurso ${status?.latestDraw?.concurso}` : 'Sem sorteio disponível para checagem'}
          >
            {checkDraw && <CheckCircle2 size={13} aria-hidden="true" />}
            Checar com o sorteio atual
          </button>
```

with:

```tsx
          <button
            type="button"
            onClick={() => {
              if (!checkDraw && checkConcurso === null && latestConcurso) applyConcurso(latestConcurso);
              setCheckDraw((value) => !value);
            }}
            disabled={latestConcurso === null}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              checkDraw
                ? 'border-yellow-300 bg-yellow-400 text-blue-950'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            aria-pressed={checkDraw}
            title={latestConcurso !== null ? 'Checar jogos com um concurso' : 'Sem sorteio disponível para checagem'}
          >
            {checkDraw && <CheckCircle2 size={13} aria-hidden="true" />}
            Checar sorteio
          </button>
          {checkDraw && checkConcurso !== null && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyConcurso(checkConcurso - 1)}
                disabled={checkConcurso <= 1}
                aria-label="Concurso anterior"
                className="inline-flex items-center rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={13} aria-hidden="true" />
              </button>
              <input
                value={concursoInput}
                onChange={(e) => setConcursoInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  const parsed = Number(concursoInput);
                  if (Number.isInteger(parsed) && parsed > 0) applyConcurso(parsed);
                  else setConcursoInput(String(checkConcurso));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                inputMode="numeric"
                aria-label="Concurso para checagem"
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center font-mono text-xs font-bold text-slate-700 outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => applyConcurso(checkConcurso + 1)}
                disabled={latestConcurso !== null && checkConcurso >= latestConcurso}
                aria-label="Próximo concurso"
                className="inline-flex items-center rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={13} aria-hidden="true" />
              </button>
              {checkedDrawMissing && (
                <span role="alert" className="text-xs font-bold text-red-600">Concurso não encontrado</span>
              )}
            </div>
          )}
```

- [ ] **Step 4: Fix the sort button disabled condition**

The `Ordenar por acertos` button (right after the block above) has `disabled={!checkDraw || drawnNumbers.length === 0}`. Keep it exactly as is — `drawnNumbers` is now empty until the selected draw loads, which correctly disables sorting while there is nothing to sort by.

Change the hits header at line ~567 from:

```tsx
                {checkDraw && <th scope="col" className="px-3 py-2 text-center">Acertos</th>}
```

to:

```tsx
                {checkDraw && <th scope="col" className="px-3 py-2 text-center">Acertos ({checkConcurso})</th>}
```

- [ ] **Step 5: Verify build and lint pass**

Run: `cd /Users/bruno/projects/funnietech/apps/ganhadordamegasena/frontend && npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Manual verification in dev server**

Run backend + frontend dev servers (backend: `cd backend && npm run dev`; frontend: `cd frontend && npm run dev`), open a wallet with games, then check:

1. Toggle `Checar sorteio` on → stepper appears pre-filled with the latest concurso; hits/highlights match the latest draw (same behavior as before the change).
2. Click `◀` → concurso decrements, hits recompute against that draw, no flicker.
3. `▶` disabled at the latest concurso; `◀` works down; typing a number + Enter jumps to it; typing `0` or garbage resets/clamps.
4. Typing a huge number (beyond latest) clamps to latest.
5. Hits column header shows `Acertos (<concurso>)`; cards view highlights the same numbers.
6. Toggle off and on again → same concurso retained.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Carteiras.tsx
git commit -m "feat: choose which concurso to check wallet games against"
```
