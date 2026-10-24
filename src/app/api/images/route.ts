import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, sameOrigin, throttle } from '@/lib/backend/auth';
import { savePhoto } from '@/lib/backend/media';
import { BusinessError, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export async function POST(request:NextRequest) {
  try {
    sameOrigin(request);await requireOwner(request);await throttle(request,'photo-upload',80);
    if(Number(request.headers.get('content-length'))>16000000) throw new BusinessError('Upload een foto kleiner dan 15 MB.',413);
    const form=await request.formData(),file=form.get('file');
    if(!(file instanceof File)) throw new BusinessError('Kies een foto.');
    return NextResponse.json(await savePhoto(file),{headers:{'Cache-Control':'no-store'}});
  } catch(e) {const error=e instanceof BusinessError?safeError(e):{message:'Deze foto kan niet worden verwerkt. Gebruik JPEG, PNG, WebP of AVIF.',status:400};return NextResponse.json({error:error.message},{status:error.status});}
}
