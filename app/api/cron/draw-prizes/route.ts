import { NextResponse, type NextRequest } from "next/server";
import { drawPointPrize, listDuePrizeIds } from "@/lib/server/prizes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const prizeId = request.nextUrl.searchParams.get("prizeId");
  try {
    const prizeIds = prizeId ? [prizeId] : await listDuePrizeIds();
    const results = [];
    for (const id of prizeIds) {
      results.push({ prizeId: id, ...(await drawPointPrize(id)) });
    }

    return NextResponse.json({
      ok: true,
      checked: prizeIds.length,
      results
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "draw failed" },
      { status: 500 }
    );
  }
}
