"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/common/Card";
import { TeamLogo } from "@/components/common/TeamLogo";
import { useAppState } from "@/lib/state/AppState";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { getRoster } from "@/lib/rosters";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { saveMatchSession, generateSeed } from "@/lib/sim/matchSession";
import {
  PLAYOFF_ROUND_LABEL,
  PLAYOFF_TOTAL_ROUNDS,
  type PlayoffRun
} from "@/lib/supabase/query-parts/bpPlayoff";

/** 진행 중 run 의 대진표 — 현재 라운드 매치업 + 경기 시작 + 결과 히스토리. */
export function PlayoffBracket({ run }: { run: PlayoffRun }) {
  const router = useRouter();
  const { showToast } = useAppState();
  const round = run.currentRound;
  const opp = run.state.opponents.find((o) => o.round === round) ?? null;

  const startGame = () => {
    if (!opp) return;
    const entry = loadLineupEntries().find((e) => e.entryId === run.state.myEntryId);
    if (!entry) {
      showToast("도전한 팀을 찾을 수 없어요. 팀 관리에서 확인해주세요.");
      return;
    }
    if (entry.batting.slots.length !== 9 || !entry.pitching?.slots?.[0]) {
      showToast("이 팀의 라인업이 완성돼 있지 않아요.");
      return;
    }
    const validIds = new Set(getRoster(entry.teamId).map((p) => p.id));
    const pitching = fillMissingPitcherSlots(entry.teamId, entry.pitching?.slots ?? [], validIds) ?? entry.pitching;
    if (!pitching) {
      showToast("투수 구성에 실패했어요.");
      return;
    }
    const dir = buildStatsDirectory([entry.teamId]);
    const myAdapt = buildSimTeamInput(entry.teamId, entry.batting, pitching, dir, entry.name);
    if (!myAdapt.ok) {
      showToast("내 라인업 구성에 실패했어요.");
      return;
    }
    // 상대는 lineupSeed 로 박제(결정적) — 매번 같은 상대 라인업.
    const opponent = buildFakeOpponentTeam(opp.teamId, opp.lineupSeed, null);
    if (!opponent) {
      showToast("상대 팀 구성에 실패했어요.");
      return;
    }
    const playSeed = generateSeed();
    saveMatchSession({
      myTeamId: entry.teamId,
      opponentTeamId: opp.teamId,
      seed: playSeed,
      input: { home: myAdapt.team, away: opponent, context: {} },
      startedAt: new Date().toISOString(),
      source: "playoff",
      playoffRunId: run.id,
      playoffRound: round
    });
    router.push("/stadium/play");
  };

  return (
    <section className="playoff-bracket">
      <header className="playoff-bracket-head">
        <span className="playoff-round-chip">{PLAYOFF_ROUND_LABEL[round]}</span>
        <span className="playoff-round-progress">{round} / {PLAYOFF_TOTAL_ROUNDS}</span>
      </header>

      <Card className="playoff-matchup">
        <div className="playoff-matchup-team">
          <TeamLogo teamId={run.teamId} size="lg" />
          <strong>{run.teamName}</strong>
          <span className="playoff-seed">5위 · 나</span>
        </div>
        <span className="playoff-vs">VS</span>
        <div className="playoff-matchup-team">
          <TeamLogo teamId={opp?.teamId ?? ""} size="lg" />
          <strong>{opp?.teamName ?? "-"}</strong>
          <span className="playoff-seed">{opp ? `${5 - round}위 · AI` : ""}</span>
        </div>
      </Card>

      <button type="button" className="stadium-cta-primary playoff-start-btn" onClick={startGame}>
        경기 시작
      </button>

      {run.state.games.length > 0 ? (
        <ul className="playoff-history">
          {run.state.games.map((g) => (
            <li key={g.round} className={`playoff-history-item ${g.win ? "is-win" : "is-loss"}`}>
              <span className="playoff-history-round">{PLAYOFF_ROUND_LABEL[g.round]}</span>
              <span className="playoff-history-score">{g.score.me} : {g.score.opp}</span>
              <span className="playoff-history-badge">{g.win ? "승" : "패"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
