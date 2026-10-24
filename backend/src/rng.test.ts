import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('same-seed');
    const b = createRng('same-seed');
    const sequenceA = Array.from({ length: 20 }, () => a.next());
    const sequenceB = Array.from({ length: 20 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(
      Array.from({ length: 10 }, () => b.next())
    );
  });

  it('shuffle is a permutation and does not mutate the input', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6];
    const output = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
  });

  it('weightedIndex never returns a zero-weight index', () => {
    const rng = createRng('weights');
    const weights = [0, 0, 0, 1];
    for (let i = 0; i < 100; i++) expect(rng.weightedIndex(weights)).toBe(3);
  });

  it('int stays within bounds', () => {
    const rng = createRng('int');
    for (let i = 0; i < 200; i++) {
      const value = rng.int(10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
    }
  });
});
