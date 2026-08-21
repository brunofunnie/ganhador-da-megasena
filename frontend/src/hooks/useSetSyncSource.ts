import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setSyncSource, type SyncSource } from '../lib/api';

export function useSetSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SyncSource) => setSyncSource(source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}