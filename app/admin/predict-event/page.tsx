import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  addDays,
  computeWeeklyContest,
  contestWeekEnd,
  contestWeekStart,
  listEventDraws
} from "@/lib/server/predict/weeklyContest";
import { PredictEventDrawPanel } from "@/components/domain/admin/PredictEventDrawPanel";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function PredictEventAdminPage({
  searchParams
}: {
  searchParams: { week?: string };
}) {
  const serverClient = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(serverClient, identity);
  if (tier !== "admin") notFound();

  const admin = createSupabaseAdminClient();

  const currentWeek = contestWeekStart();
  // 기본값: 이번 회차(현재 주 화요일). 지난주 추첨은 '이전 주'로 이동. ?week 지정 시 그 날짜가 속한 회차.
  const weekStart =
    searchParams.week && DATE_RE.test(searchParams.week)
      ? contestWeekStart(searchParams.week)
      : currentWeek;

  // 연장 회차는 2주를 한 회차로 묶으므로 종료일 다음 화요일로 건너뛴다.
  const prevWeek = contestWeekStart(addDays(weekStart, -7));
  const nextWeekCandidate = addDays(contestWeekEnd(weekStart), 2);
  // 현재 회차 이후(미래)는 막는다.
  const nextWeek = nextWeekCandidate > currentWeek ? null : nextWeekCandidate;

  const [contest, draws] = await Promise.all([
    computeWeeklyContest(admin, weekStart),
    listEventDraws(admin)
  ]);

  const existingDraw = draws.find((d) => d.weekStartDate === weekStart) ?? null;

  return (
    <AppShell activeTab="home" title="승부예측 이벤트 추첨" theme="light" backHref="/admin/events" wide>
      <PredictEventDrawPanel
        weekStartISO={contest.weekStartISO}
        weekEndISO={contest.weekEndISO}
        prevWeekISO={prevWeek}
        nextWeekISO={nextWeek}
        gameCount={contest.gameCount}
        threshold={contest.threshold}
        aiAvgAccuracy={contest.aiAvgAccuracy}
        aiMaxAccuracy={contest.aiMaxAccuracy}
        aiProviders={contest.aiProviders}
        qualifiers={contest.qualifiers}
        participantCount={contest.participantCount}
        existingDraw={existingDraw}
        draws={draws}
      />
    </AppShell>
  );
}
