import { Router, Request, Response } from 'express';
import { computeStatistics } from '../statistics';

const router = Router();

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = computeStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao calcular estatísticas' });
  }
});

export default router;
