"use client";

import { ModalShell } from "@/components/common/ModalShell";

type ConfirmUnpublishModalProps = {
  open: boolean;
  /** 현재 전적 — 리셋 안내에 표시 */
  stats?: { wins: number; losses: number; draws: number };
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmUnpublishModal({
  open,
  stats,
  processing,
  onCancel,
  onConfirm
}: ConfirmUnpublishModalProps) {
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const draws = stats?.draws ?? 0;
  return (
    /* 공개 → 비공개 전환 확인 모달 (전적 리셋 안내) */
    <ModalShell
      open={open}
      title="비공개로 전환"
      onClose={onCancel}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          비공개로 전환하면 이 라인업의 <strong>현재 전적({wins}승 {losses}패 {draws}무)이 모두 리셋</strong>됩니다.<br />
          그래도 비공개로 바꿀까요?
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onCancel}
            disabled={processing}
          >
            취소
          </button>
          <button
            type="button"
            className="lineup-confirm-destruct"
            disabled={processing}
            onClick={onConfirm}
          >
            비공개로
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type LockInfoModalProps = {
  open: boolean;
  onClose: () => void;
  /** "비공개로 전환" 클릭 시 — 한 번 더 확인 모달로 이어짐 */
  onUnpublish: () => void;
};

export function LockInfoModal({ open, onClose, onUnpublish }: LockInfoModalProps) {
  return (
    /* 공개 라인업 잠금 안내 모달 — 슬롯/풀/다이아몬드 클릭 시 */
    <ModalShell
      open={open}
      title="공개 라인업은 수정할 수 없어요"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          이 라인업은 <strong>공개 상태</strong>예요.<br />
          수정하려면 먼저 <strong>비공개로 전환</strong>해야 하고,<br />
          전환하면 누적된 전적은 <strong>리셋</strong>됩니다.
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="lineup-confirm-destruct"
            onClick={onUnpublish}
          >
            비공개로 전환
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
