/**
 * Economical covering wheels ("fechamento").
 *
 * Given a pool of M numbers and a target guarantee T, the wheel returns a small
 * set of 6-number tickets such that **if the 6 drawn numbers are all inside the
 * pool**, at least one ticket matches T of them.
 *
 * This is a covering design solved greedily (set cover over every T-subset of
 * the pool). The guarantee is conditional on the pool containing all 6 drawn
 * numbers — the UI/docs must say that explicitly.
 */

export interface WheelResult {
  pool: string[];
  guarantee: number;
  tickets: string[][];
  /** ceil(C(M,T) / C(6,T)) — a lower bound, the greedy result is usually close. */
  theoreticalMinimum: number;
  /** Fraction of T-subsets of the pool covered by the returned tickets. */
  coverage: number;
  complete: boolean;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  if (k <= 0 || k > items.length) return result;

  const current: T[] = [];
  const walk = (start: number): void => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      walk(i + 1);
      current.pop();
    }
  };
  walk(0);
  return result;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

export function buildCoveringWheel(
  pool: readonly string[],
  guarantee = 4,
  maxTickets = 400,
  ticketSize = 6
): WheelResult {
  const size = Math.max(1, Math.min(6, ticketSize));
  const numbers = Array.from(new Set(pool)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (numbers.length < size) {
    throw new Error(`O fechamento precisa de pelo menos ${size} dezenas no pool`);
  }

  const target = Math.max(1, Math.min(guarantee, size, numbers.length));
  const theoreticalMinimum = Math.ceil(
    binomial(numbers.length, target) / binomial(size, target)
  );

  const ticketCombos = combinations(numbers, size);
  const targetCombos = combinations(
    Array.from({ length: numbers.length }, (_, i) => i),
    target
  );

  // Map every target subset to an index.
  const targetIndex = new Map<string, number>();
  targetCombos.forEach((combo, index) => {
    targetIndex.set(combo.join(','), index);
  });

  // Coverage list of each ticket (indices of target subsets it contains).
  const coverage: number[][] = ticketCombos.map((ticket) => {
    const indices = ticket.map((numero) => numbers.indexOf(numero));
    const covered: number[] = [];
    for (const subset of combinations(indices, target)) {
      const idx = targetIndex.get([...subset].sort((a, b) => a - b).join(','));
      if (idx !== undefined) covered.push(idx);
    }
    return covered;
  });

  const uncovered = new Uint8Array(targetCombos.length).fill(1);
  let remaining = targetCombos.length;
  const chosen: number[] = [];

  while (remaining > 0 && chosen.length < maxTickets) {
    let bestTicket = -1;
    let bestGain = 0;

    for (let t = 0; t < ticketCombos.length; t++) {
      let gain = 0;
      for (const idx of coverage[t]) if (uncovered[idx]) gain++;
      if (gain > bestGain) {
        bestGain = gain;
        bestTicket = t;
        if (gain === remaining) break;
      }
    }

    if (bestTicket < 0 || bestGain === 0) break;

    chosen.push(bestTicket);
    for (const idx of coverage[bestTicket]) {
      if (uncovered[idx]) {
        uncovered[idx] = 0;
        remaining--;
      }
    }
  }

  // Remove tickets that became redundant during the greedy pass.
  if (remaining === 0) {
    for (let i = chosen.length - 1; i >= 0; i--) {
      const covered = new Uint8Array(targetCombos.length);
      let count = 0;
      for (let j = 0; j < chosen.length; j++) {
        if (j === i) continue;
        for (const idx of coverage[chosen[j]]) {
          if (!covered[idx]) {
            covered[idx] = 1;
            count++;
          }
        }
      }
      if (count === targetCombos.length) chosen.splice(i, 1);
    }
  }

  const tickets = chosen.map((index) => [...ticketCombos[index]]);
  const coveredCount = targetCombos.length - remaining;

  return {
    pool: numbers,
    guarantee: target,
    tickets,
    theoreticalMinimum,
    coverage: targetCombos.length > 0 ? coveredCount / targetCombos.length : 1,
    complete: remaining === 0,
  };
}

/** Checks the guarantee for a concrete set of tickets (used by tests). */
export function wheelGuarantee(
  pool: readonly string[],
  tickets: readonly string[][],
  guarantee: number
): boolean {
  const numbers = Array.from(new Set(pool));
  for (const subset of combinations(numbers, guarantee)) {
    const covered = tickets.some((ticket) => {
      const set = new Set(ticket);
      return subset.every((numero) => set.has(numero));
    });
    if (!covered) return false;
  }
  return true;
}
