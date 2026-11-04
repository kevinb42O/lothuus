import { NextRequest, NextResponse } from "next/server";
import {
  readJson,
  requireOwner,
  sameOrigin,
  throttle,
} from "@/lib/backend/auth";
import { cloudMode, serverDatabase } from "@/lib/backend/cloud";
import { BusinessError, safeError } from "@/lib/backend/service";
import { usageInput } from "@/lib/admin-usage-validation";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const actor = await requireOwner(request);
    await throttle(request, "workspace-usage", 240);
    const parsed = usageInput.safeParse(await readJson(request));
    if (!parsed.success)
      throw new BusinessError("Ongeldige gebruiksregistratie.");
    if (cloudMode()) {
      const result = await serverDatabase().rpc("lothuus_admin_usage", {
        actor,
        events: parsed.data.events,
      });
      if (result.error)
        throw new BusinessError(
          "Gebruiksregistratie tijdelijk niet beschikbaar.",
          503,
        );
    }
    return NextResponse.json(
      { recorded: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
