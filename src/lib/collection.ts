import records from './collection.json';
export type Category = 'vazen' | 'keramiek' | 'glas' | 'meubels' | 'verlichting' | 'objecten' | 'hout-riet-bamboe' | 'inox-ijzer' | 'plastiek' | 'textiel';
export type CollectionObject = {
  id: string; sourceReference?: string; title: string; category: Category; date: string; material: string;
  dimensions: string; maker: string; image: string; source: string; credit: string;
  imageSource: string; license: string; description: string;
  priceCents?: number; availability?: "available" | "reserved" | "sold"; condition?: string; version?: number; photos?: { id: string; alt: string; src?: string }[];
};
export const objects = records as CollectionObject[];
export const categories: { id: Category | 'alles'; label: string }[] = [
  { id: 'alles', label: 'Alles' }, { id: 'keramiek', label: 'Keramiek' },
  { id: 'glas', label: 'Glas' }, { id: 'hout-riet-bamboe', label: 'Hout / riet / bamboe' },
  { id: 'inox-ijzer', label: 'Inox / ijzer' }, { id: 'plastiek', label: 'Plastiek' }, { id: 'textiel', label: 'Textiel' }, { id: 'vazen', label: 'Vazen' },
  { id: 'meubels', label: 'Meubels' }, { id: 'verlichting', label: 'Verlichting' },
  { id: 'objecten', label: 'Objecten' },
];
export const categoryLabel = (category: Category) => categories.find(c => c.id === category)!.label;
export function photoVariant(src: string, size: 'thumb' | 'grid' | 'detail') {
  return /^\/api\/(?:collection-images|images)\//.test(src)
    ? src.replace(/([?&])size=(?:thumb|grid|detail)(?=&|$)/, `$1size=${size}`)
    : src;
}
