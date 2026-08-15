"use client";

// 타순 편집 상태와 조작 — 라인업 분석(빌더)의 타자 편집 흐름을 그대로 재현한다.
//
// 빌더(LineupBuilderScreen)에서 훅으로 뽑아내지 않고 새로 만든 이유:
// 빌더의 편집 로직은 투수 모드·팀 슬롯·저장/출전 상태와 얽혀 있어서, 공용 훅으로
// 추출하면 운영 중인 화면까지 함께 흔들린다. 여기서는 타자 9명 편집만 다룬다.
//
// UI 컴포넌트(BatterSlotList, LineupPoolCard, LineupDiamond, PositionPickerModal)는
// 빌더 것을 그대로 쓴다 — 전부 props 로만 동작하는 프레젠테이션 컴포넌트다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position
} from "@/lib/types/lineup";
import { EMPTY_SLOTS, getFallbackOrder, type SlotState } from "@/lib/lineup/swapHelpers";
import type { SwapTraveler } from "@/components/domain/LineupDiamond";

const SWAP_ORDER_ANIM_MS = 450;
const SWAP_TRAVEL_ANIM_MS = 650;

type Options = {
  /** 선택 가능한 선수(야수). 팀이 바뀌면 새 배열을 넘긴다. */
  players: Player[];
  onToast?: (message: string) => void;
};

export function useLineupEditor({ players, onToast }: Options) {
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);

  const orderAnimTimer = useRef<number | null>(null);
  const travelTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (orderAnimTimer.current !== null) window.clearTimeout(orderAnimTimer.current);
      if (travelTimer.current !== null) window.clearTimeout(travelTimer.current);
    };
  }, []);

  const toast = useCallback((msg: string) => onToast?.(msg), [onToast]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const placedPlayerIds = useMemo(
    () => new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId)),
    [slots]
  );
  const poolPlayers = useMemo(
    () => players.filter((p) => !placedPlayerIds.has(p.id)),
    [players, placedPlayerIds]
  );
  const filledCount = useMemo(() => slots.filter((s) => s !== null).length, [slots]);

  /** 빈 타순에 추가. 포지션은 이미 쓰인 자리를 피해 자동 할당한다. */
  const addPlayer = useCallback(
    (player: Player) => {
      if (placedPlayerIds.has(player.id)) {
        toast("이미 라인업에 있어요.");
        return;
      }
      if (player.primaryPosition === "P") {
        toast("투수는 타순에 넣을 수 없어요.");
        return;
      }
      setSlots((current) => {
        const firstEmpty = current.findIndex((s) => s === null);
        if (firstEmpty === -1) {
          toast("타순이 모두 찼어요.");
          return current;
        }
        // KBO 명단이 내야수/외야수 그룹으로만 표기돼 primaryPosition 이 겹친다.
        // 같은 그룹 안에서 빈 포지션을 먼저 찾아 자연스럽게 분배한다.
        const used = new Set(current.filter((s): s is LineupSlot => s !== null).map((s) => s.position));
        const fallback = getFallbackOrder(player.primaryPosition);
        const assigned: Position = used.has(player.primaryPosition)
          ? (fallback.find((p) => !used.has(p)) ?? player.primaryPosition)
          : player.primaryPosition;

        const next = [...current];
        next[firstEmpty] = {
          order: (firstEmpty + 1) as LineupOrder,
          playerId: player.id,
          position: assigned
        };
        return next;
      });
    },
    [placedPlayerIds, toast]
  );

  const removeSlot = useCallback((order: LineupOrder) => {
    setSlots((current) => current.map((s, i) => (i === order - 1 ? null : s)));
    setSwapOrderSourceIdx(null);
  }, []);

  /** 타순 번호 두 번 탭 — 두 슬롯의 선수를 교환한다(포지션은 각자 유지). */
  const orderClick = useCallback(
    (idx: number) => {
      if (swapOrderSourceIdx === null) {
        setSwapOrderSourceIdx(idx);
        return;
      }
      if (swapOrderSourceIdx === idx) {
        setSwapOrderSourceIdx(null);
        return;
      }
      setSlots((current) => {
        const a = current[swapOrderSourceIdx];
        const b = current[idx];
        const next = [...current];
        next[swapOrderSourceIdx] = b ? { ...b, order: (swapOrderSourceIdx + 1) as LineupOrder } : null;
        next[idx] = a ? { ...a, order: (idx + 1) as LineupOrder } : null;
        return next;
      });

      setSwapOrderAnimation({ a: swapOrderSourceIdx, b: idx });
      if (orderAnimTimer.current !== null) window.clearTimeout(orderAnimTimer.current);
      orderAnimTimer.current = window.setTimeout(() => {
        setSwapOrderAnimation(null);
        orderAnimTimer.current = null;
      }, SWAP_ORDER_ANIM_MS);

      setSwapOrderSourceIdx(null);
    },
    [swapOrderSourceIdx]
  );

  /** 포지션 변경. 그 자리를 이미 쓰던 선수가 있으면 서로 맞바꾼다. */
  const changePosition = useCallback(
    (order: LineupOrder, newPosition: Position) => {
      const sourceIdx = order - 1;
      const sourceSlot = slots[sourceIdx];
      if (!sourceSlot || sourceSlot.position === newPosition) {
        setPositionPickerForOrder(null);
        return;
      }
      const conflictIdx = slots.findIndex(
        (s, i) => s !== null && i !== sourceIdx && s.position === newPosition
      );
      const oldPosition = sourceSlot.position;

      setSlots((current) =>
        current.map((s, i) => {
          if (!s) return s;
          if (i === sourceIdx) return { ...s, position: newPosition };
          if (conflictIdx !== -1 && i === conflictIdx) return { ...s, position: oldPosition };
          return s;
        })
      );

      const travelers: SwapTraveler[] = [
        { playerId: sourceSlot.playerId, from: oldPosition, to: newPosition }
      ];
      const conflictSlot = conflictIdx !== -1 ? slots[conflictIdx] : null;
      if (conflictSlot) {
        travelers.push({ playerId: conflictSlot.playerId, from: newPosition, to: oldPosition });
      }
      setSwapTravelers(travelers);
      if (travelTimer.current !== null) window.clearTimeout(travelTimer.current);
      travelTimer.current = window.setTimeout(() => {
        setSwapTravelers([]);
        travelTimer.current = null;
      }, SWAP_TRAVEL_ANIM_MS);

      setPositionPickerForOrder(null);
    },
    [slots]
  );

  /** 다이아몬드 마커 두 번 클릭 — 두 포지션의 선수를 맞바꾼다. */
  const diamondPositionClick = useCallback(
    (pos: Position) => {
      if (pos === "P") {
        toast("투수는 타순에 포함되지 않아요.");
        setSwapSource(null);
        return;
      }
      if (swapSource === null) {
        setSwapSource(pos);
        return;
      }
      if (swapSource === pos) {
        setSwapSource(null);
        return;
      }

      const sourceIdx = slots.findIndex((s) => s !== null && s.position === swapSource);
      const targetIdx = slots.findIndex((s) => s !== null && s.position === pos);
      if (sourceIdx === -1 && targetIdx === -1) {
        setSwapSource(null);
        return;
      }

      const travelers: SwapTraveler[] = [];
      const sourceSlot = sourceIdx !== -1 ? slots[sourceIdx] : null;
      const targetSlot = targetIdx !== -1 ? slots[targetIdx] : null;
      if (sourceSlot) travelers.push({ playerId: sourceSlot.playerId, from: swapSource, to: pos });
      if (targetSlot) travelers.push({ playerId: targetSlot.playerId, from: pos, to: swapSource });

      setSlots((current) =>
        current.map((s, i) => {
          if (!s) return s;
          if (i === sourceIdx) return { ...s, position: pos };
          if (i === targetIdx) return { ...s, position: swapSource };
          return s;
        })
      );

      setSwapTravelers(travelers);
      if (travelTimer.current !== null) window.clearTimeout(travelTimer.current);
      travelTimer.current = window.setTimeout(() => {
        setSwapTravelers([]);
        travelTimer.current = null;
      }, SWAP_TRAVEL_ANIM_MS);

      setSwapSource(null);
    },
    [slots, swapSource, toast]
  );

  const reset = useCallback(() => {
    setSlots(EMPTY_SLOTS);
    setSwapSource(null);
    setSwapOrderSourceIdx(null);
  }, []);

  /** 외부 데이터(직전 경기 라인업, 저장된 예측)로 통째 교체. */
  const replaceAll = useCallback((next: SlotState[]) => {
    setSlots(next);
    setSwapSource(null);
    setSwapOrderSourceIdx(null);
  }, []);

  return {
    slots,
    filledCount,
    playersById,
    poolPlayers,
    swapOrderSourceIdx,
    swapOrderAnimation,
    swapTravelers,
    swapSource,
    positionPickerForOrder,
    setPositionPickerForOrder,
    addPlayer,
    removeSlot,
    orderClick,
    changePosition,
    diamondPositionClick,
    reset,
    replaceAll
  };
}
