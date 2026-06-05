import { useState, useCallback } from 'react';
import { fetchSimulate, type SimulationResponse } from '../lib/api';
import { NumberBall } from '../components/NumberBall';

export function Simulador() {
  const [numbersText, setNumbersText] = useState('');
  const [mode, setMode] = useState('historical');
  const [randomCount, setRandomCount] = useState(1000);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const games = numbersText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const validGames = games.filter(g => g.split(',').filter(n => n.trim()).length === 6);

  const handleSimulate = useCallback(async () => {
    if (validGames.length === 0) return;

    setLoading(true);
    try {
      const numbersParam = validGames.join(';');
      const res = await fetchSimulate({
        numbers: numbersParam,
        mode,
        count: mode === 'random' ? randomCount : undefined,
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [numbersText, mode, randomCount, validGames]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Simulador de Sorteios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Seus Jogos (um por linha, 6 números separados por vírgula)
            </label>
            <textarea
              value={numbersText}
              onChange={e => setNumbersText(e.target.value)}
              placeholder={"01,02,03,04,05,06\n07,08,09,10,11,12\n13,14,15,16,17,18"}
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-y"
            />
            <span className="text-xs text-gray-500 mt-1 block">
              {games.length > 0 ? `${validGames.length} de ${games.length} jogos válidos` : ''}
            </span>
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
            disabled={loading || validGames.length === 0}
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 text-gray-400">Jogo</th>
                  <th className="text-center py-3 text-gray-400">Números</th>
                  <th className="text-center py-3 text-yellow-400">6</th>
                  <th className="text-center py-3 text-purple-400">5</th>
                  <th className="text-center py-3 text-blue-400">4</th>
                  <th className="text-center py-3 text-gray-400">3</th>
                </tr>
              </thead>
              <tbody>
                {result.jogos.map((jogo, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 font-mono text-gray-500">#{i + 1}</td>
                    <td className="py-2">
                      <div className="flex gap-1 justify-center">
                        {jogo.numeros.map(n => (
                          <NumberBall key={n} number={n} size="sm" />
                        ))}
                      </div>
                    </td>
                    {['6', '5', '4', '3'].map(k => (
                      <td key={k} className="text-center py-2 font-mono">
                        <div className="text-white">{jogo.acertos[k]?.toLocaleString('pt-BR') ?? 0}</div>
                        <div className="text-xs text-gray-500">{jogo.porcentagens[k]?.toFixed(2)}%</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
