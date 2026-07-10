import { NumberBall } from './NumberBall';

interface FrequencyGridProps {
  data: Array<{ numero: string; frequencia: number }>;
  title: string;
  maxValue?: number;
}

export function FrequencyGrid({ data, title, maxValue }: FrequencyGridProps) {
  const max = maxValue ?? Math.max(...data.map((item) => item.frequencia), 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-blue-700">Mapa de frequência</p>
          <h3 className="mt-1 text-base font-bold text-blue-950">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold text-slate-500" aria-label="Legenda de intensidade">
          <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-slate-200" />Menor</span>
          <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-blue-300" />Média</span>
          <span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-blue-700" />Maior</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {data.map(({ numero, frequencia }) => {
          const intensity = frequencia / max;
          const cellColor =
            intensity > 0.8
              ? 'border-blue-200 bg-blue-100'
              : intensity > 0.5
              ? 'border-blue-100 bg-blue-50'
              : intensity > 0.2
              ? 'border-slate-200 bg-slate-50'
              : 'border-slate-100 bg-white';

          return (
            <div
              key={numero}
              className={`${cellColor} flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 py-2`}
              title={`${numero}: ${frequencia}x`}
            >
              <NumberBall number={numero} size="sm" variant={intensity > 0.5 ? 'default' : 'dim'} />
              <span className="mt-1 block text-[0.68rem] font-semibold text-slate-500">{frequencia}x</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
