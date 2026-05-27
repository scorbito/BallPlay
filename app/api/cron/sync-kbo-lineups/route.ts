import { NextResponse, type NextRequest } from "next/server";
import { syncLineupsForDate } from "@/lib/server/kbo/syncLineups";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 매일 어제 경기 라인업 수집. scope=range&from=&to= 로 백필도 가능.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "yesterday";

  let dates: string[];
  if (scope === "range") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ ok: false, error: "from and to required for scope=range" }, { status: 400 });
    }
    dates = [];
    const d = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (d <= end) {
      dates.push(formatDate(d));
      d.setDate(d.getDate() + 1);
    }
  } else {
    // 어제 (KST). cron이 새벽에 돌아 전날 경기 확정분 수집.
    const y = kstNow();
    y.setDate(y.getDate() - 1);
    dates = [formatDate(y)];
  }

  try {
    const results = [];
    for (const dateStr of dates) {
      results.push(await syncLineupsForDate(dateStr));
    }
    const totals = results.reduce(
      (acc, r) => ({ upserted: acc.upserted + r.upserted, unmatched: acc.unmatched + r.unmatchedBatters }),
      { upserted: 0, unmatched: 0 }
    );
    return NextResponse.json({ ok: true, scope, totals, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
