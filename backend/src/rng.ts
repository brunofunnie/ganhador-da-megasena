/**
 * Deterministic pseudo-random number generator.
 *
 * Every generation path receives an `Rng` instead of touching `Math.random()`
 * directly, so a request with an explicit `seed` is fully reproducible and the
 * backtest harness can replay exactly the same tickets.
 */

export interface Rng {
  /** Seed actually used (useful to echo back to the caller). */
  readonly seed: string;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Fisher-Yates copy of the array. */
  shuffle<T>(items: readonly T[]): T[];
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Index sampled proportionally to the weights (all weights must be >= 0). */
  weightedIndex(weights: readonly number[]): number;
}

/** xmur3 string hash → 32-bit seed. */
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function resolveSeed(seed?: string | number): string {
  if (typeof seed === 'string' && seed.length > 0) return seed;
  if (typeof seed === 'number' && Number.isFinite(seed)) return String(seed);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRng(seed?: string | number): Rng {
  const resolved = resolveSeed(seed);
  let state = hashSeed(resolved);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => {
    if (maxExclusive <= 0) return 0;
    return Math.floor(next() * maxExclusive);
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  const pick = <T>(items: readonly T[]): T => items[int(items.length)];

  const weightedIndex = (weights: readonly number[]): number => {
    let total = 0;
    for (const w of weights) total += Number.isFinite(w) && w > 0 ? w : 0;
    if (total <= 0) return int(weights.length);

    let remaining = next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Number.isFinite(weights[i]) && weights[i] > 0 ? weights[i] : 0;
      if (w === 0) continue;
      remaining -= w;
      if (remaining <= 0) return i;
    }
    return weights.length - 1;
  };

  return { seed: resolved, next, int, shuffle, pick, weightedIndex };
}
