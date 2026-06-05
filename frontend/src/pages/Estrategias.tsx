import { useState, useCallback } from 'react';
import { useStrategies } from '../hooks/useStrategies';
import { fetchStrategy } from '../lib/api';
import type { StrategyResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';

export function Estrategias() {
  const { data: strategies, isLoading } = useStrategies();
  const [selectedResult, setSelectedResult] = useState<StrategyResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleExecute = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetchStrategy(id);
      setSelectedResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }, []);

  if (isLoading) {
    return <div className="text-gray-400">Carregando estratégias...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Estratégias</h1>
      <p className="text-sm text-gray-400">
        Combinações pré-definidas baseadas em padrões estatísticos.
        Clique em "Executar" para gerar os números.
      </p>

      {selectedResult && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">
            {selectedResult.estrategia.nome}
          </h3>
          {selectedResult.jogos.map((jogo, i) => (
            <GameCard key={i} numbers={jogo} index={selectedResult.jogos.length > 1 ? i : undefined} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies?.map(s => (
          <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-white font-medium">{s.nome}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-3">{s.descricao}</p>
            <button
              onClick={() => handleExecute(s.id)}
              disabled={loadingId === s.id}
              className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white px-4 py-1.5 rounded-md text-sm transition-colors"
            >
              {loadingId === s.id ? 'Executando...' : 'Executar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
