import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { closeDb, getDb, initDb } from './db';
import {
  addGame,
  createWallet,
  dedupeAllWallets,
  dedupeWalletGames,
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

    const created = createWallet('Consistência');
    const loadedBack = getWallet(created.id);
    expect(loadedBack?.createdAt).toBe(created.createdAt);
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

  it('throws when removing a game that does not exist in the wallet', () => {
    const wallet = createWallet('Carteira');
    expect(() => removeGame(wallet.id, 999)).toThrow(/Jogo não encontrado/);
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
    expect(() => addGame(wallet.id, ['0x10', '02', '03', '04', '05', '06'])).toThrow(/entre 01 e 60/);
    expect(() => addGame(wallet.id, ['01', '01', '02', '03', '04', '05'])).toThrow(/duplicados/);
    expect(getWallet(wallet.id)?.games).toHaveLength(0);
  });

  it('throws when adding to or removing from a nonexistent wallet', () => {
    expect(() => addGame(999, ['01', '02', '03', '04', '05', '06'])).toThrow(/não encontrada/);
    expect(() => removeGame(999, 1)).toThrow(/não encontrada/);
  });

  it('rejects a duplicate game within the same wallet', () => {
    const wallet = createWallet('Carteira');
    addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    expect(() => addGame(wallet.id, ['01', '02', '03', '04', '05', '06'])).toThrow(/já existe/i);
    expect(getWallet(wallet.id)?.games).toHaveLength(1);
  });

  it('allows the same game in different wallets', () => {
    const walletA = createWallet('A');
    const walletB = createWallet('B');
    addGame(walletA.id, ['01', '02', '03', '04', '05', '06']);
    expect(() => addGame(walletB.id, ['01', '02', '03', '04', '05', '06'])).not.toThrow();
    expect(getWallet(walletA.id)?.games).toHaveLength(1);
    expect(getWallet(walletB.id)?.games).toHaveLength(1);
  });

  it('dedupes existing games in a wallet keeping the first occurrence', () => {
    const wallet = createWallet('Carteira');
    const insert = getDb().prepare('INSERT INTO wallet_games (wallet_id, dezenas, created_at) VALUES (?, ?, ?)');
    insert.run(wallet.id, JSON.stringify(['01', '02', '03', '04', '05', '06']), '2024-01-01T00:00:00.000Z');
    insert.run(wallet.id, JSON.stringify(['01', '02', '03', '04', '05', '06']), '2024-01-02T00:00:00.000Z');
    insert.run(wallet.id, JSON.stringify(['10', '20', '30', '40', '50', '60']), '2024-01-03T00:00:00.000Z');

    const removed = dedupeWalletGames(wallet.id);
    expect(removed).toBe(1);

    const games = getWallet(wallet.id)?.games ?? [];
    expect(games).toHaveLength(2);
    expect(games[0].dezenas).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(games[1].dezenas).toEqual(['10', '20', '30', '40', '50', '60']);
  });

  it('returns zero from dedupe when there are no duplicates', () => {
    const wallet = createWallet('Carteira');
    addGame(wallet.id, ['01', '02', '03', '04', '05', '06']);
    addGame(wallet.id, ['10', '20', '30', '40', '50', '60']);

    expect(dedupeWalletGames(wallet.id)).toBe(0);
    expect(getWallet(wallet.id)?.games).toHaveLength(2);
  });

  it('dedupes all wallets at once', () => {
    const walletA = createWallet('A');
    const walletB = createWallet('B');
    const insert = getDb().prepare('INSERT INTO wallet_games (wallet_id, dezenas, created_at) VALUES (?, ?, ?)');
    insert.run(walletA.id, JSON.stringify(['01', '02', '03', '04', '05', '06']), '2024-01-01T00:00:00.000Z');
    insert.run(walletA.id, JSON.stringify(['01', '02', '03', '04', '05', '06']), '2024-01-02T00:00:00.000Z');
    insert.run(walletB.id, JSON.stringify(['10', '20', '30', '40', '50', '60']), '2024-01-01T00:00:00.000Z');
    insert.run(walletB.id, JSON.stringify(['10', '20', '30', '40', '50', '60']), '2024-01-02T00:00:00.000Z');

    const removed = dedupeAllWallets();
    expect(removed).toBe(2);
    expect(getWallet(walletA.id)?.games).toHaveLength(1);
    expect(getWallet(walletB.id)?.games).toHaveLength(1);
  });
});
