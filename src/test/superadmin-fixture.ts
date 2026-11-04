import type { OperatorReport } from '../lib/superadmin/types';
export const operatorFixture: OperatorReport = {
 policy: { count: 304, limit: 200, enforced: true },
 settings: { enforce_limit: true, object_limit: null, expires_at: null, version: 1, updated_at: '2026-11-04T13:00:00Z' },
 activity: [{ id: '12', at: '2026-11-04T13:00:00Z', actor: 'Eigenaar', kind: 'product_updated', object_id: 'fixture-product', title: 'Vintage vaas', details: { fields: ['title', 'priceCents'], number: 'K12' } }],
 hosting: null, technicalError: 'Technische metingen zijn tijdelijk niet beschikbaar.',
};
