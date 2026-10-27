'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { adminApi } from '@/lib/admin-client';
import type { UpdateTarget, WorkspaceUpdate } from '@/lib/updates/types';
import { readViewed, saveViewed } from '@/lib/updates/viewed';
import './updates.css';

export function useUpdates(authenticated: boolean | null) {
  const [updates, setUpdates] = useState<WorkspaceUpdate[]>([]);
  const [viewed, setViewed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(false);
    try {
      const data: { updates: WorkspaceUpdate[] } = await adminApi('/api/updates');
      if (request === generation.current) setUpdates(data.updates);
    } catch { if (request === generation.current) setError(true); }
    finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!authenticated) { setUpdates([]); setViewed([]); return; }
    setViewed(readViewed());
    void reload();
    return () => { ++generation.current; };
  }, [authenticated, reload]);
  const markViewed = useCallback((ids: string[]) => {
    const saved = saveViewed(ids);
    setViewed(current => [...new Set([...current, ...saved])]);
  }, []);
  return { updates, viewed, loading, error, reload, markViewed };
}
export type UpdatesState = ReturnType<typeof useUpdates>;
const dateLabel = (date: string) => new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' }).format(new Date(`${date}T12:00:00Z`));

export function LatestUpdate({ state, onOpen }: { state: UpdatesState; onOpen: () => void }) {
  const latest = state.updates[0];
  if (!latest || state.error) return null;
  return <section className="au-latest" aria-label="Nieuw voor jou">
    <div><h2>Nieuw voor jou</h2><p><time dateTime={latest.date}>{dateLabel(latest.date)}</time>{!state.viewed.includes(latest.id) && <span className="au-new">Nieuw</span>}</p><h3>{latest.title}</h3></div>
    <button className="a-link" onClick={onOpen}>Alle updates bekijken<ArrowRight size={16} aria-hidden="true" /></button>
  </section>;
}

export function Updates({ state, onNavigate }: { state: UpdatesState; onNavigate: (target: UpdateTarget) => void }) {
  // Keep the labels from arrival visible during this visit, even after saving.
  const arrival = useRef<string[] | null>(null);
  const { updates, loading, error, viewed, markViewed } = state;
  useEffect(() => {
    if (loading || error || !updates.length) return;
    if (arrival.current === null) arrival.current = updates.filter(update => !viewed.includes(update.id)).map(update => update.id);
    markViewed(updates.map(update => update.id));
  }, [loading, error, updates, markViewed]);
  // The first render precedes the effect; subsequent renders keep the snapshot.
  const fresh = arrival.current ?? updates.filter(update => !viewed.includes(update.id)).map(update => update.id);
  if (loading) return <p className="au-status" role="status">Updates laden…</p>;
  if (error) return <div className="au-status" role="alert"><p>De updates konden niet worden geladen.</p><button className="a-secondary" onClick={() => void state.reload()}>Opnieuw proberen</button></div>;
  if (!updates.length) return <p className="au-status">Zodra er iets nieuws is, lees je het hier.</p>;
  return <div className="au-list">{updates.map(update => <article className="au-entry" key={update.id} aria-labelledby={`update-${update.id}`}>
    <div className="au-meta"><time dateTime={update.date}>{dateLabel(update.date)}</time>{fresh.includes(update.id) && <span className="au-new">Nieuw</span>}</div>
    <div className="au-copy"><h2 id={`update-${update.id}`}>{update.title}</h2>{update.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{update.action && <button className="a-link" onClick={() => onNavigate(update.action!.target)}>{update.action.label}<ArrowRight size={16} aria-hidden="true" /></button>}</div>
  </article>)}</div>;
}
