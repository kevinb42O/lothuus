'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sessionForActivity, type VisitSession } from '@/lib/analytics/session';
let session: VisitSession | undefined;
let inFlight: Promise<void> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let lastInput = 0;

export function VisitorTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Production only. A separate development server can explicitly enable this for isolated QA.
    if (!['/', '/huis'].includes(pathname) || process.env.NEXT_PUBLIC_VISITOR_TRACKING === 'false' || process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_VISITOR_TRACKING !== 'true') return;
    let mounted = true;
    const send = async () => {
      const current = session;
      if (!mounted || document.hidden || !current || current.sent || current.attempts >= 3 || Date.now() - current.created > 5 * 60000) return;
      if (inFlight) { await inFlight; if (mounted && session === current) void send(); return; }
      current.attempts++;
      inFlight = (async () => {
        try {
          const response = await fetch('/api/analytics/visit', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: current.id, route: pathname }), signal: AbortSignal.timeout(8000) });
          if (response.ok || response.status < 500 && response.status !== 429) current.sent = true;
        } catch { /* Analytics never interrupts the public website. */ }
      })();
      await inFlight; inFlight = undefined;
      if (mounted && session === current && !current.sent && current.attempts < 3) { clearTimeout(retry); retry = setTimeout(() => void send(), current.attempts * 2000); }
    };
    const activity = (event?: Event) => {
      if (!mounted || document.hidden || event && !event.isTrusted) return;
      const now = Date.now(); if (event && now - lastInput < 1000) return; lastInput = now;
      session = sessionForActivity(session, now, () => crypto.randomUUID()); void send();
    };
    const visible = () => { if (!document.hidden) activity(); };
    const online = () => void send();
    activity();
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach(name => window.addEventListener(name, activity, { passive: true }));
    document.addEventListener('visibilitychange', visible); window.addEventListener('pageshow', visible); window.addEventListener('online', online);
    return () => { mounted = false; events.forEach(name => window.removeEventListener(name, activity)); document.removeEventListener('visibilitychange', visible); window.removeEventListener('pageshow', visible); window.removeEventListener('online', online); clearTimeout(retry); };
  }, [pathname]);
  return null;
}
