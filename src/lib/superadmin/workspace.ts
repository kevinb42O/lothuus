import { z } from "zod";
import type { Item, Store } from "../backend/types";
import { command, BusinessError } from "../backend/service";
import { withStore } from "../backend/cloud";
import { operatorRpc } from "./server";
import { missingFields } from "../inventory";

export const restoreFields = [
  "title",
  "description",
  "date",
  "dimensions",
  "condition",
  "maker",
  "material",
  "category",
  "priceCents",
  "priceUnset",
] as const;
export const workspaceCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("note"),
      id: z.uuid(),
      version: z.number().int().min(0),
      title: z.string().trim().min(1).max(180),
      body: z.string().max(6000),
      status: z.enum(["open", "doing", "done", "archived"]),
      priority: z.enum(["normal", "high"]),
      itemId: z.uuid().nullable(),
      dueAt: z.iso.datetime({ offset: true }).nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("restore"),
      itemId: z.uuid(),
      versionId: z.string().regex(/^[1-9]\d{0,17}$/),
      expectedVersion: z.number().int().positive(),
      fields: z.array(z.enum(restoreFields)).min(1).max(10),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("publication"),
      itemId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      publication: z.enum(["draft", "published", "archived"]),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("maintenance"),
      kind: z.enum(["backup", "measurements"]),
    })
    .strict(),
  z.object({ action: z.literal("revoke-sessions") }).strict(),
]);
export function restoreProduct(
  state: Store,
  input: { itemId: string; expectedVersion: number; fields: readonly string[] },
  snapshot: Item,
) {
  const current = state.items.find((item) => item.id === input.itemId);
  if (!current) throw new BusinessError("Product niet gevonden.", 404);
  if (current.version !== input.expectedVersion)
    throw new BusinessError(
      "Het product is intussen gewijzigd. Vernieuw vóór je iets herstelt.",
      409,
    );
  if (
    snapshot.id !== current.id ||
    input.fields.some(
      (field) =>
        !restoreFields.includes(field as (typeof restoreFields)[number]),
    )
  )
    throw new BusinessError(
      "Deze versie hoort niet bij het gekozen herstel.",
      400,
    );
  const restored = {
    ...current,
    ...Object.fromEntries(
      input.fields.map((field) => [field, snapshot[field as keyof Item]]),
    ),
  };
  if (missingFields(restored).length) restored.editorReady = false;
  command(state, { action: "save-item", item: restored });
}
export async function changeProduct(
  actor: string,
  input: Extract<
    z.infer<typeof workspaceCommand>,
    { action: "restore" | "publication" }
  >,
) {
  const snapshot =
    input.action === "restore"
      ? ((await operatorRpc("lothuus_operator_version", {
          actor,
          item_key: input.itemId,
          version_key: input.versionId,
        })) as Item)
      : null;
  await withStore(
    (state) => {
      if (input.action === "restore") restoreProduct(state, input, snapshot!);
      else {
        const current = state.items.find((item) => item.id === input.itemId);
        if (!current) throw new BusinessError("Product niet gevonden.", 404);
        if (current.version !== input.expectedVersion)
          throw new BusinessError(
            "Het product is intussen gewijzigd. Vernieuw de fiche.",
            409,
          );
        command(state, {
          action: "save-item",
          item: { ...current, publication: input.publication },
        });
      }
    },
    undefined,
    actor,
    {
      kind:
        input.action === "restore"
          ? "product_restored"
          : "product_status_changed",
      itemId: input.itemId,
      reason: input.reason,
      sourceVersion: input.action === "restore" ? input.versionId : undefined,
    },
  );
}
export function csvCell(value: unknown) {
  const string = String(value ?? "");
  return `"${(/^\s*[=+@\-]|^[\t\r\n]/.test(string) ? "'" : "") + string.replaceAll('"', '""')}"`;
}
export function csv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export function boundedCsv(rows: unknown[][], maxBytes = 3_000_000) {
  if (!rows.length) return { content: "\uFEFF", count: 0 };
  const parts = ["\uFEFF" + rows[0].map(csvCell).join(";")];
  let bytes = Buffer.byteLength(parts[0]),
    count = 0;
  for (const row of rows.slice(1)) {
    const line = "\r\n" + row.map(csvCell).join(";");
    const size = Buffer.byteLength(line);
    if (bytes + size > maxBytes) break;
    parts.push(line);
    bytes += size;
    count++;
  }
  return { content: parts.join(""), count };
}
