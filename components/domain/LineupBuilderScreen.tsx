"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Cloud, CloudOff, Eye, EyeOff, HardDrive, History, Loader2, Pencil, Plus, RotateCcw, Share2, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDiamond, type SwapTraveler } from "@/components/domain/LineupDiamond";
import { ShareLineupModal } from "@/components/domain/modals/ShareLineupModal";
import { RecentLineupPickerModal } from "@/components/domain/modals/RecentLineupPickerModal";
import { getTeam, teams } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { getRoster, getSeededTeamIds } from "@/lib/rosters";
import {
  POSITIONS,
  POSITION_LABEL,
  POSITION_SHORT,
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  formatHandBadge,
  getPoolGroupLabel,
  normalizeKboPosition,
  type LineupEntry,
  type LineupMode,
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position,
  type SavedLineup,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import { createEmptyEntry } from "@/lib/storage/lineupEntries";
import { hasSeenGuide, markGuideSeen } from "@/lib/storage/lineupGuides";
import { useLineupSync } from "@/lib/storage/useLineupSync";
import { useUserTier } from "@/lib/auth/useUserTier";
import { getLineupSlotLimit } from "@/lib/auth/tierLimits";
import { TIER_LABEL } from "@/lib/auth/userTier";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchLineupStatsBulk } from "@/lib/supabase/query-parts/bpLineups";
import type { RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";

const ORDERS: LineupOrder[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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
  const { tier } = useUserTier();
  const lineupLimit = getLineupSlotLimit(tier);
  const seededTeamIds = useMemo(() => getSeededTeamIds(), []);

  // 시드가 있는 팀으로 기본값 — 사용자의 메인팀이 시드 안 됐으면 두산
  const initialTeamId = seededTeamIds.has(profile.mainTeamId) ? profile.mainTeamId : "doosan";

  // 다중 라인업 슬롯 (entries) — useLineupSync가 localStorage + Supabase DB 양방향 sync.
  // 비로그인이면 localStorage만, 로그인이면 첫 진입 시 마이그레이션 + 이후 양방향.
  const {
    entries,
    status: syncStatus,
    syncedUpsert,
    syncedDelete,
    syncedRename,
    localUpsertEntry,
    togglePublished
  } = useLineupSync();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const currentEntry = useMemo(
    () => entries.find((e) => e.entryId === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );
  const selectedTeamId = currentEntry?.teamId ?? initialTeamId;

  const [slotMenuOpen, setSlotMenuOpen] = useState(false);
  const slotPickerRef = useRef<HTMLDivElement | null>(null);
  const [newSlotOpen, setNewSlotOpen] = useState(false);
  const [newSlotTeamId, setNewSlotTeamId] = useState<string>(initialTeamId);
  const [newSlotName, setNewSlotName] = useState<string>("");
  const [renamingEntryId, setRenamingEntryId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  // 삭제 진행/결과 모달 — DB sync 완료까지 진행 상태 보여줌.
  const [deleteStatus, setDeleteStatus] = useState<{ phase: "idle" | "deleting" | "success" | "error"; error?: string }>({ phase: "idle" });

  const [mode, setMode] = useState<LineupMode>("batter");
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>(EMPTY_PITCHER_SLOTS);
  const useDH = true;
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  /** 다이아몬드에서 첫 번째로 선택된 포지션 — 두 번째 클릭 시 교환 */
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // 공개/비공개 토글 — 비공개로 갈 때 전적 리셋 확인 모달
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);
  const [publishProcessing, setPublishProcessing] = useState(false);
  // 공개 상태에서 잠긴 영역(슬롯/풀/다이아몬드) 클릭 시 안내 모달
  const [lockInfoOpen, setLockInfoOpen] = useState(false);
  // 새 슬롯 onboarding 안내 — 슬롯별 한 번씩만 노출.
  //   step1: 타순 9명 채우면 "선발 투수만 선택하면 공개 가능"
  //   step2: 선발 투수까지 고르면 "이제 공개해서 가상경기 가능 — 마무리/불펜은 자동"
  const [guideStep1Open, setGuideStep1Open] = useState(false);
  const [guideStep2Open, setGuideStep2Open] = useState(false);
  // 팀 최근 라인업 불러오기 모달 + 덮어쓰기 확인 (pending: 선택한 row 임시 보관)
  const [recentPickerOpen, setRecentPickerOpen] = useState(false);
  const [pendingRecentLineup, setPendingRecentLineup] = useState<RecentLineupRow | null>(null);
  // 공개 시 마무리/불펜 빈 자리 자동 채움 안내 모달
  const [confirmAutoFillOpen, setConfirmAutoFillOpen] = useState(false);
  // 본인 라인업별 전적 (entry_id → stats). 공개 라인업만 매칭되는 stats 있음.
  const [statsByEntryId, setStatsByEntryId] = useState<Record<string, { matches: number; wins: number; losses: number; draws: number }>>({});

  // 본인 라인업 stats 일괄 fetch — 빌더 마운트 시 + 공개 토글 후 자동 갱신.
  // entries의 entryId + isPublished 시그니처를 기준으로 변경 감지.
  const publishedSignature = useMemo(
    () => entries.map((e) => `${e.entryId}:${e.isPublished ? 1 : 0}`).join(","),
    [entries]
  );

  useEffect(() => {
    if (syncStatus !== "synced") return;
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      // 본인 라인업 row 모두 fetch (id ↔ entry_id 매핑 필요) — 익명도 DB sync되므로 포함
      const { data: rows } = await client
        .from("bp_lineups")
        .select("id, entry_id")
        .eq("owner_user_id", user.id);
      if (cancelled || !rows) return;
      const ids = (rows as Array<{ id: string; entry_id: string }>).map((r) => r.id);
      const stats = await fetchLineupStatsBulk(client, ids);
      if (cancelled) return;
      const byEntryId: Record<string, { matches: number; wins: number; losses: number; draws: number }> = {};
      for (const r of rows as Array<{ id: string; entry_id: string }>) {
        if (stats[r.id]) byEntryId[r.entry_id] = stats[r.id];
      }
      setStatsByEntryId(byEntryId);
    })();
    return () => {
      cancelled = true;
    };
  }, [syncStatus, publishedSignature]);
  /** entry 복원이 끝났는지 — 저장 effect가 마운트 직후 EMPTY로 entry를 덮어쓰는 레이스 차단 */
  const [hydratedEntryId, setHydratedEntryId] = useState<string | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);
  const swapTimerRef = useRef<number | null>(null);
  /** 타순 번호 뱃지로 두 슬롯의 선수를 교체할 때의 source 인덱스 (0-based) */
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  /** 직전에 swap된 두 인덱스 — 잠시 애니메이션 클래스를 부여하기 위함 */
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const swapOrderAnimTimerRef = useRef<number | null>(null);

  // 외부 클릭 시 슬롯 드롭다운 닫기
  useEffect(() => {
    if (!slotMenuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && slotPickerRef.current && !slotPickerRef.current.contains(target)) {
        setSlotMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [slotMenuOpen]);

  // entries가 로드되면 첫 entry 자동 선택 (이미 선택된 게 있으면 유지)
  useEffect(() => {
    if (selectedEntryId) return;
    if (entries.length > 0) setSelectedEntryId(entries[0].entryId);
  }, [entries, selectedEntryId]);

  const roster = useMemo(() => getRoster(selectedTeamId), [selectedTeamId]);
  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach((p) => map.set(p.id, p));
    return map;
  }, [roster]);

  // 선택된 슬롯 변경 시 swap 선택도 초기화
  useEffect(() => {
    setSwapSource(null);
    setSwapOrderSourceIdx(null);
  }, [selectedEntryId]);

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

  // 선택된 슬롯(entry) 변경 시 batting/pitching 복원, 없으면 빈 슬롯
  useEffect(() => {
    setHydratedEntryId(null);
    if (!currentEntry) {
      setSlots(EMPTY_SLOTS);
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
      return;
    }
    const stored = currentEntry.batting;
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

    const storedPitcher = currentEntry.pitching;
    if (storedPitcher && Array.isArray(storedPitcher.slots)) {
      const next = Array.from({ length: PITCHER_SLOTS_COUNT }, (_, i) => storedPitcher.slots[i] ?? null);
      setPitcherSlots(next);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }
    setHydratedEntryId(currentEntry.entryId);
  }, [currentEntry?.entryId]);

  // 타자/투수 라인업 변경 → 현재 entry 업데이트 + 저장. 복원 완료 전엔 skip.
  // 공개 상태면 DB trigger가 변경을 막으므로 저장 시도 자체 skip.
  //
  // ⚠️ batter/pitcher를 하나의 effect로 묶음 (이전엔 2개로 분리).
  //    applyRecentLineup처럼 setSlots + setPitcherSlots를 동시에 부르면
  //    두 effect가 같은 render에 실행되면서 둘 다 stale closure currentEntry를
  //    spread해서 두 번째 write가 첫 번째 write의 필드를 덮어쓰는 race가 발생함.
  //    (구체적으로: batter effect가 batting=9를 쓴 직후, pitcher effect가
  //     batting=stale-empty를 다시 써서 batting이 비어버림 → 그 상태에서 공개되면
  //     DB에도 빈 batting 저장됨.)
  //    하나의 effect로 합쳐 batter+pitcher 양쪽 모두 live state에서 동시에 읽고
  //    한 번에 write → 어떤 setter 조합이든 race 차단.
  useEffect(() => {
    if (!currentEntry || hydratedEntryId !== currentEntry.entryId) return;
    if (currentEntry.isPublished) return;
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    const hasAnyPitcher = pitcherSlots.some(Boolean);
    const now = new Date().toISOString();
    const updated: LineupEntry = {
      ...currentEntry,
      batting: {
        teamId: currentEntry.teamId,
        slots: filledSlots,
        useDH,
        updatedAt: now
      },
      pitching: hasAnyPitcher
        ? { teamId: currentEntry.teamId, slots: pitcherSlots, updatedAt: now }
        : null,
      updatedAt: now
    };
    // 타선 9명 완성됐을 때만 DB 동기화. 미완성은 localStorage만 (호출 빈도 감소).
    // DB엔 항상 "마지막 완성 시점의 9명 라인업"만 남아있음 → Discover에서 미완성 노출 X.
    if (filledSlots.length === 9) {
      syncedUpsert(updated);
    } else {
      localUpsertEntry(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, pitcherSlots, useDH, hydratedEntryId]);

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

    // 투수 모드: 선발(0번) → 마무리(1번) → 불펜(2~8번) 순으로 빈 자리 채우기
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

  /** 팀 최근 라인업(bp_team_recent_lineups의 한 행)을 현재 entry에 적용.
   *  - 타순 9명: rosterId 매칭되는 선수만 채움. 매칭 실패 자리는 비워두고 토스트로 알림.
   *  - 선발 투수: starter_roster_id 매칭되면 pitcherSlots[0]에 세팅(나머지 불펜은 유지). */
  const applyRecentLineup = (row: RecentLineupRow) => {
    if (!currentEntry || currentEntry.isPublished) return;

    const sorted = [...row.batting].sort((a, b) => a.order - b.order);
    const nextSlots: SlotState[] = Array.from({ length: 9 }, () => null);
    let missed = 0;
    sorted.forEach((b, idx) => {
      if (idx >= 9) return;
      if (b.rosterId && playersById.has(b.rosterId)) {
        const fallback = playersById.get(b.rosterId)!.primaryPosition;
        // 한자 표기("三一" 등 경기 중 포지션 교체) 첫 글자 매핑 + 영문 코드 통과.
        const pos: Position = normalizeKboPosition(b.position) ?? fallback;
        nextSlots[idx] = {
          order: (idx + 1) as LineupOrder,
          playerId: b.rosterId,
          position: pos
        };
      } else {
        missed += 1;
      }
    });
    setSlots(nextSlots);
    setSwapOrderSourceIdx(null);
    setSwapSource(null);

    const starterId = row.starter_roster_id;
    if (starterId && playersById.has(starterId)) {
      setPitcherSlots((current) => current.map((id, i) => (i === PITCHER_STARTER_INDEX ? starterId : id)));
    }

    // 타자 9명 + 선발이 한 번에 채워지면 step1(타순 완성) 안내는 건너뛰고
    // step2(공개 준비 완료)만 뜨도록 step1을 미리 "본 것"으로 표시한다.
    if (starterId && playersById.has(starterId)) {
      markGuideSeen("step1", currentEntry.entryId);
    }

    // 타자 모드로 전환해 적용 결과를 바로 확인할 수 있게 함
    setMode("batter");

    if (missed > 0) {
      showToast(`${9 - missed}명 적용. ${missed}자리는 로스터 변경으로 비워뒀어요.`);
    } else {
      showToast("최근 라인업을 불러왔어요.");
    }
  };

  /** "최근 라인업 불러오기" 모달에서 행을 선택했을 때. 기존 슬롯이 있으면 confirm 모달로 한 번 더 확인. */
  const handleRecentLineupPick = (row: RecentLineupRow) => {
    const hasFilledBatter = slots.some((s) => s !== null);
    const hasStarter = pitcherSlots[PITCHER_STARTER_INDEX] !== null;
    setRecentPickerOpen(false);
    if (hasFilledBatter || hasStarter) {
      setPendingRecentLineup(row);
    } else {
      applyRecentLineup(row);
    }
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
  // 공개 가능 조건 — 타선 9명 + 선발 1명. 마무리/불펜은 공개 시 자동 채움.
  const hasStarter = pitcherSlots[PITCHER_STARTER_INDEX] != null;
  const hasCloser = pitcherSlots[PITCHER_CLOSER_INDEX] != null;
  const hasRequiredBullpen = pitcherSlots[PITCHER_REQUIRED_BULLPEN_INDEX] != null;
  const hasRequiredPitchers = hasStarter; // 가이드 트리거용 — 선발만 있으면 공개 가능
  const publishRequirementMessage = filledCount !== 9
    ? "타자 9명을 모두 채워야 공개할 수 있어요"
    : !hasStarter
      ? "선발 투수를 골라야 공개할 수 있어요"
      : null;
  const canPublish = publishRequirementMessage === null;
  // 마무리/불펜 중 하나라도 비어있으면 공개 시 자동 채움 안내가 필요한 상태.
  const needsAutoFillNotice = canPublish && pitcherSlots.slice(PITCHER_CLOSER_INDEX).some((id) => !id);

  // 슬롯별 가이드 트리거 상태 추적 — transition(0~8→9, false→true)만 캐치.
  // 첫 마운트(prev 없음)는 무시 → 기존 슬롯이 페이지 진입 시 즉시 popup되는 것 차단.
  const guideTrackRef = useRef<Map<string, { filledCount: number; hasRequiredPitchers: boolean }>>(new Map());

  useEffect(() => {
    if (!currentEntry) return;
    const key = currentEntry.entryId;
    const prev = guideTrackRef.current.get(key);
    guideTrackRef.current.set(key, { filledCount, hasRequiredPitchers });
    if (currentEntry.isPublished) return;
    if (!prev) return; // 슬롯 첫 추적은 트리거 X (기존 슬롯 보호)

    // step1: 타순 미완성 → 9명 완성
    if (prev.filledCount < 9 && filledCount === 9 && !hasSeenGuide("step1", key)) {
      markGuideSeen("step1", key);
      setGuideStep1Open(true);
      return;
    }
    // step2: 필수 투수 슬롯이 모두 채워짐 (타순 9 + step1 안내 본 후)
    if (!prev.hasRequiredPitchers && hasRequiredPitchers && filledCount === 9
        && hasSeenGuide("step1", key) && !hasSeenGuide("step2", key)) {
      markGuideSeen("step2", key);
      setGuideStep2Open(true);
    }
  }, [currentEntry?.entryId, currentEntry?.isPublished, filledCount, hasRequiredPitchers]);


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
    <AppShell activeTab="play" title="라인업 짜기" theme="light" backHref="/" wide>
      <header className="lineup-header lineup-header-no-back">
        {/* 헤더 좌측: 동기화 상태 배지 (이전 공개 토글 자리. 공개/비공개 개념은 "경기장 등록"으로 대체됨) */}
        <div className={`lineup-sync-badge is-${syncStatus}`} title={
          syncStatus === "local-only" ? "이 기기에만 저장 — 로그인하면 다른 기기에서도 사용 가능" :
          syncStatus === "synced" ? "DB와 동기화됨 — 다른 기기에서도 사용 가능" :
          syncStatus === "loading" ? "동기화 중..." :
          "동기화 실패 (이 기기 저장은 정상)"
        }>
          {syncStatus === "loading" ? <Loader2 size={12} className="lineup-sync-spin" /> :
           syncStatus === "synced" ? <Cloud size={12} /> :
           syncStatus === "local-only" ? <HardDrive size={12} /> :
           <CloudOff size={12} />}
          <span>{
            syncStatus === "loading" ? "동기화 중" :
            syncStatus === "synced" ? "동기화됨" :
            syncStatus === "local-only" ? "이 기기만" :
            "동기화 실패"
          }</span>
        </div>

        {/* 슬롯 picker — 현재 슬롯 + 드롭다운으로 다른 슬롯 / 새 슬롯 / 이름 편집 / 삭제 */}
        <div className="lineup-slot-picker" ref={slotPickerRef}>
          <button
            type="button"
            className="lineup-slot-trigger"
            aria-haspopup="listbox"
            aria-expanded={slotMenuOpen}
            onClick={() => setSlotMenuOpen((open) => !open)}
          >
            {currentEntry ? (
              <>
                <TeamBadge teamId={currentEntry.teamId} size="sm" />
                <strong className="lineup-slot-trigger-name">{currentEntry.name}</strong>
              </>
            ) : (
              <strong className="lineup-slot-trigger-empty">슬롯을 만드세요</strong>
            )}
            <ChevronDown size={16} className={slotMenuOpen ? "lineup-slot-chevron-open" : ""} />
          </button>
          {slotMenuOpen ? (
            <ul className="lineup-slot-menu" role="listbox" aria-label="라인업 슬롯">
              {entries.map((entry) => {
                const active = entry.entryId === selectedEntryId;
                const stats = statsByEntryId[entry.entryId];
                return (
                  <li key={entry.entryId} className="lineup-slot-menu-item-wrap">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`lineup-slot-menu-item ${active ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedEntryId(entry.entryId);
                        setSlotMenuOpen(false);
                      }}
                    >
                      <TeamBadge teamId={entry.teamId} size="sm" />
                      <span className="lineup-slot-menu-name">{entry.name}</span>
                      <span className="lineup-slot-menu-record">
                        {stats && stats.matches > 0
                          ? `${stats.wins}승 ${stats.losses}패`
                          : "0승 0패"}
                      </span>
                      {entry.isPublished ? (
                        <span className="lineup-slot-menu-badge is-public" title="공개 중">공개</span>
                      ) : (
                        <span className="lineup-slot-menu-badge" title="비공개">비공개</span>
                      )}
                    </button>
                    <div className="lineup-slot-menu-actions">
                      <button
                        type="button"
                        className="lineup-slot-action-btn"
                        aria-label="이름 변경"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingEntryId(entry.entryId);
                          setRenameInput(entry.name);
                          setSlotMenuOpen(false);
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="lineup-slot-action-btn lineup-slot-action-btn-danger"
                        aria-label="삭제"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteEntryId(entry.entryId);
                          setSlotMenuOpen(false);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                );
              })}
              {entries.length < lineupLimit ? (
                <li>
                  <button
                    type="button"
                    className="lineup-slot-menu-item lineup-slot-menu-add"
                    onClick={() => {
                      setNewSlotTeamId(initialTeamId);
                      setNewSlotName("");
                      setNewSlotOpen(true);
                      setSlotMenuOpen(false);
                    }}
                  >
                    <Plus size={14} />
                    <span>새 라인업 슬롯</span>
                  </button>
                </li>
              ) : (
                <li className="lineup-slot-menu-cap">
                  {TIER_LABEL[tier]} 등급은 최대 {lineupLimit}개까지 저장
                </li>
              )}
            </ul>
          ) : null}
        </div>
        {/* 헤더 우측: 공유 버튼 (이전 동기화 배지 자리) */}
        <button
          type="button"
          className="lineup-action-btn lineup-action-btn-primary lineup-header-share"
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={12} />
          공유
        </button>
      </header>

      <div className={`lineup-layout ${currentEntry?.isPublished ? "is-locked" : ""}`}>
        {/* 야구장 다이아몬드 — 타자 모드: 9수비, 투수 모드: 선발만 P 표시 */}
        <section
          className="lineup-diamond-card"
          aria-label={mode === "batter" ? "수비 위치" : "선발 투수"}
          onClick={currentEntry?.isPublished ? () => setLockInfoOpen(true) : undefined}
        >
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
          {currentEntry?.isPublished ? (() => {
            const stats = statsByEntryId[currentEntry.entryId];
            const wins = stats?.wins ?? 0;
            const losses = stats?.losses ?? 0;
            return (
              <p className="lineup-action-hint lineup-action-hint-published">
                🔒 공개 라인업 · {wins}승 {losses}패
              </p>
            );
          })() : currentEntry ? (
            <button
              type="button"
              className="lineup-recent-load-btn"
              onClick={() => setRecentPickerOpen(true)}
              title={`${selectedTeam.shortName}이(가) 최근 경기에서 실제로 쓴 선발 라인업으로 자동 세팅`}
            >
              <History size={12} />
              <span>실제 경기 라인업 불러오기</span>
            </button>
          ) : null}
          <div className="lineup-action-buttons">
            {/* 타자/투수 토글 — 공유 옆에 배치 */}
            <div className="lineup-mode-toggle lineup-mode-toggle-inline" role="tablist" aria-label="라인업 종류">
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
            {/* 공개/비공개 토글 */}
            {(() => {
              if (!currentEntry) return null;
              const isOn = !!currentEntry.isPublished;
              // 익명도 DB sync되므로 syncStatus가 "synced"면 통과. "local-only"는 sync 실패 fallback.
              const canSync = syncStatus !== "local-only";
              // 공개 조건 미충족은 클릭 시 안내한다. 이미 공개 중이면 세션을 재확인해 비공개 전환을 시도한다.
              const disabled = publishProcessing || (!isOn && !canSync);
              const tip = !canSync
                ? "잠시 후 다시 시도해주세요"
                : isOn
                  ? "공개 중 — 다른 사람이 도전 가능. 클릭하여 비공개로 (전적 리셋)"
                  : publishRequirementMessage ?? "공개로 바꾸면 다른 사람이 도전할 수 있어요";
              return (
                <button
                  type="button"
                  className={`lineup-action-btn ${isOn ? "lineup-action-btn-published" : "lineup-action-btn-primary"}`}
                  disabled={disabled}
                  title={tip}
                  onClick={async () => {
                    if (!currentEntry) return;
                    // 비공개로 가는 경우 확인 모달 (전적 리셋 안내)
                    if (isOn) {
                      setConfirmUnpublishOpen(true);
                      return;
                    }
                    if (!canPublish) {
                      showToast(publishRequirementMessage ?? "공개 조건을 확인해주세요.");
                      return;
                    }
                    // 마무리/불펜 중 빈 자리가 있으면 자동 채움 안내 모달부터.
                    if (needsAutoFillNotice) {
                      setConfirmAutoFillOpen(true);
                      return;
                    }
                    // 모두 채워져 있으면 즉시 공개
                    setPublishProcessing(true);
                    const res = await togglePublished(currentEntry.entryId, true);
                    setPublishProcessing(false);
                    if (!res.ok) showToast(res.error ?? "공개 전환 실패");
                    else showToast("공개됐어요");
                  }}
                >
                  {isOn ? <Eye size={12} /> : <EyeOff size={12} />}
                  {isOn ? "공개 중" : "공개하기"}
                </button>
              );
            })()}
          </div>
          {/* PC 와이드 모드에서만 노출 — 대기 선수 카드 헤더 자리 절약. 모바일은 풀 카드 자체에 헤더 유지. */}
          <div className="lineup-action-pool-badge" aria-hidden="true">
            <strong>대기</strong>
            <span className="lineup-section-count">{poolPlayers.length}</span>
          </div>
        </div>

        {/* 슬롯 카드 — 타자: 1~9 타순 / 투수: 선발 + 마무리 + 불펜 1~7 */}
        {mode === "batter" ? (
          <section className="lineup-slots-card" aria-label="타순" onClick={currentEntry?.isPublished ? () => setLockInfoOpen(true) : undefined}>
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
                    className={`lineup-slot ${slot ? "lineup-slot-filled" : "lineup-slot-empty lineup-slot-required"} ${orderSelected ? "lineup-slot-selected" : ""} ${swapAnimClass}`}
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
                        <span className="lineup-slot-placeholder">타자 필수</span>
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
            {!currentEntry?.isPublished && filledCount > 0 ? (
              <p className="lineup-slot-foot-hint">
                삭제나 순서를 변경하려면 <strong>슬롯을 선택</strong>
              </p>
            ) : null}
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
                      onClick={() => handleOrderClick(idx)}
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
            {!currentEntry?.isPublished && pitcherFilled > 0 ? (
              <p className="lineup-slot-foot-hint">
                삭제나 순서를 변경하려면 <strong>슬롯을 선택</strong>
              </p>
            ) : null}
          </section>
        )}

        <section
          className="lineup-pool-card lineup-pool-card-side"
          aria-label="대기 선수"
          onClick={currentEntry?.isPublished ? () => setLockInfoOpen(true) : undefined}
        >
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

      {/* 팀 최근 라인업 불러오기 — bp_team_recent_lineups의 최근 10경기 표시 */}
      <RecentLineupPickerModal
        open={recentPickerOpen}
        teamId={selectedTeamId}
        onClose={() => setRecentPickerOpen(false)}
        onPick={handleRecentLineupPick}
      />

      {/* 마무리/불펜 자동 채움 안내 모달 — 빈 자리만 자동 채워서 공개 */}
      <ModalShell
        open={confirmAutoFillOpen}
        title="마무리·불펜 자동 채움"
        onClose={() => setConfirmAutoFillOpen(false)}
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
              onClick={() => setConfirmAutoFillOpen(false)}
              disabled={publishProcessing}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              disabled={publishProcessing}
              onClick={async () => {
                if (!currentEntry) return;
                // 빈 자리 자동 채움 → state + DB 모두 반영. 이후 공개 토글.
                const filled = fillMissingPitcherSlots(currentEntry.teamId, pitcherSlots);
                if (!filled) {
                  showToast("투수 자동 채움 실패");
                  return;
                }
                setPitcherSlots(filled.slots);
                setPublishProcessing(true);
                // pitcherSlots state는 비동기라 sync useEffect가 처리하기 전에 togglePublished가
                // 실행되면 빈 자리 그대로 DB에 남을 수 있다. 따라서 entry 전체를 직접 upsert.
                const now = new Date().toISOString();
                const updated: LineupEntry = {
                  ...currentEntry,
                  pitching: filled,
                  updatedAt: now
                };
                syncedUpsert(updated);
                const res = await togglePublished(currentEntry.entryId, true);
                setPublishProcessing(false);
                setConfirmAutoFillOpen(false);
                if (!res.ok) showToast(res.error ?? "공개 전환 실패");
                else showToast("공개됐어요");
              }}
            >
              자동 채움 + 공개
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 기존 슬롯이 채워져 있을 때 덮어쓰기 확인 */}
      <ModalShell
        open={pendingRecentLineup !== null}
        title="현재 라인업 덮어쓰기"
        onClose={() => setPendingRecentLineup(null)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            지금 짜둔 라인업을 <strong>최근 경기 라인업으로 덮어쓸까요?</strong><br />
            기존 타순·선발은 사라집니다. (불펜은 유지)
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setPendingRecentLineup(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              onClick={() => {
                if (pendingRecentLineup) applyRecentLineup(pendingRecentLineup);
                setPendingRecentLineup(null);
              }}
            >
              덮어쓰기
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 공개 → 비공개 전환 확인 모달 (전적 리셋 안내) */}
      <ModalShell
        open={confirmUnpublishOpen}
        title="비공개로 전환"
        onClose={() => setConfirmUnpublishOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            {(() => {
              const stats = currentEntry ? statsByEntryId[currentEntry.entryId] : undefined;
              const wins = stats?.wins ?? 0;
              const losses = stats?.losses ?? 0;
              const draws = stats?.draws ?? 0;
              return (
                <>
                  비공개로 전환하면 이 라인업의 <strong>현재 전적({wins}승 {losses}패 {draws}무)이 모두 리셋</strong>됩니다.<br />
                  그래도 비공개로 바꿀까요?
                </>
              );
            })()}
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setConfirmUnpublishOpen(false)}
              disabled={publishProcessing}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              disabled={publishProcessing}
              onClick={async () => {
                if (!currentEntry) return;
                setPublishProcessing(true);
                const res = await togglePublished(currentEntry.entryId, false);
                setPublishProcessing(false);
                setConfirmUnpublishOpen(false);
                if (!res.ok) showToast(res.error ?? "비공개 전환 실패");
                else showToast("비공개로 바꿨어요 (전적 리셋)");
              }}
            >
              비공개로
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 공개 라인업 잠금 안내 모달 — 슬롯/풀/다이아몬드 클릭 시 */}
      <ModalShell
        open={lockInfoOpen}
        title="공개 라인업은 수정할 수 없어요"
        onClose={() => setLockInfoOpen(false)}
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
              onClick={() => setLockInfoOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              onClick={() => {
                // 전적 리셋이 중요하므로 한 번 더 확인 모달 띄움
                setLockInfoOpen(false);
                setConfirmUnpublishOpen(true);
              }}
            >
              비공개로 전환
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 새 슬롯 onboarding step1 — 타순 9명 완성 직후, "다음은 필수 투수" 안내 */}
      <ModalShell
        open={guideStep1Open}
        title="타순 9명을 다 채웠습니다"
        onClose={() => setGuideStep1Open(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            이제 <strong>선발 투수</strong>만 선택하면 라인업을 공개할 수 있어요.<br />
            (마무리·불펜은 공개 시 자동으로 채워집니다)
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setGuideStep1Open(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              onClick={() => {
                setGuideStep1Open(false);
                setMode("pitcher");
                setSwapSource(null);
              }}
            >
              확인
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 새 슬롯 onboarding step2 — 선발 투수까지 선택 직후, "이제 공개해서 가상경기" 안내 + 자동 공개.
          마무리/불펜이 비어있으면 saves/era 기준으로 자동 채워서 함께 저장. */}
      <ModalShell
        open={guideStep2Open}
        title="라인업 준비 완료!"
        onClose={() => setGuideStep2Open(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            이제 라인업을 <strong>공개</strong>해서 경기장에서 다른 사람 라인업과 가상경기를 할 수 있어요.<br />
            {needsAutoFillNotice ? (
              <>
                <br />
                마무리·불펜 빈 자리는 자동으로 채워집니다.
              </>
            ) : null}
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setGuideStep2Open(false)}
              disabled={publishProcessing}
            >
              닫기
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              disabled={publishProcessing}
              onClick={async () => {
                if (!currentEntry) return;
                setPublishProcessing(true);
                // 마무리/불펜 빈 자리 있으면 자동 채워서 entry 전체 upsert
                if (needsAutoFillNotice) {
                  const filled = fillMissingPitcherSlots(currentEntry.teamId, pitcherSlots);
                  if (filled) {
                    setPitcherSlots(filled.slots);
                    const now = new Date().toISOString();
                    syncedUpsert({
                      ...currentEntry,
                      pitching: filled,
                      updatedAt: now
                    });
                  }
                }
                const res = await togglePublished(currentEntry.entryId, true);
                setPublishProcessing(false);
                setGuideStep2Open(false);
                if (!res.ok) showToast(res.error ?? "공개 전환 실패");
                else showToast("공개됐어요");
              }}
            >
              확인
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 새 슬롯 만들기 모달 */}
      <ModalShell
        open={newSlotOpen}
        title="새 라인업 슬롯"
        onClose={() => setNewSlotOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">선수 풀로 사용할 팀과 우리 팀명을 정해주세요.</p>
          <div className="lineup-slot-team-grid">
            {teams.map((team) => {
              const seeded = seededTeamIds.has(team.id);
              const active = team.id === newSlotTeamId;
              return (
                <button
                  key={team.id}
                  type="button"
                  className={`lineup-slot-team-choice ${active ? "is-active" : ""} ${!seeded ? "is-disabled" : ""}`}
                  disabled={!seeded}
                  onClick={() => setNewSlotTeamId(team.id)}
                >
                  <TeamBadge teamId={team.id} size="sm" />
                  <span>{team.shortName}</span>
                </button>
              );
            })}
          </div>
          <label className="lineup-newslot-name-label" htmlFor="newslot-team-name">
            팀명 (선택)
          </label>
          <input
            id="newslot-team-name"
            type="text"
            className="lineup-rename-input"
            value={newSlotName}
            onChange={(e) => setNewSlotName(e.target.value)}
            placeholder={`예) ${profile.nickname?.trim() ? `${profile.nickname.trim()}의 ${getTeam(newSlotTeamId).shortName}` : getTeam(newSlotTeamId).name}`}
            maxLength={20}
          />
          <p className="lineup-newslot-name-hint">
            비워두면 &lsquo;
            {profile.nickname?.trim()
              ? `${profile.nickname.trim()}의 ${getTeam(newSlotTeamId).shortName}`
              : getTeam(newSlotTeamId).name}
            &rsquo;으로 저장됩니다. 경기 화면에도 표시되는 이름입니다.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setNewSlotOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              onClick={() => {
                // 새 슬롯은 빈 라인업이므로 localStorage만 — 9명 채울 때 DB로 첫 commit.
                const newEntry = createEmptyEntry(
                  newSlotTeamId,
                  newSlotName.trim() || undefined,
                  profile.nickname
                );
                localUpsertEntry(newEntry);
                setSelectedEntryId(newEntry.entryId);
                setMode("batter"); // 새 슬롯은 타자부터 채우도록 토글 자동
                setNewSlotOpen(false);
              }}
            >
              만들기
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 슬롯 이름 변경 모달 */}
      <ModalShell
        open={renamingEntryId !== null}
        title="팀명 변경"
        onClose={() => setRenamingEntryId(null)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">경기 화면에 표시될 우리 팀명을 입력하세요.</p>
          <input
            type="text"
            className="lineup-rename-input"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            placeholder="팀명"
            maxLength={20}
            autoFocus
          />
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setRenamingEntryId(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-primary"
              onClick={() => {
                if (renamingEntryId && renameInput.trim()) {
                  syncedRename(renamingEntryId, renameInput.trim());
                }
                setRenamingEntryId(null);
              }}
            >
              저장
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 슬롯 삭제 확인 모달 */}
      <ModalShell
        open={confirmDeleteEntryId !== null}
        title="라인업 삭제"
        onClose={() => setConfirmDeleteEntryId(null)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            이 라인업을 삭제할까요?<br />
            저장된 타순과 투수 라인업이 함께 사라집니다.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setConfirmDeleteEntryId(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              onClick={() => {
                if (!confirmDeleteEntryId) return;
                const entryToDelete = confirmDeleteEntryId;
                setConfirmDeleteEntryId(null);
                setDeleteStatus({ phase: "deleting" });
                const next = syncedDelete(entryToDelete, {
                  onSyncResult: (res) => {
                    if (res.ok) {
                      setDeleteStatus({ phase: "success" });
                      // 1.5초 후 자동 닫기
                      setTimeout(() => setDeleteStatus({ phase: "idle" }), 1500);
                    } else {
                      setDeleteStatus({ phase: "error", error: res.error });
                    }
                  }
                });
                if (selectedEntryId === entryToDelete) {
                  setSelectedEntryId(next[0]?.entryId ?? null);
                }
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </ModalShell>

      {/* 삭제 진행/결과 모달 — 사용자가 DB sync 완료 여부 알 수 있게.
          deleting: 스피너 + "삭제 중...". success: ✓ + "삭제 완료" (1.5초 자동 닫기).
          error: ⚠ 메시지 + 확인 버튼. */}
      <ModalShell
        open={deleteStatus.phase !== "idle"}
        title="라인업 삭제"
        onClose={() => {
          // 진행 중에는 닫을 수 없음. 성공/실패만 닫기 허용.
          if (deleteStatus.phase !== "deleting") setDeleteStatus({ phase: "idle" });
        }}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop={deleteStatus.phase !== "deleting"}
      >
        <div className="lineup-delete-status">
          {deleteStatus.phase === "deleting" ? (
            <>
              <Loader2 size={28} className="lineup-delete-status-spinner" />
              <p className="lineup-delete-status-msg">삭제 중...</p>
            </>
          ) : deleteStatus.phase === "success" ? (
            <>
              <Check size={28} strokeWidth={3} className="lineup-delete-status-check" />
              <p className="lineup-delete-status-msg">삭제 완료</p>
            </>
          ) : deleteStatus.phase === "error" ? (
            <>
              <X size={28} strokeWidth={3} className="lineup-delete-status-error-icon" />
              <p className="lineup-delete-status-msg">
                {deleteStatus.error === "offline"
                  ? "동기화가 멈춰있어요"
                  : "삭제 실패"}
              </p>
              <p className="lineup-delete-status-error">
                {deleteStatus.error === "offline"
                  ? "로그인 상태를 확인 중이에요. 잠시 후 다시 시도해 주세요. (로컬에서는 삭제됨)"
                  : deleteStatus.error}
              </p>
              <button
                type="button"
                className="lineup-confirm-cancel"
                onClick={() => setDeleteStatus({ phase: "idle" })}
              >
                확인
              </button>
            </>
          ) : null}
        </div>
      </ModalShell>
    </AppShell>
  );
}
