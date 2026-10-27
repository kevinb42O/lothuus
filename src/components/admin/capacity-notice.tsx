'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { objectUsage } from '@/lib/hosting/catalogue';

export function CapacityNotice({ count, onCapacity, onOverLimitChange }: { count: number; onCapacity: () => void; onOverLimitChange?: (over: boolean) => void }) {
  const [limit, setLimit] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/hosting', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => {
        if (!response.ok) return;
        const report = await response.json();
        if (!controller.signal.aborted && Number.isSafeInteger(report.limit) && report.limit > 0) setLimit(report.limit);
      }).catch(() => { /* A failed capacity lookup must never block product editing. */ });
    return () => controller.abort();
  }, [count]);
  useEffect(() => {
    onOverLimitChange?.(limit !== null && count > limit);
  }, [count, limit, onOverLimitChange]);
  if (limit === null || count <= limit) return null;
  const usage = objectUsage(count, limit);
  return <section className="a-capacity-notice" role="status" aria-label="Objectlimiet overschreden">
    <AlertCircle size={22} aria-hidden="true" />
    <div><strong>Je collectie is groter dan je huidige pakket</strong><p>{count} van {limit} objecten · {usage.over} boven je pakketlimiet. Breid je capaciteit uit of kies een groter pakket dat bij je collectie past.</p></div>
    <button type="button" className="a-link" onClick={onCapacity}>Capaciteit uitbreiden<ArrowUpRight size={16} aria-hidden="true" /></button>
  </section>;
}
