"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, RotateCcw, Share2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDiamond, type SwapTraveler } from "@/components/domain/LineupDiamond";
import { ShareLineupModal } from "@/components/domain/modals/ShareLineupModal";
import { getTeam, teams } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { getRoster, getSeededTeamIds } from "@/lib/rosters";
import {
  LINEUP_STORAGE_PREFIX,
  PITCHER_STORAGE_PREFIX,
  POSITIONS,
  POSITION_LABEL,
  POSITION_SHORT,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  formatHandBadge,
  getPoolGroupLabel,
  type LineupMode,
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position,
  type SavedLineup,
  type SavedPitcherLineup
} from "@/lib/types/lineup";

const ORDERS: LineupOrder[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function storageKey(teamId: string) {
  return `${LINEUP_STORAGE_PREFIX}${teamId}`;
}

function pitcherStorageKey(teamId: string) {
  return `${PITCHER_STORAGE_PREFIX}${teamId}`;
}

function loadLineup(teamId: string): SavedLineup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(teamId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedLineup;
  } catch {
    return null;
  }
}

function saveLineup(lineup: SavedLineup) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(lineup.teamId), JSON.stringify(lineup));
  } catch {
    // ignore quota errors
  }
}

function loadPitcherLineup(teamId: string): SavedPitcherLineup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(pitcherStorageKey(teamId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedPitcherLineup;
  } catch {
    return null;
  }
}

function savePitcherLineup(lineup: SavedPitcherLineup) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pitcherStorageKey(lineup.teamId), JSON.stringify(lineup));
  } catch {
    // ignore quota errors
  }
}

type SlotState = LineupSlot | null;
const EMPTY_SLOTS: SlotState[] = Array.from({ length: 9 }, () => null);
const EMPTY_PITCHER_SLOTS: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);

/** 두 슬롯이 swap된 직후 적용할 방향성 애니메이션 클래스.
 *  - a→b swap: 위쪽 슬롯은 "아래에서 위로" 들어오는 듯한 효과
 *               아래쪽 슬롯은 "위에서 아래로" 들어오는 듯한 효과 */
function getSwapAnimClass(
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
function getFallbackOrder(primaryPos: Position): Position[] {
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

export function LineupBuilderScreen() {
  const { profile, showToast } = useAppState();
  const seededTeamIds = useMemo(() => getSeededTeamIds(), []);

  // 시드가 있는 팀으로 기본값 — 사용자의 메인팀이 시드 안 됐으면 두산
  const initialTeamId = seededTeamIds.has(profile.mainTeamId) ? profile.mainTeamId : "doosan";

  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId);
  const [mode, setMode] = useState<LineupMode>("batter");
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>(EMPTY_PITCHER_SLOTS);
  const useDH = true;
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const teamPickerRef = useRef<HTMLDivElement | null>(null);
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  /** 다이아몬드에서 첫 번째로 선택된 포지션 — 두 번째 클릭 시 교환 */
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** localStorage 복원이 끝난 팀 id. 저장 effect는 이 값이 selectedTeamId와 같을 때만 동작하여,
   *  마운트 직후 EMPTY 슬롯으로 save가 먼저 돌며 localStorage를 비우는 레이스를 차단한다. */
  const [hydratedTeam, setHydratedTeam] = useState<string | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);
  const swapTimerRef = useRef<number | null>(null);
  /** 타순 번호 뱃지로 두 슬롯의 선수를 교체할 때의 source 인덱스 (0-based) */
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  /** 직전에 swap된 두 인덱스 — 잠시 애니메이션 클래스를 부여하기 위함 */
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const swapOrderAnimTimerRef = useRef<number | null>(null);

  // 외부 클릭 시 팀 드롭다운 닫기
  useEffect(() => {
    if (!teamMenuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && teamPickerRef.current && !teamPickerRef.current.contains(target)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [teamMenuOpen]);

  const roster = useMemo(() => getRoster(selectedTeamId), [selectedTeamId]);
  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach((p) => map.set(p.id, p));
    return map;
  }, [roster]);

  // 팀 변경 시 swap 선택도 초기화
  useEffect(() => {
    setSwapSource(null);
    setSwapOrderSourceIdx(null);
  }, [selectedTeamId]);

  // 모드 전환 시 타순 swap 선택도 초기화
  useEffect(() => {
    setSwapOrderSourceIdx(null);
  }, [mode]);

  // 언마운트 시 swap 애니메이션 타이머 정리
  useEffect(() => {
    return () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    };
  }, []);

  // 팀 변경 시 저장된 라인업 복원, 없으면 빈 슬롯 — 타자/투수 양쪽 모두
  useEffect(() => {
    // 복원 시작 전 게이트 닫기 — 새 팀 데이터가 슬롯에 반영되기 전에는 save 금지
    setHydratedTeam(null);

    // 타자 라인업 복원
    const stored = loadLineup(selectedTeamId);
    if (stored && stored.slots.length > 0) {
      const next: SlotState[] = Array.from({ length: 9 }, () => null);
      stored.slots.forEach((s) => {
        if (s.order >= 1 && s.order <= 9) {
          next[s.order - 1] = s;
        }
      });
      setSlots(next);
    } else {
      setSlots(EMPTY_SLOTS);
    }

    // 투수 라인업 복원
    const storedPitcher = loadPitcherLineup(selectedTeamId);
    if (storedPitcher && Array.isArray(storedPitcher.slots)) {
      const next = Array.from({ length: PITCHER_SLOTS_COUNT }, (_, i) => storedPitcher.slots[i] ?? null);
      setPitcherSlots(next);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }

    // 복원 완료 — 이 팀에 대해서만 save 이펙트가 동작하도록 게이트 열기
    setHydratedTeam(selectedTeamId);
  }, [selectedTeamId]);

  // 타자 라인업 — 변경 시 localStorage 즉시 저장. 복원 완료 전엔 skip.
  useEffect(() => {
    if (hydratedTeam !== selectedTeamId) return;
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    if (filledSlots.length === 0) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey(selectedTeamId));
      }
      return;
    }
    saveLineup({
      teamId: selectedTeamId,
      slots: filledSlots,
      useDH,
      updatedAt: new Date().toISOString()
    });
  }, [slots, selectedTeamId, useDH, hydratedTeam]);

  // 투수 라인업 — 변경 시 localStorage 저장. 복원 완료 전엔 skip.
  useEffect(() => {
    if (hydratedTeam !== selectedTeamId) return;
    const hasAny = pitcherSlots.some(Boolean);
    if (!hasAny) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(pitcherStorageKey(selectedTeamId));
      }
      return;
    }
    savePitcherLineup({
      teamId: selectedTeamId,
      slots: pitcherSlots,
      updatedAt: new Date().toISOString()
    });
  }, [pitcherSlots, selectedTeamId, hydratedTeam]);

  // 모드별 배치된 선수 ID 집합 — 중복 방지에 사용
  const placedPlayerIds = useMemo(() => {
    if (mode === "batter") {
      return new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId));
    }
    const ids = new Set<string>();
    pitcherSlots.forEach((id) => id && ids.add(id));
    return ids;
  }, [mode, slots, pitcherSlots]);

  const handleAddPlayer = (player: Player) => {
    if (placedPlayerIds.has(player.id)) {
      showToast("이미 라인업에 있어요.");
      return;
    }

    if (mode === "batter") {
      // 타자 모드: 투수는 추가 불가
      if (player.primaryPosition === "P") {
        showToast("투수는 투수 라인업에서 관리해주세요.");
        return;
      }
      setSlots((current) => {
        const firstEmpty = current.findIndex((s) => s === null);
        if (firstEmpty === -1) {
          showToast("타순이 모두 찼어요.");
          return current;
        }

        // 이미 쓰이는 포지션을 피해 자동 할당.
        // 선수 타입(내야/외야/포수)에 맞춰 같은 그룹부터 비어있는 포지션 탐색.
        // KBO 명단이 "내야수/외야수" 그룹으로만 표기되어 외야수 3명을 등록하면
        // 자연스럽게 LF → CF → RF 순으로 분배되도록 한다.
        const usedPositions = new Set(
          current.filter((s): s is LineupSlot => s !== null).map((s) => s.position)
        );
        const fallbackOrder = getFallbackOrder(player.primaryPosition);
        const assignedPosition: Position = usedPositions.has(player.primaryPosition)
          ? (fallbackOrder.find((p) => !usedPositions.has(p)) ?? player.primaryPosition)
          : player.primaryPosition;

        const next = [...current];
        next[firstEmpty] = {
          order: (firstEmpty + 1) as LineupOrder,
          playerId: player.id,
          position: assignedPosition
        };
        return next;
      });
      return;
    }

    // 투수 모드: 선발(0번) → 불펜(1~8번) 순으로 빈 자리 채우기
    if (player.primaryPosition !== "P") {
      showToast("야수는 타자 라인업에서 관리해주세요.");
      return;
    }
    const emptyIdx = pitcherSlots.findIndex((id) => id === null);
    if (emptyIdx === -1) {
      showToast("투수 자리가 모두 찼어요.");
      return;
    }
    setPitcherSlots((current) => current.map((id, i) => (i === emptyIdx ? player.id : id)));
  };

  const handleRemoveSlot = (order: LineupOrder) => {
    setSlots((current) => current.map((s, i) => (i === order - 1 ? null : s)));
    setSwapOrderSourceIdx(null);
  };

  const handleRemovePitcher = (idx: number) => {
    setPitcherSlots((current) => current.map((id, i) => (i === idx ? null : id)));
    setSwapOrderSourceIdx(null);
  };

  /** 타순 번호 뱃지 클릭 — 두 번 탭으로 두 슬롯의 선수를 교체.
   *  포지션은 각자 유지하고 슬롯(타순)만 swap. 타자 모드는 slots, 투수 모드는
   *  pitcherSlots에 동일 패턴 적용. */
  const handleOrderClick = (idx: number) => {
    if (swapOrderSourceIdx === null) {
      setSwapOrderSourceIdx(idx);
      return;
    }
    if (swapOrderSourceIdx === idx) {
      setSwapOrderSourceIdx(null);
      return;
    }

    if (mode === "batter") {
      setSlots((current) => {
        const a = current[swapOrderSourceIdx];
        const b = current[idx];
        const next = [...current];
        // 슬롯 통째 교환. order 필드는 인덱스+1로 재매핑.
        next[swapOrderSourceIdx] = b ? { ...b, order: (swapOrderSourceIdx + 1) as LineupOrder } : null;
        next[idx] = a ? { ...a, order: (idx + 1) as LineupOrder } : null;
        return next;
      });
    } else {
      setPitcherSlots((current) => {
        const next = [...current];
        [next[swapOrderSourceIdx], next[idx]] = [next[idx], next[swapOrderSourceIdx]];
        return next;
      });
    }

    // 두 슬롯에 짧은 swap 애니메이션 (위/아래 방향까지 반영)
    setSwapOrderAnimation({ a: swapOrderSourceIdx, b: idx });
    if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    swapOrderAnimTimerRef.current = window.setTimeout(() => {
      setSwapOrderAnimation(null);
      swapOrderAnimTimerRef.current = null;
    }, 450);

    setSwapOrderSourceIdx(null);
    showToast("타순을 바꿨어요.");
  };

  /** 슬롯의 포지션 변경. 다른 슬롯이 이미 그 포지션을 쓰고 있으면 자동으로 swap.
   *  다이아몬드 직접 swap과 동일한 traveler 애니메이션을 재사용해 이동/교체를 시각화. */
  const handleChangePosition = (order: LineupOrder, newPosition: Position) => {
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

    // 슬롯 상태 갱신
    setSlots((current) =>
      current.map((s, i) => {
        if (!s) return s;
        if (i === sourceIdx) return { ...s, position: newPosition };
        if (conflictIdx !== -1 && i === conflictIdx) return { ...s, position: oldPosition };
        return s;
      })
    );

    // 애니메이션 — 항상 source player가 이동, 충돌 있으면 conflict player도 같이 이동
    const travelers: SwapTraveler[] = [
      { playerId: sourceSlot.playerId, from: oldPosition, to: newPosition }
    ];
    if (conflictIdx !== -1) {
      const conflictSlot = slots[conflictIdx];
      if (conflictSlot) {
        travelers.push({
          playerId: conflictSlot.playerId,
          from: newPosition,
          to: oldPosition
        });
      }
    }
    setSwapTravelers(travelers);
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);

    setPositionPickerForOrder(null);
  };

  const handleReset = () => {
    if (mode === "batter") {
      if (slots.every((s) => s === null)) return;
    } else {
      if (pitcherSlots.every((s) => s === null)) return;
    }
    setConfirmResetOpen(true);
  };

  const confirmReset = () => {
    if (mode === "batter") {
      setSlots(EMPTY_SLOTS);
      setSwapSource(null);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }
    setConfirmResetOpen(false);
    showToast("라인업을 비웠어요.");
  };

  /** 다이아몬드 마커 클릭 — 두 번 클릭으로 두 포지션의 선수를 교환.
   *  - 첫 클릭: 해당 포지션을 source로 선택 (강조)
   *  - 같은 포지션 재클릭: 선택 취소
   *  - 다른 포지션 클릭: 두 포지션의 슬롯이 가진 position 값을 swap
   *    (양쪽 다 비어 있으면 무시, 한쪽만 있으면 그 선수가 이동)
   *  - swap 시 한 자리에서 다른 자리로 선수 이름이 날아가는 애니메이션 노출 */
  const handleDiamondPositionClick = (pos: Position) => {
    // 타자 모드에서 P(투수) 마커는 별도 라인업이라 swap 불가
    if (pos === "P") {
      showToast("투수는 투수 라인업에서 관리해주세요.");
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
      // 두 위치 모두 비어있음 — 단순 선택 갱신
      setSwapSource(pos);
      return;
    }

    // 애니메이션용 traveler 목록 — 비어있는 쪽은 제외
    const travelers: SwapTraveler[] = [];
    if (sourceIdx !== -1) {
      travelers.push({ playerId: slots[sourceIdx]!.playerId, from: swapSource, to: pos });
    }
    if (targetIdx !== -1) {
      travelers.push({ playerId: slots[targetIdx]!.playerId, from: pos, to: swapSource });
    }

    setSlots((current) =>
      current.map((s, i) => {
        if (!s) return s;
        if (i === sourceIdx && i === targetIdx) return s;
        if (i === sourceIdx) return { ...s, position: pos };
        if (i === targetIdx) return { ...s, position: swapSource };
        return s;
      })
    );
    setSwapSource(null);
    setSwapTravelers(travelers);
    showToast("포지션을 바꿨어요.");

    // 애니메이션 끝나면 traveler 정리 → 정적 이름 라벨 다시 노출
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);
  };


  const selectedTeam = getTeam(selectedTeamId);
  const filledCount = slots.filter((s) => s !== null).length;
  const pitcherFilled = pitcherSlots.filter(Boolean).length;

  // 선수 풀: 모드에 따라 야수만 / 투수만 노출. 이미 배치된 선수는 제외.
  // 정렬: 시즌 1군 출장 경기수(seasonGames) 내림차순 → 1군 주전이 위로.
  // 동률은 등번호 오름차순.
  const poolPlayers = useMemo(() => {
    const filtered = roster.filter((p) => !placedPlayerIds.has(p.id));
    const byMode = mode === "batter"
      ? filtered.filter((p) => p.primaryPosition !== "P")
      : filtered.filter((p) => p.primaryPosition === "P");
    return byMode.sort((a, b) => {
      const ga = a.seasonGames ?? 0;
      const gb = b.seasonGames ?? 0;
      if (ga !== gb) return gb - ga;
      return a.jerseyNumber - b.jerseyNumber;
    });
  }, [roster, placedPlayerIds, mode]);

  // 다이아몬드는 모드와 무관하게 항상 같은 풍경을 보여준다:
  // 타자 9명(각자 수비 위치) + 선발투수 1명(P 위치). 양쪽 라인업이 합쳐진 실제 출전 가능 라인업.
  const diamondSlots: SlotState[] = useMemo(() => {
    const combined: SlotState[] = [...slots];
    const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
    if (starterId) {
      // 가상 슬롯 — 다이아몬드의 playerByPosition map에만 사용됨 (실제 slots/pitcherSlots와는 별개)
      combined.push({ order: 1 as LineupOrder, playerId: starterId, position: "P" });
    }
    return combined;
  }, [slots, pitcherSlots]);

  return (
    <AppShell activeTab="play" title="라인업 짜기" theme="dark" hideHeader wide>
      <header className="lineup-header lineup-header-no-back">
        {/* v1: 라인업 탭이 BottomTabs에서 직접 진입하므로 뒤로가기 버튼 일시 숨김.
            추후 다른 진입 경로 생기면 다시 노출. */}
        <div className="sched-team-picker" ref={teamPickerRef}>
          <button
            type="button"
            className="sched-team-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={teamMenuOpen}
            onClick={() => setTeamMenuOpen((open) => !open)}
          >
            <TeamBadge teamId={selectedTeamId} size="sm" />
            <strong>{selectedTeam.shortName}</strong>
            <ChevronDown size={16} className={teamMenuOpen ? "sched-team-picker-chevron-open" : ""} />
          </button>
          {teamMenuOpen ? (
            <ul className="sched-team-picker-menu" role="listbox" aria-label="팀 선택">
              {teams.map((team) => {
                const active = team.id === selectedTeamId;
                const seeded = seededTeamIds.has(team.id);
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!seeded}
                      className={`sched-team-picker-item ${active ? "sched-team-picker-item-active" : ""} ${!seeded ? "sched-team-picker-item-disabled" : ""}`}
                      onClick={() => {
                        if (!seeded) return;
                        setSelectedTeamId(team.id);
                        setTeamMenuOpen(false);
                      }}
                    >
                      <TeamBadge teamId={team.id} size="sm" />
                      <span>{team.name}</span>
                      {active ? <Check size={14} strokeWidth={3} className="sched-team-picker-check" /> : null}
                      {!seeded ? <span className="lineup-pool-soon">준비중</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="lineup-mode-toggle" role="tablist" aria-label="라인업 종류">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "batter"}
            className={mode === "batter" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
            onClick={() => {
              setMode("batter");
              setSwapSource(null);
            }}
          >
            타자
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pitcher"}
            className={mode === "pitcher" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
            onClick={() => {
              setMode("pitcher");
              setSwapSource(null);
            }}
          >
            투수
          </button>
        </div>
      </header>

      <div className="lineup-layout">
        {/* 야구장 다이아몬드 — 타자 모드: 9수비, 투수 모드: 선발만 P 표시 */}
        <section className="lineup-diamond-card" aria-label={mode === "batter" ? "수비 위치" : "선발 투수"}>
          <LineupDiamond
            slots={diamondSlots}
            playersById={playersById}
            teamColor={selectedTeam.color}
            selectedPosition={mode === "batter" ? swapSource : null}
            onPositionClick={mode === "batter" ? handleDiamondPositionClick : undefined}
            travelers={mode === "batter" ? swapTravelers : []}
          />
          {swapSource ? (
            <div className="lineup-field-hint" role="status">
              <strong>{POSITION_SHORT[swapSource]}</strong> 선택됨 · 교환할 다른 포지션을 탭하세요
              <button type="button" className="lineup-field-hint-cancel" onClick={() => setSwapSource(null)}>
                취소
              </button>
            </div>
          ) : null}
        </section>

        <div className="lineup-action-row">
          <p className="lineup-action-hint">
            삭제나 순서를 변경하려면 <strong>슬롯을 선택</strong>해주세요.
          </p>
          <div className="lineup-action-buttons">
            <button
              type="button"
              className="lineup-action-btn lineup-action-btn-primary"
              onClick={() => setShareOpen(true)}
            >
              <Share2 size={12} />
              공유
            </button>
          </div>
        </div>

        {/* 슬롯 카드 — 타자: 1~9 타순 / 투수: 선발 + 불펜 1~8 */}
        {mode === "batter" ? (
          <section className="lineup-slots-card" aria-label="타순">
            <div className="lineup-section-head">
              <strong>타순</strong>
              <span className="lineup-section-count">{filledCount} / 9</span>
              {filledCount > 0 ? (
                <button
                  type="button"
                  className="lineup-clear-btn"
                  onClick={handleReset}
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
                    className={`lineup-slot ${slot ? "lineup-slot-filled" : "lineup-slot-empty"} ${orderSelected ? "lineup-slot-selected" : ""} ${swapAnimClass}`}
                  >
                    <button
                      type="button"
                      className="lineup-slot-main"
                      onClick={() => handleOrderClick(idx)}
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
                        <span className="lineup-slot-placeholder">선택</span>
                      )}
                    </button>
                    {slot && player ? (
                      <>
                        <button
                          type="button"
                          className="lineup-slot-pos"
                          onClick={() => setPositionPickerForOrder(order)}
                          aria-label="포지션 변경"
                        >
                          {POSITION_SHORT[slot.position]}
                        </button>
                        {orderSelected ? (
                          <button
                            type="button"
                            className="lineup-slot-remove"
                            onClick={() => handleRemoveSlot(order)}
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
          </section>
        ) : (
          <section className="lineup-slots-card" aria-label="투수 라인업">
            <div className="lineup-section-head">
              <strong>투수</strong>
              <span className="lineup-section-count">{pitcherFilled} / {PITCHER_SLOTS_COUNT}</span>
              {pitcherFilled > 0 ? (
                <button
                  type="button"
                  className="lineup-clear-btn"
                  onClick={handleReset}
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
                const roleLabel = isStarter ? "선발" : "불펜";
                const orderSelected = swapOrderSourceIdx === idx;
                const swapAnimClass = getSwapAnimClass(swapOrderAnimation, idx);
                return (
                  <li
                    key={`p-${idx}`}
                    className={`lineup-slot ${player ? "lineup-slot-filled" : "lineup-slot-empty"} ${orderSelected ? "lineup-slot-selected" : ""} ${swapAnimClass}`}
                  >
                    <button
                      type="button"
                      className="lineup-slot-main"
                      onClick={() => handleOrderClick(idx)}
                      aria-label={`${roleLabel} ${orderSelected ? "선택 취소" : "선택"}`}
                      aria-pressed={orderSelected}
                    >
                      <span className={`lineup-slot-order ${isStarter ? "lineup-slot-order-starter" : ""} ${orderSelected ? "lineup-slot-order-selected" : ""}`}>
                        {isStarter ? "선" : idx}
                      </span>
                      {player ? (
                        <span className="lineup-slot-player">
                          <span className="lineup-slot-name">{player.name}</span>
                          {hand ? (
                            <span className={`lineup-hand-badge lineup-hand-${hand.tone}`}>{hand.label}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="lineup-slot-placeholder">{roleLabel} 선택</span>
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
                            onClick={() => handleRemovePitcher(idx)}
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
          </section>
        )}

        <section className="lineup-pool-card lineup-pool-card-side" aria-label="대기 선수">
          <div className="lineup-section-head">
            <strong>대기</strong>
            <span className="lineup-section-count">{poolPlayers.length}</span>
          </div>
          {poolPlayers.length === 0 ? (
            <p className="lineup-pool-empty">전원 출장 중</p>
          ) : (
            <ul className="lineup-pool-list">
              {poolPlayers.map((player) => {
                const hand = formatHandBadge(player);
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      className="lineup-pool-row"
                      onClick={() => handleAddPlayer(player)}
                    >
                      <span className="lineup-pool-pos">{getPoolGroupLabel(player.primaryPosition)}</span>
                      <span className="lineup-pool-row-name">{player.name}</span>
                      {hand ? (
                        <span className={`lineup-hand-badge lineup-hand-${hand.tone}`}>{hand.label}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 라인업 비우기 확인 모달 */}
      <ModalShell
        open={confirmResetOpen}
        title="라인업 비우기"
        onClose={() => setConfirmResetOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            지금 짜둔 라인업을 모두 비우시겠어요?<br />
            저장된 데이터도 함께 사라집니다.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setConfirmResetOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              onClick={confirmReset}
            >
              비우기
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 포지션 변경 모달 */}
      <ModalShell
        open={positionPickerForOrder !== null}
        title="포지션 변경"
        onClose={() => setPositionPickerForOrder(null)}
        panelClassName="lineup-pos-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-pos-grid">
          {/* 타자 모드 전용 — P(투수)는 별도 모드에서 관리하므로 제외 */}
          {POSITIONS.filter((pos) => pos !== "P").map((pos) => {
            const active = positionPickerForOrder !== null
              && slots[positionPickerForOrder - 1]?.position === pos;
            return (
              <button
                key={pos}
                type="button"
                className={`lineup-pos-choice ${active ? "lineup-pos-choice-active" : ""}`}
                onClick={() => {
                  if (positionPickerForOrder !== null) {
                    handleChangePosition(positionPickerForOrder, pos);
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

      <ShareLineupModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        teamId={selectedTeamId}
        mode={mode}
        slots={slots}
        pitcherSlots={pitcherSlots}
        playersById={playersById}
      />
    </AppShell>
  );
}
