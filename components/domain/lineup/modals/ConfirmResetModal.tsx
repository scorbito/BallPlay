"use client";

import { ModalShell } from "@/components/common/ModalShell";

type ConfirmResetModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmResetModal({ open, onCancel, onConfirm }: ConfirmResetModalProps) {
  return (
    /* 라인업 비우기 확인 모달 */
    <ModalShell
      open={open}
      title="라인업 비우기"
      onClose={onCancel}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          지금 짜둔 라인업을 모두 비우시겠어요?<br />
          저장된 데이터도 함께 사라집니다.
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="lineup-confirm-destruct"
            onClick={onConfirm}
          >
            비우기
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
