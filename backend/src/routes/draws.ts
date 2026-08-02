import { Request, Response, Router } from 'express';
import { analyzeDraw, getDraw, listDraws } from '../draws';

const router = Router();

function queryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parsePositiveInteger(value: unknown, fallback: number): number | null {
  const raw = queryValue(value);
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseConcurso(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseAccumulated(value: unknown): boolean | undefined | null {
  const raw = queryValue(value);
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function invalidRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

router.get('/draws', (req: Request, res: Response) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 20);
    const accumulated = parseAccumulated(req.query.accumulated);
    if (page === null || limit === null) {
      invalidRequest(res, 'Parâmetros de paginação inválidos');
      return;
    }
    if (accumulated === null) {
      invalidRequest(res, 'Parâmetro accumulated inválido');
      return;
    }

    res.json(listDraws({
      page,
      limit,
      search: queryValue(req.query.search),
      from: queryValue(req.query.from),
      to: queryValue(req.query.to),
      accumulated
    }));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter dados dos sorteios' });
  }
});

router.get('/draws/:concurso/analysis', (req: Request, res: Response) => {
  const concurso = parseConcurso(req.params.concurso);
  if (concurso === null) {
    invalidRequest(res, 'Número de concurso inválido');
    return;
  }

  try {
    const analysis = analyzeDraw(concurso);
    if (!analysis) {
      res.status(404).json({ error: 'Concurso não encontrado' });
      return;
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter dados dos sorteios' });
  }
});

router.get('/draws/:concurso', (req: Request, res: Response) => {
  const concurso = parseConcurso(req.params.concurso);
  if (concurso === null) {
    invalidRequest(res, 'Número de concurso inválido');
    return;
  }

  try {
    const draw = getDraw(concurso);
    if (!draw) {
      res.status(404).json({ error: 'Concurso não encontrado' });
      return;
    }
    res.json(draw);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter dados dos sorteios' });
  }
});

export default router;
