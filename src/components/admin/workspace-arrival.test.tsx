import test from "node:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { setupDom, settle } from "../../test/dom";
import { useWorkspaceArrival } from "./workspace-arrival";
import { flushAdminUsage } from "../../lib/admin-usage-client";
test("only authenticated workspace mounts emit one arrival, including StrictMode and a later sign-in", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(ui.container);
  const actions: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/admin/usage");
    actions.push(
      ...JSON.parse(String(init?.body)).events.map(
        (e: { action: string }) => e.action,
      ),
    );
    return Response.json({ recorded: true });
  };
  function Example({ authenticated }: { authenticated: boolean }) {
    useWorkspaceArrival(authenticated);
    return null;
  }
  const render = async (authenticated: boolean) =>
    act(async () => {
      root.render(
        <StrictMode>
          <Example authenticated={authenticated} />
        </StrictMode>,
      );
      await settle();
    });
  try {
    await render(false);
    assert.equal(actions.length, 0);
    await render(true);
    assert.deepEqual(actions, ["workspace_open"]);
    await render(true);
    assert.equal(actions.length, 1);
    await render(false);
    await render(true);
    assert.deepEqual(actions, ["workspace_open", "workspace_open"]);
  } finally {
    await act(async () => root.unmount());
    await flushAdminUsage();
    globalThis.fetch = originalFetch;
    ui.cleanup();
  }
});
