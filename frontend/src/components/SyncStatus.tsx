import { useStatus } from '../hooks/useStatus';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';

interface SyncStatusProps {
  compact?: boolean;
}

export function SyncStatus({ compact = false }: SyncStatusProps) {
  const { data, isLoading, isError } = useStatus();

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

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-950 ${compact ? 'justify-between' : ''}`} role="status">
      <CheckCircle2 className="size-4 shrink-0 text-blue-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span><span className="text-blue-700">Concursos:</span> <strong>{data?.totalDraws ?? 0}</strong></span>
        <span><span className="text-blue-700">Último:</span> <strong>#{data?.latestConcurso ?? 0}</strong></span>
        {!compact && data?.lastSync && <span className="text-blue-700">Sincronizado: {new Date(data.lastSync).toLocaleString('pt-BR')}</span>}
      </div>
    </div>
  );
}
