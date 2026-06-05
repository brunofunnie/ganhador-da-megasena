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
