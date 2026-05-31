"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { LineupEntry } from "@/lib/types/lineup";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import {
  applyBlendedStatsToTeam,
  buildStatsDirectoryWithRecentForm
} from "@/lib/sim/statsLoaderWithRecent";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLatestLineupForTeam, type RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import { fetchLineupStatsBulk, listMyLineups, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import {
  generateSeed,
  saveMatchSession
} from "@/lib/sim/matchSession";

export function EnterScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const opponentTeamId = params.get("opponent") ?? "lg";
  const opponentTeam = useMemo(() => getTeam(opponentTeamId), [opponentTeamId]);

  const [myEntries, setMyEntries] = useState<LineupEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // 상대팀 최근 라인업 prefetch — buildFakeOpponentTeam에 hint로 전달.
  // 못 받아오면 null로 폴백(시즌 stats 랜덤).
  const [opponentHint, setOpponentHint] = useState<RecentLineupRow | null>(null);
  // 공개 라인업 전적 — picker 라벨 옆 표시용. 비공개 entry는 stats 없음.
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, LineupStats>>({});

  useEffect(() => {
    // 9명 batting이 다 채워진 entry만 출전 가능
    const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
    setMyEntries(ready);
    if (ready.length > 0) setSelectedEntryId(ready[0].entryId);
  }, []);

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

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void getLatestLineupForTeam(client, opponentTeamId).then((res) => {
      if (res.ok) setOpponentHint(res.row);
    });
  }, [opponentTeamId]);

  const selectedEntry = useMemo(
    () => myEntries.find((e) => e.entryId === selectedEntryId) ?? null,
    [myEntries, selectedEntryId]
  );

  const handleStart = async () => {
    if (!selectedEntry) {
      setError("출전할 라인업을 선택해주세요.");
      return;
    }

    setStarting(true);
    const seed = generateSeed();

    // 투수 라인업 없으면 자동 보강
    // partial pitching(선발만 있는 등)도 안전하게 9슬롯으로 보강
    const pitchingToUse = fillMissingPitcherSlots(
      selectedEntry.teamId,
      selectedEntry.pitching?.slots ?? []
    );
    if (!pitchingToUse) {
      setError("투수 라인업을 자동 생성하지 못했습니다.");
      setStarting(false);
      return;
    }

    // 양팀 능력치 — 시즌 baseline + 주간 델타 블렌드(최근 폼 반영).
    // DB fetch 실패 시 baseline JSON으로 graceful fallback.
    const client = createSupabaseBrowserClient();
    const enhancedDir = await buildStatsDirectoryWithRecentForm(
      client,
      [selectedEntry.teamId, opponentTeamId]
    );

    // 내 팀 변환 (entry.name을 displayName으로 전달)
    const myAdapt = buildSimTeamInput(
      selectedEntry.teamId,
      selectedEntry.batting,
      pitchingToUse,
      enhancedDir,
      selectedEntry.name
    );
    if (!myAdapt.ok) {
      const reasons = myAdapt.issues.map((i) => i.kind).join(", ");
      setError(`내 라인업을 변환하지 못했습니다 (${reasons}). 라인업을 다시 확인해주세요.`);
      setStarting(false);
      return;
    }

    // 상대팀 자동 생성 — 최근 라인업이 있으면 그걸 기준으로(타순·선발투수), 없으면 시즌 stats 랜덤 폴백.
    // 생성 후 블렌드된 디렉터리로 후처리 → 상대팀 선수도 최근 폼 반영.
    const opponentRaw = buildFakeOpponentTeam(opponentTeamId, seed, opponentHint);
    if (!opponentRaw) {
      setError("상대팀 데이터를 로드하지 못했습니다.");
      setStarting(false);
      return;
    }
    const opponent = applyBlendedStatsToTeam(opponentRaw, enhancedDir);

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
    router.push("/stadium/play");
  };

  return (
    <AppShell activeTab="stadium" title="경기장 입장" backHref="/stadium/lobby" theme="light" wide>
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
                {/* 라인업명이 팀 정식명과 같으면 중복이라 sub 라인 숨김 */}
                {selectedEntry.name !== getTeam(selectedEntry.teamId).name ? (
                  <span className="stadium-enter-team-sub">{selectedEntry.name}</span>
                ) : null}
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
          <div className="stadium-discover-my-picker">
            <span className="stadium-discover-my-picker-label">출전 라인업 선택</span>
            <div className="stadium-discover-my-picker-list">
              {myEntries.map((entry) => {
                const active = entry.entryId === selectedEntryId;
                const pitcherAuto = entry.pitching === null;
                const s = statsByEntryId[entry.entryId];
                const recordTxt = s && s.matches > 0
                  ? ` (${s.wins}승 ${s.losses}패)`
                  : "";
                return (
                  <button
                    key={entry.entryId}
                    type="button"
                    className={`stadium-discover-my-pick ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                  >
                    <TeamBadge teamId={entry.teamId} size="sm" />
                    <span>{entry.name}{recordTxt}</span>
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
