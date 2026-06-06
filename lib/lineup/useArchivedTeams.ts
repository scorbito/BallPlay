"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listMyArchivedLineups,
  fetchLineupStatsBulk,
  rowToEntry,
  type LineupStats
} from "@/lib/supabase/query-parts/bpLineups";
import type { SyncStatus } from "@/lib/storage/useLineupSync";
import type { LineupEntry } from "@/lib/types/lineup";

export type ArchivedTeam = {
  entry: LineupEntry;
  stats: LineupStats | null;
  archivedAt: string | null;
};

/** 은퇴(보관) 팀 + 최종 전적 — 팀 관리 드롭다운 하단 읽기 전용 표시용.
 *  refreshKey 가 바뀌면(은퇴 직후) 재조회해서 막 은퇴한 팀도 바로 반영.
 *  is_archived 컬럼이 아직 없으면 listMyArchivedLineups 가 빈 배열을 돌려주므로
 *  SQL 미적용 환경에서도 안전(에러 없음). */
export function useArchivedTeams(syncStatus: SyncStatus, refreshKey: number): ArchivedTeam[] {
  const [teams, setTeams] = useState<ArchivedTeam[]>([]);

  useEffect(() => {
    if (syncStatus !== "synced") return;
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return; // 비로그인/게스트는 은퇴 개념 없음(DB 전적 없음)
      const res = await listMyArchivedLineups(client, user.id);
      if (cancelled || !res.ok) return;
      const rows = res.rows;
      const ids = rows.map((r) => r.id);
      const stats = ids.length > 0 ? await fetchLineupStatsBulk(client, ids) : {};
      if (cancelled) return;
      setTeams(
        rows.map((r) => ({
          entry: rowToEntry(r),
          stats: stats[r.id] ?? null,
          archivedAt: r.archived_at ?? null
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [syncStatus, refreshKey]);

  return teams;
}
