import { Drawer } from '@base-ui/react/drawer';
import { X, Save, FlaskConical, Play } from 'lucide-react';
import { NumberBall } from './NumberBall';
import type { SimulationResponse } from '../lib/api';

interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
  games: string[][];
  result: SimulationResponse | null;
  loading: boolean;
  error: string | null;
  simMode: string;
  onSimModeChange: (mode: string) => void;
  randomCount: number;
  onRandomCountChange: (count: number) => void;
  onRunSimulation: () => void;
  onSaveGame: (numbers: string[]) => void;
  savingKey: string | null;
  savedKeys: Record<string, boolean>;
}

export function SimulationDrawer({
  open,
  onClose,
  games,
  result,
  loading,
  error,
  simMode,
  onSimModeChange,
  randomCount,
  onRandomCountChange,
  onRunSimulation,
  onSaveGame,
  savingKey,
  savedKeys,
}: SimulationDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-slate-900/40 transition-opacity data-[open]:opacity-100 data-[closed]:opacity-0" />
        <Drawer.Popup className="fixed inset-y-0 right-0 z-50 flex h-full w-[640px] max-w-[95vw] flex-col bg-white shadow-xl outline-none will-change-transform data-[open]:translate-x-0 data-[closed]:translate-x-full">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-blue-700">Simulação</p>
              <h2 className="font-bold text-slate-900">
                {result ? `${result.totalConcursos.toLocaleString('pt-BR')} concursos · ${result.modo}` : `${games.length} jogo${games.length > 1 ? 's' : ''} selecionado${games.length > 1 ? 's' : ''}`}
              </h2>
            </div>
            <Drawer.Close className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="Fechar">
              <X size={18} />
            </Drawer.Close>
          </div>

          <div className="space-y-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <label className="block text-xs font-bold text-slate-700">
              Modo de simulação
              <select
                value={simMode}
                onChange={(e) => onSimModeChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="historical">Contra histórico real</option>
                <option value="random">Sorteios aleatórios</option>
              </select>
            </label>
            {simMode === 'random' && (
              <label className="block text-xs font-bold text-slate-700">
                Quantidade de sorteios
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={100}
                  value={randomCount}
                  onChange={(e) => onRandomCountChange(parseInt(e.target.value) || 1000)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            )}
            <button
              type="button"
              onClick={onRunSimulation}
              disabled={loading || games.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-400"
            >
              <Play size={16} />
              {loading ? 'Simulando...' : 'Rodar simulação'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <FlaskConical size={16} className="animate-pulse" />
                Simulando...
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            {!loading && !result && !error && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Jogos prontos para simulação:</p>
                {games.map((numbers, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">Jogo {index + 1}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {numbers.map((n) => (
                        <NumberBall key={n} number={n} size="sm" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {result && !loading && (
              <div className="space-y-2">
                <div className="grid grid-cols-[3rem_1fr_repeat(4,4.5rem)_4rem] items-center gap-2 rounded-xl bg-[#0a376c] px-3 py-2 text-xs font-bold text-white">
                  <span>#</span>
                  <span>Números</span>
                  {['6', '5', '4', '3'].map((k) => (
                    <span key={k} className="text-center">{k}</span>
                  ))}
                  <span className="text-center">Salvar</span>
                </div>
                {result.jogos.map((jogo, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[3rem_1fr_repeat(4,4.5rem)_4rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <span className="font-mono text-sm font-semibold text-slate-500">#{index + 1}</span>
                    <div className="flex flex-wrap gap-1">
                      {jogo.numeros.map((n) => (
                        <NumberBall key={n} number={n} size="sm" />
                      ))}
                    </div>
                    {['6', '5', '4', '3'].map((k) => (
                      <div key={k} className="text-center">
                        <span className="block font-mono text-sm font-semibold text-slate-800">{jogo.acertos[k]?.toLocaleString('pt-BR') ?? 0}</span>
                        <span className="block text-[0.65rem] text-slate-400">{jogo.porcentagens[k]?.toFixed(2)}%</span>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onSaveGame(jogo.numeros)}
                      disabled={savingKey === jogo.numeros.join(',')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-700 px-2 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Save size={13} />
                      {savedKeys[jogo.numeros.join(',')] ? 'Salvo' : savingKey === jogo.numeros.join(',') ? '...' : 'Salvar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
