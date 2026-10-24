'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { elasticProfile, elasticStep } from '@/lib/elastic-scroll';

/** Native document scrolling; only grid transforms receive elastic column lag. */
export function useElasticGrid(container: RefObject<HTMLDivElement | null>, columns: number, reduced: boolean, resetKey: string, onScrollStart: () => void) {
  const scrolling = useRef(false);
  const stop = useRef<() => void>(() => {});
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const grid: HTMLDivElement = element;
    let frame = 0;
    let lastTime = 0;
    let lastScroll = window.scrollY;
    let lastEvent = 0;
    let offsets = Array.from({ length: columns }, () => 0);
    const compact = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    const clear = () => {
      offsets = offsets.map(() => 0);
      offsets.forEach((_, column) => grid.style.setProperty(`--elastic-${column}`, '0px'));
      grid.dataset.elastic = 'idle';
    };
    clear();
    function tick(now: number) {
      const elapsed = Math.min(.05, Math.max(.001, (now - lastTime) / 1000));
      lastTime = now;
      const scroll = window.scrollY;
      const delta = scroll - lastScroll;
      lastScroll = scroll;
      if (document.body.style.overflow === 'hidden' || document.hidden) {
        clear(); scrolling.current = false; frame = 0; return;
      }
      let moving = false;
      let largestOffset = 0;
      offsets = offsets.map((offset, column) => {
        const profile = elasticProfile(column, columns, compact);
        const next = elasticStep(offset, delta, elapsed, profile.time, profile.limit);
        grid.style.setProperty(`--elastic-${column}`, `${next.toFixed(3)}px`);
        if (next) moving = true;
        largestOffset = Math.max(largestOffset, Math.abs(next));
        return next;
      });
      const receivingScroll = now - lastEvent < 140;
      scrolling.current = receivingScroll || largestOffset > 12;
      grid.dataset.elastic = receivingScroll || moving ? 'moving' : 'idle';
      if (receivingScroll || moving) frame = requestAnimationFrame(tick);
      else { clear(); frame = 0; }
    }
    function scroll() {
      // Ignore scroll events from the product dialog; those do not move the page.
      const bounds = grid.getBoundingClientRect();
      if (bounds.bottom < -120 || bounds.top > window.innerHeight + 120 || document.body.style.overflow === 'hidden') {
        lastScroll = window.scrollY; return;
      }
      lastEvent = performance.now();
      if (!scrolling.current) onScrollStart();
      scrolling.current = true;
      if (reduced) { clear(); scrolling.current = false; lastScroll = window.scrollY; return; }
      if (!frame) { lastTime = performance.now() - 16.67; frame = requestAnimationFrame(tick); }
    }
    function reset() {
      cancelAnimationFrame(frame); frame = 0; clear(); scrolling.current = false;
      lastScroll = window.scrollY;
    }
    stop.current = reset;
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      reset(); stop.current = () => {};
    };
  }, [container, columns, reduced, resetKey, onScrollStart]);
  return { scrolling, stop };
}
