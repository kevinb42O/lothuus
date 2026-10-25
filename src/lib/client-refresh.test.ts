import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, settle } from '../test/dom';
import { observeFreshness } from './client-refresh';

test('returning to a fresh or hidden page does not load; overlapping reveal events share one request', async () => {
  const ui = setupDom(), originalNow = Date.now;
  let now = 100000, loaded = now, calls = 0, release!: () => void;
  Date.now = () => now;
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  const stop = observeFreshness(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); loaded = now; }, () => loaded);
  try {
    window.dispatchEvent(new ui.dom.window.Event('focus')); assert.equal(calls,0);
    now += 60001;
    window.dispatchEvent(new ui.dom.window.Event('focus')); document.dispatchEvent(new ui.dom.window.Event('visibilitychange')); assert.equal(calls,1);
    release(); await settle(); window.dispatchEvent(new ui.dom.window.Event('focus')); assert.equal(calls,1);
    now += 60001; Object.defineProperty(document,'hidden',{value:true,configurable:true}); window.dispatchEvent(new ui.dom.window.Event('online')); assert.equal(calls,1);
    Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new ui.dom.window.Event('visibilitychange'));assert.equal(calls,2);release();await settle();
    stop();now+=60001;window.dispatchEvent(new ui.dom.window.Event('focus'));assert.equal(calls,2);
  } finally { stop(); Date.now = originalNow; ui.cleanup(); }
});
