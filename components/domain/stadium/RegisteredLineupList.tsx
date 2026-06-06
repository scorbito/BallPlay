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
import { ArrowRight, List, RefreshCw, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TeamLogo } from "@/components/common/TeamLogo";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import {
  fetchLineupStatsBulk,
  fetchPublishedLineupsByIds,
  listMyLineups,
  listPublishedByRecent,
  listPublishedByWinrate,
  type LineupStats,
  type PublishedLineupRow
} from "@/lib/supabase/query-parts/bpLineups";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import type { LineupEntry } from "@/lib/types/lineup";
import { getRoster } from "@/lib/rosters";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

function formatOwnerLabel(row: PublishedLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명";
}

function formatRecord(stats: LineupStats | undefined): string {
  if (!stats || stats.matches === 0) return "전적 없음";
  return `${stats.wins}승 ${stats.losses}패`;
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
  // 도전 picker — 본인 공개 라인업의 entry_id → 전적. 표시용.
  const [myStatsByEntryId, setMyStatsByEntryId] = useState<Record<string, LineupStats>>({});

  const [selectedOpponent, setSelectedOpponent] = useState<PublishedLineupRow | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [needPublishGateOpen, setNeedPublishGateOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  const loadList = useCallback(
    async (excludeUid: string | null) => {
      const client = createSupabaseBrowserClient();
      setLoading(true);
      setError(null);
      const filterUid = includeMine ? null : excludeUid;
      if (sortBy === "winrate") {
        // 본인 카드가 winrate top 안에 들어있으면 사후 필터로 결과가 줄어드는 버그 방지.
        // 유저당 공개 라인업 최대 10개라 +12 over-fetch 후 본인 제외 → maxItems slice.
        const overfetch = filterUid ? maxItems + 12 : maxItems;
        const sorted = await listPublishedByWinrate(client, overfetch);
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
        const filtered = (filterUid
          ? fetched.rows.filter((r) => r.owner_user_id !== filterUid)
          : fetched.rows
        ).slice(0, maxItems);
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
      // 익명도 본인 row 보유 가능하도록 변경 → realUid 분리 폐지, user.id 그대로 사용
      const anyUid = user?.id ?? null;
      setUserId(anyUid);
      setOwnerIdForExclude(anyUid);

      // 본인의 공개 라인업만 picker에 노출 — 공개 라인업만 다른 공개 라인업과 매치 가능.
      const allLocal = loadLineupEntries();
      const myPublished = allLocal.filter(
        (e) => e.batting.slots.length === 9 && e.isPublished === true
      );
      setMyPublishedEntries(myPublished);
      if (myPublished.length > 0) setMyEntryId(myPublished[0].entryId);

      // 본인 공개 라인업 전적 — picker 라벨에 표시. entry_id → bp_lineups.id 매핑 후 stats fetch.
      if (anyUid && myPublished.length > 0) {
        const myLineupsRes = await listMyLineups(client, anyUid);
        if (myLineupsRes.ok) {
          const idByEntry: Record<string, string> = {};
          for (const row of myLineupsRes.rows) {
            if (row.is_published) idByEntry[row.entry_id] = row.id;
          }
          const ids = Object.values(idByEntry);
          if (ids.length > 0) {
            const statsByLineupId = await fetchLineupStatsBulk(client, ids);
            const statsByEntry: Record<string, LineupStats> = {};
            for (const [entryId, lineupId] of Object.entries(idByEntry)) {
              const s = statsByLineupId[lineupId];
              if (s) statsByEntry[entryId] = s;
            }
            setMyStatsByEntryId(statsByEntry);
          }
        }
      }

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
    const validIds = new Set(getRoster(row.team_id).map((p) => p.id));
    const pitching = fillMissingPitcherSlots(row.team_id, row.pitching?.slots ?? [], validIds);
    if (!pitching) return;
    const stats = buildStatsDirectory([row.team_id]);
    const built = buildSimTeamInput(row.team_id, row.batting, pitching, stats, row.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  // 도전 클릭 — 본인 공개 라인업 보유 여부만 검증.
  // 익명 사용자도 도전 가능 (2026-06-04). 실제 익명 세션 lazy 생성은 startChallenge에서.
  const handleChallenge = (row: PublishedLineupRow) => {
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
    setStarting(true);
    setError(null);

    // DB 스냅샷 기반 시즌+최근 폼 블렌드. fetch 실패 시 baseline 폴백.
    const client = createSupabaseBrowserClient();
    // 익명 사용자도 도전 가능 — 세션 없으면 lazy 익명 계정 생성 (2026-06-04).
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      effectiveUserId = await ensureAnonymousClient(client);
      if (effectiveUserId) setUserId(effectiveUserId);
    }
    if (!effectiveUserId) {
      // 안전 폴백 — 익명 생성도 실패한 경우만 도달 (네트워크/RLS 이슈).
      setStarting(false);
      setError("계정 준비에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const opponentValidIds = new Set(getRoster(selectedOpponent.team_id).map((p) => p.id));
    const myValidIds = new Set(getRoster(myEntry.teamId).map((p) => p.id));
    const opponentPitching = fillMissingPitcherSlots(
      selectedOpponent.team_id,
      selectedOpponent.pitching?.slots ?? [],
      opponentValidIds
    );
    const myPitching = fillMissingPitcherSlots(
      myEntry.teamId,
      myEntry.pitching?.slots ?? [],
      myValidIds
    );

    if (!opponentPitching || !myPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const stats = await buildStatsDirectoryWithRecentForm(client, [myEntry.teamId, selectedOpponent.team_id]);
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
    const myRow = await client
      .from("bp_lineups")
      .select("id")
      .eq("owner_user_id", effectiveUserId)
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
      opponentLineupId: selectedOpponent.id,
      opponentNickname: formatOwnerLabel(selectedOpponent)
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
        <strong>아직 출전 등록된 팀이 없어요</strong>
        <p>팀 관리에서 타자 9명과 선발 투수를 채운 뒤 &lsquo;출전 등록&rsquo;을 눌러보세요.</p>
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
              <TeamLogo teamId={row.team_id} size="md" />
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
                  <span className="stadium-mine-tag" aria-label="내 출전 팀">내 팀</span>
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

      {/* 도전 모달 — 본인 출전 팀 picker */}
      <ModalShell
        open={selectedOpponent !== null}
        title="도전 시작"
        onClose={() => setSelectedOpponent(null)}
        panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {selectedOpponent ? (
            <>
              <div className="stadium-enter-vs">
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">{formatOwnerLabel(selectedOpponent)}</span>
                  <TeamLogo teamId={selectedOpponent.team_id} size="lg" />
                  <strong>{selectedOpponent.name}</strong>
                </div>
                <span className="stadium-enter-vs-label">VS</span>
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">내 팀</span>
                  {myEntry ? (
                    <>
                      <TeamLogo teamId={myEntry.teamId} size="lg" />
                      <strong>{myEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">출전 팀이 없음</span>
                  )}
                </div>
              </div>

              {myPublishedEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 출전 팀 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myPublishedEntries.map((entry) => {
                      const s = myStatsByEntryId[entry.entryId];
                      const recordTxt = s && s.matches > 0
                        ? ` (${s.wins}승 ${s.losses}패)`
                        : "";
                      return (
                        <button
                          key={entry.entryId}
                          type="button"
                          className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                          onClick={() => setMyEntryId(entry.entryId)}
                        >
                          <TeamBadge teamId={entry.teamId} size="sm" />
                          <span>{entry.name}{recordTxt}</span>
                        </button>
                      );
                    })}
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

      {/* 본인이 출전 팀이 없을 때 안내 */}
      <ModalShell
        open={needPublishGateOpen}
        title="출전 팀이 필요해요"
        onClose={() => setNeedPublishGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            다른 출전 팀과 도전하려면 본인도 출전 등록된 팀이 있어야 해요.<br />
            팀 관리에서 타자 9명과 선발 투수를 채운 뒤 &lsquo;출전 등록&rsquo;을 눌러주세요.
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
              팀 관리
            </Link>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
