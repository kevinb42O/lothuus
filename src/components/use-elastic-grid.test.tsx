import assert from 'node:assert/strict';
import test from 'node:test';
import { act, useRef } from 'react';
import { setupDom } from '../test/dom';
import { useElasticGrid } from './use-elastic-grid';

test('top-edge wheel pulls share column motion, settle, and respect native scroll and reduced motion', async () => {
  const ui = setupDom();
  const keys = ['Element', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0, scrollY = 0, starts = 0;
  const onStart = () => { starts++; };
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
  Object.defineProperties(globalThis, {
    Element: { configurable: true, value: ui.dom.window.Element },
    requestAnimationFrame: { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; } },
    cancelAnimationFrame: { configurable: true, value: (id: number) => frames.delete(id) },
  });
  ui.dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 88, bottom: 2000, left: 0, right: 1000, width: 1000, height: 1912, x: 0, y: 88, toJSON() {} });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  function Harness({ reduced = false }: { reduced?: boolean }) {
    const grid = useRef<HTMLDivElement>(null);
    const revealing = useRef(false);
    useElasticGrid(grid, 6, reduced, 'test', onStart, revealing);
    return <div className="house-entry-experience house-entry-pinned"><div ref={grid} data-grid><textarea /></div></div>;
  }
  const wheel = (deltaY: number, target: EventTarget = window) => {
    const event = new ui.dom.window.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const flush = (now: number) => {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  };
  try {
    await act(async () => root.render(<Harness />));
    const grid = ui.container.querySelector<HTMLElement>('[data-grid]')!;
    assert.equal(wheel(100), false);
    scrollY = 200;
    assert.equal(wheel(-100), false);
    scrollY = 0;
    assert.equal(wheel(-100, grid.querySelector('textarea')!), false);
    document.body.style.overflow = 'hidden';
    assert.equal(wheel(-100), false);
    document.body.style.overflow = '';
    assert.equal(wheel(-100), false); // The entrance still owns the collection.
    grid.parentElement!.classList.add('house-entry-arrived');
    assert.equal(wheel(-100, grid), true);
    const immediate = parseFloat(grid.style.getPropertyValue('--elastic-0'));
    assert.equal(immediate, 0); // Wheel input never snaps the displayed position.
    const now = performance.now();
    flush(now);
    assert.equal(starts, 1);
    const outer = parseFloat(grid.style.getPropertyValue('--elastic-0'));
    const center = parseFloat(grid.style.getPropertyValue('--elastic-2'));
    assert.ok(outer > 0); // Responds on the first frame without a release timer.
    assert.ok(outer > center && center > 0);
    assert.equal(grid.style.getPropertyValue('--elastic-0'), grid.style.getPropertyValue('--elastic-5'));
    let returning = false, previousOffset = outer;
    for (let i = 1; i <= 48; i++) {
      flush(now + i * 16.67);
      const offset = parseFloat(grid.style.getPropertyValue('--elastic-0'));
      assert.ok(offset >= 0);
      if (offset < previousOffset) returning = true;
      if (returning) assert.ok(offset <= previousOffset); // One crest, no repeated bounces.
      previousOffset = offset;
    }
    assert.equal(grid.style.getPropertyValue('--elastic-0'), '0px');
    assert.equal(frames.size, 0);
    assert.equal(grid.dataset.elastic, 'idle');
    // A real trackpad gesture is a stream of pulses, not a single wheel event.
    const burstStart = now + 1000;
    for (let i = 0; i < 20; i++) {
      const before = grid.style.getPropertyValue('--elastic-0');
      assert.equal(wheel(-24), true);
      assert.equal(grid.style.getPropertyValue('--elastic-0'), before);
      flush(burstStart + i * 16.67);
    }
    previousOffset = parseFloat(grid.style.getPropertyValue('--elastic-0'));
    assert.ok(previousOffset > 30);
    returning = false;
    for (let i = 20; i < 80; i++) {
      flush(burstStart + i * 16.67);
      const offset = parseFloat(grid.style.getPropertyValue('--elastic-0'));
      assert.ok(offset >= 0);
      if (offset < previousOffset) returning = true;
      if (returning) assert.ok(offset <= previousOffset);
      previousOffset = offset;
    }
    assert.equal(grid.style.getPropertyValue('--elastic-0'), '0px');
    assert.equal(wheel(-100), true);
    window.dispatchEvent(new ui.dom.window.Event('blur'));
    assert.equal(frames.size, 0);
    await act(async () => root.render(<Harness reduced />));
    assert.equal(wheel(-100), false);
    assert.equal(frames.size, 0);
    await act(async () => root.unmount());
    assert.equal(wheel(-100), false);
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    ui.cleanup();
  }
});
