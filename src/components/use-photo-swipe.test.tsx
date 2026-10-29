import assert from 'node:assert/strict';
import test from 'node:test';
import { act, useRef, type PointerEvent } from 'react';
import { setupDom } from '../test/dom';

test('photos track the finger before release, flick with recent velocity, resist edges and recover from failed loading', async () => {
  const ui = setupDom();
  const { usePhotoSwipe } = await import('./use-photo-swipe');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  let swipe!: ReturnType<typeof usePhotoSwipe>;
  const choices: number[] = [];
  let rejectChoice: ((ok: boolean) => void) | undefined;
  function Harness({ count = 3 }: { count?: number }) {
    const frame = useRef<HTMLDivElement>(null);
    swipe = usePhotoSwipe(0, count, index => { choices.push(index); return new Promise(resolve => { rejectChoice = resolve; }); }, frame);
    return <div ref={frame} />;
  }
  const target = { getBoundingClientRect: () => ({ width: 400 }), setPointerCapture() {}, closest: () => null };
  const event = (x: number, timeStamp: number, y = 100) => ({ clientX: x, clientY: y, timeStamp, pointerId: 1, isPrimary: true, button: 0, target, currentTarget: target }) as unknown as PointerEvent<HTMLDivElement>;
  try {
    await act(async () => root.render(<Harness />));
    const frame = ui.container.firstElementChild!;
    const touchMove = (fingers: number) => {
      const event = new ui.dom.window.Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: Array(fingers).fill({}) });
      frame.dispatchEvent(event);
      return event.defaultPrevented;
    };
    assert.equal(touchMove(1), true, 'single-finger motion over the photo must block native scrolling');
    assert.equal(touchMove(2), false, 'two-finger pinch remains native');
    const outsideMove = new ui.dom.window.Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(outsideMove, 'touches', { value: [{}] });
    ui.container.dispatchEvent(outsideMove);
    assert.equal(outsideMove.defaultPrevented, false, 'content outside the photo must remain scrollable');
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
    swipe.handlers.onPointerMove(event(280, 1040));
    swipe.handlers.onPointerUp(event(280, 1200));
    assert.equal(choices.length, 1, 'holding still before release discards stale flick velocity');
    assert.equal(swipe.position.get() + 0, 0);
    swipe.handlers.onPointerDown(event(300, 1300));
    swipe.handlers.onPointerMove(event(300, 1320, 200));
    assert.equal(swipe.position.get() + 0, 0, 'pure vertical movement does not move the photo');
    swipe.handlers.onPointerMove(event(100, 1340, 200));
    swipe.handlers.onPointerUp(event(100, 1360, 200));
    assert.deepEqual(choices, [1, 1], 'initial vertical drift must not lose a later horizontal swipe on the photo');
    await act(async () => { rejectChoice!(false); await Promise.resolve(); });
    swipe.handlers.onPointerDown(event(300, 1400));
    swipe.handlers.onPointerMove(event(200, 1700));
    swipe.handlers.onPointerUp(event(200, 1800));
    assert.deepEqual(choices, [1, 1, 1], 'a deliberate quarter-screen drag advances even without flick velocity');
    await act(async () => { rejectChoice!(false); await Promise.resolve(); });
    swipe.handlers.onPointerDown(event(300, 1900));
    swipe.handlers.onPointerMove(event(255, 2300));
    swipe.handlers.onPointerUp(event(255, 2500));
    assert.deepEqual(choices, [1, 1, 1, 1], 'a slow 45px swipe is enough; a large screen fraction is not required');
    await act(async () => root.render(<Harness count={1} />));
    assert.equal(touchMove(1), false, 'a single-photo object must not block native scrolling');
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});
