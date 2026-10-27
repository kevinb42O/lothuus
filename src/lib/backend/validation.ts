import { z } from 'zod';
export const categories = z.enum(['vazen', 'keramiek', 'glas', 'meubels', 'verlichting', 'objecten', 'hout-riet-bamboe', 'inox-ijzer', 'plastiek', 'textiel']);
const text = (max: number) => z.string().trim().max(max);
const contactShape = { name: text(120).min(2, 'Vul je naam in.'), email: z.string().trim().email('Vul een geldig e-mailadres in.').max(180).transform(v => v.toLowerCase()), phone: text(40), channel: z.enum(['email', 'phone', 'whatsapp']) };
export const contactSchema = z.object(contactShape).refine(c => c.channel === 'email' || c.phone.length >= 6, 'Vul een telefoonnummer in voor deze contactmethode.');
const photosSchema = z.array(z.object({ id: z.uuid(), alt: text(240).min(1) })).max(12);
export const itemSchema = z.object({ id: z.uuid().optional(), version: z.number().int().optional(), creationKey: z.uuid().optional(), materialGroup: z.enum(['K', 'P', 'G', 'T', 'H', 'I']).optional(), editorReady: z.boolean().optional(), priceUnset: z.boolean().optional(), title: text(180), category: categories, description: text(6000), priceCents: z.number().int().min(0).max(100000000), date: text(120), material: text(180), dimensions: text(180), maker: text(180), condition: text(1200), publication: z.enum(['draft', 'published', 'archived']), photos: photosSchema });
export const settingsSchema = z.object({ requestsEnabled: z.boolean().default(true), businessName: text(120).min(1), ownerEmail: z.union([z.literal(''), z.email().max(180)]), replyTo: z.union([z.literal(''), z.email().max(180)]), beneficiary: text(180), iban: text(40).transform(v => v.replace(/\s/g, '').toUpperCase()), deadlineDays: z.number().int().min(1).max(30), pickup: text(2000), terms: text(8000), privacy: text(8000), termsVersion: text(30).min(1), reservationsEnabled: z.boolean() });
export function validIban(iban: string) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expanded = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rem = 0; for (const digit of expanded) rem = (rem * 10 + Number(digit)) % 97;
  return rem === 1;
}
export const reservationSchema = z.object({ itemId: z.uuid(), expectedPrice: z.number().int(), expectedVersion: z.number().int(), contact: contactSchema, emailConfirmation: z.email(), message: text(3000), termsVersion: text(30), accepted: z.literal(true), website: z.literal(''), key: z.uuid() }).refine(v => v.contact.email === v.emailConfirmation.trim().toLowerCase(), 'De e-mailadressen komen niet overeen.');
export const checkoutSchema = z.object({
  items: z.array(z.object({ itemId: z.union([z.uuid(), z.string().regex(/^[KPGTHI]\d{3}$/)]), expectedPrice: z.number().int().positive().nullable(), expectedVersion: z.number().int().positive() })).min(1).max(50),
  contact: contactSchema, message: text(3000), termsVersion: text(30), accepted: z.literal(true), website: z.literal(''), key: z.uuid(),
}).refine(v => new Set(v.items.map(i => i.itemId)).size === v.items.length, 'Een object kan maar één keer in je bestelling staan.');
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare-payment'), id: z.uuid(), version: z.number().int(), prices: z.array(z.object({ itemId: z.string().max(80), priceCents: z.number().int().positive().max(100000000) })).min(1).max(50) }),
  z.object({ action: z.literal('resolve-notification'), id: z.string().max(100) }),
  z.object({ action: z.literal('read-notification'), id: z.string().max(100) }),
  z.object({ action: z.literal('save-item'), item: itemSchema }),
  z.object({ action: z.literal('save-item-photos'), id: z.uuid(), version: z.number().int(), photos: photosSchema }),
  z.object({ action: z.literal('change-material'), id: z.uuid(), version: z.number().int(), materialGroup: z.enum(['K', 'P', 'G', 'T', 'H', 'I']) }),
  z.object({ action: z.literal('save-settings'), settings: settingsSchema, version: z.number().int() }),
  z.object({ action: z.literal('save-customer'), customer: z.object({ id: z.uuid().optional(), ...contactShape, notes: text(6000) }) }),
  z.object({ action: z.literal('reservation'), id: z.uuid(), version: z.number().int(), operation: z.enum(['cancel', 'complete', 'pickup', 'extend', 'resend']), deadline: z.iso.datetime().optional() }),
  z.object({ action: z.literal('payment'), id: z.uuid(), version: z.number().int(), key: z.uuid(), type: z.enum(['receipt', 'refund']), amountCents: z.number().int().positive().max(100000000), date: z.iso.datetime(), note: text(1000) }),
  z.object({ action: z.literal('correct-contact'), id: z.uuid(), version: z.number().int(), contact: contactSchema }),
  z.object({ action: z.literal('merge-customers'), sourceId: z.uuid(), targetId: z.uuid() }),
  z.object({ action: z.literal('direct-sale'), itemId: z.uuid(), customerId: z.uuid(), key: z.uuid() }),
]);
