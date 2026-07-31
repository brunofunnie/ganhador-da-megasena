import { executeStrategy } from './strategies';

export function runEnsemble(options: {
  strategyIds: string[];
  count: number;
}): string[][] {
  const { strategyIds, count } = options;

  if (strategyIds.length === 0) {
    throw new Error('Ensemble requires at least one strategy');
  }

  const voteMap = new Map<string, number>();

  for (const id of strategyIds) {
    const result = executeStrategy(id);
    const game = result.jogos[0];
    for (const num of game) {
      voteMap.set(num, (voteMap.get(num) || 0) + 1);
    }
  }

  const sorted = Array.from(voteMap.entries())
    .sort((a, b) => b[1] - a[1] || parseInt(a[0]) - parseInt(b[0]));

  const games: string[][] = [];
  for (let g = 0; g < count; g++) {
    const game = sorted.slice(g * 6, g * 6 + 6).map(e => e[0]);
    if (game.length < 6) {
      const used = new Set(game);
      const remaining = sorted.filter(e => !used.has(e[0])).map(e => e[0]);
      game.push(...remaining.slice(0, 6 - game.length));
    }
    games.push(game.sort((a, b) => parseInt(a) - parseInt(b)));
  }

  return games;
}
