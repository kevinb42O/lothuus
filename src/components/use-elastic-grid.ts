'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { edgeRubberband, edgeSpringStep, elasticProfile, elasticStep } from '@/lib/elastic-scroll';

/** Native document scrolling, with column lag and a resisted spring at the exhausted top edge. */
export function useElasticGrid(container: RefObject<HTMLDivElement | null>, columns: number, reduced: boolean, resetKey: string, onScrollStart: () => void, revealing: RefObject<boolean>) {
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
    let edge = { position: 0, velocity: 0 };
    let edgePull = 0;
    const edgeLimit = Math.min(180, window.innerHeight * .22);
    const compact = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    const clear = () => {
      edge = { position: 0, velocity: 0 };
      edgePull = 0;
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
      if (document.body.style.overflow === 'hidden' || document.hidden || grid.closest('[inert]')) {
        clear(); scrolling.current = false; frame = 0; return;
      }
      let moving = false;
      let largestOffset = 0;
      // One animation owns the displayed position. Wheel pulses only feed its target.
      edge = edgeSpringStep(edge.position, edge.velocity, elapsed, edgeRubberband(edgePull, edgeLimit));
      edgePull *= Math.exp(-elapsed / .065);
      if (edgePull < .05) edgePull = 0;
      offsets = offsets.map((offset, column) => {
        const profile = elasticProfile(column, columns, compact);
        const next = elasticStep(offset, delta, elapsed, profile.time, profile.limit);
        // The same symmetric profile connects the boundary pull to ordinary column lag.
        const shift = next + edge.position * (.72 + .28 * (profile.time - .11) / .17);
        grid.style.setProperty(`--elastic-${column}`, `${shift.toFixed(3)}px`);
        if (next || edge.position || edge.velocity || edgePull) moving = true;
        largestOffset = Math.max(largestOffset, Math.abs(shift));
        return next;
      });
      const receivingScroll = now - lastEvent < 140;
      scrolling.current = receivingScroll || largestOffset > 12;
      grid.dataset.elastic = receivingScroll || moving ? 'moving' : 'idle';
      if (receivingScroll || moving) frame = requestAnimationFrame(tick);
      else { clear(); frame = 0; }
    }
    function wheel(event: WheelEvent) {
      if (reduced || event.defaultPrevented || event.ctrlKey || !event.cancelable ||
        revealing.current || document.hidden || document.body.style.overflow === 'hidden' ||
        grid.closest('[inert]') || grid.closest('.house-entry-pinned:not(.house-entry-arrived)')) return;
      if (event.target instanceof Element && event.target.closest('dialog, [role="dialog"], textarea, input, select, [contenteditable="true"]')) return;
      if (event.deltaY >= 0) { edgePull = 0; return; }
      if (window.scrollY > 1 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const bounds = grid.getBoundingClientRect();
      if (bounds.top < -24 || bounds.top > window.innerHeight / 2 || bounds.bottom <= 0) return;
      // Intercept only the exhausted top edge; native scrolling owns the rest of the page.
      event.preventDefault();
      const now = performance.now();
      const delta = -event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      // Never overwrite position/velocity or paint between frames: trackpads deliver
      // many momentum pulses, which otherwise fight the return and create sawtooth jumps.
      edgePull = Math.min(1800, edgePull + Math.min(delta, 240));
      lastEvent = now;
      if (!scrolling.current) onScrollStart();
      scrolling.current = true;
      if (!frame) { lastTime = now - 16.67; frame = requestAnimationFrame(tick); }
    }
    function scroll() {
      // Expansion reveal must neither close its owner nor introduce column lag.
      if (revealing.current) { reset(); return; }
      // Ignore scroll events from the product dialog; those do not move the page.
      if (grid.closest('[inert]')) {
        clear(); scrolling.current = false; lastScroll = window.scrollY; return;
      }
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
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      reset(); stop.current = () => {};
    };
  }, [container, columns, reduced, resetKey, onScrollStart, revealing]);
  return { scrolling, stop };
}
