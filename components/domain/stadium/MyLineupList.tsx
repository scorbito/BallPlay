"use client";

// 내 라인업 목록 — 본인만 보임 (localStorage 기반).
// 한 카드의 "도전" 버튼을 누르면 다른 내 라인업을 상대로 골라 대결.
// source: "self" 라 기록 저장은 하지 않음.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, List, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
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

export function MyLineupList({ maxItems = 6 }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<LineupEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  // 도전 모달: 내 팀(클릭한 카드) vs 다른 내 라인업
  const [myEntry, setMyEntry] = useState<LineupEntry | null>(null);
  const [opponentEntryId, setOpponentEntryId] = useState<string | null>(null);

  useEffect(() => {
    const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
    setEntries(ready);
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
    const pitching = entry.pitching ?? autoFillPitcherLineup(entry.teamId);
    if (!pitching) return;
    const stats = buildStatsDirectory([entry.teamId]);
    const built = buildSimTeamInput(entry.teamId, entry.batting, pitching, stats, entry.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  const openChallenge = (entry: LineupEntry) => {
    if (!entries || entries.length < 2) return;
    setMyEntry(entry);
    const firstOpponent = entries.find((e) => e.entryId !== entry.entryId);
    setOpponentEntryId(firstOpponent?.entryId ?? null);
    setError(null);
  };

  const closeChallenge = () => {
    setMyEntry(null);
    setOpponentEntryId(null);
  };

  const startMatch = () => {
    if (!myEntry || !opponentEntry || starting) return;
    setStarting(true);
    setError(null);

    const myPitching = myEntry.pitching ?? autoFillPitcherLineup(myEntry.teamId);
    const oppPitching = opponentEntry.pitching ?? autoFillPitcherLineup(opponentEntry.teamId);
    if (!myPitching || !oppPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const stats = buildStatsDirectory([myEntry.teamId, opponentEntry.teamId]);
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

  const list = entries.slice(0, maxItems);
  const canChallenge = entries.length >= 2;

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
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                  onClick={() => openChallenge(entry)}
                  disabled={!canChallenge}
                  title={canChallenge ? undefined : "내 라인업이 2개 이상 있어야 대결할 수 있어요"}
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
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {myEntry ? (
            <>
              <div className="stadium-discover-vs">
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">내 팀</span>
                  <TeamBadge teamId={myEntry.teamId} size="lg" />
                  <strong>{myEntry.name}</strong>
                </div>
                <span className="stadium-discover-vs-divider">VS</span>
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">상대</span>
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
                    {opponentCandidates.map((entry) => (
                      <button
                        key={entry.entryId}
                        type="button"
                        className={`stadium-discover-my-pick ${entry.entryId === opponentEntryId ? "is-active" : ""}`}
                        onClick={() => setOpponentEntryId(entry.entryId)}
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
    </>
  );
}
