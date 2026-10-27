import assert from 'node:assert/strict';
import test from 'node:test';
import { act } from 'react';
import { setupDom } from '../test/dom';
import { DoorwayHero } from './doorway-hero';

async function mount(reduced = false) {
  const ui = setupDom();
  const w = ui.dom.window;
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.play = async () => {};
  const media = (query: string) => ({ matches: reduced && query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} });
  class Observer { observe() {} disconnect() {} }
  const globals = { history: w.history, Element: w.Element, MutationObserver: w.MutationObserver,
    ResizeObserver: Observer, matchMedia: media, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  await act(async () => root.render(<DoorwayHero><section id="collectie" tabIndex={-1}>Collectie</section></DoorwayHero>));
  return { ...ui, close: async () => {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    ui.cleanup();
  } };
}

test('skip during loading releases the video and exposes the actual collection', async () => {
  const ui = await mount();
  try {
    assert.match(ui.container.querySelector('video')!.src, /entrance-desktop\.webm$/);
    assert.equal(ui.container.querySelector('.house-entry-world')!.getAttribute('style')?.includes('hidden'), true);
    await act(async () => ui.container.querySelector<HTMLAnchorElement>('.house-entry-loader-skip')!.click());
    assert.ok(ui.container.querySelector('.house-entry-arrived'));
    assert.equal(ui.container.querySelector('video')!.getAttribute('src'), null);
    assert.equal((ui.container.querySelector('.house-entry-world') as HTMLElement).inert, false);
    assert.equal((ui.container.querySelector('.house-entry-world') as HTMLElement).style.visibility, 'visible');
    assert.equal(ui.container.querySelector('canvas'), null);
  } finally { await ui.close(); }
});

test('reduced motion reaches the collection without requesting a video', async () => {
  const ui = await mount(true);
  try {
    assert.ok(ui.container.querySelector('.house-entry-arrived'));
    assert.equal(ui.container.querySelector('video')!.getAttribute('src'), null);
    assert.equal((ui.container.querySelector('.house-entry-world') as HTMLElement).inert, false);
  } finally { await ui.close(); }
});
