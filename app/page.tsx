import { HomeScreen } from "@/components/domain/HomeScreen";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAccountStats, getMyAccountStatsRank } from "@/lib/supabase/query-parts/bpAccountStats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 홈 진입 시 일일 데이터 sync 트리거. throttle 로 보호되므로 매 요청 부담 없음.
  // cascade: 오늘 모든 게임 finished 면 라인업/순위/AI 채점도 자동 트리거.
  void triggerDailyDataSync();

  // 현재 사용자 누적 매치 기록 + 계정 누적 랭킹 순위 — 둘 다 admin client 로 집계.
  // 로그인 안 된 경우(true unauth)는 zeros + 익명 플래그 false 로 분기.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  const [record, rankResult] = await Promise.all([
    user
      ? getAccountStats(adminClient, user.id)
      : Promise.resolve({ wins: 0, losses: 0, total: 0, winRate: 0 }),
    user
      ? getMyAccountStatsRank(adminClient, user.id)
      : Promise.resolve({ ok: false as const })
  ]);
  const myRank = rankResult.ok ? rankResult.data.rank : null;
  const isAnonymous = Boolean(user?.is_anonymous);

  return (
    <HomeScreen
      userRecord={record}
      myRank={myRank}
      isAnonymous={isAnonymous}
    />
  );
}
