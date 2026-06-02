import type { Metadata } from "next";
import { AccountRankingScreen } from "@/components/domain/AccountRankingScreen";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMyAccountRank,
  listSeasonAccountRanking,
  type AccountRankingRow,
  type MyAccountRank
} from "@/lib/supabase/query-parts/bpAccountRanking";

// 공개 매치 결과가 누적되는 동안 자주 갱신 → ISR 5분.
// 본인 user 조회 + getMyAccountRank 호출은 매 요청마다 발생해야 하므로 dynamic 처리도 함께 필요.
// → 단순하게 force-dynamic. 라인업 랭킹과 달리 본인행 강조가 핵심이라 캐싱 X.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 누적 랭킹",
  description: "공개 매치 전적으로 매기는 계정별 누적 승수 랭킹.",
  alternates: { canonical: "/play/account-ranking" }
};

export default async function AccountRankingPage() {
  const adminClient = createSupabaseAdminClient();
  const serverClient = createSupabaseServerClient();

  // 본인 user — 익명(`is_anonymous`)은 비로그인 처리. 정식 로그인만 본인 행 강조 + 내 순위 카드.
  const { data: { user } } = await serverClient.auth.getUser();
  const isLoggedIn = Boolean(user && !user.is_anonymous);
  const myUserId = isLoggedIn ? user?.id ?? null : null;

  const rankingRes = await listSeasonAccountRanking(adminClient, 100);
  const rankingRows: AccountRankingRow[] = rankingRes.ok ? rankingRes.rows : [];

  let myRank: MyAccountRank | null = null;
  if (myUserId) {
    const myRes = await getMyAccountRank(adminClient, myUserId);
    if (myRes.ok) myRank = myRes.data;
  }

  return (
    <AccountRankingScreen
      ranking={rankingRows}
      myRank={myRank}
      myUserId={myUserId}
      isLoggedIn={isLoggedIn}
    />
  );
}
