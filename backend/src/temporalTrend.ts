import { DrawDataset, getDataset } from './dataset';
import { TrendStat, buildTrendModel } from './statistical';

/**
 * Temporal trend: signed z-score of (recent inclusion rate − historical rate).
 *
 * The sign matters — a number that is heating up must not get the same weight
 * as one that is cooling down (the previous implementation used Math.abs()).
 */
export function getTemporalTrend(
  windowSize: number = 50,
  dataset: DrawDataset = getDataset()
): Map<string, number> {
  const model = buildTrendModel(dataset, windowSize);
  const scores = new Map<string, number>();
  for (const [numero, stat] of model) {
    scores.set(numero, parseFloat(stat.z.toFixed(4)));
  }
  return scores;
}

export function getTrendDetails(
  windowSize: number = 50,
  dataset: DrawDataset = getDataset()
): Map<string, TrendStat> {
  return buildTrendModel(dataset, windowSize);
}
