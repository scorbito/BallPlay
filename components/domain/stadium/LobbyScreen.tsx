"use client";

import { AppShell } from "@/components/layout/AppShell";
import { RegisteredLineupList } from "./RegisteredLineupList";
import { StadiumLineupRankingPreview } from "./StadiumLineupRankingPreview";
import type { LineupRankingRow } from "@/lib/supabase/query-parts/bpLineupRankings";
import type { AccountStatsRankingRow } from "@/lib/supabase/query-parts/bpAccountStats";

// 경기장 메인 — 공개 매치 + 랭킹 진입점으로 단순화.
// 연습 콘텐츠(친구 매치/내 라인업/AI 대결)는 /play/practice 로 이동.

type Props = {
  topLineupRanking: LineupRankingRow[];
  topAccountRanking: AccountStatsRankingRow[];
};

export function LobbyScreen({ topLineupRanking, topAccountRanking }: Props) {
  return (
    <AppShell activeTab="stadium" title="경기장" backHref="/" theme="light" wide>
      {/* 1. 랭킹 TOP 5 — 라인업/계정 누적 탭 전환 */}
      <StadiumLineupRankingPreview
        lineupRows={topLineupRanking}
        accountRows={topAccountRanking}
      />

      {/* 2. 출전 팀 풀 — 전체 리스트 (추가 진입 불필요) */}
      <section className="stadium-lobby-section stadium-lobby-section-main">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">출전 팀</h2>
        </header>
        <RegisteredLineupList sortBy="winrate" showHeader={false} />
      </section>
    </AppShell>
  );
}
