import { NumberBall } from './NumberBall';

interface FrequencyGridProps {
  data: Array<{ numero: string; frequencia: number }>;
  title: string;
  maxValue?: number;
}

export function FrequencyGrid({ data, title, maxValue }: FrequencyGridProps) {
  const max = maxValue || Math.max(...data.map(d => d.frequencia), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      <div className="grid grid-cols-10 gap-1">
        {data.map(({ numero, frequencia }) => {
          const intensity = frequencia / max;
          const bgColor =
            intensity > 0.8
              ? 'bg-green-900/60'
              : intensity > 0.5
              ? 'bg-green-900/30'
              : intensity > 0.2
              ? 'bg-gray-800'
              : 'bg-gray-900';

          return (
            <div
              key={numero}
              className={`${bgColor} rounded p-1 pb-2 flex flex-col items-center justify-center`}
              title={`${numero}: ${frequencia}x`}
            >
              <NumberBall number={numero} size="sm" variant={intensity > 0.5 ? 'default' : 'dim'} />
              <span className="text-[10px] text-gray-500 block mt-1">{frequencia}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
