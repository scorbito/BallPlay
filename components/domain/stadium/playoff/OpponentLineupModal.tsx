"use client";

import { ModalShell } from "@/components/common/ModalShell";
import { TeamLogo } from "@/components/common/TeamLogo";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";

type Props = {
  open: boolean;
  teamId: string;
  teamName: string;
  lineupSeed: number;
  onClose: () => void;
};

function battingHandLabel(h: "L" | "R" | "S"): string {
  return h === "L" ? "좌타" : h === "R" ? "우타" : "양타";
}

function fmtAvg(avg: number): string {
  // 0.285 → ".285"
  return avg.toFixed(3).replace(/^0(?=\.)/, "");
}

/** 상대 AI 라인업 보기 — lineupSeed 로 박제된 실제 경기 라인업과 동일. */
export function OpponentLineupModal({ open, teamId, teamName, lineupSeed, onClose }: Props) {
  // 모달 열릴 때만 빌드 (정적·결정적, 가벼움).
  const team = open ? buildFakeOpponentTeam(teamId, lineupSeed, null) : null;

  return (
    <ModalShell open={open} title="상대 라인업" onClose={onClose} panelClassName="playoff-opp-modal-panel">
      <div className="playoff-opp">
        <div className="playoff-opp-head">
          <TeamLogo teamId={teamId} size="sm" />
          <strong>{teamName}</strong>
        </div>

        {!team ? (
          <p className="playoff-opp-empty">상대 정보를 불러올 수 없어요.</p>
        ) : (
          <>
            <div className="playoff-opp-starter">
              <span className="playoff-opp-starter-label">선발</span>
              <strong>{team.starter.name}</strong>
              <span className="playoff-opp-hand">
                {team.starter.throwingHand === "L" ? "좌투" : "우투"}
              </span>
            </div>

            <ol className="playoff-opp-order">
              {team.batters.map((b, i) => (
                <li key={b.playerId} className="playoff-opp-batter">
                  <span className="playoff-opp-num">{i + 1}</span>
                  <span className="playoff-opp-name">{b.name}</span>
                  <span className="playoff-opp-hand">{battingHandLabel(b.battingHand)}</span>
                  <span className="playoff-opp-stat">
                    {fmtAvg(b.avg)} · {b.homers}홈런
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </ModalShell>
  );
}
