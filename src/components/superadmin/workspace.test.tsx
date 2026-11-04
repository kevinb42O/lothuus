import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { randomUUID } from "node:crypto";
import { setupDom, settle, button } from "../../test/dom";
import { operatorFixture } from "../../test/superadmin-fixture";

test("all workspace sections are reachable without performing writes on navigation", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch;
  ui.dom.window.scrollTo = () => {};
  const { createRoot } = await import("react-dom/client"),
    { Dashboard } = await import("./superadmin");
  const root = createRoot(ui.container);
  let writes = 0;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") writes++;
    if (url === "/api/superadmin/report") return Response.json(operatorFixture);
    const path = String(url);
    if (path.includes("view=inventory"))
      return Response.json({
        items: [],
        total: 0,
        offset: 0,
        counts: { all: 0 },
      });
    if (path.includes("view=activity"))
      return Response.json({ activity: [], total: 0 });
    if (path.includes("view=work")) return Response.json({ notes: [] });
    if (path.includes("view=package-state"))
      return Response.json({
        account: {
          plan: "basis",
          validUntil: null,
          updatedAt: "2026-11-04T12:00:00Z",
        },
        grants: [],
      });
    if (path.includes("view=usage"))
      return Response.json({
        days: 30,
        recordingSince: null,
        lastInteraction: null,
        totals: {
          actions: 0,
          hostingOpens: 0,
          usageViews: 0,
          usageRefreshes: 0,
          plansViews: 0,
          planClicks: 0,
          paymentOpens: 0,
          orderClicks: 0,
          paymentClaims: 0,
        },
        top: [],
        products: [],
        daily: [],
        events: [],
      });
    if (path.includes("view=jobs")) return Response.json([]);
    if (path.includes("view=access"))
      return Response.json({
        email: "operator@example.test",
        lastSignIn: null,
        createdAt: null,
        assurance: "password",
        isolatedSession: true,
      });
    throw Error(`Unexpected request: ${path}`);
  };
  try {
    await act(async () => {
      root.render(<Dashboard onExpired={() => {}} onLogout={async () => {}} />);
      await settle();
    });
    for (const [tab, text] of [
      ["Collectie & versies", "Geen producten gevonden"],
      ["Activiteiten", "0 resultaten"],
      ["Jouw werkblad", "Je werkblad is leeg"],
      ["Pakket & rechten", "Objectrechten opslaan"],
      ["Klikken & interesse", "Wat wordt werkelijk gebruikt"],
      ["Betalingen", "Een pakket activeren"],
      ["Back-ups & techniek", "Nu een reservekopie maken"],
      ["Toegang", "E-mailadres en wachtwoord"],
    ]) {
      await act(async () => {
        button(ui.container, tab).click();
        await settle();
      });
      assert.match(ui.container.textContent!, new RegExp(text));
    }
    assert.equal(writes, 0);
    assert.equal(ui.container.querySelector('[name="code"]'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    ui.cleanup();
  }
});

test("operator task creates once with private content, strict versioning and no message transmission", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch;
  const { createRoot } = await import("react-dom/client"),
    { WorkDesk } = await import("./work");
  const root = createRoot(ui.container);
  let sent: Record<string, unknown> | undefined;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("/api/superadmin/data"))
      return Response.json({ notes: [] });
    assert.equal(url, "/api/superadmin/workspace");
    sent = JSON.parse(String(init?.body));
    return Response.json({ saved: true });
  };
  try {
    await act(async () => {
      root.render(<WorkDesk onChanged={() => {}} />);
      await settle();
    });
    await act(async () =>
      button(ui.container, "Nieuwe taak of notitie").click(),
    );
    ui.container.querySelector<HTMLInputElement>('[name="title"]')!.value =
      "Opvolging afspraak";
    ui.container.querySelector<HTMLTextAreaElement>('[name="body"]')!.value =
      "Interne notitie voor Kevin";
    await act(async () => {
      ui.container.querySelector("form")!.dispatchEvent(
        new ui.dom.window.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
    });
    assert.equal(sent?.action, "note");
    assert.equal(sent?.version, 0);
    assert.equal(sent?.body, "Interne notitie voor Kevin");
    assert.equal(sent?.status, "open");
    assert.equal(sent?.itemId, null);
    assert.match(
      ui.container.textContent!,
      /opgeslagen in je interne werkruimte/,
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    ui.cleanup();
  }
});

test("a product opens with earlier versions and never changes publication or restores on inspection", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch;
  const { createRoot } = await import("react-dom/client"),
    { Collection } = await import("./collection");
  const root = createRoot(ui.container),
    id = randomUUID();
  let writes = 0;
  const item = {
    id,
    version: 2,
    title: "Huidige vaas",
    description: "Huidige beschrijving",
    category: "objecten",
    materialGroup: "K",
    priceCents: 5000,
    date: "1970",
    material: "",
    dimensions: "20 cm",
    condition: "Goed",
    maker: "",
    photos: [],
    publication: "draft",
    createdAt: "2026-11-04T10:00:00Z",
  };
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") writes++;
    if (String(url).includes("view=inventory"))
      return Response.json({
        items: [
          {
            ...item,
            number: "K1",
            stock: "available",
            photoId: null,
            photoCount: 0,
            missing: ["photos"],
            updatedAt: item.createdAt,
          },
        ],
        total: 1,
        offset: 0,
        counts: { all: 1 },
      });
    if (String(url).includes("view=product"))
      return Response.json({
        item,
        stock: "available",
        missing: ["photos"],
        versions: [{ id: "1", item_version: 1, captured_at: item.createdAt }],
      });
    if (String(url).includes("view=version"))
      return Response.json({ ...item, version: 1, title: "Oude vaas" });
    throw Error(`Unexpected: ${url}`);
  };
  try {
    await act(async () => {
      root.render(<Collection onChanged={() => {}} />);
      await settle();
    });
    await act(async () => {
      button(ui.container, "Huidige vaas").click();
      await settle();
    });
    assert.ok(ui.container.querySelector("dialog[open]"));
    const select =
      ui.container.querySelector<HTMLSelectElement>("dialog select")!;
    await act(async () => {
      select.value = "1";
      select.dispatchEvent(
        new ui.dom.window.Event("change", { bubbles: true }),
      );
      await settle();
    });
    assert.match(ui.container.textContent!, /Oude vaas/);
    assert.match(ui.container.textContent!, /Geselecteerde velden herstellen/);
    assert.equal(writes, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    ui.cleanup();
  }
});

test("unsaved notes prevent navigation when the operator chooses to keep editing", async () => {
  const ui = setupDom(),
    originalFetch = globalThis.fetch;
  ui.dom.window.scrollTo = () => {};
  ui.dom.window.confirm = () => false;
  const { createRoot } = await import("react-dom/client"),
    { Dashboard } = await import("./superadmin");
  const root = createRoot(ui.container);
  globalThis.fetch = async (url) =>
    String(url).includes("view=work")
      ? Response.json({ notes: [] })
      : Response.json(operatorFixture);
  try {
    await act(async () => {
      root.render(<Dashboard onExpired={() => {}} onLogout={async () => {}} />);
      await settle();
    });
    await act(async () => {
      button(ui.container, "Jouw werkblad").click();
      await settle();
    });
    await act(async () =>
      button(ui.container, "Nieuwe taak of notitie").click(),
    );
    const title =
      ui.container.querySelector<HTMLInputElement>('[name="title"]')!;
    await act(async () => {
      title.value = "Onvoltooide afspraak";
      title.dispatchEvent(new ui.dom.window.Event("change", { bubbles: true }));
    });
    const status =
      ui.container.querySelector<HTMLSelectElement>('[name=\"status\"]')!;
    await act(async () => {
      status.value = "doing";
      status.dispatchEvent(
        new ui.dom.window.Event("change", { bubbles: true }),
      );
    });
    await act(async () => button(ui.container, "Overzicht").click());
    // No lost input when a dirty change event was registered.
    const current =
      ui.container.querySelector<HTMLInputElement>('[name="title"]');
    assert.ok(current);
    assert.equal(current.value, "Onvoltooide afspraak");
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    ui.cleanup();
  }
});
