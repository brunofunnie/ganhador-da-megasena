import { useQuery } from '@tanstack/react-query';
import { fetchStatistics } from '../lib/api';

export function useStatistics() {
  return useQuery({
    queryKey: ['statistics'],
    queryFn: fetchStatistics,
  });
}
