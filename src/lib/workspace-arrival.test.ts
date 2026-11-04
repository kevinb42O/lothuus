import test from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "../test/dom";
import {
  observeWorkspaceArrival,
  resetWorkspaceArrival,
  workspaceReturnAfter,
} from "./workspace-arrival";
test("workspace opens only in the foreground, survives remounts and counts only long returns", () => {
  const ui = setupDom();
  let hidden = true,
    time = 1000,
    count = 0;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  const start = () =>
    observeWorkspaceArrival(
      document,
      ui.dom.window as unknown as Window,
      () => count++,
      () => time,
    );
  const visibility = () =>
    document.dispatchEvent(new ui.dom.window.Event("visibilitychange"));
  let stop = start();
  try {
    assert.equal(count, 0);
    hidden = false;
    visibility();
    assert.equal(count, 1);
    // React StrictMode effect replay / component remount cannot double count.
    stop();
    stop = start();
    assert.equal(count, 1);
    hidden = true;
    visibility();
    time += workspaceReturnAfter - 1;
    hidden = false;
    visibility();
    assert.equal(count, 1);
    // A later return measures away time, rather than the age of the page.
    hidden = true;
    visibility();
    time += workspaceReturnAfter;
    hidden = false;
    visibility();
    assert.equal(count, 2);
    visibility();
    ui.dom.window.dispatchEvent(new ui.dom.window.Event("pageshow"));
    assert.equal(count, 2);
    ui.dom.window.dispatchEvent(new ui.dom.window.Event("pagehide"));
    time += workspaceReturnAfter;
    ui.dom.window.dispatchEvent(new ui.dom.window.Event("pageshow"));
    assert.equal(count, 3);
    stop();
    resetWorkspaceArrival(document);
    stop = start();
    assert.equal(count, 4);
  } finally {
    stop();
    ui.cleanup();
  }
});
test("arrival listeners are removed on exit and a newly loaded document has its own opening", () => {
  for (let i = 0; i < 2; i++) {
    const ui = setupDom();
    let count = 0;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    const stop = observeWorkspaceArrival(
      document,
      ui.dom.window as unknown as Window,
      () => count++,
    );
    assert.equal(count, 1);
    stop();
    ui.dom.window.dispatchEvent(new ui.dom.window.Event("pageshow"));
    assert.equal(count, 1);
    ui.cleanup();
  }
});
