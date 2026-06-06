import type { Metadata } from "next";
import { AccountRankingScreen } from "@/components/domain/AccountRankingScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AccountRankingRow,
  MyAccountRank
} from "@/lib/supabase/query-parts/bpAccountRanking";
import {
  getCachedFullAccountStatsRanking,
  hydrateAccountStatsNicknames
} from "@/lib/supabase/query-parts/bpAccountStats";

// 본인 user 조회는 매 요청 발생해야 하므로 dynamic 유지.
// 단 전체 랭킹 리스트는 unstable_cache(60초)로 공유 캐시 → DB 부하 완화.
// 본인 강조 / 내 순위 카드 도출은 캐시된 리스트 위에서 user_id 매칭으로 처리한다.
// → 캐시는 전체 사용자 공통 데이터만, 본인 종속 결과는 캐시 외부에서 계산.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 누적 랭킹",
  description: "공식 경기 전적으로 매기는 계정별 누적 승수 랭킹.",
  alternates: { canonical: "/play/account-ranking" }
};

const TOP_LIMIT = 100;

export default async function AccountRankingPage({
  searchParams
}: {
  searchParams: { from?: string };
}) {
  const serverClient = createSupabaseServerClient();

  // ?from= 으로 들어온 출처에 따라 뒤로가기 목적지 결정.
  // 미지정 시 기본 /records (홈 뱃지에서 옴 → 이제 홈은 /records 로 직행이지만 안전망).
  const from = searchParams.from;
  const backHref =
    from === "stadium" ? "/stadium/lobby" : from === "records" ? "/records" : "/records";

  // 1) 캐시된 전체 정렬 랭킹 (user_id 무관 → 공유 캐시 안전)
  //    bp_account_stats 카운터 기반 — mirror row 제외된 본인 직접 플레이 전적.
  const allRanking = await getCachedFullAccountStatsRanking();

  // 2) 상위 N 슬라이스 후 닉네임 hydrate (캐시 외부, 가볍게 IN 쿼리)
  const top = allRanking.slice(0, TOP_LIMIT);
  const rankingRows: AccountRankingRow[] = await hydrateAccountStatsNicknames(top);

  // 3) 본인 user 조회 — 절대 캐시 X. 익명은 비로그인 처리.
  const { data: { user } } = await serverClient.auth.getUser();
  const isLoggedIn = Boolean(user && !user.is_anonymous);
  const myUserId = isLoggedIn ? user?.id ?? null : null;

  // 4) 본인 순위 카드: 캐시된 전체 리스트에서 본인 row 매칭으로 도출.
  //    → getMyAccountRank 의 풀스캔을 캐시 안에서 재사용 → DB 추가 호출 0.
  let myRank: MyAccountRank | null = null;
  if (myUserId) {
    const mine = allRanking.find((r) => r.ownerUserId === myUserId);
    if (mine) {
      myRank = {
        rank: mine.rank,
        wins: mine.wins,
        losses: mine.losses,
        total: mine.total,
        winRate: mine.winRate
      };
    }
  }

  return (
    <AccountRankingScreen
      ranking={rankingRows}
      myRank={myRank}
      myUserId={myUserId}
      isLoggedIn={isLoggedIn}
      backHref={backHref}
    />
  );
}
