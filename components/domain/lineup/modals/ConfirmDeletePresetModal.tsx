"use client";

import { ModalShell } from "@/components/common/ModalShell";

type ConfirmDeletePresetModalProps = {
  open: boolean;
  presetName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 프리셋 삭제 확인 — 저장된 라인업 스냅샷만 지움(현재 편집본·전적엔 영향 없음). */
export function ConfirmDeletePresetModal({
  open,
  presetName,
  onCancel,
  onConfirm
}: ConfirmDeletePresetModalProps) {
  return (
    <ModalShell
      open={open}
      title="프리셋 삭제"
      onClose={onCancel}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          <strong>{presetName}</strong> 프리셋을 삭제할까요?<br />
          저장된 라인업 스냅샷만 지워지고, 지금 편집 중인 라인업과 전적에는 영향이 없어요.
        </p>
        <div className="lineup-confirm-actions">
          <button type="button" className="lineup-confirm-cancel" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="lineup-confirm-destruct" onClick={onConfirm}>
            삭제
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
