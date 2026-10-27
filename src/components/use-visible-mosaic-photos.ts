'use client';

import { useEffect, useState, type RefObject } from 'react';
import { photoWindowPolicy, selectPhotoWindow } from '@/lib/mosaic-photo-window';

/** Prepare ahead, retain behind, and release distant decoded images. Tile controls stay mounted. */
export function useVisibleMosaicPhotos(grid: RefObject<HTMLDivElement | null>, revision: string) {
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    let active = true, frame = 0;
    let observers: IntersectionObserver[] = [];
    const entrance = element.closest('.house-entry-experience');
    const inFlight = () => !!entrance?.classList.contains('house-entry-pinned') && !entrance.classList.contains('house-entry-arrived');
    const tiles = Array.from(element.querySelectorAll<HTMLElement>('[data-id][data-present="true"]'));
    const decodedPixels = new Map<string, number>();
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const commit = (next: ReadonlySet<string>) => setVisible(previous => stable(previous, next));
    const update = () => {
      frame = 0;
      if (!active) return;
      if (inFlight()) {
        // Projection must not change the eight atlas source rows during flight.
        const columns = Math.max(0, ...tiles.map(tile => Number(tile.dataset.column) || 0)) + 1;
        commit(new Set(tiles.slice(0, columns * 8).map(tile => tile.dataset.id!)));
        return;
      }
      const height = window.innerHeight;
      const policy = photoWindowPolicy(height, window.matchMedia('(pointer: coarse), (max-width: 700px)').matches, !!connection?.saveData);
      // Read geometry together, only at observer boundaries/load/resize, never each scroll frame.
      const bounds = tiles.map(tile => {
        const rect = tile.getBoundingClientRect();
        const image = tile.querySelector<HTMLImageElement>('.object-photograph img');
        const estimatedWidth = Number(image?.dataset.sourceWidth) || Math.ceil(rect.width * Math.min(2, window.devicePixelRatio || 1));
        if (image?.naturalWidth) decodedPixels.set(tile.dataset.id!, image.naturalWidth * image.naturalHeight);
        return { id: tile.dataset.id!, top: rect.top, bottom: rect.bottom,
          pixels: decodedPixels.get(tile.dataset.id!) || estimatedWidth * estimatedWidth * 2,
          pinned: tile.classList.contains('is-expanded') || tile.contains(document.activeElement) };
      });
      setVisible(previous => stable(previous, selectPhotoWindow(bounds, previous, height, policy)));
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
    const synchronize = () => {
      observers.forEach(observer => observer.disconnect());
      observers = [];
      if (!inFlight()) {
        const policy = photoWindowPolicy(window.innerHeight, window.matchMedia('(pointer: coarse), (max-width: 700px)').matches, !!connection?.saveData);
        observers = [policy.load, policy.retain].map(margin => {
          const observer = new IntersectionObserver(schedule, { rootMargin: `${Math.ceil(margin)}px 0px` });
          tiles.forEach(tile => observer.observe(tile));
          return observer;
        });
      }
      schedule();
    };
    const phase = new MutationObserver(synchronize);
    if (entrance) phase.observe(entrance, { attributes: true, attributeFilter: ['class'] });
    element.addEventListener('load', schedule, true);
    element.addEventListener('focusin', schedule);
    window.addEventListener('resize', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    synchronize();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observers.forEach(observer => observer.disconnect());
      phase.disconnect();
      element.removeEventListener('load', schedule, true);
      element.removeEventListener('focusin', schedule);
      window.removeEventListener('resize', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [grid, revision]);
  return visible;
}

function stable(previous: ReadonlySet<string>, next: ReadonlySet<string>) {
  return next.size === previous.size && [...next].every(id => previous.has(id)) ? previous : next;
}
