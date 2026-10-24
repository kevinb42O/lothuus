import { NextRequest, NextResponse } from 'next/server';
import { authClient, readJson, requireOwner, sameOrigin, throttle } from '@/lib/backend/auth';
import { cloudMode } from '@/lib/backend/cloud';
import { BusinessError, safeError } from '@/lib/backend/service';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); await requireOwner(request); await throttle(request,'password',8);
    if (!cloudMode()) throw new BusinessError('Wachtwoord wijzigen wordt beschikbaar met de online account.',503);
    const {currentPassword,password,confirmation} = await readJson(request);
    if (typeof currentPassword !== 'string' || currentPassword.length > 200 || typeof password !== 'string' || password.length < 12 || password.length > 200 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) throw new BusinessError('Gebruik minstens 12 tekens met een hoofdletter, kleine letter, cijfer en symbool.');
    if (password !== confirmation) throw new BusinessError('De nieuwe wachtwoorden komen niet overeen.');
    if (password === currentPassword) throw new BusinessError('Kies een ander wachtwoord dan je huidige.');
    const client = await authClient();
    const verified = await client.auth.signInWithPassword({email:process.env.ADMIN_EMAIL!,password:currentPassword});
    if (verified.error || verified.data.user?.id !== process.env.ADMIN_USER_ID) throw new BusinessError('Je huidige wachtwoord klopt niet.',401);
    const changed = await client.auth.updateUser({password,current_password:currentPassword});
    if (changed.error) throw new BusinessError('Het wachtwoord kon niet worden gewijzigd. Probeer later opnieuw.',400);
    await client.auth.signOut({scope:'others'});
    return NextResponse.json({changed:true},{headers:{'Cache-Control':'no-store'}});
  } catch(e) { const error=safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}}); }
}
