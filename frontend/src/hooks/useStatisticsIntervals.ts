import { useQuery } from '@tanstack/react-query';
import { fetchStatisticsIntervals } from '../lib/api';

export function useStatisticsIntervals(windowSize: number) {
  return useQuery({
    queryKey: ['statistics', 'intervals', windowSize],
    queryFn: () => fetchStatisticsIntervals(windowSize),
  });
}
