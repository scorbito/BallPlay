"use client";

// AI 대전 매치 미리보기 + 라인업 picker + 시작 버튼.
// AppShell(EnterScreen) 과 ModalShell(AiChallengeModal) 양쪽에서 재사용.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TeamLogo } from "@/components/common/TeamLogo";
import { getTeam, teams as ALL_TEAMS } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import type { LineupEntry } from "@/lib/types/lineup";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { autoFillBattingLineup } from "@/lib/sim/autoBattingLineup";
import { autoFillPitcherLineup, fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import {
  applyBlendedStatsToTeam,
  buildStatsDirectoryWithRecentForm
} from "@/lib/sim/statsLoaderWithRecent";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLatestLineupForTeam, type RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import { fetchLineupStatsBulk, listMyLineups, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

type Props = {
  opponentTeamId: string;
  /** 모달용: 시작 직전에 호출 (모달 닫기 등). 페이지에선 미사용. */
  onBeforeStart?: () => void;
};

export function AiChallengeBody({ opponentTeamId, onBeforeStart }: Props) {
  const router = useRouter();
  const opponentTeam = useMemo(() => getTeam(opponentTeamId), [opponentTeamId]);

  const [myEntries, setMyEntries] = useState<LineupEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [opponentHint, setOpponentHint] = useState<RecentLineupRow | null>(null);
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, LineupStats>>({});

  useEffect(() => {
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

    const validIds = new Set(getRoster(selectedEntry.teamId).map((p) => p.id));
    const pitchingToUse = fillMissingPitcherSlots(
      selectedEntry.teamId,
      selectedEntry.pitching?.slots ?? [],
      validIds
    );
    if (!pitchingToUse) {
      setError("투수 라인업을 자동 생성하지 못했습니다.");
      setStarting(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    const enhancedDir = await buildStatsDirectoryWithRecentForm(
      client,
      [selectedEntry.teamId, opponentTeamId]
    );

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

    const opponentRaw = buildFakeOpponentTeam(opponentTeamId, seed, opponentHint);
    if (!opponentRaw) {
      setError("상대팀 데이터를 로드하지 못했습니다.");
      setStarting(false);
      return;
    }
    const opponent = applyBlendedStatsToTeam(opponentRaw, enhancedDir);

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
    onBeforeStart?.();
    router.push("/stadium/play");
  };

  // 라인업이 없을 때의 즉석 체험 — 무작위 팀(상대 제외)으로 자동 타순/투수 생성 후 매치.
  // 저장은 하지 않음(임시). 결과 화면 후 뒤로가기는 평소처럼 /play/practice 로.
  const handleAiTrialStart = async () => {
    setStarting(true);
    try {
      // 1. 상대 팀이 아닌 다른 팀 중에서 무작위로 1개 선택
      const candidates = ALL_TEAMS.filter((t) => t.id !== opponentTeamId);
      if (candidates.length === 0) {
        setError("자동 라인업을 만들 팀이 없습니다.");
        setStarting(false);
        return;
      }
      const myTeamId = candidates[Math.floor(Math.random() * candidates.length)].id;

      const seed = generateSeed();
      const validIds = new Set(getRoster(myTeamId).map((p) => p.id));

      // 2. 자동 타순 + 자동 투수 라인업
      const autoBatting = autoFillBattingLineup(myTeamId);
      if (!autoBatting) {
        setError("자동 타순 생성에 실패했습니다.");
        setStarting(false);
        return;
      }
      const autoPitching = autoFillPitcherLineup(myTeamId, validIds);
      if (!autoPitching) {
        setError("자동 투수 라인업 생성에 실패했습니다.");
        setStarting(false);
        return;
      }
      // stale-id 호환 — autoFillPitcherLineup도 내부적으로 validIds를 쓰지만
      // 일관성을 위해 fillMissingPitcherSlots로 한 번 더 통과.
      const pitchingToUse = fillMissingPitcherSlots(myTeamId, autoPitching.slots, validIds);
      if (!pitchingToUse) {
        setError("투수 라인업을 자동 생성하지 못했습니다.");
        setStarting(false);
        return;
      }

      // 3. 스탯 디렉터리 빌드 + SimTeamInput 변환
      const client = createSupabaseBrowserClient();
      const enhancedDir = await buildStatsDirectoryWithRecentForm(
        client,
        [myTeamId, opponentTeamId]
      );

      const myAdapt = buildSimTeamInput(
        myTeamId,
        autoBatting,
        pitchingToUse,
        enhancedDir,
        `${getTeam(myTeamId).name} (AI 자동)`
      );
      if (!myAdapt.ok) {
        const reasons = myAdapt.issues.map((i) => i.kind).join(", ");
        setError(`자동 라인업 변환에 실패했습니다 (${reasons}).`);
        setStarting(false);
        return;
      }

      const opponentRaw = buildFakeOpponentTeam(opponentTeamId, seed, opponentHint);
      if (!opponentRaw) {
        setError("상대팀 데이터를 로드하지 못했습니다.");
        setStarting(false);
        return;
      }
      const opponent = applyBlendedStatsToTeam(opponentRaw, enhancedDir);

      const input = {
        home: myAdapt.team,
        away: opponent,
        context: {}
      };

      // 임시 매치라 saveMatchSession은 그대로 사용하되 source="ai" 유지.
      saveMatchSession({
        myTeamId,
        opponentTeamId,
        seed,
        input,
        startedAt: new Date().toISOString(),
        source: "ai"
      });
      onBeforeStart?.();
      router.push("/stadium/play");
    } catch (e) {
      setError("자동 체험 매치 준비 중 오류가 발생했습니다.");
      setStarting(false);
    }
  };

  return (
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
              <TeamLogo teamId={selectedEntry.teamId} size="lg" />
              <strong>{selectedEntry.name}</strong>
            </>
          ) : (
            <span className="stadium-enter-empty">라인업 필요</span>
          )}
        </div>
        <span className="stadium-enter-vs-label">VS</span>
        <div className="stadium-enter-team">
          <span className="stadium-enter-team-label">상대</span>
          <TeamLogo teamId={opponentTeam.id} size="lg" />
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
          <Link href="/play/lineup" className="stadium-cta-primary" prefetch>
            라인업 만들러 가기
          </Link>
          <button
            type="button"
            className="stadium-cta-outline-pink"
            onClick={handleAiTrialStart}
            disabled={starting}
          >
            <Bot size={16} />
            <span>{starting ? "준비 중..." : "AI 자동 라인업으로 체험"}</span>
          </button>
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
  );
}
