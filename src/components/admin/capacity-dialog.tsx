'use client';
import { ArrowUpRight } from 'lucide-react';
import { Dialog } from '../dialog';

export function CapacityDialog({ count, limit, onClose, onPlans }: { count: number; limit: number; onClose: () => void; onPlans: () => void }) {
  return <Dialog title="Je pakketlimiet is bereikt" className="a-capacity-dialog" onClose={onClose}>
    <h2>Je pakketlimiet is bereikt</h2>
    <p>Je collectie bevat {count} objecten. Je huidige pakket biedt ruimte voor {limit} objecten.</p>
    <p>Upgrade je pakket om nieuwe producten toe te voegen. Je bestaande collectie blijft beschikbaar en bewerkbaar.</p>
    <div className="a-capacity-dialog-actions"><button type="button" className="a-button" onClick={onPlans}>Bekijk de pakketten<ArrowUpRight size={16} aria-hidden="true" /></button><button type="button" className="a-secondary" onClick={onClose}>Sluiten</button></div>
  </Dialog>;
}
