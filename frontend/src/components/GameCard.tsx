import { useState } from 'react';
import { Check, Copy, FlaskConical } from 'lucide-react';
import { NumberBall } from './NumberBall';

interface GameCardProps {
  numbers: string[];
  index?: number;
  onSimulate?: (numbers: string[]) => void;
  ballSize?: 'sm' | 'md';
}

export function GameCard({ numbers, index, onSimulate, ballSize = 'md' }: GameCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(numbers.join(','));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        {index !== undefined ? (
          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
            Jogo {index + 1}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onSimulate && (
            <button
              type="button"
              onClick={() => onSimulate(numbers)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <FlaskConical size={14} aria-hidden="true" />
              Simular
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
      <div
        className="flex flex-wrap justify-center gap-1.5"
        aria-label={index === undefined ? 'Dezenas do jogo' : `Dezenas do jogo ${index + 1}`}
      >
        {numbers.map((n) => (
          <NumberBall key={n} number={n} size={ballSize} />
        ))}
      </div>
    </div>
  );
}
