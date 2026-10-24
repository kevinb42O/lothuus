import { NextRequest, NextResponse } from 'next/server';
import { withStore } from '@/lib/backend/cloud';
import { readJson, sameOrigin, throttle } from '@/lib/backend/auth';
import { BusinessError, checkout, hash, publicReservation, reserve, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = await readJson(request);
    if (input.operation === 'status') {
      await throttle(request, 'reservation-status', 300);
      if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) throw new BusinessError('Deze reserveringslink is niet geldig.', 404);
      return NextResponse.json(await withStore(s => { const r = s.reservations.find(r => r.tokenHash === hash(input.token)); if (!r) throw new BusinessError('Reservering niet gevonden.', 404); return publicReservation(r); }), { headers: { 'Cache-Control': 'no-store' } });
    }
    await throttle(request, 'reserve', 30);
    return NextResponse.json(await withStore(s => 'items' in input ? checkout(s, input) : reserve(s, input)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
