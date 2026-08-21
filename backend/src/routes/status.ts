import { Router, Request, Response } from 'express';
import { getSyncStatus, getSyncSource, setSyncSource, syncResults, SYNC_SOURCES, SyncSource } from '../sync';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao obter status do banco de dados' });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.source === 'string' ? req.query.source : getSyncSource();
    if (!SYNC_SOURCES.includes(raw as SyncSource)) {
      return res.status(400).json({ error: `Fonte de sincronização inválida: ${raw}` });
    }
    const source = raw as SyncSource;
    const result = await syncResults(source);
    res.json({
      mensagem: 'Sincronização concluída',
      source,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao sincronizar com a API externa' });
  }
});

router.put('/sync-source', (req: Request, res: Response) => {
  try {
    const source = (req.body as { source?: unknown })?.source;
    if (typeof source !== 'string' || !SYNC_SOURCES.includes(source as SyncSource)) {
      return res.status(400).json({ error: `Fonte de sincronização inválida: ${String(source)}` });
    }
    setSyncSource(source as SyncSource);
    res.json({ syncSource: getSyncSource() });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao salvar a fonte de sincronização' });
  }
});

export default router;