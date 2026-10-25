import type { CollectionObject } from './collection';

/** Keep saved source objects connected to their published inventory record. */
export function reconcileSelection(ids: string[], objects: CollectionObject[]) {
  const aliases = new Map<string, string>();
  for (const object of objects) { aliases.set(object.id, object.id); if (object.sourceReference) aliases.set(object.sourceReference, object.id); }
  return [...new Set(ids.map(id => aliases.get(id) || id))];
}

export function removeOrderedSelection(saved: string[], ordered: string[], objects: CollectionObject[]) {
  const remove = new Set([...ordered, ...reconcileSelection(ordered, objects)]);
  return saved.filter(id => !remove.has(id));
}
