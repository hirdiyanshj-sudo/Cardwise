import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { X, AlertTriangle } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500',
        secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
        outline:
          'border border-slate-200 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70',
        danger: 'bg-rose-600 text-white hover:bg-rose-500',
        ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass-card p-5', className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#091224] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#091224] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20',
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25',
    danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25',
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Progress({
  value,
  indicatorClassName,
  className,
}: {
  value: number;
  indicatorClassName?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', indicatorClassName || 'bg-sky-500')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className={cn(
          'w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0D172B] p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto',
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p>{message}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-rose-500/30 bg-rose-500/5 p-6 text-center space-y-3">
      <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unable to load data</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Card>
  );
}
