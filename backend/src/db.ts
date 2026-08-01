import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export interface DrawPrize {
  descricao: string;
  faixa: number;
  ganhadores: number;
  valorPremio: number;
}

export interface DrawRecord {
  concurso: number;
  data: string;
  dezenas: string[];
  local: string | null;
  concursoEspecial: boolean | null;
  dezenasOrdemSorteio: string[] | null;
  premiacoes: DrawPrize[] | null;
  estadosPremiados: unknown[] | null;
  localGanhadores: unknown[] | null;
  acumulou: boolean | null;
  proximoConcurso: number | null;
  dataProximoConcurso: string | null;
  valorArrecadado: number | null;
  valorAcumuladoConcurso_0_5: number | null;
  valorAcumuladoConcursoEspecial: number | null;
  valorAcumuladoProximoConcurso: number | null;
  valorEstimadoProximoConcurso: number | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS draws (
  concurso INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  dezenas TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS wallet_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  dezenas TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const DRAW_METADATA_COLUMNS: Array<[string, string]> = [
  ['local', 'TEXT'],
  ['concurso_especial', 'INTEGER'],
  ['dezenas_ordem_sorteio', 'TEXT'],
  ['premiacoes', 'TEXT'],
  ['estados_premiados', 'TEXT'],
  ['local_ganhadores', 'TEXT'],
  ['acumulou', 'INTEGER'],
  ['proximo_concurso', 'INTEGER'],
  ['data_proximo_concurso', 'TEXT'],
  ['valor_arrecadado', 'REAL'],
  ['valor_acumulado_concurso_0_5', 'REAL'],
  ['valor_acumulado_concurso_especial', 'REAL'],
  ['valor_acumulado_proximo_concurso', 'REAL'],
  ['valor_estimado_proximo_concurso', 'REAL']
];

export function initDb(dbPath?: string): void {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'data', 'megasena.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);

  const columns = new Set(
    (db.prepare('PRAGMA table_info(draws)').all() as Array<{ name: string }>).map(column => column.name)
  );
  for (const [name, type] of DRAW_METADATA_COLUMNS) {
    if (!columns.has(name)) db.exec(`ALTER TABLE draws ADD COLUMN ${name} ${type}`);
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
