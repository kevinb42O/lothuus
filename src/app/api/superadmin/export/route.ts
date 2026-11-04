import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/superadmin/auth";
import { operatorRpc, recordActivity } from "@/lib/superadmin/server";
import { sameOrigin, readJson, throttle } from "@/lib/backend/auth";
import { BusinessError, safeError } from "@/lib/backend/service";
import { boundedCsv } from "@/lib/superadmin/workspace";
import { activityInput } from "@/lib/superadmin/queries";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const { actor } = await requireOperator();
    await throttle(request, "operator-export", 10);
    const input = (await readJson(request)) as {
      kind?: unknown;
      filters?: unknown;
    };
    let content: string, filename: string, total: number, count: number;
    if (input.kind === "collection") {
      const data = await operatorRpc("lothuus_operator_export", {
        actor,
        export_kind: "collection",
      });
      total = data.total;
      count = data.items.length;
      const encoded = boundedCsv([
        [
          "Productnummer",
          "Titel",
          "Beschrijving",
          "Prijs EUR",
          "Publicatie",
          "Voorraad",
          "Ontbreekt",
          "Bijgewerkt",
        ],
        ...data.items.map((i: Record<string, unknown>) => [
          i.number,
          i.title,
          i.description,
          Number(i.priceCents || 0) / 100,
          i.publication,
          i.stock,
          Array.isArray(i.missing) ? i.missing.join(", ") : "",
          i.updatedAt,
        ]),
      ]);
      content = encoded.content;
      count = encoded.count;
      filename = "lothuus-collectie.csv";
    } else if (input.kind === "activity") {
      if (typeof input.filters !== "string" || input.filters.length > 1000)
        throw new BusinessError("Ongeldige exportfilters.");
      const filters = activityInput(new URLSearchParams(input.filters));
      const data = await operatorRpc("lothuus_operator_activity_page", {
        actor,
        ...filters,
        before_id: null,
        page_size: 1000,
      });
      total = data.total;
      count = data.activity.length;
      const encoded = boundedCsv([
        [
          "Tijdstip",
          "Actor",
          "Handeling",
          "Product",
          "Titel",
          "Velden",
          "Reden",
        ],
        ...data.activity.map(
          (e: {
            at: string;
            actor: string;
            kind: string;
            title: string;
            details: { number?: string; fields?: string[]; reason?: string };
          }) => [
            e.at,
            e.actor,
            e.kind,
            e.details.number,
            e.title,
            e.details.fields?.join(", "),
            e.details.reason,
          ],
        ),
      ]);
      content = encoded.content;
      count = encoded.count;
      filename = "lothuus-activiteiten.csv";
      await recordActivity(
        actor,
        "export_created",
        undefined,
        "Activiteiten-export aangemaakt",
      );
    } else throw new BusinessError("Onbekend exporttype.");
    return new NextResponse(content, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Rows": String(count),
        "X-Export-Total": String(total),
      },
    });
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  }
}
