interface NumberBallProps {
  number: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'dim';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg font-bold',
};

const variantClasses = {
  default: 'bg-green-700 text-white shadow-md shadow-green-900/50',
  accent: 'bg-yellow-600 text-white shadow-md shadow-yellow-900/50',
  dim: 'bg-gray-700 text-gray-300',
};

export function NumberBall({ number, size = 'md', variant = 'default' }: NumberBallProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full flex items-center justify-center`}
    >
      {number}
    </div>
  );
}
