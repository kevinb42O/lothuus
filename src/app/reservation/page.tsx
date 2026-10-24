'use client';
import { useEffect, useRef, useState } from 'react';
import { ReservationConfirmation, type ReservationResult } from '@/components/reservation';
export default function ReservationPage() {
  const tokenRef = useRef<string | null>(null);
  const [result, setResult] = useState<ReservationResult | null>(null); const [error, setError] = useState('');
  useEffect(() => { const token = tokenRef.current ?? window.location.hash.slice(1); tokenRef.current = token; if (!token) { setError('Open de privélink die je na je reservering bewaard hebt.'); return; } window.history.replaceState(null, '', '/reservation'); fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'status', token }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setResult({ ...body, token }); }).catch(e => setError(e.message)); }, []);
  return <main className="reservation-page"><a className="wordmark" href="/"><b>LO</b><span>THUUS</span></a>{result ? <ReservationConfirmation result={result} /> : error ? <><h1>Je reservering</h1><p role="alert">{error}</p><a className="text-link" href="/">Terug naar de collectie</a></> : <p role="status">Reservering ophalen…</p>}</main>;
}
