import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerSync, type SyncSource } from '../lib/api';

export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SyncSource) => triggerSync(source),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}