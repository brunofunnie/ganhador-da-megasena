import { useStatistics } from '../hooks/useStatistics';
import { FrequencyGrid } from '../components/FrequencyGrid';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Analise() {
  const { data: stats, isLoading } = useStatistics();

  if (isLoading) {
    return <div className="text-gray-400">Carregando análise...</div>;
  }

  if (!stats) {
    return <div className="text-red-400">Erro ao carregar dados.</div>;
  }

  const sortedByNumber = [...stats.frequency].sort((a, b) => parseInt(a.numero) - parseInt(b.numero));

  const parityData = Object.entries(stats.parity.evenOddDistribution).map(([key, value]) => ({
    distribuicao: key,
    concursos: value,
    porcentagem: (value / stats.totalConcursos * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Análise Completa</h1>

      {/* Row 1: Full table (left) | Top 15 combined (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Tabela Completa */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-800">
            <h3 className="text-xs font-medium text-gray-500">Tabela Completa — Todos os 60 Números</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] leading-tight">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-0.5 px-1.5">Nº</th>
                  <th className="text-left py-0.5 px-1.5">Vezes</th>
                  <th className="text-left py-0.5 px-1.5">%</th>
                  <th className="text-left py-0.5 px-1.5">Nº</th>
                  <th className="text-left py-0.5 px-1.5">Vezes</th>
                  <th className="text-left py-0.5 px-1.5">%</th>
                  <th className="text-left py-0.5 px-1.5">Nº</th>
                  <th className="text-left py-0.5 px-1.5">Vezes</th>
                  <th className="text-left py-0.5 px-1.5">%</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }, (_, row) => (
                  <tr key={row} className="border-b border-gray-800/30">
                    {[0, 1, 2].map(col => {
                      const idx = row + col * 20;
                      const item = sortedByNumber[idx];
                      if (!item) return <td key={col} colSpan={3} className="py-0 px-1.5"></td>;
                      return (
                        <>
                          <td key={`num-${idx}`} className="py-0 px-1.5 font-mono text-white">{item.numero}</td>
                          <td key={`freq-${idx}`} className="py-0 px-1.5 font-mono text-green-400">{item.frequencia}</td>
                          <td key={`pct-${idx}`} className="py-0 px-1.5 font-mono text-gray-500">{item.porcentagem}%</td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Combined Top 15 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-800">
            <h3 className="text-xs font-medium text-gray-500">Top 15</h3>
          </div>
          <div className="grid grid-cols-2">
            {/* Left column: Most frequent */}
            <div className="border-r border-gray-800/50">
              <div className="px-3 py-1 border-b border-gray-800/50">
                <span className="text-[10px] text-gray-500">Mais Frequentes</span>
              </div>
              <div className="overflow-y-auto max-h-72">
                {stats.frequency.slice(0, 15).map((f, i) => (
                  <div key={f.numero} className="flex items-center justify-between px-3 py-0.5 text-xs border-b border-gray-800/20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600 w-3">{i + 1}</span>
                      <span className="text-white font-mono">{f.numero}</span>
                    </div>
                    <span className="text-gray-400 font-mono">{f.frequencia}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: Most delayed */}
            <div>
              <div className="px-3 py-1 border-b border-gray-800/50">
                <span className="text-[10px] text-gray-500">Mais Atrasados</span>
              </div>
              <div className="overflow-y-auto max-h-72">
                {stats.coldNumbers.slice(0, 15).map((c, i) => (
                  <div key={c.numero} className="flex items-center justify-between px-3 py-0.5 text-xs border-b border-gray-800/20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600 w-3">{i + 1}</span>
                      <span className="text-white font-mono">{c.numero}</span>
                    </div>
                    <span className="text-gray-400 font-mono">{c.concursosAtrasado}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <FrequencyGrid
        title="Frequência de Todos os Números (01-60)"
        data={stats.frequency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Distribuição Pares/Ímpares</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={parityData}>
              <XAxis dataKey="distribuicao" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="concursos" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
