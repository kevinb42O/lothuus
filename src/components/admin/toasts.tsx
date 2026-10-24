'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import './toasts.css';

type ToastInput = { id?: string; message: string; tone?: 'loading' | 'success' | 'error' | 'info'; action?: { label: string; run: () => void }; duration?: number };
type Toast = ToastInput & { id: string; revision: number };
type ToastContextValue = { notify: (input: ToastInput) => string; dismiss: (id: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  const notify = useCallback((input: ToastInput) => {
    const id = input.id || crypto.randomUUID();
    setToasts(current => {
      const previous = current.find(toast => toast.id === id);
      const next = { ...input, tone: input.tone || 'info', id, revision: (previous?.revision || 0) + 1 };
      return [...current.filter(toast => toast.id !== id), next].slice(-4);
    });
    return id;
  }, []);
  return <ToastContext.Provider value={{ notify, dismiss }}>{children}<section className="admin-toasts" aria-label="Meldingen over acties">{toasts.map(toast => <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />)}</section></ToastContext.Provider>;
}

function ToastMessage({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const duration = toast.duration ?? (toast.tone === 'loading' || toast.tone === 'error' ? 0 : 6500);
  useEffect(() => {
    if (!duration || paused) return;
    const timer = setTimeout(() => dismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.revision, duration, paused, dismiss]);
  const Icon = toast.tone === 'loading' ? LoaderCircle : toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
  return <div className={`admin-toast is-${toast.tone}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <Icon className={toast.tone === 'loading' ? 'toast-spinner' : ''} size={20} aria-hidden="true" />
    <div className="admin-toast-body"><p role={toast.tone === 'error' ? 'alert' : 'status'} aria-atomic="true">{toast.message}</p>{toast.action && <button type="button" onClick={() => { dismiss(toast.id); toast.action!.run(); }}>{toast.action.label}</button>}</div>
    <button type="button" className="admin-toast-close" aria-label="Melding sluiten" onClick={() => dismiss(toast.id)}><X size={17} aria-hidden="true" /></button>
  </div>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('ToastProvider ontbreekt in de werkruimte.');
  return value;
}
