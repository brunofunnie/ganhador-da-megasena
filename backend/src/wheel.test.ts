import { describe, it, expect } from 'vitest';
import { buildCoveringWheel, wheelGuarantee } from './wheel';

function poolOf(size: number): string[] {
  return Array.from({ length: size }, (_, index) => String(index + 1).padStart(2, '0'));
}

describe('wheel', () => {
  it('produces a complete covering wheel for common pool sizes', () => {
    for (const [poolSize, guarantee] of [
      [7, 4],
      [8, 4],
      [9, 4],
      [10, 5],
    ] as const) {
      const pool = poolOf(poolSize);
      const wheel = buildCoveringWheel(pool, guarantee);

      expect(wheel.complete).toBe(true);
      expect(wheel.coverage).toBe(1);
      expect(wheel.guarantee).toBe(guarantee);
      expect(wheel.tickets.length).toBeGreaterThanOrEqual(wheel.theoreticalMinimum);
      expect(wheelGuarantee(pool, wheel.tickets, guarantee)).toBe(true);

      for (const ticket of wheel.tickets) {
        expect(ticket).toHaveLength(6);
        expect(new Set(ticket).size).toBe(6);
        for (const numero of ticket) expect(pool).toContain(numero);
      }
    }
  });

  it('supports a reduced ticket size (used when the player fixes numbers)', () => {
    const pool = poolOf(6);
    const wheel = buildCoveringWheel(pool, 2, 200, 3);
    expect(wheel.tickets.every((ticket) => ticket.length === 3)).toBe(true);
    expect(wheel.complete).toBe(true);

    // Every pair of the pool is inside at least one 3-number ticket.
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const covered = wheel.tickets.some(
          (ticket) => ticket.includes(pool[i]) && ticket.includes(pool[j])
        );
        expect(covered).toBe(true);
      }
    }
  });

  it('rejects a pool smaller than the ticket', () => {
    expect(() => buildCoveringWheel(['01', '02'], 2)).toThrow();
  });
});
