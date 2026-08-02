import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStatistics } from '../hooks/useStatistics';
import { useStatus } from '../hooks/useStatus';
import { StatsCard } from '../components/StatsCard';
import { NumberBall } from '../components/NumberBall';

const chartTooltip = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e1ee',
  borderRadius: '10px',
  color: '#17325c',
};

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useStatistics();
  const { data: status } = useStatus();

  const top10 = stats?.frequency.slice(0, 10).map(f => ({ numero: f.numero, frequencia: f.frequencia })) ?? [];
  const cold10 = stats?.coldNumbers.slice(0, 10).map(c => ({ numero: c.numero, atraso: c.concursosAtrasado })) ?? [];

  if (statsLoading) {
    return <div className="rounded-2xl border border-[#d7e1ee] bg-white px-5 py-10 text-center text-sm text-[#49627f] shadow-sm" role="status">Carregando estatísticas e tendências...</div>;
  }

  if (statsError) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800" role="alert">Não foi possível carregar o painel. Tente atualizar a página.</div>;
  }

  return (
    <div className="space-y-6 text-[#17325c]">
      <header className="flex flex-col gap-4 border-b border-[#d7e1ee] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#3569b5]">Visão geral</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#0d2d62]">Painel da Mega-Sena</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#49627f]">Acompanhe os dados históricos e encontre padrões para orientar seus próximos jogos.</p>
        </div>
        <Link to="/gerador" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#075ca8] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#064c8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075ca8] sm:w-auto">
          Gerar jogo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {status?.latestDraw && (
        <section className="overflow-hidden rounded-2xl border border-[#1e65b5] bg-gradient-to-br from-[#073e82] to-[#075ca8] p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffd64d]"><Sparkles size={15} aria-hidden="true" /> Último sorteio</p>
              <h2 className="mt-2 text-xl font-bold text-white">Concurso {status.latestDraw.concurso}</h2>
              <p className="mt-1 text-sm text-blue-100">Resultado apurado em {status.latestDraw.data}</p>
            </div>
            <span className="w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50">Mega-Sena</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {[...status.latestDraw.dezenas].sort((a, b) => Number(a) - Number(b)).map(d => <NumberBall key={d} number={d} size="lg" variant="accent" />)}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Total de Concursos" value={status?.totalDraws ?? stats?.totalConcursos ?? 0} />
        <StatsCard title="Número Mais Frequente" value={stats?.frequency[0]?.numero ?? '-'} subtitle={stats?.frequency[0] ? `${stats.frequency[0].frequencia}x (${stats.frequency[0].porcentagem}%)` : undefined} />
        <StatsCard title="Maior Atraso" value={stats?.coldNumbers[0]?.numero ?? '-'} subtitle={stats?.coldNumbers[0] ? `${stats.coldNumbers[0].concursosAtrasado} concursos sem sair` : undefined} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#d7e1ee] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Frequência</p><h2 className="mt-1 font-bold text-[#17325c]">Top 10 números mais sorteados</h2></div>
          <ResponsiveContainer width="100%" height={250}><BarChart data={top10}><XAxis dataKey="numero" stroke="#7184a1" fontSize={12} /><YAxis stroke="#7184a1" fontSize={12} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="frequencia" fill="#075ca8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-[#d7e1ee] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Atraso</p><h2 className="mt-1 font-bold text-[#17325c]">Top 10 números mais atrasados</h2></div>
          <ResponsiveContainer width="100%" height={250}><BarChart data={cold10}><XAxis dataKey="numero" stroke="#7184a1" fontSize={12} /><YAxis stroke="#7184a1" fontSize={12} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="atraso" fill="#f4b000" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
      </section>

      {stats && <section className="rounded-2xl border border-[#d7e1ee] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-[#075ca8]" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Composição</p><h2 className="font-bold text-[#17325c]">Distribuição pares e ímpares</h2></div></div><div className="flex flex-wrap gap-3">{Object.entries(stats.parity.evenOddDistribution).map(([key, count]) => <div key={key} className="min-w-36 rounded-xl border border-[#d7e1ee] bg-[#f4f8fc] px-4 py-3"><p className="font-semibold text-[#17325c]">{key}</p><p className="mt-1 text-xs text-[#49627f]">{count} concursos · {(count / stats.totalConcursos * 100).toFixed(1)}%</p></div>)}</div></section>}
    </div>
  );
}
