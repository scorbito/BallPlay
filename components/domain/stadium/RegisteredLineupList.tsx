"use client";

// 등록된 라인업 목록 — 경기장 메인/전체보기 둘 다 사용.
// 메인(6개): 승률 정렬 (표본 5경기 가중)
// 전체보기: 최신순
// 카드 표시: 라인업명·팀배지·닉네임·설명·전적(W-L)
// 도전: 본인 슬롯(LineupEntry) picker → opponentLineupId 세팅 후 매치 시작

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, List, LogIn, RefreshCw, Swords, Trash2 } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteRegisteredLineup,
  fetchLineupStatsBulk,
  fetchRegisteredLineupsByIds,
  listRegisteredByRecent,
  listRegisteredByWinrate,
  type LineupStats,
  type RegisteredLineupRow
} from "@/lib/supabase/query-parts/bpLineups";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { PITCHER_SLOTS_COUNT, type LineupEntry, type SavedPitcherLineup } from "@/lib/types/lineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory, getTeamStats } from "@/lib/sim/statsLoader";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

function autoFillPitcherLineup(teamId: string): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;
  const sorted = [...stats.pitchers].sort((a, b) => b.staminaPitches - a.staminaPitches);
  const slots: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  for (let i = 0; i < PITCHER_SLOTS_COUNT && i < sorted.length; i++) {
    slots[i] = sorted[i].playerId;
  }
  return { teamId, slots, updatedAt: new Date().toISOString() };
}

function formatOwnerLabel(row: RegisteredLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명 등록자";
}

function formatRecord(stats: LineupStats | undefined): string {
  if (!stats || stats.matches === 0) return "전적 없음";
  const winPct = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const drawTxt = stats.draws > 0 ? `-${stats.draws}D` : "";
  return `${stats.wins}승 ${stats.losses}패${drawTxt} (${winPct}%)`;
}

type Props = {
  maxItems?: number;
  /** "winrate": 승률 정렬 (메인). "recent": 최신순 (전체보기). */
  sortBy: "winrate" | "recent";
  /** 헤더 (새로고침 버튼) 렌더 여부. 기본 true. */
  showHeader?: boolean;
};

export function RegisteredLineupList({
  maxItems = 50,
  sortBy,
  showHeader = true
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RegisteredLineupRow[] | null>(null);
  const [statsByLineupId, setStatsByLineupId] = useState<Record<string, LineupStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerIdForExclude, setOwnerIdForExclude] = useState<string | null>(null);
  const [myEntries, setMyEntries] = useState<LineupEntry[]>([]);

  const [selectedOpponent, setSelectedOpponent] = useState<RegisteredLineupRow | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [loginGateOpen, setLoginGateOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadList = useCallback(
    async (excludeUid: string | null) => {
      const client = createSupabaseBrowserClient();
      setLoading(true);
      setError(null);
      if (sortBy === "winrate") {
        // RPC로 정렬된 lineup_id 목록 + stats 받고, 카드 데이터는 별도 fetch
        const sorted = await listRegisteredByWinrate(client, maxItems);
        if (!sorted.ok) {
          setLoading(false);
          setError(sorted.error);
          return;
        }
        const fetched = await fetchRegisteredLineupsByIds(client, sorted.lineupIds);
        setLoading(false);
        if (!fetched.ok) {
          setError(fetched.error);
          return;
        }
        // 본인 라인업 제외 — 도전 대상 아님
        const filtered = excludeUid
          ? fetched.rows.filter((r) => r.owner_user_id !== excludeUid)
          : fetched.rows;
        setRows(filtered);
        setStatsByLineupId(sorted.statsByLineupId);
      } else {
        const res = await listRegisteredByRecent(client, maxItems, excludeUid);
        setLoading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRows(res.rows);
        setStatsByLineupId(res.statsByLineupId);
      }
    },
    [sortBy, maxItems]
  );

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void (async () => {
      const { data: authData } = await client.auth.getUser();
      const user = authData.user;
      const realUid = user && !user.is_anonymous ? user.id : null;
      const anyUid = user?.id ?? null;
      setUserId(realUid);
      setOwnerIdForExclude(anyUid);

      const allLocalEntries = loadLineupEntries();
      const ready = allLocalEntries.filter((e) => e.batting.slots.length === 9);
      setMyEntries(ready);
      if (ready.length > 0) setMyEntryId(ready[0].entryId);

      await loadList(anyUid);
    })();
  }, [loadList]);

  const refresh = useCallback(async () => {
    await loadList(ownerIdForExclude);
  }, [loadList, ownerIdForExclude]);

  // 모바일: 백그라운드 복귀 시 재조회
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const myEntry = useMemo(
    () => myEntries.find((e) => e.entryId === myEntryId) ?? null,
    [myEntries, myEntryId]
  );

  // 등록 카드 미리보기 — SimTeamInput으로 변환
  const openLineupPreview = (row: RegisteredLineupRow) => {
    const pitching = row.pitching ?? autoFillPitcherLineup(row.team_id);
    if (!pitching) return;
    const stats = buildStatsDirectory([row.team_id]);
    const built = buildSimTeamInput(row.team_id, row.batting, pitching, stats, row.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  // 본인 등록 카드 삭제
  const handleDelete = async (row: RegisteredLineupRow) => {
    if (deletingId) return;
    if (!confirm(`"${row.name}" 등록을 삭제할까요?\n전적은 사라집니다.`)) return;
    setDeletingId(row.id);
    const client = createSupabaseBrowserClient();
    const res = await deleteRegisteredLineup(client, row.id);
    setDeletingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refresh();
  };

  const startChallenge = useCallback(() => {
    if (!selectedOpponent || !myEntry || starting) return;
    if (!userId) {
      setSelectedOpponent(null);
      setLoginGateOpen(true);
      return;
    }
    setStarting(true);
    setError(null);

    const opponentPitching = selectedOpponent.pitching ?? autoFillPitcherLineup(selectedOpponent.team_id);
    const myPitching = myEntry.pitching ?? autoFillPitcherLineup(myEntry.teamId);

    if (!opponentPitching || !myPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const stats = buildStatsDirectory([myEntry.teamId, selectedOpponent.team_id]);
    const mine = buildSimTeamInput(myEntry.teamId, myEntry.batting, myPitching, stats, myEntry.name);
    if (!mine.ok) {
      setStarting(false);
      setError(`내 라인업 변환 실패 (${mine.issues.map((i) => i.kind).join(", ")})`);
      return;
    }
    const opp = buildSimTeamInput(
      selectedOpponent.team_id,
      selectedOpponent.batting,
      opponentPitching,
      stats,
      selectedOpponent.name
    );
    if (!opp.ok) {
      setStarting(false);
      setError(`상대 라인업 변환 실패 (${opp.issues.map((i) => i.kind).join(", ")})`);
      return;
    }

    const seed = generateSeed();
    saveMatchSession({
      myTeamId: myEntry.teamId,
      opponentTeamId: selectedOpponent.team_id,
      seed,
      input: { home: mine.team, away: opp.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "public",
      userSide: "home",
      // 상대는 등록 카드라 lineup_id 채움. 본인 슬롯은 등록 카드 아니므로 null.
      // (본인 등록 카드로 도전하는 흐름은 추후 확장)
      opponentLineupId: selectedOpponent.id
    });
    router.push("/stadium/play");
  }, [selectedOpponent, myEntry, starting, router, userId]);

  if (loading && rows === null) {
    return <p className="stadium-loading">불러오는 중...</p>;
  }
  if (rows === null) {
    return error ? <p className="stadium-error">{error}</p> : null;
  }
  if (rows.length === 0) {
    return (
      <section className="stadium-discover-empty">
        <strong>아직 등록된 라인업이 없어요</strong>
        <p>라인업 짜기에서 9명 채운 뒤 &lsquo;경기장에 등록&rsquo;을 눌러보세요.</p>
      </section>
    );
  }

  return (
    <>
      {showHeader ? (
        <div className="stadium-discover-actions">
          <button type="button" className="stadium-discover-refresh" onClick={refresh} disabled={loading}>
            <RefreshCw size={12} className={loading ? "stadium-discover-spin" : ""} />
            새로고침
          </button>
        </div>
      ) : null}

      {error ? <p className="stadium-error">{error}</p> : null}

      <section className="stadium-discover-list">
        {rows.map((row) => {
          const team = getTeam(row.team_id);
          const isMine = row.owner_user_id === ownerIdForExclude;
          const stats = statsByLineupId[row.id];
          return (
            <div key={row.id} className="stadium-discover-card stadium-registered-card">
              <TeamBadge teamId={row.team_id} size="md" />
              <div className="stadium-discover-card-body">
                <strong>{row.name}</strong>
                <span className="stadium-registered-meta">
                  {formatOwnerLabel(row)} · {team.shortName} · <span className="stadium-registered-record">{formatRecord(stats)}</span>
                </span>
                {row.description ? (
                  <span className="stadium-registered-desc">{row.description}</span>
                ) : null}
              </div>
              <div className="stadium-lobby-card-actions">
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-secondary"
                  onClick={() => openLineupPreview(row)}
                  aria-label={`${row.name} 라인업 보기`}
                >
                  <List size={14} />
                  <span>라인업</span>
                </button>
                {isMine ? (
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-danger"
                    onClick={() => handleDelete(row)}
                    disabled={deletingId === row.id}
                    aria-label={`${row.name} 등록 삭제`}
                  >
                    <Trash2 size={14} />
                    <span>삭제</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                    onClick={() => {
                      if (!userId) {
                        setLoginGateOpen(true);
                        return;
                      }
                      setSelectedOpponent(row);
                    }}
                    aria-label={`${row.name}에 도전`}
                  >
                    <Swords size={14} />
                    <span>도전</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />

      <ModalShell
        open={selectedOpponent !== null}
        title="도전 시작"
        onClose={() => setSelectedOpponent(null)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {selectedOpponent ? (
            <>
              <div className="stadium-discover-vs">
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">상대</span>
                  <TeamBadge teamId={selectedOpponent.team_id} size="lg" />
                  <strong>{selectedOpponent.name}</strong>
                  <span className="stadium-discover-vs-owner">{formatOwnerLabel(selectedOpponent)}</span>
                </div>
                <span className="stadium-discover-vs-divider">VS</span>
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">내 팀</span>
                  {myEntry ? (
                    <>
                      <TeamBadge teamId={myEntry.teamId} size="lg" />
                      <strong>{myEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">완성된 라인업이 없음</span>
                  )}
                </div>
              </div>

              {myEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 라인업 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myEntries.map((entry) => (
                      <button
                        key={entry.entryId}
                        type="button"
                        className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                        onClick={() => setMyEntryId(entry.entryId)}
                      >
                        <TeamBadge teamId={entry.teamId} size="sm" />
                        <span>{entry.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {myEntries.length === 0 ? (
                <p className="stadium-error">
                  9명을 채운 라인업이 없어요. 라인업 짜기에서 먼저 완성해주세요.
                </p>
              ) : null}

              <button
                type="button"
                className="stadium-cta-primary"
                disabled={!myEntry || starting}
                onClick={startChallenge}
              >
                <Swords size={16} />
                <span>{starting ? "시작 중..." : "도전 시작"}</span>
                <ArrowRight size={16} />
              </button>
            </>
          ) : null}
        </div>
      </ModalShell>

      <ModalShell
        open={loginGateOpen}
        title="로그인이 필요해요"
        onClose={() => setLoginGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            등록 라인업과 대결하려면 로그인이 필요해요.<br />
            로그인하면 내 라인업도 경기장에 등록할 수 있어요.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setLoginGateOpen(false)}
            >
              나중에
            </button>
            <Link href="/login" className="lineup-confirm-primary" prefetch>
              <LogIn size={14} />
              로그인
            </Link>
          </div>
        </div>
      </ModalShell>
    </>
  );
}

/** 단순 fallback — RegisteredLineupList의 stats가 비어 있을 때 별도 fetch (선택). */
export async function fetchStatsForRows(rows: RegisteredLineupRow[]): Promise<Record<string, LineupStats>> {
  const client = createSupabaseBrowserClient();
  return fetchLineupStatsBulk(client, rows.map((r) => r.id));
}
