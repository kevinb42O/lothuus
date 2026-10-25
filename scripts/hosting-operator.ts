/** Run with server-only credentials, never from a customer-facing route. */
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
async function main(){
 const [operation,id,receipt,...flags]=process.argv.slice(2);
 if(!['list','activate'].includes(operation))throw new Error('Gebruik: npm run hosting:operator -- list | activate <order-uuid> <bankreferentie> [--provisioned]');
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw new Error('Servertoegang ontbreekt.');
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
 if(operation==='list'){const {data,error}=await db.rpc('lothuus_hosting_report');if(error)throw error;console.table(data.orders);return;}
 if(!z.uuid().safeParse(id).success||!receipt||receipt.length<3)throw new Error('Geef een geldige bestelling en echte bankreferentie op.');
 const {data,error}=await db.rpc('lothuus_hosting_activate',{order_id:id,operator_name:'Kevin Bourguignon',receipt_reference:receipt,provisioned:flags.includes('--provisioned')});
 if(error)throw error;console.log({plan:data.plan,objectlimiet:data.limit,extra:data.extra});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
