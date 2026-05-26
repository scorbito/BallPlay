import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { syncGamesInRange } from "@/lib/server/kbo/syncGames";

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";

  let from: string;
  let to: string;

  if (scope === "range") {
    from = url.searchParams.get("from") ?? "";
    to = url.searchParams.get("to") ?? "";
    if (!from || !to) {
      return NextResponse.json({ ok: false, error: "from and to required for scope=range" }, { status: 400 });
    }
  } else {
    const today = kstNow();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 1);
    const toDate = new Date(today);
    if (scope === "week") {
      toDate.setDate(today.getDate() + 30);
    }
    from = formatDate(fromDate);
    to = formatDate(toDate);
  }

  try {
    const results = await syncGamesInRange(from, to, { delayMs: 200 });
    const totals = results.reduce(
      (acc, r) => ({ inserted: acc.inserted + r.inserted, updated: acc.updated + r.updated }),
      { inserted: 0, updated: 0 }
    );

    // ISR 캐시 무효화 — schedule/홈 페이지가 revalidate 24시간이라
    // cron이 새 결과를 sync해도 캐시 만료 전엔 안 보임. 명시적으로 무효화.
    // 변경 없는 fetch면 굳이 무효화 안 해도 되지만, totals 체크 비용보다 무효화 비용이 더 싸므로 항상 호출.
    revalidatePath("/schedule");
    revalidatePath("/");

    return NextResponse.json({ ok: true, scope, totals, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
