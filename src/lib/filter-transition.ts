import type { GridCell } from './grid-layout';

export type TileBounds = { top: number; bottom: number; left: number; right: number };

/** A complete change of subject deserves one directional reveal, not individual tile exits. */
export function categoryDirection(from: string, to: string, order: string[]): -1 | 0 | 1 {
  if (from === 'alles' || to === 'alles' || from === to) return 0;
  return order.indexOf(to) > order.indexOf(from) ? 1 : -1;
}

export function collectionColumns(width: number, focused: boolean) {
  return focused
    ? width > 1150 ? 6 : width > 800 ? 4 : width > 500 ? 3 : 2
    : width > 1150 ? 8 : width > 800 ? 6 : width > 500 ? 4 : 3;
}

/** Only shared, visible photographs travel. Offscreen objects never fly through the viewport. */
export function filterTransition(cells: GridCell[], previous: Map<string, TileBounds & { key: string }>, gridTop: number, viewportHeight: number, revision: number) {
  const keys: Record<string, string> = {};
  const arriving = new Set<string>();
  for (const cell of cells) {
    const old = previous.get(cell.id);
    const visible = gridTop + cell.y < viewportHeight && gridTop + cell.y + cell.height > 0;
    const shared = old && old.bottom > 0 && old.top < viewportHeight && visible;
    keys[cell.id] = shared ? old.key : `${cell.id}:${revision}`;
    if (visible && !shared) arriving.add(cell.id);
  }
  return { keys, arriving };
}
