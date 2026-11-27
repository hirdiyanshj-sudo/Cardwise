import React from 'react';
import { Card } from '../ui';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-4 text-slate-400 mb-4">{icon}</div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
