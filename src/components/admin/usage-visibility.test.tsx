import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { setupDom, settle } from "../../test/dom";
import { flushAdminUsage } from "../../lib/admin-usage-client";
import { useHostingVisibility } from "./usage-visibility";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
test("package visibility requires continuous foreground exposure and records only once per visit", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch,
    descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "IntersectionObserver",
    );
  let callback: IntersectionObserverCallback = () => {},
    sent: { events: { action: string }[] }[] = [];
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    },
  });
  let hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ recorded: true });
  };
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(ui.container);
  function Example() {
    useHostingVisibility(true);
    return <section data-usage-visibility="plans_view">Packages</section>;
  }
  const emit = (ratio: number) =>
    callback(
      [
        {
          target: ui.container.querySelector("section")!,
          intersectionRatio: ratio,
          isIntersecting: ratio > 0,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  try {
    await act(async () => {
      root.render(<Example />);
      await settle();
    });
    emit(0.5);
    await wait(1100);
    hidden = true;
    document.dispatchEvent(new ui.dom.window.Event("visibilitychange"));
    await wait(1000);
    await flushAdminUsage();
    assert.equal(sent.length, 0);
    hidden = false;
    document.dispatchEvent(new ui.dom.window.Event("visibilitychange"));
    await wait(2100);
    await flushAdminUsage();
    assert.deepEqual(
      sent.flatMap((b) => b.events.map((e) => e.action)),
      ["plans_view"],
    );
    emit(0);
    emit(0.5);
    await flushAdminUsage();
    assert.equal(sent.length, 1);
  } finally {
    await act(async () => root.unmount());
    await flushAdminUsage();
    globalThis.fetch = originalFetch;
    if (descriptor)
      Object.defineProperty(globalThis, "IntersectionObserver", descriptor);
    else Reflect.deleteProperty(globalThis, "IntersectionObserver");
    ui.cleanup();
  }
});
