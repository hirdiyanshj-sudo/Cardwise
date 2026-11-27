import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (title: string, variant?: ToastVariant, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((title: string, variant: ToastVariant = 'info', description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev, { id, title, variant, description }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const icons: Record<ToastVariant, React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    error: <XCircle className="h-4 w-4 text-rose-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    info: <Info className="h-4 w-4 text-sky-400" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-[#0F1B33]/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3"
          >
            <div className="mt-0.5 shrink-0">{icons[item.variant]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
