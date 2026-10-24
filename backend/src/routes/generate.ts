import { Router, Request, Response } from 'express';
import {
  expectedHitsPerTicket,
  generateNumbers,
  GENERATOR_MODES,
  GeneratorMode,
  quadraProbability,
} from '../generators';
import { buildFeatureModel } from '../features';
import { getDataset } from '../dataset';
import { buildFrequencyModel, summarizeSignificance } from '../statistical';

const router = Router();

function parseNumberList(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

router.get('/generate', (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || 'random';

  if (!GENERATOR_MODES.includes(mode as GeneratorMode)) {
    res.status(400).json({
      error: `Modo inválido. Opções: ${GENERATOR_MODES.join(', ')}`,
    });
    return;
  }

  try {
    const count = parseOptionalInt(req.query.count) ?? 1;
    const fixedNumbers = parseNumberList(req.query.fixed);
    const excludeNumbers = parseNumberList(req.query.exclude);
    const seedNumbers = parseNumberList(req.query.seeds);

    const games = generateNumbers({
      mode: mode as GeneratorMode,
      count,
      fixedNumbers,
      excludeNumbers,
      seedNumbers,
      iterations: parseOptionalInt(req.query.iterations),
      strategies:
        typeof req.query.strategies === 'string'
          ? req.query.strategies.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      windowSize: parseOptionalInt(req.query.windowSize),
      poolSize: parseOptionalInt(req.query.poolSize),
      guarantee: parseOptionalInt(req.query.guarantee),
      candidates: parseOptionalInt(req.query.candidates),
      maxOverlap: parseOptionalInt(req.query.maxOverlap),
      seed: typeof req.query.seed === 'string' ? req.query.seed : undefined,
    });

    res.json({ modo: mode, jogos: games });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar números';
    const isValidation =
      /dezena inválida|não há dezenas|máximo|Números|pool|histórico insuficiente/i.test(message);
    res.status(isValidation ? 400 : 500).json({ error: message });
  }
});

router.get('/generator/modes', (_req: Request, res: Response) => {
  res.json({ modes: GENERATOR_MODES });
});

/**
 * Empirical feature model: what a "typical" Mega-Sena ticket looks like
 * (sum, parity, quadrants, consecutive pairs, repeats, ...).
 */
router.get('/generator/features', (_req: Request, res: Response) => {
  try {
    const dataset = getDataset();
    const model = buildFeatureModel(dataset);
    const frequency = buildFrequencyModel(dataset);

    res.json({
      totalConcursos: model.total,
      sum: model.sum,
      evens: model.evens,
      quadrantsUsed: model.quadrantsUsed,
      consecutivePairs: model.consecutivePairs,
      primes: model.primes,
      low: model.low,
      maxSameLastDigit: model.maxSameLastDigit,
      repeatsPrev: model.repeatsPrev,
      multiplesOf5: model.multiplesOf5,
      arithmeticRate: model.arithmeticRate,
      allUnder32Rate: model.allUnder32Rate,
      significance: summarizeSignificance(frequency),
      baseline: {
        expectedHitsPerTicket: expectedHitsPerTicket(),
        quadraProbability: quadraProbability(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao calcular o modelo estrutural' });
  }
});

export default router;
