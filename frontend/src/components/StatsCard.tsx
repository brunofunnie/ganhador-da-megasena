import { BarChart3 } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatsCard({ title, value, subtitle }: StatsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{title}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700" aria-hidden="true"><BarChart3 size={18} /></span>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight text-blue-950">{value}</p>
      {subtitle && <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p>}
    </div>
  );
}
