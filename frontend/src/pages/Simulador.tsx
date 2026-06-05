import { useState, useCallback } from 'react';
import { fetchSimulate, type SimulationResponse } from '../lib/api';
import { NumberBall } from '../components/NumberBall';

export function Simulador() {
  const [numbers, setNumbers] = useState('');
  const [mode, setMode] = useState('historical');
  const [randomCount, setRandomCount] = useState(1000);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = useCallback(async () => {
    const parsed = numbers.split(',').map(n => n.trim());
    if (parsed.length !== 6) return;

    setLoading(true);
    try {
      const res = await fetchSimulate({
        numbers: numbers.replace(/\s/g, ''),
        mode,
        count: mode === 'random' ? randomCount : undefined,
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [numbers, mode, randomCount]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Simulador de Sorteios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Seus 6 Números (separados por vírgula)
            </label>
            <input
              type="text"
              value={numbers}
              onChange={e => setNumbers(e.target.value)}
              placeholder="01,02,03,04,05,06"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Modo</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
            >
              <option value="historical">Contra Histórico Real</option>
              <option value="random">Sorteios Aleatórios</option>
            </select>
          </div>

          {mode === 'random' && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Quantidade de Sorteios</label>
              <input
                type="number"
                min={100}
                max={100000}
                step={100}
                value={randomCount}
                onChange={e => setRandomCount(parseInt(e.target.value) || 1000)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSimulate}
            disabled={loading || numbers.split(',').filter(n => n.trim()).length !== 6}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
          >
            {loading ? 'Simulando...' : 'Executar Simulação'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Resultados — {result.totalConcursos.toLocaleString('pt-BR')} concursos ({result.modo})
          </h3>

          <div className="flex gap-3 mb-4">
            {result.numeros.map(n => (
              <NumberBall key={n} number={n} size="lg" />
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 text-gray-400"></th>
                  <th className="text-center py-3 text-yellow-400">6 acertos</th>
                  <th className="text-center py-3 text-purple-400">5 acertos</th>
                  <th className="text-center py-3 text-blue-400">4 acertos</th>
                  <th className="text-center py-3 text-gray-400">3 acertos</th>
                  <th className="text-center py-3 text-gray-400">0-2 acertos</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 font-medium">Ocorrências</td>
                  {['6', '5', '4', '3'].map(k => (
                    <td key={k} className="text-center py-3 font-mono">
                      {result.acertos[k]?.toLocaleString('pt-BR') ?? 0}
                    </td>
                  ))}
                  <td className="text-center py-3 font-mono text-gray-500">
                    {((result.acertos['2'] ?? 0) + (result.acertos['1'] ?? 0) + (result.acertos['0'] ?? 0)).toLocaleString('pt-BR')}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-gray-400 text-xs">Porcentagem</td>
                  {['6', '5', '4', '3'].map(k => (
                    <td key={k} className="text-center py-3 text-xs text-gray-400">
                      {result.porcentagens[k]?.toFixed(4)}%
                    </td>
                  ))}
                  <td className="text-center py-3 text-xs text-gray-500">
                    {(
                      (result.porcentagens['2'] ?? 0) +
                      (result.porcentagens['1'] ?? 0) +
                      (result.porcentagens['0'] ?? 0)
                    ).toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
