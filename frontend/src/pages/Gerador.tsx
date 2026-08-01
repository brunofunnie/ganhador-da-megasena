import { useCallback, useState } from 'react';
import { Dice5, WandSparkles } from 'lucide-react';
import { fetchGenerate, fetchSimulate, addGameToWallet, createWallet, type GenerateResponse, type SimulationResponse } from '../lib/api';
import { GameCard } from '../components/GameCard';
import { NumberPicker } from '../components/NumberPicker';
import { SimulationDrawer } from '../components/SimulationDrawer';
import { useQueryClient } from '@tanstack/react-query';
import { useWallets } from '../hooks/useWallets';

const MODES = [
  { value: 'random', label: 'Aleatório Puro' },
  { value: 'hot', label: 'Quentes (mais sorteados)' },
  { value: 'cold', label: 'Frios (mais atrasados)' },
  { value: 'balanced', label: 'Balanceado (3P-3I)' },
  { value: 'genetic', label: 'Genético (Quentes + Frios)' },
  { value: 'sequences', label: 'Sequências (Primos/Fibonacci)' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'dreams', label: 'Sonhos (com seed)' },
  { value: 'trend', label: 'Tendência Temporal' },
  { value: 'monte-carlo', label: 'Monte Carlo' },
  { value: 'ensemble', label: 'Ensemble (voto entre estratégias)' },
  { value: 'markov', label: 'Markov (cadeia de transição)' },
];

const ALL_STRATEGIES = ['top6', 'cold6', 'balanced-3p3i', 'quadrants', 'full-cycle', 'sum-target', 'primes-power', 'avg-frequency'] as const;
const DEFAULT_STRATEGIES = ['top6', 'cold6', 'balanced-3p3i', 'quadrants', 'primes-power', 'avg-frequency'];

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100';

export function Gerador() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('random');
  const [count, setCount] = useState(1);
  const [fixed, setFixed] = useState('');
  const [exclude, setExclude] = useState('');
  const [seed, setSeed] = useState('');
  const [iterations, setIterations] = useState(10000);
  const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES.join(','));
  const [windowSize, setWindowSize] = useState(50);
  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [simMode, setSimMode] = useState('historical');
  const [randomCount, setRandomCount] = useState(1000);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGames, setDrawerGames] = useState<string[][]>([]);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  const { data: walletsData } = useWallets();

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(
        await fetchGenerate({
          mode,
          count,
          fixed: fixed || undefined,
          exclude: exclude || undefined,
          seeds: seed || undefined,
          iterations: mode === 'monte-carlo' ? iterations : undefined,
          strategies: mode === 'ensemble' ? strategies : undefined,
          windowSize: mode === 'trend' ? windowSize : undefined,
        }),
      );
    } catch (err) {
      console.error(err);
      setError('Não foi possível gerar os jogos. Revise os números informados e tente novamente.');
    } finally {
      setLoading(false);
    }
    }, [mode, count, fixed, exclude, seed, iterations, strategies, windowSize]);

  const handleRunSimulation = useCallback(async () => {
    if (drawerGames.length === 0) return;
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    try {
      setSimResult(
        await fetchSimulate({
          numbers: drawerGames.map((jogo) => jogo.join(',')).join(';'),
          mode: simMode,
          count: simMode === 'random' ? randomCount : undefined,
        }),
      );
    } catch (err) {
      console.error(err);
      setSimError('Não foi possível executar a simulação. Tente novamente em instantes.');
    } finally {
      setSimLoading(false);
    }
  }, [drawerGames, simMode, randomCount]);

  const handleSimulateGame = useCallback((numbers: string[][]) => {
    setSimResult(null);
    setSimError(null);
    setDrawerGames(numbers);
    setDrawerOpen(true);
  }, []);

  const handleSimulateAll = useCallback(() => {
    if (results?.jogos.length) {
      handleSimulateGame(results.jogos);
    }
  }, [results, handleSimulateGame]);

  const handleSaveGame = useCallback(
    async (numbers: string[]) => {
      const key = numbers.join(',');
      setSavingKey(key);
      try {
        const wallets = walletsData?.carteiras ?? [];
        const walletId = wallets[0]?.id ?? (await createWallet('Meus jogos')).id;
        await addGameToWallet(walletId, numbers);
        setSavedKeys((current) => ({ ...current, [key]: true }));
        await queryClient.invalidateQueries({ queryKey: ['wallets'] });
      } catch (err) {
        console.error(err);
      } finally {
        setSavingKey(null);
      }
    },
    [walletsData, queryClient],
  );

  return (
    <div className="space-y-6 text-slate-800">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Estratégias de jogo</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Gerador & simulador</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Monte combinações com base na estratégia escolhida e compare o desempenho antes de jogar.
        </p>
      </header>

      <section className="surface-card p-5 shadow-sm">
        <div className="mb-5 flex gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
            <WandSparkles size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Gerador de números</h2>
            <p className="text-sm text-slate-500">Configure sua combinação.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">
            Modo
            <select value={mode} onChange={(event) => setMode(event.target.value)} className={fieldClass}>
              {MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Quantidade de jogos <span className="font-normal text-slate-500">(1–10)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(event) => setCount(Math.max(1, Math.min(10, parseInt(event.target.value) || 1)))}
              className={fieldClass}
            />
          </label>

          <div className="block text-sm font-semibold text-slate-800">
            <span className="block">
              Números fixos <span className="font-normal text-slate-500">(opcional)</span>
            </span>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={fixed}
                onChange={(event) => setFixed(event.target.value)}
                placeholder="01,15,30"
                className={`${fieldClass} mt-0 flex-1`}
              />
              <NumberPicker value={fixed} onChange={setFixed}>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Selecionar
                </button>
              </NumberPicker>
            </div>
          </div>

          <div className="block text-sm font-semibold text-slate-800">
            <span className="block">
              Números excluídos <span className="font-normal text-slate-500">(opcional)</span>
            </span>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={exclude}
                onChange={(event) => setExclude(event.target.value)}
                placeholder="58,59,60"
                className={`${fieldClass} mt-0 flex-1`}
              />
              <NumberPicker value={exclude} onChange={setExclude}>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Selecionar
                </button>
              </NumberPicker>
            </div>
          </div>

          {mode === 'dreams' && (
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              Números semente
              <input
                type="text"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="07,13,21"
                className={fieldClass}
              />
            </label>
          )}

          {mode === 'trend' && (
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              Janela de sorteios
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={10}
                  value={windowSize}
                  onChange={(e) => setWindowSize(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="min-w-[3rem] text-sm font-bold text-blue-700">{windowSize}</span>
              </div>
            </label>
          )}

          {mode === 'monte-carlo' && (
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              Iterações
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="range"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="min-w-[5rem] text-sm font-bold text-blue-700">{iterations.toLocaleString()}</span>
              </div>
            </label>
          )}

          {mode === 'ensemble' && (
            <fieldset className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              <legend className="mb-2">Estratégias</legend>
              <div className="flex flex-wrap gap-3">
                {ALL_STRATEGIES.map((s) => {
                  const checked = strategies.split(',').includes(s);
                  return (
                    <label key={s} className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = strategies.split(',').filter(Boolean);
                          const next = checked
                            ? current.filter((x) => x !== s)
                            : [...current, s];
                          setStrategies(next.join(','));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600/20"
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Dice5 size={18} aria-hidden="true" />
          {loading ? 'Gerando jogos...' : 'Gerar números'}
        </button>
      </section>

      {results && (
        <section className="surface-card p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Combinações geradas</p>
              <p className="mt-1 text-sm text-slate-500">
                Modo: <span className="capitalize text-slate-800">{results.modo}</span>
              </p>
            </div>
            {results.jogos.length > 1 && (
              <button
                onClick={handleSimulateAll}
                disabled={simLoading}
                className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
              >
                {simLoading ? 'Simulando todos...' : 'Simular todos'}
              </button>
            )}
          </div>

            <div className="grid gap-3 sm:grid-cols-2">
            {results.jogos.map((jogo, index) => (
              <GameCard
                key={index}
                numbers={jogo}
                index={index}
                onSimulate={(numbers) => handleSimulateGame([numbers])}
                ballSize="sm"
              />
            ))}
          </div>
        </section>
      )}

      <SimulationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        games={drawerGames}
        result={simResult}
        loading={simLoading}
        error={simError}
        simMode={simMode}
        onSimModeChange={setSimMode}
        randomCount={randomCount}
        onRandomCountChange={setRandomCount}
        onRunSimulation={handleRunSimulation}
        onSaveGame={handleSaveGame}
        savingKey={savingKey}
        savedKeys={savedKeys}
      />
    </div>
  );
}
