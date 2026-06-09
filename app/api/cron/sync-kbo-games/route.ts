import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { syncGamesInRange } from "@/lib/server/kbo/syncGames";
import { syncLineupsForDate } from "@/lib/server/kbo/syncLineups";
import { syncStandings } from "@/lib/server/kbo/syncStandings";
import { listGamesFromDb, listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton } from "@/lib/utils/dailyReportHelper";
import { generateDailyReportWithGemini } from "@/lib/server/kbo/geminiDailyReport";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

    // AI 예측 채점은 cron 의존을 끊고 bp_ai_predictions_with_result VIEW 로 라이브 판정 중.
    // games.home_score / away_score 가 위에서 sync 되자마자 VIEW 가 즉시 반영하므로 별도 단계 불필요.

    // 라인업 + 순위 통합 sync — scope=week(미래 일정만)에는 스킵.
    // 각각 try/catch로 격리해서 한 단계 실패해도 다른 단계는 진행.
    let lineups: Awaited<ReturnType<typeof syncLineupsForDate>> | { error: string } | { skipped: true } = { skipped: true };
    let standings: Awaited<ReturnType<typeof syncStandings>> | { error: string } | { skipped: true } = { skipped: true };
    if (scope !== "week") {
      try {
        // 어제 종료 경기의 라인업 수집. `from`은 어제(scope=today) 또는 사용자 지정 시작일(scope=range).
        lineups = await syncLineupsForDate(from);
      } catch (err) {
        lineups = { error: (err as Error).message };
      }
      try {
        const season = Number(from.slice(0, 4));
        standings = await syncStandings(season);
      } catch (err) {
        standings = { error: (err as Error).message };
      }
    }

    // 3. 일일 리포트(daily_ai_reports) 자동 생성 및 캐싱 (scope !== 'week' 일 때만 연쇄 구동)
    let dailyReport: any = { skipped: true };
    if (scope !== "week") {
      try {
        const gamesForDate = await listGamesFromDb({ from, to: from });
        const hasUnfinished = gamesForDate.some(g => g.status === "scheduled" || g.status === "in_progress");

        if (gamesForDate.length > 0 && !hasUnfinished) {
          const supabase = createSupabaseAdminClient();
          
          // 중복 생성 방지: 이미 해당 날짜의 일일 리포트 캐시가 DB에 있으면 스킵
          const { data: existingReport } = await supabase
            .from("daily_ai_reports")
            .select("report_date")
            .eq("report_date", from)
            .maybeSingle();

          if (existingReport) {
            dailyReport = { skipped: true, reason: "Daily report already exists in DB", date: from };
          } else {
            // 뉴스 조회
            const { data: newsData } = await supabase
              .from("bp_news")
              .select("title")
              .gte("published_at", `${from}T00:00:00+09:00`)
              .lte("published_at", `${from}T23:59:59+09:00`)
              .order("published_at", { ascending: false });
            const newsTitles = (newsData ?? []).map(n => n.title);

            // 순위표 조회
            const yearNum = Number(from.slice(0, 4));
            const standingsData = await listStandingsFromDb(yearNum);

            // 뼈대 생성 및 AI 분석
            const basicSkeleton = buildDailyReportSkeleton(gamesForDate, from);
            const aiReport = await generateDailyReportWithGemini(basicSkeleton, newsTitles, standingsData);

            if (aiReport) {
              // 캐시 적재
              await supabase.from("daily_ai_reports").upsert({
                report_date: from,
                report_json: aiReport,
                created_at: new Date().toISOString()
              });

              dailyReport = { ok: true, cached: true, date: from };
            } else {
              dailyReport = { error: "AI 리포트 생성 실패 (null 반환)", date: from };
            }
          }
        } else {
          dailyReport = { 
            skipped: true, 
            reason: gamesForDate.length === 0 ? "No games found" : "Some games are still in progress" 
          };
        }
      } catch (err) {
        dailyReport = { error: (err as Error).message };
      }
    }

    // ISR 캐시 무효화 — schedule/홈 페이지가 revalidate 24시간이라
    // cron이 새 결과를 sync해도 캐시 만료 전엔 안 보임. 명시적으로 무효화.
    // 변경 없는 fetch면 굳이 무효화 안 해도 되지만, totals 체크 비용보다 무효화 비용이 더 싸므로 항상 호출.
    revalidatePath("/schedule");
    revalidatePath("/");
    revalidatePath("/predict/ai-winner");
    revalidatePath("/rankings");
    revalidatePath("/play/lineup");
    revalidatePath("/daily-report");

    return NextResponse.json({ ok: true, scope, totals, results, lineups, standings, dailyReport });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
