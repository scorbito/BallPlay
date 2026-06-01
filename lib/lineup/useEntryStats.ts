"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchLineupStatsBulk, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import type { SyncStatus } from "@/lib/storage/useLineupSync";
import type { LineupEntry } from "@/lib/types/lineup";

/** 본인 라인업별 전적 (entry_id → stats) 일괄 fetch.
 *  공개 라인업만 매칭되는 stats 있음. 빌더 마운트 시 + 공개 토글 후 자동 갱신.
 *  entries의 entryId + isPublished 시그니처를 기준으로 변경 감지. */
export function useEntryStats(
  entries: LineupEntry[],
  syncStatus: SyncStatus
): Record<string, LineupStats> {
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, LineupStats>>({});

  const publishedSignature = useMemo(
    () => entries.map((e) => `${e.entryId}:${e.isPublished ? 1 : 0}`).join(","),
    [entries]
  );

  useEffect(() => {
    if (syncStatus !== "synced") return;
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      // 본인 라인업 row 모두 fetch (id ↔ entry_id 매핑 필요) — 익명도 DB sync되므로 포함
      const { data: rows } = await client
        .from("bp_lineups")
        .select("id, entry_id")
        .eq("owner_user_id", user.id);
      if (cancelled || !rows) return;
      const ids = (rows as Array<{ id: string; entry_id: string }>).map((r) => r.id);
      const stats = await fetchLineupStatsBulk(client, ids);
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
  }, [syncStatus, publishedSignature]);

  return statsByEntryId;
}
