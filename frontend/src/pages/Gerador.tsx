import { useState, useCallback } from 'react';
import { fetchGenerate } from '../lib/api';
import type { GenerateResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Gerador de Números</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
          >
            {loading ? 'Gerando...' : 'Gerar Números'}
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Modo: <span className="text-white capitalize">{results.modo}</span>
          </p>
          {results.jogos.map((jogo, i) => (
            <GameCard key={i} numbers={jogo} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
