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
  async function choose(next: boolean) {
    setBusy(true); setMessage('');
    try {
      await setHeartConsent(next); setAllowed(next);
      setMessage(next ? 'Je keuze is bewaard. Je hartjes mogen meetellen.' : 'Je keuze is bewaard. Je browserregistratie is verwijderd.');
    } catch {
      let saved: string | null = null;
      try { saved = localStorage.getItem(consentKey); } catch {}
      setAllowed(saved === 'yes');
      setMessage(saved === 'no' ? 'De meting staat voor jou uit. Het verwijderen van je browserregistratie wordt opnieuw geprobeerd zodra je verbinding herstelt.' : 'Je keuze kon niet worden bewaard. Probeer opnieuw; je selectie blijft bruikbaar.');
    } finally { setBusy(false); }
  }
  if (!enabled && !allowed) return null;
  return <section className="heart-privacy" aria-label="Privacy van je hartjes">
    <label><input type="checkbox" checked={allowed} disabled={busy} onChange={e=>void choose(e.target.checked)} aria-describedby="heart-privacy-help" />Mijn hartjes mogen meetellen</label>
    <p id="heart-privacy-help">Help LOTHUUS populaire objecten herkennen. Je selectie werkt ook zonder meting.</p>
    <details><summary>Privacy van je hartjes</summary><p>Je selectie blijft in deze browser bewaard. Alleen als je het goed vindt, telt LOTHUUS je hartjes ook mee. We gebruiken een willekeurige browsercode, zonder naam of contactgegevens.</p><p>Browserregistraties vervallen na 90 dagen zonder synchronisatie. Dagtotalen blijven maximaal 24 maanden bewaard. Je kunt je keuze hierboven intrekken; je browserregistratie wordt dan verwijderd. De bestaande dagtotalen blijven behouden.</p></details>
    {message && <p role="status">{message}</p>}
  </section>;
}
