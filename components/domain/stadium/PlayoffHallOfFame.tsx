"use client";

// 가을야구 명예의 전당 — 전체 유저 공개 우승자 목록.
// 마운트 시 클라이언트에서 bp_playoff_champions 페치(서버 prop 변경 불필요).
// 행 탭 → 그 우승 라인업으로 LineupDetailModal (StadiumLineupRankingPreview.openLineupPreview 패턴).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TeamLogo } from "@/components/common/TeamLogo";
import { ModalShell } from "@/components/common/ModalShell";
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

type Props = {
  /** "full": 전체 목록 + 라인업 모달(가을야구 페이지). "compact": 1줄 진입 배너(경기장). */
  variant?: "full" | "compact";
};

export function PlayoffHallOfFame({ variant = "full" }: Props) {
  const compact = variant === "compact";
  const [rows, setRows] = useState<PlayoffChampionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // compact 배너 — 역대 우승자 순환(광고판) 인덱스.
  const [rotateIdx, setRotateIdx] = useState(0);
  const [allModalOpen, setAllModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      // compact는 광고판처럼 역대 우승자를 순환 노출하므로 여러 명을 가져온다.
      // full 버전은 모달에서 전체 목록을 보여주어야 하므로, 넉넉하게 100명까지 가져온다.
      const [listRes, countRes] = await Promise.all([
        listPlayoffChampions(client, compact ? 10 : 100),
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
  }, [compact]);

  // compact: 2.8초마다 다음 우승자로 순환.
  useEffect(() => {
    if (!compact || rows.length <= 1) return;
    const t = window.setInterval(() => {
      setRotateIdx((i) => (i + 1) % rows.length);
    }, 2800);
    return () => window.clearInterval(t);
  }, [compact, rows.length]);

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

  // 경기장 진입 배너 — 1줄 요약. 우승자가 없으면(아래 '가을야구 도전' 배너가 유도) 숨김.
  if (compact) {
    if (total === 0) return null;
    const champ = rows[rotateIdx % rows.length] ?? rows[0];
    return (
      <Link href="/stadium/playoff" className="playoff-hall-banner" prefetch>
        <span className="playoff-hall-banner-emoji" aria-hidden="true">🏆</span>
        <strong className="playoff-hall-banner-title">명예의 전당</strong>
        {champ ? (
          <span key={champ.id} className="playoff-hall-banner-spot">
            <TeamLogo teamId={champ.teamId} size="sm" />
            <span className="playoff-hall-banner-nick">{champ.nickname}</span>
          </span>
        ) : null}
        <span className="playoff-hall-banner-count">역대 {total}회</span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <section className="playoff-hall">
      <header className="playoff-hall-head">
        <h2 className="playoff-hall-title">🏆 명예의 전당</h2>
        <button
          type="button"
          className="playoff-hall-count-btn"
          onClick={() => setAllModalOpen(true)}
          aria-label="명예의 전당 전체 목록 보기"
        >
          역대 우승 {total}회
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="playoff-hall-empty">
          <p>아직 우승자가 없어요 — 첫 우승의 주인공이 되어보세요.</p>
        </div>
      ) : (
        <>
          <ul className="playoff-hall-list">
            {rows.slice(0, 3).map((champ) => {
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
                      <strong className="playoff-hall-team-name">{champ.teamName}</strong>
                      <span className="playoff-hall-owner">({champ.nickname})</span>
                    </div>
                    <span className="playoff-hall-date">{formatDate(champ.completedAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {total > 3 && (
            <button
              type="button"
              className="playoff-hall-more-btn"
              onClick={() => setAllModalOpen(true)}
            >
              전체 보기
            </button>
          )}
        </>
      )}

      {/* 전체 우승자 목록 모달 */}
      <ModalShell
        open={allModalOpen}
        title="🏆 명예의 전당"
        onClose={() => setAllModalOpen(false)}
        panelClassName="playoff-hall-modal-panel"
        closeOnBackdrop
      >
        <ul className="playoff-hall-modal-list">
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
                    <strong className="playoff-hall-team-name">{champ.teamName}</strong>
                    <span className="playoff-hall-owner">({champ.nickname})</span>
                  </div>
                  <span className="playoff-hall-date">{formatDate(champ.completedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </ModalShell>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
    </section>
  );
}
