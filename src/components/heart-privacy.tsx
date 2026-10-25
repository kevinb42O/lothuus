'use client';
import { useEffect, useState } from 'react';
import { consentKey, setHeartConsent } from '@/lib/hearts/client';
export function HeartPrivacy() {
  const [allowed, setAllowed] = useState(false), [enabled, setEnabled] = useState(false), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    try { setAllowed(localStorage.getItem(consentKey) === 'yes'); } catch {}
    const controller = new AbortController();
    fetch('/api/hearts', { signal: controller.signal }).then(r=>r.ok?r.json():null).then(v=>setEnabled(!!v?.enabled)).catch(()=>{});
    const sync = () => { try { setAllowed(localStorage.getItem(consentKey) === 'yes'); } catch {} }; window.addEventListener('storage',sync);
    return () => { controller.abort(); window.removeEventListener('storage',sync); };
  }, []);
  if (!enabled && !allowed) return null;
  return <details className="heart-privacy"><summary>Privacy van je hartjes</summary><p>Je selectie blijft in deze browser bewaard. Als je het goed vindt, telt LOTHUUS je hartjes ook mee om populaire objecten en trends te herkennen.</p><label><input type="checkbox" checked={allowed} disabled={busy} onChange={async e=>{ const next=e.target.checked; setBusy(true); setAllowed(next); try { await setHeartConsent(next); setMessage(next ? 'Je keuze is bewaard. Je hartjes mogen meetellen.' : 'Je keuze is bewaard. Je browserregistratie is verwijderd.'); } catch { setMessage('De meting staat voor jou uit. Het verwijderen van je browserregistratie wordt opnieuw geprobeerd zodra je verbinding herstelt.'); } finally { setBusy(false); } }} />Mijn hartjes mogen meetellen</label><p>We gebruiken een willekeurige browsercode, zonder naam of contactgegevens. Browserregistraties vervallen na 90 dagen zonder synchronisatie. Dagtotalen blijven maximaal 24 maanden bewaard. Je kunt je keuze hier intrekken; de bestaande dagtotalen blijven behouden. Je selectie werkt ook zonder meting.</p>{message && <p role="status">{message}</p>}</details>;
}
