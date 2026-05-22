"use client";

import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";

type LineupDetailModalProps = {
  open: boolean;
  team: SimTeamInput | null;
  onClose: () => void;
};

const HAND_LABEL: Record<"L" | "R" | "S", string> = { L: "좌", R: "우", S: "양" };

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
      <section className="lineup-detail-section">
        <h3>타순</h3>
        <ol className="lineup-detail-batters">
          {team.batters.map((b, i) => (
            <li key={b.playerId}>
              <span className="lineup-detail-order">{i + 1}</span>
              <span className="lineup-detail-name">{b.name}</span>
              <span className="lineup-detail-hand">{HAND_LABEL[b.battingHand]}타</span>
              <span className="lineup-detail-stat">
                AVG <strong>{b.avg.toFixed(3).replace(/^0/, "")}</strong>
              </span>
              <span className="lineup-detail-stat">
                OPS <strong>{(b.obp + b.slg).toFixed(3).replace(/^0/, "")}</strong>
              </span>
              <span className="lineup-detail-stat">
                HR <strong>{b.homers}</strong>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="lineup-detail-section">
        <h3>투수</h3>
        <div className="lineup-detail-pitcher">
          <span className="lineup-detail-role">선발</span>
          <span className="lineup-detail-name">{team.starter.name}</span>
          <span className="lineup-detail-hand">{HAND_LABEL[team.starter.throwingHand]}투</span>
          <span className="lineup-detail-stat">
            ERA <strong>{team.starter.era.toFixed(2)}</strong>
          </span>
          <span className="lineup-detail-stat">
            K/9 <strong>{team.starter.k9.toFixed(1)}</strong>
          </span>
        </div>
        {team.bullpen.length > 0 ? (
          <ul className="lineup-detail-bullpen">
            {team.bullpen.map((p) => (
              <li key={p.playerId}>
                <span className="lineup-detail-role">{p.role === "CL" ? "마무리" : "불펜"}</span>
                <span className="lineup-detail-name">{p.name}</span>
                <span className="lineup-detail-hand">{HAND_LABEL[p.throwingHand]}투</span>
                <span className="lineup-detail-stat">
                  ERA <strong>{p.era.toFixed(2)}</strong>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lineup-detail-empty">불펜 없음 (자동 처리)</p>
        )}
      </section>
    </ModalShell>
  );
}
