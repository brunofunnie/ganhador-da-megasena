import { Router, Request, Response } from 'express';
import { computeGapIntervals, computeStatistics } from '../statistics';

const router = Router();

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = computeStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao calcular estatísticas' });
  }
});

router.get('/statistics/intervals', (req: Request, res: Response) => {
  try {
    const rawWindow = typeof req.query.window === 'string' ? req.query.window : '';
    const windowSize = /^\d+$/.test(rawWindow) ? parseInt(rawWindow, 10) : 50;
    res.json(computeGapIntervals(windowSize));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao calcular intervalos' });
  }
});

export default router;
