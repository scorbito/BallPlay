"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";

type RenameSlotModalProps = {
  open: boolean;
  /** 모달 오픈 시 input 초기값으로 사용할 현재 팀명 */
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function RenameSlotModal({
  open,
  initialName,
  onClose,
  onSubmit
}: RenameSlotModalProps) {
  const [renameInput, setRenameInput] = useState(initialName);

  // 모달 열릴 때마다 초기값으로 리셋
  useEffect(() => {
    if (open) setRenameInput(initialName);
  }, [open, initialName]);

  return (
    /* 슬롯 이름 변경 모달 */
    <ModalShell
      open={open}
      title="팀명 변경"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">경기 화면에 표시될 우리 팀명을 입력하세요.</p>
        <input
          type="text"
          className="lineup-rename-input"
          value={renameInput}
          onChange={(e) => setRenameInput(e.target.value)}
          placeholder="팀명"
          maxLength={12}
          autoFocus
        />
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
              if (renameInput.trim()) {
                onSubmit(renameInput.trim());
              }
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
