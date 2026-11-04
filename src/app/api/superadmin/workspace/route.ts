import { after, NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireOperator } from "@/lib/superadmin/auth";
import { operatorRpc, recordActivity } from "@/lib/superadmin/server";
import { workspaceCommand, changeProduct } from "@/lib/superadmin/workspace";
import { readJson, sameOrigin, throttle } from "@/lib/backend/auth";
import { BusinessError, safeError } from "@/lib/backend/service";
import { dailyCloudBackup } from "@/lib/maintenance/backup";
import { refreshHosting } from "@/lib/hosting/server";
import { refreshSupabaseUsage } from "@/lib/maintenance/usage";
export const runtime = "nodejs";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const { actor, client } = await requireOperator();
    await throttle(request, "operator-workspace", 50);
    const parsed = workspaceCommand.safeParse(await readJson(request));
    if (!parsed.success)
      throw new BusinessError(
        "Controleer de ingevulde gegevens en vermeld een duidelijke reden.",
      );
    const input = parsed.data;
    if (input.action === "note")
      await operatorRpc("lothuus_operator_note", {
        actor,
        note_key: input.id,
        expected_version: input.version,
        note_title: input.title,
        note_body: input.body,
        note_status: input.status,
        note_priority: input.priority,
        item_key: input.itemId,
        due: input.dueAt,
      });
    else if (input.action === "restore" || input.action === "publication")
      await changeProduct(actor, input);
    else if (input.action === "revoke-sessions") {
      const result = await client.auth.signOut({ scope: "others" });
      if (result.error)
        throw new BusinessError(
          "Andere sessies konden niet worden afgemeld.",
          503,
        );
      await recordActivity(
        actor,
        "sessions_revoked",
        undefined,
        "Andere superadminsessies afgemeld",
      );
    } else {
      const id = randomUUID();
      await operatorRpc("lothuus_operator_job_start", {
        actor,
        job_key: id,
        job_kind: input.kind,
      });
      after(async () => {
        try {
          await operatorRpc("lothuus_operator_job_finish", {
            job_key: id,
            job_status: "running",
            result_message: "Uitvoering gestart.",
          });
          let status = "succeeded",
            message = "Uitvoering afgerond.";
          if (input.kind === "backup") {
            const result = await dailyCloudBackup(true);
            if ("failed" in result && result.failed) {
              status = "error";
              message =
                "De reservekopie kon niet worden bevestigd. De vorige bevestigde kopie blijft behouden.";
            } else if ("skipped" in result && result.skipped) {
              status = "skipped";
              message = "Recent uitgevoerd of er is al een back-up bezig.";
            } else
              message =
                "Nieuwe reservekopie opgeslagen en checksum gecontroleerd.";
          } else {
            const results = await Promise.allSettled([
              refreshHosting(true),
              refreshSupabaseUsage(),
            ]);
            if (
              results.some(
                (r) =>
                  r.status === "rejected" ||
                  (r.status === "fulfilled" &&
                    "failed" in r.value &&
                    r.value.failed),
              )
            ) {
              status = "partial";
              message =
                "Een deel van de metingen kon niet worden vernieuwd. Bekijk de actualiteit per meetwaarde.";
            } else if (
              results[0].status === "fulfilled" &&
              "complete" in results[0].value &&
              !results[0].value.complete
            ) {
              status = "partial";
              message =
                "De opslagscan is nog niet volledig. Een volgende uitvoering hervat de scan.";
            } else
              message = "De beschikbare technische metingen zijn vernieuwd.";
          }
          await operatorRpc("lothuus_operator_job_finish", {
            job_key: id,
            job_status: status,
            result_message: message,
          });
        } catch {
          await operatorRpc("lothuus_operator_job_finish", {
            job_key: id,
            job_status: "error",
            result_message:
              "De uitvoering kon niet worden bevestigd. Bestaande gegevens en de vorige back-up blijven behouden.",
          }).catch(() => {});
        }
      });
      return NextResponse.json(
        { saved: true, jobId: id },
        { headers, status: 202 },
      );
    }
    return NextResponse.json({ saved: true }, { headers });
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  }
}
