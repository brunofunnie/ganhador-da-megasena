import { Router, Request, Response } from 'express';
import { GENERATOR_MODES, GeneratorMode } from '../generators';
import { runBacktest } from '../backtest';

const router = Router();

function optionalInt(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Walk-forward validation: the mode is generated with data up to draw N-1 and
 * scored against draw N, compared with uniform random tickets via a bootstrap CI.
 */
router.get('/backtest', (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || 'statistical';

  if (!GENERATOR_MODES.includes(mode as GeneratorMode)) {
    res.status(400).json({ error: `Modo inválido. Opções: ${GENERATOR_MODES.join(', ')}` });
    return;
  }

  try {
    const result = runBacktest({
      mode: mode as GeneratorMode,
      window: optionalInt(req.query.window),
      gamesPerDraw: optionalInt(req.query.games) ?? optionalInt(req.query.gamesPerDraw),
      seed: typeof req.query.seed === 'string' ? req.query.seed : undefined,
      strategies:
        typeof req.query.strategies === 'string'
          ? req.query.strategies.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
      windowSize: optionalInt(req.query.windowSize),
      iterations: optionalInt(req.query.iterations),
      poolSize: optionalInt(req.query.poolSize),
      guarantee: optionalInt(req.query.guarantee),
      candidates: optionalInt(req.query.candidates),
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao executar o backtest';
    const isValidation = /Histórico insuficiente/i.test(message);
    res.status(isValidation ? 400 : 500).json({ error: message });
  }
});

export default router;
