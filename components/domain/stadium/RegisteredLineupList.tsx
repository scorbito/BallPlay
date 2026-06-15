"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, List, RefreshCw } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import {
  fetchPublishedLineupsByIds,
  listMyLineups,
  listPublishedByRecent,
  listPublishedByWinrate,
  rowToEntry,
  type LineupStats,
  type PublishedLineupRow
} from "@/lib/supabase/query-parts/bpLineups";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import type { LineupEntry } from "@/lib/types/lineup";
import { fillMissingPitcherSlotsFromStatsDirectory } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import {
  buildStatsDirectoryWithRecentFormForLineups,
  getEntryValidPlayerIds,
  getLineupValidPlayerIds
} from "@/lib/sim/lineupStatsDirectory";

type Props = {
  maxItems?: number;
  sortBy: "winrate" | "recent";
  showHeader?: boolean;
  includeMine?: boolean;
};

type CustomTeamBadgeInfo = {
  initials?: string;
  color?: string;
};

type LineupListCacheEntry = {
  rows: PublishedLineupRow[];
  statsByLineupId: Record<string, LineupStats>;
};

function formatOwnerLabel(row: PublishedLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명";
}

function compareByRecord(
  a: PublishedLineupRow,
  b: PublishedLineupRow,
  statsByLineupId: Record<string, LineupStats>
): number {
  const aStats = statsByLineupId[a.id] ?? { matches: 0, wins: 0, losses: 0, draws: 0 };
  const bStats = statsByLineupId[b.id] ?? { matches: 0, wins: 0, losses: 0, draws: 0 };
  return (
    bStats.wins - aStats.wins ||
    aStats.losses - bStats.losses ||
    bStats.matches - aStats.matches ||
    a.name.localeCompare(b.name, "ko")
  );
}

function getTeamShortName(teamId: string): string {
  if (teamId.startsWith("custom:")) return "나만의 팀";
  try {
    return getTeam(teamId).shortName;
  } catch {
    return teamId === "national" ? "국가대표" : teamId;
  }
}

function isCustomTeamId(teamId: string): boolean {
  return teamId.startsWith("custom:") || teamId.startsWith("custom-team:");
}

function mergePublishedEntries(localEntries: LineupEntry[], dbEntries: LineupEntry[]): LineupEntry[] {
  const map = new Map<string, LineupEntry>();
  for (const entry of [...localEntries, ...dbEntries]) {
    if (entry.batting.slots.length === 9 && entry.isPublished === true) {
      map.set(entry.entryId, entry);
    }
  }
  return Array.from(map.values());
}

export function RegisteredLineupList({
  maxItems = 50,
  sortBy,
  showHeader = true,
  includeMine = false
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PublishedLineupRow[] | null>(null);
  const [statsByLineupId, setStatsByLineupId] = useState<Record<string, LineupStats>>({});
  const [myPublishedEntries, setMyPublishedEntries] = useState<LineupEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerIdForExclude, setOwnerIdForExclude] = useState<string | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<PublishedLineupRow | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [needPublishGateOpen, setNeedPublishGateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myCustomBadgeInfo, setMyCustomBadgeInfo] = useState<CustomTeamBadgeInfo | null>(null);
  const listCacheRef = useRef<Record<string, LineupListCacheEntry>>({});

  const loadList = useCallback(
    async (excludeUid: string | null, options?: { bypassCache?: boolean }) => {
      const filterUid = includeMine ? null : excludeUid;
      const cacheKey = `${sortBy}:${filterUid ?? "all"}:${maxItems}`;

      if (!options?.bypassCache) {
        const cached = listCacheRef.current[cacheKey];
        if (cached) {
          setRows(cached.rows);
          setStatsByLineupId(cached.statsByLineupId);
          setError(null);
          setLoading(false);
          return;
        }
      }

      const client = createSupabaseBrowserClient();
      setLoading(true);
      setError(null);

      if (sortBy === "winrate") {
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
          ? fetched.rows.filter((row) => row.owner_user_id !== filterUid)
          : fetched.rows
        )
          .filter((row) => !isCustomTeamId(row.team_id))
          .sort((a, b) => compareByRecord(a, b, sorted.statsByLineupId))
          .slice(0, maxItems);
        listCacheRef.current[cacheKey] = { rows: filtered, statsByLineupId: sorted.statsByLineupId };
        setRows(filtered);
        setStatsByLineupId(sorted.statsByLineupId);
        return;
      }

      const res = await listPublishedByRecent(client, maxItems, filterUid);
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const rows = res.rows.filter((row) => !isCustomTeamId(row.team_id));
      listCacheRef.current[cacheKey] = { rows, statsByLineupId: res.statsByLineupId };
      setRows(rows);
      setStatsByLineupId(res.statsByLineupId);
    },
    [includeMine, maxItems, sortBy]
  );

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    try {
      const raw = window.localStorage.getItem("ballplay:my-team-info");
      if (raw) {
        const info = JSON.parse(raw) as { initials?: string; color?: string };
        setMyCustomBadgeInfo({ initials: info.initials, color: info.color });
      }
    } catch {
      setMyCustomBadgeInfo(null);
    }
    void (async () => {
      let { data: authData } = await client.auth.getUser();
      let uid = authData.user?.id ?? null;
      if (!uid) {
        uid = await ensureAnonymousClient(client);
        authData = (await client.auth.getUser()).data;
        uid = authData.user?.id ?? uid;
      }
      setUserId(uid);
      setOwnerIdForExclude(uid);

      const myPublished = loadLineupEntries().filter(
        (entry) => entry.batting.slots.length === 9 && entry.isPublished === true
      );
      setMyPublishedEntries(myPublished);
      if (myPublished.length > 0) setMyEntryId(myPublished[0].entryId);

      if (uid) {
        const myLineupsRes = await listMyLineups(client, uid);
        if (myLineupsRes.ok) {
          const dbPublished = myLineupsRes.rows.filter((row) => row.is_published).map(rowToEntry);
          const merged = mergePublishedEntries(myPublished, dbPublished);
          setMyPublishedEntries(merged);
          if (merged.length > 0) setMyEntryId((prev) => prev ?? merged[0].entryId);
        }
      }

      await loadList(uid);
    })();
  }, [loadList]);

  const refresh = useCallback(async () => {
    await loadList(ownerIdForExclude, { bypassCache: true });
  }, [loadList, ownerIdForExclude]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const myEntry = useMemo(
    () => myPublishedEntries.find((entry) => entry.entryId === myEntryId) ?? null,
    [myEntryId, myPublishedEntries]
  );

  const openLineupPreview = async (row: PublishedLineupRow) => {
    const client = createSupabaseBrowserClient();
    const stats = await buildStatsDirectoryWithRecentFormForLineups(client, [
      { teamId: row.team_id, batting: row.batting, pitching: row.pitching }
    ]);
    const pitching = fillMissingPitcherSlotsFromStatsDirectory(
      row.team_id,
      row.pitching?.slots ?? [],
      stats,
      getLineupValidPlayerIds(row.team_id, row.batting)
    );
    if (!pitching) return;
    const built = buildSimTeamInput(row.team_id, row.batting, pitching, stats, row.name);
    if (built.ok) setPreviewTeam(built.team);
  };

  const handleChallenge = (row: PublishedLineupRow) => {
    if (myPublishedEntries.length === 0) {
      setNeedPublishGateOpen(true);
      return;
    }
    setSelectedOpponent(row);
  };

  const startChallenge = useCallback(async () => {
    if (!selectedOpponent || !myEntry || starting) return;
    setStarting(true);
    setError(null);

    const client = createSupabaseBrowserClient();
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      effectiveUserId = await ensureAnonymousClient(client);
      if (effectiveUserId) setUserId(effectiveUserId);
    }
    if (!effectiveUserId) {
      setStarting(false);
      setError("계정 준비에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const stats = await buildStatsDirectoryWithRecentFormForLineups(client, [
      { teamId: myEntry.teamId, batting: myEntry.batting, pitching: myEntry.pitching },
      { teamId: selectedOpponent.team_id, batting: selectedOpponent.batting, pitching: selectedOpponent.pitching }
    ]);
    const myPitching = fillMissingPitcherSlotsFromStatsDirectory(
      myEntry.teamId,
      myEntry.pitching?.slots ?? [],
      stats,
      getEntryValidPlayerIds(myEntry)
    );
    const opponentPitching = fillMissingPitcherSlotsFromStatsDirectory(
      selectedOpponent.team_id,
      selectedOpponent.pitching?.slots ?? [],
      stats,
      getLineupValidPlayerIds(selectedOpponent.team_id, selectedOpponent.batting)
    );
    if (!myPitching || !opponentPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const mine = buildSimTeamInput(myEntry.teamId, myEntry.batting, myPitching, stats, myEntry.name);
    const opponent = buildSimTeamInput(
      selectedOpponent.team_id,
      selectedOpponent.batting,
      opponentPitching,
      stats,
      selectedOpponent.name
    );
    if (!mine.ok || !opponent.ok) {
      setStarting(false);
      setError("라인업 변환에 실패했습니다.");
      return;
    }

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
      input: { home: mine.team, away: opponent.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "public",
      userSide: "home",
      myLineupId: myLineupId ?? undefined,
      opponentLineupId: selectedOpponent.id,
      opponentNickname: formatOwnerLabel(selectedOpponent)
    });
    router.push("/stadium/play");
  }, [myEntry, router, selectedOpponent, starting, userId]);

  if (loading && rows === null) return <p className="stadium-loading">불러오는 중...</p>;
  if (rows === null) return error ? <p className="stadium-error">{error}</p> : null;
  if (rows.length === 0) {
    return (
      <section className="stadium-discover-empty">
        <strong>아직 공개된 라인업이 없어요</strong>
        <p>라인업 분석에서 타자 9명과 선발 투수를 채운 뒤 공개해보세요.</p>
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
          const isMine = row.owner_user_id === ownerIdForExclude;
          return (
            <div key={row.id} className="stadium-discover-card stadium-registered-card">
              <TeamBadge teamId={row.team_id} size="md" fallbackName={row.name} />
              <div className="stadium-discover-card-body">
                <strong>{row.name}</strong>
                <span className="stadium-registered-meta">
                  {formatOwnerLabel(row)} · {getTeamShortName(row.team_id)}
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
                  <span>보기</span>
                </button>
                {isMine ? (
                  <span className="stadium-mine-tag" aria-label="내 공개 라인업">내 라인업</span>
                ) : (
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                    onClick={() => handleChallenge(row)}
                    aria-label={`${row.name} 비교 시뮬레이션`}
                  >
                    <BarChart3 size={14} />
                    <span>시뮬</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <LineupDetailModal open={previewTeam !== null} team={previewTeam} onClose={() => setPreviewTeam(null)} />

      <ModalShell
        open={selectedOpponent !== null}
        title="비교 시뮬레이션"
        onClose={() => setSelectedOpponent(null)}
        panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {selectedOpponent ? (
            <>
              <div className="stadium-enter-vs">
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">공개 라인업</span>
                  <TeamBadge
                    teamId={selectedOpponent.team_id}
                    size="lg"
                    fallbackName={selectedOpponent.name}
                  />
                  <strong>{selectedOpponent.name}</strong>
                </div>
                <span className="stadium-enter-vs-label">VS</span>
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">내 라인업</span>
                  {myEntry ? (
                    <>
                      <TeamBadge
                        teamId={myEntry.teamId}
                        size="lg"
                        fallbackName={myEntry.name}
                        fallbackInitial={myEntry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.initials : undefined}
                        fallbackColor={myEntry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.color : undefined}
                      />
                      <strong>{myEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">공개 라인업 없음</span>
                  )}
                </div>
              </div>

              {myPublishedEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 공개 라인업 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myPublishedEntries.map((entry) => {
                      return (
                        <button
                          key={entry.entryId}
                          type="button"
                          className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                          onClick={() => setMyEntryId(entry.entryId)}
                        >
                          <TeamBadge
                            teamId={entry.teamId}
                            size="sm"
                            fallbackName={entry.name}
                            fallbackInitial={entry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.initials : undefined}
                            fallbackColor={entry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.color : undefined}
                          />
                          <span>{entry.name}</span>
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
                <BarChart3 size={16} />
                <span>{starting ? "준비 중..." : "시뮬레이션 시작"}</span>
                <ArrowRight size={16} />
              </button>
            </>
          ) : null}
        </div>
      </ModalShell>

      <ModalShell
        open={needPublishGateOpen}
        title="공개 라인업이 필요해요"
        onClose={() => setNeedPublishGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            공개 라인업과 비교 시뮬레이션을 하려면 내 라인업도 공개 상태여야 해요.
          </p>
          <div className="lineup-confirm-actions">
            <button type="button" className="lineup-confirm-cancel" onClick={() => setNeedPublishGateOpen(false)}>
              닫기
            </button>
            <Link href="/play/lineup" className="lineup-confirm-primary" prefetch>
              라인업 분석
            </Link>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
