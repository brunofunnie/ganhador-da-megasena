import { getDb } from './db';

const API_BASE = 'https://loteriascaixa-api.herokuapp.com/api';
const LOTERIA = 'megasena';

interface ApiResultado {
  loteria: string;
  concurso: number;
  data: string;
  dezenas: string[];
}

export async function syncResults(): Promise<{ inserted: number; total: number }> {
  const response = await fetch(`${API_BASE}/${LOTERIA}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const results: ApiResultado[] = await response.json();
  const db = getDb();

  const insert = db.prepare(
    'INSERT OR REPLACE INTO draws (concurso, data, dezenas) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    let inserted = 0;
    for (const r of results) {
      const existing = db.prepare('SELECT concurso FROM draws WHERE concurso = ?').get(r.concurso);
      if (!existing) inserted++;
      insert.run(r.concurso, r.data, JSON.stringify(r.dezenas));
    }
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('last_sync', new Date().toISOString());
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
      .run('total_draws', String(results.length));
    return inserted;
  });

  const inserted = transaction();
  return { inserted, total: results.length };
}

export function getSyncStatus() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number };
  const latest = db.prepare('SELECT MAX(concurso) as max FROM draws').get() as { max: number };
  const lastSync = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get() as { value: string } | undefined;

  return {
    totalDraws: count.count,
    latestConcurso: latest.max || 0,
    lastSync: lastSync?.value || null
  };
}
