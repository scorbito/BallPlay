"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";

const MAX_NAME_LEN = 12;

type PresetNameModalProps = {
  open: boolean;
  /** "저장"(신규) / "이름 변경"(기존) — 타이틀·버튼 문구 구분 */
  intent: "save" | "rename";
  /** rename 시 초기값 */
  initialName?: string;
  /** save 시 placeholder로 제안할 기본 이름 (예: "프리셋 1") */
  placeholder?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

/** 프리셋 이름 입력 모달 — 저장(신규)/이름 변경 공용. */
export function PresetNameModal({
  open,
  intent,
  initialName = "",
  placeholder = "프리셋 이름",
  onClose,
  onSubmit
}: PresetNameModalProps) {
  const [name, setName] = useState(() => initialName.slice(0, MAX_NAME_LEN));

  useEffect(() => {
    if (open) setName(initialName.slice(0, MAX_NAME_LEN));
  }, [open, initialName]);

  // IME 합성 등으로 한도 초과 시 안전망 트림.
  useEffect(() => {
    if (name.length > MAX_NAME_LEN) setName(name.slice(0, MAX_NAME_LEN));
  }, [name]);

  const title = intent === "save" ? "프리셋으로 저장" : "프리셋 이름 변경";
  const submitLabel = intent === "save" ? "저장" : "변경";

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          {intent === "save"
            ? "지금 편집 중인 라인업을 이름과 함께 저장해요."
            : "프리셋 이름을 변경해요."}
        </p>
        <input
          type="text"
          className="lineup-rename-input"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
          placeholder={placeholder}
          maxLength={MAX_NAME_LEN}
          autoFocus
        />
        <div className="lineup-confirm-actions">
          <button type="button" className="lineup-confirm-cancel" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            onClick={() => {
              const trimmed = name.trim().slice(0, MAX_NAME_LEN);
              const fallback = placeholder.trim().slice(0, MAX_NAME_LEN) || "프리셋";
              onSubmit(trimmed || fallback);
              onClose();
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
