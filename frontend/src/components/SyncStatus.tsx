import { useEffect, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useSync } from '../hooks/useSync';
import { useSetSyncSource } from '../hooks/useSetSyncSource';
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import type { SyncSource } from '../lib/api';

interface SyncStatusProps {
  compact?: boolean;
}

export function SyncStatus({ compact = false }: SyncStatusProps) {
  const { data, isLoading, isError } = useStatus();
  const sync = useSync();
  const setSource = useSetSyncSource();
  const [source, setSourceState] = useState<SyncSource>('caixa');

  useEffect(() => {
    if (data?.syncSource) setSourceState(data.syncSource);
  }, [data?.syncSource]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status" aria-live="polite">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        <p>Atualizando dados...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <p>Não foi possível atualizar o status.</p>
      </div>
    );
  }

  function handleSourceChange(next: SyncSource) {
    setSourceState(next);
    setSource.mutate(next);
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-950 ${compact ? 'justify-between' : ''}`} role="status">
      {sync.isError ? (
        <AlertCircle className="size-4 shrink-0 text-red-700" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span><span className="text-blue-700">Concursos:</span> <strong>{data?.totalDraws ?? 0}</strong></span>
        <span><span className="text-blue-700">Último:</span> <strong>#{data?.latestConcurso ?? 0}</strong></span>
        {!compact && data?.lastSync && <span className="text-blue-700">Sincronizado: {new Date(data.lastSync).toLocaleString('pt-BR')}</span>}
        {sync.isError && <span className="text-red-700">Falha ao sincronizar.</span>}
      </div>
      <select
        value={source}
        onChange={(e) => handleSourceChange(e.target.value as SyncSource)}
        disabled={setSource.isPending}
        aria-label="Fonte de sincronização"
        title="Fonte de sincronização"
        className="shrink-0 rounded border border-blue-200 bg-white px-1 py-0.5 text-xs text-blue-800 disabled:opacity-50"
      >
        <option value="caixa">Caixa API</option>
        <option value="guidi">Guidi API</option>
      </select>
      <button
        type="button"
        onClick={() => sync.mutate(source)}
        disabled={sync.isPending}
        title="Sincronizar agora"
        aria-label="Sincronizar agora"
        className="ml-auto shrink-0 rounded p-1 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}