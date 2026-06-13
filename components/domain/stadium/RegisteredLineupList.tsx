"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, List, RefreshCw, Swords } from "lucide-react";
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

function formatRecord(stats: LineupStats | undefined): string {
  if (!stats || stats.matches === 0) return "전적 없음";
  return `${stats.wins}승 ${stats.losses}패`;
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
  const [myStatsByEntryId, setMyStatsByEntryId] = useState<Record<string, LineupStats>>({});
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
      listCacheRef.current[cacheKey] = { rows: res.rows, statsByLineupId: res.statsByLineupId };
      setRows(res.rows);
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

          const idByEntry: Record<string, string> = {};
          for (const row of myLineupsRes.rows) {
            if (row.is_published) idByEntry[row.entry_id] = row.id;
          }
          const ids = Object.values(idByEntry);
          if (ids.length > 0) {
            const statsByLineupId = await fetchLineupStatsBulk(client, ids);
            const statsByEntry: Record<string, LineupStats> = {};
            for (const [entryId, lineupId] of Object.entries(idByEntry)) {
              const stats = statsByLineupId[lineupId];
              if (stats) statsByEntry[entryId] = stats;
            }
            setMyStatsByEntryId(statsByEntry);
          }
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
        <strong>아직 출전 등록된 라인업이 없어요</strong>
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
          const isMine = row.owner_user_id === ownerIdForExclude;
          const stats = statsByLineupId[row.id];
          return (
            <div key={row.id} className="stadium-discover-card stadium-registered-card">
              <TeamLogo teamId={row.team_id} size="md" fallbackName={row.name} />
              <div className="stadium-discover-card-body">
                <strong>{row.name}</strong>
                <span className="stadium-registered-meta">
                  {formatOwnerLabel(row)} · {getTeamShortName(row.team_id)} ·{" "}
                  <span className="stadium-registered-record">{formatRecord(stats)}</span>
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

      <LineupDetailModal open={previewTeam !== null} team={previewTeam} onClose={() => setPreviewTeam(null)} />

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
                  <TeamLogo teamId={selectedOpponent.team_id} size="lg" fallbackName={selectedOpponent.name} />
                  <strong>{selectedOpponent.name}</strong>
                </div>
                <span className="stadium-enter-vs-label">VS</span>
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">내 팀</span>
                  {myEntry ? (
                    <>
                      <TeamLogo
                        teamId={myEntry.teamId}
                        size="lg"
                        fallbackName={myEntry.name}
                        fallbackInitial={myEntry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.initials : undefined}
                        fallbackColor={myEntry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.color : undefined}
                      />
                      <strong>{myEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">출전 팀 없음</span>
                  )}
                </div>
              </div>

              {myPublishedEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 출전 팀 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myPublishedEntries.map((entry) => {
                      const stats = myStatsByEntryId[entry.entryId];
                      const recordTxt = stats && stats.matches > 0 ? ` (${stats.wins}승 ${stats.losses}패)` : "";
                      return (
                        <button
                          key={entry.entryId}
                          type="button"
                          className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                          onClick={() => setMyEntryId(entry.entryId)}
                        >
                          <TeamLogo
                            teamId={entry.teamId}
                            size="sm"
                            fallbackName={entry.name}
                            fallbackInitial={entry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.initials : undefined}
                            fallbackColor={entry.teamId.startsWith("custom:") ? myCustomBadgeInfo?.color : undefined}
                          />
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

      <ModalShell
        open={needPublishGateOpen}
        title="출전 팀이 필요해요"
        onClose={() => setNeedPublishGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            다른 출전 팀과 도전하려면 본인의 출전 등록 팀이 있어야 해요.
          </p>
          <div className="lineup-confirm-actions">
            <button type="button" className="lineup-confirm-cancel" onClick={() => setNeedPublishGateOpen(false)}>
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
