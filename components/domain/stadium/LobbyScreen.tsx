"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RegisteredLineupList } from "./RegisteredLineupList";
import { StadiumLineupRankingPreview } from "./StadiumLineupRankingPreview";
import { PlayoffHallOfFame } from "./PlayoffHallOfFame";
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
      {/* === 가을야구(특별 이벤트) — 명예의 전당 → 도전, 상단 강조 === */}
      {/* 1. 명예의 전당 — 전체 유저 공개 우승자 */}
      <PlayoffHallOfFame />

      {/* 2. 가을야구(플레이오프) 도전 — 솔로 PvE 진입 */}
      <Link href="/stadium/playoff" className="stadium-playoff-entry" prefetch>
        <span className="stadium-playoff-entry-emoji" aria-hidden="true">🏆</span>
        <span className="stadium-playoff-entry-text">
          <strong>가을야구 도전</strong>
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
