import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext, ToastItem, ToastType } from '@/hooks/useToast';

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-500/10 text-green-600 border-green-500/30',
  error: 'bg-red-500/10 text-red-600 border-red-500/30',
  info: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 2500) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastItem = { id, message, type, duration };
    setToasts((prev) => [...prev, toast]);
    timers.current[id] = window.setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur bg-white/90 dark:bg-[#1E1F20]/90 ${typeStyles[toast.type]}`}
          >
            <div className="text-sm font-medium">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
