"use client";

// 적중률 랭킹 전용 화면 — 메인 → "적중률 랭킹" 메뉴로 진입.
// PredictionRanking 컴포넌트 1개만 보여주는 얇은 래퍼.

import { AppShell } from "@/components/layout/AppShell";
import { PredictionRanking } from "@/components/domain/PredictionRanking";
import type { PredictionRankingRow } from "@/lib/supabase/query-parts/bpPredictions";

type Props = {
  currentUserId: string;
  initialRanking: PredictionRankingRow[];
};

export function RankingScreen({ currentUserId, initialRanking }: Props) {
  return (
    <AppShell activeTab="home" title="적중률 랭킹" theme="light" backHref="/">
      <PredictionRanking
        initialRows={initialRanking}
        currentUserId={currentUserId}
      />
    </AppShell>
  );
}
