import assert from 'node:assert/strict';
import test from 'node:test';
import { act, useRef } from 'react';
import { setupDom, settle } from '../test/dom';
import { useVisibleMosaicPhotos } from './use-visible-mosaic-photos';

test('both observer boundaries drive retention, arrival preserves nearby photos, and cleanup releases observers', async () => {
  const ui = setupDom();
  const keys = ['IntersectionObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
  const old = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map<number, FrameRequestCallback>();
  const observers: { notify: () => void; disconnected: boolean; margin?: string }[] = [];
  let offset = 0, serial = 0;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  class Observer {
    disconnected = false;
    margin?: string;
    constructor(public notify: () => void, options?: IntersectionObserverInit) { this.margin = options?.rootMargin; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  Object.defineProperties(globalThis, {
    IntersectionObserver: { configurable: true, value: Observer },
    MutationObserver: { configurable: true, value: ui.dom.window.MutationObserver },
    requestAnimationFrame: { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; } },
    cancelAnimationFrame: { configurable: true, value: (id: number) => frames.delete(id) },
  });
  ui.dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = Number(this.dataset.row || 0) * 200 - offset;
    return { top, bottom: top + 190, left: 0, right: 120, width: 120, height: 190, x: 0, y: top, toJSON() {} };
  };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  function Harness() {
    const grid = useRef<HTMLDivElement>(null);
    const visible = useVisibleMosaicPhotos(grid, 'test');
    return <div className="house-entry-experience"><div ref={grid}>{Array.from({ length: 90 }, (_, i) =>
      <div key={i} data-id={String(i)} data-present="true" data-column={i % 3} data-row={Math.floor(i / 3)}>{visible.has(String(i)) && <img alt="" />}</div>)}</div></div>;
  }
  async function flush() {
    await act(async () => {
      for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
      await settle();
    });
  }
  const mounted = (id: number) => !!ui.container.querySelector(`[data-id="${id}"] img`);
  try {
    await act(async () => { root.render(<Harness />); });
    await flush();
    assert.deepEqual(observers.slice(0, 2).map(o => o.margin), ['800px 0px', '1600px 0px']);
    assert.ok(mounted(21)); // More than the old 240px margin.
    assert.ok(!mounted(30));
    offset = 1400;
    observers[0].notify(); observers[1].notify();
    assert.equal(frames.size, 1); // Two boundaries share one React update.
    await flush();
    assert.ok(mounted(0)); // Retained, despite leaving the load zone.
    offset = 3000;
    observers[0].notify();
    await flush();
    assert.ok(!mounted(0));
    assert.ok(mounted(45));
    const entrance = ui.container.firstElementChild!;
    await act(async () => { entrance.className = 'house-entry-experience house-entry-pinned'; await settle(); });
    await flush();
    assert.ok(mounted(0)); assert.ok(mounted(23)); assert.ok(!mounted(24));
    offset = 0;
    const firstImage = ui.container.querySelector('[data-id="0"] img');
    await act(async () => { entrance.classList.add('house-entry-arrived'); await settle(); });
    await flush();
    assert.equal(ui.container.querySelector('[data-id="0"] img'), firstImage);
    await act(async () => { root.unmount(); });
    assert.ok(observers.every(observer => observer.disconnected));
    assert.equal(frames.size, 0);
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    ui.cleanup();
  }
});
