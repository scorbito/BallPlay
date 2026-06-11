"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/common/Card";
import { TeamLogo } from "@/components/common/TeamLogo";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import { useAppState } from "@/lib/state/AppState";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildFakeOpponentTeam, type RecentLineupHint } from "@/lib/sim/fakeOpponent";
import { fillMissingPitcherSlotsFromStatsDirectory } from "@/lib/sim/autoPitcherLineup";
import { saveMatchSession } from "@/lib/sim/matchSession";
import { applyBlendedStatsToTeam } from "@/lib/sim/statsLoaderWithRecent";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { beginPlayoffGame } from "@/lib/actions/playoff";
import { listLatestBattingLineupsByTeam } from "@/lib/supabase/query-parts/bpRecentLineups";
import {
  PLAYOFF_ROUND_LABEL,
  PLAYOFF_TOTAL_ROUNDS,
  PLAYOFF_FINAL_WINS_NEEDED,
  type PlayoffRun
} from "@/lib/supabase/query-parts/bpPlayoff";
import {
  buildStatsDirectoryWithRecentFormForLineups,
  getLineupValidPlayerIds
} from "@/lib/sim/lineupStatsDirectory";

/** 진행 중 run 의 대진표 — 현재 라운드 매치업 + 경기 시작 + 결과 히스토리. */
export function PlayoffBracket({ run }: { run: PlayoffRun }) {
  const router = useRouter();
  const { showToast } = useAppState();
  const [oppOpen, setOppOpen] = useState(false);
  // 대진표 진입 시 4팀의 "타순 완성된 최신" 라인업을 실시간 로드 (오늘 경기 전 선발만 있는
  // 행은 건너뛰고 어제 등 완성 라인업 사용). run 생성 시 박제 힌트(lineupHint)는 폴백.
  const [liveHints, setLiveHints] = useState<Record<string, RecentLineupHint>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const res = await listLatestBattingLineupsByTeam(client);
      if (cancelled || !res.ok) return;
      const map: Record<string, RecentLineupHint> = {};
      for (const [tid, row] of Object.entries(res.byTeam)) {
        map[tid] = {
          batting: row.batting,
          starter_roster_id: row.starter_roster_id,
          starter_name: row.starter_name
        };
      }
      setLiveHints(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingGame = run.state.pendingGame ?? null;
  const round = pendingGame?.round ?? run.currentRound;
  // 한국시리즈(마지막 라운드) — 3전 2선승. 완료된 경기들로 시리즈 스코어/차수 계산.
  const isFinal = round === PLAYOFF_TOTAL_ROUNDS;
  const finalGames = run.state.games.filter((g) => g.round === PLAYOFF_TOTAL_ROUNDS);
  const finalWins = finalGames.filter((g) => g.win).length;
  const finalLosses = finalGames.filter((g) => !g.win).length;
  const seriesGameNo = finalWins + finalLosses + 1; // 지금 시작/진행할 경기 차수
  const opp = run.state.opponents.find((o) => o.round === round) ?? null;
  const hintFor = (teamId: string, frozen?: RecentLineupHint | null): RecentLineupHint | null =>
    liveHints[teamId] ?? frozen ?? null;

  // 상대 라인업 — 실시간 최신(타순 완성) 우선, 없으면 박제 힌트. LineupDetailModal 로 표시.
  const oppTeam = useMemo(() => {
    if (!opp) return null;
    const t = buildFakeOpponentTeam(opp.teamId, opp.lineupSeed, hintFor(opp.teamId, opp.lineupHint));
    return t ? { ...t, displayName: opp.teamName } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, liveHints]);
  const gameByRound = new Map(run.state.games.map((g) => [g.round, g]));
  // 1위(한국시리즈)가 위, 현재(4·5위전)가 아래 — 바닥에서 위로 올라가는 연출.
  const ladder = [...run.state.opponents].sort((a, b) => b.round - a.round);

  const startGame = async () => {
    if (!opp) return;

    const openSavedGame = async (runForGame: PlayoffRun): Promise<boolean> => {
      const pending = runForGame.state.pendingGame;
      const savedLineup = runForGame.state.myLineup;
      if (!pending || !savedLineup) {
        showToast("\uC9C4\uD589 \uC911\uC778 \uACBD\uAE30 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694.");
        return false;
      }
      const savedOpp = runForGame.state.opponents.find((o) => o.round === pending.round);
      if (!savedOpp) {
        showToast("\uC0C1\uB300 \uD300 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694.");
        return false;
      }
      const client = createSupabaseBrowserClient();
      const dir = await buildStatsDirectoryWithRecentFormForLineups(
        client,
        [{ teamId: runForGame.teamId, batting: savedLineup.batting, pitching: savedLineup.pitching }],
        [savedOpp.teamId]
      );
      const pitching = fillMissingPitcherSlotsFromStatsDirectory(
        runForGame.teamId,
        savedLineup.pitching.slots,
        dir,
        getLineupValidPlayerIds(runForGame.teamId, savedLineup.batting)
      );
      if (!pitching) {
        showToast("\uD22C\uC218 \uAD6C\uC131\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.");
        return false;
      }
      const myAdapt = buildSimTeamInput(
        runForGame.teamId,
        savedLineup.batting,
        pitching,
        dir,
        pending.myDisplayName ?? runForGame.teamName
      );
      if (!myAdapt.ok) {
        showToast("\uB0B4 \uB77C\uC778\uC5C5 \uAD6C\uC131\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.");
        return false;
      }
      const opponentRaw = buildFakeOpponentTeam(
        savedOpp.teamId,
        savedOpp.lineupSeed,
        pending.oppLineupHint ?? savedOpp.lineupHint ?? null
      );
      if (!opponentRaw) {
        showToast("\uC0C1\uB300 \uD300 \uAD6C\uC131\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.");
        return false;
      }
      const opponent = applyBlendedStatsToTeam(opponentRaw, dir);
      // 한국시리즈: 이 경기를 이기면 우승 확정(이미 1승)인지 → 결과 화면 우승 연출 트리거.
      const seriesWins = runForGame.state.games.filter(
        (g) => g.round === PLAYOFF_TOTAL_ROUNDS && g.win
      ).length;
      const playoffClinch =
        pending.round === PLAYOFF_TOTAL_ROUNDS && seriesWins >= PLAYOFF_FINAL_WINS_NEEDED - 1;
      saveMatchSession({
        myTeamId: runForGame.teamId,
        opponentTeamId: savedOpp.teamId,
        seed: pending.playSeed,
        input: { home: myAdapt.team, away: opponent, context: {} },
        startedAt: pending.startedAt,
        source: "playoff",
        playoffRunId: runForGame.id,
        playoffRound: pending.round,
        playoffClinch
      });
      router.push("/stadium/play");
      return true;
    };

    if (run.state.pendingGame) {
      await openSavedGame(run);
      return;
    }

    let batting = run.state.myLineup?.batting ?? null;
    let pitchingSlots = run.state.myLineup?.pitching.slots ?? null;
    let displayName = run.teamName;
    if (!batting || !pitchingSlots) {
      const entry = loadLineupEntries().find((e) => e.entryId === run.state.myEntryId);
      if (!entry) {
        showToast("\uAC00\uC744\uC57C\uAD6C \uD300\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC5B4\uC694. \uD300 \uAD00\uB9AC\uC5D0\uC11C \uD655\uC778\uD574\uC8FC\uC138\uC694.");
        return;
      }
      if (entry.batting.slots.length !== 9 || !entry.pitching?.slots?.[0]) {
        showToast("\uCD9C\uC804 \uB77C\uC778\uC5C5\uC774 \uC644\uC131\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694.");
        return;
      }
      batting = entry.batting;
      pitchingSlots = entry.pitching.slots;
      displayName = entry.name;
    }
    const pitchingSeed = {
      teamId: run.teamId,
      slots: pitchingSlots,
      updatedAt: new Date().toISOString(),
      lineupType: batting.lineupType,
      rosterSourceId: batting.rosterSourceId
    };
    const client = createSupabaseBrowserClient();
    const dir = await buildStatsDirectoryWithRecentFormForLineups(
      client,
      [{ teamId: run.teamId, batting, pitching: pitchingSeed }],
      [opp.teamId]
    );
    const pitching = fillMissingPitcherSlotsFromStatsDirectory(
      run.teamId,
      pitchingSlots,
      dir,
      getLineupValidPlayerIds(run.teamId, batting)
    );
    if (!pitching) {
      showToast("\uD22C\uC218 \uAD6C\uC131\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.");
      return;
    }
    const oppLineupHint = hintFor(opp.teamId, opp.lineupHint);
    const result = await beginPlayoffGame({
      runId: run.id,
      round,
      oppTeamId: opp.teamId,
      batting,
      pitching,
      myDisplayName: displayName,
      oppLineupHint
    });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    await openSavedGame(result.run);
  };

  return (
    <section className="playoff-bracket">
      <ul className="playoff-ladder">
        {ladder.map((o) => {
          const isCurrent = o.round === round;
          const isFinalRow = o.round === PLAYOFF_TOTAL_ROUNDS;
          let cls: string;
          let statusText: string;
          if (isFinalRow && finalGames.length > 0) {
            // 한국시리즈 시리즈 — 스코어로 표시. 2승=승(우승) / 2패=패 / 그 외=현재.
            cls =
              finalWins >= PLAYOFF_FINAL_WINS_NEEDED
                ? "is-win"
                : finalLosses >= PLAYOFF_FINAL_WINS_NEEDED
                  ? "is-loss"
                  : "is-current";
            statusText = `${finalWins}승 ${finalLosses}패`;
          } else {
            const g = gameByRound.get(o.round);
            cls = g ? (g.win ? "is-win" : "is-loss") : isCurrent ? "is-current" : "is-upcoming";
            statusText = g
              ? `${g.score.me}:${g.score.opp} ${g.win ? "승" : "패"}`
              : isCurrent
                ? "현재"
                : "예정";
          }
          return (
            <li key={o.round} className={`playoff-ladder-row ${cls}`}>
              <span className="playoff-ladder-round">{PLAYOFF_ROUND_LABEL[o.round]}</span>
              <TeamLogo teamId={o.teamId} size="sm" />
              <span className="playoff-ladder-name">{o.teamName}</span>
              <span className="playoff-ladder-seed">{5 - o.round}위</span>
              <span className="playoff-ladder-status">{statusText}</span>
            </li>
          );
        })}
      </ul>

      {pendingGame ? (
        <div className="playoff-pending-card">
          <strong>{"\uC9C4\uD589 \uC911\uC778 \uACBD\uAE30\uAC00 \uC788\uC5B4\uC694"}</strong>
          <span>{"\uC800\uC7A5\uB41C \uB77C\uC778\uC5C5\uACFC \uAC19\uC740 \uC2DC\uB4DC\uB85C \uB2E4\uC2DC \uC2DC\uC791\uD569\uB2C8\uB2E4."}</span>
        </div>
      ) : null}

      <Card className="playoff-matchup">
        {/* 왼쪽=상대(상대 라인업 보기 버튼), 오른쪽=내 팀(내 라인업 수정 버튼) — 버튼과 좌우 정렬 일치.
            가운데 칩=현재 라운드(VS 대신, 두 팀 로고 사이) */}
        <div className="playoff-matchup-team">
          <TeamLogo teamId={opp?.teamId ?? ""} size="lg" />
          <strong>{opp?.teamName ?? "-"}</strong>
          <span className="playoff-seed">{opp ? `${5 - round}위 · AI` : ""}</span>
        </div>
        <div className="playoff-vs">
          <span className="playoff-vs-round">{PLAYOFF_ROUND_LABEL[round]}</span>
          <span className="playoff-vs-text">VS</span>
          {isFinal ? <span className="playoff-vs-series">{seriesGameNo}차전</span> : null}
        </div>
        <div className="playoff-matchup-team">
          <TeamLogo teamId={run.teamId} size="lg" />
          <strong>{run.teamName}</strong>
          <span className="playoff-seed">5위 · 나</span>
        </div>
      </Card>

      <div className="playoff-secondary-row">
        {opp ? (
          <button type="button" className="playoff-secondary-btn" onClick={() => setOppOpen(true)}>
            상대 라인업 보기
          </button>
        ) : null}
        {!pendingGame ? (
          <button
            type="button"
            className="playoff-secondary-btn"
            onClick={() => router.push("/stadium/playoff/edit")}
          >
            {"\uB0B4 \uB77C\uC778\uC5C5 \uC218\uC815"}
          </button>
        ) : null}
      </div>

      <button type="button" className="stadium-cta-primary playoff-start-btn" onClick={() => void startGame()}>
        {pendingGame ? "\uACBD\uAE30 \uC774\uC5B4\uBCF4\uAE30" : "\uACBD\uAE30 \uC2DC\uC791"}
      </button>

      <LineupDetailModal open={oppOpen} team={oppTeam} onClose={() => setOppOpen(false)} />
    </section>
  );
}
