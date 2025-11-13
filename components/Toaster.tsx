import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastVariant = 'info' | 'success' | 'error';
export type Toast = {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

type ToastContextType = {
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, variant: 'info', duration: 3500, ...t };
    setToasts(prev => [...prev, toast]);
    if (toast.duration && toast.duration > 0) {
      const handle = window.setTimeout(() => dismiss(id), toast.duration);
      timers.current.set(id, handle);
    }
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Viewport */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={
              `pointer-events-auto min-w-[260px] max-w-sm rounded-lg shadow-lg border p-3 animate-[toastFade_220ms_ease-out] ` +
              (t.variant === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200'
                : t.variant === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100')
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {t.title && <div className="text-sm font-semibold">{t.title}</div>}
                <div className="text-sm opacity-90">{t.message}</div>
              </div>
              <button
                className="ml-2 text-xs px-2 py-1 rounded bg-slate-200/70 dark:bg-slate-700/70 hover:bg-slate-300 dark:hover:bg-slate-600"
                onClick={() => dismiss(t.id)}
              >Close</button>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </ToastContext.Provider>
  );
};
