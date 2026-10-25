import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

export function setupDom(url = 'http://localhost:3000/') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url });
  const replacements = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, FormData: dom.window.FormData, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const descriptors = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const objectUrls = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }; let objectUrl = 0;
  URL.createObjectURL = () => `blob:http://localhost:3000/test-${++objectUrl}`;
  URL.revokeObjectURL = () => {};
  const require = createRequire(import.meta.url), previousCss = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  return { dom, container: dom.window.document.getElementById('root')!, cleanup() {
    dom.window.close();
    URL.createObjectURL = objectUrls.create; URL.revokeObjectURL = objectUrls.revoke;
    if (previousCss) require.extensions['.css'] = previousCss; else delete require.extensions['.css'];
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  } };
}

export const settle = () => new Promise<void>(resolve => setImmediate(resolve));
export function button(container: HTMLElement, text: string) {
  const result = [...container.querySelectorAll('button')].find(element => element.textContent?.includes(text));
  if (!result) throw new Error(`Button missing: ${text}`);
  return result;
}
