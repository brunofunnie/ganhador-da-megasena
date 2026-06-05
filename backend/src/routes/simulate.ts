import { Router, Request, Response } from 'express';
import { runSimulation } from '../simulator';

const router = Router();

router.get('/simulate', (req: Request, res: Response) => {
  try {
    const numbersStr = req.query.numbers as string;
    const mode = (req.query.mode as string) || 'historical';
    const randomCount = parseInt(req.query.count as string) || 1000;

    if (!numbersStr) {
      res.status(400).json({ error: 'Parâmetro "numbers" obrigatório (ex: ?numbers=01,02,03,04,05,06)' });
      return;
    }

    const numbers = numbersStr.split(',').map(n => n.trim().padStart(2, '0'));

    if (numbers.length !== 6) {
      res.status(400).json({ error: 'Forneça exatamente 6 números' });
      return;
    }

    const result = runSimulation({
      numbers,
      mode: mode === 'random' ? 'random' : 'historical',
      randomCount
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao executar simulação' });
  }
});

export default router;
