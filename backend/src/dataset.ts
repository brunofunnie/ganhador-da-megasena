import { getDb } from './db';

/**
 * In-memory view of the draw history.
 *
 * Every statistical module used to re-query SQLite and re-parse the `dezenas`
 * JSON on each call (the Monte Carlo mode did that inside its iteration loop,
 * ~29 million parses per generation). The dataset is loaded once, converted to
 * 60-bit masks and cached until the database fingerprint changes.
 */

export const TOTAL_NUMBERS = 60;
export const PICK_SIZE = 6;

export interface DrawMask {
  concurso: number;
  numbers: string[];
  /** Bits 0-31 → numbers 01-32. */
  lo: number;
  /** Bits 32-59 → numbers 33-60. */
  hi: number;
}

export interface DrawDataset {
  draws: DrawMask[];
  /** Cache key: db name + draw count + latest concurso. */
  key: string;
}

let cached: DrawDataset | null = null;

export function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

export function maskOf(numbers: readonly (string | number)[]): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  for (const raw of numbers) {
    const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_NUMBERS) continue;
    const bit = n - 1;
    if (bit < 32) lo |= 1 << bit;
    else hi |= 1 << (bit - 32);
  }
  return { lo, hi };
}

/** Number of set bits in a 32-bit integer (works for signed ints). */
export function popcount32(value: number): number {
  let x = value;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24) & 0x3f;
}

export function intersectCount(
  a: { lo: number; hi: number },
  b: { lo: number; hi: number }
): number {
  return popcount32(a.lo & b.lo) + popcount32(a.hi & b.hi);
}

export function invalidateDataset(): void {
  cached = null;
}

export function getDataset(): DrawDataset {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) AS count, MAX(concurso) AS max FROM draws')
    .get() as { count: number; max: number | null };
  const key = `${db.name}:${row.count}:${row.max ?? 0}`;

  if (cached && cached.key === key) return cached;

  const rows = db
    .prepare('SELECT concurso, dezenas FROM draws ORDER BY concurso ASC')
    .all() as Array<{ concurso: number; dezenas: string }>;

  const draws: DrawMask[] = rows.map((record) => {
    const numbers: string[] = JSON.parse(record.dezenas);
    const { lo, hi } = maskOf(numbers);
    return { concurso: record.concurso, numbers, lo, hi };
  });

  cached = { draws, key };
  return cached;
}

/** Dataset containing only the first `endExclusive` draws (walk-forward view). */
export function sliceDataset(dataset: DrawDataset, endExclusive: number): DrawDataset {
  const end = Math.max(0, Math.min(endExclusive, dataset.draws.length));
  return {
    draws: dataset.draws.slice(0, end),
    key: `${dataset.key}#${end}`,
  };
}

export function allNumbers(): string[] {
  return Array.from({ length: TOTAL_NUMBERS }, (_, i) => formatNumber(i + 1));
}
