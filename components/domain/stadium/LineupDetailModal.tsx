"use client";

// 라인업 상세 모달 — 라인업짜기처럼 타순(포지션+좌/우타) + 투수(선발/불펜, 좌/우투) 표시.
// 매일 바뀌는 시즌 스탯은 표시하지 않음.

import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import type { SimTeamInput } from "@/lib/sim/types";

type LineupDetailModalProps = {
  open: boolean;
  team: SimTeamInput | null;
  onClose: () => void;
};

const HAND_LABEL: Record<"L" | "R" | "S", string> = { L: "좌", R: "우", S: "양" };

const POSITION_LABEL: Record<string, string> = {
  P: "P",
  C: "C",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  SS: "SS",
  LF: "LF",
  CF: "CF",
  RF: "RF",
  DH: "DH"
};

export function LineupDetailModal({ open, team, onClose }: LineupDetailModalProps) {
  if (!team) {
    return (
      <ModalShell
        open={open}
        title="라인업"
        onClose={onClose}
        panelClassName="lineup-detail-panel"
        closeOnBackdrop
      >
        <p>라인업 정보가 없어요.</p>
      </ModalShell>
    );
  }

  const teamMeta = getTeam(team.teamId);
  const lineupName = team.displayName?.trim() || teamMeta.shortName;

  // 포지션 lookup — 사용자가 라인업에서 지정한 포지션(b.position) 우선,
  // 없으면(AI 자동 생성팀 등) 로스터의 primaryPosition으로 폴백.
  const roster = getRoster(team.teamId);
  const positionOf = (playerId: string, simPosition?: string): string => {
    if (simPosition) return POSITION_LABEL[simPosition] ?? simPosition;
    const p = roster.find((r) => r.id === playerId);
    return p?.primaryPosition ? POSITION_LABEL[p.primaryPosition] ?? p.primaryPosition : "—";
  };

  return (
    <ModalShell
      open={open}
      ariaLabel={lineupName}
      title={
        <span className="lineup-detail-title">
          <TeamBadge teamId={team.teamId} size="sm" />
          <span>{lineupName}</span>
        </span>
      }
      onClose={onClose}
      panelClassName="lineup-detail-panel"
      closeOnBackdrop
    >
      <div className="lineup-detail-cols">
        {/* 왼쪽: 타순 */}
        <section className="lineup-detail-col">
          <h3>타순</h3>
          <ol className="lineup-detail-batters">
            {team.batters.map((b, i) => (
              <li key={b.playerId}>
                <span className="lineup-detail-order">{i + 1}</span>
                <span className="lineup-detail-name">{b.name}</span>
                <span className="lineup-detail-pos">{positionOf(b.playerId, b.position)}</span>
                <span className="lineup-detail-hand">{HAND_LABEL[b.battingHand]}타</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 오른쪽: 투수 */}
        <section className="lineup-detail-col">
          <h3>투수</h3>
          <div className="lineup-detail-pitcher">
            <span className="lineup-detail-role">선발</span>
            <span className="lineup-detail-name">{team.starter.name}</span>
            <span className="lineup-detail-hand">{HAND_LABEL[team.starter.throwingHand]}투</span>
          </div>
          {team.bullpen.length > 0 ? (
            <ul className="lineup-detail-bullpen">
              {team.bullpen.map((p) => (
                <li key={p.playerId}>
                  <span className="lineup-detail-role">{p.role === "CL" ? "마무리" : "불펜"}</span>
                  <span className="lineup-detail-name">{p.name}</span>
                  <span className="lineup-detail-hand">{HAND_LABEL[p.throwingHand]}투</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lineup-detail-empty">불펜 없음 (자동 처리)</p>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
