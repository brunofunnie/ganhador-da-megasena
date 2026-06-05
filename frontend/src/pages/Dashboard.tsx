import { useStatistics } from '../hooks/useStatistics';
import { useStatus } from '../hooks/useStatus';
import { StatsCard } from '../components/StatsCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatistics();
  const { data: status } = useStatus();

  const top10 = stats?.frequency.slice(0, 10).map(f => ({
    numero: f.numero,
    frequencia: f.frequencia,
  })) ?? [];

  const cold10 = stats?.coldNumbers.slice(0, 10).map(c => ({
    numero: c.numero,
    atraso: c.concursosAtrasado,
  })) ?? [];

  if (statsLoading) {
    return <div className="text-gray-400">Carregando estatísticas...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Painel</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total de Concursos"
          value={status?.totalDraws ?? stats?.totalConcursos ?? 0}
        />
        <StatsCard
          title="Número Mais Frequente"
          value={stats?.frequency[0]?.numero ?? '-'}
          subtitle={
            stats?.frequency[0]
              ? `${stats.frequency[0].frequencia}x (${stats.frequency[0].porcentagem}%)`
              : undefined
          }
        />
        <StatsCard
          title="Maior Atraso"
          value={stats?.coldNumbers[0]?.numero ?? '-'}
          subtitle={
            stats?.coldNumbers[0]
              ? `${stats.coldNumbers[0].concursosAtrasado} concursos sem sair`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 10 Números Mais Sorteados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10}>
              <XAxis dataKey="numero" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="frequencia" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top 10 Números Mais Atrasados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cold10}>
              <XAxis dataKey="numero" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Bar dataKey="atraso" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Distribuição Pares/Ímpares</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(stats.parity.evenOddDistribution).map(([key, count]) => (
              <div key={key} className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                <span className="text-white font-medium">{key}</span>
                <p className="text-xs text-gray-400">
                  {count} concursos ({(count / stats.totalConcursos * 100).toFixed(1)}%)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
