import { useQuery } from '@tanstack/react-query';
import { fetchStrategies, fetchStrategy } from '../lib/api';

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
  });
}

export function useStrategy(id: string | null) {
  return useQuery({
    queryKey: ['strategy', id],
    queryFn: () => fetchStrategy(id!),
    enabled: !!id,
  });
}
