import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/superadmin/auth";
import { readPhoto } from "@/lib/backend/media";
import { safeError } from "@/lib/backend/service";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    await requireOperator();
    const id = request.nextUrl.searchParams.get("id"),
      size = request.nextUrl.searchParams.get("size") || "thumb";
    if (
      !z.uuid().safeParse(id).success ||
      !["thumb", "grid", "detail"].includes(size)
    )
      return new NextResponse(null, { status: 404 });
    const tag = `"operator-image-${id}-${size}"`,
      headers = {
        "Cache-Control": "private, no-cache",
        Vary: "Cookie",
        ETag: tag,
        "X-Content-Type-Options": "nosniff",
      };
    if (
      (request.headers.get("if-none-match") || "")
        .split(",")
        .map((v) => v.trim())
        .includes(tag)
    )
      return new NextResponse(null, { status: 304, headers });
    const body = await readPhoto(id!, size);
    if (!body) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(body, {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch (e) {
    const error = safeError(e);
    return NextResponse.json(
      {
        error:
          error.status === 401 || error.status === 403
            ? error.message
            : "Deze foto is niet beschikbaar.",
      },
      {
        status:
          error.status === 401 || error.status === 403 ? error.status : 404,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
