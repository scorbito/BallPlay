"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam, teams } from "@/lib/constants/teams";

type NewSlotModalProps = {
  open: boolean;
  initialTeamId: string;
  seededTeamIds: Set<string>;
  /** 미리보기 placeholder/hint에 사용할 닉네임 */
  nickname: string | null | undefined;
  onClose: () => void;
  /** "만들기" 클릭 시 호출. name이 빈 문자열이면 외부에서 default로 처리 */
  onCreate: (teamId: string, name: string) => void;
};

export function NewSlotModal({
  open,
  initialTeamId,
  seededTeamIds,
  nickname,
  onClose,
  onCreate
}: NewSlotModalProps) {
  const [newSlotTeamId, setNewSlotTeamId] = useState<string>(initialTeamId);
  const [newSlotName, setNewSlotName] = useState<string>("");

  // 모달 열릴 때 초기값 리셋
  useEffect(() => {
    if (open) {
      setNewSlotTeamId(initialTeamId);
      setNewSlotName("");
    }
  }, [open, initialTeamId]);

  return (
    /* 새 슬롯 만들기 모달 */
    <ModalShell
      open={open}
      title="새 라인업 슬롯"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">선수 풀로 사용할 팀과 우리 팀명을 정해주세요.</p>
        <div className="lineup-slot-team-grid">
          {teams.map((team) => {
            const seeded = seededTeamIds.has(team.id);
            const active = team.id === newSlotTeamId;
            return (
              <button
                key={team.id}
                type="button"
                className={`lineup-slot-team-choice ${active ? "is-active" : ""} ${!seeded ? "is-disabled" : ""}`}
                disabled={!seeded}
                onClick={() => setNewSlotTeamId(team.id)}
              >
                <TeamBadge teamId={team.id} size="sm" />
                <span>{team.shortName}</span>
              </button>
            );
          })}
        </div>
        <label className="lineup-newslot-name-label" htmlFor="newslot-team-name">
          팀명 (선택)
        </label>
        <input
          id="newslot-team-name"
          type="text"
          className="lineup-rename-input"
          value={newSlotName}
          onChange={(e) => setNewSlotName(e.target.value)}
          placeholder={`예) ${nickname?.trim() ? `${nickname.trim()}의 ${getTeam(newSlotTeamId).shortName}` : getTeam(newSlotTeamId).name}`}
          maxLength={12}
        />
        <p className="lineup-newslot-name-hint">
          비워두면 &lsquo;
          {nickname?.trim()
            ? `${nickname.trim()}의 ${getTeam(newSlotTeamId).shortName}`
            : getTeam(newSlotTeamId).name}
          &rsquo;으로 저장됩니다. 경기 화면에도 표시되는 이름입니다.
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            onClick={() => {
              // 새 슬롯은 빈 라인업이므로 localStorage만 — 9명 채울 때 DB로 첫 commit.
              onCreate(newSlotTeamId, newSlotName.trim());
            }}
          >
            만들기
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
