# Design: Carteira de apostas (grupos de números)

**Data:** 2026-08-01
**Escopo:** backend (`backend/src/wallets.ts`, `backend/src/routes/wallets.ts`, `backend/src/db.ts`, `backend/src/index.ts`) e frontend (`frontend/src/pages/Carteiras.tsx`, `frontend/src/components/SimulationDrawer.tsx`, `frontend/src/lib/api.ts`, `frontend/src/components/Sidebar.tsx`, `frontend/src/App.tsx`)
**Status:** Aprovado para implementação

## Problema

O frontend já possui botões "Salvar" que chamam `saveNumbers()` e `fetchSavedNumbers()` (ex: `frontend/src/pages/Gerador.tsx:118`), mas **o backend nunca implementou essas rotas** — hoje salvar um jogo falha silenciosamente. Não existe forma de o usuário guardar grupos de números (jogos) para apostar mais tarde, organizá-los por objetivo (ex: "Mega da Virada", "Aposta do mês") ou voltar a eles depois.

## Objetivo

Criar "carteiras de apostas": contêineres nomeados e persistidos que aceitam jogos de 6 números. Uma carteira pode ser marcada como "finalizada" (rótulo), mas continua aceitando novos jogos — o carrinho não trava.

## Princípios

- Persistência no SQLite existente (`megasena.db`) via `better-sqlite3`, mesmo padrão do restante do backend.
- Lógica de domínio isolada em módulo testável (`backend/src/wallets.ts`), com testes vitest no padrão de `backend/src/draws.test.ts`.
- Consistência com a API atual: formato de erro `{ error: string }`, respostas JSON, rotas sob `/api`.
- Seguir o padrão visual atual (shadcn/base-ui, cores, `GameCard`, `NumberBall`).

## Solução

### 1. Backend — esquema (`backend/src/db.ts`)

Adicionar ao `SCHEMA`:

```sql
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',       -- 'open' | 'finalized'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS wallet_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  dezenas TEXT NOT NULL,                      -- JSON: ["01","02",...]
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2. Backend — domínio (`backend/src/wallets.ts`)

Funções puras sobre `getDb()` (mesmo padrão de `draws.ts`):

- `listWallets()` → `Array<{ id, name, status, createdAt, finalizedAt, gameCount }>`
- `getWallet(id)` → carteira + `games: Array<{ id, dezenas: string[], createdAt }>` ou `null`
- `createWallet(name)` → nova carteira
- `updateWallet(id, patch)` → renomeia e/ou altera `status` (finalizar/reaibrir)
- `deleteWallet(id)` → remove carteira (jogos em cascata)
- `addGame(walletId, dezenas)` → adiciona jogo; permitido mesmo se carteira `finalized`
- `removeGame(walletId, gameId)` → remove um jogo

**Validação de jogo:** exatamente 6 números, cada um inteiro entre 1 e 60, normalizado para formato `01`–`60`.

### 3. Backend — rotas (`backend/src/routes/wallets.ts`)

Registrado em `backend/src/index.ts` como `app.use('/api', walletsRoutes)`.

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/api/wallets` | Lista carteiras + contagem de jogos |
| `POST` | `/api/wallets` | Cria carteira `{ name }` |
| `GET` | `/api/wallets/:id` | Carteira com seus jogos |
| `PATCH` | `/api/wallets/:id` | Renomeia e/ou finaliza (`{ name?, status? }`) |
| `DELETE` | `/api/wallets/:id` | Remove carteira |
| `POST` | `/api/wallets/:id/games` | Adiciona jogo `{ dezenas }` |
| `DELETE` | `/api/wallets/:id/games/:gameId` | Remove um jogo |

"Finalizar" é um `UPDATE` de `status` + `finalized_at` — não bloqueia novos jogos (rótulo, não trava).

### 4. Frontend — página "Carteiras" (`frontend/src/pages/Carteiras.tsx`)

- Nova rota `/carteiras` em `frontend/src/App.tsx`.
- Novo link na `Sidebar.tsx`: `Carteiras` (ícone `Wallet`).
- Lista de carteiras: nome, status (`Aberta`/`Finalizada`), nº de jogos, data de criação.
- Ações por carteira: abrir (ver jogos), renomear, finalizar/reabrir, excluir.
- Detalhe da carteira: grid de `GameCard` com os jogos + ação "Remover jogo".
- Modal para criar nova carteira e para renomear.

### 5. Frontend — fluxo "Salvar jogo" (Gerador)

- O botão "Salvar" do `SimulationDrawer` passa a abrir um seletor de carteira: lista as carteiras existentes + opção "Nova carteira".
- Ao escolher, chama `addGameToWallet(walletId, numbers)` (ou cria a carteira e adiciona).
- `frontend/src/lib/api.ts`: **remover** `saveNumbers`, `fetchSavedNumbers` e interfaces associadas (`SavedNumbersItem`, etc.); **adicionar** `fetchWallets`, `createWallet`, `fetchWallet`, `updateWallet`, `deleteWallet`, `addGameToWallet`, `deleteWalletGame`.

### 6. Testes (`backend/src/wallets.test.ts`)

Vitest no padrão de `draws.test.ts` (DB de teste via `initDb(TEST_DB_PATH)`, cleanup antes/depois):

- CRUD de carteira: criar, listar, obter, renomear, finalizar, reabrir, excluir.
- Adicionar/remover jogo, inclusive em carteira `finalized`.
- Validação: nome ausente, jogo com quantidade ≠ 6 dezenas, dezena fora de 1–60.
- Carteira inexistente retorna `null`/vazio.

## Critérios de aceitação

- [ ] `GET /api/wallets` lista carteiras com contagem de jogos.
- [ ] `POST /api/wallets` cria carteira; `PATCH` renomeia e finaliza/reabre; `DELETE` remove em cascata.
- [ ] `POST /api/wallets/:id/games` adiciona jogo mesmo em carteira `finalized`.
- [ ] Jogo inválido (≠6 dezenas ou fora de 1–60) retorna 400.
- [ ] Carteira inexistente retorna 404 (HTTP) / `null` (domínio).
- [ ] Página `/carteiras` lista, cria, renomeia, finaliza, exclui e exibe jogos de carteiras.
- [ ] Botão "Salvar" no `SimulationDrawer` abre seletor de carteira e adiciona o jogo.
- [ ] `saveNumbers`/`fetchSavedNumbers` removidos do frontend sem referências remanescentes.
- [ ] Testes vitest do backend passam (`npm test`).
- [ ] Nenhuma regressão nas rotas existentes.

## Não faz parte deste escopo

- Autenticação / usuários múltiplos (carteiras são globais, single-user).
- Cálculo de custo por carteira.
- Exportação/impressão de carteiras.
- Notificações ou lembretes de concurso.
