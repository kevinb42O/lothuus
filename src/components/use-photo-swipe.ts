import { animate, useMotionValue, useTransform } from 'motion/react';
import { useLayoutEffect, useRef, type PointerEvent } from 'react';

/** Track in slide units so resizing never leaves a photograph between pages. */
export function usePhotoSwipe(index: number, count: number, choose: (index: number) => Promise<boolean>) {
  const position = useMotionValue(-index);
  const x = useTransform(position, value => `${value * 100}%`);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const target = useRef(index);
  const request = useRef(0);
  const gesture = useRef<{ id: number; x: number; y: number; width: number; origin: number; axis: 'pending' | 'horizontal' | 'vertical'; lastX: number; time: number; velocity: number } | null>(null);

  function settle(next: number, velocity = 0) {
    animation.current?.stop();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) position.set(-next);
    else animation.current = animate(position, -next, { type: 'spring', stiffness: 400, damping: 40, velocity });
  }
  useLayoutEffect(() => {
    request.current++;
    if (target.current === index) return;
    target.current = index;
    if (!gesture.current) settle(index);
  }, [index]); // Successful thumbnail/keyboard choices share the same track.
  useLayoutEffect(() => () => { request.current++; animation.current?.stop(); }, []);

  function cancel() {
    if (!gesture.current) return;
    gesture.current = null;
    settle(target.current);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (drag.axis !== 'horizontal') return;
    const now = event.timeStamp;
    const elapsed = now - drag.time;
    if (elapsed > 0 && event.clientX !== drag.lastX) drag.velocity = (event.clientX - drag.lastX) / elapsed;
    if (event.clientX !== drag.lastX) { drag.lastX = event.clientX; drag.time = now; }
    let next = drag.origin + dx / drag.width;
    const bound = Math.max(-(count - 1), Math.min(0, next));
    const excess = next - bound;
    // A progressively resistant edge still acknowledges the finger's movement.
    if (excess) next = bound + excess * .35 / (1 + Math.abs(excess));
    position.set(next);
  }
  return {
    x,
    position,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!event.isPrimary) { cancel(); return; }
        if (count < 2 || event.button > 0 || (event.target as Element).closest('button')) return;
        animation.current?.stop();
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width || 1, origin: position.get(), axis: 'pending', lastX: event.clientX, time: event.timeStamp, velocity: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: move,
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        const drag = gesture.current;
        if (!drag || drag.id !== event.pointerId) return;
        move(event);
        gesture.current = null;
        if (drag.axis !== 'horizontal') { settle(target.current); return; }
        // Use only recent velocity: pausing before release must not fling a slide.
        const velocity = Math.abs(event.clientX - drag.x) >= 16 && event.timeStamp - drag.time < 80 ? drag.velocity / drag.width : 0;
        const start = Math.round(-drag.origin);
        const projected = -position.get() - velocity * 180;
        const travel = projected - start;
        const destination = start + (Math.abs(travel) >= .22 ? Math.sign(travel) : 0);
        const next = Math.max(0, Math.min(count - 1, Math.max(start - 1, Math.min(start + 1, destination))));
        const previousTarget = target.current;
        target.current = next;
        settle(next, velocity * 1000);
        if (next === previousTarget) return;
        const latest = ++request.current;
        void choose(next).then(ok => {
          if (!ok && latest === request.current) { target.current = index; if (!gesture.current) settle(index); }
        });
      },
    },
  };
}
