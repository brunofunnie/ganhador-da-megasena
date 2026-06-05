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

  const parityData = Object.entries(stats.parity.evenOddDistribution).map(([key, value]) => ({
    distribuicao: key,
    concursos: value,
    porcentagem: (value / stats.totalConcursos * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Análise Completa</h1>

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

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 15 Números Mais Frequentes</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {stats.frequency.slice(0, 15).map((f, i) => (
              <div key={f.numero} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <span className="text-white font-medium">{f.numero}</span>
                </div>
                <div className="text-gray-400">
                  {f.frequencia}x <span className="text-gray-600">({f.porcentagem}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 15 Números Mais Atrasados</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {stats.coldNumbers.slice(0, 15).map((c, i) => (
              <div key={c.numero} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-5">{i + 1}.</span>
                  <span className="text-white font-medium">{c.numero}</span>
                </div>
                <div className="text-gray-400">
                  {c.concursosAtrasado} concursos
                  {c.ultimoConcurso !== null && (
                    <span className="text-gray-600 ml-2">(último: {c.ultimoConcurso})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
