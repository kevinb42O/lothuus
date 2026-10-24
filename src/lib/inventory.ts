import type { Item } from './backend/types';

export const materialGroups = [
  { code: 'K', label: 'Keramiek', hint: 'Aardewerk, porselein & steengoed', category: 'keramiek' },
  { code: 'P', label: 'Plastiek', hint: 'Kunststof & bakeliet', category: 'objecten' },
  { code: 'G', label: 'Glas', hint: 'Glas & kristal', category: 'glas' },
  { code: 'T', label: 'Textiel', hint: 'Stoffen, kleden & wandtextiel', category: 'objecten' },
  { code: 'H', label: 'Hout / riet', hint: 'Ook bamboe & rotan', category: 'hout-riet-bamboe' },
  { code: 'I', label: 'Inox / ijzer', hint: 'Metalen objecten', category: 'objecten' },
] as const;
export type MaterialGroup = typeof materialGroups[number]['code'];
export const materialName = (code?: string) => materialGroups.find(m => m.code === code)?.label || 'Nog te kiezen';
export const itemTitle = (item: Pick<Item, 'title'>) => item.title.trim() || 'Nog zonder titel';
export function missingFields(item: Pick<Item, 'title' | 'description' | 'date' | 'dimensions' | 'condition' | 'priceCents' | 'photos' | 'materialGroup' | 'priceUnset'>) {
  return [
    !item.materialGroup && { field: 'materialGroup', label: 'Kies een materiaal' },
    item.title.trim().length < 2 && { field: 'title', label: 'Geef je product een titel' },
    !item.description.trim() && { field: 'description', label: 'Voeg een beschrijving toe' },
    !item.date.trim() && { field: 'date', label: 'Vul stijl of periode in' },
    !item.dimensions.trim() && { field: 'dimensions', label: 'Vul de afmetingen in' },
    !item.condition.trim() && { field: 'condition', label: 'Beschrijf de staat' },
    (item.priceUnset || item.priceCents <= 0) && { field: 'price', label: 'Vul de vaste prijs in' },
    (item.photos.length < 2 || item.photos.length > 8) && { field: 'photos', label: item.photos.length > 8 ? 'Kies maximaal 8 foto’s' : 'Voeg minstens 2 foto’s toe' },
  ].filter((v): v is { field: string; label: string } => Boolean(v));
}
export function inputCents(value: string): number | null {
  const cleaned = value.replace(/€|EUR/gi, '').replace(/\s/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const result = Math.round(Number(normalized) * 100);
  return result <= 100000000 ? result : NaN;
}
export const textTargets = [
  { key: 'title', label: 'Titel', max: 180 }, { key: 'description', label: 'Beschrijving', max: 6000 },
  { key: 'date', label: 'Stijl / Periode', max: 120 }, { key: 'dimensions', label: 'Afmetingen', max: 180 },
  { key: 'condition', label: 'Staat', max: 1200 }, { key: 'price', label: 'Prijs', max: 40 },
] as const;
export type TextTarget = typeof textTargets[number]['key'];
export function divideText(source: string): { fields: Partial<Record<TextTarget, string>>; remainder: string } {
  const fields: Partial<Record<TextTarget, string>> = {};
  const remainder: string[] = [];
  const aliases: Record<string, TextTarget> = { titel: 'title', naam: 'title', beschrijving: 'description', omschrijving: 'description', stijl: 'date', periode: 'date', 'stijl / periode': 'date', 'stijl/periode': 'date', datering: 'date', afmetingen: 'dimensions', maten: 'dimensions', staat: 'condition', conditie: 'condition', prijs: 'price', 'vaste lothuus-prijs': 'price', 'vaste prijs': 'price' };
  let current: TextTarget | undefined;
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*([^:]{1,35}):\s*(.*)$/);
    const key = match && aliases[match[1].trim().toLowerCase()];
    if (key) { current = key; fields[key] = [fields[key], match![2]].filter(Boolean).join('\n'); }
    else if (current) fields[current] = `${fields[current] || ''}\n${line}`.trim();
    else remainder.push(line);
  }
  return { fields, remainder: remainder.join('\n').trim() };
}
