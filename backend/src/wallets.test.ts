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
