"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/common/Card";
import { TeamLogo } from "@/components/common/TeamLogo";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
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
  const [oppOpen, setOppOpen] = useState(false);
  const round = run.currentRound;
  const opp = run.state.opponents.find((o) => o.round === round) ?? null;
  // 상대 라인업(시드 박제) — 기존 LineupDetailModal 로 보여줌. 팀명 표시용 displayName 부여.
  const oppTeam = useMemo(() => {
    if (!opp) return null;
    const t = buildFakeOpponentTeam(opp.teamId, opp.lineupSeed, opp.lineupHint ?? null);
    return t ? { ...t, displayName: opp.teamName } : null;
  }, [opp]);
  const gameByRound = new Map(run.state.games.map((g) => [g.round, g]));
  // 1위(한국시리즈)가 위, 현재(4·5위전)가 아래 — 바닥에서 위로 올라가는 연출.
  const ladder = [...run.state.opponents].sort((a, b) => b.round - a.round);

  const startGame = () => {
    if (!opp) return;
    // 임시 라인업(편집본)이 있으면 그걸로, 없으면 팀의 현재 라인업으로.
    let batting = run.state.myLineup?.batting ?? null;
    let pitchingSlots = run.state.myLineup?.pitching.slots ?? null;
    let displayName = run.teamName;
    if (!batting || !pitchingSlots) {
      const entry = loadLineupEntries().find((e) => e.entryId === run.state.myEntryId);
      if (!entry) {
        showToast("도전한 팀을 찾을 수 없어요. 팀 관리에서 확인해주세요.");
        return;
      }
      if (entry.batting.slots.length !== 9 || !entry.pitching?.slots?.[0]) {
        showToast("이 팀의 라인업이 완성돼 있지 않아요.");
        return;
      }
      batting = entry.batting;
      pitchingSlots = entry.pitching.slots;
      displayName = entry.name;
    }
    const validIds = new Set(getRoster(run.teamId).map((p) => p.id));
    const pitching = fillMissingPitcherSlots(run.teamId, pitchingSlots, validIds);
    if (!pitching) {
      showToast("투수 구성에 실패했어요.");
      return;
    }
    const dir = buildStatsDirectory([run.teamId]);
    const myAdapt = buildSimTeamInput(run.teamId, batting, pitching, dir, displayName);
    if (!myAdapt.ok) {
      showToast("내 라인업 구성에 실패했어요.");
      return;
    }
    // 상대는 DB 최신 라인업(박제) 기준. 힌트 없으면 시즌 스탯 폴백. lineupSeed 로 결정적.
    const opponent = buildFakeOpponentTeam(opp.teamId, opp.lineupSeed, opp.lineupHint ?? null);
    if (!opponent) {
      showToast("상대 팀 구성에 실패했어요.");
      return;
    }
    const playSeed = generateSeed();
    saveMatchSession({
      myTeamId: run.teamId,
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
      <div className="playoff-ladder-head">전체 대진</div>
      <ul className="playoff-ladder">
        {ladder.map((o) => {
          const g = gameByRound.get(o.round);
          const isCurrent = o.round === round;
          const cls = g ? (g.win ? "is-win" : "is-loss") : isCurrent ? "is-current" : "is-upcoming";
          return (
            <li key={o.round} className={`playoff-ladder-row ${cls}`}>
              <span className="playoff-ladder-round">{PLAYOFF_ROUND_LABEL[o.round]}</span>
              <TeamLogo teamId={o.teamId} size="sm" />
              <span className="playoff-ladder-name">{o.teamName}</span>
              <span className="playoff-ladder-seed">{5 - o.round}위</span>
              <span className="playoff-ladder-status">
                {g ? `${g.score.me}:${g.score.opp} ${g.win ? "승" : "패"}` : isCurrent ? "현재" : "예정"}
              </span>
            </li>
          );
        })}
      </ul>

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

      <div className="playoff-secondary-row">
        {opp ? (
          <button type="button" className="playoff-secondary-btn" onClick={() => setOppOpen(true)}>
            상대 라인업 보기
          </button>
        ) : null}
        <button
          type="button"
          className="playoff-secondary-btn"
          onClick={() => router.push("/stadium/playoff/edit")}
        >
          내 라인업 수정
        </button>
      </div>

      <button type="button" className="stadium-cta-primary playoff-start-btn" onClick={startGame}>
        경기 시작
      </button>

      <LineupDetailModal open={oppOpen} team={oppTeam} onClose={() => setOppOpen(false)} />
    </section>
  );
}
