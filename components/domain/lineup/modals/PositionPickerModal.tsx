"use client";

import { Check } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  POSITIONS,
  POSITION_LABEL,
  POSITION_SHORT,
  type LineupOrder,
  type LineupSlot,
  type Position
} from "@/lib/types/lineup";

type PositionPickerModalProps = {
  /** 변경 대상 타순 — null이면 모달 닫힘 */
  order: LineupOrder | null;
  slots: (LineupSlot | null)[];
  onClose: () => void;
  onPick: (order: LineupOrder, position: Position) => void;
};

export function PositionPickerModal({
  order,
  slots,
  onClose,
  onPick
}: PositionPickerModalProps) {
  return (
    /* 포지션 변경 모달 */
    <ModalShell
      open={order !== null}
      title="포지션 변경"
      onClose={onClose}
      panelClassName="lineup-pos-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-pos-grid">
        {/* 타자 모드 전용 — P(투수)는 별도 모드에서 관리하므로 제외 */}
        {POSITIONS.filter((pos) => pos !== "P").map((pos) => {
          const active = order !== null
            && slots[order - 1]?.position === pos;
          return (
            <button
              key={pos}
              type="button"
              className={`lineup-pos-choice ${active ? "lineup-pos-choice-active" : ""}`}
              onClick={() => {
                if (order !== null) {
                  onPick(order, pos);
                }
              }}
            >
              <strong>{POSITION_SHORT[pos]}</strong>
              <span>{POSITION_LABEL[pos]}</span>
              {active ? <Check size={12} strokeWidth={3} className="lineup-pos-check" /> : null}
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
