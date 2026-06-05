import { useState } from 'react';
import { NumberBall } from './NumberBall';

interface GameCardProps {
  numbers: string[];
  index?: number;
}

export function GameCard({ numbers, index }: GameCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(numbers.join(','));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-2">
      {index !== undefined && (
        <span className="text-xs text-gray-500 mr-1">#{index + 1}</span>
      )}
      {numbers.map((n) => (
        <NumberBall key={n} number={n} size="sm" />
      ))}
      <button
        onClick={handleCopy}
        className="ml-auto text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors"
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
