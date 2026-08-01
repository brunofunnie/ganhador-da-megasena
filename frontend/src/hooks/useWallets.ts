import { useQuery } from '@tanstack/react-query';
import { fetchWallet, fetchWallets } from '../lib/api';

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: fetchWallets,
  });
}

export function useWallet(id: number | null) {
  return useQuery({
    queryKey: ['wallets', id],
    queryFn: () => fetchWallet(id as number),
    enabled: id !== null,
  });
}
