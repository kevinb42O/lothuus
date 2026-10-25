'use client';
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { X } from 'lucide-react';
export function Dialog({ children, title, onClose, className = '', style, dismissible = true }: { children: ReactNode; title: string; onClose: () => void; className?: string; style?: CSSProperties; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closing || !dismissible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  }
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`dialog ${className} ${closing ? 'is-closing' : ''}`} style={style} aria-label={title}
    onAnimationEnd={event => { if (closing && event.target === event.currentTarget) onClose(); }}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose(); } }}>
    <button className="close-dialog" aria-label="Sluiten" disabled={!dismissible} onClick={requestClose}><X size={30} strokeWidth={1.8} /></button>
    {children}
  </dialog>;
}
