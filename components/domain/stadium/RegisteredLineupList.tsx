"use client";

// 공개 라인업 목록 — 경기장 메인/전체보기 둘 다 사용.
// 메인(6개): 승률 정렬 (표본 5경기 가중). 본인 카드 제외 (도전 대상만).
// 전체보기: 최신순. includeMine=true면 본인 공개 카드도 표시 (도전 불가).
//
// 도전: 본인 공개 라인업이 있어야 가능. picker에 본인 공개 슬롯만 표시.
// 본인 vs 본인은 차단 (RegisteredLineupList 호출 측에서 본인 카드 제외).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, List, LogIn, RefreshCw, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchPublishedLineupsByIds,
  listPublishedByRecent,
  listPublishedByWinrate,
  type LineupStats,
  type PublishedLineupRow
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

function formatOwnerLabel(row: PublishedLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명";
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
  showHeader?: boolean;
  /** 본인 카드도 표시할지. true면 본인 카드는 도전 불가 (라벨로 표시). */
  includeMine?: boolean;
};

export function RegisteredLineupList({
  maxItems = 50,
  sortBy,
  showHeader = true,
  includeMine = false
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PublishedLineupRow[] | null>(null);
  const [statsByLineupId, setStatsByLineupId] = useState<Record<string, LineupStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerIdForExclude, setOwnerIdForExclude] = useState<string | null>(null);
  const [myPublishedEntries, setMyPublishedEntries] = useState<LineupEntry[]>([]);

  const [selectedOpponent, setSelectedOpponent] = useState<PublishedLineupRow | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [loginGateOpen, setLoginGateOpen] = useState(false);
  const [needPublishGateOpen, setNeedPublishGateOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  const loadList = useCallback(
    async (excludeUid: string | null) => {
      const client = createSupabaseBrowserClient();
      setLoading(true);
      setError(null);
      const filterUid = includeMine ? null : excludeUid;
      if (sortBy === "winrate") {
        const sorted = await listPublishedByWinrate(client, maxItems);
        if (!sorted.ok) {
          setLoading(false);
          setError(sorted.error);
          return;
        }
        const fetched = await fetchPublishedLineupsByIds(client, sorted.lineupIds);
        setLoading(false);
        if (!fetched.ok) {
          setError(fetched.error);
          return;
        }
        const filtered = filterUid
          ? fetched.rows.filter((r) => r.owner_user_id !== filterUid)
          : fetched.rows;
        setRows(filtered);
        setStatsByLineupId(sorted.statsByLineupId);
      } else {
        const res = await listPublishedByRecent(client, maxItems, filterUid);
        setLoading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRows(res.rows);
        setStatsByLineupId(res.statsByLineupId);
      }
    },
    [sortBy, maxItems, includeMine]
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

      // 본인의 공개 라인업만 picker에 노출 — 공개 라인업만 다른 공개 라인업과 매치 가능.
      const allLocal = loadLineupEntries();
      const myPublished = allLocal.filter(
        (e) => e.batting.slots.length === 9 && e.isPublished === true
      );
      setMyPublishedEntries(myPublished);
      if (myPublished.length > 0) setMyEntryId(myPublished[0].entryId);

      await loadList(anyUid);
    })();
  }, [loadList]);

  const refresh = useCallback(async () => {
    await loadList(ownerIdForExclude);
  }, [loadList, ownerIdForExclude]);

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
    () => myPublishedEntries.find((e) => e.entryId === myEntryId) ?? null,
    [myPublishedEntries, myEntryId]
  );

  // 공개 라인업 미리보기 → SimTeamInput으로 변환
  const openLineupPreview = (row: PublishedLineupRow) => {
    const pitching = row.pitching ?? autoFillPitcherLineup(row.team_id);
    if (!pitching) return;
    const stats = buildStatsDirectory([row.team_id]);
    const built = buildSimTeamInput(row.team_id, row.batting, pitching, stats, row.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  // 도전 클릭 — 본인 공개 라인업 보유 여부 검증
  const handleChallenge = (row: PublishedLineupRow) => {
    if (!userId) {
      setLoginGateOpen(true);
      return;
    }
    if (myPublishedEntries.length === 0) {
      setNeedPublishGateOpen(true);
      return;
    }
    setSelectedOpponent(row);
  };

  // 본인의 공개 라인업 row 찾기 (myEntry의 entry_id → bp_lineups.id)
  // — 매치 시작 시 myLineupId로 세팅 (전적 누적).
  // 본인 공개 라인업 row id는 별도로 lookup 필요. listMyLineups를 다시 호출하기보단
  // picker entry_id → bp_lineups.id를 미리 매핑해두는 게 효율적. 여기선 매치 시작 시 1회 조회.
  const startChallenge = useCallback(async () => {
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

    // 본인 공개 라인업의 bp_lineups.id lookup
    const client = createSupabaseBrowserClient();
    const myRow = await client
      .from("bp_lineups")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("entry_id", myEntry.entryId)
      .maybeSingle();
    const myLineupId = (myRow.data as { id: string } | null)?.id ?? null;

    const seed = generateSeed();
    saveMatchSession({
      myTeamId: myEntry.teamId,
      opponentTeamId: selectedOpponent.team_id,
      seed,
      input: { home: mine.team, away: opp.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "public",
      userSide: "home",
      myLineupId: myLineupId ?? undefined,
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
        <strong>아직 공개된 라인업이 없어요</strong>
        <p>라인업 짜기에서 9명 채운 뒤 &lsquo;공개하기&rsquo;를 눌러보세요.</p>
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
                  <span className="stadium-mine-tag" aria-label="내 공개 라인업">내 라인업</span>
                ) : (
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                    onClick={() => handleChallenge(row)}
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

      {/* 도전 모달 — 본인 공개 라인업 picker */}
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
                    <span className="stadium-enter-empty">공개 라인업이 없음</span>
                  )}
                </div>
              </div>

              {myPublishedEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 공개 라인업 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myPublishedEntries.map((entry) => (
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

      {/* 로그인 게이트 */}
      <ModalShell
        open={loginGateOpen}
        title="로그인이 필요해요"
        onClose={() => setLoginGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            공개 라인업과 대결하려면 로그인이 필요해요.<br />
            로그인하면 내 라인업도 공개해서 전적을 쌓을 수 있어요.
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

      {/* 본인이 공개 라인업이 없을 때 안내 */}
      <ModalShell
        open={needPublishGateOpen}
        title="공개 라인업이 필요해요"
        onClose={() => setNeedPublishGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            다른 공개 라인업과 도전하려면 본인도 공개 라인업이 있어야 해요.<br />
            라인업 짜기에서 9명을 채운 뒤 &lsquo;공개하기&rsquo;를 눌러주세요.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setNeedPublishGateOpen(false)}
            >
              닫기
            </button>
            <Link href="/play" className="lineup-confirm-primary" prefetch>
              라인업 짜기
            </Link>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
