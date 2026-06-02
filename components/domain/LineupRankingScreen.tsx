"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, Crown, Medal, Award, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import { getTeam, teams } from "@/lib/constants/teams";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchPublishedLineupsByIds } from "@/lib/supabase/query-parts/bpLineups";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import type { SimTeamInput } from "@/lib/sim/types";
import type { LineupRankingRow } from "@/lib/supabase/query-parts/bpLineupRankings";

type Props = {
  seasonRanking: LineupRankingRow[];
  weeklyRanking: LineupRankingRow[];
};

type Tab = "season" | "weekly";

function formatRate(rate: number): string {
  // 0.857 형식, 단 정수형 .000 처리
  return rate.toFixed(3).replace(/^0/, "");
}

// 상위 3위는 아이콘만, 4위부터는 숫자.
function renderRankBadge(rank: number) {
  if (rank === 1) return <Crown size={22} strokeWidth={2.2} aria-hidden />;
  if (rank === 2) return <Medal size={20} strokeWidth={2.2} aria-hidden />;
  if (rank === 3) return <Award size={18} strokeWidth={2.2} aria-hidden />;
  return rank;
}

export function LineupRankingScreen({ seasonRanking, weeklyRanking }: Props) {
  const [tab, setTab] = useState<Tab>("season");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const ddRef = useRef<HTMLDivElement | null>(null);
  const rows = tab === "season" ? seasonRanking : weeklyRanking;
  // 팀 필터 — 클라이언트 사이드 필터. 랭크 숫자는 전체 기준으로 유지(재계산 X).
  const filteredRows = teamFilter ? rows.filter((r) => r.teamId === teamFilter) : rows;

  // 드롭다운 외부 클릭 + Escape 키로 닫기
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ddRef.current) return;
      if (!ddRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  const selectedTeam = teamFilter ? getTeam(teamFilter) : null;
  const currentLabel = selectedTeam ? selectedTeam.shortName : "팀 전체";

  // 라인업 미리보기 — bp_lineups row 1건 조회 → SimTeamInput으로 변환 후 모달 오픈.
  // baseline 스탯 사용(DB 스냅샷 X) — 라인업 구성 미리보기 용도라 충분.
  const openLineupPreview = async (row: LineupRankingRow) => {
    if (previewLoadingId) return;
    setPreviewLoadingId(row.lineupId);
    try {
      const client = createSupabaseBrowserClient();
      const fetched = await fetchPublishedLineupsByIds(client, [row.lineupId]);
      if (!fetched.ok || fetched.rows.length === 0) return;
      const lineup = fetched.rows[0];
      const pitching = fillMissingPitcherSlots(lineup.team_id, lineup.pitching?.slots ?? []);
      if (!pitching) return;
      const stats = buildStatsDirectory([lineup.team_id]);
      const built = buildSimTeamInput(lineup.team_id, lineup.batting, pitching, stats, lineup.name);
      if (!built.ok) return;
      setPreviewTeam(built.team);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <AppShell activeTab="play" title="라인업 랭킹" theme="light" backHref="/" wide>
      {/* 탭 */}
      <div className="lineup-rank-tabs" role="tablist" aria-label="랭킹 기간">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "season"}
          className={`lineup-rank-tab ${tab === "season" ? "is-active" : ""}`}
          onClick={() => setTab("season")}
        >
          시즌
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "weekly"}
          className={`lineup-rank-tab ${tab === "weekly" ? "is-active" : ""}`}
          onClick={() => setTab("weekly")}
        >
          이번 주
        </button>
      </div>

      {/* 안내 + 팀 필터 드롭다운 — 한 줄. 좌: 안내 텍스트, 우: 드롭다운 */}
      <div className="lineup-rank-hint-row">
        <p className="lineup-rank-hint">
          {tab === "season"
            ? "공개 매치에서 누적된 라인업 전적 순위입니다."
            : "이번 주(월요일 ~ 일요일) 공개 매치 전적 순위입니다."}
        </p>
        <div className="lineup-rank-team-dropdown" ref={ddRef}>
          <button
            type="button"
            className="lineup-rank-team-dropdown-btn"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {selectedTeam ? <TeamBadge teamId={selectedTeam.id} size="sm" /> : null}
            <span>{currentLabel}</span>
            <ChevronDown size={14} aria-hidden />
          </button>
          {dropdownOpen ? (
            <div className="lineup-rank-team-dropdown-menu" role="listbox" aria-label="팀 필터">
              <button
                type="button"
                role="option"
                aria-selected={teamFilter === null}
                className={`lineup-rank-team-dropdown-item ${teamFilter === null ? "is-active" : ""}`}
                onClick={() => {
                  setTeamFilter(null);
                  setDropdownOpen(false);
                }}
              >
                <span>전체</span>
              </button>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={teamFilter === t.id}
                  className={`lineup-rank-team-dropdown-item ${teamFilter === t.id ? "is-active" : ""}`}
                  onClick={() => {
                    setTeamFilter(t.id);
                    setDropdownOpen(false);
                  }}
                  title={t.name}
                >
                  <TeamBadge teamId={t.id} size="sm" />
                  <span>{t.shortName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 목록 */}
      {rows.length === 0 ? (
        <div className="lineup-rank-empty">
          <Trophy size={28} aria-hidden />
          <p>
            {tab === "season"
              ? "아직 집계된 공개 매치가 없어요."
              : "이번 주 집계된 공개 매치가 없어요."}
          </p>
          <p className="lineup-rank-empty-sub">
            경기장에서 공개 매치를 진행하면 라인업이 랭킹에 등록됩니다.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="lineup-rank-empty lineup-rank-empty-team">
          <p>이 팀 라인업이 아직 랭킹에 없어요</p>
        </div>
      ) : (
        <ol className="lineup-rank-list">
          {filteredRows.map((row) => {
            const team = row.teamId ? getTeam(row.teamId) : null;
            const isLoading = previewLoadingId === row.lineupId;
            return (
              <li
                key={`${row.lineupId}-${row.ownerUserId}`}
                className={`lineup-rank-item ${isLoading ? "is-loading" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`라인업 보기 - ${row.lineupName}`}
                onClick={() => openLineupPreview(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLineupPreview(row);
                  }
                }}
              >
                <span
                  className={`lineup-rank-position ${
                    row.rank <= 3 ? `is-top is-top-${row.rank}` : ""
                  }`}
                  aria-label={`${row.rank}위`}
                >
                  {renderRankBadge(row.rank)}
                </span>
                {team ? <TeamBadge teamId={team.id} size="md" /> : null}
                <div className="lineup-rank-body">
                  <span className="lineup-rank-lineup-name">{row.lineupName}</span>
                  <span className="lineup-rank-nickname">{row.nickname}</span>
                </div>
                <div className="lineup-rank-stats">
                  <span className="lineup-rank-wl">
                    <strong>{row.wins}</strong>승 {row.losses}패
                  </span>
                  <span className="lineup-rank-rate">({formatRate(row.winRate)})</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
    </AppShell>
  );
}
