"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";

const MAX_NAME_LEN = 12;

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
  // 기존 저장된 긴 이름(이전 한도 20자 시절) 들어와도 12자로 잘라 표시.
  const [renameInput, setRenameInput] = useState(() => initialName.slice(0, MAX_NAME_LEN));

  // 모달 열릴 때마다 초기값으로 리셋 (12자 한도 적용)
  useEffect(() => {
    if (open) setRenameInput(initialName.slice(0, MAX_NAME_LEN));
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
          onChange={(e) => setRenameInput(e.target.value.slice(0, MAX_NAME_LEN))}
          placeholder="팀명"
          maxLength={MAX_NAME_LEN}
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
              const trimmed = renameInput.trim().slice(0, MAX_NAME_LEN);
              if (trimmed) {
                onSubmit(trimmed);
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
