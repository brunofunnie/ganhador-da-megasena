import { Router, Request, Response } from 'express';
import { runSimulation } from '../simulator';

const router = Router();

router.get('/simulate', (req: Request, res: Response) => {
  try {
    const numbersStr = req.query.numbers as string;
    const mode = (req.query.mode as string) || 'historical';
    const randomCount = parseInt(req.query.count as string) || 1000;

    if (!numbersStr) {
      res.status(400).json({ error: 'Parâmetro "numbers" obrigatório. Ex: ?numbers=01,02,03,04,05,06 ou ?numbers=01,02,03,04,05,06;07,08,09,10,11,12 para múltiplos jogos' });
      return;
    }

    const games = numbersStr.split(';').map(game =>
      game.split(',').map(n => n.trim().padStart(2, '0'))
    );

    for (const game of games) {
      if (game.length !== 6) {
        res.status(400).json({ error: 'Cada jogo deve ter exatamente 6 números' });
        return;
      }
    }

    const result = runSimulation({
      games,
      mode: mode === 'random' ? 'random' : 'historical',
      randomCount
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao executar simulação' });
  }
});

export default router;
