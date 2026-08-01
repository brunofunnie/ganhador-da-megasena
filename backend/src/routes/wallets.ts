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

function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
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
    const wallet = updateWallet(id, { name, status: status as 'open' | 'finalized' });
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
