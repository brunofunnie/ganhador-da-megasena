import { useStatus } from '../hooks/useStatus';

export function SyncStatus() {
  const { data, isLoading, isError } = useStatus();

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <p className="text-sm text-gray-400">Carregando status...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
        <p className="text-sm text-red-400">Erro ao carregar status</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Concursos: <span className="text-white font-medium">{data?.totalDraws ?? 0}</span>
          </span>
          <span className="text-gray-400">
            Último: <span className="text-white font-medium">#{data?.latestConcurso ?? 0}</span>
          </span>
        </div>
        {data?.lastSync && (
          <span className="text-xs text-gray-500">
            Sincronizado: {new Date(data.lastSync).toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
}
