import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { NumberBall } from './NumberBall';

interface GameCardProps {
  numbers: string[];
  index?: number;
  action?: ReactNode;
}

export function GameCard({ numbers, index, action }: GameCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(numbers.join(','));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {index !== undefined && (
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">Jogo {index + 1}</span>
      )}
      <div className="flex flex-wrap gap-1.5" aria-label={index === undefined ? 'Dezenas do jogo' : `Dezenas do jogo ${index + 1}`}>
        {numbers.map((n) => <NumberBall key={n} number={n} size="sm" />)}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {action}
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
      </div>
    </div>
  );
}
