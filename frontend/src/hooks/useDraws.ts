import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchDraw, fetchDrawAnalysis, fetchDraws, type DrawFilters } from '../lib/api';

export function useDraws(filters: DrawFilters) {
  return useQuery({
    queryKey: ['draws', filters],
    queryFn: () => fetchDraws(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDraw(concurso: number | null | undefined, options?: { keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ['draw', concurso],
    queryFn: () => fetchDraw(concurso as number),
    enabled: typeof concurso === 'number' && concurso > 0,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
    retry: (failureCount, error) => !String(error).includes('404') && failureCount < 2,
  });
}

export function useDrawAnalysis(concurso: number | null | undefined) {
  return useQuery({
    queryKey: ['draw-analysis', concurso],
    queryFn: () => fetchDrawAnalysis(concurso as number),
    enabled: typeof concurso === 'number' && concurso > 0,
  });
}
