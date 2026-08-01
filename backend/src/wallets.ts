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
  if (input.length !== 6) {
    throw new Error('Cada jogo deve ter exatamente 6 números');
  }
  const numbers = input.map(value => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error('Cada número deve estar entre 01 e 60');
    }
    const number = Number(trimmed);
    if (!Number.isInteger(number) || number < 1 || number > 60) {
      throw new Error('Cada número deve estar entre 01 e 60');
    }
    return number;
  });
  const padded = numbers.map(value => value.toString().padStart(2, '0'));
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
  const createdAt = new Date().toISOString();
  const result = db.prepare('INSERT INTO wallets (name, created_at) VALUES (?, ?)').run(trimmed, createdAt);
  return {
    id: Number(result.lastInsertRowid),
    name: trimmed,
    status: 'open',
    createdAt,
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
  const createdAt = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO wallet_games (wallet_id, dezenas, created_at) VALUES (?, ?, ?)'
  ).run(walletId, JSON.stringify(normalized), createdAt);

  return {
    id: Number(result.lastInsertRowid),
    dezenas: normalized,
    createdAt
  };
}

export function removeGame(walletId: number, gameId: number): void {
  const db = getDb();
  const wallet = getWallet(walletId);
  if (!wallet) throw new Error('Carteira não encontrada');
  const result = db.prepare('DELETE FROM wallet_games WHERE id = ? AND wallet_id = ?').run(gameId, walletId);
  if (result.changes === 0) throw new Error('Jogo não encontrado');
}
