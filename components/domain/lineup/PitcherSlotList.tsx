"use client";

import { RotateCcw, X } from "lucide-react";
import {
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  formatHandBadge,
  type Player
} from "@/lib/types/lineup";
import { getSwapAnimClass } from "@/lib/lineup/swapHelpers";

type PitcherSlotListProps = {
  pitcherSlots: (string | null)[];
  pitcherFilled: number;
  playersById: Map<string, Player>;
  swapOrderSourceIdx: number | null;
  swapOrderAnimation: { a: number; b: number } | null;
  isLocked: boolean;
  onOrderClick: (idx: number) => void;
  onRemove: (idx: number) => void;
  onReset: () => void;
};

/** 투수 라인업 슬롯 리스트 — 선발 + 마무리 + 불펜 1~7 */
export function PitcherSlotList({
  pitcherSlots,
  pitcherFilled,
  playersById,
  swapOrderSourceIdx,
  swapOrderAnimation,
  isLocked,
  onOrderClick,
  onRemove,
  onReset
}: PitcherSlotListProps) {
  return (
    <section className="lineup-slots-card" aria-label="투수 라인업">
      <div className="lineup-section-head">
        <strong>투수</strong>
        <span className="lineup-section-count">{pitcherFilled} / {PITCHER_SLOTS_COUNT}</span>
        {pitcherFilled > 0 ? (
          <button
            type="button"
            className="lineup-clear-btn"
            onClick={onReset}
            aria-label="투수 라인업 비우기"
          >
            <RotateCcw size={12} />
            비우기
          </button>
        ) : null}
      </div>
      <ol className="lineup-slots">
        {pitcherSlots.map((playerId, idx) => {
          const player = playerId ? playersById.get(playerId) : undefined;
          const hand = player ? formatHandBadge(player) : null;
          const isStarter = idx === PITCHER_STARTER_INDEX;
          const isCloser = idx === PITCHER_CLOSER_INDEX;
          const isRequiredBullpen = idx === PITCHER_REQUIRED_BULLPEN_INDEX;
          const roleLabel = isStarter ? "선발" : isCloser ? "마무리" : "불펜";
          const slotBadge = isStarter ? "선" : isCloser ? "마" : String(idx - 1);
          // 선발만 공개 필수. 나머지 자리는 자동 채움 가능.
          const isRequiredSlot = isStarter;
          const placeholder = isStarter
            ? "선발 필수"
            : isCloser
              ? "마무리 (자동)"
              : "불펜 (자동)";
          const orderSelected = swapOrderSourceIdx === idx;
          const swapAnimClass = getSwapAnimClass(swapOrderAnimation, idx);
          return (
            <li
              key={`p-${idx}`}
              className={`lineup-slot ${player ? "lineup-slot-filled" : `lineup-slot-empty ${isRequiredSlot ? "lineup-slot-required" : ""}`} ${orderSelected ? "lineup-slot-selected" : ""} ${swapAnimClass}`}
            >
              <button
                type="button"
                className="lineup-slot-main"
                onClick={() => onOrderClick(idx)}
                aria-label={`${roleLabel} ${orderSelected ? "선택 취소" : "선택"}`}
                aria-pressed={orderSelected}
              >
                <span className={`lineup-slot-order ${isStarter || isCloser ? "lineup-slot-order-starter" : ""} ${orderSelected ? "lineup-slot-order-selected" : ""}`}>
                  {slotBadge}
                </span>
                {player ? (
                  <span className="lineup-slot-player">
                    <span className="lineup-slot-name">{player.name}</span>
                    {hand ? (
                      <span className={`lineup-hand-badge lineup-hand-${hand.tone}`}>{hand.label}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="lineup-slot-placeholder">{placeholder}</span>
                )}
              </button>
              {player ? (
                <>
                  <span className={`lineup-slot-pos lineup-slot-pos-static ${isStarter ? "lineup-slot-pos-starter" : ""}`}>
                    {roleLabel}
                  </span>
                  {orderSelected ? (
                    <button
                      type="button"
                      className="lineup-slot-remove"
                      onClick={() => onRemove(idx)}
                      aria-label={`${player.name} ${roleLabel}에서 빼기`}
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
      {!isLocked && pitcherFilled > 0 ? (
        <p className="lineup-slot-foot-hint">
          삭제나 순서를 변경하려면 <strong>슬롯을 선택</strong>
        </p>
      ) : null}
    </section>
  );
}
