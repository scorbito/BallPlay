"use client";

import { ModalShell } from "@/components/common/ModalShell";

type AutoFillPublishModalProps = {
  open: boolean;
  publishProcessing: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** 마무리/불펜 자동 채움 안내 모달 — 빈 자리만 자동 채워서 출전 등록.
 *  실제 채움 + DB upsert + togglePublished는 부모의 onConfirm에서 처리. */
export function AutoFillPublishModal({
  open,
  publishProcessing,
  onConfirm,
  onClose
}: AutoFillPublishModalProps) {
  return (
    <ModalShell
      open={open}
      title="마무리·불펜 자동 채움"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          마무리·불펜 빈 자리를 <strong>자동으로 채워서 공개</strong>합니다.<br />
          <br />
          · 마무리 — 세이브 많은 선수<br />
          · 불펜 — 평균자책점 좋은 선수<br />
          <br />
          직접 짜려면 취소 후 투수 탭에서 선택해주세요.
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
            disabled={publishProcessing}
          >
            취소
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            disabled={publishProcessing}
            onClick={onConfirm}
          >
            자동 채움 + 공개
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
