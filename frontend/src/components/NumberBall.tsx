interface NumberBallProps {
  number: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'dim';
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
};

const variantClasses = {
  default: 'border-blue-800 bg-blue-700 text-white shadow-sm shadow-blue-900/25',
  accent: 'border-yellow-300 bg-yellow-400 text-blue-950 shadow-sm shadow-yellow-700/25',
  dim: 'border-slate-200 bg-slate-100 text-slate-500',
};

export function NumberBall({ number, size = 'md', variant = 'default' }: NumberBallProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${variantClasses[variant]} inline-flex shrink-0 items-center justify-center rounded-full border font-extrabold tabular-nums`}
    >
      {number}
    </div>
  );
}
