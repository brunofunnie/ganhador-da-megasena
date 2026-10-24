import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartNoAxesColumnIncreasing, ShieldAlert, Sigma } from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';
import { useStatisticsIntervals } from '../hooks/useStatisticsIntervals';
import { fetchFeatureModel, type SignificanceSummary } from '../lib/api';
import { FrequencyGrid } from '../components/FrequencyGrid';

const chartTooltip = { backgroundColor: '#ffffff', border: '1px solid #d7e1ee', borderRadius: '10px', color: '#17325c' };

export function Analise() {
  const { data: stats, isLoading, isError } = useStatistics();
  if (isLoading) return <div className="rounded-2xl border border-[#d7e1ee] bg-white px-5 py-10 text-center text-sm text-[#49627f] shadow-sm" role="status">Carregando análise completa e frequências...</div>;
  if (isError || !stats) return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800" role="alert">Não foi possível carregar os dados da análise. Tente atualizar a página.</div>;
  const sortedByNumber = [...stats.frequency].sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  const parityData = Object.entries(stats.parity.evenOddDistribution).map(([key, value]) => ({ distribuicao: key, concursos: value }));
  return <div className="space-y-6 text-[#17325c]"><header className="border-b border-[#d7e1ee] pb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3569b5]">Dados históricos</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0d2d62]">Análise completa</h1><p className="mt-2 max-w-2xl text-sm text-[#49627f]">Explore frequência, atraso e distribuição dos números em todos os concursos disponíveis.</p></header>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-[#d7e1ee] bg-white shadow-sm"><div className="border-b border-[#d7e1ee] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Frequência</p><h2 className="mt-1 font-bold">Tabela completa · 01 a 60</h2></div><div className="overflow-x-auto"><table className="min-w-[590px] w-full text-xs"><thead className="bg-[#f4f8fc] text-[#49627f]"><tr>{[0, 1, 2].flatMap(group => ['Nº', 'Vezes', '%'].map(label => <th key={`${group}-${label}`} className="px-3 py-2.5 text-left font-bold">{label}</th>))}</tr></thead><tbody>{Array.from({ length: 20 }, (_, row) => <tr key={row} className="border-t border-[#e4edf5] hover:bg-[#f8fbfe]">{[0, 1, 2].map(col => { const idx = row + col * 20; const item = sortedByNumber[idx]; return item ? <Fragment key={idx}><td className="px-3 py-1.5 font-mono font-semibold text-[#17325c]">{item.numero}</td><td className="px-3 py-1.5 font-mono text-[#075ca8]">{item.frequencia}</td><td className="px-3 py-1.5 font-mono text-[#7184a1]">{item.porcentagem}%</td></Fragment> : <td key={idx} colSpan={3} />; })}</tr>)}</tbody></table></div></section>
      <section className="overflow-hidden rounded-2xl border border-[#d7e1ee] bg-white shadow-sm"><div className="border-b border-[#d7e1ee] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Destaques</p><h2 className="mt-1 font-bold">Top 15 números</h2></div><div className="grid grid-cols-2 divide-x divide-[#d7e1ee]"><RankedList title="Mais frequentes" items={stats.frequency.slice(0, 15).map(item => ({ number: item.numero, value: item.frequencia }))} valueLabel="vezes" /><RankedList title="Mais atrasados" items={stats.coldNumbers.slice(0, 15).map(item => ({ number: item.numero, value: item.concursosAtrasado }))} valueLabel="concursos" /></div></section></div>
    <div className="rounded-2xl border border-[#d7e1ee] bg-white shadow-sm [&>div]:border-0 [&>div]:bg-transparent"><FrequencyGrid title="Frequência de todos os números (01–60)" data={stats.frequency} /></div>
    <section className="rounded-2xl border border-[#d7e1ee] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ChartNoAxesColumnIncreasing size={18} className="text-[#075ca8]" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Distribuição</p><h2 className="font-bold">Pares e ímpares por concurso</h2></div></div><ResponsiveContainer width="100%" height={260}><BarChart data={parityData}><XAxis dataKey="distribuicao" stroke="#7184a1" fontSize={12} /><YAxis stroke="#7184a1" fontSize={12} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="concursos" fill="#075ca8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></section>
    <SignificanceSection significance={stats.significance} />
    <FeatureModelSection />
    <GapIntervalsSection /></div>;
}

function GapIntervalsSection() {
  const [windowSize, setWindowSize] = useState(20);
  const { data, isLoading, isError } = useStatisticsIntervals(windowSize);

  const maxGaps = data?.numeros.reduce((max, n) => Math.max(max, n.intervalos.length), 0) ?? 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d7e1ee] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e1ee] px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Intervalos</p>
          <h2 className="mt-1 font-bold">Gaps entre aparições · últimos {data?.totalConcursos ?? windowSize} concursos</h2>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-[#49627f]">
          Últimos
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(parseInt(e.target.value, 10))}
            className="rounded-lg border border-[#c9d8e8] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#17325c] outline-none transition focus:border-[#075ca8] focus:ring-2 focus:ring-[#075ca8]/20"
          >
            {[10, 20, 50, 100, 500, 1000].map((size) => (
              <option key={size} value={size}>{size} sorteios</option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-b border-[#e4edf5] bg-[#f8fbfe] px-5 py-3 text-xs leading-5 text-[#49627f]">
        <p className="font-semibold text-[#17325c]">Como ler esta tabela</p>
        <p className="mt-1">
          Cada coluna <strong>1º gap, 2º gap, …</strong> mostra o intervalo entre duas aparições consecutivas do número: o
          <strong> 1º gap</strong> é o intervalo entre a 1ª e a 2ª aparições <em>mais recentes</em> do número na janela selecionada
          (quantos sorteios o número ficou ausente). O <strong>Atual</strong> indica há quantos concursos o número está sumido
          desde sua última aparição até o sorteio mais recente — <strong>0</strong> significa que ele saiu no último sorteio.
          Ex.: um número com <em>1º gap = 3</em> ficou 3 concursos sem sair entre suas duas últimas aparições.
        </p>
      </div>

      {isLoading && <div className="px-5 py-10 text-center text-sm text-[#49627f]" role="status">Calculando intervalos...</div>}
      {isError && <div className="px-5 py-8 text-center text-sm text-red-800" role="alert">Não foi possível calcular os intervalos. Tente atualizar a página.</div>}
      {!isLoading && !isError && data && (
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-xs">
            <thead className="bg-[#f4f8fc] text-[#49627f]">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-bold">Nº</th>
                {Array.from({ length: maxGaps }, (_, i) => (
                  <th key={i} scope="col" className="px-2 py-2.5 text-center font-bold">{i + 1}º gap</th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-center font-bold">Atual</th>
              </tr>
            </thead>
            <tbody>
              {data.numeros.map((n) => (
                <tr key={n.numero} className="border-t border-[#e4edf5] hover:bg-[#f8fbfe]">
                  <td className="px-3 py-1.5 font-mono font-semibold text-[#17325c]">{n.numero}</td>
                  {Array.from({ length: maxGaps }, (_, i) => (
                    <td key={i} className="px-2 py-1.5 text-center font-mono text-[#075ca8]">
                      {n.intervalos[i] !== undefined ? n.intervalos[i] : <span className="text-[#c3d0e0]">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center font-mono font-bold text-[#17325c]">{n.gapAtual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RankedList({ title, items, valueLabel }: { title: string; items: Array<{ number: string; value: number }>; valueLabel: string }) { return <div><h3 className="border-b border-[#d7e1ee] bg-[#f4f8fc] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#49627f]">{title}</h3><ol>{items.map((item, index) => <li key={item.number} className="flex items-center justify-between border-b border-[#e4edf5] px-4 py-2.5 last:border-0"><div className="flex items-center gap-2"><span className="w-4 text-xs text-[#7184a1]">{index + 1}</span><span className="font-mono font-semibold text-[#17325c]">{item.number}</span></div><span className="text-xs text-[#49627f]"><strong className="font-mono text-[#075ca8]">{item.value}</strong> {valueLabel}</span></li>)}</ol></div>; }

function SignificanceSection({ significance }: { significance: SignificanceSummary }) {
  return (
    <section className="rounded-2xl border border-[#d7e1ee] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert size={18} className="text-[#075ca8]" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Significância</p>
          <h2 className="font-bold">As diferenças de frequência são reais?</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Concursos" value={significance.totalDraws.toLocaleString('pt-BR')} />
        <Stat label="Esperado por dezena" value={significance.expectedPerNumber.toFixed(1)} />
        <Stat label="Desvio-padrão" value={`± ${significance.standardDeviation.toFixed(1)}`} />
        <Stat
          label={`χ² (${significance.degreesOfFreedom} g.l.)`}
          value={significance.chiSquare.toFixed(1)}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-[#49627f]">{significance.interpretation}</p>

      {significance.outliers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {significance.outliers.slice(0, 8).map((item) => (
            <span
              key={item.numero}
              className="rounded-full border border-[#d7e1ee] bg-[#f4f8fc] px-2.5 py-1 text-xs font-semibold text-[#17325c]"
            >
              <span className="font-mono">{item.numero}</span>
              <span className="ml-1 text-[#49627f]">{item.count}× · z {item.z > 0 ? '+' : ''}{item.z}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e4edf5] bg-[#f8fbfe] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7184a1]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0d2d62]">{value}</p>
    </div>
  );
}

function FeatureModelSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feature-model'],
    queryFn: fetchFeatureModel,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[#d7e1ee] bg-white px-5 py-10 text-center text-sm text-[#49627f] shadow-sm" role="status">
        Calculando o bilhete típico...
      </section>
    );
  }

  if (isError || !data) return null;

  const pct = (probability: number) => `${(probability * 100).toFixed(1)}%`;
  const centralEvens =
    data.evens[2] + data.evens[3] + data.evens[4];
  const usedQuadrants = data.quadrantsUsed[3] + data.quadrantsUsed[4];
  const zeroOrOneConsecutive = data.consecutivePairs[0] + data.consecutivePairs[1];
  const zeroOrOneRepeat = data.repeatsPrev[0] + data.repeatsPrev[1];

  return (
    <section className="rounded-2xl border border-[#d7e1ee] bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Sigma size={18} className="text-[#075ca8]" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#3569b5]">Modelo estrutural</p>
          <h2 className="font-bold">Como é um bilhete típico da Mega-Sena</h2>
        </div>
      </div>
      <p className="mb-4 text-xs leading-5 text-[#49627f]">
        Distribuições medidas em {data.totalConcursos.toLocaleString('pt-BR')} concursos. O modo
        Estatístico sorteia um alvo real e escolhe o bilhete que mais se parece com ele.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Soma média" value={`${data.sum.mean.toFixed(0)} ± ${data.sum.standardDeviation.toFixed(0)}`} />
        <Stat label="Faixa central da soma (P25–P75)" value={`${data.sum.p25}–${data.sum.p75}`} />
        <Stat label="2 a 4 pares" value={pct(centralEvens)} />
        <Stat label="3 ou 4 quadrantes" value={pct(usedQuadrants)} />
        <Stat label="0 ou 1 par consecutivo" value={pct(zeroOrOneConsecutive)} />
        <Stat label="0 ou 1 repetida do sorteio anterior" value={pct(zeroOrOneRepeat)} />
        <Stat label="Todas as dezenas ≤ 31" value={pct(data.allUnder32Rate)} />
        <Stat label="Progressão aritmética" value={pct(data.arithmeticRate)} />
      </div>

      <div className="mt-4 grid gap-2 rounded-xl border border-[#e4edf5] bg-[#f8fbfe] p-4 text-xs text-[#49627f] sm:grid-cols-2">
        <p>
          Um jogo tem <strong className="text-[#17325c]">{data.baseline.expectedHitsPerTicket.toFixed(1)} acerto esperado</strong>{' '}
          e chance de quadra de <strong className="text-[#17325c]">1 em {Math.round(1 / data.baseline.quadraProbability).toLocaleString('pt-BR')}</strong>.
        </p>
        <p>
          Nenhum filtro muda a chance de 6 acertos. O que muda é a diversificação da carteira e a
          chance de menos gente dividir o prêmio.
        </p>
      </div>
    </section>
  );
}
