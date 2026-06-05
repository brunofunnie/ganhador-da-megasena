import { NumberBall } from './NumberBall';

interface GameCardProps {
  numbers: string[];
  index?: number;
}

export function GameCard({ numbers, index }: GameCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-2">
      {index !== undefined && (
        <span className="text-xs text-gray-500 mr-1">#{index + 1}</span>
      )}
      {numbers.map((n) => (
        <NumberBall key={n} number={n} />
      ))}
    </div>
  );
}
