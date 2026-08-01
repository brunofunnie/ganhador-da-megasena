import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Wallet, Plus, Lock, Unlock } from 'lucide-react';
import {
  createWallet,
  deleteWallet,
  deleteWalletGame,
  updateWallet,
  type WalletSummary,
} from '../lib/api';
import { useWallet, useWallets } from '../hooks/useWallets';
import { GameCard } from '../components/GameCard';

export function Carteiras() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useWallets();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (name: string) => createWallet(name),
    onSuccess: (wallet) => {
      setCreateOpen(false);
      setCreateName('');
      setSelectedId(wallet.id);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWallet(id),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (wallet: WalletSummary) =>
      updateWallet(wallet.id, { status: wallet.status === 'open' ? 'finalized' : 'open' }),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500" role="status">Carregando carteiras...</div>;
  }
  if (isError || !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800" role="alert">Não foi possível carregar as carteiras. Tente atualizar a página.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Apostas</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Minhas carteiras</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Guarde grupos de jogos para apostar depois. Finalizar é só um rótulo — dá para continuar adicionando.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          <Plus size={16} aria-hidden="true" />
          Nova carteira
        </button>
      </header>

      {createOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createName.trim()) createMutation.mutate(createName);
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="block text-sm font-semibold text-slate-700">
            Nome da carteira
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800">
              Criar
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {selectedId !== null ? (
        <WalletDetailView
          id={selectedId}
          onBack={() => setSelectedId(null)}
          onRemoved={invalidate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.carteiras.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Nenhuma carteira ainda. Crie uma para começar a guardar jogos.
            </div>
          )}
          {data.carteiras.map((wallet) => (
            <div key={wallet.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedId(wallet.id)}
                className="flex items-start justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <Wallet size={16} className={wallet.status === 'finalized' ? 'text-slate-400' : 'text-blue-700'} aria-hidden="true" />
                  {wallet.name}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${wallet.status === 'finalized' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                  {wallet.status === 'finalized' ? 'Finalizada' : 'Aberta'}
                </span>
              </button>
              <p className="mt-2 text-sm text-slate-500">
                {wallet.gameCount} jogo{wallet.gameCount === 1 ? '' : 's'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate(wallet)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {wallet.status === 'open' ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                  {wallet.status === 'open' ? 'Finalizar' : 'Reabrir'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(wallet.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletDetailView({ id, onBack, onRemoved }: { id: number; onBack: () => void; onRemoved: () => void }) {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading } = useWallet(id);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateWallet(id, { name }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['wallets', id] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });

  const removeGameMutation = useMutation({
    mutationFn: (gameId: number) => deleteWalletGame(id, gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets', id] });
      onRemoved();
    },
  });

  if (isLoading || !wallet) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500" role="status">Carregando carteira...</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
            ← Voltar
          </button>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (nameDraft.trim()) renameMutation.mutate(nameDraft);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-600"
              />
              <button type="submit" className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white">Salvar</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600">Cancelar</button>
            </form>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900">{wallet.name}</h2>
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${wallet.status === 'finalized' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {wallet.status === 'finalized' ? 'Finalizada' : 'Aberta'}
              </span>
              <button type="button" onClick={() => { setNameDraft(wallet.name); setEditing(true); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                <Pencil size={12} aria-hidden="true" /> Renomear
              </button>
            </>
          )}
        </div>
      </div>

      {wallet.games.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Esta carteira ainda não tem jogos.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {wallet.games.map((game, index) => (
            <div key={game.id} className="relative">
              <GameCard numbers={game.dezenas} index={index} ballSize="sm" />
              <button
                type="button"
                onClick={() => removeGameMutation.mutate(game.id)}
                className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remover jogo"
                title="Remover jogo"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
