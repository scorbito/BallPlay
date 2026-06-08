"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RegisteredLineupList } from "./RegisteredLineupList";
import { StadiumLineupRankingPreview } from "./StadiumLineupRankingPreview";
import { PlayoffHallOfFame } from "./PlayoffHallOfFame";
import type { LineupRankingRow } from "@/lib/supabase/query-parts/bpLineupRankings";
import type { AccountStatsRankingRow } from "@/lib/supabase/query-parts/bpAccountStats";
import type { PlayoffSummary } from "@/lib/supabase/query-parts/bpPlayoff";

// 경기장 메인 — 공개 매치 + 랭킹 진입점으로 단순화.
// 연습 콘텐츠(친구 매치/내 라인업/AI 대결)는 /play/practice 로 이동.

type Props = {
  topLineupRanking: LineupRankingRow[];
  topAccountRanking: AccountStatsRankingRow[];
  playoffSummary: PlayoffSummary;
};

function formatPlayoffEntryRecord(summary: PlayoffSummary): string | null {
  if (summary.totalGames > 0) {
    const champion = summary.championCount > 0 ? ` · 우승 ${summary.championCount}회` : "";
    return `${summary.wins}승 ${summary.losses}패${champion}`;
  }
  if (summary.totalChallenges > 0) {
    return `총 도전 ${summary.totalChallenges}회`;
  }
  return null;
}

export function LobbyScreen({ topLineupRanking, topAccountRanking, playoffSummary }: Props) {
  const playoffEntryRecord = formatPlayoffEntryRecord(playoffSummary);

  return (
    <AppShell activeTab="stadium" title="경기장" backHref="/" theme="light" wide>
      {/* === 가을야구(특별 이벤트) — 명예의 전당 배너 → 도전, 상단 강조 === */}
      {/* 1. 명예의 전당 — 1줄 요약 배너(전체 목록은 가을야구 페이지에서) */}
      <PlayoffHallOfFame variant="compact" />

      {/* 2. 가을야구(플레이오프) 도전 — 솔로 PvE 진입 */}
      <Link href="/stadium/playoff" className="stadium-playoff-entry" prefetch>
        <span className="stadium-playoff-entry-emoji" aria-hidden="true">🏆</span>
        <span className="stadium-playoff-entry-text">
          <strong>
            가을야구 도전
            {playoffEntryRecord ? (
              <span className="stadium-playoff-entry-record">
                {playoffEntryRecord}
              </span>
            ) : null}
          </strong>
          <span>5위에서 시작해 한국시리즈 우승까지</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </Link>

      {/* === 출전팀(상시) — 랭킹 → 리스트 묶음 === */}
      {/* 3. 출전팀 랭킹 TOP3 — 라인업/계정 누적 탭 전환 */}
      <StadiumLineupRankingPreview
        lineupRows={topLineupRanking}
        accountRows={topAccountRanking}
      />

      {/* 4. 출전 팀 풀 — 전체 리스트 (추가 진입 불필요) */}
      <section className="stadium-lobby-section stadium-lobby-section-main">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">출전 팀</h2>
        </header>
        <RegisteredLineupList sortBy="winrate" showHeader={false} />
      </section>
    </AppShell>
  );
}
