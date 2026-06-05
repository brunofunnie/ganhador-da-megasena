import { Router, Request, Response } from 'express';
import { getStrategies, executeStrategy } from '../strategies';

const router = Router();

router.get('/strategies', (_req: Request, res: Response) => {
  try {
    const strategies = getStrategies();
    res.json(strategies);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar estratégias' });
  }
});

router.get('/strategies/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = executeStrategy(id);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('não encontrada')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Falha ao executar estratégia' });
    }
  }
});

export default router;
