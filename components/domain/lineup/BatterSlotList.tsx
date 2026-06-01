"use client";

import { RotateCcw, X } from "lucide-react";
import {
  POSITION_SHORT,
  formatHandBadge,
  type LineupOrder,
  type Player
} from "@/lib/types/lineup";
import { ORDERS, getSwapAnimClass, type SlotState } from "@/lib/lineup/swapHelpers";

type BatterSlotListProps = {
  slots: SlotState[];
  filledCount: number;
  playersById: Map<string, Player>;
  swapOrderSourceIdx: number | null;
  swapOrderAnimation: { a: number; b: number } | null;
  isLocked: boolean;
  onOrderClick: (idx: number) => void;
  onPositionPickerOpen: (idx: LineupOrder) => void;
  onRemove: (idx: LineupOrder) => void;
  onReset: () => void;
  onLockedClick?: () => void;
};

/** 타자 9명 타순 슬롯 리스트 */
export function BatterSlotList({
  slots,
  filledCount,
  playersById,
  swapOrderSourceIdx,
  swapOrderAnimation,
  isLocked,
  onOrderClick,
  onPositionPickerOpen,
  onRemove,
  onReset,
  onLockedClick
}: BatterSlotListProps) {
  return (
    <section
      className="lineup-slots-card"
      aria-label="타순"
      onClick={isLocked ? onLockedClick : undefined}
    >
      <div className="lineup-section-head">
        <strong>타순</strong>
        <span className="lineup-section-count">{filledCount} / 9</span>
        {filledCount > 0 ? (
          <button
            type="button"
            className="lineup-clear-btn"
            onClick={onReset}
            aria-label="라인업 비우기"
          >
            <RotateCcw size={12} />
            비우기
          </button>
        ) : null}
      </div>
      <ol className="lineup-slots">
        {ORDERS.map((order) => {
          const slot = slots[order - 1];
          const player = slot ? playersById.get(slot.playerId) : undefined;
          const hand = player ? formatHandBadge(player) : null;
          const idx = order - 1;
          const orderSelected = swapOrderSourceIdx === idx;
          const swapAnimClass = getSwapAnimClass(swapOrderAnimation, idx);
          return (
            <li
              key={order}
              className={`lineup-slot ${slot ? "lineup-slot-filled" : "lineup-slot-empty lineup-slot-required"} ${orderSelected ? "lineup-slot-selected" : ""} ${swapAnimClass}`}
            >
              <button
                type="button"
                className="lineup-slot-main"
                onClick={() => onOrderClick(idx)}
                aria-label={`${order}번 타순 ${orderSelected ? "선택 취소" : "선택"}`}
                aria-pressed={orderSelected}
              >
                <span className={`lineup-slot-order ${orderSelected ? "lineup-slot-order-selected" : ""}`}>{order}</span>
                {slot && player ? (
                  <span className="lineup-slot-player">
                    <span className="lineup-slot-name">{player.name}</span>
                    {hand ? (
                      <span className={`lineup-hand-badge lineup-hand-${hand.tone}`}>{hand.label}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="lineup-slot-placeholder">타자 필수</span>
                )}
              </button>
              {slot && player ? (
                <>
                  <button
                    type="button"
                    className="lineup-slot-pos"
                    onClick={() => onPositionPickerOpen(order)}
                    aria-label="포지션 변경"
                  >
                    {POSITION_SHORT[slot.position]}
                  </button>
                  {orderSelected ? (
                    <button
                      type="button"
                      className="lineup-slot-remove"
                      onClick={() => onRemove(order)}
                      aria-label={`${player.name} 라인업에서 빼기`}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!isLocked && filledCount > 0 ? (
        <p className="lineup-slot-foot-hint">
          삭제나 순서를 변경하려면 <strong>슬롯을 선택</strong>
        </p>
      ) : null}
    </section>
  );
}
