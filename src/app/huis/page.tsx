import type { Metadata } from 'next';
import Link from 'next/link';
import { HouseExplorer } from '@/components/house-explorer';

export const metadata: Metadata = { title: 'Het huis, van dichtbij — LOTHUUS', description: 'Verken de buitenkant van LOTHUUS in 3D, met gemodelleerde architectuur, straat en begroeiing.' };

export default function HousePage() {
  return <main className="house-view-page"><h1 className="sr-only">Het huis van LOTHUUS in 3D</h1><header><Link className="house-view-wordmark" href="/" aria-label="LOTHUUS, naar de website"><b>LO</b>THUUS</Link><Link href="/#huis">Terug naar de website</Link></header><HouseExplorer /></main>;
}
