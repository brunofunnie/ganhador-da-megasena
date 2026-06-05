import { Router, Request, Response } from 'express';
import { generateNumbers, GENERATOR_MODES, GeneratorMode } from '../generators';

const router = Router();

router.get('/generate', (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'random';
    const count = parseInt(req.query.count as string) || 1;
    const fixedNumbers = req.query.fixed
      ? (req.query.fixed as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];
    const excludeNumbers = req.query.exclude
      ? (req.query.exclude as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];
    const seedNumbers = req.query.seeds
      ? (req.query.seeds as string).split(',').map(n => n.trim().padStart(2, '0'))
      : [];

    if (!GENERATOR_MODES.includes(mode as GeneratorMode)) {
      res.status(400).json({
        error: `Modo inválido. Opções: ${GENERATOR_MODES.join(', ')}`
      });
      return;
    }

    const games = generateNumbers({
      mode: mode as GeneratorMode,
      count,
      fixedNumbers,
      excludeNumbers,
      seedNumbers
    });

    res.json({ modo: mode, jogos: games });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar números' });
  }
});

router.get('/generator/modes', (_req: Request, res: Response) => {
  res.json({ modes: GENERATOR_MODES });
});

export default router;
