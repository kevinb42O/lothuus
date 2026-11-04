import type { Metadata } from 'next';
import { Superadmin } from '@/components/superadmin/superadmin';
export const metadata: Metadata = { title: 'Superadmin — LOTHUUS', robots: { index: false, follow: false } };
export default function SuperadminPage() { return <Superadmin />; }
