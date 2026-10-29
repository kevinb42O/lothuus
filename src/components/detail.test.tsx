import assert from 'node:assert/strict';
import test from 'node:test';
import { act } from 'react';
import { setupDom, settle } from '../test/dom';
import { objects } from '../lib/collection';

test('mobile photo choices precede long copy and reveal only the latest successfully decoded image', async () => {
  const ui = setupDom();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const pending: { resolve: () => void; reject: () => void }[] = [];
  ui.dom.window.Image = class {
    src = ''; naturalWidth = 800; naturalHeight = 600;
    decode() { return new Promise<void>((resolve, reject) => pending.push({ resolve, reject })); }
  } as unknown as typeof Image;
  const { Detail } = await import('./lothuus');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  const object = { ...objects[0], priceCents: 12000, description: 'Een uitgebreid servies. '.repeat(100), photos: [
    { id: 'first', src: '/first.jpg', alt: 'Overzicht' },
    { id: 'second', src: '/second.jpg', alt: 'Detail' },
    { id: 'third', src: '/third.jpg', alt: 'Onderzijde' },
  ] };
  const render = (item = object) => root.render(<Detail object={item} saved={false} count={0} onSave={() => {}} onClose={() => {}} onSelection={() => {}} />);
  const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 366, width: 366, height: bottom - top, x: 0, y: top, toJSON() {} });
  const scrolls: ScrollToOptions[] = [];
  try {
    await act(async () => render());
    const content = ui.container.querySelector('.detail-content')!;
    const children = [...content.children];
    const strip = ui.container.querySelector('.detail-photo-strip')!;
    assert.ok(children.indexOf(strip) > children.indexOf(content.querySelector('.detail-price')!));
    assert.ok(children.indexOf(strip) < children.indexOf(content.querySelector('.detail-intro')!));
    const frame = ui.container.querySelector<HTMLElement>('.detail-image')!;
    const dialog = ui.container.querySelector('dialog')!;
    dialog.getBoundingClientRect = () => rect(12, 812);
    Object.defineProperty(dialog, 'clientHeight', { configurable: true, value: 800 });
    dialog.scrollTop = 500;
    dialog.scrollTo = options => scrolls.push(options as ScrollToOptions);
    frame.getBoundingClientRect = () => rect(-488, -188);
    const buttons = strip.querySelectorAll<HTMLButtonElement>('button');
    await act(async () => { buttons[1].click(); buttons[2].click(); });
    await act(async () => { pending[0].resolve(); await settle(); });
    assert.equal(scrolls.length, 0, 'superseded decode must not scroll');
    await act(async () => { pending[1].resolve(); await settle(); });
    assert.match(frame.querySelector('img')!.getAttribute('src')!, /third/);
    assert.deepEqual(scrolls, [{ top: 0, behavior: 'instant' }]);
    frame.getBoundingClientRect = () => rect(12, 312);
    await act(async () => { buttons[1].click(); });
    await act(async () => { pending[2].resolve(); await settle(); });
    assert.equal(scrolls.length, 1, 'fully visible photo must not scroll');
    await act(async () => { buttons[2].click(); });
    await act(async () => { pending[3].reject(); await settle(); });
    assert.match(content.textContent!, /Deze foto kan niet worden geladen/);
    assert.match(frame.querySelector('img')!.getAttribute('src')!, /second/);
    assert.equal(scrolls.length, 1, 'failed decode must not scroll');
    await act(async () => render({ ...object, photos: [object.photos[0]] }));
    assert.equal(ui.container.querySelector('.detail-photo-strip'), null);
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});

test('photo arrows wrap, track rapid choices and share selection with thumbnails and keyboard', async () => {
  const ui = setupDom();
  const pending: (() => void)[] = [];
  ui.dom.window.Image = class {
    src = ''; naturalWidth = 800; naturalHeight = 600;
    decode() { return new Promise<void>(resolve => pending.push(resolve)); }
  } as unknown as typeof Image;
  const { Detail } = await import('./lothuus');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  const object = { ...objects[0], title: 'K012 - Vintage servies – Model 1648', image: '/first.jpg', photos: [
    { id: 'first', src: '/first.jpg', alt: 'Overzicht' },
    { id: 'second', src: '/second.jpg', alt: 'Detail' },
    { id: 'third', src: '/third.jpg', alt: 'Onderzijde' },
  ] };
  const render = (item = object) => root.render(<Detail object={item} saved={false} count={0} onSave={() => {}} onClose={() => {}} onSelection={() => {}} />);
  const arrow = (name: string) => ui.container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  const source = () => ui.container.querySelector('.detail-image img')!.getAttribute('src');
  const decode = async () => { await act(async () => { pending.shift()!(); await settle(); }); };
  try {
    await act(async () => render());
    assert.equal(ui.container.querySelector('h2')!.textContent, 'Vintage servies – Model 1648');
    assert.equal(ui.container.querySelector('dialog')!.getAttribute('aria-label'), 'Vintage servies – Model 1648');
    await act(async () => arrow('Vorige foto').click());
    await decode();
    assert.equal(source(), '/third.jpg', 'previous from first wraps to last');
    assert.equal(ui.container.querySelector('.detail-photo-strip button[aria-pressed="true"]')!.getAttribute('aria-label'), 'Bekijk Onderzijde');
    await act(async () => arrow('Volgende foto').click());
    await decode();
    assert.equal(source(), '/first.jpg', 'next from last wraps to first');
    await act(async () => { arrow('Volgende foto').click(); arrow('Volgende foto').click(); });
    await decode();
    assert.equal(source(), '/first.jpg', 'superseded arrow request must not commit');
    await decode();
    assert.equal(source(), '/third.jpg', 'rapid clicks advance through requested photos');
    await act(async () => arrow('Volgende foto').dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    await decode();
    assert.equal(source(), '/second.jpg');
    await act(async () => render({ ...object, photos: [object.photos[0]] }));
    assert.equal(ui.container.querySelector('.detail-photo-arrow'), null);
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});

test('touch swipes navigate both ways while taps, vertical scroll, cancellation and multiple pointers do not', async () => {
  const ui = setupDom();
  const pending: (() => void)[] = [];
  ui.dom.window.Image = class {
    src = ''; naturalWidth = 800; naturalHeight = 600;
    decode() { return new Promise<void>(resolve => pending.push(resolve)); }
  } as unknown as typeof Image;
  const { Detail } = await import('./lothuus');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  const object = { ...objects[0], image: '/first.jpg', photos: [
    { id: 'first', src: '/first.jpg', alt: 'Overzicht' },
    { id: 'second', src: '/second.jpg', alt: 'Detail' },
  ] };
  try {
    await act(async () => root.render(<Detail object={object} saved={false} count={0} onSave={() => {}} onClose={() => {}} onSelection={() => {}} />));
    const frame = ui.container.querySelector<HTMLElement>('.detail-image')!;
    frame.setPointerCapture = () => {};
    const pointer = (type: string, x: number, y: number, options: { target?: Element; isPrimary?: boolean; pointerType?: string } = {}) => {
      const event = new ui.dom.window.Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, clientX: x, clientY: y, pointerType: options.pointerType || 'touch', isPrimary: options.isPrimary ?? true });
      (options.target || frame).dispatchEvent(event);
    };
    const gesture = async (x: number, y: number, cancel = false) => act(async () => {
      pointer('pointerdown', 150, 150);
      if (cancel) pointer('pointercancel', 150, 150);
      pointer('pointerup', x, y);
    });
    await gesture(140, 150);
    await gesture(100, 260);
    await gesture(40, 150, true);
    await act(async () => {
      pointer('pointerdown', 150, 150);
      pointer('pointerdown', 160, 150, { isPrimary: false });
      pointer('pointerup', 40, 150);
      const heart = frame.querySelector('.detail-heart')!;
      pointer('pointerdown', 150, 150, { target: heart });
      pointer('pointerup', 40, 150);
      pointer('pointerdown', 150, 150, { pointerType: 'mouse' });
      pointer('pointerup', 40, 150, { pointerType: 'mouse' });
    });
    assert.equal(pending.length, 0, 'only deliberate horizontal touch gestures navigate');
    await gesture(40, 150);
    await act(async () => { pending.shift()!(); await settle(); });
    assert.equal(frame.querySelector('img')!.getAttribute('src'), '/second.jpg');
    await gesture(240, 150);
    await act(async () => { pending.shift()!(); await settle(); });
    assert.equal(frame.querySelector('img')!.getAttribute('src'), '/first.jpg');
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});
