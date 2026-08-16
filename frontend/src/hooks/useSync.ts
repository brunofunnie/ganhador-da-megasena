import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerSync } from '../lib/api';

export function useSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
