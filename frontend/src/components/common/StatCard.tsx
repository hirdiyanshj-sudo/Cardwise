import React from 'react';
import { Card } from '../ui';
import { cn } from '../../lib/utils';

export function StatCard({
  label,
  value,
  subtext,
  icon,
  accent = 'sky',
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';
}) {
  const accents: Record<string, string> = {
    sky: 'bg-sky-500/15 text-sky-500 dark:text-sky-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  };

  return (
    <Card className="p-4 sm:p-5 hover:border-sky-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {value}
          </p>
          {subtext && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">{subtext}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5 shrink-0', accents[accent])}>{icon}</div>
      </div>
    </Card>
  );
}
