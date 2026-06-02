"use client";

// 내 라인업 목록 — 본인만 보임 (localStorage 기반).
// 한 카드의 "도전" 버튼을 누르면 다른 내 라인업을 상대로 골라 대결.
// source: "self" 라 기록 저장은 하지 않음.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, List, Plus, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { LINEUP_ENTRIES_CHANGED_EVENT, loadLineupEntries } from "@/lib/storage/lineupEntries";
import type { LineupEntry } from "@/lib/types/lineup";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchLineupStatsBulk, listMyLineups, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";

function formatRelativeDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay <= 0) return "오늘";
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  return `${Math.floor(diffDay / 30)}달 전`;
}

type Props = {
  maxItems?: number;
};

export function MyLineupList({ maxItems = 10 }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<LineupEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  // 도전 모달: 내 팀(클릭한 카드) vs 다른 내 라인업
  const [myEntry, setMyEntry] = useState<LineupEntry | null>(null);
  const [opponentEntryId, setOpponentEntryId] = useState<string | null>(null);
  // 라인업이 1개뿐일 때 도전 누르면 안내 모달
  const [needSecondLineupOpen, setNeedSecondLineupOpen] = useState(false);
  // picker 라벨 옆 전적 표시 — 공개 라인업만 stats 존재 (비공개는 bp_lineups row 없음)
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, LineupStats>>({});

  useEffect(() => {
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data } = await client.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      const linRes = await listMyLineups(client, userId);
      if (!linRes.ok) return;
      const published = linRes.rows.filter((r) => r.is_published);
      if (published.length === 0) return;
      const ids = published.map((r) => r.id);
      const statsByLineupId = await fetchLineupStatsBulk(client, ids);
      const byEntry: Record<string, LineupStats> = {};
      for (const r of published) {
        const s = statsByLineupId[r.id];
        if (s) byEntry[r.entry_id] = s;
      }
      setStatsByEntryId(byEntry);
    })();
  }, []);

  // 마운트 시 1회 + 라인업 변경 이벤트/페이지 가시화/포커스 시 재로드.
  //   - LINEUP_ENTRIES_CHANGED_EVENT (커스텀): 같은 탭 내 빌더에서 publish 직후 발화 →
  //     SPA 내부 탭 전환에서도 즉시 반영. visibility/focus만으론 SPA 내 nav를 못 잡아
  //     "라인업 갔다 다시 와야 보임" 증상이 남았던 게 이 이벤트로 해결.
  //   - pageshow: 모바일 BFCache 복원
  //   - visibilitychange/focus: 백그라운드↔포그라운드, 윈도우 포커스
  //   - storage: 다른 탭의 변경 동기화
  useEffect(() => {
    const load = () => {
      const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
      setEntries(ready);
    };
    load();
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") load();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener(LINEUP_ENTRIES_CHANGED_EVENT, load);
      window.addEventListener("focus", load);
      window.addEventListener("pageshow", load);
      window.addEventListener("storage", load);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener(LINEUP_ENTRIES_CHANGED_EVENT, load);
        window.removeEventListener("focus", load);
        window.removeEventListener("pageshow", load);
        window.removeEventListener("storage", load);
      }
    };
  }, []);

  const opponentCandidates = useMemo(() => {
    if (!myEntry || !entries) return [];
    return entries.filter((e) => e.entryId !== myEntry.entryId);
  }, [entries, myEntry]);

  const opponentEntry = useMemo(
    () => opponentCandidates.find((e) => e.entryId === opponentEntryId) ?? null,
    [opponentCandidates, opponentEntryId]
  );

  const openLineupPreview = (entry: LineupEntry) => {
    // partial pitching(선발만 있는 경우 등)도 안전하게 9슬롯으로 보강
    const pitching = fillMissingPitcherSlots(entry.teamId, entry.pitching?.slots ?? []);
    if (!pitching) return;
    const stats = buildStatsDirectory([entry.teamId]);
    const built = buildSimTeamInput(entry.teamId, entry.batting, pitching, stats, entry.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  const openChallenge = (entry: LineupEntry) => {
    if (!entries) return;
    // 라인업이 1개뿐이면 안내 모달 — silent return 대신 사용자 인지 가능하게.
    if (entries.length < 2) {
      setNeedSecondLineupOpen(true);
      return;
    }
    setMyEntry(entry);
    const firstOpponent = entries.find((e) => e.entryId !== entry.entryId);
    setOpponentEntryId(firstOpponent?.entryId ?? null);
    setError(null);
  };

  const closeChallenge = () => {
    setMyEntry(null);
    setOpponentEntryId(null);
  };

  const startMatch = async () => {
    if (!myEntry || !opponentEntry || starting) return;
    setStarting(true);
    setError(null);

    const myPitching = fillMissingPitcherSlots(myEntry.teamId, myEntry.pitching?.slots ?? []);
    const oppPitching = fillMissingPitcherSlots(opponentEntry.teamId, opponentEntry.pitching?.slots ?? []);
    if (!myPitching || !oppPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    // DB 스냅샷 기반 시즌+최근 폼 블렌드. fetch 실패 시 baseline 폴백.
    const client = createSupabaseBrowserClient();
    const stats = await buildStatsDirectoryWithRecentForm(client, [myEntry.teamId, opponentEntry.teamId]);
    const mine = buildSimTeamInput(myEntry.teamId, myEntry.batting, myPitching, stats, myEntry.name);
    if (!mine.ok) {
      setStarting(false);
      setError(`내 라인업 변환 실패 (${mine.issues.map((i) => i.kind).join(", ")})`);
      return;
    }
    const opp = buildSimTeamInput(
      opponentEntry.teamId,
      opponentEntry.batting,
      oppPitching,
      stats,
      opponentEntry.name
    );
    if (!opp.ok) {
      setStarting(false);
      setError(`상대 라인업 변환 실패 (${opp.issues.map((i) => i.kind).join(", ")})`);
      return;
    }

    const seed = generateSeed();
    saveMatchSession({
      myTeamId: myEntry.teamId,
      opponentTeamId: opponentEntry.teamId,
      seed,
      input: { home: mine.team, away: opp.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "self",
      userSide: "home"
    });
    router.push("/stadium/play");
  };

  if (entries === null) return null;
  if (entries.length === 0) {
    return (
      <section className="stadium-discover-empty">
        <strong>내가 만든 라인업이 없어요</strong>
        <p>라인업 짜기에서 9명을 채워 저장하면 여기 표시돼요.</p>
      </section>
    );
  }

  // updatedAt 내림차순 정렬 후 slice — 새로 만든/수정한 라인업이 항상 상단에 보이도록.
  //   - loadLineupEntries()는 무정렬, upsertLineupEntry()는 새 entry를 배열 끝에 append.
  //     그래서 기존 entry가 maxItems만큼 차있으면 새 entry가 slice에서 잘려 안 보이는 버그가 있었음.
  //     (도전 모달의 picker는 slice 없이 전부 노출 → 거기엔 보임. 같은 localStorage라도
  //     list slice 위치가 달라서 두 곳에서 다르게 보였음.)
  const list = [...entries]
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
    .slice(0, maxItems);

  return (
    <>
      {error ? <p className="stadium-error">{error}</p> : null}

      <section className="stadium-discover-list">
        {list.map((entry) => {
          const team = getTeam(entry.teamId);
          return (
            <div key={entry.entryId} className="stadium-discover-card">
              <TeamBadge teamId={entry.teamId} size="md" />
              <div className="stadium-discover-card-body">
                <strong>{entry.name}</strong>
                <span>{team.shortName} · {formatRelativeDate(entry.updatedAt)}</span>
              </div>
              <div className="stadium-lobby-card-actions">
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-secondary"
                  onClick={() => openLineupPreview(entry)}
                  aria-label={`${entry.name} 라인업 보기`}
                >
                  <List size={14} />
                  <span>라인업</span>
                </button>
                {/* disabled 제거 — 라인업 1개일 때도 클릭 등록되어 안내 모달 노출되도록 */}
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                  onClick={() => openChallenge(entry)}
                  aria-label={`${entry.name}로 도전 시작`}
                >
                  <Swords size={14} />
                  <span>도전</span>
                </button>
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
        open={myEntry !== null}
        title="내 라인업끼리 대결"
        onClose={closeChallenge}
        panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {myEntry ? (
            <>
              <div className="stadium-enter-vs">
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">내 팀</span>
                  <TeamBadge teamId={myEntry.teamId} size="lg" />
                  <strong>{myEntry.name}</strong>
                </div>
                <span className="stadium-enter-vs-label">VS</span>
                <div className="stadium-enter-team">
                  <span className="stadium-enter-team-label">상대</span>
                  {opponentEntry ? (
                    <>
                      <TeamBadge teamId={opponentEntry.teamId} size="lg" />
                      <strong>{opponentEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">상대 선택</span>
                  )}
                </div>
              </div>

              {opponentCandidates.length > 0 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">상대 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {opponentCandidates.map((entry) => {
                      const s = statsByEntryId[entry.entryId];
                      const recordTxt = s && s.matches > 0
                        ? ` (${s.wins}승 ${s.losses}패)`
                        : "";
                      return (
                        <button
                          key={entry.entryId}
                          type="button"
                          className={`stadium-discover-my-pick ${entry.entryId === opponentEntryId ? "is-active" : ""}`}
                          onClick={() => setOpponentEntryId(entry.entryId)}
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
                disabled={!opponentEntry || starting}
                onClick={startMatch}
              >
                <Swords size={16} />
                <span>{starting ? "시작 중..." : "대결 시작"}</span>
                <ArrowRight size={16} />
              </button>
            </>
          ) : null}
        </div>
      </ModalShell>

      {/* 라인업 1개일 때 도전 클릭 시 안내 모달 — 새 라인업 만들기 CTA 포함 */}
      <ModalShell
        open={needSecondLineupOpen}
        title="라인업이 2개 필요해요"
        onClose={() => setNeedSecondLineupOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            내 라인업끼리 대결하려면 <strong>라인업이 2개</strong> 필요해요.<br />
            새 라인업을 하나 더 만들어보세요.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setNeedSecondLineupOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              onClick={() => {
                setNeedSecondLineupOpen(false);
                router.push("/play");
              }}
            >
              <Plus size={14} />
              라인업 만들기
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
