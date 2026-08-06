"use client";

// 적중률 랭킹 전용 화면 — 승리팀 예측 페이지 안의 "적중률 랭킹 보기" 링크로 진입.
// PredictionRanking 컴포넌트 1개만 보여주는 얇은 래퍼.
// 뒤로가기는 진입 출처인 승리팀 예측 페이지로.

import { AppShell } from "@/components/layout/AppShell";
import { PredictionRanking } from "@/components/domain/PredictionRanking";
import type { PredictionRankingRow } from "@/lib/supabase/query-parts/bpPredictions";
import type { HallOfFameEntry } from "@/lib/server/predict/weeklyContest";

type Props = {
  // 비로그인이면 null — 랭킹은 누구나 열람, 본인 행 하이라이트만 생략.
  currentUserId: string | null;
  weeklyRanking: PredictionRankingRow[];
  /** 예측왕 자격 기준선(이 경기 수 미만은 자격 미달로 하단 배치). */
  weeklyQualifyBar?: number;
  /** 회차가 연장된 주의 안내 문구. 평소에는 null. */
  weeklyPeriodNote?: string | null;
  seasonRanking: PredictionRankingRow[];
  /** 역대 예측왕(마감된 주) — 명예의 전당 탭. */
  hallOfFame?: HallOfFameEntry[];
};

export function RankingScreen({
  currentUserId,
  weeklyRanking,
  weeklyQualifyBar = 0,
  weeklyPeriodNote = null,
  seasonRanking,
  hallOfFame = []
}: Props) {
  return (
    <AppShell activeTab="home" title="적중률 랭킹" theme="light" backHref="/predict/winner" wide>
      <PredictionRanking
        weeklyRows={weeklyRanking}
        weeklyQualifyBar={weeklyQualifyBar}
        weeklyPeriodNote={weeklyPeriodNote}
        seasonRows={seasonRanking}
        hallOfFame={hallOfFame}
        currentUserId={currentUserId}
      />
    </AppShell>
  );
}
