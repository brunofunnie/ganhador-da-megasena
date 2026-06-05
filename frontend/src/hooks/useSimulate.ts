import { useQuery } from '@tanstack/react-query';
import { fetchSimulate } from '../lib/api';

export function useSimulate(params: {
  numbers: string;
  mode: string;
  count?: number;
}) {
  return useQuery({
    queryKey: ['simulate', params],
    queryFn: () => fetchSimulate(params),
    enabled: false,
  });
}
