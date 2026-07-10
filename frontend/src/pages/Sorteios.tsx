import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  LoaderCircle,
  MapPin,
  Search,
  Trophy,
} from 'lucide-react';
import { NumberBall } from '../components/NumberBall';
import { useDraw, useDrawAnalysis, useDraws } from '../hooks/useDraws';
import type { DrawFilters } from '../lib/api';

const PAGE_SIZE = 12;
const fieldClassName = 'w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--blue-600)] focus:ring-2 focus:ring-[var(--blue-100)]';
const fieldLabelClassName = 'mb-1.5 block text-sm font-semibold text-[var(--foreground)]';
const tableHeaderClassName = 'border-b border-[var(--line)] bg-[var(--surface-muted)] text-left text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]';

function formatCurrency(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'Não informado'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatAverage(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function sortedNumbers(numbers: string[]) {
  return [...numbers].sort((a, b) => Number(a) - Number(b));
}

function locationLabel(location: unknown) {
  if (typeof location === 'string') return location;
  if (!location || typeof location !== 'object') return 'Local não informado';

  const data = location as Record<string, unknown>;
  const place = [data.municipio, data.uf].filter((value): value is string => typeof value === 'string').join(' · ');
  const winners = typeof data.ganhadores === 'number' ? `${data.ganhadores} ganhador${data.ganhadores === 1 ? '' : 'es'}` : null;
  return [place || (typeof data.local === 'string' ? data.local : null), winners].filter(Boolean).join(' — ') || 'Local não informado';
}

export function Sorteios() {
  const [filters, setFilters] = useState<DrawFilters>({ page: 1, limit: PAGE_SIZE });
  const [selectedConcurso, setSelectedConcurso] = useState<number | null>(null);
  const { data: drawList, isLoading: listLoading, isFetching: listFetching, isError: listError } = useDraws(filters);
  const activeConcurso = !listFetching && drawList?.items.length
    ? (selectedConcurso ?? drawList.items[0].concurso)
    : null;
  const { data: draw, isLoading: detailLoading, isError: detailError } = useDraw(activeConcurso);
  const { data: analysis, isLoading: analysisLoading, isError: analysisError } = useDrawAnalysis(activeConcurso);

  const currentPage = filters.page ?? 1;
  const statusText = useMemo(() => {
    if (!drawList) return '';
    return `${drawList.total.toLocaleString('pt-BR')} concurso${drawList.total === 1 ? '' : 's'} encontrado${drawList.total === 1 ? '' : 's'}`;
  }, [drawList]);

  function updateFilter<K extends keyof DrawFilters>(key: K, value: DrawFilters[K]) {
    setSelectedConcurso(null);
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1, limit: PAGE_SIZE }));
  }

  function changePage(page: number) {
    setSelectedConcurso(null);
    setFilters((current) => ({ ...current, page }));
  }

  const newestConcurso = drawList?.items[0]?.concurso ?? null;
  const canGoOlder = activeConcurso !== null && activeConcurso > 1;
  const canGoNewer = activeConcurso !== null && (newestConcurso === null || activeConcurso < newestConcurso);

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Histórico oficial</span>
          <h1>Sorteios da Mega-Sena</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            Consulte resultados, faixas de premiação e padrões de cada concurso sem carregar todo o histórico de uma vez.
          </p>
          {drawList && <p className="mt-3 text-sm font-semibold text-[var(--blue-700)]">{statusText}</p>}
        </div>
      </div>

      <section className="surface-card p-4 sm:p-5" aria-labelledby="draw-filters-title">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--blue-100)] text-[var(--blue-700)]" aria-hidden="true"><Filter size={18} /></span>
          <div>
            <h2 id="draw-filters-title" className="text-base">Filtrar concursos</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">A busca atualiza a lista a partir da primeira página.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={fieldLabelClassName}>Concurso</span>
            <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" /><input value={filters.search ?? ''} onChange={(event) => updateFilter('search', event.target.value)} className={`${fieldClassName} pl-9`} placeholder="Ex.: 2780" inputMode="numeric" /></span>
          </label>
          <label>
            <span className={fieldLabelClassName}>De</span>
            <input type="date" value={filters.from ?? ''} onChange={(event) => updateFilter('from', event.target.value)} className={fieldClassName} />
          </label>
          <label>
            <span className={fieldLabelClassName}>Até</span>
            <input type="date" value={filters.to ?? ''} onChange={(event) => updateFilter('to', event.target.value)} className={fieldClassName} />
          </label>
          <label>
            <span className={fieldLabelClassName}>Situação do prêmio</span>
            <select value={filters.accumulated === undefined ? '' : String(filters.accumulated)} onChange={(event) => updateFilter('accumulated', event.target.value === '' ? undefined : event.target.value === 'true')} className={fieldClassName}>
              <option value="">Todos os resultados</option>
              <option value="true">Acumulou</option>
              <option value="false">Teve ganhador na sena</option>
            </select>
          </label>
        </div>
      </section>

      {listLoading ? (
        <div className="status-panel" role="status" aria-live="polite"><LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-[var(--blue-700)]" aria-hidden="true" /><div><p className="font-semibold text-[var(--navy-950)]">Carregando concursos</p><p className="mt-1 text-sm">Buscando o histórico oficial disponível.</p></div></div>
      ) : listError ? (
        <div className="status-panel border-red-200 bg-red-50 text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Não foi possível carregar os sorteios</p><p className="mt-1 text-sm text-red-800">Atualize a página para tentar novamente.</p></div></div>
      ) : !drawList?.items.length ? (
        <div className="status-panel" role="status"><CalendarDays className="mt-0.5 size-5 shrink-0 text-[var(--blue-700)]" aria-hidden="true" /><div><p className="font-semibold text-[var(--navy-950)]">Nenhum concurso encontrado</p><p className="mt-1 text-sm">Ajuste os filtros para consultar outra parte do histórico.</p></div></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.35fr)]">
          <section className="surface-card overflow-hidden" aria-labelledby="draw-list-title">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
              <div><span className="eyebrow mb-1">Página {drawList.page} de {drawList.totalPages || 1}</span><h2 id="draw-list-title" className="text-base">Concursos encontrados</h2></div>
              {listFetching && <LoaderCircle className="size-4 animate-spin text-[var(--blue-700)]" aria-label="Atualizando lista" />}
            </div>
            <div className="divide-y divide-[var(--line)]">
              {drawList.items.map((item) => {
                const selected = item.concurso === activeConcurso;
                return <button key={item.concurso} type="button" onClick={() => setSelectedConcurso(item.concurso)} aria-pressed={selected} className={`block w-full px-4 py-4 text-left transition ${selected ? 'bg-[var(--blue-100)] shadow-[inset_4px_0_0_var(--blue-700)]' : 'hover:bg-[var(--surface-muted)]'}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[var(--navy-950)]">Concurso {item.concurso}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.data}</p></div><span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${item.acumulou === true ? 'bg-[var(--lottery-yellow-soft)] text-[var(--navy-900)]' : item.acumulou === false ? 'bg-emerald-50 text-emerald-800' : 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]'}`}>{item.acumulou === true ? 'Acumulou' : item.acumulou === false ? 'Sena com ganhador' : 'Prêmio indisponível'}</span></div>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Dezenas do concurso ${item.concurso}`}>{sortedNumbers(item.dezenas).map((number) => <NumberBall key={number} number={number} size="sm" />)}</div>
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">Prêmio principal: {item.acumulou === true ? 'acumulado para o próximo concurso' : item.acumulou === false ? 'teve ao menos um ganhador' : 'dados não informados'}</p>
                </button>;
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3"><button type="button" className="secondary-action min-h-9 px-3 py-2 text-xs disabled:opacity-45" disabled={currentPage <= 1 || listFetching} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" />Anterior</button><span className="text-xs font-semibold text-[var(--muted-foreground)]">{drawList.total.toLocaleString('pt-BR')} no total</span><button type="button" className="secondary-action min-h-9 px-3 py-2 text-xs disabled:opacity-45" disabled={currentPage >= drawList.totalPages || listFetching} onClick={() => changePage(currentPage + 1)}>Próxima<ChevronRight size={16} aria-hidden="true" /></button></div>
          </section>

          <section className="min-w-0 space-y-6" aria-live="polite">
            {detailLoading ? <div className="status-panel" role="status"><LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-[var(--blue-700)]" aria-hidden="true" /><div><p className="font-semibold text-[var(--navy-950)]">Carregando detalhes</p><p className="mt-1 text-sm">Preparando as informações do concurso selecionado.</p></div></div> : detailError || !draw ? <div className="status-panel border-red-200 bg-red-50 text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Detalhes indisponíveis</p><p className="mt-1 text-sm text-red-800">Este concurso não pôde ser localizado no histórico detalhado.</p></div></div> : <>
              <article className="surface-card overflow-hidden" aria-labelledby="draw-detail-title">
                <div className="bg-[linear-gradient(125deg,var(--navy-900),var(--blue-700))] p-4 text-[var(--on-dark)] sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--lottery-yellow)]"><Trophy size={15} aria-hidden="true" />Resultado oficial</span><h2 id="draw-detail-title" className="text-2xl text-[var(--on-dark)]">Concurso {draw.concurso}</h2><p className="mt-1 text-sm text-[#dce9ff]">{draw.data}{draw.local ? ` · ${draw.local}` : ''}</p></div><div className="flex gap-2"><button type="button" onClick={() => setSelectedConcurso(activeConcurso ? activeConcurso - 1 : null)} disabled={!canGoOlder || detailLoading} className="rounded-lg border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Concurso anterior"><ArrowLeft size={18} aria-hidden="true" /></button><button type="button" onClick={() => setSelectedConcurso(activeConcurso ? activeConcurso + 1 : null)} disabled={!canGoNewer || detailLoading} className="rounded-lg border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próximo concurso"><ArrowRight size={18} aria-hidden="true" /></button></div></div><div className="mt-5 flex flex-wrap gap-2" aria-label="Dezenas sorteadas">{sortedNumbers(draw.dezenas).map((number) => <NumberBall key={number} number={number} size="md" variant="accent" />)}</div></div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5"><div><h3 className="text-sm">Ordem do sorteio</h3>{draw.dezenasOrdemSorteio?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{draw.dezenasOrdemSorteio.map((number, index) => <span key={`${number}-${index}`} className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--navy-900)]"><span className="text-[var(--muted-foreground)]">{index + 1}º</span>{number}</span>)}</div> : <p className="mt-2 text-sm text-[var(--muted-foreground)]">A ordem do sorteio não foi informada.</p>}</div><div><h3 className="text-sm">Situação</h3><p className="mt-2 text-sm text-[var(--muted-foreground)]">{draw.acumulou === true ? 'O prêmio principal acumulou.' : draw.acumulou === false ? 'Houve ganhador na faixa principal.' : 'A situação de acumulação não está disponível.'}</p>{draw.concursoEspecial && <span className="mt-2 inline-flex rounded-full bg-[var(--lottery-yellow-soft)] px-2.5 py-1 text-xs font-bold text-[var(--navy-900)]">Concurso especial</span>}</div></div>
              </article>

              <section className="surface-card overflow-hidden" aria-labelledby="prizes-title"><div className="border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3"><h2 id="prizes-title" className="text-base">Premiação e ganhadores</h2></div>{draw.premiacoes?.length ? <div className="overflow-x-auto" tabIndex={0} aria-label="Tabela de premiação"><table className="min-w-[560px] w-full text-sm"><thead><tr className={tableHeaderClassName}><th scope="col" className="px-4 py-3">Faixa</th><th scope="col" className="px-4 py-3 text-right">Ganhadores</th><th scope="col" className="px-4 py-3 text-right">Valor por ganhador</th></tr></thead><tbody>{draw.premiacoes.map((prize) => <tr key={`${prize.faixa}-${prize.descricao}`} className="border-b border-[var(--line)] last:border-b-0 even:bg-[var(--surface-muted)]/70"><td className="px-4 py-3 font-semibold text-[var(--navy-950)]">{prize.descricao}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{prize.ganhadores.toLocaleString('pt-BR')}</td><td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[var(--blue-700)]">{formatCurrency(prize.valorPremio)}</td></tr>)}</tbody></table></div> : <p className="p-4 text-sm leading-6 text-[var(--muted-foreground)]">Os dados de premiação deste concurso ainda não estão disponíveis no histórico sincronizado.</p>}</section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><section className="surface-card p-4 sm:p-5" aria-labelledby="winner-locations-title"><div className="flex items-center gap-2"><MapPin size={18} className="text-[var(--blue-700)]" aria-hidden="true" /><h2 id="winner-locations-title" className="text-base">Locais dos ganhadores</h2></div>{draw.localGanhadores?.length ? <ul className="mt-4 space-y-2">{draw.localGanhadores.map((location, index) => <li key={index} className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{locationLabel(location)}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Não há localidades de ganhadores para este concurso.</p>}</section><section className="surface-card p-4 sm:p-5" aria-labelledby="next-draw-title"><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-[var(--blue-700)]" aria-hidden="true" /><h2 id="next-draw-title" className="text-base">Acumulação e próximo sorteio</h2></div><dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--muted-foreground)]">Estimativa próxima</dt><dd className="mt-1 font-semibold text-[var(--navy-950)]">{formatCurrency(draw.valorEstimadoProximoConcurso)}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Próximo concurso</dt><dd className="mt-1 font-semibold text-[var(--navy-950)]">{draw.proximoConcurso ? `${draw.proximoConcurso}${draw.dataProximoConcurso ? ` · ${draw.dataProximoConcurso}` : ''}` : 'Não informado'}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Arrecadação</dt><dd className="mt-1 font-semibold text-[var(--navy-950)]">{formatCurrency(draw.valorArrecadado)}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Acumulado próximo</dt><dd className="mt-1 font-semibold text-[var(--navy-950)]">{formatCurrency(draw.valorAcumuladoProximoConcurso)}</dd></div></dl></section></div>

              <section className="surface-card p-4 sm:p-5" aria-labelledby="analysis-title"><div><span className="eyebrow">Leitura do concurso</span><h2 id="analysis-title" className="text-base">Análise das dezenas</h2></div>{analysisLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="size-4 animate-spin text-[var(--blue-700)]" aria-hidden="true" />Calculando comparação histórica.</div> : analysisError || !analysis ? <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">A análise deste concurso não está disponível para os dados atuais.</p> : <><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Soma das dezenas</p><p className="mt-1 text-2xl font-bold text-[var(--navy-950)]">{analysis.sum}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Média: {formatAverage(analysis.historicalComparison.averageSum)}</p></div><div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Pares e ímpares</p><p className="mt-1 text-2xl font-bold text-[var(--navy-950)]">{analysis.evenCount}P · {analysis.oddCount}I</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Média de pares: {formatAverage(analysis.historicalComparison.averageEvenCount)}</p></div><div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Faixas 01–20 · 21–40 · 41–60</p><p className="mt-1 text-2xl font-bold text-[var(--navy-950)]">{analysis.rangeDistribution.first} · {analysis.rangeDistribution.second} · {analysis.rangeDistribution.third}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Média: {formatAverage(analysis.historicalComparison.averageRangeDistribution.first)} · {formatAverage(analysis.historicalComparison.averageRangeDistribution.second)} · {formatAverage(analysis.historicalComparison.averageRangeDistribution.third)}</p></div></div></>}</section>
            </>}
          </section>
        </div>
      )}
    </div>
  );
}
