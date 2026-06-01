import {
  PITCHER_SLOTS_COUNT,
  type LineupOrder,
  type LineupSlot,
  type Position
} from "@/lib/types/lineup";

export const ORDERS: LineupOrder[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export type SlotState = LineupSlot | null;
export const EMPTY_SLOTS: SlotState[] = Array.from({ length: 9 }, () => null);
export const EMPTY_PITCHER_SLOTS: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);

/** 두 슬롯이 swap된 직후 적용할 방향성 애니메이션 클래스.
 *  - a→b swap: 위쪽 슬롯은 "아래에서 위로" 들어오는 듯한 효과
 *               아래쪽 슬롯은 "위에서 아래로" 들어오는 듯한 효과 */
export function getSwapAnimClass(
  swap: { a: number; b: number } | null,
  idx: number
): string {
  if (!swap) return "";
  if (idx !== swap.a && idx !== swap.b) return "";
  const upperIdx = Math.min(swap.a, swap.b);
  const lowerIdx = Math.max(swap.a, swap.b);
  // 위쪽 슬롯은 아래쪽에 있던 내용을 받음 → from-down
  if (idx === upperIdx) return "lineup-slot-swap-from-down";
  // 아래쪽 슬롯은 위쪽에 있던 내용을 받음 → from-up
  if (idx === lowerIdx) return "lineup-slot-swap-from-up";
  return "";
}

/** 선수 타입에 맞춰 자동 배치 fallback 순서를 결정.
 *  KBO 명단이 "내야수/외야수"로만 묶여 있어, primaryPosition이 3B(내야 기본)
 *  또는 CF(외야 기본)로 통일되는 한계를 우회 — 같은 그룹 안에서 빈 자리를
 *  먼저 채워 자연스러운 분배가 되도록 한다. */
export function getFallbackOrder(primaryPos: Position): Position[] {
  const INFIELD: Position[] = ["1B", "2B", "3B", "SS"];
  const OUTFIELD: Position[] = ["LF", "CF", "RF"];
  switch (primaryPos) {
    case "3B": // 내야수 기본값
    case "1B":
    case "2B":
    case "SS":
      return [...INFIELD, "DH", ...OUTFIELD, "C"];
    case "CF": // 외야수 기본값
    case "LF":
    case "RF":
      return [...OUTFIELD, "DH", ...INFIELD, "C"];
    case "C":
      return ["C", "DH", ...INFIELD, ...OUTFIELD];
    case "DH":
      return ["DH", ...INFIELD, ...OUTFIELD, "C"];
    default:
      return [...INFIELD, ...OUTFIELD, "C", "DH"];
  }
}
