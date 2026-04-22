import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  durationMs?: number;
  onClose: () => void;
}

const toastTone: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export const Toast: React.FC<ToastProps> = ({ toast, durationMs = 5200, onClose }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onClose, toast.id]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[80] max-w-[min(92vw,420px)] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${toastTone[toast.type]}`}
    >
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 break-words">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 text-xs uppercase tracking-[0.16em] opacity-70 hover:opacity-100"
        >
          Dong
        </button>
      </div>
    </div>
  );
};

