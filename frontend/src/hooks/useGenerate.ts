import { useQuery } from '@tanstack/react-query';
import { fetchGenerate } from '../lib/api';

export function useGenerate(params: {
  mode?: string;
  count?: number;
  fixed?: string;
  exclude?: string;
  seeds?: string;
}) {
  return useQuery({
    queryKey: ['generate', params],
    queryFn: () => fetchGenerate(params),
    enabled: false,
  });
}
