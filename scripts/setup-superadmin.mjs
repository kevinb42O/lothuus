/** Local operator provisioning. Requires server credentials, never shipped as an HTTP action. */
import { createClient } from '@supabase/supabase-js';
const email = 'kevin@webaanzee.be';
async function main() {
 if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Servertoegang ontbreekt.');
 const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
 let user;
 for (let page = 1; page <= 10; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (result.error) throw new Error('Accountcontrole mislukt.');
  user = result.data.users.find(u => u.email?.toLowerCase() === email);
  if (user || result.data.users.length < 100) break;
 }
 if (!user) {
  if (!process.env.SUPERADMIN_PASSWORD) throw new Error('Geef SUPERADMIN_PASSWORD uitsluitend via de lokale procesomgeving voor een nieuw account.');
  const created = await db.auth.admin.createUser({ email, password: process.env.SUPERADMIN_PASSWORD, email_confirm: true, app_metadata: { role: 'superadmin' } });
  if (created.error || !created.data.user) throw new Error('Account aanmaken mislukt.');
  user = created.data.user;
 }
 if (user.app_metadata?.role !== 'superadmin') throw new Error('Het bestaande account heeft een andere rol. Geen rechten of wachtwoord gewijzigd.');
 const result = await db.rpc('lothuus_operator_bootstrap', { actor: user.id });
 if (result.error) throw new Error('Operatorregistratie mislukt. Controleer de migratie en bestaande registratie.');
 console.log({ configured: true, email, login: 'email-password' });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
