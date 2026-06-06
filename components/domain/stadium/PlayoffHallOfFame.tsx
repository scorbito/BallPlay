"use client";

// 가을야구 명예의 전당 — 전체 유저 공개 우승자 목록.
// 마운트 시 클라이언트에서 bp_playoff_champions 페치(서버 prop 변경 불필요).
// 행 탭 → 그 우승 라인업으로 LineupDetailModal (StadiumLineupRankingPreview.openLineupPreview 패턴).

import { useEffect, useState } from "react";
import { TeamLogo } from "@/components/common/TeamLogo";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import { getRoster } from "@/lib/rosters";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listPlayoffChampions,
  countPlayoffChampions,
  type PlayoffChampionRow
} from "@/lib/supabase/query-parts/bpPlayoffChampions";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import type { SimTeamInput } from "@/lib/sim/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function PlayoffHallOfFame() {
  const [rows, setRows] = useState<PlayoffChampionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const [listRes, countRes] = await Promise.all([
        listPlayoffChampions(client, 5),
        countPlayoffChampions(client)
      ]);
      if (cancelled) return;
      if (listRes.ok) setRows(listRes.rows);
      if (countRes.ok) setTotal(countRes.count);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openLineup = (champ: PlayoffChampionRow) => {
    if (loadingId || !champ.batting || !champ.pitching) return;
    setLoadingId(champ.id);
    try {
      const validIds = new Set(getRoster(champ.teamId).map((p) => p.id));
      const pitching = fillMissingPitcherSlots(champ.teamId, champ.pitching.slots, validIds);
      if (!pitching) return;
      const stats = buildStatsDirectory([champ.teamId]);
      const built = buildSimTeamInput(champ.teamId, champ.batting, pitching, stats, champ.teamName);
      if (!built.ok) return;
      setPreviewTeam(built.team);
    } finally {
      setLoadingId(null);
    }
  };

  // 로드 전이거나 우승자 0명이라도 카드는 그려서 "첫 우승" 안내를 보여준다.
  if (!loaded) return null;

  return (
    <section className="playoff-hall">
      <header className="playoff-hall-head">
        <h2 className="playoff-hall-title">🏆 명예의 전당</h2>
        <span className="playoff-hall-count">역대 우승 {total}회</span>
      </header>

      {rows.length === 0 ? (
        <div className="playoff-hall-empty">
          <p>아직 우승자가 없어요 — 첫 우승의 주인공이 되어보세요.</p>
        </div>
      ) : (
        <ul className="playoff-hall-list">
          {rows.map((champ) => {
            const hasLineup = Boolean(champ.batting && champ.pitching);
            const isLoading = loadingId === champ.id;
            return (
              <li key={champ.id} className="playoff-hall-row">
                <button
                  type="button"
                  className="playoff-hall-row-btn"
                  onClick={() => openLineup(champ)}
                  disabled={!hasLineup || isLoading}
                  aria-label={`${champ.nickname} 우승 라인업 보기`}
                >
                  <TeamLogo teamId={champ.teamId} size="sm" />
                  <div className="playoff-hall-row-body">
                    <span className="playoff-hall-nick">{champ.nickname}</span>
                    <span className="playoff-hall-team">{champ.teamName}</span>
                  </div>
                  <span className="playoff-hall-date">{formatDate(champ.completedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
    </section>
  );
}
