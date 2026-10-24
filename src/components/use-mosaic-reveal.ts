'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { GridCell } from '@/lib/grid-layout';
import { mosaicRevealDelta } from '@/lib/mosaic-reveal';

/** Own only the scroll needed for an expansion; actual visitor input cancels it. */
export function useMosaicReveal(container: RefObject<HTMLDivElement | null>, cell: GridCell | undefined, reduced: boolean, cancel: () => void, clearIntent: () => void) {
  const revealing = useRef(false);
  useLayoutEffect(() => {
    const grid = container.current;
    if (!grid || !cell) return;
    let frame = 0;
    let stopped = false;
    let started = 0;
    let previous = 0;
    const delta = () => {
      const toolbar = grid.closest('.collection-section')?.querySelector('.collection-navbar');
      const top = Math.max(0, toolbar?.getBoundingClientRect().bottom ?? 0) + 16;
      return mosaicRevealDelta(grid.getBoundingClientRect().top + cell.y, cell.height, top, window.innerHeight - 16);
    };
    if (Math.abs(delta()) < 1) return;
    revealing.current = true;
    clearIntent();
    const interrupt = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      revealing.current = false;
      cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (['Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) interrupt();
    };
    // Let a photo or heart finish its click without moving out from under it.
    const pointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !grid.contains(event.target)) interrupt();
    };
    const tick = (now: number) => {
      if (stopped) return;
      if (document.hidden || document.body.style.overflow === 'hidden' || grid.closest('[inert]')) { interrupt(); return; }
      if (!started) started = previous = now;
      const elapsed = now - started;
      const amount = delta();
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(maximum, window.scrollY + amount));
      const distance = target - window.scrollY;
      const progress = reduced ? 1 : 1 - Math.exp(-Math.max(1, now - previous) / 65);
      previous = now;
      // Explicit instant steps avoid CSS smooth-scroll restarting on each frame.
      if (Math.abs(distance) > .5) window.scrollTo({ top: Math.abs(distance) < 1 ? target : window.scrollY + distance * progress, behavior: 'instant' });
      // The grid height is also springing, so allow the last row to finish growing.
      if (elapsed < (reduced ? 32 : 600) || (Math.abs(distance) > 1 && elapsed < 1200)) {
        frame = requestAnimationFrame(tick);
      } else {
        // Drain the last native scroll event before restoring normal scroll/hover.
        frame = requestAnimationFrame(() => { revealing.current = false; });
      }
    };
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('pointerdown', pointer, { passive: true });
    window.addEventListener('keydown', key);
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      revealing.current = false;
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('pointerdown', pointer);
      window.removeEventListener('keydown', key);
    };
  }, [container, cell, reduced, cancel, clearIntent]);
  return revealing;
}
