import assert from 'node:assert/strict';
import test from 'node:test';
import { act, type PointerEvent } from 'react';
import { setupDom } from '../test/dom';

test('photos track the finger before release, flick with recent velocity, resist edges and recover from failed loading', async () => {
  const ui = setupDom();
  const { usePhotoSwipe } = await import('./use-photo-swipe');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  let swipe!: ReturnType<typeof usePhotoSwipe>;
  const choices: number[] = [];
  let rejectChoice: ((ok: boolean) => void) | undefined;
  function Harness() {
    swipe = usePhotoSwipe(0, 3, index => { choices.push(index); return new Promise(resolve => { rejectChoice = resolve; }); });
    return null;
  }
  const target = { getBoundingClientRect: () => ({ width: 400 }), setPointerCapture() {}, closest: () => null };
  const event = (x: number, timeStamp: number, y = 100) => ({ clientX: x, clientY: y, timeStamp, pointerId: 1, isPrimary: true, button: 0, target, currentTarget: target }) as unknown as PointerEvent<HTMLDivElement>;
  try {
    await act(async () => root.render(<Harness />));
    swipe.handlers.onPointerDown(event(300, 0));
    swipe.handlers.onPointerMove(event(200, 300));
    assert.equal(swipe.position.get(), -.25, '100px movement on a 400px frame must move the photos exactly 25% before releasing');
    assert.equal(choices.length, 0, 'drag preview must not wait for loading or commit early');
    swipe.handlers.onPointerCancel();
    assert.equal(swipe.position.get() + 0, 0);

    swipe.handlers.onPointerDown(event(300, 400));
    swipe.handlers.onPointerMove(event(340, 500));
    assert.ok(swipe.position.get() > 0 && swipe.position.get() < .1, 'first-photo edge follows with resistance');
    swipe.handlers.onPointerUp(event(340, 700));
    assert.equal(swipe.position.get() + 0, 0);
    assert.equal(choices.length, 0);

    swipe.handlers.onPointerDown(event(300, 800));
    swipe.handlers.onPointerMove(event(280, 820));
    swipe.handlers.onPointerMove(event(260, 840));
    swipe.handlers.onPointerUp(event(260, 850));
    assert.deepEqual(choices, [1], 'a short, fast flick advances without needing half a screen');
    assert.equal(swipe.position.get(), -1);
    await act(async () => { rejectChoice!(false); await Promise.resolve(); });
    assert.equal(swipe.position.get() + 0, 0, 'failed loading returns to the displayed photo');

    swipe.handlers.onPointerDown(event(300, 1000));
    swipe.handlers.onPointerMove(event(260, 1040));
    swipe.handlers.onPointerUp(event(260, 1200));
    assert.equal(choices.length, 1, 'holding still before release discards stale flick velocity');
    assert.equal(swipe.position.get() + 0, 0);
    swipe.handlers.onPointerDown(event(300, 1300));
    swipe.handlers.onPointerMove(event(250, 1320, 200));
    swipe.handlers.onPointerMove(event(100, 1340, 200));
    swipe.handlers.onPointerUp(event(100, 1360, 200));
    assert.equal(choices.length, 1, 'a gesture locked to vertical scrolling must never become a photo swipe');
    swipe.handlers.onPointerDown(event(300, 1400));
    swipe.handlers.onPointerMove(event(200, 1700));
    swipe.handlers.onPointerUp(event(200, 1800));
    assert.deepEqual(choices, [1, 1], 'a deliberate quarter-screen drag advances even without flick velocity');
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});
