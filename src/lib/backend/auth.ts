import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { cloudMode, serverDatabase } from './cloud';
import { BusinessError, hash } from './service';
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`;
  if (!origin || origin !== expected) throw new BusinessError('Deze aanvraag komt niet van de website.', 403);
}
export async function readJson(request: NextRequest) {
  const maximum=128000;
  if(Number(request.headers.get('content-length'))>maximum) throw new BusinessError('De aanvraag is te groot.',413);
  const reader=request.body?.getReader();if(!reader)throw new BusinessError('De aanvraag bevat geen geldige gegevens.');
  const decoder=new TextDecoder();let raw='',size=0;
  try {while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>maximum){await reader.cancel();throw new BusinessError('De aanvraag is te groot.',413);}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}
  finally {reader.releaseLock();}
  try {const value=JSON.parse(raw);if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();return value;}catch{throw new BusinessError('De aanvraag bevat geen geldige gegevens.');}
}
export const sessionCookie = 'lothuus-owner';
const local = () => import('./local-auth');
export const configured = async () => cloudMode() ? Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.ADMIN_USER_ID && process.env.ADMIN_EMAIL) : process.env.NODE_ENV !== 'production' && (await local()).configured();
export async function authClient() {
  const jar = await cookies();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new BusinessError('Inloggen is nog niet geconfigureerd.', 503);
  return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600 },
    cookies: { getAll: () => jar.getAll(), setAll: values => { values.forEach(({name,value,options}) => jar.set(name,value,options)); } },
  });
}
export async function isOwner(request: NextRequest) {
  if (!cloudMode()) return process.env.NODE_ENV !== 'production' && (await local()).isOwner(request);
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  return !error && !!data.user && data.user.id === process.env.ADMIN_USER_ID && data.user.app_metadata.role === 'owner';
}
export async function requireOwner(request: NextRequest) { if (!await isOwner(request)) throw new BusinessError('Log opnieuw in om verder te gaan.',401); }
export async function authenticate(password: string, email: string) {
  if (!cloudMode()) {
    if (process.env.NODE_ENV === 'production') throw new BusinessError('Online toegang ontbreekt.',503);
    return (await local()).authenticate(password);
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.',401);
  const client = await authClient();
  const {data,error} = await client.auth.signInWithPassword({email: normalizedEmail,password});
  if (error || data.user?.id !== process.env.ADMIN_USER_ID || data.user?.app_metadata.role !== 'owner') {
    await client.auth.signOut({scope:'local'}); throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.',401);
  }
  return null;
}
export async function throttle(request: NextRequest, prefix: string, max: number) {
  if (!cloudMode()) return (await local()).throttle(request,prefix,max);
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
  const {data,error} = await serverDatabase().rpc('lothuus_rate_limit',{bucket_key:`${prefix}:${hash(ip)}`,maximum:max,window_seconds:900});
  if (error) throw new BusinessError('De beveiligingscontrole is tijdelijk niet bereikbaar.',503);
  if (!data) throw new BusinessError('Te veel pogingen. Probeer het later opnieuw.',429);
}
