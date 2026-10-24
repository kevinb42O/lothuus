export type ActiveCell = { id: string; column: number; row: number; aspectRatio: number; maxPhotoHeight?: number };
export type GridCell = { id: string; column: number; row: number; span: number; x: number; y: number; width: number; height: number; expanded: boolean };
export const captionHeight = 84;

/** Pack into column intervals, including directly below a non-square photograph. */
export function collectionLayout(ids: string[], columns: number, active: ActiveCell | null, cell = 140, gap = 10) {
  const pitch = cell + gap;
  const valid = active && ids.includes(active.id) ? active : null;
  const intervals: { start: number; end: number }[][] = Array.from({ length: columns }, () => []);
  let selected: GridCell | null = null;
  if (valid) {
    const ratio = Number.isFinite(valid.aspectRatio) && valid.aspectRatio > 0 ? valid.aspectRatio : 1;
    const preferredSpan = Math.min(columns, ratio < .9 ? 2 : 3);
    const width = Math.min(cell * preferredSpan + gap * (preferredSpan - 1), (valid.maxPhotoHeight || 620) * ratio);
    const height = width / ratio + captionHeight;
    const span = Math.min(columns, Math.max(1, Math.ceil((width + gap - .001) / pitch)));
    const column = Math.max(0, Math.min(columns - span, valid.column - Math.floor(span / 2)));
    const row = Math.max(0, Math.min(Math.max(0, Math.ceil(ids.length / columns) - 1), valid.row - 1));
    selected = { id: valid.id, column, row, span, x: column * pitch, y: row * pitch, width, height, expanded: true };
    for (let x = column; x < column + span; x++) intervals[x].push({ start: selected.y, end: selected.y + height + gap });
  }
  function firstFree(column: number) {
    let y = 0;
    for (const occupied of intervals[column]) {
      if (y + cell + gap <= occupied.start + .001) break;
      if (y < occupied.end) y = occupied.end;
    }
    return y;
  }
  const cells: GridCell[] = ids.map(id => {
    if (selected?.id === id) return selected;
    let column = 0;
    let y = firstFree(0);
    for (let x = 1; x < columns; x++) {
      const next = firstFree(x);
      if (next < y - .001) { column = x; y = next; }
    }
    intervals[column].push({ start: y, end: y + cell + gap });
    intervals[column].sort((a, b) => a.start - b.start);
    return { id, column, row: y / pitch, span: 1, x: column * pitch, y, width: cell, height: cell, expanded: false };
  });
  return { cells, height: Math.max(0, ...cells.map(tile => tile.y + tile.height)) };
}
