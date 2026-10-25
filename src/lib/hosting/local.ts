import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory, transact } from '../backend/repository';
import { BusinessError } from '../backend/service';
import { PRODUCTS, type HostingOrder, type HostingReport, type HostingProduct } from './catalogue';
function localOrders<T>(fn:(orders:HostingOrder[])=>T):T {
 if(process.env.NODE_ENV==='production')throw new Error('Local hosting disabled');
 mkdirSync(dataDirectory(),{recursive:true,mode:0o700});const db=new DatabaseSync(join(dataDirectory(),'hosting.sqlite'));
 try{db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS hosting(id INTEGER PRIMARY KEY,body TEXT NOT NULL); BEGIN IMMEDIATE');const row=db.prepare('select body from hosting where id=1').get() as {body:string}|undefined;const orders:HostingOrder[]=row?JSON.parse(row.body):[];const result=fn(orders);db.prepare('insert into hosting(id,body) values(1,?) on conflict(id) do update set body=excluded.body').run(JSON.stringify(orders));db.exec('COMMIT');return result;}catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
export function localReport():HostingReport {
 const count=transact(s=>s.items.length),now=new Date().toISOString();const images=join(dataDirectory(),'images');const bytes=existsSync(images)?readdirSync(images).reduce((n,k)=>n+statSync(join(images,k)).size,0):0;
 return {plan:'basis',extra:0,count,limit:200,validUntil:null,orders:localOrders(s=>s.slice(0,30)),updatedAt:now,local:true,metrics:{media:{value:bytes,measuredAt:now,status:'ready'},database:{value:null,measuredAt:null,status:'unavailable'},direct:{value:null,measuredAt:null,status:'unavailable'},cached:{value:null,measuredAt:null,status:'not_applicable'}}};
}
export function localCommand(input:{action:'order';key:string;product:HostingProduct}|{action:'status';id:string;status:'payment_review'|'cancelled'}) {
 localOrders(orders=>{if(input.action==='order'){const old=orders.find(o=>o.id===input.key);if(old){if(old.product!==input.product)throw new BusinessError('Deze bestelcode is al gebruikt.',409);return;}if(orders.some(o=>o.product===input.product&&['pending_payment','payment_review'].includes(o.status)))return;if(orders.filter(o=>['pending_payment','payment_review'].includes(o.status)).length>=10)throw new BusinessError('Werk eerst je openstaande bestellingen af.');orders.unshift({id:input.key,product:input.product,cents:PRODUCTS[input.product].cents,status:'pending_payment',createdAt:new Date().toISOString(),activatedAt:null});}else{const o=orders.find(o=>o.id===input.id);if(o?.status==='pending_payment')o.status=input.status;}});
 return localReport();
}
