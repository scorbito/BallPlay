"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Medal, Award, Trophy, ChevronRight, List } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TeamLogo } from "@/components/common/TeamLogo";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import { PublicLineupChallenge } from "@/components/domain/stadium/PublicLineupChallenge";
import { getTeam } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchPublishedLineupsByIds } from "@/lib/supabase/query-parts/bpLineups";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import type { SimTeamInput } from "@/lib/sim/types";
import type { LineupRankingRow } from "@/lib/supabase/query-parts/bpLineupRankings";
import type { AccountStatsRankingRow } from "@/lib/supabase/query-parts/bpAccountStats";

// 경기장 상단 랭킹 TOP3 위젯 — 라인업/계정 누적 탭 전환.
// 라인업: 메달 + 팀배지 + 라인업명/닉네임 + 승패 + 라인업 미리보기/도전 버튼.
// 계정 누적: 메달 + 닉네임 + 승패 (도전 X — 라인업이 아니라 사용자라).

type Tab = "lineup" | "account";

function renderRankBadge(rank: number) {
  if (rank === 1) return <Crown size={18} strokeWidth={2.2} aria-hidden />;
  if (rank === 2) return <Medal size={16} strokeWidth={2.2} aria-hidden />;
  if (rank === 3) return <Award size={14} strokeWidth={2.2} aria-hidden />;
  return rank;
}

type Props = {
  lineupRows: LineupRankingRow[];
  accountRows: AccountStatsRankingRow[];
};

export function StadiumLineupRankingPreview({ lineupRows, accountRows }: Props) {
  const [tab, setTab] = useState<Tab>("lineup");
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [previewLineupId, setPreviewLineupId] = useState<string | null>(null);
  const [challengeLineupId, setChallengeLineupId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const openLineupPreview = async (row: LineupRankingRow) => {
    if (previewLoadingId) return;
    setPreviewLoadingId(row.lineupId);
    try {
      const client = createSupabaseBrowserClient();
      const fetched = await fetchPublishedLineupsByIds(client, [row.lineupId]);
      if (!fetched.ok || fetched.rows.length === 0) return;
      const lineup = fetched.rows[0];
      const validIds = new Set(getRoster(lineup.team_id).map((p) => p.id));
      const pitching = fillMissingPitcherSlots(lineup.team_id, lineup.pitching?.slots ?? [], validIds);
      if (!pitching) return;
      const stats = buildStatsDirectory([lineup.team_id]);
      const built = buildSimTeamInput(lineup.team_id, lineup.batting, pitching, stats, lineup.name);
      if (!built.ok) return;
      setPreviewTeam(built.team);
      setPreviewLineupId(row.lineupId);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const moreHref =
    tab === "lineup" ? "/play/lineup/ranking" : "/play/account-ranking?from=stadium";

  return (
    <section className="stadium-lobby-section stadium-lobby-rank-preview">
      {/* 탭 — 라인업 / 계정 누적 (TOP5 라벨도 탭 안에 포함해 한 줄 절약) */}
      <div className="stadium-lobby-rank-tabs" role="tablist" aria-label="랭킹 종류">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "lineup"}
          className={`stadium-lobby-rank-tab ${tab === "lineup" ? "is-active" : ""}`}
          onClick={() => setTab("lineup")}
        >
          <Trophy size={14} aria-hidden />
          <span>라인업 랭킹 TOP3</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "account"}
          className={`stadium-lobby-rank-tab ${tab === "account" ? "is-active" : ""}`}
          onClick={() => setTab("account")}
        >
          <Trophy size={14} aria-hidden />
          <span>계정 누적 랭킹 TOP3</span>
        </button>
      </div>

      {tab === "lineup" ? (
        lineupRows.length === 0 ? (
          <div className="stadium-lobby-rank-preview-empty">
            <p>아직 집계된 공식 경기가 없어요.</p>
            <p className="stadium-lobby-rank-preview-empty-sub">
              공식 경기를 진행하면 팀이 랭킹에 등록됩니다.
            </p>
          </div>
        ) : (
          <ol className="stadium-lobby-rank-preview-list">
            {lineupRows.slice(0, 3).map((row) => {
              const team = row.teamId ? getTeam(row.teamId) : null;
              const isLoading = previewLoadingId === row.lineupId;
              return (
                <li key={`${row.lineupId}-${row.ownerUserId}`} className="stadium-lobby-rank-preview-item">
                  <span
                    className={`stadium-lobby-rank-preview-pos ${row.rank <= 3 ? `is-top is-top-${row.rank}` : ""}`}
                    aria-label={`${row.rank}위`}
                  >
                    {renderRankBadge(row.rank)}
                  </span>
                  {team ? (
                    row.rank <= 3 ? <TeamLogo teamId={team.id} size="sm" /> : <TeamBadge teamId={team.id} size="sm" />
                  ) : null}
                  <div className="stadium-lobby-rank-preview-body">
                    <span className="stadium-lobby-rank-preview-name">{row.lineupName}</span>
                    <span className="stadium-lobby-rank-preview-nick">{row.nickname}</span>
                  </div>
                  <div className="stadium-lobby-rank-preview-stats">
                    <span className="stadium-lobby-rank-preview-wl">
                      <strong>{row.wins}</strong>승 {row.losses}패
                    </span>
                  </div>
                  <button
                    type="button"
                    className="stadium-lobby-rank-preview-btn"
                    onClick={() => openLineupPreview(row)}
                    disabled={isLoading}
                    aria-label={`${row.lineupName} 라인업 보기`}
                  >
                    <List size={12} aria-hidden />
                    <span>라인업</span>
                  </button>
                </li>
              );
            })}
            <li className="stadium-lobby-rank-preview-more">
              <Link href={moreHref} className="stadium-lobby-rank-preview-more-link" prefetch>
                <span>라인업 랭킹 전체 보기</span>
                <ChevronRight size={16} />
              </Link>
            </li>
          </ol>
        )
      ) : accountRows.length === 0 ? (
        <div className="stadium-lobby-rank-preview-empty">
          <p>아직 집계된 공식 경기가 없어요.</p>
          <p className="stadium-lobby-rank-preview-empty-sub">
            공식 경기를 진행하면 계정 전적이 누적됩니다.
          </p>
        </div>
      ) : (
        <ol className="stadium-lobby-rank-preview-list">
          {accountRows.slice(0, 3).map((row) => (
            <li key={row.ownerUserId} className="stadium-lobby-rank-preview-item">
              <span
                className={`stadium-lobby-rank-preview-pos ${row.rank <= 3 ? `is-top is-top-${row.rank}` : ""}`}
                aria-label={`${row.rank}위`}
              >
                {renderRankBadge(row.rank)}
              </span>
              <AccountTierBadge wins={row.wins} size={24} />
              <div className="stadium-lobby-rank-preview-body">
                <span className="stadium-lobby-rank-preview-name">{row.nickname}</span>
              </div>
              <div className="stadium-lobby-rank-preview-stats">
                <span className="stadium-lobby-rank-preview-wl">
                  <strong>{row.wins}</strong>승 {row.losses}패
                </span>
              </div>
            </li>
          ))}
          <li className="stadium-lobby-rank-preview-more">
            <Link href={moreHref} className="stadium-lobby-rank-preview-more-link" prefetch>
              <span>계정 누적 랭킹 전체 보기</span>
              <ChevronRight size={16} />
            </Link>
          </li>
        </ol>
      )}

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => {
          setPreviewTeam(null);
          setPreviewLineupId(null);
        }}
        onChallenge={previewLineupId ? () => setChallengeLineupId(previewLineupId) : undefined}
      />

      <PublicLineupChallenge
        opponentLineupId={challengeLineupId}
        onClose={() => setChallengeLineupId(null)}
      />
    </section>
  );
}
