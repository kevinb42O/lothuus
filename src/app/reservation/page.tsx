'use client';
import { useEffect, useState } from 'react';
import { ReservationConfirmation, type ReservationResult } from '@/components/reservation';
export default function ReservationPage() {
  const [result, setResult] = useState<ReservationResult | null>(null); const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort(); controller = new AbortController(); const request = controller;
      const token = window.location.hash.slice(1);
      setResult(null); setError('');
      if (!/^[a-f0-9]{64}$/.test(token)) { setError('Open de privélink die je na je reservering bewaard hebt.'); return; }
      // The fragment is never sent to the server. Keeping it preserves reloads and bookmarks.
      try {
        const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'status', token }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error);
        if (!request.signal.aborted) setResult({ ...body, token });
      } catch (e) { if (!request.signal.aborted) setError((e as Error).message || 'De reservering kon niet worden opgehaald. Probeer opnieuw.'); }
    };
    const changed = () => { void load(); };
    void load(); window.addEventListener('hashchange', changed);
    return () => { controller?.abort(); window.removeEventListener('hashchange', changed); };
  }, [retry]);
  return <main className="reservation-page"><a className="wordmark" href="/"><b>LO</b><span>THUUS</span></a>{result ? <ReservationConfirmation result={result} /> : error ? <><h1>Je reservering</h1><p role="alert">{error}</p><button type="button" className="text-link" onClick={() => setRetry(value => value + 1)}>Opnieuw proberen</button><a className="text-link" href="/">Terug naar de collectie</a></> : <p role="status">Reservering ophalen…</p>}</main>;
}
