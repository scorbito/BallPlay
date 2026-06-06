"use client";

import { Check, Loader2, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";

export type DeleteStatus =
  | { phase: "idle"; error?: string }
  | { phase: "deleting"; error?: string }
  | { phase: "success"; error?: string }
  | { phase: "error"; error?: string };

// 전적 있는 팀은 "은퇴"(보관), 전적 0인 팀은 "삭제"(완전 제거)로 분기.
export type SlotRemoveMode = "delete" | "archive";

type ConfirmDeleteSlotModalProps = {
  open: boolean;
  mode: SlotRemoveMode;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteSlotModal({
  open,
  mode,
  onCancel,
  onConfirm
}: ConfirmDeleteSlotModalProps) {
  const archive = mode === "archive";
  return (
    /* 팀 삭제/은퇴 확인 모달 */
    <ModalShell
      open={open}
      title={archive ? "팀 은퇴" : "팀 삭제"}
      onClose={onCancel}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          {archive ? (
            <>
              이 팀을 은퇴시킬까요?<br />
              쌓은 전적은 기록으로 보존되지만,<br />
              더 이상 편집하거나 출전할 수 없어요.
            </>
          ) : (
            <>
              이 팀을 삭제할까요?<br />
              저장된 타순과 투수 라인업이 함께 사라집니다.
            </>
          )}
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
            {archive ? "은퇴" : "삭제"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type DeleteSlotStatusModalProps = {
  status: DeleteStatus;
  mode: SlotRemoveMode;
  onClose: () => void;
};

export function DeleteSlotStatusModal({ status, mode, onClose }: DeleteSlotStatusModalProps) {
  const archive = mode === "archive";
  const verb = archive ? "은퇴" : "삭제";
  return (
    /* 삭제/은퇴 진행·결과 모달 — 사용자가 DB sync 완료 여부 알 수 있게.
        deleting: 스피너 + "...중". success: ✓ + "...완료" (1.5초 자동 닫기).
        error: ⚠ 메시지 + 확인 버튼. */
    <ModalShell
      open={status.phase !== "idle"}
      title={archive ? "팀 은퇴" : "팀 삭제"}
      onClose={() => {
        // 진행 중에는 닫을 수 없음. 성공/실패만 닫기 허용.
        if (status.phase !== "deleting") onClose();
      }}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop={status.phase !== "deleting"}
    >
      <div className="lineup-delete-status">
        {status.phase === "deleting" ? (
          <>
            <Loader2 size={28} className="lineup-delete-status-spinner" />
            <p className="lineup-delete-status-msg">{verb} 중...</p>
          </>
        ) : status.phase === "success" ? (
          <>
            <Check size={28} strokeWidth={3} className="lineup-delete-status-check" />
            <p className="lineup-delete-status-msg">{verb} 완료</p>
          </>
        ) : status.phase === "error" ? (
          <>
            <X size={28} strokeWidth={3} className="lineup-delete-status-error-icon" />
            <p className="lineup-delete-status-msg">
              {status.error === "offline"
                ? "동기화가 멈춰있어요"
                : `${verb} 실패`}
            </p>
            <p className="lineup-delete-status-error">
              {status.error === "offline"
                ? `로그인 상태를 확인 중이에요. 잠시 후 다시 시도해 주세요. (로컬에서는 ${verb}됨)`
                : status.error}
            </p>
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={onClose}
            >
              확인
            </button>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
