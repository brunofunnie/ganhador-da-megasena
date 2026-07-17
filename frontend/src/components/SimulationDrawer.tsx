import { Drawer } from '@base-ui/react/drawer';
import { X, Save, FlaskConical } from 'lucide-react';
import { NumberBall } from './NumberBall';
import type { SimulationResponse } from '../lib/api';

interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
  result: SimulationResponse | null;
  loading: boolean;
  error: string | null;
  simMode: string;
  onSimModeChange: (mode: string) => void;
  randomCount: number;
  onRandomCountChange: (count: number) => void;
  onSaveGame: (numbers: string[]) => void;
  savingKey: string | null;
  savedKeys: Record<string, boolean>;
}

export function SimulationDrawer({
  open,
  onClose,
  result,
  loading,
  error,
  simMode,
  onSimModeChange,
  randomCount,
  onRandomCountChange,
  onSaveGame,
  savingKey,
  savedKeys,
}: SimulationDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity data-[open]:opacity-100 data-[closed]:opacity-0" />
        <Drawer.Popup className="fixed inset-y-0 right-0 z-50 flex h-full w-[480px] max-w-[95vw] flex-col bg-white shadow-2xl outline-none transition-transform data-[open]:translate-x-0 data-[closed]:translate-x-full">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-blue-700">Resultado da simulação</p>
                <h2 className="font-bold text-slate-900">
                  {result ? `${result.totalConcursos.toLocaleString('pt-BR')} concursos · ${result.modo}` : 'Simulação'}
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
            </div>

            <div className="flex-1 overflow-y-auto p-5">
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
              {result && !loading && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-[420px] w-full text-sm">
                      <thead className="bg-[#0a376c] text-white">
                        <tr>
                          <th className="px-3 py-3 text-left font-semibold">Jogo</th>
                          <th className="px-3 py-3 text-center font-semibold">Números</th>
                          {['6', '5', '4', '3'].map((k) => (
                            <th key={k} className="px-2 py-3 text-center font-semibold">{k} acertos</th>
                          ))}
                          <th className="px-3 py-3 text-center font-semibold">Salvar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.jogos.map((jogo, index) => (
                          <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="px-3 py-3 font-mono text-slate-500">#{index + 1}</td>
                            <td className="px-3 py-3">
                              <div className="flex min-w-max justify-center gap-1">
                                {jogo.numeros.map((n) => (
                                  <NumberBall key={n} number={n} size="sm" />
                                ))}
                              </div>
                            </td>
                            {['6', '5', '4', '3'].map((k) => (
                              <td key={k} className="px-2 py-3 text-center font-mono">
                                <span className="block font-semibold text-slate-800">{jogo.acertos[k]?.toLocaleString('pt-BR') ?? 0}</span>
                                <span className="text-xs text-slate-400">{jogo.porcentagens[k]?.toFixed(2)}%</span>
                              </td>
                            ))}
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => onSaveGame(jogo.numeros)}
                                disabled={savingKey === jogo.numeros.join(',')}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-700 px-2 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                              >
                                <Save size={13} />
                                {savedKeys[jogo.numeros.join(',')] ? 'Salvo' : savingKey === jogo.numeros.join(',') ? '...' : 'Salvar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
