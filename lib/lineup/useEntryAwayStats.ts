"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchLineupAwayStatsBulk, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import type { SyncStatus } from "@/lib/storage/useLineupSync";
import type { LineupEntry } from "@/lib/types/lineup";

/** 본인 팀별 원정/방어 전적 (entry_id → stats) 일괄 fetch.
 *  다른 유저가 내 팀을 도전한 경기(user_side=away)만 집계. useEntryStats(홈전적)와 동형.
 *  공개/비공개와 무관하게, 한 번이라도 도전받은 팀은 기록이 남아 있을 수 있어 항상 조회. */
export function useEntryAwayStats(
  entries: LineupEntry[],
  syncStatus: SyncStatus
): Record<string, LineupStats> {
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, LineupStats>>({});

  const entrySignature = useMemo(
    () => entries.map((e) => e.entryId).join(","),
    [entries]
  );

  useEffect(() => {
    if (syncStatus !== "synced") return;
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      // 본인 라인업 row 모두 fetch (id ↔ entry_id 매핑 필요). 은퇴 팀 제외.
      const { data: rows } = await client
        .from("bp_lineups")
        .select("id, entry_id")
        .eq("owner_user_id", user.id);
      if (cancelled || !rows) return;
      const ids = (rows as Array<{ id: string; entry_id: string }>).map((r) => r.id);
      const stats = await fetchLineupAwayStatsBulk(client, ids);
      if (cancelled) return;
      const byEntryId: Record<string, LineupStats> = {};
      for (const r of rows as Array<{ id: string; entry_id: string }>) {
        if (stats[r.id]) byEntryId[r.entry_id] = stats[r.id];
      }
      setStatsByEntryId(byEntryId);
    })();
    return () => {
      cancelled = true;
    };
  }, [syncStatus, entrySignature]);

  return statsByEntryId;
}
