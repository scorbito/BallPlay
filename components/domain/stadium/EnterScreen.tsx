"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import {
  PITCHER_SLOTS_COUNT,
  type LineupEntry,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import { buildStatsDirectory, getTeamStats } from "@/lib/sim/statsLoader";
import {
  generateSeed,
  saveMatchSession
} from "@/lib/sim/matchSession";

// 저장된 투수 라인업이 없을 때 — 팀 stats에서 자동으로 9명(선발+불펜) 생성.
function autoFillPitcherLineup(teamId: string): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;
  const sorted = [...stats.pitchers].sort((a, b) => b.staminaPitches - a.staminaPitches);
  const slots: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  for (let i = 0; i < PITCHER_SLOTS_COUNT && i < sorted.length; i++) {
    slots[i] = sorted[i].playerId;
  }
  return {
    teamId,
    slots,
    updatedAt: new Date().toISOString()
  };
}

export function EnterScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const opponentTeamId = params.get("opponent") ?? "lg";
  const opponentTeam = useMemo(() => getTeam(opponentTeamId), [opponentTeamId]);

  const [myEntries, setMyEntries] = useState<LineupEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // 9명 batting이 다 채워진 entry만 출전 가능
    const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
    setMyEntries(ready);
    if (ready.length > 0) setSelectedEntryId(ready[0].entryId);
  }, []);

  const selectedEntry = useMemo(
    () => myEntries.find((e) => e.entryId === selectedEntryId) ?? null,
    [myEntries, selectedEntryId]
  );

  const handleStart = () => {
    if (!selectedEntry) {
      setError("출전할 라인업을 선택해주세요.");
      return;
    }

    const seed = generateSeed();

    // 투수 라인업 없으면 자동 보강
    const pitchingToUse = selectedEntry.pitching ?? autoFillPitcherLineup(selectedEntry.teamId);
    if (!pitchingToUse) {
      setError("투수 라인업을 자동 생성하지 못했습니다.");
      return;
    }

    // 내 팀 변환 (entry.name을 displayName으로 전달)
    const myStats = buildStatsDirectory([selectedEntry.teamId]);
    const myAdapt = buildSimTeamInput(
      selectedEntry.teamId,
      selectedEntry.batting,
      pitchingToUse,
      myStats,
      selectedEntry.name
    );
    if (!myAdapt.ok) {
      const reasons = myAdapt.issues.map((i) => i.kind).join(", ");
      setError(`내 라인업을 변환하지 못했습니다 (${reasons}). 라인업을 다시 확인해주세요.`);
      return;
    }

    // 상대팀 자동 생성
    const opponent = buildFakeOpponentTeam(opponentTeamId, seed);
    if (!opponent) {
      setError("상대팀 데이터를 로드하지 못했습니다.");
      return;
    }

    // 홈/원정 — v1 스캐폴드에선 내가 홈 고정
    const input = {
      home: myAdapt.team,
      away: opponent,
      context: {}
    };

    saveMatchSession({
      myTeamId: selectedEntry.teamId,
      opponentTeamId,
      seed,
      input,
      startedAt: new Date().toISOString(),
      source: "ai"
    });
    setStarting(true);
    router.push("/stadium/play");
  };

  return (
    <AppShell activeTab="stadium" title="경기장 입장" backHref="/stadium/lobby" theme="dark" wide>
      <section className="stadium-enter">
        <header className="stadium-enter-head">
          <h1 className="stadium-h1">매치 미리보기</h1>
          <p className="stadium-sub">내 라인업과 상대 라인업을 확인하고 경기를 시작합니다.</p>
        </header>

        <div className="stadium-enter-vs">
          <div className="stadium-enter-team">
            <span className="stadium-enter-team-label">내 팀</span>
            {selectedEntry ? (
              <>
                <TeamBadge teamId={selectedEntry.teamId} size="lg" />
                <strong>{getTeam(selectedEntry.teamId).name}</strong>
                <span className="stadium-enter-team-sub">{selectedEntry.name}</span>
              </>
            ) : (
              <span className="stadium-enter-empty">라인업 필요</span>
            )}
          </div>
          <span className="stadium-enter-vs-label">VS</span>
          <div className="stadium-enter-team">
            <span className="stadium-enter-team-label">상대</span>
            <TeamBadge teamId={opponentTeam.id} size="lg" />
            <strong>{opponentTeam.name}</strong>
          </div>
        </div>

        {myEntries.length > 0 ? (
          <div className="stadium-enter-picker">
            <span className="stadium-enter-picker-label">출전 라인업 선택</span>
            <div className="stadium-enter-picker-row">
              {myEntries.map((entry) => {
                const team = getTeam(entry.teamId);
                const active = entry.entryId === selectedEntryId;
                const pitcherAuto = entry.pitching === null;
                return (
                  <button
                    key={entry.entryId}
                    type="button"
                    className={`stadium-enter-picker-item ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                  >
                    <TeamBadge teamId={entry.teamId} size="sm" />
                    <span className="stadium-enter-picker-name">{entry.name}</span>
                    <span className="stadium-enter-picker-team">{team.shortName}</span>
                    {pitcherAuto ? (
                      <span className="stadium-enter-picker-tag">투수 자동</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedEntry?.pitching === null ? (
              <p className="stadium-enter-hint">
                투수 라인업이 저장돼있지 않아 자동으로 생성됩니다. 직접 짜려면 라인업 빌더의 &lsquo;투수&rsquo; 탭에서 9명을 채워주세요.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="stadium-enter-empty-box">
            <p>출전 가능한 라인업이 없습니다.</p>
            <p className="stadium-enter-empty-hint">라인업 빌더에서 9명 타순을 모두 채워야 출전할 수 있어요.</p>
            <Link href="/play/lineup" className="stadium-cta-secondary" prefetch>
              라인업 만들러 가기
            </Link>
          </div>
        )}

        {error ? <p className="stadium-error">{error}</p> : null}

        <button
          type="button"
          className="stadium-cta-primary"
          onClick={handleStart}
          disabled={!selectedEntry || starting}
        >
          <Sparkles size={16} />
          <span>{starting ? "준비 중..." : "대결 시작"}</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </AppShell>
  );
}
