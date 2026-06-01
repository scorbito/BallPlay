"use client";

import { ModalShell } from "@/components/common/ModalShell";

type ConfirmOverwriteRecentModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmOverwriteRecentModal({
  open,
  onCancel,
  onConfirm
}: ConfirmOverwriteRecentModalProps) {
  return (
    /* 기존 슬롯이 채워져 있을 때 덮어쓰기 확인 */
    <ModalShell
      open={open}
      title="현재 라인업 덮어쓰기"
      onClose={onCancel}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          지금 짜둔 라인업을 <strong>최근 경기 라인업으로 덮어쓸까요?</strong><br />
          기존 타순·선발은 사라집니다. (불펜은 유지)
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
            덮어쓰기
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
