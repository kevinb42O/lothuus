import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/superadmin/auth";
import { operatorRpc } from "@/lib/superadmin/server";
import { BusinessError, safeError } from "@/lib/backend/service";
import { activityInput } from "@/lib/superadmin/queries";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = z.uuid();
export async function GET(request: NextRequest) {
  try {
    const { actor, client, email } = await requireOperator(),
      p = request.nextUrl.searchParams,
      view = p.get("view");
    let data: unknown;
    if (view === "usage") {
      const days = Number(p.get("days") || 30),
        before = p.get("before"),
        category = p.get("category") || "all";
      if (
        !["all", "packages", "usage", "workspace"].includes(category) ||
        ![7, 30, 90].includes(days) ||
        (before && !/^[1-9]\d{0,17}$/.test(before))
      )
        throw new BusinessError("Ongeldige gebruiksperiode.");
      data = await operatorRpc("lothuus_operator_usage", {
        actor,
        period_days: days,
        before_id: before || null,
        category_filter: category,
      });
    } else if (view === "package-state")
      data = await operatorRpc("lothuus_operator_package_state", { actor });
    else if (view === "inventory") {
      const offset = Number(p.get("offset") || 0),
        q = p.get("q") || "",
        filter = p.get("filter") || "all",
        sort = p.get("sort") || "recent";
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 100000 ||
        q.length > 120 ||
        ![
          "all",
          "draft",
          "published",
          "archived",
          "sold",
          "reserved",
          "incomplete",
          "price",
          "photos",
        ].includes(filter) ||
        !["recent", "title", "price"].includes(sort)
      )
        throw new BusinessError("Controleer de collectiezoekopdracht.");
      data = await operatorRpc("lothuus_operator_inventory", {
        actor,
        query: q,
        filter,
        page_offset: offset,
        sort_order: sort,
      });
    } else if (view === "product" || view === "version") {
      const id = p.get("id");
      if (!uuid.safeParse(id).success)
        throw new BusinessError("Ongeldig productnummer.");
      if (view === "product")
        data = await operatorRpc("lothuus_operator_product", {
          actor,
          item_key: id,
        });
      else {
        const version = p.get("version");
        if (!version || !/^[1-9]\d{0,17}$/.test(version))
          throw new BusinessError("Ongeldige versie.");
        data = await operatorRpc("lothuus_operator_version", {
          actor,
          item_key: id,
          version_key: version,
        });
      }
    } else if (view === "activity") {
      const input = activityInput(p);
      data = await operatorRpc("lothuus_operator_activity_page", {
        actor,
        ...input,
      });
    } else if (view === "work") {
      const filter = p.get("filter") || "active";
      if (!["active", "done", "archived"].includes(filter))
        throw new BusinessError("Ongeldig takenfilter.");
      data = await operatorRpc("lothuus_operator_work", {
        actor,
        note_filter: filter,
      });
    } else if (view === "jobs")
      data = await operatorRpc("lothuus_operator_jobs", { actor });
    else if (view === "access") {
      const { data: user, error } = await client.auth.getUser();
      if (error)
        throw new BusinessError(
          "De accountgegevens zijn niet bereikbaar.",
          503,
        );
      data = {
        email,
        lastSignIn: user.user?.last_sign_in_at || null,
        createdAt: user.user?.created_at || null,
        assurance: "password",
        isolatedSession: true,
      };
    } else throw new BusinessError("Onbekend beheeroverzicht.");
    return NextResponse.json(data, { headers });
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  }
}
