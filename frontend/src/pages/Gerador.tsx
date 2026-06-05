import { useState, useCallback } from 'react';
import { fetchGenerate, fetchSimulate } from '../lib/api';
import type { GenerateResponse, SimulationResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';
import { NumberBall } from '../components/NumberBall';

const MODES = [
  { value: 'random', label: 'Aleatório Puro' },
  { value: 'hot', label: 'Quentes (mais sorteados)' },
  { value: 'cold', label: 'Frios (mais atrasados)' },
  { value: 'balanced', label: 'Balanceado (3P-3I)' },
  { value: 'genetic', label: 'Genético (Quentes + Frios)' },
  { value: 'sequences', label: 'Sequências (Primos/Fibonacci)' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'dreams', label: 'Sonhos (com seed)' },
];

export function Gerador() {
  const [mode, setMode] = useState('random');
  const [count, setCount] = useState(1);
  const [fixed, setFixed] = useState('');
  const [exclude, setExclude] = useState('');
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [simMode, setSimMode] = useState('historical');
  const [randomCount, setRandomCount] = useState(1000);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchGenerate({
        mode,
        count,
        fixed: fixed || undefined,
        exclude: exclude || undefined,
        seeds: seed || undefined,
      });
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mode, count, fixed, exclude, seed]);

  const handleSimulateGame = useCallback(async (numbers: string[]) => {
    setSimLoading(true);
    try {
      const res = await fetchSimulate({
        numbers: numbers.join(','),
        mode: simMode,
        count: simMode === 'random' ? randomCount : undefined,
      });
      setSimResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  }, [simMode, randomCount]);

  const handleSimulateAll = useCallback(async () => {
    if (!results || results.jogos.length === 0) return;
    setSimLoading(true);
    try {
      const numbersParam = results.jogos.map(j => j.join(',')).join(';');
      const res = await fetchSimulate({
        numbers: numbersParam,
        mode: simMode,
        count: simMode === 'random' ? randomCount : undefined,
      });
      setSimResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  }, [results, simMode, randomCount]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Gerador & Simulador</h1>

      {/* Two-column layout: Generator | Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Generator */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <h2 className="text-lg font-bold text-white">Gerador de Números</h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Modo</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              >
                {MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Quantidade de Jogos (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Números Fixos (ex: 01,15,30)</label>
              <input
                type="text"
                value={fixed}
                onChange={e => setFixed(e.target.value)}
                placeholder="01,15,30"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Números Excluídos (ex: 58,59,60)</label>
              <input
                type="text"
                value={exclude}
                onChange={e => setExclude(e.target.value)}
                placeholder="58,59,60"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              />
            </div>

            {mode === 'dreams' && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Números Semente (ex: 07,13,21)</label>
                <input
                  type="text"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="07,13,21"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
                />
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
            >
              {loading ? 'Gerando...' : 'Gerar Números'}
            </button>
          </div>
        </div>

        {/* Right: Simulator */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <h2 className="text-lg font-bold text-white">Simulador</h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Modo de Simulação</label>
              <select
                value={simMode}
                onChange={e => setSimMode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm"
              >
                <option value="historical">Contra Histórico Real</option>
                <option value="random">Sorteios Aleatórios</option>
              </select>
            </div>

            {simMode === 'random' && (
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

            <p className="text-xs text-gray-500 pt-2">
              Clique "Simular este jogo" ou "Simular Todos" nos números gerados à esquerda.
            </p>
          </div>
        </div>
      </div>

      {/* Results: Generated Games (left) | Simulator Results (right) */}
      {(results || simResult) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Generated Games */}
          {results && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Modo: <span className="text-white capitalize">{results.modo}</span>
                </p>
                {results.jogos.length > 1 && (
                  <button
                    onClick={handleSimulateAll}
                    disabled={simLoading}
                    className="text-sm bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white px-3 py-1 rounded-md transition-colors"
                  >
                    {simLoading ? 'Simulando todos...' : 'Simular Todos'}
                  </button>
                )}
              </div>
              {results.jogos.map((jogo, i) => (
                <GameCard
                  key={i}
                  numbers={jogo}
                  index={i}
                  action={
                    <button
                      onClick={() => handleSimulateGame(jogo)}
                      disabled={simLoading}
                      className="text-xs bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      {simLoading ? 'Simulando...' : 'Simular este jogo'}
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {/* Right: Simulator Results */}
          {simResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-400">
                Resultados — {simResult.totalConcursos.toLocaleString('pt-BR')} concursos ({simResult.modo})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 text-gray-400">Jogo</th>
                      <th className="text-center py-2 text-gray-400">Números</th>
                      <th className="text-center py-2 text-yellow-400">6</th>
                      <th className="text-center py-2 text-purple-400">5</th>
                      <th className="text-center py-2 text-blue-400">4</th>
                      <th className="text-center py-2 text-gray-400">3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResult.jogos.map((jogo, i) => (
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
      )}
    </div>
  );
}
